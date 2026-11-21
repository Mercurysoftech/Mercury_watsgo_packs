const { pool } = require('../config/database');

// Get all categories for logged in user
exports.getAllCategories = async (req, res) => {
    try {
        const [categories] = await pool.query(
            'SELECT id, name, created_at FROM categories WHERE user_id = ? ORDER BY name ASC',
            [req.ownerId]
        );

        res.json({
            success: true,
            categories
        });
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Failed to get categories' });
    }
};

// Create new category
exports.createCategory = async (req, res) => {
    try {
        const { name } = req.body;

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ error: 'Category name must be at least 2 characters' });
        }

        const [result] = await pool.query(
            'INSERT INTO categories (name, user_id) VALUES (?, ?)',
            [name.trim(), req.ownerId]
        );

        res.status(201).json({
            success: true,
            message: 'Category created successfully',
            categoryId: result.insertId
        });
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Failed to create category' });
    }
};

// Delete category
exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;

        // Verify ownership
        const [existing] = await pool.query(
            'SELECT id FROM categories WHERE id = ? AND user_id = ?',
            [id, req.ownerId]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        await pool.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [id, req.ownerId]);

        res.json({
            success: true,
            message: 'Category deleted successfully'
        });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Failed to delete category' });
    }
};
