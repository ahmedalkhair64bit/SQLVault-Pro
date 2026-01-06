const express = require('express');
const { body, validationResult, param, query } = require('express-validator');
const { getDb } = require('../models/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
    encryptPassword,
    collectInstanceMetadata,
    saveInstanceMetadata,
    collectDatabaseMetadata,
    saveDatabaseMetadata
} = require('../services/sqlServerCollector');

const router = express.Router();

// GET /api/instances - List all instances with optional filters
router.get('/', authenticateToken, [
    query('environment').optional().isIn(['Production', 'Dev', 'QA', 'UAT', 'Other']),
    query('status').optional().isIn(['UP', 'DOWN', 'UNKNOWN']),
    query('search').optional().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { environment, status, search } = req.query;

    let sql = `
        SELECT
            i.id, i.name, i.environment, i.is_always_on, i.ag_name,
            i.host, i.port, i.description, i.is_active, i.last_status,
            i.last_restart_time, i.version, i.edition, i.cpu_cores, i.total_memory_gb,
            i.last_checked_at, i.last_error, i.created_at, i.updated_at,
            COUNT(DISTINCT d.id) AS database_count
        FROM sql_instances i
        LEFT JOIN sql_databases d ON i.id = d.instance_id
        WHERE i.is_active = 1
    `;
    const params = [];

    if (environment) {
        sql += ' AND i.environment = ?';
        params.push(environment);
    }

    if (status) {
        sql += ' AND i.last_status = ?';
        params.push(status);
    }

    if (search) {
        sql += ' AND (i.name LIKE ? OR i.ag_name LIKE ? OR i.description LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ' GROUP BY i.id ORDER BY i.ag_name NULLS LAST, i.name';

    try {
        const instances = db.prepare(sql).all(...params);

        // Get all application mappings in a single query (optimized for 100+ instances)
        if (instances.length > 0) {
            const instanceIds = instances.map(i => i.id);
            const placeholders = instanceIds.map(() => '?').join(',');
            const appMappings = db.prepare(`
                SELECT instance_id, application_id
                FROM instance_applications
                WHERE instance_id IN (${placeholders})
            `).all(...instanceIds);

            // Build a map for quick lookup
            const appMap = {};
            for (const mapping of appMappings) {
                if (!appMap[mapping.instance_id]) {
                    appMap[mapping.instance_id] = [];
                }
                appMap[mapping.instance_id].push(mapping.application_id);
            }

            // Assign to instances
            for (const instance of instances) {
                instance.application_ids = appMap[instance.id] || [];
            }
        }

        res.json(instances);
    } catch (err) {
        console.error('List instances error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/instances/:id - Get single instance details
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
        // Don't return sensitive fields like auth_password_encrypted
        const instance = db.prepare(`
            SELECT id, name, environment, is_always_on, ag_name,
                   host, port, auth_username, description, is_active, last_status,
                   last_restart_time, version, edition, cpu_cores, total_memory_gb,
                   last_checked_at, last_error, created_at, updated_at
            FROM sql_instances WHERE id = ? AND is_active = 1
        `).get(id);

        if (!instance) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        // Get databases count
        const dbCount = db.prepare('SELECT COUNT(*) as count FROM sql_databases WHERE instance_id = ?').get(id);
        instance.database_count = dbCount.count;

        res.json(instance);
    } catch (err) {
        console.error('Get instance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/instances - Create new instance (Admin only)
router.post('/', authenticateToken, requireAdmin, [
    body('name').trim().notEmpty().withMessage('Instance name is required'),
    body('environment').isIn(['Production', 'Dev', 'QA', 'UAT', 'Other']).withMessage('Invalid environment'),
    body('host').trim().notEmpty().withMessage('Host is required'),
    body('port').optional().isInt({ min: 1, max: 65535 }).withMessage('Invalid port'),
    body('is_always_on').optional().isBoolean(),
    body('ag_name').optional().trim(),
    body('auth_username').trim().notEmpty().withMessage('Authentication username is required'),
    body('auth_password').notEmpty().withMessage('Authentication password is required'),
    body('description').optional().trim()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const {
        name, environment, host, port = 1433, is_always_on = false,
        ag_name, auth_username, auth_password, description
    } = req.body;

    try {
        // Check if instance already exists
        const existing = db.prepare('SELECT id FROM sql_instances WHERE name = ?').get(name);
        if (existing) {
            return res.status(400).json({ error: 'Instance with this name already exists' });
        }

        // Encrypt password before storing
        const encryptedPassword = encryptPassword(auth_password);

        // Insert instance
        const result = db.prepare(`
            INSERT INTO sql_instances (
                name, environment, host, port, is_always_on, ag_name,
                auth_username, auth_password_encrypted, description, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `).run(
            name, environment, host, port, is_always_on ? 1 : 0,
            is_always_on ? ag_name : null,
            auth_username, encryptedPassword, description
        );

        const instanceId = result.lastInsertRowid;

        // Try to collect initial metadata
        const instance = db.prepare('SELECT * FROM sql_instances WHERE id = ?').get(instanceId);

        try {
            const metadata = await collectInstanceMetadata(instance);
            await saveInstanceMetadata(instanceId, metadata);

            // Also collect database objects for each database
            if (metadata.status === 'UP' && metadata.databases) {
                const databases = db.prepare('SELECT id, name FROM sql_databases WHERE instance_id = ?').all(instanceId);
                for (const dbRecord of databases) {
                    try {
                        const dbMetadata = await collectDatabaseMetadata(instance, dbRecord.name);
                        await saveDatabaseMetadata(dbRecord.id, dbMetadata);
                    } catch (dbErr) {
                        console.error(`Failed to collect objects for database ${dbRecord.name}:`, dbErr.message);
                    }
                }
            }
        } catch (collectErr) {
            console.error('Initial collection error:', collectErr);
            // Update status to DOWN and save error message if collection fails
            db.prepare('UPDATE sql_instances SET last_status = ?, last_error = ? WHERE id = ?')
                .run('DOWN', collectErr.message, instanceId);
        }

        // Return the updated instance (without sensitive data)
        const updatedInstance = db.prepare(`
            SELECT id, name, environment, is_always_on, ag_name,
                   host, port, auth_username, description, is_active, last_status,
                   last_restart_time, version, edition, cpu_cores, total_memory_gb,
                   last_checked_at, last_error, created_at, updated_at
            FROM sql_instances WHERE id = ?
        `).get(instanceId);
        res.status(201).json(updatedInstance);

    } catch (err) {
        console.error('Create instance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/instances/:id - Update instance (Admin only for connection details)
router.put('/:id', authenticateToken, requireAdmin, [
    param('id').isInt(),
    body('environment').optional().isIn(['Production', 'Dev', 'QA', 'UAT', 'Other']),
    body('host').optional().trim(),
    body('port').optional().isInt({ min: 1, max: 65535 }),
    body('is_always_on').optional().isBoolean(),
    body('ag_name').optional().trim(),
    body('auth_username').optional().trim(),
    body('auth_password').optional(),
    body('description').optional().trim(),
    body('application_ids').optional().isArray()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;
    const updates = req.body;

    try {
        const instance = db.prepare('SELECT * FROM sql_instances WHERE id = ? AND is_active = 1').get(id);
        if (!instance) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        // Build update query dynamically
        const allowedFields = ['environment', 'host', 'port', 'is_always_on', 'ag_name', 'auth_username', 'description'];
        const setClauses = [];
        const values = [];

        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                setClauses.push(`${field} = ?`);
                values.push(field === 'is_always_on' ? (updates[field] ? 1 : 0) : updates[field]);
            }
        }

        // Handle password separately - encrypt before storing
        if (updates.auth_password) {
            const encryptedPassword = encryptPassword(updates.auth_password);
            setClauses.push('auth_password_encrypted = ?');
            values.push(encryptedPassword);
        }

        if (setClauses.length > 0) {
            setClauses.push('updated_at = CURRENT_TIMESTAMP');
            values.push(id);
            db.prepare(`UPDATE sql_instances SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
        }

        // Handle application_ids
        if (updates.application_ids !== undefined) {
            // Clear existing associations
            db.prepare('DELETE FROM instance_applications WHERE instance_id = ?').run(id);
            // Add new associations
            const insertApp = db.prepare('INSERT INTO instance_applications (instance_id, application_id) VALUES (?, ?)');
            for (const appId of updates.application_ids) {
                insertApp.run(id, appId);
            }
        }

        const updatedInstance = db.prepare(`
            SELECT id, name, environment, is_always_on, ag_name,
                   host, port, auth_username, description, is_active, last_status,
                   last_restart_time, version, edition, cpu_cores, total_memory_gb,
                   last_checked_at, last_error, created_at, updated_at
            FROM sql_instances WHERE id = ?
        `).get(id);

        // Get application_ids
        const appRows = db.prepare('SELECT application_id FROM instance_applications WHERE instance_id = ?').all(id);
        updatedInstance.application_ids = appRows.map(r => r.application_id);

        res.json(updatedInstance);

    } catch (err) {
        console.error('Update instance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/instances/:id/description - Update instance description only (DBA allowed)
router.patch('/:id/description', authenticateToken, [
    param('id').isInt(),
    body('description').trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;
    const { description } = req.body;

    try {
        const instance = db.prepare('SELECT * FROM sql_instances WHERE id = ? AND is_active = 1').get(id);
        if (!instance) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        db.prepare('UPDATE sql_instances SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(description, id);

        const updatedInstance = db.prepare(`
            SELECT id, name, environment, is_always_on, ag_name,
                   host, port, auth_username, description, is_active, last_status,
                   last_restart_time, version, edition, cpu_cores, total_memory_gb,
                   last_checked_at, last_error, created_at, updated_at
            FROM sql_instances WHERE id = ?
        `).get(id);
        res.json(updatedInstance);

    } catch (err) {
        console.error('Update instance description error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/instances/:id - Soft delete instance (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, [
    param('id').isInt(),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
    body('type').isIn(['permanent', 'temporary']).withMessage('Type must be permanent or temporary')
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;
    const { reason, type } = req.body;

    try {
        const result = db.prepare(`
            UPDATE sql_instances
            SET is_active = 0,
                disabled_reason = ?,
                disabled_type = ?,
                disabled_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(reason, type, id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Instance not found' });
        }
        res.json({ message: 'Instance disabled successfully' });
    } catch (err) {
        console.error('Delete instance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/instances/disabled - List disabled instances
router.get('/disabled/list', authenticateToken, requireAdmin, (req, res) => {
    const db = getDb();

    try {
        const instances = db.prepare(`
            SELECT
                i.id, i.name, i.environment, i.host, i.port, i.ag_name,
                i.disabled_reason, i.disabled_type, i.disabled_at,
                i.last_status, i.version, i.edition, i.description
            FROM sql_instances i
            WHERE i.is_active = 0
            ORDER BY i.disabled_at DESC
        `).all();

        res.json(instances);
    } catch (err) {
        console.error('List disabled instances error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/instances/:id/reactivate - Re-enable a disabled instance (Admin only)
router.post('/:id/reactivate', authenticateToken, requireAdmin, [
    param('id').isInt()
], (req, res) => {
    const db = getDb();
    const { id } = req.params;

    try {
        const result = db.prepare(`
            UPDATE sql_instances
            SET is_active = 1,
                disabled_reason = NULL,
                disabled_type = NULL,
                disabled_at = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Instance not found' });
        }
        res.json({ message: 'Instance reactivated successfully' });
    } catch (err) {
        console.error('Reactivate instance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/instances/:id/refresh - Refresh instance metadata
router.post('/:id/refresh', authenticateToken, [
    param('id').isInt()
], async (req, res) => {
    const db = getDb();
    const { id } = req.params;

    try {
        const instance = db.prepare('SELECT * FROM sql_instances WHERE id = ? AND is_active = 1').get(id);
        if (!instance) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        const metadata = await collectInstanceMetadata(instance);
        await saveInstanceMetadata(id, metadata);

        // Also collect database objects for each database
        if (metadata.status === 'UP' && metadata.databases) {
            const databases = db.prepare('SELECT id, name FROM sql_databases WHERE instance_id = ?').all(id);
            for (const dbRecord of databases) {
                try {
                    const dbMetadata = await collectDatabaseMetadata(instance, dbRecord.name);
                    await saveDatabaseMetadata(dbRecord.id, dbMetadata);
                } catch (dbErr) {
                    console.error(`Failed to collect objects for database ${dbRecord.name}:`, dbErr.message);
                }
            }
        }

        const updatedInstance = db.prepare(`
            SELECT id, name, environment, is_always_on, ag_name,
                   host, port, auth_username, description, is_active, last_status,
                   last_restart_time, version, edition, cpu_cores, total_memory_gb,
                   last_checked_at, last_error, created_at, updated_at
            FROM sql_instances WHERE id = ?
        `).get(id);

        res.json(updatedInstance);

    } catch (err) {
        console.error('Refresh instance error:', err);
        res.status(500).json({ error: 'Failed to refresh instance metadata' });
    }
});

// GET /api/instances/:id/databases - List databases for an instance
router.get('/:id/databases', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const db = getDb();
    const { id } = req.params;

    try {
        const databases = db.prepare(`
            SELECT
                d.*,
                GROUP_CONCAT(a.name, ', ') AS applications
            FROM sql_databases d
            LEFT JOIN database_applications da ON d.id = da.database_id
            LEFT JOIN applications a ON da.application_id = a.id
            WHERE d.instance_id = ?
            GROUP BY d.id
            ORDER BY d.name
        `).all(id);

        // Calculate backup status for each database
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        for (const database of databases) {
            if (database.last_full_backup) {
                const lastBackup = new Date(database.last_full_backup);
                if (lastBackup >= sevenDaysAgo) {
                    database.backup_status = 'OK';
                } else {
                    database.backup_status = 'Warning';
                }
            } else {
                database.backup_status = 'Missing';
            }
        }

        res.json(databases);
    } catch (err) {
        console.error('List databases error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/instances/:id/logins - List logins for an instance
router.get('/:id/logins', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const db = getDb();
    const { id } = req.params;

    try {
        const logins = db.prepare(`
            SELECT * FROM sql_instance_logins WHERE instance_id = ? ORDER BY login_name
        `).all(id);
        res.json(logins);
    } catch (err) {
        console.error('List logins error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/instances/:id/backup-history - Get backup history for all databases in instance
router.get('/:id/backup-history', authenticateToken, [
    param('id').isInt(),
    query('period').optional().isIn(['today', 'week', 'month', 'all'])
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;
    const period = req.query.period || 'week';

    try {
        // Calculate date filter based on period
        let dateFilter = '';
        const now = new Date();

        if (period === 'today') {
            const today = now.toISOString().split('T')[0];
            dateFilter = `AND DATE(bh.backup_finish_date) = '${today}'`;
        } else if (period === 'week') {
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            dateFilter = `AND bh.backup_finish_date >= '${weekAgo}'`;
        } else if (period === 'month') {
            const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            dateFilter = `AND bh.backup_finish_date >= '${monthAgo}'`;
        }
        // 'all' = no filter

        const backupHistory = db.prepare(`
            SELECT
                bh.*,
                d.name AS database_name,
                d.id AS database_id
            FROM backup_history bh
            INNER JOIN sql_databases d ON bh.database_id = d.id
            WHERE d.instance_id = ?
            ${dateFilter}
            ORDER BY bh.backup_finish_date DESC
        `).all(id);

        res.json(backupHistory);
    } catch (err) {
        console.error('Get backup history error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/instances/ag/:agName - Get all instances in an Availability Group
router.get('/ag/:agName', authenticateToken, (req, res) => {
    const db = getDb();
    const { agName } = req.params;
    const decodedAgName = decodeURIComponent(agName);

    try {
        const instances = db.prepare(`
            SELECT
                i.id, i.name, i.environment, i.is_always_on, i.ag_name,
                i.host, i.port, i.description, i.is_active, i.last_status,
                i.last_restart_time, i.version, i.edition, i.cpu_cores, i.total_memory_gb,
                i.last_checked_at, i.last_error, i.created_at, i.updated_at,
                COUNT(DISTINCT d.id) AS database_count
            FROM sql_instances i
            LEFT JOIN sql_databases d ON i.id = d.instance_id
            WHERE i.is_active = 1 AND i.ag_name = ?
            GROUP BY i.id
            ORDER BY i.name
        `).all(decodedAgName);

        // Get databases from the primary instance (or all instances in the AG)
        const databases = db.prepare(`
            SELECT DISTINCT
                d.id, d.name, d.status, d.recovery_model, d.size_mb,
                d.last_full_backup, d.last_diff_backup, d.last_log_backup,
                i.name AS instance_name, i.id AS instance_id
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE i.is_active = 1 AND i.ag_name = ?
            ORDER BY d.name
        `).all(decodedAgName);

        res.json({
            ag_name: decodedAgName,
            instance_count: instances.length,
            instances,
            databases
        });
    } catch (err) {
        console.error('Get AG instances error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
