import { AnimatePresence } from "framer-motion";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import {
  AdminDashboard,
  BookingPage,
  EmailVerificationPage,
  ForgotPasswordPage,
  HostAnalyticsPage,
  HostCalendarPage,
  HostDashboard,
  HostEarningsPage,
  HostListingsPage,
  HostOnboarding,
  HostProfilePage,
  HostReservationsPage,
  HostReviewsPage,
  HostSettingsPage,
  LandingPage,
  LoginPage,
  MessagesPage,
  MyReservationsPage,
  OAuthCallbackPage,
  PropertyDetails,
  RegisterPage,
  SearchResults,
  TravelerPaymentsPage,
  TravelerProfilePage,
  TravelerReviewsPage,
  TravelerSettingsPage,
  TravelerWishlistPage,
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
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/dashboard" element={<ProtectedRoute roles={["Traveler"]}><UserDashboard /></ProtectedRoute>} />
        <Route path="/dashboard/wishlist" element={<ProtectedRoute roles={["Traveler"]}><TravelerWishlistPage /></ProtectedRoute>} />
        <Route path="/dashboard/payments" element={<ProtectedRoute roles={["Traveler"]}><TravelerPaymentsPage /></ProtectedRoute>} />
        <Route path="/dashboard/reviews" element={<ProtectedRoute roles={["Traveler"]}><TravelerReviewsPage /></ProtectedRoute>} />
        <Route path="/dashboard/profile" element={<ProtectedRoute roles={["Traveler"]}><TravelerProfilePage /></ProtectedRoute>} />
        <Route path="/dashboard/settings" element={<ProtectedRoute roles={["Traveler"]}><TravelerSettingsPage /></ProtectedRoute>} />
        <Route path="/reservations" element={<ProtectedRoute roles={["Traveler"]}><MyReservationsPage /></ProtectedRoute>} />
        <Route path="/host" element={<ProtectedRoute roles={["Host"]}><HostDashboard /></ProtectedRoute>} />
        <Route path="/host/listings" element={<ProtectedRoute roles={["Host"]}><HostListingsPage /></ProtectedRoute>} />
        <Route path="/host/reservations" element={<ProtectedRoute roles={["Host"]}><HostReservationsPage /></ProtectedRoute>} />
        <Route path="/host/calendar" element={<ProtectedRoute roles={["Host"]}><HostCalendarPage /></ProtectedRoute>} />
        <Route path="/host/earnings" element={<ProtectedRoute roles={["Host"]}><HostEarningsPage /></ProtectedRoute>} />
        <Route path="/host/reviews" element={<ProtectedRoute roles={["Host"]}><HostReviewsPage /></ProtectedRoute>} />
        <Route path="/host/analytics" element={<ProtectedRoute roles={["Host"]}><HostAnalyticsPage /></ProtectedRoute>} />
        <Route path="/host/settings" element={<ProtectedRoute roles={["Host"]}><HostSettingsPage /></ProtectedRoute>} />
        <Route path="/host/onboarding" element={<ProtectedRoute roles={["Host"]}><HostOnboarding /></ProtectedRoute>} />
        <Route path="/hosts/:id" element={<HostProfilePage />} />
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
