import { useState, useEffect } from 'react';
import { Building2, Bell, DollarSign, Lock, Save, MessageCircle, CheckCircle, XCircle, Loader2, CreditCard, Clock, Apple, X, FileText, ArrowUpCircle, Download, ExternalLink, DownloadCloud, Camera, User, Trash2, Truck, ShieldCheck, Smartphone, Users, UserPlus, MapPin, ShoppingCart, AlertTriangle } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { BusinessSettings } from '../types';
import { subscriptionAPI, authAPI, UPLOAD_BASE_URL } from '../services/api';
import { SubscriptionLock } from './SubscriptionLock';
import { toast } from 'sonner';

interface SettingsProps {
  settings: BusinessSettings;
  onSave: (settings: BusinessSettings) => void;
  onViewInvoice?: (invoice: any) => void;
  onLogout?: () => void;
  isSubscriptionActive?: boolean;
  subStatus?: {
    status: string,
    expiry: string | null,
    daysRemaining: number,
    planType?: string,
    razorpaySubscriptionId?: string,
    addons?: {
      deliveryBoys: number,
      customerApp: number,
      extraCustomers: number,
      extraStaff: number,
      extraZones: number
    }
  } | null;
  onRefreshStatus?: () => void;
}

const LockedFeatureWrapper = ({ children, isLocked, featureName, onUpgrade }: { children: React.ReactNode, isLocked: boolean, featureName: string, onUpgrade: () => void }) => {
  if (!isLocked) return <>{children}</>;

  return (
    <div className="relative group/locked">
      <div className="blur-[3px] pointer-events-none opacity-40 select-none">
        {children}
      </div>
      <div className="absolute inset-0 z-30 flex items-center justify-center p-4">
        <div className="bg-white/95 backdrop-blur-md border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.1)] rounded-[2.5rem] p-8 max-w-sm w-full text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-green-100 shadow-inner">
            <Lock className="w-8 h-8 text-green-600 animate-pulse" />
          </div>
          <h3 className="text-xl font-black text-gray-900 mb-2 tracking-tight">Unlock {featureName}</h3>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed font-medium">
            Take your business to the next level with <strong>Automation</strong>. Upgrade to access these premium controls!
          </p>
          <button
            onClick={onUpgrade}
            className="w-full py-4 bg-green-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-green-700 transition-all shadow-xl shadow-green-100 flex items-center justify-center gap-2 group active:scale-95"
          >
            <ArrowUpCircle className="w-5 h-5 group-hover:translate-y-[-2px] transition-transform" />
            View Subscription Plans
          </button>
          <p className="mt-4 text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">Mercury Softech • Premium</p>
        </div>
      </div>
    </div>
  );
};

