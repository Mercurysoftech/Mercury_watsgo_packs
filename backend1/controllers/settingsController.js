const { pool } = require('../config/database');
const fs = require('fs');
const path = require('path');

// --- Migration Check for settings ---
(async () => {
    try {
        const [cols] = await pool.query('SHOW COLUMNS FROM settings');
        const colNames = cols.map(c => c.Field);
        if (!colNames.includes('custom_charge_name')) {
            console.log('Running migration: Adding custom charge fields to settings');
            await pool.query('ALTER TABLE settings ADD COLUMN custom_charge_name VARCHAR(255) DEFAULT "Charge"');
            await pool.query('ALTER TABLE settings ADD COLUMN custom_charge_amount DECIMAL(10, 2) DEFAULT 0');
        }
        if (!colNames.includes('business_type')) {
            console.log('Running migration: Adding business_type to settings');
            await pool.query('ALTER TABLE settings ADD COLUMN business_type ENUM("fruits", "food", "dairy") DEFAULT "fruits"');
        } else {
            try {
                await pool.query('ALTER TABLE settings MODIFY COLUMN business_type ENUM("fruits", "food", "dairy") DEFAULT "fruits"');
            } catch (e) {}
        }
        if (!colNames.includes('packaging_type')) {
            await pool.query('ALTER TABLE settings ADD COLUMN packaging_type ENUM("packet", "bottle") DEFAULT "packet"');
        }
        if (!colNames.includes('morning_shift_time')) {
            await pool.query('ALTER TABLE settings ADD COLUMN morning_shift_time VARCHAR(100) DEFAULT "05:00 AM - 07:00 AM"');
        }
        if (!colNames.includes('evening_shift_time')) {
            await pool.query('ALTER TABLE settings ADD COLUMN evening_shift_time VARCHAR(100) DEFAULT "05:00 PM - 07:00 PM"');
        }
        if (!colNames.includes('bottle_deposit')) {
            await pool.query('ALTER TABLE settings ADD COLUMN bottle_deposit DECIMAL(10, 2) DEFAULT 0');
        }
        if (!colNames.includes('is_free_shipping')) {
            console.log('Running migration: Adding is_free_shipping to settings');
            await pool.query('ALTER TABLE settings ADD COLUMN is_free_shipping TINYINT(1) DEFAULT 0');
        }
        if (!colNames.includes('whatsapp_otp_template')) {
            console.log('Running migration: Adding whatsapp_otp_template to settings');
            await pool.query('ALTER TABLE settings ADD COLUMN whatsapp_otp_template VARCHAR(255) DEFAULT "otp_verification"');
        }
        if (!colNames.includes('invoice_prefix')) {
            console.log('Running migration: Adding invoice_prefix to settings');
            await pool.query('ALTER TABLE settings ADD COLUMN invoice_prefix VARCHAR(50) DEFAULT "INV-"');
        }
        if (!colNames.includes('invoice_start_number')) {
            console.log('Running migration: Adding invoice_start_number to settings');
            await pool.query('ALTER TABLE settings ADD COLUMN invoice_start_number INT DEFAULT 1');
        }
        if (!colNames.includes('timezone')) {
            console.log('Running migration: Adding timezone to settings');
            await pool.query('ALTER TABLE settings ADD COLUMN timezone VARCHAR(100) DEFAULT "Asia/Kolkata"');
        }
        
        const [phCols] = await pool.query('SHOW COLUMNS FROM payment_history');
        const phNames = phCols.map(c => c.Field);
        if (!phNames.includes('invoice_seq')) {
            console.log('Running migration: Adding invoice_seq to payment_history');
            await pool.query('ALTER TABLE payment_history ADD COLUMN invoice_seq INT NULL');
        }
        if (!phNames.includes('invoice_string')) {
            console.log('Running migration: Adding invoice_string to payment_history');
            await pool.query('ALTER TABLE payment_history ADD COLUMN invoice_string VARCHAR(100) NULL');
        }
    } catch (e) {
        console.error('Settings migration check failed:', e.message);
    }
})();
// ----------------------------------------------

