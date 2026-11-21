import React, { useState, useEffect } from 'react';
import { RefreshCw, AlertCircle, CheckCircle, XCircle, CreditCard, User, IndianRupee, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { withdrawalAPI } from '../services/api';
import { toast } from 'sonner';

export interface WithdrawalRequest {
  id: number;
  customer_id: number;
  amount: string;
  upi_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  customer_name: string;
  customer_mobile: string;
}

export function WithdrawalRequests() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 10;

  const fetchRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await withdrawalAPI.getAll();
      if (res.data.success) {
        setRequests(res.data.data);
      } else {
        setError('Failed to load withdrawal requests');
      }
    } catch (err: any) {
      console.error('Error fetching withdrawal requests:', err);
      setError(err.response?.data?.error || 'Failed to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleUpdateStatus = async (id: number, status: 'approved' | 'rejected') => {
    if (!window.confirm(`Are you sure you want to ${status} this request?`)) return;
    
    setProcessingId(id);
    try {
      const res = await withdrawalAPI.updateStatus(id, status);
      if (res.data.success) {
        // Update local state instead of re-fetching to be faster
        setRequests(prev => prev.map(req => req.id === id ? { ...req, status } : req));
      }
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const pastRequests = requests.filter(r => r.status !== 'pending');

  if (loading && requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-10 h-10 text-green-500 animate-spin" />
        <p className="text-gray-500 font-medium">Loading withdrawal requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-800">Withdrawal Requests</h1>
          <p className="text-gray-500 mt-1">Manage and approve customer fund withdrawals</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-green-50 px-4 py-2 rounded-xl flex items-center gap-2 border border-green-100 shadow-sm">
            <Clock className="w-5 h-5 text-green-500" />
            <span className="font-bold text-gray-800">{pendingRequests.length}</span>
            <span className="text-xs text-gray-500 ml-1 font-medium hidden sm:inline">Pending</span>
          </div>
          <button 
            onClick={fetchRequests}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl font-medium hover:bg-green-100 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-center gap-4 text-center shadow-sm">
          <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
          <div className="text-left">
            <h3 className="text-lg font-bold text-red-800">Failed to Load Requests</h3>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Requests Column */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 pb-2 border-b border-gray-200">
            <Clock className="w-5 h-5 text-amber-500" />
            Needs Attention ({pendingRequests.length})
          </h2>
          
          {pendingRequests.length > 0 ? (
            pendingRequests.map(req => (
              <div key={req.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm shadow-amber-100/50 p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4">
                  <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Pending
                  </span>
                </div>
                
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-xl shadow-md flex-shrink-0">
                    {req.customer_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{req.customer_name}</h3>
                    <p className="text-sm font-medium text-gray-500 font-mono">{req.customer_mobile}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3 mb-5">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500 uppercase">Amount Requested</span>
                    <span className="text-xl font-bold text-gray-800 flex items-center gap-1">
                      <IndianRupee className="w-5 h-5" /> 
                      {parseFloat(req.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 border-dashed">
                    <span className="text-xs font-bold text-gray-500 uppercase">UPI ID</span>
                    <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                      {req.upi_id}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 border-dashed">
                    <span className="text-xs font-bold text-gray-500 uppercase">Date</span>
                    <span className="text-xs font-medium text-gray-600">
                      {new Date(req.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    disabled={processingId === req.id}
                    onClick={() => handleUpdateStatus(req.id, 'approved')}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-green-200 disabled:opacity-50"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve
                  </button>
                  <button
                    disabled={processingId === req.id}
                    onClick={() => handleUpdateStatus(req.id, 'rejected')}
                    className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 border border-red-200 disabled:opacity-50"
                  >
                    <XCircle className="w-5 h-5" />
                    Reject
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-gray-50 rounded-2xl border border-gray-200 border-dashed p-10 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-bold text-gray-700">All Caught Up!</h3>
              <p className="text-gray-500 mt-2 text-sm max-w-xs">There are no pending withdrawal requests at the moment.</p>
            </div>
          )}
        </div>

        {/* History Column */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2 pb-2 border-b border-gray-200">
            <CreditCard className="w-5 h-5 text-gray-500" />
            Recent History ({pastRequests.length})
          </h2>

          <div className="space-y-3">
            {pastRequests.length > 0 ? (
              pastRequests.slice((historyPage - 1) * itemsPerPage, historyPage * itemsPerPage).map(req => (
                <div key={req.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
                      req.status === 'approved' ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {req.customer_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">{req.customer_name}</h4>
                      <p className="text-[11px] text-gray-500 font-medium">
                        {new Date(req.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-bold text-gray-800 flex items-center justify-end gap-0.5">
                      <IndianRupee className="w-3.5 h-3.5" /> 
                      {parseFloat(req.amount).toFixed(2)}
                    </p>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full inline-block mt-1 ${
                      req.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
                <p className="text-gray-500 font-medium text-sm">No recent withdrawal history.</p>
              </div>
            )}
            
            {pastRequests.length > itemsPerPage && (
              <div className="flex items-center justify-between py-4 px-2 border-t border-gray-50 mt-2">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-tight">
                  Page {historyPage} of {Math.ceil(pastRequests.length / itemsPerPage)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                    disabled={historyPage === 1}
                    className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <button
                    onClick={() => setHistoryPage(p => Math.min(Math.ceil(pastRequests.length / itemsPerPage), p + 1))}
                    disabled={historyPage === Math.ceil(pastRequests.length / itemsPerPage)}
                    className="p-1.5 bg-gray-50 border border-gray-100 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
