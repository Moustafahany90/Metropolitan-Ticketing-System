import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Wrench, Shield, Lock, User, AlertCircle, ArrowRight, WifiOff } from 'lucide-react';

const QUICK_DEV_USERS = [
  { username: 'employee', label: 'Employee', role: 'EMPLOYEE', dept: 'Elementary Education' },
  { username: 'supervisor', label: 'Supervisor', role: 'SUPERVISOR', dept: 'Facilities' },
  { username: 'worker', label: 'Maintenance Worker', role: 'WORKER', dept: 'Facilities' },
  { username: 'storekeeper', label: 'Store Keeper', role: 'STORE', dept: 'Inventory' },
  { username: 'admin', label: 'Admin', role: 'ADMIN', dept: 'IT' },
];

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [logoOk, setLogoOk] = useState(true);
  const [adStatus, setAdStatus] = useState(null);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    let isMounted = true;
    api
      .get('/auth/ad-status')
      .then((res) => {
        if (isMounted && res.data?.success) {
          setAdStatus(res.data.data);
        }
      })
      .catch(() => {
        // Silently catch ad-status probe errors to never break login
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setFormError('Please enter both your Active Directory username and password.');
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      const result = await login(username, password);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setFormError(result.error || 'Authentication failed. Please verify your credentials.');
      }
    } catch (err) {
      setFormError('Connection error. Could not contact authentication server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = (devUser) => {
    setUsername(devUser.username);
    setPassword('password123');
    setFormError('');
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-mms-surface px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          {logoOk ? (
            <img
              src="/logo/metropolitan-logo.png"
              alt="Metropolitan School"
              className="mb-4 h-16 w-auto"
              onError={() => setLogoOk(false)}
            />
          ) : (
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-mms-primary-soft">
              <Wrench size={32} className="text-mms-primary" />
            </div>
          )}
          <h1 className="font-display text-2xl font-bold">Metropolitan Maintenance System</h1>
          <p className="mt-1 text-sm text-mms-ink-muted">Report it. Track it. Fixed.</p>
        </div>

        <div className="card p-6 sm:p-8">
          <div className="mb-5">
            <h2 className="font-display text-lg font-semibold">Sign in</h2>
            <p className="mt-1 text-[13px] text-mms-ink-muted">
              Use your school domain credentials (@metschool.local)
            </p>
          </div>

          {adStatus && !adStatus.reachable && adStatus.authMode === 'ad' && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-50 px-3.5 py-3 text-sm text-amber-800"
            >
              <WifiOff size={18} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <span className="font-semibold">Active Directory server is currently unreachable.</span>
                <p className="mt-0.5 text-xs text-amber-700">If sign-in fails, please verify your network connection or contact the IT Helpdesk.</p>
              </div>
            </div>
          )}

          {formError && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-lg border border-red-700/30 bg-red-50 px-3.5 py-3 text-sm text-red-700"
            >
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="mms-label flex items-center gap-1.5">
                <User size={14} className="text-mms-ink-muted" />
                <span>Username (sAMAccountName)</span>
              </label>
              <input
                id="username"
                type="text"
                className="mms-input"
                placeholder="e.g. jdoe or teacher"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="mms-label flex items-center gap-1.5">
                <Lock size={14} className="text-mms-ink-muted" />
                <span>Password</span>
              </label>
              <input
                id="password"
                type="password"
                className="mms-input"
                placeholder="Enter your domain password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                disabled={isSubmitting}
                required
              />
            </div>

            <button
              type="submit"
              className="btn-primary btn-lg w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-6 rounded-lg border border-dashed border-mms-gold bg-mms-gold-soft px-4 py-3.5">
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-mms-ink">
                <Shield size={14} className="text-mms-ink-muted" />
                <span>Development quick fill</span>
              </div>
              <p className="mt-0.5 text-xs text-mms-ink-muted">
                Only shown in local development builds. Still authenticates against Active Directory.
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {QUICK_DEV_USERS.map((u) => (
                  <button
                    key={u.username}
                    type="button"
                    onClick={() => handleQuickLogin(u)}
                    className={`rounded-lg border px-2 py-1.5 text-center transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-mms-primary/20 ${
                      username === u.username
                        ? 'border-mms-primary bg-mms-primary-soft text-mms-primary-dark'
                        : 'border-mms-border bg-white text-mms-ink hover:bg-mms-surface'
                    }`}
                  >
                    <span className="block text-xs font-semibold">{u.label}</span>
                    <span className="block text-[11px] text-mms-ink-muted">{u.username}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col items-center text-center text-xs text-mms-ink-muted">
          <div className="mb-1 flex items-center gap-1.5 font-medium">
            {adStatus?.reachable ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                AD Server Connected ({adStatus.latencyMs}ms)
              </span>
            ) : adStatus ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                AD Server Unreachable
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px]">
                Authenticated through Metropolitan School Active Directory
              </span>
            )}
          </div>
          <p>© {new Date().getFullYear()} Metropolitan School • Internal Use Only</p>
          <p className="mt-0.5 text-[11px]">Credentials verified directly against Active Directory</p>
        </div>
      </div>
    </div>
  );
}

