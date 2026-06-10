import axios from "axios";
import { storeSessionRole, clearStoredSessionRole } from "../auth/roles";
import type {
  AdminStats,
  Conversation,
  HostDashboard,
  Message,
  NotificationRecord,
  PaymentRecord,
  Property,
  PublicHostProfile,
  ReservationCalendarDay,
  TravelerDashboard,
  UserBooking,
  Wishlist
} from "../types/api";


const localApiBaseUrl =
  typeof window !== "undefined" && window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:8080/api"
    : "http://localhost:8080/api";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || localApiBaseUrl;
const SESSION_EXPIRES_AT_KEY = "ubook_session_expires_at";
const ACCESS_TOKEN_KEY = "ubook_access_token";
const REFRESH_TOKEN_KEY = "ubook_refresh_token";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;
type BrowserSessionStorage = "local" | "session";
const SESSION_STORAGE_MODE: BrowserSessionStorage =
  import.meta.env.VITE_AUTH_SESSION_STORAGE === "session" ? "session" : "local";

function getStorage(mode: BrowserSessionStorage): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return mode === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function getPreferredStorage(): Storage | null {
  return getStorage(SESSION_STORAGE_MODE) || getStorage("local") || getStorage("session");
}

function getFallbackStorage(): Storage | null {
  return getStorage(SESSION_STORAGE_MODE === "local" ? "session" : "local");
}

function setSessionItem(key: string, value: string) {
  getPreferredStorage()?.setItem(key, value);
}

function getSessionItem(key: string) {
  return getPreferredStorage()?.getItem(key) || getFallbackStorage()?.getItem(key) || null;
}

function removeSessionItem(key: string) {
  getStorage("local")?.removeItem(key);
  getStorage("session")?.removeItem(key);
}

function getAccessToken() {
  return getSessionItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken() {
  return getSessionItem(REFRESH_TOKEN_KEY);
}

function parseSessionExpiry(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value !== "string" || !value.trim()) return null;

  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    return numericValue > 10_000_000_000 ? numericValue : numericValue * 1000;
  }

  const parsedDate = Date.parse(value);
  return Number.isFinite(parsedDate) ? parsedDate : null;
}

function resolveSessionExpiry(data?: unknown): number {
  const payload = data as Record<string, unknown> | undefined;
  const session = payload?.session as Record<string, unknown> | undefined;
  const candidates = [
    payload?.refreshExpiresAt,
    payload?.refresh_expires_at,
    payload?.sessionExpiresAt,
    payload?.session_expires_at,
    payload?.expiresAt,
    payload?.expires_at,
    session?.expiresAt,
    session?.expires_at
  ];

  for (const candidate of candidates) {
    const expiresAt = parseSessionExpiry(candidate);
    if (expiresAt && expiresAt > Date.now()) {
      return expiresAt;
    }
  }

  return Date.now() + SESSION_DURATION_MS;
}
export interface PaymentOverview {
  totalPaid?: number;
  totalPending?: number;
  totalRefunded?: number;
  currency?: string;
  recentPayments?: unknown[];
}

export interface WalletAccount {
  id: string;
  balance: number;
  currency: string;
  status?: string;
}

export interface PaymentMethod {
  id: string;
  type: string;
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
}

export interface ReviewCenter {
  reviews?: unknown[];
  averageRating?: number;
  totalReviews?: number;
}

export interface SmartTravelFilter {
  key: string;
  value: string | number | boolean;
}

export interface SmartTravelFinderRequest {
  query?: string;
  destination?: string;
  dates?: {
    start?: string;
    end?: string;
  };
  guests?: number;
  filters?: SmartTravelFilter[];
}

export interface SmartTravelSearchResponse {
  results: unknown[];
  total?: number;
  filters?: SmartTravelFilter[];
}

export interface ConversationalTravelResponse {
  message: string;
  suggestions?: unknown[];
}

