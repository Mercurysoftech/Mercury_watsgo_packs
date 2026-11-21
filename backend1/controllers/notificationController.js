const admin = require('firebase-admin');
const path = require('path');
const { pool } = require('../config/database');

// Initialize Firebase Admin SDK
const serviceAccount = require('../config/firebase-service-account.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK Initialized');
}

/**
 * Controller for Push Notifications (FCM).
 * Uses Firebase Admin SDK HTTP v1 (Secure).
 */

/**
 * Send a generic push notification to a list of customer IDs.
 * This matches your PHP instruction: http://your-server-ip:5000/api/notifications/send-bulk
 */
exports.sendBulkReminders = async (req, res) => {
    const { customer_ids, customerIds, title, message } = req.body;
    const finalIds = customer_ids || customerIds;

    if (!finalIds || !Array.isArray(finalIds) || finalIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing customer_ids array' });
    }

    try {
        const [customers] = await pool.query(
            "SELECT id, fcm_token FROM customers WHERE id IN (?) AND fcm_token IS NOT NULL",
            [finalIds]
        );

        if (customers.length === 0) {
            return res.json({ success: true, message: 'No device tokens found for these customers' });
        }

        const notificationTitle = title || '🔔 Subscription Reminder';
        const notificationMessage = message || 'Your subscription is due for renewal. Please check the app for details.';

        // Prepare multicast message
        const tokens = customers.map(c => c.fcm_token);

        // Firebase Admin SDK supports sending to multiple tokens
        const response = await admin.messaging().sendEachForMulticast({
            tokens: tokens,
            notification: {
                title: notificationTitle,
                body: notificationMessage,
            },
            android: {
                notification: {
                    sound: 'default',
                    priority: 'high'
                }
            },
            data: {
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                type: 'reminder'
            }
        });

        res.json({
            success: true,
            total: tokens.length,
            successCount: response.successCount,
            failureCount: response.failureCount,
            message: `Successfully processed ${tokens.length} notifications`
        });
    } catch (error) {
        console.error('Bulk FCM error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

/**
 * Core function to send FCM + Save to Database
 */
exports.saveAndSendNotification = async (userId, role, title, message, type = 'info') => {
    try {
        const isCustomer = role === 'customer';
        const tableName = isCustomer ? 'customer_notifications' : 'delivery_notifications';
        const idField = isCustomer ? 'customer_id' : 'delivery_user_id';
        const userTable = isCustomer ? 'customers' : 'delivery_user';

        // 1. Save to Database first
        console.log(`[DEBUG] Storing ${type} notification for ${role} ${userId}`);
        await pool.query(
            `INSERT INTO ${tableName} (${idField}, title, message, type) VALUES (?, ?, ?, ?)`,
            [userId, title, message, type]
        );

        // 2. Fetch Token
        const [[user]] = await pool.query(
            `SELECT fcm_token FROM ${userTable} WHERE id = ?`,
            [userId]
        );

        if (!user || !user.fcm_token || user.fcm_token.length < 10) {
            console.log(`Skipping FCM for ${role} ${userId}: No valid token found.`);
            return true; // Still return true because DB was saved
        }

        // 3. Send FCM
        const payload = {
            token: user.fcm_token,
            notification: { title, body: message },
            android: {
                priority: 'high',
                notification: { sound: 'default' }
            },
            data: {
                click_action: 'FLUTTER_NOTIFICATION_CLICK',
                type: String(type)
            }
        };

        const response = await admin.messaging().send(payload);
        console.log(`Successfully sent FCM message to ${role}:`, response);
        return true;
    } catch (error) {
        console.error('saveAndSendNotification Error:', error.message);
        return false;
    }
};

/**
 * Trigger a notification for a single customer.
 */
exports.triggerSingleReminder = async (req, res) => {
    const { customerId, title, message, type } = req.body;
    
    if (!customerId) {
        return typeof res.status === 'function' ? res.status(400).json({ error: 'Missing customerId' }) : false;
    }

    const finalType = type || 'subscription';
    const success = await exports.saveAndSendNotification(customerId, 'customer', title, message, finalType);

    return typeof res.json === 'function'
        ? res.json({ success, message: success ? 'Notification sent and stored' : 'Failed to process' })
        : success;
};

/**
 * Send a generic push notification to a list of customer IDs.
 */
exports.sendBulkReminders = async (req, res) => {
    const { customer_ids, customerIds, title, message } = req.body;
    const finalIds = customer_ids || customerIds;

    if (!finalIds || !Array.isArray(finalIds) || finalIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing customer_ids array' });
    }

    try {
        const notificationTitle = title || '🔔 Subscription Reminder';
        const notificationMessage = message || 'Your subscription is due for renewal. Please check the app for details.';

        // For bulk, we'll loop to ensure each is stored in DB
        const results = await Promise.all(finalIds.map(id => 
            exports.saveAndSendNotification(id, 'customer', notificationTitle, notificationMessage, 'subscription')
        ));

        const successCount = results.filter(r => r).length;

        res.json({
            success: true,
            total: finalIds.length,
            successCount,
            message: `Processed ${successCount} out of ${finalIds.length} notifications`
        });
    } catch (error) {
        console.error('Bulk FCM error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

/**
 * Send push notification for withdrawal status updates.
 */
exports.withdrawalStatusUpdate = async (req, res) => {
    const { customer_id, status, amount } = req.body;
    const title = 'Withdrawal Update 💰';
    const message = `Your withdrawal request of ₹${amount} has been ${status}.`;

    try {
        const success = await exports.saveAndSendNotification(customer_id, 'customer', title, message, 'wallet');
        res.json({ success, message: success ? 'Withdrawal notification stored and sent' : 'Error processing notification' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Helper to register an FCM token received from the Flutter App.
 */
exports.updateFcmToken = async (req, res) => {
    const { customerId, fcmToken } = req.body;
    if (!customerId || !fcmToken) return res.status(400).json({ error: 'Missing customerId or fcmToken' });

    try {
        await pool.query("UPDATE customers SET fcm_token = ? WHERE id = ?", [fcmToken, customerId]);
        res.json({ success: true, message: 'FCM Token updated' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update token' });
    }
};

/**
 * Older compatibility function (if needed)
 */
exports.sendPushNotification = async (fcmToken, title, message) => {
    // This function no longer handles DB storage because it doesn't have customerId.
    // Recommended to use saveAndSendNotification instead.
    try {
        const payload = {
            token: fcmToken,
            notification: { title, body: message },
            android: { priority: 'high', notification: { sound: 'default' } },
            data: { click_action: 'FLUTTER_NOTIFICATION_CLICK', type: 'info' }
        };
        await admin.messaging().send(payload);
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Handle incoming socket event triggers from external apps (e.g., Delivery App API)
 */
exports.handleInternalSocketEvent = async (req, res) => {
    // Validate API Key for security
    const apiKey = req.headers['x-api-key'] || req.body.api_key;
    if (apiKey !== process.env.ADMIN_API_KEY && apiKey !== 'watsgo_admin_secret_123') {
        return res.status(401).json({ error: 'Unauthorized. Invalid API Key.' });
    }

    const { event, roomId, data } = req.body;

    if (!event || !roomId) {
        return res.status(400).json({ error: 'Missing event name or roomId' });
    }

    try {
        const { sendRealTimeUpdate } = require('../socketManager');
        sendRealTimeUpdate(roomId, event, data || {});
        res.json({ success: true, message: `Event ${event} broadcasted to room ${roomId}` });
    } catch (error) {
        console.error('Error handling internal socket event:', error);
        res.status(500).json({ error: 'Failed to broadcast socket event' });
    }
};
