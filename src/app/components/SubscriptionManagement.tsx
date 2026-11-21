import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://watsgo.in/packs/api';

interface Plan {
    id: string;
    name: string;
    amount: number;
    currency: string;
    period: string;
    interval: number;
}

interface User {
    id: number;
    full_name: string;
    email: string;
    phone: string;
    subscription_status: 'active' | 'inactive';
    subscription_expiry: string | null;
}

const SubscriptionManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'create-plan' | 'create-subscription' | 'view-users'>('create-subscription');

    // Plan creation state
    const [planName, setPlanName] = useState('Monthly Fresh Fruit Packs Subscription');
    const [planAmount, setPlanAmount] = useState(500);
    const [planDescription, setPlanDescription] = useState('Monthly subscription for Fresh Fruit Packs service');
    const [createdPlan, setCreatedPlan] = useState<Plan | null>(null);

    // Subscription creation state
    const [selectedPlanId, setSelectedPlanId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [paymentLink, setPaymentLink] = useState('');
    const [subscriptionId, setSubscriptionId] = useState('');

    // Users list state
    const [users, setUsers] = useState<User[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Loading states
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const getToken = () => localStorage.getItem('token');

    // Fetch all users
    const fetchUsers = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/auth/users`, {
                headers: { Authorization: `Bearer ${getToken()}` }
            });
            if (response.data.users) {
                setUsers(response.data.users);
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    // Manual activation function
    const handleManualActivate = async (userId: number) => {
        if (!window.confirm('Are you sure you want to manually activate this user? Only do this if they have already paid.')) return;

        setLoading(true);
        try {
            const response = await axios.post(
                `${API_BASE_URL}/subscription/activate`,
                { userId, durationMonths: 1 },
                {
                    headers: { Authorization: `Bearer ${getToken()}` }
                }
            );

            if (response.data.success) {
                setMessage(`✅ ${response.data.message}`);
                fetchUsers(); // Refresh the list
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to manually activate account');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'view-users') {
            fetchUsers();
            setCurrentPage(1);
        }
    }, [activeTab]);

    // Create Plan
    const handleCreatePlan = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const response = await axios.post(
                `${API_BASE_URL}/subscription/plans`,
                {
                    planName,
                    amount: planAmount,
                    description: planDescription
                },
                {
                    headers: { Authorization: `Bearer ${getToken()}` }
                }
            );

            if (response.data.success) {
                setCreatedPlan(response.data.plan);
                setSelectedPlanId(response.data.plan.id);
                setMessage(`✅ Plan created successfully! Plan ID: ${response.data.plan.id}`);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create plan');
        } finally {
            setLoading(false);
        }
    };

    // Create Subscription
    const handleCreateSubscription = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');
        setPaymentLink('');

        if (!selectedPlanId) {
            setError('Please enter Plan ID or create a plan first');
            setLoading(false);
            return;
        }

        try {
            const response = await axios.post(
                `${API_BASE_URL}/subscription/create`,
                {
                    planId: selectedPlanId,
                    customerName,
                    customerEmail,
                    customerPhone
                },
                {
                    headers: { Authorization: `Bearer ${getToken()}` }
                }
            );

            if (response.data.success) {
                setPaymentLink(response.data.subscription.shortUrl);
                setSubscriptionId(response.data.subscription.id);
                setMessage('✅ Subscription created successfully! Share the payment link below.');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to create subscription');
        } finally {
            setLoading(false);
        }
    };

    // Copy to clipboard
    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setMessage(`📋 ${label} copied to clipboard!`);
        setTimeout(() => setMessage(''), 3000);
    };

    // Send via WhatsApp
    const sendViaWhatsApp = () => {
        const message = `🎉 Welcome to Fresh Fruit Packs!\n\nYour subscription payment link:\n${paymentLink}\n\n💰 Amount: ₹${planAmount}/month\n✅ Pay via UPI, Card, or Net Banking\n🔒 100% Secure Razorpay Payment\n\nClick the link to get started!`;
        const whatsappUrl = `https://wa.me/${customerPhone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

    // Format date
    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // Calculate days remaining
    const getDaysRemaining = (expiryDate: string | null) => {
        if (!expiryDate) return 0;
        const expiry = new Date(expiryDate);
        const now = new Date();
        const diff = expiry.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 60 * 60 * 24));
    };

    return (
        <div className="subscription-management">
            <div className="page-header">
                <h1>💳 Subscription Management</h1>
                <p>Manage subscription plans and user payments</p>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'create-subscription' ? 'active' : ''}`}
                    onClick={() => setActiveTab('create-subscription')}
                >
                    🎯 Create Subscription
                </button>
                <button
                    className={`tab ${activeTab === 'create-plan' ? 'active' : ''}`}
                    onClick={() => setActiveTab('create-plan')}
                >
                    📋 Create Plan
                </button>
                <button
                    className={`tab ${activeTab === 'view-users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('view-users')}
                >
                    👥 View Users
                </button>
            </div>

            {/* Messages */}
            {message && (
                <div className="message success">
                    {message}
                </div>
            )}

            {error && (
                <div className="message error">
                    {error}
                </div>
            )}

            {/* Create Subscription Tab */}
            {activeTab === 'create-subscription' && (
                <div className="tab-content">
                    <div className="card">
                        <h2>Create User Subscription</h2>
                        <p className="help-text">Generate a payment link for a new user subscription</p>

                        <form onSubmit={handleCreateSubscription}>
                            <div className="form-group">
                                <label>Plan ID *</label>
                                <input
                                    type="text"
                                    value={selectedPlanId}
                                    onChange={(e) => setSelectedPlanId(e.target.value)}
                                    placeholder="plan_xxxxxxxxxxxxx"
                                    required
                                />
                                <small>Create a plan first or use existing Plan ID</small>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>Customer Name *</label>
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        placeholder="John Doe"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Customer Email *</label>
                                    <input
                                        type="email"
                                        value={customerEmail}
                                        onChange={(e) => setCustomerEmail(e.target.value)}
                                        placeholder="john@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Customer Phone *</label>
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    placeholder="+919876543210"
                                    required
                                />
                                <small>Include country code (e.g., +91 for India)</small>
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? '⏳ Creating...' : '🚀 Create Subscription & Get Payment Link'}
                            </button>
                        </form>

                        {/* Payment Link Result */}
                        {paymentLink && (
                            <div className="payment-result">
                                <div className="success-banner">
                                    <h3>✅ Subscription Created Successfully!</h3>
                                    <p>Subscription ID: <code>{subscriptionId}</code></p>
                                </div>

                                <div className="payment-link-box">
                                    <label>📱 Payment Link</label>
                                    <div className="link-display">
                                        <input
                                            type="text"
                                            value={paymentLink}
                                            readOnly
                                            onClick={(e) => (e.target as HTMLInputElement).select()}
                                        />
                                        <button
                                            className="btn btn-copy"
                                            onClick={() => copyToClipboard(paymentLink, 'Payment link')}
                                        >
                                            📋 Copy
                                        </button>
                                    </div>
                                </div>

                                <div className="action-buttons">
                                    <button className="btn btn-whatsapp" onClick={sendViaWhatsApp}>
                                        💬 Send via WhatsApp
                                    </button>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            const sms = `Hi ${customerName}, Complete your Fresh Fruit Packs subscription: ${paymentLink}`;
                                            window.open(`sms:${customerPhone}?body=${encodeURIComponent(sms)}`);
                                        }}
                                    >
                                        📱 Send via SMS
                                    </button>
                                    <a
                                        href={paymentLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn btn-link"
                                    >
                                        🔗 Open Link
                                    </a>
                                </div>

                                <div className="info-box">
                                    <h4>📨 Next Steps:</h4>
                                    <ol>
                                        <li>Copy the payment link above</li>
                                        <li>Send it to the customer via WhatsApp/SMS/Email</li>
                                        <li>Customer pays via Razorpay (UPI/Card/Net Banking)</li>
                                        <li>Subscription automatically activates after payment</li>
                                        <li>Customer receives confirmation email</li>
                                    </ol>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Create Plan Tab */}
            {activeTab === 'create-plan' && (
                <div className="tab-content">
                    <div className="card">
                        <h2>Create Subscription Plan</h2>
                        <p className="help-text">Create a new monthly subscription plan (one-time setup)</p>

                        <form onSubmit={handleCreatePlan}>
                            <div className="form-group">
                                <label>Plan Name *</label>
                                <input
                                    type="text"
                                    value={planName}
                                    onChange={(e) => setPlanName(e.target.value)}
                                    placeholder="Monthly Fresh Fruit Packs Subscription"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Amount (₹) *</label>
                                <input
                                    type="number"
                                    value={planAmount}
                                    onChange={(e) => setPlanAmount(Number(e.target.value))}
                                    placeholder="500"
                                    min="1"
                                    required
                                />
                                <small>Amount in Indian Rupees (INR)</small>
                            </div>

                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={planDescription}
                                    onChange={(e) => setPlanDescription(e.target.value)}
                                    placeholder="Monthly subscription for Fresh Fruit Packs service"
                                    rows={3}
                                />
                            </div>

                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? '⏳ Creating...' : '📋 Create Plan'}
                            </button>
                        </form>

                        {/* Created Plan Display */}
                        {createdPlan && (
                            <div className="created-plan">
                                <div className="success-banner">
                                    <h3>✅ Plan Created Successfully!</h3>
                                </div>

                                <div className="plan-details">
                                    <div className="detail-row">
                                        <span className="label">Plan ID:</span>
                                        <div className="value-with-copy">
                                            <code>{createdPlan.id}</code>
                                            <button
                                                className="btn-icon"
                                                onClick={() => copyToClipboard(createdPlan.id, 'Plan ID')}
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </div>

                                    <div className="detail-row">
                                        <span className="label">Plan Name:</span>
                                        <span className="value">{createdPlan.name}</span>
                                    </div>

                                    <div className="detail-row">
                                        <span className="label">Amount:</span>
                                        <span className="value">₹{createdPlan.amount} / month</span>
                                    </div>

                                    <div className="detail-row">
                                        <span className="label">Currency:</span>
                                        <span className="value">{createdPlan.currency}</span>
                                    </div>

                                    <div className="detail-row">
                                        <span className="label">Billing Cycle:</span>
                                        <span className="value">Every {createdPlan.interval} {createdPlan.period}</span>
                                    </div>
                                </div>

                                <div className="info-box">
                                    <h4>💡 Important:</h4>
                                    <ul>
                                        <li>Save the Plan ID: <code>{createdPlan.id}</code></li>
                                        <li>Use this Plan ID to create subscriptions for all users</li>
                                        <li>You typically create the plan once and reuse it</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* View Users Tab */}
            {activeTab === 'view-users' && (
                <div className="tab-content">
                    <div className="card">
                        <h2>User Subscriptions</h2>
                        <p className="help-text">View all users and their subscription status</p>

                        <div className="users-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Phone</th>
                                        <th>Status</th>
                                        <th>Expiry</th>
                                        <th>Days Left</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>
                                                No users found
                                            </td>
                                        </tr>
                                    ) : (
                                        users.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(user => {
                                            const daysLeft = getDaysRemaining(user.subscription_expiry);
                                            const isActive = user.subscription_status === 'active' && (user.subscription_expiry === null || daysLeft > 0);

                                            return (
                                                <tr key={user.id}>
                                                    <td>{user.full_name}</td>
                                                    <td>{user.email}</td>
                                                    <td>{user.phone || 'N/A'}</td>
                                                    <td>
                                                        <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
                                                            {isActive ? '✅ Active' : '❌ Inactive'}
                                                        </span>
                                                    </td>
                                                    <td>{formatDate(user.subscription_expiry)}</td>
                                                    <td>
                                                        <span className={daysLeft <= 3 && daysLeft > 0 ? 'warning' : ''}>
                                                            {isActive ? (user.subscription_expiry === null ? 'Lifetime' : `${daysLeft} days`) : 'Expired'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {!isActive && (
                                                            <button
                                                                className="btn btn-small btn-primary"
                                                                onClick={() => handleManualActivate(user.id)}
                                                                title="Manually Activate"
                                                            >
                                                                Verify & Activate
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {users.length > itemsPerPage && (
                            <div className="pagination">
                                <p className="pagination-info">
                                    Showing {Math.min(users.length, (currentPage - 1) * itemsPerPage + 1)} to {Math.min(users.length, currentPage * itemsPerPage)} of {users.length} users
                                </p>
                                <div className="pagination-buttons">
                                    <button
                                        className="btn btn-small btn-secondary"
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                    >
                                        Previous
                                    </button>
                                    <span className="page-number">Page {currentPage} of {Math.ceil(users.length / itemsPerPage)}</span>
                                    <button
                                        className="btn btn-small btn-secondary"
                                        onClick={() => setCurrentPage(prev => Math.min(Math.ceil(users.length / itemsPerPage), prev + 1))}
                                        disabled={currentPage === Math.ceil(users.length / itemsPerPage)}
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
        .subscription-management {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h1 {
          font-size: 28px;
          font-weight: 700;
          color: #1f2937;
          margin: 0 0 8px 0;
        }

        .page-header p {
          color: #6b7280;
          margin: 0;
        }

        .tabs {
          display: flex;
          gap: 8px;
          margin-bottom: 24px;
          border-bottom: 2px solid #e5e7eb;
        }

        .tab {
          padding: 12px 24px;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          cursor: pointer;
          font-size: 15px;
          font-weight: 500;
          color: #6b7280;
          transition: all 0.2s;
        }

        .tab:hover {
          color: #4f46e5;
          background: #f9fafb;
        }

        .tab.active {
          color: #4f46e5;
          border-bottom-color: #4f46e5;
        }

        .message {
          padding: 16px;
          border-radius: 8px;
          margin-bottom: 24px;
          font-weight: 500;
        }

        .message.success {
          background: #d1fae5;
          border: 1px solid #10b981;
          color: #065f46;
        }

        .message.error {
          background: #fee2e2;
          border: 1px solid #ef4444;
          color: #991b1b;
        }

        .card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          padding: 32px;
        }

        .card h2 {
          font-size: 22px;
          font-weight: 600;
          color: #1f2937;
          margin: 0 0 8px 0;
        }

        .help-text {
          color: #6b7280;
          margin: 0 0 24px 0;
          font-size: 14px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-group label {
          display: block;
          font-weight: 500;
          color: #374151;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .form-group small {
          display: block;
          color: #6b7280;
          font-size: 12px;
          margin-top: 4px;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .btn-small {
          padding: 6px 12px;
          font-size: 12px;
          border-radius: 4px;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #6366f1;
          color: white;
        }

        .btn-primary:not(:disabled):hover {
          background: #4f46e5;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px rgba(99, 102, 241, 0.3);
        }

        .btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .btn-secondary:hover {
          background: #e5e7eb;
        }

        .btn-whatsapp {
          background: #25d366;
          color: white;
        }

        .btn-whatsapp:hover {
          background: #20ba5a;
        }

        .btn-copy {
          background: #3b82f6;
          color: white;
          padding: 8px 16px;
        }

        .btn-copy:hover {
          background: #2563eb;
        }

        .btn-link {
          background: #8b5cf6;
          color: white;
          text-decoration: none;
        }

        .btn-link:hover {
          background: #7c3aed;
        }

        .btn-icon {
          background: transparent;
          border: none;
          cursor: pointer;
          font-size: 16px;
          padding: 4px;
        }

        .payment-result {
          margin-top: 32px;
          padding-top: 32px;
          border-top: 2px solid #e5e7eb;
        }

        .success-banner {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 24px;
        }

        .success-banner h3 {
          margin: 0 0 4px 0;
          font-size: 18px;
        }

        .success-banner p {
          margin: 0;
          opacity: 0.9;
          font-size: 14px;
        }

        .success-banner code {
          background: rgba(255, 255, 255, 0.2);
          padding: 2px 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
        }

        .payment-link-box {
          margin-bottom: 24px;
        }

        .payment-link-box label {
          display: block;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
        }

        .link-display {
          display: flex;
          gap: 8px;
        }

        .link-display input {
          flex: 1;
          padding: 12px;
          border: 2px solid #6366f1;
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          background: #f9fafb;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .info-box {
          background: #eff6ff;
          border: 1px solid #3b82f6;
          border-radius: 8px;
          padding: 20px;
        }

        .info-box h4 {
          margin: 0 0 12px 0;
          color: #1e40af;
          font-size: 16px;
        }

        .info-box ol,
        .info-box ul {
          margin: 0;
          padding-left: 20px;
          color: #1e40af;
        }

        .info-box li {
          margin-bottom: 8px;
        }

        .info-box code {
          background: rgba(59, 130, 246, 0.1);
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }

        .created-plan {
          margin-top: 32px;
          padding-top: 32px;
          border-top: 2px solid #e5e7eb;
        }

        .plan-details {
          background: #f9fafb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row .label {
          font-weight: 500;
          color: #6b7280;
        }

        .detail-row .value {
          color: #1f2937;
          font-weight: 500;
        }

        .detail-row code {
          background: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          border: 1px solid #d1d5db;
        }

        .value-with-copy {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .users-table {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          background: #f9fafb;
        }

        th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 2px solid #e5e7eb;
        }

        td {
          padding: 16px 12px;
          border-bottom: 1px solid #e5e7eb;
          color: #1f2937;
          font-size: 14px;
        }

        tbody tr:hover {
          background: #f9fafb;
        }

        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .status-badge.active {
          background: #d1fae5;
          color: #065f46;
        }

        .status-badge.inactive {
          background: #fee2e2;
          color: #991b1b;
        }

        .warning {
          color: #f59e0b;
          font-weight: 600;
        }

        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .pagination-info {
          font-size: 14px;
          color: #6b7280;
        }

        .pagination-buttons {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .page-number {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }
      `}</style>
        </div>
    );
};

export default SubscriptionManagement;
