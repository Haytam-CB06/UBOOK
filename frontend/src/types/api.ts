export type PropertyType = "Riad" | "Apartment" | "House" | "Hotel" | "Villa" | "Resort" | "Cabin";

export interface Review {
  id: number;
  author: string;
  role: string;
  avatar?: string;
  rating: number;
  comment: string;
}

export interface RoomOption {
  id: string;
  name: string;
  description: string;
  priceModifier: number;
  sleeps: number;
}

export interface AvailabilitySlot {
  label: string;
  status: "Open" | "Limited" | "Closed";
}

export interface Property {
  id: number;
  name: string;
  title?: string;
  type: PropertyType | string;
  propertyType?: string;
  country?: string;
  city: string;
  address?: string;
  location: string;
  neighborhood: string;
  coordinates: [number, number];
  price: number;
  pricePerNight?: number;
  cleaningFee?: number;
  serviceFee?: number;
  rating: number;
  averageRating?: number;
  reviewCount: number;
  image: string;
  coverImage?: string;
  gallery: string[];
  amenities: string[];
  capacity: number;
  maxGuests?: number;
  bedrooms?: number;
  bathrooms?: number;
  beds?: number;
  description: string;
  tags: string[];
  host: string;
  hostId?: number;
  hostAvatar?: string | null;
  hostSince?: string | null;
  hostRating?: number;
  hostReviewsCount?: number;
  verified: boolean;
  isActive?: boolean;
  availableFrom?: string | null;
  createdAt?: string;
  updatedAt?: string;
  dynamicPricingNote?: string;
  roomOptions: RoomOption[];
  availability: AvailabilitySlot[];
  reviews: Review[];
  hostStats?: {
    bookingCount: number;
    revenue: number;
    status: string;
    views: number;
    conversionRate: number;
  };
}

export interface UserBooking {
  id: number;
  bookingId: string;
  bookingReference: string;
  propertyId: number;
  propertyName: string;
  propertyTitle?: string;
  propertyImage?: string;
  hostId?: number | null;
  hostName?: string | null;
  city: string;
  dates: string;
  nights: number;
  status: string;
  total: number;
  payload?: Record<string, unknown>;
}

export interface AdminMetric {
  label: string;
  value: string;
  change?: string;
  detail?: string;
}

export interface RecentSearch {
  id: string;
  destination: string;
  dates: string;
  guests: number;
}

export interface Testimonial {
  id: number | string;
  quote: string;
  name?: string;
  author: string;
  role: string;
  avatar: string;
}

export interface BusyArea {
  id: string;
  name: string;
  coordinates: [number, number];
  radius: number;
  occupancyRate: number;
  intensity: "High" | "Growing" | "Emerging";
  note: string;
}

export interface AdminPropertyRow {
  id: number;
  name: string;
  type: string;
  location: string;
  occupancy: string;
  nightlyRate: number;
  status: string;
}

export interface BookingRequest {
  id: number;
  guest: string;
  property: string;
  dates: string;
  value: number;
  status: string;
}

export interface DashboardMetric {
  label: string;
  value: string;
  detail?: string;
  change?: string;
}

export interface TravelerDashboard {
  metrics: DashboardMetric[];
  upcomingTrips: UserBooking[];
  bookingHistory: UserBooking[];
  recommendedProperties: Property[];
  notifications: NotificationRecord[];
}

export interface HostDashboard {
  needsOnboarding: boolean;
  hasActiveProperties: boolean;
  metrics: DashboardMetric[];
  properties: Property[];
  recentReservations: UserBooking[];
  recentReviews: Review[];
  bookingTrends: Array<{ date: string; bookings: number }>;
  revenueTrends: Array<{ date: string; revenue: number }>;
  notifications: NotificationRecord[];
}

export interface AdminStats {
  metrics: AdminMetric[];
  bookingMetrics: Record<string, number>;
  revenueMetrics: Record<string, number>;
  propertyMetrics: Record<string, number>;
  userMetrics: Record<string, number>;
  busyAreas: BusyArea[];
  occupancyOverview: Array<{ label: string; value: number }>;
  pricingRules: string[];
  recentSearches: unknown[];
}

export interface NotificationRecord {
  id: number;
  type: string;
  subject: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: number;
  bookingId: number;
  provider: "stripe" | "paypal" | "manual";
  status: string;
  amount: number;
  currency: string;
  transactionId?: string | null;
  refundStatus: string;
  invoiceUrl?: string | null;
  receiptUrl?: string | null;
}

export interface Wishlist {
  id: number;
  name: string;
  description?: string | null;
  properties: Property[];
  createdAt: string;
}

export interface Conversation {
  id: number;
  propertyId?: number | null;
  bookingId?: number | null;
  travelerId: number;
  hostId: number;
  lastMessageAt?: string | null;
  messages?: Message[];
}

export interface Message {
  id: number;
  conversationId: number;
  senderId?: number | null;
  body?: string | null;
  imageUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
}
