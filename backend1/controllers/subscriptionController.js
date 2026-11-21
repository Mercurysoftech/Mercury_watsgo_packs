const Razorpay = require('razorpay');
const { pool } = require('../config/database');
const crypto = require('crypto');
const messagingService = require('../services/messagingService');

// Helper to get Razorpay instance (lazy initialization)
const getRazorpayInstance = () => {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    
    if (!keyId || !keySecret) {
        const missing = [];
        if (!keyId) missing.push('RAZORPAY_KEY_ID');
        if (!keySecret) missing.push('RAZORPAY_KEY_SECRET');
        console.error(`❌ Missing Razorpay credentials: ${missing.join(', ')} - Check your .env file`);
    }
    
    return new Razorpay({
        key_id: keyId || 'missing_key_id',
        key_secret: keySecret || 'missing_key_secret'
    });
};

/**
 * Get plan price from database
 */
const getPlanPrice = async (planType, billingPeriod) => {
    try {
        const [rows] = await pool.query(
            'SELECT price FROM subscription_plans WHERE plan_type = ? AND billing_period = ?',
            [planType, billingPeriod]
        );
        
        if (rows.length > 0) {
            return parseFloat(rows[0].price);
        }
        
        // Fallback prices for addons and safety
        const fallbackPrices = {
            starter: { monthly: 699, '3months': 1899, '6months': 3499, yearly: 6999 },
            growth: { monthly: 2499, '3months': 6999, '6months': 13999, yearly: 24999 },
            pro: { monthly: 4999, '3months': 13999, '6months': 27999, yearly: 49999 },
            basic: { monthly: 149, yearly: 1490 },
            delivery_boy: 99,
            customer_app: 299,
            extra_customer: 2,
            extra_staff: 99,
            zone: 49
        };

        if (fallbackPrices[planType]) {
            if (typeof fallbackPrices[planType] === 'object') {
                return fallbackPrices[planType][billingPeriod] || fallbackPrices[planType].monthly || 0;
            }
            return fallbackPrices[planType];
        }
        return 0;
    } catch (error) {
        console.error('❌ Error fetching plan price from DB:', error);
        return 0;
    }
};

async function saveSubscriptionHistory({ userId, razorpaySubscriptionId, razorpayPaymentId, planType, amount, currency, status, periodStart, periodEnd }) {
    try {
        if (!userId) {
            console.warn('⚠️ Cannot save subscription history: Missing userId');
            return;
        }

        // Check if user exists (role check could be too restrictive if user role isn't 'admin' for some reason)
        const [users] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            console.warn(`⚠️ Cannot save subscription history: User ${userId} not found`);
            return;
        }

        console.log(`📝 Attempting to save history for user ${userId}: ${status} (${planType})`);

        await pool.query(
            `INSERT INTO subscription_history 
             (user_id, razorpay_subscription_id, razorpay_payment_id, plan_type, amount, currency, status, period_start, period_end)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
                status = VALUES(status), 
                period_end = VALUES(period_end),
                plan_type = VALUES(plan_type)`,
            [
                userId,
                razorpaySubscriptionId,
                razorpayPaymentId || null,
                planType,
                amount,
                currency || 'INR',
                status,
                periodStart ? new Date(periodStart) : null,
                periodEnd ? new Date(periodEnd) : null
            ]
        );
        console.log(`✅ Subscription history saved for user ${userId} (${planType}, ${status}, ₹${amount})`);
    } catch (err) {
        console.error('❌ Error saving subscription history:', err.message);
    }
}

/**
 * Create a Razorpay subscription plan for monthly subscriptions
 */
const createSubscriptionPlan = async (req, res) => {
    try {
        const { planName, amount, description, planType, billingPeriod = 'monthly' } = req.body;

        if (!planName || !amount) {
            return res.status(400).json({ error: 'Plan name and amount are required' });
        }

        const razorpayInstance = getRazorpayInstance();
        
        let period = 'monthly';
        let interval = 1;

        if (billingPeriod === 'yearly') {
            period = 'yearly';
        } else if (billingPeriod === '3months') {
            period = 'monthly';
            interval = 3;
        } else if (billingPeriod === '6months') {
            period = 'monthly';
            interval = 6;
        }

        // Create Razorpay plan
        const plan = await razorpayInstance.plans.create({
            period: period,
            interval: interval,
            item: {
                name: planName,
                amount: amount * 100, // Amount in paise (multiply by 100)
                currency: 'INR',
                description: description || `${billingPeriod.charAt(0).toUpperCase() + billingPeriod.slice(1)} subscription for Fresh Fruit Packs`
            }
        });

        // 2b. Sync with subscription_plans table if plan_type matching
        if (planType) {
            try {
                await pool.query(
                    'UPDATE subscription_plans SET razorpay_plan_id = ? WHERE plan_type = ? AND billing_period = ?',
                    [plan.id, planType, billingPeriod]
                );
                console.log(`✅ Synced Razorpay plan ${plan.id} to subscription_plans for ${planType} (${billingPeriod})`);
            } catch (syncErr) {
                console.warn('⚠️ Could not sync razorpay_plan_id to DB:', syncErr.message);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Subscription plan created successfully',
            plan: {
                id: plan.id,
                name: plan.item.name,
                amount: plan.item.amount / 100,
                currency: plan.item.currency,
                period: plan.period,
                interval: plan.interval,
                planType: planType || 'pro'
            }
        });

    } catch (error) {
        const errorMsg = error.message || JSON.stringify(error);
        const statusCode = error.statusCode || 500;
        const errorDetails = error.error ? JSON.stringify(error.error) : errorMsg;
        
        console.error('❌ Create plan error:', {
            statusCode,
            message: errorMsg,
            details: errorDetails,
            error: error
        });
        
        res.status(statusCode === 401 ? 401 : 500).json({
            error: errorMsg || 'Failed to create subscription plan',
            message: error.message || 'Unknown error',
            statusCode: statusCode,
            details: statusCode === 401 ? 'Razorpay authentication failed - check API credentials' : errorDetails
        });
    }
};

/**
 * Create a subscription for a user
 */
