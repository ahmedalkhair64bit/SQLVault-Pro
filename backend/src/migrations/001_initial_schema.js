// Initial database schema migration
const schema = `
-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'dba')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SQL Server instances inventory
CREATE TABLE IF NOT EXISTS sql_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('Production', 'Dev', 'QA', 'UAT', 'Other')),
    is_always_on INTEGER DEFAULT 0,
    ag_name TEXT,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 1433,
    auth_username TEXT,
    auth_password_encrypted TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    disabled_reason TEXT,
    disabled_type TEXT CHECK (disabled_type IN ('permanent', 'temporary') OR disabled_type IS NULL),
    disabled_at DATETIME,
    last_status TEXT DEFAULT 'UNKNOWN' CHECK (last_status IN ('UP', 'DOWN', 'UNKNOWN')),
    last_restart_time DATETIME,
    version TEXT,
    edition TEXT,
    cpu_cores INTEGER,
    total_memory_gb REAL,
    last_checked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SQL Server databases
CREATE TABLE IF NOT EXISTS sql_databases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'UNKNOWN',
    recovery_model TEXT,
    size_mb REAL,
    data_file_path TEXT,
    data_file_size_mb REAL,
    log_file_path TEXT,
    log_file_size_mb REAL,
    description TEXT,
    last_full_backup DATETIME,
    last_diff_backup DATETIME,
    last_log_backup DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES sql_instances(id) ON DELETE CASCADE,
    UNIQUE(instance_id, name)
);

-- Database to application mapping
CREATE TABLE IF NOT EXISTS database_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    database_id INTEGER NOT NULL,
    application_id INTEGER NOT NULL,
    FOREIGN KEY (database_id) REFERENCES sql_databases(id) ON DELETE CASCADE,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    UNIQUE(database_id, application_id)
);

-- Instance to application mapping
CREATE TABLE IF NOT EXISTS instance_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    application_id INTEGER NOT NULL,
    FOREIGN KEY (instance_id) REFERENCES sql_instances(id) ON DELETE CASCADE,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
    UNIQUE(instance_id, application_id)
);

-- Database tables
CREATE TABLE IF NOT EXISTS db_tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    database_id INTEGER NOT NULL,
    schema_name TEXT NOT NULL,
    table_name TEXT NOT NULL,
    row_count INTEGER,
    created_date DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (database_id) REFERENCES sql_databases(id) ON DELETE CASCADE
);

-- Database indexes
CREATE TABLE IF NOT EXISTS db_indexes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    database_id INTEGER NOT NULL,
    table_name TEXT NOT NULL,
    index_name TEXT NOT NULL,
    index_type TEXT,
    is_unique INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (database_id) REFERENCES sql_databases(id) ON DELETE CASCADE
);

-- Database stored procedures
CREATE TABLE IF NOT EXISTS db_stored_procedures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    database_id INTEGER NOT NULL,
    schema_name TEXT NOT NULL,
    procedure_name TEXT NOT NULL,
    created_date DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (database_id) REFERENCES sql_databases(id) ON DELETE CASCADE
);

-- Instance logins
CREATE TABLE IF NOT EXISTS sql_instance_logins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER NOT NULL,
    login_name TEXT NOT NULL,
    login_type TEXT,
    default_database TEXT,
    is_disabled INTEGER DEFAULT 0,
    created_date DATETIME,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (instance_id) REFERENCES sql_instances(id) ON DELETE CASCADE
);

-- Database users
CREATE TABLE IF NOT EXISTS db_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    database_id INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    user_type TEXT,
    default_schema TEXT,
    roles TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (database_id) REFERENCES sql_databases(id) ON DELETE CASCADE
);

-- Backup history
CREATE TABLE IF NOT EXISTS backup_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    database_id INTEGER NOT NULL,
    backup_type TEXT NOT NULL,
    backup_start_date DATETIME,
    backup_finish_date DATETIME,
    backup_size_mb REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (database_id) REFERENCES sql_databases(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sql_instances_environment ON sql_instances(environment);
CREATE INDEX IF NOT EXISTS idx_sql_instances_status ON sql_instances(last_status);
CREATE INDEX IF NOT EXISTS idx_sql_instances_ag ON sql_instances(ag_name);
CREATE INDEX IF NOT EXISTS idx_sql_databases_instance ON sql_databases(instance_id);
CREATE INDEX IF NOT EXISTS idx_sql_databases_name ON sql_databases(name);
CREATE INDEX IF NOT EXISTS idx_db_tables_database ON db_tables(database_id);
CREATE INDEX IF NOT EXISTS idx_db_indexes_database ON db_indexes(database_id);
CREATE INDEX IF NOT EXISTS idx_db_stored_procedures_database ON db_stored_procedures(database_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_database ON backup_history(database_id);
`;

module.exports = { schema };
