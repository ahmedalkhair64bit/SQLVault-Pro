const sql = require('mssql');
const crypto = require('crypto');
const { getDb } = require('../models/db');
require('dotenv').config();

const MSSQL_ENCRYPT = process.env.MSSQL_ENCRYPT === 'true';
const MSSQL_TRUST_CERT = process.env.MSSQL_TRUST_SERVER_CERTIFICATE !== 'false';

// Encryption key for SQL Server passwords (should be set in environment)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32);
const ENCRYPTION_IV_LENGTH = 16;

// Helper to convert Date objects to ISO strings for SQLite
function toISOString(value) {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return value;
}

// Encrypt password before storing
function encryptPassword(password) {
    if (!password) return null;
    const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

// Decrypt password when retrieving
function decryptPassword(encryptedPassword) {
    if (!encryptedPassword) return null;
    try {
        const parts = encryptedPassword.split(':');
        if (parts.length !== 2) {
            // Legacy plain text password - return as-is for backward compatibility
            return encryptedPassword;
        }
        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        // If decryption fails, assume it's a legacy plain text password
        return encryptedPassword;
    }
}

// Create connection configuration for an instance
function getConnectionConfig(instance) {
    const password = decryptPassword(instance.auth_password_encrypted);
    return {
        server: instance.host,
        port: instance.port || 1433,
        user: instance.auth_username,
        password: password,
        options: {
            encrypt: MSSQL_ENCRYPT,
            trustServerCertificate: MSSQL_TRUST_CERT,
            connectTimeout: 15000,
            requestTimeout: 30000
        }
    };
}

// Test connection and get basic status
async function checkInstanceStatus(instance) {
    const config = getConnectionConfig(instance);

    try {
        const pool = await sql.connect(config);
        await pool.close();
        return { status: 'UP', error: null };
    } catch (err) {
        return { status: 'DOWN', error: err.message };
    }
}

// Collect all metadata from an instance (INVENTORY ONLY - no performance metrics)
async function collectInstanceMetadata(instance) {
    const config = getConnectionConfig(instance);
    const result = {
        status: 'DOWN',
        version: null,
        edition: null,
        lastRestartTime: null,
        cpuCores: null,
        totalMemoryGb: null,
        databases: [],
        logins: []
    };

    let pool = null;

    try {
        pool = await sql.connect(config);
        result.status = 'UP';

        // Get version and edition
        const versionResult = await pool.request().query(`
            SELECT
                SERVERPROPERTY('ProductVersion') AS Version,
                SERVERPROPERTY('Edition') AS Edition,
                SERVERPROPERTY('ProductLevel') AS ProductLevel
        `);
        if (versionResult.recordset.length > 0) {
            const row = versionResult.recordset[0];
            result.version = `${row.Version} (${row.ProductLevel})`;
            result.edition = row.Edition;
        }

        // Get last restart time, CPU cores, and total memory
        const sysInfoResult = await pool.request().query(`
            SELECT
                sqlserver_start_time AS LastRestart,
                cpu_count AS CpuCores,
                CAST(physical_memory_kb / 1024.0 / 1024.0 AS DECIMAL(18,2)) AS TotalMemoryGb
            FROM sys.dm_os_sys_info
        `);
        if (sysInfoResult.recordset.length > 0) {
            const row = sysInfoResult.recordset[0];
            result.lastRestartTime = row.LastRestart;
            result.cpuCores = row.CpuCores;
            result.totalMemoryGb = row.TotalMemoryGb;
        }

        // Get databases with file info
        const dbResult = await pool.request().query(`
            SELECT
                d.name,
                d.state_desc AS status,
                d.recovery_model_desc AS recovery_model,
                CAST((SELECT SUM(size) * 8.0 / 1024 FROM sys.master_files WHERE database_id = d.database_id) AS DECIMAL(18,2)) AS size_mb,
                (SELECT TOP 1 physical_name FROM sys.master_files WHERE database_id = d.database_id AND type = 0) AS data_file_path,
                CAST((SELECT SUM(size) * 8.0 / 1024 FROM sys.master_files WHERE database_id = d.database_id AND type = 0) AS DECIMAL(18,2)) AS data_file_size_mb,
                (SELECT TOP 1 physical_name FROM sys.master_files WHERE database_id = d.database_id AND type = 1) AS log_file_path,
                CAST((SELECT SUM(size) * 8.0 / 1024 FROM sys.master_files WHERE database_id = d.database_id AND type = 1) AS DECIMAL(18,2)) AS log_file_size_mb
            FROM sys.databases d
            WHERE d.name NOT IN ('master', 'tempdb', 'model', 'msdb')
            ORDER BY d.name
        `);
        result.databases = dbResult.recordset;

        // Get backup info for each database (last 30 days for history)
        for (const db of result.databases) {
            db.backup_history = [];
            try {
                // Get last backup dates by type
                const lastBackupResult = await pool.request()
                    .input('dbname', sql.NVarChar, db.name)
                    .query(`
                        SELECT
                            type,
                            MAX(backup_finish_date) AS last_backup
                        FROM msdb.dbo.backupset
                        WHERE database_name = @dbname
                        GROUP BY type
                    `);

                for (const backup of lastBackupResult.recordset) {
                    if (backup.type === 'D') db.last_full_backup = backup.last_backup;
                    if (backup.type === 'I') db.last_diff_backup = backup.last_backup;
                    if (backup.type === 'L') db.last_log_backup = backup.last_backup;
                }

                // Get full backup history (last 30 days)
                const historyResult = await pool.request()
                    .input('dbname', sql.NVarChar, db.name)
                    .query(`
                        SELECT
                            CASE type
                                WHEN 'D' THEN 'Full'
                                WHEN 'I' THEN 'Differential'
                                WHEN 'L' THEN 'Log'
                                ELSE type
                            END AS backup_type,
                            backup_start_date,
                            backup_finish_date,
                            CAST(backup_size / 1024.0 / 1024.0 AS DECIMAL(18,2)) AS backup_size_mb
                        FROM msdb.dbo.backupset
                        WHERE database_name = @dbname
                        AND backup_finish_date >= DATEADD(day, -30, GETDATE())
                        ORDER BY backup_finish_date DESC
                    `);

                db.backup_history = historyResult.recordset;
            } catch (e) {
                // Backup query may fail, continue
            }
        }

        // Get logins with default database
        const loginsResult = await pool.request().query(`
            SELECT
                name AS login_name,
                type_desc AS login_type,
                default_database_name AS default_database,
                is_disabled,
                create_date AS created_date
            FROM sys.server_principals
            WHERE type IN ('S', 'U', 'G')
            AND name NOT LIKE '##%'
            ORDER BY name
        `);
        result.logins = loginsResult.recordset;

    } catch (err) {
        result.status = 'DOWN';
        result.error = err.message;
    } finally {
        if (pool) {
            await pool.close();
        }
    }

    return result;
}

// Collect database-specific metadata
async function collectDatabaseMetadata(instance, databaseName) {
    const config = getConnectionConfig(instance);
    config.database = databaseName;

    const result = {
        tables: [],
        indexes: [],
        storedProcedures: [],
        users: []
    };

    let pool = null;

    try {
        pool = await sql.connect(config);

        // Get tables
        const tablesResult = await pool.request().query(`
            SELECT
                s.name AS schema_name,
                t.name AS table_name,
                p.rows AS row_count,
                t.create_date AS created_date
            FROM sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
            ORDER BY s.name, t.name
        `);
        result.tables = tablesResult.recordset;

        // Get indexes
        const indexesResult = await pool.request().query(`
            SELECT
                OBJECT_NAME(i.object_id) AS table_name,
                i.name AS index_name,
                i.type_desc AS index_type,
                i.is_unique
            FROM sys.indexes i
            INNER JOIN sys.tables t ON i.object_id = t.object_id
            WHERE i.name IS NOT NULL
            ORDER BY OBJECT_NAME(i.object_id), i.name
        `);
        result.indexes = indexesResult.recordset;

        // Get stored procedures
        const procsResult = await pool.request().query(`
            SELECT
                s.name AS schema_name,
                p.name AS procedure_name,
                p.create_date AS created_date
            FROM sys.procedures p
            INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
            ORDER BY s.name, p.name
        `);
        result.storedProcedures = procsResult.recordset;

        // Get database users and their roles
        const usersResult = await pool.request().query(`
            SELECT
                dp.name AS user_name,
                dp.type_desc AS user_type,
                dp.default_schema_name AS default_schema,
                STRING_AGG(r.name, ', ') AS roles
            FROM sys.database_principals dp
            LEFT JOIN sys.database_role_members drm ON dp.principal_id = drm.member_principal_id
            LEFT JOIN sys.database_principals r ON drm.role_principal_id = r.principal_id
            WHERE dp.type IN ('S', 'U', 'G')
            AND dp.name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys')
            GROUP BY dp.name, dp.type_desc, dp.default_schema_name
            ORDER BY dp.name
        `);
        result.users = usersResult.recordset;

    } catch (err) {
        result.error = err.message;
    } finally {
        if (pool) {
            await pool.close();
        }
    }

    return result;
}

// Save collected metadata to app database
async function saveInstanceMetadata(instanceId, metadata) {
    const db = getDb();
    const now = new Date().toISOString();

    // Update instance info including error message
    db.prepare(`
        UPDATE sql_instances SET
            last_status = ?,
            version = ?,
            edition = ?,
            last_restart_time = ?,
            cpu_cores = ?,
            total_memory_gb = ?,
            last_checked_at = ?,
            last_error = ?,
            updated_at = ?
        WHERE id = ?
    `).run(
        metadata.status,
        metadata.version,
        metadata.edition,
        toISOString(metadata.lastRestartTime),
        metadata.cpuCores,
        metadata.totalMemoryGb,
        now,
        metadata.status === 'DOWN' ? metadata.error : null,
        now,
        instanceId
    );

    // Update databases
    if (metadata.databases && metadata.databases.length > 0) {
        const upsertDb = db.prepare(`
            INSERT INTO sql_databases (instance_id, name, status, recovery_model, size_mb, data_file_path, data_file_size_mb, log_file_path, log_file_size_mb, last_full_backup, last_diff_backup, last_log_backup, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(instance_id, name) DO UPDATE SET
                status = excluded.status,
                recovery_model = excluded.recovery_model,
                size_mb = excluded.size_mb,
                data_file_path = excluded.data_file_path,
                data_file_size_mb = excluded.data_file_size_mb,
                log_file_path = excluded.log_file_path,
                log_file_size_mb = excluded.log_file_size_mb,
                last_full_backup = excluded.last_full_backup,
                last_diff_backup = excluded.last_diff_backup,
                last_log_backup = excluded.last_log_backup,
                updated_at = excluded.updated_at
        `);

        for (const dbInfo of metadata.databases) {
            upsertDb.run(
                instanceId,
                dbInfo.name,
                dbInfo.status,
                dbInfo.recovery_model,
                dbInfo.size_mb,
                dbInfo.data_file_path || null,
                dbInfo.data_file_size_mb || null,
                dbInfo.log_file_path || null,
                dbInfo.log_file_size_mb || null,
                toISOString(dbInfo.last_full_backup),
                toISOString(dbInfo.last_diff_backup),
                toISOString(dbInfo.last_log_backup),
                now
            );

            // Save backup history for this database
            if (dbInfo.backup_history && dbInfo.backup_history.length > 0) {
                const dbRecord = db.prepare('SELECT id FROM sql_databases WHERE instance_id = ? AND name = ?').get(instanceId, dbInfo.name);
                if (dbRecord) {
                    // Clear old backup history for this database (keep last 30 days handled by query)
                    db.prepare('DELETE FROM backup_history WHERE database_id = ?').run(dbRecord.id);

                    const insertBackup = db.prepare(`
                        INSERT INTO backup_history (database_id, backup_type, backup_start_date, backup_finish_date, backup_size_mb, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    `);

                    for (const backup of dbInfo.backup_history) {
                        insertBackup.run(
                            dbRecord.id,
                            backup.backup_type,
                            toISOString(backup.backup_start_date),
                            toISOString(backup.backup_finish_date),
                            backup.backup_size_mb,
                            now
                        );
                    }
                }
            }
        }
    }

    // Update logins with default_database
    if (metadata.logins && metadata.logins.length > 0) {
        // Clear existing logins
        db.prepare('DELETE FROM sql_instance_logins WHERE instance_id = ?').run(instanceId);

        const insertLogin = db.prepare(`
            INSERT INTO sql_instance_logins (instance_id, login_name, login_type, default_database, is_disabled, created_date, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        for (const login of metadata.logins) {
            insertLogin.run(
                instanceId,
                login.login_name,
                login.login_type,
                login.default_database,
                login.is_disabled ? 1 : 0,
                toISOString(login.created_date),
                now
            );
        }
    }
}

// Save database metadata to app database
async function saveDatabaseMetadata(databaseId, metadata) {
    const db = getDb();
    const now = new Date().toISOString();

    // Clear and update tables
    if (metadata.tables) {
        db.prepare('DELETE FROM db_tables WHERE database_id = ?').run(databaseId);
        const insertTable = db.prepare(`
            INSERT INTO db_tables (database_id, schema_name, table_name, row_count, created_date, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const table of metadata.tables) {
            insertTable.run(databaseId, table.schema_name, table.table_name, table.row_count, toISOString(table.created_date), now);
        }
    }

    // Clear and update indexes
    if (metadata.indexes) {
        db.prepare('DELETE FROM db_indexes WHERE database_id = ?').run(databaseId);
        const insertIndex = db.prepare(`
            INSERT INTO db_indexes (database_id, table_name, index_name, index_type, is_unique, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const idx of metadata.indexes) {
            insertIndex.run(databaseId, idx.table_name, idx.index_name, idx.index_type, idx.is_unique ? 1 : 0, now);
        }
    }

    // Clear and update stored procedures
    if (metadata.storedProcedures) {
        db.prepare('DELETE FROM db_stored_procedures WHERE database_id = ?').run(databaseId);
        const insertProc = db.prepare(`
            INSERT INTO db_stored_procedures (database_id, schema_name, procedure_name, created_date, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `);
        for (const proc of metadata.storedProcedures) {
            insertProc.run(databaseId, proc.schema_name, proc.procedure_name, toISOString(proc.created_date), now);
        }
    }

    // Clear and update users
    if (metadata.users) {
        db.prepare('DELETE FROM db_users WHERE database_id = ?').run(databaseId);
        const insertUser = db.prepare(`
            INSERT INTO db_users (database_id, user_name, user_type, default_schema, roles, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        for (const user of metadata.users) {
            insertUser.run(databaseId, user.user_name, user.user_type, user.default_schema, user.roles, now);
        }
    }
}

module.exports = {
    encryptPassword,
    decryptPassword,
    checkInstanceStatus,
    collectInstanceMetadata,
    collectDatabaseMetadata,
    saveInstanceMetadata,
    saveDatabaseMetadata
};