const createSubscription = async (req, res) => {
    try {
        const { customerName, customerEmail, customerPhone, planType, billingPeriod = 'monthly' } = req.body;

        if (!customerName || !customerEmail || !customerPhone) {
            return res.status(400).json({
                error: 'Customer name, email, and phone are required'
            });
        }

        const resolvedPlanType = planType || 'starter';
        const razorpayInstance = getRazorpayInstance();

        // 1. Get current plan details from DB to ensure we use the correct price
        const [dbPlans] = await pool.query(
            'SELECT id, price, razorpay_plan_id, name FROM subscription_plans WHERE plan_type = ? AND billing_period = ?',
            [resolvedPlanType, billingPeriod]
        );

        if (dbPlans.length === 0) {
            return res.status(400).json({ error: `Plan type '${resolvedPlanType}' for period '${billingPeriod}' not found in database` });
        }

        const currentPrice = parseFloat(dbPlans[0].price);
        const planName = dbPlans[0].name;
        let finalPlanId = dbPlans[0].razorpay_plan_id;

        // 2. Verify if we need to create/recreate the plan due to price changes
        let needsNewPlan = !finalPlanId;

        if (finalPlanId) {
            try {
                // Fetch the plan from Razorpay to verify its current amount
                const rzpPlan = await razorpayInstance.plans.fetch(finalPlanId);
                // Razorpay amount is in paise, so we multiply by 100
                if (rzpPlan.amount !== Math.round(currentPrice * 100)) {
                    console.log(`⚠️ Price mismatch for plan ${finalPlanId}: Razorpay=₹${rzpPlan.amount/100}, DB=₹${currentPrice}. Recreating...`);
                    needsNewPlan = true;
                }
            } catch (err) {
                console.log(`⚠️ Plan ${finalPlanId} not found on Razorpay: ${err.message}. Recreating...`);
                needsNewPlan = true;
            }
        }

        if (needsNewPlan && currentPrice > 0) {
            console.log(`🔄 Creating new Razorpay plan for ${resolvedPlanType} (${billingPeriod}) at ₹${currentPrice}`);
            try {
                const newPlan = await razorpayInstance.plans.create({
                    period: billingPeriod === 'yearly' ? 'yearly' : 'monthly',
                    interval: billingPeriod === '3months' ? 3 : (billingPeriod === '6months' ? 6 : 1),
                    item: {
                        name: `${planName} - ${billingPeriod}`,
                        amount: Math.round(currentPrice * 100),
                        currency: 'INR',
                        description: `Subscription for ${planName} (${billingPeriod} billing cycle)`
                    }
                });
                finalPlanId = newPlan.id;
                // Update DB with the new valid plan ID
                await pool.query(
                    'UPDATE subscription_plans SET razorpay_plan_id = ? WHERE id = ?',
                    [finalPlanId, dbPlans[0].id]
                );
            } catch (err) {
                console.error('❌ Failed to create new Razorpay plan:', err);
                return res.status(500).json({ error: 'Failed to synchronize plan with Razorpay', details: err.message });
            }
        }

        if (!finalPlanId) {
            return res.status(400).json({ error: 'Valid Plan ID could not be determined. Please ensure the price is set correctly in DB.' });
        }
        
        let totalCount = 60; // Default 60 months
        if (billingPeriod === 'yearly') totalCount = 5;
        else if (billingPeriod === '3months') totalCount = 20; // 20 * 3 = 60 months
        else if (billingPeriod === '6months') totalCount = 10; // 10 * 6 = 60 months

        const subscription = await razorpayInstance.subscriptions.create({
            plan_id: finalPlanId,
            customer_notify: 1,
            quantity: 1,
            total_count: totalCount,
            notes: {
                user_id: req.userId,
                plan_type: resolvedPlanType,
                billing_period: billingPeriod,
                customer_name: customerName,
                customer_email: customerEmail,
                customer_phone: customerPhone
            }
        });
        console.log(`🆕 Razorpay subscription ${subscription.id} created for user ${req.userId} (${resolvedPlanType})`);

        // Record initial history (before payment) so user sees it in their "Payment History"
        try {
            const amount = await getPlanPrice(resolvedPlanType, billingPeriod);

            let durationDays = 30;
            if (billingPeriod === 'yearly') durationDays = 365;
            else if (billingPeriod === '3months') durationDays = 90;
            else if (billingPeriod === '6months') durationDays = 180;

            await saveSubscriptionHistory({
                userId: req.userId,
                razorpaySubscriptionId: subscription.id,
                razorpayPaymentId: null,
                planType: resolvedPlanType,
                amount: amount,
                currency: 'INR',
                status: 'created', // Event status
                periodStart: new Date(),
                periodEnd: new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000) // Initial estimate
            });
        } catch (histErr) {
            console.error('⚠️ Failed to save placeholder history:', histErr.message);
        }

        res.status(201).json({
            success: true,
            message: 'Subscription created successfully',
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            subscription: {
                id: subscription.id,
                plan_id: subscription.plan_id,
                status: subscription.status
            }
        });

    } catch (error) {
        const errorMsg = error.message || (error.error && error.error.description) || JSON.stringify(error);
        const statusCode = error.statusCode || 500;
        const errorDetails = error.error ? JSON.stringify(error.error) : errorMsg;
        
        // SELF-HEALING: If plan id is invalid, clear it from DB so next try recreates it
        if (error.error && error.error.description && (error.error.description.includes('plan_id') || error.error.description.includes('Plan ID'))) {
            console.log(`⚠️ Razorpay Plan ID ${planId} seems invalid. Clearing from DB for re-sync...`);
            try {
                await pool.query('UPDATE subscription_plans SET razorpay_plan_id = NULL WHERE razorpay_plan_id = ?', [planId]);
            } catch (dbErr) {
                console.error('Failed to clear invalid plan ID:', dbErr.message);
            }
        }

        console.error('❌ Create subscription error:', {
            statusCode,
            message: errorMsg,
            details: errorDetails,
            error: error
        });
        
        res.status(statusCode === 401 ? 401 : 500).json({
            error: errorMsg || 'Failed to create subscription',
            message: error.message || 'Unknown error',
            statusCode: statusCode,
            details: statusCode === 401 ? 'Razorpay authentication failed - check API credentials' : errorDetails
        });
    }
};

/**
 * Webhook handler for Razorpay events
 */
