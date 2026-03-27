const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('./config/database');

async function initDatabase() {
  // Run Schema.sql to create tables if they don't exist
  const schemaPath = path.join(__dirname, '..', '..', 'Schema.sql');
  const schemaPathAlt = path.join(__dirname, '..', 'Schema.sql');

  let schemaFile = null;
  if (fs.existsSync(schemaPath)) schemaFile = schemaPath;
  else if (fs.existsSync(schemaPathAlt)) schemaFile = schemaPathAlt;

  if (schemaFile) {
    const sql = fs.readFileSync(schemaFile, 'utf8');
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await sequelize.query(stmt);
      } catch (err) {
        // Ignore duplicate index errors
        if (!err.message.includes('Duplicate') && !err.message.includes('already exists')) {
          console.warn('Schema statement warning:', err.message.substring(0, 100));
        }
      }
    }
    console.log('Database schema initialized.');
  }

  // Seed default users if users table is empty
  try {
    const [users] = await sequelize.query('SELECT COUNT(*) as cnt FROM users');
    if (users[0].cnt === 0) {
      const salt = await bcrypt.genSalt(10);
      const adminHash = await bcrypt.hash('admin123', salt);
      const dispatcherHash = await bcrypt.hash('dispatch123', salt);

      await sequelize.query(
        'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
        { replacements: [uuidv4(), 'admin', adminHash, 'ADMIN'] }
      );
      await sequelize.query(
        'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
        { replacements: [uuidv4(), 'dispatcher', dispatcherHash, 'DISPATCHER'] }
      );
      console.log('Default users seeded (admin/admin123, dispatcher/dispatch123).');
    }
  } catch (err) {
    console.warn('Seed users warning:', err.message);
  }

  // Seed sample data if drivers table is empty
  try {
    const [drivers] = await sequelize.query('SELECT COUNT(*) as cnt FROM drivers');
    if (drivers[0].cnt === 0) {
      const seedPath = path.join(__dirname, '..', 'seed.sql');
      if (fs.existsSync(seedPath)) {
        const seedSql = fs.readFileSync(seedPath, 'utf8');
        const stmts = seedSql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));
        for (const stmt of stmts) {
          try {
            await sequelize.query(stmt);
          } catch (err) {
            // skip user inserts (already done above) or duplicates
          }
        }
        console.log('Sample data seeded.');
      }
    }
  } catch (err) {
    console.warn('Seed data warning:', err.message);
  }
}

module.exports = { initDatabase };
