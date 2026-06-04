import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import {
  AdminDashboard,
  BookingPage,
  EmailVerificationPage,
  ForgotPasswordPage,
  HostDashboard,
  HostOnboarding,
  LandingPage,
  LoginPage,
  MessagesPage,
  PropertyDetails,
  RegisterPage,
  SearchResults,
  UserDashboard
} from "../experience/pages";
import { ProtectedRoute } from "./ProtectedRoute";

export function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email" element={<EmailVerificationPage />} />
        <Route path="/dashboard" element={<ProtectedRoute roles={["Traveler"]}><UserDashboard /></ProtectedRoute>} />
        <Route path="/host" element={<ProtectedRoute roles={["Host"]}><HostDashboard /></ProtectedRoute>} />
        <Route path="/host/onboarding" element={<ProtectedRoute roles={["Host"]}><HostOnboarding /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={["Admin"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/messages" element={<ProtectedRoute roles={["Traveler", "Host", "Admin"]}><MessagesPage /></ProtectedRoute>} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/property/:id" element={<PropertyDetails />} />
        <Route path="/booking/:id" element={<ProtectedRoute roles={["Traveler"]}><BookingPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
