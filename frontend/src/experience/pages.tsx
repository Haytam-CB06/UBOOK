import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BedDouble,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  Filter,
  Heart,
  Home,
  Inbox,
  LayoutDashboard,
  LineChart,
  LockKeyhole,
  LogOut,
  Mail,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Plane,
  Plus,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Table2,
  UserRound,
  Users,
  Wallet,
  X
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";

import { imageManifest } from "../assets/imageManifest";
import {
  amenityOptions,
  categoryData,
  Conversation,
  currency,
  Metric,
  onboardingSteps,
  Property,
  propertyTypeOptions,
  testimonialsFromProperties,
  toChartData,
  toConversation,
  toExperienceProperty,
  toMetric,
  trustOptions,
  WorkspaceRole
} from "./dynamic";
import {
  cancelHostReservation,
  cancelReservation,
  confirmPayment,
  checkAvailability,
  clearAuthSession,
  completeHostReservation,
  confirmHostReservation,
  createPayment,
  createProperty,
  createConversation,
  createReservation,
  createSavedSearch,
  createStayReview,
  disableTwoFactor,
  enableTwoFactor,
  forgotPassword,
  addFavorite,
  getAdminListings,
  getAdminReports,
  getAdminRiskEvents,
  getAdminSupportTickets,
  getAdminStats,
  getAdminUsers,
  getConversation,
  getConversations,
  getCurrentUser,
  getDynamicPriceForDates,
  getFavorites,
  getPaymentMethods,
  getPaymentOverview,
  getPropertyCalendar,
  getHostDashboard,
  getHostReservations,
  getMyReservations,
  getMyReviews,
  getPayments,
  getProperties,
  getProfileCenter,
  getProfilePreferences,
  getPublicHostProfile,
  getPropertyById,
  getPropertyReservationCalendar,
  getSavedSearches,
  getSessionExpiresAt,
  getTravelerDashboard,
  getWallet,
  isSessionExpired,
  login,
  logout,
  markConversationRead,
  register,
  sendMessage,
  updateAccountPreferences,
  updateNotificationPreferences,
  updateProfile,
  updatePropertyCalendar,
  uploadImage,
  verifyTwoFactorSetup,
  verifyEmail,
  validateTwoFactor,
  startOAuthLogin,
  getOAuthProviders
} from "../services/api";
import type {
  AdminStats,
  Conversation as ApiConversation,
  HostDashboard as ApiHostDashboard,
  Property as ApiProperty,
  PublicHostProfile,
  ReservationCalendarDay,
  TravelerDashboard as ApiTravelerDashboard,
  UserBooking
  
} from "../types/api";

const navByRole = {
  traveler: [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Explore", href: "/search", icon: Search },
    { label: "Reservations", href: "/reservations", icon: CalendarDays },
    { label: "Wishlist", href: "/dashboard/wishlist", icon: Heart },
    { label: "Messages", href: "/messages", icon: MessageCircle },
    { label: "Payments", href: "/dashboard/payments", icon: CreditCard },
    { label: "Reviews", href: "/dashboard/reviews", icon: Star },
    { label: "Profile", href: "/dashboard/profile", icon: UserRound },
    { label: "Settings", href: "/dashboard/settings", icon: Settings }
  ],
  host: [
    { label: "Dashboard", href: "/host", icon: LayoutDashboard },
    { label: "Listings", href: "/host/listings", icon: Building2 },
    { label: "Reservations", href: "/host/reservations", icon: CalendarDays },
    { label: "Calendar", href: "/host/calendar", icon: CalendarDays },
    { label: "Messages", href: "/messages", icon: MessageCircle },
    { label: "Earnings", href: "/host/earnings", icon: Wallet },
    { label: "Reviews", href: "/host/reviews", icon: Star },
    { label: "Analytics", href: "/host/analytics", icon: LineChart },
    { label: "Settings", href: "/host/settings", icon: Settings }
  ],
  admin: [
    { label: "Overview", href: "/admin", icon: Activity },
    { label: "Users", href: "/admin#users", icon: Users },
    { label: "Hosts", href: "/admin#hosts", icon: ShieldCheck },
    { label: "Properties", href: "/admin#properties", icon: Building2 },
    { label: "Bookings", href: "/admin#bookings", icon: CalendarDays },
    { label: "Payments", href: "/admin#payments", icon: Receipt },
    { label: "Reviews", href: "/admin#reviews", icon: Star },
    { label: "Reports", href: "/admin#reports", icon: FileText },
    { label: "Support", href: "/admin#support", icon: Inbox },
    { label: "Settings", href: "/admin#settings", icon: Settings }
  ]
};

const easing = [0.22, 1, 0.36, 1] as const;
const sourceColors = ["#2563EB", "#0891B2", "#0F172A", "#16A34A"];

type AuthUserLike = {
  role?: string;
  rawRole?: string;
  raw_role?: string;
  requiresHostOnboarding?: boolean;
  requires_host_onboarding?: boolean;
};

type AuthResponseLike = {
  user?: AuthUserLike | null;
  requires_2fa?: boolean;
  requires2fa?: boolean;
  requiresTwoFactor?: boolean;
  two_factor_required?: boolean;
  twoFactorRequired?: boolean;
  otp_required?: boolean;
  otpRequired?: boolean;
  tempToken?: string;
  temp_token?: string;
  temporaryToken?: string;
  temporary_token?: string;
  two_factor_token?: string;
  twoFactorToken?: string;
  otp_token?: string;
  otpToken?: string;
  token?: string;
};

function normalizedWorkspaceRole(role?: string | null): "Traveler" | "Host" | "Admin" {
  const value = String(role || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  if (["admin", "super_admin", "administrator"].includes(value)) {
    return "Admin";
  }

  if (["host", "hotel_admin", "property_owner", "property_manager", "owner"].includes(value)) {
    return "Host";
  }

  return "Traveler";
}

function workspacePathForUser(user?: AuthUserLike | null) {
  const role = normalizedWorkspaceRole(user?.role || user?.rawRole || user?.raw_role);

  if (role === "Admin") {
    return "/admin";
  }

  if (role === "Host") {
    return user?.requiresHostOnboarding || user?.requires_host_onboarding ? "/host/onboarding" : "/host";
  }

  return "/dashboard";
}

function safeRedirectPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  if (["/login", "/register", "/forgot-password", "/verify-email"].includes(value)) {
    return fallback;
  }

  return value;
}

function getApiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  const apiError = error as { response?: { data?: { detail?: unknown; message?: unknown } }; message?: string } | undefined;
  const detail = apiError?.response?.data?.detail || apiError?.response?.data?.message;
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail) && typeof detail[0] === "object" && detail[0] && "msg" in detail[0]) {
    return String((detail[0] as { msg: unknown }).msg);
  }
  if (apiError?.message) {
    return apiError.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayIso() {
  return toIsoDate(new Date());
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function monthStartIso(value = todayIso()) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(1);
  return toIsoDate(date);
}

function addMonthsIso(value: string, months: number) {
  const date = new Date(`${monthStartIso(value)}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return monthStartIso(toIsoDate(date));
}

function daysBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  return Math.max(0, Math.round((new Date(`${checkOut}T00:00:00`).getTime() - new Date(`${checkIn}T00:00:00`).getTime()) / 86400000));
}

function selectedStayDates(checkIn: string, checkOut: string) {
  const nights = daysBetween(checkIn, checkOut);
  return Array.from({ length: nights }, (_, index) => addDaysIso(checkIn, index));
}

function calendarGrid(startIso = todayIso(), days = 42) {
  const start = new Date(`${startIso}T00:00:00`);
  start.setDate(1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toIsoDate(date);
  });
}

function calendarMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function formatFriendlyDate(value?: string) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00`));
}

function reservationStatusTone(status?: string): "success" | "warning" | "error" | "neutral" | "primary" {
  const value = String(status || "").toLowerCase();
  if (["confirmed", "completed", "checked-in", "checked_in", "checked-out", "checked_out"].includes(value)) return "success";
  if (["pending", "draft"].includes(value)) return "warning";
  if (["cancelled", "canceled", "rejected", "refunded"].includes(value)) return "error";
  return "neutral";
}

function bookingLabel(booking: UserBooking) {
  return booking.guestName || booking.bookingReference || "Reserved";
}

function authResponseNeedsTwoFactor(response: AuthResponseLike) {
  return Boolean(
    response.requires_2fa ||
      response.requires2fa ||
      response.requiresTwoFactor ||
      response.two_factor_required ||
      response.twoFactorRequired ||
      response.otp_required ||
      response.otpRequired
  );
}

function getTwoFactorTempToken(response: AuthResponseLike) {
  return (
    response.tempToken ||
    response.temp_token ||
    response.temporaryToken ||
    response.temporary_token ||
    response.twoFactorToken ||
    response.two_factor_token ||
    response.otpToken ||
    response.otp_token ||
    response.token ||
    ""
  );
}

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function MotionPage({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.42, ease: easing }}
    >
      {children}
    </motion.div>
  );
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group inline-flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-sm font-black text-canvas transition group-hover:scale-95 dark:bg-secondary dark:text-secondary-ink">
        U
      </span>
      {!compact ? (
        <span>
          <span className="block text-sm font-black tracking-[0.24em] text-ink">UBOOK</span>
          <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Verified stays</span>
        </span>
      ) : null}
    </Link>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const toggle = () => {
    document.documentElement.classList.toggle("dark");
    setDark(document.documentElement.classList.contains("dark"));
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:-translate-y-0.5 hover:shadow-soft"
      aria-label="Toggle theme"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-bold tracking-[-0.01em] transition duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-ink shadow-soft hover:-translate-y-0.5 hover:shadow-lift",
        variant === "secondary" && "border border-line bg-surface text-ink hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft",
        variant === "ghost" && "text-ink-soft hover:bg-surface-2 hover:text-ink",
        className
      )}
    >
      {children}
    </button>
  );
}

function LinkButton({
  to,
  children,
  variant = "primary",
  className
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[13px] font-bold tracking-[-0.01em] transition duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
        variant === "primary" && "bg-primary text-primary-ink shadow-soft hover:-translate-y-0.5 hover:shadow-lift",
        variant === "secondary" && "border border-line bg-surface text-ink hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft",
        variant === "ghost" && "text-ink-soft hover:bg-surface-2 hover:text-ink",
        className
      )}
    >
      {children}
    </Link>
  );
}

type PublicNavUser = AuthUserLike & {
  fullName?: string;
  name?: string;
  email?: string;
  avatarUrl?: string | null;
};

function PublicAuthActions({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasSession = Boolean(getSessionExpiresAt()) && !isSessionExpired();
  const userQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    enabled: hasSession,
    retry: false,
    staleTime: 30_000
  });
  const user = userQuery.data as PublicNavUser | undefined;
  const role = normalizedWorkspaceRole(user?.role || user?.rawRole || user?.raw_role);
  const displayName = user?.fullName || user?.name || user?.email || "Account";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
  const isSignedIn = Boolean(user);

  useEffect(() => {
    if (isSessionExpired()) {
      clearAuthSession();
      queryClient.removeQueries({ queryKey: ["current-user"] });
    }
  }, [queryClient]);

  useEffect(() => {
    if (userQuery.isError) {
      clearAuthSession();
      queryClient.removeQueries({ queryKey: ["current-user"] });
    }
  }, [queryClient, userQuery.isError]);

  const signOut = async () => {
    await logout().catch(() => undefined);
    clearAuthSession();
    queryClient.clear();
    setMenuOpen(false);
    onNavigate?.();
    navigate("/", { replace: true });
  };

  if (!isSignedIn) {
    return (
      <div className={cn(mobile ? "grid gap-2 sm:grid-cols-3" : "flex items-center gap-2")}>
        <LinkButton to="/login" variant="secondary" className={mobile ? "w-full" : undefined}>Log in</LinkButton>
        <LinkButton to="/host/onboarding" variant="secondary" className={mobile ? "w-full" : undefined}><Plus className="h-4 w-4" /> List a rent</LinkButton>
        <LinkButton to="/register" className={mobile ? "w-full" : undefined}>Register</LinkButton>
      </div>
    );
  }

  const menuItems = [
    { label: "My Profile", href: role === "Host" ? "/host#settings" : "/dashboard#profile", icon: UserRound },
    { label: "My Reservations", href: role === "Host" ? "/host#reservations" : "/reservations", icon: CalendarDays },
    ...(role === "Host" ? [{ label: "Host Dashboard", href: "/host", icon: LayoutDashboard }] : []),
  ];

  if (mobile) {
    return (
      <div className="grid gap-2 pt-2">
        <div className="rounded-2xl border border-line bg-surface-2 p-4">
          <p className="text-sm font-black text-ink">{displayName}</p>
          {user?.email ? <p className="mt-1 truncate text-xs font-semibold text-muted">{user.email}</p> : null}
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} to={item.href} onClick={onNavigate} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm font-bold text-ink-soft hover:bg-primary/10 hover:text-primary">
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        <Button type="button" variant="secondary" onClick={signOut} className="w-full justify-start rounded-2xl">
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-3 rounded-full border border-line bg-surface px-2.5 py-1.5 pr-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
        aria-expanded={menuOpen}
      >
        <span className="grid h-8 w-8 place-items-center overflow-hidden rounded-full bg-primary/10 text-xs font-black text-primary">
          {user?.avatarUrl ? <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" /> : initials}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-36 truncate text-sm font-black text-ink">{displayName}</span>
          <span className="block max-w-36 truncate text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{role}</span>
        </span>
      </button>
      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: easing }}
            className="absolute right-0 top-[calc(100%+0.75rem)] w-72 overflow-hidden rounded-[1.5rem] border border-line bg-surface p-2 shadow-lift"
          >
            <div className="border-b border-line px-3 py-3">
              <p className="truncate text-sm font-black text-ink">{displayName}</p>
              {user?.email ? <p className="mt-1 truncate text-xs font-semibold text-muted">{user.email}</p> : null}
            </div>
            <div className="grid gap-1 py-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} to={item.href} onClick={() => setMenuOpen(false)} className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold text-ink-soft hover:bg-surface-2 hover:text-ink">
                    <Icon className="h-4 w-4 text-primary" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <Button type="button" variant="ghost" onClick={signOut} className="w-full justify-start rounded-2xl px-3">
              <LogOut className="h-4 w-4" /> Logout
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function PublicNav() {
  const [open, setOpen] = useState(false);
  const links = [
    ["Explore", "/search"],
    ["For travelers", "/dashboard"],
    ["For hosts", "/host"]
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/88 backdrop-blur-2xl supports-[backdrop-filter]:bg-canvas/78">
      <div className="page-shell flex h-[4.5rem] min-h-[4.5rem] items-center justify-between gap-4 py-3">
        <BrandMark />
        <nav className="hidden items-center gap-1 rounded-full border border-line bg-surface/80 p-1 shadow-soft lg:flex">
          {links.map(([label, href]) => (
            <Link key={label} to={href} className="rounded-full px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <ThemeToggle />
          <PublicAuthActions />
        </div>
        <button className="rounded-full border border-line bg-surface p-3 shadow-soft lg:hidden" type="button" onClick={() => setOpen((value) => !value)} aria-label="Open navigation">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-line bg-surface lg:hidden"
          >
            <div className="page-shell grid gap-2 py-4">
              {links.map(([label, href]) => (
                <Link key={label} to={href} onClick={() => setOpen(false)} className="rounded-2xl px-4 py-3 text-sm font-bold text-ink-soft hover:bg-surface-2">
                  {label}
                </Link>
              ))}
              <ThemeToggle />
              <PublicAuthActions mobile onNavigate={() => setOpen(false)} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function PublicFooter() {
  const groups = [
    ["Marketplace", "Apartments", "Hotels", "Villas", "Student housing"],
    ["Company", "Trust", "Careers", "Press", "Accessibility"],
    ["Support", "Help center", "Safety center", "Cancellation", "Payments"]
  ];
  return (
    <footer className="border-t border-line bg-surface">
      <div className="page-shell grid gap-10 py-12 lg:grid-cols-[1.2fr_2fr]">
        <div>
          <BrandMark />
          <p className="mt-5 max-w-sm text-sm leading-6 text-ink-soft">
            UBOOK helps travelers feel confident before they book, and gives hosts a calmer way to run every stay.
          </p>
        </div>
        <div className="grid gap-8 sm:grid-cols-3">
          {groups.map(([title, ...items]) => (
            <div key={title}>
              <p className="caption-type">{title}</p>
              <div className="mt-4 grid gap-3">
                {items.map((item) => (
                  <Link key={item} to="/" className="text-sm font-semibold text-ink-soft hover:text-ink">
                    {item}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "error" | "primary" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
        tone === "neutral" && "bg-surface-2 text-ink-soft",
        tone === "primary" && "bg-primary/10 text-primary",
        tone === "accent" && "bg-accent/10 text-accent",
        tone === "success" && "bg-success/10 text-success",
        tone === "warning" && "bg-warning/15 text-warning",
        tone === "error" && "bg-error/10 text-error"
      )}
    >
      {children}
    </span>
  );
}


function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-dashed border-line bg-surface/80 p-6 text-center shadow-soft">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-12 left-8 h-28 w-28 rounded-full bg-accent/10 blur-2xl" />
      <div className="relative mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
        {icon || <Sparkles className="h-5 w-5" />}
      </div>
      <h3 className="relative mt-4 text-lg font-semibold tracking-[-0.035em] text-ink">{title}</h3>
      {text ? <p className="relative mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-ink-soft">{text}</p> : null}
      {action ? <div className="relative mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

function LoadingBlock({ label = "Loading workspace data..." }: { label?: string }) {
  return (
    <div className="premium-card grid min-h-40 place-items-center p-6">
      <div className="flex items-center gap-3 text-sm font-bold text-ink-soft">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary" />
        {label}
      </div>
    </div>
  );
}

function HumanNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-surface/80 p-4 shadow-soft">
      <div className="flex gap-3 text-sm font-semibold leading-6 text-ink-soft">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">✦</span>
        <div>{children}</div>
      </div>
    </div>
  );
}

function WorkspaceHero({
  kicker,
  title,
  text,
  children,
  action
}: {
  kicker: string;
  title: string;
  text: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2.25rem] border border-line bg-gradient-to-br from-ink via-ink to-primary/80 p-5 text-canvas shadow-lift sm:p-6 lg:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-white/60">{kicker}</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.065em] text-white sm:text-4xl">{title}</h2>
          <p className="mt-4 max-w-2xl text-sm font-medium leading-7 text-white/72 sm:text-base">{text}</p>
        </div>
        {action ? <div className="flex flex-wrap gap-3 lg:justify-end">{action}</div> : null}
      </div>
      {children ? <div className="relative mt-6">{children}</div> : null}
    </section>
  );
}

function SectionHeader({ kicker, title, text, action }: { kicker: string; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="caption-type">{kicker}</p>
        <h2 className="h2-type mt-3">{title}</h2>
        {text ? <p className="body-type mt-3 max-w-2xl">{text}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function SearchDock({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate();
  const [destination, setDestination] = useState("Tokyo");
  const [checkIn, setCheckIn] = useState("2026-06-18");
  const [checkOut, setCheckOut] = useState("2026-06-22");
  const [guests, setGuests] = useState("2");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = new URLSearchParams({ destination, checkIn, checkOut, guests });
    navigate(`/search?${query.toString()}`);
  };
  return (
    <form
      onSubmit={submit}
      className={cn(
        "grid min-w-0 gap-3 rounded-[2rem] border border-line bg-surface/92 p-3 shadow-lift backdrop-blur-xl",
        compact ? "md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_150px_150px_120px_auto]" : "md:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_0.8fr_auto]"
      )}
    >
      <FieldShell label="Destination" icon={<MapPin className="h-4 w-4" />}>
        <input className="w-full bg-transparent text-sm font-bold outline-none" value={destination} onChange={(event) => setDestination(event.target.value)} />
      </FieldShell>
      <FieldShell label="Check-in" icon={<CalendarDays className="h-4 w-4" />}>
        <input className="w-full bg-transparent text-sm font-bold outline-none" type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} />
      </FieldShell>
      <FieldShell label="Check-out" icon={<CalendarDays className="h-4 w-4" />}>
        <input className="w-full bg-transparent text-sm font-bold outline-none" type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} />
      </FieldShell>
      <FieldShell label="Guests" icon={<Users className="h-4 w-4" />}>
        <select className="w-full bg-transparent text-sm font-bold outline-none" value={guests} onChange={(event) => setGuests(event.target.value)}>
          <option value="1">1 guest</option>
          <option value="2">2 guests</option>
          <option value="4">4 guests</option>
        </select>
      </FieldShell>
      <Button className="h-full min-h-14 rounded-[1.5rem]" type="submit">
        <Search className="h-4 w-4" />
        Search
      </Button>
    </form>
  );
}

function FieldShell({ label, icon, children }: { label: string; icon: ReactNode; children: ReactNode }) {
  return (
    <label className="flex min-h-14 items-center gap-3 rounded-[1.4rem] bg-surface-2 px-4">
      <span className="text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{label}</span>
        {children}
      </span>
    </label>
  );
}

function PropertyCard({ property, featured = false }: { property: Property; featured?: boolean }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const saveFavorite = useMutation({
    mutationFn: () => addFavorite(property.id),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
      await queryClient.invalidateQueries({ queryKey: ["traveler-dashboard"] });
    }
  });

  return (
    <motion.article
      whileHover={{ y: -5 }}
      transition={{ duration: 0.22, ease: easing }}
      className={cn(
        "group min-w-0 overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-soft ring-1 ring-transparent transition hover:border-primary/25 hover:shadow-lift",
        featured && "lg:grid lg:grid-cols-[1.08fr_0.92fr]"
      )}
    >
      <Link to={`/property/${property.id}`} className="relative block overflow-hidden bg-surface-2">
        <img
          src={property.image}
          alt={property.title}
          className={cn("w-full object-cover transition duration-700 group-hover:scale-105", featured ? "aspect-[4/3] lg:h-full" : "aspect-[4/3]")}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          <Badge tone={property.verified ? "success" : "warning"}>{property.verified ? "Verified" : "Reviewing"}</Badge>
        </div>
      </Link>
      <div className="flex min-h-[250px] flex-col p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link to={`/property/${property.id}`} className="block truncate text-xl font-semibold tracking-[-0.04em] text-ink">
              {property.title}
            </Link>
            <p className="mt-1 truncate text-sm font-semibold text-ink-soft">{property.neighborhood}, {property.city}</p>
          </div>
          <button
            className={cn("shrink-0 rounded-full border border-line p-2 transition hover:bg-primary hover:text-primary-ink", saved ? "bg-primary text-primary-ink" : "text-ink-soft")}
            type="button"
            onClick={() => saveFavorite.mutate()}
            disabled={saveFavorite.isPending || saved}
            aria-label={saved ? "Property saved" : "Save property"}
          >
            <Heart className={cn("h-4 w-4", saved && "fill-current")} />
          </button>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-ink-soft">{property.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {property.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-ink-soft">{tag}</span>
          ))}
        </div>
        <div className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-4">
          <div>
            <p className="text-2xl font-semibold tracking-[-0.05em] text-ink">${property.price}</p>
            <p className="text-xs font-semibold text-muted">per night</p>
          </div>
          <div className="text-right">
            <p className="inline-flex items-center gap-1 text-sm font-bold text-ink">
              <Star className="h-4 w-4 fill-warning text-warning" />
              {property.rating}
            </p>
            <p className="text-xs font-semibold text-muted">{property.reviews} reviews</p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div className="premium-card group min-w-0 overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-4">
        <p className="caption-type truncate">{metric.label}</p>
        <span
          className={cn(
            "h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-current/10",
            metric.tone === "success" && "bg-success text-success",
            metric.tone === "warning" && "bg-warning text-warning",
            metric.tone === "accent" && "bg-accent text-accent",
            metric.tone === "primary" && "bg-primary text-primary",
            metric.tone === "neutral" && "bg-muted text-muted"
          )}
        />
      </div>
      <p className="mt-5 truncate text-3xl font-semibold tracking-[-0.06em] text-ink">{metric.value}</p>
      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-6 text-ink-soft">{metric.delta}</p>
    </div>
  );
}

function ChartPanel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="premium-card min-w-0 overflow-hidden p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="truncate text-lg font-semibold tracking-[-0.035em] text-ink">{title}</h3>
        {action}
      </div>
      <div className="h-64 min-w-0 overflow-hidden rounded-[1.25rem] bg-surface/40 p-1">{children}</div>
    </div>
  );
}

function useMeasuredChartSize() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}

function RevenueChart({ data }: { data: Array<{ month: string; revenue: number; occupancy: number; conversion: number }> }) {
  const chart = useMeasuredChartSize();
  return (
    <div ref={chart.ref} className="h-full min-h-[220px] min-w-0">
      {chart.width > 0 && chart.height > 0 ? (
      <AreaChart width={chart.width} height={chart.height} data={data}>
        <defs>
          <linearGradient id="revenueFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.32} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="hsl(var(--line))" vertical={false} />
        <XAxis dataKey="month" stroke="hsl(var(--muted))" tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted))" tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid hsl(var(--line))" }} />
        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} fill="url(#revenueFill)" />
      </AreaChart>
      ) : null}
    </div>
  );
}

