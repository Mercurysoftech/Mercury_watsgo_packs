import React, { useState, useEffect } from 'react';
import { customerAPI, paymentHistoryAPI } from '../services/api';
import { Customer } from '../types';
import { AlertCircle, CheckCircle, Clock, XCircle, Search, Filter, Users, IndianRupee, Pencil, X, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';

export function PaymentHistoryPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Edit modal state
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editPaymentStatus, setEditPaymentStatus] = useState('paid');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete confirmation state
  const [deleteConfirm, setDeleteConfirm] = useState<{ customerId: string; paymentId?: number } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await customerAPI.getAll();
      const data: Customer[] = res.data.customers || [];
      setCustomers(data);
      applyFilters(data, '', '', '', '');
    } catch (err) {
      setError('Failed to load payment data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (
    data: Customer[],
    search: string,
    status: string,
    start: string,
    end: string
  ) => {
    let filtered = [...data];

    if (search) {
      filtered = filtered.filter(
        c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.mobile.includes(search)
      );
    }

    if (status) {
      filtered = filtered.filter(c => (c.paymentStatus ?? 'unpaid') === status);
    }

    if (start) {
      filtered = filtered.filter(c => {
        if (!c.lastPaymentDate) return false;
        return new Date(c.lastPaymentDate) >= new Date(start);
      });
    }

    if (end) {
      filtered = filtered.filter(c => {
        if (!c.lastPaymentDate) return false;
        return new Date(c.lastPaymentDate) <= new Date(end);
      });
    }

    setFilteredCustomers(filtered);
    setCurrentPage(1); // Reset page on filter change
  };

  // Calculate pagination values
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);

  const handleFilterChange = (field: string, value: string) => {
    const newSearch = field === 'search' ? value : searchTerm;
    const newStatus = field === 'status' ? value : statusFilter;
    const newStart = field === 'startDate' ? value : startDate;
    const newEnd = field === 'endDate' ? value : endDate;

    if (field === 'search') setSearchTerm(value);
    if (field === 'status') setStatusFilter(value);
    if (field === 'startDate') setStartDate(value);
    if (field === 'endDate') setEndDate(value);

    applyFilters(customers, newSearch, newStatus, newStart, newEnd);
  };

  const openEdit = (customer: Customer) => {
    setEditCustomer(customer);
    setEditPaymentStatus(customer.paymentStatus || 'unpaid');
    // Pre-fill last payment date, default to today if none
    const today = new Date().toISOString().split('T')[0];
    setEditPaymentDate(
      customer.lastPaymentDate
        ? String(customer.lastPaymentDate).split('T')[0]
        : today
    );
    setEditError('');
  };

  const handleEditSave = async () => {
    if (!editCustomer) return;
    setEditLoading(true);
    setEditError('');
    try {
      if (editPaymentStatus === 'paid') {
        await paymentHistoryAPI.markPaid({
          customerId: editCustomer.id,
          paymentDate: editPaymentDate,
          recordPayment: true
        });
      } else {
        await customerAPI.update(editCustomer.id, {
          ...editCustomer,
          paymentStatus: editPaymentStatus,
          lastPaymentDate: editPaymentDate
        });
      }
      // Update local state immediately
      const updated = customers.map(c =>
        c.id === editCustomer.id
          ? { ...c, paymentStatus: editPaymentStatus as any, lastPaymentDate: editPaymentDate }
          : c
      );
      setCustomers(updated);
      applyFilters(updated, searchTerm, statusFilter, startDate, endDate);
      setEditCustomer(null);
    } catch (err: any) {
      setEditError(err?.response?.data?.error || 'Failed to update payment');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletePayment = async (customerId: string) => {
    if (!deleteConfirm) return;
    setDeleteLoading(true);
    try {
      // Delete the payment record
      await paymentHistoryAPI.delete(Number(customerId));
      
      // Refresh customer data
      const res = await customerAPI.getAll();
      const updated: Customer[] = res.data.customers || [];
      setCustomers(updated);
      applyFilters(updated, searchTerm, statusFilter, startDate, endDate);
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Failed to delete payment:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const getPaymentBadge = (status?: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Paid
          </span>
        );
      case 'partially_paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            <Clock className="w-3.5 h-3.5" />
            Partial
          </span>
        );
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 border border-orange-200">
            <XCircle className="w-3.5 h-3.5" />
            Overdue
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 border border-red-200">
            <XCircle className="w-3.5 h-3.5" />
            Unpaid
          </span>
        );
    }
  };


  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    // Parse date parts directly to avoid UTC offset shifting the date
    const parts = String(dateStr).split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      const d = new Date(year, month - 1, day); // Local time — no UTC shift
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
    return '—';
  };


  // Summary counts
  const totalPaid = customers.filter(c => c.paymentStatus === 'paid').length;
  const totalUnpaid = customers.filter(c => !c.paymentStatus || c.paymentStatus === 'unpaid').length;
  const totalPartial = customers.filter(c => c.paymentStatus === 'partially_paid').length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.amountPaid ?? 0), 0);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 mt-20 lg:mt-0">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-1">Payment History</h1>
              <p className="text-gray-500">Customer-wise payment status and last payment date</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const response = await paymentHistoryAPI.exportCSV();
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `payment-history-${new Date().toISOString().split('T')[0]}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  } catch (err) {
                    console.error('Export failed:', err);
                    alert('Failed to export payment history');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
              >
                <Download className="w-4 h-4 text-green-600" />
                Export CSV
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await paymentHistoryAPI.exportHistoryPDF();
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `payment-history-${new Date().toISOString().split('T')[0]}.pdf`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                  } catch (err) {
                    console.error('Export failed:', err);
                    alert('Failed to export payment history PDF');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm"
              >
                <FileText className="w-4 h-4 text-green-600" />
                Export PDF
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <span className="text-red-700">{error}</span>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-green-200 p-5 flex items-center gap-4 shadow-sm">
              <div className="bg-green-100 rounded-xl p-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Paid</p>
                <p className="text-2xl font-bold text-gray-800">{totalPaid}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-red-200 p-5 flex items-center gap-4 shadow-sm">
              <div className="bg-red-100 rounded-xl p-3">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Unpaid</p>
                <p className="text-2xl font-bold text-gray-800">{totalUnpaid}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-yellow-200 p-5 flex items-center gap-4 shadow-sm">
              <div className="bg-yellow-100 rounded-xl p-3">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Partial</p>
                <p className="text-2xl font-bold text-gray-800">{totalPartial}</p>
              </div>
            </div>
            {/* <div className="bg-white rounded-xl border border-green-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="bg-green-100 rounded-xl p-3">
              <IndianRupee className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Total Collected</p>
              <p className="text-2xl font-bold text-gray-800">₹{totalRevenue.toLocaleString('en-IN')}</p>
            </div>
          </div> */}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="font-semibold text-gray-700">Filters</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search name or mobile..."
                  value={searchTerm}
                  onChange={e => handleFilterChange('search', e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                />
              </div>

              {/* Payment Status */}
              <select
                value={statusFilter}
                onChange={e => handleFilterChange('status', e.target.value)}
                className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
              >
                <option value="">All Payments</option>
                <option value="paid">Paid</option>
                <option value="unpaid">Unpaid</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="overdue">Overdue</option>
              </select>

              {/* From Date */}
              <div>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="From Date"
                />
              </div>

              {/* To Date */}
              <div>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  placeholder="To Date"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                Loading payment data...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No customers found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="hidden md:table w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">#</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Customer Name</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Mobile</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Pack</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Payment Status</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Amount Paid</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Last Payment Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Renewal Date</th>
                      <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentCustomers.map((customer, idx) => (
                      <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-400">{indexOfFirstItem + idx + 1}</td>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-gray-800">{customer.name}</p>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{customer.mobile}</td>
                        <td className="px-6 py-4">
                          {customer.packName ? (
                            <div>
                              <p className="text-sm font-medium text-gray-800">{customer.packName}</p>
                              <p className="text-xs text-gray-400">₹{customer.packPrice}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">No pack</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {getPaymentBadge(customer.paymentStatus)}
                        </td>
                        <td className="px-6 py-4 text-sm font-semibold text-gray-700">
                          {customer.amountPaid && customer.amountPaid > 0
                            ? `₹${Number(customer.amountPaid).toLocaleString('en-IN')}`
                            : '—'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(customer.lastPaymentDate)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(customer.renewalDate)}
                        </td>
                        <td className="px-6 py-4 flex gap-2">
                          <button
                            onClick={() => openEdit(customer)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                            title="Edit payment"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ customerId: customer.id })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                            title="Delete payment record"
                          >
                            <X className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-gray-100 bg-white">
                  {currentCustomers.map((customer, idx) => (
                    <div key={customer.id} className="p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900 text-base">{customer.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{customer.mobile}</p>
                        </div>
                        <div>
                          {getPaymentBadge(customer.paymentStatus)}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl text-xs">
                        <div>
                          <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Pack Details</span>
                          <span className="font-semibold text-gray-700">{customer.packName || 'No Pack'}</span>
                          {customer.packPrice && <span className="text-gray-500 block">₹{customer.packPrice}</span>}
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Amount Paid</span>
                          <span className="font-bold text-gray-900 text-sm">
                            {customer.amountPaid && customer.amountPaid > 0
                              ? `₹${Number(customer.amountPaid).toLocaleString('en-IN')}`
                              : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Last Payment</span>
                          <span className="font-semibold text-gray-700">{formatDate(customer.lastPaymentDate)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Renewal Date</span>
                          <span className="font-semibold text-gray-700">{formatDate(customer.renewalDate)}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={() => openEdit(customer)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ customerId: customer.id })}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 gap-4">
                <div className="text-sm text-gray-600">
                  Showing <span className="font-medium text-gray-900">{indexOfFirstItem + 1}</span> to <span className="font-medium text-gray-900">{Math.min(indexOfLastItem, filteredCustomers.length)}</span> of <span className="font-medium text-gray-900">{filteredCustomers.length}</span> results
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="sr-only sm:not-sr-only sm:text-sm">Prev</span>
                  </button>
                  
                  <div className="hidden sm:flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                        return (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                              currentPage === page
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
                  
                  <span className="sm:hidden text-sm font-medium text-gray-700">Page {currentPage} of {totalPages}</span>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors flex items-center gap-1"
                  >
                    <span className="sr-only sm:not-sr-only sm:text-sm">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Edit Payment Modal */}
      {
        editCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">Edit Payment</h2>
                  <p className="text-sm text-gray-500">{editCustomer.name} · {editCustomer.mobile}</p>
                </div>
                <button
                  onClick={() => setEditCustomer(null)}
                  className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-5 space-y-4">
                {editError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-sm text-red-700">{editError}</p>
                  </div>
                )}

                {/* Payment Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Status</label>
                  <select
                    value={editPaymentStatus}
                    onChange={e => setEditPaymentStatus(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
                  >
                    <option value="paid">✅ Paid</option>
                    <option value="unpaid">❌ Unpaid</option>
                    <option value="partially_paid">⏳ Partially Paid</option>
                    <option value="overdue">⚠️ Overdue</option>
                  </select>
                </div>

                {/* Payment Date */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Date</label>
                  <input
                    type="date"
                    value={editPaymentDate}
                    onChange={e => setEditPaymentDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">This updates the Last Payment Date for the customer</p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
                <button
                  onClick={() => setEditCustomer(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={editLoading || !editPaymentDate}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {editLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
                  ) : (
                    <><CheckCircle className="w-4 h-4" />Save Changes</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Delete Payment Record</h2>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-3">
              <p className="text-gray-700 text-sm">
                Are you sure you want to delete this payment record? This will:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                <li>Remove the payment record permanently</li>
                <li>Reset customer status to Unpaid if no other payments exist</li>
                <li>Clear the last payment date</li>
              </ul>
              <p className="text-sm text-red-600 font-medium mt-4">
                ⚠️ This action cannot be undone.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePayment(deleteConfirm.customerId)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
              >
                {deleteLoading ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Deleting...</>
                ) : (
                  <><X className="w-4 h-4" />Delete Record</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

