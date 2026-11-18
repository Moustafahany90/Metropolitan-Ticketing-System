/**
 * Microsoft Graph email test.
 *
 * Uses the same app-only client_credentials flow and /sendMail endpoint as
 * backend/src/services/email.service.ts, so a success here means the app's
 * email transport is configured correctly.
 *
 * Usage:
 *   node test-graph-email.js                    # sends to MICROSOFT_SENDER_EMAIL
 *   node test-graph-email.js someone@school.edu # sends to a specific address
 */

const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load root .env first (used by docker-compose), then backend/.env as fallback.
for (const f of [path.join(__dirname, '..', '.env'), path.join(__dirname, '.env')]) {
  if (fs.existsSync(f)) dotenv.config({ path: f });
}

const tenant = process.env.MICROSOFT_TENANT_ID;
const clientId = process.env.MICROSOFT_CLIENT_ID;
const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
const sender = process.env.MICROSOFT_SENDER_EMAIL;
const to = process.argv[2] || sender;

if (!tenant || !clientId || !clientSecret || !sender) {
  console.error('Missing Graph config. Need MICROSOFT_TENANT_ID, MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_SENDER_EMAIL.');
  process.exit(2);
}

(async () => {
  console.log('Microsoft Graph email test');
  console.log(`  Tenant   : ${tenant}`);
  console.log(`  ClientId : ${clientId}`);
  console.log(`  Sender   : ${sender}`);
  console.log(`  To       : ${to}`);

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  });

  console.log('\n[1/2] Requesting app-only access token...');
  const tr = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const ttext = await tr.text();
  if (!tr.ok) {
    console.error(`  FAILED (${tr.status}): ${ttext.slice(0, 600)}`);
    process.exit(1);
  }
  const tok = JSON.parse(ttext);
  let roles = [];
  try {
    roles = JSON.parse(Buffer.from(tok.access_token.split('.')[1], 'base64').toString()).roles || [];
  } catch { /* ignore */ }
  console.log(`  OK (expires_in=${tok.expires_in}s). App roles in token: ${roles.length ? roles.join(', ') : '(none)'}`);
  if (roles.length && !roles.includes('Mail.Send')) {
    console.log('  WARNING: token does not contain the Mail.Send role — the app registration may be missing the Graph "Mail.Send" application permission.');
  }

  console.log('\n[2/2] Sending test message via /sendMail...');
  const sr = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: '[MTS] Microsoft Graph email test',
        body: {
          contentType: 'Text',
          content: `This is a test message from the Metropolitan Ticketing System.\nSent at ${new Date().toISOString()}.`,
        },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });
  const stext = await sr.text();
  if (sr.ok) {
    console.log('  OK (202 Accepted). Graph accepted the message.');
    console.log('\nSUCCESS: Graph email transport is working.');
  } else {
    console.error(`  FAILED (${sr.status}): ${stext.slice(0, 900)}`);
    process.exit(1);
  }
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
