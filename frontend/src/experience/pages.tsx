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
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
  ResponsiveContainer,
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
  Reservation,
  testimonialsFromProperties,
  toChartData,
  toConversation,
  toExperienceProperty,
  toMetric,
  toReservation,
  trustOptions,
  WorkspaceRole
} from "./dynamic";
import {
  confirmPayment,
  createBooking,
  createPayment,
  createProperty,
  createSavedSearch,
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
  getPropertyCalendar,
  getHostDashboard,
  getProperties,
  getPropertyById,
  getSavedSearches,
  getTravelerDashboard,
  login,
  logout,
  markConversationRead,
  register,
  sendMessage,
  updatePropertyCalendar,
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
  TravelerDashboard as ApiTravelerDashboard,
  UserBooking
  
} from "../types/api";

const navByRole = {
  traveler: [
    { label: "Home", href: "/dashboard", icon: Home },
    { label: "Explore", href: "/search", icon: Search },
    { label: "Trips", href: "/dashboard#trips", icon: Plane },
    { label: "Wishlist", href: "/dashboard#wishlist", icon: Heart },
    { label: "Messages", href: "/messages", icon: MessageCircle },
    { label: "Payments", href: "/dashboard#payments", icon: CreditCard },
    { label: "Reviews", href: "/dashboard#reviews", icon: Star },
    { label: "Profile", href: "/dashboard#profile", icon: UserRound },
    { label: "Settings", href: "/dashboard#settings", icon: Settings }
  ],
  host: [
    { label: "Dashboard", href: "/host", icon: LayoutDashboard },
    { label: "Listings", href: "/host#listings", icon: Building2 },
    { label: "Reservations", href: "/host#reservations", icon: CalendarDays },
    { label: "Calendar", href: "/host#calendar", icon: CalendarDays },
    { label: "Messages", href: "/messages", icon: MessageCircle },
    { label: "Earnings", href: "/host#earnings", icon: Wallet },
    { label: "Reviews", href: "/host#reviews", icon: Star },
    { label: "Analytics", href: "/host#analytics", icon: LineChart },
    { label: "Settings", href: "/host#settings", icon: Settings }
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
const sourceColors = ["#E86D4A", "#2F8F83", "#1F2937", "#D89A24"];

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
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-bold transition duration-200 ease-premium disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-ink shadow-soft hover:-translate-y-0.5 hover:shadow-lift",
        variant === "secondary" && "border border-line bg-surface text-ink hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft",
        variant === "ghost" && "text-ink-soft hover:bg-surface-2 hover:text-ink",
        className
      )}
    />
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
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-[13px] font-bold transition duration-200 ease-premium",
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

function PublicNav() {
  const [open, setOpen] = useState(false);
  const links = [
    ["Explore", "/search"],
    ["Traveler", "/dashboard"],
    ["Host", "/host"],
    ["Admin", "/admin"]
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
      <div className="page-shell flex h-20 items-center justify-between gap-4">
        <BrandMark />
        <nav className="hidden items-center gap-1 rounded-full border border-line bg-surface p-1 lg:flex">
          {links.map(([label, href]) => (
            <Link key={label} to={href} className="rounded-full px-4 py-2 text-sm font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle />
          <LinkButton to="/login" variant="secondary">Log in</LinkButton>
          <LinkButton to="/register">Get started</LinkButton>
        </div>
        <button className="rounded-full border border-line bg-surface p-3 lg:hidden" type="button" onClick={() => setOpen((value) => !value)} aria-label="Open navigation">
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
                <Link key={label} to={href} className="rounded-2xl px-4 py-3 text-sm font-bold text-ink-soft hover:bg-surface-2">
                  {label}
                </Link>
              ))}
              <div className="flex gap-2 pt-2">
                <LinkButton to="/login" variant="secondary" className="flex-1">Log in</LinkButton>
                <LinkButton to="/register" className="flex-1">Get started</LinkButton>
              </div>
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
            UBOOK is a premium marketplace for verified short stays, student housing, shared rooms, and host-operated accommodation.
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
        "grid gap-3 rounded-[2rem] border border-line bg-surface p-3 shadow-lift",
        compact ? "lg:grid-cols-[1fr_140px_140px_120px_auto]" : "lg:grid-cols-[1.4fr_1fr_1fr_0.8fr_auto]"
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
  return (
    <motion.article
      whileHover={{ y: -6 }}
      transition={{ duration: 0.22, ease: easing }}
      className={cn("group overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-soft", featured && "lg:grid lg:grid-cols-[1.08fr_0.92fr]")}
    >
      <Link to={`/property/${property.id}`} className="block overflow-hidden">
        <img src={property.image} alt={property.title} className={cn("w-full object-cover transition duration-700 group-hover:scale-105", featured ? "aspect-[4/3] lg:h-full" : "aspect-[4/3]")} />
      </Link>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Badge tone={property.verified ? "success" : "warning"}>{property.verified ? "Verified" : "Reviewing"}</Badge>
            <Link to={`/property/${property.id}`} className="mt-3 block text-xl font-semibold tracking-[-0.04em] text-ink">
              {property.title}
            </Link>
            <p className="mt-1 text-sm font-semibold text-ink-soft">{property.neighborhood}, {property.city}</p>
          </div>
          <button className="rounded-full border border-line p-2 text-ink-soft transition hover:bg-primary hover:text-primary-ink" type="button" aria-label="Save property">
            <Heart className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 line-clamp-2 text-sm leading-6 text-ink-soft">{property.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {property.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold text-ink-soft">{tag}</span>
          ))}
        </div>
        <div className="mt-5 flex items-end justify-between gap-4 border-t border-line pt-4">
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
    <div className="premium-card p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="caption-type">{metric.label}</p>
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            metric.tone === "success" && "bg-success",
            metric.tone === "warning" && "bg-warning",
            metric.tone === "accent" && "bg-accent",
            metric.tone === "primary" && "bg-primary",
            metric.tone === "neutral" && "bg-muted"
          )}
        />
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-[-0.06em] text-ink">{metric.value}</p>
      <p className="mt-2 text-sm font-semibold text-ink-soft">{metric.delta}</p>
    </div>
  );
}

