import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Common types handled by @types/node or vite

const API_BASE_URL = (import.meta as any).env.VITE_API_URL;
const UPLOAD_BASE_URL = API_BASE_URL ? new URL(API_BASE_URL).origin : '';

export { API_BASE_URL, UPLOAD_BASE_URL };

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Add auth token to requests
api.interceptors.request.use((config: any) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Handle  401 errors (logout)
api.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = import.meta.env.BASE_URL;
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    sendOtp: (data: { email: string; purpose?: string }) => 
        api.post('/auth/send-otp', data),

    register: (data: {
        fullName: string;
        email: string;
        password: string;
        otp: string;
        phone?: string;
        role?: string;
        businessName?: string;
        zone?: string | string[];
    }) => api.post('/auth/register', data),

    login: (data: { email: string; password: string }) =>
        api.post('/auth/login', data),

    getProfile: () => api.get('/auth/profile'),

    updateProfile: (data: {
        fullName: string;
        phone?: string;
        businessName?: string;
    }) => api.put('/auth/profile', data),

    changePassword: (data: any) => api.post('/auth/change-password', data),

    getAllUsers: () => api.get('/auth/users'),

    updateUser: (id: string, data: {
        fullName?: string;
        email?: string;
        phone?: string;
        role?: string;
        businessName?: string;
        permissions?: string[];
        zone?: string | string[];
    }) => api.put(`/auth/users/${id}`, data),

    deleteUser: (id: string) => api.delete(`/auth/users/${id}`)
};

// Customer API
export const customerAPI = {
    getAll: () => api.get('/customers'),

    getOne: (id: string) => api.get(`/customers/${id}`),

    create: (data: any) => api.post('/customers', data),

    update: (id: string, data: any) => api.put(`/customers/${id}`, data),

    delete: (id: string) => api.delete(`/customers/${id}`),

    getDashboardStats: () => api.get('/customers/stats'),

    generateAutopayLink: (data: { customerId: string, amount: number, packName?: string, renewalCycle: string }) => api.post('/customers/autopay-link', data),
    bulkAssignDeliveryUser: (data: { customerIds: string[], deliveryUserId: string }) => api.put('/customers/bulk/assign', data),
    bulkAssignByArea: (data: { areas: string[], deliveryUserId: string }) => api.put('/customers/bulk/assign-area', data),
    bulkUnassignDeliveryUser: (data: { customerIds: string[] }) => api.put('/customers/bulk/unassign', data),
    recalculateDistance: (id: string) => api.post(`/customers/${id}/recalculate-distance`),
    checkMobile: (mobile: string, excludeId?: string) => api.get(`/customers/check-mobile?mobile=${mobile}${excludeId ? `&excludeId=${excludeId}` : ''}`),
    exportCSV: (zone?: string, area?: string, customerIds?: string[]) => {
        let url = '/customers/export/csv?';
        if (zone) url += `zone=${zone}&`;
        if (area) url += `area=${area}&`;
        if (customerIds && customerIds.length > 0) url += `customerIds=${customerIds.join(',')}&`;
        return api.get(url, { responseType: 'blob' as any });
    },
    exportPDF: (zone?: string, area?: string, customerIds?: string[]) => {
        let url = '/customers/export/pdf?';
        if (zone) url += `zone=${zone}&`;
        if (area) url += `area=${area}&`;
        if (customerIds && customerIds.length > 0) url += `customerIds=${customerIds.join(',')}&`;
        return api.get(url, { responseType: 'blob' as any });
    },
    getInsights: () => api.get('/customers/insights'),
};

// Reminder API
export const reminderAPI = {
    send: (data: { customerId: string; sendVia: 'sms' | 'whatsapp'; message?: string }) =>
        api.post('/reminders/send', data),

    sendBulk: (data: { customerIds: string[]; sendVia: 'sms' | 'whatsapp' }) =>
        api.post('/reminders/send-bulk', data),

    getHistory: (customerId: string) =>
        api.get(`/reminders/history/${customerId}`),

    getAllHistory: () =>
        api.get('/reminders/history'),

    schedule: (data: { customerId: string; scheduledDate: string }) =>
        api.post('/reminders/schedule', data),

    scheduleBulk: (data: { customerIds: string[]; scheduledDate: string; sendVia: 'sms' | 'whatsapp' }) =>
        api.post('/reminders/schedule-bulk', data),

    autoSchedule: (data: { customerIds: string[] }) =>
        api.post('/reminders/auto-schedule', data),

    getScheduled: () => api.get('/reminders/scheduled'),
    delete: (id: number) => api.delete(`/reminders/${id}`)
};

