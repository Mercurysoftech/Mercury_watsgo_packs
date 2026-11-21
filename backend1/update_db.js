const { pool } = require('./config/database');

async function updateDb() {
  try {
    const defaultTemplate = `Hi {{customer_name}}, your monthly fruit pack subscription is due for renewal on {{renewal_date}}. Please complete your payment using the link below:\n{{payment_info}}\nRenew now to continue enjoying fresh fruits.\n– {{business_name}}`;
    
    // Update settings table
    const [result] = await pool.query(
      "UPDATE settings s JOIN users u ON s.user_id = u.id SET s.whatsapp_reminder_template = ? WHERE s.whatsapp_reminder_template LIKE '%renew to continue%' OR s.whatsapp_reminder_template IS NULL OR s.whatsapp_reminder_template = ''",
      [defaultTemplate]
    );

    console.log('✅ Updated existing users with new default template. Affected Rows: ', result.affectedRows);
  } catch (err) {
    console.error('❌ Error updating DB:', err);
  } finally {
    process.exit(0);
  }
}

updateDb();
