import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Truck, Plus, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { Customer, DeliveryUser, Pack, BusinessSettings } from '../types';
import { deliveryUserAPI, packAPI, customerAPI } from '../services/api';

interface AddEditCustomerProps {
  customer?: Customer | null;
  settings: BusinessSettings;
  onSave: (customer: Omit<Customer, 'id'> | Customer) => void;
  onCancel: () => void;
  isSubscriptionActive?: boolean;
  subscription?: { status: string, planType?: string } | null;
}

interface PackEntry {
  id?: number;
  packId: string | number;
  quantity: number;
  subscriptionStartDate: string;
  renewalDate: string;
  renewalCycle: 'monthly' | 'weekly' | 'daily';
  totalDeliveries: number;
  status: string;
  lastPaymentDate?: string;
}

export function AddEditCustomer({ customer, settings, onSave, onCancel, isSubscriptionActive = true, subscription }: AddEditCustomerProps) {
  const isEditing = !!customer;

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    alternativeMobile: '',
    address: '',
    address2: '',
    area: '',
    landmark: '',
    location: '',
    zone: '',
    deliveryUserId: '' as string | number,
    distanceKm: 0 as number,
    deliveryCharge: 0 as number,
    extraFields: [] as { label: string, value: string }[],
    cookingInstructions: '',
    parcelLabelName: '',
    nutritionalGoal: '',
  });

  const [customerPacks, setCustomerPacks] = useState<PackEntry[]>([]);
  const [deliveryUsers, setDeliveryUsers] = useState<DeliveryUser[]>([]);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkingMobile, setCheckingMobile] = useState(false);
  const [mobileExists, setMobileExists] = useState(false);

  useEffect(() => {
    fetchDeliveryUsers();
    fetchPacks();
  }, []);

  useEffect(() => {
    if (packs.length === 0 && !customer) return;

    if (customer) {
      setFormData({
        name: customer.name,
        mobile: customer.mobile,
        alternativeMobile: customer.alternativeMobile || '',
        address: customer.address || '',
        address2: customer.address2 || '',
        area: customer.area || '',
        landmark: customer.landmark || '',
        location: customer.location || '',
        zone: customer.zone || '',
        deliveryUserId: customer.deliveryUserId?.toString() || '',
        distanceKm: customer.distanceKm || 0,
        deliveryCharge: customer.deliveryCharge || 0,
        extraFields: (() => {
          if (typeof customer.extraFields === 'string') {
            try { return JSON.parse(customer.extraFields); } catch (e) { return []; }
          }
          return Array.isArray(customer.extraFields) ? customer.extraFields : [];
        })(),
        cookingInstructions: customer.cookingInstructions || '',
        parcelLabelName: customer.parcelLabelName || '',
        nutritionalGoal: customer.nutritionalGoal || '',
      });

      const formatDateForInput = (dateValue?: string) => {
        if (!dateValue) return '';
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return dateValue.split('T')[0];
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      };

      if (customer.packs && customer.packs.length > 0) {
        setCustomerPacks(customer.packs.map(p => {
          const packInfo = packs.find(pk => String(pk.id) === String(p.packId || ''));
          const isFood = packInfo?.packType === 'food' || settings.businessType === 'food' || (settings as any).business_type === 'food';
          const defaultMonthly = isFood ? 26 : 24;
          
          return {
            id: p.id,
            packId: p.packId,
            quantity: p.quantity,
            subscriptionStartDate: formatDateForInput(p.startDate || customer.subscriptionStartDate),
            renewalDate: formatDateForInput(p.renewalDate || customer.renewalDate),
            renewalCycle: (p.renewalCycle as 'monthly' | 'weekly' | 'daily') || customer.renewalCycle,
            totalDeliveries: p.totalDeliveries || (p.renewalCycle === 'weekly' ? 6 : defaultMonthly),
            status: p.status || 'pending',
            lastPaymentDate: formatDateForInput(p.lastPaymentDate || customer.lastPaymentDate)
          };
        }));
      } else {
        // Fallback for old data without individual packs array
        const packInfo = packs.find(pk => String(pk.id) === String(customer.packId || ''));
        const isFood = packInfo?.packType === 'food' || settings.businessType === 'food' || (settings as any).business_type === 'food';
        const defaultMonthly = isFood ? 26 : 24;

        setCustomerPacks([{
          packId: customer.packId?.toString() || '',
          quantity: customer.quantity || 1,
          subscriptionStartDate: formatDateForInput(customer.subscriptionStartDate),
          renewalDate: formatDateForInput(customer.renewalDate),
          renewalCycle: customer.renewalCycle,
          totalDeliveries: customer.totalDeliveries || (customer.renewalCycle === 'weekly' ? 6 : defaultMonthly),
          status: customer.status || 'pending',
          lastPaymentDate: formatDateForInput(customer.lastPaymentDate)
        }]);
      }
    } else if (customerPacks.length === 0 || (customerPacks.length === 1 && customerPacks[0].packId === '')) {
      // Default pack for new customer - only set if not already interacting
      const isFood = settings.businessType === 'food' || (settings as any).business_type === 'food';
      setCustomerPacks([{
        packId: '',
        quantity: 1,
        subscriptionStartDate: new Date().toISOString().split('T')[0],
        renewalDate: '',
        renewalCycle: 'monthly',
        totalDeliveries: isFood ? 26 : 24,
        status: 'pending'
      }]);
    }
  }, [customer, packs, settings.businessType, (settings as any).business_type]);

  const fetchDeliveryUsers = async () => {
    try {
      const res = await deliveryUserAPI.getAll();
      setDeliveryUsers(res.data.delivery_users || []);
    } catch (err) {
      console.error('Failed to fetch delivery users:', err);
    }
  };

  const fetchPacks = async () => {
    try {
      const res = await packAPI.getAll();
      setPacks(res.data.packs || []);
    } catch (err) {
      console.error('Failed to fetch packs:', err);
    }
  };

  const validateMobile = async (mobile: string) => {
    if (!mobile || !/^\+?[\d\s-]{10,}$/.test(mobile)) return;
    
    setCheckingMobile(true);
    try {
      const res = await customerAPI.checkMobile(mobile, customer?.id);
      setMobileExists(res.data.exists);
      if (res.data.exists) {
        setErrors(prev => ({ ...prev, mobile: 'This mobile number is already registered' }));
      } else {
        setErrors(prev => {
          const { mobile: _, ...rest } = prev;
          return rest;
        });
      }
    } catch (err) {
      console.error('Failed to check mobile:', err);
    } finally {
      setCheckingMobile(false);
    }
  };

  const calculateRenewalDate = (startDate: string, totalDeliveries: number): string => {
    if (!startDate || totalDeliveries <= 0) return '';
    const date = new Date(startDate + 'T00:00:00');
    const targetDays = totalDeliveries;
    let count = 1;

    while (count < targetDays) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0) { // Skip Sunday
        count++;
      }
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Customer name is required';
    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile number is required';
    } else if (!/^\+?[\d\s-]{10,}$/.test(formData.mobile)) {
      newErrors.mobile = 'Please enter a valid mobile number (min 10 digits)';
    } else if (mobileExists) {
      newErrors.mobile = 'This mobile number is already registered';
    }

    if (!formData.address.trim()) newErrors.address = 'Delivery address is required';
    if (!formData.area.trim()) newErrors.area = 'Area is required';
    if (!formData.zone.trim()) newErrors.zone = 'Zone is required';

    customerPacks.forEach((p, idx) => {
      if (!p.packId) newErrors[`pack_${idx}`] = 'Please select a pack';
      if (!p.subscriptionStartDate) newErrors[`start_${idx}`] = 'Start date required';
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;
    
    // Final mobile check before submit to be sure
    setCheckingMobile(true);
    try {
      const res = await customerAPI.checkMobile(formData.mobile, customer?.id);
      if (res.data.exists) {
        setMobileExists(true);
        setErrors(prev => ({ ...prev, mobile: 'This mobile number is already registered' }));
        setCheckingMobile(false);
        return;
      }
    } catch (e) {}
    setCheckingMobile(false);

    // Helper to normalize strings for consistency
    const normalizeLocation = (val?: string) => {
      if (!val) return '';
      return val.trim().toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
    };

    const customerData = {
      ...formData,
      zone: normalizeLocation(formData.zone),
      area: normalizeLocation(formData.area),
      packs: customerPacks.map(p => {
        const packInfo = packs.find(pk => pk.id.toString() === p.packId.toString());
        return {
          id: p.id || 0,
          packId: Number(p.packId),
          name: packInfo?.name || '',
          price: packInfo?.price || 0,
          quantity: p.quantity,
          startDate: p.subscriptionStartDate,
          renewalDate: p.renewalDate,
          renewalCycle: p.renewalCycle,
          totalDeliveries: p.totalDeliveries,
          status: p.status,
          lastPaymentDate: p.lastPaymentDate
        };
      }),
      // Main table single-pack fields for fallback
      packId: Number(customerPacks[0]?.packId),
      quantity: customerPacks[0]?.quantity,
      subscriptionStartDate: customerPacks[0]?.subscriptionStartDate,
      renewalDate: customerPacks[0]?.renewalDate,
      renewalCycle: customerPacks[0]?.renewalCycle,
      totalDeliveries: customerPacks[0]?.totalDeliveries,
      status: (customerPacks[0]?.status as any) || 'pending',
      lastPaymentDate: customerPacks[0]?.lastPaymentDate,
      deliveryUserId: formData.deliveryUserId ? Number(formData.deliveryUserId) : undefined,
      extraFields: formData.extraFields,
    };

    onSave(isEditing && customer ? ({ ...customer, ...customerData } as Customer) : (customerData as any));
  };

  const handlePackChange = (index: number, field: string, value: any) => {
    setCustomerPacks(prev => {
      const newPacks = [...prev];
      const p = { ...newPacks[index], [field]: value };
      
      const packInfo = packs.find(pk => String(pk.id) === String(value || p.packId || ''));
      const isFood = packInfo?.packType === 'food' || settings.businessType === 'food' || (settings as any).business_type === 'food';
      const defaultMonthly = isFood ? 26 : 24;

      if (field === 'packId') {
        if (packInfo) {
          p.renewalCycle = packInfo.billingCycle as any;
          p.totalDeliveries = packInfo.billingCycle === 'weekly' ? 6 : (packInfo.billingCycle === 'daily' ? Number(packInfo.billingDays || 1) : defaultMonthly);
        }
      } else if (field === 'renewalCycle') {
        p.totalDeliveries = value === 'weekly' ? 6 : (value === 'daily' ? Number(packInfo?.billingDays || 1) : defaultMonthly);
      }
      
      if (['subscriptionStartDate', 'totalDeliveries', 'renewalCycle', 'packId'].includes(field)) {
        p.renewalDate = calculateRenewalDate(p.subscriptionStartDate, p.totalDeliveries);
      }
      
      newPacks[index] = p;
      return newPacks;
    });
  };

  const addPack = () => {
    const isFood = settings.businessType === 'food' || (settings as any).business_type === 'food';
    setCustomerPacks([...customerPacks, {
      packId: '',
      quantity: 1,
      subscriptionStartDate: new Date().toISOString().split('T')[0],
      renewalDate: '',
      renewalCycle: 'monthly',
      totalDeliveries: isFood ? 26 : 24,
      status: 'pending'
    }]);
  };

  const removePack = (index: number) => {
    if (customerPacks.length <= 1) return;
    setCustomerPacks(customerPacks.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex items-center justify-between">
        <div>
          <button onClick={onCancel} className="flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors mb-2">
            <ArrowLeft className="w-4 h-4" /> <span className="text-sm font-bold">Back to List</span>
          </button>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">{isEditing ? 'Edit Customer' : 'Add New Customer'}</h1>
        </div>
        <div className={`p-3 rounded-2xl ${isEditing ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
          <Truck className="w-6 h-6" />
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-gray-50">
          {/* Basic Info Section */}
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Customer Name *</label>
                <input
                  name="name" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-5 py-3.5 bg-gray-50 border-2 ${errors.name ? 'border-red-200' : 'border-gray-100'} rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700`}
                  placeholder="John Doe"
                />
                {errors.name && <p className="text-red-500 text-[10px] font-black uppercase tracking-tight ml-2">{errors.name}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Mobile Number *</label>
                <div className="relative">
                  <input
                    name="mobile" value={formData.mobile}
                    onChange={(e) => {
                      setFormData({ ...formData, mobile: e.target.value });
                      setMobileExists(false);
                    }}
                    onBlur={(e) => validateMobile(e.target.value)}
                    className={`w-full px-5 py-3.5 bg-gray-50 border-2 ${errors.mobile ? 'border-red-200' : 'border-gray-100'} rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700`}
                    placeholder="+91 9976707011"
                  />
                  {checkingMobile && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 animate-spin text-green-600" /></div>}
                  {mobileExists && !checkingMobile && <div className="absolute right-4 top-1/2 -translate-y-1/2"><AlertCircle className="w-5 h-5 text-red-500" /></div>}
                </div>
                {errors.mobile && <p className="text-red-500 text-[10px] font-black uppercase tracking-tight ml-2">{errors.mobile}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Zone *</label>
                <input
                  name="zone" value={formData.zone}
                  onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                  className={`w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700 ${subscription?.planType === 'free' && isEditing ? 'opacity-70 cursor-not-allowed' : ''}`}
                  placeholder="Ariyamangalam"
                  disabled={subscription?.planType === 'free' && isEditing}
                />
                {subscription?.planType === 'free' && (
                  <p className="text-[9px] font-black text-orange-500 uppercase tracking-tighter mt-1 ml-1">Free Plan: Only 1 Zone allowed</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Area *</label>
                <input
                  name="area" value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
                  placeholder="Kattur"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Full Delivery Address *</label>
              <textarea
                name="address" value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700 resize-none"
                placeholder="Door No, Street Name, etc."
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Alt. Mobile (Optional)</label>
                <input
                  name="alternativeMobile" value={formData.alternativeMobile}
                  onChange={(e) => setFormData({ ...formData, alternativeMobile: e.target.value })}
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Assign Delivery Man</label>
                <select
                  value={formData.deliveryUserId}
                  onChange={(e) => setFormData({ ...formData, deliveryUserId: e.target.value })}
                  className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
                >
                  <option value="">Select delivery man</option>
                  {deliveryUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </div>
            </div>

            {/* Food specific optional fields */}
            {(settings.businessType === 'food' || (settings as any).business_type === 'food') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Name to be labeled on your parcel (Optional)</label>
                  <input
                    name="parcelLabelName" value={formData.parcelLabelName}
                    onChange={(e) => setFormData({ ...formData, parcelLabelName: e.target.value })}
                    className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
                    placeholder="e.g. John's Meal"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Primary Nutritional Goal (Optional)</label>
                  <select
                    value={formData.nutritionalGoal}
                    onChange={(e) => setFormData({ ...formData, nutritionalGoal: e.target.value })}
                    className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
                  >
                    <option value="">Select a goal</option>
                    <option value="Weight Loss">Weight Loss</option>
                    <option value="Muscle Gain">Muscle Gain</option>
                    <option value="Balanced Nutrition">Balanced Nutrition</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-black text-gray-700 uppercase tracking-widest ml-1">Any Special Cooking Instructions (Optional)</label>
                  <textarea
                    name="cookingInstructions" value={formData.cookingInstructions}
                    onChange={(e) => setFormData({ ...formData, cookingInstructions: e.target.value })}
                    rows={2}
                    className="w-full px-5 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700 resize-none"
                    placeholder="e.g. Less spicy, no peanuts, etc."
                  />
                </div>
              </div>
            )}

            {/* Dynamic Extra Fields Section */}
            <div className="pt-4 mt-4 border-t border-gray-50">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Additional Fields</h4>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    extraFields: [...(Array.isArray(prev.extraFields) ? prev.extraFields : []), { label: '', value: '' }] 
                  }))}
                  className="flex items-center gap-1.5 text-[10px] font-black text-green-600 uppercase hover:text-green-700 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add Field
                </button>
              </div>
              
              <div className="space-y-4">
                {Array.isArray(formData.extraFields) && formData.extraFields.map((field, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Field Label</label>
                      <input
                        value={field.label}
                        onChange={(e) => {
                          const newFields = [...formData.extraFields];
                          newFields[idx].label = e.target.value;
                          setFormData({ ...formData, extraFields: newFields });
                        }}
                        className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700 text-sm"
                        placeholder="e.g. GST Number"
                      />
                    </div>
                    <div className="space-y-2 relative">
                      <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Field Value</label>
                      <div className="flex gap-2">
                        <input
                          value={field.value}
                          onChange={(e) => {
                            const newFields = [...formData.extraFields];
                            newFields[idx].value = e.target.value;
                            setFormData({ ...formData, extraFields: newFields });
                          }}
                          className="w-full px-4 py-2.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700 text-sm"
                          placeholder="Enter value"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newFields = formData.extraFields.filter((_, i) => i !== idx);
                            setFormData({ ...formData, extraFields: newFields });
                          }}
                          className="p-2.5 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors border border-red-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Subscriptions Section */}
          <div className="p-8 bg-gray-50/30">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-xl">
                  <Clock className="w-5 h-5 text-green-600" />
                </div>
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Support Packs ({customerPacks.length})</h3>
              </div>
              <button
                type="button" onClick={addPack}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl text-sm font-black hover:bg-green-700 transition-all shadow-lg shadow-green-100 mb-4"
              >
                <Plus className="w-4 h-4" /> Add Pack
              </button>
            </div>

            <div className="space-y-6">
              {customerPacks.map((packEntry, idx) => (
                <div key={idx} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm relative group animate-in slide-in-from-bottom-2 duration-300">
                  {customerPacks.length > 1 && (
                    <button
                      type="button" onClick={() => removePack(idx)}
                      className="absolute -top-3 -right-3 p-2 bg-red-50 text-red-500 rounded-full hover:bg-red-100 transition-colors border border-red-100 shadow-sm opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Subscription Pack *</label>
                      <select
                        value={packEntry.packId}
                        onChange={(e) => handlePackChange(idx, 'packId', e.target.value)}
                        className={`w-full px-4 py-3 bg-gray-50 border-2 ${errors[`pack_${idx}`] ? 'border-red-100' : 'border-gray-100'} rounded-xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700`}
                      >
                        <option value="">Select a pack</option>
                        {packs.map(p => <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Renewal Cycle *</label>
                      <select
                        value={packEntry.renewalCycle}
                        onChange={(e) => handlePackChange(idx, 'renewalCycle', e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
                      >
                        <option value="weekly">Weekly (6 Deliveries)</option>
                        <option value="monthly">
                          Monthly ({ (packs.find(pk => String(pk.id) === String(packEntry.packId || ''))?.packType === 'food' || settings.businessType === 'food' || (settings as any).business_type === 'food') ? 26 : 24 } Deliveries)
                        </option>
                        <option value="daily">
                          Daily ({packs.find(pk => String(pk.id) === String(packEntry.packId || ''))?.billingDays || 1} Deliveries)
                        </option>
                      </select>
                    </div>

                    <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Start Date *</label>
                      <input
                        type="date" value={packEntry.subscriptionStartDate}
                        onChange={(e) => handlePackChange(idx, 'subscriptionStartDate', e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
                      />
                    </div>

                    <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Deliveries</label>
                      <input
                        type="number" value={packEntry.totalDeliveries}
                        onChange={(e) => handlePackChange(idx, 'totalDeliveries', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-100 rounded-xl outline-none font-bold text-gray-500"
                      />
                    </div>

                    <div className="space-y-2">
                    <label className="text-[10px] font-black text-orange-400 uppercase tracking-widest ml-1">Renewal Date</label>
                      <div className="w-full px-4 py-3 bg-orange-50/30 border-2 border-orange-100 rounded-xl font-black text-orange-600">
                        {packEntry.renewalDate || 'Select Start Date'}
                      </div>
                    </div>

                    <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Quantity</label>
                      <input
                        type="number" value={packEntry.quantity}
                        onChange={(e) => handlePackChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-green-500 focus:bg-white outline-none transition-all font-bold text-gray-700"
                      />
                    </div>
                  </div>

                  {packEntry.renewalCycle === 'daily' && packEntry.packId && (
                    <div className="mt-6 p-5 bg-green-50/50 border border-green-200 rounded-2xl">
                      <h4 className="text-sm font-black text-gray-800 mb-4 tracking-tight">Auto Calculation Preview</h4>
                      <div className="space-y-3">
                        <div className="bg-white p-4 rounded-xl border border-green-100">
                          <p className="text-xs text-gray-500 font-bold mb-1">Formula:</p>
                          <p className="text-lg font-black text-gray-900">
                            ₹{packs.find(p => String(p.id) === String(packEntry.packId))?.price || 0} × {packEntry.totalDeliveries} days × Qty {packEntry.quantity}
                          </p>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-green-100/50">
                          <span className="text-sm text-gray-600 font-medium">Total Amount:</span>
                          <span className="text-2xl font-black text-green-600">
                            ₹{(packs.find(p => String(p.id) === String(packEntry.packId))?.price || 0) * (packEntry.totalDeliveries || 0) * (packEntry.quantity || 1)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-green-100/50">
                          <span className="text-sm text-gray-600 font-medium">Remaining Deliveries:</span>
                          <span className="text-base font-bold text-gray-900">{packEntry.totalDeliveries}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-green-100/50">
                          <span className="text-sm text-gray-600 font-medium">Renewal Date:</span>
                          <span className="text-base font-bold text-gray-900">{packEntry.renewalDate || '-'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-sm text-gray-600 font-medium">Expiry Date:</span>
                          <span className="text-base font-bold text-gray-900">{packEntry.renewalDate || '-'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions Section */}
          <div className="p-8 bg-gray-50/50 flex flex-col md:flex-row gap-4 items-center justify-end">
            <button
              type="button" onClick={onCancel}
              className="w-full md:w-40 px-6 py-3.5 bg-white border-2 border-gray-100 rounded-2xl text-gray-400 font-black uppercase tracking-widest hover:border-gray-200 hover:text-gray-600 transition-all active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={checkingMobile}
              className={`w-full md:w-64 px-8 py-3.5 bg-green-600 shadow-green-100 text-white rounded-2xl text-base font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${checkingMobile ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              {checkingMobile ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEditing ? 'Update Profile' : 'Save Customer')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
