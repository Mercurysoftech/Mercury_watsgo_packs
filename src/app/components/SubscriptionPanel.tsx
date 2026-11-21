import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://watsgo.in/packs/api';

interface SubscriptionStatus {
    status: 'active' | 'inactive';
    expiry: string | null;
    daysRemaining: number;
}

const SubscriptionPanel: React.FC = () => {
    const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchSubscriptionStatus();
    }, []);

    const fetchSubscriptionStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`${API_BASE_URL}/subscription/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.success) {
                setSubscription(response.data.subscription);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to fetch subscription status');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = () => {
        if (!subscription) return 'gray';
        if (subscription.status === 'active') {
            if (subscription.daysRemaining <= 3) return 'orange';
            return 'green';
        }
        return 'red';
    };

    const getStatusMessage = () => {
        if (!subscription) return 'Loading...';

        if (subscription.status === 'active') {
            if (subscription.daysRemaining <= 3) {
                return `⚠️ Subscription expiring in ${subscription.daysRemaining} day(s)`;
            }
            return `✅ Active (${subscription.daysRemaining} days remaining)`;
        }

        return '❌ Subscription Expired - Please Renew';
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    if (loading) {
        return (
            <div className="subscription-panel loading">
                <div className="spinner"></div>
                <p>Loading subscription status...</p>
            </div>
        );
    }

    return (
        <div className={`subscription-panel status-${getStatusColor()}`}>
            <div className="subscription-header">
                <h3>💳 Subscription Status</h3>
            </div>

            <div className="subscription-body">
                <div className="status-badge" style={{
                    backgroundColor: getStatusColor() === 'green' ? '#10b981' :
                        getStatusColor() === 'orange' ? '#f59e0b' : '#ef4444',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    display: 'inline-block',
                    marginBottom: '16px'
                }}>
                    {getStatusMessage()}
                </div>

                {subscription && (
                    <div className="subscription-details">
                        <div className="detail-row">
                            <span className="label">Status:</span>
                            <span className="value" style={{
                                fontWeight: 'bold',
                                color: subscription.status === 'active' ? '#10b981' : '#ef4444'
                            }}>
                                {subscription.status.toUpperCase()}
                            </span>
                        </div>

                        <div className="detail-row">
                            <span className="label">Expiry Date:</span>
                            <span className="value">{formatDate(subscription.expiry)}</span>
                        </div>

                        <div className="detail-row">
                            <span className="label">Days Remaining:</span>
                            <span className="value" style={{
                                fontWeight: 'bold',
                                color: subscription.daysRemaining <= 3 ? '#f59e0b' : '#10b981'
                            }}>
                                {subscription.daysRemaining} days
                            </span>
                        </div>
                    </div>
                )}

                {subscription?.status === 'inactive' && (
                    <div className="action-buttons" style={{ marginTop: '20px' }}>
                        <button
                            className="btn-renew"
                            style={{
                                backgroundColor: '#6366f1',
                                color: 'white',
                                padding: '12px 24px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '14px',
                                width: '100%'
                            }}
                            onClick={() => {
                                alert('Please contact admin to renew your subscription');
                            }}
                        >
                            Renew Subscription
                        </button>
                    </div>
                )}

                {subscription?.status === 'active' && subscription.daysRemaining <= 7 && (
                    <div className="renewal-reminder" style={{
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: '#fef3c7',
                        borderRadius: '8px',
                        border: '1px solid #f59e0b'
                    }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#92400e' }}>
                            💡 Your subscription is about to expire. Please renew to continue accessing all features.
                        </p>
                    </div>
                )}

                {error && (
                    <div className="error-message" style={{
                        marginTop: '16px',
                        padding: '12px',
                        backgroundColor: '#fee2e2',
                        borderRadius: '8px',
                        border: '1px solid #ef4444'
                    }}>
                        <p style={{ margin: 0, fontSize: '13px', color: '#991b1b' }}>
                            {error}
                        </p>
                    </div>
                )}
            </div>

            <style>{`
        .subscription-panel {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 20px;
          margin-bottom: 24px;
        }

        .subscription-panel.loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }

        .subscription-header h3 {
          margin: 0 0 16px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
        }

        .subscription-body {
          padding: 0;
        }

        .subscription-details {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #f3f4f6;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row .label {
          color: #6b7280;
          font-size: 14px;
        }

        .detail-row .value {
          color: #1f2937;
          font-size: 14px;
          font-weight: 500;
        }

        .spinner {
          border: 3px solid #f3f4f6;
          border-top: 3px solid #6366f1;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .btn-renew:hover {
          backgroundColor: #4f46e5;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
      `}</style>
        </div>
    );
};

export default SubscriptionPanel;
