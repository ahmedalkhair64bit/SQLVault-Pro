const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/inventory.db';
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created directory: ${dbDir}`);
}

const db = new Database(dbPath);

console.log('Running migrations...');

// Import and run schema
const { schema } = require('./001_initial_schema');

// Split by semicolons and run each statement
const statements = schema.split(';').filter(s => s.trim());
for (const statement of statements) {
    if (statement.trim()) {
        try {
            db.exec(statement);
        } catch (err) {
            console.error(`Error executing statement: ${statement.substring(0, 50)}...`);
            console.error(err.message);
        }
    }
}

console.log('Migrations completed successfully!');
db.close();