const handleWebhook = async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];

        if (!secret) {
            console.error('❌ RAZORPAY_WEBHOOK_SECRET is missing');
            return res.status(500).json({ error: 'Webhook secret not configured' });
        }

        // Verify webhook signature (using raw body for precision)
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(req.rawBody || JSON.stringify(req.body))
            .digest('hex');

        if (signature !== expectedSignature) {
            console.error('❌ Webhook Signature Verification Failed');
            console.error('Expected:', expectedSignature);
            console.error('Received:', signature);
            // In development, maybe let it through? But better to fix the root cause (rawBody).
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = req.body.event;
        const payload = req.body.payload;

        console.log(`📥 Webhook received: ${event}`);

        switch (event) {
            case 'subscription.activated':
                await handleSubscriptionActivated(payload.subscription.entity);
                break;

            case 'subscription.charged':
                await handleSubscriptionCharged(payload.subscription.entity, payload.payment?.entity);
                break;

            case 'subscription.completed':
                await handleSubscriptionCompleted(payload.subscription.entity);
                break;

            case 'subscription.cancelled':
            case 'subscription.halted':
            case 'subscription.paused':
                await handleSubscriptionInactive(payload.subscription.entity);
                break;

            default:
                console.log('Unhandled event:', event);
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
};

/**
 * Handle subscription activation
 */
async function handleSubscriptionActivated(subscription) {
    try {
        const paymentType = subscription.notes?.payment_type;

        // --- 1. IF END-CUSTOMER AUTOPAYMENT ---
        if (paymentType === 'customer_autopay') {
            const customerId = subscription.notes?.customer_id;
            if (!customerId) return;

            await pool.query(
                `UPDATE customers SET autopay_status = 'active', razorpay_subscription_id = ? WHERE id = ?`,
                [subscription.id, customerId]
            );
            console.log(`✅ Customer Autopay activated for customer ${customerId}`);
            return;
        }

        // --- 2. IF SHOP OWNER APP SUBSCRIPTION ---
        let userId = subscription.notes?.user_id || subscription.notes?.userId;
        const planType = subscription.notes?.plan_type || 'pro';
        const customerEmail = subscription.notes?.customer_email;
        const customerPhone = subscription.notes?.customer_phone;

        // Fallback: If no userId in notes, try to find user by email or phone
        if (!userId) {
            console.log('🔍 userId missing from notes, searching by email/phone...', { customerEmail, customerPhone });
            if (customerEmail || customerPhone) {
                const [foundUsers] = await pool.query(
                    'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
                    [customerEmail, customerPhone]
                );
                if (foundUsers.length > 0) {
                    userId = foundUsers[0].id;
                    console.log(`✅ Found user ${userId} via fallback search`);
                }
            }
        }

        if (!userId) {
            console.error('❌ No user_id found in subscription notes or fallback search');
            return;
        }

        // Calculate extension: If user already has an active subscription, extend from that date
        const [userRecord] = await pool.query('SELECT subscription_expiry FROM users WHERE id = ?', [userId]);
        const currentExpiry = userRecord[0]?.subscription_expiry;
        const now = new Date();
        const billingPeriod = subscription.notes?.billing_period || 'monthly';

        let periodStart, expiryDate;
        if (currentExpiry && new Date(currentExpiry) > now) {
            // Extend from current expiry
            periodStart = new Date(currentExpiry);
            expiryDate = new Date(currentExpiry);
        } else {
            // Start from activation date
            const startTimestamp = subscription.current_start || subscription.start_at || Math.floor(Date.now() / 1000);
            periodStart = new Date(startTimestamp * 1000);
            expiryDate = new Date(startTimestamp * 1000);
        }

        if (billingPeriod === 'yearly') {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
        } else if (billingPeriod === '3months') {
            expiryDate.setMonth(expiryDate.getMonth() + 3);
        } else if (billingPeriod === '6months') {
            expiryDate.setMonth(expiryDate.getMonth() + 6);
        } else {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
        }

        // Check if this is an addon or a main plan
        const isAddon = planType.startsWith('addon_') || ['delivery_boy', 'customer_app', 'extra_customer', 'extra_staff', 'zone'].includes(planType);

        if (isAddon) {
            // Determine which column to update
            let column = '';
            if (planType === 'delivery_boy') column = 'addon_delivery_boys';
            else if (planType === 'customer_app') column = 'addon_customer_app';
            else if (planType === 'extra_customer') column = 'addon_extra_customers';
            else if (planType === 'extra_staff') column = 'addon_extra_staff';
            else if (planType === 'zone') column = 'addon_extra_zones';

            if (column) {
                if (column === 'addon_customer_app') {
                    await pool.query(`UPDATE users SET ${column} = 1 WHERE id = ?`, [userId]);
                } else {
                    await pool.query(`UPDATE users SET ${column} = ${column} + 1 WHERE id = ?`, [userId]);
                }
                console.log(`✅ Addon ${planType} activated for user ${userId}`);
            }

            // For addons, we ensure status is active but don't overwrite main plan_type or expiry
            await pool.query(
                `UPDATE users SET subscription_status = 'active' WHERE id = ?`,
                [userId]
            );
        } else {
            // UPDATE DATABASE STATUS TO ACTIVE + plan_type + subscription_id
            await pool.query(
                `UPDATE users 
                 SET subscription_status = 'active', 
                     subscription_expiry = ?,
                     plan_type = ?,
                     razorpay_subscription_id = ?
                 WHERE id = ?`,
                [expiryDate, planType, subscription.id, userId]
            );
            console.log(`✅ Subscription status updated to active (${planType}) for user ${userId}`);
        }

        // Update default template if moving to Pro/Enterprise
        if (planType === 'pro' || planType === 'enterprise') {
            const premiumTemplate = JSON.stringify({
                type: "template",
                template: {
                    name: "remi_new",
                    language: { code: "en_US" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: "{{customer_name}}" },
                                { type: "text", text: "{{pack_price}}" },
                                { type: "text", text: "{{pack_name}}" },
                                { type: "text", text: "{{payment_url}}" },
                                { type: "text", text: "{{business_name}}" },
                                { type: "text", text: "{{renewal_date}}" }
                            ]
                        }
                    ]
                }
            }, null, 2);
            await pool.query(
                `UPDATE settings SET whatsapp_reminder_template = ? 
                 WHERE user_id = ? AND (whatsapp_reminder_template LIKE '%fruit pack subscription is due%' OR whatsapp_reminder_template IS NULL OR whatsapp_reminder_template = '')`,
                [premiumTemplate, userId]
            );
        }

        // Send confirmation message to user
        try {
            const [[userData]] = await pool.query('SELECT phone, full_name FROM users WHERE id = ?', [userId]);
            if (userData && userData.phone) {
                const message = `🎉 Congratulations ${userData.full_name}! Your Fresh Fruit Packs subscription has been successfully added and activated until ${expiryDate.toLocaleDateString()}. You now have full access to manage customers and send reminders. Thank you for subscribing!`;

                // Try WhatsApp
                console.log(`📤 Sending activation WhatsApp to ${userData.phone}...`);
                await messagingService.sendWhatsApp(userData.phone, message);
                console.log('✅ Activation WhatsApp sent');
            }
        } catch (msgErr) {
            console.error('⚠️ Failed to send activation notification:', msgErr.message);
            // Don't return, continue to save history
        }

        console.log(`✅ Subscription activated for user ${userId}, expires: ${expiryDate}`);

        const prices = {
            starter: { monthly: 699, '3months': 1899, '6months': 3499, yearly: 6999 },
            growth: { monthly: 2499, '3months': 6999, '6months': 13999, yearly: 24999 },
            pro: { monthly: 4999, '3months': 13999, '6months': 27999, yearly: 49999 }
        };

        let defaultAmount = 4999;
        if (prices[planType]) {
            defaultAmount = prices[planType][billingPeriod] || prices[planType].monthly;
        }

        await saveSubscriptionHistory({
            userId,
            razorpaySubscriptionId: subscription.id,
            razorpayPaymentId: null,
            planType: planType,
            amount: defaultAmount,
            currency: 'INR',
            status: 'activated',
            periodStart: periodStart,
            periodEnd: expiryDate
        });

    } catch (error) {
        console.error('Error handling subscription activation:', error);
    }
}

/**
 * Handle successful subscription charge
 */
