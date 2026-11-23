const Razorpay = require('razorpay');
const { calculateCustomerTotal, formatPacksText } = require('./billingHelper');

/**
 * Generate a payment link based on user settings
 */
const getPaymentLink = async (customer, userSettings, forcedAmount = null, multiPacks = null) => {
    const billing = calculateCustomerTotal(multiPacks, customer, userSettings, forcedAmount);
    const amount = billing.grandTotal;
    const customerId = customer.id || customer.customer_id;
    const userId = userSettings.user_id || userSettings.id;

    if (userSettings.preferred_payment_method === 'razorpay' && userSettings.razorpay_key_id && userSettings.razorpay_key_secret) {
        try {
            const rzp = new Razorpay({
                key_id: userSettings.razorpay_key_id,
                key_secret: userSettings.razorpay_key_secret
            });

            const quantity = customer.quantity || 1;
            const pl = await rzp.paymentLink.create({
                amount: Math.round(amount * 100),
                currency: "INR",
                accept_partial: false,
                description: `Renewal for ${customer.pack_name || 'Subscription Pack'} (${quantity} packs)`,
                customer: {
                    name: customer.name,
                    contact: customer.mobile
                },
                notify: { whatsapp: false, sms: false },
                notes: {
                    customer_id: String(customerId),
                    user_id: String(userId)
                }
            });
            return pl.short_url;
        } catch (error) {
            console.error('Razorpay Link Error:', error.message || error.description || error);
            return null;
        }
    } else if (userSettings.preferred_payment_method === 'upi' && userSettings.upi_id) {
        const businessName = userSettings.business_name || 'Fresh Fruit Packs';
        const clientUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',')[0].trim() : '';
        const apiPrefix = process.env.API_PREFIX || '/packs/api';

        // Link to our own reliable custom backend direct UPI redirector
        return `${clientUrl}${apiPrefix}/pay?pa=${userSettings.upi_id}&am=${amount}&pn=${encodeURIComponent(businessName)}`;
    }
    return null;
};

/**
 * Replace placeholders in template text or JSON
 */
const prepareMessage = (customer, userSettings, paymentUrl = '', multiPacks = null, forcedAmount = null) => {
    const renewalDateRaw = customer.renewal_date || new Date();
    const renewalDate = new Date(renewalDateRaw).toLocaleDateString('en-GB', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });

    const packName = customer.pack_name || 'N/A';

    // Calculate billing breakdown using single source of truth
    const billing = calculateCustomerTotal(multiPacks, customer, userSettings, forcedAmount);
    const finalPacks = formatPacksText(multiPacks, customer);
    const packPrice = String(billing.packTotal).replace(/[₹,]/g, '').trim();
    const finalDelivery = billing.deliveryCharge;
    const finalChargeName = billing.customChargeName;
    const finalChargeAmount = billing.customChargeAmount;
    const finalTotalAmount = billing.grandTotal.toFixed(2);

    const upiId = userSettings.upi_id || '';
    const businessName = userSettings.business_name || 'Fresh Fruit Packs';
    const upiLink = upiId ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(businessName)}&am=${finalTotalAmount}&cu=INR` : '';

    let paymentInfo = '';
    if (userSettings.preferred_payment_method === 'upi' && upiId) {
        paymentInfo = paymentUrl ? `Pay via UPI (Click to pay): ${paymentUrl}` : `Pay via UPI ID: ${upiId}`;
    } else if (userSettings.preferred_payment_method === 'razorpay') {
        paymentInfo = paymentUrl ? `Pay Now: ${paymentUrl}` : 'Secure payment link will be sent via WhatsApp.';
    }

    const template = userSettings.whatsapp_reminder_template;
    const defaultText = `Hi ${customer.name}, your ${finalPacks} (Total: ₹${finalTotalAmount}) subscription is due for renewal on ${renewalDate}. ${paymentInfo} - ${businessName}`;

    if (!template) return defaultText;

    // Helper for regex replacement of placeholders
    const replaceAll = (text) => {
        if (!text) return '';
        return text
            .replace(/\{\{customer_name\}\}|\{\{1\}\}/g, customer.name || '')
            .replace(/\{\{pack_details\}\}|\{\{2\}\}/g, finalPacks)
            .replace(/\{\{delivery_charge\}\}|\{\{3\}\}/g, String(finalDelivery))
            .replace(/\{\{gst_label\}\}|\{\{4\}\}/g, finalChargeName)
            .replace(/\{\{gst_amount\}\}|\{\{5\}\}/g, String(finalChargeAmount))
            .replace(/\{\{total_amount\}\}|\{\{6\}\}/g, String(finalTotalAmount))
            .replace(/\{\{payment_url\}\}|\{\{7\}\}/g, paymentUrl || ' ')
            .replace(/\{\{renewal_date\}\}/g, renewalDate)
            .replace(/\{\{pack_name\}\}/g, packName)
            .replace(/\{\{pack_price\}\}/g, packPrice)
            .replace(/\{\{business_name\}\}/g, businessName)
            .replace(/\{\{upi_id\}\}/g, upiId)
            .replace(/\{\{upi_link\}\}/g, upiLink)
            .replace(/\{\{payment_info\}\}/g, paymentInfo);
    };

    // If template is JSON (Cloud API), parse first then replace inside to avoid JSON errors
    if (template.trim().startsWith('{') && template.includes('template')) {
        try {
            let json = JSON.parse(template);
            if (json.type === 'template' && json.template.components) {
                json.template.components.forEach(comp => {
                    if (comp.parameters) {
                        comp.parameters.forEach(param => {
                            if (param.type === 'text' && typeof param.text === 'string') {
                                param.text = replaceAll(param.text);
                            }
                        });
                    }
                });
                return JSON.stringify(json);
            }
        } catch (e) {
            console.error('Error handling template JSON:', e.message);
            // Fallback to direct replacement if JSON parse fails
        }
    }

    // Default: Plain string replacement
    return replaceAll(template);
};

module.exports = {
    getPaymentLink,
    prepareMessage
};