// Settings API
export const settingsAPI = {
    get: () => api.get('/settings'),

    update: (data: {
        businessName?: string;
        contactEmail?: string;
        contactPhone?: string;
        address?: string;
        smsReminders?: boolean;
        emailNotifications?: boolean;
        reminderDaysBefore?: string;
        defaultPackPrice?: string;
        currency?: string;
        whatsappEnabled?: boolean;
        whatsappApiKey?: string;
        whatsappPhoneNumberId?: string;
        whatsappBusinessAccountId?: string;
        whatsappReminderTemplate?: string;
        smsReminderTemplate?: string;
        smsTemplateId?: string;
        reminderTime?: string;
        razorpayKeyId?: string;
        razorpayKeySecret?: string;
        whatsappOtpTemplate?: string;
    }) => api.put('/settings', data)
};

// Subscription API
export const subscriptionAPI = {
    getStatus: () => api.get('/subscription/status'),
    getPlans: () => api.get('/subscription/plans'),
    createPlan: (data: { planName: string, amount: number, description: string, planType?: string, billingPeriod?: string }) =>
        api.post('/subscription/plans', data),
    createSubscription: (data: { planId: string, customerName: string, customerEmail: string, customerPhone: string, planType?: string, billingPeriod?: string }) =>
        api.post('/subscription/create', data),
    cancel: (subscriptionId: string) =>
        api.post('/subscription/cancel', { subscriptionId }),
    activate: (data: { userId: number, durationMonths: number }) =>
        api.post('/subscription/activate', data),
    getInvoices: () =>
        api.get('/subscription/invoices'),
    getInvoiceDetail: (invoiceId: string) =>
        api.get(`/subscription/invoices/${invoiceId}`),
    downloadInvoicePDF: (invoiceId: string) =>
        api.get(`/subscription/invoices/${invoiceId}/download`, {
            responseType: 'blob' as any
        }),
    getHistory: () =>
        api.get('/subscription/history'),
    verifySubscription: (subscriptionId: string) =>
        api.get(`/subscription/verify/${subscriptionId}`)
};

// Category API
export const categoryAPI = {
    getAll: () => api.get('/categories'),
    create: (data: { name: string }) => api.post('/categories', data),
    delete: (id: string) => api.delete(`/categories/${id}`)
};

// Pack API
export const packAPI = {
    getAll: () => api.get('/packs'),
    create: (data: { name: string, categoryId: string, price: number, billingCycle: string, fruits?: string, extraNotes?: string, packType?: string, mealSlots?: string }) => api.post('/packs', data),
    update: (id: string, data: { name: string, categoryId: string, price: number, billingCycle: string, fruits?: string, extraNotes?: string, packType?: string, mealSlots?: string }) => api.put(`/packs/${id}`, data),
    delete: (id: string) => api.delete(`/packs/${id}`)
};