async function handleSubscriptionCharged(subscription, payment) {
    try {
        const paymentType = subscription.notes?.payment_type;

        // --- 1. IF END-CUSTOMER AUTOPAYMENT ---
        if (paymentType === 'customer_autopay') {
            const customerId = subscription.notes?.customer_id;
            if (!customerId) return;

            // Automatically record the payment in payment_history!
            await pool.query(
                `INSERT INTO payment_history (customer_id, amount, payment_status, payment_method, razorpay_payment_id, transaction_date) 
                 VALUES (?, ?, 'paid', 'razorpay_autopay', ?, NOW())`,
                [customerId, payment.amount / 100, payment.id]
            );

            // Extend their renewal date and status
            await pool.query(
                `UPDATE customers 
                 SET paymentStatus = 'paid', autopay_status = 'active', lastPaymentDate = NOW()
                 WHERE id = ?`,
                [customerId]
            );

            console.log(`✅ Customer ${customerId} Autopaid successfully!`);
            return;
        }

        // --- 2. IF SHOP OWNER APP SUBSCRIPTION ---
        let userId = subscription.notes?.user_id || subscription.notes?.userId;
        const customerEmail = subscription.notes?.customer_email;
        const customerPhone = subscription.notes?.customer_phone;

        // Fallback: If no userId in notes, try to find user by email or phone
        if (!userId) {
            console.log('🔍 userId missing from charged notes, searching by email/phone...', { customerEmail, customerPhone });
            if (customerEmail || customerPhone) {
                const [foundUsers] = await pool.query(
                    'SELECT id FROM users WHERE email = ? OR phone = ? LIMIT 1',
                    [customerEmail, customerPhone]
                );
                if (foundUsers.length > 0) {
                    userId = foundUsers[0].id;
                    console.log(`✅ Found user ${userId} via fallback search`);
                }
            }
        }

        if (!userId) {
            console.error('❌ No user_id found in subscription charged notes or fallback');
            return;
        }

        // Extend subscription by 1 month from current expiry
        const [user] = await pool.query(
            'SELECT subscription_expiry FROM users WHERE id = ?',
            [userId]
        );

        let periodStart, newExpiry;
        const now = new Date();
        const billingPeriod = subscription.notes?.billing_period || 'monthly';

        if (user[0]?.subscription_expiry && new Date(user[0].subscription_expiry) > now) {
            // Extend from current expiry
            periodStart = new Date(user[0].subscription_expiry);
            newExpiry = new Date(user[0].subscription_expiry);
        } else {
            // Start from today or charge date
            periodStart = subscription.current_start ? new Date(subscription.current_start * 1000) : now;
            newExpiry = new Date(periodStart);
        }

        if (billingPeriod === 'yearly') {
            newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        } else if (billingPeriod === '3months') {
            newExpiry.setMonth(newExpiry.getMonth() + 3);
        } else if (billingPeriod === '6months') {
            newExpiry.setMonth(newExpiry.getMonth() + 6);
        } else {
            newExpiry.setMonth(newExpiry.getMonth() + 1);
        }

        const planType = subscription.notes?.plan_type || 'starter';
        const isAddon = planType.startsWith('addon_') || ['delivery_boy', 'customer_app', 'extra_customer', 'extra_staff', 'zone'].includes(planType);

        if (isAddon) {
            // For addons, we just ensure status is active on renewal charge
            await pool.query(
                `UPDATE users SET subscription_status = 'active' WHERE id = ?`,
                [userId]
            );
            console.log(`✅ Addon ${planType} charge processed for user ${userId}`);
        } else {
            await pool.query(
                `UPDATE users 
                 SET subscription_status = 'active',
                     subscription_expiry = ?,
                     plan_type = ?,
                     razorpay_subscription_id = ?
                 WHERE id = ?`,
                [newExpiry, planType, subscription.id, userId]
            );
            console.log(`✅ Subscription renewed (${planType}) for user ${userId}, new expiry: ${newExpiry}`);
        }

        // Send confirmation message to user
        const [[userData]] = await pool.query('SELECT phone, full_name FROM users WHERE id = ?', [userId]);
        if (userData && userData.phone) {
            const message = `✅ Your Fresh Fruit Packs subscription has been successfully renewed until ${newExpiry.toLocaleDateString()}. Thank you for your continued support!`;

            await messagingService.sendWhatsApp(userData.phone, message);
        }

        console.log(`✅ Subscription charged (${planType}) for user ${userId}, new expiry: ${newExpiry}`);

        const prices = {
            starter: { monthly: 699, '3months': 1899, '6months': 3499, yearly: 6999 },
            growth: { monthly: 2499, '3months': 6999, '6months': 13999, yearly: 24999 },
            pro: { monthly: 4999, '3months': 13999, '6months': 27999, yearly: 49999 }
        };

        let defaultAmount = 4999;
        if (prices[planType]) {
            defaultAmount = prices[planType][billingPeriod] || prices[planType].monthly;
        }

        // 3. RECORD IN SUBSCRIPTION HISTORY
        try {
            await saveSubscriptionHistory({
                userId,
                razorpaySubscriptionId: subscription.id,
                razorpayPaymentId: payment?.id || null, // Capture payment ID from the event if available
                planType: planType,
                amount: payment ? payment.amount / 100 : defaultAmount,
                currency: payment?.currency || 'INR',
                status: 'paid',
                periodStart: periodStart,
                periodEnd: newExpiry
            });
        } catch (histErr) {
            console.error('⚠️ Failed to save charged history:', histErr.message);
        }

    } catch (error) {
        console.error('Error handling subscription charge:', error);
    }
}

/**
 * Handle subscription completion
 */
async function handleSubscriptionCompleted(subscription) {
    try {
        const userId = subscription.notes?.user_id;
        if (!userId) return;

        await pool.query(
            `UPDATE users 
             SET subscription_status = 'inactive'
             WHERE id = ?`,
            [userId]
        );

        console.log(`⚠️ Subscription completed for user ${userId}`);

    } catch (error) {
        console.error('Error handling subscription completion:', error);
    }
}

/**
 * Handle subscription becoming inactive
 */
async function handleSubscriptionInactive(subscription) {
    try {
        const paymentType = subscription.notes?.payment_type;

        // --- 1. IF END-CUSTOMER AUTOPAYMENT ---
        if (paymentType === 'customer_autopay') {
            const customerId = subscription.notes?.customer_id;
            if (!customerId) return;

            await pool.query(
                `UPDATE customers SET autopay_status = 'inactive' WHERE id = ?`,
                [customerId]
            );
            console.log(`⚠️ Customer Autopay deactivated for customer ${customerId}`);
            return;
        }

        // --- 2. IF SHOP OWNER APP SUBSCRIPTION ---
        const userId = subscription.notes?.user_id || subscription.notes?.userId;
        if (!userId) return;

        const planType = subscription.notes?.plan_type || 'pro';
        const isAddon = planType.startsWith('addon_') || ['delivery_boy', 'customer_app', 'extra_customer', 'extra_staff', 'zone'].includes(planType);

        if (isAddon) {
            let column = '';
            if (planType === 'delivery_boy') column = 'addon_delivery_boys';
            else if (planType === 'customer_app') column = 'addon_customer_app';
            else if (planType === 'extra_customer') column = 'addon_extra_customers';
            else if (planType === 'extra_staff') column = 'addon_extra_staff';
            else if (planType === 'zone') column = 'addon_extra_zones';

            if (column) {
                if (column === 'addon_customer_app') {
                    await pool.query(`UPDATE users SET ${column} = 0 WHERE id = ?`, [userId]);
                } else {
                    await pool.query(`UPDATE users SET ${column} = GREATEST(0, ${column} - 1) WHERE id = ?`, [userId]);
                }
                console.log(`⚠️ Addon ${planType} deactivated for user ${userId}`);
            }
        } else {
            await pool.query(
                `UPDATE users 
                 SET subscription_status = 'inactive'
                 WHERE id = ?`,
                [userId]
            );
            console.log(`⚠️ Main subscription became inactive for user ${userId}`);
        }

    } catch (error) {
        console.error('Error handling subscription inactive:', error);
    }
}

/**
 * Get current user subscription status
 */
