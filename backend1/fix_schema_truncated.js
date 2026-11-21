const { pool } = require('./config/database');

async function fixSchema() {
  try {
    console.log('🚀 Fixing users table schema...');
    
    // Increase plan_type length
    await pool.query("ALTER TABLE users MODIFY COLUMN plan_type VARCHAR(50) DEFAULT 'free'");
    console.log('  ✓ Increased plan_type length to 50');
    
    // Also ensure addon columns exist (just in case)
    const columns = [
      { name: 'addon_delivery_boys', type: 'INT DEFAULT 0' },
      { name: 'addon_customer_app', type: 'INT DEFAULT 0' },
      { name: 'addon_extra_customers', type: 'INT DEFAULT 0' },
      { name: 'addon_extra_staff', type: 'INT DEFAULT 0' },
      { name: 'addon_extra_zones', type: 'INT DEFAULT 0' }
    ];

    for (const col of columns) {
      try {
        await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
        console.log(`  ✓ Added column: ${col.name}`);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
          // console.log(`  ℹ️ Column ${col.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    console.log('✅ Schema fix completed.');
  } catch (err) {
    console.error('❌ Error fixing schema:', err);
  } finally {
    process.exit(0);
  }
}

fixSchema();
