export type SubscriptionStatus = 'renewed' | 'pending' | 'expired';

export type UserRole = 'admin' | 'staff';

export type BusinessType = 'fruits' | 'food' | 'dairy';
export type DairyUnit = 'litres' | 'ml' | 'grams' | 'packets' | 'pack';
export type DeliveryShift = 'morning' | 'evening' | 'both';
export type PackagingType = 'packet' | 'bottle';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  businessName?: string;
  permissions?: string[];
  zone?: string | string[];
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  alternativeMobile?: string;
  address?: string;
  address2?: string;
  area?: string;
  landmark?: string;
  location?: string;
  zone?: string;
  subscriptionStartDate: string;
  renewalDate: string;
  status: SubscriptionStatus;
  renewalCycle: 'monthly' | 'weekly' | 'daily';
  paymentStatus?: 'unpaid' | 'paid' | 'partially_paid' | 'overdue';
  lastPaymentDate?: string;
  amountPaid?: number;
  packId?: number;
  packName?: string;
  packPrice?: number;
  quantity?: number;
  packType?: 'fruits' | 'food' | 'dairy';
  unitType?: DairyUnit;
  unitVolume?: number;
  deliveryShift?: DeliveryShift;
  emptyBottlesHeld?: number;
  mealSlots?: string;
  attendance_records?: { status: string, meal_type: string, updated_at?: string }[];
  packs?: {
    id: number;
    packId: number;
    name: string;
    price: number;
    quantity: number;
    startDate?: string;
    renewalDate?: string;
    renewalCycle?: string;
    status?: string;
    lastPaymentDate?: string;
    delivered_at?: string | null;
    attendance_status?: string | null;
    packType?: 'fruits' | 'food' | 'dairy';
    unitType?: DairyUnit;
    unitVolume?: number;
    deliveryShift?: DeliveryShift;
    emptyBottlesHeld?: number;
    mealSlots?: string;
    attendance_records?: { status: string, meal_type: string, updated_at?: string }[];
  }[];
  totalDeliveries?: number;
  deliveryUserId?: number;
  deliveryManName?: string;
  distanceKm?: number;
  deliveryCharge?: number;
  balance?: number;
  extraFields?: { label: string, value: string }[] | string;
  cookingInstructions?: string;
  parcelLabelName?: string;
  nutritionalGoal?: string;
}

export interface Category {
  id: string;
  name: string;
  createdAt?: string;
}

export interface Pack {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  categoryName?: string;
  billingCycle: 'weekly' | 'monthly' | 'daily';
  billingDays?: number | string;
  fruits?: string;
  extraNotes?: string;
  packType?: 'fruits' | 'food' | 'dairy';
  unitType?: DairyUnit;
  unitVolume?: number;
  deliveryShift?: DeliveryShift;
  mealSlots?: string;
  customerCount?: number;
}

export interface PaymentHistory {
  id: number;
  customerId: string;
  customerName: string;
  customerMobile: string;
  amount: number;
  currency: string;
  paymentStatus: 'success' | 'failed' | 'pending' | 'paid';
  paymentMethod: string;
  razorpayPaymentId?: string;
  transactionDate: string;
  paymentDate?: string;
  description?: string;
  subscriptionStatus?: string;
  invoice_string?: string;
}

export interface DeliveryUser {
  id: string;
  name: string;
  mobile: string;
  address?: string;
}

export type Page = 'login' | 'dashboard' | 'customers' | 'add-customer' | 'edit-customer' | 'settings' | 'users' | 'add-user' | 'edit-user' | 'reports' | 'payment-status' | 'categories' | 'subscription' | 'payment-history' | 'attendance' | 'invoice' | 'delivery-user' | 'reviews' | 'withdrawals' | 'logs';

export interface Review {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_mobile: string;
  delivery_user_id: number;
  delivery_man_name?: string;
  delivery_man_mobile?: string;
  rating: number;
  feedback: string;
  created_at: string;
  image1?: string;
  image2?: string;
  image3?: string;
  image4?: string;
  image5?: string;
}

export interface BusinessSettings {
  businessName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  businessLogo?: string;
  smsReminders?: boolean;
  emailNotifications: boolean;
  reminderDaysBefore: string;
  defaultPackPrice: string;
  currency: string;
  whatsappEnabled: boolean;
  whatsappApiKey: string;
  whatsappPhoneNumberId: string;
  whatsappBusinessAccountId: string;
  whatsappReminderTemplate: string;
  smsReminderTemplate?: string;
  smsTemplateId?: string;
  reminderTime: string;
  timezone?: string;
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  upiId?: string;
  preferredPaymentMethod?: 'razorpay' | 'upi';
  planType?: 'basic' | 'free' | 'trial' | 'starter' | 'growth' | 'pro' | 'enterprise';
  deliveryCharges: string;
  deliveryFreeKm: string;
  deliveryPricePerKm: string;
  googleMapsApiKey?: string;
  privacyPolicy?: string;
  termsConditions?: string;
  businessType?: 'fruits' | 'food' | 'dairy';
  packagingType?: PackagingType;
  morningShiftTime?: string;
  eveningShiftTime?: string;
  bottleDeposit?: number;
  whatsappOtpTemplate?: string;
  invoicePrefix?: string;
  invoiceStartNumber?: string;
}

export interface AdminNotification {
  id: string;
  type: 'delivery' | 'review' | 'subscription' | 'withdrawal' | 'general';
  title: string;
  description: string;
  timestamp: string; // ISO string
  read: boolean;
  targetPage?: Page;
  meta?: any;
}