function ChartPanel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="premium-card p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold tracking-[-0.035em] text-ink">{title}</h3>
        {action}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function RevenueChart({ data }: { data: Array<{ month: string; revenue: number; occupancy: number; conversion: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
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
    </ResponsiveContainer>
  );
}

function OccupancyChart({ data }: { data: Array<{ month: string; revenue: number; occupancy: number; conversion: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid stroke="hsl(var(--line))" vertical={false} />
        <XAxis dataKey="month" stroke="hsl(var(--muted))" tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted))" tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid hsl(var(--line))" }} />
        <Bar dataKey="occupancy" fill="hsl(var(--accent))" radius={[12, 12, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SourceChart({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={86} innerRadius={52} paddingAngle={5}>
          {data.map((item, index) => (
            <Cell key={item.name} fill={sourceColors[index % sourceColors.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ borderRadius: 16, border: "1px solid hsl(var(--line))" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function DataTable<TData extends object>({ data, columns }: { data: TData[]; columns: ColumnDef<TData>[] }) {
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
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
  const nav = navByRole[role];
  const roleLabel = role === "traveler" ? "Traveler" : role === "host" ? "Host" : "Admin";

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <MotionPage>
      <div className="min-h-screen bg-canvas text-[14px]">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-[236px] overflow-y-auto border-r border-line bg-surface/90 px-3 py-4 backdrop-blur-xl lg:block">
          <BrandMark />
          <div className="mt-6 rounded-[1.25rem] bg-surface-2 p-3">
            <p className="caption-type">{roleLabel} workspace</p>
            <p className="mt-2 text-xs font-semibold leading-5 text-ink-soft">A role-specific command center.</p>
          </div>
          <nav className="mt-5 grid gap-1">
            {nav.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} to={item.href} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-5 border-t border-line pt-4">
            <Button type="button" variant="ghost" onClick={handleSignOut} className="w-full justify-start rounded-xl px-3 py-2.5 text-[13px]">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>
        <div className="lg:pl-[236px]">
          <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur-xl">
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 sm:px-5 lg:px-6">
              <div className="min-w-0">
                <p className="caption-type">{roleLabel}</p>
                <h1 className="truncate text-lg font-semibold tracking-[-0.04em] text-ink sm:text-xl">{title}</h1>
              </div>
              <div className="hidden items-center gap-2 md:flex">
                <LinkButton to="/dashboard" variant="ghost">Traveler</LinkButton>
                <LinkButton to="/host" variant="ghost">Host</LinkButton>
                <LinkButton to="/admin" variant="ghost">Admin</LinkButton>
                <ThemeToggle />
                <Button type="button" variant="secondary" onClick={handleSignOut} className="min-h-9 px-3">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
                {action}
              </div>
              <button className="rounded-full border border-line bg-surface p-3 lg:hidden" type="button" onClick={() => setMobileNav(true)} aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </header>
          <main className="px-4 py-5 sm:px-5 lg:px-6">
            <div className="mb-5 max-w-4xl">
              <p className="body-type">{subtitle}</p>
            </div>
            {children}
          </main>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/92 px-2 py-1.5 backdrop-blur-xl lg:hidden">
          <div className="grid grid-cols-5 gap-1">
            {nav.slice(0, 5).map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} to={item.href} className="flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold text-ink-soft">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <AnimatePresence>
          {mobileNav ? (
            <motion.div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.aside
                className="h-full w-[86vw] max-w-sm bg-surface p-5"
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
                <nav className="mt-8 grid gap-2">
                  {nav.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.label} to={item.href} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm font-bold text-ink-soft" onClick={() => setMobileNav(false)}>
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                  <Button type="button" variant="secondary" onClick={handleSignOut} className="mt-2 w-full justify-start rounded-2xl">
                    <LogOut className="h-4 w-4" />
                    Sign out
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
  const featured = properties.slice(0, 4);
  const categories = categoryData(properties);
  const testimonials = testimonialsFromProperties(apiProperties);
  const averageRating = properties.length ? (properties.reduce((sum, property) => sum + property.rating, 0) / properties.length).toFixed(1) : "0.0";
  const heroStats = [
    [String(properties.filter((property) => property.verified).length), "verified stays"],
    [`${averageRating}/5`, "average stay rating"],
    [String(properties.reduce((sum, property) => sum + property.reviews, 0)), "verified reviews"]
  ];
  return (
    <MotionPage>
      <div className="ambient-wash min-h-screen">
        <PublicNav />
        <section className="page-shell grid min-h-[calc(100vh-5rem)] items-center gap-10 py-12 lg:grid-cols-[1.02fr_0.98fr]">
          <div>
            <Badge tone="primary"><Sparkles className="h-3.5 w-3.5" /> Global launch system 2026</Badge>
            <h1 className="display-type mt-6 max-w-5xl">The safer way to book every kind of stay.</h1>
            <p className="body-type mt-6 max-w-2xl text-lg">
              UBOOK combines hospitality-grade trust, fast marketplace search, student housing depth, and host business tooling in one premium product ecosystem.
            </p>
            <div className="mt-8">
              <SearchDock />
            </div>
            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              {heroStats.map(([value, label]) => (
                <div key={label} className="rounded-[1.5rem] border border-line bg-surface/70 p-4">
                  <p className="text-2xl font-semibold tracking-[-0.05em] text-ink">{value}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-muted">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-[2.5rem] border border-line bg-surface p-3 shadow-lift">
              <img src={imageManifest.hero.fallback} alt="Premium verified stay" className="aspect-[4/5] w-full rounded-[2rem] object-cover lg:aspect-[5/6]" />
            </div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: easing }}
              className="absolute -bottom-5 left-5 right-5 rounded-[1.75rem] border border-line bg-surface/92 p-5 shadow-lift backdrop-blur"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="caption-type">Trust profile</p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.04em] text-ink">Verified host / fee clarity / protected payment</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-success" />
              </div>
            </motion.div>
          </div>
        </section>

        <section className="content-shell py-16">
          <SectionHeader kicker="Stay categories" title="One marketplace, multiple travel jobs." text="UBOOK is structured for weekends, business trips, long-stay student housing, social travel, and premium villas without forcing every stay into the same pattern." />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category, index) => (
              <motion.div
                key={category.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ delay: index * 0.04, duration: 0.36, ease: easing }}
                className="premium-card p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="rounded-2xl bg-surface-2 p-3 text-primary"><Building2 className="h-5 w-5" /></div>
                  <Badge>{category.count}</Badge>
                </div>
                <h3 className="mt-6 text-2xl font-semibold tracking-[-0.05em] text-ink">{category.label}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-soft">{category.detail}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="content-shell py-16">
          <SectionHeader kicker="Featured properties" title="Premium cards with useful decision signals." action={<LinkButton to="/search" variant="secondary">Explore all <ArrowRight className="h-4 w-4" /></LinkButton>} />
          <div className="mt-8 grid gap-5 lg:grid-cols-4">
            {featured.map((property) => <PropertyCard key={property.id} property={property} />)}
          </div>
        </section>

        <section className="content-shell py-16">
          <div className="premium-panel overflow-hidden">
            <div className="grid gap-8 p-6 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
              <div>
                <p className="caption-type">Why UBOOK</p>
                <h2 className="h2-type mt-3">Trust, clarity, and speed are product features.</h2>
                <p className="body-type mt-4">Travelers see verified hosts, transparent pricing, clear cancellation states, and messaging context before payment. Hosts see revenue, occupancy, and guest operations without a generic SaaS dashboard.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Identity checks", "Hosts, properties, and high-risk bookings are reviewed with visible status."],
                  ["Payment protection", "Fees, taxes, deposits, and payout states are clear before confirmation."],
                  ["Operations console", "Admins manage fraud, reports, moderation, support, and platform health in one place."],
                  ["Mobile-first flows", "Search, booking, messaging, and host tasks are usable on the move."]
                ].map(([title, text]) => (
                  <div key={title} className="rounded-[1.5rem] bg-surface-2 p-5">
                    <ShieldCheck className="h-5 w-5 text-success" />
                    <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-ink">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-ink-soft">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="content-shell py-16">
          <SectionHeader kicker="Testimonials" title="Built for travelers, hosts, and operators." />
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {testimonials.length ? testimonials.map((item) => (
              <article key={`${item.name}-${item.quote}`} className="premium-card p-6">
                <p className="text-lg font-medium leading-8 text-ink">"{item.quote}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <img src={item.avatar} alt={item.name} className="h-12 w-12 rounded-full object-cover" />
                  <div>
                    <p className="font-bold text-ink">{item.name}</p>
                    <p className="text-sm font-semibold text-muted">{item.role}</p>
                  </div>
                </div>
              </article>
            )) : (
              <article className="premium-card p-6 lg:col-span-3">
                <p className="text-lg font-medium leading-8 text-ink">Guest reviews will appear here after verified stays are completed.</p>
              </article>
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

  const [role, setRole] = useState<"Traveler" | "Host">("Traveler");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    setLoading(true);
    setError("");

    try {
      if (requiresTwoFactor) {
        const response = await validateTwoFactor(tempToken, twoFactorCode.trim());

        navigate(
          response.user?.role === "Host"
            ? "/host"
            : response.user?.role === "Admin"
              ? "/admin"
              : "/dashboard"
        );
        return;
      }

      if (mode === "forgot") {
        await forgotPassword(String(form.get("email") || ""));
        navigate("/verify-email");
        return;
      }

      if (mode === "verify") {
        await verifyEmail();
        navigate("/dashboard");
        return;
      }

      if (mode === "register") {
        const response = await register({
          fullName: String(form.get("fullName") || ""),
          email: String(form.get("email") || ""),
          password: String(form.get("password") || ""),
          role
        });

        navigate(response.user?.role === "Host" ? "/host" : "/dashboard");
        return;
      }

      const response = await login({
        email: String(form.get("email") || ""),
        password: String(form.get("password") || "")
      });

      if (response.requires_2fa || response.requires2fa) {
        setTempToken(response.tempToken || response.temp_token || "");
        setRequiresTwoFactor(true);
        setTwoFactorCode("");
        return;
      }

      navigate(
        response.user?.role === "Host"
          ? "/host"
          : response.user?.role === "Admin"
            ? "/admin"
            : "/dashboard"
      );
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };
  const title =
    mode === "login" ? "Welcome back to UBOOK." : mode === "register" ? "Create your trusted travel identity." : mode === "forgot" ? "Reset your secure access." : "Verify your email.";
  return (
    <MotionPage>
      <div className="grid min-h-screen bg-canvas lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md">
            <BrandMark />
            <h1 className="h2-type mt-8">{title}</h1>
            <p className="body-type mt-4">
              {mode === "verify" ? "Enter the six digit code sent to your email to unlock trusted booking and host operations." : "Use Google, Apple, or email. The UI is optimized for verification, payments, and role-specific workspace access."}
            </p>
            <form onSubmit={submit} className="premium-card mt-8 grid gap-4 p-5">
              {mode === "register" ? (
                <label>
                  <span className="caption-type">Full name</span>
                  <input className="input-control mt-2" name="fullName" required />
                </label>
              ) : null}
              {mode !== "verify" ? (
                <label>
                  <span className="caption-type">Email</span>
                  <div className="relative mt-2">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input className="input-control pl-11" name="email" type="email" required />
                  </div>
                </label>
              ) : (
                <label>
                  <span className="caption-type">Verification code</span>
                  <input className="input-control mt-2 text-center text-xl tracking-[0.45em]" name="code" inputMode="numeric" />
                </label>
              )}
              {mode === "login" || mode === "register" ? (
                <label>
                  <span className="caption-type">Password</span>
                  <div className="relative mt-2">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                    <input className="input-control pl-11" name="password" type="password" required />
                  </div>
                </label>
              ) : null}
              {mode === "register" ? (
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
  <label>
    <span className="caption-type">Authenticator code</span>
    <input
      className="input-control mt-2 text-center text-xl tracking-[0.35em]"
      value={twoFactorCode}
      onChange={(event) => setTwoFactorCode(event.target.value)}
      inputMode="numeric"
      maxLength={6}
      required
      autoFocus
    />
  </label>
) : null}
              {error ? <div className="rounded-2xl bg-error/10 p-3 text-sm font-semibold text-error">{error}</div> : null}
<Button type="submit" disabled={loading}>
  {loading
    ? "Working..."
    : requiresTwoFactor
      ? "Verify code"
      : mode === "forgot"
        ? "Send reset link"
        : mode === "verify"
          ? "Verify email"
          : mode === "register"
            ? "Create account"
            : "Log in"}
</Button>
              {mode === "login" || mode === "register" ? (
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
                {mode !== "login" ? <Link to="/login" className="text-primary">Back to login</Link> : <Link to="/forgot-password" className="text-primary">Forgot password?</Link>}
                {mode !== "register" ? <Link to="/register" className="text-ink-soft">Create account</Link> : null}
              </div>
            </form>
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
  const [view, setView] = useState<"list" | "map">("list");
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
      <div className="min-h-screen bg-canvas">
        <PublicNav />
        <main className="page-shell py-8">
          <div className="premium-panel p-4 sm:p-5">
            <SearchDock compact />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[320px_1fr]">
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
            <section>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="caption-type">Property discovery</p>
                  <h1 className="h2-type mt-2">{destination ? `Stays in ${destination}` : "Explore verified stays"}</h1>
                  <p className="body-type mt-3">{results.length} curated results with list view, map mode, sorting, saved searches, and trust signals.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant={view === "list" ? "primary" : "secondary"} onClick={() => setView("list")}><Table2 className="h-4 w-4" /> List</Button>
                  <Button variant={view === "map" ? "primary" : "secondary"} onClick={() => setView("map")}><Map className="h-4 w-4" /> Map</Button>
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
              {view === "map" ? <MapExperience results={results} /> : <div className="mt-6 grid gap-5 md:grid-cols-2">{results.map((property) => <PropertyCard key={property.id} property={property} />)}</div>}
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
  const [checkIn, setCheckIn] = useState("2026-06-18");
  const [checkOut, setCheckOut] = useState("2026-06-22");
  const [guests, setGuests] = useState("2");
  const propertyId = Number(id);
  const propertyQuery = useQuery({ queryKey: ["property", propertyId], queryFn: () => getPropertyById(propertyId), enabled: Number.isFinite(propertyId) });
  const apiProperty = propertyQuery.data;
  const property = apiProperty ? toExperienceProperty(apiProperty) : null;
  const similarQuery = useQuery({
    queryKey: ["similar-properties", property?.city, property?.type],
    queryFn: () => getProperties({ city: property?.city, propertyType: property?.type, size: 4 }),
    enabled: Boolean(property)
  });
  const pricingQuery = useQuery({
    queryKey: ["pricing", propertyId, checkIn, checkOut, guests],
    queryFn: () => getDynamicPriceForDates(propertyId, checkIn, checkOut, Number(guests)),
    enabled: Boolean(property)
  });
  const saveFavorite = useMutation({ mutationFn: () => addFavorite(propertyId) });
  if (!property || !apiProperty) {
    return <div className="min-h-screen bg-canvas" />;
  }
  const nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
  const fees = Math.round((pricingQuery.data?.serviceFee ?? property.price * nights * 0.18) + (pricingQuery.data?.cityTax ?? 0));
  const total = Math.round(pricingQuery.data?.total ?? property.price * nights + fees);
  const similar = (similarQuery.data ?? []).map(toExperienceProperty).filter((item) => item.id !== property.id).slice(0, 3);
  return (
    <MotionPage>
      <div className="min-h-screen bg-canvas">
        <PublicNav />
        <main className="page-shell py-8">
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
          <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_400px]">
            <section className="grid gap-6">
              <article className="premium-card p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="h3-type">Hosted by {property.host}</h2>
                    <p className="mt-2 text-sm font-semibold text-ink-soft">Host since {property.hostSince} / identity and payout verified</p>
                  </div>
                  <img src={property.hostAvatar} alt={property.host} className="h-16 w-16 rounded-2xl object-cover" />
                </div>
                <p className="body-type mt-6">{property.description}</p>
              </article>
              <article className="premium-card p-6">
                <SectionHeader kicker="Amenities" title="Everything important is visible before payment." />
                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {property.amenities.map((amenity) => <div key={amenity} className="rounded-2xl bg-surface-2 p-4 text-sm font-bold text-ink-soft">{amenity}</div>)}
                </div>
              </article>
              <article className="premium-card p-6">
                <SectionHeader kicker="Availability" title="Clear dates, rules, and booking confidence." />
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {apiProperty.availability.length ? apiProperty.availability.slice(0, 3).map((item) => <div key={item.label} className="rounded-2xl border border-line bg-surface-2 p-5 text-center font-bold text-ink">{item.label} / {item.status}</div>) : <div className="rounded-2xl border border-line bg-surface-2 p-5 text-center font-bold text-ink">Availability updates after host calendar setup.</div>}
                </div>
              </article>
              <article className="premium-card p-6">
                <SectionHeader kicker="Reviews" title="Recent guest signals." />
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {apiProperty.reviews.slice(0, 2).map((item) => (
                    <div key={item.id} className="rounded-[1.25rem] bg-surface-2 p-5">
                      <p className="text-sm leading-6 text-ink-soft">"{item.comment}"</p>
                      <p className="mt-4 font-bold text-ink">{item.author}</p>
                    </div>
                  ))}
                </div>
              </article>
              <article className="premium-card p-6">
                <SectionHeader kicker="Location" title="Neighborhood context, not just a pin." text={`${property.distance}. The location block prioritizes transit, safety, arrival clarity, and nearby essentials.`} />
                <div className="subtle-grid mt-6 grid min-h-72 place-items-center rounded-[1.5rem] bg-surface-2">
                  <Badge tone="primary"><MapPin className="h-3.5 w-3.5" /> {property.neighborhood}</Badge>
                </div>
              </article>
            </section>
            <aside className="xl:sticky xl:top-28 xl:self-start">
              <div className="premium-panel p-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="caption-type">From</p>
                    <p className="mt-1 text-3xl font-semibold tracking-[-0.06em]">${property.price}<span className="text-sm font-semibold text-muted"> / night</span></p>
                  </div>
                  <Badge tone="success">Protected payment</Badge>
                </div>
                <div className="mt-5 grid gap-3">
                  <label><span className="caption-type">Check-in</span><input className="input-control mt-2" type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></label>
                  <label><span className="caption-type">Check-out</span><input className="input-control mt-2" type="date" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></label>
                  <label><span className="caption-type">Guests</span><select className="input-control mt-2" value={guests} onChange={(event) => setGuests(event.target.value)}><option value="2">2 guests</option><option value="4">4 guests</option><option value="6">6 guests</option></select></label>
                </div>
                <div className="mt-5 grid gap-3 text-sm font-semibold text-ink-soft">
                  <LineItem label={`${nights} nights`} value={currency(Math.round(pricingQuery.data?.subtotal ?? property.price * nights))} />
                  <LineItem label="Fees and taxes" value={currency(fees)} />
                  <LineItem label="Total" value={currency(total)} strong />
                </div>
                <LinkButton to={`/booking/${property.id}`} className="mt-5 w-full">Reserve</LinkButton>
              </div>
            </aside>
          </div>
          <section className="mt-12">
            <SectionHeader kicker="Similar properties" title="Comparable stays nearby." />
            <div className="mt-6 grid gap-5 md:grid-cols-3">{similar.map((item) => <PropertyCard key={item.id} property={item} />)}</div>
          </section>
        </main>
        <PublicFooter />
      </div>
    </MotionPage>
  );
}

function LineItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-4", strong && "border-t border-line pt-3 text-lg text-ink")}>
      <span>{label}</span>
      <span className="font-bold text-ink">{value}</span>
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
  const profileChecks = [
    ["Email verified", Boolean(userQuery.data?.emailVerified)],
    ["Phone verified", Boolean(userQuery.data?.phoneVerified)],
    ["Government ID ready", Boolean(userQuery.data?.identityVerified)],
    ["Two-factor enabled", Boolean(userQuery.data?.otpEnabled)]
  ] as const;
  return (
    <WorkspaceShell role="traveler" title="Traveler home" subtitle="A calm command center for upcoming trips, recommendations, saved listings, messages, payments, reviews, and profile readiness." action={<LinkButton to="/search">Explore stays</LinkButton>}>
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
      <section id="trips" className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="premium-card p-5">
          <SectionHeader kicker="Upcoming trips" title="Beautiful trip cards with next actions." />
          <div className="mt-5 grid gap-4">
            {(dashboard?.upcomingTrips || []).slice(0, 2).map((booking, index) => <TripCard key={booking.id} booking={booking} index={index} />)}
          </div>
        </div>
        <div className="premium-card p-5">
          <SectionHeader kicker="AI-style recommendations" title="Stays matched to your intent." />
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {recommendations.slice(0, 2).map((property) => <PropertyCard key={property.id} property={property} />)}
          </div>
        </div>
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-3">
        <InsightPanel title="Recent searches" items={(savedSearchesQuery.data || []).map((item: { name: string }) => item.name)} />
        <InsightPanel title="Saved properties" items={(favoritesQuery.data || []).map((item) => item.title || item.name)} />
        <InsightPanel title="Travel insights" items={[`${dashboard?.bookingHistory?.length || 0} lifetime bookings`, `${dashboard?.upcomingTrips?.length || 0} upcoming trips`, `${currency((dashboard?.bookingHistory || []).reduce((sum, booking) => sum + booking.total, 0))} total trip value`]} />
      </section>
      <section id="payments" className="mt-8 grid gap-6 lg:grid-cols-2">
        <ChartPanel title="Travel spending"><RevenueChart data={spendingData} /></ChartPanel>
        <div id="profile" className="premium-card p-5">
          <SectionHeader kicker="Profile readiness" title="Trust setup for smoother booking." />
          <div className="mt-5 grid gap-3">
            {profileChecks.map(([item, complete]) => <StatusRow key={item} label={item} tone={complete ? "success" : "warning"} />)}
          </div>
        </div>
      </section>
    </WorkspaceShell>
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

export function BookingPage() {
  const { id } = useParams();
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState<UserBooking | null>(null);
  const [checkoutError, setCheckoutError] = useState("");
  const [guestDetails, setGuestDetails] = useState({ fullName: "", email: "", phone: "", guests: "2", notes: "" });
  const steps = ["Property", "Guest details", "Payment", "Confirmation"];
  const propertyId = Number(id);
  const propertyQuery = useQuery({ queryKey: ["booking-property", propertyId], queryFn: () => getPropertyById(propertyId), enabled: Number.isFinite(propertyId) });
  const apiProperty = propertyQuery.data;
  const property = apiProperty ? toExperienceProperty(apiProperty) : null;
  const checkout = useMutation({
    mutationFn: async () => {
      if (!property) throw new Error("Property is not available");
      if (step === 1) {
        const created = await createBooking({
          propertyId: property.id,
          fullName: guestDetails.fullName,
          email: guestDetails.email,
          guests: Number(guestDetails.guests),
          checkIn: "2026-06-18",
          checkOut: "2026-06-22",
          notes: guestDetails.notes,
        });
        setBooking(created);
      }
      if (step === 2) {
        const activeBooking = booking;
        if (!activeBooking) throw new Error("Create the booking before payment");
        const payment = await createPayment(activeBooking.id, "manual");
        await confirmPayment(payment.id, "succeeded", `manual-${activeBooking.bookingReference}`);
      }
    },
    onSuccess: () => {
      setCheckoutError("");
      setStep((value) => Math.min(steps.length - 1, value + 1));
    },
    onError: (error) => setCheckoutError(error instanceof Error ? error.message : "Checkout failed")
  });
  if (!property) {
    return <div className="min-h-screen bg-canvas" />;
  }
  const continueCheckout = () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === steps.length - 1) {
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
            {step === 0 ? <BookingPropertyStep property={property} /> : null}
            {step === 1 ? <GuestDetailsStep value={guestDetails} onChange={setGuestDetails} /> : null}
            {step === 2 ? <PaymentStep property={property} /> : null}
            {step === 3 ? <ConfirmationStep property={property} /> : null}
          </div>
          {checkoutError ? <div className="mt-5 rounded-2xl bg-error/10 p-4 text-sm font-semibold text-error">{checkoutError}</div> : null}
          <div className="mt-8 flex flex-col justify-between gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0}>Back</Button>
            <Button onClick={continueCheckout} disabled={checkout.isPending}>{step === steps.length - 1 ? "Done" : checkout.isPending ? "Working..." : "Continue"}</Button>
          </div>
        </section>
        <aside className="premium-panel h-fit p-5 xl:sticky xl:top-28">
          <img src={property.image} alt={property.title} className="aspect-[16/10] rounded-[1.5rem] object-cover" />
          <h2 className="mt-5 text-2xl font-semibold tracking-[-0.05em]">{property.title}</h2>
          <p className="mt-2 text-sm font-semibold text-ink-soft">{property.city} / 4 nights / 2 guests</p>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-ink-soft">
            <LineItem label="Stay" value={`$${property.price * 4}`} />
            <LineItem label="Fees" value={`$${Math.round(property.price * 0.18)}`} />
            <LineItem label="Total" value={`$${property.price * 4 + Math.round(property.price * 0.18)}`} strong />
          </div>
          <div className="mt-5 rounded-[1.25rem] bg-success/10 p-4 text-sm font-semibold leading-6 text-success">
            Your payment is held securely until the booking is confirmed by UBOOK policy.
          </div>
        </aside>
      </div>
    </WorkspaceShell>
  );
}

function BookingPropertyStep({ property }: { property: Property }) {
  return (
    <div className="grid gap-5 md:grid-cols-[280px_1fr]">
      <img src={property.image} alt={property.title} className="aspect-[4/3] rounded-[1.5rem] object-cover" />
      <div>
        <Badge tone="success">Verified selection</Badge>
        <h2 className="h3-type mt-3">{property.title}</h2>
        <p className="body-type mt-3">{property.description}</p>
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
      <label><span className="caption-type">Guests</span><select className="input-control mt-2" value={value.guests} onChange={(event) => update("guests", event.target.value)}><option value="2">2 guests</option><option value="4">4 guests</option></select></label>
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
          <StatusRow label="Availability locked" tone="success" />
          <StatusRow label={`${property.host} verified`} tone="success" />
          <StatusRow label="Fee disclosure accepted" tone="success" />
        </div>
      </div>
    </div>
  );
}

function ConfirmationStep({ property }: { property: Property }) {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success/10 text-success"><Check className="h-8 w-8" /></div>
      <h2 className="h2-type mt-5">Booking confirmed.</h2>
      <p className="body-type mx-auto mt-4 max-w-xl">Your stay at {property.title} is now in Trips. The host, receipt, arrival guide, and message thread are attached to the booking timeline.</p>
      <LinkButton to="/dashboard" className="mt-6">Open trips</LinkButton>
    </div>
  );
}

export function HostDashboard() {
  const dashboardQuery = useQuery({ queryKey: ["host-dashboard"], queryFn: getHostDashboard });
  const dashboard = dashboardQuery.data as ApiHostDashboard | undefined;
  const metrics = (dashboard?.metrics || []).map(toMetric);
  const listings = (dashboard?.properties || []).map(toExperienceProperty);
  const reservations = (dashboard?.recentReservations || []).map(toReservation);
  const chartData = toChartData(dashboard?.revenueTrends, dashboard?.bookingTrends);
  const sourceData = Object.entries(reservations.reduce<Record<string, number>>((acc, reservation) => {
    acc[reservation.status] = (acc[reservation.status] || 0) + 1;
    return acc;
  }, {})).map(([name, value]) => ({ name, value }));
  const tasks = (dashboard as (ApiHostDashboard & { tasks?: string[] }) | undefined)?.tasks || [];
  const reservationColumns = useMemo<ColumnDef<Reservation>[]>(() => [
    { accessorKey: "id", header: "Reservation" },
    { accessorKey: "guest", header: "Guest" },
    { accessorKey: "property", header: "Property" },
    { accessorKey: "dates", header: "Dates" },
    { accessorKey: "status", header: "Status", cell: ({ getValue }) => <Badge tone={getValue() === "Dispute" ? "error" : getValue() === "Pending" ? "warning" : "success"}>{String(getValue())}</Badge> },
    { accessorKey: "value", header: "Value" }
  ], []);
  return (
    <WorkspaceShell role="host" title="Host business cockpit" subtitle="A business-focused operating system for revenue, occupancy, reservations, pricing, calendar health, guest communication, reviews, and analytics." action={<LinkButton to="/host/onboarding"><Plus className="h-4 w-4" /> New listing</LinkButton>}>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <ChartPanel title="Revenue analytics"><RevenueChart data={chartData} /></ChartPanel>
        <ChartPanel title="Occupancy trend"><OccupancyChart data={chartData} /></ChartPanel>
      </section>
      <section id="listings" className="mt-8">
        <SectionHeader kicker="Listings" title="Professional property management." action={<LinkButton to="/host/onboarding" variant="secondary">Open wizard</LinkButton>} />
        <div className="mt-6 grid gap-5 md:grid-cols-3">{listings.slice(0, 3).map((property) => <PropertyCard key={property.id} property={property} />)}</div>
      </section>
      <section id="reservations" className="mt-8 grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="premium-card p-5">
          <SectionHeader kicker="Reservations" title="Filtered reservation management." />
          <div className="mt-5"><DataTable data={reservations} columns={reservationColumns} /></div>
        </div>
        <div className="premium-card p-5">
          <SectionHeader kicker="Tasks" title="What needs attention." />
          <div className="mt-5 grid gap-3">
            {tasks.map((task, index) => <div key={task} className="rounded-2xl bg-surface-2 p-4 text-sm font-semibold leading-6 text-ink-soft"><Badge tone={index === 0 ? "warning" : "neutral"}>{index + 1}</Badge><p className="mt-3">{task}</p></div>)}
          </div>
        </div>
      </section>
      <section id="calendar" className="mt-8 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <CalendarPanel propertyId={listings[0]?.id} />
        <div id="analytics" className="premium-card p-5">
          <SectionHeader kicker="Booking sources" title="Where demand is coming from." />
          <div className="mt-5 h-72"><SourceChart data={sourceData} /></div>
        </div>
      </section>
    </WorkspaceShell>
  );
}

function CalendarPanel({ propertyId }: { propertyId?: number }) {
  const start = new Date();
  start.setDate(1);
  const dates = Array.from({ length: 35 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const queryClient = useQueryClient();
  const calendarQuery = useQuery({ queryKey: ["property-calendar", propertyId], queryFn: () => getPropertyCalendar(propertyId as number), enabled: Boolean(propertyId) });
  const rows = new globalThis.Map<string, { calendarDate: string; availableUnits: number; minNights: number; closed: boolean; priceOverride?: number | null }>((calendarQuery.data || []).map((row: { calendarDate: string; availableUnits: number; minNights: number; closed: boolean; priceOverride?: number | null }) => [row.calendarDate, row]));
  const updateCalendar = useMutation({
    mutationFn: (row: { calendarDate: string; availableUnits: number; minNights: number; closed: boolean; priceOverride?: number | null }) => updatePropertyCalendar(propertyId as number, [row]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["property-calendar", propertyId] })
  });
  return (
    <div className="premium-card p-5">
      <SectionHeader kicker="Calendar" title="Month view with blocks and price cues." />
      <div className="mt-5 grid grid-cols-7 gap-2">
        {dates.map((date) => {
          const row = rows.get(date);
          const closed = row?.closed ?? false;
          return (
          <button key={date} type="button" onClick={() => propertyId ? updateCalendar.mutate({ calendarDate: date, availableUnits: closed ? 1 : 0, minNights: row?.minNights || 1, closed: !closed, priceOverride: row?.priceOverride ?? null }) : undefined} className={cn("min-h-20 rounded-2xl border border-line p-2 text-left text-xs font-bold", closed ? "bg-error/10 text-error" : row?.priceOverride ? "bg-warning/10 text-warning" : "bg-surface-2 text-ink-soft")}>
            <span>{new Date(date).getDate()}</span>
            <span className="mt-5 block">{closed ? "Blocked" : row?.priceOverride ? currency(row.priceOverride) : "Open"}</span>
          </button>
          );
        })}
      </div>
    </div>
  );
}

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
  return (
    <MotionPage>
      <main className="min-h-screen bg-canvas">
        <div className="page-shell py-6">
          <header className="flex items-center justify-between gap-4">
            <BrandMark />
            <LinkButton to="/host" variant="secondary">Exit wizard</LinkButton>
          </header>
          <div className="mt-10 grid gap-8 xl:grid-cols-[320px_1fr]">
            <aside className="premium-card h-fit p-5 xl:sticky xl:top-6">
              <p className="caption-type">Listing creation</p>
              <h1 className="h3-type mt-3">Publish without instructions.</h1>
              <div className="mt-6 grid gap-2">
                {onboardingSteps.map((item, index) => (
                  <button key={item} type="button" onClick={() => setStep(index)} className={cn("flex items-center gap-3 rounded-2xl p-3 text-left text-sm font-bold", step === index ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-soft")}>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white/20">{index + 1}</span>
                    {item}
                  </button>
                ))}
              </div>
            </aside>
            <section className="premium-panel p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="caption-type">Autosaved / step {step + 1} of {onboardingSteps.length}</p>
                  <h2 className="h2-type mt-3">{onboardingSteps[step]}</h2>
                </div>
                <div className="h-2 w-full rounded-full bg-surface-2 md:w-80">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${((step + 1) / onboardingSteps.length) * 100}%` }} />
                </div>
              </div>
              <div className="mt-8">
                {step === 0 ? <TypeSelection value={listingDraft.propertyType} onSelect={(propertyType) => setListingDraft((draft) => ({ ...draft, propertyType }))} /> : null}
                {step === 1 ? <AddressStep value={listingDraft} onChange={setListingDraft} /> : null}
                {step === 2 ? <AmenityStep selected={listingDraft.amenities} onToggle={(amenity) => setListingDraft((draft) => ({ ...draft, amenities: draft.amenities.includes(amenity) ? draft.amenities.filter((item) => item !== amenity) : [...draft.amenities, amenity] }))} /> : null}
                {step === 3 ? <PhotoStep property={property} /> : null}
                {step === 4 ? <PricingWizardStep value={listingDraft} onChange={setListingDraft} /> : null}
                {step === 5 ? <AvailabilityStep /> : null}
                {step === 6 ? <PreviewWizard property={property} /> : null}
                {step === 7 ? <PublishStep property={property} onPublish={() => publish.mutate()} publishing={publish.isPending} /> : null}
              </div>
              <div className="mt-8 flex flex-col justify-between gap-3 sm:flex-row">
                <Button variant="secondary" onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</Button>
                <Button onClick={() => setStep((value) => Math.min(onboardingSteps.length - 1, value + 1))}>Continue</Button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </MotionPage>
  );
}

function TypeSelection({ value, onSelect }: { value: string; onSelect: (value: string) => void }) {
  return <div className="grid gap-4 md:grid-cols-3">{propertyTypeOptions.filter((item) => item !== "All").map((item) => <button key={item} type="button" onClick={() => onSelect(item)} className={cn("rounded-[1.5rem] border border-line bg-surface-2 p-5 text-left", value === item && "border-primary")}><Building2 className="h-5 w-5 text-primary" /><h3 className="mt-5 text-xl font-semibold">{item}</h3><p className="mt-2 text-sm text-ink-soft">Use this property type for the listing.</p></button>)}</div>;
}

function AddressStep({ value, onChange }: { value: { title: string; address: string; city: string; country: string; neighborhood: string }; onChange: (value: any) => void }) {
  const update = (key: keyof typeof value, nextValue: string) => onChange((draft: typeof value) => ({ ...draft, [key]: nextValue }));
  return <div className="grid gap-4 md:grid-cols-2"><label><span className="caption-type">Address</span><input className="input-control mt-2" value={value.address} onChange={(event) => update("address", event.target.value)} /></label><label><span className="caption-type">City</span><input className="input-control mt-2" value={value.city} onChange={(event) => update("city", event.target.value)} /></label><label><span className="caption-type">Country</span><input className="input-control mt-2" value={value.country} onChange={(event) => update("country", event.target.value)} /></label><label><span className="caption-type">Neighborhood</span><input className="input-control mt-2" value={value.neighborhood} onChange={(event) => update("neighborhood", event.target.value)} /></label></div>;
}

function AmenityStep({ selected, onToggle }: { selected: string[]; onToggle: (value: string) => void }) {
  return <div className="grid gap-3 md:grid-cols-3">{amenityOptions.map((item) => <label key={item} className="rounded-2xl bg-surface-2 p-4 text-sm font-bold"><input className="mr-3" type="checkbox" checked={selected.includes(item)} onChange={() => onToggle(item)} />{item}</label>)}</div>;
}

function PhotoStep({ property }: { property: Property }) {
  return <div className="grid gap-4 md:grid-cols-2"><img src={property.image} alt={property.title} className="rounded-[1.5rem] object-cover" /><div className="grid gap-4">{property.gallery.slice(0, 4).map((image) => <img key={image} src={image} alt="" className="h-36 rounded-[1.25rem] object-cover" />)}</div></div>;
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
  const userQuery = useQuery({ queryKey: ["current-user"], queryFn: getCurrentUser });
  const conversationsQuery = useQuery({ queryKey: ["conversations"], queryFn: getConversations });
  const [activeId, setActiveId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const currentUserId = userQuery.data?.id ?? null;
  const conversations = (conversationsQuery.data || []).map((conversation) => toConversation(conversation as ApiConversation & Record<string, unknown>, currentUserId));
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
      <WorkspaceShell role="traveler" title="Messages" subtitle="A modern conversation workspace with attachments, read receipts, booking context, notifications, and role-aware thread state.">
        <section className="premium-card p-5">No conversations yet.</section>
      </WorkspaceShell>
    );
  }
  return (
    <WorkspaceShell role="traveler" title="Messages" subtitle="A modern conversation workspace with attachments, read receipts, booking context, notifications, and role-aware thread state.">
      <section className="grid min-h-[680px] gap-6 xl:grid-cols-[340px_1fr_320px]">
        <aside className="premium-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="h4-type">Conversations</h2>
            <Badge tone="primary">{conversations.reduce((sum, item) => sum + item.unread, 0)} unread</Badge>
          </div>
          <div className="mt-5 grid gap-2">
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
        <article className="premium-card flex flex-col overflow-hidden">
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
        <aside className="premium-card p-5">
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
