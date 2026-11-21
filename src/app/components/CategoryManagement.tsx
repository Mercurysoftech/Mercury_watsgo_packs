import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Tag, IndianRupee, Layers, X, Save, AlertCircle, Pencil, Search, Bell, Grid, ChevronLeft, ChevronRight } from 'lucide-react';
import { Category, Pack, UserRole, BusinessSettings } from '../types';
import { categoryAPI, packAPI } from '../services/api';

interface CategoryManagementProps {
    userRole: UserRole;
    userName?: string;
    isSubscriptionActive?: boolean;
    settings?: BusinessSettings;
}

export function CategoryManagement({ userRole, userName, isSubscriptionActive = true, settings }: CategoryManagementProps) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [packs, setPacks] = useState<Pack[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showPackModal, setShowPackModal] = useState(false);
    const [editingPack, setEditingPack] = useState<Pack | null>(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [packPage, setPackPage] = useState(1);
    const packsPerPage = 6;

    const [packForm, setPackForm] = useState({
        name: '',
        categoryId: '',
        price: '',
        billingCycle: 'daily' as 'weekly' | 'monthly' | 'daily',
        billingDays: '',
        fruits: '',
        extraNotes: '',
        packType: (settings?.businessType || 'fruits') as 'fruits' | 'food' | 'dairy',
        unitType: 'litres' as 'litres' | 'ml' | 'grams' | 'packets' | 'pack',
        unitVolume: '1',
        deliveryShift: 'morning' as 'morning' | 'evening' | 'both',
        mealSlots: [] as string[]
    });

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [catRes, packRes] = await Promise.all([
                categoryAPI.getAll(),
                packAPI.getAll()
            ]);
            setCategories(catRes.data.categories || []);
            setPacks(packRes.data.packs || []);
            setPackPage(1); // Reset page on data fetch
        } catch (err) {
            console.error('Failed to fetch categories/packs:', err);
            setError('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        try {
            await categoryAPI.create({ name: newCategoryName.trim() });
            setNewCategoryName('');
            setShowCategoryModal(false);
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to add category');
        }
    };

    const handleSavePack = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!packForm.name.trim() || !packForm.categoryId || !packForm.price) return;

        try {
            const packData = {
                name: packForm.name.trim(),
                categoryId: packForm.categoryId,
                price: parseFloat(packForm.price),
                billingCycle: packForm.billingCycle,
                billingDays: packForm.billingCycle === 'daily' ? (parseInt(packForm.billingDays) || 1) : undefined,
                fruits: packForm.fruits.trim(),
                extraNotes: packForm.extraNotes.trim(),
                packType: packForm.packType,
                unitType: packForm.unitType,
                unitVolume: parseFloat(packForm.unitVolume) || 1,
                deliveryShift: packForm.deliveryShift,
                mealSlots: packForm.mealSlots.join(',')
            };

            if (editingPack) {
                await packAPI.update(editingPack.id, packData);
            } else {
                await packAPI.create(packData);
            }

            setShowPackModal(false);
            resetPackForm();
            fetchData();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to save pack');
        }
    };

    const resetPackForm = () => {
        setEditingPack(null);
        setPackForm({
            name: '',
            categoryId: '',
            price: '',
            billingCycle: 'daily',
            billingDays: '',
            fruits: '',
            extraNotes: '',
            packType: (settings?.businessType || 'fruits') as 'fruits' | 'food' | 'dairy',
            unitType: 'litres',
            unitVolume: '1',
            deliveryShift: 'morning',
            mealSlots: []
        });
    };

    const handleEditPack = (pack: Pack) => {
        setEditingPack(pack);
        setPackForm({
            name: pack.name,
            categoryId: pack.categoryId,
            price: pack.price.toString(),
            billingCycle: pack.billingCycle,
            billingDays: pack.billingDays ? pack.billingDays.toString() : '',
            fruits: pack.fruits || '',
            extraNotes: pack.extraNotes || '',
            packType: pack.packType || (settings?.businessType || 'fruits') as 'fruits' | 'food' | 'dairy',
            unitType: pack.unitType || 'litres',
            unitVolume: pack.unitVolume ? pack.unitVolume.toString() : '1',
            deliveryShift: pack.deliveryShift || 'morning',
            mealSlots: pack.mealSlots ? pack.mealSlots.split(',') : []
        });
        setShowPackModal(true);
    };

    const handleDeleteCategory = async (id: string) => {
        if (!window.confirm('Are you sure? This will also delete all packs in this category.')) return;
        try {
            await categoryAPI.delete(id);
            fetchData();
        } catch (err) {
            setError('Failed to delete category');
        }
    };

    const handleDeletePack = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this pack?')) return;
        try {
            await packAPI.delete(id);
            fetchData();
        } catch (err) {
            setError('Failed to delete pack');
        }
    };

    const getPacksCountByCategory = (categoryId: string) => {
        return packs.filter((p: Pack) => p.categoryId === categoryId).length;
    };

    if (userRole !== 'admin') {
        return (
            <div className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
                <p className="text-gray-600 mt-2">Only administrators can manage categories and packs.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-12">
            <div className="max-w-[1500px] mx-auto px-4 md:px-8">
                {/* Main Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-gray-900">Products Packs Management</h1>
                        <p className="text-gray-500 mt-2 text-lg">Manage your products packs and categories</p>
                    </div>
                    <button
                        onClick={() => isSubscriptionActive && setShowPackModal(true)}
                        disabled={!isSubscriptionActive}
                        className={`group flex items-center gap-3 px-6 py-3.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg shadow-green-200 active:scale-95 ${!isSubscriptionActive ? 'grayscale opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                        Add New Pack
                    </button>
                </div>

                {error && (
                    <div className="mb-8 bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top duration-300">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <p className="font-medium">{error}</p>
                        <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
                    {/* Categories Sidebar */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden lg:sticky lg:top-8">
                            <div className="p-6 pb-4 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-gray-900">Categories</h2>
                                <button
                                    onClick={() => setShowCategoryModal(true)}
                                    className="p-1.5 px-3 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg border border-green-100 flex items-center gap-1.5 text-xs font-bold transition-all"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add
                                </button>
                            </div>

                            <div className="p-3 pt-0 max-h-[calc(100vh-250px)] overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full">
                                {loading ? (
                                    <div className="p-8 text-center text-gray-400">Loading...</div>
                                ) : categories.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 italic text-sm">No categories found</div>
                                ) : (
                                    <div className="space-y-1">
                                        {categories.map((cat) => (
                                            <div key={cat.id} className="group flex items-center justify-between p-4 rounded-xl hover:bg-green-50/50 transition-all border border-transparent hover:border-green-100">
                                                <span className="font-semibold text-gray-600 group-hover:text-green-700">{cat.name}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md min-w-[24px] text-center">
                                                        {getPacksCountByCategory(cat.id)}
                                                    </span>
                                                    <button
                                                        onClick={() => isSubscriptionActive && handleDeleteCategory(cat.id)}
                                                        disabled={!isSubscriptionActive}
                                                        className={`p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100`}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Packs Grid */}
                    <div className="lg:col-span-3">
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="h-80 bg-white rounded-[2rem] animate-pulse border border-gray-100"></div>
                                ))}
                            </div>
                        ) : packs.length === 0 ? (
                            <div className="bg-white rounded-[2rem] border border-gray-100 p-20 text-center">
                                <div className="w-24 h-24 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <Package className="w-12 h-12 text-green-200" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">No packs created yet</h3>
                                <p className="text-gray-500 mb-8">Start by adding your first subscription pack.</p>
                                <button
                                    onClick={() => setShowPackModal(true)}
                                    className="px-8 py-3.5 bg-green-600 text-white rounded-xl font-bold"
                                >
                                    Add New Pack
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 md:gap-6">
                                    {packs.slice((packPage - 1) * packsPerPage, packPage * packsPerPage).map((pack: Pack) => (
                                        <div
                                            key={pack.id}
                                            className="bg-white rounded-[2rem] border border-gray-100 p-6 md:p-7 shadow-sm hover:shadow-md transition-all group relative flex flex-col h-full overflow-hidden"
                                        >
                                            {/* Action Buttons - Repositioned to prevent overlap */}
                                            <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditPack(pack)}
                                                    className="p-2 text-green-600 bg-white/90 backdrop-blur-sm hover:bg-green-50 rounded-xl border border-gray-100 shadow-sm transition-all"
                                                    title="Edit Pack"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeletePack(e, pack.id)}
                                                    className="p-2 text-red-600 bg-white/90 backdrop-blur-sm hover:bg-red-50 rounded-xl border border-gray-100 shadow-sm transition-all"
                                                    title="Delete Pack"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <div className="flex items-start gap-3 mb-6 pr-16">
                                                <div className="w-10 h-10 md:w-12 md:h-12 bg-green-50 rounded-2xl flex items-center justify-center shrink-0">
                                                    <Package className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-base md:text-lg font-bold text-gray-900 mb-0.5 leading-tight truncate" title={pack.name}>{pack.name}</h3>
                                                    <p className="text-base md:text-lg font-extrabold text-green-600 whitespace-nowrap">
                                                        ₹{pack.price}<span className="text-xs md:text-sm text-gray-400 font-bold ml-1">/{pack.billingCycle === 'monthly' ? 'mo' : pack.billingCycle === 'daily' ? `${pack.billingDays || 1}d` : 'wk'}</span>
                                                    </p>
                                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${
                                                        pack.packType === 'food' ? 'bg-orange-100 text-orange-600' : (pack.packType === 'dairy' ? 'bg-emerald-100 text-emerald-700' : 'bg-green-100 text-green-600')
                                                    }`}>
                                                        {pack.packType === 'dairy' ? `🥛 Dairy (${pack.unitVolume || 1} ${pack.unitType === 'litres' ? 'L' : pack.unitType || 'L'})` : (pack.packType || 'fruits')}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="space-y-6 flex-1">
                                                {pack.packType === 'dairy' ? (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                                            Volume & Delivery Shift
                                                        </p>
                                                        <div className="flex flex-wrap gap-2 text-xs font-bold text-gray-800">
                                                            <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg border border-green-100">
                                                                {pack.unitVolume || 1} {pack.unitType === 'litres' ? 'Litres' : pack.unitType}
                                                            </span>
                                                            <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg border border-green-100 capitalize">
                                                                {pack.deliveryShift === 'both' ? '☀️🌙 Morning & Evening' : (pack.deliveryShift === 'evening' ? '🌙 Evening Shift' : '☀️ Morning Shift')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                                                            {pack.packType === 'food' ? 'Food Items' : 'Fruits Included'}
                                                        </p>
                                                        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                                                            {(pack.fruits || '').split(',').map((fruit: string, idx: number) => fruit.trim() && (
                                                                <span key={idx} className="px-2.5 py-1 bg-green-50 text-green-700 rounded-lg">
                                                                    {fruit.trim()}
                                                                </span>
                                                            ))}
                                                            {!pack.fruits && <span className="text-gray-400 italic font-normal">None specified</span>}
                                                        </div>
                                                    </div>
                                                )}

                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Category</p>
                                                    <span className="inline-block px-3 py-1 bg-gray-50 text-gray-600 rounded-lg text-[11px] font-bold border border-gray-100">
                                                        {pack.categoryName}
                                                    </span>
                                                </div>

                                                {pack.extraNotes && (
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Extra Notes</p>
                                                        <p className="text-xs text-gray-600 font-medium italic bg-gray-50 p-2.5 rounded-xl border border-gray-100 line-clamp-2">
                                                            "{pack.extraNotes}"
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-50">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Freq:</span>
                                                    <span className="text-[11px] font-bold text-gray-900 capitalize">{pack.billingCycle} {pack.billingCycle === 'daily' ? `(${pack.billingDays || 1} Days)` : ''}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">Cust:</span>
                                                    <span className="text-[11px] font-bold text-gray-900">{pack.customerCount || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pack Pagination */}
                                {packs.length > packsPerPage && (
                                    <div className="flex items-center justify-between py-6 px-4 border-t border-gray-100">
                                        <p className="text-sm font-bold text-gray-400">
                                            Page <span className="text-gray-900">{packPage}</span> of <span className="text-gray-900">{Math.ceil(packs.length / packsPerPage)}</span>
                                        </p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setPackPage(p => Math.max(1, p - 1))}
                                                disabled={packPage === 1}
                                                className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30 transition-all active:scale-95"
                                            >
                                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => setPackPage(p => Math.min(Math.ceil(packs.length / packsPerPage), p + 1))}
                                                disabled={packPage === Math.ceil(packs.length / packsPerPage)}
                                                className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:bg-gray-50 disabled:opacity-30 transition-all active:scale-95"
                                            >
                                                <ChevronRight className="w-5 h-5 text-gray-600" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Category Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)}></div>
                    <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-10">
                            <div className="flex items-center justify-between mb-10">
                                <h3 className="text-2xl font-bold text-gray-900">Add New Category</h3>
                                <button onClick={() => setShowCategoryModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleAddCategory} className="space-y-8">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 pl-1">Category Name</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="e.g., Premium Packs"
                                        className="w-full px-6 py-4.5 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-gray-700"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-5 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-700 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-3"
                                >
                                    <Save className="w-5 h-5" />
                                    Save Category
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Pack Modal */}
            {showPackModal && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => { setShowPackModal(false); resetPackForm(); }}></div>
                    <div className="relative bg-white w-full sm:max-w-xl sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 flex flex-col max-h-[95dvh] sm:max-h-[90vh]">
                        {/* Modal Header - Sticky */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-100 shrink-0">
                            <h3 className="text-xl font-bold text-gray-900">{editingPack ? `Edit ${packForm.packType === 'food' ? 'Food' : 'Fruit'} Pack` : 'Create New Pack'}</h3>
                            <button onClick={() => { setShowPackModal(false); resetPackForm(); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Modal Body - Scrollable */}
                        <div className="overflow-y-auto flex-1 p-6">
                            <form id="pack-form" onSubmit={handleSavePack} className="space-y-5">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Pack Name</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        value={packForm.name}
                                        onChange={(e) => setPackForm({ ...packForm, name: e.target.value })}
                                        placeholder="e.g., Deluxe Fruit Pack"
                                        className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-gray-700"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Category</label>
                                        <select
                                            value={packForm.categoryId}
                                            onChange={(e) => setPackForm({ ...packForm, categoryId: e.target.value })}
                                            className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-gray-700 appearance-none"
                                            required
                                        >
                                            <option value="">Select Category</option>
                                            {categories.map((cat) => (
                                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Price (₹)</label>
                                        <div className="relative">
                                            <IndianRupee className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                                            <input
                                                type="number"
                                                value={packForm.price}
                                                onChange={(e) => setPackForm({ ...packForm, price: e.target.value })}
                                                placeholder="0.00"
                                                className="w-full pl-12 pr-5 py-3.5 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-gray-700"
                                                required
                                                min="0"
                                                step="0.01"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Pack Type</label>
                                    <div className="flex gap-3">
                                        {[settings?.businessType || 'fruits'].map(type => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setPackForm({ ...packForm, packType: type as any })}
                                                className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 transition-all uppercase text-[10px] tracking-widest ${packForm.packType === type
                                                    ? 'bg-green-600 border-green-600 text-white'
                                                    : 'bg-white border-gray-100 text-gray-500 hover:border-green-200'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Billing Frequency</label>
                                    <div className="flex gap-3">
                                        {['weekly', 'monthly', 'daily'].map(cycle => (
                                            <button
                                                key={cycle}
                                                type="button"
                                                onClick={() => setPackForm({ ...packForm, billingCycle: cycle as any })}
                                                className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 transition-all uppercase text-[10px] tracking-widest ${packForm.billingCycle === cycle
                                                    ? 'bg-green-600 border-green-600 text-white'
                                                    : 'bg-white border-gray-100 text-gray-500 hover:border-green-200'}`}
                                            >
                                                {cycle}
                                            </button>
                                        ))}
                                    </div>
                                    {packForm.billingCycle === 'daily' && (
                                        <div className="mt-4 animate-in slide-in-from-top-2">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Number of Days</label>
                                            <input
                                                type="number"
                                                value={packForm.billingDays}
                                                onChange={(e) => setPackForm({ ...packForm, billingDays: e.target.value })}
                                                placeholder="e.g., 5"
                                                className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-gray-700"
                                                required
                                                min="1"
                                            />
                                        </div>
                                    )}
                                </div>

                                {packForm.packType === 'food' && (
                                    <div className="mt-4 animate-in slide-in-from-top-2">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Included Meals (Select 1, 2, or 3)</label>
                                        <div className="flex gap-3">
                                            {[
                                                { id: 'breakfast', label: 'Breakfast' },
                                                { id: 'lunch', label: 'Lunch' },
                                                { id: 'dinner', label: 'Dinner' }
                                            ].map(meal => {
                                                const isSelected = packForm.mealSlots.includes(meal.id);
                                                return (
                                                    <button
                                                        key={meal.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setPackForm({
                                                                ...packForm,
                                                                mealSlots: isSelected
                                                                    ? packForm.mealSlots.filter(m => m !== meal.id)
                                                                    : [...packForm.mealSlots, meal.id]
                                                                });
                                                        }}
                                                        className={`flex-1 py-3 px-4 rounded-xl font-bold border-2 transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 ${
                                                            isSelected
                                                                ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-100'
                                                                : 'bg-white border-gray-100 text-gray-500 hover:border-green-200'
                                                        }`}
                                                    >
                                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isSelected ? 'border-white bg-white text-green-600' : 'border-gray-300'}`}>
                                                            {isSelected && <span className="text-[9px] font-black leading-none">✓</span>}
                                                        </div>
                                                        {meal.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {packForm.packType === 'dairy' && (
                                    <div className="mt-4 p-4 bg-green-50/70 border border-green-200 rounded-2xl space-y-4 animate-in slide-in-from-top-2">
                                        <div className="flex items-center gap-2 text-green-900 font-bold text-xs uppercase tracking-wider">
                                            <span>🥛</span> Dairy Volume & Shift Specifications
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1.5 pl-1">Unit Type</label>
                                                <select
                                                    value={packForm.unitType}
                                                    onChange={(e) => setPackForm({ ...packForm, unitType: e.target.value as any })}
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 focus:border-green-500 rounded-xl text-sm font-bold text-gray-800 outline-none"
                                                >
                                                    <option value="litres">Litres (L)</option>
                                                    <option value="ml">Millilitres (ml)</option>
                                                    <option value="grams">Grams (g)</option>
                                                    <option value="packets">Packets / Units</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 mb-1.5 pl-1">Volume per Pack (e.g., 1, 500)</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={packForm.unitVolume}
                                                    onChange={(e) => setPackForm({ ...packForm, unitVolume: e.target.value })}
                                                    placeholder="e.g. 1 or 500"
                                                    className="w-full px-4 py-3 bg-white border border-gray-200 focus:border-green-500 rounded-xl text-sm font-bold text-gray-800 outline-none"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1.5 pl-1">Delivery Shift</label>
                                            <div className="flex gap-2">
                                                {[
                                                    { id: 'morning', label: '☀️ Morning' },
                                                    { id: 'evening', label: '🌙 Evening' },
                                                    { id: 'both', label: '☀️🌙 Both' }
                                                ].map(shift => (
                                                    <button
                                                        key={shift.id}
                                                        type="button"
                                                        onClick={() => setPackForm({ ...packForm, deliveryShift: shift.id as any })}
                                                        className={`flex-1 py-2.5 px-3 rounded-xl font-bold border-2 transition-all text-xs ${
                                                            packForm.deliveryShift === shift.id
                                                                ? 'bg-green-600 border-green-600 text-white shadow-md shadow-green-200'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:border-green-200'
                                                        }`}
                                                    >
                                                        {shift.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">Extra Notes</label>
                                    <textarea
                                        value={packForm.extraNotes}
                                        onChange={(e) => setPackForm({ ...packForm, extraNotes: e.target.value })}
                                        placeholder="Special instructions, packaging details, etc."
                                        className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-gray-700 min-h-[70px]"
                                    />
                                </div>

                                {packForm.packType !== 'dairy' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">
                                            {packForm.packType === 'food' ? 'Food Items' : 'Fruits Included'} (Comma separated)
                                        </label>
                                        <textarea
                                            value={packForm.fruits}
                                            onChange={(e) => setPackForm({ ...packForm, fruits: e.target.value })}
                                            placeholder={packForm.packType === 'food' ? "Idly, Dosa, Meals..." : "Apple, Banana, Orange, Grapes..."}
                                            className="w-full px-5 py-3.5 bg-gray-50 border-2 border-transparent focus:border-green-500 focus:bg-white rounded-2xl transition-all outline-none font-bold text-gray-700 min-h-[80px]"
                                        />
                                    </div>
                                )}
                            </form>
                        </div>

                        {/* Modal Footer - Sticky Save Button */}
                        <div className="p-5 border-t border-gray-100 shrink-0 bg-white sm:rounded-b-[2rem]">
                            <button
                                type="submit"
                                form="pack-form"
                                className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base hover:bg-green-700 active:scale-98 transition-all shadow-lg shadow-green-200 flex items-center justify-center gap-3"
                            >
                                {editingPack ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                {editingPack ? 'Update Pack' : 'Create Pack'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
