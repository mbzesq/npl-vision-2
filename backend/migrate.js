require('dotenv').config();
const { sequelize } = require('./src/models');

async function runMigration() {
  try {
    console.log('🔄 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established.');
    
    console.log('🔄 Adding new columns to loans table...');
    
    // Add the new columns one by one
    const queries = [
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS servicer_name VARCHAR(255);`,
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS monthly_payment DECIMAL(15,2);`,
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS loan_type VARCHAR(50);`,
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS property_type VARCHAR(50);`,
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS next_due_date DATE;`,
      `ALTER TABLE loans ADD COLUMN IF NOT EXISTS document_types VARCHAR(255);`
    ];
    
    for (const query of queries) {
      try {
        await sequelize.query(query);
        console.log('✅ Executed:', query);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('⚠️ Column already exists:', query);
        } else {
          console.error('❌ Failed:', query, error.message);
        }
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    
    // Verify columns exist
    const [results] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'loans' ORDER BY ordinal_position;`
    );
    
    console.log('📋 Current loan table columns:');
    results.forEach(row => console.log(`  - ${row.column_name}`));
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await sequelize.close();
  }
}

runMigration();