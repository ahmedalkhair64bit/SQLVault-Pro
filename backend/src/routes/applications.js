const express = require('express');
const { body, validationResult, param } = require('express-validator');
const { getDb } = require('../models/db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/applications - List all applications
router.get('/', authenticateToken, (req, res) => {
    const db = getDb();

    try {
        const applications = db.prepare(`
            SELECT a.*,
                COUNT(DISTINCT da.database_id) AS database_count,
                COUNT(DISTINCT ia.instance_id) AS instance_count
            FROM applications a
            LEFT JOIN database_applications da ON a.id = da.application_id
            LEFT JOIN instance_applications ia ON a.id = ia.application_id
            GROUP BY a.id
            ORDER BY a.name
        `).all();
        res.json(applications);
    } catch (err) {
        console.error('List applications error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/applications - Create application (Admin only)
router.post('/', authenticateToken, requireAdmin, [
    body('name').trim().notEmpty().withMessage('Application name is required'),
    body('description').optional().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { name, description } = req.body;

    try {
        const existing = db.prepare('SELECT id FROM applications WHERE name = ?').get(name);
        if (existing) {
            return res.status(400).json({ error: 'Application already exists' });
        }

        const result = db.prepare('INSERT INTO applications (name, description) VALUES (?, ?)').run(name, description);
        res.status(201).json({ id: result.lastInsertRowid, name, description });
    } catch (err) {
        console.error('Create application error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/applications/:id - Get application details with related instances and databases
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
        // Get application
        const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Get databases associated with this application
        const databases = db.prepare(`
            SELECT
                d.id, d.name, d.status, d.size_mb, d.recovery_model,
                d.last_full_backup, d.last_diff_backup, d.last_log_backup,
                i.id AS instance_id, i.name AS instance_name, i.environment, i.last_status
            FROM sql_databases d
            INNER JOIN database_applications da ON d.id = da.database_id
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE da.application_id = ? AND i.is_active = 1
            ORDER BY i.name, d.name
        `).all(id);

        // Get instances directly associated with this application via instance_applications
        const instances = db.prepare(`
            SELECT DISTINCT
                i.id, i.name, i.environment, i.last_status, i.ag_name,
                i.version, i.edition, i.host, i.port, i.last_checked_at,
                (SELECT COUNT(*) FROM sql_databases d WHERE d.instance_id = i.id) AS database_count
            FROM sql_instances i
            INNER JOIN instance_applications ia ON i.id = ia.instance_id
            WHERE ia.application_id = ? AND i.is_active = 1
            ORDER BY i.name
        `).all(id);

        res.json({
            ...application,
            databases,
            instances
        });
    } catch (err) {
        console.error('Get application error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/applications/:id - Update application (Admin only)
router.put('/:id', authenticateToken, requireAdmin, [
    param('id').isInt(),
    body('name').trim().notEmpty().withMessage('Application name is required'),
    body('description').optional().trim()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;
    const { name, description } = req.body;

    try {
        // Check if application exists
        const application = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        // Check if new name already exists (if changing name)
        if (name !== application.name) {
            const existing = db.prepare('SELECT id FROM applications WHERE name = ? AND id != ?').get(name, id);
            if (existing) {
                return res.status(400).json({ error: 'Application name already exists' });
            }
        }

        db.prepare('UPDATE applications SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
            .run(name, description || null, id);

        const updated = db.prepare('SELECT * FROM applications WHERE id = ?').get(id);
        res.json(updated);
    } catch (err) {
        console.error('Update application error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/applications/:id - Delete application (Admin only)
router.delete('/:id', authenticateToken, requireAdmin, [
    param('id').isInt()
], (req, res) => {
    const db = getDb();
    const { id } = req.params;

    try {
        db.prepare('DELETE FROM database_applications WHERE application_id = ?').run(id);
        const result = db.prepare('DELETE FROM applications WHERE id = ?').run(id);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Application not found' });
        }
        res.json({ message: 'Application deleted successfully' });
    } catch (err) {
        console.error('Delete application error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