// Get settings for logged in user
exports.getSettings = async (req, res) => {
    try {
        const [settings] = await pool.query(
            `SELECT s.*, u.plan_type 
             FROM settings s
             JOIN users u ON s.user_id = u.id
             WHERE s.user_id = ?`,
            [req.ownerId]
        );

        if (settings.length === 0) {
            // Create default settings if not exists
            const defaultText = 'Hi {{customer_name}}, your monthly fruit pack subscription is due for renewal on {{renewal_date}}. Please complete your payment using the link below:\n{{payment_info}}\nRenew now to continue enjoying fresh fruits.\n– {{business_name}}';

            await pool.query(
                `INSERT INTO settings (user_id, whatsapp_reminder_template, reminder_time)
                 VALUES (?, ?, ?)`,
                [req.ownerId, defaultText, '09:00']
            );

            // Re-fetch to get the join with users
            const [retry] = await pool.query(
                `SELECT s.*, u.plan_type FROM settings s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?`,
                [req.ownerId]
            );
            settings = retry;
        }

        const s = settings[0];

        // --- PRO/ENTERPRISE TEMPLATE AUTO-SYNC ---
        // If they are Pro/Enterprise but have a text template, upgrade to JSON
        const isJSON = s.whatsapp_reminder_template && s.whatsapp_reminder_template.trim().startsWith('{');
        if ((s.plan_type === 'pro' || s.plan_type === 'enterprise') && !isJSON) {

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

            await pool.query('UPDATE settings SET whatsapp_reminder_template = ? WHERE user_id = ?', [premiumTemplate, req.ownerId]);
            s.whatsapp_reminder_template = premiumTemplate;
        }
        // ----------------------------------------

        const formatted = formatSettings(s);
        res.json({
            success: true,
            settings: formatted
        });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Failed to get settings' });
    }
};

