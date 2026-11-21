import React, { useState } from 'react';
import { X, Send, Clock, Calendar, Bell, Loader2, MessageCircle } from 'lucide-react';
import { BusinessSettings } from '../types';

interface BulkReminderModalProps {
    customerCount: number;
    onSend: (options: { via: 'sms' | 'whatsapp', isScheduled: boolean, scheduledDate?: string }) => void;
    onClose: () => void;
    settings?: BusinessSettings;
}

export function BulkReminderModal({ customerCount, onSend, onClose, settings }: BulkReminderModalProps) {
    const [isSending, setIsSending] = useState(false);
    const [showSchedule, setShowSchedule] = useState(false);

    // Use the time saved in Settings → Notifications tab
    const defaultTime = settings?.reminderTime || '09:00';

    // Use reminderDaysBefore to compute a suggested scheduled date
    const getDefaultScheduledDate = () => {
        const today = new Date();
        if (settings?.reminderDaysBefore) {
            const days = settings.reminderDaysBefore.toString().split(',').map(Number).filter(d => !isNaN(d) && d > 0);
            if (days.length > 0) {
                const maxDays = Math.max(...days);
                today.setDate(today.getDate() + maxDays);
            }
        }
        return today.toISOString().split('T')[0];
    };

    const [scheduledDate, setScheduledDate] = useState(getDefaultScheduledDate());
    const [scheduledTime, setScheduledTime] = useState(defaultTime);

    // Human-readable summary of settings
    const daysLabel = (() => {
        if (!settings?.reminderDaysBefore) return null;
        const days = settings.reminderDaysBefore.toString().split(',').filter(d => d !== '');
        if (days.length === 0) return null;
        return days.map(d => d === '0' ? 'Renewal Day' : `${d} day${Number(d) > 1 ? 's' : ''} before`).join(', ');
    })();

    const handleSendNow = async () => {
        setIsSending(true);
        try {
            await onSend({ via: 'whatsapp', isScheduled: false, scheduledDate: undefined });
        } finally {
            setIsSending(false);
        }
    };

    const handleScheduleSend = async () => {
        setIsSending(true);
        try {
            // Send current date so the cron processes the batch immediately according to settings
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().slice(0, 5);
            const combinedScheduledDate = `${dateStr} ${timeStr}:00`;
            await onSend({ via: 'whatsapp', isScheduled: true, scheduledDate: combinedScheduledDate });
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-green-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">WhatsApp Bulk Reminder</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Sending to <span className="font-black text-green-700">{customerCount}</span> customer{customerCount > 1 ? 's' : ''}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Settings summary banner */}
                {(daysLabel || defaultTime) && (
                    <div className="mx-6 mt-5 flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700">
                        <Bell className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-600" />
                        <div className="space-y-0.5">
                            <p className="font-bold text-green-800">Your Notification Settings:</p>
                            {daysLabel && <p>📅 Reminder: {daysLabel}</p>}
                            {defaultTime && <p>⏰ Time: {defaultTime}</p>}
                        </div>
                    </div>
                )}

                {/* Content */}
                <div className="p-6 space-y-4">

                    {/* Send Now — Big action button */}
                    {!showSchedule && (
                        <button
                            onClick={handleSendNow}
                            disabled={isSending}
                            className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Sending...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    <span>Send Now</span>
                                </>
                            )}
                        </button>
                    )}

                    {/* Schedule option toggle */}
                    {!showSchedule ? (
                        <button
                            onClick={() => setShowSchedule(true)}
                            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-gray-200 bg-white text-gray-600 hover:border-green-400 hover:text-green-700 font-medium transition-all text-sm"
                        >
                            <Clock className="w-4 h-4" />
                            <span>Schedule Instead</span>
                        </button>
                    ) : (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between">
                                <label className="block text-sm font-bold text-gray-700">Schedule Automatically</label>
                                <button onClick={() => setShowSchedule(false)} className="text-xs text-gray-400 hover:text-gray-600 underline">← Back to Send Now</button>
                            </div>
                            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                                <p className="text-sm text-green-800">
                                    🤖 Messages will be automatically scheduled and sent to the selected customers based strictly on your <strong>Notification Settings</strong>.
                                </p>
                            </div>
                            <button
                                onClick={handleScheduleSend}
                                disabled={isSending}
                                className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-green-600 text-white font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isSending ? (
                                    <><Loader2 className="w-5 h-5 animate-spin" /> Scheduling...</>
                                ) : (
                                    <><Clock className="w-5 h-5" /> Schedule Send</>
                                )}
                            </button>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="px-6 pb-6">
                    <button
                        onClick={onClose}
                        disabled={isSending}
                        className="w-full px-4 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
