import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Truck, Star, CreditCard, DollarSign, CheckCheck, Trash2, X, Clock } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { UserRole, AdminNotification, Page } from '../types';
import { UPLOAD_BASE_URL } from '../services/api';

interface TopBarProps {
    userName?: string;
    userRole: UserRole;
    userLogo?: string;
    onSearch?: (term: string) => void;
    hideMenu?: boolean;
    onLogout?: () => void;
    notifications?: AdminNotification[];
    onMarkAllAsRead?: () => void;
    onClearNotifications?: () => void;
    onNotificationClick?: (notification: AdminNotification) => void;
    onDeleteNotification?: (id: string) => void;
}

export function TopBar({
    userName,
    userRole,
    userLogo,
    onSearch,
    hideMenu,
    onLogout,
    notifications = [],
    onMarkAllAsRead,
    onClearNotifications,
    onNotificationClick,
    onDeleteNotification
}: TopBarProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.read).length;

    const getLogoUrl = (logo?: string) => {
        if (!logo) return null;
        if (logo.startsWith('data:image')) return logo;
        if (logo.startsWith('http')) return logo;
        return `${UPLOAD_BASE_URL}${logo}`;
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Format relative time helper12345
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
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4" />
                    </div>
                );
            case 'review':
                return (
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                        <Star className="w-4 h-4" />
                    </div>
                );
            case 'subscription':
                return (
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4" />
                    </div>
                );
            case 'withdrawal':
                return (
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                        <DollarSign className="w-4 h-4" />
                    </div>
                );
            default:
                return (
                    <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                        <Bell className="w-4 h-4" />
                    </div>
                );
        }
    };

    return (
        <div className="hidden lg:flex bg-white border-b border-gray-100 px-8 py-4 sticky top-0 z-30 items-center justify-end">
            <div className="flex items-center gap-6">

                {/* Notification Bell with Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className={`relative p-2.5 rounded-xl border transition-all duration-200 ${
                            isOpen || unreadCount > 0
                                ? 'bg-green-50 border-green-200 text-green-700 shadow-sm'
                                : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                        title="Notifications"
                        aria-label="Notifications"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-md animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {/* Dropdown Menu */}
                    {isOpen && (
                        <div className="absolute right-0 mt-3 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            {/* Header */}
                            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[11px] font-black">
                                            {unreadCount} new
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {unreadCount > 0 && onMarkAllAsRead && (
                                        <button
                                            onClick={onMarkAllAsRead}
                                            className="text-xs font-semibold text-green-700 hover:text-green-800 flex items-center gap-1 hover:underline transition-colors"
                                            title="Mark all as read"
                                        >
                                            <CheckCheck className="w-3.5 h-3.5" />
                                            <span>Read all</span>
                                        </button>
                                    )}
                                    {notifications.length > 0 && onClearNotifications && (
                                        <button
                                            onClick={onClearNotifications}
                                            className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-gray-100 transition-colors"
                                            title="Clear all"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Desktop Notification Alert Banner */}
                            {"Notification" in window && Notification.permission === "default" && (
                                <div className="px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white flex items-center justify-between gap-2 text-xs">
                                    <span className="font-medium">🔔 Enable desktop push alerts?</span>
                                    <button
                                        onClick={async () => {
                                            if ("Notification" in window) {
                                                await Notification.requestPermission();
                                            }
                                        }}
                                        className="px-2.5 py-1 bg-white text-green-700 rounded-lg font-bold text-[11px] shadow-sm hover:bg-green-50 active:scale-95 transition-all"
                                    >
                                        Enable
                                    </button>
                                </div>
                            )}

                            {/* Notifications List */}
                            <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50 custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto mb-3">
                                            <Bell className="w-6 h-6" />
                                        </div>
                                        <p className="text-sm font-semibold text-gray-800">All caught up!</p>
                                        <p className="text-xs text-gray-400 mt-1">No new notifications at this moment.</p>
                                    </div>
                                ) : (
                                    notifications.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => {
                                                if (onNotificationClick) {
                                                    onNotificationClick(item);
                                                }
                                                setIsOpen(false);
                                            }}
                                            className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer hover:bg-gray-50/80 group ${
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
                                                        <span className="w-2 h-2 rounded-full bg-green-600 shrink-0" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 line-clamp-2 mt-0.5 leading-relaxed">
                                                    {item.description}
                                                </p>
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1.5 font-medium">
                                                    <Clock className="w-3 h-3" />
                                                    <span>{formatTimeAgo(item.timestamp)}</span>
                                                </div>
                                            </div>
                                            {/* Dismiss (X) button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (onDeleteNotification) {
                                                        onDeleteNotification(item.id);
                                                    }
                                                }}
                                                className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0 mt-0.5"
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

                {/* User Profile */}
                <div className="flex items-center gap-3 pl-2 border-l border-gray-100">
                    <div className="w-10 h-10 bg-green-100 text-green-700 font-bold rounded-full flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                        {userLogo ? (
                            <img
                                src={getLogoUrl(userLogo) || undefined}
                                alt={userName}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).src = logoImg; }}
                            />
                        ) : (
                            <span className="text-xs">{(userName || 'Admin').split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2)}</span>
                        )}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">{userName || 'Admin'}</p>
                        <div className="flex items-center gap-2 justify-end">
                            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
                                {userRole === 'admin' ? 'Business Owner' : 'Staff Member'}
                            </p>
                            {hideMenu && onLogout && (
                                <button
                                    onClick={onLogout}
                                    className="text-[10px] text-red-600 font-bold uppercase tracking-wider hover:underline"
                                >
                                    Log Out
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
