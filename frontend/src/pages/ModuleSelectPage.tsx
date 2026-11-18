import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Ticket, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ModuleCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  cta: string;
  disabled?: boolean;
  disabledHint?: string;
  onClick: () => void;
}

function ModuleCard({
  icon,
  title,
  description,
  cta,
  disabled,
  disabledHint,
  onClick,
}: ModuleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group block text-left",
        disabled && "cursor-not-allowed opacity-60"
      )}
    >
      <Card
        className={cn(
          "h-full transition-all",
          !disabled && "group-hover:border-primary group-hover:shadow-md"
        )}
      >
        <CardHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            {icon}
          </div>
          <CardTitle className="mt-3 text-lg">{title}</CardTitle>
          <CardDescription>{disabled && disabledHint ? disabledHint : description}</CardDescription>
        </CardHeader>
        <CardContent>
          <span className="text-sm font-semibold text-primary">
            {disabled ? "Unavailable" : cta}
          </span>
        </CardContent>
      </Card>
    </button>
  );
}

export default function ModuleSelectPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <img
        src="/logo/metropolitan-logo.png"
        alt="Metropolitan School logo"
        className="h-16 w-auto object-contain"
      />
      <h1 className="mt-4 font-heading text-2xl font-bold text-ink">Choose a module</h1>
      <p className="mt-1 text-center text-sm text-ink-muted">
        Signed in as <span className="font-medium text-ink">{user?.name}</span>
        {user?.roleLabel ? ` · ${user.roleLabel}` : ""}
      </p>

      <div className="mt-8 grid w-full max-w-3xl gap-5 sm:grid-cols-2">
        <ModuleCard
          icon={<Ticket className="h-6 w-6" />}
          title="IT Ticketing"
          description="Report an IT issue and track its progress with the support team."
          cta="Open IT Ticketing →"
          onClick={() => navigate("/dashboard")}
        />
        <ModuleCard
          icon={<Wrench className="h-6 w-6" />}
          title="Maintenance Management"
          description="Submit and manage facility and maintenance requests."
          cta="Open Maintenance →"
          disabled={!user?.maintenance}
          disabledHint="Your account is not linked to the maintenance system."
          onClick={() => navigate("/maintenance")}
        />
      </div>

      <Button variant="ghost" className="mt-8" onClick={handleLogout}>
        <LogOut />
        Sign out
      </Button>
    </div>
  );
}
