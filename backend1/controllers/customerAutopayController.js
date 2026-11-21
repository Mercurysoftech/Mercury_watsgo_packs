const Razorpay = require('razorpay');
const { pool } = require('../config/database');
const messagingService = require('../services/messagingService');

exports.generateCustomerAutopayLink = async (req, res) => {
    try {
        const { customerId, amount, packName, renewalCycle } = req.body;

        if (!customerId || !amount) {
            return res.status(400).json({ error: 'Customer ID and amount are required' });
        }

        // --- Free Plan Block ---
        const [ownerRows] = await pool.query(
            'SELECT plan_type, subscription_status, subscription_expiry FROM users WHERE id = ?',
            [req.ownerId]
        );
        const owner = ownerRows[0] || {};
        const isActive = (owner.subscription_status === 'active' &&
            owner.subscription_expiry && new Date(owner.subscription_expiry) > new Date()) ||
            owner.plan_type === 'free';

        if (owner.plan_type === 'free') {
            return res.status(403).json({
                error: 'Customer Auto-payments are not available on the Free Plan. Please upgrade to Pro or Enterprise to enable this feature.',
                planRestricted: true
            });
        }
        // -----------------------

        // --- FETCH SHOP OWNER'S RAZORPAY KEYS FROM SETTINGS ---
        const [settingsResult] = await pool.query(
            'SELECT * FROM settings WHERE user_id = ?',
            [req.ownerId]
        );
        const settings = settingsResult[0] || {};

        const rzpKeyId = settings.razorpay_key_id || process.env.RAZORPAY_KEY_ID;
        const rzpKeySecret = settings.razorpay_key_secret || process.env.RAZORPAY_KEY_SECRET;

        // Use individual shop owner's credentials
        const razorpayInstance = new Razorpay({
            key_id: rzpKeyId,
            key_secret: rzpKeySecret
        });

        // 1. Create a dynamic Razorpay Plan for this customer's pack
        const plan = await razorpayInstance.plans.create({
            period: renewalCycle === 'weekly' ? 'weekly' : 'monthly',
            interval: 1,
            item: {
                name: packName || 'Fruit Pack Subscription',
                amount: amount * 100, // paise
                currency: 'INR',
                description: `Auto-payment for ${packName || 'Fruit Pack'}`
            }
        });

        // Get full customer and pack data for message preparation
        const [customers] = await pool.query(`
            SELECT c.*, p.name as pack_name, p.price as pack_price 
            FROM customers c 
            LEFT JOIN packs p ON c.pack_id = p.id 
            WHERE c.id = ? AND c.user_id = ?
        `, [customerId, req.ownerId]);

        if (customers.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // 2. Create the Subscription
        const subscription = await razorpayInstance.subscriptions.create({
            plan_id: plan.id,
            customer_notify: 1,
            total_count: 50, // Auto-charge up to 50 times
            notes: {
                payment_type: 'customer_autopay',
                customer_id: customerId, // Critical: helps webhook identify it's a customer
                user_id: req.ownerId // Shop owner ID
            }
        });

        // 3. Save to database
        await pool.query(
            `UPDATE customers 
             SET razorpay_plan_id = ?, razorpay_subscription_id = ?, autopay_status = 'pending' 
             WHERE id = ?`,
            [plan.id, subscription.id, customerId]
        );

        // 4. Send the Autopay Setup Link directly to
        //    Customer's WhatsApp via the integrated Messaging Service
        const customer = customers[0];
        const businessName = settings.business_name || "Fresh Fruit Packs";

        // Check if there's a JSON template for WhatsApp (common for Pro/Enterprise)
        let messageText = '';
        const isPremiumTemplate = settings.whatsapp_reminder_template && settings.whatsapp_reminder_template.trim().startsWith('{');
        
        if (isPremiumTemplate) {
            console.log("Using premium JSON template for Autopay link...");
            // Use prepareMessage from messageHelper to populate the template with the short_url
            const { prepareMessage } = require('../services/messageHelper');
            messageText = prepareMessage(customer, settings, subscription.short_url);
        } else {
            // Default plain text message if no template is set or it's just raw text
            messageText = `Hi ${customer.name},\n\nPlease safely set up your recurring Auto-Payment for your ${packName || 'monthly pack'} here.\n\n*Just like Netflix, this will automatically deduct your renewal amount securely via UPI or Card when it's due.*\n\n👉 Click here to activate Auto-pay: ${subscription.short_url}\n\nThank you,\n${businessName}`;
        }

        console.log(`Attempting to send Autopay link to customer ${customer.mobile} via WhatsApp...`);

        // Attempt to send via WhatsApp Cloud API
        let sentStatus = "generated only (WhatsApp failed)";
        try {
            if (settings.whatsapp_enabled) {
                const waResponse = await messagingService.sendWhatsApp(
                    customer.mobile,
                    messageText,
                    settings.whatsapp_api_key,
                    settings.whatsapp_phone_number_id
                );

                if (waResponse.success) {
                    sentStatus = "sent via WhatsApp";
                    console.log("✅ WhatsApp autopay message sent successfully.");
                } else {
                    console.warn("❌ WhatsApp failed:", waResponse.error);
                    sentStatus = `WhatsApp failed (${waResponse.error})`;
                }
            } else {
                console.log("WhatsApp is disabled in settings.");
                sentStatus = "generated (WhatsApp disabled)";
            }
        } catch (msgError) {
            console.error("Critical error in sending WhatsApp message:", msgError.message);
            sentStatus = "generated (message error)";
        }

        res.json({
            success: true,
            message: `Autopay link generated and ${sentStatus}.`,
            paymentLink: subscription.short_url,
            subscriptionId: subscription.id
        });


    } catch (error) {
        console.error('Customer Autopay Error:', error);
        res.status(500).json({ error: 'Failed to create customer autopayment link', details: error.message });
    }
};
