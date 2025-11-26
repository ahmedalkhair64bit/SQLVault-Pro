const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const dbPath = process.env.DB_PATH || './data/inventory.db';
const db = new Database(dbPath);

const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

console.log('Seeding database...');

// Check if admin user already exists
const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);

if (existingUser) {
    console.log(`Admin user '${adminUsername}' already exists. Skipping...`);
} else {
    // Create admin user
    const passwordHash = bcrypt.hashSync(adminPassword, 10);

    db.prepare(`
        INSERT INTO users (username, password_hash, role)
        VALUES (?, ?, 'admin')
    `).run(adminUsername, passwordHash);

    console.log(`Created admin user: ${adminUsername}`);
}

// Note: Applications are no longer pre-seeded - users create their own via Manage Applications

console.log('Seeding completed!');
db.close();
