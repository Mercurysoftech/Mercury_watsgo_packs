import React, { useState, useEffect } from 'react';
import { paymentHistoryAPI, UPLOAD_BASE_URL } from '../services/api';
import { AlertCircle, CheckCircle, XCircle, Search, Filter, Trash2, FileText, Download, Printer, X, ShieldCheck, Mail, Phone, Globe } from 'lucide-react';

interface PaymentRecord {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_mobile: string;
  amount: number;
  payment_status: 'paid' | 'unpaid' | 'pending';
  payment_date: string;
  renewal_date: string;
  created_at: string;
  payment_method?: string;
  description?: string;
  delivery_charge?: number;
  distance_km?: number;
  customer_address?: string;
  custom_charge_amount?: number;
  custom_charge_name?: string;
  amount_paid?: number;
  balance?: number;
}

interface SimplePaymentHistoryProps {
  isSubscriptionActive?: boolean;
  settings?: any;
}

export function SimplePaymentHistory({ isSubscriptionActive = true, settings }: SimplePaymentHistoryProps) {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PaymentRecord | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    fetchPaymentHistory();
  }, []);

  const fetchPaymentHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await paymentHistoryAPI.getAll();
      const data: PaymentRecord[] = res.data.data || [];
      setRecords(data);
      applyFilters(data, '', '');
    } catch (err) {
      setError('Failed to load payment history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (data: PaymentRecord[], search: string, status: string) => {
    let filtered = [...data];

    if (search) {
      filtered = filtered.filter(
        r =>
          r.customer_name.toLowerCase().includes(search.toLowerCase()) ||
          r.customer_mobile.includes(search)
      );
    }

    if (status) {
      filtered = filtered.filter(r => r.payment_status === status);
    }

    setFilteredRecords(filtered);
    setCurrentPage(1);
  };

  const handleFilterChange = (field: string, value: string) => {
    const newSearch = field === 'search' ? value : searchTerm;
    const newStatus = field === 'status' ? value : statusFilter;

    if (field === 'search') setSearchTerm(value);
    if (field === 'status') setStatusFilter(value);

    applyFilters(records, newSearch, newStatus);
  };

  const handleDelete = async (recordId: number) => {
    setDeleteLoading(true);
    try {
      await paymentHistoryAPI.delete(recordId);
      setRecords(records.filter(r => r.id !== recordId));
      applyFilters(
        records.filter(r => r.id !== recordId),
        searchTerm,
        statusFilter
      );
      setSelectedRecords(selectedRecords.filter(id => id !== recordId));
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error('Failed to delete:', err);
      alert('Failed to delete payment record');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRecords(filteredRecords.map(r => r.id));
    } else {
      setSelectedRecords([]);
    }
  };

  const handleSelectRecord = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedRecords([...selectedRecords, id]);
    } else {
      setSelectedRecords(selectedRecords.filter(rId => rId !== id));
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-200">
            <CheckCircle className="w-3.5 h-3.5" />
            Paid
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter bg-yellow-100 text-yellow-800 border border-yellow-200 shadow-sm">
            ⏳ Partially Paid
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

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
    return '—';
  };

  const totalPaid = records.filter(r => r.payment_status === 'paid').length;
  const totalUnpaid = records.filter(r => r.payment_status === 'unpaid').length;
  const totalPending = records.filter(r => r.payment_status === 'pending').length;

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 mt-20 lg:mt-0">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-1">Payment History</h1>
          <p className="text-gray-500">All payments recorded for customers</p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-green-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="bg-green-100 rounded-xl p-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Paid</p>
              <p className="text-2xl font-bold text-gray-800">{totalPaid}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="bg-red-100 rounded-xl p-3">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Unpaid</p>
              <p className="text-2xl font-bold text-gray-800">{totalUnpaid}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-yellow-200 p-5 flex items-center gap-4 shadow-sm">
            <div className="bg-yellow-100 rounded-xl p-3">
              <span className="text-lg">⏳</span>
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase">Pending</p>
              <p className="text-2xl font-bold text-gray-800">{totalPending}</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="font-semibold text-gray-700">Filters</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            <select
              value={statusFilter}
              onChange={e => handleFilterChange('status', e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white"
            >
              <option value="">All Status</option>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
              <option value="pending">Pending</option>
            </select>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const response = await paymentHistoryAPI.exportCSV(undefined, selectedRecords);
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
                className="flex-1 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-50 transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <Download className="w-4 h-4 text-green-600" />
                CSV
              </button>
              <button
                onClick={async () => {
                  try {
                    const response = await paymentHistoryAPI.exportHistoryPDF(selectedRecords);
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
                className="flex-1 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg font-bold hover:bg-red-100 transition-all shadow-sm flex items-center justify-center gap-2 text-sm"
              >
                <FileText className="w-4 h-4 text-red-600" />
                PDF
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">
              <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              Loading payment history...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">No payment records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="hidden md:table w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="bg-gray-50/55">
                    <th className="px-6 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={filteredRecords.length > 0 && selectedRecords.length === filteredRecords.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Date</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Packs Taken</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRecords.map((record, idx) => (
                    <tr key={record.id} className={`hover:bg-gray-50 transition-colors ${selectedRecords.includes(record.id) ? 'bg-green-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRecords.includes(record.id)}
                          onChange={(e) => handleSelectRecord(record.id, e.target.checked)}
                          className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-800">{record.customer_name}</p>
                        <p className="text-xs text-gray-500">{record.customer_mobile}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-gray-900">
                          ₹{((Number(record.amount) || 0) + (Number(record.delivery_charge) || 0) + (Number(record.custom_charge_amount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        {record.balance && Number(record.balance) > 0 && (
                          <p className="text-[10px] text-red-500 font-bold mt-1">Bal: ₹{Number(record.balance).toLocaleString('en-IN')}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getPaymentBadge(record.payment_status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(record.payment_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-[200px] truncate" title={record.description || '—'}>
                        {record.description ? record.description.replace('Subscription Renewal:', '').trim() : '—'}
                      </td>
                      <td className="px-6 py-4 flex items-center gap-2">
                        <button
                          onClick={() => setSelectedInvoice(record)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                          title="View Invoice"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Invoice
                        </button>
                        <button
                          onClick={() => isSubscriptionActive && setDeleteConfirm(record.id)}
                          disabled={!isSubscriptionActive}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors ${!isSubscriptionActive ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                          title={isSubscriptionActive ? "Delete record" : "Subscription Required"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-gray-100 bg-white">
                {paginatedRecords.map((record, idx) => (
                  <div key={record.id} className={`p-5 space-y-4 transition-colors ${selectedRecords.includes(record.id) ? 'bg-green-50/30' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedRecords.includes(record.id)}
                          onChange={(e) => handleSelectRecord(record.id, e.target.checked)}
                          className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                        />
                        <div>
                          <p className="font-bold text-gray-900 text-base">{record.customer_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{record.customer_mobile}</p>
                        </div>
                      </div>
                      <div>
                        {getPaymentBadge(record.payment_status)}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl text-xs">
                      <div>
                        <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Amount</span>
                        <span className="font-bold text-gray-900 text-sm">
                          ₹{((Number(record.amount) || 0) + (Number(record.delivery_charge) || 0) + (Number(record.custom_charge_amount) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                        {record.balance && Number(record.balance) > 0 && (
                          <span className="text-[10px] text-red-500 font-bold block mt-0.5">Bal: ₹{Number(record.balance).toLocaleString('en-IN')}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Payment Date</span>
                        <span className="font-semibold text-gray-700">{formatDate(record.payment_date)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400 block mb-0.5 font-bold uppercase tracking-wider text-[9px]">Packs Taken</span>
                        <span className="font-medium text-gray-600 truncate block">
                          {record.description ? record.description.replace('Subscription Renewal:', '').trim() : '—'}
                        </span>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2 pt-2 mt-1 border-t border-gray-200 border-dashed">
                        <button
                          onClick={() => setSelectedInvoice(record)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Invoice
                        </button>
                        <button
                          onClick={() => isSubscriptionActive && setDeleteConfirm(record.id)}
                          disabled={!isSubscriptionActive}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors ${!isSubscriptionActive ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && filteredRecords.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-900">{((currentPage - 1) * itemsPerPage) + 1}</span> to <span className="font-medium text-gray-900">{Math.min(currentPage * itemsPerPage, filteredRecords.length)}</span> of <span className="font-medium text-gray-900">{filteredRecords.length}</span> records
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  Previous
                </button>
                <div className="text-sm text-gray-500 font-medium px-2">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Delete Payment Record</h2>
            </div>
            <div className="px-6 py-5">
              <p className="text-gray-700 text-sm">
                Are you sure? This will delete the payment record permanently.
              </p>
              <p className="text-sm text-red-600 font-medium mt-4">⚠️ This cannot be undone.</p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteLoading}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg font-medium text-sm"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Invoice Modal */}
      {selectedInvoice && (
        <CustomerInvoiceModal
          record={selectedInvoice}
          settings={settings}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}

// --- Customer Invoice Modal ---
function CustomerInvoiceModal({ record, settings, onClose }: { record: PaymentRecord, settings: any, onClose: () => void }) {
  const handlePrint = () => {
    window.print();
  };

  const getLogoUrl = (logo?: string) => {
    if (!logo) return null;
    if (logo.startsWith('data:image')) return logo;
    if (logo.startsWith('http')) return logo;
    // Ensure logo path starts correctly
    const path = logo.startsWith('/') ? logo : `/${logo}`;
    return `${UPLOAD_BASE_URL}${path}`;
  };

  const businessLogoUrl = getLogoUrl(settings?.businessLogo);

  return (
    <div className="print-container-wrapper fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm p-4 overflow-y-auto flex justify-center items-start print:p-0 print:bg-white print:block print:relative print:z-[99999]">
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          body {
            visibility: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          /* Target the modal overlay */
          .print-container-wrapper {
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            min-height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            z-index: 99999 !important;
            display: block !important;
          }
          /* Ensure all contents are visible */
          .print-container-wrapper * {
            visibility: visible !important;
          }
          /* The actual invoice box */
          .print-container {
            margin: 0 auto !important;
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }
          /* Kill the background page height */
          #root {
            height: 0 !important;
            overflow: hidden !important;
          }
          #root .print-container-wrapper {
            height: auto !important;
            overflow: visible !important;
          }
          /* Hide buttons */
          .print\\:hidden, button {
            display: none !important;
          }
          /* Reduce spacings to fit on 1 page */
          .print-container .p-8, 
          .print-container .md\\:p-12 {
            padding: 20px !important;
          }
          .print-container .mb-12 {
            margin-bottom: 8px !important;
          }
          .print-container .mb-8 {
            margin-bottom: 6px !important;
          }
          .print-container .py-8 {
            padding-top: 8px !important;
            padding-bottom: 8px !important;
          }
          .print-container .pt-12 {
            padding-top: 10px !important;
          }
          .print-container .space-y-12 > * + * {
            margin-top: 10px !important;
          }
          .print-container .gap-12 {
            gap: 15px !important;
          }
          /* Shrink the total box for print */
          .print-container .bg-gray-900.p-5 {
            padding: 12px !important;
            border-radius: 12px !important;
          }
          /* Ensure table rows are tight */
          .print-container td, .print-container th {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
          /* Date bar and header gaps */
          .print-container .p-6 {
            padding: 12px !important;
          }
          .print-container .gap-8 {
            gap: 12px !important;
          }
          .print-container .mb-12 {
            margin-bottom: 8px !important;
          }
        }
      `}</style>
      <div className="print-container bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-4 md:my-12 overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 print:shadow-none print:my-0 print:rounded-none">
        {/* Actions - Hidden in Print */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 print:hidden">
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-all shadow-sm text-sm"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button
              onClick={async () => {
                try {
                  const response = await paymentHistoryAPI.exportPDF(record.id);
                  const url = window.URL.createObjectURL(new Blob([response.data]));
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `invoice-${record.id}.pdf`);
                  document.body.appendChild(link);
                  link.click();
                  link.remove();
                } catch (err) {
                  console.error('Download failed:', err);
                  alert('Failed to download PDF');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md text-sm"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Invoice Body */}
        <div className="p-8 md:p-12">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-12">
            <div className="flex items-center gap-4">
              {businessLogoUrl ? (
                <img src={businessLogoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-xl" />
              ) : (
                <div className="w-16 h-16 bg-green-600 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-10 h-10 text-white" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">{settings?.businessName || 'Fresh Fruit Packs'}</h2>
                <div className="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Official Receipt</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Invoice Number</div>
              <div className="text-xl font-mono font-bold text-gray-900 bg-gray-50 px-4 py-2 rounded-xl border border-gray-100">
                {record.invoice_string || `INV-${record.id.toString().padStart(6, '0')}`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            {/* From */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Issued By</h3>
              <div>
                <p className="text-lg font-black text-gray-900 uppercase tracking-tight">{settings?.businessName}</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed whitespace-pre-line">{settings?.address || 'Address not listed'}</p>
                <div className="mt-3 space-y-1">
                  {settings?.contactPhone && (
                    <p className="text-xs flex items-center gap-2 text-gray-600 font-bold">
                      <Phone className="w-3 h-3" /> {settings.contactPhone}
                    </p>
                  )}
                  {settings?.contactEmail && (
                    <p className="text-xs flex items-center gap-2 text-gray-600 font-bold">
                      <Mail className="w-3 h-3" /> {settings.contactEmail}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* To */}
            <div className="md:text-right space-y-4">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Bill To</h3>
              <div>
                <p className="text-lg font-black text-gray-900 uppercase tracking-tight">{record.customer_name}</p>
                <p className="text-sm font-bold text-gray-500 mt-1">{record.customer_mobile}</p>
                <p className="text-sm text-gray-400 mt-1 whitespace-pre-line leading-relaxed">{record.customer_address || 'Address not provided'}</p>
              </div>
            </div>
          </div>

          {/* Date & Info */}
          <div className="flex flex-wrap gap-8 items-center p-6 bg-green-50/30 rounded-3xl border border-green-50 mb-12">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Payment Date</p>
              <p className="font-black text-gray-800 uppercase text-xs">
                {new Date(record.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="w-px h-8 bg-green-100 hidden sm:block" />
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Renewal Date</p>
              <p className="font-black text-green-600 uppercase text-xs">
                {new Date(record.renewal_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <div className="w-px h-8 bg-green-100 hidden sm:block" />
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Method</p>
              <p className="font-black text-gray-800 uppercase text-xs">
                {record.payment_method?.replace(/_/g, ' ') || 'Manual'}
              </p>
            </div>
            <div className="w-px h-8 bg-green-100 hidden sm:block" />
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
              <span className="px-2 py-0.5 bg-green-500 text-white rounded-md text-[10px] font-black uppercase tracking-widest">
                SUCCESSFUL
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="mb-12">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Description</th>
                  <th className="py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] w-32">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-8">
                    <p className="font-black text-gray-900 text-lg uppercase tracking-tight">{record.description || 'Subscription Renewal'}</p>
                    <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-widest">Subscription Period Extension</p>
                  </td>
                  <td className="py-8 text-right font-black text-gray-900 text-xl tabular-nums">
                    ₹{record.amount?.toLocaleString('en-IN')}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="flex justify-end mb-12">
            <div className="w-full md:w-80 space-y-3">
              {(() => {
                const isSubscriptionPack = record.description?.toLowerCase().includes('subscription pack');
                const subtotal = Number(record.amount || 0);
                const deliveryCharge = Number(record.delivery_charge || 0);
                const distanceKm = Number(record.distance_km || 0);
                const discountValue = Number(settings?.deliveryCharges || 0);
                const customChargeAmount = Number(record.custom_charge_amount || 0);
                const customChargeName = record.custom_charge_name || 'Extra Charge';

                // For sub packs, standard fee would have been higher
                const standardDelivery = isSubscriptionPack ? (deliveryCharge + discountValue) : deliveryCharge;

                return (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-gray-400 uppercase tracking-widest">Subtotal</span>
                      <span className="font-black text-gray-900">₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span className="font-bold text-gray-400 uppercase tracking-widest">Delivery Fee {distanceKm > 0 ? `(${distanceKm.toFixed(2)}km)` : ''}</span>
                      <span className="font-black text-gray-900">₹{standardDelivery.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {customChargeAmount > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-gray-400 uppercase tracking-widest">{customChargeName}</span>
                        <span className="font-black text-gray-900">₹{customChargeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    {isSubscriptionPack && discountValue > 0 && (
                      <div className="flex justify-between items-center text-sm text-red-500 font-bold italic">
                        <span className="uppercase tracking-widest">Premium Discount</span>
                        <span className="font-black">-₹{discountValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}

                    <div className="h-px bg-gray-100 my-2" />

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-gray-900 uppercase tracking-widest">Total Amount Due</span>
                        <span className="font-black text-gray-900">₹{(subtotal + deliveryCharge + customChargeAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex justify-between items-center text-sm">
                        <span className="font-bold text-green-600 uppercase tracking-widest">Amount Paid</span>
                        <span className="font-black text-green-700">₹{(record.amount_paid !== undefined ? Number(record.amount_paid) : (subtotal + deliveryCharge + customChargeAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>

                      {record.balance && Number(record.balance) > 0 && (
                        <div className="flex justify-between items-center text-sm p-2 bg-red-50 rounded-lg border border-red-100">
                          <span className="font-black text-red-600 uppercase tracking-widest">Balance Due</span>
                          <span className="font-black text-red-700">₹{Number(record.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center bg-gray-900 p-5 rounded-2xl text-white shadow-xl">
                      <span className="text-xs font-black uppercase tracking-[0.2em]">{record.balance && Number(record.balance) > 0 ? 'Total Received' : 'Paid Amount'}</span>
                      <span className="text-2xl font-black tabular-nums">₹{(record.amount_paid !== undefined ? Number(record.amount_paid) : (subtotal + deliveryCharge + customChargeAmount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Footer */}
          <div className="pt-12 border-t border-gray-100 text-center">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-4">Thank you for your business</p>
            <p className="text-[9px] text-gray-400 italic">This is a system generated receipt and does not require a physical signature.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
