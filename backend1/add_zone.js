const { pool } = require('./config/database'); 
pool.query('ALTER TABLE users ADD COLUMN zone VARCHAR(255)')
  .then(()=> console.log('Column added successfully'))
  .catch(e => console.log('Error or column exists:', e.message))
  .finally(() => process.exit(0));
