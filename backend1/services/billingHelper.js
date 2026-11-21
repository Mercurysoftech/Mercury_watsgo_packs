/**
 * Centralized Billing & Pricing Engine (Single Source of Truth)
 * Handles accurate price, quantity, and cycle multiplier calculations
 * for subscription packs across UI, WhatsApp reminders, cron jobs, and payment links.
 */

/**
 * Calculates the total cost for a single pack line item
 * @param {Object} pack - The pack or customer_pack object
 * @param {Object} fallbackCustomer - Optional customer object for default cycle/deliveries
 * @returns {number} The total amount for this pack
 */
const calculatePackAmount = (pack, fallbackCustomer = {}) => {
    if (!pack) return 0;

    const unitPrice = Number(pack.price || pack.pack_price || pack.pack_base_price || 0);
    const quantity = Number(pack.quantity || 1);
    const cycle = pack.renewal_cycle || pack.renewalCycle || fallbackCustomer.renewal_cycle || fallbackCustomer.renewalCycle || 'daily';
    const totalDeliveries = Number(pack.total_deliveries || pack.totalDeliveries || fallbackCustomer.total_deliveries || fallbackCustomer.totalDeliveries || 1);

    // Multiplier calculation: If cycle is daily, multiply by total days/deliveries
    const multiplier = (cycle === 'daily' && totalDeliveries > 0) ? totalDeliveries : 1;

    return Math.round(unitPrice * quantity * multiplier * 100) / 100;
};

/**
 * Calculates the grand total for a customer (all relevant packs + delivery charge + custom charges)
 * @param {Array} packs - Array of packs
 * @param {Object} customer - Customer record
 * @param {Object} userSettings - User/Business settings record
 * @param {number|null} forcedAmount - Optional override amount
 * @returns {Object} { packTotal, deliveryCharge, customCharge, grandTotal }
 */
const calculateCustomerTotal = (packs = [], customer = {}, userSettings = {}, forcedAmount = null) => {
    let packTotal = 0;

    if (packs && Array.isArray(packs) && packs.length > 0) {
        packTotal = packs.reduce((sum, p) => sum + calculatePackAmount(p, customer), 0);
    } else if (customer.pack_name || customer.pack_price || customer.pack_id) {
        packTotal = calculatePackAmount({
            name: customer.pack_name,
            price: customer.pack_price,
            quantity: customer.quantity,
            renewal_cycle: customer.renewal_cycle,
            total_deliveries: customer.total_deliveries
        }, customer);
    }

    const deliveryCharge = Number(customer.delivery_charge || 0);
    const customChargeAmount = Number(userSettings.custom_charge_amount || 0);

    const calculatedTotal = Math.round((packTotal + deliveryCharge + customChargeAmount) * 100) / 100;
    const grandTotal = forcedAmount !== null && forcedAmount !== undefined && !isNaN(Number(forcedAmount))
        ? Number(forcedAmount)
        : calculatedTotal;

    return {
        packTotal: Math.round(packTotal * 100) / 100,
        deliveryCharge,
        customChargeAmount,
        customChargeName: userSettings.custom_charge_name || 'Charge',
        grandTotal: Math.round(grandTotal * 100) / 100
    };
};

/**
 * Formats a clean list of pack line items for WhatsApp Cloud API & SMS messages
 * @param {Array} packs - Array of packs
 * @param {Object} fallbackCustomer - Customer record
 * @returns {string} Formatted pack summary string
 */
const formatPacksText = (packs = [], fallbackCustomer = {}) => {
    const list = (packs && Array.isArray(packs) && packs.length > 0)
        ? packs
        : (fallbackCustomer.pack_name ? [{
            name: fallbackCustomer.pack_name,
            price: fallbackCustomer.pack_price,
            quantity: fallbackCustomer.quantity || 1,
            renewal_cycle: fallbackCustomer.renewal_cycle,
            total_deliveries: fallbackCustomer.total_deliveries
        }] : []);

    if (list.length === 0) return 'N/A';

    return list.map(p => {
        const name = p.name || p.pack_name || 'Subscription Pack';
        const unitPrice = Number(p.price || p.pack_price || 0);
        const qty = Number(p.quantity || 1);
        const cycle = p.renewal_cycle || p.renewalCycle || fallbackCustomer.renewal_cycle || fallbackCustomer.renewalCycle || 'daily';
        const deliveries = Number(p.total_deliveries || p.totalDeliveries || fallbackCustomer.total_deliveries || fallbackCustomer.totalDeliveries || 1);
        const packAmt = calculatePackAmount(p, fallbackCustomer);

        if (cycle === 'daily' && deliveries > 1) {
            return `• ${name} (${deliveries} days x ${qty}x ₹${unitPrice.toFixed(2)} = ₹${packAmt.toFixed(2)})`;
        }
        return `• ${name} (${qty}x ₹${unitPrice.toFixed(2)})`;
    }).join(', ');
};

module.exports = {
    calculatePackAmount,
    calculateCustomerTotal,
    formatPacksText
};