const getSubscriptionStatus = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.subscription_status, u.subscription_expiry, u.role, u.created_by, u.plan_type, u.razorpay_subscription_id,
                    u.addon_delivery_boys, u.addon_customer_app, u.addon_extra_customers, u.addon_extra_staff, u.addon_extra_zones,
                    COALESCE(admin.subscription_status, u.subscription_status) as effective_status,
                    COALESCE(admin.subscription_expiry, u.subscription_expiry) as effective_expiry,
                    COALESCE(admin.plan_type, u.plan_type) as effective_plan,
                    COALESCE(admin.razorpay_subscription_id, u.razorpay_subscription_id) as effective_sub_id,
                    COALESCE(admin.addon_delivery_boys, u.addon_delivery_boys) as effective_delivery_boys,
                    COALESCE(admin.addon_customer_app, u.addon_customer_app) as effective_customer_app,
                    COALESCE(admin.addon_extra_customers, u.addon_extra_customers) as effective_extra_customers,
                    COALESCE(admin.addon_extra_staff, u.addon_extra_staff) as effective_extra_staff,
                    COALESCE(admin.addon_extra_zones, u.addon_extra_zones) as effective_extra_zones
             FROM users u
             LEFT JOIN users admin ON u.created_by = admin.id AND u.role = 'staff'
             WHERE u.id = ?`,
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        const now = new Date();
        let expiry = user.effective_expiry ? new Date(user.effective_expiry) : null;

        // --- TRIAL INITIALIZATION FALLBACK ---
        // If they are on a legacy 'free' plan or new 'trial' but have no expiry date,
        // we set it to 10 days from registration/now to prevent immediate lockout.
        if ((!user.effective_plan || user.effective_plan === 'free' || user.effective_plan === 'trial' || user.effective_plan === 'basic') && !expiry && user.role === 'admin') {
            const trialExpiry = new Date();
            trialExpiry.setDate(trialExpiry.getDate() + 10);

            await pool.query(
                `UPDATE users SET subscription_expiry = ?, plan_type = 'basic', subscription_status = 'active' WHERE id = ?`,
                [trialExpiry, req.userId]
            );
            user.effective_status = 'active';
            user.effective_plan = 'basic';
            user.effective_expiry = trialExpiry;
            // Recalculate expiry for the check below
            expiry = trialExpiry;
            console.log(`✅ Basic Plan with 10-day trial initialized for user ${req.userId}`);
        }

        // A subscription is considered active if:
        // 1. It is explicitly marked as 'active' in DB
        // 2. OR it hasn't expired yet (grace period / cancelled but still valid)
        // 3. AND it's not a 'free' plan (unless 'active' status is set)
        const isExpired = expiry && expiry <= now;
        let isActive = (user.effective_status === 'active') || (!isExpired && expiry && user.effective_plan !== 'free');

        // Ensure trial/basic/free plans are handled correctly
        if (user.effective_plan === 'basic' || user.effective_plan === 'free' || user.effective_plan === 'trial') {
            // For these, we mainly trust the status and the expiry check
            isActive = (user.effective_status === 'active' && !isExpired);
        }

        // --- SAFETY SYNC FALLBACK ---
        // Always check Razorpay for admins to ensure the database matches reality (status, expiry, and plan_type)
        if (user.role === 'admin') {
            try {
                const razorpayInstance = getRazorpayInstance();

                // 1. Collect all subscription IDs to verify for this user
                const subIdsToCheck = new Set();

                // Add the one from users table
                if (user.effective_sub_id) subIdsToCheck.add(user.effective_sub_id);

                // Fetch recent IDs from history as well (just in case)
                const [historyRows] = await pool.query(
                    'SELECT DISTINCT razorpay_subscription_id FROM subscription_history WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 3 MONTH)',
                    [req.userId]
                );
                historyRows.forEach(row => {
                    if (row.razorpay_subscription_id && !row.razorpay_subscription_id.startsWith('MANUAL_')) {
                        subIdsToCheck.add(row.razorpay_subscription_id);
                    }
                });

                if (subIdsToCheck.size > 0) {
                    const activeSubs = [];

                    // Fetch status for each ID from Razorpay
                    for (const subId of subIdsToCheck) {
                        try {
                            const rzpSub = await razorpayInstance.subscriptions.fetch(subId);
                            if (rzpSub.status === 'active' || rzpSub.status === 'authenticated') {
                                activeSubs.push(rzpSub);
                            }
                        } catch (e) {
                            const errorMsg = e.message || (e.error?.description) || JSON.stringify(e);
                            const statusCode = e.statusCode || 'unknown';
                            console.warn(`⚠️ Could not fetch sub ${subId} (${statusCode}): ${errorMsg}`);
                        }
                    }

                    if (activeSubs.length > 0) {
                        // 1. Calculate MAX expiry among ALL active subscriptions (Plans + Addons)
                        const allExpiries = activeSubs.map(s => (s.current_end || s.end_at || 0) * 1000);
                        const maxExpiry = new Date(Math.max(...allExpiries));

                        // 2. Separate main plans from addons for plan_type determination
                        const mainPlans = activeSubs.filter(s => {
                            const pt = s.notes?.plan_type || 'pro';
                            return !pt.startsWith('addon_') && !['delivery_boy', 'customer_app', 'extra_customer', 'extra_staff', 'zone'].includes(pt);
                        });

                        let bestPlanType = 'basic';
                        let bestSubId = user.effective_sub_id;

                        if (mainPlans.length > 0) {
                            mainPlans.sort((a, b) => {
                                const levels = { 'pro': 3, 'growth': 2, 'starter': 1, 'basic': 0, 'free': 0, 'enterprise': 4, 'trial': 0 };
                                const levelA = levels[a.notes?.plan_type] || 0;
                                const levelB = levels[b.notes?.plan_type] || 0;
                                if (levelA !== levelB) return levelB - levelA;
                                return (b.current_end || 0) - (a.current_end || 0);
                            });
                            bestPlanType = mainPlans[0].notes?.plan_type || 'pro';
                            bestSubId = mainPlans[0].id;
                        } else if (user.effective_plan === 'trial') {
                            bestPlanType = 'trial'; // Maintain trial status if it hasn't expired elsewhere
                        }

                        // 3. Update User Record if status, plan, or expiry changed
                        const dbExpiry = user.effective_expiry ? new Date(user.effective_expiry) : null;
                        const isExpiryDifferent = !dbExpiry || Math.abs(dbExpiry.getTime() - maxExpiry.getTime()) > 3600000;

                        if (user.effective_status !== 'active' || user.effective_plan !== bestPlanType || isExpiryDifferent) {
                            console.log(`🔄 Safety Sync: User ${req.userId} status/plan/expiry updated (Plan: ${bestPlanType}, Max Expiry: ${maxExpiry})`);
                            await pool.query(
                                `UPDATE users SET subscription_status = 'active', subscription_expiry = ?, plan_type = ?, razorpay_subscription_id = ? WHERE id = ?`,
                                [maxExpiry, bestPlanType, bestSubId || null, req.userId]
                            );
                            isActive = true;
                            user.effective_status = 'active';
                            user.effective_expiry = maxExpiry;
                            user.effective_plan = bestPlanType;
                            user.effective_sub_id = bestSubId;
                        }

                        // 4. --- ADDON SYNC ---
                        const addonPlans = activeSubs.filter(s => {
                            const pt = s.notes?.plan_type;
                            return pt && (pt.startsWith('addon_') || ['delivery_boy', 'customer_app', 'extra_customer', 'extra_staff', 'zone'].includes(pt));
                        });

                        const counts = { deliveryBoys: 0, customerApp: 0, extraCustomers: 0, extraStaff: 0, extraZones: 0 };
                        addonPlans.forEach(s => {
                            const pt = s.notes.plan_type;
                            if (pt === 'delivery_boy') counts.deliveryBoys++;
                            else if (pt === 'customer_app') counts.customerApp = 1;
                            else if (pt === 'extra_customer') counts.extraCustomers++;
                            else if (pt === 'extra_staff') counts.extraStaff++;
                            else if (pt === 'zone') counts.extraZones++;
                        });

                        if (counts.deliveryBoys !== (user.effective_delivery_boys || 0) ||
                            counts.customerApp !== (user.effective_customer_app || 0) ||
                            counts.extraCustomers !== (user.effective_extra_customers || 0) ||
                            counts.extraStaff !== (user.effective_extra_staff || 0) ||
                            counts.extraZones !== (user.effective_extra_zones || 0)) {

                            console.log(`🔄 Safety Sync: Correcting addon counts for user ${req.userId}`);
                            await pool.query(
                                `UPDATE users SET addon_delivery_boys = ?, addon_customer_app = ?, addon_extra_customers = ?, addon_extra_staff = ?, addon_extra_zones = ? WHERE id = ?`,
                                [counts.deliveryBoys, counts.customerApp, counts.extraCustomers, counts.extraStaff, counts.extraZones, req.userId]
                            );

                            user.effective_delivery_boys = counts.deliveryBoys;
                            user.effective_customer_app = counts.customerApp;
                            user.effective_extra_customers = counts.extraCustomers;
                            user.effective_extra_staff = counts.extraStaff;
                            user.effective_extra_zones = counts.extraZones;
                        }
                    } else {
                        // No active subscriptions found at all
                        if (user.effective_plan !== 'free' && user.effective_plan !== 'trial' && user.effective_status === 'active') {
                            console.log(`🔄 Safety Sync: No active subs. Reverting user ${req.userId} to free.`);
                            await pool.query("UPDATE users SET subscription_status = 'inactive', plan_type = 'free' WHERE id = ?", [req.userId]);
                            user.effective_status = 'inactive';
                            user.effective_plan = 'free';
                            isActive = false;
                        }
                    }
                }
            } catch (rzpError) {
                console.error('Safety sync error:', rzpError.message);
            }
        }
        // ----------------------------

        const daysRemaining = (user.effective_expiry && new Date(user.effective_expiry) > now)
            ? Math.ceil((new Date(user.effective_expiry) - now) / (1000 * 60 * 60 * 24))
            : 0;

        res.json({
            success: true,
            subscription: {
                status: isActive ? 'active' : 'inactive',
                expiry: user.effective_expiry,
                planType: user.effective_plan || 'free',
                // If it is active, we should at least show 1 day remaining to avoid "0 days" confusion
                daysRemaining: (isActive && daysRemaining === 0) ? 1 : daysRemaining,
                razorpaySubscriptionId: user.effective_sub_id,
                addons: {
                    deliveryBoys: user.effective_delivery_boys || 0,
                    customerApp: user.effective_customer_app || 0,
                    extraCustomers: user.effective_extra_customers || 0,
                    extraStaff: user.effective_extra_staff || 0,
                    extraZones: user.effective_extra_zones || 0
                }
            }
        });

    } catch (error) {
        console.error('Get subscription status error:', error);
        res.status(500).json({ error: 'Failed to get subscription status' });
    }
};

/**
 * Cancel subscription
 */
const cancelSubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({ error: 'Subscription ID is required' });
        }

        const razorpayInstance = getRazorpayInstance();
        // Cancel in Razorpay
        const subscription = await razorpayInstance.subscriptions.cancel(subscriptionId);

        // Update in database
        await pool.query(
            `UPDATE users 
             SET subscription_status = 'inactive'
             WHERE id = ?`,
            [req.userId]
        );

        res.json({
            success: true,
            message: 'Subscription cancelled successfully',
            subscription: {
                id: subscription.id,
                status: subscription.status
            }
        });

    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            error: 'Failed to cancel subscription',
            details: error.message
        });
    }
};

/**
 * Manually activate a user's subscription (Admin only)
 */
const activateSubscription = async (req, res) => {
    try {
        const { userId, durationMonths = 1, expiryDate: customExpiry, planType = 'pro' } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        let expiryDate;
        let periodStart = new Date();

        if (customExpiry) {
            expiryDate = new Date(customExpiry);
        } else {
            // Default extension - check if user already has an active subscription
            const [userRecord] = await pool.query('SELECT subscription_expiry FROM users WHERE id = ?', [userId]);
            const currentExpiry = userRecord[0]?.subscription_expiry;
            const now = new Date();

            if (currentExpiry && new Date(currentExpiry) > now) {
                periodStart = new Date(currentExpiry);
                expiryDate = new Date(currentExpiry);
                expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
            } else {
                periodStart = now;
                expiryDate = new Date();
                expiryDate.setMonth(expiryDate.getMonth() + durationMonths);
            }
        }

        await pool.query(
            `UPDATE users 
             SET subscription_status = 'active', 
                 subscription_expiry = ?,
                 plan_type = ?
             WHERE id = ?`,
            [expiryDate, planType, userId]
        );

        // Update default template if moving to Pro/Enterprise
        if (planType === 'pro' || planType === 'enterprise') {
            const premiumTemplate = JSON.stringify({
                type: "template",
                template: {
                    name: "remi_new",
                    language: { code: "en_US" },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: "{{customer_name}}" },
                                { type: "text", text: "{{pack_price}}" },
                                { type: "text", text: "{{pack_name}}" },
                                { type: "text", text: "{{payment_url}}" },
                                { type: "text", text: "{{business_name}}" },
                                { type: "text", text: "{{renewal_date}}" }
                            ]
                        }
                    ]
                }
            }, null, 2);
            await pool.query(
                `UPDATE settings SET whatsapp_reminder_template = ? 
                 WHERE user_id = ? AND (whatsapp_reminder_template LIKE '%fruit pack subscription is due%' OR whatsapp_reminder_template IS NULL OR whatsapp_reminder_template = '')`,
                [premiumTemplate, userId]
            );
        }

        let defaultAmount = 699;
        if (planType === 'starter') defaultAmount = 699;
        else if (planType === 'growth') defaultAmount = 2499;
        else if (planType === 'pro') defaultAmount = 4999;

        // Save manual activation to subscription history
        await saveSubscriptionHistory({
            userId,
            razorpaySubscriptionId: 'MANUAL_' + Date.now(),
            razorpayPaymentId: null,
            planType: planType,
            amount: defaultAmount,
            currency: 'INR',
            status: 'paid',
            periodStart: periodStart,
            periodEnd: expiryDate
        });

        // Send confirmation message to user
        const [[userData]] = await pool.query('SELECT phone, full_name FROM users WHERE id = ?', [userId]);
        if (userData && userData.phone) {
            const message = `🎉 Your Fresh Fruit Packs subscription has been manually activated until ${expiryDate.toLocaleDateString()}! You now have full access to our services. Thank you!`;

            const waRes = await messagingService.sendWhatsApp(userData.phone, message);
            if (!waRes.success) {
                await messagingService.sendSMS(userData.phone, message);
            }
        }

        res.json({
            success: true,
            message: `User ${userId} activated successfully until ${expiryDate.toLocaleDateString()}`,
            expiryDate: expiryDate
        });

    } catch (error) {
        console.error('Manual activation error:', error);
        res.status(500).json({
            error: 'Failed to manually activate account',
            details: error.message
        });
    }
};

/**
 * Get admin subscription invoice/payment history from local DB
 */
const getInvoices = async (req, res) => {
    try {
        const adminId = req.ownerId || req.userId;

        const [rows] = await pool.query(
            `SELECT sh.*, u.full_name, u.email, u.business_name
             FROM subscription_history sh
             JOIN users u ON sh.user_id = u.id
             WHERE sh.user_id = ?
             ORDER BY sh.created_at DESC`,
            [adminId]
        );

        const invoices = rows.map(row => ({
            id: row.id,
            invoiceNumber: `INV-S${String(row.id).padStart(6, '0')}`,
            razorpaySubscriptionId: row.razorpay_subscription_id,
            razorpayPaymentId: row.razorpay_payment_id,
            planType: row.plan_type,
            amount: parseFloat(row.amount),
            currency: row.currency || 'INR',
            status: row.status,
            method: row.razorpay_payment_id ? 'Razorpay' : 'Manual',
            periodStart: row.period_start,
            periodEnd: row.period_end,
            createdAt: row.created_at,
            businessName: row.business_name || row.full_name,
            email: row.email
        }));

        res.json({ success: true, invoices });
    } catch (error) {
        console.error('Get invoices error:', error);
        res.status(500).json({ error: 'Failed to fetch invoices', details: error.message });
    }
};

/**
 * Download invoice as PDF from database
 */
const downloadInvoicePDF = async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const adminId = req.ownerId || req.userId;

        // Fetch invoice from database
        const [invoices] = await pool.query(
            `SELECT sh.*, u.full_name, u.email, u.business_name
             FROM subscription_history sh
             JOIN users u ON sh.user_id = u.id
             WHERE sh.id = ? AND sh.user_id = ?`,
            [invoiceId, adminId]
        );

        if (invoices.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoices[0];

        // --- PROACTIVE SYNC: If not paid in DB, check Razorpay one last time before PDF generation ---
        if (!['paid', 'activated', 'active'].includes(invoice.status?.toLowerCase())) {
            try {
                const razorpayInstance = getRazorpayInstance();
                const remoteSub = await razorpayInstance.subscriptions.fetch(invoice.razorpay_subscription_id);

                if (remoteSub.status === 'active' || remoteSub.status === 'authenticated') {
                    const expiryDate = new Date((remoteSub.current_end || remoteSub.end_at) * 1000);

                    // Update main status
                    await pool.query(
                        `UPDATE users SET subscription_status = 'active', subscription_expiry = ?, razorpay_subscription_id = ? WHERE id = ?`,
                        [expiryDate, remoteSub.id, adminId]
                    );

                    // Update history status
                    await pool.query(
                        'UPDATE subscription_history SET status = ?, razorpay_payment_id = ?, period_end = ? WHERE id = ?',
                        ['paid', remoteSub.payment_id || null, expiryDate, invoice.id]
                    );

                    // Refresh local invoice object for the PDF
                    invoice.status = 'paid';
                    invoice.razorpay_payment_id = remoteSub.payment_id;
                    invoice.period_end = expiryDate;
                }
            } catch (syncErr) {
                console.warn('⚠️ Proactive PDF Sync failed:', syncErr.message);
            }
        }

        // Generate PDF using pdfkit
        const PDFDocument = require('pdfkit');
        const path = require('path');
        const doc = new PDFDocument({
            margins: 40,
            bufferPages: true
        });

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="INV-S${String(invoice.id).padStart(6, '0')}.pdf"`);

        // Pipe PDF to response
        doc.pipe(res);

        // Logo
        try {
            const logoPath = path.join(__dirname, '..', '..', 'mercury logo.png.jpg');
            doc.image(logoPath, 50, 45, { width: 40 });
            // Move title to the right of logo
            doc.fontSize(24)
                .font('Helvetica-Bold')
                .text('Mercury Softech', 100, 50);
        } catch (err) {
            // Fallback if logo fails
            doc.fontSize(24)
                .font('Helvetica-Bold')
                .text('Mercury Softech', 50, 50);
        }

        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#666')
            .text('3rd Floor, GrandTowers, Cheran Salai', 50, 95)
            .text('LIC Colony, Ayyappa Nagar, K K Nagar', 50, 110)
            .text('Tiruchirappalli, Tamil Nadu 620021', 50, 125)
            .text('Phone: 063826 94426', 50, 140)
            .text('Email: mercurysoftechofficial@gmail.com', 50, 155)
            .text('Website: https://www.mercurysoftech.com/', 50, 170);

        // Invoice Title and Number
        doc.fontSize(18)
            .font('Helvetica-Bold')
            .fillColor('#000')
            .text('INVOICE', 400, 70);

        doc.fontSize(11)
            .font('Helvetica')
            .text(`Invoice #: INV-S${String(invoice.id).padStart(6, '0')}`, 400, 90)
            .text(`Date: ${new Date(invoice.created_at).toLocaleDateString('en-IN')}`, 400, 105);

        // Divider line
        doc.moveTo(50, 200)
            .lineTo(550, 200)
            .stroke('#333', 1);

        // Bill To section
        doc.fontSize(12)
            .font('Helvetica-Bold')
            .text('Bill To:', 50, 225);

        doc.fontSize(10)
            .font('Helvetica')
            .text(invoice.business_name || invoice.full_name, 50, 245)
            .text(invoice.email, 50, 260);

        // Invoice Details section
        const tableTop = 280;
        const col1 = 50;
        const col2 = 250;
        const col3 = 380;
        const col4 = 480;
        const rowHeight = 25;

        // Table Header
        doc.fontSize(11)
            .font('Helvetica-Bold')
            .fillColor('#fff')
            .rect(col1 - 10, tableTop, 500, 30)
            .fill('#2d3436')
            .fillColor('#fff')
            .text('Description', col1, tableTop + 8)
            .text('Qty', col3, tableTop + 8)
            .text('Amount', col4, tableTop + 8);

        // Table Data
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor('#000')
            .rect(col1 - 10, tableTop + 30, 500, rowHeight)
            .stroke('#e0e0e0')

            .text(`${invoice.planType === 'growth' ? 'Growth Plan' : (invoice.planType === 'pro' ? 'Pro Plan' : 'Starter Plan')}`, col1, tableTop + 40)
            .text('1', col3, tableTop + 40)
            .text(`Rs. ${parseFloat(invoice.amount).toLocaleString('en-IN')}`, col4, tableTop + 40);

        doc.fontSize(9)
            .fillColor('#666')
            .text('Monthly cloud service subscription for Watsgo Reminders platform.', col1, tableTop + 57, { width: 300 });

        // Totals section
        const totalsTop = tableTop + 120;

        doc.fontSize(11)
            .font('Helvetica')
            .fillColor('#000');

        // Subtotal
        doc.text('Subtotal:', col3, totalsTop)
            .text(`Rs. ${parseFloat(invoice.amount).toLocaleString('en-IN')}`, col4, totalsTop);

        // Tax
        doc.text('Tax (0%):', col3, totalsTop + 25)
            .text('Rs. 0.00', col4, totalsTop + 25);

        // Total
        doc.moveTo(col3, totalsTop + 50)
            .lineTo(550, totalsTop + 50)
            .stroke('#333', 1);

        doc.fontSize(13)
            .font('Helvetica-Bold')
            .text('Total Amount:', col3, totalsTop + 65)
            .text(`Rs. ${parseFloat(invoice.amount).toLocaleString('en-IN')}`, col4, totalsTop + 65);

        // Status
        const isPaid = ['paid', 'activated', 'active'].includes(invoice.status?.toLowerCase());
        doc.fontSize(10)
            .font('Helvetica')
            .fillColor(isPaid ? '#27ae60' : '#f39c12')
            .text(`Status: ${isPaid ? 'PAID' : 'PENDING'}`, 50, totalsTop + 100);

        // Period info
        if (invoice.period_start || invoice.period_end) {
            doc.fontSize(9)
                .fillColor('#666')
                .text(`Period: ${invoice.period_start ? new Date(invoice.period_start).toLocaleDateString('en-IN') : 'N/A'} - ${invoice.period_end ? new Date(invoice.period_end).toLocaleDateString('en-IN') : 'N/A'}`, 50, totalsTop + 125);
        }

        // Payment Method
        if (invoice.razorpay_payment_id || invoice.razorpay_subscription_id) {
            doc.fontSize(9)
                .text(`Payment Method: ${invoice.razorpay_payment_id ? 'Razorpay' : 'Manual'}`, 50, totalsTop + 145);
        }

        // Footer
        const footerTop = totalsTop + 180;
        doc.moveTo(50, footerTop)
            .lineTo(550, footerTop)
            .stroke('#e0e0e0', 1);

        doc.fontSize(9)
            .fillColor('#666')
            .text('Thank you for your business!', 50, footerTop + 15)
            .text('This is a computer-generated invoice and does not require a physical signature.', 50, footerTop + 30)
            .text('For any billing inquiries, please contact: mercurysoftechofficial@gmail.com', 50, footerTop + 45);

        // GST Information
        doc.fontSize(8)
            .text('GSTIN: 33ACBFM6385R1ZJ', 50, footerTop + 65)
            .text('© 2024 Mercury Softech. All rights reserved.', 50, footerTop + 78);

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Download invoice error:', error);
        res.status(500).json({ error: 'Failed to download invoice', details: error.message });
    }
};

