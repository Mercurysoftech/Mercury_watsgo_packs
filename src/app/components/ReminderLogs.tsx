import React, { useState, useEffect } from 'react';
import { reminderAPI } from '../services/api';
import { toast } from 'sonner';
import { Clock, CheckCircle, XCircle, Calendar, RefreshCcw, Search, Filter, Loader2, ChevronLeft, ChevronRight, MessageSquare, Send } from 'lucide-react';

interface ReminderLog {
  id: number;
  customerId: number;
  customerName: string;
  mobile: string;
  sendVia: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  sentAt: string;
  message: string;
}

interface ScheduledReminder {
  id: number;
  customerId: number;
  customerName: string;
  mobile: string;
  scheduledDate: string;
  sendVia: string;
  status: string;
}

export function ReminderLogs() {
  const [history, setHistory] = useState<ReminderLog[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'history' | 'scheduled'>('history');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [historyRes, scheduledRes] = await Promise.all([
        reminderAPI.getAllHistory(),
        reminderAPI.getScheduled()
      ]);
      setHistory(historyRes.data.history || []);
      setScheduled(scheduledRes.data.scheduled || []);
    } catch (error) {
      console.error('Failed to fetch reminder data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(log => 
    log.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.mobile.includes(searchTerm)
  );

  const filteredScheduled = scheduled.filter(rem => 
    rem.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rem.mobile.includes(searchTerm)
  );

  const currentData = activeTab === 'history' ? filteredHistory : filteredScheduled;
  const totalPages = Math.ceil(currentData.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedData = currentData.slice((safeCurrentPage - 1) * itemsPerPage, safeCurrentPage * itemsPerPage);

  const getPaginationRange = (current: number, total: number) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const delta = 1;
    const left = Math.max(2, current - delta);
    const right = Math.min(total - 1, current + delta);
    const range: (number | string)[] = [1];

    if (left > 2) {
      range.push('...');
    }

    for (let i = left; i <= right; i++) {
      range.push(i);
    }

    if (right < total - 1) {
      range.push('...');
    }

    range.push(total);
    return range;
  };

  const formatMessageSnippet = (msg: string) => {
    if (!msg) return '-';
    try {
      const parsed = typeof msg === 'string' ? JSON.parse(msg) : msg;
      if (parsed?.type === 'template' && parsed?.template) {
        const tName = parsed.template.name || 'Template';
        const params: string[] = [];
        if (Array.isArray(parsed.template.components)) {
          parsed.template.components.forEach((c: any) => {
            if (c?.parameters) {
              c.parameters.forEach((p: any) => {
                if (p?.text) params.push(p.text);
              });
            }
          });
        }
        if (params.length > 0) {
          return `Template: ${tName} (${params.join(', ')})`;
        }
        return `Template: ${tName}`;
      }
      if (parsed?.text?.body) return parsed.text.body;
      if (parsed?.message) return parsed.message;
    } catch {
      // not json, return raw
    }
    return msg;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDeleteScheduled = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled reminder?')) return;
    try {
      await reminderAPI.delete(id);
      toast.success('Reminder cancelled successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to cancel reminder');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reminder History & Logs</h1>
          <p className="text-sm text-gray-500 mt-1">Track sent messages and upcoming automated reminders</p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all text-sm font-medium shadow-sm"
        >
          <RefreshCcw className={`w-4 h-4 text-green-600 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100/50 rounded-2xl w-fit border border-gray-100">
        <button
          onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'history' 
            ? 'bg-white text-green-700 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <CheckCircle className="w-4 h-4" />
          Sent History
        </button>
        <button
          onClick={() => { setActiveTab('scheduled'); setCurrentPage(1); }}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'scheduled' 
            ? 'bg-white text-green-700 shadow-sm' 
            : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          Upcoming Scheduled
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by customer name or mobile..."
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-green-500 shadow-sm transition-all"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-green-600" />
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="hidden md:table w-full text-left">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Channel</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    {activeTab === 'history' ? 'Sent At' : 'Scheduled For'}
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                  {activeTab === 'history' && <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Message Snippet</th>}
                  {activeTab === 'scheduled' && <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedData.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{item.customerName}</span>
                        <span className="text-xs text-gray-500">{item.mobile}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {item.sendVia === 'whatsapp' ? (
                          <div className="p-1.5 bg-green-50 text-green-600 rounded-lg">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                            <Send className="w-4 h-4" />
                          </div>
                        )}
                        <span className="capitalize font-medium text-gray-700">{item.sendVia}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                      {formatDate(activeTab === 'history' ? item.sentAt : item.scheduledDate)}
                    </td>
                    <td className="px-6 py-4">
                      {activeTab === 'history' ? (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          item.status === 'success' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                        }`}>
                          {item.status === 'success' ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          {item.status.toUpperCase()}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                          <Clock className="w-3.5 h-3.5" />
                          PENDING
                        </span>
                      )}
                    </td>
                    {activeTab === 'history' && (
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-xs text-gray-600 truncate" title={item.message}>
                          {formatMessageSnippet(item.message)}
                        </p>
                      </td>
                    )}
                    {activeTab === 'scheduled' && (
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteScheduled(item.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          title="Cancel Schedule"
                        >
                          <XCircle className="w-5 h-5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center text-gray-400 font-medium">
                      No reminder records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-gray-100 bg-white">
              {paginatedData.map((item: any) => (
                <div key={item.id} className="p-5 space-y-3.5">
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900 text-sm">{item.customerName}</span>
                      <span className="text-xs text-gray-500 font-medium mt-0.5">{item.mobile}</span>
                    </div>
                    {activeTab === 'history' ? (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        item.status === 'success' 
                        ? 'bg-green-50 text-green-700 border border-green-100' 
                        : 'bg-red-50 text-red-700 border border-red-100'
                      }`}>
                        {item.status === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {item.status.toUpperCase()}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-100">
                        <Clock className="w-3 h-3" />
                        PENDING
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <div className="flex items-center gap-1.5">
                      {item.sendVia === 'whatsapp' ? (
                        <div className="p-1 bg-green-50 text-green-600 rounded">
                          <MessageSquare className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <div className="p-1 bg-blue-50 text-blue-600 rounded">
                          <Send className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <span className="capitalize font-semibold">{item.sendVia}</span>
                    </div>
                    <span className="font-medium text-gray-500">
                      {formatDate(activeTab === 'history' ? item.sentAt : item.scheduledDate)}
                    </span>
                  </div>

                  {activeTab === 'history' && item.message && (
                    <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                      <p className="text-[11px] text-gray-600 line-clamp-2" title={item.message}>
                        {formatMessageSnippet(item.message)}
                      </p>
                    </div>
                  )}

                  {activeTab === 'scheduled' && (
                    <div className="flex justify-end pt-1">
                      <button 
                        onClick={() => handleDeleteScheduled(item.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-all font-bold border border-red-100"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel Schedule
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {paginatedData.length === 0 && (
                <div className="py-12 text-center text-gray-400 font-medium text-sm">
                  No reminder records found.
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {currentData.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between bg-gray-50/30 gap-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 font-medium">
                <span>
                  Showing <span className="font-semibold text-gray-800">{Math.min(currentData.length, (safeCurrentPage - 1) * itemsPerPage + 1)}</span> to <span className="font-semibold text-gray-800">{Math.min(currentData.length, safeCurrentPage * itemsPerPage)}</span> of <span className="font-semibold text-gray-800">{currentData.length}</span> entries
                </span>
                <div className="flex items-center gap-1.5 pl-2 border-l border-gray-200">
                  <span className="text-xs text-gray-400">Rows:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none text-gray-700 font-medium cursor-pointer hover:border-gray-300"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    aria-label="Previous Page"
                    className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                  </button>

                  <div className="flex items-center gap-1">
                    {getPaginationRange(safeCurrentPage, totalPages).map((page, idx) => {
                      if (page === '...') {
                        return (
                          <span
                            key={`dots-${idx}`}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 font-bold select-none text-sm"
                          >
                            •••
                          </span>
                        );
                      }
                      const pageNum = Number(page);
                      const isActive = safeCurrentPage === pageNum;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-w-[36px] h-9 px-2 rounded-xl text-sm font-bold transition-all ${
                            isActive
                              ? 'bg-green-600 text-white shadow-md shadow-green-200'
                              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safeCurrentPage === totalPages}
                    aria-label="Next Page"
                    className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
