import { imageManifest } from "../assets/imageManifest";
import type { Conversation as ApiConversation, DashboardMetric, Message, Property as ApiProperty, UserBooking } from "../types/api";

export type WorkspaceRole = "traveler" | "host" | "admin";

export type Property = {
  id: number;
  title: string;
  type: "Apartment" | "Hotel" | "Villa" | "Student Housing" | "Shared Room" | "Unique Stay" | string;
  city: string;
  country: string;
  neighborhood: string;
  image: string;
  gallery: string[];
  price: number;
  rating: number;
  reviews: number;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  host: string;
  hostId?: number | null;
  hostAvatar: string;
  hostSince: string;
  verified: boolean;
  tags: string[];
  amenities: string[];
  description: string;
  distance: string;
  availability: string;
  lat: number;
  lng: number;
};

export type Metric = {
  label: string;
  value: string;
  delta: string;
  tone: "primary" | "success" | "warning" | "accent" | "neutral";
};

export type Reservation = {
  id: string;
  guest: string;
  property: string;
  dates: string;
  status: string;
  value: string;
  risk: "Low" | "Medium" | "High";
};

export type Conversation = {
  id: number;
  person: string;
  role: "Traveler" | "Host" | "Support";
  property: string;
  unread: number;
  status: "Online" | "Away" | "Resolved";
  messages: Array<{ from: "me" | "them"; body: string; time: string; read?: boolean }>;
};

export const onboardingSteps = ["Basics", "Location", "Amenities", "Photos", "Pricing", "Calendar", "Preview", "Publish"];

export const propertyTypeOptions = ["All", "Apartment", "Hotel", "Villa", "Student Housing", "Shared Room", "Unique Stay"];
export const amenityOptions = ["Workspace", "Pool", "Laundry", "Breakfast", "Smart lock", "Transit"];
export const trustOptions = ["Verified host", "Instant book", "Rating 4.8+", "Flexible cancellation"];

const tones: Metric["tone"][] = ["primary", "success", "accent", "neutral", "warning"];

export function toExperienceProperty(property: ApiProperty): Property {
  const reviewCount = property.reviewCount ?? property.reviews?.length ?? 0;
  return {
    id: property.id,
    title: property.title || property.name,
    type: normalizePropertyType(property.type || property.propertyType || "Hotel"),
    city: property.city,
    country: property.country || "",
    neighborhood: property.neighborhood || property.location,
    image: property.image || property.coverImage || imageManifest.properties.hotel,
    gallery: property.gallery?.length ? property.gallery : [property.image || property.coverImage || imageManifest.properties.hotel],
    price: Math.round(property.pricePerNight ?? property.price ?? 0),
    rating: Number(property.averageRating ?? property.rating ?? 0),
    reviews: reviewCount,
    guests: property.maxGuests ?? property.capacity ?? 1,
    bedrooms: property.bedrooms ?? 1,
    bathrooms: Number(property.bathrooms ?? 1),
    host: property.host || "Verified host",
    hostId: property.hostId,
    hostAvatar: property.hostAvatar || imageManifest.avatars.maya,
    hostSince: property.hostSince ? new Date(property.hostSince).getFullYear().toString() : "Verified",
    verified: Boolean(property.verified),
    tags: property.tags || [],
    amenities: property.amenities || [],
    description: property.description || "",
    distance: property.location || property.address || `${property.neighborhood}, ${property.city}`,
    availability: property.availability?.[0]?.status || (property.isActive === false ? "Unavailable" : "Available"),
    lat: property.coordinates?.[0] ?? 0,
    lng: property.coordinates?.[1] ?? 0,
  };
}

export function toMetric(metric: DashboardMetric, index = 0): Metric {
  return {
    label: metric.label,
    value: metric.value,
    delta: metric.detail || metric.change || "Live data",
    tone: tones[index % tones.length],
  };
}

export function toReservation(booking: UserBooking): Reservation {
  return {
    id: booking.bookingReference || booking.bookingId || String(booking.id),
    guest: String(booking.payload?.fullName || "Traveler"),
    property: booking.propertyName,
    dates: booking.dates,
    status: booking.status,
    value: currency(booking.total),
    risk: booking.status.toLowerCase().includes("cancel") ? "Medium" : "Low",
  };
}

export function toChartData(revenueTrends?: Array<{ date: string; revenue: number }>, bookingTrends?: Array<{ date: string; bookings: number }>) {
  const byDate = new Map<string, { month: string; revenue: number; occupancy: number; conversion: number }>();
  for (const row of revenueTrends || []) {
    byDate.set(row.date, { month: shortDate(row.date), revenue: Math.round(row.revenue), occupancy: 0, conversion: 0 });
  }
  for (const row of bookingTrends || []) {
    const existing = byDate.get(row.date) || { month: shortDate(row.date), revenue: 0, occupancy: 0, conversion: 0 };
    existing.occupancy = row.bookings;
    existing.conversion = row.bookings;
    byDate.set(row.date, existing);
  }
  return [...byDate.values()];
}

export function toConversation(conversation: ApiConversation & Record<string, unknown>, currentUserId?: number | null): Conversation {
  const hostName = String(conversation.hostName || "Host");
  const travelerName = String(conversation.travelerName || "Traveler");
  const isTraveler = currentUserId === conversation.travelerId;
  const person = isTraveler ? hostName : travelerName;
  return {
    id: conversation.id,
    person,
    role: isTraveler ? "Host" : "Traveler",
    property: String(conversation.propertyTitle || `Property ${conversation.propertyId || ""}`),
    unread: Number(conversation.unreadCount || 0),
    status: "Online",
    messages: (conversation.messages || []).map((message) => toMessage(message, currentUserId)),
  };
}

function toMessage(message: Message, currentUserId?: number | null) {
  return {
    from: message.senderId === currentUserId ? "me" as const : "them" as const,
    body: message.body || (message.imageUrl ? "Image attachment" : ""),
    time: message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
    read: Boolean(message.readAt),
  };
}

export function categoryData(properties: Property[]) {
  const counts = new Map<string, number>();
  for (const property of properties) {
    counts.set(property.type, (counts.get(property.type) || 0) + 1);
  }
  return ["Apartment", "Hotel", "Villa", "Student Housing", "Shared Room", "Unique Stay"].map((label) => ({
    label: label === "Apartment" ? "Apartments" : label === "Hotel" ? "Hotels" : label === "Villa" ? "Villas" : `${label}s`,
    value: label,
    detail: categoryDetail(label),
    count: String(counts.get(label) || 0),
  }));
}

export function testimonialsFromProperties(properties: ApiProperty[]) {
  return properties.flatMap((property) => (property.reviews || []).map((review) => ({
    quote: review.comment,
    name: review.author,
    role: review.role,
    avatar: review.avatar || imageManifest.avatars.lina,
  }))).slice(0, 3);
}

export function currency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function shortDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizePropertyType(type: string) {
  const normalized = type.toLowerCase();
  if (normalized.includes("student")) return "Student Housing";
  if (normalized.includes("shared")) return "Shared Room";
  if (normalized.includes("unique") || normalized.includes("cabin") || normalized.includes("riad")) return "Unique Stay";
  if (normalized.includes("villa")) return "Villa";
  if (normalized.includes("apartment")) return "Apartment";
  return "Hotel";
}

function categoryDetail(label: string) {
  if (label === "Apartment") return "Design-led city homes";
  if (label === "Hotel") return "Operated stays with service";
  if (label === "Villa") return "Private premium homes";
  if (label === "Student Housing") return "Verified monthly rooms";
  if (label === "Shared Room") return "Social and affordable";
  return "Rare places, safe operations";
}