function OccupancyChart({ data }: { data: Array<{ month: string; revenue: number; occupancy: number; conversion: number }> }) {
  const chart = useMeasuredChartSize();
  return (
    <div ref={chart.ref} className="h-full min-h-[220px] min-w-0">
      {chart.width > 0 && chart.height > 0 ? (
      <BarChart width={chart.width} height={chart.height} data={data}>
        <CartesianGrid stroke="hsl(var(--line))" vertical={false} />
        <XAxis dataKey="month" stroke="hsl(var(--muted))" tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted))" tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid hsl(var(--line))" }} />
        <Bar dataKey="occupancy" fill="hsl(var(--accent))" radius={[12, 12, 0, 0]} />
      </BarChart>
      ) : null}
    </div>
  );
}

function SourceChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const chart = useMeasuredChartSize();
  return (
    <div ref={chart.ref} className="h-full min-h-[220px] min-w-0">
      {chart.width > 0 && chart.height > 0 ? (
      <PieChart width={chart.width} height={chart.height}>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={86} innerRadius={52} paddingAngle={5}>
          {data.map((item, index) => (
            <Cell key={item.name} fill={sourceColors[index % sourceColors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid hsl(var(--line))" }} />
      </PieChart>
      ) : null}
    </div>
  );
}

function DataTable<TData extends object>({ data, columns }: { data: TData[]; columns: ColumnDef<TData>[] }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="max-w-full overflow-hidden rounded-[1.25rem] border border-line bg-surface">
      <div className="overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
        <table className="w-full min-w-[680px] text-left text-sm sm:min-w-[720px]">
          <thead className="bg-surface-2 text-xs font-bold uppercase tracking-[0.14em] text-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-4">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-line">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="transition hover:bg-surface-2/70">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-4 font-semibold text-ink-soft">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkspaceShell({
  role,
  title,
  subtitle,
  children,
  action
}: {
  role: WorkspaceRole;
  title: string;
  subtitle: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const [mobileNav, setMobileNav] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const nav = navByRole[role];
  const roleLabel = role === "traveler" ? "Traveler" : role === "host" ? "Host" : "Admin";

  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  const isActive = (href: string) => {
    const [path, hash] = href.split("#");
    if (hash) {
      return location.pathname === path && location.hash === `#${hash}`;
    }
    return location.pathname === path || (path !== "/" && location.pathname.startsWith(`${path}/`));
  };

  useEffect(() => {
    if (!location.hash) return;
    const targetId = decodeURIComponent(location.hash.slice(1));
    const timeout = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => window.clearTimeout(timeout);
  }, [location.hash, location.pathname]);

  return (
    <MotionPage>
      <div className="h-screen overflow-hidden bg-canvas text-[14px]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] overflow-y-auto border-r border-line bg-surface/92 px-4 py-4 backdrop-blur-2xl lg:block">
          <BrandMark />
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border border-line bg-ink p-4 text-canvas shadow-soft">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/55">{roleLabel} workspace</p>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/78">Your home base for guests, stays, messages, payments, and the little details that make hosting feel easy.</p>
            {role === "host" ? (
              <LinkButton to="/host/onboarding" className="mt-4 w-full bg-white text-ink hover:shadow-lift">
                <Plus className="h-4 w-4" /> Add your place
              </LinkButton>
            ) : null}
          </div>
          <nav className="mt-5 grid gap-1.5">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13px] font-bold transition",
                    active ? "bg-primary text-primary-ink shadow-soft" : "text-ink-soft hover:bg-surface-2 hover:text-ink"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={handleSignOut} className="w-full justify-start rounded-2xl px-3 py-2.5 text-[13px]">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>
        <div className="h-screen overflow-y-auto overflow-x-hidden scroll-smooth pb-24 lg:pl-[260px] lg:pb-0">
          <header className="sticky top-0 z-20 border-b border-line bg-canvas/88 backdrop-blur-2xl supports-[backdrop-filter]:bg-canvas/78">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
              <div className="min-w-0">
                <p className="caption-type">{roleLabel}</p>
                <h1 className="truncate text-lg font-semibold tracking-[-0.04em] text-ink sm:text-xl">{title}</h1>
              </div>
              <div className="hidden min-w-0 items-center gap-2 md:flex">
                <ThemeToggle />
                {action}
                {role === "host" ? <LinkButton to="/host/onboarding"><Plus className="h-4 w-4" /> Add place</LinkButton> : null}
                <Button type="button" variant="secondary" onClick={handleSignOut} className="min-h-9 px-3">
                  <LogOut className="h-4 w-4" /> Sign out
                </Button>
              </div>
              <button className="rounded-full border border-line bg-surface p-3 shadow-soft lg:hidden" type="button" onClick={() => setMobileNav(true)} aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>
          <main className="max-w-full overflow-x-hidden px-4 py-5 sm:px-5 lg:px-6">
            <div className="mb-5 max-w-5xl">
              <p className="body-type">{subtitle}</p>
            </div>
            <div className="min-w-0 space-y-8">{children}</div>
          </main>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/94 px-2 py-1.5 shadow-lift backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-5 gap-1">
            {nav.slice(0, 5).map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} to={item.href} className={cn("flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold", isActive(item.href) ? "bg-primary text-primary-ink" : "text-ink-soft") }>
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
        <AnimatePresence>
          {mobileNav ? (
            <motion.div className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.aside
                className="h-full w-[88vw] max-w-sm overflow-y-auto bg-surface p-5 shadow-lift"
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={{ duration: 0.28, ease: easing }}
              >
                <div className="flex items-center justify-between">
                  <BrandMark />
                  <button type="button" className="rounded-full border border-line p-3" onClick={() => setMobileNav(false)} aria-label="Close navigation">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {role === "host" ? <LinkButton to="/host/onboarding" className="mt-6 w-full"><Plus className="h-4 w-4" /> Add your place</LinkButton> : null}
                <nav className="mt-6 grid gap-2">
                  {nav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.label} to={item.href} className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold", isActive(item.href) ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-soft")} onClick={() => setMobileNav(false)}>
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                  <Button type="button" variant="secondary" onClick={handleSignOut} className="mt-2 w-full justify-start rounded-2xl">
                    <LogOut className="h-4 w-4" /> Sign out
                  </Button>
                </nav>
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionPage>
  );
}

export function LandingPage() {
  const propertiesQuery = useQuery({ queryKey: ["landing-properties"], queryFn: () => getProperties({ sort: "recommended", size: 12 }) });
  const apiProperties = propertiesQuery.data ?? [];
  const properties = apiProperties.map(toExperienceProperty);
  const featured = properties.slice(0, 6);
  const heroProperty = featured[0];
  const secondaryProperties = featured.slice(1, 4);
  const categories = categoryData(properties).slice(0, 6);
  const testimonials = testimonialsFromProperties(apiProperties);
  const averageRating = properties.length ? (properties.reduce((sum, property) => sum + property.rating, 0) / properties.length).toFixed(1) : "4.9";
  const verifiedCount = properties.filter((property) => property.verified).length || properties.length;
  const reviewCount = properties.reduce((sum, property) => sum + property.reviews, 0);
  const heroStats = [
    [String(verifiedCount || "120+"), "verified stays"],
    [`${averageRating}/5`, "guest confidence"],
    [String(reviewCount || "2k+"), "real reviews"]
  ];
  const trustCards = [
    ["Verified before booking", "Every stay highlights host status, property signals, and clear guest expectations.", ShieldCheck],
    ["No surprise checkout", "Dates, fees, taxes, and protected payment details stay visible before reserve.", Receipt],
    ["Built for hosts too", "Hosts get a calmer operating layer for listings, reservations, revenue, and messages.", Building2]
  ] as const;
  const journeySteps = [
    ["Search with intent", "Choose the city, dates, and guests — UBOOK keeps the discovery flow calm and quick."],
    ["Compare trust signals", "Scan verified hosts, reviews, fees, location notes, and amenities without opening ten tabs."],
    ["Book with confidence", "Reserve from a protected payment flow and keep every trip detail in one workspace."]
  ];

  return (
    <MotionPage>
      <div className="min-h-screen overflow-x-hidden bg-canvas text-ink">
        <PublicNav />

        <section className="relative overflow-hidden border-b border-line bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.16),transparent_32%),radial-gradient(circle_at_85%_18%,hsl(var(--accent)/0.16),transparent_28%)]">
          <div className="pointer-events-none absolute inset-0 subtle-grid opacity-50" />
          <div className="page-shell relative grid min-h-[calc(100vh-4.5rem)] items-center gap-10 py-10 lg:grid-cols-[minmax(0,1.03fr)_minmax(420px,0.97fr)] lg:py-16">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="primary"><Sparkles className="h-3.5 w-3.5" /> Designed for safer stays</Badge>
                <span className="rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-bold text-ink-soft shadow-soft">Travelers · hosts · operations</span>
              </div>
              <h1 className="mt-6 max-w-5xl text-[clamp(3.1rem,8vw,6.7rem)] font-semibold leading-[0.9] tracking-[-0.085em] text-ink">
                Book stays that feel right before you arrive.
              </h1>
              <p className="mt-6 max-w-2xl text-base font-medium leading-8 text-ink-soft sm:text-lg">
                UBOOK blends verified stays, transparent pricing, host messaging, and traveler workspaces into one calm booking experience.
              </p>
              <div className="mt-8 min-w-0 rounded-[2.25rem] border border-line bg-surface/70 p-2 shadow-lift backdrop-blur-2xl">
                <SearchDock />
              </div>
              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {heroStats.map(([value, label]) => (
                  <div key={label} className="rounded-[1.5rem] border border-line bg-surface/75 p-4 shadow-soft backdrop-blur">
                    <p className="text-2xl font-semibold tracking-[-0.055em] text-ink">{value}</p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative min-w-0">
              <div className="absolute -right-10 -top-8 hidden h-52 w-52 rounded-full bg-primary/15 blur-3xl lg:block" />
              <div className="absolute -bottom-10 left-10 hidden h-52 w-52 rounded-full bg-accent/15 blur-3xl lg:block" />
              <div className="relative grid gap-4">
                <motion.div
                  initial={{ opacity: 0, y: 18, rotate: -1 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={{ duration: 0.55, ease: easing }}
                  className="overflow-hidden rounded-[2.6rem] border border-line bg-surface p-3 shadow-lift"
                >
                  <div className="relative overflow-hidden rounded-[2.1rem] bg-ink">
                    <img
                      src={heroProperty?.image || imageManifest.hero.fallback}
                      alt={heroProperty?.title || "Verified UBOOK stay"}
                      className="aspect-[4/5] w-full object-cover opacity-95 lg:aspect-[5/6]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 rounded-[1.7rem] border border-white/15 bg-white/12 p-4 text-white shadow-lift backdrop-blur-xl">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/65">Featured stay</p>
                          <h2 className="mt-2 truncate text-2xl font-semibold tracking-[-0.055em]">{heroProperty?.title || "Verified calm retreat"}</h2>
                          <p className="mt-1 truncate text-sm font-semibold text-white/70">{heroProperty ? `${heroProperty.neighborhood}, ${heroProperty.city}` : "Clear pricing · verified host"}</p>
                        </div>
                        <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right text-ink">
                          <p className="text-lg font-black">${heroProperty?.price || 120}</p>
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">night</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {secondaryProperties.length ? secondaryProperties.map((property) => (
                    <Link key={property.id} to={`/property/${property.id}`} className="group overflow-hidden rounded-[1.7rem] border border-line bg-surface p-2 shadow-soft transition hover:-translate-y-1 hover:shadow-lift">
                      <img src={property.image} alt={property.title} className="aspect-[4/3] w-full rounded-[1.25rem] object-cover transition duration-500 group-hover:scale-[1.03]" />
                      <div className="p-2">
                        <p className="truncate text-sm font-black text-ink">{property.title}</p>
                        <p className="mt-1 text-xs font-bold text-muted">${property.price}/night · {property.rating} ★</p>
                      </div>
                    </Link>
                  )) : (
                    <div className="rounded-[1.7rem] border border-line bg-surface p-4 shadow-soft sm:col-span-3">
                      <p className="text-sm font-bold text-ink-soft">Your best stays will appear here as soon as the backend returns properties.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="content-shell py-16 lg:py-20">
          <div className="grid gap-5 lg:grid-cols-3">
            {trustCards.map(([title, text, Icon]) => (
              <motion.article
                key={title}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2, ease: easing }}
                className="premium-card p-6"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/10">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.055em] text-ink">{title}</h3>
                <p className="mt-3 text-sm font-medium leading-7 text-ink-soft">{text}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="content-shell py-16">
          <SectionHeader
            kicker="Explore by trip style"
            title="A marketplace that adapts to the reason you’re traveling."
            text="Short stay, family trip, student housing, business visit, or resort escape — each category gets clear context instead of a generic grid."
            action={<LinkButton to="/search" variant="secondary">Browse stays <ArrowRight className="h-4 w-4" /></LinkButton>}
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => (
              <motion.div
                key={category.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: index * 0.04, duration: 0.36, ease: easing }}
                className="group relative overflow-hidden rounded-[2rem] border border-line bg-surface p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl transition group-hover:bg-primary/20" />
                <div className="relative flex items-start justify-between">
                  <div className="rounded-2xl bg-surface-2 p-3 text-primary"><Building2 className="h-5 w-5" /></div>
                  <Badge>{category.count}</Badge>
                </div>
                <h3 className="relative mt-6 text-2xl font-semibold tracking-[-0.055em] text-ink">{category.label}</h3>
                <p className="relative mt-2 text-sm font-medium leading-6 text-ink-soft">{category.detail}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="content-shell py-16">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="caption-type">How it feels</p>
              <h2 className="h2-type mt-3">From search to check-in, every step has a reason.</h2>
              <p className="body-type mt-4">The landing page should sell confidence, not just inventory. UBOOK’s flow keeps the emotional decision simple: see trust, understand price, book clearly.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton to="/search">Start exploring</LinkButton>
                <LinkButton to="/host/onboarding" variant="secondary"><Plus className="h-4 w-4" /> Add a rent announcement</LinkButton>
              </div>
            </div>
            <div className="grid gap-4">
              {journeySteps.map(([title, text], index) => (
                <div key={title} className="premium-card flex gap-4 p-5">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-sm font-black text-canvas">0{index + 1}</div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.035em] text-ink">{title}</h3>
                    <p className="mt-1 text-sm font-medium leading-6 text-ink-soft">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="content-shell py-16">
          <SectionHeader kicker="Featured stays" title="A visual grid that helps people decide faster." />
          {featured.length ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {featured.map((property, index) => <PropertyCard key={property.id} property={property} featured={index === 0} />)}
            </div>
          ) : (
            <EmptyState icon={<Home className="h-5 w-5" />} title="No stays yet" text="Once your backend returns properties, this section becomes a premium discovery grid." action={<LinkButton to="/host/onboarding"><Plus className="h-4 w-4" /> Add first place</LinkButton>} />
          )}
        </section>

        <section className="content-shell py-16">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-line bg-ink p-6 text-canvas shadow-lift lg:p-10">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
            <div className="absolute -bottom-28 left-12 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-white/55">For hosts</p>
                <h2 className="mt-3 text-4xl font-semibold tracking-[-0.07em] text-white lg:text-5xl">Turn an empty place into a trusted rent announcement.</h2>
                <p className="mt-4 text-sm font-medium leading-7 text-white/70">Give hosts a clear path: create a listing, manage bookings, message travelers, and see revenue from one workspace.</p>
                <LinkButton to="/host/onboarding" className="mt-6 bg-white text-ink hover:shadow-lift"><Plus className="h-4 w-4" /> Add rent announcement</LinkButton>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {["Smart listing setup", "Availability calendar", "Protected payouts", "Guest messages"].map((item) => (
                  <div key={item} className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 backdrop-blur">
                    <Check className="h-5 w-5 text-white" />
                    <p className="mt-4 text-lg font-semibold tracking-[-0.04em] text-white">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="content-shell py-16">
          <SectionHeader kicker="Guest voices" title="Trust feels better when people sound real." />
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {testimonials.length ? testimonials.slice(0, 3).map((item) => (
              <article key={`${item.name}-${item.quote}`} className="premium-card p-6">
                <p className="text-lg font-medium leading-8 text-ink">“{item.quote}”</p>
                <div className="mt-6 flex items-center gap-3">
                  <img src={item.avatar} alt={item.name} className="h-12 w-12 rounded-full object-cover" />
                  <div>
                    <p className="font-bold text-ink">{item.name}</p>
                    <p className="text-sm font-semibold text-muted">{item.role}</p>
                  </div>
                </div>
              </article>
            )) : (
              <EmptyState title="Reviews will live here" text="After verified stays are completed, this becomes social proof for travelers and hosts." />
            )}
          </div>
        </section>

        <PublicFooter />
      </div>
    </MotionPage>
  );
}

function AuthShell({ mode }: { mode: "login" | "register" | "forgot" | "verify" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [role, setRole] = useState<"Traveler" | "Host">("Traveler");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(searchParams.get("oauthError")?.replace(/_/g, " ") || "");

  const [requiresTwoFactor, setRequiresTwoFactor] = useState(Boolean(searchParams.get("tempToken") || searchParams.get("temp_token")));
  const [tempToken, setTempToken] = useState(searchParams.get("tempToken") || searchParams.get("temp_token") || "");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const signupSecurityRedirect = role === "Host" ? "/host#settings" : "/dashboard#profile";
  const defaultRedirect = mode === "register" ? signupSecurityRedirect : "/dashboard";
  const redirectTo = safeRedirectPath(searchParams.get("redirectTo") || searchParams.get("redirect") || (location.state as { from?: string } | null)?.from, defaultRedirect);

  const activeSessionQuery = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    retry: false,
    staleTime: 30_000,
    enabled: !requiresTwoFactor
  });

  const goToWorkspace = (user?: AuthUserLike | null, fallback?: string) => {
    queryClient.invalidateQueries({ queryKey: ["current-user"] });
    const target = safeRedirectPath(fallback || redirectTo, workspacePathForUser(user));
    navigate(target, { replace: true });
  };

  useEffect(() => {
    const oauthTempToken = searchParams.get("tempToken") || searchParams.get("temp_token");
    const oauthError = searchParams.get("oauthError");

    if (oauthTempToken) {
      setTempToken(oauthTempToken);
      setRequiresTwoFactor(true);
      setError("");
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("tempToken");
        next.delete("temp_token");
        return next;
      }, { replace: true });
    }

    if (oauthError) {
      setError(oauthError.replace(/_/g, " "));
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!requiresTwoFactor && activeSessionQuery.data) {
      goToWorkspace(activeSessionQuery.data as AuthUserLike);
    }
  }, [requiresTwoFactor, activeSessionQuery.data]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setLoading(true);
    setError("");

    try {
      if (requiresTwoFactor) {
        if (!tempToken) {
          setError("Your 2FA session expired. Please log in again.");
          setRequiresTwoFactor(false);
          return;
        }

        const code = useRecoveryCode ? undefined : twoFactorCode.replace(/\s+/g, "");
        const backup = useRecoveryCode ? recoveryCode.trim() : undefined;

        if (!code && !backup) {
          setError(useRecoveryCode ? "Enter a recovery code." : "Enter your 6-digit authenticator code.");
          return;
        }

        const response = await validateTwoFactor(tempToken, code, backup);
        goToWorkspace(response.user as AuthUserLike | undefined);
        return;
      }

      if (mode === "forgot") {
        await forgotPassword(String(form.get("email") || "").trim());
        navigate("/login", { replace: true });
        return;
      }

      if (mode === "verify") {
        await verifyEmail();
        goToWorkspace(undefined, "/dashboard");
        return;
      }

      if (mode === "register") {
        const response = await register({
          fullName: String(form.get("fullName") || "").trim(),
          email: String(form.get("email") || "").trim(),
          password: String(form.get("password") || ""),
          role
        });

        goToWorkspace(response.user as AuthUserLike | undefined, signupSecurityRedirect);
        return;
      }

      const response = (await login({
        email: String(form.get("email") || "").trim(),
        password: String(form.get("password") || "")
      })) as AuthResponseLike;

      if (authResponseNeedsTwoFactor(response)) {
        const nextTempToken = getTwoFactorTempToken(response);

        if (!nextTempToken) {
          setError("2FA is required, but the server did not return a temporary token.");
          return;
        }

        setTempToken(nextTempToken);
        setRequiresTwoFactor(true);
        setTwoFactorCode("");
        setRecoveryCode("");
        setUseRecoveryCode(false);
        return;
      }

      goToWorkspace(response.user);
    } catch (error_) {
      setError(getApiErrorMessage(error_, "Authentication failed"));
    } finally {
      setLoading(false);
    }
  };

  const checkingExistingSession = !requiresTwoFactor && activeSessionQuery.isLoading;
  const title = requiresTwoFactor
    ? "One more quick check."
    : mode === "login"
      ? "Welcome back."
      : mode === "register"
        ? "Create your UBOOK account."
        : mode === "forgot"
          ? "Let’s get you back in."
          : "Verify your email.";

  return (
    <MotionPage>
      <div className="grid min-h-screen overflow-x-hidden bg-canvas lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md">
            <BrandMark />
            <h1 className="h2-type mt-8">{checkingExistingSession ? "Checking if you’re already signed in." : title}</h1>
            <p className="body-type mt-4">
              {checkingExistingSession
                ? "If your session is still active, we’ll take you directly to your workspace."
                : requiresTwoFactor
                  ? "Enter the code from your authenticator app, or use one of your recovery codes."
                  : mode === "verify"
                    ? "Verify your email to unlock trusted booking and host operations."
                    : "Sign in with email or OAuth. We’ll take you straight to the right workspace."}
            </p>

            {checkingExistingSession ? (
              <div className="premium-card mt-8 p-5">
                <div className="flex items-center gap-3 text-sm font-bold text-ink-soft">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Looking for your active session...
                </div>
              </div>
            ) : (
              <form onSubmit={submit} className="premium-card mt-8 grid gap-4 p-5">
                {requiresTwoFactor ? (
                  <div className="rounded-[1.5rem] border border-primary/20 bg-primary/10 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-black text-ink">Two-factor authentication</p>
                        <p className="mt-1 text-sm leading-6 text-ink-soft">
                          This extra step protects your bookings, payouts, messages, and account access.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {mode === "register" && !requiresTwoFactor ? (
                  <label>
                    <span className="caption-type">Full name</span>
                    <input className="input-control mt-2" name="fullName" autoComplete="name" required />
                  </label>
                ) : null}

                {!requiresTwoFactor && mode !== "verify" ? (
                  <label>
                    <span className="caption-type">Email</span>
                    <div className="relative mt-2">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <input className="input-control pl-11" name="email" type="email" autoComplete="email" required />
                    </div>
                  </label>
                ) : null}

                {!requiresTwoFactor && mode === "verify" ? (
                  <label>
                    <span className="caption-type">Verification code</span>
                    <input className="input-control mt-2 text-center text-xl tracking-[0.45em]" name="code" inputMode="numeric" autoComplete="one-time-code" />
                  </label>
                ) : null}

                {!requiresTwoFactor && (mode === "login" || mode === "register") ? (
                  <label>
                    <span className="caption-type">Password</span>
                    <div className="relative mt-2">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                      <input className="input-control pl-11" name="password" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} required />
                    </div>
                  </label>
                ) : null}

                {!requiresTwoFactor && mode === "register" ? (
                  <div>
                    <span className="caption-type">Workspace</span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {(["Traveler", "Host"] as const).map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={cn("rounded-2xl border px-4 py-3 text-sm font-bold", role === item ? "border-primary bg-primary/10 text-primary" : "border-line bg-surface-2 text-ink-soft")}
                          onClick={() => setRole(item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {requiresTwoFactor ? (
                  <div className="grid gap-3">
                    {!useRecoveryCode ? (
                      <label>
                        <span className="caption-type">Authenticator code</span>
                        <input
                          className="input-control mt-2 text-center text-xl tracking-[0.35em]"
                          value={twoFactorCode}
                          onChange={(event) => setTwoFactorCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          required
                          autoFocus
                        />
                      </label>
                    ) : (
                      <label>
                        <span className="caption-type">Recovery code</span>
                        <input
                          className="input-control mt-2 font-mono"
                          value={recoveryCode}
                          onChange={(event) => setRecoveryCode(event.target.value)}
                          autoComplete="one-time-code"
                          required
                          autoFocus
                        />
                      </label>
                    )}

                    <button
                      type="button"
                      className="text-left text-sm font-bold text-primary"
                      onClick={() => {
                        setUseRecoveryCode((value) => !value);
                        setTwoFactorCode("");
                        setRecoveryCode("");
                        setError("");
                      }}
                    >
                      {useRecoveryCode ? "Use authenticator code instead" : "Use a recovery code instead"}
                    </button>
                  </div>
                ) : null}

                {error ? <div className="rounded-2xl bg-error/10 p-3 text-sm font-semibold text-error">{error}</div> : null}

                <Button type="submit" disabled={loading}>
                  {loading
                    ? "Working..."
                    : requiresTwoFactor
                      ? "Verify and continue"
                      : mode === "forgot"
                        ? "Send reset link"
                        : mode === "verify"
                          ? "Verify email"
                          : mode === "register"
                            ? "Create account"
                            : "Log in"}
                </Button>

                {!requiresTwoFactor && (mode === "login" || mode === "register") ? (
                  <>
                    <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      <span className="h-px flex-1 bg-line" />
                      Or continue with
                      <span className="h-px flex-1 bg-line" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button type="button" variant="secondary" onClick={() => startOAuthLogin("google", role)}>
                        Google
                      </Button>

                      <Button type="button" variant="secondary" onClick={() => startOAuthLogin("microsoft", role)}>
                        Microsoft
                      </Button>
                    </div>
                  </>
                ) : null}

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold">
                  {requiresTwoFactor ? (
                    <button
                      type="button"
                      className="text-primary"
                      onClick={() => {
                        setRequiresTwoFactor(false);
                        setTempToken("");
                        setTwoFactorCode("");
                        setRecoveryCode("");
                        setError("");
                      }}
                    >
                      Back to password login
                    </button>
                  ) : mode !== "login" ? (
                    <Link to="/login" className="text-primary">Back to login</Link>
                  ) : (
                    <Link to="/forgot-password" className="text-primary">Forgot password?</Link>
                  )}
                  {!requiresTwoFactor && mode !== "register" ? <Link to="/register" className="text-ink-soft">Create account</Link> : null}
                </div>
              </form>
            )}
          </div>
        </div>
        <div className="relative hidden overflow-hidden bg-ink lg:block">
          <img src={mode === "register" ? imageManifest.destinationsGrid.fallback : imageManifest.propertiesGrid.fallback} alt="UBOOK workspace preview" className="h-full w-full object-cover opacity-90" />
          <div className="absolute inset-0 bg-hero-wash" />
          <div className="absolute bottom-10 left-10 right-10 rounded-[2rem] border border-white/20 bg-white/12 p-8 text-white backdrop-blur-xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Secure by design</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.06em]">One identity for bookings, hosting, payments, and trust operations.</h2>
          </div>
        </div>
      </div>
    </MotionPage>
  );
}

export function LoginPage() {
  return <AuthShell mode="login" />;
}

export function RegisterPage() {
  return <AuthShell mode="register" />;
}

export function ForgotPasswordPage() {
  return <AuthShell mode="forgot" />;
}

export function EmailVerificationPage() {
  return <AuthShell mode="verify" />;
}

export function SearchResults() {
  const [params] = useSearchParams();
  const [type, setType] = useState("All");
  const [sort, setSort] = useState("Recommended");
  const [maxPrice, setMaxPrice] = useState(500);
  const [savedSearch, setSavedSearch] = useState(false);
  const destination = params.get("destination") || "";
  const searchParams = {
    destination,
    propertyType: type === "All" ? undefined : type,
    maxPrice,
    sort: sort === "Price" ? "price-low" : sort === "Rating" ? "rating" : "recommended",
    checkIn: params.get("checkIn") || undefined,
    checkOut: params.get("checkOut") || undefined,
    guests: params.get("guests") || undefined,
  };
  const query = useQuery({ queryKey: ["properties", searchParams], queryFn: () => getProperties(searchParams) });
  const saveSearch = useMutation({
    mutationFn: () => createSavedSearch(destination || "Explore verified stays", searchParams),
    onSuccess: () => setSavedSearch(true)
  });
  const results = useMemo(() => {
    return (query.data ?? []).map(toExperienceProperty);
  }, [query.data]);
  return (
    <MotionPage>
      <div className="min-h-screen overflow-x-hidden bg-canvas">
        <PublicNav />
        <main className="page-shell py-8">
          <div className="premium-panel p-4 sm:p-5">
            <SearchDock compact />
          </div>
          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <aside className="h-fit rounded-[2rem] border border-line bg-surface p-5 shadow-soft xl:sticky xl:top-28">
              <div className="flex items-center justify-between">
                <h2 className="h4-type">Smart filters</h2>
                <SlidersHorizontal className="h-5 w-5 text-primary" />
              </div>
              <div className="mt-5 grid gap-5">
                <FilterBlock title="Property type">
                  <div className="grid grid-cols-2 gap-2">
                    {propertyTypeOptions.map((item) => (
                      <button key={item} type="button" onClick={() => setType(item)} className={cn("rounded-2xl px-3 py-2 text-sm font-bold", type === item ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-soft")}>
                        {item}
                      </button>
                    ))}
                  </div>
                </FilterBlock>
                <FilterBlock title="Price">
                  <input type="range" min={40} max={500} value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} className="w-full accent-primary" />
                  <div className="flex justify-between text-xs font-bold text-muted"><span>$40</span><span>$500+</span></div>
                </FilterBlock>
                <FilterBlock title="Amenities">
                  <div className="flex flex-wrap gap-2">
                    {amenityOptions.map((item) => <Badge key={item}>{item}</Badge>)}
                  </div>
                </FilterBlock>
                <FilterBlock title="Trust">
                  {trustOptions.map((item) => (
                    <label key={item} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 text-sm font-bold text-ink-soft">
                      <input type="checkbox" defaultChecked={item !== "Flexible cancellation"} />
                      {item}
                    </label>
                  ))}
                </FilterBlock>
              </div>
            </aside>
            <section className="min-w-0">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="caption-type">Property discovery</p>
                  <h1 className="h2-type mt-2">{destination ? `Stays in ${destination}` : "Explore verified stays"}</h1>
                  <p className="body-type mt-3">{results.length} announcements shown as a clean grid. Click any stay to open its full details.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={savedSearch ? "primary" : "secondary"} onClick={() => saveSearch.mutate()} disabled={saveSearch.isPending}><Bell className="h-4 w-4" /> {savedSearch ? "Saved" : "Save search"}</Button>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {["Instant results", "Map-ready", "Safe payments", "Student friendly"].map((item) => <Badge key={item} tone="accent">{item}</Badge>)}
                </div>
                <select className="input-control max-w-[220px]" value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option>Recommended</option>
                  <option>Price</option>
                  <option>Rating</option>
                </select>
              </div>
              <div className="mt-6 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
                {query.isLoading ? (
                  Array.from({ length: 12 }).map((_, index) => (
                    <div key={index} className="min-h-[360px] animate-pulse rounded-[1.75rem] border border-line bg-surface/70 shadow-soft" />
                  ))
                ) : results.length ? (
                  results.map((property) => <PropertyCard key={property.id} property={property} />)
                ) : (
                  <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 2xl:col-span-6">
                    <EmptyState
                      icon={<Search className="h-5 w-5" />}
                      title="No announcements found"
                      text="Try another destination, a higher budget, or fewer filters to see more stays."
                      action={<Button type="button" variant="secondary" onClick={() => { setType("All"); setMaxPrice(500); }}>Reset filters</Button>}
                    />
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
        <PublicFooter />
      </div>
    </MotionPage>
  );
}

function FilterBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="caption-type">{title}</p>
      <div className="mt-3 grid gap-2">{children}</div>
    </div>
  );
}

function MapExperience({ results }: { results: Property[] }) {
  return (
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="relative min-h-[620px] overflow-hidden rounded-[2rem] border border-line bg-surface-2 shadow-soft">
        <div className="subtle-grid absolute inset-0" />
        {results.map((property, index) => (
          <Link
            key={property.id}
            to={`/property/${property.id}`}
            className="absolute rounded-full bg-ink px-3 py-2 text-sm font-black text-canvas shadow-lift"
            style={{ left: `${18 + (index * 13) % 62}%`, top: `${18 + (index * 17) % 58}%` }}
          >
            ${property.price}
          </Link>
        ))}
        <div className="absolute bottom-5 left-5 right-5 rounded-[1.5rem] border border-line bg-surface/90 p-5 backdrop-blur">
          <p className="caption-type">Map view</p>
          <p className="mt-2 text-lg font-semibold text-ink">Interactive map composition placeholder powered by property coordinates.</p>
        </div>
      </div>
      <div className="grid gap-4">
        {results.slice(0, 3).map((property) => <PropertyCard key={property.id} property={property} />)}
      </div>
    </div>
  );
}

export function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [checkIn, setCheckIn] = useState(() => addDaysIso(todayIso(), 1));
  const [checkOut, setCheckOut] = useState(() => addDaysIso(todayIso(), 4));
  const [calendarMonth, setCalendarMonth] = useState(() => monthStartIso(todayIso()));
  const [guests, setGuests] = useState("2");
  const [reservationError, setReservationError] = useState("");
  const [bookingPanelOpen, setBookingPanelOpen] = useState(true);
  const [bookingDetailsOpen, setBookingDetailsOpen] = useState(false);
  const [mobileBookingOpen, setMobileBookingOpen] = useState(false);
  const [bookingScrollY, setBookingScrollY] = useState(0);

  useEffect(() => {
    const updateBookingScroll = () => {
      setBookingScrollY(window.scrollY || document.documentElement.scrollTop || 0);
    };

    updateBookingScroll();
    window.addEventListener("scroll", updateBookingScroll, { passive: true });

    return () => window.removeEventListener("scroll", updateBookingScroll);
  }, []);
  const propertyId = Number(id);
  const today = todayIso();
  const activeSession = Boolean(getSessionExpiresAt()) && !isSessionExpired();
  const selectedNights = daysBetween(checkIn, checkOut);
  const hasBasicDateRange = Boolean(checkIn && checkOut && selectedNights > 0 && checkIn >= today);
  const calendarStart = calendarMonth;
  const calendarEnd = addDaysIso(addMonthsIso(calendarMonth, 2), -1);
  const propertyQuery = useQuery({ queryKey: ["property", propertyId], queryFn: () => getPropertyById(propertyId), enabled: Number.isFinite(propertyId) });
  const apiProperty = propertyQuery.data;
  const property = apiProperty ? toExperienceProperty(apiProperty) : null;
  const currentUserQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, enabled: activeSession, retry: false, staleTime: 30_000 });
  const similarQuery = useQuery({
    queryKey: ["similar-properties", property?.city, property?.type],
    queryFn: () => getProperties({ city: property?.city, propertyType: property?.type, size: 4 }),
    enabled: Boolean(property)
  });
  const calendarQuery = useQuery({
    queryKey: ["reservation-calendar", propertyId, calendarStart, calendarEnd],
    queryFn: () => getPropertyReservationCalendar(propertyId, { start: calendarStart, end: calendarEnd }),
    enabled: Boolean(property)
  });
  const pricingQuery = useQuery({
    queryKey: ["pricing", propertyId, checkIn, checkOut, guests],
    queryFn: () => getDynamicPriceForDates(propertyId, checkIn, checkOut, Number(guests)),
    enabled: Boolean(property && hasBasicDateRange)
  });
  const availabilityQuery = useQuery({
    queryKey: ["property-availability", propertyId, checkIn, checkOut, guests],
    queryFn: () => checkAvailability(propertyId, checkIn, checkOut, Number(guests)),
    enabled: Boolean(property && hasBasicDateRange)
  });
  const saveFavorite = useMutation({
    mutationFn: () => addFavorite(propertyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
      await queryClient.invalidateQueries({ queryKey: ["traveler-dashboard"] });
    }
  });
  if (!property || !apiProperty) {
    return <div className="min-h-screen overflow-x-hidden bg-canvas" />;
  }
  const calendarRows = new globalThis.Map<string, ReservationCalendarDay>((calendarQuery.data || []).map((row) => [row.date, row]));
  const blockedSelection = selectedStayDates(checkIn, checkOut).some((date) => calendarRows.get(date)?.available === false);
  const backendUnavailable = availabilityQuery.data?.available === false;
  const validationMessage = checkIn < today
    ? "Choose a check-in date that is not in the past."
    : selectedNights <= 0
      ? "Choose a check-out date after check-in."
      : blockedSelection
        ? "Your selected stay includes a blocked or reserved night."
        : backendUnavailable
          ? "These dates are no longer available."
          : "";
  const nights = Math.max(1, selectedNights);
  const fees = Math.round((pricingQuery.data?.serviceFee ?? property.price * nights * 0.18) + (pricingQuery.data?.cityTax ?? 0));
  const total = Math.round(pricingQuery.data?.total ?? property.price * nights + fees);
  const similar = (similarQuery.data ?? []).map(toExperienceProperty).filter((item) => item.id !== property.id).slice(0, 3);
  const bookingScrollStage = bookingScrollY > 820 ? "deep" : bookingScrollY > 240 ? "compact" : "hero";
  const bookingCardCompact = bookingScrollStage !== "hero";
  const bookingCardDeep = bookingScrollStage === "deep";
  const bookingPath = `/booking/${property.id}?${new URLSearchParams({ checkIn, checkOut, guests }).toString()}`;
  const reserve = () => {
    if (validationMessage) {
      setReservationError(validationMessage);
      setBookingDetailsOpen(true);
      return;
    }
    setReservationError("");
    if (!currentUserQuery.data) {
      navigate(`/login?redirect=${encodeURIComponent(bookingPath)}`);
      return;
    }
    navigate(bookingPath);
  };

  return (
    <MotionPage>
      <div className="min-h-screen overflow-x-hidden bg-canvas">
        <PublicNav />
        <main className={cn("page-shell py-8 transition-[padding] duration-500 ease-premium", bookingPanelOpen && (bookingCardDeep ? "xl:pr-[350px]" : bookingCardCompact ? "xl:pr-[390px]" : "xl:pr-[430px]"))}>
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <Badge tone="success"><BadgeCheck className="h-3.5 w-3.5" /> Verified stay</Badge>
              <h1 className="h1-type mt-4 max-w-5xl">{property.title}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-3 text-sm font-bold text-ink-soft">
                <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4 text-primary" /> {property.neighborhood}, {property.city}</span>
                <span className="inline-flex items-center gap-1"><Star className="h-4 w-4 fill-warning text-warning" /> {property.rating} / {property.reviews} reviews</span>
                <span>{property.guests} guests</span>
              </p>
            </div>
            <Button variant="secondary" onClick={() => saveFavorite.mutate()} disabled={saveFavorite.isPending}><Heart className="h-4 w-4" /> Save</Button>
          </div>
          <section className="grid gap-3 overflow-hidden rounded-[2rem] md:grid-cols-[1.3fr_0.7fr]">
            <img src={property.image} alt={property.title} className="aspect-[16/10] h-full w-full object-cover" />
            <div className="grid grid-cols-2 gap-3">
              {property.gallery.slice(0, 4).map((image) => <img key={image} src={image} alt={property.title} className="h-full min-h-40 w-full rounded-[1.25rem] object-cover" />)}
            </div>
          </section>
          <div className="mt-8 grid min-w-0 gap-8">
            <section className="grid gap-6">
              <article className="premium-card p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="h3-type">Hosted by {property.host}</h2>
                    <p className="mt-2 text-sm font-semibold text-ink-soft">Host since {property.hostSince} / identity and payout verified</p>
                    {property.hostId ? <Link to={`/hosts/${property.hostId}`} className="mt-3 inline-flex text-sm font-black text-primary">View host profile and apartments</Link> : null}
                  </div>
                  {property.hostId ? (
                    <Link to={`/hosts/${property.hostId}`} className="shrink-0">
                      <img src={property.hostAvatar || imageManifest.avatars.maya} alt={property.host} className="h-16 w-16 rounded-2xl object-cover" />
                    </Link>
                  ) : (
                    <img src={property.hostAvatar || imageManifest.avatars.maya} alt={property.host} className="h-16 w-16 rounded-2xl object-cover" />
                  )}
                </div>
                <p className="body-type mt-6 break-words">{property.description}</p>
              </article>
              <article className="premium-card p-6">
                <SectionHeader kicker="Amenities" title="Everything important is visible before payment." />
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {property.amenities.map((amenity) => <div key={amenity} className="rounded-2xl bg-surface-2 p-4 text-sm font-bold text-ink-soft">{amenity}</div>)}
                </div>
              </article>
              <article className="premium-card p-6">
                <SectionHeader kicker="Availability" title="Clear dates, rules, and booking confidence." />
                <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <ReservationDateCalendar
                    rows={calendarRows}
                    month={calendarMonth}
                    checkIn={checkIn}
                    checkOut={checkOut}
                    onMonthChange={(nextMonth) => {
                      setCalendarMonth(nextMonth);
                      setReservationError("");
                    }}
                    onRangeChange={(nextCheckIn, nextCheckOut) => {
                      setCheckIn(nextCheckIn);
                      setCheckOut(nextCheckOut);
                      setCalendarMonth(monthStartIso(nextCheckIn));
                      setReservationError("");
                    }}
                    loading={calendarQuery.isLoading}
                  />
                  <div className="grid content-start gap-3 rounded-[1.5rem] border border-line bg-surface-2 p-4 text-sm font-semibold text-ink-soft">
                    <LineItem label="Check-in" value={formatFriendlyDate(checkIn)} />
                    <LineItem label="Check-out" value={formatFriendlyDate(checkOut)} />
                    <LineItem label="Nights" value={`${nights}`} />
                    <LineItem label="Guests" value={`${guests}`} />
                    <LineItem label="Total" value={currency(total)} strong />
                    {validationMessage ? <div className="rounded-2xl bg-warning/15 p-3 text-warning">{validationMessage}</div> : <div className="rounded-2xl bg-success/10 p-3 text-success">Dates are ready for final review.</div>}
                  </div>
                </div>
              </article>
              <article className="premium-card p-6">
                <SectionHeader kicker="Reviews" title="All apartment reviews." />
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {apiProperty.reviews.length ? apiProperty.reviews.map((item) => (
                    <div key={item.id} className="rounded-[1.25rem] bg-surface-2 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone="success">{item.rating} stars</Badge>
                        {item.createdAt ? <span className="text-xs font-bold text-muted">{formatFriendlyDate(item.createdAt.slice(0, 10))}</span> : null}
                      </div>
                      <p className="text-sm leading-6 text-ink-soft">"{item.comment}"</p>
                      <p className="mt-4 font-bold text-ink">{item.author}</p>
                    </div>
                  )) : <EmptyState title="No apartment reviews yet" text="Verified guest reviews will appear here after completed stays." />}
                </div>
              </article>
              <article className="premium-card p-6">
                <SectionHeader kicker="Location" title="Neighborhood context, not just a pin." text={`${property.distance}. The location block prioritizes transit, safety, arrival clarity, and nearby essentials.`} />
                <div className="subtle-grid mt-6 grid min-h-72 place-items-center rounded-[1.5rem] bg-surface-2">
                  <Badge tone="primary"><MapPin className="h-3.5 w-3.5" /> {property.neighborhood}</Badge>
                </div>
              </article>
            </section>

          </div>
          <section className="mt-12 pb-28 xl:pb-0">
            <SectionHeader kicker="Similar properties" title="Comparable stays nearby." />
            <div className="mt-6 grid gap-5 md:grid-cols-3">{similar.map((item) => <PropertyCard key={item.id} property={item} />)}</div>
          </section>
        </main>

        <AnimatePresence initial={false}>
          {bookingPanelOpen ? (
            <motion.aside
              key="desktop-booking-sidebar"
              className={cn(
                "fixed right-6 z-40 hidden overflow-y-auto overscroll-contain pr-1 [scrollbar-gutter:stable] xl:block",
                bookingCardDeep ? "top-5 bottom-5 w-[318px]" : bookingCardCompact ? "top-7 bottom-7 w-[344px]" : "top-24 bottom-6 w-[408px]"
              )}
              initial={{ x: 440, opacity: 0, scale: 0.96 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 440, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.42, ease: easing }}
            >
              <motion.div
                layout
                className={cn(
                  "relative overflow-hidden border border-line/80 bg-surface/95 ring-1 ring-white/70 backdrop-blur-2xl",
                  "shadow-[0_28px_100px_rgba(17,24,39,0.18)]",
                  bookingCardDeep ? "rounded-[1.6rem]" : bookingCardCompact ? "rounded-[1.85rem]" : "rounded-[2.25rem]"
                )}
                transition={{ layout: { duration: 0.38, ease: easing } }}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-primary/16 via-accent/8 to-transparent" />
                <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-20 left-8 h-56 w-56 rounded-full bg-accent/12 blur-3xl" />

                <motion.div layout className={cn("relative", bookingCardDeep ? "p-4" : bookingCardCompact ? "p-4" : "p-5")}>
                  <motion.div layout className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <motion.div layout className="inline-flex items-center gap-2 rounded-full border border-line bg-white/70 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-muted shadow-soft backdrop-blur">
                        <ShieldCheck className="h-3.5 w-3.5 text-success" />
                        {bookingCardDeep ? "Ready to reserve" : bookingCardCompact ? "Booking companion" : "Booking assistant"}
                      </motion.div>
                      <motion.div layout className={cn("mt-4 flex items-end gap-2", bookingCardDeep && "mt-3")}>
                        <p className={cn("font-semibold tracking-[-0.08em] text-ink", bookingCardDeep ? "text-3xl" : bookingCardCompact ? "text-4xl" : "text-5xl")}>{bookingCardDeep ? currency(total) : `$${property.price}`}</p>
                        <p className="pb-1.5 text-sm font-bold text-muted">{bookingCardDeep ? "total" : "/ night"}</p>
                      </motion.div>
                      <p className="mt-2 text-sm font-bold text-ink-soft">{nights} nights · {guests} guests · {bookingCardDeep ? "final review next" : "review before paying"}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setBookingPanelOpen(false)}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line bg-white/75 text-ink shadow-soft transition hover:-translate-x-0.5 hover:bg-primary hover:text-primary-ink"
                      aria-label="Collapse booking panel"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </motion.div>

                  <motion.div layout className={cn("mt-4 overflow-hidden rounded-[1.5rem] border border-line bg-white/65 p-2 shadow-soft backdrop-blur", bookingCardDeep && "rounded-[1.25rem]") }>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded-[1rem] bg-success/10 px-2 py-2">
                        <ShieldCheck className="mx-auto h-3.5 w-3.5 text-success" />
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-success">Protected</p>
                      </div>
                      <div className="rounded-[1rem] bg-primary/10 px-2 py-2">
                        <Check className="mx-auto h-3.5 w-3.5 text-primary" />
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-primary">No charge</p>
                      </div>
                      <div className="rounded-[1rem] bg-accent/10 px-2 py-2">
                        <Sparkles className="mx-auto h-3.5 w-3.5 text-accent" />
                        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-accent">Verified</p>
                      </div>
                    </div>
                  </motion.div>

                  <motion.div
                    layout
                    className={cn(
                      "mt-4 overflow-hidden rounded-[1.75rem] border border-line bg-gradient-to-br from-ink via-ink to-primary/85 text-canvas shadow-lift",
                      bookingCardDeep ? "p-3" : "p-4"
                    )}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/55">Total estimate</p>
                        <p className={cn("mt-1 font-semibold tracking-[-0.06em] text-white", bookingCardDeep ? "text-2xl" : "text-3xl")}>{currency(total)}</p>
                        {!bookingCardDeep ? <p className="mt-1 text-xs font-semibold text-white/60">Includes visible fees and taxes</p> : null}
                      </div>
                      <Button type="button" onClick={reserve} className={cn("bg-primary text-primary-ink hover:shadow-lift", bookingCardDeep ? "min-h-11 px-4" : "min-h-12 px-6")}>
                        Reserve{bookingCardDeep ? ` · ${currency(total)}` : ""}
                      </Button>
                    </div>
                  </motion.div>
                  {(reservationError || validationMessage) ? (
                    <div className="mt-3 rounded-2xl bg-warning/15 p-3 text-sm font-semibold text-warning">
                      {reservationError || validationMessage}
                    </div>
                  ) : null}

                  <AnimatePresence initial={false}>
                    {!bookingCardDeep ? (
                      <motion.div
                        key="booking-summary-lines"
                        layout
                        initial={{ opacity: 0, height: 0, y: -8 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -8 }}
                        transition={{ duration: 0.28, ease: easing }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 overflow-hidden rounded-[1.65rem] border border-line bg-canvas/70">
                          <div className="grid gap-3 p-4 text-sm font-semibold text-ink-soft">
                            <LineItem label={`${nights} nights`} value={currency(Math.round(pricingQuery.data?.subtotal ?? property.price * nights))} />
                            <LineItem label="Fees and taxes" value={currency(fees)} />
                          </div>
                          <div className="flex items-center justify-between border-t border-line bg-surface/75 px-4 py-3">
                            <span className="text-sm font-black uppercase tracking-[0.16em] text-muted">Total</span>
                            <span className="text-2xl font-semibold tracking-[-0.05em] text-ink">{currency(total)}</span>
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={() => setBookingDetailsOpen((value) => !value)}
                    className={cn(
                      "mt-4 flex w-full items-center justify-between rounded-[1.4rem] border border-line bg-white/75 px-4 py-3.5 text-left text-sm font-black text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-surface",
                      bookingCardDeep && "py-3"
                    )}
                    aria-expanded={bookingDetailsOpen}
                  >
                    <span>{bookingDetailsOpen ? "Hide dates and guests" : bookingCardDeep ? "Edit trip" : "Edit dates and guests"}</span>
                    <ChevronRight className={cn("h-4 w-4 transition-transform duration-300", bookingDetailsOpen && "rotate-90")} />
                  </button>

                  <AnimatePresence initial={false}>
                    {bookingDetailsOpen ? (
                      <motion.div
                        key="booking-details"
                        initial={{ height: 0, opacity: 0, x: 18 }}
                        animate={{ height: "auto", opacity: 1, x: 0 }}
                        exit={{ height: 0, opacity: 0, x: 18 }}
                        transition={{ duration: 0.26, ease: easing }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 grid gap-3 rounded-[1.5rem] border border-line bg-surface/80 p-3">
                          <label><span className="caption-type">Check-in</span><input className="input-control mt-2" type="date" min={today} value={checkIn} onChange={(event) => { setCheckIn(event.target.value); setCalendarMonth(monthStartIso(event.target.value)); setReservationError(""); }} /></label>
                          <label><span className="caption-type">Check-out</span><input className="input-control mt-2" type="date" min={addDaysIso(checkIn, 1)} value={checkOut} onChange={(event) => { setCheckOut(event.target.value); setReservationError(""); }} /></label>
                          <label><span className="caption-type">Guests</span><select className="input-control mt-2" value={guests} onChange={(event) => { setGuests(event.target.value); setReservationError(""); }}><option value="1">1 guest</option><option value="2">2 guests</option><option value="4">4 guests</option><option value="6">6 guests</option></select></label>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {!bookingCardCompact ? (
                      <motion.div
                        key="booking-human-note"
                        className="mt-4 rounded-[1.5rem] border border-line bg-white/60 p-4 shadow-soft"
                        initial={{ opacity: 0, height: 0, y: 8 }}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: 8 }}
                        transition={{ duration: 0.26, ease: easing }}
                      >
                        <div className="flex gap-3 text-sm font-semibold leading-6 text-ink-soft">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent"><Sparkles className="h-4 w-4" /></span>
                          <p>You’ll review the final amount, payment method, cancellation notes, and host rules before confirming.</p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            </motion.aside>
          ) : (
            <motion.button
              key="desktop-booking-reopen"
              type="button"
              onClick={() => setBookingPanelOpen(true)}
              className="fixed right-5 top-32 z-40 hidden rounded-l-[1.5rem] border border-r-0 border-line bg-surface/95 px-3 py-4 text-left shadow-[0_18px_60px_rgba(17,24,39,0.16)] backdrop-blur-2xl transition hover:-translate-x-1 hover:border-primary/30 xl:block"
              initial={{ x: 90, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 90, opacity: 0 }}
              transition={{ duration: 0.24, ease: easing }}
              aria-label="Open booking panel"
            >
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 rotate-180 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-ink">{currency(total)}</p>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Reserve</p>
                </div>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 shadow-lift backdrop-blur-2xl xl:hidden">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <button type="button" onClick={() => setMobileBookingOpen(true)} className="min-w-0 text-left">
              <p className="text-lg font-semibold tracking-[-0.04em] text-ink">{currency(total)}</p>
              <p className="truncate text-xs font-bold text-muted">{nights} nights · {guests} guests · protected payment</p>
            </button>
            <Button type="button" onClick={() => setMobileBookingOpen(true)} className="min-h-12 shrink-0 px-6">Reserve</Button>
          </div>
        </div>

        <AnimatePresence>
          {mobileBookingOpen ? (
            <motion.div className="fixed inset-0 z-50 bg-ink/45 backdrop-blur-sm xl:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div
                className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[2rem] bg-surface p-5 shadow-lift"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.3, ease: easing }}
              >
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="caption-type">Booking details</p>
                    <p className="mt-1 text-3xl font-semibold tracking-[-0.06em] text-ink">{currency(total)}</p>
                    <p className="mt-1 text-sm font-bold text-ink-soft">${property.price} / night · {nights} nights</p>
                  </div>
                  <button type="button" onClick={() => setMobileBookingOpen(false)} className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface-2" aria-label="Close booking details">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge tone="success">Protected payment</Badge>
                  <Badge tone="primary">Review before paying</Badge>
                </div>
                <div className="mt-5 grid gap-3">
                  <label><span className="caption-type">Check-in</span><input className="input-control mt-2" type="date" min={today} value={checkIn} onChange={(event) => { setCheckIn(event.target.value); setCalendarMonth(monthStartIso(event.target.value)); setReservationError(""); }} /></label>
                  <label><span className="caption-type">Check-out</span><input className="input-control mt-2" type="date" min={addDaysIso(checkIn, 1)} value={checkOut} onChange={(event) => { setCheckOut(event.target.value); setReservationError(""); }} /></label>
                  <label><span className="caption-type">Guests</span><select className="input-control mt-2" value={guests} onChange={(event) => { setGuests(event.target.value); setReservationError(""); }}><option value="1">1 guest</option><option value="2">2 guests</option><option value="4">4 guests</option><option value="6">6 guests</option></select></label>
                </div>
                <div className="mt-5 grid gap-3 rounded-[1.5rem] bg-surface-2 p-4 text-sm font-semibold text-ink-soft">
                  <LineItem label={`${nights} nights`} value={currency(Math.round(pricingQuery.data?.subtotal ?? property.price * nights))} />
                  <LineItem label="Fees and taxes" value={currency(fees)} />
                  <LineItem label="Total" value={currency(total)} strong />
                </div>
                {(reservationError || validationMessage) ? <div className="mt-4 rounded-2xl bg-warning/15 p-3 text-sm font-semibold text-warning">{reservationError || validationMessage}</div> : null}
                <Button type="button" onClick={reserve} className="mt-5 w-full min-h-12">Reserve</Button>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <PublicFooter />
      </div>
    </MotionPage>
  );
}

export function HostProfilePage() {
  const { id } = useParams();
  const hostId = Number(id);
  const profileQuery = useQuery({ queryKey: ["public-host-profile", hostId], queryFn: () => getPublicHostProfile(hostId), enabled: Number.isFinite(hostId) });
  const profile = profileQuery.data as PublicHostProfile | undefined;
  const hostName = profile?.host.name || "Host";
  const hostAvatar = profile?.host.avatarUrl || imageManifest.avatars.maya;
  const listings = (profile?.properties || []).map(toExperienceProperty);
  const hostReviews = profile?.hostReviews || [];
  const propertyReviews = profile?.propertyReviews || [];
  const allReviews = (profile?.allReviews || [
    ...hostReviews.map((review) => ({ ...review, propertyTitle: "Host review" })),
    ...propertyReviews
  ]).sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));

  if (profileQuery.isLoading) {
    return (
      <MotionPage>
        <div className="min-h-screen bg-canvas">
          <PublicNav />
          <main className="page-shell py-8"><LoadingBlock label="Loading host profile..." /></main>
        </div>
      </MotionPage>
    );
  }

  if (!profile) {
    return (
      <MotionPage>
        <div className="min-h-screen bg-canvas">
          <PublicNav />
          <main className="page-shell py-8">
            <EmptyState title="Host profile not found" text="This host profile is not available or has no public listings." action={<LinkButton to="/search">Browse stays</LinkButton>} />
          </main>
        </div>
      </MotionPage>
    );
  }

  return (
    <MotionPage>
      <div className="min-h-screen overflow-x-hidden bg-canvas">
        <PublicNav />
        <main className="page-shell py-8">
          <section className="premium-panel overflow-hidden">
            <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-end">
              <div>
                <Badge tone={profile.profile.verifiedBadge ? "success" : "primary"}>{profile.profile.verifiedBadge ? "Verified host" : "UBOOK host"}</Badge>
                <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
                  <img src={hostAvatar} alt={hostName} className="h-24 w-24 rounded-[1.5rem] object-cover shadow-soft" />
                  <div>
                    <h1 className="h1-type">{hostName}</h1>
                    <p className="mt-2 text-sm font-bold text-ink-soft">
                      Host since {profile.host.createdAt ? formatFriendlyDate(profile.host.createdAt.slice(0, 10)) : "recently"} / {profile.stats.listingCount} apartments
                    </p>
                  </div>
                </div>
                {profile.profile.bio ? <p className="body-type mt-6 max-w-3xl">{profile.profile.bio}</p> : <p className="body-type mt-6 max-w-3xl">This host manages verified UBOOK stays with reservation visibility, messaging, and calendar-backed availability.</p>}
              </div>
              <div className="grid gap-3 rounded-[1.5rem] bg-surface-2 p-4">
                <LineItem label="Host rating" value={`${profile.profile.averageRating || 0} / 5`} />
                <LineItem label="Host reviews" value={`${profile.stats.hostReviewCount}`} />
                <LineItem label="Apartment reviews" value={`${profile.stats.propertyReviewCount}`} />
                <LineItem label="Response rate" value={`${Math.round(profile.profile.responseRate || 0)}%`} strong />
              </div>
            </div>
          </section>

          <section className="mt-10">
            <SectionHeader kicker="Apartments" title={`${hostName}'s apartments.`} text="Every active listing owned by this host, with live pricing and review signals." />
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {listings.length ? listings.map((property) => <PropertyCard key={property.id} property={property} />) : <EmptyState title="No public apartments" text="This host does not have active public listings right now." />}
            </div>
          </section>

          <section className="mt-10">
            <div className="premium-card p-5">
              <SectionHeader kicker="All reviews" title="Host and apartment feedback in one place." text="Each completed stay can create one combined review covering both the apartment and the host." />
              <ReviewList reviews={allReviews} showProperty emptyTitle="No reviews yet" emptyText="Verified host and apartment reviews appear here after completed stays." />
            </div>
          </section>
        </main>
        <PublicFooter />
      </div>
    </MotionPage>
  );
}

function ReviewList({ reviews, showProperty = false, emptyTitle, emptyText }: { reviews: Array<{ id: number; author?: string; avatar?: string; rating: number; comment: string; createdAt?: string; propertyTitle?: string }>; showProperty?: boolean; emptyTitle: string; emptyText: string }) {
  if (!reviews.length) {
    return <div className="mt-5"><EmptyState title={emptyTitle} text={emptyText} /></div>;
  }
  return (
    <div className="mt-5 grid gap-3">
      {reviews.map((review) => (
        <article key={review.id} className="rounded-[1.25rem] bg-surface-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img src={review.avatar || imageManifest.avatars.lina} alt={review.author || "Reviewer"} className="h-10 w-10 rounded-xl object-cover" />
              <div className="min-w-0">
                <p className="truncate font-bold text-ink">{review.author || "Verified guest"}</p>
                {showProperty && review.propertyTitle ? <p className="text-xs font-bold text-muted">{review.propertyTitle}</p> : null}
              </div>
            </div>
            <Badge tone="success">{review.rating} stars</Badge>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-ink-soft">"{review.comment}"</p>
          {review.createdAt ? <p className="mt-3 text-xs font-bold text-muted">{formatFriendlyDate(review.createdAt.slice(0, 10))}</p> : null}
        </article>
      ))}
    </div>
  );
}

function ReservationDateCalendar({
  rows,
  month,
  checkIn,
  checkOut,
  onMonthChange,
  onRangeChange,
  loading
}: {
  rows: globalThis.Map<string, ReservationCalendarDay>;
  month: string;
  checkIn: string;
  checkOut: string;
  onMonthChange: (month: string) => void;
  onRangeChange: (checkIn: string, checkOut: string) => void;
  loading?: boolean;
}) {
  const [selectingCheckout, setSelectingCheckout] = useState(false);
  const today = todayIso();
  const currentMonth = monthStartIso(today);
  const canGoPrevious = addMonthsIso(month, -1) >= currentMonth;
  const dates = calendarGrid(month, 42);
  const stayDates = new Set(selectedStayDates(checkIn, checkOut));

  const selectDate = (date: string, disabled: boolean) => {
    if (disabled) return;
    if (!selectingCheckout) {
      onRangeChange(date, addDaysIso(date, 1));
      setSelectingCheckout(true);
      return;
    }
    if (date <= checkIn) {
      onRangeChange(date, addDaysIso(date, 1));
      setSelectingCheckout(true);
      return;
    }
    onRangeChange(checkIn, date);
    setSelectingCheckout(false);
  };

  return (
    <div className="rounded-[1.5rem] border border-line bg-surface p-4 shadow-soft">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-black text-ink">Select dates</p>
          <p className="mt-1 text-xs font-semibold text-muted">{selectingCheckout ? "Choose a check-out date" : "Choose a check-in date"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canGoPrevious}
            onClick={() => onMonthChange(addMonthsIso(month, -1))}
            className={cn("grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 transition hover:bg-surface-3", !canGoPrevious && "cursor-not-allowed opacity-40")}
            aria-label="Previous month"
          >
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
          <div className="min-w-36 rounded-full bg-surface-2 px-4 py-2 text-center text-xs font-black text-ink">
            {calendarMonthLabel(month)}
          </div>
          <button
            type="button"
            onClick={() => onMonthChange(addMonthsIso(month, 1))}
            className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 transition hover:bg-surface-3"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {loading ? <Badge tone="neutral">Loading dates</Badge> : <Badge tone="success">Live availability</Badge>}
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase tracking-[0.12em] text-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {dates.map((date) => {
          const row = rows.get(date);
          const past = date < today;
          const disabled = past || row?.available === false;
          const selected = date === checkIn || date === checkOut;
          const inRange = stayDates.has(date);
          const outsideMonth = monthStartIso(date) !== month;
          const statusLabel = past ? "Past" : row?.status === "reserved" ? "Reserved" : row?.status === "blocked" ? "Blocked" : row?.status === "limited" ? "Limited" : "Open";
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => selectDate(date, disabled)}
              className={cn(
                "min-h-16 rounded-2xl border border-line p-2 text-left text-xs font-bold transition",
                outsideMonth && "opacity-45",
                disabled && "cursor-not-allowed bg-surface-2 text-muted opacity-60",
                !disabled && !selected && !inRange && "bg-surface text-ink-soft hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
                inRange && !selected && "border-primary/20 bg-primary/10 text-primary",
                selected && "border-primary bg-primary text-primary-ink shadow-soft"
              )}
            >
              <span className="block text-sm">{new Date(`${date}T00:00:00`).getDate()}</span>
              <span className="mt-2 block truncate text-[10px] opacity-80">{statusLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function displayLineValue(value: unknown, fallback = "Not set"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const items = value.map((item) => displayLineValue(item, "")).filter(Boolean);
    return items.length ? items.join(", ") : fallback;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return fallback;
    const summary = entries
      .map(([key, item]) => {
        const rendered = displayLineValue(item, "");
        return rendered ? `${key}: ${rendered}` : "";
      })
      .filter(Boolean)
      .join(" / ");
    return summary || fallback;
  }
  return fallback;
}

function LineItem({ label, value, strong }: { label: string; value: unknown; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-line pt-3 text-lg text-ink")}>
      <span>{label}</span>
      <span className="font-bold text-ink">{displayLineValue(value)}</span>
    </div>
  );
}

export function UserDashboard() {
  const dashboardQuery = useQuery({ queryKey: ["traveler-dashboard"], queryFn: getTravelerDashboard });
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const savedSearchesQuery = useQuery({ queryKey: ["saved-searches"], queryFn: getSavedSearches });
  const favoritesQuery = useQuery({ queryKey: ["favorites"], queryFn: getFavorites });
  const dashboard = dashboardQuery.data as ApiTravelerDashboard | undefined;
  const metrics = (dashboard?.metrics || []).map(toMetric);
  const recommendations = (dashboard?.recommendedProperties || []).map(toExperienceProperty);
  const heroTrip = dashboard?.upcomingTrips?.[0];
  const heroProperty = recommendations.find((property) => property.id === heroTrip?.propertyId) || recommendations[0];
  const spendingData = toChartData((dashboard?.bookingHistory || []).map((booking) => ({ date: String(booking.payload?.checkIn || new Date().toISOString()), revenue: booking.total })));
  const quickLinks = [
    { title: "Reservations", text: `${dashboard?.upcomingTrips?.length || 0} upcoming trips`, href: "/reservations", icon: CalendarDays },
    { title: "Wishlist", text: `${favoritesQuery.data?.length || 0} saved apartments`, href: "/dashboard/wishlist", icon: Heart },
    { title: "Payments", text: `${currency((dashboard?.bookingHistory || []).reduce((sum, booking) => sum + booking.total, 0))} lifetime spend`, href: "/dashboard/payments", icon: CreditCard },
    { title: "Profile", text: userQuery.data?.otpEnabled ? "2FA enabled" : "Security setup available", href: "/dashboard/profile", icon: UserRound }
  ];
  return (
    <WorkspaceShell role="traveler" title="Your trips" subtitle="Everything for your next stay: trips, saved places, messages, payments, and helpful reminders." action={<LinkButton to="/search">Explore stays</LinkButton>}>
      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="premium-panel overflow-hidden">
          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_280px]">
            <div>
              <Badge tone="primary">Good afternoon, {userQuery.data?.name || userQuery.data?.fullName || "Traveler"}</Badge>
              <h2 className="h2-type mt-4">{heroTrip ? `Your ${heroTrip.city} trip is in your timeline.` : "Your next verified stay will appear here."}</h2>
              <p className="body-type mt-4">Booking, host messages, arrival notes, and payment receipts stay attached to the trip timeline.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton to={heroTrip ? `/booking/${heroTrip.propertyId}` : "/search"}>Review booking</LinkButton>
                <LinkButton to="/messages" variant="secondary">Message host</LinkButton>
              </div>
            </div>
            {heroProperty ? <img src={heroProperty.image} alt={heroProperty.title} className="h-full min-h-64 rounded-[1.5rem] object-cover" /> : null}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
        </div>
      </section>
      <HumanNote>Little travel details stay easier to manage when they live next to the booking: host messages, arrival notes, receipts, and saved places are all connected here.</HumanNote>
      <section id="trips" className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="premium-card p-5">
          <SectionHeader kicker="Upcoming trips" title="Beautiful trip cards with next actions." action={<LinkButton to="/reservations" variant="secondary">Open reservations</LinkButton>} />
          <div className="mt-5 grid gap-4">
            {(dashboard?.upcomingTrips || []).slice(0, 2).map((booking, index) => <TripCard key={booking.id} booking={booking} index={index} />)}
            {!(dashboard?.upcomingTrips || []).length ? <EmptyState title="No upcoming trips" text="Your accepted and pending reservations will appear in the Reservations page." action={<LinkButton to="/search">Find an apartment</LinkButton>} /> : null}
          </div>
        </div>
        <div className="premium-card p-5">
          <SectionHeader kicker="AI-style recommendations" title="Stays matched to your intent." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recommendations.slice(0, 2).map((property) => <PropertyCard key={property.id} property={property} />)}
          </div>
        </div>
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.title} to={item.href} className="group rounded-[1.5rem] border border-line bg-surface p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lift">
              <div className="flex items-center justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
                <ChevronRight className="h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-[-0.04em] text-ink">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-ink-soft">{item.text}</p>
            </Link>
          );
        })}
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <ChartPanel title="Travel spending preview"><RevenueChart data={spendingData} /></ChartPanel>
        <div className="premium-card p-5">
          <SectionHeader kicker="Recent searches" title="Return to what you were planning." action={<LinkButton to="/dashboard/wishlist" variant="secondary">Open wishlist</LinkButton>} />
          <div className="mt-5 grid gap-3">
            {(savedSearchesQuery.data || []).slice(0, 4).map((item: { name: string }) => <StatusRow key={item.name} label={item.name} tone="neutral" />)}
            {!(savedSearchesQuery.data || []).length ? <EmptyState title="No saved searches" text="Saved searches and wishlists now live in their own workspace page." /> : null}
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}

export function TravelerWishlistPage() {
  const favoritesQuery = useQuery({ queryKey: ["favorites"], queryFn: getFavorites });
  const savedSearchesQuery = useQuery({ queryKey: ["saved-searches"], queryFn: getSavedSearches });
  const favorites = (favoritesQuery.data || []).map(toExperienceProperty);
  const savedSearches = savedSearchesQuery.data || [];

  return (
    <WorkspaceShell role="traveler" title="Wishlist" subtitle="Saved apartments and searches stay together so you can return to the exact trip you were planning." action={<LinkButton to="/search"><Search className="h-4 w-4" /> Search stays</LinkButton>}>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <SectionHeader kicker="Saved apartments" title="Places you want to compare." />
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {favorites.length ? favorites.map((property) => <PropertyCard key={property.id} property={property} />) : (
              <div className="md:col-span-2 xl:col-span-3">
                <EmptyState icon={<Heart className="h-5 w-5" />} title="No saved apartments yet" text="Browse listings and save the apartments you want to compare before booking." action={<LinkButton to="/search">Browse apartments</LinkButton>} />
              </div>
            )}
          </div>
        </div>
        <aside className="premium-card h-fit p-5 xl:sticky xl:top-24">
          <SectionHeader kicker="Saved searches" title="Reusable trip filters." />
          <div className="mt-5 grid gap-3">
            {savedSearches.length ? savedSearches.map((item: { id?: number; name?: string; query?: Record<string, unknown> }) => (
              <div key={item.id || item.name} className="rounded-2xl bg-surface-2 p-4">
                <p className="font-bold text-ink">{item.name || "Saved search"}</p>
                <p className="mt-2 text-xs font-bold text-muted">{Object.entries(item.query || {}).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(" / ") || "Search filters saved"}</p>
              </div>
            )) : <EmptyState title="No saved searches" text="Save a search to quickly return to destination, date, and guest filters." />}
          </div>
        </aside>
      </section>
    </WorkspaceShell>
  );
}

export function TravelerPaymentsPage() {
  const paymentsQuery = useQuery({ queryKey: ["payments"], queryFn: getPayments });
  const overviewQuery = useQuery({ queryKey: ["payment-overview"], queryFn: getPaymentOverview });
  const walletQuery = useQuery({ queryKey: ["wallet"], queryFn: getWallet });
  const methodsQuery = useQuery({ queryKey: ["payment-methods"], queryFn: getPaymentMethods });
  const payments = paymentsQuery.data || [];
  const overview = overviewQuery.data;
  const methods = methodsQuery.data || [];
  const chartData = toChartData(payments.map((payment, index) => ({ date: new Date(Date.now() - index * 86400000).toISOString(), revenue: payment.amount })));

  return (
    <WorkspaceShell role="traveler" title="Payments" subtitle="Receipts, wallet balance, saved methods, refunds, and payment status for your trips." action={<LinkButton to="/reservations" variant="secondary">Open reservations</LinkButton>}>
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard metric={{ label: "Paid", value: currency(overview?.totalPaid || 0), delta: "Completed trip payments", tone: "success" }} />
        <MetricCard metric={{ label: "Pending", value: currency(overview?.totalPending || 0), delta: "Awaiting payment or host action", tone: "warning" }} />
        <MetricCard metric={{ label: "Wallet", value: currency(walletQuery.data?.balance || 0), delta: walletQuery.data?.status || "Wallet status", tone: "primary" }} />
      </section>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <ChartPanel title="Payment history"><RevenueChart data={chartData} /></ChartPanel>
        <div className="premium-card p-5">
          <SectionHeader kicker="Payment methods" title="Cards and wallet." />
          <div className="mt-5 grid gap-3">
            {methods.length ? methods.map((method) => (
              <div key={method.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-4">
                <div>
                  <p className="font-bold text-ink">{method.brand || method.type || "Payment method"}</p>
                  <p className="mt-1 text-xs font-bold text-muted">{method.last4 ? `Ending in ${method.last4}` : "Tokenized payment method"}</p>
                </div>
                {method.isDefault ? <Badge tone="success">Default</Badge> : <Badge tone="neutral">Saved</Badge>}
              </div>
            )) : <EmptyState title="No payment methods" text="Add payment methods from checkout when you reserve your next stay." />}
          </div>
        </div>
      </section>
      <section className="premium-card p-5">
        <SectionHeader kicker="Transactions" title="Reservation payment records." />
        <div className="mt-5 grid gap-3">
          {payments.length ? payments.map((payment) => (
            <div key={payment.id} className="grid gap-3 rounded-2xl bg-surface-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="font-bold text-ink">Booking #{payment.bookingId}</p>
                <p className="mt-1 text-sm font-semibold text-ink-soft">{payment.provider} / {payment.refundStatus || "no refund"}</p>
              </div>
              <div className="flex items-center gap-3 sm:justify-end">
                <Badge tone={payment.status === "paid" || payment.status === "succeeded" ? "success" : "warning"}>{payment.status}</Badge>
                <p className="text-lg font-semibold text-ink">{currency(payment.amount)}</p>
              </div>
            </div>
          )) : <EmptyState icon={<Receipt className="h-5 w-5" />} title="No transactions yet" text="Payments will appear here after you book an apartment." />}
        </div>
      </section>
    </WorkspaceShell>
  );
}

export function TravelerReviewsPage() {
  const reviewsQuery = useQuery({ queryKey: ["my-reviews"], queryFn: getMyReviews });
  const center = reviewsQuery.data as { reviews?: any[]; hostReviews?: any[]; travelerReviews?: any[]; averageRating?: number; totalReviews?: number } | undefined;
  const apartmentReviews = (center?.reviews || []).map((review) => ({ ...review, author: review.author || "You" }));
  const hostReviews = (center?.hostReviews || []).map((review) => ({ ...review, author: review.author || "You", propertyTitle: "Host review" }));
  const travelerReviews = (center?.travelerReviews || []).map((review) => ({ ...review, author: review.author || "Host feedback", propertyTitle: "Traveler review" }));

  return (
    <WorkspaceShell role="traveler" title="Reviews" subtitle="Your apartment reviews, host feedback, and traveler reputation stay in one review center." action={<LinkButton to="/reservations" variant="secondary">Review completed stays</LinkButton>}>
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard metric={{ label: "Average rating", value: String(center?.averageRating || 0), delta: "Across your review center", tone: "success" }} />
        <MetricCard metric={{ label: "Total reviews", value: String(center?.totalReviews || 0), delta: "Apartment, host, and traveler reviews", tone: "primary" }} />
        <MetricCard metric={{ label: "Review rule", value: "1 per stay", delta: "Apartment and host reviewed together", tone: "accent" }} />
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="premium-card p-5">
          <SectionHeader kicker="Apartment reviews" title="What you wrote about stays." />
          <ReviewList reviews={apartmentReviews} showProperty emptyTitle="No apartment reviews yet" emptyText="Completed stays can be reviewed from My Reservations." />
        </div>
        <div className="premium-card p-5">
          <SectionHeader kicker="Host reviews" title="What you wrote about hosts." />
          <ReviewList reviews={hostReviews} showProperty emptyTitle="No host reviews yet" emptyText="A stay review covers both the apartment and the host." />
        </div>
      </section>
      <section className="premium-card p-5">
        <SectionHeader kicker="Traveler feedback" title="Reviews hosts left for you." />
        <ReviewList reviews={travelerReviews} showProperty emptyTitle="No traveler feedback yet" emptyText="Host feedback appears here after completed stays." />
      </section>
    </WorkspaceShell>
  );
}

export function TravelerProfilePage() {
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const profileQuery = useQuery({ queryKey: ["profile-center"], queryFn: getProfileCenter });
  const user = userQuery.data as any;
  const profile = profileQuery.data as any;
  const profileData = profile?.profile || profile || {};
  const displayName = user?.fullName || user?.name || profile?.name || "Traveler";
  const checks = [
    ["Email verified", Boolean(user?.emailVerified)],
    ["Phone verified", Boolean(user?.phoneVerified || profileData.phone)],
    ["Government ID ready", Boolean(user?.identityVerified)],
    ["Two-factor enabled", Boolean(user?.otpEnabled)]
  ] as const;

  return (
    <WorkspaceShell role="traveler" title="Profile" subtitle="Identity, trust signals, security setup, and public traveler information." action={<LinkButton to="/dashboard/settings" variant="secondary">Account settings</LinkButton>}>
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="premium-panel p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <img src={user?.avatarUrl || imageManifest.avatars.lina} alt={displayName} className="h-24 w-24 rounded-[1.5rem] object-cover shadow-soft" />
            <div>
              <Badge tone="primary">Traveler profile</Badge>
              <h2 className="h2-type mt-3">{displayName}</h2>
              <p className="mt-2 text-sm font-bold text-ink-soft">{user?.email || profile?.email || "Email unavailable"}</p>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <LineItem label="Phone" value={profileData.phone || user?.phone || "Not added"} />
            <LineItem label="Rating" value={`${profileData.averageRating || 0} / 5`} />
            <LineItem label="Reviews" value={`${profileData.reviewCount || 0}`} />
            <LineItem label="Member since" value={user?.createdAt ? formatFriendlyDate(String(user.createdAt).slice(0, 10)) : "Recently"} />
          </div>
        </div>
        <div className="grid gap-5">
          <div className="premium-card p-5">
            <SectionHeader kicker="Profile readiness" title="Trust setup for smoother booking." />
            <div className="mt-5 grid gap-3">
              {checks.map(([item, complete]) => <StatusRow key={item} label={item} tone={complete ? "success" : "warning"} />)}
            </div>
          </div>
          <TwoFactorSecurityPanel />
        </div>
      </section>
    </WorkspaceShell>
  );
}

function EditableSettingsPanels({ role }: { role: "traveler" | "host" }) {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["profile-center"], queryFn: getProfileCenter });
  const preferencesQuery = useQuery({ queryKey: ["profile-preferences"], queryFn: getProfilePreferences });
  const profileCenter = profileQuery.data as any;
  const preferences = preferencesQuery.data as any;
  const user = profileCenter?.user || {};
  const profile = profileCenter?.profile || {};
  const account = preferences?.account || {};
  const notifications = preferences?.notifications || {};
  const [profileForm, setProfileForm] = useState({ fullName: "", phone: "", avatarUrl: "", bio: "" });
  const [notificationForm, setNotificationForm] = useState({
    bookingUpdates: true,
    messages: true,
    reviews: true,
    securityAlerts: true,
    marketing: false,
    inApp: true,
    email: true
  });
  const [accountForm, setAccountForm] = useState({
    locale: "en-US",
    currency: "USD",
    timezone: "UTC",
    profileVisibility: "public",
    searchPersonalization: true
  });
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    setProfileForm({
      fullName: user.fullName || user.name || "",
      phone: profile.phone || user.phone || "",
      avatarUrl: user.avatarUrl || "",
      bio: profile.bio || ""
    });
  }, [profile.phone, profile.bio, user.avatarUrl, user.fullName, user.name, user.phone]);

  useEffect(() => {
    setNotificationForm({
      bookingUpdates: notifications.bookingUpdates !== false,
      messages: notifications.messages !== false,
      reviews: notifications.reviews !== false,
      securityAlerts: notifications.securityAlerts !== false,
      marketing: Boolean(notifications.marketing),
      inApp: notifications.channels?.inApp !== false,
      email: notifications.channels?.email !== false
    });
  }, [notifications.bookingUpdates, notifications.channels?.email, notifications.channels?.inApp, notifications.marketing, notifications.messages, notifications.reviews, notifications.securityAlerts]);

  useEffect(() => {
    setAccountForm({
      locale: account.locale || "en-US",
      currency: account.currency || "USD",
      timezone: account.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      profileVisibility: account.privacy?.profileVisibility || "public",
      searchPersonalization: account.settings?.searchPersonalization !== false
    });
  }, [account.currency, account.locale, account.privacy?.profileVisibility, account.settings?.searchPersonalization, account.timezone]);

  const afterSave = async (message: string) => {
    setSaveError("");
    setSaveMessage(message);
    await queryClient.invalidateQueries({ queryKey: ["profile-center"] });
    await queryClient.invalidateQueries({ queryKey: ["profile-preferences"] });
    await queryClient.invalidateQueries({ queryKey: ["current-user"] });
  };

  const profileMutation = useMutation({
    mutationFn: () => updateProfile({
      fullName: profileForm.fullName.trim(),
      phone: profileForm.phone.trim(),
      avatarUrl: profileForm.avatarUrl.trim(),
      bio: profileForm.bio.trim()
    }),
    onSuccess: () => afterSave("Profile information saved."),
    onError: (error) => {
      setSaveMessage("");
      setSaveError(getApiErrorMessage(error, "Could not save profile information"));
    }
  });
  const notificationMutation = useMutation({
    mutationFn: () => updateNotificationPreferences({
      bookingUpdates: notificationForm.bookingUpdates,
      messages: notificationForm.messages,
      reviews: notificationForm.reviews,
      securityAlerts: notificationForm.securityAlerts,
      marketing: notificationForm.marketing,
      channels: { inApp: notificationForm.inApp, email: notificationForm.email }
    }),
    onSuccess: () => afterSave("Notification settings saved."),
    onError: (error) => {
      setSaveMessage("");
      setSaveError(getApiErrorMessage(error, "Could not save notification settings"));
    }
  });
  const accountMutation = useMutation({
    mutationFn: () => updateAccountPreferences({
      locale: accountForm.locale.trim() || "en-US",
      currency: (accountForm.currency.trim() || "USD").toUpperCase(),
      timezone: accountForm.timezone.trim() || "UTC",
      privacy: { ...(account.privacy || {}), profileVisibility: accountForm.profileVisibility },
      settings: { ...(account.settings || {}), searchPersonalization: accountForm.searchPersonalization }
    }),
    onSuccess: () => afterSave("Account settings saved."),
    onError: (error) => {
      setSaveMessage("");
      setSaveError(getApiErrorMessage(error, "Could not save account settings"));
    }
  });

  const updateProfileField = (key: keyof typeof profileForm, value: string) => setProfileForm((current) => ({ ...current, [key]: value }));
  const updateNotificationField = (key: keyof typeof notificationForm, value: boolean) => setNotificationForm((current) => ({ ...current, [key]: value }));
  const updateAccountField = (key: keyof typeof accountForm, value: string | boolean) => setAccountForm((current) => ({ ...current, [key]: value }));
  const loading = profileQuery.isLoading || preferencesQuery.isLoading;

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="grid gap-6">
        {loading ? <LoadingBlock label="Loading settings..." /> : null}
        {saveMessage ? <div className="rounded-2xl bg-success/10 p-4 text-sm font-semibold text-success">{saveMessage}</div> : null}
        {saveError ? <div className="rounded-2xl bg-error/10 p-4 text-sm font-semibold text-error">{saveError}</div> : null}
        <form className="premium-card p-5" onSubmit={(event) => { event.preventDefault(); profileMutation.mutate(); }}>
          <SectionHeader kicker={`${role === "host" ? "Host" : "Traveler"} profile`} title="Edit public and account information." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label><span className="caption-type">Full name</span><input className="input-control mt-2" value={profileForm.fullName} onChange={(event) => updateProfileField("fullName", event.target.value)} /></label>
            <label><span className="caption-type">Phone</span><input className="input-control mt-2" value={profileForm.phone} onChange={(event) => updateProfileField("phone", event.target.value)} /></label>
            <label className="md:col-span-2"><span className="caption-type">Avatar URL</span><input className="input-control mt-2" value={profileForm.avatarUrl} onChange={(event) => updateProfileField("avatarUrl", event.target.value)} placeholder="https://..." /></label>
            <label className="md:col-span-2"><span className="caption-type">Bio</span><textarea className="input-control mt-2 min-h-32 py-4" value={profileForm.bio} onChange={(event) => updateProfileField("bio", event.target.value)} /></label>
          </div>
          <Button type="submit" className="mt-5" disabled={profileMutation.isPending}>{profileMutation.isPending ? "Saving..." : "Save profile"}</Button>
        </form>
        <form className="premium-card p-5" onSubmit={(event) => { event.preventDefault(); accountMutation.mutate(); }}>
          <SectionHeader kicker="Account preferences" title="Edit locale, currency, timezone, and privacy." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label><span className="caption-type">Locale</span><input className="input-control mt-2" value={accountForm.locale} onChange={(event) => updateAccountField("locale", event.target.value)} /></label>
            <label><span className="caption-type">Currency</span><input className="input-control mt-2 uppercase" maxLength={3} value={accountForm.currency} onChange={(event) => updateAccountField("currency", event.target.value.toUpperCase())} /></label>
            <label><span className="caption-type">Timezone</span><input className="input-control mt-2" value={accountForm.timezone} onChange={(event) => updateAccountField("timezone", event.target.value)} /></label>
            <label><span className="caption-type">Profile visibility</span><select className="input-control mt-2" value={accountForm.profileVisibility} onChange={(event) => updateAccountField("profileVisibility", event.target.value)}><option value="public">Public</option><option value="guests-only">Guests and hosts only</option><option value="private">Private</option></select></label>
            <label className="flex items-center gap-3 rounded-2xl bg-surface-2 p-4 text-sm font-bold text-ink-soft md:col-span-2"><input type="checkbox" checked={accountForm.searchPersonalization} onChange={(event) => updateAccountField("searchPersonalization", event.target.checked)} /> Personalized recommendations and saved-search suggestions</label>
          </div>
          <Button type="submit" className="mt-5" disabled={accountMutation.isPending}>{accountMutation.isPending ? "Saving..." : "Save account settings"}</Button>
        </form>
      </div>
      <aside className="grid h-fit gap-6 xl:sticky xl:top-24">
        <form className="premium-card p-5" onSubmit={(event) => { event.preventDefault(); notificationMutation.mutate(); }}>
          <SectionHeader kicker="Notifications" title="Edit every alert channel." />
          <div className="mt-5 grid gap-3">
            {[
              ["bookingUpdates", "Booking updates"],
              ["messages", "Messages"],
              ["reviews", "Reviews"],
              ["securityAlerts", "Security alerts"],
              ["marketing", "Product and travel tips"],
              ["inApp", "In-app channel"],
              ["email", "Email channel"]
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 p-4 text-sm font-bold text-ink-soft">
                <span>{label}</span>
                <input type="checkbox" checked={Boolean(notificationForm[key as keyof typeof notificationForm])} onChange={(event) => updateNotificationField(key as keyof typeof notificationForm, event.target.checked)} />
              </label>
            ))}
          </div>
          <Button type="submit" className="mt-5 w-full" disabled={notificationMutation.isPending}>{notificationMutation.isPending ? "Saving..." : "Save notifications"}</Button>
        </form>
      </aside>
    </section>
  );
}

export function TravelerSettingsPage() {
  return (
    <WorkspaceShell role="traveler" title="Settings" subtitle="Account, notifications, language, privacy, and security controls for your traveler workspace.">
      <EditableSettingsPanels role="traveler" />
      <TwoFactorSecurityPanel />
    </WorkspaceShell>
  );
}

export function MyReservationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const reservationsQuery = useQuery({ queryKey: ["my-reservations"], queryFn: getMyReservations });
  const cancelMutation = useMutation({
    mutationFn: (bookingId: number) => cancelReservation(bookingId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["traveler-dashboard"] });
    }
  });
  const openConversation = useMutation({
    mutationFn: (booking: UserBooking) => {
      if (!booking.hostId) throw new Error("Host is not available for this reservation.");
      return createConversation(booking.hostId, booking.propertyId, booking.id);
    },
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/messages?conversation=${conversation.id}`);
    }
  });
  const reservations = reservationsQuery.data || [];

  return (
    <WorkspaceShell role="traveler" title="My Reservations" subtitle="Every booking, status update, receipt, and cancellation action in one clean trip workspace." action={<LinkButton to="/search">Browse stays</LinkButton>}>
      {reservationsQuery.isLoading ? (
        <LoadingBlock label="Loading your reservations..." />
      ) : reservations.length ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {reservations.map((booking) => (
            <ReservationCard
              key={booking.id}
              booking={booking}
              cancelling={cancelMutation.isPending}
              onCancel={() => cancelMutation.mutate(booking.id)}
              openingConversation={openConversation.isPending && openConversation.variables?.id === booking.id}
              onOpenConversation={() => openConversation.mutate(booking)}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="No reservations yet"
          text="When you reserve a stay, it appears here with dates, price, status, and host details."
          action={<LinkButton to="/search">Find a stay</LinkButton>}
        />
      )}
    </WorkspaceShell>
  );
}

function ReservationCard({
  booking,
  onCancel,
  cancelling,
  onOpenConversation,
  openingConversation
}: {
  booking: UserBooking;
  onCancel: () => void;
  cancelling: boolean;
  onOpenConversation: () => void;
  openingConversation: boolean;
}) {
  const queryClient = useQueryClient();
  const status = booking.statusRaw || booking.status;
  const cancellable = ["pending", "confirmed"].includes(String(status).toLowerCase());
  const reviewable = ["completed", "checked_out", "checked-out"].includes(String(status).toLowerCase());
  const [propertyRating, setPropertyRating] = useState(5);
  const [propertyComment, setPropertyComment] = useState("");
  const [hostRating, setHostRating] = useState(5);
  const [hostComment, setHostComment] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const stayReview = useMutation({
    mutationFn: () => {
      if (!booking.hostId) throw new Error("Host is not available for this reservation.");
      return createStayReview({
        propertyId: booking.propertyId,
        bookingId: booking.id,
        hostId: booking.hostId,
        apartmentRating: propertyRating,
        apartmentComment: propertyComment.trim(),
        hostRating,
        hostComment: hostComment.trim()
      });
    },
    onSuccess: async () => {
      setPropertyComment("");
      setHostComment("");
      setReviewMessage("Apartment and host review submitted.");
      setReviewError("");
      await queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["traveler-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["property", booking.propertyId] });
      if (booking.hostId) await queryClient.invalidateQueries({ queryKey: ["public-host-profile", booking.hostId] });
    },
    onError: (error) => {
      setReviewMessage("");
      setReviewError(getApiErrorMessage(error, "Could not submit the stay review."));
    }
  });

  const submitStayReview = (event: FormEvent) => {
    event.preventDefault();
    if (propertyComment.trim().length < 3) {
      setReviewError("Write at least 3 characters for the apartment review.");
      return;
    }
    if (hostComment.trim().length < 3) {
      setReviewError("Write at least 3 characters for the host review.");
      return;
    }
    stayReview.mutate();
  };

  return (
    <article className="premium-card overflow-hidden p-4">
      <div className="sm:flex sm:gap-4">
        <img src={booking.propertyImage || imageManifest.properties.hotel} alt={booking.propertyTitle || booking.propertyName} className="h-48 w-full rounded-[1.25rem] object-cover sm:h-auto sm:w-56" />
        <div className="mt-4 min-w-0 flex-1 sm:mt-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge tone={reservationStatusTone(status)}>{booking.status}</Badge>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.05em] text-ink">{booking.propertyTitle || booking.propertyName}</h2>
              <p className="mt-1 text-sm font-semibold text-ink-soft">{booking.city}</p>
            </div>
            <p className="text-2xl font-semibold tracking-[-0.05em] text-ink">{currency(booking.total)}</p>
          </div>
          <div className="mt-5 grid gap-3 rounded-[1.25rem] bg-surface-2 p-4 text-sm font-semibold text-ink-soft sm:grid-cols-2">
            <LineItem label="Check-in" value={formatFriendlyDate(booking.checkIn || String(booking.payload?.checkIn || ""))} />
            <LineItem label="Check-out" value={formatFriendlyDate(booking.checkOut || String(booking.payload?.checkOut || ""))} />
            <LineItem label="Nights" value={`${booking.nights}`} />
            <LineItem label="Created" value={booking.createdAt ? formatFriendlyDate(booking.createdAt.slice(0, 10)) : "Not available"} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={onOpenConversation} disabled={openingConversation || !booking.hostId}>
              <MessageCircle className="h-4 w-4" /> {openingConversation ? "Opening..." : "Open conversation"}
            </Button>
            <LinkButton to={`/property/${booking.propertyId}`} variant="secondary">View listing</LinkButton>
            {booking.hostId ? <LinkButton to={`/hosts/${booking.hostId}`} variant="secondary">View host</LinkButton> : null}
            {cancellable ? (
              <Button type="button" variant="secondary" onClick={onCancel} disabled={cancelling}>
                {cancelling ? "Cancelling..." : "Cancel reservation"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {reviewable ? (
        <form className="mt-5 grid gap-4 border-t border-line pt-5" onSubmit={submitStayReview}>
          <div className="grid gap-4 xl:grid-cols-2">
            <ReviewComposer
              title="Review the apartment"
              rating={propertyRating}
              comment={propertyComment}
              submitting={stayReview.isPending}
              onRatingChange={setPropertyRating}
              onCommentChange={setPropertyComment}
            />
            <ReviewComposer
              title="Review the host"
              rating={hostRating}
              comment={hostComment}
              submitting={stayReview.isPending}
              disabled={!booking.hostId}
              onRatingChange={setHostRating}
              onCommentChange={setHostComment}
            />
          </div>
          <Button type="submit" className="w-full" disabled={stayReview.isPending || !booking.hostId}>
            <Star className="h-4 w-4" /> {stayReview.isPending ? "Submitting..." : "Submit apartment and host review"}
          </Button>
          {(reviewMessage || reviewError) ? (
            <div className={cn("rounded-2xl p-3 text-sm font-semibold", reviewError ? "bg-error/10 text-error" : "bg-success/10 text-success")}>
              {reviewError || reviewMessage}
            </div>
          ) : null}
        </form>
      ) : null}
    </article>
  );
}

function ReviewComposer({
  title,
  rating,
  comment,
  submitting,
  disabled,
  onRatingChange,
  onCommentChange
}: {
  title: string;
  rating: number;
  comment: string;
  submitting: boolean;
  disabled?: boolean;
  onRatingChange: (value: number) => void;
  onCommentChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[1.25rem] bg-surface-2 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-black text-ink">{title}</p>
        <select className="input-control max-w-28 py-2" value={rating} disabled={disabled || submitting} onChange={(event) => onRatingChange(Number(event.target.value))}>
          {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} stars</option>)}
        </select>
      </div>
      <textarea
        className="input-control mt-3 min-h-24 py-3"
        value={comment}
        disabled={disabled || submitting}
        onChange={(event) => onCommentChange(event.target.value)}
        placeholder={disabled ? "Host is not available for this reservation." : "Share what future guests should know."}
      />
    </div>
  );
}

function TripCard({ booking, index }: { booking: UserBooking; index: number }) {
  return (
    <article className="rounded-[1.5rem] border border-line bg-surface-2 p-4 sm:flex sm:gap-4">
      <img src={booking.propertyImage || imageManifest.properties.hotel} alt={booking.propertyTitle || booking.propertyName} className="h-40 w-full rounded-[1.25rem] object-cover sm:h-auto sm:w-44" />
      <div className="mt-4 min-w-0 flex-1 sm:mt-0">
        <Badge tone={index === 0 ? "primary" : "neutral"}>{index === 0 ? "Next trip" : "Past stay"}</Badge>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-ink">{booking.propertyTitle || booking.propertyName}</h3>
        <p className="mt-1 text-sm font-semibold text-ink-soft">{booking.city} / {booking.dates}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone={booking.status === "Confirmed" ? "success" : "warning"}>{booking.status}</Badge>
          <Badge>{currency(booking.total)}</Badge>
          <Badge>{booking.nights} nights</Badge>
        </div>
      </div>
    </article>
  );
}

function InsightPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="premium-card p-5">
      <h3 className="h4-type">{title}</h3>
      <div className="mt-5 grid gap-3">
        {items.length ? items.map((item) => <div key={item} className="rounded-2xl bg-surface-2 p-4 text-sm font-semibold leading-6 text-ink-soft">{item}</div>) : <div className="rounded-2xl bg-surface-2 p-4 text-sm font-semibold leading-6 text-ink-soft">No records yet.</div>}
      </div>
    </div>
  );
}

function StatusRow({ label, tone = "neutral" }: { label: string; tone?: "success" | "warning" | "neutral" | "error" }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-surface-2 p-4">
      <span className="font-bold text-ink">{label}</span>
      <Badge tone={tone}>{tone === "success" ? "Complete" : tone === "error" ? "Blocked" : tone === "warning" ? "Review" : "Ready"}</Badge>
    </div>
  );
}

type TwoFactorSetupPayload = {
  secret?: string;
  otpauthUrl?: string;
  otpauth_url?: string;
  qrCode?: string;
  qr_code?: string;
};

type TwoFactorVerifyPayload = {
  recoveryCodes?: string[];
  recovery_codes?: string[];
};

function TwoFactorSecurityPanel() {
  const queryClient = useQueryClient();
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser, retry: false, staleTime: 30_000 });
  const user = userQuery.data as { email?: string; otpEnabled?: boolean; otp_enabled?: boolean; securitySetupRequired?: boolean; security_setup_required?: boolean } | undefined;
  const enabled = Boolean(user?.otpEnabled || user?.otp_enabled);
  const setupRequired = Boolean(user?.securitySetupRequired ?? user?.security_setup_required ?? !enabled);
  const [setup, setSetup] = useState<TwoFactorSetupPayload | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableRecoveryCode, setDisableRecoveryCode] = useState("");
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const qrCode = setup?.qrCode || setup?.qr_code;
  const secret = setup?.secret || "";
  const otpauthUrl = setup?.otpauthUrl || setup?.otpauth_url || "";

  const startSetup = useMutation({
    mutationFn: enableTwoFactor,
    onSuccess: (data: TwoFactorSetupPayload) => {
      setSetup(data);
      setSetupCode("");
      setRecoveryCodes([]);
      setMessage("");
      setError("");
    },
    onError: (error_) => setError(getApiErrorMessage(error_, "Could not start 2FA setup."))
  });

  const verifySetup = useMutation({
    mutationFn: () => {
      const code = setupCode.replace(/\s+/g, "");
      if (!code) {
        throw new Error("Enter the 6-digit authenticator code.");
      }
      return verifyTwoFactorSetup(code);
    },
    onSuccess: async (data: TwoFactorVerifyPayload) => {
      setRecoveryCodes(data.recoveryCodes || data.recovery_codes || []);
      setSetup(null);
      setSetupCode("");
      setMessage("Two-factor authentication is active on this account.");
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: (error_) => setError(getApiErrorMessage(error_, "Could not verify the authenticator code."))
  });

  const disableSetup = useMutation({
    mutationFn: () => {
      const code = useRecoveryCode ? undefined : disableCode.replace(/\s+/g, "");
      const recovery = useRecoveryCode ? disableRecoveryCode.trim() : undefined;
      if (!disablePassword) {
        throw new Error("Enter your password.");
      }
      if (!code && !recovery) {
        throw new Error(useRecoveryCode ? "Enter a recovery code." : "Enter the 6-digit authenticator code.");
      }
      return disableTwoFactor(disablePassword, code, recovery);
    },
    onSuccess: async () => {
      setSetup(null);
      setSetupCode("");
      setDisablePassword("");
      setDisableCode("");
      setDisableRecoveryCode("");
      setUseRecoveryCode(false);
      setRecoveryCodes([]);
      setMessage("Two-factor authentication is disabled. You can activate it again anytime.");
      setError("");
      await queryClient.invalidateQueries({ queryKey: ["current-user"] });
    },
    onError: (error_) => setError(getApiErrorMessage(error_, "Could not disable 2FA."))
  });

  return (
    <div className="premium-card p-5">
      <SectionHeader
        kicker="Account security"
        title="Two-factor authentication"
        text={enabled ? "Your account requires an authenticator code at login." : "Add an authenticator code requirement to protect every login after signup."}
        action={<Badge tone={enabled ? "success" : setupRequired ? "warning" : "neutral"}>{enabled ? "Active" : "Setup required"}</Badge>}
      />
      {userQuery.isLoading ? (
        <div className="mt-5"><LoadingBlock label="Loading security status..." /></div>
      ) : (
        <div className="mt-5 grid gap-4">
          {!enabled ? (
            <>
              {!setup ? (
                <div className="rounded-[1.5rem] bg-surface-2 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-ink">Authenticator setup</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-ink-soft">Works with Google Authenticator, Microsoft Authenticator, Authy, and compatible TOTP apps.</p>
                    </div>
                    <Button type="button" onClick={() => startSetup.mutate()} disabled={startSetup.isPending}>
                      <ShieldCheck className="h-4 w-4" /> {startSetup.isPending ? "Starting..." : "Activate 2FA"}
                    </Button>
                  </div>
                </div>
              ) : (
                <form className="grid gap-4 rounded-[1.5rem] bg-surface-2 p-4" onSubmit={(event) => { event.preventDefault(); verifySetup.mutate(); }}>
                  <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
                    {qrCode ? <img src={qrCode} alt="Two-factor authentication QR code" className="h-44 w-44 rounded-2xl bg-white p-3 shadow-soft" /> : null}
                    <div className="min-w-0">
                      <p className="text-sm font-black text-ink">Scan the QR code, then enter the current code.</p>
                      {secret ? <p className="mt-3 break-all rounded-2xl bg-surface px-4 py-3 text-xs font-bold text-ink-soft">{secret}</p> : null}
                      {otpauthUrl ? <a className="mt-3 inline-flex text-sm font-bold text-primary" href={otpauthUrl}>Open authenticator link</a> : null}
                    </div>
                  </div>
                  <label>
                    <span className="caption-type">Authenticator code</span>
                    <input className="input-control mt-2" inputMode="numeric" autoComplete="one-time-code" value={setupCode} onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={verifySetup.isPending}>{verifySetup.isPending ? "Verifying..." : "Verify and enable"}</Button>
                    <Button type="button" variant="secondary" onClick={() => { setSetup(null); setSetupCode(""); }}>Cancel setup</Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <form className="grid gap-4 rounded-[1.5rem] bg-surface-2 p-4" onSubmit={(event) => { event.preventDefault(); disableSetup.mutate(); }}>
              <div className="grid gap-4 md:grid-cols-2">
                <label>
                  <span className="caption-type">Password</span>
                  <input className="input-control mt-2" type="password" autoComplete="current-password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} />
                </label>
                {!useRecoveryCode ? (
                  <label>
                    <span className="caption-type">Authenticator code</span>
                    <input className="input-control mt-2" inputMode="numeric" autoComplete="one-time-code" value={disableCode} onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" />
                  </label>
                ) : (
                  <label>
                    <span className="caption-type">Recovery code</span>
                    <input className="input-control mt-2" value={disableRecoveryCode} onChange={(event) => setDisableRecoveryCode(event.target.value)} placeholder="XXXX-XXXX-XXXX" />
                  </label>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="secondary" disabled={disableSetup.isPending}>
                  {disableSetup.isPending ? "Disabling..." : "Deactivate 2FA"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setUseRecoveryCode((value) => !value)}>
                  {useRecoveryCode ? "Use authenticator code" : "Use recovery code"}
                </Button>
              </div>
            </form>
          )}
          {recoveryCodes.length ? (
            <div className="rounded-[1.5rem] border border-warning/25 bg-warning/10 p-4">
              <p className="text-sm font-black text-ink">Save these recovery codes now.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {recoveryCodes.map((code) => <code key={code} className="rounded-xl bg-surface px-3 py-2 text-sm font-bold text-ink">{code}</code>)}
              </div>
            </div>
          ) : null}
          {message ? <div className="rounded-2xl bg-success/10 p-3 text-sm font-semibold text-success">{message}</div> : null}
          {error ? <div className="rounded-2xl bg-error/10 p-3 text-sm font-semibold text-error">{error}</div> : null}
        </div>
      )}
    </div>
  );
}

export function BookingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState<UserBooking | null>(null);
  const [bookingConversationId, setBookingConversationId] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const initialCheckIn = searchParams.get("checkIn") || addDaysIso(todayIso(), 1);
  const initialCheckOut = searchParams.get("checkOut") || addDaysIso(initialCheckIn, 3);
  const initialGuests = searchParams.get("guests") || "2";
  const [tripDetails, setTripDetails] = useState({ checkIn: initialCheckIn, checkOut: initialCheckOut });
  const [guestDetails, setGuestDetails] = useState({ fullName: "", email: "", phone: "", guests: initialGuests, notes: "" });
  const steps = ["Property", "Guest details", "Payment", "Confirmation"];
  const propertyId = Number(id);
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const propertyQuery = useQuery({ queryKey: ["booking-property", propertyId], queryFn: () => getPropertyById(propertyId), enabled: Number.isFinite(propertyId) });
  const apiProperty = propertyQuery.data;
  const property = apiProperty ? toExperienceProperty(apiProperty) : null;
  const rawNights = daysBetween(tripDetails.checkIn, tripDetails.checkOut);
  const nights = Math.max(1, rawNights);
  const validDateRange = Boolean(tripDetails.checkIn && tripDetails.checkOut && rawNights > 0 && tripDetails.checkIn >= todayIso());
  const pricingQuery = useQuery({
    queryKey: ["booking-pricing", propertyId, tripDetails.checkIn, tripDetails.checkOut, guestDetails.guests],
    queryFn: () => getDynamicPriceForDates(propertyId, tripDetails.checkIn, tripDetails.checkOut, Number(guestDetails.guests)),
    enabled: Boolean(property && validDateRange)
  });
  const availabilityQuery = useQuery({
    queryKey: ["booking-availability", propertyId, tripDetails.checkIn, tripDetails.checkOut, guestDetails.guests],
    queryFn: () => checkAvailability(propertyId, tripDetails.checkIn, tripDetails.checkOut, Number(guestDetails.guests)),
    enabled: Boolean(property && validDateRange)
  });
  useEffect(() => {
    const user = userQuery.data as { fullName?: string; name?: string; email?: string } | undefined;
    if (!user) return;
    setGuestDetails((current) => ({
      ...current,
      fullName: current.fullName || user.fullName || user.name || "",
      email: current.email || user.email || "",
    }));
  }, [userQuery.data]);
  const checkout = useMutation({
    mutationFn: async () => {
      if (!property) throw new Error("Property is not available");
      if (step === 1) {
        if (!validDateRange) {
          throw new Error("Choose a valid check-in and check-out before continuing.");
        }
        if (!guestDetails.fullName.trim()) {
          throw new Error("Enter your full name before continuing.");
        }
        if (!guestDetails.email.trim()) {
          throw new Error("Enter your email before continuing.");
        }
        const latestAvailability = await availabilityQuery.refetch();
        if (latestAvailability.isError) {
          throw latestAvailability.error;
        }
        if (latestAvailability.data?.available === false) {
          throw new Error("Selected dates are no longer available");
        }
        const created = await createReservation({
          propertyId: property.id,
          fullName: guestDetails.fullName,
          email: guestDetails.email,
          guests: Number(guestDetails.guests),
          checkIn: tripDetails.checkIn,
          checkOut: tripDetails.checkOut,
          notes: guestDetails.notes,
        });
        setBooking(created);
        if (created.hostId) {
          const conversation = await createConversation(created.hostId, created.propertyId, created.id);
          setBookingConversationId(conversation.id);
          await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        }
        await queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
      }
      if (step === 2) {
        const activeBooking = booking;
        if (!activeBooking) throw new Error("Create the booking before payment");
        const payment = await createPayment(activeBooking.id, "manual");
        await confirmPayment(payment.id, "succeeded", `manual-${activeBooking.bookingReference}`);
        setBooking({ ...activeBooking, status: activeBooking.status || "Pending", statusRaw: activeBooking.statusRaw || "pending" });
        await queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
      }
    },
    onSuccess: () => {
      setCheckoutError("");
      setStep((value) => Math.min(steps.length - 1, value + 1));
    },
    onError: (error) => setCheckoutError(getApiErrorMessage(error, "Checkout failed"))
  });
  if (!property) {
    return <div className="min-h-screen overflow-x-hidden bg-canvas" />;
  }
  const fees = Math.round((pricingQuery.data?.serviceFee ?? property.price * nights * 0.18) + (pricingQuery.data?.cityTax ?? 0));
  const total = Math.round(pricingQuery.data?.total ?? property.price * nights + fees);
  const primaryActionLabel =
    step === 0
      ? "Continue to guest details"
      : step === 1
        ? "Create reservation request"
        : step === 2
          ? "Submit for host approval"
          : "View My Reservations";
  const continueCheckout = () => {
    if (step === 0) {
      if (!validDateRange) {
        setCheckoutError("Choose a checkout date after check-in");
        return;
      }
      if (availabilityQuery.isLoading || availabilityQuery.isFetching) {
        setCheckoutError("Checking availability. Please wait a moment.");
        return;
      }
      if (availabilityQuery.isError) {
        setCheckoutError(getApiErrorMessage(availabilityQuery.error, "Could not check availability for these dates."));
        return;
      }
      if (availabilityQuery.data?.available === false) {
        setCheckoutError("Selected dates are no longer available");
        return;
      }
      setCheckoutError("");
      setStep(1);
      return;
    }
    if (step === steps.length - 1) {
      navigate("/reservations");
      return;
    }
    checkout.mutate();
  };
  return (
    <WorkspaceShell role="traveler" title="Booking flow" subtitle="A compact multi-step checkout with progress, validation cues, trust copy, payment review, and mobile-friendly sticky summary." action={<LinkButton to={`/property/${property.id}`} variant="secondary">Back to listing</LinkButton>}>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <section className="premium-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="caption-type">Step {step + 1} of {steps.length}</p>
              <h1 className="h2-type mt-2">{steps[step]}</h1>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-2 sm:w-72">
              <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
          </div>
          <div className="mt-8">
            {step === 0 ? <BookingPropertyStep property={property} tripDetails={tripDetails} guestCount={guestDetails.guests} onTripChange={setTripDetails} availability={availabilityQuery.data} /> : null}
            {step === 1 ? <GuestDetailsStep value={guestDetails} onChange={setGuestDetails} /> : null}
            {step === 2 ? <PaymentStep property={property} /> : null}
            {step === 3 ? <ConfirmationStep property={property} booking={booking} conversationId={bookingConversationId} tripDetails={tripDetails} nights={nights} total={total} /> : null}
          </div>
          {checkoutError ? <div className="mt-5 rounded-2xl bg-error/10 p-4 text-sm font-semibold text-error">{checkoutError}</div> : null}
          <div className="mt-8 flex flex-col justify-between gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>Back</Button>
            <Button onClick={continueCheckout} disabled={checkout.isPending}>{checkout.isPending ? "Working..." : primaryActionLabel}</Button>
          </div>
        </section>
        <aside className="premium-panel h-fit p-5 xl:sticky xl:top-28">
          <img src={property.image} alt={property.title} className="aspect-[16/10] rounded-[1.5rem] object-cover" />
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.05em]">{property.title}</h2>
          <p className="mt-2 text-sm font-semibold text-ink-soft">{property.city} / {nights} nights / {guestDetails.guests} guests</p>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-ink-soft">
            <LineItem label="Stay" value={currency(Math.round(pricingQuery.data?.subtotal ?? property.price * nights))} />
            <LineItem label="Fees" value={currency(fees)} />
            <LineItem label="Total" value={currency(total)} strong />
          </div>
          <div className="mt-5 rounded-[1.25rem] bg-success/10 p-4 text-sm font-semibold leading-6 text-success">
            Your payment is recorded and the host must accept the reservation before the dates become booked.
          </div>
        </aside>
      </div>
    </WorkspaceShell>
  );
}

function BookingPropertyStep({
  property,
  tripDetails,
  guestCount,
  onTripChange,
  availability
}: {
  property: Property;
  tripDetails: { checkIn: string; checkOut: string };
  guestCount: string;
  onTripChange: (value: { checkIn: string; checkOut: string }) => void;
  availability?: { available?: boolean; remainingUnits?: number };
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[280px_1fr]">
      <img src={property.image} alt={property.title} className="aspect-[4/3] rounded-[1.5rem] object-cover" />
      <div>
        <Badge tone="success">Verified selection</Badge>
        <h2 className="h3-type mt-3">{property.title}</h2>
        <p className="body-type mt-3">{property.description}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label><span className="caption-type">Check-in</span><input className="input-control mt-2" type="date" min={todayIso()} value={tripDetails.checkIn} onChange={(event) => onTripChange({ ...tripDetails, checkIn: event.target.value })} /></label>
          <label><span className="caption-type">Check-out</span><input className="input-control mt-2" type="date" min={addDaysIso(tripDetails.checkIn, 1)} value={tripDetails.checkOut} onChange={(event) => onTripChange({ ...tripDetails, checkOut: event.target.value })} /></label>
        </div>
        <div className="mt-4">
          <StatusRow
            label={availability?.available === false ? "Selected dates unavailable" : `Availability checked for ${guestCount} guests`}
            tone={availability?.available === false ? "warning" : "success"}
          />
        </div>
      </div>
    </div>
  );
}

function GuestDetailsStep({ value, onChange }: { value: { fullName: string; email: string; phone: string; guests: string; notes: string }; onChange: (value: { fullName: string; email: string; phone: string; guests: string; notes: string }) => void }) {
  const update = (key: keyof typeof value, nextValue: string) => onChange({ ...value, [key]: nextValue });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label><span className="caption-type">Full name</span><input className="input-control mt-2" value={value.fullName} onChange={(event) => update("fullName", event.target.value)} required /></label>
      <label><span className="caption-type">Email</span><input className="input-control mt-2" type="email" value={value.email} onChange={(event) => update("email", event.target.value)} required /></label>
      <label><span className="caption-type">Phone</span><input className="input-control mt-2" value={value.phone} onChange={(event) => update("phone", event.target.value)} /></label>
      <label><span className="caption-type">Guests</span><select className="input-control mt-2" value={value.guests} onChange={(event) => update("guests", event.target.value)}><option value="1">1 guest</option><option value="2">2 guests</option><option value="4">4 guests</option><option value="6">6 guests</option></select></label>
      <label className="sm:col-span-2"><span className="caption-type">Arrival notes</span><textarea className="input-control mt-2 min-h-32 py-4" value={value.notes} onChange={(event) => update("notes", event.target.value)} /></label>
    </div>
  );
}

function PaymentStep({ property }: { property: Property }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.9fr]">
      <div className="rounded-[1.5rem] bg-surface-2 p-5">
        <p className="caption-type">Payment method</p>
        <div className="mt-4 rounded-[1.25rem] border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <p className="font-bold text-ink">Secure manual payment</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input className="input-control" aria-label="Payment reference" />
            <input className="input-control" aria-label="Billing ZIP" />
          </div>
        </div>
      </div>
      <div className="rounded-[1.5rem] bg-surface-2 p-5">
        <p className="caption-type">Validation</p>
        <div className="mt-4 grid gap-3">
          <StatusRow label="Availability checked" tone="success" />
          <StatusRow label={`${property.host} verified`} tone="success" />
          <StatusRow label="Host approval required" tone="warning" />
        </div>
      </div>
    </div>
  );
}

function ConfirmationStep({
  property,
  booking,
  conversationId,
  tripDetails,
  nights,
  total
}: {
  property: Property;
  booking: UserBooking | null;
  conversationId?: number | null;
  tripDetails: { checkIn: string; checkOut: string };
  nights: number;
  total: number;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-[2rem] border border-success/20 bg-success/10 p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success text-white shadow-soft"><Check className="h-8 w-8" /></div>
        <h2 className="h2-type mt-5">Reservation request sent.</h2>
        <p className="body-type mx-auto mt-4 max-w-xl">Your stay is saved in My Reservations as pending. When the host accepts it, the dates are blocked on the listing calendar and your reservation changes to confirmed.</p>
      </div>
      <div className="mt-5 grid gap-4 rounded-[1.5rem] border border-line bg-surface-2 p-5 text-sm font-semibold text-ink-soft sm:grid-cols-2">
        <LineItem label="Property" value={property.title} />
        <LineItem label="Status" value={booking?.status || "Pending"} />
        <LineItem label="Check-in" value={formatFriendlyDate(booking?.checkIn || tripDetails.checkIn)} />
        <LineItem label="Check-out" value={formatFriendlyDate(booking?.checkOut || tripDetails.checkOut)} />
        <LineItem label="Nights" value={`${booking?.nights || nights}`} />
        <LineItem label="Total" value={currency(booking?.total || total)} strong />
      </div>
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        {conversationId ? <LinkButton to={`/messages?conversation=${conversationId}`}><MessageCircle className="h-4 w-4" /> Open conversation</LinkButton> : null}
        <LinkButton to="/reservations">View My Reservations</LinkButton>
        <LinkButton to="/search" variant="secondary">Return to browsing</LinkButton>
      </div>
    </div>
  );
}

function useHostWorkspaceData() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [hostReservationError, setHostReservationError] = useState("");
  const dashboardQuery = useQuery({ queryKey: ["host-dashboard"], queryFn: getHostDashboard });
  const hostReservationsQuery = useQuery({ queryKey: ["host-reservations"], queryFn: getHostReservations });
  const dashboard = dashboardQuery.data as ApiHostDashboard | undefined;
  const listings = (dashboard?.properties || []).map(toExperienceProperty);
  const reservations = hostReservationsQuery.data || dashboard?.recentReservations || [];
  const metrics = (dashboard?.metrics || []).map(toMetric);
  const chartData = toChartData(dashboard?.revenueTrends, dashboard?.bookingTrends);
  const sourceData = Object.entries(reservations.reduce<Record<string, number>>((acc, reservation) => {
    acc[reservation.status] = (acc[reservation.status] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value }));
  const tasks = (dashboard as (ApiHostDashboard & { tasks?: string[] }) | undefined)?.tasks || [];
  const reservationLoadError = hostReservationsQuery.isError ? getApiErrorMessage(hostReservationsQuery.error, "Could not load host reservations") : "";
  const hostReservationAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "confirm" | "cancel" | "complete" }) => {
      if (action === "confirm") return confirmHostReservation(id);
      if (action === "complete") return completeHostReservation(id);
      return cancelHostReservation(id);
    },
    onMutate: () => setHostReservationError(""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["host-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["host-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["property-calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["reservation-calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["property-availability"] });
    },
    onError: (error) => setHostReservationError(getApiErrorMessage(error, "Could not update reservation"))
  });
  const openReservationConversation = useMutation({
    mutationFn: (booking: UserBooking) => {
      if (!booking.guestId) throw new Error("Guest account is not available for this reservation.");
      return createConversation(booking.guestId, booking.propertyId, booking.id);
    },
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/messages?conversation=${conversation.id}`);
    },
    onError: (error) => setHostReservationError(getApiErrorMessage(error, "Could not open conversation"))
  });

  return {
    chartData,
    dashboard,
    dashboardQuery,
    hostReservationAction,
    hostReservationError,
    hostReservationsQuery,
    listings,
    metrics,
    openReservationConversation,
    reservationLoadError,
    reservations,
    sourceData,
    tasks
  };
}

export function HostDashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [hostReservationError, setHostReservationError] = useState("");
  const [selectedCalendarPropertyId, setSelectedCalendarPropertyId] = useState<number | undefined>();
  const dashboardQuery = useQuery({ queryKey: ["host-dashboard"], queryFn: getHostDashboard });
  const hostReservationsQuery = useQuery({ queryKey: ["host-reservations"], queryFn: getHostReservations });
  const dashboard = dashboardQuery.data as ApiHostDashboard | undefined;
  const metrics = (dashboard?.metrics || []).map(toMetric);
  const listings = (dashboard?.properties || []).map(toExperienceProperty);
  const reservations = hostReservationsQuery.data || dashboard?.recentReservations || [];
  const chartData = toChartData(dashboard?.revenueTrends, dashboard?.bookingTrends);
  const sourceData = Object.entries(reservations.reduce<Record<string, number>>((acc, reservation) => {
    acc[reservation.status] = (acc[reservation.status] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value }));
  const tasks = (dashboard as (ApiHostDashboard & { tasks?: string[] }) | undefined)?.tasks || [];
  const reservationLoadError = hostReservationsQuery.isError ? getApiErrorMessage(hostReservationsQuery.error, "Could not load host reservations") : "";
  const hostReservationAction = useMutation({
    mutationFn: ({ id, action }: { id: number; action: "confirm" | "cancel" | "complete" }) => {
      if (action === "confirm") return confirmHostReservation(id);
      if (action === "complete") return completeHostReservation(id);
      return cancelHostReservation(id);
    },
    onMutate: () => setHostReservationError(""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["host-reservations"] });
      await queryClient.invalidateQueries({ queryKey: ["host-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["property-calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["reservation-calendar"] });
      await queryClient.invalidateQueries({ queryKey: ["property-availability"] });
    },
    onError: (error) => setHostReservationError(getApiErrorMessage(error, "Could not update reservation"))
  });
  const openReservationConversation = useMutation({
    mutationFn: (booking: UserBooking) => {
      if (!booking.guestId) throw new Error("Guest account is not available for this reservation.");
      return createConversation(booking.guestId, booking.propertyId, booking.id);
    },
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
      navigate(`/messages?conversation=${conversation.id}`);
    },
    onError: (error) => setHostReservationError(getApiErrorMessage(error, "Could not open conversation"))
  });
  useEffect(() => {
    if (!listings.length) return;
    if (!selectedCalendarPropertyId || !listings.some((property) => property.id === selectedCalendarPropertyId)) {
      setSelectedCalendarPropertyId(listings[0].id);
    }
  }, [listings, selectedCalendarPropertyId]);

  if (dashboardQuery.isLoading || hostReservationsQuery.isLoading) {
    return (
      <WorkspaceShell role="host" title="Host home" subtitle="Loading your host workspace." action={<LinkButton to="/host/onboarding"><Plus className="h-4 w-4" /> Add your place</LinkButton>}>
        <LoadingBlock />
      </WorkspaceShell>
    );
  }

  return (
    <WorkspaceShell role="host" title="Host home" subtitle="A warm, practical workspace for listings, reservations, pricing, messages, calendar health, and guest care." action={<LinkButton to="/host/onboarding"><Plus className="h-4 w-4" /> Add your place</LinkButton>}>
      <WorkspaceHero
        kicker="Today's hosting rhythm"
        title="Make your place feel ready for the next guest."
        text="Publish a rent announcement, adjust availability, follow reservations, and keep every guest touchpoint in one calm dashboard."
        action={
          <>
            <LinkButton to="/host/onboarding" className="bg-white text-ink hover:bg-white hover:text-ink"><Plus className="h-4 w-4" /> Add your place</LinkButton>
            <LinkButton to="/host/reservations" variant="secondary" className="border-white/20 bg-white/10 text-white hover:bg-white/15">Review reservations</LinkButton>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {["Listings", "Reservations", "Calendar"].map((item, index) => (
            <div key={item} className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
              <p className="text-2xl font-semibold tracking-[-0.05em]">{index === 0 ? listings.length : index === 1 ? reservations.length : chartData.length}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/55">{item}</p>
            </div>
          ))}
        </div>
      </WorkspaceHero>

      <HumanNote>Tip: guests decide faster when your announcement feels personal. Add a warm opening line, clear arrival notes, and two or three photos that show the real light of the space.</HumanNote>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.length ? metrics.slice(0, 4).map((metric) => <MetricCard key={metric.label} metric={metric} />) : (
          <div className="sm:col-span-2 xl:col-span-4"><EmptyState icon={<BarChart3 className="h-5 w-5" />} title="Metrics will appear after your first activity" text="Publish a listing and accept reservations to unlock revenue, occupancy, and conversion insights." /></div>
        )}
      </section>

      <section id="earnings" className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <ChartPanel title="Revenue analytics"><RevenueChart data={chartData} /></ChartPanel>
        <ChartPanel title="Occupancy trend"><OccupancyChart data={chartData} /></ChartPanel>
      </section>

      <section id="listings">
        <SectionHeader kicker="Listings" title="Your spaces, beautifully organized." text="Each announcement is easy to scan, with the essentials hosts and guests care about most." action={<LinkButton to="/host/onboarding" variant="secondary"><Plus className="h-4 w-4" /> Add your place</LinkButton>} />
        <div className="mt-6 grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {listings.length ? listings.slice(0, 6).map((property) => <PropertyCard key={property.id} property={property} />) : (
            <div className="md:col-span-2 xl:col-span-3"><EmptyState icon={<Building2 className="h-5 w-5" />} title="No places listed yet" text="Start with the basics: a friendly title, a few honest photos, clear pricing, location, amenities, and availability." action={<LinkButton to="/host/onboarding"><Plus className="h-4 w-4" /> Add your place</LinkButton>} /></div>
          )}
        </div>
      </section>

      <section id="reservations" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="premium-card min-w-0 p-5">
          <SectionHeader kicker="Reservations" title="Reservations without the noise." text="A clean view of who is arriving, where they are staying, and what needs your attention." />
          <div className="mt-5">
            {hostReservationError ? <div className="mb-4 rounded-2xl bg-error/10 p-4 text-sm font-semibold text-error">{hostReservationError}</div> : null}
            {reservationLoadError ? <div className="mb-4 rounded-2xl bg-error/10 p-4 text-sm font-semibold text-error">{reservationLoadError}</div> : null}
            <HostReservationList
              reservations={reservations}
              workingId={hostReservationAction.isPending ? hostReservationAction.variables?.id : undefined}
              onAction={(id, action) => hostReservationAction.mutate({ id, action })}
              openingConversationId={openReservationConversation.isPending ? openReservationConversation.variables?.id : undefined}
              onOpenConversation={(booking) => openReservationConversation.mutate(booking)}
            />
          </div>
        </div>
        <div className="premium-card p-5">
          <SectionHeader kicker="Tasks" title="Small things to handle next." />
          <div className="mt-5 grid max-h-[420px] gap-3 overflow-y-auto pr-1">
            {tasks.length ? tasks.map((task, index) => <div key={task} className="rounded-2xl bg-surface-2 p-4 text-sm font-semibold leading-6 text-ink-soft"><Badge tone={index === 0 ? "warning" : "neutral"}>{index + 1}</Badge><p className="mt-3">{task}</p></div>) : <EmptyState title="All clear" text="No urgent host tasks are waiting right now." />}
          </div>
        </div>
      </section>

      <section id="calendar" className="grid gap-6 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <CalendarPanel
          propertyId={selectedCalendarPropertyId}
          properties={listings}
          reservations={reservations}
          onPropertyChange={setSelectedCalendarPropertyId}
          workingId={hostReservationAction.isPending ? hostReservationAction.variables?.id : undefined}
          onReservationAction={(id, action) => hostReservationAction.mutate({ id, action })}
          openingConversationId={openReservationConversation.isPending ? openReservationConversation.variables?.id : undefined}
          onOpenConversation={(booking) => openReservationConversation.mutate(booking)}
        />
        <div id="analytics" className="premium-card min-w-0 p-5">
          <SectionHeader kicker="Booking sources" title="Where demand is coming from." />
          <div className="mt-5 h-72 min-w-0">{sourceData.length ? <SourceChart data={sourceData} /> : <EmptyState title="No source data yet" text="Source distribution appears after reservations start flowing." />}</div>
        </div>
      </section>
      <section id="reviews" className="grid gap-6 lg:grid-cols-2">
        <div className="premium-card p-5">
          <SectionHeader kicker="Reviews" title="Recent guest feedback." />
          <div className="mt-5 grid gap-3">
            {(dashboard?.recentReviews || []).length ? (dashboard?.recentReviews || []).slice(0, 4).map((review) => (
              <div key={review.id} className="rounded-2xl bg-surface-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-ink">{review.author}</p>
                  <Badge tone="success">{review.rating} stars</Badge>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink-soft">{review.comment}</p>
              </div>
            )) : <EmptyState title="No host reviews yet" text="Reviews appear here after guests complete stays and leave feedback." />}
          </div>
        </div>
        <div id="settings" className="grid gap-5">
          <div className="premium-card p-5">
            <SectionHeader kicker="Settings" title="Hosting controls." />
            <div className="mt-5 grid gap-3">
              <StatusRow label="Host reservation approvals enabled" tone="success" />
              <StatusRow label="Calendar sync uses backend reservation data" tone="success" />
              <StatusRow label="Only your properties are visible" tone="success" />
            </div>
          </div>
          <TwoFactorSecurityPanel />
        </div>
      </section>
    </WorkspaceShell>
  );
}

export function HostListingsPage() {
  const { dashboardQuery, listings } = useHostWorkspaceData();

  return (
    <WorkspaceShell role="host" title="Listings" subtitle="Every apartment you own, with clear status, pricing, photos, and quick access to the public listing." action={<LinkButton to="/host/onboarding"><Plus className="h-4 w-4" /> Add apartment</LinkButton>}>
      {dashboardQuery.isLoading ? <LoadingBlock label="Loading your apartments..." /> : (
        <>
          <WorkspaceHero
            kicker="Listing portfolio"
            title="Your apartments need to feel easy to scan and easy to trust."
            text="Use the onboarding flow to add better photos, accurate capacity, pricing, amenities, and location context for each apartment."
            action={<LinkButton to="/host/onboarding" className="bg-white text-ink hover:bg-white hover:text-ink"><Plus className="h-4 w-4" /> Add apartment</LinkButton>}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                <p className="text-2xl font-semibold tracking-[-0.05em]">{listings.length}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/55">Published spaces</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                <p className="text-2xl font-semibold tracking-[-0.05em]">{listings.filter((property) => property.verified).length}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/55">Verified</p>
              </div>
              <div className="rounded-[1.35rem] border border-white/10 bg-white/10 p-4 text-white backdrop-blur">
                <p className="text-2xl font-semibold tracking-[-0.05em]">{listings.reduce((sum, property) => sum + property.reviews, 0)}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/55">Reviews</p>
              </div>
            </div>
          </WorkspaceHero>
          <section>
            <SectionHeader kicker="Your apartments" title="Manage each announcement separately." />
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {listings.length ? listings.map((property) => <PropertyCard key={property.id} property={property} />) : (
                <div className="md:col-span-2 xl:col-span-3">
                  <EmptyState icon={<Building2 className="h-5 w-5" />} title="No apartments yet" text="Start the guided onboarding to add photos, price, location, amenities, and calendar rules." action={<LinkButton to="/host/onboarding"><Plus className="h-4 w-4" /> Add your first apartment</LinkButton>} />
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}

export function HostReservationsPage() {
  const {
    hostReservationAction,
    hostReservationError,
    hostReservationsQuery,
    openReservationConversation,
    reservationLoadError,
    reservations
  } = useHostWorkspaceData();
  const pendingCount = reservations.filter((reservation) => ["pending", "draft"].includes(String(reservation.statusRaw || reservation.status).toLowerCase())).length;

  return (
    <WorkspaceShell role="host" title="Reservations" subtitle="Accept, reject, complete, and message guests from one host-owned reservation queue." action={<LinkButton to="/host/calendar" variant="secondary">Open calendar</LinkButton>}>
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard metric={{ label: "Total reservations", value: String(reservations.length), delta: "For your apartments only", tone: "primary" }} />
        <MetricCard metric={{ label: "Need decision", value: String(pendingCount), delta: "Pending host acceptance", tone: pendingCount ? "warning" : "success" }} />
        <MetricCard metric={{ label: "Confirmed revenue", value: currency(reservations.filter((reservation) => String(reservation.statusRaw || reservation.status).toLowerCase() === "confirmed").reduce((sum, reservation) => sum + reservation.total, 0)), delta: "Accepted reservations", tone: "success" }} />
      </section>
      <section className="premium-card p-5">
        <SectionHeader kicker="Reservation queue" title="See price, dates, guest, and acceptance status." text="Accepting a reservation blocks those apartment dates on the host and guest calendars." />
        <div className="mt-5">
          {hostReservationsQuery.isLoading ? <LoadingBlock label="Loading reservations..." /> : null}
          {hostReservationError ? <div className="mb-4 rounded-2xl bg-error/10 p-4 text-sm font-semibold text-error">{hostReservationError}</div> : null}
          {reservationLoadError ? <div className="mb-4 rounded-2xl bg-error/10 p-4 text-sm font-semibold text-error">{reservationLoadError}</div> : null}
          <HostReservationList
            reservations={reservations}
            workingId={hostReservationAction.isPending ? hostReservationAction.variables?.id : undefined}
            onAction={(id, action) => hostReservationAction.mutate({ id, action })}
            openingConversationId={openReservationConversation.isPending ? openReservationConversation.variables?.id : undefined}
            onOpenConversation={(booking) => openReservationConversation.mutate(booking)}
          />
        </div>
      </section>
    </WorkspaceShell>
  );
}

export function HostCalendarPage() {
  const {
    dashboardQuery,
    hostReservationAction,
    hostReservationError,
    listings,
    openReservationConversation,
    reservations
  } = useHostWorkspaceData();
  const [selectedCalendarPropertyId, setSelectedCalendarPropertyId] = useState<number | undefined>();

  useEffect(() => {
    if (!listings.length) return;
    if (!selectedCalendarPropertyId || !listings.some((property) => property.id === selectedCalendarPropertyId)) {
      setSelectedCalendarPropertyId(listings[0].id);
    }
  }, [listings, selectedCalendarPropertyId]);

  return (
    <WorkspaceShell role="host" title="Calendar" subtitle="Each apartment has its own calendar. Accepted reservations are highlighted and block the same dates for guests." action={<LinkButton to="/host/reservations" variant="secondary">Reservations</LinkButton>}>
      {dashboardQuery.isLoading ? <LoadingBlock label="Loading calendar data..." /> : listings.length ? (
        <>
          {hostReservationError ? <div className="rounded-2xl bg-error/10 p-4 text-sm font-semibold text-error">{hostReservationError}</div> : null}
          <CalendarPanel
            propertyId={selectedCalendarPropertyId}
            properties={listings}
            reservations={reservations}
            onPropertyChange={setSelectedCalendarPropertyId}
            workingId={hostReservationAction.isPending ? hostReservationAction.variables?.id : undefined}
            onReservationAction={(id, action) => hostReservationAction.mutate({ id, action })}
            openingConversationId={openReservationConversation.isPending ? openReservationConversation.variables?.id : undefined}
            onOpenConversation={(booking) => openReservationConversation.mutate(booking)}
          />
        </>
      ) : <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No apartment calendar yet" text="Create an apartment first, then its own backend-backed calendar appears here." action={<LinkButton to="/host/onboarding"><Plus className="h-4 w-4" /> Add apartment</LinkButton>} />}
    </WorkspaceShell>
  );
}

export function HostEarningsPage() {
  const { chartData, dashboardQuery, metrics, reservations } = useHostWorkspaceData();
  const confirmedRevenue = reservations.filter((reservation) => String(reservation.statusRaw || reservation.status).toLowerCase() === "confirmed").reduce((sum, reservation) => sum + reservation.total, 0);

  return (
    <WorkspaceShell role="host" title="Earnings" subtitle="Revenue, occupancy, payout readiness, and accepted reservation value for your apartments.">
      {dashboardQuery.isLoading ? <LoadingBlock label="Loading earnings..." /> : (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            {metrics.slice(0, 3).map((metric) => <MetricCard key={metric.label} metric={metric} />)}
            <MetricCard metric={{ label: "Confirmed value", value: currency(confirmedRevenue), delta: "Accepted reservations", tone: "success" }} />
          </section>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <ChartPanel title="Revenue analytics"><RevenueChart data={chartData} /></ChartPanel>
            <ChartPanel title="Occupancy trend"><OccupancyChart data={chartData} /></ChartPanel>
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}

export function HostReviewsPage() {
  const { dashboard, dashboardQuery } = useHostWorkspaceData();
  const reviews = (dashboard?.recentReviews || []).map((review) => ({ ...review, author: review.author || "Verified guest" }));

  return (
    <WorkspaceShell role="host" title="Reviews" subtitle="Recent apartment and host feedback from travelers after completed stays.">
      {dashboardQuery.isLoading ? <LoadingBlock label="Loading reviews..." /> : (
        <section className="premium-card p-5">
          <SectionHeader kicker="Guest feedback" title="Reviews guests left for your hosting work." />
          <ReviewList reviews={reviews} emptyTitle="No host reviews yet" emptyText="Reviews appear after guests complete stays and submit their one combined apartment and host review." />
        </section>
      )}
    </WorkspaceShell>
  );
}

export function HostAnalyticsPage() {
  const { chartData, dashboardQuery, listings, reservations, sourceData } = useHostWorkspaceData();

  return (
    <WorkspaceShell role="host" title="Analytics" subtitle="Performance signals across listings, reservations, demand, revenue, and calendar health.">
      {dashboardQuery.isLoading ? <LoadingBlock label="Loading analytics..." /> : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <MetricCard metric={{ label: "Listings", value: String(listings.length), delta: "Published apartments", tone: "primary" }} />
            <MetricCard metric={{ label: "Reservations", value: String(reservations.length), delta: "All host-owned reservations", tone: "accent" }} />
            <MetricCard metric={{ label: "Average rating", value: listings.length ? (listings.reduce((sum, property) => sum + property.rating, 0) / listings.length).toFixed(1) : "0.0", delta: "Across active apartments", tone: "success" }} />
          </section>
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <ChartPanel title="Revenue and demand"><RevenueChart data={chartData} /></ChartPanel>
            <ChartPanel title="Reservation status mix">{sourceData.length ? <SourceChart data={sourceData} /> : <EmptyState title="No reservation mix yet" text="Reservation status analytics appear after guests request stays." />}</ChartPanel>
          </section>
          <section className="premium-card p-5">
            <SectionHeader kicker="Listing performance" title="Apartment health at a glance." />
            <div className="mt-5 grid gap-3">
              {listings.length ? listings.map((property) => (
                <div key={property.id} className="grid gap-3 rounded-2xl bg-surface-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="font-bold text-ink">{property.title}</p>
                    <p className="mt-1 text-sm font-semibold text-ink-soft">{property.city} / {property.guests} guests / {currency(property.price)} per night</p>
                  </div>
                  <Badge tone={property.verified ? "success" : "warning"}>{property.rating.toFixed(1)} stars</Badge>
                </div>
              )) : <EmptyState title="No analytics yet" text="Publish an apartment to unlock listing performance." />}
            </div>
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}

export function HostSettingsPage() {
  return (
    <WorkspaceShell role="host" title="Settings" subtitle="Hosting controls, calendar assurances, notifications, and security setup.">
      <section className="grid gap-6">
        <div className="premium-card p-5">
          <SectionHeader kicker="Hosting rules" title="Operational safeguards." />
          <div className="mt-5 grid gap-3">
            <StatusRow label="Host reservation approvals enabled" tone="success" />
            <StatusRow label="Accepted bookings block apartment calendar dates" tone="success" />
            <StatusRow label="Host API only returns your own reservations" tone="success" />
            <StatusRow label="Guests can message after booking request" tone="success" />
          </div>
        </div>
        <EditableSettingsPanels role="host" />
      </section>
      <TwoFactorSecurityPanel />
    </WorkspaceShell>
  );
}

function HostReservationList({
  reservations,
  onAction,
  workingId,
  onOpenConversation,
  openingConversationId
}: {
  reservations: UserBooking[];
  onAction: (id: number, action: "confirm" | "cancel" | "complete") => void;
  workingId?: number;
  onOpenConversation?: (booking: UserBooking) => void;
  openingConversationId?: number;
}) {
  if (!reservations.length) {
    return <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="No reservations yet" text="Reservations will appear here as soon as travelers request or confirm stays." />;
  }

  return (
    <div className="grid gap-3">
      {reservations.map((booking) => {
        const rawStatus = String(booking.statusRaw || booking.status).toLowerCase();
        const canConfirm = ["pending", "draft"].includes(rawStatus);
        const canCancel = ["pending", "confirmed"].includes(rawStatus);
        const canComplete = rawStatus === "confirmed";
        return (
          <article key={booking.id} className="rounded-[1.5rem] border border-line bg-surface-2 p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={reservationStatusTone(rawStatus)}>{booking.status}</Badge>
                  <Badge tone="neutral">{booking.bookingReference}</Badge>
                </div>
                <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-ink">{booking.propertyTitle || booking.propertyName}</h3>
                <p className="mt-1 text-sm font-semibold text-ink-soft">
                  {booking.guestName || "Guest"}{booking.guestEmail ? ` / ${booking.guestEmail}` : ""}
                </p>
                <p className="mt-2 text-sm font-bold text-muted">
                  {formatFriendlyDate(booking.checkIn || String(booking.payload?.checkIn || ""))} - {formatFriendlyDate(booking.checkOut || String(booking.payload?.checkOut || ""))} / {booking.nights} nights
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <p className="text-2xl font-semibold tracking-[-0.05em] text-ink">{currency(booking.total)}</p>
                <div className="flex flex-wrap gap-2 lg:justify-end">
                  {onOpenConversation ? (
                    <Button type="button" onClick={() => onOpenConversation(booking)} disabled={openingConversationId === booking.id || !booking.guestId}>
                      <MessageCircle className="h-4 w-4" /> {openingConversationId === booking.id ? "Opening..." : "Open conversation"}
                    </Button>
                  ) : null}
                  {canConfirm ? <Button type="button" onClick={() => onAction(booking.id, "confirm")} disabled={workingId === booking.id}>Accept reservation</Button> : null}
                  {canCancel ? <Button type="button" variant="secondary" onClick={() => onAction(booking.id, "cancel")} disabled={workingId === booking.id}>Cancel</Button> : null}
                  {canComplete ? <Button type="button" variant="secondary" onClick={() => onAction(booking.id, "complete")} disabled={workingId === booking.id}>Mark completed</Button> : null}
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function CalendarPanel({
  propertyId,
  properties,
  reservations,
  onPropertyChange,
  onReservationAction,
  workingId,
  onOpenConversation,
  openingConversationId
}: {
  propertyId?: number;
  properties: Property[];
  reservations: UserBooking[];
  onPropertyChange: (propertyId: number) => void;
  onReservationAction?: (id: number, action: "confirm" | "cancel" | "complete") => void;
  workingId?: number;
  onOpenConversation?: (booking: UserBooking) => void;
  openingConversationId?: number;
}) {
  const [month, setMonth] = useState(() => monthStartIso(todayIso()));
  const currentMonth = monthStartIso(todayIso());
  const canGoPrevious = addMonthsIso(month, -1) >= currentMonth;
  const calendarStart = month;
  const calendarEnd = addDaysIso(addMonthsIso(month, 2), -1);
  const dates = calendarGrid(month, 42);
  const [selectedReservation, setSelectedReservation] = useState<UserBooking | null>(null);
  const queryClient = useQueryClient();
  const calendarQuery = useQuery({
    queryKey: ["property-calendar", propertyId, calendarStart, calendarEnd],
    queryFn: () => getPropertyCalendar(propertyId as number, { start: calendarStart, end: calendarEnd }),
    enabled: Boolean(propertyId)
  });
  const rows = new globalThis.Map<string, { calendarDate: string; availableUnits: number; minNights: number; closed: boolean; priceOverride?: number | null }>((calendarQuery.data || []).map((row: { calendarDate: string; availableUnits: number; minNights: number; closed: boolean; priceOverride?: number | null }) => [row.calendarDate, row]));
  const updateCalendar = useMutation({
    mutationFn: (row: { calendarDate: string; availableUnits: number; minNights: number; closed: boolean; priceOverride?: number | null }) => updatePropertyCalendar(propertyId as number, [row]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["property-calendar", propertyId] })
  });
  const reservationsForProperty = reservations.filter((booking) => !propertyId || booking.propertyId === propertyId);
  return (
    <div className="premium-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeader kicker="Calendar" title="Month view with blocks, reservations, and price cues." />
        <div className="grid gap-3 sm:min-w-72">
          {properties.length ? (
            <select className="input-control max-w-full" value={propertyId || ""} onChange={(event) => onPropertyChange(Number(event.target.value))}>
              {properties.map((property) => <option key={property.id} value={property.id}>{property.title}</option>)}
            </select>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setMonth(addMonthsIso(month, -1))}
              className={cn("grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 transition hover:bg-surface-3", !canGoPrevious && "cursor-not-allowed opacity-40")}
              aria-label="Previous month"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
            </button>
            <div className="min-w-36 rounded-full bg-surface-2 px-4 py-2 text-center text-xs font-black text-ink">
              {calendarMonthLabel(month)}
            </div>
            <button
              type="button"
              onClick={() => setMonth(addMonthsIso(month, 1))}
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 transition hover:bg-surface-3"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="mt-5 overflow-x-auto overscroll-x-contain pb-2 [scrollbar-gutter:stable]">
        <div className="grid min-w-[620px] grid-cols-7 gap-2">
          {dates.map((date) => {
            const row = rows.get(date);
            const closed = row?.closed ?? false;
            const reservation = reservationsForProperty.find((booking) => {
              const checkIn = booking.checkIn || String(booking.payload?.checkIn || "");
              const checkOut = booking.checkOut || String(booking.payload?.checkOut || "");
              return checkIn <= date && date < checkOut;
            });
            const reservationStatus = String(reservation?.statusRaw || reservation?.status || "").toLowerCase();
            const accepted = ["confirmed", "checked_in", "checked-in"].includes(reservationStatus);
            return (
            <button
              key={date}
              type="button"
              onClick={() => reservation ? setSelectedReservation(reservation) : propertyId ? updateCalendar.mutate({ calendarDate: date, availableUnits: closed ? 1 : 0, minNights: row?.minNights || 1, closed: !closed, priceOverride: row?.priceOverride ?? null }) : undefined}
              className={cn(
                "min-h-20 rounded-2xl border border-line p-2 text-left text-xs font-bold transition hover:-translate-y-0.5",
                reservation
                  ? accepted
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning"
                  : closed ? "bg-error/10 text-error" : row?.priceOverride ? "bg-warning/10 text-warning" : "bg-surface-2 text-ink-soft"
              )}
            >
              <span>{new Date(`${date}T00:00:00`).getDate()}</span>
              <span className="mt-5 block truncate">{reservation ? `${accepted ? "Accepted" : "Request"} · ${bookingLabel(reservation)}` : closed ? "Blocked" : row?.priceOverride ? currency(row.priceOverride) : "Open"}</span>
            </button>
            );
          })}
        </div>
      </div>
      {selectedReservation ? (
        <div className="mt-5 rounded-[1.5rem] border border-line bg-surface-2 p-4">
          {(() => {
            const rawStatus = String(selectedReservation.statusRaw || selectedReservation.status).toLowerCase();
            const canConfirm = ["pending", "draft"].includes(rawStatus);
            const canCancel = ["pending", "confirmed"].includes(rawStatus);
            const canComplete = rawStatus === "confirmed";
            return (
              <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone={reservationStatusTone(selectedReservation.statusRaw || selectedReservation.status)}>{selectedReservation.status}</Badge>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-ink">{selectedReservation.propertyTitle || selectedReservation.propertyName}</h3>
              <p className="mt-1 text-sm font-semibold text-ink-soft">{selectedReservation.guestName || "Guest"}{selectedReservation.guestEmail ? ` / ${selectedReservation.guestEmail}` : ""}</p>
            </div>
            <p className="text-2xl font-semibold tracking-[-0.05em] text-ink">{currency(selectedReservation.total)}</p>
          </div>
          <p className="mt-3 text-sm font-bold text-muted">
            {formatFriendlyDate(selectedReservation.checkIn || String(selectedReservation.payload?.checkIn || ""))} - {formatFriendlyDate(selectedReservation.checkOut || String(selectedReservation.payload?.checkOut || ""))} / {selectedReservation.nights} nights
          </p>
          {onReservationAction && (canConfirm || canCancel || canComplete) ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {onOpenConversation ? (
                <Button type="button" onClick={() => onOpenConversation(selectedReservation)} disabled={openingConversationId === selectedReservation.id || !selectedReservation.guestId}>
                  <MessageCircle className="h-4 w-4" /> {openingConversationId === selectedReservation.id ? "Opening..." : "Open conversation"}
                </Button>
              ) : null}
              {canConfirm ? <Button type="button" onClick={() => { onReservationAction(selectedReservation.id, "confirm"); setSelectedReservation(null); }} disabled={workingId === selectedReservation.id}>Accept reservation</Button> : null}
              {canCancel ? <Button type="button" variant="secondary" onClick={() => { onReservationAction(selectedReservation.id, "cancel"); setSelectedReservation(null); }} disabled={workingId === selectedReservation.id}>Cancel / reject</Button> : null}
              {canComplete ? <Button type="button" variant="secondary" onClick={() => { onReservationAction(selectedReservation.id, "complete"); setSelectedReservation(null); }} disabled={workingId === selectedReservation.id}>Mark completed</Button> : null}
            </div>
          ) : null}
              </>
            );
          })()}
        </div>
      ) : null}
    </div>
  );
}

const onboardingStepMeta = [
  { title: "Basics", detail: "Choose the apartment type and set the first guest-facing positioning.", icon: Building2 },
  { title: "Location", detail: "Add the address, city, country, and neighborhood guests will evaluate.", icon: MapPin },
  { title: "Amenities", detail: "Select the features that help guests compare your place quickly.", icon: Sparkles },
  { title: "Photos", detail: "Upload real house photos and choose the image that leads the listing.", icon: Plus },
  { title: "Pricing", detail: "Set nightly price, cleaning fee, and simple revenue expectations.", icon: Wallet },
  { title: "Calendar", detail: "Prepare availability rules before travelers request dates.", icon: CalendarDays },
  { title: "Preview", detail: "Review the announcement as guests will see it in search and booking.", icon: BadgeCheck },
  { title: "Publish", detail: "Confirm the listing and send it to your host dashboard.", icon: Check }
] as const;

export function HostOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [listingDraft, setListingDraft] = useState({
    title: "",
    propertyType: "Apartment",
    city: "",
    country: "",
    address: "",
    neighborhood: "",
    latitude: 0,
    longitude: 0,
    pricePerNight: 1,
    cleaningFee: 0,
    serviceFee: 0,
    maxGuests: 1,
    bedrooms: 1,
    bathrooms: 1,
    beds: 1,
    description: "",
    image: imageManifest.properties.apartment,
    gallery: [imageManifest.properties.apartment],
    amenities: [] as string[],
  });
  const publishPayload = {
    ...listingDraft,
    title: listingDraft.title || `${listingDraft.propertyType} in ${listingDraft.city || "UBOOK"}`,
    description: listingDraft.description || `${listingDraft.propertyType} listing managed in UBOOK.`,
    country: listingDraft.country || "Morocco",
    city: listingDraft.city || "Marrakech",
    address: listingDraft.address || listingDraft.neighborhood || "Address pending",
    location: listingDraft.address || listingDraft.neighborhood || listingDraft.city || "Address pending",
    neighborhood: listingDraft.neighborhood || listingDraft.city || "Central",
  };
  const publish = useMutation({ mutationFn: () => createProperty(publishPayload), onSuccess: () => navigate("/host") });
  const property: Property = {
    id: 0,
    title: listingDraft.title || "Draft listing",
    type: listingDraft.propertyType,
    city: listingDraft.city,
    country: listingDraft.country,
    neighborhood: listingDraft.neighborhood,
    image: listingDraft.image,
    gallery: listingDraft.gallery,
    price: listingDraft.pricePerNight,
    rating: 0,
    reviews: 0,
    guests: listingDraft.maxGuests,
    bedrooms: listingDraft.bedrooms,
    bathrooms: listingDraft.bathrooms,
    host: "Host",
    hostAvatar: imageManifest.avatars.maya,
    hostSince: "",
    verified: false,
    tags: [],
    amenities: listingDraft.amenities,
    description: listingDraft.description,
    distance: listingDraft.address,
    availability: "Draft",
    lat: listingDraft.latitude,
    lng: listingDraft.longitude,
  };
  const currentStep = onboardingStepMeta[step] || onboardingStepMeta[0];
  const CurrentStepIcon = currentStep.icon;
  const readiness = [
    { label: "Guest-facing title", complete: Boolean(listingDraft.title.trim()) },
    { label: "Location details", complete: Boolean(listingDraft.city.trim() && (listingDraft.address.trim() || listingDraft.neighborhood.trim())) },
    { label: "At least one uploaded photo", complete: listingDraft.gallery.some((image) => image !== imageManifest.properties.apartment) },
    { label: "Amenities selected", complete: listingDraft.amenities.length >= 3 },
    { label: "Real nightly price", complete: listingDraft.pricePerNight > 1 },
    { label: "Description added", complete: Boolean(listingDraft.description.trim()) }
  ];
  const completedReadiness = readiness.filter((item) => item.complete).length;
  const progress = Math.round(((step + 1) / onboardingSteps.length) * 100);
  return (
    <MotionPage>
      <main className="min-h-screen overflow-x-hidden bg-canvas">
        <div className="page-shell max-w-full overflow-x-hidden py-5 sm:py-6">
          <header className="sticky top-0 z-30 -mx-4 flex items-center justify-between gap-4 border-b border-line bg-canvas/88 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-[1.5rem] sm:border sm:bg-surface/80 sm:px-5">
            <BrandMark />
            <div className="flex items-center gap-2">
              <LinkButton to="/host" variant="secondary">Exit wizard</LinkButton>
              <Button onClick={() => step === onboardingSteps.length - 1 ? publish.mutate() : setStep((value) => Math.min(onboardingSteps.length - 1, value + 1))} disabled={publish.isPending}>
                {step === onboardingSteps.length - 1 ? "Publish" : "Continue"}
              </Button>
            </div>
          </header>
          <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
            <aside className="h-fit overflow-hidden rounded-[1.75rem] border border-line bg-surface p-4 shadow-soft sm:p-5 xl:sticky xl:top-6">
              <Badge tone="primary"><Plus className="h-3.5 w-3.5" /> Apartment onboarding</Badge>
              <h1 className="h3-type mt-4">Build a listing guests can trust.</h1>
              <p className="mt-3 text-sm font-semibold leading-6 text-ink-soft">A focused workflow for photos, price, address, calendar, and the details travelers check before requesting dates.</p>
              <div className="mt-5 rounded-[1.35rem] bg-surface-2 p-4">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.16em] text-muted">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-surface">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="mt-5 grid max-h-[54vh] gap-2 overflow-y-auto pr-1 xl:max-h-none">
                {onboardingStepMeta.map((item, index) => {
                  const StepIcon = item.icon;
                  const active = step === index;
                  const complete = index < step;
                  return (
                    <button key={item.title} type="button" onClick={() => setStep(index)} className={cn("flex items-start gap-3 rounded-2xl p-3 text-left transition", active ? "bg-primary text-primary-ink shadow-soft" : "bg-surface-2 text-ink-soft hover:bg-surface-3 hover:text-ink")}>
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", active ? "bg-white/20" : complete ? "bg-success/10 text-success" : "bg-surface text-ink-soft")}>
                        {complete ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-black">{item.title}</span>
                        <span className={cn("mt-1 block text-xs font-semibold leading-5", active ? "text-white/75" : "text-muted")}>{item.detail}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
            <section className="premium-panel min-w-0 overflow-hidden p-4 sm:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><CurrentStepIcon className="h-5 w-5" /></span>
                    <p className="caption-type">Step {step + 1} of {onboardingSteps.length}</p>
                  </div>
                  <h2 className="h2-type mt-4">{currentStep.title}</h2>
                  <p className="body-type mt-3 max-w-3xl">{currentStep.detail}</p>
                </div>
                <Badge tone={completedReadiness >= 5 ? "success" : "warning"}>{completedReadiness}/6 ready</Badge>
              </div>
              <div className="mt-8 min-w-0 rounded-[1.5rem] bg-surface/70 p-4 sm:p-5">
                {step === 0 ? <TypeSelection value={listingDraft.propertyType} onSelect={(propertyType) => setListingDraft((draft) => ({ ...draft, propertyType }))} /> : null}
                {step === 1 ? <AddressStep value={listingDraft} onChange={setListingDraft} /> : null}
                {step === 2 ? <AmenityStep selected={listingDraft.amenities} onToggle={(amenity) => setListingDraft((draft) => ({ ...draft, amenities: draft.amenities.includes(amenity) ? draft.amenities.filter((item) => item !== amenity) : [...draft.amenities, amenity] }))} /> : null}
                {step === 3 ? <PhotoStep property={property} onChange={setListingDraft} /> : null}
                {step === 4 ? <PricingWizardStep value={listingDraft} onChange={setListingDraft} /> : null}
                {step === 5 ? <AvailabilityStep /> : null}
                {step === 6 ? <PreviewWizard property={property} /> : null}
                {step === 7 ? <PublishStep property={property} onPublish={() => publish.mutate()} publishing={publish.isPending} /> : null}
              </div>
              {publish.isError ? <div className="mt-5 rounded-2xl bg-error/10 p-4 text-sm font-semibold text-error">{getApiErrorMessage(publish.error, "Could not publish listing")}</div> : null}
              <div className="mt-8 flex flex-col justify-between gap-3 border-t border-line pt-5 sm:flex-row">
                <Button variant="secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>Back</Button>
                <Button onClick={() => step === onboardingSteps.length - 1 ? publish.mutate() : setStep((value) => Math.min(onboardingSteps.length - 1, value + 1))} disabled={publish.isPending}>{step === onboardingSteps.length - 1 ? "Publish listing" : "Continue"}</Button>
              </div>
            </section>
            <aside className="grid h-fit gap-5 xl:sticky xl:top-6">
              <OnboardingPreview property={property} readiness={readiness} />
            </aside>
          </div>
        </div>
      </main>
    </MotionPage>
  );
}

function OnboardingPreview({
  property,
  readiness
}: {
  property: Property;
  readiness: Array<{ label: string; complete: boolean }>;
}) {
  const completeCount = readiness.filter((item) => item.complete).length;

  return (
    <>
      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-soft">
        <div className="relative">
          <img src={property.image} alt={property.title} className="aspect-[16/11] w-full object-cover" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            <Badge tone="primary">Live preview</Badge>
            <Badge tone={completeCount >= 5 ? "success" : "warning"}>{completeCount}/6 ready</Badge>
          </div>
        </div>
        <div className="p-5">
          <p className="caption-type">{property.type || "Apartment"} listing</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-ink">{property.title}</h3>
          <p className="mt-2 text-sm font-bold text-ink-soft">{property.neighborhood || property.city || "Location pending"} / {property.guests} guests / {property.bedrooms} bedrooms</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="caption-type">Nightly</p>
              <p className="mt-1 text-xl font-semibold text-ink">{currency(property.price)}</p>
            </div>
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="caption-type">Photos</p>
              <p className="mt-1 text-xl font-semibold text-ink">{property.gallery.length}</p>
            </div>
          </div>
          <p className="mt-5 text-sm font-semibold leading-6 text-ink-soft">{property.description || "Add a concise description that tells guests what makes this apartment comfortable, practical, and easy to book."}</p>
        </div>
      </div>
      <div className="rounded-[1.75rem] border border-line bg-surface p-5 shadow-soft">
        <SectionHeader kicker="Publish readiness" title="Before guests can book." />
        <div className="mt-5 grid gap-3">
          {readiness.map((item) => <StatusRow key={item.label} label={item.label} tone={item.complete ? "success" : "warning"} />)}
        </div>
      </div>
    </>
  );
}

function TypeSelection({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{propertyTypeOptions.filter((item) => item !== "All").map((item) => <button key={item} type="button" onClick={() => onSelect(item)} className={cn("rounded-[1.5rem] border border-line bg-surface-2 p-5 text-left transition hover:-translate-y-0.5 hover:shadow-soft", value === item && "border-primary bg-primary/10 ring-2 ring-primary/20")}><Building2 className="h-5 w-5 text-primary" /><h3 className="mt-5 text-xl font-semibold">{item}</h3><p className="mt-2 text-sm leading-6 text-ink-soft">Use this property type for the listing.</p></button>)}</div>;
}

function AddressStep({ value, onChange }: { value: { title: string; address: string; city: string; country: string; neighborhood: string; description: string }; onChange: (value: any) => void }) {
  const update = (key: keyof typeof value, nextValue: string) => onChange((draft: typeof value) => ({ ...draft, [key]: nextValue }));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="md:col-span-2"><span className="caption-type">Apartment title</span><input className="input-control mt-2" value={value.title} onChange={(event) => update("title", event.target.value)} placeholder="Sunny apartment near the old town" /></label>
      <label><span className="caption-type">Address</span><input className="input-control mt-2" value={value.address} onChange={(event) => update("address", event.target.value)} /></label>
      <label><span className="caption-type">City</span><input className="input-control mt-2" value={value.city} onChange={(event) => update("city", event.target.value)} /></label>
      <label><span className="caption-type">Country</span><input className="input-control mt-2" value={value.country} onChange={(event) => update("country", event.target.value)} /></label>
      <label><span className="caption-type">Neighborhood</span><input className="input-control mt-2" value={value.neighborhood} onChange={(event) => update("neighborhood", event.target.value)} /></label>
      <label className="md:col-span-2"><span className="caption-type">Guest-facing description</span><textarea className="input-control mt-2 min-h-32 py-4" value={value.description} onChange={(event) => update("description", event.target.value)} placeholder="Describe the light, sleeping setup, arrival experience, work area, and what guests can walk to nearby." /></label>
    </div>
  );
}

function AmenityStep({ selected, onToggle }: { selected: string[]; onToggle: (value: string) => void }) {
  return <div className="grid gap-3 md:grid-cols-3">{amenityOptions.map((item) => <label key={item} className="rounded-2xl bg-surface-2 p-4 text-sm font-bold"><input className="mr-3" type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} />{item}</label>)}</div>;
}

function PhotoStep({ property, onChange }: { property: Property; onChange: (value: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState("");
  const gallery = property.gallery.length ? property.gallery : [property.image];

  const applyImages = (urls: string[]) => {
    const cleanUrls = urls.map((url) => url.trim()).filter(Boolean);
    if (!cleanUrls.length) return;
    onChange((draft: { image: string; gallery: string[] }) => {
      const isDefaultOnly = draft.gallery.length === 1 && draft.gallery[0] === imageManifest.properties.apartment;
      const baseGallery = isDefaultOnly ? [] : draft.gallery;
      const nextGallery = [...baseGallery, ...cleanUrls].filter((url, index, values) => values.indexOf(url) === index);
      return {
        ...draft,
        image: isDefaultOnly || !draft.image ? cleanUrls[0] : draft.image,
        gallery: nextGallery,
      };
    });
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    setError("");
    try {
      const uploaded = [];
      for (const file of Array.from(files)) {
        const result = await uploadImage(file);
        uploaded.push(result.url);
      }
      applyImages(uploaded);
    } catch (uploadError) {
      setError(getApiErrorMessage(uploadError, "Could not upload one of the photos."));
    } finally {
      setUploading(false);
    }
  };

  const addUrl = () => {
    if (!photoUrl.trim()) return;
    applyImages([photoUrl]);
    setPhotoUrl("");
  };

  const setCover = (url: string) => {
    onChange((draft: { gallery: string[] }) => ({ ...draft, image: url, gallery: [url, ...draft.gallery.filter((item) => item !== url)] }));
  };

  const removeImage = (url: string) => {
    onChange((draft: { image: string; gallery: string[] }) => {
      const nextGallery = draft.gallery.filter((item) => item !== url);
      const fallback = nextGallery[0] || imageManifest.properties.apartment;
      return { ...draft, image: draft.image === url ? fallback : draft.image, gallery: nextGallery.length ? nextGallery : [fallback] };
    });
  };

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="min-w-0">
        <img src={property.image} alt={property.title} className="aspect-[16/11] w-full rounded-[1.5rem] object-cover shadow-soft" />
        <div className="mt-4 rounded-[1.5rem] border border-line bg-surface-2 p-4">
          <p className="caption-type">Cover photo</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-ink-soft">This is the first image guests see on search, property details, and reservation cards.</p>
        </div>
      </div>
      <div className="grid content-start gap-4">
        <div className="rounded-[1.5rem] border border-line bg-surface-2 p-4">
          <label className="grid cursor-pointer place-items-center rounded-[1.25rem] border border-dashed border-primary/40 bg-primary/10 px-4 py-6 text-center text-primary transition hover:bg-primary/15">
            <Plus className="h-5 w-5" />
            <span className="mt-2 font-bold">{uploading ? "Uploading photos..." : "Upload house photos"}</span>
            <span className="mt-1 text-xs font-semibold text-ink-soft">Upload any common house photo. UBOOK rotates and optimizes it for the listing.</span>
            <input className="sr-only" type="file" accept="image/*,.heic,.heif,.avif,.tif,.tiff,.bmp" multiple disabled={uploading} onChange={(event) => handleUpload(event.target.files)} />
          </label>
          <div className="mt-4 flex gap-2">
            <input className="input-control flex-1" value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="Paste image URL" />
            <Button type="button" variant="secondary" onClick={addUrl}>Add</Button>
          </div>
          {error ? <div className="mt-3 rounded-2xl bg-error/10 p-3 text-sm font-semibold text-error">{error}</div> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {gallery.slice(0, 8).map((image) => (
            <div key={image} className={cn("group relative overflow-hidden rounded-[1.25rem] border", image === property.image ? "border-primary ring-2 ring-primary/20" : "border-line")}>
              <img src={image} alt={property.title} className="h-36 w-full object-cover" />
              <div className="absolute inset-x-2 bottom-2 flex gap-2">
                <Button type="button" className="min-h-9 flex-1 px-3 text-xs" onClick={() => setCover(image)} disabled={image === property.image}>
                  {image === property.image ? "Cover" : "Set cover"}
                </Button>
                <button type="button" onClick={() => removeImage(image)} className="grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-soft transition hover:bg-error hover:text-white" aria-label="Remove photo">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PricingWizardStep({ value, onChange }: { value: { pricePerNight: number; cleaningFee: number; serviceFee: number }; onChange: (value: any) => void }) {
  const update = (key: keyof typeof value, nextValue: string) => onChange((draft: typeof value) => ({ ...draft, [key]: Number(nextValue) || 0 }));
  return <div className="grid gap-5 lg:grid-cols-2"><div className="grid gap-4"><label><span className="caption-type">Nightly rate</span><input className="input-control mt-2" type="number" value={value.pricePerNight} onChange={(event) => update("pricePerNight", event.target.value)} /></label><label><span className="caption-type">Cleaning fee</span><input className="input-control mt-2" type="number" value={value.cleaningFee} onChange={(event) => update("cleaningFee", event.target.value)} /></label><label><span className="caption-type">Monthly discount</span><input className="input-control mt-2" type="number" value={value.serviceFee} onChange={(event) => update("serviceFee", event.target.value)} /></label></div><ChartPanel title="Earnings preview"><RevenueChart data={[]} /></ChartPanel></div>;
}

function AvailabilityStep() {
  return <div className="grid gap-4 md:grid-cols-3">{["Instant booking", "Request to book", "Block selected dates", "Weekend premium", "Monthly stays", "Minimum 2 nights"].map((item) => <button key={item} className="rounded-[1.5rem] border border-line bg-surface-2 p-5 text-left font-bold">{item}</button>)}</div>;
}

function PreviewWizard({ property }: { property: Property }) {
  return <PropertyCard property={property} featured />;
}

function PublishStep({ property, onPublish, publishing }: { property: Property; onPublish: () => void; publishing: boolean }) {
  return <div className="text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success"><Check className="h-8 w-8" /></div><h2 className="h2-type mt-5">Ready to publish.</h2><p className="body-type mx-auto mt-4 max-w-xl">{property.title} has pricing, photos, availability, and trust signals ready for traveler review.</p><Button onClick={onPublish} disabled={publishing} className="mt-6">Publish listing</Button></div>;
}

export function AdminDashboard() {
  const statsQuery = useQuery({ queryKey: ["admin-stats"], queryFn: getAdminStats });
  const usersQuery = useQuery({ queryKey: ["admin-users"], queryFn: getAdminUsers });
  const listingsQuery = useQuery({ queryKey: ["admin-listings"], queryFn: getAdminListings });
  const reportsQuery = useQuery({ queryKey: ["admin-reports"], queryFn: getAdminReports });
  const supportQuery = useQuery({ queryKey: ["admin-support"], queryFn: getAdminSupportTickets });
  const riskQuery = useQuery({ queryKey: ["admin-risk"], queryFn: getAdminRiskEvents });
  const stats = statsQuery.data as AdminStats | undefined;
  const metrics = (stats?.metrics || []).map(toMetric);
  const adminUsers = (usersQuery.data || []).map((user) => ({
    name: String(user.fullName || user.name || ""),
    email: String(user.email || ""),
    role: String(user.role || ""),
    status: user.isActive === false ? "Review" : "Active",
    risk: user.bannedAt ? "High" : user.suspendedAt ? "Medium" : "Low",
  }));
  const listings = (listingsQuery.data || []).map(toExperienceProperty);
  const moderationQueue = [
    ...(reportsQuery.data || []).map((item) => ({ title: `Report #${item.id}`, owner: String(item.targetType || "report"), severity: "Medium", sla: String(item.status || "open") })),
    ...(supportQuery.data || []).map((item) => ({ title: String(item.subject || `Support #${item.id}`), owner: String(item.category || "support"), severity: item.priority === "high" ? "High" : "Low", sla: String(item.status || "open") })),
    ...(riskQuery.data || []).map((item) => ({ title: String(item.signalType || `Risk #${item.id}`), owner: String(item.entityType || "risk"), severity: item.severity === "high" ? "High" : "Medium", sla: String(item.status || "open") })),
  ];
  const chartData = [{ month: "Live", revenue: Math.round(stats?.revenueMetrics?.grossRevenue || 0), occupancy: stats?.propertyMetrics?.occupancyRate || 0, conversion: stats?.bookingMetrics?.confirmed || 0 }];
  const sourceData = [
    { name: "Bookings", value: stats?.bookingMetrics?.total || 0 },
    { name: "Users", value: stats?.userMetrics?.total || 0 },
    { name: "Listings", value: stats?.propertyMetrics?.total || 0 },
  ];
  const userColumns = useMemo<ColumnDef<(typeof adminUsers)[number]>[]>(() => [
    { accessorKey: "name", header: "User" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "role", header: "Role" },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <Badge tone={getValue() === "Dispute" ? "error" : getValue() === "Review" ? "warning" : "success"}>{String(getValue())}</Badge> },
    { accessorKey: "risk", header: "Risk", cell: ({ getValue }) => <Badge tone={getValue() === "High" ? "error" : getValue() === "Medium" ? "warning" : "success"}>{String(getValue())}</Badge> }
  ], []);
  return (
    <WorkspaceShell role="admin" title="Platform operations" subtitle="A premium control plane for revenue, growth, active users, active hosts, bookings, payments, moderation, fraud, support, and reporting." action={<Button variant="secondary"><MoreHorizontal className="h-4 w-4" /> Command</Button>}>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartPanel title="Platform revenue"><RevenueChart data={chartData} /></ChartPanel>
        <ChartPanel title="Booking sources"><SourceChart data={sourceData} /></ChartPanel>
      </section>
      <section id="users" className="mt-8 grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="premium-card p-5">
          <SectionHeader kicker="User management" title="Role-aware user review." />
          <div className="mt-5"><DataTable data={adminUsers} columns={userColumns} /></div>
        </div>
        <div className="premium-card p-5">
          <SectionHeader kicker="Moderation" title="Action queue." />
          <div className="mt-5 grid gap-3">
            {moderationQueue.map((item) => <div key={item.title} className="rounded-2xl bg-surface-2 p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold text-ink">{item.title}</p><Badge tone={item.severity === "High" ? "error" : item.severity === "Medium" ? "warning" : "neutral"}>{item.severity}</Badge></div><p className="mt-2 text-sm font-semibold text-ink-soft">{item.owner} / SLA {item.sla}</p></div>)}
          </div>
        </div>
      </section>
      <section id="properties" className="mt-8">
        <SectionHeader kicker="Property moderation" title="Listings reviewed in marketplace context." />
        <div className="mt-6 grid gap-5 md:grid-cols-3">{listings.slice(0, 3).map((property) => <PropertyCard key={property.id} property={property} />)}</div>
      </section>
      <section id="bookings" className="mt-8 grid gap-6 lg:grid-cols-2">
        <ChartPanel title="Occupancy and conversion"><OccupancyChart data={chartData} /></ChartPanel>
        <div className="premium-card p-5">
          <SectionHeader kicker="Platform health" title="Operational checks." />
          <div className="mt-5 grid gap-3">
            <StatusRow label="Fraud detection model online" tone="success" />
            <StatusRow label="Payment monitoring healthy" tone="success" />
            <StatusRow label="Dispute response SLA" tone="warning" />
            <StatusRow label="Support backlog" tone="success" />
          </div>
        </div>
      </section>
    </WorkspaceShell>
  );
}

export function MessagesPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const conversationsQuery = useQuery({ queryKey: ["conversations"], queryFn: getConversations });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const currentUser = userQuery.data as (AuthUserLike & { id?: number }) | undefined;
  const currentUserId = currentUser?.id ?? null;
  const shellRole = normalizedWorkspaceRole(currentUser?.role || currentUser?.rawRole || currentUser?.raw_role).toLowerCase() as WorkspaceRole;
  const conversations = (conversationsQuery.data || []).map((conversation) => toConversation(conversation as ApiConversation & Record<string, unknown>, currentUserId));
  const requestedConversationId = Number(searchParams.get("conversation") || 0);
  useEffect(() => {
    if (requestedConversationId > 0 && requestedConversationId !== activeId) {
      setActiveId(requestedConversationId);
    }
  }, [requestedConversationId, activeId]);
  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [activeId, conversations]);
  const activeQuery = useQuery({ queryKey: ["conversation", activeId], queryFn: () => getConversation(activeId as number), enabled: Boolean(activeId) });
  const active = activeQuery.data ? toConversation(activeQuery.data as ApiConversation & Record<string, unknown>, currentUserId) : conversations[0];
  const send = useMutation({
    mutationFn: () => sendMessage(activeId as number, draft),
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["conversation", activeId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    }
  });
  useEffect(() => {
    if (activeId) markConversationRead(activeId).then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] })).catch(() => undefined);
  }, [activeId, queryClient]);
  if (!active) {
    return (
      <WorkspaceShell role={shellRole} title="Messages" subtitle="A modern conversation workspace with attachments, read receipts, booking context, notifications, and role-aware thread state.">
        <section className="premium-card p-5">No conversations yet.</section>
      </WorkspaceShell>
    );
  }
  return (
    <WorkspaceShell role={shellRole} title="Messages" subtitle="A modern conversation workspace with attachments, read receipts, booking context, notifications, and role-aware thread state.">
      <section className="grid min-h-[calc(100vh-180px)] min-w-0 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="premium-card min-w-0 p-4">
          <div className="flex items-center justify-between">
            <h2 className="h4-type">Conversations</h2>
            <Badge tone="primary">{conversations.reduce((sum, item) => sum + item.unread, 0)} unread</Badge>
          </div>
          <div className="mt-5 grid max-h-[62vh] gap-2 overflow-y-auto pr-1">
            {conversations.map((thread) => (
              <button key={thread.id} type="button" onClick={() => setActiveId(thread.id)} className={cn("rounded-[1.25rem] p-4 text-left transition", activeId === thread.id ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-soft hover:bg-surface-3")}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{thread.person}</p>
                  {thread.unread ? <span className="grid h-6 w-6 place-items-center rounded-full bg-white/20 text-xs">{thread.unread}</span> : null}
                </div>
                <p className="mt-1 text-sm font-semibold opacity-80">{thread.property}</p>
              </button>
            ))}
          </div>
        </aside>
        <article className="premium-card flex min-w-0 flex-col overflow-hidden">
          <div className="border-b border-line p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="caption-type">{active.role}</p>
                <h2 className="h4-type mt-1">{active.person}</h2>
              </div>
              <Badge tone={active.status === "Online" ? "success" : active.status === "Away" ? "warning" : "neutral"}>{active.status}</Badge>
            </div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto bg-surface-2 p-5">
            {active.messages.map((message, index) => (
              <div key={`${message.time}-${index}`} className={cn("flex", message.from === "me" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[78%] rounded-[1.5rem] px-4 py-3 text-sm font-semibold leading-6 shadow-soft", message.from === "me" ? "bg-primary text-primary-ink" : "bg-surface text-ink-soft")}>
                  <p>{message.body}</p>
                  <p className="mt-2 text-[11px] opacity-70">{message.time}{message.read ? " / read" : ""}</p>
                </div>
              </div>
            ))}
          </div>
          <form className="flex flex-col gap-3 border-t border-line p-4 sm:flex-row" onSubmit={(event) => { event.preventDefault(); if (draft.trim()) send.mutate(); }}>
            <input className="input-control flex-1" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply..." />
            <Button type="submit" disabled={send.isPending}><Send className="h-4 w-4" /> Send</Button>
          </form>
        </article>
        <aside className="premium-card min-w-0 p-5">
          <SectionHeader kicker="Activity center" title="Thread context." />
          <div className="mt-5 grid gap-3">
            <StatusRow label={`Property: ${active.property}`} tone="success" />
            <StatusRow label="Attachments enabled" tone="success" />
            <StatusRow label="Read receipts active" tone="success" />
            <StatusRow label="Booking timeline synced" tone="success" />
          </div>
        </aside>
      </section>
    </WorkspaceShell>
  );
}
