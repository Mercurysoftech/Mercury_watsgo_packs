const jwt = require('jsonwebtoken');

const { pool } = require('../config/database');

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = 'staff'; // Default, will update from DB

        // Fetch latest user info from DB to ensure role/permissions are current
        const [users] = await pool.query(
            'SELECT * FROM users WHERE id = ?',
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'User not found' });
        }

        const user = users[0];
        req.userRole = user.role;
        req.permissions = user.permissions ? JSON.parse(user.permissions) : [];
        if (user.role === 'staff' && user.zone) {
            try {
                const parsed = JSON.parse(user.zone);
                req.userZone = Array.isArray(parsed) ? parsed : [user.zone];
            } catch {
                req.userZone = [user.zone];
            }
            if (req.userZone && req.userZone.length === 0) {
                req.userZone = null;
            }
        }

        // Determine who the "Owner" of the data is
        // If Admin: they own the data.
        // If Staff: the Admin who created them owns the data.
        // Fallback: If staff has no created_by (legacy), they own their data.
        if (user.role === 'admin') {
            req.ownerId = user.id;
        } else {
            req.ownerId = user.created_by || user.id;
        }

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

const adminOnly = (req, res, next) => {
    if (req.userRole !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

const checkPermission = (permissionId) => {
    return (req, res, next) => {
        // Admins can bypass permission checks
        if (req.userRole === 'admin') {
            return next();
        }

        // Check if staff has the specific permission
        if (req.permissions && req.permissions.includes(permissionId)) {
            return next();
        }

        return res.status(403).json({ 
            error: `Access denied. You do not have permission for '${permissionId}'.` 
        });
    };
};

module.exports = { authMiddleware, adminOnly, checkPermission };
