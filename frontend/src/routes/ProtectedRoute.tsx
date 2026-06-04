import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { clearAuthSession, ensureSessionExpiry, getCurrentUser, getSessionExpiresAt, isSessionExpired } from "../services/api";

type RequiredRole = "Traveler" | "Host" | "Admin";

interface ProtectedRouteProps {
  roles: RequiredRole[];
  children: JSX.Element;
}

function landingForRole(role?: string) {
  if (role === "Host") return "/host";
  if (role === "Admin") return "/admin";
  return "/dashboard";
}

export function ProtectedRoute({ roles, children }: ProtectedRouteProps) {
  const requireAuth = import.meta.env.VITE_REQUIRE_AUTH === "true";
  const [state, setState] = useState<{ loading: boolean; role?: string; authenticated: boolean }>({
    loading: requireAuth,
    authenticated: Boolean(getSessionExpiresAt())
  });

  useEffect(() => {
    if (!requireAuth) {
      setState({ loading: false, authenticated: true, role: roles[0] });
      return;
    }

    if (isSessionExpired()) {
      clearAuthSession();
      setState({ loading: false, authenticated: false });
      return;
    }
    getCurrentUser()
      .then((user) => {
        ensureSessionExpiry();
        setState({ loading: false, authenticated: true, role: user.role });
      })
      .catch(() => setState({ loading: false, authenticated: false }));
  }, [requireAuth, roles]);

  if (state.loading) {
    return <div className="min-h-screen bg-sand" />;
  }

  if (!state.authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!state.role || !roles.includes(state.role as RequiredRole)) {
    return <Navigate to={landingForRole(state.role)} replace />;
  }

  return children;
}
