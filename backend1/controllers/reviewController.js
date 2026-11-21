const { pool } = require('../config/database');

exports.getAllReviews = async (req, res) => {
    try {
        const type = req.query.type || 'delivery';
        let query = '';
        let params = [req.ownerId];

        if (type === 'vendor') {
            query = `
                SELECT 
                    r.id, r.customer_id, NULL as delivery_user_id, r.rating, r.feedback, r.created_at,
                    c.name as customer_name,
                    c.mobile as customer_mobile,
                    NULL as delivery_man_name,
                    NULL as delivery_man_mobile
                FROM vendor_reviews r
                JOIN customers c ON r.customer_id = c.id
                WHERE c.user_id = ?
                ORDER BY r.created_at DESC
            `;
        } else if (type === 'custom') {
            query = `
                SELECT 
                    cs.id, cs.customer_id, NULL as delivery_user_id, 0 as rating, cs.text_content as feedback, cs.created_at,
                    c.name as customer_name,
                    c.mobile as customer_mobile,
                    NULL as delivery_man_name,
                    NULL as delivery_man_mobile,
                    cs.image1, cs.image2, cs.image3, cs.image4, cs.image5
                FROM custom_submissions cs
                JOIN customers c ON cs.customer_id = c.id
                WHERE cs.user_id = ?
                ORDER BY cs.created_at DESC
            `;
        } else {
            query = `
                SELECT 
                    dr.id, dr.customer_id, dr.delivery_user_id, dr.rating, dr.feedback, dr.created_at,
                    c.name as customer_name,
                    c.mobile as customer_mobile,
                    du.name as delivery_man_name,
                    du.mobile as delivery_man_mobile
                FROM delivery_reviews dr
                JOIN customers c ON dr.customer_id = c.id
                LEFT JOIN delivery_user du ON dr.delivery_user_id = du.id
                WHERE c.user_id = ?
                ORDER BY dr.created_at DESC
            `;
        }

        const [reviews] = await pool.query(query, params);

        res.json({
            success: true,
            data: reviews
        });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
};
