/**
 * Middleware to secure Admin/Server routes using a shared API Key.
 * This matches the requirement in the PHP example where 'x-api-key' is sent in headers.
 */
const adminAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.ADMIN_API_KEY || 'watsgo_admin_secret_123';

    if (!apiKey || apiKey !== validApiKey) {
        console.warn(`Unauthorized Admin API call attempted from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid or missing API Key' });
    }
    next();
};

module.exports = adminAuth;
