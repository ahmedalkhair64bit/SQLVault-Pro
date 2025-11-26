const express = require('express');
const { query, validationResult } = require('express-validator');
const { getDb } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/search - Global search
router.get('/', authenticateToken, [
    query('q').trim().notEmpty().withMessage('Search query is required')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { q } = req.query;
    const searchPattern = `%${q}%`;

    try {
        // Search instances
        const instances = db.prepare(`
            SELECT id, name, environment, ag_name, last_status, description
            FROM sql_instances
            WHERE is_active = 1
            AND (name LIKE ? OR description LIKE ? OR ag_name LIKE ?)
            ORDER BY name
            LIMIT 20
        `).all(searchPattern, searchPattern, searchPattern);

        // Search databases by name or description
        const databases = db.prepare(`
            SELECT d.id, d.name, d.status, d.description, i.name AS instance_name, i.environment
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE i.is_active = 1
            AND (d.name LIKE ? OR d.description LIKE ?)
            ORDER BY d.name
            LIMIT 20
        `).all(searchPattern, searchPattern);

        // Search by application name
        const databasesByApp = db.prepare(`
            SELECT DISTINCT d.id, d.name, d.status, d.description, i.name AS instance_name, i.environment
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            INNER JOIN database_applications da ON d.id = da.database_id
            INNER JOIN applications a ON da.application_id = a.id
            WHERE i.is_active = 1
            AND a.name LIKE ?
            ORDER BY d.name
            LIMIT 20
        `).all(searchPattern);

        // Search tables
        const tables = db.prepare(`
            SELECT t.id, t.schema_name, t.table_name, t.row_count,
                   d.id AS database_id, d.name AS database_name,
                   i.name AS instance_name, i.environment
            FROM db_tables t
            INNER JOIN sql_databases d ON t.database_id = d.id
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE i.is_active = 1
            AND t.table_name LIKE ?
            ORDER BY t.table_name
            LIMIT 20
        `).all(searchPattern);

        // Search stored procedures
        const procedures = db.prepare(`
            SELECT p.id, p.schema_name, p.procedure_name, p.created_date,
                   d.id AS database_id, d.name AS database_name,
                   i.name AS instance_name, i.environment
            FROM db_stored_procedures p
            INNER JOIN sql_databases d ON p.database_id = d.id
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE i.is_active = 1
            AND p.procedure_name LIKE ?
            ORDER BY p.procedure_name
            LIMIT 20
        `).all(searchPattern);

        // Merge database results (avoiding duplicates)
        const seenDbIds = new Set(databases.map(d => d.id));
        for (const dbItem of databasesByApp) {
            if (!seenDbIds.has(dbItem.id)) {
                databases.push(dbItem);
                seenDbIds.add(dbItem.id);
            }
        }

        // Also add databases that contain matching tables or procedures
        const databasesFromTables = db.prepare(`
            SELECT DISTINCT d.id, d.name, d.status, d.description, i.name AS instance_name, i.environment
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            INNER JOIN db_tables t ON d.id = t.database_id
            WHERE i.is_active = 1
            AND t.table_name LIKE ?
            ORDER BY d.name
            LIMIT 10
        `).all(searchPattern);

        for (const dbItem of databasesFromTables) {
            if (!seenDbIds.has(dbItem.id)) {
                databases.push(dbItem);
                seenDbIds.add(dbItem.id);
            }
        }

        const databasesFromProcs = db.prepare(`
            SELECT DISTINCT d.id, d.name, d.status, d.description, i.name AS instance_name, i.environment
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            INNER JOIN db_stored_procedures p ON d.id = p.database_id
            WHERE i.is_active = 1
            AND p.procedure_name LIKE ?
            ORDER BY d.name
            LIMIT 10
        `).all(searchPattern);

        for (const dbItem of databasesFromProcs) {
            if (!seenDbIds.has(dbItem.id)) {
                databases.push(dbItem);
                seenDbIds.add(dbItem.id);
            }
        }

        res.json({
            instances,
            databases: databases.slice(0, 30),
            tables,
            procedures
        });

    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
