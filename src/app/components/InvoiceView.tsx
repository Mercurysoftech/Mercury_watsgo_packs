import React from 'react';
import { Download, Printer, ArrowLeft, Mail, Phone, Globe, ShieldCheck } from 'lucide-react';
import { BusinessSettings } from '../types';
import { subscriptionAPI } from '../services/api';

interface InvoiceViewProps {
  invoice: any;
  settings: BusinessSettings;
  onBack: () => void;
}

export function InvoiceView({ invoice, settings, onBack }: InvoiceViewProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      if (!invoice.id) {
        alert('Invoice ID not found');
        return;
      }

      const response = await subscriptionAPI.downloadInvoicePDF(String(invoice.id));

      // Create blob from response
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber || `INV-${invoice.id}`}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download invoice');
    }
  };

  const mercuryDetails = {
    name: 'Mercury Softech',
    address: '3rd Floor, GrandTowers, Cheran Salai, LIC Colony, Ayyappa Nagar, K K Nagar, Tiruchirappalli, Tamil Nadu 620021',
    gstin: '33ACBFM6385R1ZJ',
    phone: '063826 94426',
    email: 'mercurysoftechofficial@gmail.com',
    website: 'https://www.mercurysoftech.com/'
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 print:p-0 print:bg-white">
      {/* Action Bar - Hidden in Print */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Settings</span>
        </button>
        <div className="flex gap-3">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-md"
          >
            <Download className="w-4 h-4" /> Download PDF
          </button>
        </div>
      </div>

      {/* Invoice Area */}
      <div className="max-w-4xl mx-auto bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden print:shadow-none print:border-none print:rounded-none">
        {/* Invoice Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-8 md:p-12 text-white">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-gray-900" />
                </div>
                <h1 className="text-3xl font-black tracking-tight">{mercuryDetails.name}</h1>
              </div>
              <p className="text-gray-400 text-sm max-w-sm leading-relaxed">
                Empowering businesses with modern digital solutions and smarter automation.
              </p>
            </div>
            <div className="text-right">
              <h2 className="text-4xl font-black uppercase tracking-widest opacity-20 mb-2">Invoice</h2>
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-5 border border-white/20 shadow-2xl">
                <p className="text-[10px] text-gray-300 uppercase font-black tracking-[0.2em] mb-1">Invoice Number</p>
                <p className="text-2xl font-mono font-bold tracking-tight">{invoice.invoiceNumber || `INV-${invoice.id.slice(-6).toUpperCase()}`}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-12">
          {/* Billing Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-12">
            <div>
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Issued By</h3>
              <div className="space-y-2">
                <p className="text-xl font-bold text-gray-900">{mercuryDetails.name}</p>
                <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">{mercuryDetails.address}</p>
                <div className="pt-2 space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                    <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">GSTIN</span> {mercuryDetails.gstin}
                  </p>
                  <p className="text-sm flex items-center gap-2 text-gray-600">
                    <Phone className="w-3.5 h-3.5" /> {mercuryDetails.phone}
                  </p>
                  <p className="text-sm flex items-center gap-2 text-gray-600">
                    <Mail className="w-3.5 h-3.5" /> {mercuryDetails.email}
                  </p>
                  <p className="text-sm flex items-center gap-2 text-gray-600 underline underline-offset-4">
                    <Globe className="w-3.5 h-3.5" /> {mercuryDetails.website.replace('https://', '')}
                  </p>
                </div>
              </div>
            </div>
            <div className="md:text-right">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Bill To</h3>
              <div className="space-y-2">
                <p className="text-xl font-bold text-gray-900">{settings.businessName || 'Business Owner'}</p>
                <p className="text-gray-500 text-sm leading-relaxed whitespace-pre-line">{settings.address || 'Address not provided'}</p>
                <div className="pt-2 space-y-1 md:flex md:flex-col md:items-end">
                  <p className="text-sm flex items-center gap-2 text-gray-600">
                    {settings.contactPhone} <Phone className="w-3.5 h-3.5" />
                  </p>
                  <p className="text-sm flex items-center gap-2 text-gray-600">
                    {settings.contactEmail} <Mail className="w-3.5 h-3.5" />
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Invoice Dates & Status */}
          <div className="flex flex-wrap gap-4 md:gap-8 mb-12 p-6 bg-gray-50 rounded-2xl border border-gray-100">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Issue Date</p>
              <p className="font-bold text-gray-800">{new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="w-px bg-gray-200 hidden md:block" />
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Payment Status</p>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${invoice.status === 'paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                }`}>
                {invoice.status === 'paid' ? <CheckCircle className="w-3.5 h-3.5" /> : null}
                {invoice.status === 'paid' ? 'Successful' : invoice.status}
              </span>
            </div>
            <div className="w-px bg-gray-200 hidden md:block" />
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Method</p>
              <p className="font-bold text-gray-800 uppercase">{invoice.method || 'Online Payment'}</p>
            </div>
          </div>

          {/* Table */}
          <div className="mb-12">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-900">
                  <th className="py-4 text-left text-xs font-black text-gray-400 uppercase tracking-[0.2em]">Description</th>
                  <th className="py-4 text-center text-xs font-black text-gray-400 uppercase tracking-[0.2em] w-24">Qty</th>
                  <th className="py-4 text-right text-xs font-black text-gray-400 uppercase tracking-[0.2em] w-32">Price</th>
                  <th className="py-4 text-right text-xs font-black text-gray-400 uppercase tracking-[0.2em] w-32">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-6">
                    <p className="font-bold text-gray-800 text-lg">
                      {invoice.planType === 'starter' ? 'Starter Subscription Pack' : (invoice.planType === 'growth' ? 'Growth Subscription Pack' : 'Pro Subscription Pack')}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      Cloud service subscription for Watsgo Reminders platform.
                    </p>
                  </td>
                  <td className="py-6 text-center font-bold text-gray-700">1</td>
                  <td className="py-6 text-right font-medium text-gray-500">₹{invoice.amount.toLocaleString('en-IN')}</td>
                  <td className="py-6 text-right font-black text-gray-900 text-lg">₹{invoice.amount.toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-12">
            <div className="w-full md:w-80 space-y-4">
              <div className="flex justify-between items-center text-gray-600">
                <span className="text-sm font-bold uppercase tracking-widest">Subtotal</span>
                <span className="font-bold tabular-nums">₹{invoice.amount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span className="text-sm font-bold uppercase tracking-widest">Tax (0%)</span>
                <span className="font-bold tabular-nums">₹0.00</span>
              </div>
              <div className="h-px bg-gray-200" />
              <div className="flex justify-between items-center p-4 bg-gray-900 rounded-2xl text-white">
                <span className="text-base font-black uppercase tracking-widest">Total Amount</span>
                <span className="text-2xl font-black tabular-nums">₹{invoice.amount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="pt-12 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
              <div>
                <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-3">Important Note</h4>
                <p className="text-sm text-gray-500 leading-relaxed italic">
                  This is a computer-generated invoice and does not require a physical signature.
                  For any billing inquiries, please contact our support team at {mercuryDetails.email}.
                </p>
              </div>
              <div className="md:text-right">
                <p className="text-sm font-bold text-gray-400 mb-1">Thank you for your business!</p>
                <p className="text-lg font-black text-gray-900">Mercury Softech Team</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const CheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
