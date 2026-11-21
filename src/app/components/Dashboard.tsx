import React, { useState, useEffect } from 'react';
import { Users, CheckCircle, Clock, XCircle, TrendingUp, CreditCard, ArrowUpRight, ArrowDownRight, Calendar, Truck } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Customer } from '../types';
import { customerAPI } from '../services/api';
import { AddPaymentModal } from './AddPaymentModal';

interface DashboardProps {
  customers: Customer[];
  userName?: string;
  subscription?: {
    status: string;
    expiry: string | null;
    daysRemaining: number;
    planType?: string;
    paymentUrl?: string;
  } | null;
  onNavigate: (page: any) => void;
}

export function Dashboard({ customers, userName, subscription, onNavigate }: DashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await customerAPI.getDashboardStats();
        if (res.data.success) {
          setStats(res.data.stats);
        } else {
          setStatsError(true);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setStatsError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const handlePaymentAdded = () => {
    // Refresh stats when payment is added
    const fetchStats = async () => {
      try {
        const res = await customerAPI.getDashboardStats();
        if (res.data.success) {
          setStats(res.data.stats);
        }
      } catch (error) {
        console.error('Failed to refresh stats:', error);
      }
    };
    fetchStats();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('en-US', options);
  };

  const statItems = [
    {
      title: 'Monthly Revenue',
      value: `\u20B9${Number(stats?.monthlyRevenue?.value || 0).toLocaleString()}`,
      trend: stats?.monthlyRevenue?.trend,
      icon: CreditCard,
      bgColor: 'bg-white',
      iconColor: 'text-gray-400',
      borderColor: 'border-gray-100'
    },
    {
      title: 'Active Subscriptions',
      value: stats?.activeSubscriptions?.value || 0,
      trend: stats?.activeSubscriptions?.trend,
      icon: TrendingUp,
      bgColor: 'bg-white',
      iconColor: 'text-gray-400',
      borderColor: 'border-gray-100'
    },
    {
      title: 'Pending Renewals',
      value: stats?.pendingRenewals?.value || 0,
      trendLabel: stats?.pendingRenewals?.label,
      icon: Clock,
      bgColor: 'bg-white',
      iconColor: 'text-gray-400',
      borderColor: 'border-gray-100'
    },
    {
      title: 'Net Profit',
      value: `\u20B9${Number(stats?.netProfit?.value || 0).toLocaleString()}`,
      trendLabel: stats?.netProfit?.label,
      icon: TrendingUp,
      bgColor: 'bg-white',
      iconColor: 'text-green-500',
      borderColor: 'border-gray-100'
    },
    {
      title: 'Delivery Revenue',
      value: `\u20B9${Number(stats?.deliveryRevenue?.value || 0).toLocaleString()}`,
      trend: stats?.deliveryRevenue?.trend,
      icon: Truck,
      bgColor: 'bg-white',
      iconColor: 'text-gray-400',
      borderColor: 'border-gray-100'
    }
  ];

  const isActive = subscription?.status === 'active';
  const isExpiringSoon = isActive && subscription && subscription.daysRemaining > 0 && subscription.daysRemaining <= 3;

  // Show spinner only while loading, not forever
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // If stats failed or are missing, create empty fallback so dashboard renders
  const safeStats = stats || {};
  const safeCharts = safeStats.charts || {
    revenueTrend: [
      { month: 'Jan', revenue: 0 }, { month: 'Feb', revenue: 0 },
      { month: 'Mar', revenue: 0 }, { month: 'Apr', revenue: 0 },
      { month: 'May', revenue: 0 }, { month: 'Jun', revenue: 0 }
    ],
    subscriptionGrowth: [
      { month: 'Jan', count: 0 }, { month: 'Feb', count: 0 },
      { month: 'Mar', count: 0 }, { month: 'Apr', count: 0 },
      { month: 'May', count: 0 }, { month: 'Jun', count: 0 }
    ]
  };
  const safeLists = safeStats.lists || { upcomingRenewals: [], recentPayments: [] };

  return (
    <div className="relative space-y-8 pb-12 max-w-[1400px] mx-auto">
      {/* Subscription Status Banners */}
      {isExpiringSoon && subscription?.planType !== 'free' && subscription?.planType !== 'trial' && subscription?.planType !== 'basic' && (
        <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-4 rounded-r-xl shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5" />
            <div>
              <p className="font-bold">Subscription Expiring Soon!</p>
              <p className="text-sm">Your subscription will end in {subscription?.daysRemaining} days. Please renew to avoid service interruption.</p>
            </div>
          </div>
        </div>
      )}

      {!isActive && subscription && subscription?.planType !== 'free' && subscription?.planType !== 'trial' && subscription?.planType !== 'basic' && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 mb-6 rounded-r-2xl shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-full">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-lg text-red-800">{subscription.planType === 'trial' || subscription.planType === 'free' || subscription.planType === 'basic' ? 'Trial Expired' : 'Subscription Required'}</p>
                <p className="text-sm text-red-600 opacity-90">
                  {subscription.planType === 'trial' || subscription.planType === 'free' || subscription.planType === 'basic'
                    ? 'Your 10 days trial has ended. Please upgrade to a Pro plan to continue managing your customers and automated reminders.'
                    : subscription.expiry
                      ? `Your subscription expired on ${new Date(subscription.expiry).toLocaleDateString()}. Please renew to continue using all features.`
                      : 'Welcome! To access all features like customer management and SMS reminders, please subscribe to a plan.'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('settings')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-red-100 transition-all flex items-center justify-center gap-2"
            >
              💳 Renew Now
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          {getGreeting()}, {userName?.split(' ')[0] || 'User'}
        </h1>
        <p className="text-gray-500 mt-1">Here's what's happening with your business today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statItems.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white border border-gray-100 rounded-[1.25rem] p-6 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">{stat.title}</span>
                <Icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                {stat.trend !== undefined && (
                  <div className={`flex items-center gap-1 text-xs font-bold ${stat.trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(stat.trend)}% from last month
                  </div>
                )}
                {stat.trendLabel && (
                  <p className="text-xs text-orange-600 font-bold">{stat.trendLabel}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Section */}
      {(subscription?.planType !== 'trial' && subscription?.planType !== 'free' && subscription?.planType !== 'basic') ? (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Trend Chart */}
        <div className="bg-white p-8 rounded-[1.5rem] border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-8">Monthly Revenue</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeCharts.revenueTrend} margin={{ top: 30, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }}
                  tickFormatter={(v: number) => `${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`}
                  width={55}
                  padding={{ top: 10 }}
                />
                <Tooltip
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold' }}
                  formatter={(val: any) => [`₹${Math.round(Number(val)).toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Bar
                  dataKey="revenue"
                  fill="#10b981"
                  radius={[6, 6, 0, 0]}
                  barSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subscription Growth Chart */}
        <div className="bg-white p-8 rounded-[1.5rem] border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-8">Subscription Growth</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safeCharts.subscriptionGrowth} margin={{ top: 30, right: 30, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9CA3AF', fontWeight: 500 }}
                  allowDecimals={false}
                  width={45}
                  padding={{ top: 10 }}
                />
                <Tooltip
                  cursor={{ fill: '#F0FDF4' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  formatter={(val: any) => [val, 'Customers']}
                />
                <Bar
                  dataKey="count"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={50}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      ) : (
        <div className="bg-white p-12 rounded-[2rem] border border-gray-100 shadow-sm text-center">
            <div className="bg-green-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BarChart className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Growth Analytics</h3>
            <p className="text-gray-500 max-w-sm mx-auto mb-6">Advanced charts and revenue insights are available on Starter, Growth, and Pro plans.</p>
            <button 
                onClick={() => onNavigate('settings')}
                className="text-green-600 font-bold hover:text-green-700 transition-colors"
            >
                Upgrade to Unlock &rarr;
            </button>
        </div>
      )}

      {/* Lists Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Renewals */}
        <div className="bg-white p-8 rounded-[1.5rem] border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Upcoming Renewals</h3>
          <div className="space-y-3">
            {safeLists.upcomingRenewals?.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-orange-500 mt-0.5">
                    Due: {item.renewalDate ? new Date(item.renewalDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </p>
                </div>
                <span className="font-bold text-gray-900">&#8377;{Number(item.price || 0).toLocaleString()}</span>
              </div>
            ))}
            {safeLists.upcomingRenewals.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No upcoming renewals</p>
            )}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="bg-white p-8 rounded-[1.5rem] border border-gray-100 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Recent Payments</h3>
          <div className="space-y-3">
            {safeLists.recentPayments?.map((item: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-green-500 mt-0.5">
                    Paid: {item.date ? new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                  </p>
                </div>
                <span className="font-bold text-gray-900">&#8377;{Number(item.amount || 0).toLocaleString()}</span>
              </div>
            ))}
            {safeLists.recentPayments.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">No recent payments</p>
            )}
          </div>
        </div>
      </div>

      <AddPaymentModal
        isOpen={showAddPaymentModal}
        onClose={() => setShowAddPaymentModal(false)}
        onPaymentAdded={handlePaymentAdded}
      />
    </div>
  );
}
