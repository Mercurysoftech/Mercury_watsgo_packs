import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Customer, SubscriptionStatus, UserRole, PaymentHistory, DeliveryUser, Pack } from '../types';
import { customerAPI, paymentHistoryAPI, deliveryUserAPI, packAPI, attendanceAPI } from '../services/api';
import { Search, Edit, Bell, CheckCircle, Clock, XCircle, Trash2, Package, CreditCard, AlertCircle, RefreshCw, ChevronLeft, ChevronRight, User, Users, MapPin, Phone, Calendar, History, ArrowRight, Truck, Repeat, Send, Loader2, Eye, Plus, X, Download, Upload, FileText, TrendingUp, MessageCircle, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface CustomerListProps {
  customers: Customer[];
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (id: string) => void;
  onSendReminder: (customer: Customer) => void;
  onSendBulkReminders: (customerIds: string[]) => void;
  onAutoSchedule: (customerIds: string[]) => void;
  onMarkPaid?: (customerId: string, packId?: number) => void;
  onAddCustomer?: () => void;
  userRole: UserRole;
  isSubscriptionActive?: boolean;
  subscription?: { status: string, planType?: string } | null;
}

export function CustomerList({ customers, onEditCustomer, onDeleteCustomer, onSendReminder, onSendBulkReminders, onAutoSchedule, onMarkPaid, onAddCustomer, userRole, isSubscriptionActive = true, subscription }: CustomerListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [cycleFilter, setCycleFilter] = useState<string>('all');
  const [addressFilter, setAddressFilter] = useState<string>('all');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string | null>(null);
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string | null>(null);
  const [showAllZones, setShowAllZones] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Close dropdown when clicking outside111
  useEffect(() => {
    const handleClickOutside = () => setOpenDropdownId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  // Profile Modal State
  const [selectedCustomerForProfile, setSelectedCustomerForProfile] = useState<Customer | null>(null);
  const [deliveryUsers, setDeliveryUsers] = useState<DeliveryUser[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPackModal, setShowPackModal] = useState(false);
  const [selectedCustomerForPack, setSelectedCustomerForPack] = useState<Customer | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedCustomerForPayment, setSelectedCustomerForPayment] = useState<Customer | null>(null);
  const [insights, setInsights] = useState<any>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    const fetchDeliveryUsers = async () => {
      try {
        const res = await deliveryUserAPI.getAll();
        if (res.data.success) {
          setDeliveryUsers(res.data.delivery_users || []);
        }
      } catch (err) {
        console.error('Failed to fetch delivery users');
      }
    };
    fetchDeliveryUsers();

    const fetchPacks = async () => {
      try {
        const res = await packAPI.getAll();
        if (res.data.success) {
          setPacks(res.data.packs || []);
        }
      } catch (err) {
        console.error('Failed to fetch packs');
      }
    };
    fetchPacks();

    const fetchInsights = async () => {
      setLoadingInsights(true);
      try {
        const res = await customerAPI.getInsights();
        if (res.data.success) {
          setInsights(res.data.insights);
        }
      } catch (err) {
        console.error('Failed to fetch insights');
      } finally {
        setLoadingInsights(false);
      }
    };
    fetchInsights();

    const fetchAttendance = async () => {
      try {
        const today = new Date().toLocaleDateString('en-CA');
        const res = await attendanceAPI.getAll(today);
        if (res.data.success) {
          setAttendanceRecords(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch attendance');
      }
    };
    fetchAttendance();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, paymentFilter, cycleFilter, selectedZoneFilter, selectedAreaFilter]);

  // Helper to normalize strings for comparison and display
  const normalizeLocation = useCallback((val?: string) => {
    if (!val) return '';
    return val.trim().toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  }, []);

  // Extract unique Zones and Areas (Normalized)
  const availableZones = useMemo(() => {
    const zones = new Set<string>();
    customers.forEach(c => {
      const normalizedZone = normalizeLocation(c.zone) || 'No Zone';
      zones.add(normalizedZone);
    });
    return Array.from(zones).sort();
  }, [customers, normalizeLocation]);

  const availableAreasInZone = useMemo(() => {
    if (!selectedZoneFilter) return [];
    const areas = new Set<string>();
    customers
      .filter(c => normalizeLocation(c.zone || 'No Zone') === selectedZoneFilter)
      .forEach(c => {
        if (c.area) {
          areas.add(normalizeLocation(c.area));
        }
      });
    return Array.from(areas).sort();
  }, [customers, selectedZoneFilter, normalizeLocation]);

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch =
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.mobile.includes(searchTerm) ||
      (customer.area && customer.area.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.address && customer.address.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;

    const matchesPaymentStatus = paymentFilter === 'all' || customer.paymentStatus === paymentFilter;

    const matchesCycle = cycleFilter === 'all' || customer.renewalCycle === cycleFilter || (customer.packs && customer.packs.some(p => p.renewalCycle === cycleFilter));

    const matchesZone = !selectedZoneFilter || normalizeLocation(customer.zone || 'No Zone') === selectedZoneFilter;
    const matchesArea = !selectedAreaFilter || normalizeLocation(customer.area || '') === selectedAreaFilter;

    return matchesSearch && matchesStatus && matchesPaymentStatus && matchesCycle && matchesZone && matchesArea;
  });

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);

  const handleSelectCustomer = (customerId: string) => {
    setSelectedCustomerIds(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCustomerIds(currentCustomers.map(c => c.id));
    } else {
      setSelectedCustomerIds([]);
    }
  };

  const handleSelectFully = () => {
    setSelectedCustomerIds(customers.map(c => c.id));
  };

  const handleBulkSend = () => {
    if (selectedCustomerIds.length === 0) return;
    onSendBulkReminders(selectedCustomerIds);
  };

  const [loadingAutopayId, setLoadingAutopayId] = useState<string | null>(null);

  const generateAutopayLink = async (customer: Customer) => {
    if (!customer.packPrice || customer.packPrice <= 0) {
      toast.error("Customer does not have a valid pack price to setup Autopay.");
      return;
    }

    try {
      setLoadingAutopayId(customer.id);
      const res = await customerAPI.generateAutopayLink({
        customerId: customer.id,
        amount: customer.packPrice,
        packName: customer.packName || 'Subscription Pack',
        renewalCycle: customer.renewalCycle
      });

      // Show success alert
      toast.success(res.data.message || 'Autopayment link generated correctly.');

    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to generate Autopay link");
    } finally {
      setLoadingAutopayId(null);
    }
  };

  const parseCSV = (text: string) => {
    let p = '', row = [''], ret = [row], i = 0, r = 0, s = !0, l;
    for (l of text) {
      if ('"' === l) {
        if (s && l === p) row[i] += l;
        s = !s;
      } else if (',' === l && s) l = row[++i] = '';
      else if ('\n' === l && s) {
        if ('\r' === p) row[i] = row[i].slice(0, -1);
        row = ret[++r] = [l = '']; i = 0;
      } else row[i] += l;
      p = l;
    }
    return ret;
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const rows = parseCSV(text).filter(row => row.length > 1 || row[0].trim() !== '');
      if (rows.length < 2) {
        toast.error('CSV file is empty or invalid');
        return;
      }

      const headers = rows[0].map(h => h.trim().toLowerCase());
      const nameIdx = headers.indexOf('name');
      const mobileIdx = headers.indexOf('mobile');
      const altMobileIdx = headers.indexOf('alternative mobile');
      const addressIdx = headers.indexOf('address');
      const areaIdx = headers.indexOf('area');
      const zoneIdx = headers.indexOf('zone');
      const packNameIdx = headers.indexOf('pack name');
      const quantityIdx = headers.indexOf('quantity');
      const deliveryChargeIdx = headers.indexOf('delivery charge');
      const renewalCycleIdx = headers.indexOf('renewal cycle');

      if (nameIdx === -1 || mobileIdx === -1) {
        toast.error('CSV must contain Name and Mobile columns');
        return;
      }

      let successCount = 0;
      let failCount = 0;
      let lastError = '';

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length < 2) continue; // Skip empty rows

        const name = row[nameIdx]?.trim();
        const mobile = row[mobileIdx]?.trim();

        if (!name || !mobile) {
          failCount++;
          lastError = 'Name or Mobile is missing';
          continue;
        }

        const customerPayload: any = {
          name,
          mobile,
          alternativeMobile: altMobileIdx !== -1 ? row[altMobileIdx]?.trim() : '',
          address: addressIdx !== -1 && row[addressIdx]?.trim() ? row[addressIdx]?.trim() : 'N/A',
          area: areaIdx !== -1 ? row[areaIdx]?.trim() : '',
          zone: zoneIdx !== -1 && row[zoneIdx]?.trim() ? row[zoneIdx]?.trim() : 'Default',
          deliveryCharge: deliveryChargeIdx !== -1 ? Number(row[deliveryChargeIdx]) || 0 : 0
        };

        const packName = packNameIdx !== -1 ? row[packNameIdx]?.trim() : '';
        if (packName) {
          const matchedPack = packs.find(p => p.name.toLowerCase() === packName.toLowerCase());
          if (matchedPack) {
            customerPayload.packs = [{
              packId: matchedPack.id,
              quantity: quantityIdx !== -1 ? Number(row[quantityIdx]) || 1 : 1,
              renewalCycle: renewalCycleIdx !== -1 ? (row[renewalCycleIdx]?.trim()?.toLowerCase() || 'monthly') : 'monthly',
              startDate: new Date().toISOString(),
              renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }];
            customerPayload.status = 'renewed';
          } else {
            customerPayload.status = 'pending';
          }
        } else {
          customerPayload.status = 'pending';
        }

        try {
          await customerAPI.create(customerPayload);
          successCount++;
        } catch (err: any) {
          console.error(`Failed to import row ${i}:`, err);
          failCount++;
          lastError = err.response?.data?.error || err.message || 'Unknown error';
        }

        if (i % 5 === 0) {
          toast.info(`Importing... ${i}/${rows.length - 1}`);
        }
      }

      if (failCount > 0) {
        toast.warning(`Imported ${successCount}. Failed: ${failCount} (${lastError})`);
      } else {
        toast.success(`Successfully imported ${successCount} customers!`);
      }

      // Auto-refresh the page
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (err) {
      console.error('Import error:', err);
      toast.error('Failed to process CSV file');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getStatusBadge = (status: SubscriptionStatus) => {
    const configs = {
      renewed: {
        icon: CheckCircle,
        label: 'Renewed',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      },
      pending: {
        icon: Clock,
        label: 'Pending',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200'
      },
      expired: {
        icon: XCircle,
        label: 'Expired',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      },
      connected: {
        icon: CheckCircle,
        label: 'Connected',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      }
    };

    const config = configs[status] || configs.connected;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor} border ${config.borderColor} flex-shrink-0`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status?: string) => {
    if (!status) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-700 border border-gray-200 flex-shrink-0">
          <AlertCircle className="w-3.5 h-3.5" />
          No Data
        </span>
      );
    }

    const configs: Record<string, any> = {
      paid: {
        icon: CheckCircle,
        label: 'Paid',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      },
      unpaid: {
        icon: XCircle,
        label: 'Unpaid',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        borderColor: 'border-red-200'
      },
      partially_paid: {
        icon: Clock,
        label: 'Partial',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-700',
        borderColor: 'border-yellow-200'
      },
      overdue: {
        icon: XCircle,
        label: 'Overdue',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-700',
        borderColor: 'border-orange-200'
      },
      pending: {
        icon: Clock,
        label: 'Pending',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        borderColor: 'border-green-200'
      }
    };

    const config = configs[status] || configs.unpaid;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${config.bgColor} ${config.textColor} border ${config.borderColor} flex-shrink-0`}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };


  // Today's deliveries summary - uses attendance records fetched for today (already filtered by date in API call)
  const deliveriesSummary = customers.reduce((acc, c) => {
    if (c.status !== 'renewed') return acc;
    // Build packs array - use customer_packs records (p.id = instance id = pack_id in attendance)
    const packsArray = c.packs && c.packs.length > 0 ? c.packs : [{
      id: c.packId || 0,
      packId: c.packId || 0,
      packType: c.packType || 'fruits',
      mealSlots: (c as any).mealSlots || (c as any).meal_slots || ''
    }];

    packsArray.forEach((p: any) => {
      const pType = p.packType || p.pack_type || 'fruits';
      const isFood = String(pType).toLowerCase() === 'food';
      // instance_id = p.id (customer_packs.id), this is what delivery app stores as pack_id in attendance
      const instanceId = p.id || 0;
      const masterPackId = p.packId || c.packId || 0;

      if (isFood) {
        const slotsStr = p.mealSlots || p.meal_slots || 'Breakfast,Lunch,Dinner';
        const meals = String(slotsStr).split(',').filter(Boolean);
        meals.forEach(meal => {
          acc.total += 1;
          // Match by instance_id OR master_pack_id for compatibility
          const att = attendanceRecords.find(r =>
            String(r.customer_id) === String(c.id) &&
            (String(r.pack_id) === String(instanceId) || String(r.pack_id) === String(masterPackId)) &&
            String(r.meal_type || '').toLowerCase() === meal.toLowerCase().trim()
          );
          if (att) {
            if (att.status === 'delivered') acc.delivered += 1;
            else if (['customer_pause', 'service_pause', 'holiday'].includes(att.status)) acc.paused += 1;
            else acc.pending += 1;
          } else {
            acc.pending += 1;
          }
        });
      } else {
        acc.total += 1;
        // Fruits/standard pack: match by instance_id or master_pack_id, any meal_type
        const att = attendanceRecords.find(r =>
          String(r.customer_id) === String(c.id) &&
          (String(r.pack_id) === String(instanceId) || String(r.pack_id) === String(masterPackId) || String(r.pack_id) === '0')
        );
        if (att) {
          if (att.status === 'delivered') acc.delivered += 1;
          else if (['customer_pause', 'service_pause', 'holiday'].includes(att.status)) acc.paused += 1;
          else acc.pending += 1;
        } else {
          acc.pending += 1;
        }
      }
    });
    return acc;
  }, { total: 0, delivered: 0, paused: 0, pending: 0 });

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10 bg-[#F9FAFB] p-2 sm:p-4 rounded-3xl">

      {/* 1. TOP HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-gray-100 shadow-sm mb-4">
        <div>
          <h2 className="text-xl font-black text-gray-900 tracking-tight">Customer Management</h2>
          <p className="text-xs text-gray-500 font-medium mt-0.5">Manage customer subscriptions, deliveries & reminders</p>
        </div>
        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(prev => !prev)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 flex items-center gap-2 text-xs transition-colors"
            >
              <Download className="w-4 h-4 text-gray-500" /> Export
              <ChevronRight className="w-3 h-3 rotate-90" />
            </button>
            {showExportDropdown && (
              <div className="absolute right-0 top-11 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden min-w-[150px]">
                <button
                  onClick={async () => {
                    setShowExportDropdown(false);
                    try {
                      const response = await customerAPI.exportCSV(selectedZoneFilter || undefined, selectedAreaFilter || undefined, selectedCustomerIds);
                      const url = window.URL.createObjectURL(new Blob([response.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.csv`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      toast.success('CSV exported successfully');
                    } catch (err) {
                      toast.error('Failed to export CSV');
                    }
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" /> Export CSV
                </button>
                <button
                  onClick={async () => {
                    setShowExportDropdown(false);
                    try {
                      const response = await customerAPI.exportPDF(selectedZoneFilter || undefined, selectedAreaFilter || undefined, selectedCustomerIds);
                      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.pdf`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      toast.success('PDF exported successfully');
                    } catch (err) {
                      toast.error('Failed to export PDF');
                    }
                  }}
                  className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-green-50 hover:text-green-700 flex items-center gap-2 border-t border-gray-100"
                >
                  <FileText className="w-4 h-4" /> Export PDF
                </button>
              </div>
            )}
          </div>

          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImportCSV}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="px-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-100 flex items-center gap-2 text-xs transition-colors"
          >
            {isImporting ? <Loader2 className="w-4 h-4 text-green-600 animate-spin" /> : <Upload className="w-4 h-4 text-green-600" />}
            {isImporting ? 'Importing...' : 'Import CSV'}
          </button>

          <button
            onClick={onAddCustomer}
            className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 shadow-md shadow-green-600/20 flex items-center gap-2 text-sm active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* 5 STATS CARDS ROW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        {/* Total Customers */}
        <div className="bg-white rounded-2xl p-4 border-t-4 border-t-green-500 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Total Customers</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none mt-1">{insights?.totalCustomers || customers.length}</h3>
            <p className="text-[10px] text-green-600 font-bold mt-1">{customers.filter(c => c.status === 'renewed').length} Active</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
            <div className="relative">
              <User className="w-5 h-5 text-green-600" />
              <Plus className="w-3 h-3 text-green-600 absolute -bottom-1 -right-1 font-black bg-green-50 rounded-full" />
            </div>
          </div>
        </div>
        {/* Active Packs */}
        <div className="bg-white rounded-2xl p-4 border-t-4 border-t-green-500 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Active Packs</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none mt-1">
              {customers.reduce((acc, c) => acc + (c.status === 'renewed' ? (c.packs && c.packs.length > 0 ? c.packs.filter(p => p.status === 'renewed').length : 1) : 0), 0)}
            </h3>
            <p className="text-[10px] text-green-600 font-bold mt-1">Renewed</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        {/* Today's Deliveries */}
        <div className="bg-white rounded-2xl p-4 border-t-4 border-t-green-500 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Today's Deliveries</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none mt-1">{deliveriesSummary.total}</h3>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
            <Truck className="w-5 h-5 text-green-600" />
          </div>
        </div>
        {/* Payment Received */}
        <div className="bg-white rounded-2xl p-4 border-t-4 border-t-green-500 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Payment Received</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none mt-1">₹{Number(insights?.revenueThisMonth || 0).toLocaleString()}</h3>
            <p className="text-[10px] text-gray-400 font-bold mt-1">This Month</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
            <span className="text-green-600 font-black text-lg">₹</span>
          </div>
        </div>
        {/* Pending Payments */}
        <div className="bg-white rounded-2xl p-4 border-t-4 border-t-green-500 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase">Pending Payments</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none mt-1">₹{customers.reduce((s, c) => s + (Number(c.balance) || 0), 0).toLocaleString()}</h3>
            <p className="text-[10px] text-gray-400 font-bold mt-1">From {customers.filter(c => (Number(c.balance) || 0) > 0).length} Customers</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* MAIN SPLIT LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

        {/* LEFT COLUMN (TABLE AREA) */}
        <div className="xl:col-span-3 space-y-4">

          {selectedCustomerIds.length > 0 && (
            <div className="flex flex-row flex-wrap gap-2 w-full">
              <button
                onClick={() => { if (isSubscriptionActive) { handleBulkSend(); } }}
                disabled={!isSubscriptionActive}
                className={`flex items-center justify-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-all text-xs ${!isSubscriptionActive ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp Reminder ({selectedCustomerIds.length})
              </button>
              <button
                onClick={() => setSelectedCustomerIds([])}
                className="flex items-center gap-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg font-bold hover:bg-gray-50 text-xs"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            </div>
          )}

          {/* Hierarchical Area Drill-Down Filters */}


          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm p-3 border border-gray-200 flex flex-col md:flex-row gap-3 mt-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by name or mobile number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
              />
            </div>
            <select
              value={selectedZoneFilter || 'all'}
              onChange={(e) => { setSelectedZoneFilter(e.target.value === 'all' ? null : e.target.value); setSelectedAreaFilter(null); setSelectedCustomerIds([]); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-green-500 outline-none bg-white text-sm"
            >
              <option value="all">All Zones</option>
              {availableZones.map(zone => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as SubscriptionStatus | 'all'); setSelectedCustomerIds([]); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-green-500 outline-none bg-white text-sm"
            >
              <option value="all">All Status</option>
              <option value="renewed">Renewed</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
            </select>
            <select
              value={cycleFilter}
              onChange={(e) => { setCycleFilter(e.target.value); setSelectedCustomerIds([]); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-green-500 outline-none bg-white text-sm"
            >
              <option value="all">All Packs</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <select
              value={paymentFilter}
              onChange={(e) => { setPaymentFilter(e.target.value); setSelectedCustomerIds([]); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-green-500 outline-none bg-white text-sm"
            >
              <option value="all">All Payments</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          {/* Selection Info */}
          {selectedCustomerIds.length > 0 && (
            <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-100 flex items-center justify-between text-sm text-green-800">
              <div className="flex items-center gap-2">
                <span className="font-medium">{selectedCustomerIds.length}</span>
                <span>customers selected</span>
                {selectedCustomerIds.length === currentCustomers.length && currentCustomers.length < customers.length && (
                  <button
                    onClick={handleSelectFully}
                    className="ml-2 underline hover:text-green-600 font-semibold"
                  >
                    Select all {customers.length} customers
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedCustomerIds([])}
                className="text-green-600 hover:text-green-800 font-medium"
              >
                Clear selection
              </button>
            </div>
          )}

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-black text-gray-600 uppercase tracking-widest whitespace-nowrap w-10">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={selectedCustomerIds.length === filteredCustomers.length && filteredCustomers.length > 0}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </th>
                    <th className="px-4 py-4 text-xs font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">Customer</th>
                    <th className="px-4 py-4 text-xs font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">Pack</th>
                    <th className="px-4 py-4 text-center text-xs font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">Payment Status</th>
                    <th className="px-4 py-4 text-center text-xs font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">Payment Action</th>
                    <th className="px-4 py-4 text-right text-xs font-black text-gray-600 uppercase tracking-widest whitespace-nowrap">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentCustomers.map(customer => {
                    const firstPack = customer.packs?.[0];
                    return (
                      <tr key={customer.id} className={`hover:bg-gray-50 transition-colors ${selectedCustomerIds.includes(customer.id) ? 'bg-green-50/30' : ''}`}>
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedCustomerIds.includes(customer.id)}
                            onChange={() => handleSelectCustomer(customer.id)}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black uppercase shadow-sm ${customer.status === 'renewed' ? 'bg-green-100 text-green-700' : (customer.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}`}>
                              {customer.name.substring(0, 2)}
                            </div>
                            <div className="flex flex-col items-start">
                              <button onClick={() => setSelectedCustomerForProfile(customer)} className="text-sm font-bold text-gray-800 hover:text-green-600">
                                {customer.name}
                              </button>
                              <span className="text-[10px] font-bold text-gray-500 mt-0.5 tabular-nums">{customer.mobile}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-bold text-gray-800">{firstPack?.name || 'No Pack'}</p>
                          <p className="text-[10px] text-gray-500 font-semibold mt-0.5">{firstPack ? `${firstPack.renewalCycle === 'daily' ? '1 Month' : 'Weekly'}` : 'N/A'}</p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${customer.status === 'renewed' ? 'bg-green-50 text-green-600 border-green-200' : (customer.status === 'expired' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-yellow-50 text-yellow-600 border-yellow-200')}`}>
                            {customer.status || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => onMarkPaid && onMarkPaid(customer.id)}
                              className={`mx-auto px-3 py-1.5 border rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1 transition-all ${
                                customer.paymentStatus === 'paid' && customer.status === 'renewed'
                                  ? 'border-green-100 text-green-500 bg-green-50/50 hover:bg-green-50 opacity-70' 
                                  : 'border-green-600 text-white bg-green-600 hover:bg-green-700 shadow-sm'
                              }`}
                            >
                              <span className="font-bold">₹</span> {customer.paymentStatus === 'paid' && customer.status === 'renewed' ? 'Paid' : 'Mark Paid'}
                            </button>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenDropdownId(openDropdownId === customer.id ? null : customer.id);
                                }}
                                className="px-3 py-1.5 border border-gray-200 text-gray-700 bg-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-gray-100"
                              >
                                <Eye className="w-3.5 h-3.5" /> Manage
                              </button>
                              
                              {openDropdownId === customer.id && (
                                <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 flex flex-col overflow-hidden">
                                  <button
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      setSelectedCustomerForProfile(customer);
                                    }}
                                    className="px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> View Profile
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      if (onEditCustomer) onEditCustomer(customer);
                                    }}
                                    className="px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                  >
                                    <Edit className="w-3.5 h-3.5" /> Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      setOpenDropdownId(null);
                                      if (onDeleteCustomer) onDeleteCustomer(customer.id);
                                    }}
                                    className="px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredCustomers.length === 0 && (
                <div className="py-12 text-center text-gray-500">
                  No customers found matching your criteria
                </div>
              )}
            </div>

            {/* Pagination Controls Desktop */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium text-gray-900">{indexOfFirstItem + 1}</span> to <span className="font-medium text-gray-900">{Math.min(indexOfLastItem, filteredCustomers.length)}</span> of <span className="font-medium text-gray-900">{filteredCustomers.length}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      // Only show a few page buttons around current page
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${currentPage === page
                              ? 'bg-green-600 text-white border border-green-600'
                              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="text-gray-400">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Mobile Card View */}
          <div className="lg:hidden space-y-4">
            {currentCustomers.map(customer => {
              const firstPack = customer.packs?.[0];
              return (
                <div key={customer.id} className={`bg-white rounded-xl shadow-sm border p-4 ${selectedCustomerIds.includes(customer.id) ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedCustomerIds.includes(customer.id)}
                        onChange={() => handleSelectCustomer(customer.id)}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                      />
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black uppercase shadow-sm ${customer.status === 'renewed' ? 'bg-green-100 text-green-700' : (customer.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700')}`}>
                        {customer.name.substring(0, 2)}
                      </div>
                      <div className="flex flex-col">
                        <button onClick={() => setSelectedCustomerForProfile(customer)} className="text-sm font-bold text-gray-800 hover:text-green-600 text-left truncate max-w-[150px]">
                          {customer.name}
                        </button>
                        <span className="text-[10px] font-bold text-gray-500 mt-0.5 tabular-nums">{customer.mobile}</span>
                      </div>
                    </div>
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenDropdownId(openDropdownId === customer.id ? null : customer.id);
                        }}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                      
                      {openDropdownId === customer.id && (
                        <div className="absolute right-0 mt-2 w-36 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1 flex flex-col overflow-hidden">
                          <button onClick={() => { setOpenDropdownId(null); setSelectedCustomerForProfile(customer); }} className="px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Eye className="w-3.5 h-3.5" /> View Profile
                          </button>
                          <button onClick={() => { setOpenDropdownId(null); if (onEditCustomer) onEditCustomer(customer); }} className="px-4 py-2 text-left text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                            <Edit className="w-3.5 h-3.5" /> Edit
                          </button>
                          <button onClick={() => { setOpenDropdownId(null); if (onDeleteCustomer) onDeleteCustomer(customer.id); }} className="px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2">
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 mb-4 bg-gray-50/80 p-3 rounded-lg border border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Pack</p>
                      <p className="text-xs font-bold text-gray-800 truncate">{firstPack?.name || 'No Pack'}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-semibold">{firstPack ? `${firstPack.renewalCycle === 'daily' ? '1 Month' : 'Weekly'}` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Status</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${customer.status === 'renewed' ? 'bg-green-50 text-green-600 border-green-200' : (customer.status === 'expired' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-yellow-50 text-yellow-600 border-yellow-200')}`}>
                        {customer.status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Payment</p>
                      <p className={`text-xs font-bold ${customer.paymentStatus === 'paid' ? 'text-green-600' : 'text-gray-800'}`}>
                        {customer.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </p>
                    </div>
                    <button
                      onClick={() => onMarkPaid && onMarkPaid(customer.id)}
                      className={`px-4 py-2 border rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all ${
                        customer.paymentStatus === 'paid' && customer.status === 'renewed'
                          ? 'border-green-100 text-green-500 bg-green-50/50 hover:bg-green-50 opacity-70' 
                          : 'border-green-600 text-white bg-green-600 hover:bg-green-700 shadow-sm'
                      }`}
                    >
                      <span className="font-bold">₹</span> {customer.paymentStatus === 'paid' && customer.status === 'renewed' ? 'Paid' : 'Mark Paid'}
                    </button>
                  </div>
                </div>
              );
            })}
            
            {filteredCustomers.length === 0 && (
              <div className="py-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
                No customers found matching your criteria
              </div>
            )}
            
            {/* Pagination Controls Mobile */}
            {totalPages > 1 && (
              <div className="flex flex-col items-center gap-3 pt-2">
                <div className="text-xs text-gray-500">
                  Showing <span className="font-bold text-gray-900">{indexOfFirstItem + 1}</span> to <span className="font-bold text-gray-900">{Math.min(indexOfLastItem, filteredCustomers.length)}</span> of <span className="font-bold text-gray-900">{filteredCustomers.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${currentPage === page
                              ? 'bg-green-600 text-white border border-green-600'
                              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                              }`}
                          >
                            {page}
                          </button>
                        );
                      } else if (page === currentPage - 2 || page === currentPage + 2) {
                        return <span key={page} className="text-gray-400 text-xs">...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div> {/* Close Left Column (col-span-3) */}

        {/* RIGHT SIDEBAR (QUICK ACTIONS & OVERVIEW) */}
        <div className="xl:col-span-1 space-y-6">
          {/* Today's Overview Panel */}
          <div className="bg-white rounded-3xl p-6 border-2 border-green-200 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-4 uppercase tracking-widest">TODAY'S OVERVIEW</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                  <span className="text-gray-500 font-bold">Deliveries to do</span>
                </div>
                <span className="font-black text-gray-900">{deliveriesSummary.total}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span className="text-gray-500 font-bold">Completed</span>
                </div>
                <span className="font-black text-green-600">{deliveriesSummary.delivered}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400"></div>
                  <span className="text-gray-500 font-bold">Pending</span>
                </div>
                <span className="font-black text-yellow-600">{deliveriesSummary.pending}</span>
              </div>
              {deliveriesSummary.paused > 0 && (
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                    <span className="text-gray-500 font-bold">Paused/Holiday</span>
                  </div>
                  <span className="font-black text-gray-500">{deliveriesSummary.paused}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white rounded-3xl p-6 border-2 border-green-200 shadow-sm">
            <h3 className="text-sm font-black text-gray-800 mb-4 uppercase tracking-widest">QUICK ACTIONS</h3>
            <div className="space-y-3">
              <button onClick={onAddCustomer} className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:bg-green-50 hover:border-green-200 transition-all text-left group">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100">
                  <User className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-bold text-gray-700 group-hover:text-green-700">Add Customer</span>
              </button>

              <button 
                onClick={() => {
                  if (selectedCustomerIds.length === 1) {
                    const c = customers.find(c => c.id === selectedCustomerIds[0]);
                    if (c) {
                       setSelectedCustomerForProfile(c);
                    }
                  } else {
                    toast.info('Please select exactly ONE customer to manage packs.');
                  }
                }} 
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-bold text-gray-700 group-hover:text-blue-700">Create Pack</span>
              </button>

              <button 
                onClick={() => {
                   if (selectedCustomerIds.length > 0) {
                      setShowAssignModal(true);
                   } else {
                      toast.info('Please select customers to add delivery.');
                   }
                }} 
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:bg-green-50 hover:border-green-200 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100">
                  <Truck className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-bold text-gray-700 group-hover:text-green-700">Add Delivery</span>
              </button>

              <button 
                onClick={() => {
                  if (selectedCustomerIds.length > 0) {
                    onSendBulkReminders(selectedCustomerIds);
                  } else {
                    toast.info('Select a customer to send reminder');
                  }
                }} 
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:bg-green-50 hover:border-green-200 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center group-hover:bg-green-100">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-sm font-bold text-gray-700 group-hover:text-green-700">Send Reminder</span>
              </button>

              <button 
                onClick={async () => {
                  if (selectedCustomerIds.length === 1) {
                    const c = customers.find(c => c.id === selectedCustomerIds[0]);
                    if (c) {
                      try {
                        toast.loading('Generating Auto-Pay link...', { id: 'autopay_bulk' });
                        const res = await customerAPI.generateAutopayLink({
                          customerId: c.id,
                          amount: Number(c.packPrice) || 0,
                          packName: c.packName,
                          renewalCycle: c.renewalCycle
                        });
                        if (res.data.success) {
                          toast.success('Auto-Pay link generated successfully!', { id: 'autopay_bulk' });
                          if (res.data.url) {
                            window.open(`https://wa.me/${c.mobile}?text=${encodeURIComponent(`Hi ${c.name}, set up your Auto-Pay here: ${res.data.url}`)}`, '_blank');
                          }
                        } else {
                          toast.error(res.data.error || 'Failed to generate link', { id: 'autopay_bulk' });
                        }
                      } catch (err: any) {
                        toast.error(err.response?.data?.error || 'Failed to generate Auto-Pay link', { id: 'autopay_bulk' });
                      }
                    }
                  } else if (selectedCustomerIds.length > 1) {
                    toast.info('Please select only ONE customer for Auto-Pay.');
                  } else {
                    toast.info('Select a customer to send Auto-Pay link');
                  }
                }} 
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:bg-blue-50 hover:border-blue-200 transition-all text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100">
                  <Repeat className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-bold text-gray-700 group-hover:text-blue-700">Send Auto-Pay Link</span>
              </button>
            </div>
          </div>
        </div>

      </div> {/* Close Grid Layout */}


      {/* Customer Profile Modal */}
      {selectedCustomerForProfile && (
        <CustomerProfileModal
          customer={selectedCustomerForProfile}
          onClose={() => setSelectedCustomerForProfile(null)}
          onAddPack={() => {
            setSelectedCustomerForProfile(null);
            setSelectedCustomerForPack(selectedCustomerForProfile);
            setShowPackModal(true);
          }}
        />
      )}

      {/* Assign Pack Modal */}
      {showPackModal && selectedCustomerForPack && (
        <AssignPackModal
          packs={packs}
          deliveryUsers={deliveryUsers}
          customer={selectedCustomerForPack}
          onAssign={async (packsData) => {
            setAssigning(true);
            try {
              const res = await customerAPI.update(selectedCustomerForPack.id, {
                ...selectedCustomerForPack,
                packs: packsData
              });
              if (res.data.success) {
                toast.success(`Successfully updated packs for ${selectedCustomerForPack.name}`);
                setTimeout(() => window.location.reload(), 1500);
              }
            } catch (err) {
              toast.error('Failed to update packs');
            } finally {
              setAssigning(false);
              setShowPackModal(false);
              setSelectedCustomerForPack(null);
            }
          }}
          onClose={() => {
            setShowPackModal(false);
            setSelectedCustomerForPack(null);
          }}
          isLoading={assigning}
        />
      )}

      {/* Assign Delivery Modal */}
      {showAssignModal && (
        <AssignDeliveryModal
          deliveryUsers={deliveryUsers}
          onAssign={async (userId) => {
            setAssigning(true);
            try {
              const res = await customerAPI.bulkAssignDeliveryUser({
                customerIds: selectedCustomerIds,
                deliveryUserId: userId
              });
              if (res.data.success) {
                toast.success(`Successfully assigned delivery user!`);
                setTimeout(() => window.location.reload(), 1500);
              }
            } catch (error) {
              toast.error('Failed to assign delivery user.');
            } finally {
              setAssigning(false);
              setShowAssignModal(false);
              setSelectedCustomerIds([]);
            }
          }}
          onClose={() => setShowAssignModal(false)}
          isLoading={assigning}
        />
      )}
    </div>
  );
}