export interface DestinationComparisonResponse {
  destinations: unknown[];
  recommendation?: string;
}
const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});
let refreshPromise: Promise<unknown> | null = null;
client.interceptors.request.use((config) => {
  const accessToken = getAccessToken();
  if (accessToken) {
    config.headers = config.headers || {};
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  }
  const csrfToken = getCookie("ubook_csrf_token");
  if (csrfToken && ["post", "put", "patch", "delete"].includes((config.method || "").toLowerCase())) {
    config.headers = config.headers || {};
    config.headers["X-CSRF-Token"] = csrfToken;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as typeof error.config & { _retry?: boolean };

    const isUnauthorized = error.response?.status === 401;
    const isRefreshRequest = originalRequest?.url?.includes("/auth/refresh");

    if (isUnauthorized && !originalRequest?._retry && !isRefreshRequest && getSessionExpiresAt()) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAuthSession();
        }

        await refreshPromise;
        return client(originalRequest);
      } catch (refreshError) {
        clearAuthSession();
        return Promise.reject(refreshError);
      }
    }

    if (isUnauthorized && !isRefreshRequest) {
      clearAuthSession();
    }

    return Promise.reject(error);
  }
);

function getCookie(name: string) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : "";
}

function persistAuth(data?: unknown) {
  setSessionItem(SESSION_EXPIRES_AT_KEY, String(resolveSessionExpiry(data)));
  const maybeAuth = data as
    | {
        accessToken?: string;
        access_token?: string;
        token?: string;
        refreshToken?: string;
        refresh_token?: string;
        user?: { role?: string; rawRole?: string; raw_role?: string };
      }
    | undefined;
  const accessToken = maybeAuth?.accessToken || maybeAuth?.access_token || maybeAuth?.token;
  const refreshToken = maybeAuth?.refreshToken || maybeAuth?.refresh_token;
  if (accessToken) {
    setSessionItem(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    setSessionItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  storeSessionRole(maybeAuth?.user?.role || maybeAuth?.user?.rawRole || maybeAuth?.user?.raw_role);
}

function refreshAuthSession() {
  const refreshToken = getRefreshToken();
  return axios
    .post(`${API_BASE_URL}/auth/refresh`, refreshToken ? { refreshToken } : {}, { withCredentials: true })
    .then((response) => {
      persistAuth(response.data);
      return response.data;
    })
    .finally(() => {
      refreshPromise = null;
    });
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export type OAuthProvider = "google" | "microsoft" | "apple";
export type OAuthProviderAvailability = Record<OAuthProvider, boolean>;

export interface RegisterPayload extends LoginPayload {
  fullName: string;
  role: "Traveler" | "Host" | "Admin" | "Guest" | "Property Owner";
}

export interface BookingPayload {
  propertyId: number;
  fullName: string;
  email: string;
  guests: number;
  checkIn: string;
  checkOut: string;
  notes?: string;
}

export interface PropertyPayload {
  title: string;
  propertyType: string;
  country: string;
  city: string;
  address: string;
  location?: string;
  neighborhood?: string;
  latitude: number;
  longitude: number;
  pricePerNight: number;
  cleaningFee: number;
  serviceFee: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  beds: number;
  description: string;
  image?: string;
  gallery: string[];
  amenities: string[];
  tags?: string[];
  dynamicPricingNote?: string;
  isActive?: boolean;
}

export async function login(payload: LoginPayload) {
  const response = await client.post("/auth/login", payload);

  if (!(response.data?.requires_2fa || response.data?.requires2fa)) {
    persistAuth(response.data);
  }

  return response.data;
}

export function buildOAuthStartUrl(provider: OAuthProvider) {
  const url = new URL(`${API_BASE_URL}/auth/oauth/${provider}/start`);
  url.searchParams.set("role", "Traveler");
  return url.toString();
}

export function startOAuthLogin(provider: OAuthProvider) {
  window.location.assign(buildOAuthStartUrl(provider));
}

export async function getOAuthProviders(): Promise<OAuthProviderAvailability> {
  const response = await client.get("/auth/oauth/providers");
  return response.data;
}

export async function register(payload: RegisterPayload) {
  const response = await client.post("/auth/register", payload);
  persistAuth(response.data);
  return response.data;
}

export async function forgotPassword(email: string) {
  const response = await client.post("/auth/forgot-password", { email });
  return response.data;
}

export async function resetPassword(token: string, newPassword: string) {
  const response = await client.post("/auth/reset-password", { token, newPassword });
  return response.data;
}

export async function validateTwoFactor(tempToken: string, code?: string, recoveryCode?: string) {
  const response = await client.post("/auth/2fa/validate", {
    temp_token: tempToken,
    code,
    recovery_code: recoveryCode
  });
  persistAuth(response.data);
  return response.data;
}

export async function enableTwoFactor() {
  const response = await client.post("/auth/2fa/enable");
  return response.data;
}

export async function verifyTwoFactorSetup(code: string) {
  const response = await client.post("/auth/2fa/verify-setup", { code });
  return response.data;
}

export async function disableTwoFactor(password: string, code?: string, recoveryCode?: string) {
  const response = await client.post("/auth/2fa/disable", { password, code, recoveryCode });
  return response.data;
}

export async function logout() {
  try {
    await client.post("/auth/logout", {});
  } finally {
    clearAuthSession();
  }
}
export async function getCurrentUser() {
  const response = await client.get("/auth/me");
  storeSessionRole(response.data?.role || response.data?.rawRole || response.data?.raw_role);
  return response.data;
}

export async function getProfileCenter() {
  const response = await client.get("/profiles/me");
  return response.data;
}

export async function updateProfile(payload: { fullName?: string; phone?: string; avatarUrl?: string; bio?: string }) {
  const response = await client.put("/profiles/me", payload);
  return response.data;
}

export async function verifyEmail() {
  const response = await client.post("/profiles/me/verify-email");
  return response.data;
}

export async function getProperties(params?: Record<string, string | number | undefined | string[]>): Promise<Property[]> {
  const response = await client.get("/properties", { params });
  return response.data;
}

export async function getPropertyById(id: number): Promise<Property | undefined> {
  const response = await client.get(`/properties/${id}`);
  return response.data;
}

export async function checkAvailability(propertyId: number, checkIn: string, checkOut: string, guests = 1) {
  const response = await client.get(`/properties/${propertyId}/availability`, {
    params: { checkIn, checkOut, guests }
  });
  return response.data;
}

export async function getDynamicPrice(propertyId: number, nights = 3, guests = 2) {
  const response = await client.post(`/properties/${propertyId}/pricing`, {
    nights,
    guests
  });
  return response.data;
}

export async function getDynamicPriceForDates(propertyId: number, checkIn: string, checkOut: string, guests = 1) {
  const response = await client.post(`/properties/${propertyId}/pricing`, {
    checkIn,
    checkOut,
    guests
  });
  return response.data;
}

export async function createBooking(payload: BookingPayload) {
  const response = await client.post("/bookings", payload);
  return response.data;
}

export async function createReservation(payload: BookingPayload): Promise<UserBooking> {
  const response = await client.post("/reservations", payload);
  return response.data;
}

export async function getUserBookings(): Promise<UserBooking[]> {
  const response = await client.get("/bookings/me");
  return response.data;
}

export async function getMyReservations(): Promise<UserBooking[]> {
  const response = await client.get("/reservations/me");
  return response.data;
}

export async function cancelReservation(bookingId: number): Promise<UserBooking> {
  const response = await client.patch(`/reservations/${bookingId}/cancel`);
  return response.data;
}

export async function getAdminBookings(): Promise<UserBooking[]> {
  const response = await client.get("/bookings");
  return response.data;
}

export async function getAdminStats() {
  const response = await client.get<AdminStats>("/admin/stats");
  return response.data;
}

export async function getTravelerDashboard(): Promise<TravelerDashboard> {
  const response = await client.get("/traveler/dashboard");
  return response.data;
}

export async function getHostDashboard(): Promise<HostDashboard> {
  const response = await client.get("/host/dashboard");
  return response.data;
}

export async function getHostReservations(): Promise<UserBooking[]> {
  const response = await client.get("/host/reservations");
  return response.data;
}

export async function confirmHostReservation(bookingId: number): Promise<UserBooking> {
  const response = await client.patch(`/host/reservations/${bookingId}/confirm`);
  return response.data;
}

export async function cancelHostReservation(bookingId: number): Promise<UserBooking> {
  const response = await client.patch(`/host/reservations/${bookingId}/cancel`);
  return response.data;
}

export async function completeHostReservation(bookingId: number): Promise<UserBooking> {
  const response = await client.patch(`/host/reservations/${bookingId}/complete`);
  return response.data;
}

export async function getHostOnboarding() {
  const response = await client.get("/host/onboarding");
  return response.data;
}

export async function exitHostOnboarding() {
  const response = await client.post("/host/onboarding/exit");
  return response.data;
}

export async function completeHostOnboarding() {
  const response = await client.post("/host/onboarding/complete");
  return response.data;
}

export async function createProperty(payload: PropertyPayload): Promise<Property> {
  const response = await client.post("/properties", payload);
  return response.data;
}

export async function updateProperty(id: number, payload: PropertyPayload): Promise<Property> {
  const response = await client.put(`/properties/${id}`, payload);
  return response.data;
}

export async function deleteProperty(id: number) {
  await client.delete(`/properties/${id}`);
}

export function propertyToPayload(property: Property, overrides: Partial<PropertyPayload> = {}): PropertyPayload {
  return {
    title: property.title || property.name,
    propertyType: property.propertyType || property.type,
    country: property.country || "",
    city: property.city,
    address: property.address || property.location,
    location: property.location,
    neighborhood: property.neighborhood,
    latitude: property.coordinates?.[0] ?? 0,
    longitude: property.coordinates?.[1] ?? 0,
    pricePerNight: property.pricePerNight ?? property.price,
    cleaningFee: property.cleaningFee ?? 0,
    serviceFee: property.serviceFee ?? 0,
    maxGuests: property.maxGuests ?? property.capacity,
    bedrooms: property.bedrooms ?? 1,
    bathrooms: property.bathrooms ?? 1,
    beds: property.beds ?? 1,
    description: property.description,
    image: property.coverImage || property.image,
    gallery: property.gallery || [],
    amenities: property.amenities || [],
    tags: property.tags || [],
    dynamicPricingNote: property.dynamicPricingNote,
    isActive: property.isActive ?? true,
    ...overrides
  };
}

export async function uploadImage(file: File): Promise<{ url: string }> {
  const data = new FormData();
  data.append("file", file);
  const response = await client.post("/uploads/images", data, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return response.data;
}

export async function getAmenities(): Promise<Array<{ id: number; name: string; category: string }>> {
  const response = await client.get("/amenities");
  return response.data;
}

export async function getPropertyCalendar(propertyId: number, params?: { start?: string; end?: string }) {
  const response = await client.get(`/properties/${propertyId}/calendar`, { params });
  return response.data;
}

export async function getPropertyReservationCalendar(propertyId: number, params?: { start?: string; end?: string }): Promise<ReservationCalendarDay[]> {
  const response = await client.get(`/properties/${propertyId}/reservations/calendar`, { params });
  return response.data;
}

export async function updatePropertyCalendar(
  propertyId: number,
  rows: Array<{ calendarDate: string; roomId?: number | null; availableUnits: number; minNights?: number; closed?: boolean; priceOverride?: number | null }>
) {
  const response = await client.put(`/properties/${propertyId}/calendar`, { rows });
  return response.data;
}

export async function getSavedSearches() {
  const response = await client.get("/saved-searches");
  return response.data;
}

export async function createSavedSearch(name: string, query: Record<string, unknown>, alertEnabled = true) {
  const response = await client.post("/saved-searches", { name, query, alertEnabled });
  return response.data;
}

export async function deleteSavedSearch(id: number) {
  await client.delete(`/saved-searches/${id}`);
}

export async function getNotifications(): Promise<NotificationRecord[]> {
  const response = await client.get("/notifications");
  return response.data;
}

export async function getProfilePreferences() {
  const response = await client.get("/profiles/me/preferences");
  return response.data;
}

export async function updateNotificationPreferences(payload: Record<string, unknown>) {
  const response = await client.put("/profiles/me/preferences/notifications", payload);
  return response.data;
}

export async function updateAccountPreferences(payload: Record<string, unknown>) {
  const response = await client.put("/profiles/me/preferences/account", payload);
  return response.data;
}

export async function getWishlists(): Promise<Wishlist[]> {
  const response = await client.get("/wishlists");
  return response.data;
}

export async function createWishlist(name: string, description?: string): Promise<Wishlist> {
  const response = await client.post("/wishlists", { name, description });
  return response.data;
}

export async function addWishlistItem(wishlistId: number, propertyId: number): Promise<Wishlist> {
  const response = await client.post(`/wishlists/${wishlistId}/items`, { propertyId });
  return response.data;
}

export async function getPayments(): Promise<PaymentRecord[]> {
  const response = await client.get("/payments");
  return response.data;
}

export async function getPaymentOverview(): Promise<PaymentOverview> {
  const response = await client.get("/payments/overview");
  return response.data;
}

export async function getWallet(): Promise<WalletAccount> {
  const response = await client.get("/payments/wallet");
  return response.data;
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const response = await client.get("/payments/methods");
  return response.data;
}

export async function createPaymentMethod(payload: {
  provider: string;
  brand: string;
  label: string;
  last4: string;
  expiryMonth?: number | null;
  expiryYear?: number | null;
  token: string;
  isDefault?: boolean;
}): Promise<PaymentMethod> {
  const response = await client.post("/payments/methods", payload);
  return response.data;
}

export async function deletePaymentMethod(id: number) {
  await client.delete(`/payments/methods/${id}`);
}

export function paymentReceiptUrl(id: number) {
  return `${API_BASE_URL}/payments/${id}/receipt`;
}

export function paymentInvoiceUrl(id: number) {
  return `${API_BASE_URL}/payments/${id}/invoice`;
}

export async function createPayment(bookingId: number, provider: "stripe" | "paypal" | "manual"): Promise<PaymentRecord> {
  const response = await client.post("/payments", { bookingId, provider });
  return response.data;
}

export async function confirmPayment(paymentId: number, status: string, transactionId?: string): Promise<PaymentRecord> {
  const response = await client.post(`/payments/${paymentId}/confirm`, { status, transactionId });
  return response.data;
}

export async function getConversations(): Promise<Conversation[]> {
  const response = await client.get("/messages/conversations");
  return response.data;
}

export async function getConversation(id: number): Promise<Conversation> {
  const response = await client.get(`/messages/conversations/${id}`);
  return response.data;
}

export async function createConversation(hostId: number, propertyId?: number, bookingId?: number): Promise<Conversation> {
  const response = await client.post("/messages/conversations", { hostId, propertyId, bookingId });
  return response.data;
}

export async function sendMessage(conversationId: number, body: string, imageUrl?: string): Promise<Message> {
  const response = await client.post(`/messages/conversations/${conversationId}/messages`, { body, imageUrl });
  return response.data;
}

export async function markConversationRead(conversationId: number) {
  const response = await client.post(`/messages/conversations/${conversationId}/read`);
  return response.data;
}

export async function getSessions() {
  const response = await client.get("/auth/sessions");
  return response.data;
}

export async function revokeSession(sessionId: number) {
  await client.delete(`/auth/sessions/${sessionId}`);
}

export async function getWebsocketToken(): Promise<string> {
  const response = await client.post("/auth/ws-token");
  return response.data.token;
}

export function getSessionExpiresAt() {
  const value = getSessionItem(SESSION_EXPIRES_AT_KEY);
  return value ? Number(value) : null;
}

export function getSessionTimeRemaining() {
  const expiresAt = getSessionExpiresAt();
  return expiresAt ? expiresAt - Date.now() : 0;
}

export function isSessionExpired() {
  const expiresAt = getSessionExpiresAt();
  return Boolean(expiresAt && expiresAt <= Date.now());
}

export function ensureSessionExpiry() {
  if (!getSessionExpiresAt()) {
    setSessionItem(SESSION_EXPIRES_AT_KEY, String(Date.now() + SESSION_DURATION_MS));
  }
}
export function clearAuthSession() {
  removeSessionItem(SESSION_EXPIRES_AT_KEY);
  removeSessionItem(ACCESS_TOKEN_KEY);
  removeSessionItem(REFRESH_TOKEN_KEY);
  clearStoredSessionRole();
}

export async function extendSession() {
  if (!refreshPromise) {
    refreshPromise = refreshAuthSession();
  }

  return refreshPromise;
}

export function websocketUrl(path: string) {
  return `${API_BASE_URL.replace(/^http/, "ws").replace(/\/$/, "")}${path}`;
}

export async function getPlatformStats() {
  const response = await client.get("/admin/stats");
  return response.data;
}

export async function getAdminUsers(): Promise<Array<Record<string, unknown>>> {
  const response = await client.get("/admin/users");
  return response.data;
}

export async function getAdminListings(): Promise<Property[]> {
  const response = await client.get("/admin/listings");
  return response.data;
}

export async function getAdminReviews(): Promise<Record<string, unknown>> {
  const response = await client.get("/admin/reviews");
  return response.data;
}

export async function getAdminReports(): Promise<Array<Record<string, unknown>>> {
  const response = await client.get("/admin/reports");
  return response.data;
}

export async function getAdminSupportTickets(): Promise<Array<Record<string, unknown>>> {
  const response = await client.get("/admin/support");
  return response.data;
}

export async function getAdminDisputes(): Promise<Array<Record<string, unknown>>> {
  const response = await client.get("/admin/disputes");
  return response.data;
}

export async function getAdminRiskEvents(): Promise<Array<Record<string, unknown>>> {
  const response = await client.get("/admin/risk-events");
  return response.data;
}

export async function getFavorites(): Promise<Property[]> {
  const response = await client.get("/favorites");
  return response.data;
}

export async function getMyReviews(): Promise<ReviewCenter> {
  const response = await client.get("/reviews/me");
  return response.data;
}

export async function createPropertyReview(payload: { propertyId: number; bookingId: number; rating: number; comment: string; imageUrls?: string[] }) {
  const response = await client.post("/reviews/property", payload);
  return response.data;
}

export async function createHostReview(payload: { hostId: number; bookingId: number; rating: number; comment: string }) {
  const response = await client.post("/reviews/host", payload);
  return response.data;
}

export async function createStayReview(payload: {
  propertyId: number;
  bookingId: number;
  hostId: number;
  apartmentRating: number;
  apartmentComment: string;
  hostRating: number;
  hostComment: string;
  imageUrls?: string[];
}) {
  const response = await client.post("/reviews/stay", payload);
  return response.data;
}

export async function getPublicHostProfile(hostId: number): Promise<PublicHostProfile> {
  const response = await client.get(`/profiles/hosts/${hostId}`);
  return response.data;
}

export async function addFavorite(propertyId: number) {
  const response = await client.post(`/favorites/property/${propertyId}`);
  return response.data;
}

export async function removeFavorite(propertyId: number) {
  await client.delete(`/favorites/property/${propertyId}`);
}

export async function searchSmartTravelFinder(payload: SmartTravelFinderRequest): Promise<SmartTravelSearchResponse> {
  const response = await client.post("/travel-finder/search", payload);
  return response.data;
}

export async function conversationalTravelSearch(payload: {
  message: string;
  departureCountry: string;
  preferredCurrency: string;
}): Promise<ConversationalTravelResponse> {
  const response = await client.post("/travel-finder/chat", payload);
  return response.data;
}

export async function compareTravelDestinations(destinationIds: number[]): Promise<DestinationComparisonResponse> {
  const response = await client.post("/travel-finder/compare", { destinationIds });
  return response.data;
}


