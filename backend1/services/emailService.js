const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Send email using SMTP
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content
 * @param {string} html - HTML content
 */
async function sendEmail(to, subject, text, html) {
    try {
        // Use placeholder or env variables
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const info = await transporter.sendMail({
            from: `"${process.env.BUSINESS_NAME || 'Fresh Fruit Packs'}" <${process.env.SMTP_USER}>`,
            to,
            subject,
            text,
            html
        });

        console.log('📧 Email sent: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email Error:', error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { sendEmail };
