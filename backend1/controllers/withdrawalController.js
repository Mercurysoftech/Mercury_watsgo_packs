const { pool } = require('../config/database');
const axios = require('axios');

exports.getAllRequests = async (req, res) => {
    try {
        const [requests] = await pool.query(`
            SELECT 
                w.id, w.customer_id, w.amount, w.upi_id, w.status, w.created_at,
                c.name as customer_name,
                c.mobile as customer_mobile
            FROM withdrawal_requests w
            JOIN customers c ON w.customer_id = c.id
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC
        `, [req.ownerId]);

        res.json({
            success: true,
            data: requests
        });
    } catch (error) {
        console.error('Error fetching withdrawal requests:', error);
        res.status(500).json({ error: 'Failed to fetch withdrawal requests' });
    }
};

exports.updateStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    try {
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        // Fetch the request — include current status to avoid double processing
        const [requestRows] = await pool.query(
            'SELECT customer_id, amount, status as current_status FROM withdrawal_requests WHERE id = ? AND user_id = ?',
            [id, req.ownerId]
        );

        if (requestRows.length === 0) {
            return res.status(404).json({ error: 'Withdrawal request not found or unauthorized' });
        }

        const { customer_id, amount, current_status } = requestRows[0];

        if (current_status !== 'pending') {
            return res.status(400).json({ error: `This request is already ${current_status}` });
        }

        // 1. Update the withdrawal request status
        await pool.query(
            'UPDATE withdrawal_requests SET status = ? WHERE id = ? AND user_id = ?',
            [status, id, req.ownerId]
        );

        // 2. Update wallet transaction status
        if (status === 'approved') {
            // Deduct balance from customer wallet
            await pool.query(
                'UPDATE customers SET wallet_balance = wallet_balance - ? WHERE id = ?',
                [amount, customer_id]
            );
            // Mark the pending wallet transaction as success
            await pool.query(
                "UPDATE wallet_transactions SET status = 'success' WHERE customer_id = ? AND amount = ? AND type = 'debit' AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
                [customer_id, amount]
            );
        } else if (status === 'rejected') {
            // Mark the pending wallet transaction as failed (balance NOT deducted)
            await pool.query(
                "UPDATE wallet_transactions SET status = 'failed' WHERE customer_id = ? AND amount = ? AND type = 'debit' AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
                [customer_id, amount]
            );
        }

        // 3. Trigger Push Notification on the Customer App API
        try {
            const CUSTOMER_API_KEY = process.env.CUSTOMER_APP_API_KEY || 'watsgo_admin_secret_123';
            const CUSTOMER_API_URL = process.env.CUSTOMER_APP_API_URL || '';

            await axios.post(`${CUSTOMER_API_URL}/notifications/withdrawal-status`, {
                customer_id: customer_id,
                status: status,
                amount: amount
            }, {
                headers: {
                    'x-api-key': CUSTOMER_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });
            console.log(`✅ Push notification sent to customer ${customer_id} for withdrawal ${status}`);
        } catch (webhookError) {
            // Log but don't fail the main request - status update is already done
            console.error("⚠️ Failed to send push notification:", webhookError.message);
        }

        res.json({
            success: true,
            message: `Withdrawal request successfully ${status}`
        });
    } catch (error) {
        console.error(`Error updating withdrawal request status:`, error);
        res.status(500).json({ error: 'Failed to update status' });
    }
};
