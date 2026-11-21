import React, { useState } from 'react';
import { Shield, User, Edit2, Trash2, UserPlus, Search, ChevronLeft, ChevronRight, Key, X, Save } from 'lucide-react';
import { User as UserType, UserRole } from '../types';

interface UserManagementProps {
  users: UserType[];
  onAddUser: () => void;
  onEditUser: (user: UserType) => void;
  onDeleteUser: (userId: string) => void;
  onSavePermissions: (userData: any) => void;
  isSubscriptionActive?: boolean;
  uniqueZones?: string[];
}

const SIDEBAR_PERMISSIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customers', label: 'Customers' },
  { id: 'attendance', label: 'Customer Attendance' },
  { id: 'categories', label: 'Fruit Packs' },
  { id: 'payment-history', label: 'Payment History' },
  { id: 'reports', label: 'Reports & Logs' },
  { id: 'delivery-user', label: 'Delivery Man' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'withdrawals', label: 'Withdrawal Requests' },
  { id: 'users', label: 'Staff Management' },
  { id: 'settings', label: 'Settings' },
];

export function UserManagement({ users, onAddUser, onEditUser, onDeleteUser, onSavePermissions, isSubscriptionActive = true, uniqueZones = [] }: UserManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPermissionsUser, setEditingPermissionsUser] = useState<UserType | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);
  const itemsPerPage = 5;

  const filteredUsers = (users || []).filter(user => {
    const fullName = user.fullName || '';
    const email = user.email || '';
    const matchesSearch = fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const currentUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getRoleBadgeStyle = (role: UserRole) => {
    return role === 'admin'
      ? 'bg-green-100 text-green-700 border-green-200'
      : 'bg-green-100 text-green-700 border-green-200';
  };

  const getRoleIcon = (role: UserRole) => {
    return role === 'admin' ? Shield : User;
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-2">User Management</h1>
        <p className="text-gray-600">Manage user accounts and permissions</p>
      </div>

      {/* Action Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Role Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => { setRoleFilter('all'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${roleFilter === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              All Users
            </button>
            <button
              onClick={() => { setRoleFilter('admin'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${roleFilter === 'admin'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
            >
              Admins
            </button>
            <button
              onClick={() => { setRoleFilter('staff'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${roleFilter === 'staff'
                ? 'bg-green-600 text-white'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
                }`}
            >
              Staff Only
            </button>
          </div>

          {/* Add User Button */}
          <button
            onClick={() => isSubscriptionActive && onAddUser()}
            disabled={!isSubscriptionActive}
            className={`flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25 ${!isSubscriptionActive ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
          >
            <UserPlus className="w-5 h-5" />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Users List */}
      <div className="space-y-4">
        {filteredUsers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">No users found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <>
            {currentUsers.map((user) => {
              const RoleIcon = getRoleIcon(user.role);
              return (
                <div
                  key={user.id}
                  className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* User Avatar & Info */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center ${user.role === 'admin' ? 'bg-green-100' : 'bg-green-100'
                        }`}>
                        <RoleIcon className={`w-6 h-6 md:w-7 md:h-7 ${user.role === 'admin' ? 'text-green-600' : 'text-green-600'
                          }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-800 truncate mb-1">{user.fullName}</h3>
                        <p className="text-sm text-gray-600 truncate mb-2">{user.email}</p>
                        {user.businessName && (
                          <p className="text-xs text-gray-500 truncate">{user.businessName}</p>
                        )}
                        {user.zone && user.role === 'staff' && (
                          <p className="text-xs text-green-600 font-medium mt-0.5">
                            Assigned Zone: {Array.isArray(user.zone) ? user.zone.join(", ") : user.zone}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Role Badge */}
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border font-medium capitalize ${getRoleBadgeStyle(user.role)}`}>
                      <RoleIcon className="w-4 h-4" />
                      {user.role}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {user.role === 'staff' && (
                        <button
                          onClick={() => {
                            setEditingPermissionsUser(user);
                            setSelectedPermissions(user.permissions || []);
                            setSelectedZones(Array.isArray(user.zone) ? user.zone : (user.zone ? [user.zone] : []));
                          }}
                          disabled={!isSubscriptionActive}
                          className={`flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all font-medium ${!isSubscriptionActive ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <Key className="w-4 h-4" />
                          <span className="hidden sm:inline">Permissions</span>
                        </button>
                      )}
                      <button
                        onClick={() => isSubscriptionActive && onEditUser(user)}
                        disabled={!isSubscriptionActive}
                        className={`flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all font-medium ${!isSubscriptionActive ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Edit2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => {
                          if (isSubscriptionActive && window.confirm(`Are you sure you want to delete ${user.fullName}?`)) {
                            onDeleteUser(user.id);
                          }
                        }}
                        disabled={!isSubscriptionActive}
                        className={`flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-medium ${!isSubscriptionActive ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* User Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between py-6 px-4 bg-white rounded-2xl border border-gray-200 shadow-sm mt-4">
                <p className="text-sm font-bold text-gray-400">
                  Page <span className="text-gray-900">{currentPage}</span> of <span className="text-gray-900">{totalPages}</span>
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setCurrentPage((p: number) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-3 bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30 transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="flex gap-1 hidden sm:flex items-center">
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
                    onClick={() => setCurrentPage((p: number) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-3 bg-white border border-gray-200 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30 transition-all active:scale-95"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Summary Card */}
      <div className="mt-6 bg-gradient-to-br from-green-50 to-orange-50 rounded-2xl border border-gray-200 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-800">{users.length}</p>
            <p className="text-sm text-gray-600">Total Users</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{users.filter(u => u.role === 'admin').length}</p>
            <p className="text-sm text-gray-600">Admins</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{users.filter(u => u.role === 'staff').length}</p>
            <p className="text-sm text-gray-600">Staff</p>
          </div>
        </div>
      </div>

      {/* Permissions Modal */}
      {editingPermissionsUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 bg-green-50 border-b border-green-100">
              <div>
                <h2 className="text-xl font-black text-green-900">Manage Permissions</h2>
                <p className="text-sm text-green-700 font-bold">{editingPermissionsUser.fullName}</p>
              </div>
              <button
                onClick={() => setEditingPermissionsUser(null)}
                className="p-2 hover:bg-green-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-green-800" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-xs font-black text-gray-400 upper tracking-widest mb-3">Assigned Zone</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedZones([])}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${selectedZones.length === 0
                      ? 'border-green-500 bg-green-50 text-green-700'
                      : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                      }`}
                  >
                    All Zones
                  </button>
                  {uniqueZones.map((z) => (
                    <button
                      key={z}
                      onClick={() => {
                        setSelectedZones(prev =>
                          prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z]
                        );
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${selectedZones.includes(z)
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                        }`}
                    >
                      {z}
                    </button>
                  ))}
                </div>
              </div>

              <label className="block text-xs font-black text-gray-400 upper tracking-widest mb-4">Select Menu Access</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {SIDEBAR_PERMISSIONS.map((perm) => (
                  <label
                    key={perm.id}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${selectedPermissions.includes(perm.id)
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-50 bg-gray-50 hover:border-gray-200'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(perm.id)}
                      onChange={() => {
                        setSelectedPermissions((prev: string[]) =>
                          prev.includes(perm.id)
                            ? prev.filter((id: string) => id !== perm.id)
                            : [...prev, perm.id]
                        );
                      }}
                      className="hidden"
                    />
                    <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${selectedPermissions.includes(perm.id) ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                      {selectedPermissions.includes(perm.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                    </div>
                    <span className={`text-sm font-bold ${selectedPermissions.includes(perm.id) ? 'text-green-900' : 'text-gray-500'}`}>
                      {perm.label}
                    </span>
                  </label>
                ))}
              </div>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setEditingPermissionsUser(null)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-600 rounded-2xl hover:bg-gray-200 transition-all font-black text-sm uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await onSavePermissions({
                      ...editingPermissionsUser,
                      permissions: selectedPermissions,
                      zone: selectedZones.length > 0 ? selectedZones : null
                    });
                    setEditingPermissionsUser(null);
                  }}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-2xl hover:bg-green-700 shadow-lg shadow-green-200 transition-all font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
