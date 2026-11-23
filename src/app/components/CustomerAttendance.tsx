import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import {
    Calendar, CheckCircle, Save, RefreshCw, ChevronLeft, ChevronRight,
    Users, User, Truck, PauseCircle, Settings2, Coffee, TrendingDown, MapPin,
    X, ChevronDown, ListChecks, Search as SearchIcon, List, Eye, Package, Phone, ArrowLeft, MoreHorizontal, AlertCircle, Download, Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api, { packAPI } from '../services/api';
import { Customer, Pack, Category } from '../types';

type AttendanceStatus = 'delivered' | 'customer_pause' | 'service_pause' | 'holiday' | null;

interface CustomerWithAttendance {
    id: string;
    name: string;
    mobile: string;
    renewal_cycle: string;
    total_deliveries: number;
    subscription_start_date: string | null;
    renewal_date: string | null;
    attendance_status: AttendanceStatus;
    present_count: number;
    absent_count: number;
    holiday_count: number;
    delivered_at?: string | null;
    address?: string;
    address2?: string;
    area?: string;
    zone?: string;
    landmark?: string;
    packs?: {
        customerPackId: number;
        packId: number;
        name: string;
        quantity: number;
        startDate?: string | null;
        renewalDate?: string | null;
        renewalCycle?: string | null;
        totalDeliveries?: number;
        present_count?: number;
        absent_count?: number;
        holiday_count?: number;
        attendance_status?: AttendanceStatus | null;
        delivered_at?: string | null;
        status?: string;
        packType?: 'fruits' | 'food';
        mealSlots?: string;
        attendance_records?: any;
    }[];
    status?: string;
    pack_id?: number | string;
    pack_name?: string;
    packType?: 'fruits' | 'food';
    attendance_records?: any;
}

const STATUS_CONFIG = {
    delivered: {
        label: 'DELIVERED',
        icon: Truck,
        activeClass: 'bg-green-500 text-white border-green-500 shadow-green-200 shadow-md',
        inactiveClass: 'bg-white text-green-700 border-green-200 hover:bg-green-50',
        statColor: 'bg-green-50/50 border-green-100 text-green-600',
        dot: 'bg-green-500',
    },
    customer_pause: {
        label: 'PAUSED',
        icon: PauseCircle,
        activeClass: 'bg-orange-500 text-white border-orange-500 shadow-orange-200 shadow-md',
        inactiveClass: 'bg-white text-orange-700 border-orange-200 hover:bg-orange-50',
        statColor: 'bg-orange-50/50 border-orange-100 text-orange-600',
        dot: 'bg-orange-500',
    },
    service_pause: {
        label: 'PAUSED',
        icon: Settings2,
        activeClass: 'bg-green-500 text-white border-green-500 shadow-green-200 shadow-md',
        inactiveClass: 'bg-white text-green-700 border-green-200 hover:bg-green-50',
        statColor: 'bg-green-50/50 border-green-100 text-green-600',
        dot: 'bg-green-500',
    },
    holiday: {
        label: 'HOLIDAY',
        icon: Coffee,
        activeClass: 'bg-amber-500 text-white border-amber-500 shadow-amber-200 shadow-md',
        inactiveClass: 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50',
        statColor: 'bg-amber-50/50 border-amber-100 text-amber-600',
        dot: 'bg-amber-500',
    },
} as const;

const ALL_STATUSES = ['delivered', 'customer_pause', 'service_pause', 'holiday'] as const;

function formatDateLocal(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function isSunday(dateStr: string): boolean {
    return new Date(dateStr + 'T00:00:00').getDay() === 0;
}

/**
 * Count delivery days (Mon–Sat) from fromDate to toDate inclusive12345
 */
function countDeliveryDays(fromDateStr: string, toDateStr: string): number {
    if (!fromDateStr || !toDateStr || fromDateStr > toDateStr) return 0;
    let count = 0;
    let d = new Date(fromDateStr + 'T00:00:00');
    const end = new Date(toDateStr + 'T00:00:00');
    while (d <= end) {
        if (d.getDay() !== 0) count++;
        d.setDate(d.getDate() + 1);
    }
    return count;
}

// ---- Locality Normalization Helper ----
const normalizeLocality = (text: string) => {
    if (!text) return '';
    return text.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
};

// ---- Custom Mini Calendar ----
interface MiniCalendarProps {
    value: string;
    maxDate: string;
    onChange: (date: string) => void;
}

function MiniCalendar({ value, maxDate, onChange }: MiniCalendarProps) {
    const [viewDate, setViewDate] = useState(() => {
        const d = new Date(value + 'T00:00:00');
        return { year: d.getFullYear(), month: d.getMonth() };
    });
    const [open, setOpen] = useState(false);
    const today = formatDateLocal(new Date());

    const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
    const firstDay = new Date(viewDate.year, viewDate.month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const handleDay = (day: number) => {
        const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (isSunday(dateStr)) return;
        onChange(dateStr);
        setOpen(false);
    };

    const displayValue = new Date(value + 'T00:00:00').toLocaleDateString('en-IN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    return (
        <div className="relative inline-block">
            <button onClick={() => setOpen(o => !o)}
                className="flex items-center gap-3 bg-white border-2 border-green-100 rounded-[20px] px-6 py-3 text-green-700 font-black text-sm hover:border-green-300 hover:shadow-lg transition-all active:scale-95">
                <Calendar className="w-5 h-5 text-green-500" />
                {displayValue}
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setOpen(false)}>
                    <div className="bg-white border border-gray-100 rounded-[32px] shadow-2xl p-6 w-full max-w-xs animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <button onClick={() => setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <ChevronLeft className="w-5 h-5 text-gray-400" />
                            </button>
                            <span className="font-black text-gray-800 text-sm uppercase tracking-widest">{monthNames[viewDate.month]} {viewDate.year}</span>
                            <button onClick={() => setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                                <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="grid grid-cols-7 mb-2">
                            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                                <div key={d} className={`text-center text-[10px] font-black uppercase tracking-tighter py-1 ${d === 'Su' ? 'text-red-400' : 'text-gray-400'}`}>{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {cells.map((day, i) => {
                                if (!day) return <div key={i} />;
                                const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const isSun = isSunday(dateStr);
                                const isSelected = dateStr === value;
                                const isToday = dateStr === today;
                                return (
                                    <button key={i} onClick={() => handleDay(day)} disabled={isSun}
                                        className={`w-9 h-9 rounded-xl text-xs font-black transition-all mx-auto flex items-center justify-center
                                            ${isSelected ? 'bg-green-600 text-white shadow-lg shadow-green-100' :
                                                isToday ? 'bg-green-50 text-green-700' :
                                                    isSun ? 'text-red-200 cursor-not-allowed opacity-30 font-bold' :
                                                        'text-gray-700 hover:bg-gray-50'}`}>
                                        {day}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-50 flex justify-between items-center">
                            <span className="text-[9px] font-black text-red-300 uppercase tracking-widest flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-200" /> Sunday Off
                            </span>
                            <button onClick={() => { onChange(today); setOpen(false); }} className="text-[10px] font-black text-green-600 hover:text-green-800 uppercase tracking-widest border-b-2 border-green-100 hover:border-green-600 transition-all">Go to Today</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}

interface CustomerAttendanceProps {
    isSubscriptionActive?: boolean;
}

export function CustomerAttendance({ isSubscriptionActive = true }: CustomerAttendanceProps) {
    const today = formatDateLocal(new Date());
    const [selectedDate, setSelectedDate] = useState(today);
    const tomorrowDate = useMemo(() => {
        const d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        return formatDateLocal(d);
    }, [selectedDate]);
    const [customers, setCustomers] = useState<CustomerWithAttendance[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [renewalChanges, setRenewalChanges] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeliveryList, setShowDeliveryList] = useState(false);
    const [packs, setPacks] = useState<Pack[]>([]);
    const [fetchingPacks, setFetchingPacks] = useState(false);
    const [businessType, setBusinessType] = useState<'fruits' | 'food' | 'dairy'>('fruits');
    const [packagingType, setPackagingType] = useState<'packet' | 'bottle'>('packet');
    const [dairyShiftFilter, setDairyShiftFilter] = useState<'all' | 'morning' | 'evening'>('all');

    // Meal Selection Modal State
    const [showMealModal, setShowMealModal] = useState(false);
    const [mealModalData, setMealModalData] = useState<{
        customerId: string;
        status: AttendanceStatus;
        customerPackId?: number;
        allowedMeals?: string[];
    } | null>(null);

    // Calendar Modal State
    const [showCalendar, setShowCalendar] = useState(false);
    const [calendarCustomer, setCalendarCustomer] = useState<CustomerWithAttendance | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [areaPage, setAreaPage] = useState(1);
    const itemsPerPage = 12;
    const areasPerPage = 12; // Adjusted to 12 for 4-column grid balance, easily searchable if 10 is strict

    // DRILL DOWN UI STATE
    const [viewLevel, setViewLevel] = useState<'zone' | 'area' | 'list' | 'customer' | 'pack' | 'pack_list' | 'delivery_man' | 'delivery_man_detail' | 'category' | 'delivered_list'>(searchTerm ? 'list' : 'zone');
    const [selectedZone, setSelectedZone] = useState<string | null>(null);
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const [selectedPackId, setSelectedPackId] = useState<number | string | null>(null);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | string | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [fetchingCategories, setFetchingCategories] = useState(false);
    const [isExportMode, setIsExportMode] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerWithAttendance | null>(null);
    const [selectedPackIndex, setSelectedPackIndex] = useState<number | null>(null);
    const [deliveryMen, setDeliveryMen] = useState<any[]>([]);
    const [selectedDeliveryMan, setSelectedDeliveryMan] = useState<any | null>(null);
    const [deliveryTab, setDeliveryTab] = useState<'today' | 'tomorrow'>('today');
    const [tomorrowCustomers, setTomorrowCustomers] = useState<CustomerWithAttendance[]>([]);
    const [loadingTomorrow, setLoadingTomorrow] = useState(false);
    const [showZoneHolidayModal, setShowZoneHolidayModal] = useState(false);

    // Calculate Daily Milking / Depot Procurement Volume for Dairy
    const dairyProcurementSummary = useMemo(() => {
        if (businessType !== 'dairy') return null;

        const summary: Record<string, { packName: string; totalUnits: number; unitType: string; totalVolume: number; morningCount: number; eveningCount: number }> = {};
        let grandTotalLitres = 0;

        customers.forEach(c => {
            const activePacks = (c.packs && c.packs.length > 0)
                ? c.packs.filter(p => p.attendance_status !== 'customer_pause' && p.attendance_status !== 'service_pause' && p.attendance_status !== 'holiday')
                : (c.attendance_status !== 'customer_pause' && c.attendance_status !== 'service_pause' && c.attendance_status !== 'holiday' ? [c] : []);

            activePacks.forEach((p: any) => {
                const name = p.name || p.pack_name || 'Milk';
                const qty = Number(p.quantity || 1);
                const unit = p.unitType || 'litres';
                const vol = Number(p.unitVolume || 1) * qty;
                const shift = p.deliveryShift || 'morning';

                if (!summary[name]) {
                    summary[name] = { packName: name, totalUnits: 0, unitType: unit, totalVolume: 0, morningCount: 0, eveningCount: 0 };
                }
                summary[name].totalUnits += qty;
                summary[name].totalVolume += vol;
                if (shift === 'morning' || shift === 'both') summary[name].morningCount += qty;
                if (shift === 'evening' || shift === 'both') summary[name].eveningCount += qty;

                if (unit === 'litres') grandTotalLitres += vol;
                else if (unit === 'ml') grandTotalLitres += vol / 1000;
            });
        });

        return {
            items: Object.values(summary),
            grandTotalLitres: Math.round(grandTotalLitres * 100) / 100
        };
    }, [customers, businessType]);

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get(`/attendance/customers?date=${selectedDate}`);
            if (res.data.success) {
                const processed = res.data.data.map((c: any) => {
                    // Filter packs to only include 'renewed' ones
                    const renewedPacks = (c.packs || []).filter((p: any) => p.status === 'renewed');
                    return {
                        ...c,
                        id: String(c.id),
                        packs: renewedPacks,
                        total_deliveries: c.total_deliveries || (c.renewal_cycle === 'weekly' ? 6 : 24),
                        attendance_status: c.attendance_status || null,
                        present_count: c.present_count || 0,
                        absent_count: c.absent_count || 0,
                        holiday_count: c.holiday_count || 0,
                    };
                });

                // Final filter: Only show customers who have a 'renewed' status (legacy)
                // OR who have at least one 'renewed' multi-pack
                const filtered = processed.filter((c: any) =>
                    c.status === 'renewed' || c.packs.length > 0
                );

                setCustomers(filtered);
                setAreaPage(1); // Reset area page on new data
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load customers');
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    // Fetch packs for Delivery List Modal
    const fetchPacks = useCallback(async () => {
        setFetchingPacks(true);
        try {
            const res = await api.get('/packs');
            if (res.data.success) {
                setPacks(res.data.packs || []);
            }
        } catch (err) {
            console.error('Failed to fetch packs');
        } finally {
            setFetchingPacks(false);
        }
    }, []);

    // Fetch business settings
    const fetchSettings = useCallback(async () => {
        try {
            const res = await api.get('/settings');
            if (res.data.success && res.data.settings) {
                setBusinessType(res.data.settings.businessType || 'fruits');
                setPackagingType(res.data.settings.packagingType || 'packet');
            }
        } catch (err) {
            console.error('Failed to fetch settings in attendance:', err);
        }
    }, []);

    const fetchDeliveryMen = useCallback(async () => {
        try {
            const res = await api.get('/delivery-user');
            if (res.data.success) {
                const list = res.data.delivery_users || res.data.data;
                setDeliveryMen(Array.isArray(list) ? list : []);
            } else {
                setDeliveryMen([]);
            }
        } catch (e) {
            console.error('Fetch delivery men failed:', e);
            setDeliveryMen([]);
        }
    }, []);

    const fetchCategories = useCallback(async () => {
        setFetchingCategories(true);
        try {
            const res = await api.get('/categories');
            if (res.data.success) {
                setCategories(res.data.categories || []);
            }
        } catch (err) {
            console.error('Failed to fetch categories');
        } finally {
            setFetchingCategories(false);
        }
    }, []);

    const fetchTomorrowCustomers = useCallback(async () => {
        if (loadingTomorrow) return;
        setLoadingTomorrow(true);
        try {
            const tomorrow = new Date(selectedDate + 'T00:00:00');
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateStr = formatDateLocal(tomorrow);

            const res = await api.get(`/attendance/customers?date=${dateStr}`);
            if (res.data.success && Array.isArray(res.data.data)) {
                const processed = res.data.data.map((c: any) => ({
                    id: String(c.id),
                    name: c.name || 'Unknown',
                    mobile: c.mobile || '',
                    renewal_cycle: c.renewal_cycle,
                    total_deliveries: c.total_deliveries,
                    subscription_start_date: c.subscription_start_date,
                    renewal_date: c.renewal_date,
                    pack_id: c.pack_id,
                    status: c.status,
                    address: c.address,
                    address2: c.address2,
                    area: c.area,
                    landmark: c.landmark,
                    location: c.location,
                    zone: c.zone,
                    delivery_user_id: c.delivery_user_id,
                    packs: (c.packs || []).map((p: any) => ({
                        ...p,
                        attendance_status: p.attendance_status || null,
                    })).filter((p: any) => p.status === 'renewed')
                })).filter((c: any) => c.status === 'renewed' || (c.packs && c.packs.length > 0));

                setTomorrowCustomers(processed);
            } else {
                setTomorrowCustomers([]);
            }
        } catch (e) {
            console.error('Fetch tomorrow failed:', e);
            setTomorrowCustomers([]);
        } finally {
            setLoadingTomorrow(false);
        }
    }, [selectedDate, loadingTomorrow]);

    useEffect(() => {
        fetchCustomers();
        fetchPacks();
        fetchSettings();
        fetchDeliveryMen();
        fetchCategories();
    }, [fetchCustomers, fetchPacks, fetchSettings, fetchDeliveryMen, fetchCategories]);

    useEffect(() => {
        if (viewLevel === 'delivery_man_detail' && deliveryTab === 'tomorrow') {
            fetchTomorrowCustomers();
        }
    }, [viewLevel, deliveryTab, fetchTomorrowCustomers]);

    const downloadDeliveryList = (man: any, targetCustomers: any[], date: string) => {
        const pendingCustomers = targetCustomers.map(c => {
            const pendingPacks = (c.packs || []).filter((p: any) => p.status === 'renewed' && p.attendance_status !== 'delivered' && p.attendance_status !== 'customer_pause' && p.attendance_status !== 'service_pause');
            const isSinglePending = (!c.packs || c.packs.length === 0) && c.status === 'renewed' && c.attendance_status !== 'delivered' && c.attendance_status !== 'customer_pause' && c.attendance_status !== 'service_pause';
            return {
                ...c,
                pendingPacks,
                isSinglePending,
                hasPending: pendingPacks.length > 0 || isSinglePending
            };
        }).filter(c => String(c.delivery_user_id) === String(man.id) && c.hasPending);

        if (pendingCustomers.length === 0) {
            toast.error('No pending deliveries assigned to this person for the selected date');
            return;
        }

        const displayDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        const rows = pendingCustomers.map((c, idx) => {
            const packs = c.pendingPacks.length > 0
                ? c.pendingPacks.map((p: any) => `<span style="display:inline-block;background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;margin:2px;">${p.name} (×${p.quantity || 1})</span>`).join('')
                : `<span style="background:#f3f4f6;padding:2px 8px;border-radius:6px;font-size:10px;">${c.pack_name || 'Standard Pack'}</span>`;
            return `
            <tr style="border-bottom:1px solid #f3f4f6;">
                <td style="padding:12px 8px;font-weight:900;font-size:13px;color:#111;text-align:center;width:40px;">${String(idx + 1).padStart(2, '0')}</td>
                <td style="padding:12px 8px;">
                    <div style="font-weight:900;font-size:14px;color:#111;letter-spacing:-0.3px;text-transform:uppercase;">${c.name}</div>
                    <div style="font-size:11px;color:#16a34a;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">${c.area || ''}${c.landmark ? ' · ' + c.landmark : ''}</div>
                    ${c.address ? `<div style="font-size:10px;color:#9ca3af;font-style:italic;margin-top:2px;">${c.address}</div>` : ''}
                </td>
                <td style="padding:12px 8px;">${packs}</td>
                <td style="padding:12px 8px;font-size:12px;font-weight:700;color:#374151;">${c.mobile || ''}</td>
                <td style="padding:12px 8px;text-align:center;">
                    <div style="width:28px;height:28px;border:2px solid #e5e7eb;border-radius:6px;"></div>
                </td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Delivery List - ${man.name} - ${date}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:#111; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  .no-print { text-align:center; padding:16px; background:#f0fdf4; }
  .no-print button { background:#16a34a; color:#fff; border:none; padding:10px 28px; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer; }
</style>
</head>
<body>
  <div class="no-print">
    <button onclick="window.print()">⬇ Save as PDF / Print</button>
  </div>
  <div style="max-width:800px;margin:0 auto;padding:32px 24px;">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #16a34a;">
      <div>
        <div style="font-size:11px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:2px;margin-bottom:4px;">Delivery Route Sheet</div>
        <h1 style="font-size:26px;font-weight:900;color:#111;letter-spacing:-0.5px;">${man.name}</h1>
        <div style="font-size:13px;color:#6b7280;font-weight:600;margin-top:4px;">${man.mobile || ''}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;color:#6b7280;font-weight:600;">${displayDate}</div>
        <div style="margin-top:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 16px;display:inline-block;">
          <span style="font-size:22px;font-weight:900;color:#16a34a;">${pendingCustomers.length}</span>
          <span style="font-size:11px;font-weight:700;color:#16a34a;margin-left:4px;">STOPS</span>
        </div>
      </div>
    </div>
    <!-- Table -->
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f0fdf4;">
          <th style="padding:10px 8px;font-size:10px;font-weight:900;color:#16a34a;text-transform:uppercase;letter-spacing:1px;text-align:center;">#</th>
          <th style="padding:10px 8px;font-size:10px;font-weight:900;color:#16a34a;text-transform:uppercase;letter-spacing:1px;text-align:left;">Customer / Address</th>
          <th style="padding:10px 8px;font-size:10px;font-weight:900;color:#16a34a;text-transform:uppercase;letter-spacing:1px;text-align:left;">Packs</th>
          <th style="padding:10px 8px;font-size:10px;font-weight:900;color:#16a34a;text-transform:uppercase;letter-spacing:1px;text-align:left;">Mobile</th>
          <th style="padding:10px 8px;font-size:10px;font-weight:900;color:#16a34a;text-transform:uppercase;letter-spacing:1px;text-align:center;">Done</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <!-- Footer -->
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:10px;color:#9ca3af;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Watsgo Delivery Management</div>
      <div style="font-size:10px;color:#9ca3af;">Total: ${pendingCustomers.length} customers</div>
    </div>
  </div>
</body></html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        }
    };

    const handleExportPDF = async (catId?: number | string) => {
        const categoryIdToUse = catId || selectedCategoryId;
        if (!categoryIdToUse) {
            toast.error('Please select a category first');
            return;
        }

        try {
            const dateStr = selectedDate;
            const response = await api.get(`/attendance/export?date=${dateStr}&categoryId=${categoryIdToUse}`, {
                responseType: 'blob'
            });

            const categoryName = categories.find(c => String(c.id) === String(categoryIdToUse))?.name || 'Category';
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `DeliveryList_${categoryName}_${dateStr}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Delivery list exported successfully');
        } catch (err) {
            console.error('Export failed:', err);
            toast.error('Failed to export delivery list');
        }
    };

    const setStatus = (customerId: string, status: AttendanceStatus, customerPackId?: number, mealType?: string) => {
        if (selectedDate > today) return; // Only allow today or past

        const cObj = customers.find(c => String(c.id) === String(customerId));

        // If we're pausing or delivering, check if this is a food pack
        // If we're pausing, delivering, or marking holiday, check if this is a food pack
        if (status === 'delivered' || status === 'customer_pause' || status === 'service_pause' || status === 'holiday') {
            const targetPack = customerPackId
                ? cObj?.packs?.find(p => p.customerPackId === customerPackId)
                : cObj;

            const isFoodPack = targetPack?.packType === 'food' || businessType === 'food';

            // If it's a food pack (or global setting is food) and no meal is selected yet, show the modal
            if (isFoodPack && !mealType) {
                const allowedMeals = targetPack?.mealSlots ? targetPack.mealSlots.split(',') : ['breakfast', 'lunch', 'dinner'];
                setMealModalData({ customerId, status, customerPackId, allowedMeals });
                setShowMealModal(true);
                return;
            }
        }

        setCustomers(prev => prev.map(c => {
            if (c.id !== customerId) return c;

            if (customerPackId !== undefined) {
                // Update specific pack status
                return {
                    ...c,
                    packs: (c.packs || []).map(p => {
                        if (p.customerPackId === customerPackId) {
                            const isFood = p.packType === 'food' || businessType === 'food';
                            if (!isFood) {
                                const oldS = p.attendance_status;
                                const newS = oldS === status ? null : status;

                                let newPres = p.present_count || 0;
                                let newAbs = p.absent_count || 0;

                                if (oldS === 'delivered' && newS !== 'delivered') newPres = Math.max(0, newPres - 1);
                                if (newS === 'delivered' && oldS !== 'delivered') newPres += 1;

                                if ((oldS === 'customer_pause' || oldS === 'service_pause' || oldS === 'holiday') && (newS !== 'customer_pause' && newS !== 'service_pause' && newS !== 'holiday')) newAbs = Math.max(0, newAbs - 1);
                                if ((newS === 'customer_pause' || newS === 'service_pause' || newS === 'holiday') && (oldS !== 'customer_pause' && oldS !== 'service_pause' && oldS !== 'holiday')) newAbs += 1;

                                return {
                                    ...p,
                                    attendance_status: newS,
                                    meal_type: null,
                                    attendance_records: newS ? [{ status: newS, meal_type: 'none', updated_at: new Date().toISOString() }] : [],
                                    present_count: newPres,
                                    absent_count: newAbs
                                };
                            }

                            const currentRecords = p.attendance_records || [];
                            const targetMeal = mealType || 'none';
                            const existingIdx = currentRecords.findIndex((r: any) => r.meal_type === targetMeal);
                            let newRecords = [...currentRecords];

                            if (existingIdx >= 0) {
                                if (newRecords[existingIdx].status === status) {
                                    newRecords.splice(existingIdx, 1);
                                } else {
                                    newRecords[existingIdx] = { ...newRecords[existingIdx], status: status! };
                                }
                            } else {
                                newRecords.push({ status: status!, meal_type: targetMeal, updated_at: new Date().toISOString() });
                            }

                            let newPres = p.present_count || 0;
                            let newAbs = p.absent_count || 0;

                            const oldDelivered = currentRecords.filter((r: any) => r.status === 'delivered').length;
                            const newDelivered = newRecords.filter((r: any) => r.status === 'delivered').length;
                            newPres = Math.max(0, newPres + (newDelivered - oldDelivered));

                            const oldPaused = currentRecords.filter((r: any) => r.status === 'customer_pause' || r.status === 'service_pause' || r.status === 'holiday').length;
                            const newPaused = newRecords.filter((r: any) => r.status === 'customer_pause' || r.status === 'service_pause' || r.status === 'holiday').length;
                            newAbs = Math.max(0, newAbs + (newPaused - oldPaused));

                            const lastRec = newRecords[newRecords.length - 1];

                            return {
                                ...p,
                                attendance_records: newRecords,
                                attendance_status: lastRec ? lastRec.status : null,
                                meal_type: lastRec ? lastRec.meal_type : null,
                                present_count: newPres,
                                absent_count: newAbs
                            };
                        }
                        return p;
                    })
                };
            } else {
                // Legacy - customer level status
                const isFood = c.packType === 'food' || businessType === 'food';
                if (!isFood) {
                    const oldS = c.attendance_status;
                    const newS = oldS === status ? null : status;

                    let newPres = c.present_count || 0;
                    let newAbs = c.absent_count || 0;

                    if (oldS === 'delivered' && newS !== 'delivered') newPres = Math.max(0, newPres - 1);
                    if (newS === 'delivered' && oldS !== 'delivered') newPres += 1;

                    if ((oldS === 'customer_pause' || oldS === 'service_pause' || oldS === 'holiday') && (newS !== 'customer_pause' && newS !== 'service_pause' && newS !== 'holiday')) newAbs = Math.max(0, newAbs - 1);
                    if ((newS === 'customer_pause' || newS === 'service_pause' || newS === 'holiday') && (oldS !== 'customer_pause' && oldS !== 'service_pause' && oldS !== 'holiday')) newAbs += 1;

                    return {
                        ...c,
                        attendance_status: newS,
                        meal_type: null,
                        attendance_records: newS ? [{ status: newS, meal_type: 'none', updated_at: new Date().toISOString() }] : [],
                        present_count: newPres,
                        absent_count: newAbs
                    };
                }

                const currentRecords = c.attendance_records || [];
                const targetMeal = mealType || 'none';
                const existingIdx = currentRecords.findIndex((r: any) => r.meal_type === targetMeal);
                let newRecords = [...currentRecords];

                if (existingIdx >= 0) {
                    if (newRecords[existingIdx].status === status) {
                        newRecords.splice(existingIdx, 1);
                    } else {
                        newRecords[existingIdx] = { ...newRecords[existingIdx], status: status! };
                    }
                } else {
                    newRecords.push({ status: status!, meal_type: targetMeal, updated_at: new Date().toISOString() });
                }

                let newPres = c.present_count || 0;
                let newAbs = c.absent_count || 0;

                const oldDelivered = currentRecords.filter((r: any) => r.status === 'delivered').length;
                const newDelivered = newRecords.filter((r: any) => r.status === 'delivered').length;
                newPres = Math.max(0, newPres + (newDelivered - oldDelivered));

                const oldPaused = currentRecords.filter((r: any) => r.status === 'customer_pause' || r.status === 'service_pause' || r.status === 'holiday').length;
                const newPaused = newRecords.filter((r: any) => r.status === 'customer_pause' || r.status === 'service_pause' || r.status === 'holiday').length;
                newAbs = Math.max(0, newAbs + (newPaused - oldPaused));

                const lastRec = newRecords[newRecords.length - 1];

                return {
                    ...c,
                    attendance_records: newRecords,
                    attendance_status: lastRec ? lastRec.status : null,
                    meal_type: lastRec ? lastRec.meal_type : null,
                    present_count: newPres,
                    absent_count: newAbs
                };
            }
        }));
        setSaved(false); // Enable global save button
    };

    const markAll = (status: AttendanceStatus) => {
        // Removed restriction on past dates to allow bulk updates
        setCustomers(prev => prev.map(c => ({
            ...c,
            attendance_status: status,
            packs: (c.packs || []).map(p => ({ ...p, attendance_status: status }))
        })));
    };

    const handleSave = async () => {
        const records: any[] = [];
        customers.forEach(c => {
            const hasPacks = c.packs && c.packs.length > 0;
            if (hasPacks) {
                c.packs!.forEach(p => {
                    const isFood = p.packType === 'food' || businessType === 'food';
                    if (!isFood) {
                        records.push({
                            customerId: Number(c.id),
                            customerPackId: Number(p.customerPackId),
                            status: p.attendance_status || null,
                            mealType: 'none'
                        });
                    } else {
                        const attRecs = p.attendance_records || [];
                        const allowedMeals = p.mealSlots ? p.mealSlots.split(',').map((m: string) => m.trim()).filter(Boolean) : ['breakfast', 'lunch', 'dinner'];
                        allowedMeals.forEach((meal: string) => {
                            const rec = attRecs.find((r: any) => r.meal_type === meal);
                            records.push({
                                customerId: Number(c.id),
                                customerPackId: Number(p.customerPackId),
                                status: rec ? rec.status : null,
                                mealType: meal
                            });
                        });
                    }
                });
            } else {
                const isFood = c.packType === 'food' || businessType === 'food';
                if (!isFood) {
                    records.push({
                        customerId: Number(c.id),
                        status: c.attendance_status || null,
                        mealType: 'none'
                    });
                } else {
                    const attRecs = c.attendance_records || [];
                    const allowedMeals = c.mealSlots ? c.mealSlots.split(',').map((m: string) => m.trim()).filter(Boolean) : ['breakfast', 'lunch', 'dinner'];
                    allowedMeals.forEach((meal: string) => {
                        const rec = attRecs.find((r: any) => r.meal_type === meal);
                        records.push({
                            customerId: Number(c.id),
                            status: rec ? rec.status : null,
                            mealType: meal
                        });
                    });
                }
            }
        });

        if (records.length === 0) { toast.error('No records to save.'); return; }

        setSaving(true);
        setRenewalChanges([]);
        try {
            const res = await api.post('/attendance/bulk', { date: selectedDate, records });
            setSaved(true);
            toast.success('Attendance saved successfully');
            if (res.data.renewalUpdates?.length > 0) setRenewalChanges(res.data.renewalUpdates);
            setTimeout(() => setSaved(false), 3000);
            await fetchCustomers();
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    const changeDate = (offset: number) => {
        let d = new Date(selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + offset);
        while (d.getDay() === 0) d.setDate(d.getDate() + offset);
        setSelectedDate(formatDateLocal(d));
        setCurrentPage(1); // Reset page on date change
    };

    const getStats = () => {
        const stats = { delivered: 0, customer_pause: 0, service_pause: 0, holiday: 0, unmarked: 0 };
        customers.forEach(c => {
            if (c.packs && c.packs.length > 0) {
                c.packs.forEach(p => {
                    const isFood = p.packType === 'food' || businessType === 'food';
                    if (!isFood) {
                        const s = p.attendance_status;
                        if (s === 'delivered') stats.delivered++;
                        else if (s === 'customer_pause') stats.customer_pause++;
                        else if (s === 'service_pause') stats.service_pause++;
                        else if (s === 'holiday') stats.holiday++;
                        else stats.unmarked++;
                    } else {
                        const attRecs = p.attendance_records || [];
                        if (attRecs.length > 0) {
                            if (attRecs.some((r: any) => r.status === 'delivered')) stats.delivered++;
                            else if (attRecs.some((r: any) => r.status === 'customer_pause')) stats.customer_pause++;
                            else if (attRecs.some((r: any) => r.status === 'service_pause')) stats.service_pause++;
                            else if (attRecs.some((r: any) => r.status === 'holiday')) stats.holiday++;
                            else stats.unmarked++;
                        } else {
                            const s = p.attendance_status;
                            if (s === 'delivered') stats.delivered++;
                            else if (s === 'customer_pause') stats.customer_pause++;
                            else if (s === 'service_pause') stats.service_pause++;
                            else if (s === 'holiday') stats.holiday++;
                            else stats.unmarked++;
                        }
                    }
                });
            } else {
                const isFood = c.packType === 'food' || businessType === 'food';
                if (!isFood) {
                    const s = c.attendance_status;
                    if (s === 'delivered') stats.delivered++;
                    else if (s === 'customer_pause') stats.customer_pause++;
                    else if (s === 'service_pause') stats.service_pause++;
                    else if (s === 'holiday') stats.holiday++;
                    else stats.unmarked++;
                } else {
                    const attRecs = c.attendance_records || [];
                    if (attRecs.length > 0) {
                        if (attRecs.some((r: any) => r.status === 'delivered')) stats.delivered++;
                        else if (attRecs.some((r: any) => r.status === 'customer_pause')) stats.customer_pause++;
                        else if (attRecs.some((r: any) => r.status === 'service_pause')) stats.service_pause++;
                        else if (attRecs.some((r: any) => r.status === 'holiday')) stats.holiday++;
                        else stats.unmarked++;
                    } else {
                        const s = c.attendance_status;
                        if (s === 'delivered') stats.delivered++;
                        else if (s === 'customer_pause') stats.customer_pause++;
                        else if (s === 'service_pause') stats.service_pause++;
                        else if (s === 'holiday') stats.holiday++;
                        else stats.unmarked++;
                    }
                }
            }
        });
        return stats;
    };
    const stats = getStats();

    const displayDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return '—';
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Calculate pagination values
    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.mobile.includes(searchTerm);

        const customerArea = normalizeLocality(c.area || 'Other');
        const filterArea = selectedArea ? normalizeLocality(selectedArea) : null;
        const matchesArea = filterArea === null || customerArea === filterArea;

        const matchesPack = selectedPackId === null || (
            c.packs?.some(p => String(p.packId) === String(selectedPackId)) ||
            String(c.pack_id) === String(selectedPackId)
        );

        const matchesCategory = selectedCategoryId === null || (
            c.packs?.some(p => {
                const packInfo = packs.find(pk => String(pk.id) === String(p.packId));
                return packInfo && String(packInfo.categoryId) === String(selectedCategoryId);
            }) ||
            (() => {
                const packInfo = packs.find(pk => String(pk.id) === String(c.pack_id));
                return packInfo && String(packInfo.categoryId) === String(selectedCategoryId);
            })()
        );

        const matchesDelivered = viewLevel !== 'delivered_list' || (
            c.packs?.some(p => p.attendance_status === 'delivered') ||
            c.attendance_status === 'delivered'
        );

        return matchesSearch && matchesArea && matchesPack && matchesCategory && matchesDelivered;
    });

    const uniqueZones = Array.from(new Set(customers.map(c => c.zone || 'Other'))).sort();

    // Normalize area grouping to avoid duplicates like "KK Nagar" and "k.k.nagar"
    const areaMapping = useMemo(() => {
        const mapping: Record<string, string> = {}; // Normalized -> Original
        customers.forEach(c => {
            const rawArea = c.area || 'Other';
            if (!selectedZone || (c.zone || 'Other') === selectedZone) {
                const norm = normalizeLocality(rawArea);
                if (!mapping[norm]) mapping[norm] = rawArea;
            }
        });
        return mapping;
    }, [customers, selectedZone]);

    const uniqueAreas = Object.values(areaMapping).sort();

    const totalZonePages = Math.ceil(uniqueZones.length / areasPerPage);
    const currentZones = uniqueZones.slice((areaPage - 1) * areasPerPage, areaPage * areasPerPage);

    const totalAreaPages = Math.ceil(uniqueAreas.length / areasPerPage);
    const currentAreas = uniqueAreas.slice((areaPage - 1) * areasPerPage, areaPage * areasPerPage);

    // Calculate pagination values
    const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);

    // Status buttons component
    const StatusButtons = ({ customer, packId }: { customer: CustomerWithAttendance, packId?: number }) => {
        const isPastDate = selectedDate < today;
        const targetObj = packId
            ? customer.packs?.find(p => p.customerPackId === packId)
            : customer;
        const isFood = targetObj ? (targetObj.packType === 'food' || businessType === 'food') : (businessType === 'food');
        const currentStatus = targetObj?.attendance_status;
        const attRecs = targetObj?.attendance_records || [];

        return (
            <div className="flex flex-wrap gap-2">
                {ALL_STATUSES.filter(s => s !== 'service_pause').map(s => {
                    const cfg = STATUS_CONFIG[s];
                    const Icon = cfg.icon;
                    const matchingRecs = attRecs.filter((r: any) => r.status === s);
                    const isActive = isFood ? (matchingRecs.length > 0 || currentStatus === s) : (currentStatus === s);
                    const matchingMeals = isFood ? matchingRecs.map((r: any) => r.meal_type).filter((m: any) => m && m !== 'none') : [];
                    const disabled = !isSubscriptionActive;

                    return (
                        <button
                            key={s}
                            onClick={() => !disabled && setStatus(customer.id, s, packId)}
                            disabled={disabled}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-all
                                ${isActive ? cfg.activeClass : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-600'} 
                                ${disabled ? 'grayscale opacity-30 cursor-not-allowed' : ''}`}
                        >
                            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-gray-300'}`} />
                            <span className="shrink-0">{cfg.label}</span>
                            {isActive && isFood && matchingMeals.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-[8px] font-black uppercase">
                                    {matchingMeals.join(', ')}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        );
    };

    // Delivery summary (Delivered count + Remaining days based on cycle total)
    const DeliverySummary = ({ customer, packIndex }: { customer: CustomerWithAttendance, packIndex?: number }) => {
        // If packIndex is provided, only show that specific pack's summary
        const packsToSummary = (packIndex !== undefined && customer.packs && customer.packs[packIndex])
            ? [customer.packs[packIndex]]
            : (customer.packs || []);

        if (packsToSummary.length === 0) {
            const totalDays = customer.total_deliveries || (customer.renewal_cycle === 'weekly' ? 6 : 24);
            const delivered = customer.present_count || 0;
            const paused = customer.absent_count || 0;
            const holidays = customer.holiday_count || 0;
            const remainingDays = Math.max(0, totalDays - delivered);
            const progressPct = totalDays > 0 ? Math.min(100, Math.round((delivered / totalDays) * 100)) : 0;
            return (
                <div className="space-y-2 min-w-[160px]">
                    <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-green-700 font-semibold">
                            <Truck className="w-3.5 h-3.5" /> {delivered} delivered
                        </span>
                        <span className="text-gray-400 font-medium">/ {totalDays} days</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full" style={{ width: `${progressPct}%` }} />
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold">
                        <div className={`flex items-center gap-1 ${remainingDays <= 3 ? 'text-red-600' : 'text-orange-500'}`}>
                            <TrendingDown className="w-3.5 h-3.5" />
                            {remainingDays} left
                        </div>
                        {paused > 0 && <span className="text-orange-400">· {paused}P</span>}
                        {holidays > 0 && <span className="text-amber-400">· {holidays}H</span>}
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-4 min-w-[180px]">
                {packsToSummary.map((p, pIdx) => {
                    const isFood = (p as any).packType === 'food' || businessType === 'food';
                    const mealSlotsStr = (p as any).mealSlots || '';
                    const mealN = isFood && mealSlotsStr ? mealSlotsStr.split(',').filter(Boolean).length : 1;
                    const baseDays = p.totalDeliveries || (p.renewalCycle === 'weekly' ? 6 : 24);
                    // For food packs: total = days × meals per day
                    const packTotal = baseDays * mealN;
                    const delivered = p.present_count || 0;
                    // For food packs: paused meals count; for fruits: paused days count
                    const paused = p.absent_count || 0;
                    const holidays = (p as any).holiday_count || 0;
                    const remaining = Math.max(0, packTotal - delivered - paused);
                    const progress = packTotal > 0 ? Math.min(100, Math.round((delivered / packTotal) * 100)) : 0;

                    return (
                        <div key={pIdx} className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                                <span className="truncate max-w-[110px]">{p.name || 'Pack'}</span>
                                <div className="flex items-center gap-2">
                                    {paused > 0 && (
                                        <span className="text-orange-500 font-bold">{paused} P</span>
                                    )}
                                    {holidays > 0 && (
                                        <span className="text-amber-500 font-bold">{holidays} H</span>
                                    )}
                                    <span className={delivered > 0 ? "text-green-600 font-black" : "text-gray-500 font-black"}>
                                        {delivered} / {packTotal}
                                    </span>
                                </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                <div className="h-full bg-green-500 transition-all duration-500 shadow-sm" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="flex justify-between items-center text-[9px] font-bold">
                                <span className={remaining <= 3 ? 'text-red-600' : 'text-gray-400'}>{remaining} remaining</span>
                                <div className="flex items-center gap-1.5">
                                    {(() => {
                                        if (!isFood) {
                                            if (p.attendance_status === 'customer_pause' || p.attendance_status === 'service_pause') {
                                                return (
                                                    <span className="text-orange-500 animate-pulse flex items-center gap-1 font-bold">
                                                        Paused
                                                    </span>
                                                );
                                            }
                                            return null;
                                        }

                                        const pausedRecs = (p.attendance_records || []).filter((r: any) => r.status === 'customer_pause' || r.status === 'service_pause');
                                        if (pausedRecs.length > 0) {
                                            const meals = pausedRecs.map((r: any) => r.meal_type).filter((m: any) => m && m !== 'none');
                                            return (
                                                <span className="text-orange-500 animate-pulse flex items-center gap-1 font-bold">
                                                    Paused {meals.length > 0 ? `(${meals.join(',')})` : ''}
                                                </span>
                                            );
                                        }
                                        if (p.attendance_status === 'customer_pause' || p.attendance_status === 'service_pause') {
                                            return (
                                                <span className="text-orange-500 animate-pulse flex items-center gap-1 font-bold">
                                                    Paused {(p as any).meal_type ? `(${(p as any).meal_type})` : ''}
                                                </span>
                                            );
                                        }
                                        return null;
                                    })()}
                                    <span className="text-green-400 font-black">{progress}%</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    // DERIVED STATE: Always get the most up-to-date customer and pack from the main list
    const activeCustomer = selectedCustomer ? customers.find(c => c.id === selectedCustomer.id) || selectedCustomer : null;

    // Find active pack in the up-to-date customer object
    const activePack = (activeCustomer && selectedPackIndex !== null && activeCustomer.packs)
        ? activeCustomer.packs[selectedPackIndex]
        : null;

    // -- Derived active customer data to ensure UI sync --
    const activeCustomerData = customers.find(c => c.id === selectedCustomer?.id) || selectedCustomer;

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto pb-24">
            {/* Header / Stats Navigation Section */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 md:p-8 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">Customer Attendance</h1>
                        <p className="text-gray-500 font-medium mt-1">Daily Delivery & Subscription Management</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-start md:justify-end gap-3 w-full md:w-auto min-w-0 flex-1">
                        <div className="relative group flex-1 sm:flex-initial min-w-[200px]">
                            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-focus-within:text-green-600 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    if (viewLevel === 'area' || viewLevel === 'zone' || viewLevel === 'pack_list' || viewLevel === 'category' || viewLevel === 'delivered_list') {
                                        setViewLevel('list');
                                        setSelectedArea(null);
                                        setSelectedZone(null);
                                        setSelectedPackId(null);
                                        setSelectedCategoryId(null);
                                    }
                                    setCurrentPage(1);
                                }}
                                className="pl-10 sm:pl-12 pr-4 sm:pr-6 py-2.5 sm:py-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-xs sm:text-sm font-bold focus:ring-4 focus:ring-green-500/10 focus:border-green-500 w-full sm:w-80 outline-none transition-all"
                            />
                        </div>

                        <button
                            onClick={() => setShowDeliveryList(true)}
                            className="flex items-center justify-center gap-2 p-2.5 sm:px-6 sm:py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-green-200 active:scale-95 flex-shrink-0"
                            title="Delivery List"
                        >
                            <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">Delivery List</span>
                        </button>

                        <button
                            onClick={() => {
                                setViewLevel('category');
                                setIsExportMode(true);
                            }}
                            className="flex items-center justify-center gap-2 p-2.5 sm:px-6 sm:py-3.5 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black transition-all shadow-xl shadow-green-200 active:scale-95 flex-shrink-0"
                            title="Export Today List"
                        >
                            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">Export Today List</span>
                        </button>

                        <button
                            onClick={() => setShowZoneHolidayModal(true)}
                            className="flex items-center justify-center gap-2 p-2.5 sm:px-6 sm:py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black transition-all shadow-xl shadow-amber-200 active:scale-95 flex-shrink-0"
                            title="Zone Holiday"
                        >
                            <Coffee className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden sm:inline">Zone Holiday</span>
                        </button>
                    </div>
                </div>

                {/* Stats & Date Section */}
                <div className="p-6 bg-gray-50/50 grid grid-cols-1 lg:grid-cols-2 gap-8 border-b border-gray-100">
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                        <button onClick={() => changeDate(-1)} className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-green-600 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <MiniCalendar value={selectedDate} maxDate={today} onChange={setSelectedDate} />
                        <button onClick={() => changeDate(1)} className="p-3 bg-white border border-gray-100 text-gray-400 hover:text-green-600 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                        <div className="ml-4 pl-4 border-l border-gray-100 py-1 flex flex-col justify-center">
                            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest leading-none mb-1">{displayDate}</h3>
                            <button onClick={() => setSelectedDate(today)} className="text-[10px] w-fit font-black text-green-600 hover:text-green-700 uppercase tracking-tighter flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                Current Day
                            </button>
                        </div>
                    </div>

                    <div className="flex gap-2 min-h-[70px] bg-white p-2 rounded-[24px] border border-gray-100 shadow-sm overflow-x-auto scrollbar-hide">
                        {ALL_STATUSES.filter(s => s !== 'service_pause').map(s => {
                            const cfg = STATUS_CONFIG[s];
                            const count = stats[s as keyof typeof stats];
                            return (
                                <div key={s} className="min-w-[110px] flex-1">
                                    <div className={`${cfg.statColor} border border-white/50 rounded-2xl p-2.5 flex flex-col items-center justify-center transition-all hover:shadow-md`}>
                                        <p className="text-xl font-black leading-none mb-1">{count}</p>
                                        <p className="text-[9px] font-black uppercase tracking-tighter opacity-80">{cfg.label}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                {/* Dairy Daily Procurement & Depot Loading Summary */}
                {businessType === 'dairy' && dairyProcurementSummary && dairyProcurementSummary.items.length > 0 && (
                    <div className="p-6 bg-gradient-to-r from-green-50/90 via-emerald-50/60 to-teal-50/60 border-b border-green-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                            <div className="flex items-center gap-2.5">
                                <span className="p-2 bg-green-600 text-white rounded-xl shadow-md shadow-green-200">
                                    <Package className="w-5 h-5" />
                                </span>
                                <div>
                                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        Dairy Daily Procurement & Loading Sheet
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 bg-green-100 text-green-800 rounded-md border border-green-200">
                                            {packagingType === 'bottle' ? '🍾 Glass Bottle Mode' : '⚪ Packet Mode'}
                                        </span>
                                    </h4>
                                    <p className="text-xs font-semibold text-green-700">Total volume required for {selectedDate} deliveries</p>
                                </div>
                            </div>
                            <div className="px-4 py-2 bg-white/95 border border-green-200 rounded-2xl shadow-sm flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Grand Total Volume:</span>
                                <span className="text-lg font-black text-green-700">{dairyProcurementSummary.grandTotalLitres} Litres</span>
                            </div>
                        </div>

                        {/* Product Breakdown Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
                            {dairyProcurementSummary.items.map((item, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-2xl border border-green-100 shadow-sm flex flex-col justify-between hover:border-green-300 transition-all">
                                    <span className="text-xs font-bold text-gray-700 truncate">{item.packName}</span>
                                    <div className="mt-2 flex items-baseline justify-between">
                                        <span className="text-base font-black text-gray-900">{item.totalVolume} {item.unitType === 'litres' ? 'L' : item.unitType}</span>
                                        <span className="text-[10px] font-bold text-gray-400">({item.totalUnits} pkts)</span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between text-[9px] font-bold text-gray-500 border-t border-gray-100 pt-1">
                                        <span className="text-green-700 font-semibold">☀️ {item.morningCount}</span>
                                        <span className="text-emerald-700 font-semibold">🌙 {item.eveningCount}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Breadcrumb & Shift Navigation */}
            <div className="flex items-center gap-2 px-2 overflow-x-auto scrollbar-hide py-1">
                {businessType === 'dairy' && (
                    <div className="flex items-center gap-1.5 mr-2 bg-green-50/80 p-1 rounded-2xl border border-green-100 shrink-0">
                        <button
                            onClick={() => setDairyShiftFilter('all')}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all ${
                                dairyShiftFilter === 'all' ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'text-gray-600 hover:text-green-700 hover:bg-white'
                            }`}
                        >
                            All Shifts
                        </button>
                        <button
                            onClick={() => setDairyShiftFilter('morning')}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 ${
                                dairyShiftFilter === 'morning' ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'text-gray-600 hover:text-green-700 hover:bg-white'
                            }`}
                        >
                            ☀️ Morning
                        </button>
                        <button
                            onClick={() => setDairyShiftFilter('evening')}
                            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 ${
                                dairyShiftFilter === 'evening' ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'text-gray-600 hover:text-green-700 hover:bg-white'
                            }`}
                        >
                            🌙 Evening
                        </button>
                    </div>
                )}
                <button
                    onClick={() => {
                        setViewLevel('delivered_list');
                        setSelectedZone(null);
                        setSelectedArea(null);
                        setSelectedCustomer(null);
                        setSelectedPackIndex(null);
                        setSelectedPackId(null);
                        setSelectedCategoryId(null);
                        setIsExportMode(false);
                        setCurrentPage(1);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${viewLevel === 'delivered_list' ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                >
                    <CheckCircle className="w-4 h-4" /> Delivered Today
                </button>

                <button
                    onClick={() => {
                        setViewLevel('list');
                        setSelectedZone(null);
                        setSelectedArea(null);
                        setSelectedCustomer(null);
                        setSelectedPackIndex(null);
                        setSelectedPackId(null);
                        setSelectedCategoryId(null);
                        setIsExportMode(false);
                        setCurrentPage(1);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${viewLevel === 'list' && !selectedZone && !selectedArea && !selectedPackId && !selectedCategoryId ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                >
                    <Users className="w-4 h-4" /> All
                </button>

                <button
                    onClick={() => {
                        setViewLevel('zone');
                        setSelectedZone(null);
                        setSelectedArea(null);
                        setSelectedCustomer(null);
                        setSelectedPackIndex(null);
                        setSelectedPackId(null);
                        setSelectedCategoryId(null);
                        setIsExportMode(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${(viewLevel === 'zone' || viewLevel === 'area' || viewLevel === 'pack_list') && !selectedPackId && !selectedCategoryId ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                >
                    <ListChecks className="w-4 h-4" /> Zones
                </button>

                <button
                    onClick={() => {
                        setViewLevel('category');
                        setSelectedZone(null);
                        setSelectedArea(null);
                        setSelectedCustomer(null);
                        setSelectedPackIndex(null);
                        setSelectedPackId(null);
                        setSelectedCategoryId(null);
                        setIsExportMode(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${viewLevel === 'category' ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                >
                    <List className="w-4 h-4" /> Categories
                </button>

                {/* Sub-filters for Category view */}
                {viewLevel === 'category' && (
                    <>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setViewLevel('zone');
                                setSelectedZone(null);
                                setSelectedArea(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 bg-white border border-gray-100 text-gray-400 hover:bg-green-600 hover:text-white"
                        >
                            <MapPin className="w-4 h-4" /> Zone
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setViewLevel('pack_list');
                                setSelectedPackId(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 bg-white border border-gray-100 text-gray-400 hover:bg-green-600 hover:text-white"
                        >
                            <Package className="w-4 h-4" /> Packs
                        </button>
                    </>
                )}

                {/* Zone breadcrumb - shows when a zone is selected */}
                {selectedZone !== null && (viewLevel === 'area' || viewLevel === 'pack_list' || (viewLevel === 'list' && selectedArea !== null) || selectedPackId !== null) && (
                    <>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setViewLevel('area');
                                setSelectedArea(null);
                                setSelectedCustomer(null);
                                setSelectedPackIndex(null);
                                setSelectedPackId(null);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${viewLevel === 'area' ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                        >
                            <MapPin className="w-4 h-4" /> {selectedZone || 'Other'}
                        </button>
                    </>
                )}

                {/* Pack breadcrumb button - appears while viewing areas so user can pick a pack */}
                {selectedZone !== null && viewLevel === 'area' && (
                    <>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setSelectedArea(null);
                                setSelectedPackId(null);
                                setViewLevel('pack_list');
                                setCurrentPage(1);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 bg-white border border-gray-100 text-gray-400 hover:bg-green-600 hover:text-white hover:border-green-600 hover:shadow-lg"
                        >
                            <Package className="w-4 h-4" /> Pack
                        </button>
                    </>
                )}

                {/* Area breadcrumb - shows when area is selected, takes back to customer list */}
                {selectedArea !== null && selectedPackId === null && (
                    <>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setViewLevel('list');
                                setSelectedPackId(null);
                                setSelectedCustomer(null);
                                setSelectedPackIndex(null);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${viewLevel === 'list' && !selectedPackId ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                        >
                            <Truck className="w-4 h-4" /> {selectedArea || 'Other'}
                        </button>
                    </>
                )}

                {/* Pack breadcrumb - shows when a pack is selected */}
                {selectedPackId !== null && (
                    <>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setViewLevel(selectedCategoryId ? 'list' : 'pack_list');
                                setSelectedPackId(null);
                                setSelectedCustomer(null);
                                setSelectedPackIndex(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 bg-green-600 text-white shadow-lg"
                        >
                            <Package className="w-4 h-4" /> {(packs || []).find(p => String(p.id) === String(selectedPackId))?.name || 'Selected Pack'}
                        </button>
                    </>
                )}

                {selectedCategoryId !== null && (
                    <>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setViewLevel('category');
                                setSelectedCategoryId(null);
                                setSelectedPackId(null);
                                setSelectedCustomer(null);
                                setSelectedPackIndex(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 bg-green-600 text-white shadow-lg"
                        >
                            <List className="w-4 h-4" /> {(categories || []).find(cat => String(cat.id) === String(selectedCategoryId))?.name || 'Selected Category'}
                        </button>
                    </>
                )}

                {selectedCategoryId !== null && viewLevel === 'list' && (
                    <>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setViewLevel('zone');
                                setSelectedZone(null);
                                setSelectedArea(null);
                                setSelectedPackId(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 bg-white border border-gray-100 text-gray-400 hover:bg-green-600 hover:text-white hover:border-green-600 hover:shadow-lg"
                        >
                            <MapPin className="w-4 h-4" /> Zone
                        </button>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setViewLevel('pack_list');
                                setSelectedPackId(null);
                                setSelectedZone(null);
                                setSelectedArea(null);
                            }}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 bg-white border border-gray-100 text-gray-400 hover:bg-green-600 hover:text-white hover:border-green-600 hover:shadow-lg"
                        >
                            <Package className="w-4 h-4" /> Packs
                        </button>
                    </>
                )}

                {selectedCustomer && (
                    <>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            onClick={() => {
                                setViewLevel('customer');
                                setSelectedPackIndex(null);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shrink-0 ${viewLevel === 'customer' ? 'bg-green-600 text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                        >
                            <User className="w-4 h-4" /> {selectedCustomer.name}
                        </button>
                    </>
                )}

                {activePack && (
                    <>
                        <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                        <button
                            className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm bg-green-600 text-white shadow-lg shrink-0"
                        >
                            <Package className="w-4 h-4" /> {activePack.name}
                        </button>
                    </>
                )}

                {selectedCategoryId && (
                    <button
                        onClick={() => handleExportPDF()}
                        className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-green-200 hover:bg-green-700 hover:scale-105 transition-all shrink-0 ml-auto mr-2 group"
                    >
                        <Download className="w-4 h-4 group-hover:animate-bounce" /> Export Category PDF
                    </button>
                )}
            </div>

            {/* MAIN CONTENT AREA with DRILL DOWN */}
            <div className="min-h-[400px]">
                <AnimatePresence mode="wait">
                    {/* LEVEL -1: DELIVERY MAN SELECTION */}
                    {viewLevel === 'delivery_man' && (
                        <motion.div
                            key="delivery_man"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        >
                            {!Array.isArray(deliveryMen) || deliveryMen.length === 0 ? (
                                <div className="col-span-full py-24 flex flex-col items-center gap-4 text-gray-400">
                                    <Truck className="w-12 h-12 text-gray-200" />
                                    <p className="font-black uppercase tracking-widest">No Delivery Men Found</p>
                                </div>
                            ) : (
                                <>
                                    {deliveryMen.map(man => {
                                        const manCustomers = customers.filter(c => String(c.delivery_user_id) === String(man.id));
                                        return (
                                            <button
                                                key={man.id}
                                                onClick={() => {
                                                    setSelectedDeliveryMan(man);
                                                    setViewLevel('delivery_man_detail');
                                                    setDeliveryTab('today');
                                                }}
                                                className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[40px] border border-gray-100 shadow-sm hover:shadow-2xl hover:border-green-400 hover:-translate-y-2 transition-all text-left group relative overflow-hidden flex flex-col min-h-[150px]"
                                            >
                                                <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                                    <ChevronRight className="w-8 h-8 text-green-500" />
                                                </div>
                                                <div className="w-12 h-12 md:w-16 md:h-16 bg-green-50 rounded-2xl md:rounded-3xl flex items-center justify-center mb-4 md:mb-6 group-hover:bg-green-600 transition-colors">
                                                    <User className="w-6 h-6 md:w-8 md:h-8 text-green-600 group-hover:text-white" />
                                                </div>
                                                <h3 className="text-xl font-black text-gray-900 mb-1">{man.name}</h3>
                                                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                    <Phone className="w-3 h-3" /> {man.mobile}
                                                </div>
                                                <div className="mt-4 text-xs font-bold text-green-600 uppercase tracking-widest bg-green-50 px-3 py-1 rounded-lg w-fit">
                                                    {manCustomers.length} Assigned
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* LEVEL -2: DELIVERY MAN DETAIL (Today/Tomorrow) */}
                    {viewLevel === 'delivery_man_detail' && selectedDeliveryMan && (
                        <motion.div
                            key="delivery_man_detail"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex flex-col gap-6"
                        >
                            <div className="bg-white p-6 md:p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 bg-green-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-green-100">
                                        <User className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900">{selectedDeliveryMan.name}</h2>
                                        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{selectedDeliveryMan.mobile}</p>
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        onClick={() => downloadDeliveryList(selectedDeliveryMan, deliveryTab === 'today' ? customers : tomorrowCustomers, deliveryTab === 'today' ? selectedDate : tomorrowDate)}
                                        className="px-6 py-3 bg-gray-900 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-xl hover:bg-black flex items-center gap-2 active:scale-95"
                                    >
                                        <Download className="w-4 h-4" /> Download List
                                    </button>
                                    <div className="flex bg-gray-50 p-2 rounded-2xl">
                                        <button
                                            onClick={() => setDeliveryTab('today')}
                                            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${deliveryTab === 'today' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            Today
                                        </button>
                                        {/* <button 
                                            onClick={() => setDeliveryTab('tomorrow')}
                                            className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${deliveryTab === 'tomorrow' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                        >
                                            Tomorrow
                                        </button> */}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {deliveryTab === 'tomorrow' && loadingTomorrow ? (
                                    <div className="col-span-full py-24 flex flex-col items-center gap-4 text-gray-400">
                                        <RefreshCw className="w-12 h-12 animate-spin text-green-500" />
                                        <p className="font-black uppercase tracking-widest">Fetching Tomorrow's Schedule...</p>
                                    </div>
                                ) : (
                                    <>
                                        {(deliveryTab === 'today' ? customers : tomorrowCustomers)
                                            .filter(c => String(c.delivery_user_id) === String(selectedDeliveryMan.id))
                                            .length === 0 ? (
                                            <div className="col-span-full bg-white py-24 rounded-[40px] border border-gray-100 shadow-sm flex flex-col items-center gap-4 text-gray-400">
                                                <Truck className="w-12 h-12 text-gray-100" />
                                                <p className="font-black uppercase tracking-widest">No deliveries for {deliveryTab}</p>
                                            </div>
                                        ) : (
                                            (deliveryTab === 'today' ? customers : tomorrowCustomers)
                                                .filter(c => String(c.delivery_user_id) === String(selectedDeliveryMan.id))
                                                .map(customer => (
                                                    <div
                                                        key={customer.id}
                                                        className="bg-white p-6 rounded-[32px] border border-gray-50 shadow-sm hover:shadow-md transition-all flex items-center justify-between group"
                                                    >
                                                        <div className="flex items-center gap-6">
                                                            <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-gray-400 group-hover:bg-green-50 group-hover:text-green-600 transition-colors">
                                                                {customer.name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-gray-900">{customer.name}</h4>
                                                                <div className="flex items-center gap-3 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                                                    <span>{customer.area}</span>
                                                                    <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                                    <span>{customer.mobile}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            {customer.packs && customer.packs.map((p: any) => (
                                                                <div key={p.customerPackId} className="px-3 py-1 bg-green-50 text-green-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                                                    {p.name} ({p.quantity})
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                        )
                                        }
                                    </>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* LEVEL -2: PACK SELECTION */}
                    {viewLevel === 'pack_list' && (
                        <motion.div
                            key="pack_list"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        >
                            {fetchingPacks ? (
                                <div className="col-span-full py-24 flex flex-col items-center gap-4 text-gray-400">
                                    <RefreshCw className="w-12 h-12 animate-spin text-green-500" />
                                    <p className="font-black uppercase tracking-widest">Loading Packs...</p>
                                </div>
                            ) : (
                                <>
                                    {packs.map(pack => {
                                        // Filter by zone+area if navigated from area drill-down
                                        const filteredCustomers = customers.filter(c => {
                                            if (selectedZone && (c.zone || 'Other') !== selectedZone) return false;
                                            if (selectedArea && normalizeLocality(c.area || 'Other') !== normalizeLocality(selectedArea)) return false;
                                            return true;
                                        });

                                        const packCustomersCount = filteredCustomers.filter(c =>
                                            c.packs?.some(p => String(p.packId) === String(pack.id) && p.status === 'renewed') ||
                                            (String(c.pack_id) === String(pack.id) && c.status === 'renewed')
                                        ).length;

                                        const packDelivered = filteredCustomers.reduce((acc, c) => {
                                            let delivered = 0;
                                            if (c.packs && c.packs.length > 0) {
                                                delivered += c.packs.filter(p => String(p.packId) === String(pack.id) && p.status === 'renewed' && p.attendance_status === 'delivered').length;
                                            } else if (String(c.pack_id) === String(pack.id) && c.status === 'renewed' && c.attendance_status === 'delivered') {
                                                delivered += 1;
                                            }
                                            return acc + delivered;
                                        }, 0);

                                        const totalPackInstances = filteredCustomers.reduce((acc, c) => {
                                            let count = 0;
                                            if (c.packs && c.packs.length > 0) {
                                                count += c.packs.filter(p => String(p.packId) === String(pack.id) && p.status === 'renewed').length;
                                            } else if (String(c.pack_id) === String(pack.id) && c.status === 'renewed') {
                                                count += 1;
                                            }
                                            return acc + count;
                                        }, 0);

                                        if (totalPackInstances === 0) return null;

                                        return (
                                            <button
                                                key={pack.id}
                                                onClick={() => {
                                                    setSelectedPackId(pack.id);
                                                    setViewLevel('list');
                                                    setCurrentPage(1);
                                                }}
                                                className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-green-400 hover:-translate-y-1 transition-all text-left group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
                                            >
                                                <div className="flex items-start gap-5">
                                                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-green-600 transition-colors">
                                                        <Package className="w-7 h-7 text-green-600 group-hover:text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-xl font-black text-gray-900 truncate leading-tight mb-1">{pack.name}</h3>
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{packCustomersCount} CUSTOMERS</p>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{totalPackInstances} UNITS</p>
                                                                <span className="text-[10px] font-black text-green-600 tracking-widest">{Math.round((packDelivered / (totalPackInstances || 1)) * 100)}% DONE</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                                                        style={{ width: `${(packDelivered / (totalPackInstances || 1)) * 100}%` }}
                                                    />
                                                </div>

                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                    <ChevronRight className="w-5 h-5 text-green-500" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* LEVEL -3: CATEGORY SELECTION */}
                    {viewLevel === 'category' && (
                        <motion.div
                            key="category"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        >
                            {fetchingCategories ? (
                                <div className="col-span-full py-24 flex flex-col items-center gap-4 text-gray-400">
                                    <RefreshCw className="w-12 h-12 animate-spin text-green-500" />
                                    <p className="font-black uppercase tracking-widest">Loading Categories...</p>
                                </div>
                            ) : (
                                <>
                                    {categories.map(cat => {
                                        const catCustomersCount = customers.filter(c =>
                                            c.packs?.some(p => {
                                                const packInfo = packs.find(pk => String(pk.id) === String(p.packId));
                                                return packInfo && String(packInfo.categoryId) === String(cat.id);
                                            }) ||
                                            (() => {
                                                const packInfo = packs.find(pk => String(pk.id) === String(c.pack_id));
                                                return packInfo && String(packInfo.categoryId) === String(cat.id);
                                            })()
                                        ).length;

                                        const catDelivered = customers.reduce((acc, c) => {
                                            let delivered = 0;
                                            if (c.packs && c.packs.length > 0) {
                                                delivered += c.packs.filter(p => {
                                                    const packInfo = packs.find(pk => String(pk.id) === String(p.packId));
                                                    return packInfo && String(packInfo.categoryId) === String(cat.id) && p.attendance_status === 'delivered';
                                                }).length;
                                            } else {
                                                const packInfo = packs.find(pk => String(pk.id) === String(c.pack_id));
                                                if (packInfo && String(packInfo.categoryId) === String(cat.id) && c.attendance_status === 'delivered') {
                                                    delivered += 1;
                                                }
                                            }
                                            return acc + delivered;
                                        }, 0);

                                        const totalCatPacks = customers.reduce((acc, c) => {
                                            let count = 0;
                                            if (c.packs && c.packs.length > 0) {
                                                count += c.packs.filter(p => {
                                                    const packInfo = packs.find(pk => String(pk.id) === String(p.packId));
                                                    return packInfo && String(packInfo.categoryId) === String(cat.id);
                                                }).length;
                                            } else {
                                                const packInfo = packs.find(pk => String(pk.id) === String(c.pack_id));
                                                if (packInfo && String(packInfo.categoryId) === String(cat.id)) {
                                                    count += 1;
                                                }
                                            }
                                            return acc + count;
                                        }, 0);

                                        if (totalCatPacks === 0) return null;

                                        return (
                                            <button
                                                key={cat.id}
                                                onClick={() => {
                                                    setSelectedCategoryId(cat.id);
                                                    if (isExportMode) {
                                                        handleExportPDF(cat.id);
                                                        setIsExportMode(false);
                                                    }
                                                    setViewLevel('list');
                                                    setCurrentPage(1);
                                                }}
                                                className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-green-400 hover:-translate-y-1 transition-all text-left group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
                                            >
                                                <div className="flex items-start gap-5">
                                                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-green-600 transition-colors">
                                                        <List className="w-7 h-7 text-green-600 group-hover:text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-xl font-black text-gray-900 truncate leading-tight mb-1">{cat.name}</h3>
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{catCustomersCount} CUSTOMERS</p>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{totalCatPacks} PACKS</p>
                                                                <span className="text-[10px] font-black text-green-600 tracking-widest">{Math.round((catDelivered / (totalCatPacks || 1)) * 100)}% DONE</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                                                        style={{ width: `${(catDelivered / (totalCatPacks || 1)) * 100}%` }}
                                                    />
                                                </div>

                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                    <ChevronRight className="w-5 h-5 text-green-500" />
                                                </div>
                                            </button>
                                        );
                                    })}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* LEVEL -1: ZONE SELECTION */}
                    {viewLevel === 'zone' && (
                        <motion.div
                            key="zone"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        >
                            {loading ? (
                                <div className="col-span-full py-24 flex flex-col items-center gap-4 text-gray-400">
                                    <RefreshCw className="w-12 h-12 animate-spin text-green-500" />
                                    <p className="font-black uppercase tracking-widest">Loading Zones...</p>
                                </div>
                            ) : (
                                <>
                                    {currentZones.map(zoneName => {
                                        const zoneCustomers = customers.filter(c => (c.zone || 'Other') === zoneName);
                                        const zoneAreas = Array.from(new Set(zoneCustomers.map(c => c.area || 'Other'))).length;
                                        const zoneDelivered = zoneCustomers.reduce((acc, c) => {
                                            let delivered = 0;
                                            if (c.packs && c.packs.length > 0) {
                                                delivered += c.packs.filter(p => p.attendance_status === 'delivered').length;
                                            } else if (c.attendance_status === 'delivered') {
                                                delivered += 1;
                                            }
                                            return acc + delivered;
                                        }, 0);
                                        const totalPacks = zoneCustomers.reduce((acc, c) => acc + (c.packs?.length || 1), 0);

                                        return (
                                            <button
                                                key={zoneName}
                                                onClick={() => {
                                                    setSelectedZone(zoneName === 'Other' ? '' : zoneName);
                                                    setViewLevel('area');
                                                    setAreaPage(1);
                                                }}
                                                className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-green-400 hover:-translate-y-1 transition-all text-left group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
                                            >
                                                <div className="flex items-start gap-5">
                                                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-green-600 transition-colors">
                                                        <MapPin className="w-7 h-7 text-green-600 group-hover:text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-xl font-black text-gray-900 truncate leading-tight mb-1">{zoneName}</h3>
                                                        <div className="space-y-0.5">
                                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{zoneAreas} AREAS</p>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{zoneCustomers.length} CUSTOMERS</p>
                                                                <span className="text-[10px] font-black text-green-600 tracking-widest">{Math.round((zoneDelivered / (totalPacks || 1)) * 100)}% DONE</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                                                        style={{ width: `${(zoneDelivered / (totalPacks || 1)) * 100}%` }}
                                                    />
                                                </div>

                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                    <ChevronRight className="w-5 h-5 text-green-500" />
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {/* Zone Pagination */}
                                    {totalZonePages > 1 && (
                                        <div className="col-span-full py-8 mt-4 border-t border-gray-100 flex items-center justify-between">
                                            <p className="text-sm font-bold text-gray-400">Page {areaPage} of {totalZonePages}</p>
                                            <div className="flex gap-2">
                                                <button onClick={() => setAreaPage(p => Math.max(1, p - 1))} disabled={areaPage === 1} className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30">
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => setAreaPage(p => Math.min(totalZonePages, p + 1))} disabled={areaPage === totalZonePages} className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30">
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* LEVEL 0: AREA SELECTION */}
                    {viewLevel === 'area' && (
                        <motion.div
                            key="area"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                        >
                            {loading ? (
                                <div className="col-span-full py-24 flex flex-col items-center gap-4 text-gray-400">
                                    <RefreshCw className="w-12 h-12 animate-spin text-green-500" />
                                    <p className="font-black uppercase tracking-widest">Loading Areas...</p>
                                </div>
                            ) : (
                                <>
                                    {currentAreas.map(areaName => {
                                        const areaCustomers = customers.filter(c =>
                                            normalizeLocality(c.area || 'Other') === normalizeLocality(areaName) &&
                                            (!selectedZone || (c.zone || 'Other') === selectedZone)
                                        );
                                        const areaDelivered = areaCustomers.reduce((acc, c) => {
                                            let delivered = 0;
                                            if (c.packs && c.packs.length > 0) {
                                                delivered += c.packs.filter(p => p.attendance_status === 'delivered').length;
                                            } else if (c.attendance_status === 'delivered') {
                                                delivered += 1;
                                            }
                                            return acc + delivered;
                                        }, 0);
                                        const totalPacks = areaCustomers.reduce((acc, c) => acc + (c.packs?.length || 1), 0);

                                        return (
                                            <button
                                                key={areaName}
                                                onClick={() => {
                                                    setSelectedArea(areaName === 'Other' ? '' : areaName);
                                                    setViewLevel('list');
                                                    setSelectedPackId(null);
                                                    setCurrentPage(1);
                                                }}
                                                className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl hover:border-green-400 hover:-translate-y-1 transition-all text-left group relative overflow-hidden flex flex-col justify-between min-h-[160px]"
                                            >
                                                <div className="flex items-start gap-5">
                                                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-green-600 transition-colors">
                                                        <Truck className="w-7 h-7 text-green-600 group-hover:text-white" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-xl font-black text-gray-900 truncate leading-tight mb-1">{areaName}</h3>
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{areaCustomers.length} CUSTOMERS</p>
                                                                <span className="text-[10px] font-black text-green-600 tracking-widest">{Math.round((areaDelivered / (totalPacks || 1)) * 100)}% DONE</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-4 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-500"
                                                        style={{ width: `${(areaDelivered / (totalPacks || 1)) * 100}%` }}
                                                    />
                                                </div>

                                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                    <ChevronRight className="w-5 h-5 text-green-500" />
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {/* Area Pagination */}
                                    {totalAreaPages > 1 && (
                                        <div className="col-span-full py-8 mt-4 border-t border-gray-100 flex items-center justify-between">
                                            <p className="text-sm font-bold text-gray-400">Page {areaPage} of {totalAreaPages}</p>
                                            <div className="flex gap-2">
                                                <button onClick={() => setAreaPage(p => Math.max(1, p - 1))} disabled={areaPage === 1} className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30">
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => setAreaPage(p => Math.min(totalAreaPages, p + 1))} disabled={areaPage === totalAreaPages} className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30">
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* LEVEL 1: ALL CUSTOMERS LIST */}
                    {(viewLevel === 'list' || viewLevel === 'delivered_list') && (
                        <motion.div
                            key="list"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                        >
                            {loading ? (
                                <div className="col-span-full py-24 flex flex-col items-center gap-4 text-gray-400">
                                    <RefreshCw className="w-12 h-12 animate-spin text-green-500" />
                                    <p className="font-black uppercase tracking-widest">Refreshing Base Data...</p>
                                </div>
                            ) : currentCustomers.length === 0 ? (
                                <div className="col-span-full py-24 text-center border-4 border-dashed border-gray-50 rounded-[40px]">
                                    <Users className="w-16 h-16 mx-auto mb-4 text-gray-200" />
                                    <p className="text-gray-400 font-bold">No customers match your criteria</p>
                                </div>
                            ) : (
                                <>
                                    {currentCustomers.map(customer => {
                                        const isMultiPack = customer.packs && customer.packs.length > 1;
                                        return (
                                            <button
                                                key={customer.id}
                                                onClick={() => {
                                                    setSelectedCustomer(customer);
                                                    setViewLevel('customer');
                                                    setSelectedPackIndex(null);
                                                }}
                                                className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-green-400 transition-all text-left group flex items-center gap-4 relative overflow-hidden"
                                            >
                                                <div className="w-12 h-12 md:w-14 md:h-14 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-gray-400 group-hover:bg-green-50 group-hover:text-green-600 transition-all border border-gray-100 shrink-0">
                                                    {customer.name[0]}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-base md:text-lg font-black text-gray-900 truncate leading-tight">{customer.name}</h3>
                                                        <span className="text-xs font-bold text-gray-400 hidden sm:block">{customer.mobile}</span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        {customer.packs && customer.packs.length > 0 ? (
                                                            customer.packs.map((p, i) => {
                                                                const isFood = p.packType === 'food' || businessType === 'food';
                                                                const attRecs = p.attendance_records || [];
                                                                const deliveredRecs = attRecs.filter((r: any) => r.status === 'delivered');
                                                                const pausedRecs = attRecs.filter((r: any) => r.status === 'customer_pause' || r.status === 'service_pause');
                                                                const isDelivered = isFood ? (deliveredRecs.length > 0 || p.attendance_status === 'delivered') : (p.attendance_status === 'delivered');
                                                                const isPaused = isFood ? (pausedRecs.length > 0 || p.attendance_status === 'customer_pause' || p.attendance_status === 'service_pause') : (p.attendance_status === 'customer_pause' || p.attendance_status === 'service_pause');
                                                                const deliveredMeals = isFood ? deliveredRecs.map((r: any) => r.meal_type).filter((m: any) => m && m !== 'none') : [];
                                                                const pausedMeals = isFood ? pausedRecs.map((r: any) => r.meal_type).filter((m: any) => m && m !== 'none') : [];
                                                                const deliveryTime = p.delivered_at ? new Date(p.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                                                return (
                                                                    <div key={i} className="flex items-center gap-1">
                                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 ${isDelivered ? 'bg-green-600 text-white shadow-sm' : isPaused ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'}`}>
                                                                            {isDelivered && <CheckCircle className="w-2.5 h-2.5" />}
                                                                            {isPaused && !isDelivered && <PauseCircle className="w-2.5 h-2.5" />}
                                                                            {p.name} {isDelivered ? (isFood && deliveredMeals.length > 0 ? `(Delivered: ${deliveredMeals.join(',')})` : '(Delivered)') : isPaused ? (isFood && pausedMeals.length > 0 ? `(Paused: ${pausedMeals.join(',')})` : '(Paused)') : '(Pending)'}
                                                                        </span>
                                                                        {isDelivered && deliveryTime && (
                                                                            <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md border border-green-100">
                                                                                {deliveryTime}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            (() => {
                                                                const isFood = customer.packType === 'food' || businessType === 'food';
                                                                const attRecs = customer.attendance_records || [];
                                                                const deliveredRecs = attRecs.filter((r: any) => r.status === 'delivered');
                                                                const pausedRecs = attRecs.filter((r: any) => r.status === 'customer_pause' || r.status === 'service_pause');
                                                                const isDelivered = isFood ? (deliveredRecs.length > 0 || customer.attendance_status === 'delivered') : (customer.attendance_status === 'delivered');
                                                                const isPaused = isFood ? (pausedRecs.length > 0 || customer.attendance_status === 'customer_pause' || customer.attendance_status === 'service_pause') : (customer.attendance_status === 'customer_pause' || customer.attendance_status === 'service_pause');
                                                                const deliveredMeals = isFood ? deliveredRecs.map((r: any) => r.meal_type).filter((m: any) => m && m !== 'none') : [];
                                                                const pausedMeals = isFood ? pausedRecs.map((r: any) => r.meal_type).filter((m: any) => m && m !== 'none') : [];
                                                                const deliveryTime = customer.delivered_at ? new Date(customer.delivered_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                                                return (
                                                                    <div className="flex items-center gap-1">
                                                                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 ${isDelivered ? 'bg-green-600 text-white shadow-sm' : isPaused ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-400'}`}>
                                                                            {isDelivered && <CheckCircle className="w-2.5 h-2.5" />}
                                                                            {isPaused && !isDelivered && <PauseCircle className="w-2.5 h-2.5" />}
                                                                            Standard Pack {isDelivered ? (isFood && deliveredMeals.length > 0 ? `(Delivered: ${deliveredMeals.join(',')})` : '(Delivered)') : isPaused ? (isFood && pausedMeals.length > 0 ? `(Paused: ${pausedMeals.join(',')})` : '(Paused)') : '(Pending)'}
                                                                        </span>
                                                                        {isDelivered && deliveryTime && (
                                                                            <span className="text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded-md border border-green-100">
                                                                                {deliveryTime}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 shrink-0 px-2">
                                                    {isMultiPack && (
                                                        <div className="hidden md:flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">{customer.packs?.length} Packs</span>
                                                        </div>
                                                    )}
                                                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-green-500 transition-colors" />
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {/* Pagination */}
                                    {totalPages > 1 && (
                                        <div className="col-span-full py-8 mt-4 border-t border-gray-100 flex items-center justify-between">
                                            <p className="text-sm font-bold text-gray-400">Page {currentPage} of {totalPages}</p>
                                            <div className="flex gap-2">
                                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30">
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30">
                                                    <ChevronRight className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* LEVEL 2: CUSTOMER PACKS OVERVIEW */}
                    {viewLevel === 'customer' && activeCustomer && (
                        <motion.div
                            key="customer"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            <div className="bg-white p-6 md:p-8 rounded-3xl md:rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                                    <div className="flex items-center gap-4 md:gap-6">
                                        <div className="w-16 h-16 md:w-20 md:h-20 bg-green-50 text-green-600 rounded-2xl md:rounded-[24px] flex items-center justify-center font-black text-xl md:text-2xl shadow-inner uppercase">
                                            {activeCustomer.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h2 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">{activeCustomer.name}</h2>
                                            <p className="text-xs md:text-sm text-gray-400 font-bold flex items-center gap-2 mt-1">
                                                <Phone className="w-4 h-4" /> {activeCustomer.mobile}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 md:gap-4">
                                        <button
                                            onClick={() => { setCalendarCustomer(activeCustomer); setShowCalendar(true); }}
                                            className="flex-1 md:flex-initial px-4 md:px-6 py-2.5 md:py-3 bg-green-50 text-green-600 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-green-100 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Calendar className="w-4 h-4" /> View Calendar
                                        </button>
                                        <button
                                            onClick={() => setViewLevel('list')}
                                            className="p-2.5 md:p-3 bg-gray-50 text-gray-400 rounded-xl md:rounded-2xl hover:text-green-600 transition-all active:scale-90"
                                        >
                                            <ArrowLeft className="w-6 h-6" />
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {(activeCustomer.packs && activeCustomer.packs.length > 0) ? (
                                        activeCustomer.packs.filter((p: any) => p.status === 'renewed').map((p, idx) => {
                                            const cfg = p.attendance_status ? STATUS_CONFIG[p.attendance_status as keyof typeof STATUS_CONFIG] : null;
                                            return (
                                                <div
                                                    key={idx}
                                                    onClick={() => {
                                                        setSelectedPackIndex(idx);
                                                        setViewLevel('pack');
                                                    }}
                                                    className="group cursor-pointer bg-gray-50/50 hover:bg-white border-2 border-transparent hover:border-green-100 rounded-[32px] p-6 transition-all hover:shadow-2xl hover:scale-[1.02]"
                                                >
                                                    <div className="flex items-center justify-between mb-6">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-600 shadow-sm group-hover:bg-green-600 group-hover:text-white transition-all">
                                                                <Package className="w-6 h-6" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-black text-gray-900">{p.name || 'Standard Pack'}</h4>
                                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type: {p.renewalCycle || 'Subscription'}</p>
                                                            </div>
                                                        </div>
                                                        {cfg && (
                                                            <div className={`${cfg.statColor} px-3 py-1.5 rounded-xl flex items-center gap-1.5`}>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                                <span className="text-[10px] font-black uppercase tracking-widest">
                                                                    {cfg.label}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <DeliverySummary customer={activeCustomer} packIndex={idx} />

                                                    <div className="mt-4 flex items-center justify-between text-[10px] font-bold border-t border-gray-100/50 pt-3">
                                                        <div className="flex flex-col">
                                                            <span className="text-gray-400 uppercase tracking-widest text-[8px] mb-0.5">Started</span>
                                                            <span className="text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded shadow-sm">{formatDate(p.startDate)}</span>
                                                        </div>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-gray-400 uppercase tracking-widest text-[8px] mb-0.5">Renewal</span>
                                                            <span className="text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded shadow-sm border border-orange-100/30">{formatDate(p.renewalDate)}</span>
                                                        </div>
                                                    </div>

                                                    <div className="mt-4 flex items-center justify-between border-t border-gray-100/50 pt-3">
                                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-tighter">Manage Attendance</span>
                                                        <ChevronRight className="w-5 h-5 text-gray-300 transition-transform group-hover:translate-x-1" />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="col-span-full">
                                            {activeCustomer.pack_id ? (
                                                <button
                                                    onClick={() => {
                                                        setSelectedPackIndex(null);
                                                        setViewLevel('pack');
                                                    }}
                                                    className="w-full py-12 text-center bg-gray-50 rounded-[32px] border-2 border-dashed border-gray-200 hover:border-green-400 hover:bg-green-50/50 transition-all group"
                                                >
                                                    <Package className="w-12 h-12 mx-auto mb-4 text-gray-300 group-hover:text-green-600" />
                                                    <p className="text-gray-400 font-black uppercase tracking-widest text-xs">{activeCustomer.pack_name || 'Standard Subscription Pack'}</p>
                                                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-tighter">Click to mark attendance for primary plan</p>
                                                </button>
                                            ) : (
                                                <div className="py-12 text-center bg-orange-50/50 rounded-[32px] border-2 border-dashed border-orange-200">
                                                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-orange-400" />
                                                    <p className="text-orange-600 font-black uppercase tracking-widest text-xs">No Active Subscription</p>
                                                    <p className="text-[10px] text-orange-500 mt-2 font-bold uppercase tracking-tighter px-6">
                                                        This customer does not have any active packs. <br />
                                                        Assign a pack in Customer Settings to mark attendance.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* LEVEL 3: PACK ATTENDANCE MARKING */}
                    {viewLevel === 'pack' && activeCustomer && (
                        <motion.div
                            key="pack"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="max-w-xl mx-auto px-2"
                        >
                            <div className="bg-white p-6 md:p-10 rounded-[32px] md:rounded-[48px] border border-gray-100 shadow-2xl relative overflow-hidden text-center">
                                <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-green-50/50 to-transparent pointer-events-none"></div>

                                <div className="w-16 h-16 md:w-24 md:h-24 bg-green-600 rounded-2xl md:rounded-[32px] flex items-center justify-center text-white mx-auto relative z-10 shadow-2xl shadow-green-200 mb-6 md:mb-8">
                                    <Package className="w-8 h-8 md:w-12 md:h-12" />
                                </div>

                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-green-100 mb-6 mx-auto">
                                    <Package className="w-3.5 h-3.5" />
                                    {activePack ? activePack.name : 'Primary Pack'}
                                </div>
                                <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-2 uppercase">
                                    {activePack ? activePack.name : 'Subscription Pack'}
                                </h2>
                                <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-8 truncate px-4">Recording Status for {activeCustomer.name}</p>

                                <div className="bg-gray-50/50 rounded-3xl p-6 border border-gray-100 mb-10 text-center">
                                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest mb-2">Mark status for</p>
                                    <p className="text-xl font-black text-green-600">{displayDate}</p>
                                </div>

                                {(() => {
                                    const targetObj = activePack || activeCustomer;
                                    const isFood = targetObj ? (targetObj.packType === 'food' || businessType === 'food') : (businessType === 'food');
                                    const disabled = !isSubscriptionActive;

                                    if (isFood) {
                                        // Inline meal rows: each meal gets Delivered + Paused buttons
                                        const mealSlotsStr = (targetObj as any)?.mealSlots || (activeCustomer as any)?.mealSlots || 'breakfast,lunch,dinner';
                                        const allowedMeals = mealSlotsStr.split(',').map((m: string) => m.trim()).filter(Boolean);
                                        const attRecs = targetObj?.attendance_records || [];

                                        const MEAL_CONFIG: Record<string, { label: string; bg: string; icon: string }> = {
                                            breakfast: { label: 'Breakfast', bg: 'bg-orange-50 border-orange-100', icon: '☕' },
                                            lunch: { label: 'Lunch', bg: 'bg-yellow-50 border-yellow-100', icon: '🌤️' },
                                            dinner: { label: 'Dinner', bg: 'bg-indigo-50 border-indigo-100', icon: '🍽️' },
                                        };

                                        const formatTime = (isoStr: string) => {
                                            try {
                                                const d = new Date(isoStr);
                                                return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                                            } catch { return ''; }
                                        };

                                        return (
                                            <div className="space-y-3 w-full">
                                                {allowedMeals.map((mealId: string) => {
                                                    const cfg = MEAL_CONFIG[mealId] || { label: mealId, time: '', bg: 'bg-gray-50 border-gray-100', icon: '🍴' };
                                                    const rec = attRecs.find((r: any) => r.meal_type === mealId);
                                                    const mealStatus = rec?.status || null;
                                                    const isDelivered = mealStatus === 'delivered';
                                                    const isPaused = mealStatus === 'customer_pause' || mealStatus === 'service_pause';
                                                    const isHoliday = mealStatus === 'holiday';

                                                    return (
                                                        <div key={mealId} className={`flex items-center justify-between p-3 sm:p-4 rounded-2xl border-2 ${cfg.bg} transition-all`}>
                                                            {/* Left: icon + label */}
                                                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                                                <span className="text-xl leading-none">{cfg.icon}</span>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs sm:text-sm font-black text-gray-800 uppercase tracking-wide">{cfg.label}</p>
                                                                    {rec?.updated_at && (
                                                                        <p className="text-[9px] sm:text-[10px] text-gray-500 font-semibold">
                                                                            {formatTime(rec.updated_at)}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {/* Right: Delivered + Paused + Holiday buttons */}
                                                            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                                                                <button
                                                                    disabled={disabled}
                                                                    onClick={() => !disabled && setStatus(activeCustomer!.id, isDelivered ? null as any : 'delivered', activePack?.customerPackId, mealId)}
                                                                    className={`flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all active:scale-95
                                                                        ${isDelivered
                                                                            ? 'bg-green-600 text-white shadow-md shadow-green-200'
                                                                            : 'bg-white text-gray-500 border border-gray-200 hover:border-green-300 hover:text-green-600'}
                                                                        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                                    title="Delivered"
                                                                >
                                                                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span className="hidden sm:inline">Delivered</span>
                                                                </button>
                                                                <button
                                                                    disabled={disabled}
                                                                    onClick={() => !disabled && setStatus(activeCustomer!.id, isPaused ? null as any : 'customer_pause', activePack?.customerPackId, mealId)}
                                                                    className={`flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all active:scale-95
                                                                        ${isPaused
                                                                            ? 'bg-orange-500 text-white shadow-md shadow-orange-200'
                                                                            : 'bg-white text-gray-500 border border-gray-200 hover:border-orange-300 hover:text-orange-500'}
                                                                        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                                    title="Paused"
                                                                >
                                                                    <PauseCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span className="hidden sm:inline">Paused</span>
                                                                </button>
                                                                <button
                                                                    disabled={disabled}
                                                                    onClick={() => !disabled && setStatus(activeCustomer!.id, isHoliday ? null as any : 'holiday', activePack?.customerPackId, mealId)}
                                                                    className={`flex items-center justify-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wide transition-all active:scale-95
                                                                        ${isHoliday
                                                                            ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                                                                            : 'bg-white text-gray-500 border border-gray-200 hover:border-amber-300 hover:text-amber-500'}
                                                                        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                                                                    title="Holiday"
                                                                >
                                                                    <Sun className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span className="hidden sm:inline">Holiday</span>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    }

                                    // Non-food: original grid layout
                                    return (
                                        <div className="grid grid-cols-2 gap-4">
                                            {ALL_STATUSES.filter(s => s !== 'service_pause').map(s => {
                                                const cfg = STATUS_CONFIG[s];
                                                const Icon = cfg.icon;
                                                const attRecs = targetObj?.attendance_records || [];
                                                const matchingRecs = attRecs.filter((r: any) => r.status === s);
                                                const currentStatus = targetObj?.attendance_status;
                                                const isActive = currentStatus === s;

                                                return (
                                                    <button
                                                        key={s}
                                                        onClick={() => !disabled && setStatus(activeCustomer!.id, s, activePack?.customerPackId)}
                                                        disabled={disabled}
                                                        className={`flex flex-col items-center justify-center gap-2 md:gap-4 p-4 md:p-8 rounded-2xl md:rounded-[36px] border-2 transition-all group scale-100 active:scale-95
                                                        ${isActive ? cfg.activeClass : 'bg-white border-gray-100 hover:border-green-100 hover:shadow-xl'}
                                                        ${disabled ? 'grayscale opacity-30 cursor-not-allowed border-dashed' : ''}`}
                                                    >
                                                        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-colors ${isActive ? 'bg-white/20' : 'bg-gray-50 group-hover:bg-green-50'}`}>
                                                            <Icon className={`w-5 h-5 md:w-7 md:h-7 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-green-600'}`} />
                                                        </div>
                                                        <span className={`text-[9px] md:text-[11px] font-black uppercase tracking-widest ${isActive ? 'text-white' : 'text-gray-500'}`}>{cfg.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    );
                                })()}


                                <button
                                    onClick={() => setViewLevel('customer')}
                                    className="mt-12 text-sm font-black text-gray-400 uppercase tracking-widest hover:text-green-600 transition-colors flex items-center justify-center gap-2 mx-auto"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Go Back to Packs
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer Global Save */}
            <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 md:p-6 bg-white/80 backdrop-blur-md border-t border-gray-100 z-40">
                <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
                    <div className="hidden sm:block">
                        <p className="text-sm font-black text-gray-900 uppercase">Batch Summary</p>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                            {stats.delivered} Delivered · {stats.customer_pause + stats.service_pause} Paused · {stats.unmarked} Pending
                        </p>
                    </div>

                    <button
                        onClick={() => isSubscriptionActive && handleSave()}
                        disabled={saving || !isSubscriptionActive}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 md:gap-3 px-6 md:px-12 py-3.5 md:py-4 rounded-xl md:rounded-[20px] font-black text-xs md:text-sm transition-all shadow-2xl active:scale-95 ${saved ? 'bg-green-500 text-white shadow-green-200' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200 disabled:bg-gray-200 disabled:shadow-none'}`}
                    >
                        {saving ? <><RefreshCw className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> Saving Session...</> :
                            saved ? <><CheckCircle className="w-4 h-4 md:w-5 md:h-5" /> All Saved Successfully</> :
                                <><Save className="w-4 h-4 md:w-5 md:h-5" /> Save All Attendance</>}
                    </button>
                </div>
            </div>

            {/* Calendar Modal */}
            {showCalendar && calendarCustomer && (
                <CustomerCalendarModal
                    customer={calendarCustomer}
                    businessType={businessType}
                    onClose={() => {
                        setShowCalendar(false);
                        setCalendarCustomer(null);
                        fetchCustomers(); // Refresh the main list
                    }}
                />
            )}

            {showMealModal && mealModalData && (
                <MealSelectionModal
                    allowedMeals={mealModalData.allowedMeals}
                    status={mealModalData.status}
                    onSelect={(meal) => {
                        setStatus(mealModalData.customerId, mealModalData.status, mealModalData.customerPackId, meal);
                        setShowMealModal(false);
                        setMealModalData(null);
                    }}
                    onClose={() => {
                        setShowMealModal(false);
                        setMealModalData(null);
                    }}
                />
            )}

            {/* Delivery List Modal */}
            {showDeliveryList && (
                <DeliveryListModal
                    onClose={() => setShowDeliveryList(false)}
                    onDownload={downloadDeliveryList}
                />
            )}

            {/* Zone Holiday Modal */}
            {showZoneHolidayModal && (
                <ZoneHolidayModal
                    zones={uniqueZones}
                    currentDate={selectedDate}
                    onClose={() => setShowZoneHolidayModal(false)}
                    onSuccess={() => {
                        fetchCustomers();
                        setShowZoneHolidayModal(false);
                    }}
                />
            )}
        </div>
    );
}

// ---- Delivery List Modal ----
function DeliveryListModal({ onClose, onDownload }: {
    onClose: () => void,
    onDownload: (man: any, targetCustomers: any[], date: string) => void
}) {
    const today = new Date();
    const formatDate = (d: Date) => {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const getTomorrow = () => {
        let d = new Date();
        d.setDate(d.getDate() + 1);
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        return d;
    };

    const todayStr = formatDate(today);
    const tomorrowStr = formatDate(getTomorrow());

    const [activeDate, setActiveDate] = useState(todayStr);
    const [customers, setCustomers] = useState<CustomerWithAttendance[]>([]);
    const [loading, setLoading] = useState(false);

    const [dlZone, setDlZone] = useState<string | null>(null);
    const [dlArea, setDlArea] = useState<string | null>(null);
    const [dlPackId, setDlPackId] = useState<string | null>(null);
    const [dlStaffId, setDlStaffId] = useState<string | null>(null);
    const [dlViewType, setDlViewType] = useState<'zone' | 'pack' | 'staff'>('staff');
    const [staffList, setStaffList] = useState<any[]>([]);

    const fetchStaff = useCallback(async () => {
        try {
            const res = await api.get('/delivery-user');
            if (res.data.success) setStaffList(res.data.delivery_users || []);
        } catch (e) { console.error('Staff fetch failed', e); }
    }, []);

    useEffect(() => { fetchStaff(); }, [fetchStaff]);

    const fetchModalData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/attendance/customers?date=${activeDate}`);
            if (res.data.success) {
                const allData = res.data.data || [];
                const processed = allData.map((c: any) => ({
                    ...c,
                    packs: (c.packs || []).filter((p: any) => p.status === 'renewed')
                }));
                // Only show customers who have at least one 'renewed' pack/subscription
                const renewedOnly = processed.filter((c: any) =>
                    c.status === 'renewed' || c.packs.length > 0
                );
                setCustomers(renewedOnly);
            }
        } catch (err) {
            console.error('Failed to fetch modal customers');
        } finally {
            setLoading(false);
        }
    }, [activeDate]);

    useEffect(() => { fetchModalData(); }, [fetchModalData]);

    // Reset drill-down when date changes or view type changes
    useEffect(() => {
        setDlZone(null); setDlArea(null); setDlPackId(null); setDlStaffId(null);
    }, [activeDate, dlViewType]);

    const displayDate = new Date(activeDate + 'T00:00:00').toLocaleDateString('en-IN', {
        weekday: 'short', day: 'numeric', month: 'short'
    });

    const normArea = (a: string) => a.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

    const inZone = (c: CustomerWithAttendance) =>
        dlZone === null || (c.zone || 'Other') === dlZone;
    const inArea = (c: CustomerWithAttendance) =>
        dlArea === null || normArea(c.area || 'Other') === normArea(dlArea);

    const zones = Array.from(new Set(customers.map(c => c.zone || 'Other'))).sort();

    const areaMap: Record<string, string> = {};
    customers.filter(inZone).forEach(c => {
        const raw = c.area || 'Other';
        const norm = normArea(raw);
        if (!areaMap[norm]) areaMap[norm] = raw;
    });
    const areas = Object.values(areaMap).sort();

    const packMap = new Map<string, { id: string | number; name: string }>();
    customers.filter(inZone).filter(inArea).forEach(c => {
        if (c.packs && c.packs.length > 0) {
            c.packs.forEach(p => {
                if (p.packId && p.status === 'renewed' && !packMap.has(String(p.packId)))
                    packMap.set(String(p.packId), { id: p.packId, name: p.name });
            });
        } else if (c.pack_id && c.status === 'renewed') {
            const key = String(c.pack_id);
            if (!packMap.has(key))
                packMap.set(key, { id: c.pack_id, name: (c as any).pack_name || 'Standard Pack' });
        }
    });
    const packs = Array.from(packMap.values());

    const selectedPack = (packs || []).find(p => String(p.id) === String(dlPackId));

    const packCustomers = customers.filter(c => {
        if (!inZone(c) || !inArea(c)) return false;
        const isPaused = c.attendance_status === 'customer_pause' || c.attendance_status === 'service_pause';
        if (isPaused) return false;
        if (c.packs && c.packs.length > 0)
            return c.packs.some(p => String(p.packId) === String(dlPackId) && p.status === 'renewed');
        return String((c as any).pack_id || '') === String(dlPackId) && c.status === 'renewed';
    });

    const countPackCustomers = (zone: string | null, area: string | null, packId: string) =>
        customers.filter(c => {
            if (zone && (c.zone || 'Other') !== zone) return false;
            if (area && normArea(c.area || 'Other') !== normArea(area)) return false;
            const isPaused = c.attendance_status === 'customer_pause' || c.attendance_status === 'service_pause';
            if (isPaused) return false;
            if (c.packs && c.packs.length > 0)
                return c.packs.some(p => String(p.packId) === packId && p.status === 'renewed');
            return String((c as any).pack_id || '') === packId && c.status === 'renewed';
        }).length;

    const level = dlStaffId ? 'staff_detail' :
        dlPackId ? 'customers' :
            dlViewType === 'zone' ? (dlArea !== null ? 'packs' : dlZone !== null ? 'areas' : 'zones') :
                dlViewType === 'staff' ? 'staff_list' :
                    'packs';

    const selectedStaff = (staffList || []).find(s => String(s.id) === String(dlStaffId));

    // Header title
    const headerTitle =
        level === 'staff_detail' ? `Delivery: ${selectedStaff?.name}` :
            level === 'staff_list' ? 'Delivery Personnel' :
                level === 'customers' ? `Pack: ${selectedPack?.name}` :
                    level === 'packs' ? (dlViewType === 'zone' ? `${dlArea || dlZone || 'All'} — Select Pack` : 'All Categories — Select Category') :
                        level === 'areas' ? `${dlZone} — Select Area` :
                            'Delivery List Manager';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
                            <Truck className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{headerTitle}</h2>
                            <p className="text-sm font-bold text-green-600">{displayDate}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* Date Tabs */}
                <div className="px-6 py-4 border-b border-gray-50 flex gap-4 bg-white">
                    <button
                        onClick={() => setActiveDate(todayStr)}
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all border-2 ${activeDate === todayStr ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-green-200 hover:text-green-500'}`}
                    >
                        TODAY'S LIST
                    </button>
                    <button
                        onClick={() => setActiveDate(tomorrowStr)}
                        className={`flex-1 py-3 rounded-2xl font-bold text-sm transition-all border-2 ${activeDate === tomorrowStr ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 'bg-gray-50 border-gray-100 text-gray-400 hover:border-green-200 hover:text-green-500'}`}
                    >
                        TOMORROW'S LIST
                    </button>
                </div>

                {/* View Type Toggle */}
                <div className="px-4 sm:px-6 py-3 border-b border-gray-50 flex gap-2 sm:gap-3 bg-gray-50/30 overflow-x-auto scrollbar-hide shrink-0">
                    <button
                        onClick={() => { setDlViewType('staff'); setDlZone(null); setDlArea(null); setDlPackId(null); setDlStaffId(null); }}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all border-2 shrink-0 ${dlViewType === 'staff' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 'bg-white border-gray-100 text-gray-400 hover:border-green-200 hover:text-green-600'}`}
                    >
                        <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Delivery Man
                    </button>
                    <button
                        onClick={() => { setDlViewType('zone'); setDlZone(null); setDlArea(null); setDlPackId(null); setDlStaffId(null); }}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all border-2 shrink-0 ${dlViewType === 'zone' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 'bg-white border-gray-100 text-gray-400 hover:border-green-200 hover:text-green-600'}`}
                    >
                        <ListChecks className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Zones
                    </button>
                    <button
                        onClick={() => { setDlViewType('pack'); setDlZone(null); setDlArea(null); setDlPackId(null); setDlStaffId(null); }}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 rounded-xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all border-2 shrink-0 ${dlViewType === 'pack' ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-100' : 'bg-white border-gray-100 text-gray-400 hover:border-green-200 hover:text-green-600'}`}
                    >
                        <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Categories
                    </button>
                </div>

                {/* Breadcrumb */}
                {(dlZone !== null || dlArea !== null || dlPackId !== null) && (
                    <div className="px-6 py-3 border-b border-gray-50 bg-white flex items-center gap-2 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => { setDlZone(null); setDlArea(null); setDlPackId(null); setDlStaffId(null); }}
                            className="flex items-center gap-1.5 text-xs font-black text-green-600 hover:text-green-700 bg-green-50 px-3 py-1.5 rounded-xl shrink-0"
                        >
                            {dlViewType === 'zone' ? (
                                <><MapPin className="w-3.5 h-3.5" /> Zones</>
                            ) : dlViewType === 'pack' ? (
                                <><Package className="w-3.5 h-3.5" /> Categories</>
                            ) : (
                                <><Truck className="w-3.5 h-3.5" /> Delivery Man</>
                            )}
                        </button>
                        {dlZone !== null && (
                            <>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                <button
                                    onClick={() => { setDlArea(null); setDlPackId(null); }}
                                    className={`text-xs font-black px-3 py-1.5 rounded-xl shrink-0 ${dlArea === null && dlPackId === null ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:text-green-700'}`}
                                >
                                    {dlZone}
                                </button>
                            </>
                        )}
                        {dlArea !== null && (
                            <>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                <button
                                    onClick={() => setDlPackId(null)}
                                    className={`text-xs font-black px-3 py-1.5 rounded-xl shrink-0 ${dlPackId === null ? 'bg-green-600 text-white' : 'bg-green-50 text-green-600 hover:text-green-700'}`}
                                >
                                    {dlArea || 'Other'}
                                </button>
                            </>
                        )}
                        {dlPackId !== null && (
                            <>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-green-600 text-white shrink-0">
                                    {selectedPack?.name}
                                </span>
                            </>
                        )}
                        {dlStaffId !== null && (
                            <>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-green-600 text-white shrink-0">
                                    {selectedStaff?.name}
                                </span>
                            </>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="py-20 text-center">
                            <RefreshCw className="w-10 h-10 text-green-500 animate-spin mx-auto mb-4" />
                            <p className="text-gray-500 font-bold">Fetching delivery data...</p>
                        </div>
                    ) : (
                        <div className="p-6">
                            {/* LEVEL: STAFF LIST */}
                            {level === 'staff_list' && (
                                staffList.length === 0 ? (
                                    <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl text-gray-400">
                                        <Truck className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                        <p className="font-bold">No delivery personnel found</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {staffList.map(staff => {
                                            const sCusts = customers.filter(c => String(c.delivery_user_id) === String(staff.id)).map(c => {
                                                const pendingPacks = (c.packs || []).filter((p: any) => p.status === 'renewed' && p.attendance_status !== 'delivered' && p.attendance_status !== 'customer_pause' && p.attendance_status !== 'service_pause');
                                                const isSinglePending = (!c.packs || c.packs.length === 0) && c.status === 'renewed' && c.attendance_status !== 'delivered' && c.attendance_status !== 'customer_pause' && c.attendance_status !== 'service_pause';
                                                return {
                                                    ...c,
                                                    pendingPacks,
                                                    isSinglePending,
                                                    hasPending: pendingPacks.length > 0 || isSinglePending
                                                };
                                            }).filter(c => c.hasPending);

                                            const activePks = sCusts.reduce((a, c) => {
                                                if (c.pendingPacks.length > 0) {
                                                    return a + c.pendingPacks.reduce((sum, p) => sum + Number(p.quantity || 1), 0);
                                                }
                                                return a + Number((c as any).quantity || 1);
                                            }, 0);
                                            return (
                                                <button
                                                    key={staff.id}
                                                    onClick={() => setDlStaffId(String(staff.id))}
                                                    className="p-5 bg-white border border-gray-100 rounded-2xl text-left hover:border-green-500 hover:shadow-xl hover:shadow-green-50 transition-all group relative overflow-hidden"
                                                >
                                                    <div className="absolute top-4 right-4">
                                                        <span className="px-2 py-1 bg-green-600 text-white text-[10px] font-black rounded-lg">{activePks} PACKS</span>
                                                    </div>
                                                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-600 transition-colors">
                                                        <User className="w-5 h-5 text-green-600 group-hover:text-white" />
                                                    </div>
                                                    <h3 className="font-black text-gray-800 mb-0.5 uppercase tracking-tight">{staff.name}</h3>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{staff.mobile}</p>
                                                    <p className="text-[10px] font-bold text-green-600 mt-2 uppercase">{sCusts.length} Customers Pending</p>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            )}

                            {/* LEVEL: STAFF DETAIL */}
                            {level === 'staff_detail' && (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <button onClick={() => setDlStaffId(null)} className="flex items-center gap-2 text-sm font-bold text-green-600">
                                            <ChevronLeft className="w-4 h-4" /> Back to Staff
                                        </button>
                                        <button
                                            onClick={() => onDownload(selectedStaff, customers, activeDate)}
                                            className="px-4 py-2 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.1em] flex items-center gap-2 shadow-lg"
                                        >
                                            <Download className="w-3.5 h-3.5" /> Download List
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {(() => {
                                            const staffPendingCusts = customers.filter(c => String(c.delivery_user_id) === String(dlStaffId)).map(c => {
                                                const pendingPacks = (c.packs || []).filter((p: any) => p.status === 'renewed' && p.attendance_status !== 'delivered' && p.attendance_status !== 'customer_pause' && p.attendance_status !== 'service_pause');
                                                const isSinglePending = (!c.packs || c.packs.length === 0) && c.status === 'renewed' && c.attendance_status !== 'delivered' && c.attendance_status !== 'customer_pause' && c.attendance_status !== 'service_pause';
                                                return {
                                                    ...c,
                                                    pendingPacks,
                                                    isSinglePending,
                                                    hasPending: pendingPacks.length > 0 || isSinglePending
                                                };
                                            }).filter(c => c.hasPending);

                                            if (staffPendingCusts.length === 0) {
                                                return <div className="py-20 text-center text-gray-400 font-bold uppercase tracking-widest">No pending deliveries</div>;
                                            }

                                            return staffPendingCusts.map((c, idx) => (
                                                <div key={c.id} className="p-5 bg-white border border-gray-100 rounded-3xl flex items-center justify-between group border-l-8 border-l-green-100 shadow-sm">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-10 h-10 bg-gray-800 text-white rounded-xl flex items-center justify-center font-black text-xs">{String(idx + 1).padStart(2, '0')}</div>
                                                        <div>
                                                            <h4 className="font-black text-gray-900 uppercase">{c.name}</h4>
                                                            <p className="text-[10px] text-green-600 font-bold uppercase tracking-widest">{c.area || 'General Area'}</p>
                                                            <div className="flex gap-2 mt-1">
                                                                {c.pendingPacks.length > 0 ? c.pendingPacks.map((p: any) => (
                                                                    <span key={p.customerPackId} className="px-2 py-0.5 bg-green-50 text-green-700 text-[9px] font-black rounded uppercase">
                                                                        {p.name} ({p.quantity})
                                                                    </span>
                                                                )) : (
                                                                    <span className="px-2 py-0.5 bg-green-50 text-green-700 text-[9px] font-black rounded uppercase">
                                                                        {c.pack_name || 'Standard Pack'} ({c.quantity || 1})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <a href={`tel:${c.mobile}`} className="w-10 h-10 bg-green-500 text-white rounded-xl flex items-center justify-center shadow-lg"><Phone className="w-5 h-5" /></a>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </>
                            )}
                            {/* LEVEL 1: ZONES */}
                            {level === 'zones' && (
                                zones.length === 0 ? (
                                    <div className="py-20 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                                        <TrendingDown className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                        <p className="text-gray-400 font-medium">No delivery data found</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {zones.map(zone => {
                                            const zCusts = customers.filter(c => (c.zone || 'Other') === zone);
                                            const totalPks = zCusts.reduce((a, c) => a + (c.packs?.length || 1), 0);
                                            const activePks = zCusts.reduce((a, c) => {
                                                const isPaused = c.attendance_status === 'customer_pause' || c.attendance_status === 'service_pause';
                                                if (isPaused) return a;
                                                if (c.packs && c.packs.length > 0) {
                                                    return a + c.packs.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
                                                }
                                                return a + Number((c as any).quantity || 1);
                                            }, 0);
                                            const delivered = zCusts.reduce((a, c) => {
                                                if (c.packs && c.packs.length > 0) return a + c.packs.filter(p => p.attendance_status === 'delivered').length;
                                                return a + (c.attendance_status === 'delivered' ? 1 : 0);
                                            }, 0);
                                            const pct = totalPks > 0 ? Math.round((delivered / totalPks) * 100) : 0;
                                            const areaCount = Array.from(new Set(zCusts.map(c => normArea(c.area || 'Other')))).length;
                                            return (
                                                <button
                                                    key={zone}
                                                    onClick={() => { setDlZone(zone); setDlArea(null); setDlPackId(null); }}
                                                    className="p-5 bg-white border border-gray-100 rounded-2xl text-left hover:border-green-500 hover:shadow-xl hover:shadow-green-50 transition-all group relative overflow-hidden"
                                                >
                                                    <div className="absolute top-4 right-4 flex flex-col items-end">
                                                        <span className="px-2 py-1 bg-green-600 text-white text-[10px] font-black rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                                            {activePks} PACKS
                                                        </span>
                                                    </div>
                                                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ChevronRight className="w-5 h-5 text-green-500" />
                                                    </div>
                                                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-600 transition-colors">
                                                        <MapPin className="w-5 h-5 text-green-600 group-hover:text-white" />
                                                    </div>
                                                    <h3 className="font-black text-gray-800 mb-0.5 group-hover:text-green-600 transition-colors uppercase tracking-tight">{zone}</h3>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{areaCount} Areas · {zCusts.length} Customers</p>
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[10px] font-bold text-gray-400">
                                                            <span>{delivered} Delivered</span>
                                                            <span className="text-green-600">{pct}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            )}

                            {/* LEVEL 2: AREAS */}
                            {level === 'areas' && (
                                areas.length === 0 ? (
                                    <div className="py-16 text-center text-gray-400 font-bold">No areas found in {dlZone}</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {areas.map(area => {
                                            const aCusts = customers.filter(c => inZone(c) && normArea(c.area || 'Other') === normArea(area));
                                            const totalPks = aCusts.reduce((a, c) => a + (c.packs?.length || 1), 0);
                                            const activePks = aCusts.reduce((a, c) => {
                                                const isPaused = c.attendance_status === 'customer_pause' || c.attendance_status === 'service_pause';
                                                if (isPaused) return a;
                                                if (c.packs && c.packs.length > 0) {
                                                    return a + c.packs.reduce((sum, p) => sum + Number(p.quantity || 0), 0);
                                                }
                                                return a + Number((c as any).quantity || 1);
                                            }, 0);
                                            const delivered = aCusts.reduce((a, c) => {
                                                if (c.packs && c.packs.length > 0) return a + c.packs.filter(p => p.attendance_status === 'delivered').length;
                                                return a + (c.attendance_status === 'delivered' ? 1 : 0);
                                            }, 0);
                                            const pct = totalPks > 0 ? Math.round((delivered / totalPks) * 100) : 0;
                                            return (
                                                <button
                                                    key={area}
                                                    onClick={() => { setDlArea(area); setDlPackId(null); }}
                                                    className="p-5 bg-white border border-gray-100 rounded-2xl text-left hover:border-green-500 hover:shadow-xl hover:shadow-green-50 transition-all group relative overflow-hidden"
                                                >
                                                    <div className="absolute top-4 right-4 flex flex-col items-end">
                                                        <span className="px-2 py-1 bg-green-600 text-white text-[10px] font-black rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                                            {activePks} PACKS
                                                        </span>
                                                    </div>
                                                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ChevronRight className="w-5 h-5 text-green-500" />
                                                    </div>
                                                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-600 transition-colors">
                                                        <Truck className="w-5 h-5 text-green-600 group-hover:text-white" />
                                                    </div>
                                                    <h3 className="font-black text-gray-800 mb-0.5 group-hover:text-green-600 transition-colors uppercase tracking-tight">{area}</h3>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{aCusts.length} Customers</p>
                                                    <div className="space-y-1.5">
                                                        <div className="flex justify-between text-[10px] font-bold text-gray-400">
                                                            <span>{delivered} Delivered</span>
                                                            <span className="text-green-600">{pct}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style={{ width: `${pct}%` }} />
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            )}

                            {/* LEVEL 3: PACKS */}
                            {level === 'packs' && (
                                packs.length === 0 ? (
                                    <div className="py-16 text-center text-gray-400 font-bold">No packs found for this area</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {packs.map(pack => {
                                            const count = countPackCustomers(dlZone, dlArea, String(pack.id));
                                            return (
                                                <button
                                                    key={pack.id}
                                                    onClick={() => setDlPackId(String(pack.id))}
                                                    className="p-5 bg-white border border-gray-100 rounded-2xl text-left hover:border-green-500 hover:shadow-xl hover:shadow-green-50 transition-all group relative overflow-hidden"
                                                >
                                                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <ChevronRight className="w-5 h-5 text-green-500" />
                                                    </div>
                                                    <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center mb-3 group-hover:bg-green-600 transition-colors">
                                                        <Package className="w-5 h-5 text-green-600 group-hover:text-white" />
                                                    </div>
                                                    <h3 className="font-black text-gray-800 mb-1 group-hover:text-green-600 transition-colors uppercase tracking-tight">{pack.name}</h3>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md uppercase tracking-widest self-start">{count} Customers</span>
                                                        <span className="text-[12px] font-black text-green-700 uppercase tracking-widest">
                                                            {customers.reduce((sum, c) => {
                                                                if (!inZone(c) || !inArea(c)) return sum;
                                                                const isPaused = c.attendance_status === 'customer_pause' || c.attendance_status === 'service_pause';
                                                                if (isPaused) return sum;
                                                                const p = c.packs?.find(pk => String(pk.packId) === String(pack.id));
                                                                if (p) return sum + Number(p.quantity || 0);
                                                                if (String((c as any).pack_id) === String(pack.id)) return sum + Number((c as any).quantity || 1);
                                                                return sum;
                                                            }, 0)} Packs To Deliver
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )
                            )}

                            {/* LEVEL 4: CUSTOMERS */}
                            {level === 'customers' && (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <button
                                            onClick={() => setDlPackId(null)}
                                            className="flex items-center gap-2 text-sm font-bold text-green-600 hover:text-green-700 transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" /> Change Pack
                                        </button>
                                        <div className="text-xs font-bold text-gray-600 uppercase tracking-widest">
                                            {packCustomers.reduce((sum, c) => {
                                                const p = c.packs?.find(pk => String(pk.packId) === String(dlPackId));
                                                return sum + (p?.quantity || 1);
                                            }, 0)} Total to Deliver
                                        </div>
                                    </div>
                                    {packCustomers.length === 0 ? (
                                        <div className="py-16 text-center border-2 border-dashed border-gray-100 rounded-3xl">
                                            <Users className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                                            <p className="text-gray-400 font-bold uppercase tracking-widest">No deliveries for this pack</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {packCustomers.map((customer, idx) => (
                                                <div key={customer.id} className="p-5 bg-white border border-gray-100 rounded-3xl flex items-center justify-between hover:border-green-400 hover:shadow-lg hover:shadow-green-50 transition-all group border-l-8 border-l-green-100">
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-12 h-12 bg-gray-800 text-white rounded-2xl flex items-center justify-center font-black text-xs shadow-md">
                                                            {String(idx + 1).padStart(2, '0')}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-black text-gray-900 text-lg tracking-tight uppercase">{customer.name}</p>
                                                                {(customer.packs?.find(p => String(p.packId) === String(dlPackId))?.quantity || 1) > 1 && (
                                                                    <span className="px-2 py-1 bg-green-600 text-white rounded-lg text-xs font-black shadow-sm">
                                                                        x {customer.packs?.find(p => String(p.packId) === String(dlPackId))?.quantity}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-green-600 font-black mb-1 uppercase tracking-widest">
                                                                {customer.area || 'General Area'}{customer.landmark ? ` · ${customer.landmark}` : ''}
                                                            </p>
                                                            <p className="text-xs text-gray-400 font-bold line-clamp-1 max-w-[300px] italic">
                                                                {customer.address || 'Address Not Provided'}{customer.address2 ? `, ${customer.address2}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <a
                                                        href={`tel:${customer.mobile}`}
                                                        className="w-12 h-12 bg-green-500 text-white rounded-2xl flex items-center justify-center hover:bg-green-600 transition-all shadow-lg shadow-green-100 active:scale-95"
                                                    >
                                                        <Phone className="w-6 h-6" />
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-900 border-t border-gray-800 flex justify-center items-center">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] leading-none">
                        Watsgo Interactive Delivery Assistant
                    </p>
                </div>
            </div>
        </div>
    );
}


// ---- Customer Calendar Modal ----
function CustomerCalendarModal({ customer, onClose, businessType }: { customer: CustomerWithAttendance, onClose: () => void, businessType: 'fruits' | 'food' }) {
    const [viewDate, setViewDate] = useState(() => {
        const d = new Date();
        return { year: d.getFullYear(), month: d.getMonth() };
    });
    const [selectedPackId, setSelectedPackId] = useState<number>(() => {
        if (customer.packs && customer.packs.length > 0) return customer.packs[0].customerPackId;
        return 0;
    });

    // Structure: { packId: { dateStr: { mealType: { status } } } }
    const [masterAttendance, setMasterAttendance] = useState<Record<number, Record<string, Record<string, { status: AttendanceStatus }>>>>({});
    const [masterOriginal, setMasterOriginal] = useState<Record<number, Record<string, Record<string, { status: AttendanceStatus }>>>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedTool, setSelectedTool] = useState<AttendanceStatus>('delivered');
    const [showMealModal, setShowMealModal] = useState(false);
    const [mealModalData, setMealModalData] = useState<{ dateStr: string, status: AttendanceStatus, allowedMeals?: string[] } | null>(null);

    const fetchMonthData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get(`/attendance?customerId=${customer.id}`);
            if (res.data.success) {
                const fullMap: Record<number, Record<string, Record<string, { status: AttendanceStatus }>>> = {};
                res.data.data.forEach((r: any) => {
                    const pId = r.pack_id || 0;
                    if (!fullMap[pId]) fullMap[pId] = {};
                    const dStr = r.attendance_date.split('T')[0];
                    if (!fullMap[pId][dStr]) fullMap[pId][dStr] = {};
                    const mealKey = r.meal_type || 'none';
                    fullMap[pId][dStr][mealKey] = { status: r.status };
                });
                setMasterAttendance(fullMap);
                setMasterOriginal(JSON.parse(JSON.stringify(fullMap)));
            }
        } catch (err) {
            console.error('Failed to fetch calendar data');
        } finally {
            setLoading(false);
        }
    }, [customer.id]);

    useEffect(() => { fetchMonthData(); }, [fetchMonthData]);

    const attendanceMap = masterAttendance[selectedPackId] || {};

    const handleSaveCalendar = async () => {
        const records: any[] = [];

        // Find changes across ALL packs
        Object.keys(masterAttendance).forEach(pIdStr => {
            const pId = Number(pIdStr);
            const currentPackMap = masterAttendance[pId] || {};
            const originalPackMap = masterOriginal[pId] || {};

            const allPossibleDates = new Set([...Object.keys(currentPackMap), ...Object.keys(originalPackMap)]);
            allPossibleDates.forEach(date => {
                const currentDateMap = currentPackMap[date] || {};
                const originalDateMap = originalPackMap[date] || {};

                const allPossibleMeals = new Set([...Object.keys(currentDateMap), ...Object.keys(originalDateMap)]);
                allPossibleMeals.forEach(meal => {
                    const currentStatus = currentDateMap[meal]?.status || null;
                    const originalStatus = originalDateMap[meal]?.status || null;

                    if (currentStatus !== originalStatus) {
                        records.push({
                            customerId: Number(customer.id),
                            customerPackId: pId,
                            date,
                            status: currentStatus,
                            mealType: meal
                        });
                    }
                });
            });
        });

        if (records.length === 0) {
            onClose();
            return;
        }

        setSaving(true);
        try {
            await api.post('/attendance/bulk', { date: records[0].date, records });
            onClose();
        } catch (err) {
            alert('Failed to save some changes');
        } finally {
            setSaving(false);
        }
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
    const firstDay = new Date(viewDate.year, viewDate.month, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const cells: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    const today = formatDateLocal(new Date());

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Modal Header - Fixed */}
                <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">{customer.name}</h2>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">Delivery History & Planning</p>
                    </div>
                    <button onClick={onClose} className="p-3 bg-white border border-gray-100 hover:bg-gray-50 rounded-2xl transition-all shadow-sm active:scale-95">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide">
                    {/* Pack Selector */}
                    {customer.packs && customer.packs.length > 0 && (
                        <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center gap-3 overflow-x-auto sticky top-0 z-20">
                            <span className="text-[10px] font-black text-gray-400 uppercase whitespace-nowrap">Select Pack:</span>
                            <div className="flex gap-2">
                                {customer.packs.map(p => (
                                    <button
                                        key={p.customerPackId}
                                        onClick={() => setSelectedPackId(p.customerPackId)}
                                        className={`px-5 py-2.5 rounded-[14px] text-[11px] font-black uppercase tracking-[0.1em] border-2 transition-all whitespace-nowrap
                                            ${selectedPackId === p.customerPackId
                                                ? 'bg-green-600 border-green-600 text-white shadow-xl shadow-green-100 scale-105'
                                                : 'bg-white border-gray-100 text-gray-400 hover:border-green-200 hover:text-green-600'}`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="p-6 md:p-8">
                        {/* Calendar Navigation */}
                        <div className="flex items-center justify-between mb-8">
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">
                                {monthNames[viewDate.month]} {viewDate.year}
                            </h3>
                            <div className="flex gap-2">
                                <button onClick={() => setViewDate(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })}
                                    className="p-3 bg-white border border-gray-100 hover:border-green-100 rounded-2xl shadow-sm transition-all active:scale-95">
                                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                                </button>
                                <button onClick={() => setViewDate(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })}
                                    className="p-3 bg-white border border-gray-100 hover:border-green-100 rounded-2xl shadow-sm transition-all active:scale-95">
                                    <ChevronRight className="w-5 h-5 text-gray-600" />
                                </button>
                            </div>
                        </div>

                        {/* Calendar Grid */}
                        <div className="grid grid-cols-7 gap-3 relative mb-10">
                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                                <div key={d} className={`text-center text-[10px] font-black py-2 tracking-widest ${i === 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                    {d.toUpperCase()}
                                </div>
                            ))}

                            {loading && (
                                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center backdrop-blur-[1px] rounded-3xl">
                                    <RefreshCw className="w-8 h-8 text-green-500 animate-spin" />
                                </div>
                            )}

                            {cells.map((day, i) => {
                                if (!day) return <div key={`empty-${i}`} className="aspect-square" />;

                                const dateStr = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                const dateMealMap = attendanceMap[dateStr] || {};
                                const mealsPresent = Object.keys(dateMealMap).filter(m => dateMealMap[m].status !== null);

                                const isSun = new Date(dateStr + 'T00:00:00').getDay() === 0;
                                const isToday = dateStr === today;
                                const isPast = dateStr < today;

                                const pObj = customer.packs?.find(p => p.customerPackId === selectedPackId);
                                const isFoodPack = pObj ? (pObj.packType === 'food') : (customer.packType === 'food' || businessType === 'food');

                                let boxClass = "border-gray-50 bg-gray-50/30 text-gray-400";
                                let icon = null;

                                if (isSun) {
                                    boxClass = "bg-gray-100 text-red-200 border-transparent shadow-inner";
                                    icon = <span className="text-[9px] uppercase font-black opacity-30 mt-1">Off</span>;
                                } else if (mealsPresent.length > 0) {
                                    const hasDelivered = mealsPresent.some(m => dateMealMap[m].status === 'delivered');
                                    const hasPause = mealsPresent.some(m => dateMealMap[m].status === 'customer_pause' || dateMealMap[m].status === 'service_pause');
                                    const hasHoliday = mealsPresent.some(m => dateMealMap[m].status === 'holiday');

                                    if (hasPause) {
                                        boxClass = "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100 scale-105 z-10";
                                        icon = <PauseCircle className="w-4 h-4 text-white" />;
                                    } else if (hasHoliday) {
                                        boxClass = "bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-100 scale-105 z-10";
                                        icon = <Coffee className="w-4 h-4 text-white" />;
                                    } else if (hasDelivered) {
                                        boxClass = "bg-green-500 border-green-500 text-white shadow-lg shadow-green-100 scale-105 z-10";
                                        icon = <CheckCircle className="w-4 h-4 text-white" />;
                                    }
                                } else {
                                    boxClass = "bg-white border-gray-100 text-gray-400 hover:border-green-400 hover:shadow-xl hover:shadow-green-50 hover:-translate-y-1";
                                }

                                return (
                                    <button
                                        key={dateStr}
                                        disabled={isSun}
                                        onClick={() => {
                                            if (selectedTool === 'delivered' || selectedTool === 'customer_pause' || selectedTool === 'holiday') {
                                                if (isFoodPack || businessType === 'food') {
                                                    const allowedMeals = (pObj?.mealSlots || customer.mealSlots) ? (pObj?.mealSlots || customer.mealSlots).split(',') : ['breakfast', 'lunch', 'dinner'];
                                                    setMealModalData({ dateStr, status: selectedTool, allowedMeals });
                                                    setShowMealModal(true);
                                                    return;
                                                }
                                            }

                                            // Non-food or null tool: toggle 'none'
                                            const currentStatus = dateMealMap['none']?.status || null;
                                            const newStatus = (currentStatus === selectedTool) ? null : selectedTool;

                                            setMasterAttendance(prev => {
                                                const currentPackMap = prev[selectedPackId] || {};
                                                return {
                                                    ...prev,
                                                    [selectedPackId]: { ...currentPackMap, [dateStr]: { 'none': { status: newStatus } } }
                                                };
                                            });
                                        }}
                                        className={`w-full aspect-square rounded-[20px] border-2 transition-all flex flex-col items-center justify-center relative overflow-hidden
                                            ${boxClass} ${isToday ? 'outline outline-2 outline-offset-2 outline-green-500' : ''}`}
                                    >
                                        {isToday && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-green-500 rounded-full shadow-sm" />}
                                        <span className={`text-[13px] font-black mb-1`}>{day}</span>
                                        {icon}
                                        {isFoodPack && mealsPresent.length > 0 && (
                                            <div className="absolute inset-x-0 bottom-0 p-1 flex flex-wrap gap-0.5 justify-center bg-black/20 backdrop-blur-[2px] py-1">
                                                {mealsPresent.map(m => {
                                                    const mStatus = dateMealMap[m].status;
                                                    const badgeColor = mStatus === 'delivered' ? 'bg-green-600' : mStatus === 'holiday' ? 'bg-amber-600' : 'bg-orange-600';
                                                    return (
                                                        <div key={m} className={`text-[6px] font-black uppercase px-1 py-0.5 rounded shadow-sm border border-white/20 truncate text-white ${badgeColor}`}>
                                                            {m}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Legend & Tool Selection */}
                        <div className="bg-gray-50/50 rounded-[32px] p-6 border border-gray-100 mb-4">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 text-center">Select marking tool</p>
                            <div className="flex flex-wrap justify-center gap-2">
                                {['delivered', 'customer_pause', 'holiday', null].map((toolType) => {
                                    const tool = toolType as AttendanceStatus;
                                    const isSelected = selectedTool === tool;

                                    return (
                                        <button
                                            key={String(tool)}
                                            onClick={() => setSelectedTool(tool)}
                                            className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2.5 border-2
                                                ${isSelected
                                                    ? (tool === 'delivered' ? 'bg-green-500 border-green-500 text-white shadow-xl shadow-green-100' :
                                                        tool === 'holiday' ? 'bg-amber-500 border-amber-500 text-white shadow-xl shadow-amber-100' :
                                                            tool === null ? 'bg-gray-900 border-gray-900 text-white' : 'bg-orange-500 border-orange-500 text-white shadow-xl shadow-orange-100')
                                                    : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200 hover:text-gray-600'}`}
                                        >
                                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-white border-transparent' : 'bg-white border-gray-200'}`}>
                                                {isSelected && <div className={`w-1.5 h-1.5 rounded-full ${tool === 'delivered' ? 'bg-green-500' : tool === 'holiday' ? 'bg-amber-500' : tool === null ? 'bg-gray-800' : 'bg-orange-500'}`} />}
                                            </div>
                                            {tool === 'delivered' ? 'Delivered' :
                                                tool === 'customer_pause' ? 'Paused' :
                                                    tool === 'holiday' ? 'Holiday' : 'Pending'}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-[0.2em] italic text-center mt-6 leading-relaxed opacity-60">
                                * Select a tool above and tap any date cell to apply status
                            </p>
                        </div>
                    </div>
                </div>

                {/* Meal Modal for Calendar */}
                {showMealModal && mealModalData && (
                    <MealSelectionModal
                        allowedMeals={mealModalData.allowedMeals}
                        status={mealModalData.status}
                        onSelect={(meal) => {
                            setMasterAttendance(prev => {
                                const currentPackMap = prev[selectedPackId] || {};
                                const dateMap = currentPackMap[mealModalData.dateStr] || {};
                                const currentMealStatus = dateMap[meal]?.status || null;
                                const newStatus = (currentMealStatus === mealModalData.status) ? null : mealModalData.status;

                                return {
                                    ...prev,
                                    [selectedPackId]: {
                                        ...currentPackMap,
                                        [mealModalData.dateStr]: {
                                            ...dateMap,
                                            [meal]: { status: newStatus }
                                        }
                                    }
                                };
                            });
                            setShowMealModal(false);
                            setMealModalData(null);
                        }}
                        onClose={() => {
                            setShowMealModal(false);
                            setMealModalData(null);
                        }}
                    />
                )}

                {/* Footer Action Bar - Fixed Bottom */}
                <div className="p-6 md:p-8 bg-white border-t border-gray-100 flex flex-col sm:flex-row gap-4 shrink-0 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.05)]">
                    <button onClick={onClose} className="flex-1 py-4 text-xs font-black text-gray-400 hover:text-gray-900 transition-colors uppercase tracking-[0.2em] hover:bg-gray-50 rounded-2xl">
                        Discard Changes
                    </button>
                    <button
                        onClick={handleSaveCalendar}
                        disabled={saving}
                        className={`flex-[2] py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-2xl flex items-center justify-center gap-3
                            ${saving ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-green-600 hover:bg-green-700 text-white shadow-green-200 active:scale-95'}`}
                    >
                        {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {saving ? 'PROCESSING...' : 'SAVE CHANGES PERMANENTLY'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ZoneHolidayModal({ zones, currentDate, onClose, onSuccess }: {
    zones: string[],
    currentDate: string,
    onClose: () => void,
    onSuccess: () => void
}) {
    const [selectedZone, setSelectedZone] = useState('');
    const [date, setDate] = useState(currentDate);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleMarkHoliday = async () => {
        if (!selectedZone) {
            setError('Please select a zone');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await api.post('/attendance/zone-holiday', { zone: selectedZone, date });
            if (res.data.success) {
                onSuccess();
            } else {
                setError(res.data.error || 'Failed to mark zone holiday');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to mark zone holiday');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden p-8"
            >
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <Coffee className="w-10 h-10 text-amber-500" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Zone Holiday</h2>
                    <p className="text-gray-500 font-medium mt-1 text-sm">Mark holiday for all renewed customers in a zone</p>
                </div>

                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Select Zone</label>
                        <select
                            value={selectedZone}
                            onChange={(e) => setSelectedZone(e.target.value)}
                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none transition-all appearance-none"
                        >
                            <option value="">Select a zone...</option>
                            {zones.map(z => <option key={z} value={z}>{z}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Select Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-green-500/10 focus:border-green-500 outline-none transition-all"
                        />
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-shake">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={handleMarkHoliday}
                            disabled={loading}
                            className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-3
                                ${loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-100 active:scale-95'}`}
                        >
                            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                            {loading ? 'PROCESSING...' : 'MARK ALL AS HOLIDAY'}
                        </button>

                        <button
                            onClick={onClose}
                            className="w-full py-4 text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-[0.2em] transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

function MealSelectionModal({ onSelect, onClose, allowedMeals = ['breakfast', 'lunch', 'dinner'], status = 'customer_pause' }: { onSelect: (meal: string) => void, onClose: () => void, allowedMeals?: string[], status?: AttendanceStatus }) {
    const allMeals = [
        { id: 'breakfast', label: 'Breakfast', icon: Coffee, color: 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-600 hover:text-white hover:shadow-lg hover:shadow-orange-100 active:scale-95 transition-all' },
        { id: 'lunch', label: 'Lunch', icon: Truck, color: 'bg-green-50 text-green-600 border-green-100 hover:bg-green-600 hover:text-white hover:shadow-lg hover:shadow-green-100 active:scale-95 transition-all' },
        { id: 'dinner', label: 'Dinner', icon: List, color: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-100 active:scale-95 transition-all' },
    ];

    const meals = allMeals.filter(m => allowedMeals.includes(m.id));

    const isDelivered = status === 'delivered';
    const title = isDelivered ? 'Select Delivery Meal' : 'Pause Subscription';
    const subtitle = isDelivered ? 'Which meal is being delivered?' : 'Which meal would you like to pause?';
    const HeaderIcon = isDelivered ? CheckCircle : PauseCircle;
    const headerColor = isDelivered ? 'bg-green-50 text-green-500' : 'bg-orange-50 text-orange-500';

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden p-8"
            >
                <div className="text-center mb-8">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 ${headerColor}`}>
                        <HeaderIcon className="w-10 h-10" />
                    </div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">{title}</h2>
                    <p className="text-gray-500 font-medium mt-1">{subtitle}</p>
                </div>

                <div className="space-y-3">
                    {meals.map(meal => {
                        const Icon = meal.icon;
                        return (
                            <button
                                key={meal.id}
                                onClick={() => onSelect(meal.id)}
                                className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 font-black uppercase tracking-widest text-sm transition-all group ${meal.color}`}
                            >
                                <div className="flex items-center gap-4">
                                    <Icon className="w-6 h-6" />
                                    {meal.label}
                                </div>
                                <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all" />
                            </button>
                        )
                    })}
                </div>

                <button
                    onClick={onClose}
                    className="w-full mt-6 py-4 text-xs font-black text-gray-400 hover:text-gray-600 uppercase tracking-[0.2em] transition-all"
                >
                    Cancel
                </button>
            </motion.div>
        </div>
    );
}
