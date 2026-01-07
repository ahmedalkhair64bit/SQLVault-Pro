const Database = require('better-sqlite3');
const path = require('path');
const fsModule = require('fs');
require('dotenv').config();

const dbPath = process.env.DB_PATH;
if (!dbPath) {
    throw new Error('DB_PATH environment variable must be set');
}
const dbDir = path.dirname(dbPath);

// Ensure data directory exists
if (!fsModule.existsSync(dbDir)) {
    fsModule.mkdirSync(dbDir, { recursive: true });
    console.log("Created directory:", dbDir);
}

const db = new Database(dbPath);

console.log('Running migrations...');

// Import and run schema
const { schema } = require('./001_initial_schema');
const { addLastErrorColumn } = require('./002_add_last_error');

// Split by semicolons and run each statement
const statements = schema.split(';').filter(s => s.trim());
for (const statement of statements) {
    if (statement.trim()) {
        try {
            db.exec(statement);
        } catch (err) {
            console.error("Error in migration");
            console.error(err.message);
        }
    }
}

// Run migration 002 - add last_error column (for existing databases)
const migration002Statements = addLastErrorColumn.split(';').filter(s => s.trim());
for (const statement of migration002Statements) {
    if (statement.trim()) {
        try {
            db.exec(statement);
        } catch (err) {
            // Column may already exist, ignore duplicate column error
            if (!err.message.includes('duplicate column')) {
                console.error("Error in migration");
            }
        }
    }
}

console.log('Migrations completed successfully!');
db.close();
