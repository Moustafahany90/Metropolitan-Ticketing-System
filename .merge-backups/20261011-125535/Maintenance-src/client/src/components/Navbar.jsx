import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Wrench, LogOut } from 'lucide-react';
import { RoleBadge } from './Badge';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [logoOk, setLogoOk] = useState(true);

  return (
    <header className="sticky top-0 z-40 border-b border-mms-border bg-white">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between gap-4 px-4 lg:px-8">
        <div className="flex items-center gap-3">
          {logoOk ? (
            <img
              src="/logo/metropolitan-logo.png"
              alt="Metropolitan School"
              className="h-9 w-auto"
              onError={() => setLogoOk(false)}
            />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mms-primary-soft">
              <Wrench size={20} className="text-mms-primary" />
            </div>
          )}
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-[11px] font-medium uppercase tracking-wider text-mms-ink-muted">
              Maintenance
            </span>
            <span className="font-display text-sm font-semibold text-mms-ink">
              Metropolitan Maintenance System
            </span>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2.5 md:flex">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-mms-primary-soft text-sm font-semibold text-mms-primary-dark">
                {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium text-mms-ink">
                  {user.displayName || user.username}
                </span>
                <span className="text-xs text-mms-ink-muted">
                  {user.department || 'Staff Member'}
                </span>
              </div>
            </div>
            <RoleBadge role={user.role} />
            <button
              onClick={logout}
              className="btn-outline h-9 px-3 text-[13px]"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
