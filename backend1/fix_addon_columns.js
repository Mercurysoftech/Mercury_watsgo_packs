const { pool } = require('./config/database');

async function addAddonColumns() {
  try {
    console.log('🚀 Adding addon columns to users table...');
    
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
          console.log(`  ℹ️ Column ${col.name} already exists`);
        } else {
          throw err;
        }
      }
    }

    console.log('✅ Successfully added addon columns to users table.');
  } catch (err) {
    console.error('❌ Error adding columns:', err);
  } finally {
    process.exit(0);
  }
}

addAddonColumns();
