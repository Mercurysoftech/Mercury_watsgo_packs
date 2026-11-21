import { useState, useEffect } from 'react';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { CustomerList } from './components/CustomerList';
import { AddEditCustomer } from './components/AddEditCustomer';
import { ReminderModal } from './components/ReminderModal';
import { Settings } from './components/Settings';
import { AccessDenied } from './components/AccessDenied';
import { UserManagement } from './components/UserManagement';
import { AddEditUser } from './components/AddEditUser';
import { ReminderReports } from './components/ReminderReports';
import { BulkReminderModal } from './components/BulkReminderModal';
import SubscriptionManagement from './components/SubscriptionManagement';
import { PaymentStatus } from './components/PaymentStatus';
import { CategoryManagement } from './components/CategoryManagement';
import { SimplePaymentHistory } from './components/SimplePaymentHistory';
import { CustomerAttendance } from './components/CustomerAttendance';
import { CustomerReviews } from './components/CustomerReviews';
import { WithdrawalRequests } from './components/WithdrawalRequests';
import { InvoiceView } from './components/InvoiceView';
import { DeliveryUserManagement } from './components/DeliveryUserManagement';
import { SubscriptionLock } from './components/SubscriptionLock';
import { ReminderLogs } from './components/ReminderLogs';
import { socketService } from './services/socketService';
import { toast, Toaster } from 'sonner';
import { authAPI, customerAPI, settingsAPI, reminderAPI, subscriptionAPI, paymentHistoryAPI, attendanceAPI, reviewAPI } from './services/api';
import { Page, Customer, BusinessSettings, UserRole, User, AdminNotification } from './types';
import { TopBar } from './components/TopBar';
import { playNotificationChime } from './utils/sound';
import { showDesktopNotification, requestNotificationPermission } from './utils/browserNotification';
import { LayoutDashboard, Users, UserPlus, LogOut, Apple, Menu, X, Shield, UserCog, BarChart2, RefreshCcw } from 'lucide-react';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState<User | null>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [showRegister, setShowRegister] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [reminderCustomer, setReminderCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<BusinessSettings>({
    businessName: 'Fresh Fruit Packs',
    contactEmail: '',
    contactPhone: '',
    address: '',
    smsReminders: true,
    emailNotifications: true,
    reminderDaysBefore: '3',
    defaultPackPrice: '999',
    currency: 'INR',
    whatsappEnabled: false,
    whatsappApiKey: '',
    whatsappPhoneNumberId: '',
    whatsappBusinessAccountId: '',
    whatsappReminderTemplate: 'Hi {{customer_name}}, your monthly fruit pack subscription is due for renewal on {{renewal_date}}. Please complete your payment using the link below:\n{{payment_info}}\nRenew now to continue enjoying fresh fruits.\n– {{business_name}}',
    smsReminderTemplate: "Your Login Verification code: 1234 Don't share this code with others -MERCURY",
    smsTemplateId: '1607100000000339284',
    reminderTime: '09:00',
    timezone: 'Asia/Kolkata',
    deliveryCharges: '0',
    deliveryFreeKm: '3',
    deliveryPricePerKm: '10',
    googleMapsApiKey: '',
    privacyPolicy: '',
    termsConditions: '',
    businessType: 'fruits'
  });
  const [users, setUsers] = useState<User[]>([]);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [bulkReminderIds, setBulkReminderIds] = useState<string[] | null>(null);
  const [subscription, setSubscription] = useState<{ status: string, expiry: string | null, daysRemaining: number, planType?: string } | null>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [paymentResult, setPaymentResult] = useState<{ status: 'success' | 'failure', message?: string } | null>(null);
  const [markPaidCustomerId, setMarkPaidCustomerId] = useState<string | null>(null);
  const [markPaidPackIds, setMarkPaidPackIds] = useState<number[]>([]);
  const [markPaidDate, setMarkPaidDate] = useState(new Date().toISOString().split('T')[0]);
  const [markPaidPackDates, setMarkPaidPackDates] = useState<{ [key: number]: string }>({});
  const [markPaidLoading, setMarkPaidLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [markPaidCustomChargeName, setMarkPaidCustomChargeName] = useState('');
  const [markPaidCustomChargeAmount, setMarkPaidCustomChargeAmount] = useState('0');
  const [markPaidDeliveryCharge, setMarkPaidDeliveryCharge] = useState('0');
  const [markPaidAmountReceived, setMarkPaidAmountReceived] = useState('0');

  // In-App Notification Center State with Local Storage caching
  const [notifications, setNotifications] = useState<AdminNotification[]>(() => {
    try {
      const saved = localStorage.getItem('packs_admin_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('packs_admin_notifications', JSON.stringify(notifications.slice(0, 50)));
    } catch (e) {
      console.warn("Failed to persist notifications:", e);
    }
  }, [notifications]);

  const addNotification = (item: Omit<AdminNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AdminNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      read: false,
      ...item,
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 49)]);
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearNotifications = () => {
    setNotifications([]);
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleNotificationClick = (notif: AdminNotification) => {
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n));
    if (notif.targetPage) {
      setCurrentPage(notif.targetPage);
    }
  };

  // Check for payment status in URL 111
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('payment_status');
    const subId = params.get('sub_id');

    if (status === 'success' || status === 'failure') {
      const resultStatus = status as 'success' | 'failure';
      setPaymentResult({
        status: resultStatus,
        message: params.get('message') || undefined
      });
      setCurrentPage('payment-status');

      // If success, verify and then refresh data
      if (resultStatus === 'success') {
        const syncAndRefresh = async () => {
          if (subId) {
            try {
              // Proactively verify the subscription to avoid waiting for webhook
              await subscriptionAPI.verifySubscription(subId);
            } catch (e) {
              console.warn('Verification failed, but data might still be updated via webhook:', e);
            }
          }
          await fetchInitialData();
        };
        syncAndRefresh();
      }

      // Clear URL params after reading
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Polling for subscription status when on success page
  useEffect(() => {
    let pollInterval: any;

    if (currentPage === 'payment-status' && paymentResult?.status === 'success' && subscription?.status !== 'active') {
      // Poll every 3 seconds for 2 minutes or until active
      pollInterval = setInterval(() => {
        fetchInitialData();
      }, 2000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentPage, paymentResult, subscription?.status]);

  // Fetch data on login/load
  useEffect(() => {
    if (isLoggedIn) {
      fetchInitialData();
    }
  }, [isLoggedIn]);

  // Socket connection for real-time updates
  useEffect(() => {
    if (isLoggedIn && currentUser) {
      // Automatically check/request desktop notification permission once
      requestNotificationPermission();

      // Connect to Socket
      const socket = socketService.connect();

      // Join Admin Room (Business specific)
      socketService.joinRoom(`admin_${currentUser.id}`);

      // Listen for delivery updates from the App API
      socketService.on('delivery_update', (data) => {
        console.log("Real-time delivery update:", data);

        if (data.type === 'DELIVERY_DONE') {
          const itemText = data.meal && data.meal !== 'pack' ? data.meal.toUpperCase() : 'the order';
          const title = `Delivery Completed 🚚`;
          const custName = data.customer_name ? `Customer ${data.customer_name}` : 'the customer';
          const driverName = data.delivery_man_name ? `Delivery partner ${data.delivery_man_name}` : 'Delivery partner';
          const desc = `${driverName} has successfully delivered ${itemText} to ${custName}.`;

          toast.success(title, {
            description: desc,
            duration: 6000,
            className: '!bg-white !border-green-200 !text-gray-900 shadow-xl',
          });
          playNotificationChime('success');
          showDesktopNotification(title, desc, () => {
            setCurrentPage('attendance');
          });
          addNotification({
            type: 'delivery',
            title,
            description: desc,
            targetPage: 'attendance',
            meta: data
          });
          // Refresh data to show updated stats/history
          fetchInitialData();
        }
      });

      // Listen for new reviews
      socketService.on('new_review', (data) => {
        console.log("New review received:", data);
        const title = `New Customer Review ⭐ (${data.rating}/5 Stars)`;
        const feedbackSnippet = data.feedback ? `: "${data.feedback}"` : '.';
        const custName = data.customer_name ? `Customer ${data.customer_name}` : 'A customer';
        const desc = `${custName} submitted a ${data.rating}-star review${feedbackSnippet}`;

        toast.success(title, {
          description: desc,
          duration: 6000,
          className: '!bg-white !border-green-200 !text-gray-900 shadow-xl',
        });
        playNotificationChime('info');
        showDesktopNotification(title, desc, () => {
          setCurrentPage('reviews');
        });
        addNotification({
          type: 'review',
          title,
          description: desc,
          targetPage: 'reviews',
          meta: data
        });
        fetchInitialData();
      });

      // Listen for subscription updates
      socketService.on('subscription_update', (data) => {
        console.log("Subscription update:", data);
        const custName = data.customer_name ? `Customer ${data.customer_name}` : 'A customer';
        let title = 'Subscription Updated 📦';
        let desc = `${custName} updated their subscription.`;

        if (data.type === 'PLAN_RENEWED') {
          title = 'Subscription Renewed 🎉';
          desc = `${custName} has successfully renewed their ${data.pack_name || 'pack'} plan.`;
        } else if (data.type === 'PLAN_PAUSED') {
          title = 'Subscription Paused ⏸️';
          desc = `${custName} has paused their subscription plan.`;
        } else {
          title = 'New Subscription Activated 📦';
          desc = `${custName} has purchased a ${data.pack_name || 'subscription'} plan.`;
        }

        toast.success(title, {
          description: desc,
          duration: 6000,
          className: '!bg-white !border-green-200 !text-gray-900 shadow-xl',
        });
        playNotificationChime('success');
        showDesktopNotification(title, desc, () => {
          setCurrentPage('customers');
        });
        addNotification({
          type: 'subscription',
          title,
          description: desc,
          targetPage: 'customers',
          meta: data
        });
        fetchInitialData();
      });

      // Listen for withdrawal requests
      socketService.on('withdrawal_request', (data) => {
        console.log("Withdrawal request:", data);
        const formattedAmount = Number(data.amount || 0).toLocaleString('en-IN');
        const title = `New Withdrawal Request 💰`;
        const driverName = data.delivery_man_name ? `Delivery partner ${data.delivery_man_name}` : 'A delivery partner';
        const desc = `${driverName} has requested a payout of ₹${formattedAmount}.`;

        toast.success(title, {
          description: desc,
          duration: 7000,
          className: '!bg-white !border-amber-200 !text-gray-900 shadow-xl',
        });
        playNotificationChime('alert');
        showDesktopNotification(title, desc, () => {
          setCurrentPage('delivery-user');
        });
        addNotification({
          type: 'withdrawal',
          title,
          description: desc,
          targetPage: 'delivery-user',
          meta: data
        });
      });

      return () => {
        socketService.disconnect();
      };
    }
  }, [isLoggedIn, currentUser]);

  const fetchInitialData = async () => {
    setLoading(true);
    setSubLoading(true);
    try {
      // First check subscription
      const subRes = await subscriptionAPI.getStatus();
      const sub = subRes.data.subscription;
      setSubscription(sub);
      setSubLoading(false);

      // Always sync user profile with server to update permissions/details
      try {
        const profileRes = await authAPI.getProfile();
        if (profileRes.data.user) {
          const updatedUser = profileRes.data.user;
          setCurrentUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      } catch (e) {
        // Profile fetch failed, fallback to local storage (already set in state init)
      }

      // Always fetch settings
      try {
        const settingsRes = await settingsAPI.get();
        if (settingsRes.data.settings) {
          setSettings(settingsRes.data.settings);
        }
      } catch (e) {
        // Settings fetch failed, keep defaults
      }

      // Fetch customers and users for active subs OR free/trial plan users
      if (sub?.status === 'active' || sub?.planType === 'free' || sub?.planType === 'trial' || !sub?.status) {
        try {
          const customersRes = await customerAPI.getAll();
          setCustomers(customersRes.data.customers || []);
        } catch (e) {
          setCustomers([]); // Clear if fetch fails
        }

        // Fetch users list for admin
        const userRole = currentUser?.role || JSON.parse(localStorage.getItem('user') || '{}').role;
        if (userRole === 'admin') {
          try {
            const usersRes = await authAPI.getAllUsers();
            setUsers(usersRes.data.users || []);
          } catch (e) {
            // Ignore users fetch error
          }
        }
      } else {
        // Not subscribed and not on free plan - clear data
        setCustomers([]);
        setUsers([]);
      }

    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
      setSubLoading(false);
    }
  };

  const handleLogin = async (data: any) => {
    try {
      // Clear previous user's data before login
      setCustomers([]);
      setUsers([]);
      const res = await authAPI.login(data);
      if (res.data && res.data.success) {
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setCurrentUser(user);
        setIsLoggedIn(true);
        setShowRegister(false);

        // Immediately refresh permissions for staff users
        if (user.role === 'staff') {
          try {
            const profileRes = await authAPI.getProfile();
            if (profileRes.data.user) {
              setCurrentUser(profileRes.data.user);
              localStorage.setItem('user', JSON.stringify(profileRes.data.user));
            }
          } catch (e) {
            console.warn('Failed to refresh permissions after login:', e);
          }
        }
      } else {
        alert(res.data?.error || 'Login API returned an invalid response. Expected JSON but got HTML. Check API Base URL.');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Login failed');
    }
  };

  const handleRegister = async (data: any) => {
    try {
      // Clear previous user's data before registering
      setCustomers([]);
      setUsers([]);
      const res = await authAPI.register(data);
      if (res.data.success) {
        const { token, user } = res.data;
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setCurrentUser(user);
        setIsLoggedIn(true);
        setShowRegister(false);
        alert('Registration successful!');
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Registration failed');
    }
  };

  const handleShowRegister = () => {
    setShowRegister(true);
  };

  const handleBackToLogin = () => {
    setShowRegister(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setShowRegister(false);
    setCurrentPage('dashboard');
  };

  const handleNavigate = (page: Page) => {
    // allow navigation to all pages

    // If we're coming from payment-status, refresh to get updated subscription info
    if (currentPage === 'payment-status' && page === 'dashboard') {
      fetchInitialData();
    }

    if (page === 'settings' && currentPage === 'invoice') {
      // Keep selected invoice if needed or clear it
    }

    setCurrentPage(page);
    setEditingCustomer(null);
    setEditingUser(null);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setCurrentPage('edit-customer');
  };

  const handleSaveCustomer = async (customerData: any) => {
    try {
      if ('id' in customerData) {
        await customerAPI.update(customerData.id, customerData);
        toast.success('Customer updated successfully');
      } else {
        await customerAPI.create(customerData);
        toast.success('Customer added successfully');
      }
      await fetchInitialData();
      setCurrentPage('customers');
      setEditingCustomer(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save customer');
    }
  };

  const handleCancelEdit = () => {
    setEditingCustomer(null);
    setCurrentPage('customers');
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this customer? This will also delete their reminder history.')) return;
    try {
      await customerAPI.delete(id);
      toast.success('Customer deleted successfully');
      await fetchInitialData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete customer');
    }
  };

  const handleMarkPaid = (customerId: string, packId?: number) => {
    setMarkPaidDate(new Date().toISOString().split('T')[0]);
    setMarkPaidCustomerId(customerId);

    // Use string normalization for reliable lookup
    const customer = customers.find(c => String(c.id) === String(customerId));

    const selectedIds: string[] = [];
    if (packId) {
      selectedIds.push(String(packId));
    } else if (customer?.packs && customer.packs.length > 0) {
      customer.packs.forEach(p => {
        if (p.status !== 'renewed') selectedIds.push(String(p.id));
      });
    }

    setMarkPaidPackIds(selectedIds as any);
    const dates: Record<number, string> = {};
    selectedIds.forEach(id => {
      dates[Number(id)] = new Date().toISOString().split('T')[0];
    });
    setMarkPaidPackDates(dates);

    // Default delivery charge calculation
    const distanceKm = Number(customer?.distanceKm || 0);
    const freeKm = Number(settings.deliveryFreeKm || 3);
    const pricePerKm = Number(settings.deliveryPricePerKm || 0);

    // Calculate delivery charges based on settings
    let finalModalDeliveryCharge = 0;

    if (settings.isFreeShipping) {
      finalModalDeliveryCharge = 0;
    } else {
      // Default distance calculation
      let calculatedDeliveryChargeFromDistance = 0;
      if (distanceKm > 0) {
        const extraCharge = Math.max(0, (distanceKm - freeKm) * pricePerKm);
        calculatedDeliveryChargeFromDistance = Number(extraCharge.toFixed(2));
      }

      // Priority: Saved charge from profile > Distance calculation
      const customerSavedCharge = Number(customer?.deliveryCharge || 0);
      finalModalDeliveryCharge = customerSavedCharge > 0
        ? customerSavedCharge
        : calculatedDeliveryChargeFromDistance;
    }

    setMarkPaidDeliveryCharge(finalModalDeliveryCharge.toString());
    setMarkPaidCustomChargeAmount("");
    setMarkPaidCustomChargeName("");

    // Total Amount Calculation
    let currentPackAmount = 0;
    if (selectedIds.length > 0) {
      currentPackAmount = selectedIds.reduce((sum, id) => {
        const p = customer?.packs?.find(pack => String(pack.id) == String(id));
        const price = Number(p?.price || (p as any)?.packPrice || (p as any)?.pack_base_price || 0);
        const qty = Number(p?.quantity || 1);
        let multiplier = 1;
        if (p?.renewalCycle === 'daily') {
          multiplier = p.totalDeliveries || 1;
        }
        return sum + (price * qty * multiplier);
      }, 0);
    } else {
      currentPackAmount = Number(customer?.packPrice || (customer as any)?.pack_base_price || 0);
    }

    const initialTotal = currentPackAmount + finalModalDeliveryCharge + Number(customer?.balance || 0);
    setMarkPaidAmountReceived(initialTotal.toFixed(2));
  };

  const handleConfirmMarkPaid = async () => {
    if (!markPaidCustomerId) return;
    setMarkPaidLoading(true);
    try {
      console.log('Sending markPaid request:', {
        customerId: markPaidCustomerId,
        paymentDate: markPaidDate,
        packIds: markPaidPackIds
      });
      const customer = customers.find(c => String(c.id) === String(markPaidCustomerId));
      const selectedPacks = customer?.packs?.filter(p => markPaidPackIds.some(id => String(id) == String(p.id))) || [];
      const packAmount = selectedPacks.length > 0
        ? selectedPacks.reduce((sum, p) => {
          let multiplier = 1;
          if (p.renewalCycle === 'daily') {
            multiplier = p.totalDeliveries || 1;
          }
          return sum + (Number(p.price || (p as any).packPrice || 0) * Number(p.quantity || 1) * multiplier);
        }, 0)
        : (selectedPacks.length === 0 && customer?.packs && customer.packs.length > 0 ? 0 : (Number(customer?.packPrice || (customer as any).pack_base_price) || 0));
      const deliveryCharge = Number(markPaidDeliveryCharge) || 0;
      const customAmount = Number(markPaidCustomChargeAmount) || 0;
      const prevBalance = Number(customer?.balance) || 0;
      const totalDue = packAmount + deliveryCharge + customAmount + prevBalance;
      const computedBalance = totalDue - Number(markPaidAmountReceived || 0);

      const res = await paymentHistoryAPI.markPaid({
        customerId: markPaidCustomerId,
        paymentDate: markPaidDate,
        packIds: markPaidPackIds,
        packDates: markPaidPackDates,
        recordPayment: true,
        customChargeName: markPaidCustomChargeName,
        customChargeAmount: Number(markPaidCustomChargeAmount) || 0,
        manualDeliveryCharge: Number(markPaidDeliveryCharge),
        amountPaid: Number(markPaidAmountReceived),
        balance: computedBalance
      });
      console.log('markPaid response:', res.data);
      setMarkPaidCustomerId(null);
      setMarkPaidPackIds([]);
      setMarkPaidCustomChargeName('');
      setMarkPaidCustomChargeAmount('0');
      setMarkPaidDeliveryCharge('0');
      setMarkPaidAmountReceived('0');
      toast.success('Payment recorded successfully');
      await fetchInitialData();
    } catch (error: any) {
      console.error('markPaid error details:', error.response?.data);
      const errMsg = error.response?.data?.error || 'Failed to mark customer as paid';
      const details = error.response?.data?.details;
      toast.error(details ? `${errMsg}: ${details}` : errMsg);
    } finally {
      setMarkPaidLoading(false);
    }
  };

  const handleSendReminder = (customer: Customer) => {
    setReminderCustomer(customer);
  };

  const handleConfirmSendReminder = async (via: 'sms' | 'whatsapp', customMessage: string) => {
    if (!reminderCustomer) return;
    try {
      const res = await reminderAPI.send({
        customerId: reminderCustomer.id,
        sendVia: via,
        message: customMessage
      });
      if (res.data.isFreePlan && res.data.redirectUrl) {
        window.open(res.data.redirectUrl, '_blank');
      } else if (res.data.success) {
        toast.success('Reminder sent successfully');
      }
      setReminderCustomer(null);
    } catch (error: any) {
      if (error.response?.data?.planRestricted) {
        // Handle free plan redirection if backend blocks manual send but provides lead
        const customer = reminderCustomer;
        const phone = customer.mobile.replace(/\D/g, '');
        const message = encodeURIComponent(customMessage || `Hi ${customer.name}, your subscription is due for renewal.`);
        const url = `https://wa.me/${phone}?text=${message}`;
        window.open(url, '_blank');
        setReminderCustomer(null);
        return;
      }
      toast.error(error.response?.data?.error || 'Failed to send reminder');
    }
  };

  const handleSendBulkReminders = (customerIds: string[]) => {
    setBulkReminderIds(customerIds);
  };

  const handleConfirmBulkSend = async (options: { via: 'sms' | 'whatsapp', isScheduled: boolean, scheduledDate?: string }) => {
    if (!bulkReminderIds) return;

    setLoading(true);
    try {
      if (options.isScheduled && options.scheduledDate) {
        const res = await reminderAPI.scheduleBulk({
          customerIds: bulkReminderIds,
          scheduledDate: options.scheduledDate,
          sendVia: options.via
        });
        if (res.data.success) {
          toast.success(`Successfully scheduled reminders for ${bulkReminderIds.length} customers`);
        }
      } else {
        const res = await reminderAPI.sendBulk({
          customerIds: bulkReminderIds,
          sendVia: options.via
        });
        if (res.data.success) {
          toast.success(res.data.message || 'Bulk reminders sent successfully');
        }
      }
      setBulkReminderIds(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to process bulk reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseBulkReminder = () => {
    setBulkReminderIds(null);
  };

  const handleCloseReminder = () => {
    setReminderCustomer(null);
  };

  const handleSaveSettings = async (newSettings: BusinessSettings) => {
    try {
      await settingsAPI.update(newSettings);
      setSettings(newSettings);
      toast.success('Settings saved successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save settings');
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setCurrentPage('edit-user');
  };

  const handleSaveUser = async (userData: any) => {
    try {
      if (userData.id) {
        // Admin editing a specific user
        const isUpdatingPermissions = !!userData.permissions;
        await authAPI.updateUser(userData.id, userData);

        // If we're updating a user with permissions, show a message
        if (isUpdatingPermissions) {
          alert(`✅ Permissions updated for ${userData.fullName}!\n\nNote: The staff member needs to log out and log back in to see their new menu access.`);
        }
      } else {
        // Register new staff user
        await authAPI.register(userData);
      }
      // Refresh all data including users list
      await fetchInitialData();

      // If we're updating a user with permissions, also update current user if it's the same user
      if (userData.permissions && currentUser?.id === userData.id) {
        setCurrentUser({
          ...currentUser,
          permissions: userData.permissions
        });
      }

      setCurrentPage('users');
      setEditingUser(null);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save user');
    }
  };

  const handleCancelEditUser = () => {
    setEditingUser(null);
    setCurrentPage('users');
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await authAPI.deleteUser(userId);
      await fetchInitialData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setCurrentPage('add-user');
  };

  const handleRecalculateDistance = async (id: string) => {
    try {
      const res = await customerAPI.recalculateDistance(id);
      if (res.data.success) {
        // Update local customers state so it reflects in the modal immediately
        setCustomers(prev => prev.map(c =>
          String(c.id) === String(id)
            ? { ...c, distanceKm: res.data.distanceKm, deliveryCharge: res.data.deliveryCharge }
            : c
        ));
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to recalculate distance');
    }
  };

  if (!isLoggedIn) {
    return showRegister ? (
      <RegisterPage
        onRegister={handleRegister}
        onBackToLogin={handleBackToLogin}
      />
    ) : (
      <LoginPage onLogin={handleLogin} onNavigateToRegister={handleShowRegister} />
    );
  }

  const userRole = currentUser?.role || 'staff';

  const handleAutoSchedule = async (customerIds: string[]) => {
    try {
      if (confirm(`Do you want to auto-schedule reminders for ${customerIds.length} customers?`)) {
        const res = await reminderAPI.autoSchedule({ customerIds });
        if (res.data.success) {
          alert(res.data.message);
        } else {
          alert('Failed to schedule reminders');
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to schedule reminders');
    }
  };
  const isSubscriptionActive = subscription?.status === 'active';
  const isTrialOrFree = subscription?.planType === 'trial' || subscription?.planType === 'free' || subscription?.planType === 'basic';
  const isAppLocked = !!subscription && !isSubscriptionActive && (isTrialOrFree || !subscription.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-gray-50 to-orange-50 overflow-x-hidden">
      <Toaster
        position="top-right"
        expand={true}
        toastOptions={{
          style: {
            borderRadius: '16px',
            border: '1px solid #bbf7d0',
            boxShadow: '0 10px 25px -5px rgba(22, 163, 74, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
          },
        }}
      />
      {/* Always show Navigation even if subscription is inactive */}
      <Navigation
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        userRole={userRole}
        userName={settings.businessName}
        userLogo={settings.businessLogo}
        subscription={subscription}
        permissions={currentUser?.permissions}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearNotifications={handleClearNotifications}
        onNotificationClick={handleNotificationClick}
        onDeleteNotification={handleDeleteNotification}
      />

      {/* Main Content */}
      <div className="lg:pl-[280px]">
        <TopBar
          userName={settings.businessName}
          userRole={userRole}
          userLogo={settings.businessLogo}
          hideMenu={isAppLocked}
          onLogout={handleLogout}
          notifications={notifications}
          onMarkAllAsRead={handleMarkAllAsRead}
          onClearNotifications={handleClearNotifications}
          onNotificationClick={handleNotificationClick}
          onDeleteNotification={handleDeleteNotification}
        />
        <div className="pt-24 lg:pt-6 px-4 md:px-6 lg:px-10 pb-12">
          {currentPage === 'dashboard' && (
            <Dashboard
              customers={customers}
              userName={currentUser?.fullName}
              subscription={subscription}
              onNavigate={handleNavigate}
            />
          )}

          {/* Show inactive subscription banner */}
          {/* Show inactive subscription banner only if it's not a valid trial */}
          {!isSubscriptionActive && (!isTrialOrFree || (subscription?.daysRemaining !== undefined && subscription.daysRemaining <= 0)) && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded flex items-start justify-between animate-in slide-in-from-top duration-300">
              <div className="flex items-start gap-3">
                <div className="text-red-500 font-bold text-xl mt-1">⚠️</div>
                <div>
                  <h3 className="font-bold text-red-800">Your Subscription is Inactive</h3>
                  <p className="text-red-700 text-sm mt-1">Your plan has expired or is inactive. Please renew your subscription to continue using all features.</p>
                </div>
              </div>
              <button
                onClick={() => setCurrentPage('settings')}
                className="px-4 py-2 bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition-colors ml-4 whitespace-nowrap"
              >
                Renew Plan
              </button>
            </div>
          )}

          {(true) && (
            <>
              {currentPage === 'customers' && (
                <CustomerList
                  customers={customers}
                  onEditCustomer={handleEditCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                  onSendReminder={handleSendReminder}
                  onSendBulkReminders={handleSendBulkReminders}
                  onAutoSchedule={handleAutoSchedule}
                  onMarkPaid={handleMarkPaid}
                  onAddCustomer={() => setCurrentPage('add-customer')}
                  userRole={userRole}
                  isSubscriptionActive={isSubscriptionActive}
                  subscription={subscription}
                />
              )}

              {(currentPage === 'add-customer' || currentPage === 'edit-customer') && (
                userRole === 'admin' ? (
                  <AddEditCustomer
                    customer={editingCustomer}
                    settings={settings}
                    onSave={handleSaveCustomer}
                    onCancel={handleCancelEdit}
                    isSubscriptionActive={isSubscriptionActive}
                    subscription={subscription}
                  />
                ) : (
                  <AccessDenied onNavigateBack={() => handleNavigate('dashboard')} />
                )
              )}

              {currentPage === 'settings' && (
                userRole === 'admin' ? (
                  <Settings
                    settings={settings}
                    onSave={handleSaveSettings}
                    onViewInvoice={(inv) => { setSelectedInvoice(inv); setCurrentPage('invoice'); }}
                    onLogout={handleLogout}
                    isSubscriptionActive={isSubscriptionActive}
                    subStatus={subscription}
                    onRefreshStatus={fetchInitialData}
                  />
                ) : (
                  <AccessDenied onNavigateBack={() => handleNavigate('dashboard')} />
                )
              )}


              {currentPage === 'reports' && (
                isSubscriptionActive && (subscription?.planType !== 'free' && subscription?.planType !== 'trial') ? (
                  <ReminderReports isSubscriptionActive={isSubscriptionActive} />
                ) : (
                  <SubscriptionLock
                    featureName="Reports & Logs"
                    onUpgrade={() => setCurrentPage('settings')}
                    currentPlan={subscription?.planType}
                    requiredPlans={['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE']}
                  />
                )
              )}

              {currentPage === 'payment-history' && (
                <SimplePaymentHistory
                  isSubscriptionActive={isSubscriptionActive}
                  settings={settings}
                />
              )}

              {currentPage === 'attendance' && (
                <CustomerAttendance isSubscriptionActive={isSubscriptionActive} />
              )}

              {currentPage === 'logs' && (
                <ReminderLogs />
              )}
            </>
          )}

          {/* These pages are always accessible */}
          {(true) && (
            <>
              {currentPage === 'reviews' && (
                isSubscriptionActive && (subscription?.planType === 'pro' || subscription?.planType === 'enterprise') ? (
                  <CustomerReviews />
                ) : (
                  <SubscriptionLock
                    featureName="Customer Reviews"
                    onUpgrade={() => setCurrentPage('settings')}
                    currentPlan={subscription?.planType}
                    requiredPlans={['PRO', 'ENTERPRISE']}
                  />
                )
              )}

              {currentPage === 'withdrawals' && (
                isSubscriptionActive && (subscription?.planType === 'pro' || subscription?.planType === 'enterprise') ? (
                  <WithdrawalRequests />
                ) : (
                  <SubscriptionLock
                    featureName="Withdrawal Requests"
                    onUpgrade={() => setCurrentPage('settings')}
                    currentPlan={subscription?.planType}
                    requiredPlans={['PRO', 'ENTERPRISE']}
                  />
                )
              )}

              {currentPage === 'payment-status' && paymentResult && (
                <PaymentStatus
                  status={paymentResult.status}
                  message={paymentResult.message}
                  onNavigateHome={() => handleNavigate('dashboard')}
                  isSubscriptionActive={isSubscriptionActive}
                  onRefreshStatus={fetchInitialData}
                />
              )}

              {currentPage === 'categories' && (
                <CategoryManagement
                  userRole={userRole}
                  userName={currentUser?.fullName}
                  isSubscriptionActive={isSubscriptionActive}
                  settings={settings}
                />
              )}

              {currentPage === 'subscription' && (
                <SubscriptionManagement />
              )}

              {currentPage === 'invoice' && selectedInvoice && (
                <InvoiceView
                  invoice={selectedInvoice}
                  settings={settings}
                  onBack={() => handleNavigate('settings')}
                />
              )}

              {(currentPage === 'add-user' || currentPage === 'edit-user') && (
                userRole === 'admin' ? (
                  <AddEditUser
                    user={editingUser}
                    onSave={handleSaveUser}
                    onCancel={handleCancelEditUser}
                    isSubscriptionActive={isSubscriptionActive}
                  />
                ) : (
                  <AccessDenied onNavigateBack={() => handleNavigate('dashboard')} />
                )
              )}
            </>
          )}
          {currentPage === 'delivery-user' && (
            userRole === 'admin' ? (
              isSubscriptionActive && (subscription?.planType === 'growth' || subscription?.planType === 'pro' || subscription?.planType === 'enterprise') ? (
                <DeliveryUserManagement
                  isSubscriptionActive={true}
                />
              ) : (
                <SubscriptionLock
                  featureName="Delivery Boy Management"
                  onUpgrade={() => setCurrentPage('settings')}
                  currentPlan={subscription?.planType}
                  requiredPlans={['GROWTH', 'PRO', 'ENTERPRISE']}
                />
              )
            ) : (
              <AccessDenied onNavigateBack={() => handleNavigate('dashboard')} />
            )
          )}
          {currentPage === 'users' && (
            userRole === 'admin' ? (
              isSubscriptionActive ? (
                <UserManagement
                  users={users}
                  onEditUser={handleEditUser}
                  onDeleteUser={handleDeleteUser}
                  onAddUser={handleAddUser}
                  onSavePermissions={handleSaveUser}
                  isSubscriptionActive={isSubscriptionActive}
                  uniqueZones={Array.from(new Set(customers.map(c => c.zone).filter(Boolean))) as string[]}
                />
              ) : (
                <SubscriptionLock
                  featureName="Staff Management"
                  onUpgrade={() => setCurrentPage('settings')}
                  currentPlan={subscription?.planType}
                  requiredPlans={['STARTER', 'GROWTH', 'PRO', 'ENTERPRISE']}
                />
              )
            ) : (
              <AccessDenied onNavigateBack={() => handleNavigate('dashboard')} />
            )
          )}
        </div>
      </div>

      {reminderCustomer && (
        <ReminderModal
          customer={reminderCustomer}
          onSend={(via: "sms" | "whatsapp", message: string) => handleConfirmSendReminder(via, message)}
          onClose={handleCloseReminder}
          settings={settings}
        />
      )}

      {bulkReminderIds && (
        <BulkReminderModal
          customerCount={bulkReminderIds.length}
          onSend={handleConfirmBulkSend}
          onClose={handleCloseBulkReminder}
          settings={settings}
        />
      )}      {/* Mark as Paid Modal */}
      {markPaidCustomerId && (() => {
        const customer = customers.find(c => String(c.id) === String(markPaidCustomerId));
        const selectedPacks = customer?.packs?.filter(p => markPaidPackIds.some(id => String(id) == String(p.id))) || [];
        const currentPackAmount = selectedPacks.length > 0
          ? selectedPacks.reduce((sum, p) => {
            let multiplier = 1;
            if (p.renewalCycle === 'daily') {
              multiplier = p.totalDeliveries || 1;
            }
            return sum + (Number(p.price || (p as any).packPrice || 0) * Number(p.quantity || 1) * multiplier);
          }, 0)
          : (selectedPacks.length === 0 && customer?.packs && customer.packs.length > 0 ? 0 : (Number(customer?.packPrice || (customer as any).pack_base_price) || 0));

        const calculatedDeliveryChargeFromState = Number(markPaidDeliveryCharge) || 0;
        const customCharge = Number(markPaidCustomChargeAmount) || 0;
        const previousBalance = Number(customer?.balance || 0);
        const displayTotal = currentPackAmount + calculatedDeliveryChargeFromState + customCharge + previousBalance;
        const balanceRemaining = displayTotal - (Number(markPaidAmountReceived) || 0);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in duration-200">
              <div className="flex items-center justify-between p-6 bg-green-50/50 border-b border-green-100">
                <div>
                  <h2 className="text-xl font-black text-green-900 leading-tight">Mark as Paid</h2>
                  <p className="text-sm text-green-700/70 font-bold">
                    {customer?.name}
                    {previousBalance > 0 && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-lg border border-red-200 tracking-tighter uppercase whitespace-nowrap">Bal Due: ₹{previousBalance}</span>}
                  </p>
                </div>
                <button
                  onClick={() => { setMarkPaidCustomerId(null); setMarkPaidPackIds([]); setMarkPaidCustomChargeName(''); setMarkPaidCustomChargeAmount('0'); }}
                  className="p-2 hover:bg-green-100 rounded-xl transition-colors"
                  disabled={markPaidLoading}
                >
                  <X className="w-5 h-5 text-green-800" />
                </button>
              </div>
              <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Payment Date</label>
                  <input
                    type="date"
                    value={markPaidDate}
                    onChange={(e) => setMarkPaidDate(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
                  />
                </div>

                {customer?.packs && customer.packs.length > 0 && (
                  <div className="space-y-3">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">Select Packs to Renew</label>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar bg-gray-50/30 p-2 rounded-2xl border border-dashed border-gray-100">
                      {customer.packs.filter(p => p.status !== 'renewed').map(p => {
                        const isSelected = markPaidPackIds.some(id => String(id) == String(p.id));
                        return (
                          <div key={p.id} className={`p-4 rounded-2xl border-2 transition-all duration-300 space-y-3 ${isSelected ? 'border-green-500 bg-green-50 shadow-md transform scale-[1.02]' : 'border-gray-50 bg-gray-50 opacity-40 blur-[0.8px] grayscale'}`}>
                            <label className="flex items-center justify-between cursor-pointer group">
                              <div className="flex items-center gap-3">
                                <div className="relative">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      let newPackIds = [];
                                      if (e.target.checked) {
                                        newPackIds = [...markPaidPackIds, String(p.id)];
                                        setMarkPaidPackIds(newPackIds as any);
                                        if (!markPaidPackDates[p.id]) {
                                          setMarkPaidPackDates({ ...markPaidPackDates, [p.id]: markPaidDate });
                                        }
                                      } else {
                                        newPackIds = markPaidPackIds.filter(id => String(id) !== String(p.id));
                                        setMarkPaidPackIds(newPackIds as any);
                                      }

                                      // Auto-update amount received
                                      const newSelectedPacks = customer?.packs?.filter(pk => newPackIds.some(id => String(id) == String(pk.id))) || [];
                                      const newPackAmount = newSelectedPacks.reduce((sum, pk) => {
                                        let multiplier = 1;
                                        if (pk.renewalCycle === 'daily') {
                                          multiplier = pk.totalDeliveries || 1;
                                        }
                                        return sum + (Number(pk.price || (pk as any).packPrice || 0) * Number(pk.quantity || 1) * multiplier);
                                      }, 0);
                                      const deliveryCharge = Number(markPaidDeliveryCharge) || 0;
                                      const customAmount = Number(markPaidCustomChargeAmount) || 0;
                                      const balance = Number(customer?.balance) || 0;
                                      const newTotal = newPackAmount + deliveryCharge + customAmount + balance;
                                      setMarkPaidAmountReceived(newTotal.toFixed(2));
                                    }}
                                    className="w-5 h-5 rounded-lg border-2 border-gray-300 text-green-600 focus:ring-green-500 transition-all"
                                  />
                                </div>
                                <div>
                                  <p className={`text-sm font-black transition-colors ${isSelected ? 'text-green-900' : 'text-gray-400'}`}>{p.name}</p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">
                                      {p.renewalCycle === 'daily' ? `${p.totalDeliveries} days x Qty ${p.quantity} x ₹${p.price}` : `${p.quantity}x ₹${p.price}`}
                                    </p>
                                    {p.status === 'expired' && <span className="text-[8px] font-black bg-red-100 text-red-600 px-1 py-0.5 rounded uppercase tracking-tighter">Expired</span>}
                                  </div>
                                </div>
                              </div>
                              <span className={`text-sm font-black transition-colors ${isSelected ? 'text-green-700' : 'text-gray-400'}`}>
                                ₹{p.price * p.quantity * (p.renewalCycle === 'daily' ? (p.totalDeliveries || 1) : 1)}
                              </span>
                            </label>

                            {/* Individual pack dates removed per user request */}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-2 bg-green-50/50 p-3 rounded-2xl border border-green-100 transition-all hover:bg-green-100/50">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest leading-none text-green-600">
                          Delivery Charges {customer?.distanceKm ? `(${Number(customer.distanceKm).toFixed(2)} KM)` : ''}
                        </span>
                      </div>
                      <p className="text-[8px] font-medium text-green-500/70 mt-1 pl-1 italic">Adjust delivery manually if needed</p>
                    </div>
                    <div className="w-24">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-green-600">₹</span>
                        <input
                          type="number"
                          value={markPaidDeliveryCharge}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMarkPaidDeliveryCharge(val);
                            // Update total
                            const newTotal = currentPackAmount + Number(val) + (Number(markPaidCustomChargeAmount) || 0) + previousBalance;
                            setMarkPaidAmountReceived(newTotal.toFixed(2));
                          }}
                          className="w-full pl-6 pr-3 py-1.5 bg-white border border-green-200 rounded-xl focus:border-green-500 outline-none transition-all font-black text-xs text-gray-800"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Custom Charges Section */}
                  <div className="flex gap-3 bg-green-50/50 p-4 rounded-2xl border border-green-100">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-green-600 uppercase tracking-widest mb-1.5 ml-1">Charge Name (GST/Extra)</label>
                      <input
                        type="text"
                        value={markPaidCustomChargeName}
                        onChange={(e) => setMarkPaidCustomChargeName(e.target.value)}
                        placeholder="e.g. GST"
                        className="w-full px-4 py-2 bg-white border border-green-200 rounded-xl focus:border-green-500 outline-none transition-all font-bold text-xs text-gray-700"
                      />
                    </div>
                    <div className="w-32">
                      <label className="block text-[10px] font-black text-green-600 uppercase tracking-widest mb-1.5 ml-1">Amount</label>
                      <input
                        type="number"
                        value={markPaidCustomChargeAmount}
                        onChange={(e) => {
                          const val = e.target.value;
                          setMarkPaidCustomChargeAmount(val);
                          // Update total
                          const newTotal = currentPackAmount + calculatedDeliveryChargeFromState + (Number(val) || 0) + previousBalance;
                          setMarkPaidAmountReceived(newTotal.toFixed(2));
                        }}
                        className="w-full px-4 py-2 bg-white border border-green-200 rounded-xl focus:border-green-500 outline-none transition-all font-bold text-xs text-gray-700"
                      />
                    </div>
                  </div>

                  {/* Previous Balance Indicator */}
                  {previousBalance > 0 && (
                    <div className="flex items-center justify-between px-4 py-2 bg-red-50/50 rounded-xl border border-red-100 text-red-600">
                      <span className="text-[10px] font-black uppercase tracking-widest">Previous Balance Pending</span>
                      <span className="text-xs font-black italic">₹{previousBalance}</span>
                    </div>
                  )}

                  {/* Total Amount Summary */}
                  <div className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-gray-200">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Total Amount Due</span>
                      <span className="text-[9px] font-black uppercase mt-1 tracking-tighter text-green-500">
                        Packs + Delivery + Extras {previousBalance > 0 ? '+ Balance' : ''}
                      </span>
                    </div>
                    <span className="text-xl font-black text-white italic">₹{displayTotal.toFixed(2)}</span>
                  </div>

                  {/* Partial Payment Section */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-green-50/50 p-4 rounded-2xl border border-green-100">
                      <label className="block text-[10px] font-black text-green-600 uppercase tracking-widest mb-1.5 ml-1">Amount Paid</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-green-600">₹</span>
                        <input
                          type="number"
                          value={markPaidAmountReceived}
                          onChange={(e) => setMarkPaidAmountReceived(e.target.value)}
                          className="w-full pl-6 pr-4 py-2 bg-white border border-green-200 rounded-xl focus:border-green-500 outline-none transition-all font-black text-sm text-gray-800"
                        />
                      </div>
                    </div>
                    <div className={`p-4 rounded-2xl border ${balanceRemaining > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                      <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 ${balanceRemaining > 0 ? 'text-red-600' : 'text-gray-400'}`}>Balance Due</label>
                      <div className="flex items-center gap-1">
                        <span className={`text-sm font-black ${balanceRemaining > 0 ? 'text-red-700' : 'text-gray-500'}`}>₹{balanceRemaining.toFixed(2)}</span>
                        {balanceRemaining > 0 && <span className="text-[8px] font-black bg-red-100 text-red-600 px-1 py-0.5 rounded uppercase leading-none">Pending</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!customer) return;
                      const packDetails = selectedPacks.length > 0
                        ? selectedPacks.map(p => `${p.name} (${p.quantity}x ₹${p.price})`).join(', ')
                        : (customer.packName || 'Subscription Pack');

                      // We no longer perform replacements on the frontend to avoid corrupting JSON.
                      // The backend's reminderController.js now handles all replacements (named and numbered) safely.
                      const message = settings.whatsappReminderTemplate;

                      try {
                        setMarkPaidLoading(true);
                        const res = await reminderAPI.send({
                          customerId: customer.id,
                          sendVia: 'whatsapp',
                          message: message, // Sending the clean, original template structure
                          amount: displayTotal,
                          // Pass detailed data for template replacements backend-side
                          packDetails: packDetails,
                          deliveryCharge: calculatedDeliveryChargeFromState,
                          chargeName: markPaidCustomChargeName || "GST",
                          chargeAmount: markPaidCustomChargeAmount
                        });

                        if (res.data.success) {
                          alert('✅ Payment reminder sent successfully!');
                          // Clear state and close modal
                          setMarkPaidCustomerId(null);
                          setMarkPaidPackIds([]);
                          setMarkPaidCustomChargeName('');
                          setMarkPaidCustomChargeAmount('0');
                        }
                      } catch (err: any) {
                        if (err.response?.data?.planRestricted) {
                          // Fallback for free plan
                          const phone = customer.mobile.replace(/\D/g, '');
                          const textMsg = `Hi ${customer.name}, your payment reminder:\n\nPacks: ${packDetails}\nDelivery: ₹${calculatedDeliveryChargeFromState.toFixed(2)}\n${markPaidCustomChargeName ? `${markPaidCustomChargeName}: ₹${markPaidCustomChargeAmount}\n` : ''}Total: ₹${displayTotal.toFixed(2)}`;
                          window.open(`https://wa.me/${phone}?text=${encodeURIComponent(textMsg)}`, '_blank');
                          setMarkPaidCustomerId(null);
                        } else {
                          alert(err.response?.data?.error || 'Failed to send request');
                        }
                      } finally {
                        setMarkPaidLoading(false);
                      }
                    }}
                    disabled={markPaidLoading}
                    className="flex-1 px-4 py-3 bg-green-50 text-green-700 border-2 border-green-100 rounded-2xl hover:bg-green-100 transition-all font-black text-sm uppercase tracking-widest disabled:opacity-50"
                  >
                    Send Request
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMarkPaid}
                    disabled={markPaidLoading || !markPaidDate || (customer?.packs && customer.packs.length > 0 && markPaidPackIds.length === 0)}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 shadow-lg shadow-green-100 transition-all font-black text-sm uppercase tracking-widest disabled:opacity-50 disabled:grayscale"
                  >
                    {markPaidLoading ? 'Saving...' : 'Confirm Paid'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}