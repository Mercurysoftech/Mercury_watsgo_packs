import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Search, RefreshCw, AlertCircle, User, Calendar, ChevronLeft, ChevronRight, MessageCircle, Image as ImageIcon, ClipboardList as Clipboard } from 'lucide-react';
import api, { reviewAPI, UPLOAD_BASE_URL } from '../services/api';
import { Review } from '../types';

export function CustomerReviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [reviewType, setReviewType] = useState<'vendor' | 'delivery' | 'custom'>('vendor');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchReviews = async (type: 'vendor' | 'delivery' | 'custom') => {
    setLoading(true);
    setError(null);
    try {
      const res = await reviewAPI.getAll(type);
      if (res.data.success) {
        setReviews(res.data.data);
        // Auto-select first review if none selected
        if (res.data.data.length > 0) {
          setSelectedReviewId(res.data.data[0].id);
        } else {
          setSelectedReviewId(null);
        }
      } else {
        setError('Failed to load reviews');
      }
    } catch (err: any) {
      console.error('Error fetching reviews:', err);
      setError(err.response?.data?.error || 'Failed to connect to the server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(reviewType);
    setCurrentPage(1);
  }, [reviewType]);

  const filteredReviews = reviews.filter(review =>
    review.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    review.feedback.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (review.delivery_man_name && review.delivery_man_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedReview = reviews.find(r => r.id === selectedReviewId);

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-3.5 h-3.5 flex-shrink-0 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`}
      />
    ));
  };

  if (loading && reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-10 h-10 text-green-500 animate-spin" />
        <p className="text-gray-500 font-medium">Loading reviews...</p>
      </div>
    );
  }

  const globalAverage = reviews.length > 0
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-800">Customer Reviews</h1>
          <p className="text-gray-500 mt-1">Monitor feedback and ratings from your customers</p>
          <div className="mt-4 flex gap-1 p-1 bg-gray-100 rounded-xl inline-flex shadow-inner">
            <button
              onClick={() => setReviewType('vendor')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${reviewType === 'vendor' ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Vendor Reviews
            </button>
            <button
              onClick={() => setReviewType('delivery')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${reviewType === 'delivery' ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Delivery Staff Reviews
            </button>
            <button
              onClick={() => setReviewType('custom')}
              className={`px-4 py-2 text-sm font-bold rounded-lg transition-all ${reviewType === 'custom' ? 'bg-white text-green-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Customer Customize
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4 md:mt-0 self-end md:self-auto">
          <div className="bg-amber-50 px-4 py-2 rounded-xl flex items-center gap-2 border border-amber-100 shadow-sm">
            <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
            <span className="font-bold text-gray-800">{globalAverage} / 5.0</span>
            <span className="text-xs text-gray-500 ml-1 font-medium hidden sm:inline">Overall Rating</span>
          </div>
          <button
            onClick={() => fetchReviews(reviewType)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl font-medium hover:bg-green-100 transition-colors shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden md:inline">Refresh</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 flex flex-col items-center text-center space-y-3 shadow-sm">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h3 className="text-lg font-bold text-red-800">Failed to Load Reviews</h3>
          <p className="text-red-600 max-w-md">{error}</p>
          <button
            onClick={() => fetchReviews(reviewType)}
            className="mt-2 px-6 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-md shadow-red-200"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 min-h-[600px] mb-8" style={{ height: 'calc(100vh - 220px)' }}>
          {/* Left Column - Reviews Sidebar */}
          <div className="w-full lg:w-1/3 xl:w-1/4 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50/80 backdrop-blur-sm sticky top-0 z-10">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                {reviewType === 'custom' ? <Clipboard className="w-5 h-5 text-green-500" /> : <MessageSquare className="w-5 h-5 text-green-500" />}
                {reviewType === 'custom' ? 'Custom Submissions' : 'Customer Reviews'} <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full ml-auto">{filteredReviews.length}</span>
              </h3>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search customer, staff or feedback..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none shadow-sm text-sm transition-shadow"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 relative">
              {filteredReviews.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {filteredReviews.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((review) => (
                      <button
                        key={review.id}
                        onClick={() => setSelectedReviewId(review.id)}
                        className={`w-full text-left p-4 rounded-xl transition-all border group relative overflow-hidden ${selectedReviewId === review.id
                          ? 'bg-gradient-to-r from-green-50 to-white border-green-200 shadow-sm'
                          : 'bg-white border-gray-100 hover:border-green-200 hover:shadow-sm'
                          }`}
                      >
                        {selectedReviewId === review.id && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>
                        )}
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-bold text-gray-800 text-sm flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${selectedReviewId === review.id ? 'bg-green-500 text-white' : 'bg-green-100 text-green-700'}`}>
                              {review.customer_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate pr-2">{review.customer_name}</span>
                          </div>
                        </div>

                        {reviewType === 'delivery' && (
                          <div className="flex items-center text-xs text-gray-500 mb-2 font-medium bg-gray-50 px-2 py-1 rounded-md border border-gray-100 w-fit">
                            <User className="w-3 h-3 mr-1" />
                            Staff: {review.delivery_man_name || 'Unassigned'}
                          </div>
                        )}

                        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed italic mb-3">
                          "{review.feedback}"
                        </p>

                        <div className="flex items-center justify-between mt-1">
                          <div className="flex gap-0.5">
                            {reviewType !== 'custom' && renderStars(review.rating)}
                          </div>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {new Date(review.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric', month: 'short'
                            })}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {filteredReviews.length > itemsPerPage && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 border border-gray-100 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                      <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        Page {currentPage} of {Math.ceil(filteredReviews.length / itemsPerPage)}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredReviews.length / itemsPerPage), p + 1))}
                        disabled={currentPage === Math.ceil(filteredReviews.length / itemsPerPage)}
                        className="p-2 border border-gray-100 rounded-lg disabled:opacity-30 hover:bg-gray-50 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 mt-12">
                  <div className="w-16 h-16 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="w-6 h-6 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium text-sm">No reviews found</p>
                  <p className="text-gray-400 text-xs mt-1">Try adjusting your search query</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Selected Review Detail */}
          <div className="w-full lg:w-2/3 xl:w-3/4 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden relative">
            {selectedReview ? (
              <div className="h-full flex flex-col overflow-y-auto">
                <div className="p-6 md:p-8 border-b border-gray-100 relative bg-gradient-to-r from-green-50/60 to-white overflow-hidden shrink-0">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-100/50 rounded-full blur-3xl pointer-events-none"></div>

                  {selectedReview.rating >= 4 ? (
                    <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none">
                      <div className="absolute top-[24px] -right-[32px] bg-green-500 text-white text-[12px] font-bold py-1.5 px-12 transform rotate-45 shadow-sm text-center w-full">GREAT RATING</div>
                    </div>
                  ) : selectedReview.rating <= 2 ? (
                    <div className="absolute top-0 right-0 w-32 h-32 overflow-hidden pointer-events-none">
                      <div className="absolute top-[24px] -right-[32px] bg-red-500 text-white text-[12px] font-bold py-1.5 px-12 transform rotate-45 shadow-sm text-center w-full">POOR RATING</div>
                    </div>
                  ) : null}

                  <div className="flex flex-col sm:flex-row justify-between items-start gap-6 relative z-10 w-full sm:pr-8">
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 text-white rounded-2xl flex items-center justify-center font-bold text-2xl shadow-lg shadow-green-200 border-2 border-white">
                        {selectedReview.customer_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold text-gray-800">{selectedReview.customer_name}</h2>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          <p className="text-xs text-gray-500 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
                            <Calendar className="w-3.5 h-3.5 text-green-600" />
                            {new Date(selectedReview.created_at).toLocaleDateString('en-IN', {
                              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-gray-100 shadow-sm">
                            <span className="font-semibold text-gray-700">{selectedReview.customer_mobile}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-center sm:items-end sm:mt-0 mt-2">
                      {reviewType !== 'custom' && (
                        <>
                          <div className="flex gap-1 bg-white px-3 py-2 border border-gray-100 shadow-sm rounded-xl">
                            {renderStars(selectedReview.rating)}
                          </div>
                          <span className="mt-2 text-sm font-bold text-gray-700 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
                            {selectedReview.rating}.0 <span className="text-gray-400 font-medium">out of 5</span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col p-6 md:p-8 bg-slate-50/30 gap-6">
                  {/* Customer Feedback */}
                  <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm relative group overflow-hidden">
                    <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-white px-2 hidden">
                      <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center border border-green-100">
                        <MessageSquare className="w-5 h-5 text-green-500" />
                      </div>
                    </div>
                    <MessageSquare className="absolute top-6 left-6 w-8 h-8 text-gray-100" />
                    <div className="pl-10 relative z-10">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">{reviewType === 'custom' ? 'Submission Content' : 'Customer Feedback'}</p>
                      <p className="text-gray-800 text-lg leading-relaxed italic whitespace-pre-wrap font-medium">
                        "{selectedReview.feedback || 'No content provided'}"
                      </p>
                    </div>
                  </div>

                  {/* Submission Images */}
                  {reviewType === 'custom' && (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Attached Images
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {[selectedReview.image1, selectedReview.image2, selectedReview.image3, selectedReview.image4, selectedReview.image5]
                          .filter(img => !!img)
                          .map((img, idx) => (
                            <div key={idx} className="aspect-square rounded-2xl overflow-hidden border border-gray-100 shadow-sm group hover:scale-105 transition-all bg-white p-1">
                              <img
                                src={`https://watsgo.in/packs_custo_app_api${img?.startsWith('/') ? img : `/${img}`}`}
                                alt={`Submission ${idx + 1}`}
                                className="w-full h-full object-cover rounded-xl"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Image+Not+Found';
                                }}
                              />
                            </div>
                          ))}
                        {![selectedReview.image1, selectedReview.image2, selectedReview.image3, selectedReview.image4, selectedReview.image5].some(img => !!img) && (
                          <div className="col-span-full py-8 text-center bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400 italic text-sm">
                            No images attached to this submission
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Delivery Staff Context */}
                  {reviewType === 'delivery' && (
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 relative overflow-hidden shadow-sm">
                      <div className="absolute right-0 top-0 bottom-0 w-2 bg-slate-200"></div>
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-4 flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        Delivery Staff Evaluated
                      </p>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-50 text-slate-600 border border-slate-200 rounded-full flex items-center justify-center font-bold text-lg">
                          {selectedReview.delivery_man_name ? selectedReview.delivery_man_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                          <p className="font-bold text-gray-800 text-lg">
                            {selectedReview.delivery_man_name || 'Unassigned Staff'}
                          </p>
                          {selectedReview.delivery_man_mobile && (
                            <p className="text-sm font-medium text-gray-500 mt-0.5">{selectedReview.delivery_man_mobile}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/50">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 mb-6 relative">
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center shadow-sm z-10 border border-amber-100">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  </div>
                  <MessageCircle className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-700 mb-2">No Review Selected</h3>
                <p className="text-gray-500 max-w-sm mx-auto leading-relaxed">
                  Choose a customer review from the sidebar on the left to read the full context and view details.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

