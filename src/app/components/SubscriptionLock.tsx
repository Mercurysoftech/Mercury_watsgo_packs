import React from 'react';
import { Lock, ArrowUpCircle, ShieldCheck, AlertCircle } from 'lucide-react';

interface SubscriptionLockProps {
  featureName: string;
  onUpgrade: () => void;
  currentPlan?: string;
  requiredPlans?: string[];
}

export function SubscriptionLock({ featureName, onUpgrade, currentPlan, requiredPlans }: SubscriptionLockProps) {
  const requiredPlansText = requiredPlans 
    ? requiredPlans.map(p => p.toUpperCase()).join(' or ')
    : 'PRO / ENTERPRISE';
    
  const currentPlanDisplay = currentPlan ? currentPlan.toUpperCase() : '';
  
  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4 bg-gray-50/50 rounded-3xl animate-in fade-in zoom-in duration-500">
      <div className="relative bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-green-50 flex flex-col items-center text-center max-w-lg mx-auto overflow-hidden">
        {/* Decorative Background Elements */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-50 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-orange-50 rounded-full blur-3xl opacity-50" />

        <div className="relative z-10">
          <div className="w-20 h-20 bg-green-50 rounded-[30px] flex items-center justify-center mb-8 mx-auto transform hover:scale-110 transition-transform duration-300 shadow-sm border border-green-100">
            <Lock className="w-10 h-10 text-green-600" />
          </div>

          <h3 className="text-3xl font-black text-gray-900 mb-4 tracking-tight">Premium Feature</h3>
          
          <p className="text-gray-600 font-medium mb-6 leading-relaxed text-lg">
            The <span className="text-green-600 font-black">{featureName}</span> feature is part of our <span className="font-black text-gray-800 uppercase tracking-tighter">{requiredPlansText}</span> plans.
          </p>
          
          {currentPlanDisplay && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-sm font-bold text-blue-900">Your Current Plan</p>
                <p className="text-xs text-blue-700 font-semibold mt-1">{currentPlanDisplay}</p>
              </div>
            </div>
          )}
          
          <p className="text-sm text-gray-600 mb-10">
            Upgrade your subscription to unlock this and many more powerful tools!
          </p>

          <div className="space-y-4 w-full">
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-3 px-10 py-5 bg-green-600 text-white rounded-2xl font-black transition-all shadow-2xl shadow-green-200 hover:bg-green-700 hover:scale-[1.02] active:scale-95 text-xl group"
            >
              <ArrowUpCircle className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              Upgrade Now
            </button>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Mercury Softech • Scale Your Business</p>
          </div>
          
          {/* Feature List Preview */}
          <div className="mt-12 flex items-center justify-center gap-6">
            <div className="flex items-center gap-1.5 opacity-50">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">Secure</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-50">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">Reliable</span>
            </div>
            <div className="flex items-center gap-1.5 opacity-50">
              <ShieldCheck className="w-4 h-4 text-green-500" />
              <span className="text-xs font-bold text-gray-500 uppercase tracking-tight">Advanced</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