// Payment History API
export const paymentHistoryAPI = {
    getAll: (customerId?: string) => {
        const url = customerId ? `/payment-history?customerId=${customerId}` : '/payment-history';
        return api.get(url);
    },
    getByCustomer: (customerId: string) => api.get(`/payment-history/customer/${customerId}`),
    record: (data: {
        customerId: string | number;
        amount: number;
        currency?: string;
        paymentStatus: string;
        paymentMethod?: string;
        transactionDate?: string;
        description?: string;
        deliveryCharge?: number;
        distanceKm?: number;
    }) => api.post('/payment-history/record', data),
    markPaid: (data: {
        customerId: string;
        paymentDate?: string;
        packId?: number;
        packIds?: number[];
        packDates?: Record<number, string>;
        recordPayment?: boolean;
        customChargeName?: string;
        customChargeAmount?: number;
        manualDeliveryCharge?: number;
        amountPaid?: number;
        balance?: number;
    }) => api.post('/payment-history/mark-paid', data),
    delete: (paymentHistoryId: number) => api.delete(`/payment-history/${paymentHistoryId}`),
    exportCSV: (customerId?: string, paymentIds?: number[]) => {
        let url = customerId ? `/payment-history/export/csv?customerId=${customerId}` : '/payment-history/export/csv';
        if (paymentIds && paymentIds.length > 0) {
            url += (url.includes('?') ? '&' : '?') + `paymentIds=${paymentIds.join(',')}`;
        }
        return api.get(url, { responseType: 'blob' as any });
    },
    exportHistoryPDF: (paymentIds?: number[]) => {
        let url = '/payment-history/export/pdf-history';
        if (paymentIds && paymentIds.length > 0) {
            url += `?paymentIds=${paymentIds.join(',')}`;
        }
        return api.get(url, { responseType: 'blob' as any });
    },
    exportPDF: (paymentId: number) => api.get(`/payment-history/export/pdf/${paymentId}`, { responseType: 'blob' as any })
};

// Attendance API
export const attendanceAPI = {
    // Get customers with today's or a specific date's attendance status
    getCustomersForDate: (date: string) =>
        api.get(`/attendance/customers?date=${date}`),

    // Get all attendance records (optional date filter)
    getAll: (date?: string) =>
        api.get(date ? `/attendance?date=${date}` : '/attendance'),

    // Save single attendance
    save: (data: { customerId: string; date: string; status: 'present' | 'absent' | 'holiday'; note?: string }) =>
        api.post('/attendance', data),

    // Save bulk attendance for multiple customers on one date
    saveBulk: (data: { date: string; records: Array<{ customerId: string; status: string; note?: string }> }) =>
        api.post('/attendance/bulk', data),

    // Save holiday for entire zone
    saveZoneHoliday: (data: { zone: string; date: string }) =>
        api.post('/attendance/zone-holiday', data),

    // Get attendance summary for a customer
    getSummary: (customerId: string, month?: number, year?: number) => {
        let url = `/attendance/summary?customerId=${customerId}`;
        if (month) url += `&month=${month}`;
        if (year) url += `&year=${year}`;
        return api.get(url);
    }
};

// Report API
export const reportAPI = {
    getDashboard: (timeframe?: string) =>
        api.get(timeframe ? `/reports/dashboard?timeframe=${timeframe}` : '/reports/dashboard'),
    exportCSV: (timeframe?: string, zone?: string, area?: string) => {
        let url = timeframe ? `/reports/export/csv?timeframe=${timeframe}` : '/reports/export/csv?';
        if (zone) url += `&zone=${zone}`;
        if (area) url += `&area=${area}`;
        return api.get(url, { responseType: 'blob' as any });
    },
    exportPDF: (timeframe?: string, zone?: string, area?: string) => {
        let url = timeframe ? `/reports/export/pdf?timeframe=${timeframe}` : '/reports/export/pdf?';
        if (zone) url += `&zone=${zone}`;
        if (area) url += `&area=${area}`;
        return api.get(url, { responseType: 'blob' as any });
    }
};

// Delivery User API
export const deliveryUserAPI = {
    getAll: () => api.get('/delivery-user'),
    create: (data: { name: string, mobile: string, address?: string }) => api.post('/delivery-user', data),
    update: (id: string, data: { name: string, mobile: string, address?: string }) => api.put(`/delivery-user/${id}`, data),
    delete: (id: string) => api.delete(`/delivery-user/${id}`),
    getAssignedCustomers: (id: string) => api.get(`/delivery-user/${id}/customers`)
};

// Review API
export const reviewAPI = {
    getAll: (type: 'delivery' | 'vendor' | 'custom' = 'delivery') => api.get(`/reviews/all?type=${type}`)
};

// Withdrawal API
export const withdrawalAPI = {
    getAll: () => api.get('/withdrawals'),
    updateStatus: (id: number, status: 'approved' | 'rejected') => api.put(`/withdrawals/${id}/status`, { status })
};

export default api;
