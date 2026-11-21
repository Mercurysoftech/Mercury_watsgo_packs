import React, { useState, useEffect } from 'react';
import { X, Send, MessageSquare, MessageCircle, Shield } from 'lucide-react';
import { Customer, BusinessSettings } from '../types';

interface ReminderModalProps {
  customer: Customer | null;
  onSend: (via: 'sms' | 'whatsapp', message: string) => void;
  onClose: () => void;
  settings?: BusinessSettings;
}

export function ReminderModal({ customer, onSend, onClose, settings }: ReminderModalProps) {
  const [sendVia] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!customer) return;

    const packName = customer.packName || 'N/A';
    const packPrice = customer.packPrice ? `₹${customer.packPrice}` : 'N/A';
    const renewalDateStr = new Date(customer.renewalDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const defaultMessage = `Hi ${customer.name}, your ${packName} (${packPrice}) subscription is due for renewal on ${renewalDateStr}. Please renew to continue enjoying fresh fruits! - ${settings?.businessName || 'Fresh Fruit Packs'}`;

    let initialMessage = defaultMessage;
    
    let paymentInfo = '';
    if (settings?.preferredPaymentMethod === 'upi' && settings?.upiId) {
      paymentInfo = `Pay via UPI: ${settings.upiId}`;
    } else if (settings?.preferredPaymentMethod === 'razorpay') {
      paymentInfo = 'You will receive a secure payment link shortly via WhatsApp.';
    }

    if (settings?.whatsappReminderTemplate) {
      try {
        // Handle JSON template from Meta Cloud API
        if (settings.whatsappReminderTemplate.trim().startsWith('{')) {
          const tmpl = JSON.parse(settings.whatsappReminderTemplate);
          const body = tmpl.components?.find((c: any) => c.type === 'body');
          if (body && body.text) {
            let parsedText = body.text;
            // Replace parameters if they exist
            if (body.parameters) {
              body.parameters.forEach((param: any, index: number) => {
                const placeholder = `{{${index + 1}}}`;
                let value = '';
                if (param.text) value = param.text;
                else if (param.type === 'text') value = param.text || '';
                
                // Smart mapping for common parameters
                if (index === 0) value = customer.name;
                if (index === 1) value = renewalDateStr;
                if (index === 2) value = packName;
                if (index === 3) value = packPrice;
                
                parsedText = parsedText.replace(placeholder, value);
              });
            }
            initialMessage = parsedText;
          } else {
            initialMessage = settings.whatsappReminderTemplate;
          }
        } else {
          initialMessage = settings.whatsappReminderTemplate
            .replace(/{{customer_name}}/g, customer.name)
            .replace(/{{renewal_date}}/g, renewalDateStr)
            .replace(/{{pack_name}}/g, packName)
            .replace(/{{pack_price}}/g, packPrice)
            .replace(/{{business_name}}/g, settings.businessName || 'Fresh Fruit Packs')
            .replace(/{{upi_id}}/g, settings.upiId || '')
            .replace(/{{payment_info}}/g, paymentInfo);
        }
      } catch (e) {
        // Fallback for non-JSON or invalid JSON
        initialMessage = settings.whatsappReminderTemplate
          .replace(/{{customer_name}}/g, customer.name)
          .replace(/{{renewal_date}}/g, renewalDateStr)
          .replace(/{{pack_name}}/g, packName)
          .replace(/{{pack_price}}/g, packPrice)
          .replace(/{{business_name}}/g, settings.businessName || 'Fresh Fruit Packs')
          .replace(/{{upi_id}}/g, settings.upiId || '')
          .replace(/{{payment_info}}/g, paymentInfo);
      }
    } else {
      initialMessage = `Hi ${customer.name}, your ${packName} (${packPrice}) subscription is due for renewal on ${renewalDateStr}. ${paymentInfo} - ${settings?.businessName || 'Fresh Fruit Packs'}`;
    }
    setMessage(initialMessage);
  }, [sendVia, customer, settings]);

  if (!customer) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800">Send Reminder</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Customer Info */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Customer:</span>
                <span className="text-sm font-medium text-gray-800">{customer.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Mobile:</span>
                <span className="text-sm font-medium text-gray-800">{customer.mobile}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Pack Name:</span>
                <span className="text-sm font-bold text-gray-900">{customer.packName || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Price:</span>
                <span className="text-sm font-bold text-green-700">₹{customer.packPrice || '0.00'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Renewal Date:</span>
                <span className="text-sm font-medium text-gray-800">
                  {new Date(customer.renewalDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Message Preview/Edit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Content (You can edit this)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full border-2 rounded-xl p-4 text-sm text-gray-700 leading-relaxed focus:ring-2 focus:outline-none bg-green-50 border-green-200 focus:ring-green-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              💬 This reminder will be sent via WhatsApp Business API
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-100">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSend('whatsapp', message)}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-medium transition-all shadow-md hover:shadow-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          >
            <MessageCircle className="w-4 h-4" />
            Send Now
          </button>
        </div>
      </div>
    </div>
  );
}