export function Settings({ settings, onSave, onViewInvoice, onLogout, isSubscriptionActive = true, subStatus: manualSubStatus, onRefreshStatus }: SettingsProps) {
  const [formData, setFormData] = useState(settings);
  const [activeTab, setActiveTab] = useState<'business' | 'notifications' | 'whatsapp' | 'delivery' | 'payment' | 'subscription' | 'legal' | 'account' | 'sms'>('business');
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Password states
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [showTrialOverlay, setShowTrialOverlay] = useState(false);

  // Reset overlay when tab changes
  useEffect(() => {
    setShowTrialOverlay(false);
  }, [activeTab]);

  // Subscription states
  const [subStatus, setSubStatus] = useState<any>(manualSubStatus || null);
  const [subLoading, setSubLoading] = useState(false);

  // Sync state with prop
  useEffect(() => {
    if (manualSubStatus) {
      setSubStatus(manualSubStatus);
    }
  }, [manualSubStatus]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isInvoicesModalOpen, setIsInvoicesModalOpen] = useState(false);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false); const [billingPeriod, setBillingPeriod] = useState<'monthly' | '3months' | '6months' | 'yearly'>('monthly');
  const [plansData, setPlansData] = useState<any>(null);
  const PLANS = plansData?.plans || { monthly: [], '3months': [], '6months': [], yearly: [] };
  const ADDONS_FROM_DB = plansData?.addons || [];

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await subscriptionAPI.getPlans();
        if (res.data.success) {
          setPlansData(res.data);
        }
      } catch (err) {
        console.error('Failed to fetch dynamic plans:', err);
      }
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  useEffect(() => {
    fetchSubscriptionStatus();

    // Check for payment success from redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment_status') === 'success') {
      // Small delay to ensure DB is ready but we'll call verify to be sure
      const verifyPayment = async () => {
        try {
          // Last active subscription ID
          const res = await (await import('../services/api')).subscriptionAPI.getStatus();
          const subId = res.data.subscription?.razorpaySubscriptionId;
          if (subId) {
            await (await import('../services/api')).subscriptionAPI.verifySubscription(subId);
            fetchSubscriptionStatus(); // Refresh status
            if (onRefreshStatus) onRefreshStatus();
          }
        } catch (err) {
          console.error('Auto-verify error:', err);
        }
      };
      verifyPayment();

      // Clear URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchSubscriptionStatus = async () => {
    try {
      setSubLoading(true);
      const res = await subscriptionAPI.getStatus();
      setSubStatus(res.data.subscription);
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    } finally {
      setSubLoading(false);
    }
  };

  const handleViewInvoices = async () => {
    setIsInvoicesModalOpen(true);
    try {
      setInvoicesLoading(true);
      const res = await subscriptionAPI.getInvoices();
      setInvoices(res.data.invoices || []);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleSyncSubscription = async () => {
    try {
      setSubLoading(true);
      // Try to find the subscription ID to verify
      const statusRes = await subscriptionAPI.getStatus();
      const subId = statusRes.data.subscription?.razorpaySubscriptionId;

      if (subId) {
        await subscriptionAPI.verifySubscription(subId);
        await fetchSubscriptionStatus();
        if (onRefreshStatus) onRefreshStatus();
        toast.success('Subscription status synced successfully!');
      } else {
        await fetchSubscriptionStatus();
        if (onRefreshStatus) onRefreshStatus();
        toast.success('Status refreshed from database.');
      }
    } catch (err) {
      console.error('Sync error:', err);
      toast.error('Failed to sync. Please ensure you have an active subscription.');
    } finally {
      setSubLoading(false);
    }
  };

  const handlePayNow = async (plan: any) => {
    try {
      setPaymentLoading(true);

      const planType = plan.type;
      const amount = plan.price;
      const planName = plan.name;

      // 1. Get or Use existing Razorpay plan ID
      let planId = plan.razorpayPlanId;

      if (!planId) {
        console.log(`🆕 Creating new Razorpay plan for ${planName} (${billingPeriod})...`);
        const planRes = await subscriptionAPI.createPlan({
          planName: `${planName} - ${billingPeriod.charAt(0).toUpperCase() + billingPeriod.slice(1)}`,
          amount: amount,
          description: `${planName} subscription for Fresh Fruit Packs (${billingPeriod})`,
          planType: planType,
          billingPeriod: billingPeriod
        });
        planId = planRes.data.plan.id;
      } else {
        console.log(`✅ Using existing Razorpay plan ID: ${planId}`);
      }

      // 2. Create subscription
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const subRes = await subscriptionAPI.createSubscription({
        planId: planId,
        customerName: user.fullName || formData.businessName,
        customerEmail: user.email || formData.contactEmail,
        customerPhone: user.phone || formData.contactPhone || '919876543210',
        planType: planType,
        billingPeriod: billingPeriod
      });

      if (subRes.data.success && subRes.data.subscription.id) {
        const options = {
          key: subRes.data.razorpayKeyId,
          subscription_id: subRes.data.subscription.id,
          name: 'Fresh Fruit Packs',
          description: `${planName} (${billingPeriod})`,
          handler: function (response: any) {
            // Success! Redirect to our success page
            window.location.href = `${window.location.origin}${window.location.pathname}?payment_status=success`;
          },
          modal: {
            ondismiss: function () {
              // User closed the modal
              window.location.href = `${window.location.origin}${window.location.pathname}?payment_status=failure&message=Payment declined or window closed`;
            }
          },
          prefill: {
            name: user.fullName || formData.businessName,
            email: user.email || formData.contactEmail,
            contact: user.phone || formData.contactPhone || ''
          },
          theme: {
            color: '#16a34a' // Green-600
          }
        };

        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      toast.error(err.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image size should be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, businessLogo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const getLogoUrl = (logo?: string) => {
    if (!logo) return null;
    if (logo.startsWith('data:image')) return logo;
    if (logo.startsWith('http')) return logo;
    return `${UPLOAD_BASE_URL}${logo}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;

      // Trial Check: Show overlay if trying to enable features
      if (subStatus?.planType === 'trial' && checked && (activeTab === 'notifications' || activeTab === 'whatsapp' || activeTab === 'delivery')) {
        setShowTrialOverlay(true);
        return;
      }

      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'preferredPaymentMethod') {
      setFormData(prev => ({ ...prev, preferredPaymentMethod: value as 'razorpay' | 'upi' }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Lock logic for free/trial users on automated feature tabs
    const isRestrictedTab = activeTab === 'notifications' || activeTab === 'whatsapp' || activeTab === 'delivery';
    const isLockedUser = !isSubscriptionActive || (subStatus?.planType === 'free' || subStatus?.planType === 'trial' || subStatus?.planType === 'basic');

    if (isLockedUser && isRestrictedTab) {
      setIsUpgradeModalOpen(true);
      return;
    }

    setIsSaving(true);

    try {
      await onSave(formData);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('idle');

    // Simulate API connection test
    setTimeout(() => {
      // Mock validation
      if (formData.whatsappApiKey && formData.whatsappPhoneNumberId && formData.whatsappBusinessAccountId) {
        setConnectionStatus('success');
      } else {
        setConnectionStatus('error');
      }
      setIsTestingConnection(false);
    }, 2000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      setIsChangingPassword(true);
      const res = await (await import('../services/api')).authAPI.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      if (res.data.success) {
        toast.success('Password updated successfully!');
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const res = await authAPI.deleteAccount();
      if (res.data.success) {
        toast.success('Account deleted successfully. We are sorry to see you go.');
        if (onLogout) onLogout();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete account');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const tabs = [
    { id: 'business' as const, label: 'Business Profile', icon: Building2 },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'whatsapp' as const, label: 'WhatsApp API', icon: MessageCircle },
    { id: 'delivery' as const, label: 'Delivery', icon: Truck },
    { id: 'payment' as const, label: 'Payment', icon: CreditCard },
    { id: 'subscription' as const, label: 'Subscription', icon: DollarSign },
    { id: 'legal' as const, label: 'Legal Policies', icon: ShieldCheck },
    { id: 'account' as const, label: 'Account', icon: Lock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your business preferences and account settings</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex min-w-max">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-all border-b-2 ${activeTab === tab.id
                    ? 'border-green-500 text-green-600 bg-green-50/50'
                    : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={2} />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Trial Restrictions Overlay for specific tabs */}
        {showTrialOverlay && (
          <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-[4px] rounded-b-2xl flex flex-col items-center justify-center">
            {/* Added relative so we can put a close button */}
            <div className="relative bg-white p-8 rounded-[40px] shadow-2xl border border-green-50 flex flex-col items-center text-center max-w-md mx-auto animate-in zoom-in duration-300">
              <button
                type="button"
                onClick={() => setShowTrialOverlay(false)}
                className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-20 h-20 bg-green-50 rounded-[24px] flex items-center justify-center mb-6">
                <ShieldCheck className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Subscription Required</h3>
              <p className="text-gray-500 font-medium mb-8 leading-relaxed">
                The <strong>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</strong> features are available in our Pro and Growth plans. Upgrade your trial to unlock full automation.
              </p>
              <button
                type="button"
                onClick={() => setIsUpgradeModalOpen(true)}
                className="flex items-center gap-3 px-10 py-4 bg-green-600 text-white rounded-2xl font-black transition-all shadow-xl shadow-green-200 hover:bg-green-700 active:scale-95 text-lg"
              >
                <ArrowUpCircle className="w-6 h-6" />
                Upgrade Now
              </button>

              <p className="mt-6 text-[10px] font-black text-gray-300 uppercase tracking-widest">Mercury Softech Automation</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className={`p-6 md:p-8 relative ${showTrialOverlay ? 'pointer-events-none overflow-hidden h-[500px]' : ''}`}>
          {/* Business Profile Tab */}
          {activeTab === 'business' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Logo Upload Section */}
                <div className="flex-shrink-0">
                  <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 pl-1">Business Logo</p>
                  <div className="relative group">
                    <div className="w-40 h-40 rounded-3xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-green-400 group-hover:bg-green-50/30">
                      {formData.businessLogo ? (
                        <img
                          src={getLogoUrl(formData.businessLogo) || undefined}
                          alt="Business Logo"
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = logoImg; }}
                        />
                      ) : (
                        <div className="text-center p-4">
                          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">No Logo</span>
                        </div>
                      )}

                      {/* Overlay trigger */}
                      <label
                        className="absolute inset-0 cursor-pointer flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all opacity-0 group-hover:opacity-100"
                        htmlFor="logo-upload"
                      >
                        <div className="bg-white p-3 rounded-2xl shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                          <Camera className="w-6 h-6 text-green-600" />
                        </div>
                      </label>
                    </div>

                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    {formData.businessLogo && (
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, businessLogo: '' }))}
                        className="absolute -top-2 -right-2 p-2 bg-red-100 text-red-600 rounded-xl hover:bg-red-200 transition-all border-2 border-white shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="mt-3 text-[10px] font-bold text-gray-400 uppercase text-center tracking-tighter">
                    JPG, PNG or GIF. Max 2MB
                  </p>
                </div>

                {/* Form Fields Section */}
                <div className="flex-grow space-y-6 w-full">
                  <h3 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-tight flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-green-600" />
                    Business Information
                  </h3>
                  <div>
                    <label htmlFor="businessName" className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name
                    </label>
                    <input
                      id="businessName"
                      name="businessName"
                      type="text"
                      value={formData.businessName}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      placeholder="Enter business name"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="contactEmail" className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Email
                      </label>
                      <input
                        id="contactEmail"
                        name="contactEmail"
                        type="email"
                        value={formData.contactEmail}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        placeholder="business@example.com"
                      />
                    </div>

                    <div>
                      <label htmlFor="contactPhone" className="block text-sm font-medium text-gray-700 mb-2">
                        WhatsApp Number
                      </label>
                      <input
                        id="contactPhone"
                        name="contactPhone"
                        type="tel"
                        value={formData.contactPhone}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                      Business Address
                    </label>
                    <textarea
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                      placeholder="Enter business address"
                    />
                  </div>

                  <div>
                    <label htmlFor="businessType" className="block text-sm font-medium text-gray-700 mb-2">
                      Business Type
                    </label>
                    <select
                      id="businessType"
                      name="businessType"
                      value={formData.businessType || 'fruits'}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white font-bold"
                    >
                      <option value="fruits">🍎 Fruits Pack</option>
                      <option value="food">🍱 Food Pack (Meals / Tiffin)</option>
                      <option value="dairy">🥛 Milk & Dairy</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-400 font-medium italic">
                      {formData.businessType === 'food' && 'Choose "Food Pack" if you need to select breakfast/lunch/dinner during pause events.'}
                      {formData.businessType === 'dairy' && 'Choose "Milk & Dairy" to manage morning/evening milk slots, Litres/ML volume, and packaging.'}
                      {(!formData.businessType || formData.businessType === 'fruits') && 'Standard daily fruit bowl & healthy packs delivery system.'}
                    </p>
                  </div>

                  {/* Dairy-Specific Production Settings */}
                  {formData.businessType === 'dairy' && (
                    <div className="md:col-span-2 bg-gradient-to-br from-green-50/80 to-emerald-50/50 border border-green-200/80 rounded-2xl p-5 space-y-4">
                      <div className="flex items-center gap-2 text-green-900 font-black text-sm">
                        <span className="text-lg">🥛</span> Milk & Dairy Advanced Configurations
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5">
                            Packaging Type
                          </label>
                          <select
                            name="packagingType"
                            value={formData.packagingType || 'packet'}
                            onChange={handleChange}
                            className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="packet">⚪ Packet / Pouch (Standard Milk Packets - No Return)</option>
                            <option value="bottle">🍾 Glass Bottle / Reusable Can (Returnable)</option>
                          </select>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {formData.packagingType === 'bottle'
                              ? 'Enables Empty Bottle Collection tracking on the daily attendance sheet.'
                              : 'Standard use & throw milk packets (Aavin/Amul model). Zero bottle tracking needed.'}
                          </p>
                        </div>

                        {formData.packagingType === 'bottle' && (
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1.5">
                              Bottle Deposit Fee per Customer (₹)
                            </label>
                            <input
                              type="number"
                              name="bottleDeposit"
                              value={formData.bottleDeposit || 0}
                              onChange={handleChange}
                              placeholder="0.00"
                              className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <p className="text-[11px] text-gray-500 mt-1">
                              Refundable deposit recorded for empty bottles held by the customer.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-green-200/60">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5">
                            Morning Shift Window
                          </label>
                          <input
                            type="text"
                            name="morningShiftTime"
                            value={formData.morningShiftTime || '05:00 AM - 07:00 AM'}
                            onChange={handleChange}
                            placeholder="05:00 AM - 07:00 AM"
                            className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1.5">
                            Evening Shift Window
                          </label>
                          <input
                            type="text"
                            name="eveningShiftTime"
                            value={formData.eveningShiftTime || '05:00 PM - 07:00 PM'}
                            onChange={handleChange}
                            placeholder="05:00 PM - 07:00 PM"
                            className="w-full px-3.5 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <LockedFeatureWrapper
              isLocked={!isSubscriptionActive || (subStatus?.planType === 'free' || subStatus?.planType === 'trial' || subStatus?.planType === 'basic')}
              featureName="Automated Notifications"
              onUpgrade={() => setActiveTab('subscription')}
            >
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Bell className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-800">Notification Preferences</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">Configure when and how your customers receive automated renewal reminders</p>

                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-8">
                    {/* Reminder Days Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Send Reminders (Days Before Renewal)
                      </label>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[0, 1, 2, 3, 4].map((day) => {
                          const daysArray = formData.reminderDaysBefore ? formData.reminderDaysBefore.toString().split(',').filter(d => d !== '') : [];
                          const isChecked = daysArray.includes(day.toString());

                          return (
                            <label
                              key={day}
                              className={`flex items-center gap-2 p-3 border rounded-xl cursor-pointer transition-all ${isChecked
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  let newDays;
                                  if (e.target.checked) {
                                    newDays = [...daysArray, day.toString()];
                                  } else {
                                    newDays = daysArray.filter(d => d !== day.toString());
                                  }
                                  // Sort numerically
                                  newDays.sort((a, b) => parseInt(a) - parseInt(b));
                                  setFormData(prev => ({ ...prev, reminderDaysBefore: newDays.join(',') }));
                                }}
                                className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                              />
                              <span className="text-sm font-medium">
                                {day === 0 ? 'Renewal Day' : `${day} Day${day > 1 ? 's' : ''}`}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="reminderTime" className="block text-sm font-medium text-gray-700 mb-2">
                          Automated Reminder Time (Daily)
                        </label>
                        <input
                          id="reminderTime"
                          name="reminderTime"
                          type="time"
                          value={formData.reminderTime || '09:00'}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white font-medium"
                        />
                      </div>

                      <div>
                        <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-2">
                          Business Timezone
                        </label>
                        <select
                          id="timezone"
                          name="timezone"
                          value={formData.timezone || 'Asia/Kolkata'}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white font-medium"
                        >
                          <option value="Asia/Kolkata">🇮🇳 India (IST - GMT+5:30)</option>
                          <option value="Asia/Dubai">🇦🇪 UAE / Dubai (GST - GMT+4:00)</option>
                          <option value="Asia/Riyadh">🇸🇦 Saudi Arabia (AST - GMT+3:00)</option>
                          <option value="Asia/Qatar">🇶🇦 Qatar (AST - GMT+3:00)</option>
                          <option value="Asia/Kuwait">🇰🇼 Kuwait (AST - GMT+3:00)</option>
                          <option value="Asia/Muscat">🇴🇲 Oman (GST - GMT+4:00)</option>
                          <option value="Asia/Singapore">🇸🇬 Singapore / Malaysia (SGT - GMT+8:00)</option>
                          <option value="Europe/London">🇬🇧 United Kingdom (GMT/BST - GMT+0/+1)</option>
                          <option value="America/New_York">🇺🇸 USA Eastern (EST/EDT - GMT-5/-4)</option>
                          <option value="America/Chicago">🇺🇸 USA Central (CST/CDT - GMT-6/-5)</option>
                          <option value="America/Los_Angeles">🇺🇸 USA Pacific (PST/PDT - GMT-8/-7)</option>
                          <option value="Australia/Sydney">🇦🇺 Australia (AEST - GMT+10/+11)</option>
                          <option value="UTC">🌐 UTC (Universal Time)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </LockedFeatureWrapper>
          )}

          {/* WhatsApp API Tab */}
          {activeTab === 'whatsapp' && (
            <LockedFeatureWrapper
              isLocked={!isSubscriptionActive || (subStatus?.planType === 'free' || subStatus?.planType === 'trial' || subStatus?.planType === 'basic')}
              featureName="WhatsApp Automation API"
              onUpgrade={() => setActiveTab('subscription')}
            >
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">WhatsApp Business API</h3>
                  <p className="text-sm text-gray-600 mb-6">Connect your WhatsApp Business API to send automated reminders to customers via WhatsApp</p>

                  <div className="space-y-5">
                    {/* Enable WhatsApp Toggle */}
                    <div className="flex items-start justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                      <div className="flex-1">
                        <label htmlFor="whatsappEnabled" className="font-medium text-gray-800 cursor-pointer">
                          Enable WhatsApp Reminders
                        </label>
                        <p className="text-sm text-gray-500 mt-1">
                          Send automated WhatsApp messages to customers before renewal
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          id="whatsappEnabled"
                          name="whatsappEnabled"
                          type="checkbox"
                          checked={formData.whatsappEnabled}
                          onChange={handleChange}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                    </div>

                    {/* API Credentials */}
                    <div className="space-y-5 pt-4">
                      <div>
                        <label htmlFor="whatsappApiKey" className="block text-sm font-medium text-gray-700 mb-2">
                          WhatsApp API Key / Access Token
                        </label>
                        <input
                          id="whatsappApiKey"
                          name="whatsappApiKey"
                          type="password"
                          value={formData.whatsappApiKey}
                          onChange={handleChange}
                          disabled={!formData.whatsappEnabled}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
                          placeholder="EAAxxxxxxxxxxxxxxxxxx"
                        />
                        <p className="text-xs text-gray-500 mt-1">Get this from your Meta Business Manager</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <label htmlFor="whatsappPhoneNumberId" className="block text-sm font-medium text-gray-700 mb-2">
                            Phone Number ID
                          </label>
                          <input
                            id="whatsappPhoneNumberId"
                            name="whatsappPhoneNumberId"
                            type="text"
                            value={formData.whatsappPhoneNumberId}
                            onChange={handleChange}
                            disabled={!formData.whatsappEnabled}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
                            placeholder="123456789012345"
                          />
                        </div>

                        <div>
                          <label htmlFor="whatsappBusinessAccountId" className="block text-sm font-medium text-gray-700 mb-2">
                            Business Account ID
                          </label>
                          <input
                            id="whatsappBusinessAccountId"
                            name="whatsappBusinessAccountId"
                            type="text"
                            value={formData.whatsappBusinessAccountId}
                            onChange={handleChange}
                            disabled={!formData.whatsappEnabled}
                            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
                            placeholder="987654321098765"
                          />
                        </div>
                      </div>

                      {/* Test Connection Button */}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleTestConnection}
                          disabled={!formData.whatsappEnabled || isTestingConnection || !formData.whatsappApiKey || !isSubscriptionActive}
                          className="px-6 py-3 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isTestingConnection ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Testing Connection...
                            </>
                          ) : (
                            <>
                              <MessageCircle className="w-4 h-4" />
                              Test Connection
                            </>
                          )}
                        </button>
                      </div>

                      {/* Message Template */}
                      <div>
                        <label htmlFor="whatsappReminderTemplate" className="block text-sm font-medium text-gray-700 mb-2">
                          Reminder Message Template
                        </label>
                        <textarea
                          id="whatsappReminderTemplate"
                          name="whatsappReminderTemplate"
                          value={formData.whatsappReminderTemplate}
                          onChange={handleChange}
                          disabled={!formData.whatsappEnabled}
                          rows={5}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                          placeholder="Hi {{customer_name}}, your monthly fruit pack subscription is due for renewal on {{renewal_date}}."
                        />
                      </div>

                      {/* OTP Template Name */}
                      <div>
                        <label htmlFor="whatsappOtpTemplate" className="block text-sm font-medium text-gray-700 mb-2">
                          OTP Template Name
                        </label>
                        <input
                          id="whatsappOtpTemplate"
                          name="whatsappOtpTemplate"
                          type="text"
                          value={formData.whatsappOtpTemplate || ''}
                          onChange={handleChange}
                          disabled={!formData.whatsappEnabled}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
                          placeholder="otp_verification"
                        />
                        <p className="text-xs text-gray-500 mt-1">The template name approved in your Meta Business Manager for OTP</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </LockedFeatureWrapper>
          )}

          {/* Delivery Tab */}
          {activeTab === 'delivery' && (
            <LockedFeatureWrapper
              isLocked={!isSubscriptionActive || (subStatus?.planType === 'free' || subStatus?.planType === 'trial' || subStatus?.planType === 'basic')}
              featureName="Premium Delivery Logistics"
              onUpgrade={() => setActiveTab('subscription')}
            >
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <Truck className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-gray-800">Delivery Configuration</h3>
                  </div>
                  <p className="text-sm text-gray-600 mb-6">Manage global delivery settings for your business</p>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6 shadow-sm space-y-8">
                    {/* Subscription Pack Base Fee */}
                    {/* Free Shipping Toggle */}
                    <div className={`${formData.isFreeShipping ? 'bg-green-600' : 'bg-gray-100'} rounded-2xl p-6 shadow-sm transition-all duration-300`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`${formData.isFreeShipping ? 'bg-white/20' : 'bg-gray-200'} rounded-xl p-2.5 transition-colors`}>
                            <Truck className={`w-5 h-5 ${formData.isFreeShipping ? 'text-white' : 'text-gray-500'}`} />
                          </div>
                          <div>
                            <h4 className={`text-md font-bold ${formData.isFreeShipping ? 'text-white' : 'text-gray-800'}`}>Free Shipping</h4>
                            <p className={`text-[10px] font-medium uppercase tracking-widest ${formData.isFreeShipping ? 'text-green-100' : 'text-gray-400'}`}>
                              {formData.isFreeShipping ? 'Enabled for all orders' : 'Deliveries are paid by customer'}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, isFreeShipping: !prev.isFreeShipping }))}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${formData.isFreeShipping ? 'bg-green-400 border-2 border-white/20' : 'bg-gray-300'}`}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${formData.isFreeShipping ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>

                    {/* Distance-based Delivery Settings */}
                    <div className="space-y-6 pt-2">

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="deliveryFreeKm" className="block text-sm font-bold text-gray-700 mb-2">
                            Free Delivery Radius (km)
                          </label>
                          <input
                            id="deliveryFreeKm"
                            name="deliveryFreeKm"
                            type="number"
                            value={formData.deliveryFreeKm || '0'}
                            onChange={handleChange}
                            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50"
                            placeholder="3"
                          />
                        </div>
                        <div>
                          <label htmlFor="deliveryPricePerKm" className="block text-sm font-bold text-gray-700 mb-2">
                            Price Per Extra KM (₹)
                          </label>
                          <input
                            id="deliveryPricePerKm"
                            name="deliveryPricePerKm"
                            type="number"
                            value={formData.deliveryPricePerKm || '0'}
                            onChange={handleChange}
                            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 outline-none bg-gray-50/50"
                            placeholder="10"
                          />
                        </div>
                      </div>

                      {/* Calculation Example Card */}
                      <div className="bg-green-50/50 border border-green-100 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2 text-green-700 font-bold text-sm">
                          <Loader2 className="w-4 h-4" />
                          Delivery Calculation Example:
                        </div>
                        <p className="text-xs text-green-600 font-medium leading-relaxed italic">
                          If Price is ₹{formData.deliveryPricePerKm || '10'} per km and distance is 5km:<br />
                          (5km - {formData.deliveryFreeKm || '3'}km free) = 2km × ₹{formData.deliveryPricePerKm || '10'} = <strong className="text-green-700">₹{(2 * (parseFloat(formData.deliveryPricePerKm) || 10)).toFixed(2)} charge.</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </LockedFeatureWrapper>
          )}

          {/* Payment Tab */}
          {activeTab === 'payment' && (
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="w-6 h-6 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-800">Payment Collection</h3>
                </div>

                <div className="space-y-6">
                  {/* Invoice Configuration Section */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-md font-semibold text-gray-800">Invoice Number Format</h4>
                        <p className="text-xs text-gray-500">Configure how invoice numbers are generated</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="invoicePrefix" className="block text-sm font-medium text-gray-700 mb-2">
                          Invoice Prefix
                        </label>
                        <input
                          id="invoicePrefix"
                          name="invoicePrefix"
                          type="text"
                          value={formData.invoicePrefix ?? 'INV-'}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                          placeholder="e.g. INV-"
                        />
                      </div>
                      <div>
                        <label htmlFor="invoiceStartNumber" className="block text-sm font-medium text-gray-700 mb-2">
                          Next Invoice Number
                        </label>
                        <input
                          id="invoiceStartNumber"
                          name="invoiceStartNumber"
                          type="number"
                          min="1"
                          value={formData.invoiceStartNumber ?? '1'}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                          placeholder="e.g. 1"
                        />
                        <p className="mt-1 text-xs text-gray-500">Starting number for new invoices</p>
                      </div>
                    </div>
                  </div>

                  {/* UPI ID Section - Available to ALL plans */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-md font-semibold text-gray-800">Manual UPI Collection</h4>
                        <p className="text-xs text-gray-500">Collect payments directly to your UPI ID</p>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="upiId" className="block text-sm font-medium text-gray-700 mb-2">
                        Your UPI ID (VPA)
                      </label>
                      <input
                        id="upiId"
                        name="upiId"
                        type="text"
                        value={formData.upiId || ''}
                        onChange={handleChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                        placeholder="name@upi"
                      />
                    </div>
                  </div>

                  {/* Razorpay Section - Only for Pro/Enterprise */}
                  {formData.planType !== 'free' ? (
                    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h4 className="text-md font-semibold text-gray-800">Razorpay Auto-Payment</h4>
                          <p className="text-xs text-gray-500">Enable automatic recurring payments and payment links</p>
                        </div>
                        <div className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                          Pro & Enterprise Only
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border border-green-200">
                          <div>
                            <p className="font-medium text-gray-800">Razorpay Status</p>
                            <p className="text-sm text-gray-500 mt-1">{formData.razorpayKeyId && formData.razorpayKeySecret ? 'Connected' : 'Not configured'}</p>
                          </div>
                          <span className={`px-3 py-1 text-xs font-semibold rounded-full ${formData.razorpayKeyId && formData.razorpayKeySecret ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                            {formData.razorpayKeyId && formData.razorpayKeySecret ? 'Active' : 'Missing Keys'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="razorpayKeyId" className="block text-sm font-medium text-gray-700 mb-2">
                              API Key ID
                            </label>
                            <input
                              id="razorpayKeyId"
                              name="razorpayKeyId"
                              type="text"
                              value={formData.razorpayKeyId || ''}
                              onChange={handleChange}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 font-mono text-sm"
                              placeholder="rzp_live_..."
                            />
                          </div>
                          <div>
                            <label htmlFor="razorpayKeySecret" className="block text-sm font-medium text-gray-700 mb-2">
                              API Key Secret
                            </label>
                            <input
                              id="razorpayKeySecret"
                              name="razorpayKeySecret"
                              type="password"
                              value={formData.razorpayKeySecret || ''}
                              onChange={handleChange}
                              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 font-mono text-sm"
                              placeholder="Enter your secret"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                      <ArrowUpCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-amber-800 font-semibold">Upgrade to enable Razorpay</p>
                        <p className="text-xs text-amber-700 mt-1">Collect automated recurring payments with Pro plans.</p>
                      </div>
                    </div>
                  )}

                  {/* Preferred Method Selection */}
                  {formData.planType !== 'free' && formData.razorpayKeyId && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                      <h4 className="text-sm font-semibold text-gray-800 mb-4">Choose Default Billing Method</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <label className={`flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.preferredPaymentMethod === 'upi' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                          <input
                            type="radio"
                            name="preferredPaymentMethod"
                            value="upi"
                            checked={formData.preferredPaymentMethod === 'upi'}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <span className="font-semibold text-gray-800">Direct UPI</span>
                          <span className="text-xs text-gray-500 mt-1">Simple & Fee-free</span>
                        </label>
                        <label className={`flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${formData.preferredPaymentMethod === 'razorpay' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                          <input
                            type="radio"
                            name="preferredPaymentMethod"
                            value="razorpay"
                            checked={formData.preferredPaymentMethod === 'razorpay'}
                            onChange={handleChange}
                            className="sr-only"
                          />
                          <span className="font-semibold text-gray-800">Razorpay</span>
                          <span className="text-xs text-gray-500 mt-1">Automated</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Subscription Tab */}
          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Subscription Status</h3>
                  <p className="text-sm text-gray-500">Manage your account subscription and payments</p>
                </div>
                {subStatus && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncSubscription}
                      className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                      title="Sync with Razorpay"
                    >
                      <DownloadCloud className={`w-5 h-5 ${subLoading ? 'animate-bounce' : ''}`} />
                    </button>
                    <span className={`px-4 py-1.5 rounded-full text-sm font-bold flex items-center gap-2 ${subStatus.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                      {subStatus.status === 'active' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {subStatus.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                )}
              </div>

              {subLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status Card */}
                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 relative overflow-hidden">
                    <div className="relative z-10">
                      <p className="text-gray-500 text-sm mb-1">Current Plan</p>
                      <h4 className="text-2xl font-bold text-gray-800 mb-4">
                        {subStatus?.planType === 'enterprise' ? 'Enterprise Pack'
                          : subStatus?.planType === 'pro' ? 'Monthly Pro Pack'
                            : subStatus?.planType === 'growth' ? 'Growth Pack'
                              : subStatus?.planType === 'starter' ? 'Starter Pack'
                                : subStatus?.planType === 'trial' || subStatus?.planType === 'basic' ? 'Basic Trial'
                                  : (Object.values(subStatus?.addons || {}).some(count => (count as number) > 0) ? 'Custom Active Plan' : 'Basic Plan')}
                      </h4>

                      <div className="space-y-3">
                        <div className="flex items-center gap-3 text-gray-700">
                          <CreditCard className="w-5 h-5 text-green-600" />
                          <span>Price: <strong className="text-gray-900">
                            {subStatus?.planType === 'pro' ? '₹4,999 / month'
                              : subStatus?.planType === 'growth' ? '₹2,499 / month'
                                : subStatus?.planType === 'starter' ? '₹699 / month'
                                  : subStatus?.planType === 'enterprise' ? '₹1,999 / month'
                                    : (!subStatus?.planType || subStatus?.planType === 'basic' || subStatus?.planType === 'trial' || subStatus?.planType === 'free') ? '₹149 / month'
                                      : 'Free'}
                          </strong></span>
                        </div>
                        {subStatus?.expiry && (
                          <div className="flex items-center gap-3 text-gray-700">
                            <Clock className="w-5 h-5 text-green-600" />
                            <span>
                              {subStatus?.planType === 'trial' || subStatus?.planType === 'basic' || subStatus?.planType === 'free' ? 'Trial Ends' : 'Valid Until'}:
                              <strong className="text-gray-900 ml-1">
                                {new Date(subStatus.expiry).toLocaleDateString()}
                                {(subStatus?.daysRemaining !== undefined) && (
                                  <span className="ml-2 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                    {subStatus.daysRemaining} days left
                                  </span>
                                )}
                              </strong>
                            </span>
                          </div>
                        )}
                        {(!subStatus?.planType || subStatus?.planType === 'free' || subStatus?.planType === 'trial' || subStatus?.planType === 'basic') && (
                          <div className="flex items-center gap-2 mt-1 text-amber-600 bg-amber-50 px-3 py-2 rounded-lg text-sm font-medium border border-amber-200">
                            <span>⚠️</span> Up to 25 customers · Basic Features
                          </div>
                        )}
                      </div>

                      {/* CTAs */}
                      {subStatus?.status !== 'active' ? (
                        <div className="mt-6 space-y-3">
                          <button
                            type="button"
                            onClick={() => setIsUpgradeModalOpen(true)}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg hover:shadow-green-200 disabled:opacity-50"
                          >
                            <ArrowUpCircle className="w-5 h-5" />
                            {subStatus?.planType === 'pro'
                              ? 'Renew Pro Plan'
                              : (subStatus?.planType && subStatus.planType !== 'free' && subStatus.planType !== 'trial'
                                ? `Renew ${subStatus.planType.toUpperCase()} Plan`
                                : 'Upgrade to Pro')}
                          </button>
                          <p className="text-[10px] text-center text-gray-400">Secure payment via Razorpay</p>
                        </div>
                      ) : (
                        <div className="mt-6 flex flex-wrap items-center gap-3 relative z-20">
                          {subStatus?.planType !== 'enterprise' && (
                            <button
                              type="button"
                              onClick={() => setIsUpgradeModalOpen(true)}
                              className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all shadow text-sm flex items-center gap-2"
                            >
                              <ArrowUpCircle className="w-4 h-4" />
                              Upgrade Plan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleViewInvoices}
                            className="px-5 py-2.5 border border-gray-300 bg-white text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all text-sm flex items-center gap-2"
                          >
                            <FileText className="w-4 h-4" />
                            View Invoices
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Background decoration */}
                    <DollarSign className="absolute -bottom-8 -right-8 w-32 h-32 text-gray-100" />
                  </div>

                  {/* Highlights Card */}
                  <div className={`rounded-2xl p-6 text-white overflow-hidden relative shadow-lg ${subStatus?.planType === 'enterprise' || subStatus?.planType === 'pro'
                    ? 'bg-gradient-to-br from-green-600 to-green-700'
                    : subStatus?.planType === 'growth'
                      ? 'bg-gradient-to-br from-green-500 to-green-600'
                      : subStatus?.planType === 'starter'
                        ? 'bg-gradient-to-br from-green-400 to-green-500'
                        : 'bg-gradient-to-br from-gray-500 to-gray-600'
                    }`}>
                    <h4 className="text-lg font-bold mb-4 relative z-10">
                      Included Features
                    </h4>
                    <ul className="space-y-3 relative z-10">
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-white/70" />
                        {subStatus?.planType === 'pro' || subStatus?.planType === 'enterprise' ? 'Unlimited customers'
                          : `Up to ${(subStatus?.planType === 'growth' ? 300 : (subStatus?.planType === 'starter' ? 100 : 25)) + (subStatus?.addons?.extraCustomers || 0)} customers`}
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-white/70" />
                        {subStatus?.planType === 'pro' || subStatus?.planType === 'enterprise' ? 'Team Access & Automation'
                          : subStatus?.planType === 'growth' ? 'WhatsApp Automation'
                            : subStatus?.planType === 'starter' ? 'WhatsApp Manual Send'
                              : 'Basic Records'}
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-white/70" />
                        {subStatus?.planType === 'pro' || subStatus?.planType === 'enterprise' ? 'Full Analytics & Bot'
                          : subStatus?.planType === 'growth' ? 'Payment Links'
                            : 'Manual attendance tracking'}
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-white/70" />
                        {subStatus?.planType === 'free' || subStatus?.planType === 'trial' || subStatus?.planType === 'basic' ? 'Single User Access' : 'Business Controls Enabled'}
                      </li>

                      {/* Active Addons */}
                      <li className="pt-2 border-t border-white/10 mt-2 font-black text-[10px] uppercase tracking-widest text-white/50">My active add-ons</li>
                      {(subStatus?.addons?.deliveryBoys || 0) > 0 ? (
                        <li className="flex items-center gap-2 text-sm font-bold text-green-100">
                          <CheckCircle className="w-4 h-4" /> {subStatus?.addons?.deliveryBoys} Delivery Boy Slot(s)
                        </li>
                      ) : <li className="flex items-center gap-2 text-xs text-white/30 italic"><XCircle className="w-3 h-3" /> No Delivery Add-on</li>}

                      {(subStatus?.addons?.customerApp || 0) > 0 ? (
                        <li className="flex items-center gap-2 text-sm font-bold text-green-100">
                          <CheckCircle className="w-4 h-4" /> Customer App Interface
                        </li>
                      ) : <li className="flex items-center gap-2 text-xs text-white/30 italic"><XCircle className="w-3 h-3" /> No App Add-on</li>}

                      {(subStatus?.addons?.extraZones || 0) > 0 ? (
                        <li className="flex items-center gap-2 text-sm font-bold text-green-100">
                          <CheckCircle className="w-4 h-4" /> {subStatus?.addons?.extraZones} Premium Delivery Zone(s)
                        </li>
                      ) : <li className="flex items-center gap-2 text-xs text-white/30 italic"><XCircle className="w-3 h-3" /> No Zone Add-on</li>}

                      {(!subStatus?.planType || subStatus?.planType === 'free' || subStatus?.planType === 'trial' || subStatus?.planType === 'basic') && (
                        <li className="flex items-center gap-2 text-sm opacity-70 mt-4 bg-black/20 p-2 rounded-lg">
                          <Lock className="w-4 h-4 text-orange-400" /> WhatsApp API Restricted
                        </li>
                      )}
                    </ul>
                    <Apple className="absolute -bottom-10 -right-10 w-40 h-40 text-white/10" />
                  </div>
                </div>
              )}

              {/* Advanced Settings - commented out for now */}
              {/* div className="space-y-4 pt-4 border-t border-gray-100" */}

              {/* <div className="space-y-4 pt-4 border-t border-gray-100">
                <h4 className="font-semibold text-gray-800">Advanced Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="defaultPackPrice" className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Default Price (Ref)
                    </label>
                    <input
                      id="defaultPackPrice"
                      name="defaultPackPrice"
                      type="text"
                      value={formData.defaultPackPrice}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      placeholder="500"
                    />
                  </div>

                  <div>
                    <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-2">
                      Currency
                    </label>
                    <select
                      id="currency"
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>
              </div> */}
              {/* Add-ons Section */}
              <div className="pt-8 border-t border-gray-100">
                <div className="mb-6">
                  <h4 className="text-xl font-bold text-gray-900">Custom Add-ons</h4>
                  <p className="text-sm text-gray-500">Pick individual features to power up your business</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {(() => {
                    const ADDON_METADATA: any = {
                      delivery_boy: { icon: <Truck className="w-5 h-5 text-green-600" />, desc: 'Add one additional delivery staff', count: subStatus?.addons?.deliveryBoys || 0 },
                      customer_app: { icon: <Smartphone className="w-5 h-5 text-green-600" />, desc: 'Branded Android & iOS app for customers', count: subStatus?.addons?.customerApp || 0 },
                      extra_customer: { icon: <Users className="w-5 h-5 text-green-600" />, desc: 'Price per additional customer limit', suffix: '/cust', count: subStatus?.addons?.extraCustomers || 0 },
                      extra_staff: { icon: <UserPlus className="w-5 h-5 text-green-600" />, desc: 'Add one additional admin staff', count: subStatus?.addons?.extraStaff || 0 },
                      zone: { icon: <MapPin className="w-5 h-5 text-green-600" />, desc: 'Add one additional delivery zone', count: subStatus?.addons?.extraZones || 0 },
                    };

                    // If DB has addons, use them. Otherwise fallback to defaults for UI stability
                    const addonsToRender = ADDONS_FROM_DB.length > 0
                      ? ADDONS_FROM_DB.map((dbAddon: any) => ({
                        ...dbAddon,
                        id: dbAddon.type,
                        icon: ADDON_METADATA[dbAddon.type]?.icon || <ArrowUpCircle className="w-5 h-5 text-green-600" />,
                        desc: dbAddon.features?.[0] || ADDON_METADATA[dbAddon.type]?.desc || 'Additional feature',
                        suffix: ADDON_METADATA[dbAddon.type]?.suffix || '',
                        count: ADDON_METADATA[dbAddon.type]?.count || 0
                      }))
                      : Object.keys(ADDON_METADATA).map(id => ({ id, ...ADDON_METADATA[id], price: (id === 'extra_customer' ? 2 : (id === 'customer_app' ? 299 : (id === 'zone' ? 49 : 99))) }));

                    return addonsToRender;
                  })().map((addon: any) => (
                    <div key={addon.id} className={`bg-white border rounded-2xl p-5 hover:shadow-lg transition-all flex flex-col group ${addon.count > 0 ? 'border-green-400 shadow-md shadow-green-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-2 rounded-xl transition-colors ${addon.count > 0 ? 'bg-green-600' : 'bg-green-50'}`}>
                          {addon.count > 0 ? (
                            <div className="text-white">
                              {addon.icon && <addon.icon.type {...addon.icon.props} className="w-5 h-5 text-white" />}
                            </div>
                          ) : addon.icon}
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-gray-900">₹{addon.price}{addon.suffix || ''}</span>
                          {addon.count > 0 && (
                            <div className="text-[10px] font-black text-green-600 uppercase tracking-widest mt-0.5">Active ({addon.count})</div>
                          )}
                        </div>
                      </div>
                      <h5 className="font-bold text-gray-900 mb-1">{addon.name}</h5>
                      <p className="text-xs text-gray-500 mb-6 flex-grow">{addon.desc}</p>
                      <button
                        type="button"
                        onClick={() => handlePayNow({ type: addon.id, price: addon.price, name: addon.name })}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm ${addon.count > 0 ? 'bg-white border-2 border-green-600 text-green-600 hover:bg-green-50' : 'bg-green-600 text-white hover:bg-green-700 hover:shadow-green-200'}`}
                      >
                        <ShoppingCart className="w-4 h-4" /> {addon.count > 0 ? 'Buy More' : 'Buy Now'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Legal Policies Tab */}
          {activeTab === 'legal' && (
            <div className="space-y-8">
              <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Legal Policies</h3>
                  <p className="text-sm text-gray-500">Configure your business policies for customers to view</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-8">
                <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <h4 className="font-bold text-gray-800 uppercase tracking-wider text-sm">Privacy Policy</h4>
                  </div>
                  <p className="text-xs text-gray-500 mb-4 font-medium italic">Customers will see this policy during registration and on their dashboard.</p>
                  <textarea
                    id="privacyPolicy"
                    name="privacyPolicy"
                    value={formData.privacyPolicy || ''}
                    onChange={handleChange}
                    rows={10}
                    className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none bg-white font-mono text-sm leading-relaxed"
                    placeholder="Paste your Privacy Policy here..."
                  />
                </div>

                <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <h4 className="font-bold text-gray-800 uppercase tracking-wider text-sm">Terms & Conditions</h4>
                  </div>
                  <p className="text-xs text-gray-500 mb-4 font-medium italic">Rules and guidelines for customers using your services.</p>
                  <textarea
                    id="termsConditions"
                    name="termsConditions"
                    value={formData.termsConditions || ''}
                    onChange={handleChange}
                    rows={10}
                    className="w-full px-5 py-4 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none bg-white font-mono text-sm leading-relaxed"
                    placeholder="Paste your Terms & Conditions here..."
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-sm text-blue-800 leading-relaxed">
                  <strong>Tip:</strong> You can use simple text or HTML formatting. These policies will be linked in your WhatsApp welcome messages and registration pages.
                </div>
              </div>
            </div>
          )}

          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Security</h3>
                <div className="space-y-5">
                  <div>
                    <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Current Password
                    </label>
                    <input
                      id="currentPassword"
                      type="password"
                      value={passwords.currentPassword}
                      onChange={(e) => setPasswords(p => ({ ...p, currentPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      placeholder="Enter current password"
                    />
                  </div>

                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      type="password"
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords(p => ({ ...p, newPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      placeholder="Enter new password"
                    />
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      id="confirmPassword"
                      type="password"
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords(p => ({ ...p, confirmPassword: e.target.value }))}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      placeholder="Confirm new password"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handlePasswordChange}
                      disabled={isChangingPassword || !passwords.currentPassword || !passwords.newPassword || !isSubscriptionActive}
                      className={`flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl font-medium hover:bg-gray-900 transition-all disabled:opacity-50 ${!isSubscriptionActive ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          Update Password
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="pt-8 mt-8 border-t border-red-100">
                <div className="flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <h3 className="text-lg font-bold text-red-600">Danger Zone</h3>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                      <h4 className="font-bold text-gray-900">Delete Account</h4>
                      <p className="text-sm text-gray-500 mt-1">Permanently delete your account and all associated business data. This action is irreversible.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Are you absolutely sure? This will delete all your customers, packs, history, and settings permanently. This action cannot be undone.')) {
                          handleDeleteAccount();
                        }
                      }}
                      className="px-6 py-3 bg-white border-2 border-red-500 text-red-600 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-all shadow-sm flex items-center gap-2 whitespace-nowrap"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Permanently
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save Button - Only show if not on Subscription or Account tabs */}
          {activeTab !== 'subscription' && activeTab !== 'account' && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pt-6 border-t border-gray-200 mt-8">
              {(!isSubscriptionActive || subStatus?.planType === 'free' || subStatus?.planType === 'trial' || subStatus?.planType === 'basic') && (activeTab === 'notifications' || activeTab === 'whatsapp' || activeTab === 'delivery') ? (
                <div className="flex items-center gap-3 bg-amber-50 px-4 py-2 rounded-xl border border-amber-200">
                  <Lock className="w-4 h-4 text-amber-600" />
                  <p className="text-xs text-amber-800 font-bold uppercase tracking-tight">Upgrade Required to Save {activeTab} Settings</p>
                </div>
              ) : !isSubscriptionActive && (
                <p className="text-sm text-red-600 font-medium">Subscription required to save changes.</p>
              )}

              <button
                type="submit"
                disabled={isSaving || (activeTab !== 'business' && activeTab !== 'payment' && activeTab !== 'account' && !isSubscriptionActive && subStatus?.planType !== 'free' && subStatus?.planType !== 'basic')}
                className={`flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ml-auto`}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Upgrade Plan Modal - 3 columns: Free / Pro / Enterprise */}
      {isUpgradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1200px] overflow-hidden flex flex-col pt-2 max-h-[95vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="px-6 pb-2 pt-4 flex justify-between items-start">
              <div>
                <h2 className="text-[22px] font-bold text-gray-800">Choose Your Plan</h2>
                <p className="text-sm text-gray-500 mt-1">Upgrade to unlock more features for your business</p>
              </div>
              <button onClick={() => setIsUpgradeModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 pt-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="text-sm text-gray-700 flex items-center gap-2">
                  Current Plan:
                  <span className="px-2.5 py-0.5 bg-green-600 text-white rounded text-xs font-bold">
                    {subStatus?.planType === 'starter' ? 'Starter Plan'
                      : subStatus?.planType === 'growth' ? 'Growth Plan'
                        : subStatus?.planType === 'pro' ? 'Pro Plan'
                          : 'Basic Plan'}
                  </span>
                </div>

                {/* Billing Toggle (4 items) */}
                <div className="flex items-center bg-gray-100 p-1 sm:p-1.5 rounded-2xl w-full sm:w-fit overflow-x-auto scrollbar-hide flex-nowrap shrink-0">
                  <button
                    onClick={() => setBillingPeriod('monthly')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all shrink-0 ${billingPeriod === 'monthly' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    1 Month
                  </button>
                  <button
                    onClick={() => setBillingPeriod('3months')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all shrink-0 ${billingPeriod === '3months' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    3 Months
                  </button>
                  <button
                    onClick={() => setBillingPeriod('6months')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all shrink-0 ${billingPeriod === '6months' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    6 Months
                  </button>
                  <button
                    onClick={() => setBillingPeriod('yearly')}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${billingPeriod === 'yearly' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    Yearly
                    <span className="bg-green-100 text-green-700 px-1 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase">Save 🔥</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {PLANS[billingPeriod].map((plan) => {
                  const isCurrent = subStatus?.planType === plan.type;
                  return (
                    <div
                      key={plan.type}
                      className={`relative rounded-3xl p-6 flex flex-col transition-all duration-300 border-2 ${plan.popular ? 'border-green-500 bg-white shadow-xl shadow-green-100 scale-[1.02] z-10' : 'border-gray-100 bg-gray-50/50 hover:border-green-200'}`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg">
                          Most Popular
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute top-4 right-4 bg-green-100 text-green-700 text-[9px] font-black px-2 py-0.5 rounded uppercase">
                          Current
                        </div>
                      )}

                      <div className="mb-6">
                        <h3 className="text-xl font-black text-gray-800">{plan.name}</h3>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">{plan.customers}</p>
                      </div>

                      <div className="mb-6">
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-black text-gray-900">₹{plan.price.toLocaleString('en-IN')}</span>
                          {plan.price > 0 && (
                            <span className="text-sm font-bold text-gray-400 capitalize">/{billingPeriod === 'yearly' ? 'year' : (billingPeriod === '6months' ? '6 mo' : (billingPeriod === '3months' ? '3 mo' : 'mo'))}</span>
                          )}
                        </div>
                        {billingPeriod !== 'monthly' && plan.monthlyEquivalent && plan.price > 0 && (
                          <p className="text-xs font-bold text-green-600 mt-1">₹{plan.monthlyEquivalent.toLocaleString('en-IN')}/month equivalent</p>
                        )}
                      </div>

                      <div className="flex-grow space-y-3 mb-8">
                        {plan.features.map((feature, i) => (
                          <div key={i} className="flex gap-2.5 items-start">
                            <div className="mt-1 bg-green-100 rounded-full p-0.5">
                              <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />
                            </div>
                            <span className="text-sm font-medium text-gray-600 leading-tight">{feature}</span>
                          </div>
                        ))}
                      </div>

                      {isCurrent && subStatus?.status === 'active' && (subStatus?.daysRemaining === undefined || subStatus.daysRemaining > 0) ? (
                        <button
                          onClick={() => handlePayNow(plan)}
                          disabled={paymentLoading}
                          className="w-full py-4 rounded-2xl bg-green-50 text-green-700 border-2 border-green-200 hover:bg-green-600 hover:text-white font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          {paymentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Renew / Extend
                        </button>
                      ) : (
                        <button
                          onClick={() => plan.price === 0 ? setIsUpgradeModalOpen(false) : handlePayNow(plan)}
                          disabled={paymentLoading}
                          className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                            plan.popular || isCurrent
                              ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
                              : 'bg-white text-gray-800 border-2 border-gray-200 hover:border-green-500 hover:text-green-600'
                          }`}
                        >
                          {paymentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          {isCurrent ? `Renew ${plan.name}` : `Get ${plan.name}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className="text-center text-xs text-gray-500 mt-6 pt-2">
                All plans include SSL security, data backup, and regular updates
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Invoices Modal */}
      {isInvoicesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[650px] overflow-hidden flex flex-col border border-gray-100 animate-in fade-in zoom-in duration-300">
            {/* Header */}
            <div className="px-4 sm:px-8 pt-6 pb-4 flex justify-between items-start">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-green-100 rounded-xl">
                    <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                  </div>
                  Billing History
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 ml-9 sm:ml-11">View and download your subscription invoices</p>
              </div>
              <button
                onClick={() => setIsInvoicesModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-2 rounded-full transition-all"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Summary Area */}
            {invoices.length > 0 && !invoicesLoading && (
              <div className="px-4 sm:px-8 mb-4">
                <div className="bg-gradient-to-r from-green-50 to-green-50 rounded-2xl p-3 sm:p-4 flex gap-4 sm:gap-8 border border-green-100/50">
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider">Total Paid</p>
                    <p className="text-lg sm:text-2xl font-bold text-green-700 mt-0.5">₹{invoices.reduce((sum, inv) => sum + (['paid', 'activated', 'active', 'created'].includes(inv.status?.toLowerCase()) ? inv.amount : 0), 0).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="w-px bg-green-200/50 my-1" />
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider">Total Invoices</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-800 mt-0.5">{invoices.length}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Body */}
            <div className="px-4 sm:px-8 py-2 overflow-y-auto max-h-[450px] scrollbar-thin scrollbar-thumb-gray-200">
              {invoicesLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="w-10 h-10 animate-spin text-green-600 mb-4" />
                  <p className="text-sm text-gray-500 font-medium">Fetching your payment records...</p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-gray-50/50 rounded-2xl border-2 border-dashed border-gray-100">
                  <div className="p-4 bg-white rounded-full shadow-sm mb-4">
                    <FileText className="w-12 h-12 opacity-20" />
                  </div>
                  <p className="text-base font-semibold text-gray-600">No invoices found</p>
                  <p className="text-sm mt-1 max-w-[280px] text-center">Your payment history will appear here after your first transaction</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 pb-4">
                  {invoices.map((inv: any) => (
                    <div key={inv.id} className="group relative bg-white hover:bg-green-50/20 rounded-2xl border border-gray-100 hover:border-green-200 p-3 sm:p-4 transition-all duration-300">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                        <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${inv.status === 'paid' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                            <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-gray-800 text-sm sm:text-base truncate">{inv.invoiceNumber || `INV-${inv.id.toString().padStart(4, '0')}`}</h4>
                              <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${['paid', 'activated', 'active', 'created'].includes(inv.status?.toLowerCase()) ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'}`}>
                                {['paid', 'activated', 'active', 'created'].includes(inv.status?.toLowerCase()) ? 'Paid' : inv.status}
                              </span>
                            </div>
                            <p className="text-[11px] sm:text-xs text-gray-500 font-medium mt-0.5">
                              {new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase">Plan:</span>
                                <span className="text-xs text-gray-700 font-semibold">{inv.planType === 'starter' ? 'Starter Plan' : (inv.planType === 'growth' ? 'Growth Plan' : 'Pro Plan')}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase">Amount:</span>
                                <span className="text-xs sm:text-sm text-green-600 font-bold">₹{inv.amount.toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex sm:flex-col gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-none border-gray-100 justify-end">
                          <button
                            onClick={() => onViewInvoice && onViewInvoice(inv)}
                            className="flex items-center justify-center gap-2 px-4 py-2 sm:px-3 sm:py-1.5 bg-green-600 text-white rounded-xl sm:rounded-lg text-xs font-bold hover:bg-green-700 transition-all shadow-sm w-full sm:w-auto"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Invoice
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 sm:px-8 py-4 sm:py-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-4 shrink-0">
              <div className="hidden sm:flex items-center gap-2 text-gray-400">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-medium uppercase tracking-widest">Payments via Razorpay</span>
              </div>

              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => setIsInvoicesModalOpen(false)}
                  className="px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Close
                </button>
                {invoices.length > 0 && (
                  <button
                    onClick={() => window.open('https://dashboard.razorpay.com/', '_blank')}
                    className="flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-green-200 transition-all active:scale-95 shrink-0"
                  >
                    <DownloadCloud className="w-4 h-4" /> Download All
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
