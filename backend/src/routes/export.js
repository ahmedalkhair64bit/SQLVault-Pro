const express = require('express');
const { param, validationResult } = require('express-validator');
const { getDb } = require('../models/db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper to convert array of objects to CSV
function toCSV(data, columns) {
    if (!data || data.length === 0) return '';

    const header = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
        columns.map(c => {
            const value = row[c.key];
            if (value === null || value === undefined) return '';
            const strValue = String(value);
            // Escape quotes and wrap in quotes if contains comma or newline
            if (strValue.includes(',') || strValue.includes('\n') || strValue.includes('"')) {
                return `"${strValue.replace(/"/g, '""')}"`;
            }
            return strValue;
        }).join(',')
    );

    return [header, ...rows].join('\n');
}

// GET /api/export/instances - Export all instances
router.get('/instances', authenticateToken, (req, res) => {
    const db = getDb();

    try {
        const instances = db.prepare(`
            SELECT
                i.name,
                i.environment,
                i.ag_name AS availability_group,
                i.last_status AS status,
                i.version,
                i.edition,
                i.cpu_cores,
                i.total_memory_gb,
                i.host,
                i.port,
                i.last_restart_time,
                i.description,
                i.last_checked_at,
                COUNT(d.id) AS database_count
            FROM sql_instances i
            LEFT JOIN sql_databases d ON i.id = d.instance_id
            WHERE i.is_active = 1
            GROUP BY i.id
            ORDER BY i.name
        `).all();

        const columns = [
            { key: 'name', label: 'Instance Name' },
            { key: 'environment', label: 'Environment' },
            { key: 'availability_group', label: 'Availability Group' },
            { key: 'status', label: 'Status' },
            { key: 'version', label: 'Version' },
            { key: 'edition', label: 'Edition' },
            { key: 'cpu_cores', label: 'CPU Cores' },
            { key: 'total_memory_gb', label: 'Total Memory (GB)' },
            { key: 'host', label: 'Host' },
            { key: 'port', label: 'Port' },
            { key: 'last_restart_time', label: 'Last Restart' },
            { key: 'database_count', label: 'Database Count' },
            { key: 'description', label: 'Description' },
            { key: 'last_checked_at', label: 'Last Checked' }
        ];

        const csv = toCSV(instances, columns);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="sql_instances.csv"');
        res.send(csv);

    } catch (err) {
        console.error('Export instances error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/instance/:id - Export single instance with all details
router.get('/instance/:id', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;

    try {
        const instance = db.prepare('SELECT * FROM sql_instances WHERE id = ? AND is_active = 1').get(id);
        if (!instance) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        let csv = '';

        // Instance info section
        csv += '=== INSTANCE INFORMATION ===\n';
        csv += `Name,${instance.name}\n`;
        csv += `Environment,${instance.environment}\n`;
        csv += `Availability Group,${instance.ag_name || 'Standalone'}\n`;
        csv += `Status,${instance.last_status}\n`;
        csv += `Version,${instance.version || 'Unknown'}\n`;
        csv += `Edition,${instance.edition || 'Unknown'}\n`;
        csv += `CPU Cores,${instance.cpu_cores || 'Unknown'}\n`;
        csv += `Total Memory (GB),${instance.total_memory_gb || 'Unknown'}\n`;
        csv += `Host,${instance.host}\n`;
        csv += `Port,${instance.port}\n`;
        csv += `Last Restart,${instance.last_restart_time || 'Unknown'}\n`;
        csv += `Description,${instance.description || ''}\n`;
        csv += '\n';

        // Databases section
        const databases = db.prepare(`
            SELECT d.*, GROUP_CONCAT(a.name, '; ') AS applications
            FROM sql_databases d
            LEFT JOIN database_applications da ON d.id = da.database_id
            LEFT JOIN applications a ON da.application_id = a.id
            WHERE d.instance_id = ?
            GROUP BY d.id
            ORDER BY d.name
        `).all(id);

        csv += '=== DATABASES ===\n';
        csv += 'Name,Status,Recovery Model,Total Size (MB),Data File Size (MB),Log File Size (MB),Data File Path,Log File Path,Last Full Backup,Last Diff Backup,Last Log Backup,Applications,Description\n';
        for (const dbRow of databases) {
            csv += `${dbRow.name},${dbRow.status},${dbRow.recovery_model},${dbRow.size_mb || ''},${dbRow.data_file_size_mb || ''},${dbRow.log_file_size_mb || ''},`;
            csv += `"${dbRow.data_file_path || ''}","${dbRow.log_file_path || ''}",`;
            csv += `${dbRow.last_full_backup || ''},${dbRow.last_diff_backup || ''},${dbRow.last_log_backup || ''},`;
            csv += `"${dbRow.applications || ''}","${dbRow.description || ''}"\n`;
        }
        csv += '\n';

        // Logins section
        const logins = db.prepare('SELECT * FROM sql_instance_logins WHERE instance_id = ? ORDER BY login_name').all(id);

        csv += '=== LOGINS ===\n';
        csv += 'Login Name,Login Type,Default Database,Is Disabled,Created Date\n';
        for (const login of logins) {
            csv += `${login.login_name},${login.login_type},${login.default_database || ''},${login.is_disabled ? 'Yes' : 'No'},${login.created_date || ''}\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${instance.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.csv"`);
        res.send(csv);

    } catch (err) {
        console.error('Export instance error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/database/:id - Export single database with all details
router.get('/database/:id', authenticateToken, [
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
            SELECT d.*, i.name AS instance_name, i.environment
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE d.id = ?
        `).get(id);

        if (!database) {
            return res.status(404).json({ error: 'Database not found' });
        }

        let csv = '';

        // Database info section
        csv += '=== DATABASE INFORMATION ===\n';
        csv += `Name,${database.name}\n`;
        csv += `Instance,${database.instance_name}\n`;
        csv += `Environment,${database.environment}\n`;
        csv += `Status,${database.status}\n`;
        csv += `Recovery Model,${database.recovery_model || 'Unknown'}\n`;
        csv += `Total Size (MB),${database.size_mb || 'Unknown'}\n`;
        csv += `Data File Size (MB),${database.data_file_size_mb || 'Unknown'}\n`;
        csv += `Log File Size (MB),${database.log_file_size_mb || 'Unknown'}\n`;
        csv += `Data File Path,"${database.data_file_path || 'Unknown'}"\n`;
        csv += `Log File Path,"${database.log_file_path || 'Unknown'}"\n`;
        csv += `Last Full Backup,${database.last_full_backup || 'Never'}\n`;
        csv += `Last Diff Backup,${database.last_diff_backup || 'Never'}\n`;
        csv += `Last Log Backup,${database.last_log_backup || 'Never'}\n`;
        csv += `Description,"${database.description || ''}"\n`;
        csv += '\n';

        // Applications
        const apps = db.prepare(`
            SELECT a.name FROM applications a
            INNER JOIN database_applications da ON a.id = da.application_id
            WHERE da.database_id = ?
        `).all(id);
        csv += `Related Applications,${apps.map(a => a.name).join('; ')}\n`;
        csv += '\n';

        // Tables section
        const tables = db.prepare('SELECT * FROM db_tables WHERE database_id = ? ORDER BY schema_name, table_name').all(id);
        csv += '=== TABLES ===\n';
        csv += 'Schema,Table Name,Row Count,Created Date\n';
        for (const table of tables) {
            csv += `${table.schema_name},${table.table_name},${table.row_count || ''},${table.created_date || ''}\n`;
        }
        csv += '\n';

        // Indexes section
        const indexes = db.prepare('SELECT * FROM db_indexes WHERE database_id = ? ORDER BY table_name, index_name').all(id);
        csv += '=== INDEXES ===\n';
        csv += 'Table Name,Index Name,Index Type,Is Unique\n';
        for (const idx of indexes) {
            csv += `${idx.table_name},${idx.index_name},${idx.index_type},${idx.is_unique ? 'Yes' : 'No'}\n`;
        }
        csv += '\n';

        // Stored Procedures section
        const procs = db.prepare('SELECT * FROM db_stored_procedures WHERE database_id = ? ORDER BY schema_name, procedure_name').all(id);
        csv += '=== STORED PROCEDURES ===\n';
        csv += 'Schema,Procedure Name,Created Date\n';
        for (const proc of procs) {
            csv += `${proc.schema_name},${proc.procedure_name},${proc.created_date || ''}\n`;
        }
        csv += '\n';

        // Users section
        const users = db.prepare('SELECT * FROM db_users WHERE database_id = ? ORDER BY user_name').all(id);
        csv += '=== DATABASE USERS ===\n';
        csv += 'User Name,User Type,Default Schema,Roles\n';
        for (const user of users) {
            csv += `${user.user_name},${user.user_type},${user.default_schema || ''},"${user.roles || ''}"\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_export.csv"`);
        res.send(csv);

    } catch (err) {
        console.error('Export database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/all-databases - Export all databases
router.get('/all-databases', authenticateToken, (req, res) => {
    const db = getDb();

    try {
        const databases = db.prepare(`
            SELECT
                d.name AS database_name,
                i.name AS instance_name,
                i.environment,
                d.status,
                d.recovery_model,
                d.size_mb,
                d.data_file_size_mb,
                d.log_file_size_mb,
                d.data_file_path,
                d.log_file_path,
                d.last_full_backup,
                d.last_diff_backup,
                d.last_log_backup,
                GROUP_CONCAT(a.name, '; ') AS applications,
                d.description
            FROM sql_databases d
            INNER JOIN sql_instances i ON d.instance_id = i.id
            LEFT JOIN database_applications da ON d.id = da.database_id
            LEFT JOIN applications a ON da.application_id = a.id
            WHERE i.is_active = 1
            GROUP BY d.id
            ORDER BY i.name, d.name
        `).all();

        const columns = [
            { key: 'database_name', label: 'Database Name' },
            { key: 'instance_name', label: 'Instance' },
            { key: 'environment', label: 'Environment' },
            { key: 'status', label: 'Status' },
            { key: 'recovery_model', label: 'Recovery Model' },
            { key: 'size_mb', label: 'Size (MB)' },
            { key: 'data_file_size_mb', label: 'Data File Size (MB)' },
            { key: 'log_file_size_mb', label: 'Log File Size (MB)' },
            { key: 'data_file_path', label: 'Data File Path' },
            { key: 'log_file_path', label: 'Log File Path' },
            { key: 'last_full_backup', label: 'Last Full Backup' },
            { key: 'last_diff_backup', label: 'Last Diff Backup' },
            { key: 'last_log_backup', label: 'Last Log Backup' },
            { key: 'applications', label: 'Applications' },
            { key: 'description', label: 'Description' }
        ];

        const csv = toCSV(databases, columns);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="all_databases.csv"');
        res.send(csv);

    } catch (err) {
        console.error('Export all databases error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/backup-history - Export backup history
router.get('/backup-history', authenticateToken, (req, res) => {
    const db = getDb();

    try {
        const backups = db.prepare(`
            SELECT
                d.name AS database_name,
                i.name AS instance_name,
                i.environment,
                bh.backup_type,
                bh.backup_start_date,
                bh.backup_finish_date,
                bh.backup_size_mb
            FROM backup_history bh
            INNER JOIN sql_databases d ON bh.database_id = d.id
            INNER JOIN sql_instances i ON d.instance_id = i.id
            WHERE i.is_active = 1
            ORDER BY bh.backup_finish_date DESC
        `).all();

        const columns = [
            { key: 'database_name', label: 'Database Name' },
            { key: 'instance_name', label: 'Instance' },
            { key: 'environment', label: 'Environment' },
            { key: 'backup_type', label: 'Backup Type' },
            { key: 'backup_start_date', label: 'Start Time' },
            { key: 'backup_finish_date', label: 'Finish Time' },
            { key: 'backup_size_mb', label: 'Size (MB)' }
        ];

        const csv = toCSV(backups, columns);

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="backup_history.csv"');
        res.send(csv);

    } catch (err) {
        console.error('Export backup history error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/instance/:id/databases - Export only databases for an instance
router.get('/instance/:id/databases', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;

    try {
        const instance = db.prepare('SELECT name FROM sql_instances WHERE id = ? AND is_active = 1').get(id);
        if (!instance) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        const databases = db.prepare(`
            SELECT d.name, d.status, d.recovery_model, d.size_mb, d.data_file_size_mb, d.log_file_size_mb,
                   d.data_file_path, d.log_file_path, d.last_full_backup, d.last_diff_backup, d.last_log_backup,
                   GROUP_CONCAT(a.name, '; ') AS applications, d.description
            FROM sql_databases d
            LEFT JOIN database_applications da ON d.id = da.database_id
            LEFT JOIN applications a ON da.application_id = a.id
            WHERE d.instance_id = ?
            GROUP BY d.id
            ORDER BY d.name
        `).all(id);

        const columns = [
            { key: 'name', label: 'Database Name' },
            { key: 'status', label: 'Status' },
            { key: 'recovery_model', label: 'Recovery Model' },
            { key: 'size_mb', label: 'Size (MB)' },
            { key: 'data_file_size_mb', label: 'Data File Size (MB)' },
            { key: 'log_file_size_mb', label: 'Log File Size (MB)' },
            { key: 'data_file_path', label: 'Data File Path' },
            { key: 'log_file_path', label: 'Log File Path' },
            { key: 'last_full_backup', label: 'Last Full Backup' },
            { key: 'last_diff_backup', label: 'Last Diff Backup' },
            { key: 'last_log_backup', label: 'Last Log Backup' },
            { key: 'applications', label: 'Applications' },
            { key: 'description', label: 'Description' }
        ];

        const csv = toCSV(databases, columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${instance.name.replace(/[^a-zA-Z0-9]/g, '_')}_databases.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Export instance databases error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/instance/:id/logins - Export only logins for an instance
router.get('/instance/:id/logins', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;

    try {
        const instance = db.prepare('SELECT name FROM sql_instances WHERE id = ? AND is_active = 1').get(id);
        if (!instance) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        const logins = db.prepare('SELECT * FROM sql_instance_logins WHERE instance_id = ? ORDER BY login_name').all(id);

        const columns = [
            { key: 'login_name', label: 'Login Name' },
            { key: 'login_type', label: 'Login Type' },
            { key: 'default_database', label: 'Default Database' },
            { key: 'is_disabled', label: 'Is Disabled' },
            { key: 'created_date', label: 'Created Date' }
        ];

        const csv = toCSV(logins.map(l => ({ ...l, is_disabled: l.is_disabled ? 'Yes' : 'No' })), columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${instance.name.replace(/[^a-zA-Z0-9]/g, '_')}_logins.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Export instance logins error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/instance/:id/backup-history - Export backup history for an instance
router.get('/instance/:id/backup-history', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;

    try {
        const instance = db.prepare('SELECT name FROM sql_instances WHERE id = ? AND is_active = 1').get(id);
        if (!instance) {
            return res.status(404).json({ error: 'Instance not found' });
        }

        const backups = db.prepare(`
            SELECT d.name AS database_name, bh.backup_type, bh.backup_start_date, bh.backup_finish_date, bh.backup_size_mb
            FROM backup_history bh
            INNER JOIN sql_databases d ON bh.database_id = d.id
            WHERE d.instance_id = ?
            ORDER BY bh.backup_finish_date DESC
        `).all(id);

        const columns = [
            { key: 'database_name', label: 'Database Name' },
            { key: 'backup_type', label: 'Backup Type' },
            { key: 'backup_start_date', label: 'Start Time' },
            { key: 'backup_finish_date', label: 'Finish Time' },
            { key: 'backup_size_mb', label: 'Size (MB)' }
        ];

        const csv = toCSV(backups, columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${instance.name.replace(/[^a-zA-Z0-9]/g, '_')}_backup_history.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Export instance backup history error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/database/:id/tables - Export only tables for a database
router.get('/database/:id/tables', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;

    try {
        const database = db.prepare('SELECT name FROM sql_databases WHERE id = ?').get(id);
        if (!database) {
            return res.status(404).json({ error: 'Database not found' });
        }

        const tables = db.prepare('SELECT * FROM db_tables WHERE database_id = ? ORDER BY schema_name, table_name').all(id);

        const columns = [
            { key: 'schema_name', label: 'Schema' },
            { key: 'table_name', label: 'Table Name' },
            { key: 'row_count', label: 'Row Count' },
            { key: 'created_date', label: 'Created Date' }
        ];

        const csv = toCSV(tables, columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_tables.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Export database tables error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/database/:id/indexes - Export only indexes for a database
router.get('/database/:id/indexes', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;

    try {
        const database = db.prepare('SELECT name FROM sql_databases WHERE id = ?').get(id);
        if (!database) {
            return res.status(404).json({ error: 'Database not found' });
        }

        const indexes = db.prepare('SELECT * FROM db_indexes WHERE database_id = ? ORDER BY table_name, index_name').all(id);

        const columns = [
            { key: 'table_name', label: 'Table Name' },
            { key: 'index_name', label: 'Index Name' },
            { key: 'index_type', label: 'Index Type' },
            { key: 'is_unique', label: 'Is Unique' }
        ];

        const csv = toCSV(indexes.map(i => ({ ...i, is_unique: i.is_unique ? 'Yes' : 'No' })), columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_indexes.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Export database indexes error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/database/:id/procedures - Export only stored procedures for a database
router.get('/database/:id/procedures', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;

    try {
        const database = db.prepare('SELECT name FROM sql_databases WHERE id = ?').get(id);
        if (!database) {
            return res.status(404).json({ error: 'Database not found' });
        }

        const procs = db.prepare('SELECT * FROM db_stored_procedures WHERE database_id = ? ORDER BY schema_name, procedure_name').all(id);

        const columns = [
            { key: 'schema_name', label: 'Schema' },
            { key: 'procedure_name', label: 'Procedure Name' },
            { key: 'created_date', label: 'Created Date' }
        ];

        const csv = toCSV(procs, columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_procedures.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Export database procedures error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/export/database/:id/users - Export only users for a database
router.get('/database/:id/users', authenticateToken, [
    param('id').isInt()
], (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const db = getDb();
    const { id } = req.params;

    try {
        const database = db.prepare('SELECT name FROM sql_databases WHERE id = ?').get(id);
        if (!database) {
            return res.status(404).json({ error: 'Database not found' });
        }

        const users = db.prepare('SELECT * FROM db_users WHERE database_id = ? ORDER BY user_name').all(id);

        const columns = [
            { key: 'user_name', label: 'User Name' },
            { key: 'user_type', label: 'User Type' },
            { key: 'default_schema', label: 'Default Schema' },
            { key: 'roles', label: 'Roles' }
        ];

        const csv = toCSV(users, columns);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${database.name.replace(/[^a-zA-Z0-9]/g, '_')}_users.csv"`);
        res.send(csv);
    } catch (err) {
        console.error('Export database users error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
