const { pool } = require('../config/database');

/**
 * Record a payment in payment_history table
 * Called when marking a customer as paid
 */
exports.recordPaymentHistory = async (customerId, userId, paymentStatus, paymentDate, renewalDate) => {
    try {
        // Fetch settings for invoice
        const [settingsRows] = await pool.query('SELECT invoice_prefix, invoice_start_number FROM settings WHERE user_id = ?', [userId]);
        const invoicePrefix = settingsRows[0]?.invoice_prefix !== undefined && settingsRows[0]?.invoice_prefix !== null ? settingsRows[0].invoice_prefix : 'INV-';
        const invoiceStartNum = Number(settingsRows[0]?.invoice_start_number) || 1;

        const [seqResult] = await pool.query(
            'SELECT MAX(invoice_seq) as max_seq FROM payment_history WHERE user_id = ?',
            [userId]
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
                customer_id, 
                user_id, 
                payment_status, 
                payment_date, 
                renewal_date,
                invoice_seq,
                invoice_string
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [customerId, userId, paymentStatus, paymentDate, renewalDate, nextSeq, nextInvoiceString]);
    } catch (error) {
        console.error('Error recording payment history:', error);
    }
};

/**
 * Get payment history for all customers of a user
 */
exports.getPaymentHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const { customerId, status } = req.query;

        let query = `
            SELECT 
                ph.*,
                c.name as customer_name,
                c.mobile as customer_mobile
            FROM payment_history ph
            JOIN customers c ON ph.customer_id = c.id
            WHERE ph.user_id = ?
        `;

        const params = [userId];

        if (customerId) {
            query += ` AND ph.customer_id = ?`;
            params.push(customerId);
        }

        if (status) {
            query += ` AND ph.payment_status = ?`;
            params.push(status);
        }

        query += ` ORDER BY ph.payment_date DESC`;

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
 * Get payment history for specific customer
 */
exports.getCustomerPaymentHistory = async (req, res) => {
    try {
        const { customerId } = req.params;
        const userId = req.userId;

        // Verify customer belongs to user
        const [customer] = await pool.query(
            'SELECT id FROM customers WHERE id = ? AND user_id = ?',
            [customerId, userId]
        );

        if (customer.length === 0) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const [rows] = await pool.query(`
            SELECT * FROM payment_history
            WHERE customer_id = ? AND user_id = ?
            ORDER BY payment_date DESC
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
 * Delete payment history record
 */
exports.deletePaymentHistory = async (req, res) => {
    try {
        const { paymentHistoryId } = req.params;
        const userId = req.userId;

        // Verify ownership
        const [payment] = await pool.query(
            'SELECT id FROM payment_history WHERE id = ? AND user_id = ?',
            [paymentHistoryId, userId]
        );

        if (payment.length === 0) {
            return res.status(404).json({ error: 'Payment record not found' });
        }

        await pool.query(
            'DELETE FROM payment_history WHERE id = ? AND user_id = ?',
            [paymentHistoryId, userId]
        );

        res.status(200).json({
            success: true,
            message: 'Payment record deleted successfully'
        });
    } catch (error) {
        console.error('Delete payment history error:', error);
        res.status(500).json({
            error: 'Failed to delete payment record',
            details: error.message
        });
    }
};
