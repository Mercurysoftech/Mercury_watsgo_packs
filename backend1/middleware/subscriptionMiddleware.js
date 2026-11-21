const { pool } = require('../config/database');

/**
 * Middleware to check if the user has an active subscription
 * Blocks access if subscription is expired or inactive
 */
const requireActiveSubscription = async (req, res, next) => {
    try {
        // Get user's subscription status OR their creator's status if they are staff
        const [users] = await pool.query(
            `SELECT u.id, u.role, u.created_by,
                    COALESCE(admin.subscription_status, u.subscription_status) as subscription_status,
                    COALESCE(admin.subscription_expiry, u.subscription_expiry) as subscription_expiry
             FROM users u
             LEFT JOIN users admin ON u.created_by = admin.id AND u.role = 'staff'
             WHERE u.id = ?`,
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                error: 'User not found',
                subscriptionRequired: true
            });
        }

        const user = users[0];
        const now = new Date();
        const expiry = user.subscription_expiry ? new Date(user.subscription_expiry) : null;

        // A user is active ONLY if status is 'active' AND expiry is in the future
        const isActive = user.subscription_status === 'active' && (expiry && expiry > now);

        if (!isActive) {
            const daysExpired = expiry ? Math.abs(Math.ceil((now - expiry) / (1000 * 60 * 60 * 24))) : 0;

            return res.status(403).json({
                error: 'Subscription required',
                message: expiry
                    ? `Your subscription expired ${daysExpired} day(s) ago. Please renew to continue.`
                    : 'Please subscribe to access this feature.',
                subscriptionRequired: true,
                subscriptionStatus: {
                    status: 'inactive',
                    expiry: user.subscription_expiry,
                    daysExpired: daysExpired
                }
            });
        }

        // Calculate days remaining
        const daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        // Warn if subscription is expiring soon (within 3 days)
        if (daysRemaining <= 3 && daysRemaining > 0) {
            console.warn(`⚠️ User ${req.userId} subscription expiring in ${daysRemaining} day(s)`);
        }

        // Add subscription info to request object
        req.subscription = {
            status: 'active',
            expiry: user.subscription_expiry,
            daysRemaining: daysRemaining
        };

        next();

    } catch (error) {
        console.error('Subscription middleware error:', error);
        res.status(500).json({
            error: 'Failed to verify subscription status',
            details: error.message
        });
    }
};

/**
 * Middleware to check subscription and warn but don't block
 * Useful for showing warnings in UI without blocking access
 */
const checkSubscription = async (req, res, next) => {
    try {
        const [users] = await pool.query(
            `SELECT u.subscription_status, u.subscription_expiry, u.role, u.created_by,
                    COALESCE(admin.subscription_status, u.subscription_status) as effective_status,
                    COALESCE(admin.subscription_expiry, u.subscription_expiry) as effective_expiry
             FROM users u
             LEFT JOIN users admin ON u.created_by = admin.id AND u.role = 'staff'
             WHERE u.id = ?`,
            [req.userId]
        );

        if (users.length > 0) {
            const user = users[0];
            const now = new Date();
            const expiry = user.effective_expiry ? new Date(user.effective_expiry) : null;
            const isActive = user.effective_status === 'active' && (expiry && expiry > now);

            req.subscription = {
                status: isActive ? 'active' : 'inactive',
                expiry: user.effective_expiry,
                daysRemaining: expiry && expiry > now
                    ? Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
                    : 0
            };
        }

        next();

    } catch (error) {
        console.error('Check subscription error:', error);
        // Don't block on error, just proceed
        next();
    }
};

module.exports = {
    requireActiveSubscription,
    checkSubscription
};
