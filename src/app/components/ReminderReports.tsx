import React, { useState, useEffect } from 'react';
import { IndianRupee, Users, Package, TrendingUp, Download, Loader2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { reportAPI, customerAPI } from '../services/api';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';

interface ReportsDashboardProps {
  isSubscriptionActive?: boolean;
}

const COLORS = ['#22c55e', '#eab308', '#ef4444', '#3b82f6', '#8b5cf6'];

export function ReminderReports({ isSubscriptionActive = true }: ReportsDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('monthly');
  const [data, setData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  const itemsPerPage = 5;

  useEffect(() => {
    if (isSubscriptionActive) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [timeframe, isSubscriptionActive]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const res = await reportAPI.getDashboard(timeframe);
      if (res.data.success) {
        setData(res.data.data);
        setError(null);
      } else {
        setError(res.data.error || 'Failed to fetch dashboard data');
      }
    } catch (error: any) {
      console.error('Failed to fetch report data:', error);
      setError(error.response?.data?.error || 'Failed to fetch report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await customerAPI.getAll();
        const customers = res.data.customers || [];
        const zones = Array.from(new Set(customers.map((c: any) => c.zone).filter(Boolean))) as string[];
        const areas = Array.from(new Set(customers.map((c: any) => c.area).filter(Boolean))) as string[];
        setAvailableZones(zones.sort());
        setAvailableAreas(areas.sort());
      } catch (err) {
        console.error('Failed to fetch filters:', err);
      }
    };
    fetchFilters();
  }, []);

  const handleExportCSV = async () => {
    try {
      const response = await reportAPI.exportCSV(timeframe, selectedZone, selectedArea);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${timeframe}-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export report CSV');
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await reportAPI.exportPDF(timeframe, selectedZone, selectedArea);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${timeframe}-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export report PDF');
    }
  };

  if (!isSubscriptionActive) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-gray-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Reports & Analytics Blocked</h2>
        <p className="text-gray-500 max-w-md">Please activate or renew your subscription to access comprehensive insights into your business performance.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-white rounded-2xl border border-red-100 shadow-sm">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Error Loading Dashboard</h2>
        <p className="text-gray-500 max-w-md">{error || 'Unable to load analytics data.'}</p>
        <button onClick={fetchDashboardData} className="mt-4 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Try Again</button>
      </div>
    );
  }

  // Formatting large numbers to Indian locale
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-IN').format(num);
  };

  // Prepare custom tooltip for Pie chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 shadow-lg rounded-lg">
          <p className="text-sm font-medium text-gray-800">{`${payload[0].name}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">Comprehensive insights into your business performance</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="px-3 py-2 border border-gray-300 text-sm rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white min-w-[120px]"
          >
            <option value="">All Zones</option>
            {availableZones.map(z => <option key={z} value={z}>{z}</option>)}
          </select>
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="px-3 py-2 border border-gray-300 text-sm rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white min-w-[120px]"
          >
            <option value="">All Areas</option>
            {availableAreas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              title="Export CSV"
            >
              <Download className="w-4 h-4 text-green-600" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              title="Export PDF"
            >
              <FileText className="w-4 h-4 text-green-600" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <IndianRupee className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">+15%</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-800">{formatCurrency(data.totalRevenue)}</h3>
            <p className="text-sm font-medium text-gray-500 mt-1">Total Revenue</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">+10%</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-800">{formatNumber(data.totalCustomers)}</h3>
            <p className="text-sm font-medium text-gray-500 mt-1">Total Customers</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">+8%</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-800">{formatNumber(data.totalDeliveries)}</h3>
            <p className="text-sm font-medium text-gray-500 mt-1">Total Deliveries</p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between group">
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-md">+5%</span>
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-800">{formatCurrency(data.avgOrderValue)}</h3>
            <p className="text-sm font-medium text-gray-500 mt-1">Avg. Order Value</p>
          </div>
        </div>
      </div>

      {/* Row 1 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-6">Revenue Trend</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.revenueTrend} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                  width={65}
                  tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                  domain={[0, 'dataMax + 40000']}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                  formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                <Line
                  type="linear"
                  dataKey="revenue"
                  name="Revenue (₹)"
                  stroke="#22c55e"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer Growth */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-6">Customer Growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.customerGrowth} margin={{ top: 30, right: 30, bottom: 20, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                  dy={10} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#9CA3AF', fontSize: 12 }} 
                  width={40}
                  padding={{ top: 10 }}
                />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #E5E7EB', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Legend verticalAlign="bottom" height={36} iconType="square" />
                <Bar 
                  dataKey="customers" 
                  name="Customers" 
                  fill="#22c55e" 
                  barSize={40} 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2 Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery Statistics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-6">Delivery Statistics</h3>
          <div className="h-64 flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.deliveryStats.map((d: any) => ({
                    name: d.status.charAt(0).toUpperCase() + d.status.slice(1).replace('_', ' '),
                    value: d.count
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {data.deliveryStats.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pack Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-base font-semibold text-gray-800 mb-6">Pack Performance</h3>
          <div className="h-64 overflow-y-auto pr-2 custom-scrollbar">
            <div className="space-y-5">
              {data.packPerformance.map((pack: any, index: number) => {
                const totalRev = data.packPerformance.reduce((acc: number, curr: any) => acc + (Number(curr.revenue) || 0), 0) || 1;
                const percent = ((Number(pack.revenue) || 0) / totalRev) * 100;
                
                return (
                  <div key={index} className="w-full">
                    <div className="flex justify-between items-end mb-1 text-sm">
                      <span className="font-medium text-gray-700">{pack.name || 'Unnamed Pack'}</span>
                      <div className="text-right">
                        <span className="font-bold text-gray-800 block">{formatCurrency(pack.revenue || 0)}</span>
                        <span className="text-xs text-gray-500">{pack.customerCount} customers</span>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-green-500 h-1.5 rounded-full" 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 Table & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Customers list */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Top Customers by Revenue</h3>
          </div>
          <div className="overflow-x-auto flex-1 p-2">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pack</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {(data.topCustomers || []).slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((cust: any, index: number) => (
                  <tr key={index} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 text-sm">{cust.customerName}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{cust.packName || 'No Pack'}</td>
                    <td className="px-4 py-3 text-gray-800 font-semibold text-sm text-right">{formatCurrency(cust.revenue || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.topCustomers && data.topCustomers.length > itemsPerPage && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-bold uppercase tracking-tight">
                Page {currentPage} of {Math.ceil(data.topCustomers.length / itemsPerPage)}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(data.topCustomers.length / itemsPerPage), p + 1))}
                  disabled={currentPage === Math.ceil(data.topCustomers.length / itemsPerPage)}
                  className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Monthly Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-800">Monthly Summary</h3>
          </div>
          <div className="p-5 space-y-4 flex-1">
            <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-3">
              <span className="text-sm text-gray-600">New Customers</span>
              <span className="text-sm font-semibold text-green-600">{data.monthlySummary.newCustomers}</span>
            </div>
            <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-3">
              <span className="text-sm text-gray-600">Renewed Subscriptions</span>
              <span className="text-sm font-semibold text-green-600">{data.monthlySummary.renewedSubscriptions}</span>
            </div>
            <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-3">
              <span className="text-sm text-gray-600">Canceled Subscriptions</span>
              <span className="text-sm font-semibold text-red-600">{data.monthlySummary.canceledSubscriptions}</span>
            </div>
            <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-3">
              <span className="text-sm text-gray-600">Paused Subscriptions</span>
              <span className="text-sm font-semibold text-orange-600">{data.monthlySummary.pausedSubscriptions}</span>
            </div>
            <div className="flex justify-between items-center border-b border-dashed border-gray-200 pb-3">
              <span className="text-sm text-gray-600">Total Deliveries</span>
              <span className="text-sm font-semibold text-green-600">{formatNumber(data.monthlySummary.totalDeliveries)}</span>
            </div>
            <div className="flex justify-between items-center pb-1">
              <span className="text-sm text-gray-600">Average Delivery Rate</span>
              <span className="text-sm font-semibold text-green-600">{data.monthlySummary.averageDeliveryRate}%</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