/**
 * Get single invoice details
 */
const getInvoiceDetail = async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const adminId = req.ownerId || req.userId;

        const [invoices] = await pool.query(
            `SELECT sh.*, u.full_name, u.email, u.business_name
             FROM subscription_history sh
             JOIN users u ON sh.user_id = u.id
             WHERE sh.id = ? AND sh.user_id = ?`,
            [invoiceId, adminId]
        );

        if (invoices.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const row = invoices[0];
        const invoice = {
            id: row.id,
            invoiceNumber: `INV-S${String(row.id).padStart(6, '0')}`,
            razorpaySubscriptionId: row.razorpay_subscription_id,
            razorpayPaymentId: row.razorpay_payment_id,
            planType: row.plan_type,
            amount: parseFloat(row.amount),
            currency: row.currency || 'INR',
            status: row.status,
            method: row.razorpay_payment_id ? 'Razorpay' : 'Manual',
            periodStart: row.period_start,
            periodEnd: row.period_end,
            createdAt: row.created_at,
            businessName: row.business_name || row.full_name,
            email: row.email
        };

        res.json({ success: true, invoice });
    } catch (error) {
        console.error('Get invoice detail error:', error);
        res.status(500).json({ error: 'Failed to fetch invoice', details: error.message });
    }
};