// --- Assign Pack Modal Component ---
function AssignPackModal({ packs, deliveryUsers, customer, onAssign, onClose, isLoading }: {
  packs: Pack[],
  deliveryUsers: DeliveryUser[],
  customer: Customer,
  onAssign: (packsData: {
    packId: string,
    quantity: number,
    startDate: string,
    renewalDate: string,
    renewalCycle: 'weekly' | 'monthly' | 'daily',
    totalDeliveries: number
  }[]) => void,
  onClose: () => void,
  isLoading: boolean
}) {
  const calculateRenewalDate = (startDate: string, deliveries: number) => {
    if (!startDate || deliveries <= 0) return '';
    const date = new Date(startDate + 'T00:00:00');
    let count = 1;
    while (count < deliveries) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0) count++;
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [selectedPacks, setSelectedPacks] = useState<{
    status: string,
    packId: string,
    quantity: number,
    startDate: string,
    renewalDate: string,
    renewalCycle: 'weekly' | 'monthly' | 'daily',
    totalDeliveries: number
  }[]>(
    customer.packs && customer.packs.length > 0
      ? customer.packs.map(p => ({
        status: p.status || 'active',
        packId: p.packId.toString(),
        quantity: p.quantity,
        startDate: p.startDate ? p.startDate.split('T')[0] : (customer.subscriptionStartDate?.split('T')[0] || new Date().toISOString().split('T')[0]),
        renewalDate: p.renewalDate ? p.renewalDate.split('T')[0] : (customer.renewalDate?.split('T')[0] || ''),
        renewalCycle: p.renewalCycle as 'weekly' | 'monthly' | 'daily' || (customer.renewalCycle as 'weekly' | 'monthly' | 'daily' || 'monthly'),
        totalDeliveries: p.totalDeliveries || (customer.totalDeliveries || 24)
      }))
      : [{
        status: customer.status || 'active',
        packId: customer.packId?.toString() || '',
        quantity: customer.quantity || 1,
        startDate: customer.subscriptionStartDate?.split('T')[0] || new Date().toISOString().split('T')[0],
        renewalDate: customer.renewalDate?.split('T')[0] || '',
        renewalCycle: customer.renewalCycle as 'weekly' | 'monthly' | 'daily' || 'monthly',
        totalDeliveries: customer.totalDeliveries || 24
      }]
  );

  const addPackRow = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedPacks([...selectedPacks, {
      status: 'active',
      packId: '',
      quantity: 1,
      startDate: today,
      renewalDate: calculateRenewalDate(today, 24),
      renewalCycle: 'monthly',
      totalDeliveries: 24
    }]);
  };

  const removePackRow = (index: number) => {
    const newPacks = selectedPacks.filter((_, i) => i !== index);
    setSelectedPacks(newPacks.length > 0 ? newPacks : [{
      status: 'active',
      packId: '',
      quantity: 1,
      startDate: new Date().toISOString().split('T')[0],
      renewalDate: '',
      renewalCycle: 'monthly',
      totalDeliveries: 24
    }]);
  };

  const calculateTotalAmount = () => {
    return selectedPacks.reduce((total, row) => {
      const pack = packs.find(p => p.id.toString() === row.packId);
      return total + (pack?.price || 0) * row.quantity;
    }, 0);
  };

  const updatePackRow = (index: number, field: keyof typeof selectedPacks[0], value: any) => {
    const newPacks = [...selectedPacks];
    newPacks[index] = { ...newPacks[index], [field]: value } as any;

    if (field === 'packId') {
      const pack = packs.find(p => p.id.toString() === value);
      if (pack) {
        newPacks[index].renewalCycle = pack.billingCycle as any;
        newPacks[index].totalDeliveries = pack.billingCycle === 'weekly' ? 6 : (pack.billingCycle === 'daily' ? Number(pack.billingDays || 1) : 24);
        newPacks[index].renewalDate = calculateRenewalDate(newPacks[index].startDate, newPacks[index].totalDeliveries);
      }
    } else if (field === 'startDate' || field === 'totalDeliveries' || field === 'renewalCycle') {
      if (field === 'renewalCycle') {
        const currentPack = packs.find(p => p.id.toString() === newPacks[index].packId);
        newPacks[index].totalDeliveries = (value === 'weekly' ? 6 : (value === 'daily' ? Number(currentPack?.billingDays || 1) : 24));
      }
      newPacks[index].renewalDate = calculateRenewalDate(newPacks[index].startDate, newPacks[index].totalDeliveries);
    }
    setSelectedPacks(newPacks);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-xl">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 tracking-tight">Assign Packs: {customer.name}</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <XCircle className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Subscriptions</label>
            <button onClick={addPackRow} className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-xl hover:bg-green-100 transition-all border border-green-100 shadow-sm shadow-green-50">
              <Plus className="w-3.5 h-3.5" />
              Add Pack
            </button>
          </div>

          <div className="space-y-4">
            {selectedPacks.map((row, index) => (
              <div key={index} className="p-5 rounded-2xl border border-gray-100 bg-white shadow-sm space-y-4 relative overflow-hidden group">
                <div className="flex items-center justify-between border-b border-gray-50 pb-2.5">
                  <span className="text-[10px] font-black text-green-400 uppercase tracking-widest leading-none">Subscription #{index + 1}</span>
                  {selectedPacks.length > 1 && (
                    <button onClick={() => removePackRow(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1 select-none">Pack Type</label>
                    <select
                      value={row.packId}
                      onChange={(e) => updatePackRow(index, 'packId', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none bg-gray-50/50 text-sm font-semibold"
                    >
                      <option value="">Select Pack</option>
                      {packs.map(p => <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1 select-none">Qty</label>
                    <input
                      type="number"
                      min="1"
                      value={row.quantity}
                      onChange={(e) => updatePackRow(index, 'quantity', parseInt(e.target.value) || 1)}
                      className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-600 outline-none bg-gray-50/50 text-sm font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1 select-none">Start Date</label>
                    <input
                      type="date"
                      value={row.startDate}
                      onChange={(e) => updatePackRow(index, 'startDate', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-green-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1 select-none">Cycle</label>
                    <select
                      value={row.renewalCycle}
                      onChange={(e) => updatePackRow(index, 'renewalCycle', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-green-600 outline-none"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1 select-none text-green-600">Total Deliveries</label>
                    <input
                      type="number"
                      value={row.totalDeliveries}
                      onChange={(e) => updatePackRow(index, 'totalDeliveries', parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-2 border border-green-100 bg-green-50/20 rounded-xl text-xs font-bold text-green-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1 select-none text-orange-600 font-black">Next Renewal</label>
                    <input
                      type="date"
                      value={row.renewalDate}
                      onChange={(e) => updatePackRow(index, 'renewalDate', e.target.value)}
                      className="w-full px-4 py-2 border-2 border-orange-200 bg-orange-50/20 rounded-xl text-xs font-black text-orange-700 outline-none focus:border-orange-400"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[10px] bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 border-dashed">
                  <span className="font-bold text-gray-400 uppercase tracking-widest">Row Subtotal</span>
                  <span className="font-black text-gray-800">
                    ₹{(packs.find(p => p.id.toString() === row.packId)?.price || 0) * row.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-5 bg-gradient-to-br from-green-600 to-green-800 rounded-3xl text-white shadow-xl shadow-green-100 flex items-center justify-between relative overflow-hidden group">
            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.2em] mb-1 leading-none">Total Combined Price</p>
              <p className="text-3xl font-black italic tracking-tighter">₹{calculateTotalAmount()}</p>
            </div>
            <div className="relative z-10 bg-white/10 p-3 rounded-2xl backdrop-blur-md">
              <Package className="w-8 h-8 text-white/80" />
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50/30 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-gray-600 hover:bg-white transition-all text-sm uppercase tracking-widest">
            Discard
          </button>
          <button
            disabled={isLoading || selectedPacks.some(p => !p.packId)}
            onClick={() => onAssign(selectedPacks)}
            className="flex items-center gap-2 px-10 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-black text-sm transition-all shadow-lg shadow-green-100 disabled:opacity-50 disabled:grayscale uppercase tracking-widest"
          >
            {isLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving...</> : 'Save All Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Assign Delivery Modal Component ---
function AssignDeliveryModal({ deliveryUsers, onAssign, onClose, isLoading }: {
  deliveryUsers: DeliveryUser[],
  onAssign: (userId: string) => void,
  onClose: () => void,
  isLoading: boolean
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Truck className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800">Assign Delivery Boy</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">Choose a delivery person to assign to the selected customers.</p>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {deliveryUsers.length === 0 ? (
              <div className="py-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                <User className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 font-medium">No delivery personnel found</p>
                <p className="text-xs text-gray-400">Add them in Delivery Management</p>
              </div>
            ) : (
              deliveryUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onAssign(user.id)}
                  disabled={isLoading}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-green-50 hover:border-green-200 border border-gray-100 rounded-2xl transition-all group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-bold text-green-600 border border-gray-100 shadow-sm group-hover:bg-green-600 group-hover:text-white transition-all">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-gray-800 group-hover:text-green-700">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.mobile}</p>
                      {user.address && (
                        <p className="text-[10px] text-gray-400 italic mt-0.5 line-clamp-1">{user.address}</p>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 group-hover:translate-x-1 transition-all" />
                </button>
              ))
            )}
          </div>
        </div>

        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 text-gray-600 font-bold text-sm hover:bg-gray-200 rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Customer Profile Modal Component ---
function CustomerProfileModal({ customer, onClose, onAddPack }: { customer: Customer, onClose: () => void, onAddPack: () => void }) {
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(false);

  // Helper for UI masking
  const maskMobile = (m: string) => {
    if (!m || m.includes('*')) return m; // Already masked in DB or invalid
    if (m.length < 5) return '**********';
    // Showing first 2 and last 2 digits, masking the middle
    return m.substring(0, 2) + '*'.repeat(m.length - 4) + m.substring(m.length - 2);
  };

  // Safe date formatter
  const formatDateSafe = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) {
        // Handle custom dd Mon yyyy format if needed or just return string
        return dateStr;
      }
      return d.toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Dynamic Status Logic (Same as List)
  const getDynamicStatus = () => {
    if (!customer.renewalDate) return customer.status;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const renewal = new Date(customer.renewalDate);

    if (renewal < today && customer.status !== 'renewed') return 'expired';
    if (customer.status === 'renewed' && renewal < today) return 'expired';
    return customer.status;
  };

  const dynamicStatus = getDynamicStatus();

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await paymentHistoryAPI.getAll(customer.id);
        if (res.data.success) {
          setHistory(res.data.data);
        }
      } catch (err) {
        console.error('Failed to fetch payment history');
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [customer.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in duration-200">
        {/* Sidebar Info */}
        <div className="w-full md:w-80 bg-gray-50 border-r border-gray-100 flex flex-col max-h-[90vh]">
          {/* Header - Fixed */}
          <div className="p-8 pb-4 text-center">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-green-100">
              <User className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">{customer.name}</h2>
            <p className="text-gray-500 text-sm mt-1">{maskMobile(customer.mobile)}</p>
          </div>

          {/* Scrollable Content section */}
          <div className="flex-1 overflow-y-auto p-8 pt-0 space-y-6 custom-scrollbar">
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Contact Information</h3>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold">Mobile</p>
                  <p className="text-sm text-gray-800 font-semibold">{maskMobile(customer.mobile)}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold">Address</p>
                  <p className="text-sm text-gray-800 font-medium leading-relaxed">{customer.address || "No address provided"}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold">Zone</p>
                  <p className="text-sm text-gray-800 font-semibold">{customer.zone || "Not Specified"}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold">Last Payment</p>
                  <p className="text-sm text-gray-800 font-semibold">{formatDateSafe(customer.lastPaymentDate)}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                  <Truck className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold">Delivery Boy</p>
                  <p className="text-sm text-gray-800 font-semibold">{customer.deliveryManName || "Not Assigned"}</p>
                </div>
              </div>

              {/* Added Distance and Charge info */}
              <div className="flex items-start gap-4">
                <div className="p-2 bg-green-50 rounded-xl border border-green-100 shadow-sm">
                  <MapPin className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-green-400 font-black uppercase tracking-tighter">Delivery Info</p>
                  <p className="text-sm text-gray-800 font-bold">
                    {customer.distanceKm ? `${customer.distanceKm} KM` : '0 KM'}
                  </p>
                  <p className="text-[10px] text-gray-400 font-bold">
                    Fee: ₹{customer.deliveryCharge || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Subscription Status</h3>
              <div className={`p-4 rounded-2xl border ${dynamicStatus === 'renewed' ? 'bg-green-50 border-green-100 text-green-700' : dynamicStatus === 'expired' ? 'bg-red-50 border-red-100 text-red-700' : 'bg-yellow-50 border-yellow-100 text-yellow-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {dynamicStatus === 'renewed' ? <CheckCircle className="w-4 h-4" /> : dynamicStatus === 'expired' ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  <span className="text-sm font-black uppercase tracking-tight">{dynamicStatus}</span>
                </div>
                <p className="text-[10px] font-bold opacity-70 italic">Cycle: {customer.renewalCycle || 'Monthly'}</p>
              </div>

              {/* Sidebar Packs Summary List */}
              {customer.packs && customer.packs.length > 0 && (
                <div className="space-y-2 mt-4">
                  <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Packs</h3>
                  {customer.packs.map((p, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-800 truncate">{p.name}</p>
                        <p className="text-[9px] text-gray-400 font-medium">Expires: {p.renewalDate ? new Date(p.renewalDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter ${p.status === 'renewed' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                          {p.status}
                        </span>
                        <span className="text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-tighter bg-gray-100 text-gray-600">
                          {p.renewalCycle || 'Monthly'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-8 pt-4 border-t border-gray-100 bg-gray-50">
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-gray-800 text-white rounded-2xl font-bold text-sm hover:bg-gray-900 transition-all shadow-lg active:scale-95"
            >
              Close Profile
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-8 overflow-y-auto">
          {/* Subscription Packs List */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Subscription Packs</h3>
              <button
                onClick={onAddPack}
                className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl text-xs font-bold transition-all border border-green-100 flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Pack
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {customer.packs && customer.packs.length > 0 ? (
                customer.packs.map((p, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3">
                      <Package className="w-5 h-5 text-green-500 opacity-20" />
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] font-black bg-green-50 text-green-600 px-2 py-1 rounded-lg uppercase tracking-wider">{p.renewalCycle}</span>
                    </div>
                    <h4 className="text-base font-bold text-gray-800 mb-1">{p.name}</h4>
                    {(() => {
                      let multiplier = 1;
                      if (p.renewalCycle === 'daily') {
                        multiplier = p.totalDeliveries || 1;
                      }
                      const totalAmount = p.price * p.quantity * multiplier;
                      const subtitle = p.renewalCycle === 'daily'
                        ? `(${multiplier} days x Qty ${p.quantity} x ₹${p.price})`
                        : `(${p.quantity}x ₹${p.price})`;
                      return (
                        <p className="text-xl font-black text-gray-900 mb-4">
                          ₹{totalAmount} <span className="text-xs text-gray-400 font-bold tracking-tight">{subtitle}</span>
                        </p>
                      );
                    })()}

                    <div className="space-y-2 pt-3 border-t border-gray-50">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-gray-400 font-bold uppercase tracking-widest">Started</span>
                        <span className="text-gray-700 font-black">{p.startDate ? new Date(p.startDate).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-orange-500 font-black uppercase tracking-widest">Expires</span>
                        <span className="text-orange-700 font-black px-2 py-0.5 bg-orange-50 rounded-lg border border-orange-100 italic">
                          {p.renewalDate ? new Date(p.renewalDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-8 text-center bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                  <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm font-bold text-gray-400">No Packs Assigned</p>
                </div>
              )}
            </div>
          </div>

          {/* Billing & Payment History */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <History className="w-5 h-5 text-green-500" />
                Transaction History
              </h3>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                {history.length} Records found
              </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 grayscale opacity-40">
                <RefreshCw className="w-10 h-10 animate-spin mb-4" />
                <p className="font-bold text-gray-400">Fetching history...</p>
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-3">
                {history.map((item, idx) => (
                  <div key={idx} className="bg-white border border-gray-100 p-4 rounded-2xl flex items-center justify-between transition-all hover:border-green-200 hover:shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${item.paymentStatus === 'success' || item.paymentStatus === 'paid' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">
                          {item.description || "Subscription Payment"}
                        </p>
                        <p className="text-xs text-gray-400 font-semibold">
                          {formatDateSafe(item.paymentDate || item.transactionDate)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-gray-800">₹{item.amount}</p>
                      <span className={`text-[10px] uppercase font-black tracking-tight ${item.paymentStatus === 'success' || item.paymentStatus === 'paid' ? 'text-green-500' : 'text-red-500'}`}>
                        {item.paymentStatus}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 border border-dashed border-gray-200 rounded-3xl p-12 text-center">
                <History className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-bold">No payment history available yet.</p>
                <p className="text-xs text-gray-400 mt-1 italic">Records will appear here once the customer makes a payment.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