// Update settings
exports.updateSettings = async (req, res) => {
    try {
        const {
            businessName, contactEmail, contactPhone, address, emailNotifications,
            reminderDaysBefore, defaultPackPrice, currency, whatsappEnabled,
            whatsappApiKey, whatsappPhoneNumberId, whatsappBusinessAccountId,
            whatsappReminderTemplate, reminderTime, razorpayKeyId,
            razorpayKeySecret, upiId, preferredPaymentMethod, businessLogo,
            deliveryCharges, deliveryFreeKm, deliveryPricePerKm, googleMapsApiKey,
            privacyPolicy, termsConditions, businessType, isFreeShipping, whatsappOtpTemplate,
            invoicePrefix, invoiceStartNumber
        } = req.body;

        // Force reload from DB to handle masks
        const [rows] = await pool.query('SELECT * FROM settings WHERE user_id = ?', [req.ownerId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Settings not found' });
        const existing = rows[0];

        let logoToSave = businessLogo || existing.business_logo;
        if (businessLogo && businessLogo.startsWith('data:image')) {
            try {
                const dir = path.join(__dirname, '..', 'uploads', 'logos');
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                const ext = businessLogo.split(';')[0].split('/')[1];
                const fileName = `logo_${req.ownerId}.${ext}`;
                const base64Data = businessLogo.replace(/^data:image\/\w+;base64,/, "");
                fs.writeFileSync(path.join(dir, fileName), base64Data, 'base64');
                logoToSave = `/uploads/logos/${fileName}?t=${Date.now()}`;
            } catch (err) {
                console.error('Logo save error:', err);
            }
        }

        const updates = {
            business_name: businessName,
            contact_email: contactEmail,
            contact_phone: contactPhone,
            address: address,
            email_notifications: emailNotifications ? 1 : 0,
            reminder_days_before: reminderDaysBefore,
            default_pack_price: defaultPackPrice,
            currency: currency,
            whatsapp_enabled: whatsappEnabled ? 1 : 0,
            whatsapp_reminder_template: whatsappReminderTemplate,
            reminder_time: reminderTime,
            preferred_payment_method: preferredPaymentMethod,
            // Only update the following IF they are not the mask '********'
            whatsapp_api_key: (whatsappApiKey === '********') ? existing.whatsapp_api_key : whatsappApiKey,
            whatsapp_phone_number_id: (whatsappPhoneNumberId === '********') ? existing.whatsapp_phone_number_id : whatsappPhoneNumberId,
            whatsapp_business_account_id: (whatsappBusinessAccountId === '********') ? existing.whatsapp_business_account_id : whatsappBusinessAccountId,
            razorpay_key_id: (razorpayKeyId === '********') ? existing.razorpay_key_id : razorpayKeyId,
            razorpay_key_secret: (razorpayKeySecret === '********') ? existing.razorpay_key_secret : razorpayKeySecret,
            upi_id: (upiId === '********') ? existing.upi_id : upiId,
            business_logo: logoToSave,
            delivery_charges: deliveryCharges,
            delivery_free_km: deliveryFreeKm,
            delivery_price_per_km: deliveryPricePerKm,
            google_maps_api_key: (googleMapsApiKey === '********') ? existing.google_maps_api_key : googleMapsApiKey,
            privacy_policy: privacyPolicy,
            terms_conditions: termsConditions,
            custom_charge_name: req.body.customChargeName,
            custom_charge_amount: req.body.customChargeAmount,
            business_type: businessType || 'fruits',
            packaging_type: req.body.packagingType || 'packet',
            morning_shift_time: req.body.morningShiftTime || '05:00 AM - 07:00 AM',
            evening_shift_time: req.body.eveningShiftTime || '05:00 PM - 07:00 PM',
            bottle_deposit: req.body.bottleDeposit ? parseFloat(req.body.bottleDeposit) : 0,
            is_free_shipping: isFreeShipping ? 1 : 0,
            whatsapp_otp_template: whatsappOtpTemplate || 'otp_verification',
            invoice_prefix: invoicePrefix !== undefined ? invoicePrefix : 'INV-',
            invoice_start_number: invoiceStartNumber ? parseInt(invoiceStartNumber) : 1,
            timezone: req.body.timezone || existing.timezone || 'Asia/Kolkata'
        };

        const updateKeys = Object.keys(updates);
        const updateValues = Object.values(updates);
        const setQuery = updateKeys.map(key => `${key} = ?`).join(', ');

        await pool.query(
            `UPDATE settings SET ${setQuery} WHERE user_id = ?`,
            [...updateValues, req.ownerId]
        );

        // --- NEW: Reset customer distances if business address or relevant delivery settings change ---
        const addressChanged = address && address !== existing.address;
        const pricingChanged = (deliveryFreeKm !== undefined && String(deliveryFreeKm) !== String(existing.delivery_free_km)) ||
            (deliveryPricePerKm !== undefined && String(deliveryPricePerKm) !== String(existing.delivery_price_per_km));

        if (addressChanged) {
            console.log(`[Settings] Business address changed for user ${req.ownerId}. Resetting all customer distances.`);
            await pool.query('UPDATE customers SET distance_km = 0, delivery_charge = 0 WHERE user_id = ?', [req.ownerId]);
        } else if (pricingChanged) {
            console.log(`[Settings] Delivery pricing changed for user ${req.ownerId}. Resetting all customer delivery charges.`);
            await pool.query('UPDATE customers SET delivery_charge = 0 WHERE user_id = ?', [req.ownerId]);
        }
        // ------------------------------------------------------------------------------------------

        res.json({ success: true, message: 'Settings updated successfully' });

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Failed' });
    }
};

// Helper function to format settings with masking for security
function formatSettings(settings) {
    const mask = (val) => (val && val.length > 0) ? '********' : '';

    return {
        businessName: settings.business_name || '',
        contactEmail: settings.contact_email || '',
        contactPhone: settings.contact_phone || '',
        address: settings.address || '',
        emailNotifications: Boolean(settings.email_notifications),
        reminderDaysBefore: settings.reminder_days_before || '3',
        defaultPackPrice: settings.default_pack_price ? String(settings.default_pack_price) : '999',
        currency: settings.currency || 'INR',
        whatsappEnabled: Boolean(settings.whatsapp_enabled),
        whatsappApiKey: mask(settings.whatsapp_api_key),
        whatsappPhoneNumberId: mask(settings.whatsapp_phone_number_id),
        whatsappBusinessAccountId: mask(settings.whatsapp_business_account_id),
        whatsappReminderTemplate: settings.whatsapp_reminder_template || '',
        reminderTime: settings.reminder_time || '09:00',
        timezone: settings.timezone || 'Asia/Kolkata',
        razorpayKeyId: mask(settings.razorpay_key_id),
        razorpayKeySecret: mask(settings.razorpay_key_secret),
        upiId: mask(settings.upi_id),
        preferredPaymentMethod: settings.preferred_payment_method || 'upi',
        planType: settings.plan_type || 'free',
        businessLogo: settings.business_logo || '',
        deliveryCharges: settings.delivery_charges ? String(settings.delivery_charges) : '0',
        deliveryFreeKm: settings.delivery_free_km ? String(settings.delivery_free_km) : '3',
        deliveryPricePerKm: settings.delivery_price_per_km ? String(settings.delivery_price_per_km) : '0',
        googleMapsApiKey: mask(settings.google_maps_api_key),
        privacyPolicy: settings.privacy_policy || '',
        termsConditions: settings.terms_conditions || '',
        customChargeName: settings.custom_charge_name || '',
        customChargeAmount: settings.custom_charge_amount ? String(settings.custom_charge_amount) : '0',
        businessType: settings.business_type || 'fruits',
        packagingType: settings.packaging_type || 'packet',
        morningShiftTime: settings.morning_shift_time || '05:00 AM - 07:00 AM',
        eveningShiftTime: settings.evening_shift_time || '05:00 PM - 07:00 PM',
        bottleDeposit: settings.bottle_deposit ? parseFloat(settings.bottle_deposit) : 0,
        isFreeShipping: Boolean(settings.is_free_shipping),
        whatsappOtpTemplate: settings.whatsapp_otp_template || 'otp_verification',
        invoicePrefix: settings.invoice_prefix || 'INV-',
        invoiceStartNumber: settings.invoice_start_number ? String(settings.invoice_start_number) : '1'
    };
}

module.exports = exports;