/**
 * Manually verify a subscription status (fallback for webhooks)
 */
const verifySubscription = async (req, res) => {
    try {
        const { subscriptionId } = req.params;
        const userId = req.userId;

        if (!subscriptionId) {
            return res.status(400).json({ error: 'Subscription ID is required' });
        }

        console.log(`🔍 Manually verifying subscription: ${subscriptionId} for user: ${userId}`);
        const razorpayInstance = getRazorpayInstance();
        const subscription = await razorpayInstance.subscriptions.fetch(subscriptionId);

        if (!subscription) {
            return res.status(404).json({ error: 'Subscription not found in Razorpay' });
        }

        // Check if actually active/paid
        if (subscription.status === 'active' || subscription.status === 'authenticated') {
            // Handle extension from current expiry if it exists
            const [userRecord] = await pool.query('SELECT subscription_expiry FROM users WHERE id = ?', [userId]);
            const currentExpiry = userRecord[0]?.subscription_expiry;
            const now = new Date();

            const planType = subscription.notes?.plan_type || 'pro';
            let periodStart, expiryDate;
            if (currentExpiry && new Date(currentExpiry) > now) {
                // Extend from current expiry
                periodStart = new Date(currentExpiry);
                expiryDate = new Date(currentExpiry);
                expiryDate.setMonth(expiryDate.getMonth() + 1);
            } else {
                // Use Razorpay's dates
                expiryDate = new Date((subscription.current_end || subscription.end_at) * 1000);
                periodStart = new Date(subscription.current_start * 1000);
            }

            // Check if this is an addon or a main plan
            if (planType.startsWith('addon_') || ['delivery_boy', 'customer_app', 'extra_customer', 'extra_staff', 'zone'].includes(planType)) {
                // Determine which column to update
                let column = '';
                if (planType === 'delivery_boy') column = 'addon_delivery_boys';
                else if (planType === 'customer_app') column = 'addon_customer_app';
                else if (planType === 'extra_customer') column = 'addon_extra_customers';
                else if (planType === 'extra_staff') column = 'addon_extra_staff';
                else if (planType === 'zone') column = 'addon_extra_zones';

                if (column) {
                    if (column === 'addon_customer_app') {
                        await pool.query(`UPDATE users SET ${column} = 1 WHERE id = ?`, [userId]);
                    } else {
                        await pool.query(`UPDATE users SET ${column} = ${column} + 1 WHERE id = ?`, [userId]);
                    }
                    console.log(`✅ Addon ${planType} activated for user ${userId}`);
                }
            } else {
                // Update main subscription status
                await pool.query(
                    `UPDATE users SET subscription_status = 'active', subscription_expiry = ?, plan_type = ?, razorpay_subscription_id = ? WHERE id = ?`,
                    [expiryDate, planType, subscription.id, userId]
                );
            }

            const billingPeriod = subscription.notes?.billing_period || 'monthly';
            const amount = await getPlanPrice(planType, billingPeriod);

            // Update history
            await saveSubscriptionHistory({
                userId,
                razorpaySubscriptionId: subscription.id,
                razorpayPaymentId: subscription.payment_id || null, // Might be null if first charge hasn't fully cleared
                planType,
                amount: amount,
                currency: 'INR',
                status: 'paid', // Mark as paid since it's active
                periodStart: periodStart,
                periodEnd: expiryDate
            });

            return res.json({
                success: true,
                message: 'Subscription verified and activated',
                status: subscription.status,
                planType,
                expiry: expiryDate
            });
        }

        res.json({
            success: false,
            message: `Subscription status is ${subscription.status}`,
            status: subscription.status
        });

    } catch (error) {
        console.error('Verify subscription error:', error);
        res.status(500).json({ error: 'Failed to verify subscription', details: error.message });
    }
};

