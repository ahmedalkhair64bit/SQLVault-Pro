const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { getDb } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');
const {
    collectDatabaseMetadata,
    saveDatabaseMetadata
} = require('../services/sqlServerCollector');

const router = express.Router();

// GET /api/databases/:id - Get single database details
router.get('/:id', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;

    try {
        const database = db.prepare(`
            SELECT
                d.*,
                i.name AS instance_name,
                i.environment,
                i.host,
                i.port,
                i.is_always_on,
                i.ag_name
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE d.id = ?
        `).get(id);

        if (!database) {
            return res.status(404).json({ error: 'Database not found' });
        }

        // Get related applications
        database.applications = db.prepare(`
            SELECT a.id, a.name
            FROM applications a
            INNER JOIN database_applications da ON a.id = da.application_id
            WHERE da.database_id = ?
        `).all(id);

        // Get backup history
        database.backup_history = db.prepare(`
            SELECT * FROM backup_history WHERE database_id = ? ORDER BY backup_start_date DESC LIMIT 20
        `).all(id);

        res.json(database);
    } catch (err) {
        console.error('Get database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/databases/:id - Update database metadata (description, applications)
router.put('/:id', authenticateToken, [
    param('id').isInt(),
    body('description').optional().trim(),
    body('application_ids').optional().isArray()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;
    const { description, application_ids } = req.body;

    try {
        const database = db.prepare('SELECT * FROM sql_databases WHERE id = ?').get(id);
        if (!database) {
            return res.status(404).json({ error: 'Database not found' });
        }

        // Update description
        if (description !== undefined) {
            db.prepare('UPDATE sql_databases SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
                .run(description, id);
        }

        // Update applications
        if (application_ids !== undefined) {
            // Clear existing associations
            db.prepare('DELETE FROM database_applications WHERE database_id = ?').run(id);

            // Add new associations
            const insertApp = db.prepare('INSERT INTO database_applications (database_id, application_id) VALUES (?, ?)');
            for (const appId of application_ids) {
                insertApp.run(id, appId);
            }
        }

        // Return updated database
        const updatedDb = db.prepare(`
            SELECT d.*, i.name AS instance_name, i.environment, i.is_always_on, i.ag_name
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE d.id = ?
        `).get(id);

        updatedDb.applications = db.prepare(`
            SELECT a.id, a.name
            FROM applications a
            INNER JOIN database_applications da ON a.id = da.application_id
            WHERE da.database_id = ?
        `).all(id);

        res.json(updatedDb);

    } catch (err) {
        console.error('Update database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/databases/:id/refresh - Refresh database metadata (objects, users)
router.post('/:id/refresh', authenticateToken, [
    param('id').isInt()
], async (req, res) => {
    const db = getDb();
    const { id } = req.params;

    try {
        const database = db.prepare(`
            SELECT d.*, i.*
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE d.id = ?
        `).get(id);

        if (!database) {
            return res.status(404).json({ error: 'Database not found' });
        }

        // Collect metadata from SQL Server
        const instance = {
            host: database.host,
            port: database.port,
            auth_username: database.auth_username,
            auth_password_encrypted: database.auth_password_encrypted
        };

        const metadata = await collectDatabaseMetadata(instance, database.name);
        await saveDatabaseMetadata(id, metadata);

        res.json({ message: 'Database metadata refreshed successfully' });

    } catch (err) {
        console.error('Refresh database error:', err);
        res.status(500).json({ error: 'Failed to refresh database metadata' });
    }
});

// GET /api/databases/:id/tables - List tables
router.get('/:id/tables', authenticateToken, [
    param('id').isInt(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM db_tables WHERE database_id = ?').get(id).count;

        const tables = db.prepare(`
            SELECT * FROM db_tables
            WHERE database_id = ?
            ORDER BY schema_name, table_name
            LIMIT ? OFFSET ?
        `).all(id, limit, offset);

        res.json({
            data: tables,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('List tables error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/databases/:id/indexes - List indexes
router.get('/:id/indexes', authenticateToken, [
    param('id').isInt(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM db_indexes WHERE database_id = ?').get(id).count;

        const indexes = db.prepare(`
            SELECT * FROM db_indexes
            WHERE database_id = ?
            ORDER BY table_name, index_name
            LIMIT ? OFFSET ?
        `).all(id, limit, offset);

        res.json({
            data: indexes,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('List indexes error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/databases/:id/procedures - List stored procedures
router.get('/:id/procedures', authenticateToken, [
    param('id').isInt(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
], (req, res) => {
    const db = getDb();
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    try {
        const total = db.prepare('SELECT COUNT(*) as count FROM db_stored_procedures WHERE database_id = ?').get(id).count;

        const procedures = db.prepare(`
            SELECT * FROM db_stored_procedures
            WHERE database_id = ?
            ORDER BY schema_name, procedure_name
            LIMIT ? OFFSET ?
        `).all(id, limit, offset);

        res.json({
            data: procedures,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('List procedures error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/databases/:id/users - List database users
router.get('/:id/users', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const db = getDb();
    const { id } = req.params;

    try {
        const users = db.prepare(`
            SELECT * FROM db_users WHERE database_id = ? ORDER BY user_name
        `).all(id);
        res.json(users);
    } catch (err) {
        console.error('List database users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
