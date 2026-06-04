import { Clock3, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  clearAuthSession,
  extendSession,
  getSessionExpiresAt,
  getSessionTimeRemaining,
  isSessionExpired,
  logout
} from "../../services/api";
import { Button, buttonStyles } from "../ui/button";

const WARNING_THRESHOLD_MS = 10 * 60 * 1000;
const POLL_INTERVAL_MS = 15 * 1000;

function formatRemaining(ms: number) {
  const safeMs = Math.max(0, ms);
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SessionManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const [remainingMs, setRemainingMs] = useState(0);
  const [visible, setVisible] = useState(false);
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    const tick = () => {
      if (!getSessionExpiresAt()) {
        setVisible(false);
        setRemainingMs(0);
        return;
      }

      const remaining = getSessionTimeRemaining();
      setRemainingMs(remaining);

      if (isSessionExpired()) {
        clearAuthSession();
        setVisible(false);
        navigate("/login", { replace: true, state: { from: location.pathname } });
        return;
      }

      setVisible(remaining <= WARNING_THRESHOLD_MS);
    };

    tick();
    const interval = window.setInterval(tick, POLL_INTERVAL_MS);
    window.addEventListener("storage", tick);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", tick);
    };
  }, [location.pathname, navigate]);

  if (!visible) {
    return null;
  }

  const handleExtend = async () => {
    setExtending(true);
    try {
      await extendSession();
      setVisible(false);
      setRemainingMs(getSessionTimeRemaining());
    } catch {
      clearAuthSession();
      navigate("/login", { replace: true, state: { from: location.pathname } });
    } finally {
      setExtending(false);
    }
  };

  const handleSignOut = async () => {
    await logout().catch(() => clearAuthSession());
    navigate("/login", { replace: true });
  };

  return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-xl">
      <div className="overflow-hidden rounded-lg border border-brand-200 bg-white shadow-float">
        <div className="flex gap-4 p-4 sm:p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Your session is ending soon</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Stay signed in to keep working without losing your current page.
                </p>
              </div>
              <div className="inline-flex shrink-0 items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-ink">
                <Clock3 className="h-4 w-4 text-brand-600" />
                {formatRemaining(remainingMs)}
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button onClick={handleExtend} disabled={extending}>
                {extending ? "Extending..." : "Stay signed in"}
              </Button>
              <button type="button" className={buttonStyles("ghost")} onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