/**
 * Get all available subscription plans from database
 */
const getPlans = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM subscription_plans ORDER BY price ASC');
        
        // Structure plans by billing period for frontend convenience
        const plans = {
            monthly: [],
            '3months': [],
            '6months': [],
            yearly: []
        };
        const addons = [];
        
        // Define which types are considered addons
        const addonTypes = ['delivery_boy', 'customer_app', 'extra_customer', 'extra_staff', 'zone'];
        
        rows.forEach(row => {
            const plan = {
                id: row.id,
                type: row.plan_type,
                name: row.name,
                price: parseFloat(row.price),
                customers: row.customers,
                features: typeof row.features === 'string' ? JSON.parse(row.features) : row.features,
                popular: row.popular === 1,
                monthlyEquivalent: row.monthly_equivalent ? parseFloat(row.monthly_equivalent) : undefined,
                razorpayPlanId: row.razorpay_plan_id,
                billingPeriod: row.billing_period
            };
            
            if (addonTypes.includes(row.plan_type)) {
                addons.push(plan);
            } else if (plans[row.billing_period]) {
                plans[row.billing_period].push(plan);
            }
        });
        
        res.json({ success: true, plans, addons });
    } catch (error) {
        console.error('Get plans error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription plans' });
    }
};

module.exports = {
    createSubscriptionPlan,
    createSubscription,
    handleWebhook,
    getSubscriptionStatus,
    cancelSubscription,
    activateSubscription,
    getInvoices,
    downloadInvoicePDF,
    getInvoiceDetail,
    verifySubscription,
    getPlans
};

