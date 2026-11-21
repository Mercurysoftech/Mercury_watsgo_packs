import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { paymentHistoryAPI, customerAPI } from '../services/api';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentAdded: () => void;
}

export function AddPaymentModal({ isOpen, onClose, onPaymentAdded }: AddPaymentModalProps) {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customersLoading, setCustomersLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerId: '',
    amount: '',
    currency: 'INR',
    paymentStatus: 'paid',
    paymentMethod: 'manual',
    transactionDate: new Date().toISOString().split('T')[0],
    description: '',
    deliveryCharge: '0',
    distanceKm: '0'
  });

  const [settings, setSettings] = useState<any>(null);

  React.useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await (await import('../services/api')).settingsAPI.get();
      if (res.data.success) {
        setSettings(res.data.settings);
      }
    } catch (err) {
      console.error('Failed to fetch settings');
    }
  };

  React.useEffect(() => {
    if (isOpen && customers.length === 0) {
      fetchCustomers();
    }
  }, [isOpen]);

  // Auto-calculate delivery charge when customer changes
  React.useEffect(() => {
    if (formData.customerId && settings) {
      const customer = customers.find(c => String(c.id) === String(formData.customerId));
      if (customer) {
        const dist = Number(customer.distanceKm || 0);
        const base = Number(settings.deliveryCharges || 0);
        const free = Number(settings.deliveryFreeKm || 3);
        const price = Number(settings.deliveryPricePerKm || 0);
        
        let calc = 0;
        if (dist > 0 || base > 0) {
          const extra = Math.max(0, dist - free) * price;
          calc = Number((base + extra).toFixed(2));
        }
        
        setFormData(prev => ({
          ...prev,
          distanceKm: String(dist),
          deliveryCharge: String(calc)
        }));
      }
    }
  }, [formData.customerId, settings, customers]);

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    try {
      const res = await customerAPI.getAll();
      setCustomers(res.data.customers || []);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setError('Failed to load customers');
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.customerId || !formData.amount) {
        setError('Customer and amount are required');
        setLoading(false);
        return;
      }

      await paymentHistoryAPI.record({
        customerId: formData.customerId,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        paymentStatus: formData.paymentStatus,
        paymentMethod: formData.paymentMethod,
        transactionDate: formData.transactionDate,
        description: formData.description,
        deliveryCharge: parseFloat(formData.deliveryCharge),
        distanceKm: parseFloat(formData.distanceKm)
      });

      alert('Payment added successfully!');
      onPaymentAdded();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add payment');
      console.error('Error adding payment:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      customerId: '',
      amount: '',
      currency: 'INR',
      paymentStatus: 'paid',
      paymentMethod: 'manual',
      transactionDate: new Date().toISOString().split('T')[0],
      description: '',
      deliveryCharge: '0',
      distanceKm: '0'
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Add Payment</h2>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-700 text-sm">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Customer</label>
            <select
              name="customerId"
              value={formData.customerId}
              onChange={handleInputChange}
              disabled={customersLoading}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50"
            >
              <option value="">
                {customersLoading ? 'Loading...' : 'Select Customer'}
              </option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} - {c.mobile}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
            <div className="flex gap-2">
              <input
                type="number"
                name="amount"
                placeholder="0.00"
                value={formData.amount}
                onChange={handleInputChange}
                step="0.01"
                min="0"
                required
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <select
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                className="px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Status</label>
            <select
              name="paymentStatus"
              value={formData.paymentStatus}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="paid">Paid</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="manual">Manual</option>
              <option value="razorpay">Razorpay</option>
              <option value="online">Online</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Distance (KM)</label>
              <input
                type="number"
                name="distanceKm"
                value={formData.distanceKm}
                onChange={handleInputChange}
                step="0.1"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Fee</label>
              <input
                type="number"
                name="deliveryCharge"
                value={formData.deliveryCharge}
                onChange={handleInputChange}
                step="0.01"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Transaction Date</label>
            <input
              type="date"
              name="transactionDate"
              value={formData.transactionDate}
              onChange={handleInputChange}
              required
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
            <textarea
              name="description"
              placeholder="e.g., Monthly subscription payment"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
            >
              {loading ? 'Adding...' : 'Add Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
