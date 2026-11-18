# Design & Branding Prompt — Metropolitan Maintenance System (MMS)

## 1. Context
You are designing the brand identity and UI system for **Metropolitan Maintenance System (MMS)**,
an internal maintenance management web app for **Metropolitan School** staff. It is not a
consumer product: it is a daily tool used by employees (report maintenance problems),
supervisors (assign them), maintenance workers (fix them), store keepers (release spare
parts), and admins (manage/oversee). Priorities: clarity, speed, trust, and institutional
credibility — not flashiness. Audience skews non-technical, so the UI must feel calm,
obvious, and school-administration professional.

**Terminology rule:** the noun is **request** ("New request", "Request list", "My requests").
Every request carries an auto-generated **ticket number** (`MNT-XXXXXX`). Never use "ticket"
as the noun, and never use IT-support jargon ("incident", "raise a ticket", "resolve a
case"). This is a facilities/maintenance tool.

## 2. Brand identity
- **Name:** Metropolitan Maintenance System (short form: MMS). Parent brand: Metropolitan School.
- **Positioning:** "The one place school staff report maintenance problems and get them fixed."
- **Personality:** dependable · helpful · clear · quietly modern · institutional-but-warm.
  Think "trusted school administration" meets "well-made SaaS tool".
- **Voice & copy:** plain, polite, direct. Sentence case. Short labels ("Sign in",
  "New request", "Assign", "Start work", "Release"). No jargon in user-facing text (say
  "report a problem", not "raise an incident"). Errors are calm and actionable, never blame
  the user.
- **Tagline options:** "Report it. Track it. Fixed." / "Maintenance, one place."

## 3. Logo direction
- Existing logo: `public/logo/metropolitan-logo.png` (wide horizontal lockup, transparent
  background). It is the anchor — build the system around it; do not redesign it unless asked.
- Motif vocabulary: purple + gold + teal geometry, black wordmark. Any icon/mark set should
  derive from the same shapes and colors (e.g., wrench, checkmark, shield, package).
- App usage rules: logo at 36px height in the header (left-aligned), 64px centered on the
  login card. Keep clear space equal to the cap height of the wordmark. Never recolor,
  stretch, or place on a busy background.

## 4. Color palette (tokens — author colors only here)
| Token | Hex | Role |
|---|---|---|
| `--mms-primary` | `#693198` | brand purple: primary buttons, active nav, links, focus rings |
| `--mms-primary-dark` | `#4f2174` | hover/pressed state of primary |
| `--mms-primary-soft` | `#f3eaf9` | tinted backgrounds, active nav pill, subtle highlights |
| `--mms-gold` | `#f4bb4c` | secondary accent: highlight/CTA variant, attention, brand warmth |
| `--mms-gold-soft` | `#fdf3dd` | gold tint backgrounds |
| `--mms-teal` | `#007f7d` | tertiary accent: success-adjacent, chart series, illustrations |
| `--mms-ink` | `#190721` | primary text (near-black with a purple cast) |
| `--mms-ink-muted` | `#5c5563` | secondary text, labels, captions |
| `--mms-bg` | `#ffffff` | page background |
| `--mms-surface` | `#f9f9f9` | alternate surface: page sections, hover rows, inputs on tinted bg |
| `--mms-border` | `#e5e1ea` | hairline borders and dividers |

Rules: purple = "primary action / brand"; gold = "look here" (sparingly); teal = "good/going
well"; never introduce a fourth brand hue. Semantic colors are reserved for status only.

## 5. Status & priority color language (semantic, fixed)
- Status: `SUBMITTED` → cyan-50/cyan-700 · `ASSIGNED` → blue-50/blue-700 ·
  `IN_PROGRESS` → amber-50/amber-700 · `COMPLETED` → green-50/green-700 ·
  `REJECTED` → red-50/red-700.
- Priority: `Normal` slate-100/slate-600 · `High` orange-50/orange-700 ·
  `Urgent` red-50/red-700.
- Render as small pill badges (rounded-full, 1px border, light tint bg, darker text, 12px).
  Semantic colors never appear on buttons, headings, or decorative elements.
- Role badges use brand/slate tokens only (never semantic status hues):
  Admin → purple · Supervisor → gold (dark ink text) · Maintenance Worker → teal ·
  Store Keeper → teal or slate · Employee → slate.

## 6. Typography
- **Headings:** Manrope (500/600/700) — geometric, friendly, confident. Tight tracking on
  large sizes (`tracking-tight` for h1/h2).
- **Body/UI:** Inter (400/500/600) — neutral, dense-data legible. 15–16px body, 14px UI,
  12–13px captions/metadata.
- Scale: h1 24px semibold/bold · h2 20px · card title 18px semibold · body 15px ·
  small/meta 12–13px muted. Tabular numerals for ticket IDs and dashboard metrics.
- Never use pure black text; always `--mms-ink` on white.

## 7. UI design language (light, calm, structured)
- **Layout:** centered max-width container (~1024–1152px), 16–32px gutters, 4px spacing
  base with 8/12/16/24/32 rhythm. Single-column forms; 2–5 column stat grids on dashboard.
- **Shell:** white top header (logo + product name + "Maintenance" eyebrow left; nav pills +
  user name/role + logout right), white footer strip, content on `--mms-bg`.
- **Cards:** white, `1px --mms-border` hairline, `rounded-xl`, `shadow-sm` only. No heavy
  shadows, no glassmorphism, no gradients on panels. Section titles inside cards, generous
  padding (24px).
- **Buttons:** `rounded-lg`, 40px height (44px for primary form submits). Primary = solid
  purple/white text, hover `primary-dark`. Outline = white + hairline border. Ghost =
  muted text. Gold variant reserved for a single attention CTA.
- **Inputs:** white, hairline border, `rounded-lg`, 40px, 14px text; focus = purple border +
  2px purple ring at 20% alpha; visible label above every field; placeholders are examples,
  not labels.
- **Icons:** Lucide, 16–20px, stroke 1.75–2, colored `ink-muted` unless carrying status color.
- **Data viz:** donut (status) + horizontal bars (category/priority/worker), using the
  status palette + purple/gold/teal series; legends with counts; no floating tooltips over
  the chart center.
- **States:** every screen defines loading (muted text/skeleton), empty ("No requests yet."
  + a CTA), and error (red-50/red-700 bordered alert with role="alert") states.
- **Motion:** minimal and functional — 150ms color/opacity transitions, a spinner on
  submit, no parallax or entrance animation cascades.

## 8. Accessibility
- WCAG AA contrast (4.5:1 body, 3:1 large text) — verify purple on white and gold on white
  (gold uses dark ink text, never white).
- Keyboard: visible purple focus ring on every interactive element; logical tab order.
- Never encode status/priority by color alone — always pair with the text label.
- Semantic HTML, labelled form controls, `aria-label` on icon-only buttons, alerts use
  `role="alert"`.

## 9. Deliverables
1. Brand mini-guideline (logo usage, color, type, voice) as a one-pager.
2. Design tokens file: CSS variables matching the `--mms-*` names above, bridged into
   Tailwind (`theme.extend` colors/fonts in `tailwind.config.js`). No hardcoded hex in
   components.
3. Component specs: Button, Card, Input/Select/Textarea, Badge (status, priority, role),
   StatCard, Nav pill, Alert, Empty state, Modal, Table, Tabs, Workflow timeline.
4. Screen specs: Login; Dashboard per role (Admin / Supervisor / Maintenance Worker /
   Store Keeper / Employee); Request list + filters; New request form; Request detail +
   workflow actions (receive, assign, start, complete, reject) + comment thread + audit
   timeline + spare-parts table.
5. Do/Don't sheet: no new accent hues, no hardcoded hex in components (use tokens),
   no dark-mode mixing, no decorative use of semantic colors.

## 10. Out of scope
Consumer/marketing landing page aesthetics, dark mode, illustrations of people, rebranding
the Metropolitan School logo, IT-support/ticketing product aesthetics.
