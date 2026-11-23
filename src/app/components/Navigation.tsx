import React, { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, Users, LogOut, Menu, X, Settings, User as UserIcon, UserCog, BarChart2, CreditCard, Clock, Layers, ClipboardList, Star, Bell, Truck, DollarSign, CheckCheck, Trash2 } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { Page, UserRole, AdminNotification } from '../types';
import { UPLOAD_BASE_URL } from '../services/api';

interface NavigationProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
  userName?: string;
  userLogo?: string;
  subscription?: {
    status: string;
    expiry: string | null;
    daysRemaining: number;
  } | null;
  permissions?: string[];
  notifications?: AdminNotification[];
  onMarkAllAsRead?: () => void;
  onClearNotifications?: () => void;
  onNotificationClick?: (notification: AdminNotification) => void;
  onDeleteNotification?: (id: string) => void;
}

export function Navigation({
  currentPage,
  onNavigate,
  onLogout,
  userRole,
  userName,
  userLogo,
  subscription,
  permissions = [],
  notifications = [],
  onMarkAllAsRead,
  onClearNotifications,
  onNotificationClick,
  onDeleteNotification
}: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const notifDropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isNotifOpen]);

  const formatTimeAgo = (timestampStr: string) => {
    try {
      const date = new Date(timestampStr);
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSeconds < 60) return 'Just now';
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
      if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
      return `${Math.floor(diffSeconds / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  const getNotificationIcon = (type: AdminNotification['type']) => {
    switch (type) {
      case 'delivery':
        return (
          <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
            <Truck className="w-3.5 h-3.5" />
          </div>
        );
      case 'review':
        return (
          <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
            <Star className="w-3.5 h-3.5" />
          </div>
        );
      case 'subscription':
        return (
          <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
        );
      case 'withdrawal':
        return (
          <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        );
      default:
        return (
          <div className="w-7 h-7 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
            <Bell className="w-3.5 h-3.5" />
          </div>
        );
    }
  };

  const allMenuItems = [
    { id: 'dashboard' as Page, label: 'Overview', icon: LayoutDashboard, adminOnly: false },
    { id: 'customers' as Page, label: 'Customers', icon: Users, adminOnly: false },
    { id: 'attendance' as Page, label: 'Daily Entry', icon: ClipboardList, adminOnly: false },
    { id: 'categories' as Page, label: 'Products & Packs', icon: Layers, adminOnly: true },
    { id: 'payment-history' as Page, label: 'Payments', icon: CreditCard, adminOnly: false },
    { id: 'logs' as Page, label: 'Reminder Logs', icon: Clock, adminOnly: false },
    { id: 'reports' as Page, label: 'Analytics', icon: BarChart2, adminOnly: false },
    { id: 'delivery-user' as Page, label: 'Delivery Team', icon: UserIcon, adminOnly: true },
    { id: 'reviews' as Page, label: 'Reviews', icon: Star, adminOnly: true },
    { id: 'users' as Page, label: 'Staff Management', icon: UserCog, adminOnly: true },
    { id: 'settings' as Page, label: 'Settings', icon: Settings, adminOnly: true },
  ];

  // Filter menu items based on role and permissions
  const menuItems = allMenuItems.filter(item => {
    // Admins see everything
    if (userRole === 'admin') return true;

    // Staff see items if they have explicit permission OR if it's the Dashboard (always allowed)
    if (item.id === 'dashboard') return true;

    // Check if item id exists in the user's permissions array
    return permissions && permissions.includes(item.id);
  });

  const handleNavigate = (page: Page) => {
    onNavigate(page);
    setIsMobileMenuOpen(false);
  };

  const getLogoUrl = (logo?: string) => {
    if (!logo) return null;
    if (logo.startsWith('data:image')) return logo;
    if (logo.startsWith('http')) return logo;
    return `${UPLOAD_BASE_URL}${logo}`;
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 z-50">
        <div className="flex items-center justify-between px-4 h-[72px]">
          <div className="flex items-center gap-2.5 bg-green-50/50 border border-green-100 px-2.5 py-1.5 rounded-2xl max-w-[200px] truncate">
            <div className="w-9 h-9 rounded-xl bg-white border border-green-500 flex items-center justify-center overflow-hidden shrink-0">
              {userLogo ? (
                <img
                  src={getLogoUrl(userLogo) || undefined}
                  alt="Logo"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = logoImg; }}
                />
              ) : (
                <UserIcon className="w-4 h-4 text-green-600" />
              )}
            </div>
            <div className="truncate">
              <h2 className="text-sm font-black text-gray-900 leading-tight truncate">{userName || 'User'}</h2>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-[8px] font-black text-green-600 uppercase tracking-widest">
                  {userRole === 'admin' ? 'Admin' : 'Staff'}
                </p>
                <span className="text-[8px] text-gray-300">•</span>
                <p className={`text-[8px] font-black uppercase tracking-widest ${subscription?.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                  {subscription?.status === 'active' ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Notification Bell */}
            <div className="relative" ref={notifDropdownRef}>
              <button
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className={`relative p-2.5 rounded-xl border transition-all ${
                  isNotifOpen || unreadCount > 0
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
                }`}
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-sm animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Mobile Notification Dropdown */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-[310px] sm:w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-gray-900 text-xs">Notifications</h3>
                      {unreadCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-black">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && onMarkAllAsRead && (
                        <button
                          onClick={onMarkAllAsRead}
                          className="text-[11px] font-semibold text-green-700 hover:text-green-800 flex items-center gap-1"
                        >
                          <CheckCheck className="w-3 h-3" />
                          <span>Read all</span>
                        </button>
                      )}
                      {notifications.length > 0 && onClearNotifications && (
                        <button
                          onClick={onClearNotifications}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-gray-400">
                        No notifications
                      </div>
                    ) : (
                      notifications.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (onNotificationClick) onNotificationClick(item);
                            setIsNotifOpen(false);
                          }}
                          className={`p-2.5 flex items-start gap-2.5 cursor-pointer hover:bg-gray-50 group ${
                            !item.read ? 'bg-green-50/30' : ''
                          }`}
                        >
                          {getNotificationIcon(item.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className={`text-xs truncate ${!item.read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                                {item.title}
                              </p>
                              {!item.read && (
                                <span className="w-1.5 h-1.5 rounded-full bg-green-600 shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">
                              {item.description}
                            </p>
                            <span className="text-[9px] text-gray-400 mt-1 block">
                              {formatTimeAgo(item.timestamp)}
                            </span>
                          </div>
                          {/* Dismiss (X) button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDeleteNotification) {
                                onDeleteNotification(item.id);
                              }
                            }}
                            className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                            title="Delete notification"
                            aria-label="Delete notification"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2.5 text-gray-600 bg-gray-50 rounded-xl transition-all active:scale-95 border border-gray-200"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40 mt-[73px] animate-in fade-in duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`lg:hidden fixed top-[73px] left-0 bottom-0 w-[280px] bg-white border-r border-gray-100 transform transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] z-40 flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="p-4 mx-4 my-2 bg-green-50/50 border border-green-100 rounded-2xl flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 rounded-xl bg-white border border-green-500 flex items-center justify-center overflow-hidden shrink-0">
            {userLogo ? (
              <img
                src={getLogoUrl(userLogo) || undefined}
                alt="Logo"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = logoImg; }}
              />
            ) : (
              <UserIcon className="w-6 h-6 text-green-600" />
            )}
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-900 leading-tight">{userName || 'User'}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[9px] font-black text-green-600 uppercase tracking-[0.2em]">
                {userRole === 'admin' ? 'Admin' : 'Staff'}
              </p>
              <span className="text-gray-300">•</span>
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${subscription?.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                {subscription?.status === 'active' ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>
        </div>
        <nav className="p-4 space-y-1.5 overflow-y-auto flex-1 custom-scrollbar">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id ||
              (currentPage === 'edit-customer' && item.id === 'customers') ||
              ((currentPage === 'add-user' || currentPage === 'edit-user') && item.id === 'users');

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all ${isActive
                  ? 'bg-green-600 text-white shadow-lg shadow-green-100 font-bold'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500'}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-sm tracking-tight">{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3.5 px-5 py-3.5 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold"
            >
              <LogOut className="w-5 h-5" strokeWidth={2.5} />
              <span className="text-sm">Log Out</span>
            </button>
          </div>
        </nav>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[280px] bg-white border-r border-gray-100 z-30">
        <div className="pt-6"></div>

        {/* User Card */}
        <div className="mx-6 mb-8 px-4 py-4 bg-green-50/50 border border-green-100 rounded-3xl flex items-center gap-4 group transition-all hover:bg-green-50 hover:border-green-200">
          <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center border border-green-500 shadow-sm overflow-hidden shrink-0 transition-transform group-hover:scale-105">
            {userLogo ? (
              <img
                src={getLogoUrl(userLogo) || undefined}
                alt="Logo"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = logoImg; }}
              />
            ) : (
              <div className="bg-green-50 w-full h-full flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-green-600" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-black text-gray-900 leading-none mb-1.5">{userName || 'User'}</h2>
            <div className="flex items-center gap-2.5">
              <span className="text-[10px] font-black text-green-600 uppercase tracking-[0.2em]">
                {userRole === 'admin' ? 'Admin' : 'Staff'}
              </span>
              <span className="text-gray-200">|</span>
              <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${subscription?.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>
                {subscription?.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 px-6 pb-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          <p className="px-4 text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] mb-4">Main Menu</p>
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = currentPage === item.id ||
              (currentPage === 'edit-customer' && item.id === 'customers') ||
              ((currentPage === 'add-user' || currentPage === 'edit-user') && item.id === 'users');

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.id)}
                className={`w-full group flex items-center gap-3.5 px-5 py-3.5 rounded-2xl transition-all ${isActive
                  ? 'bg-green-600 text-white shadow-xl shadow-green-100 font-bold'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                <div className={`p-1 rounded-lg transition-all ${isActive ? 'bg-white/20' : 'group-hover:bg-green-50'}`}>
                  <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-green-600'}`} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className="text-sm tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout Section */}
        <div className="p-6 border-t border-gray-100 bg-gray-50/30">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3.5 px-5 py-4 text-red-500 hover:bg-red-50 rounded-2xl transition-all font-bold group"
          >
            <div className="p-1 bg-red-50 rounded-lg group-hover:bg-red-100 transition-all">
              <LogOut className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <span className="text-sm">Logout System</span>
          </button>
        </div>
      </div>
    </>
  );
}
