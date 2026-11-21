const { pool } = require('../config/database');
const { calculateDistance, calculateDeliveryCharge } = require('../services/googleMapsService');

// Helper to ensure dates are in YYYY-MM-DD format for MySQL (timezone-safe local date)
const formatDate = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') {
        return dateVal.split('T')[0];
    }
    if (dateVal instanceof Date) {
        const yyyy = dateVal.getFullYear();
        const mm = String(dateVal.getMonth() + 1).padStart(2, '0');
        const dd = String(dateVal.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return dateVal;
};

/**
 * Helper function to update customer payment status
 */
async function updateCustomerPaymentStatus(customerId, paymentStatus) {
    try {
        let customerPaymentStatus = 'unpaid';

        if (paymentStatus === 'paid' || paymentStatus === 'success') {
            customerPaymentStatus = 'paid';
        } else if (paymentStatus === 'pending') {
            customerPaymentStatus = 'partially_paid';
        } else if (paymentStatus === 'failed') {
            // Don't change status for failed payments
            return;
        }

        await pool.query(
            `UPDATE customers 
             SET payment_status = ?, last_payment_date = NOW() 
             WHERE id = ?`,
            [customerPaymentStatus, customerId]
        );
    } catch (error) {
        console.error('Error updating customer payment status:', error);
    }
}

/**
 * Get payment history for all customers (or filtered by customer ID)
 */
exports.getPaymentHistory = async (req, res) => {
    try {
        const { customerId, status } = req.query;
        const ownerId = req.ownerId || req.userId;

        let query = `
            SELECT 
                ph.*,
                c.name as customer_name,
                c.mobile as customer_mobile,
                c.address as customer_address
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `;

        const params = req.userZone ? [ownerId, req.userZone] : [ownerId];

        if (customerId) {
            query += ` AND ph.customer_id = ?`;
            params.push(customerId);
        }

        if (status) {
            query += ` AND ph.payment_status = ?`;
            params.push(status);
        }

        query += ` ORDER BY ph.payment_date DESC, ph.created_at DESC`;

        const [rows] = await pool.query(query, params);

        res.status(200).json({
            success: true,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Get payment history error:', error);
        res.status(500).json({
            error: 'Failed to fetch payment history',
            details: error.message
        });
    }
};

/**
 * Get payment history for a specific customer
 */
exports.getCustomerPaymentHistory = async (req, res) => {
    try {
        const { customerId } = req.params;
        const userId = req.userId;

        // Verify customer belongs to user
        const [customer] = await pool.query(
            `SELECT id FROM customers WHERE id = ? AND user_id = ? ${req.userZone ? "AND zone IN (?)" : ""}`,
            req.userZone ? [customerId, userId, req.userZone] : [customerId, userId]
        );

        if (customer.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const [rows] = await pool.query(`
            SELECT ph.*, c.name as customer_name, c.address as customer_address, c.mobile as customer_mobile
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.customer_id = ? AND ph.user_id = ?
            ORDER BY ph.payment_date DESC
        `, [customerId, userId]);

        res.status(200).json({
            success: true,
            customerId,
            data: rows,
            count: rows.length
        });
    } catch (error) {
        console.error('Get customer payment history error:', error);
        res.status(500).json({
            error: 'Failed to fetch customer payment history',
            details: error.message
        });
    }
};

/**
 * Record a payment (admin only)
 */
exports.recordPayment = async (req, res) => {
    try {
        const {
            customerId,
            amount,
            currency = 'INR',
            paymentStatus,
            paymentMethod,
            razorpayPaymentId,
            razorpayOrderId,
            razorpaySubscriptionId,
            transactionDate,
            description,
            notes,
            deliveryCharge = 0,
            distanceKm = 0
        } = req.body;

        // Validation
        if (!customerId || amount === undefined || !paymentStatus) {
            return res.status(400).json({
                error: 'Customer ID, amount, and payment status are required'
            });
        }

        // Validate payment status
        const validStatuses = ['success', 'failed', 'pending', 'paid'];
        if (!validStatuses.includes(paymentStatus)) {
            return res.status(400).json({
                error: `Invalid payment status. Allowed values: ${validStatuses.join(', ')}`
            });
        }

        const userId = req.userId;
        const ownerId = req.ownerId || req.userId;

        // Verify customer belongs to user and get their distance
        const [customers] = await pool.query(
            `SELECT c.id, c.distance_km, c.delivery_charge, c.address, p.name as pack_name 
             FROM customers c 
             LEFT JOIN packs p ON c.pack_id = p.id
             WHERE c.id = ? AND c.user_id = ?
             ${req.userZone ? "AND c.zone IN (?)" : ""}`,
            req.userZone ? [customerId, ownerId, req.userZone] : [customerId, ownerId]
        );

        if (customers.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        const customer = customers[0];

        // --- NEW: Sync distance/charge if they are 0 ---
        let finalDistanceKm = (Number(distanceKm) > 0) ? distanceKm : (customer.distance_km || 0);
        let finalDeliveryCharge = (Number(deliveryCharge) > 0) ? deliveryCharge : (customer.delivery_charge || 0);

        // Fetch settings if we need to calculate
        const [settingsRows] = await pool.query('SELECT address, delivery_charges, delivery_free_km, delivery_price_per_km, google_maps_api_key, invoice_prefix, invoice_start_number FROM settings WHERE user_id = ?', [ownerId]);
        const settings = settingsRows[0] || { delivery_charges: 0, delivery_free_km: 3, delivery_price_per_km: 0, invoice_prefix: 'INV-', invoice_start_number: 1 };

        // If distance is still 0, try to calculate
        if (Number(finalDistanceKm) === 0) {
            const apiKey = (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== 'your_google_maps_api_key_here')
                ? process.env.GOOGLE_MAPS_API_KEY
                : settings.google_maps_api_key;

            if (apiKey && apiKey !== '********' && settings.address && customer.address) {
                const dist = await calculateDistance(settings.address, customer.address, apiKey);
                if (dist !== null) {
                    finalDistanceKm = dist;
                    // Update customer record so it's saved for next time
                    await pool.query('UPDATE customers SET distance_km = ? WHERE id = ?', [dist, customerId]);
                }
            }
        }

        // If Charge is still 0, try to calculate from distance
        if (Number(finalDeliveryCharge) === 0 && Number(finalDistanceKm) > 0) {
            finalDeliveryCharge = calculateDeliveryCharge(finalDistanceKm, settings);
            // Also update customer's delivery_charge record
            await pool.query('UPDATE customers SET delivery_charge = ? WHERE id = ?', [finalDeliveryCharge, customerId]);
        }

        // --- DISCOUNTED DELIVERY LOGIC (Formula: Pack + (Delivery - Discount)) ---
        const isSubscriptionPack = customer.pack_name?.toLowerCase().includes('subscription pack');
        let finalCalculatedDelivery = finalDeliveryCharge;
        
        if (isSubscriptionPack) {
            // Subtract the 'deliveryCharges' (base discount) from the distance fee
            // Example: 5000 + 300 - 200 = 5100
            const discountValue = Number(settings.delivery_charges || 0);
            finalCalculatedDelivery = Math.max(0, Number(finalDeliveryCharge) - discountValue);
        }

        // Subtotal (Pack Price) remains unchanged
        let finalItemAmount = amount;

        // --- NEW: Calculate custom invoice string ---
        const invoicePrefix = settings.invoice_prefix !== undefined && settings.invoice_prefix !== null ? settings.invoice_prefix : 'INV-';
        const invoiceStartNum = Number(settings.invoice_start_number) || 1;

        const [seqResult] = await pool.query(
            'SELECT MAX(invoice_seq) as max_seq FROM payment_history WHERE user_id = ?',
            [userId]
        );
        let nextSeq = invoiceStartNum;
        if (seqResult[0]?.max_seq !== null && seqResult[0]?.max_seq >= invoiceStartNum) {
            nextSeq = seqResult[0].max_seq + 1;
        } else if (seqResult[0]?.max_seq !== null && seqResult[0]?.max_seq > 0) {
            // If they decreased the start number but max is already higher
            nextSeq = seqResult[0].max_seq + 1;
        }

        const nextInvoiceString = `${invoicePrefix}${String(nextSeq).padStart(4, '0')}`;

        const [result] = await pool.query(`
            INSERT INTO payment_history (
                customer_id, user_id, amount, currency, payment_status, 
                payment_method, razorpay_payment_id, razorpay_order_id, 
                razorpay_subscription_id, payment_date, renewal_date, description, notes,
                delivery_charge, distance_km, invoice_seq, invoice_string
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            customerId, userId, finalItemAmount, currency, paymentStatus,
            paymentMethod || 'manual',
            razorpayPaymentId || null,
            razorpayOrderId || null,
            razorpaySubscriptionId || null,
            transactionDate || formatDate(new Date()),
            transactionDate || formatDate(new Date()),
            description,
            notes ? JSON.stringify(notes) : null,
            finalCalculatedDelivery,
            finalDistanceKm,
            nextSeq,
            nextInvoiceString
        ]);

        // Update customer payment status
        await updateCustomerPaymentStatus(customerId, paymentStatus);

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            paymentId: result.insertId
        });
    } catch (error) {
        console.error('Record payment error:', error);
        res.status(500).json({
            error: 'Failed to record payment',
            details: error.message
        });
    }
};

/**
 * Update a payment history record (status, date, amount)
 */
exports.updatePaymentRecord = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { paymentStatus, paymentDate, amount } = req.body;
        const userId = req.userId;

        if (!paymentStatus) {
            return res.status(400).json({ error: 'Payment status is required' });
        }

        const validStatuses = ['paid', 'unpaid', 'pending', 'success', 'failed'];
        if (!validStatuses.includes(paymentStatus)) {
            return res.status(400).json({
                error: `Invalid payment status. Allowed values: ${validStatuses.join(', ')}`
            });
        }

        // Verify payment belongs to user's customer
        const [payment] = await pool.query(`
            SELECT ph.id, ph.customer_id FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.id = ? AND c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `, [paymentId, userId, ...(req.userZone ? [req.userZone] : [])]);

        if (payment.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const customerId = payment[0].customer_id;

        // Build dynamic update
        let setClauses = ['payment_status = ?'];
        let params = [paymentStatus];

        if (paymentDate) {
            const formattedDate = formatDate(paymentDate);
            setClauses.push('payment_date = ?');
            params.push(formattedDate);
        }

        if (amount !== undefined && amount !== null && !isNaN(Number(amount))) {
            setClauses.push('amount = ?');
            params.push(Number(amount));
        }

        params.push(paymentId);

        await pool.query(
            `UPDATE payment_history SET ${setClauses.join(', ')} WHERE id = ?`,
            params
        );

        // Sync customer payment status
        await updateCustomerPaymentStatus(customerId, paymentStatus);

        // If date changed, also update customer's last_payment_date with the latest paid record
        if (paymentDate) {
            const [latestPaid] = await pool.query(
                `SELECT MAX(payment_date) as latest FROM payment_history WHERE customer_id = ? AND payment_status IN ('paid','success')`,
                [customerId]
            );
            if (latestPaid[0]?.latest) {
                await pool.query(
                    `UPDATE customers SET last_payment_date = ? WHERE id = ?`,
                    [latestPaid[0].latest, customerId]
                );
            }
        }

        res.status(200).json({
            success: true,
            message: 'Payment record updated successfully'
        });
    } catch (error) {
        console.error('Update payment record error:', error);
        res.status(500).json({
            error: 'Failed to update payment record',
            details: error.message
        });
    }
};

/**
 * Update payment status
 */
exports.updatePaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const { paymentStatus, notes } = req.body;
        const userId = req.userId;

        if (!paymentStatus) {
            return res.status(400).json({ error: 'Payment status is required' });
        }

        // Validate payment status
        const validStatuses = ['success', 'failed', 'pending', 'paid'];
        if (!validStatuses.includes(paymentStatus)) {
            return res.status(400).json({
                error: `Invalid payment status. Allowed values: ${validStatuses.join(', ')}`
            });
        }

        // Verify payment belongs to user's customer and get customer ID
        const [payment] = await pool.query(`
            SELECT ph.id, ph.customer_id FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.id = ? AND c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `, [paymentId, userId, ...(req.userZone ? [req.userZone] : [])]);

        if (payment.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const customerId = payment[0].customer_id;

        const updateQuery = `
            UPDATE payment_history 
            SET payment_status = ?
            ${notes ? ', notes = ?' : ''}
            WHERE id = ?
        `;

        const params = notes
            ? [paymentStatus, JSON.stringify(notes), paymentId]
            : [paymentStatus, paymentId];

        await pool.query(updateQuery, params);

        // Update customer payment status
        await updateCustomerPaymentStatus(customerId, paymentStatus);

        res.status(200).json({
            success: true,
            message: 'Payment status updated successfully'
        });
    } catch (error) {
        console.error('Update payment status error:', error);
        res.status(500).json({
            error: 'Failed to update payment status',
            details: error.message
        });
    }
};

/**
 * Delete payment history record (admin only)
 * Deletes a payment record and recalculates customer's payment status
 */
exports.deletePaymentHistory = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const userId = req.userId;

        if (!paymentId) {
            return res.status(400).json({ error: 'Payment ID is required' });
        }

        // Verify payment belongs to user's customer
        const [payment] = await pool.query(`
            SELECT ph.id, ph.customer_id FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.id = ? AND c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `, [paymentId, userId, ...(req.userZone ? [req.userZone] : [])]);

        if (payment.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        const customerId = payment[0].customer_id;

        // Delete the payment record
        await pool.query('DELETE FROM payment_history WHERE id = ?', [paymentId]);

        // Recalculate customer's payment status from remaining payments
        const [remainingPayments] = await pool.query(`
             SELECT 
                COUNT(*) as total_payments,
                MAX(CASE WHEN payment_status IN ('paid', 'success') THEN payment_date ELSE NULL END) as last_paid_date,
                SUM(CASE WHEN payment_status IN ('paid', 'success') THEN (amount + delivery_charge) ELSE 0 END) as total_paid
            FROM payment_history
            WHERE customer_id = ?
        `, [customerId]);

        const summary = remainingPayments[0];
        let newPaymentStatus = 'unpaid';
        let lastPaymentDate = null;

        if (summary.total_payments > 0 && summary.last_paid_date) {
            newPaymentStatus = 'paid';
            lastPaymentDate = summary.last_paid_date;
        }

        // Update customer
        await pool.query(`
            UPDATE customers 
            SET payment_status = ?,
                last_payment_date = ?,
                amount_paid = ?
            WHERE id = ?
        `, [newPaymentStatus, lastPaymentDate, summary.total_paid || 0, customerId]);

        res.status(200).json({
            success: true,
            message: 'Payment record deleted successfully',
            customerId,
            newPaymentStatus
        });
    } catch (error) {
        console.error('Delete payment history error:', error);
        res.status(500).json({
            error: 'Failed to delete payment record',
            details: error.message
        });
    }
};

/**
 * Delete payment record (admin only)
 * Updates customer payment status and optionally records a payment
 */
exports.deletePayment = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const userId = req.userId;

        // Verify payment belongs to user's customer
        const [payment] = await pool.query(`
            SELECT ph.id FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.id = ? AND c.user_id = ?
        `, [paymentId, userId]);

        if (payment.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        await pool.query('DELETE FROM payment_history WHERE id = ?', [paymentId]);

        res.status(200).json({
            success: true,
            message: 'Payment deleted successfully'
        });
    } catch (error) {
        console.error('Delete payment error:', error);
        res.status(500).json({
            error: 'Failed to delete payment',
            details: error.message
        });
    }
};

/**
 * Get payment statistics
 */
exports.getPaymentStats = async (req, res) => {
    try {
        const userId = req.userId;
        const { startDate, endDate } = req.query;

        let query = `
            SELECT 
                COUNT(*) as total_transactions,
                SUM(CASE WHEN payment_status = 'success' THEN amount ELSE 0 END) as total_successful,
                SUM(CASE WHEN payment_status = 'failed' THEN amount ELSE 0 END) as total_failed,
                SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END) as total_pending,
                COUNT(CASE WHEN payment_status = 'success' THEN 1 END) as success_count,
                COUNT(CASE WHEN payment_status = 'failed' THEN 1 END) as failed_count,
                COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_count
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `;

        const params = req.userZone ? [userId, req.userZone] : [userId];

        if (startDate) {
            query += ` AND ph.transaction_date >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND ph.transaction_date <= ?`;
            params.push(endDate);
        }

        const [rows] = await pool.query(query, params);

        res.status(200).json({
            success: true,
            stats: rows[0] || {
                total_transactions: 0,
                total_successful: 0,
                total_failed: 0,
                total_pending: 0,
                success_count: 0,
                failed_count: 0,
                pending_count: 0
            }
        });
    } catch (error) {
        console.error('Get payment stats error:', error);
        res.status(500).json({
            error: 'Failed to fetch payment statistics',
            details: error.message
        });
    }
};

/**
 * Export payment history (CSV format)
 */
exports.exportPaymentHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const { customerId, paymentIds } = req.query;

        let query = `
            SELECT 
                c.name as 'Customer Name',
                c.mobile as 'Customer Mobile',
                ph.amount as 'Amount',
                ph.delivery_charge as 'Delivery Charge',
                ph.distance_km as 'Distance (KM)',
                ph.currency as 'Currency',
                ph.payment_status as 'Status',
                ph.payment_method as 'Method',
                DATE_FORMAT(ph.transaction_date, '%Y-%m-%d') as 'Transaction Date',
                DATE_FORMAT(ph.payment_date, '%Y-%m-%d %H:%i:%s') as 'Payment Date',
                ph.description as 'Description'
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `;

        const params = req.userZone ? [userId, req.userZone] : [userId];

        if (customerId) {
            query += ` AND ph.customer_id = ?`;
            params.push(customerId);
        }

        if (paymentIds) {
            const ids = paymentIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            if (ids.length > 0) {
                query += ` AND ph.id IN (?)`;
                params.push(ids);
            }
        }

        query += ` ORDER BY ph.transaction_date DESC`;

        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No payment history found' });
        }

        // Convert to CSV
        const headers = Object.keys(rows[0]);
        const csv = [headers.join(',')];

        rows.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                if (value === null) return '';
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csv.push(values.join(','));
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="payment-history.csv"');
        res.send(csv.join('\n'));
    } catch (error) {
        console.error('Export payment history error:', error);
        res.status(500).json({
            error: 'Failed to export payment history',
            details: error.message
        });
    }
};

/**
 * Mark customer as paid (admin only)
 * Updates customer payment status and records in payment_history table
 */
exports.markCustomerAsPaid = async (req, res) => {
    try {
        const { 
            customerId, 
            paymentDate, 
            packId, 
            packIds, 
            packDates = {}, 
            recordPayment = false, 
            customChargeName, 
            customChargeAmount = 0,
            manualDeliveryCharge,
            amountPaid,
            balance
        } = req.body;
        const ownerId = req.ownerId || req.userId;
        const userId = req.userId;

        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required' });
        }

        // --- AUTO-MIGRATION: Ensure columns exist ---
        try {
            const [phCols] = await pool.query('SHOW COLUMNS FROM payment_history');
            const phNames = phCols.map(c => c.Field);
            if (!phNames.includes('amount_paid')) {
                await pool.query('ALTER TABLE payment_history ADD COLUMN amount_paid DECIMAL(10,2) DEFAULT 0');
            }
            if (!phNames.includes('balance')) {
                await pool.query('ALTER TABLE payment_history ADD COLUMN balance DECIMAL(10,2) DEFAULT 0');
            }

            const [custCols] = await pool.query('SHOW COLUMNS FROM customers');
            const custNames = custCols.map(c => c.Field);
            if (!custNames.includes('balance')) {
                await pool.query('ALTER TABLE customers ADD COLUMN balance DECIMAL(10,2) DEFAULT 0');
            }
        } catch (migErr) {
            console.warn('Auto-migration warning in markCustomerAsPaid:', migErr.message);
        }
        // ------------------------------------------

        // Standardize to array of IDs
        const targetPackIds = packIds || (packId ? [packId] : []);
        const usedDateForPrimary = paymentDate || formatDate(new Date());

        // Always get customer basic details for history/context
        const [customers] = await pool.query(
            `SELECT c.id, c.renewal_date, c.subscription_start_date, c.renewal_cycle, c.status,
                    COALESCE(p.price, 0) as pack_price, p.name as pack_name, c.pack_id,
                    COALESCE(c.delivery_charge, 0) as delivery_charge,
                    COALESCE(c.distance_km, 0) as distance_km
             FROM customers c
             LEFT JOIN packs p ON c.pack_id = p.id
             WHERE c.id = ? AND c.user_id = ?
             ${req.userZone ? "AND c.zone IN (?)" : ""}`,
            req.userZone ? [customerId, ownerId, req.userZone] : [customerId, ownerId]
        );

        if (customers.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        const customer = customers[0];

        // Fetch business settings for current delivery charge calculation
        const [settingsRows] = await pool.query(
            'SELECT address, delivery_charges, delivery_free_km, delivery_price_per_km, google_maps_api_key, invoice_prefix, invoice_start_number FROM settings WHERE user_id = ?',
            [ownerId]
        );
        const settings = settingsRows[0] || { delivery_charges: 0, delivery_free_km: 3, delivery_price_per_km: 0, invoice_prefix: 'INV-', invoice_start_number: 1 };

        let distanceKm = Number(customer.distance_km || 0);
        let calculatedDeliveryCharge = 0;

        // Auto-calculate distance if it is 0
        if (distanceKm === 0) {
            try {
                const apiKey = (process.env.GOOGLE_MAPS_API_KEY && process.env.GOOGLE_MAPS_API_KEY !== 'your_google_maps_api_key_here')
                    ? process.env.GOOGLE_MAPS_API_KEY
                    : settingsRows[0]?.google_maps_api_key;

                if (apiKey && settingsRows[0]?.address && customer.id) {
                    const [fullCust] = await pool.query('SELECT address FROM customers WHERE id = ?', [customerId]);
                    const userAddress = fullCust[0]?.address;
                    if (userAddress) {
                        const dist = await calculateDistance(settingsRows[0].address, userAddress, apiKey);
                        if (dist !== null) {
                            distanceKm = Number(dist);
                            await pool.query('UPDATE customers SET distance_km = ? WHERE id = ?', [dist, customerId]);
                        }
                    }
                }
            } catch (err) {
                console.error('[MarkPaid Calc] Failed:', err.message);
            }
        }

        // Calculate fresh if NOT provided manually
        if (manualDeliveryCharge !== undefined) {
            calculatedDeliveryCharge = Number(manualDeliveryCharge);
        } else if (distanceKm > 0) {
            calculatedDeliveryCharge = calculateDeliveryCharge(distanceKm, settings);
        }

        let totalPacksAmount = 0;
        let descriptions = [];
        let updates = [];
        let hasSubscriptionPack = false;

        if (targetPackIds.length > 0) {
            const [packs] = await pool.query(
                `SELECT cp.*, p.name as pack_name, p.price as pack_base_price
                 FROM customer_packs cp
                 JOIN packs p ON cp.pack_id = p.id
                 WHERE cp.id IN (?) AND cp.customer_id = ? AND cp.user_id = ?`,
                [targetPackIds, customerId, ownerId]
            );

            for (const p of packs) {
                let multiplier = 1;
                if (p.renewal_cycle === 'daily') {
                    multiplier = p.total_deliveries || 1;
                }
                const amount = p.pack_base_price * p.quantity * multiplier;
                totalPacksAmount += amount;
                descriptions.push(p.pack_name);
                if (p.pack_name.toLowerCase().includes('subscription pack')) {
                    hasSubscriptionPack = true;
                }

                const packUsedDate = packDates[p.id] || usedDateForPrimary;
                const deliveries = p.total_deliveries || (p.renewal_cycle === 'weekly' ? 6 : 24);
                let finalStartDateStr;
                let finalRenewalDateStr;

                if (p.status === 'renewed' || p.status === 'active') {
                    let baseRenewal = p.renewal_date ? new Date(p.renewal_date + 'T00:00:00') : new Date();
                    if (isNaN(baseRenewal.getTime())) baseRenewal = new Date();
                    baseRenewal.setDate(baseRenewal.getDate() + 1);
                    while (baseRenewal.getDay() === 0) baseRenewal.setDate(baseRenewal.getDate() + 1);
                    finalStartDateStr = formatDate(baseRenewal);
                } else {
                    finalStartDateStr = packUsedDate;
                }
                
                const calcRenewal = (start, count) => {
                    let d = new Date(start + 'T00:00:00');
                    let rem = count;
                    while (rem > 0) {
                        d.setDate(d.getDate() + 1);
                        if (d.getDay() !== 0) rem--;
                    }
                    return formatDate(d);
                };
                finalRenewalDateStr = calcRenewal(finalStartDateStr, deliveries - 1);

                updates.push({
                    id: p.id,
                    startDate: finalStartDateStr,
                    renewalDate: finalRenewalDateStr,
                    deliveries,
                    lastPaymentDate: packUsedDate
                });
            }
        }

        // Execute updates
        if (updates.length > 0) {
            for (const up of updates) {
                await pool.query(
                    `UPDATE customer_packs SET status = 'renewed', start_date = ?, renewal_date = ?, total_deliveries = ?, last_payment_date = ? WHERE id = ?`,
                    [up.startDate, up.renewalDate, up.deliveries, up.lastPaymentDate, up.id]
                );
            }
            await pool.query(`UPDATE customers SET status = 'renewed', payment_status = 'paid', last_payment_date = ?, amount_paid = ?, balance = ? WHERE id = ?`, [usedDateForPrimary, amountPaid || 0, balance || 0, customerId]);
        } else {
            const cycle = customer.renewal_cycle || 'monthly';
            const deliveries = cycle === 'weekly' ? 6 : 24;
            let finalStart;
            if (customer.status === 'renewed' || customer.status === 'active') {
                let base = customer.renewal_date ? new Date(customer.renewal_date + 'T00:00:00') : new Date();
                base.setDate(base.getDate() + 1);
                while (base.getDay() === 0) base.setDate(base.getDate() + 1);
                finalStart = formatDate(base);
            } else {
                finalStart = usedDateForPrimary;
            }

            const calcRen = (s, c) => {
                let d = new Date(s + 'T00:00:00');
                let r = c;
                while (r > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0) r--; }
                return formatDate(d);
            };
            const finalRen = calcRen(finalStart, deliveries - 1);

            totalPacksAmount = customer.pack_price || 0;
            descriptions = [customer.pack_name || 'Subscription Renewal'];

            await pool.query(
                `UPDATE customers SET status = 'renewed', payment_status = 'paid', last_payment_date = ?, subscription_start_date = ?, renewal_date = ?, total_deliveries = ?, amount_paid = ?, balance = ? WHERE id = ?`,
                [usedDateForPrimary, finalStart, finalRen, deliveries, amountPaid || 0, balance || 0, customerId]
            );

            if (customer.pack_id) {
                await pool.query(
                    `UPDATE customer_packs SET status = 'renewed', start_date = ?, renewal_date = ?, total_deliveries = ?, last_payment_date = ?
                     WHERE customer_id = ? AND pack_id = ?`,
                    [finalStart, finalRen, deliveries, usedDateForPrimary, customerId, customer.pack_id]
                );
            }
        }

        // --- DELIVERY DISCOUNT LOGIC ---
        let finalDeliveryForRecord = calculatedDeliveryCharge;
        if (hasSubscriptionPack && manualDeliveryCharge === undefined) {
            const discountValue = Number(settings.delivery_charges || 0);
            finalDeliveryForRecord = Math.max(0, calculatedDeliveryCharge - discountValue);
        }

        const finalDescription = `Subscription Renewal: ${descriptions.join(', ')} ${customChargeName ? `+ ${customChargeName}: ₹${customChargeAmount}` : ''}`;
        
        // --- NEW: Calculate custom invoice string ---
        const invoicePrefix = settings.invoice_prefix !== undefined && settings.invoice_prefix !== null ? settings.invoice_prefix : 'INV-';
        const invoiceStartNum = Number(settings.invoice_start_number) || 1;

        const [seqResult] = await pool.query(
            'SELECT MAX(invoice_seq) as max_seq FROM payment_history WHERE user_id = ?',
            [ownerId]
        );
        let nextSeq = invoiceStartNum;
        if (seqResult[0]?.max_seq !== null && seqResult[0]?.max_seq >= invoiceStartNum) {
            nextSeq = seqResult[0].max_seq + 1;
        } else if (seqResult[0]?.max_seq !== null && seqResult[0]?.max_seq > 0) {
            nextSeq = seqResult[0].max_seq + 1;
        }

        const nextInvoiceString = `${invoicePrefix}${String(nextSeq).padStart(4, '0')}`;

        await pool.query(`
            INSERT INTO payment_history (
                customer_id, user_id, amount, delivery_charge, custom_charge_name, custom_charge_amount, 
                amount_paid, balance, distance_km, payment_status, payment_date, renewal_date, description,
                invoice_seq, invoice_string
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            customerId, ownerId, totalPacksAmount, finalDeliveryForRecord, 
            customChargeName || null, Number(customChargeAmount) || 0,
            amountPaid || 0, balance || 0,
            distanceKm, 'paid', usedDateForPrimary, usedDateForPrimary, finalDescription,
            nextSeq, nextInvoiceString
        ]);

        const totalWithCharges = totalPacksAmount + finalDeliveryForRecord + (Number(customChargeAmount) || 0);

        res.status(200).json({
            success: true,
            message: 'Payment recorded successfully',
            customerId,
            totalPacksAmount,
            deliveryCharge: finalDeliveryForRecord,
            customChargeName: customChargeName || null,
            customChargeAmount: Number(customChargeAmount) || 0,
            amountPaid: amountPaid || 0,
            balance: balance || 0,
            finalDisplayAmount: totalWithCharges
        });
    } catch (error) {
        console.error('Mark customer as paid error:', error);
        res.status(500).json({
            error: 'Failed to mark customer as paid',
            details: error.message
        });
    }
};

/**
 * Reset customer payment status back to unpaid (clear payment record)
 */
exports.resetCustomerPayment = async (req, res) => {
    try {
        const { customerId } = req.params;
        const userId = req.userId;

        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required' });
        }

        // Verify ownership
        const [customer] = await pool.query(
            'SELECT id FROM customers WHERE id = ? AND user_id = ?',
            [customerId, userId]
        );

        if (customer.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Reset payment status
        await pool.query(`
            UPDATE customers 
            SET payment_status = 'unpaid',
                last_payment_date = NULL,
                amount_paid = 0
            WHERE id = ?
        `, [customerId]);

        res.status(200).json({
            success: true,
            message: 'Payment record reset successfully',
            customerId
        });
    } catch (error) {
        console.error('Reset customer payment error:', error);
        res.status(500).json({
            error: 'Failed to reset payment',
            details: error.message
        });
    }
};


/**
 * Auto-update customer payment status based on their payments
 * Calculates status from all payments in payment_history
 */
exports.syncCustomerPaymentStatus = async (req, res) => {
    try {
        const { customerId } = req.params;
        const userId = req.userId;

        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required' });
        }

        // Verify customer belongs to user
        const [customer] = await pool.query(
            'SELECT id FROM customers WHERE id = ? AND user_id = ?',
            [customerId, userId]
        );

        if (customer.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get payment summary for this customer
        const [paymentSummary] = await pool.query(`
            SELECT 
                COUNT(*) as total_payments,
                SUM(CASE WHEN payment_status IN ('paid', 'success') THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN payment_status IN ('paid', 'success') THEN (amount + delivery_charge) ELSE 0 END) as total_paid,
                SUM(CASE WHEN payment_status = 'pending' THEN (amount + delivery_charge) ELSE 0 END) as pending_amount,
                MAX(transaction_date) as last_payment_date
            FROM payment_history
            WHERE customer_id = ?
        `, [customerId]);

        const summary = paymentSummary[0];

        // Determine payment status
        let paymentStatus = 'unpaid';
        if (summary.total_paid > 0) {
            paymentStatus = summary.pending_amount > 0 ? 'partially_paid' : 'paid';
        } else if (summary.pending_amount > 0) {
            paymentStatus = 'pending';
        }

        // Update customer
        await pool.query(`
            UPDATE customers 
            SET payment_status = ?,
                amount_paid = ?,
                last_payment_date = ?
            WHERE id = ?
        `, [paymentStatus, summary.total_paid || 0, summary.last_payment_date, customerId]);

        res.status(200).json({
            success: true,
            message: 'Customer payment status synced successfully',
            customerId,
            paymentStatus,
            summary: {
                totalPayments: summary.total_payments,
                paidCount: summary.paid_count,
                totalPaid: summary.total_paid || 0,
                pendingAmount: summary.pending_amount || 0,
                lastPaymentDate: summary.last_payment_date
            }
        });
    } catch (error) {
        console.error('Sync customer payment status error:', error);
        res.status(500).json({
            error: 'Failed to sync customer payment status',
            details: error.message
        });
    }
};

/**
 * Bulk update customer payment statuses
 * Syncs all customers' payment statuses based on their payment history
 */
exports.syncAllCustomerPaymentStatuses = async (req, res) => {
    try {
        const userId = req.userId;
        let syncedCount = 0;

        // Get all customers for this user
        const [customers] = await pool.query(
            'SELECT id FROM customers WHERE user_id = ?',
            [userId]
        );

        // Sync each customer's payment status
        for (const customer of customers) {
            try {
                const [paymentSummary] = await pool.query(`
                    SELECT 
                        SUM(CASE WHEN payment_status IN ('paid', 'success') THEN amount ELSE 0 END) as total_paid,
                        SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END) as pending_amount,
                        MAX(transaction_date) as last_payment_date
                    FROM payment_history
                    WHERE customer_id = ?
                `, [customer.id]);

                const summary = paymentSummary[0];

                // Determine payment status
                let paymentStatus = 'unpaid';
                if (summary.total_paid > 0) {
                    paymentStatus = summary.pending_amount > 0 ? 'partially_paid' : 'paid';
                } else if (summary.pending_amount > 0) {
                    paymentStatus = 'pending';
                }

                // Update customer
                await pool.query(`
                    UPDATE customers 
                    SET payment_status = ?,
                        amount_paid = ?,
                        last_payment_date = ?
                    WHERE id = ?
                `, [paymentStatus, summary.total_paid || 0, summary.last_payment_date, customer.id]);

                syncedCount++;
            } catch (err) {
                console.error(`Error syncing customer ${customer.id}:`, err);
            }
        }

        res.status(200).json({
            success: true,
            message: 'All customer payment statuses synced successfully',
            totalCustomers: customers.length,
            syncedCount
        });
    } catch (error) {
        console.error('Bulk sync customer payment statuses error:', error);
        res.status(500).json({
            error: 'Failed to sync all customer payment statuses',
            details: error.message
        });
    }
};

// Export single payment as PDF
// Export single payment as PDF
exports.exportPaymentPDF = async (req, res) => {
    try {
        const { paymentId } = req.params;
        const ownerId = req.ownerId || req.userId;
        const PDFDocument = require('pdfkit');
        const path = require('path');

        // Fetch payment details
        const [payments] = await pool.query(`
            SELECT 
                ph.*, 
                c.name as customer_name, 
                c.mobile as customer_mobile, 
                c.address as customer_address,
                c.area as customer_area,
                c.zone as customer_zone
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.id = ? AND ph.user_id = ?
        `, [paymentId, ownerId]);

        if (payments.length === 0) {
            return res.status(404).json({ error: 'Payment record not found' });
        }

        const payment = payments[0];

        // Fetch user settings for business details
        const [settingsRows] = await pool.query('SELECT * FROM settings WHERE user_id = ?', [ownerId]);
        const settings = settingsRows[0] || {};

        const invoiceNumberStr = payment.invoice_string || `INV-${payment.id}`;
        
        const doc = new PDFDocument({ 
            margin: 50,
            size: 'A4',
            info: {
                Title: `Invoice - ${invoiceNumberStr}`,
                Author: settings.business_name || 'Watsgo Reminders'
            }
        });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="invoice-${paymentId}.pdf"`);
        doc.pipe(res);

        // --- Helper: Horizontal Line ---
        const hr = (y) => {
            doc.strokeColor('#eeeeee')
               .lineWidth(1)
               .moveTo(50, y)
               .lineTo(550, y)
               .stroke();
        };

        // --- Header ---
        const businessName = (settings.business_name || 'Fresh Fruit Packs').toUpperCase();
        
        // Draw a dark header background for the top section (similar to UI)
        doc.rect(0, 0, 612, 140).fill('#1a1a1a');
        
        doc.fillColor('#ffffff')
           .fontSize(24)
           .font('Helvetica-Bold')
           .text(businessName, 50, 45);

        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#999999')
           .text('OFFICIAL RECEIPT', 50, 75, { characterSpacing: 2 });

        // Invoice Badge
        doc.rect(400, 45, 160, 60).fill('#2d2d2d');
        doc.fillColor('#999999')
           .fontSize(8)
           .text('INVOICE NUMBER', 415, 55, { characterSpacing: 1 });
        doc.fillColor('#ffffff')
           .fontSize(16)
           .font('Helvetica-Bold')
           .text(payment.invoice_string || `INV-${payment.id.toString().padStart(6, '0')}`, 415, 70);

        // --- Billing Info ---
        doc.fillColor('#000000').fontSize(10).font('Helvetica');
        
        // Column 1: From
        doc.fillColor('#999999').fontSize(8).font('Helvetica-Bold').text('ISSUED BY', 50, 160, { characterSpacing: 1 });
        doc.fillColor('#1a1a1a').fontSize(11).font('Helvetica-Bold').text(businessName, 50, 175);
        doc.fillColor('#666666').fontSize(9).font('Helvetica').text(settings.address || '', 50, 190, { width: 220, lineGap: 2 });
        if (settings.contact_phone) doc.text(`Phone: ${settings.contact_phone}`, 50, doc.y + 5);
        if (settings.contact_email) doc.text(`Email: ${settings.contact_email}`, 50, doc.y + 2);

        // Column 2: Bill To
        doc.fillColor('#999999').fontSize(8).font('Helvetica-Bold').text('BILL TO', 350, 160, { characterSpacing: 1 });
        doc.fillColor('#1a1a1a').fontSize(11).font('Helvetica-Bold').text(payment.customer_name.toUpperCase(), 350, 175);
        doc.fillColor('#1a1a1a').fontSize(10).font('Helvetica-Bold').text(payment.customer_mobile, 350, 190);
        doc.fillColor('#666666').fontSize(9).font('Helvetica').text(payment.customer_address || '', 350, 205, { width: 200, lineGap: 2 });

        // --- Payment Dates Bar ---
        const barY = 260;
        doc.rect(50, barY, 500, 50).fill('#f9fafb');
        
        doc.fillColor('#999999').fontSize(7).font('Helvetica-Bold').text('PAYMENT DATE', 70, barY + 12);
        doc.fillColor('#1a1a1a').fontSize(9).font('Helvetica-Bold').text(new Date(payment.payment_date || payment.transaction_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), 70, barY + 25);

        doc.fillColor('#999999').fontSize(7).font('Helvetica-Bold').text('RENEWAL DATE', 210, barY + 12);
        doc.fillColor('#059669').fontSize(9).font('Helvetica-Bold').text(new Date(payment.renewal_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), 210, barY + 25);

        doc.fillColor('#999999').fontSize(7).font('Helvetica-Bold').text('METHOD', 350, barY + 12);
        doc.fillColor('#1a1a1a').fontSize(9).font('Helvetica-Bold').text((payment.payment_method || 'Manual').toUpperCase(), 350, barY + 25);

        doc.fillColor('#999999').fontSize(7).font('Helvetica-Bold').text('STATUS', 460, barY + 12);
        doc.rect(460, barY + 23, 70, 16).fill('#10b981');
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold').text('SUCCESSFUL', 465, barY + 28, { width: 60, align: 'center' });

        // --- Table ---
        const tableTop = 340;
        doc.fillColor('#999999').fontSize(8).font('Helvetica-Bold').text('DESCRIPTION', 50, tableTop, { characterSpacing: 1 });
        doc.text('TOTAL AMOUNT', 450, tableTop, { align: 'right', width: 100, characterSpacing: 1 });
        
        doc.strokeColor('#1a1a1a').lineWidth(2).moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        const itemY = tableTop + 35;
        doc.fillColor('#1a1a1a').fontSize(12).font('Helvetica-Bold').text((payment.description || 'Subscription Renewal').toUpperCase(), 50, itemY);
        doc.fillColor('#999999').fontSize(9).font('Helvetica').text('SUBSCRIPTION PERIOD EXTENSION', 50, itemY + 15);
        
        doc.fillColor('#1a1a1a').fontSize(14).font('Helvetica-Bold').text(`Rs. ${Number(payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, itemY + 5, { align: 'right', width: 100 });

        // --- Summary Totals ---
        const summaryY = 480;
        const subtotal = Number(payment.amount || 0);
        const deliveryCharge = Number(payment.delivery_charge || 0);
        const customChargeAmount = Number(payment.custom_charge_amount || 0);
        const customChargeName = payment.custom_charge_name || 'Extra Charge';
        const totalDue = subtotal + deliveryCharge + customChargeAmount;
        const amountPaid = Number(payment.amount_paid || 0);
        const balance = Number(payment.balance || 0);

        let currentY = summaryY;
        const drawRow = (label, value, isBold = false, color = '#666666', size = 9) => {
            doc.fillColor('#999999').fontSize(8).font('Helvetica-Bold').text(label.toUpperCase(), 350, currentY, { characterSpacing: 1 });
            doc.fillColor(color).fontSize(size).font(isBold ? 'Helvetica-Bold' : 'Helvetica').text(`Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, currentY, { align: 'right', width: 100 });
            currentY += 25;
        };

        drawRow('Subtotal', subtotal);
        if (deliveryCharge > 0) {
            const distText = payment.distance_km > 0 ? `DELIVERY FEE (${payment.distance_km}KM)` : 'DELIVERY FEE';
            drawRow(distText, deliveryCharge);
        }
        if (customChargeAmount > 0) {
            drawRow(customChargeName, customChargeAmount);
        }

        hr(currentY - 10);
        currentY += 10;

        drawRow('Total Amount Due', totalDue, true, '#1a1a1a', 10);
        drawRow('Amount Paid', amountPaid, true, '#059669', 10);
        
        if (balance > 0) {
            doc.rect(345, currentY - 5, 215, 25).fill('#fef2f2');
            doc.fillColor('#ef4444').fontSize(8).font('Helvetica-Bold').text('BALANCE DUE', 350, currentY + 5, { characterSpacing: 1 });
            doc.text(`Rs. ${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 450, currentY + 5, { align: 'right', width: 100 });
            currentY += 35;
        }

        // Final Payment Box
        doc.rect(345, currentY, 215, 45).fill('#1a1a1a');
        doc.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold').text(balance > 0 ? 'TOTAL RECEIVED' : 'PAID AMOUNT', 360, currentY + 12, { characterSpacing: 1 });
        doc.fontSize(18).text(`Rs. ${amountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 360, currentY + 22, { align: 'right', width: 180 });

        // --- Footer ---
        doc.fillColor('#999999')
           .fontSize(8)
           .font('Helvetica')
           .text('THANK YOU FOR YOUR BUSINESS', 50, 750, { align: 'center', width: 500, characterSpacing: 2 });
        doc.text('This is a system generated receipt and does not require a physical signature.', 50, 765, { align: 'center', width: 500, font: 'Helvetica-Oblique' });

        doc.end();

    } catch (error) {
        console.error('Export payment PDF error:', error);
        res.status(500).json({ error: 'Failed to export payment PDF', details: error.message });
    }
};

// Export full payment history as PDF
exports.exportPaymentHistoryPDF = async (req, res) => {
    try {
        const userId = req.userId;
        const { paymentIds } = req.query;
        const PDFDocument = require('pdfkit');
        
        let query = `
            SELECT 
                c.name as customer_name,
                ph.amount,
                ph.delivery_charge,
                ph.payment_status,
                ph.payment_date,
                ph.description
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE c.user_id = ?
            ${req.userZone ? "AND c.zone IN (?)" : ""}
        `;

        let params = req.userZone ? [userId, req.userZone] : [userId];

        if (paymentIds) {
            const ids = paymentIds.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
            if (ids.length > 0) {
                query += ` AND ph.id IN (?)`;
                params.push(ids);
            }
        }

        query += ` ORDER BY ph.payment_date DESC`;
        
        const [rows] = await pool.query(query, params);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'No payment history found' });
        }

        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="payment_history.pdf"');
        doc.pipe(res);

        doc.fontSize(20).text('Payment History Report', { align: 'center' }).moveDown();

        const tableTop = 100;
        const colWidths = [150, 80, 80, 80, 100];
        const headers = ['Customer', 'Amount', 'Del. Charge', 'Status', 'Date'];
        
        let x = 30;
        doc.fontSize(10).fillColor('#000000');
        headers.forEach((h, i) => {
            doc.text(h, x, tableTop, { width: colWidths[i], bold: true });
            x += colWidths[i];
        });

        doc.moveTo(30, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let y = tableTop + 25;
        rows.forEach(row => {
            if (y > 750) {
                doc.addPage();
                y = 50;
                let x2 = 30;
                headers.forEach((h, i) => {
                    doc.text(h, x2, y, { width: colWidths[i], bold: true });
                    x2 += colWidths[i];
                });
                doc.moveTo(30, y + 15).lineTo(550, y + 15).stroke();
                y += 25;
            }

            let xRow = 30;
            doc.text(row.customer_name || '', xRow, y, { width: colWidths[0] }); xRow += colWidths[0];
            doc.text(`Rs. ${row.amount}`, xRow, y, { width: colWidths[1] }); xRow += colWidths[1];
            doc.text(`Rs. ${row.delivery_charge}`, xRow, y, { width: colWidths[2] }); xRow += colWidths[2];
            doc.text(row.payment_status.toUpperCase(), xRow, y, { width: colWidths[3] }); xRow += colWidths[3];
            doc.text(row.payment_date ? new Date(row.payment_date).toLocaleDateString() : '', xRow, y, { width: colWidths[4] });
            
            y += 20;
        });

        doc.end();
    } catch (error) {
        console.error('Export payment history PDF error:', error);
        res.status(500).json({ error: 'Failed to export payment history PDF' });
    }
};
