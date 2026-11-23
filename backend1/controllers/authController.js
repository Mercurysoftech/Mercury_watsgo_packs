const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register new user
const parseZone = (zoneStr) => {
    if (!zoneStr) return [];
    try {
        const parsed = JSON.parse(zoneStr);
        return Array.isArray(parsed) ? parsed : [zoneStr];
    } catch {
        return [zoneStr];
    }
};

exports.register = async (req, res) => {
    try {
        const { fullName, email, password, phone, role, businessName, permissions, zone, otp } = req.body;

        if (!fullName || !email || !password || !otp) {
            return res.status(400).json({ error: 'Full name, email, password and OTP are required' });
        }

        // Verify OTP
        const [otpRows] = await pool.query(
            'SELECT * FROM email_otps WHERE email = ? AND otp = ? AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [email, otp]
        );

        if (otpRows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // Check if user exists
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if this registration is being done by a logged-in admin (for creating staff)
        let createdBy = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                createdBy = decoded.userId;
            } catch (err) {
                console.error('Token verification failed during registration:', err.message);
            }
        }

        // Check staff limit for trial/free plan
        if (createdBy && (role || 'staff') === 'staff') {
            const [ownerRows] = await pool.query(
                'SELECT subscription_status, subscription_expiry, plan_type, addon_extra_staff FROM users WHERE id = ?',
                [createdBy]
            );
            const owner = ownerRows[0] || {};
            const isActive = owner.subscription_status === 'active' &&
            (owner.plan_type === 'free' || owner.plan_type === 'trial' || (owner.subscription_expiry && new Date(owner.subscription_expiry) > new Date()));
            const isTrialOrFree = owner.plan_type === 'trial' || owner.plan_type === 'free';
            const effectivePlan = isActive ? (owner.plan_type || 'pro') : (isTrialOrFree ? (owner.plan_type || 'free') : 'free');

            if (effectivePlan !== 'pro' && effectivePlan !== 'enterprise') {
                const baseStaffLimit = (effectivePlan === 'trial' || effectivePlan === 'free') ? 1 : (effectivePlan === 'starter' ? 5 : (effectivePlan === 'growth' ? 10 : 1));
                const totalAllowed = baseStaffLimit + (owner.addon_extra_staff || 0);

                const [[countRow]] = await pool.query(
                    'SELECT COUNT(*) as cnt FROM users WHERE created_by = ? AND role = "staff"', [createdBy]
                );
                if (countRow.cnt >= totalAllowed) {
                    return res.status(403).json({
                        error: `Staff limit reached for ${effectivePlan.toUpperCase()} Plan (${totalAllowed} staff). Upgrade your plan or buy an 'Extra Staff' addon in Settings.`,
                        limitReached: true,
                        currentPlan: effectivePlan,
                        limit: totalAllowed
                    });
                }
            }
        }

        // New users default to BASIC PLAN with 10 days trial
        const trialExpiry = new Date();
        trialExpiry.setDate(trialExpiry.getDate() + 10);

        const [result] = await pool.query(
            'INSERT INTO users (full_name, email, password, phone, role, business_name, created_by, permissions, plan_type, subscription_expiry, subscription_status, zone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                fullName,
                email,
                hashedPassword,
                phone,
                role || 'admin',
                businessName,
                createdBy,
                permissions ? JSON.stringify(permissions) : null,
                'basic',
                trialExpiry,
                'active',
                zone && Array.isArray(zone) && zone.length > 0 ? JSON.stringify(zone) : null
            ]
        );

        const userId = result.insertId;

        // Create default settings for user
        await pool.query(
            `INSERT INTO settings (user_id, business_name, contact_email, contact_phone, whatsapp_reminder_template, default_pack_price)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                userId,
                businessName || 'Fresh Fruit Packs',
                email,
                phone || '',
                'Hi {{customer_name}}, your monthly fruit pack subscription is due for renewal on {{renewal_date}}. Please complete your payment using the link below:\n{{payment_info}}\nRenew now to continue enjoying fresh fruits.\n– {{business_name}}',
                999
            ]
        );

        // Generate JWT token
        const token = jwt.sign(
            { userId, role: role || 'admin' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Send email with login details if this is a staff member
        if ((role || 'staff') === 'staff') {
            try {
                const { sendEmail } = require('../services/emailService');
                const subject = 'Welcome to Fresh Fruit Packs - Staff Account Created';
                const loginBaseUrl = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',')[0].trim() : '';
                const text = `Hi ${fullName},\n\nYour staff account has been created.\n\nLogin Details:\nEmail: ${email}\nPassword: ${password}\n\nLogin here: ${loginBaseUrl}/`;
                const html = `
                    <h3>Welcome to Fresh Fruit Packs</h3>
                    <p>Hi ${fullName},</p>
                    <p>Your staff account has been created by your administrator.</p>
                    <p><strong>Login Details:</strong><br>
                    Email: ${email}<br>
                    Password: ${password}</p>
                    <p><a href="${loginBaseUrl}/">Click here to login</a></p>
                    <p>Thank you!</p>
                `;
                await sendEmail(email, subject, text, html);
            } catch (emailError) {
                console.error('Email sending failed during registration:', emailError.message);
                // Continue with registration even if email fails
            }
        }

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            user: {
                id: userId,
                fullName,
                email,
                role: role || 'staff',
                businessName,
                zone: zone || null,
                permissions: permissions || []
            }
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

// Login user
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Find user
        const [users] = await pool.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = users[0];

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                role: user.role,
                businessName: user.business_name,
                zone: parseZone(user.zone),
                permissions: user.permissions ? JSON.parse(user.permissions) : []
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

// Get current user profile
exports.getProfile = async (req, res) => {
    try {
        const [users] = await pool.query(
            'SELECT id, full_name, email, phone, role, business_name, permissions, zone, created_at FROM users WHERE id = ?',
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            success: true,
            user: {
                id: users[0].id,
                fullName: users[0].full_name,
                email: users[0].email,
                phone: users[0].phone,
                role: users[0].role,
                businessName: users[0].business_name,
                zone: parseZone(users[0].zone),
                permissions: users[0].permissions ? JSON.parse(users[0].permissions) : [],
                createdAt: users[0].created_at
            }
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to get profile' });
    }
};

// Update user profile
exports.updateProfile = async (req, res) => {
    try {
        const { fullName, phone, businessName } = req.body;

        await pool.query(
            'UPDATE users SET full_name = ?, phone = ?, business_name = ? WHERE id = ?',
            [fullName, phone, businessName, req.userId]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};
// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
    try {
        // --- Permissions Column Migration ---
        try {
            const [columns] = await pool.query('SHOW COLUMNS FROM users LIKE "permissions"');
            if (columns.length === 0) {
                await pool.query('ALTER TABLE users ADD COLUMN permissions TEXT');
            }
        } catch (e) {
            console.error('Migration failed:', e.message);
        }

        try {
            const [columns] = await pool.query('SHOW COLUMNS FROM users LIKE "zone"');
            if (columns.length === 0) {
                await pool.query('ALTER TABLE users ADD COLUMN zone VARCHAR(255)');
            }
        } catch (e) {
            console.error('Migration failed for zone:', e.message);
        }

        // Show:
        // 1. The admin themselves
        // 2. Anyone this admin created
        // 3. Anyone in the same business where created_by is missing (legacy/self-registered)
        const [users] = await pool.query(
            `SELECT u.id, u.full_name, u.email, u.phone, u.role, u.business_name, u.permissions, u.zone, u.created_at 
             FROM users u
             WHERE u.id = ? 
             OR (u.created_by = ? AND u.role != 'admin')
             ORDER BY u.created_at DESC`,
            [req.userId, req.userId]
        );

        res.json({
            success: true,
            users: users.map(u => ({
                id: u.id,
                fullName: u.full_name,
                email: u.email,
                phone: u.phone,
                role: u.role,
                businessName: u.business_name,
                zone: parseZone(u.zone),
                permissions: u.permissions ? JSON.parse(u.permissions) : [],
                createdAt: u.created_at
            }))
        });

    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ error: 'Failed to get users' });
    }
};

// Update a user (admin only)
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, email, phone, role, businessName, permissions, zone } = req.body;

        // Check if email already exists for another user
        if (email) {
            const [existing] = await pool.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, id]
            );

            if (existing.length > 0) {
                return res.status(400).json({ error: 'Email already registered' });
            }
        }

        await pool.query(
            'UPDATE users SET full_name = ?, email = ?, phone = ?, role = ?, business_name = ?, permissions = ?, zone = ? WHERE id = ?',
            [fullName, email, phone, role || 'staff', businessName, permissions ? JSON.stringify(permissions) : null, zone && Array.isArray(zone) && zone.length > 0 ? JSON.stringify(zone) : null, id]
        );

        res.json({
            success: true,
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Don't allow deleting yourself
        if (parseInt(id) === req.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await pool.query('DELETE FROM users WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
// Change password
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new passwords are required' });
        }

        // Get user from DB
        const [users] = await pool.query(
            'SELECT password FROM users WHERE id = ?',
            [req.userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify current password
        const isValid = await bcrypt.compare(currentPassword, users[0].password);
        if (!isValid) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        await pool.query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, req.userId]
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
};

// Delete account (Current user)
exports.deleteAccount = async (req, res) => {
    try {
        const userId = req.user.id;

        // Perform cascading delete or soft delete
        await pool.query('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ success: true, message: 'Account deleted successfully' });
    } catch (err) {
        console.error('Delete account error:', err);
        res.status(500).json({ error: 'Server error during account deletion' });
    }
};

exports.sendOtp = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user already exists
        const [existing] = await pool.query(
            'SELECT id FROM users WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Expire in 10 minutes
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        // Store in DB
        await pool.query(
            'INSERT INTO email_otps (email, otp, expires_at) VALUES (?, ?, ?)',
            [email, otp, expiresAt]
        );

        // Send email
        const { sendEmail } = require('../services/emailService');
        const subject = 'Your Watsgo Verification Code';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
                <h2 style="color: #10b981; text-align: center;">Email Verification</h2>
                <p>Hello,</p>
                <p>Your one-time password (OTP) for registration is:</p>
                <div style="text-align: center; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1f2937; padding: 10px 20px; background: #f3f4f6; border-radius: 8px;">${otp}</span>
                </div>
                <p>This code will expire in 10 minutes.</p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
            </div>
        `;
        
        const emailResult = await sendEmail(email, subject, `Your OTP is ${otp}`, html);

        if (!emailResult.success) {
            return res.status(500).json({ error: 'Failed to send OTP email: ' + emailResult.error });
        }

        res.json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
        console.error('sendOtp error:', err);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
};
