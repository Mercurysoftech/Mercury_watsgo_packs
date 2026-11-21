import React, { useState, useEffect } from 'react';
import { User, Phone, Trash2, UserPlus, Search, Loader2, CheckCircle, Edit2, Eye, XCircle, Truck, Package, ArrowRight, Users, MapPin, ChevronLeft, ChevronRight, Star, MessageSquare, Calendar, Filter, Clock, Award, Layers, Download, Printer } from 'lucide-react';
import { Customer, DeliveryUser, Review } from '../types';
import api, { deliveryUserAPI, customerAPI, attendanceAPI, reviewAPI } from '../services/api';
import { toast } from 'sonner';

interface DeliveryUserManagementProps {
  isSubscriptionActive?: boolean;
}

export function DeliveryUserManagement({ isSubscriptionActive = true }: DeliveryUserManagementProps) {
  const [deliveryUsers, setDeliveryUsers] = useState<DeliveryUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form state
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Edit state
  const [editingUser, setEditingUser] = useState<DeliveryUser | null>(null);

  // View state
  const [viewingUser, setViewingUser] = useState<DeliveryUser | null>(null);
  const [assignedCustomers, setAssignedCustomers] = useState<Customer[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Assign customers state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningTo, setAssigningTo] = useState<DeliveryUser | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [selectedToAssign, setSelectedToAssign] = useState<string[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  useEffect(() => {
    fetchDeliveryUsers();
  }, []);

  const fetchDeliveryUsers = async () => {
    try {
      setLoading(true);
      const res = await deliveryUserAPI.getAll();
      if (res.data.success) {
        setDeliveryUsers(res.data.delivery_users || []);
      }
    } catch (error) {
      console.error('Failed to fetch delivery users:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateDeliveryForm = () => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = 'Full name is required';
    else if (name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';
    if (!mobile.trim()) newErrors.mobile = 'Mobile number is required';
    else {
      // Strip spaces, dashes, and leading + or country code to get pure digits
      const digitsOnly = mobile.trim().replace(/[\s\-]/g, '').replace(/^\+91/, '').replace(/^91/, '');
      if (!/^\d{10}$/.test(digitsOnly)) {
        newErrors.mobile = 'Enter a valid 10-digit mobile number';
      }
    }
    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');
    if (!validateDeliveryForm()) return;

    try {
      setAdding(true);
      if (editingUser) {
        const res = await deliveryUserAPI.update(editingUser.id, { name, mobile, address });
        if (res.data.success) {
          setSuccessMsg('Delivery man updated successfully!');
          resetForm();
          fetchDeliveryUsers();
        }
      } else {
        const res = await deliveryUserAPI.create({ name, mobile, address });
        if (res.data.success) {
          setSuccessMsg('Delivery man added successfully!');
          resetForm();
          fetchDeliveryUsers();
        }
      }
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error: any) {
      setFormError(error.response?.data?.error || 'Failed to process request');
    } finally {
      setAdding(false);
    }
  };

  const resetForm = () => {
    setName('');
    setMobile('');
    setAddress('');
    setFieldErrors({});
    setFormError('');
    setEditingUser(null);
    setShowAddModal(false);
  };

  const handleEdit = (user: DeliveryUser) => {
    setEditingUser(user);
    setName(user.name);
    setMobile(user.mobile);
    setAddress(user.address || '');
    setShowAddModal(true);
  };

  const handleView = async (user: DeliveryUser) => {
    setViewingUser(user);
    setLoadingAssigned(true);
    try {
      const res = await deliveryUserAPI.getAssignedCustomers(user.id);
      if (res.data.success) {
        setAssignedCustomers(res.data.customers || []);
      }
    } catch (error) {
      console.error('Failed to fetch assigned customers');
    } finally {
      setLoadingAssigned(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete delivery man ${name}?`)) return;

    try {
      const res = await deliveryUserAPI.delete(id);
      if (res.data.success) {
        fetchDeliveryUsers();
      }
    } catch (error) {
      console.error('Failed to delete delivery man:', error);
      alert('Failed to delete delivery man');
    }
  };

  const filteredUsers = (deliveryUsers || []).filter(user =>
    (user.name || '').toLowerCase().includes((searchTerm || '').toLowerCase()) ||
    (user.mobile || '').includes(searchTerm || '')
  );

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleOpenAssignModal = async (user: DeliveryUser) => {
    setAssigningTo(user);
    setSelectedToAssign([]);
    setShowAssignModal(true);
    try {
      const res = await customerAPI.getAll();
      if (res.data.success) {
        const customers = res.data.customers || [];
        setAllCustomers(customers);

        // Find areas where all customers are assigned to this delivery man
        const areas = Array.from(new Set(customers.map((c: Customer) => c.area).filter(Boolean)));
        const alreadyAssignedAreas = areas.filter(area => {
          const areaCustomers = customers.filter((c: Customer) => c.area === area);
          return areaCustomers.every((c: Customer) => String(c.deliveryUserId) === String(user.id));
        }) as string[];

        setSelectedToAssign(alreadyAssignedAreas);
      }
    } catch (e) {
      console.error('Failed to fetch customers', e);
    }
  };

  const handleAssignAreas = async () => {
    if (!assigningTo || selectedToAssign.length === 0) return;
    setAssignLoading(true);
    try {
      const res = await customerAPI.bulkAssignByArea({ areas: selectedToAssign, deliveryUserId: assigningTo.id });
      if (res.data.success) {
        setSuccessMsg(`Assigned ${res.data.affectedRows} customer(s) across ${selectedToAssign.length} area(s) to ${assigningTo.name}`);
        setShowAssignModal(false);
        fetchDeliveryUsers(); // Refresh counts
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (e: any) {
      setFormError(e.response?.data?.error || 'Failed to assign areas');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassignArea = async (area: string) => {
    if (!window.confirm(`Are you sure you want to remove all customers in "${area}" from this delivery man?`)) return;
    try {
      // ONLY target customers currently assigned to THIS delivery man in this area
      const areaCustomers = allCustomers.filter(c => {
        const isSameArea = (c.area || '').trim().toLowerCase() === (area || '').trim().toLowerCase();
        const deliveredById = String((c as any).delivery_user_id || c.deliveryUserId || (c as any).deliveryUserId || '');
        const isAssignedToThisUser = assigningTo && deliveredById === String(assigningTo.id);
        return isSameArea && isAssignedToThisUser;
      }).map(c => c.id);

      if (areaCustomers.length === 0) {
        alert('No customers assigned to this delivery man in this area');
        return;
      }

      const res = await customerAPI.bulkUnassignDeliveryUser({ customerIds: areaCustomers });
      if (res.data.success) {
        setSuccessMsg(`Area "${area}" unassigned successfully`);
        // Refresh customer list for modal
        const resAll = await customerAPI.getAll();
        if (resAll.data.success) {
          setAllCustomers(resAll.data.customers || []);
          setSelectedToAssign(prev => prev.filter(a => a !== area));
        }
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (e: any) {
      setFormError(e.response?.data?.error || 'Failed to unassign area');
    }
  };

  const handleUnassignSingle = async (customerId: string) => {
    if (!window.confirm('Are you sure you want to remove this delivery man from this customer?')) return;
    try {
      const res = await customerAPI.bulkUnassignDeliveryUser({ customerIds: [customerId] });
      if (res.data.success) {
        setSuccessMsg('Assignment removed successfully');
        // Refresh customer list for modal
        if (assigningTo) {
          const resAll = await customerAPI.getAll();
          if (resAll.data.success) {
            const customers = resAll.data.customers || [];
            const availableCustomers = customers.filter((c: Customer) => !c.deliveryUserId || String(c.deliveryUserId) === String(assigningTo.id));
            setAllCustomers(availableCustomers);
          }
        }
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (e: any) {
      setFormError(e.response?.data?.error || 'Failed to unassign customer');
    }
  };

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Delivery Management</h1>
            <p className="text-gray-500 mt-1">Manage and assign your delivery personnel</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200"
          >
            <UserPlus className="w-5 h-5" />
            <span>Add Delivery Partner</span>
          </button>
        </div>

        {/* Search & Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 p-2 shadow-sm flex items-center gap-3">
            <div className="pl-3">
              <Search className="w-5 h-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name or mobile..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 py-2 bg-transparent outline-none text-gray-700 font-medium"
            />
          </div>
          <div className="bg-gray-900 rounded-2xl p-4 text-white flex items-center justify-between px-6 shadow-xl">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-gray-400" />
              <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">TOTAL PERSONNEL</span>
            </div>
            <span className="text-2xl font-bold">{deliveryUsers.length}</span>
          </div>
        </div>

        {/* Table View */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[400px]">
          <div className="overflow-x-auto">
            <table className="hidden md:table w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Delivery Person</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contact Info</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Location</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-20 text-center">
                      <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-4" />
                      <p className="text-gray-500 font-medium">Loading personnel data...</p>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-24 text-center">
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-400 font-medium">{searchTerm ? 'No matches found' : 'Start by adding a delivery person'}</p>
                    </td>
                  </tr>
                ) : (
                  currentUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div 
                          className="flex items-center gap-4 cursor-pointer hover:opacity-85" 
                          onClick={() => handleView(user)}
                        >
                          <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center font-bold shadow-sm">
                            {(user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 group-hover:text-green-600 transition-colors uppercase tracking-tight">{user.name || 'Unknown'}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">ID: #{String(user.id || '').slice(-4)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                          <Phone className="w-3.5 h-3.5 text-gray-400" />
                          {user.mobile}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-500 max-w-[200px] truncate">{user.address || '—'}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenAssignModal(user)}
                            className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-all"
                            title="Assign Areas"
                          >
                            <MapPin className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleView(user)}
                            className="p-2 text-green-500 hover:bg-green-100 rounded-lg transition-all"
                            title="View Assignments"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.name)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-gray-100 bg-white">
              {loading ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-10 h-10 text-green-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">Loading personnel data...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-8 h-8 text-gray-300" />
                  </div>
                  <p className="text-gray-400 font-medium">{searchTerm ? 'No matches found' : 'Start by adding a delivery person'}</p>
                </div>
              ) : (
                currentUsers.map((user) => (
                  <div key={user.id} className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-3 cursor-pointer hover:opacity-85" 
                        onClick={() => handleView(user)}
                      >
                        <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center font-bold shadow-sm">
                          {(user.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 uppercase tracking-tight">{user.name || 'Unknown'}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">ID: #{String(user.id || '').slice(-4)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2.5 pl-1">
                      <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{user.mobile}</span>
                      </div>
                      {user.address && (
                        <div className="flex items-start gap-2 text-xs text-gray-500">
                          <MapPin className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2">{user.address}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-50 gap-2">
                      <button
                        onClick={() => handleOpenAssignModal(user)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-all font-bold border border-green-100"
                      >
                        <MapPin className="w-4 h-4" />
                        Assign
                      </button>
                      <button
                        onClick={() => handleView(user)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs bg-green-50 text-green-600 hover:bg-green-100 rounded-lg transition-all font-bold border border-green-100"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all border border-gray-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id, user.name)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all border border-red-100 bg-red-50/50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <div className="text-sm text-gray-500 font-medium">
                Showing <span className="text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-gray-900">{Math.min(currentPage * itemsPerPage, filteredUsers.length)}</span> of <span className="text-gray-900">{filteredUsers.length}</span> results
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="flex gap-1 items-center">
                  {(() => {
                    if (totalPages <= 7) {
                      return Array.from({ length: totalPages }, (_, i) => i + 1).map(num => (
                        <button
                          key={num}
                          onClick={() => setCurrentPage(num)}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${currentPage === num ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                        >
                          {num}
                        </button>
                      ));
                    }
                    const left = Math.max(2, currentPage - 1);
                    const right = Math.min(totalPages - 1, currentPage + 1);
                    const items: (number | string)[] = [1];
                    if (left > 2) items.push('...');
                    for (let i = left; i <= right; i++) items.push(i);
                    if (right < totalPages - 1) items.push('...');
                    items.push(totalPages);

                    return items.map((item, idx) => {
                      if (item === '...') {
                        return <span key={`dots-${idx}`} className="w-8 text-center text-gray-400 font-bold">•••</span>;
                      }
                      const num = Number(item);
                      return (
                        <button
                          key={num}
                          onClick={() => setCurrentPage(num)}
                          className={`min-w-[40px] h-10 px-2 rounded-xl text-sm font-bold transition-all ${currentPage === num ? 'bg-green-600 text-white shadow-md shadow-green-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                        >
                          {num}
                        </button>
                      );
                    });
                  })()}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all active:scale-95"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${editingUser ? 'bg-green-100' : 'bg-green-100'} rounded-2xl flex items-center justify-center`}>
                  {editingUser ? <Edit2 className="w-6 h-6 text-green-600" /> : <UserPlus className="w-6 h-6 text-green-600" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{editingUser ? 'Edit Details' : 'Add Personnel'}</h2>
                  <p className="text-sm text-gray-500">{editingUser ? 'Update personnel info' : 'Register new personnel'}</p>
                </div>
              </div>
              <button onClick={resetForm} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleAddOrUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wider text-[10px]">Full Name</label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${fieldErrors.name ? 'text-red-400' : 'text-gray-400'}`} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter full name"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white outline-none transition-all font-medium"
                  />
                </div>
                {fieldErrors.name && <p className="text-red-500 text-xs mt-1 font-medium">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wider text-[10px]">Mobile Number</label>
                <div className="relative">
                  <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${fieldErrors.mobile ? 'text-red-400' : 'text-gray-400'}`} />
                  <input
                    type="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Enter mobile number"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white outline-none transition-all font-medium"
                  />
                </div>
                {fieldErrors.mobile && <p className="text-red-500 text-xs mt-1 font-medium">{fieldErrors.mobile}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 uppercase tracking-wider text-[10px]">Address</label>
                <div className="relative">
                  <div className="absolute left-3 top-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                  </div>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter address"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:bg-white outline-none transition-all font-medium min-h-[100px]"
                  />
                </div>
              </div>

              {formError && <p className="text-red-500 text-sm text-center font-bold bg-red-50 py-2 rounded-lg">{formError}</p>}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={resetForm} className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-all">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding}
                  className={`flex-1 py-3 ${editingUser ? 'bg-green-600 hover:bg-green-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-all`}
                >
                  {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingUser ? 'Update' : 'Confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Assigned Customers Modal */}
      {viewingUser && (
        <AssignedCustomersModal
          user={viewingUser}
          customers={assignedCustomers}
          loading={loadingAssigned}
          onClose={() => setViewingUser(null)}
        />
      )}

      {/* Assign Customers Modal */}
      {showAssignModal && assigningTo && (
        <AssignCustomersModal
          user={assigningTo}
          allCustomers={allCustomers}
          selected={selectedToAssign}
          onToggle={(area) => setSelectedToAssign(prev =>
            prev.includes(area) ? prev.filter(x => x !== area) : [...prev, area]
          )}
          onSelectAll={() => {
            const areas = Array.from(new Set(allCustomers.map(c => c.area).filter(Boolean))) as string[];
            setSelectedToAssign(areas);
          }}
          onClearAll={() => setSelectedToAssign([])}
          onAssign={handleAssignAreas}
          onUnassignArea={handleUnassignArea}
          onClose={() => setShowAssignModal(false)}
          isLoading={assignLoading}
        />
      )}
    </>
  );
}

function AssignedCustomersModal({ user, customers, loading, onClose }: {
  user: DeliveryUser;
  customers: Customer[];
  loading: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'deliveries' | 'reviews' | 'customers'>('deliveries');

  // Date-wise deliveries state
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedPack, setSelectedPack] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedMeal, setSelectedMeal] = useState('');
  const [exportingPDF, setExportingPDF] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);


  const handleExportPDF = async () => {
    if (selectedRowKeys.length === 0) {
      toast.error('Please select at least one delivery item to export');
      return;
    }
    setExportingPDF(true);
    try {
      const keysParam = selectedRowKeys.join(',');
      const response = await api.get(`/delivery-user/${user.id}/export-pdf?date=${selectedDate}&meal=${selectedMeal || 'all'}&selectedKeys=${keysParam}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const mealSuffix = selectedMeal && selectedMeal !== 'all' ? `_${selectedMeal}` : '';
      link.setAttribute('download', `DeliverySheet_${user.name}_${selectedDate}${mealSuffix}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded successfully');
    } catch (err) {
      console.error('Failed to export delivery PDF:', err);
      toast.error('Failed to export delivery list PDF');
    } finally {
      setExportingPDF(false);
    }
  };

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Fetch reviews on mount
  useEffect(() => {
    const fetchReviews = async () => {
      setLoadingReviews(true);
      try {
        const res = await reviewAPI.getAll('delivery');
        if (res.data.success) {
          // Filter reviews belonging to this delivery user
          const filtered = (res.data.data || []).filter(
            (r: any) => String(r.delivery_user_id) === String(user.id)
          );
          setReviews(filtered);
        }
      } catch (err) {
        console.error('Failed to fetch delivery reviews:', err);
      } finally {
        setLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [user.id]);

  // Fetch attendance on date change
  useEffect(() => {
    const fetchAttendance = async () => {
      setLoadingAttendance(true);
      try {
        const res = await attendanceAPI.getAll(selectedDate);
        if (res.data.success) {
          setAttendanceRecords(res.data.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch attendance for date:', err);
      } finally {
        setLoadingAttendance(false);
      }
    };
    fetchAttendance();
  }, [selectedDate]);

  // Unique lists for dropdown filters from customer data
  const zones = Array.from(new Set(customers.map(c => c.zone || c.area).filter(Boolean))).sort() as string[];

  const packsList = Array.from(
    new Set(
      customers.flatMap(c => c.packs || []).map(p => p.name).filter(Boolean)
    )
  ).sort() as string[];

  const categories = Array.from(
    new Set(
      customers.flatMap(c => c.packs || []).map(p => (p as any).categoryName).filter(Boolean)
    )
  ).sort() as string[];

  // Helper to query attendance status
  const getPackAttendance = (customerId: string, packId: number, mealType?: string) => {
    return attendanceRecords.filter(r =>
      String(r.customer_id) === String(customerId) &&
      (Number(r.pack_id) === Number(packId) || (Number(r.pack_id) === 0 && Number(packId) === 0)) &&
      (!mealType || String(r.meal_type).toLowerCase() === String(mealType).toLowerCase())
    );
  };

  // Filter flattened packs list — only pack-renewed customers
  const flattenedPacks = customers
    .filter(c => c.status === 'renewed')
    .flatMap(c => {
    const packsArray = c.packs && c.packs.length > 0 ? c.packs : [{
      customerPackId: 0,
      name: c.packName || 'Primary Pack',
      status: c.status,
      renewalDate: c.renewalDate,
      categoryName: (c as any).category_name || (c as any).categoryName || '',
      packType: c.packType || 'fruits',
      mealSlots: (c as any).mealSlots || (c as any).meal_slots || ''
    }];

    return packsArray.map(pack => ({
      customer: c,
      pack: {
        id: pack.customerPackId || 0,
        name: pack.name,
        status: pack.status,
        renewalDate: pack.renewalDate || pack.renewal_date,
        categoryName: (pack as any).categoryName || (pack as any).category_name || (c as any).category_name || (c as any).categoryName || '',
        packType: pack.packType || c.packType || 'fruits',
        mealSlots: (pack as any).mealSlots || (pack as any).meal_slots || (c as any).mealSlots || (c as any).meal_slots || ''
      }
    }));
  });

  // Filter flattened packs list
  const filteredPacks = flattenedPacks.filter(item => {
    const matchesSearch =
      item.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customer.mobile.includes(searchQuery) ||
      (item.customer.area || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesZone = !selectedZone || item.customer.zone === selectedZone || item.customer.area === selectedZone;
    const matchesPack = !selectedPack || item.pack.name === selectedPack;
    const matchesCategory = !selectedCategory || item.pack.categoryName === selectedCategory;

    const matchesMeal = !selectedMeal || selectedMeal === 'all' || (
      item.pack.packType === 'food' &&
      item.pack.mealSlots.toLowerCase().split(',').map((m: string) => m.trim()).includes(selectedMeal.toLowerCase())
    );

    return matchesSearch && matchesZone && matchesPack && matchesCategory && matchesMeal;
  });


  // Summary calculation for selected date
  const summary = filteredPacks.reduce((acc, item) => {
    const isFood = item.pack.packType === 'food';
    if (isFood) {
      const mealSlots = (item.pack.mealSlots || 'Breakfast,Lunch,Dinner')
        .split(',')
        .map(m => m.trim().toLowerCase())
        .filter(Boolean);

      mealSlots.forEach(meal => {
        if (selectedMeal && selectedMeal !== 'all' && meal !== selectedMeal.toLowerCase()) return;

        acc.total += 1;
        const att = getPackAttendance(item.customer.id, item.pack.id, meal);
        if (att.length > 0) {
          const status = att[0].status;
          if (status === 'delivered') acc.delivered += 1;
          else if (status === 'customer_pause' || status === 'service_pause' || status === 'holiday') acc.paused += 1;
        } else {
          acc.pending += 1;
        }
      });
    } else {
      if (!selectedMeal || selectedMeal === 'all') {
        acc.total += 1;
        const att = getPackAttendance(item.customer.id, item.pack.id);
        if (att.length > 0) {
          const status = att[0].status;
          if (status === 'delivered') acc.delivered += 1;
          else if (status === 'customer_pause' || status === 'service_pause' || status === 'holiday') acc.paused += 1;
        } else {
          acc.pending += 1;
        }
      }
    }
    return acc;
  }, { total: 0, delivered: 0, paused: 0, pending: 0 });

  // Reviews calculation
  const averageRating = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  const ratingBreakdown = [5, 4, 3, 2, 1].map(stars => {
    const count = reviews.filter(r => r.rating === stars).length;
    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
    return { stars, count, percentage };
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3 h-3 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
      />
    ));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-green-50 border border-green-200 rounded-2xl flex items-center justify-center font-bold text-xl text-green-600 shadow-sm">
              {(user.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-800 uppercase tracking-tight">{user.name}</h2>
                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">ACTIVE</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                ID: #{String(user.id).slice(-4)} · Mobile: {user.mobile}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="self-end sm:self-auto p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <XCircle className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="border-b border-gray-100 px-6 bg-white shrink-0 flex items-center overflow-x-auto scrollbar-hide flex-nowrap gap-1">
          <button
            onClick={() => setActiveTab('deliveries')}
            className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'deliveries'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Date Deliveries
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'reviews'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Star className="w-4 h-4" />
            Customer Reviews
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[9px] font-bold">
              {reviews.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('customers')}
            className={`px-4 py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'customers'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Assigned Customers
            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[9px] font-bold">
              {customers.filter(c => c.status === 'renewed').length}
            </span>
          </button>
        </div>

        {/* Tab Content Panel */}
        <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50/30">
          {activeTab === 'deliveries' && (
            <div className="p-6 space-y-6">
              {/* Filters Area */}
              <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                  <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Date Input */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Select Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-green-500 focus:bg-white outline-none"
                        />
                      </div>
                    </div>

                    {/* Search Input */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Search Customer</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search name/mobile..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-green-500 focus:bg-white outline-none"
                        />
                      </div>
                    </div>

                    {/* Zone Filter */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Zone / Area</label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <select
                          value={selectedZone}
                          onChange={(e) => setSelectedZone(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-green-500 focus:bg-white outline-none appearance-none cursor-pointer"
                        >
                          <option value="">All Zones</option>
                          {zones.map(z => (
                            <option key={z} value={z}>{z}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Pack Filter */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Pack Name</label>
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <select
                          value={selectedPack}
                          onChange={(e) => setSelectedPack(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-green-500 focus:bg-white outline-none appearance-none cursor-pointer"
                        >
                          <option value="">All Packs</option>
                          {packsList.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Category</label>
                      <div className="relative">
                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-green-500 focus:bg-white outline-none appearance-none cursor-pointer"
                        >
                          <option value="">All Categories</option>
                          {categories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Meal Filter */}
                    <div>
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Select Meal</label>
                      <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <select
                          value={selectedMeal}
                          onChange={(e) => setSelectedMeal(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-green-500 focus:bg-white outline-none appearance-none cursor-pointer"
                        >
                          <option value="">All Meals</option>
                          <option value="breakfast">Breakfast</option>
                          <option value="lunch">Lunch</option>
                          <option value="dinner">Dinner</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Export Button */}
                  <div className="shrink-0 flex items-end w-full lg:w-auto">
                    <button
                      onClick={handleExportPDF}
                      disabled={exportingPDF}
                      className="w-full lg:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-green-100 disabled:opacity-50 h-[34px]"
                    >
                      {exportingPDF ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Export PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Banner */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Deliveries</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{summary.total}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <Package className="w-5 h-5" />
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-green-600 uppercase tracking-wider">Delivered</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">{summary.delivered}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-500">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Paused / Holiday</p>
                    <p className="text-2xl font-bold text-amber-500 mt-1">{summary.paused}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pending</p>
                    <p className="text-2xl font-bold text-gray-500 mt-1">{summary.pending}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Delivery Table */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="px-6 py-4 w-12 text-left">
                          <input
                            type="checkbox"
                            checked={filteredPacks.length > 0 && filteredPacks.every(item => selectedRowKeys.includes(`${item.customer.id}_${item.pack.id}`))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRowKeys(prev => {
                                  const newKeys = filteredPacks.map(item => `${item.customer.id}_${item.pack.id}`);
                                  return Array.from(new Set([...prev, ...newKeys]));
                                });
                              } else {
                                const filteredKeys = filteredPacks.map(item => `${item.customer.id}_${item.pack.id}`);
                                setSelectedRowKeys(prev => prev.filter(k => !filteredKeys.includes(k)));
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                          />
                        </th>
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Zone / Area</th>
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Pack & Category</th>
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Status Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loadingAttendance || loading ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-medium">
                            <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-2" />
                            Loading delivery statuses...
                          </td>
                        </tr>
                      ) : filteredPacks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic font-medium">
                            No matching deliveries found on this date.
                          </td>
                        </tr>
                      ) : (
                        filteredPacks.map((item, idx) => {
                          const isFood = item.pack.packType === 'food';
                          const mealSlots = isFood 
                            ? (item.pack.mealSlots || 'Breakfast,Lunch,Dinner')
                                .split(',')
                                .map(m => m.trim().toLowerCase())
                                .filter(Boolean)
                                .filter(m => !selectedMeal || selectedMeal === 'all' || m === selectedMeal.toLowerCase())
                            : ['none'];

                          return (
                            <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4 w-12">
                                <input
                                  type="checkbox"
                                  checked={selectedRowKeys.includes(`${item.customer.id}_${item.pack.id}`)}
                                  onChange={(e) => {
                                    const key = `${item.customer.id}_${item.pack.id}`;
                                    if (e.target.checked) {
                                      setSelectedRowKeys(prev => [...prev, key]);
                                    } else {
                                      setSelectedRowKeys(prev => prev.filter(k => k !== key));
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                />
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-bold text-gray-900 text-sm">{item.customer.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{item.customer.mobile}</p>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                                  <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                  <span>{item.customer.zone || item.customer.area || '—'}</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <p className="font-semibold text-gray-700 text-xs">{item.pack.name}</p>
                                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">{item.pack.categoryName || 'No Category'}</p>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  isFood ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                                }`}>
                                  {item.pack.packType || 'fruits'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex flex-col items-end gap-1.5">
                                  {mealSlots.map((meal) => {
                                    const att = getPackAttendance(item.customer.id, item.pack.id, isFood ? meal : undefined);
                                    const record = att[0];
                                    const status = record?.status;

                                    let badgeColor = 'bg-gray-100 text-gray-500 border-gray-200';
                                    let statusLabel = 'Pending';
                                    if (status === 'delivered') {
                                      badgeColor = 'bg-green-50 text-green-700 border-green-200';
                                      statusLabel = 'Delivered';
                                    } else if (status === 'customer_pause' || status === 'service_pause') {
                                      badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
                                      statusLabel = 'Paused';
                                    } else if (status === 'holiday') {
                                      badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                                      statusLabel = 'Holiday';
                                    }

                                    const deliveryTime = record?.updated_at 
                                      ? new Date(record.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
                                      : '';

                                    return (
                                      <div key={meal} className="flex items-center gap-2">
                                        {isFood && (
                                          <span className="text-[10px] font-bold text-gray-400 uppercase">{meal}:</span>
                                        )}
                                        <div className="flex flex-col items-end">
                                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${badgeColor}`}>
                                            {statusLabel}
                                          </span>
                                          {status === 'delivered' && deliveryTime && (
                                            <span className="text-[9px] font-bold text-green-600 mt-0.5">{deliveryTime}</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Summary Stats */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center justify-center space-y-6 text-center">
                <div>
                  <Award className="w-12 h-12 text-amber-500 mx-auto fill-amber-100" />
                  <h3 className="text-xl font-bold text-gray-800 mt-3">Rating Summary</h3>
                  <p className="text-xs text-gray-500 mt-1">Based on {reviews.length} customer feedback</p>
                </div>
                <div>
                  <p className="text-4xl font-extrabold text-gray-900">{averageRating}</p>
                  <div className="flex justify-center gap-0.5 mt-2">
                    {renderStars(Number(averageRating))}
                  </div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2">OUT OF 5.0 STARS</p>
                </div>

                {/* Rating Breakdown Bar Chart */}
                <div className="w-full space-y-2 pt-4 border-t border-gray-100 text-left">
                  {ratingBreakdown.map((row) => (
                    <div key={row.stars} className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-semibold w-3 shrink-0">{row.stars}</span>
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                      <div className="flex-1 bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-400 h-full rounded-full"
                          style={{ width: `${row.percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-400 font-medium w-6 text-right shrink-0">{row.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: Reviews Log */}
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Customer Feedback Log</h3>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {loadingReviews ? (
                    <div className="py-12 text-center text-gray-500 font-medium">
                      <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-2" />
                      Loading reviews...
                    </div>
                  ) : reviews.length === 0 ? (
                    <div className="py-16 text-center border-2 border-dashed border-gray-100 rounded-3xl bg-white">
                      <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400 font-medium">No reviews left for this delivery boy yet</p>
                    </div>
                  ) : (
                    reviews.map((rev) => (
                      <div key={rev.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:border-green-200 transition-colors">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-50 text-green-600 font-bold text-xs flex items-center justify-center">
                              {rev.customer_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-gray-800 text-sm">{rev.customer_name}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{rev.customer_mobile}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex justify-end gap-0.5">
                              {renderStars(rev.rating)}
                            </div>
                            <p className="text-[10px] text-gray-400 font-semibold mt-1">
                              {new Date(rev.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 italic mt-3 bg-gray-50/50 p-3 rounded-xl border border-gray-50/80 leading-relaxed">
                          "{rev.feedback}"
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'customers' && (
            <div className="p-6">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100">
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Customer Details</th>
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Location / Zone</th>
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Primary Pack</th>
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Category</th>
                        <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium">
                            <Loader2 className="w-8 h-8 text-green-500 animate-spin mx-auto mb-2" />
                            Loading assigned customers...
                          </td>
                        </tr>
                      ) : customers.filter(c => c.status === 'renewed').length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-16 text-center border-2 border-dashed border-gray-100 rounded-3xl bg-white">
                            <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                            <p className="text-gray-400 font-medium">No active (renewed) customers assigned</p>
                          </td>
                        </tr>
                      ) : (
                        customers
                          .filter(c => c.status === 'renewed')
                          .map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{c.mobile}</p>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-600 font-medium">
                                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span>{c.zone || c.area || '—'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-gray-700 text-xs">{c.packName || 'Primary Pack'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs text-gray-500 font-medium">{(c as any).category_name || (c as any).categoryName || 'No Category'}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                c.status === 'renewed'
                                  ? 'bg-green-50 text-green-700 border-green-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}>
                                {c.status === 'renewed' ? 'Active' : 'Expired'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all shadow-md shadow-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AssignCustomersModal({ user, allCustomers, selected, onToggle, onSelectAll, onClearAll, onAssign, onUnassignArea, onClose, isLoading }: {
  user: DeliveryUser;
  allCustomers: Customer[];
  selected: string[];
  onToggle: (area: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onAssign: () => void;
  onUnassignArea: (area: string) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [search, setSearch] = useState('');

  // Group customers by area
  const areaGroups = allCustomers.reduce((acc: Record<string, { customers: Customer[], count: number, assignedCount: number, assignedToOthersCount: number, zones: Set<string> }>, curr) => {
    if (!curr.area) return acc;
    const cleanArea = curr.area.trim();
    if (!acc[cleanArea]) {
      acc[cleanArea] = { customers: [], count: 0, assignedCount: 0, assignedToOthersCount: 0, zones: new Set<string>() };
    }
    acc[cleanArea].customers.push(curr);
    acc[cleanArea].count += 1;
    if (curr.zone && curr.zone.trim()) {
      acc[cleanArea].zones.add(curr.zone.trim());
    }
    // Robust detection of both camelCase and snake_case versions of the delivery user ID
    const deliveredById = String((curr as any).delivery_user_id || curr.deliveryUserId || (curr as any).deliveryUserId || '');
    if (deliveredById) {
      if (deliveredById === String(user.id)) {
        acc[cleanArea].assignedCount += 1;
      } else {
        acc[cleanArea].assignedToOthersCount += 1;
      }
    }
    return acc;
  }, {});

  const areas = Object.keys(areaGroups).sort();
  // Filter out areas that are already assigned (partially or fully) to OTHER delivery men
  const filteredAreas = areas.filter(a => {
    const group = areaGroups[a];
    const zoneStr = group ? Array.from(group.zones).join(' ').toLowerCase() : '';
    const q = (search || '').toLowerCase();
    return ((a || '').toLowerCase().includes(q) || zoneStr.includes(q)) &&
      group.assignedToOthersCount === 0;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Assign Areas</h2>
              <p className="text-sm text-gray-500">Assign to <strong>{user.name}</strong> · {selected.length} area(s) selected</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
            <XCircle className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Search + Select All/Clear */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search areas or zones…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
            />
          </div>
          <button onClick={onSelectAll} className="text-xs px-3 py-2 bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-all whitespace-nowrap">
            Select All
          </button>
          <button onClick={onClearAll} className="text-xs px-3 py-2 bg-gray-100 text-gray-600 rounded-lg font-medium hover:bg-gray-200 transition-all whitespace-nowrap">
            Clear
          </button>
        </div>

        {/* Area List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredAreas.length === 0 ? (
            <div className="py-12 text-center">
              <MapPin className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No areas found</p>
            </div>
          ) : filteredAreas.map(areaName => {
            const group = areaGroups[areaName];
            const isSelected = selected.includes(areaName);
            const assignedCount = group.assignedCount;
            const totalCount = group.count;

            return (
              <div
                key={areaName}
                className={`flex items-center gap-4 p-4 rounded-2xl transition-all border ${isSelected ? 'bg-green-50 border-green-200 shadow-sm' : 'border-gray-100 hover:bg-gray-50'}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(areaName)}
                  className="w-4 h-4 accent-green-600 cursor-pointer"
                />
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${assignedCount > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <p className="font-semibold text-gray-800 text-sm truncate uppercase tracking-tight">{areaName}</p>
                    {group.zones && group.zones.size > 0 && (
                      <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-lg border border-green-200/60 shrink-0">
                        ({Array.from(group.zones).join(', ')})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    {assignedCount > 0 ? (
                      <span className="text-green-600 font-medium">{assignedCount} assigned</span>
                    ) : (
                      <span>Not assigned</span>
                    )}
                    {" · "}{totalCount} total
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {assignedCount > 0 && (
                    <button
                      onClick={(e) => { e.preventDefault(); onUnassignArea(areaName); }}
                      className="text-[10px] bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 transition-all border border-red-100"
                    >
                      REMOVE
                    </button>
                  )}
                  {assignedCount > 0 && assignedCount < totalCount && (
                    <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-1 rounded-lg font-bold border border-orange-100">
                      PARTIAL
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500">{selected.length} customer(s) will be assigned to <strong>{user.name}</strong></p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-100 transition-all">
              Cancel
            </button>
            <button
              onClick={onAssign}
              disabled={isLoading || selected.length === 0}
              className="px-6 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
              Assign {selected.length > 0 ? `(${selected.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
