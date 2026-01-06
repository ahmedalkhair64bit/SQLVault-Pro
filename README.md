# SQL Inventory Hub




![alt text](https://i.imgur.com/bXO3GVs.png)




![alt text](https://i.imgur.com/xtJCk6L.png)

**A modern web application for Database Administrators to centrally manage, monitor, and document SQL Server infrastructure.**

---

## 📥 Quick Download

| Platform | Download | Instructions |
|----------|----------|--------------|
| **Windows** | [📦 SQLVault Pro-Portable-1.0.2.exe](https://github.com/ahmedalkhair64bit/SQLVault-Pro/raw/claude/releases-GydND/desktop/dist/SQLVault%20Pro-Portable-1.0.2.exe) | Download, double-click, run! No installation needed. |
| **Docker** | `docker pull` | See [Docker instructions](#docker-deployment) below |

### Default Login Credentials
| Username | Password |
|----------|----------|
| `admin` | `Admin@123` |

> ⚠️ **Change the default password immediately after first login!**

---

## Overview

SQL Inventory Hub replaces traditional Excel-based SQL Server inventory tracking with a live, interactive web dashboard. It provides DBAs with a single pane of glass to view all SQL Server instances, databases, and related metadata across their organization.

### Why SQL Inventory Hub?

- **Centralized Inventory**: No more scattered spreadsheets - all SQL Server information in one place
- **Live Connectivity**: Connect to your SQL Servers and pull real-time metadata
- **Application Mapping**: Track which applications use which databases/instances
- **Backup Monitoring**: View backup history and identify databases with missing backups
- **Export Reports**: Generate CSV reports for auditing and documentation
- **Role-Based Access**: Admins manage instances, DBAs can view and document

---

## Features

### Dashboard Views
- **Instances View**: All SQL Server instances with status, environment, and database counts
- **Databases View**: All databases across instances with size, backup status, and recovery model
- **Applications View**: Application-centric view showing which instances/databases support each app
- **Summary Cards**: Quick stats for total instances, databases, and health status

### Instance Management
- Add, edit, and disable SQL Server instances
- Store encrypted connection credentials (AES-256-CBC)
- Group instances by Availability Group (Always On AG support)
- Track instance metadata: version, edition, CPU cores, memory
- View all logins with their default databases

### Database Management
- View tables, indexes, stored procedures, and users
- Track backup history (Full, Differential, Log backups)
- Associate databases with business applications
- Add descriptions and documentation

### Application Tracking
- Create applications and associate them with instances or databases
- View all infrastructure supporting a specific application
- Track instance and database counts per application

### Export & Reporting
- Export instances, databases, or specific data to CSV
- Selective export: choose what data to include
- Export options for logins, backup history, tables, indexes, procedures, users

### Security
- JWT-based authentication
- Role-based access control (Admin / DBA)
- Encrypted SQL Server credentials
- Session management with secure tokens

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Node.js + Express.js |
| Frontend | React 18 |
| App Database | SQLite (better-sqlite3) |
| SQL Server Connectivity | mssql package |
| Authentication | JWT (jsonwebtoken) |
| Password Hashing | bcryptjs |
| Encryption | Node.js crypto (AES-256-CBC) |
| HTTP Client | Axios |
| Routing | react-router-dom v6 |

---

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **npm** 9.x or higher (comes with Node.js)
- **Git** (for cloning the repository)

Optional:
- SQL Server instances to connect and monitor

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/sqlinventory.git
cd sqlinventory
```

### 2. Setup Backend

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env file with your settings (see Configuration section below)

# Run database migrations
npm run migrate

# Seed the database with default admin user
npm run seed
```

### 3. Setup Frontend

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install
```

### 4. Start the Application

**Option A: Development Mode (Recommended for development)**

Open two terminal windows:

Terminal 1 - Start Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Start Frontend:
```bash
cd frontend
npm start
```

Access the application at: **http://localhost:3000**

**Option B: Production Mode**

```bash
# Build the frontend
cd frontend
npm run build

# Start backend (serves built frontend)
cd ../backend
NODE_ENV=production npm start
```

Access the application at: **http://localhost:3001**

---

## Docker Deployment

The easiest way to run SQLVault Pro is using Docker.

### Quick Start with Docker

```bash
# Clone the repository
git clone https://github.com/yourusername/sqlvault-pro.git
cd sqlvault-pro

# Start with Docker Compose
docker compose up -d

# View logs
docker compose logs -f
```

Access the application at: **http://localhost:3001**

### Docker Compose (Recommended)

The `docker-compose.yml` file provides the complete setup:

```bash
# Build and start
docker compose up -d --build

# Stop
docker compose down

# Stop and remove data volume
docker compose down -v
```

### Environment Variables

Configure the application by creating a `.env` file or passing environment variables:

```bash
# Create .env file for Docker Compose
cat > .env << 'EOF'
JWT_SECRET=your-super-secret-jwt-key-change-in-production
ENCRYPTION_KEY=your-32-character-encryption-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=YourSecurePassword123!
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true
EOF

# Start with custom environment
docker compose up -d
```

### Building the Docker Image Manually

```bash
# Build the image
docker build -t sqlvault-pro:latest .

# Run the container
docker run -d \
  --name sqlvault-pro \
  -p 3001:3001 \
  -e JWT_SECRET=your-secret-key \
  -e ENCRYPTION_KEY=change-this-to-32-char-secret!! \
  -v sqlvault-data:/app/data \
  sqlvault-pro:latest
```

### Docker Image Details

- **Base Image**: Node.js 20 Alpine
- **Exposed Port**: 3001
- **Data Volume**: `/app/data` (SQLite database)
- **Health Check**: `GET /api/health`
- **Non-root User**: Runs as `sqlvault` user for security

### Automatic Database Initialization

The Docker container automatically handles database setup on first run:
- Runs migrations if no database exists
- Seeds the default admin user
- Checks for pending migrations on subsequent starts

No manual initialization is required!

### Connecting to SQL Servers

When running in Docker, ensure your SQL Servers are accessible from the container:

- For SQL Servers on the host machine, use `host.docker.internal` as the hostname
- For SQL Servers on the same Docker network, use the container name
- For remote SQL Servers, ensure network connectivity from the container

### Production Deployment

For production deployments:

1. **Use strong secrets**:
   ```bash
   # Generate JWT secret
   openssl rand -base64 32

   # Generate encryption key (32 characters)
   openssl rand -hex 16
   ```

2. **Use a reverse proxy** (nginx/traefik) with SSL termination

3. **Backup the data volume** regularly:
   ```bash
   docker run --rm -v sqlvault-data:/data -v $(pwd):/backup alpine tar czf /backup/sqlvault-backup.tar.gz /data
   ```

4. **Monitor container health**:
   ```bash
   docker inspect --format='{{.State.Health.Status}}' sqlvault-pro
   ```

---

## Windows Desktop Application

SQLVault Pro can also be installed as a native Windows desktop application with a standard installer.

### Download & Install

1. Download `SQLVault-Pro-Setup-1.0.0.exe` from the [Releases](https://github.com/yourusername/sqlvault-pro/releases) page
2. Run the installer
3. Follow the installation wizard
4. Launch SQLVault Pro from the Start Menu or Desktop shortcut

### Features

- **Native Windows App**: Runs as a standalone desktop application
- **No Server Required**: Backend runs locally within the app
- **Persistent Data**: Database stored in `%APPDATA%\sqlvault-pro`
- **Auto-Updates**: (Coming soon)

### Building the Installer

To build the Windows installer yourself:

```bash
# Prerequisites: Node.js 18+

# Clone the repository
git clone https://github.com/yourusername/sqlvault-pro.git
cd sqlvault-pro/desktop

# Option 1: Use the build script
node build.js

# Option 2: On Windows, double-click build.bat
```

The installer will be created in `desktop/dist/`:
- `SQLVault-Pro-Setup-1.0.0.exe`

### Desktop App Data Locations

| Data | Location |
|------|----------|
| Database | `%APPDATA%\sqlvault-pro\data\inventory.db` |
| Secrets | `%APPDATA%\sqlvault-pro\secrets.json` |
| Logs | `%APPDATA%\sqlvault-pro\logs\` |

### System Requirements

- Windows 10 or Windows 11
- 4GB RAM minimum
- 500MB disk space

---

## Configuration

### Backend Environment Variables (.env)

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Secret - CHANGE THIS IN PRODUCTION!
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Encryption Key for SQL credentials (exactly 32 characters) - CHANGE THIS!
ENCRYPTION_KEY=your-32-character-encryption-key

# App Database Path
DB_PATH=./data/inventory.db

# Default Admin Credentials (used during seeding)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123

# SQL Server Connection Settings
MSSQL_ENCRYPT=false
MSSQL_TRUST_SERVER_CERTIFICATE=true
```

### Important Security Notes

1. **JWT_SECRET**: Use a long, random string in production
2. **ENCRYPTION_KEY**: Must be exactly 32 characters, use a strong random key
3. **ADMIN_PASSWORD**: Change immediately after first login
4. **HTTPS**: Use a reverse proxy (nginx) with SSL in production

---

## Default Login Credentials

After running the seed script, use these credentials:

| Username | Password | Role |
|----------|----------|------|
| admin | Admin@123 | Administrator |

**Change the default password immediately after first login!**

---

## User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage instances, users, applications, view all data |
| **DBA** | View all instances/databases, edit descriptions, export data |

---

## Adding SQL Server Instances

### Step 1: Login as Admin
Navigate to http://localhost:3000 and login with admin credentials.

### Step 2: Go to Manage Instances
Click "Manage Instances" in the sidebar.

### Step 3: Click "Add Instance"
Fill in the connection details:

| Field | Description | Example |
|-------|-------------|---------|
| Instance Name | Friendly identifier | SQLPROD01\MAIN |
| Environment | Production, Dev, QA, UAT, Other | Production |
| Host | Server hostname or IP | 192.168.1.100 |
| Port | SQL Server port | 1433 |
| SQL Auth Username | SQL login with read permissions | inventory_reader |
| SQL Auth Password | Password for the login | ******** |
| Always On AG | Check if part of Availability Group | - |
| AG Name | Availability Group name (if applicable) | AG_Production |
| Applications | Associate with business applications | - |

### Step 4: Test Connection
Click "Add Instance" - the application will attempt to connect and collect metadata.

---

## SQL Server Permissions

Create a dedicated SQL login with minimal permissions for monitoring:

```sql
-- Create login
CREATE LOGIN [inventory_reader] WITH PASSWORD = 'YourSecurePassword';

-- Grant server-level permissions
GRANT VIEW SERVER STATE TO [inventory_reader];
GRANT VIEW ANY DEFINITION TO [inventory_reader];
GRANT VIEW ANY DATABASE TO [inventory_reader];

-- For each database to monitor:
USE [YourDatabase];
CREATE USER [inventory_reader] FOR LOGIN [inventory_reader];
GRANT VIEW DEFINITION TO [inventory_reader];
GRANT SELECT ON sys.database_principals TO [inventory_reader];

-- For backup history (msdb database):
USE [msdb];
CREATE USER [inventory_reader] FOR LOGIN [inventory_reader];
GRANT SELECT ON dbo.backupset TO [inventory_reader];
GRANT SELECT ON dbo.backupmediafamily TO [inventory_reader];
```

---

## Project Structure

```
sqlinventory/
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server entry point
│   │   ├── routes/
│   │   │   ├── auth.js           # Authentication endpoints
│   │   │   ├── instances.js      # Instance management
│   │   │   ├── databases.js      # Database operations
│   │   │   ├── applications.js   # Application management
│   │   │   ├── search.js         # Global search
│   │   │   └── export.js         # CSV export
│   │   ├── middleware/
│   │   │   └── auth.js           # JWT authentication middleware
│   │   ├── models/
│   │   │   └── db.js             # SQLite database connection
│   │   ├── services/
│   │   │   └── sqlServerCollector.js  # SQL Server metadata collector
│   │   └── migrations/
│   │       ├── 001_initial_schema.js  # Database schema
│   │       ├── run.js            # Migration runner
│   │       └── seed.js           # Initial data seeder
│   ├── data/                     # SQLite database files
│   ├── .env.example              # Environment template
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── index.js              # React entry point
│   │   ├── index.css             # Global styles (dark theme)
│   │   ├── App.js                # Main app with routing
│   │   ├── context/
│   │   │   └── AuthContext.js    # Authentication state
│   │   ├── services/
│   │   │   └── api.js            # Axios API client
│   │   ├── components/
│   │   │   ├── Layout.js         # App layout with sidebar
│   │   │   └── GlobalSearch.js   # Search component
│   │   └── pages/
│   │       ├── Login.js          # Login page
│   │       ├── Dashboard.js      # Main dashboard
│   │       ├── InstanceDetail.js # Instance details view
│   │       ├── DatabaseDetail.js # Database details view
│   │       ├── ApplicationDetail.js # Application details
│   │       ├── AdminInstances.js # Instance management
│   │       ├── AdminUsers.js     # User management
│   │       ├── AdminApplications.js # Application management
│   │       └── SearchResults.js  # Search results page
│   └── package.json
└── README.md
```

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | User login |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/register | Register user (admin) |
| GET | /api/auth/users | List all users (admin) |
| PUT | /api/auth/users/:id | Update user (admin) |
| DELETE | /api/auth/users/:id | Delete user (admin) |

### Instances
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/instances | List all instances |
| GET | /api/instances/:id | Get instance details |
| POST | /api/instances | Add instance (admin) |
| PUT | /api/instances/:id | Update instance (admin) |
| DELETE | /api/instances/:id | Disable instance (admin) |
| POST | /api/instances/:id/refresh | Refresh metadata |
| POST | /api/instances/:id/reactivate | Reactivate disabled instance |
| GET | /api/instances/:id/databases | List databases |
| GET | /api/instances/:id/logins | List logins |
| GET | /api/instances/:id/backup-history | Get backup history |
| GET | /api/instances/disabled/list | List disabled instances |

### Databases
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/databases/:id | Get database details |
| PUT | /api/databases/:id | Update database |
| POST | /api/databases/:id/refresh | Refresh objects |
| GET | /api/databases/:id/tables | List tables (paginated) |
| GET | /api/databases/:id/indexes | List indexes (paginated) |
| GET | /api/databases/:id/procedures | List procedures (paginated) |
| GET | /api/databases/:id/users | List database users |

### Applications
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/applications | List applications |
| GET | /api/applications/:id | Get application details |
| POST | /api/applications | Create application (admin) |
| PUT | /api/applications/:id | Update application (admin) |
| DELETE | /api/applications/:id | Delete application (admin) |

### Search
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/search?q=query | Global search |

### Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/export/instances | Export all instances |
| GET | /api/export/instance/:id | Export instance (full) |
| GET | /api/export/instance/:id/databases | Export instance databases |
| GET | /api/export/instance/:id/logins | Export instance logins |
| GET | /api/export/instance/:id/backup-history | Export backup history |
| GET | /api/export/database/:id | Export database (full) |
| GET | /api/export/database/:id/tables | Export tables |
| GET | /api/export/database/:id/indexes | Export indexes |
| GET | /api/export/database/:id/procedures | Export procedures |
| GET | /api/export/database/:id/users | Export users |
| GET | /api/export/all-databases | Export all databases |
| GET | /api/export/backup-history | Export all backup history |

---

## Troubleshooting

### Cannot connect to SQL Server

1. **Verify network connectivity**
   ```bash
   telnet <hostname> 1433
   ```

2. **Check SQL Server settings**
   - Ensure TCP/IP protocol is enabled in SQL Server Configuration Manager
   - Verify SQL Server Browser service is running (for named instances)
   - Check Windows Firewall allows port 1433

3. **Verify credentials**
   - Ensure SQL Server authentication is enabled (mixed mode)
   - Test login using SSMS or sqlcmd

### Database permission errors

Run the SQL permission script provided in the "SQL Server Permissions" section.

### API returns 401 Unauthorized

- Token may be expired (24 hour lifetime)
- Re-login to get a new token
- Check that the JWT_SECRET hasn't changed

### Frontend not loading

- Ensure backend is running on port 3001
- Check frontend proxy configuration in package.json
- Clear browser cache and cookies

### SQLite database errors

- Ensure `backend/data` directory exists and is writable
- Delete `inventory.db` and re-run migrations if corrupted

---

## Screenshots

### Dashboard - Instances View
View all SQL Server instances with status indicators, environment badges, and database counts.
![alt text](https://i.imgur.com/bXO3GVs.png)

### Dashboard - Databases View
Browse all databases across instances with backup status and size information.
![alt text](https://i.imgur.com/RLtNXYE.png)
### Instance Detail
Detailed view of a single instance with databases, logins, and backup history tabs.
![alt text](https://i.imgur.com/fNRj3kf.png)
### Export Options
Select specific data to export as CSV files.
![alt text](https://i.imgur.com/BtBDYtX.png)
---

## Developer Guide

This section is for developers and AI coding agents who want to extend or customize the application.

### Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│  Express API    │────▶│  SQLite DB      │
│   (Frontend)    │     │  (Backend)      │     │  (App Data)     │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  SQL Servers    │
                        │  (Monitored)    │
                        └─────────────────┘
```

### Backend Architecture

#### Entry Point
- **`src/index.js`**: Express server setup, middleware configuration, route mounting

#### Routes Pattern
All routes follow RESTful conventions in `src/routes/`:

```javascript
// Example route structure
const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Public route (if any)
router.get('/public', (req, res) => { });

// Authenticated route
router.get('/', authenticateToken, (req, res) => { });

// Admin-only route
router.post('/', authenticateToken, requireAdmin, (req, res) => { });

module.exports = router;
```

#### Database Access Pattern
Uses `better-sqlite3` for synchronous SQLite operations:

```javascript
const db = require('../models/db');

// SELECT query
const rows = db.prepare('SELECT * FROM table WHERE id = ?').all(id);

// INSERT query
const result = db.prepare('INSERT INTO table (col) VALUES (?)').run(value);
const newId = result.lastInsertRowid;

// UPDATE query
db.prepare('UPDATE table SET col = ? WHERE id = ?').run(value, id);

// Transaction
const transaction = db.transaction(() => {
    db.prepare('INSERT ...').run();
    db.prepare('UPDATE ...').run();
});
transaction();
```

#### Adding a New API Endpoint

1. **Create or edit route file** in `src/routes/`:
```javascript
// src/routes/newfeature.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../models/db');

router.get('/', authenticateToken, (req, res) => {
    try {
        const data = db.prepare('SELECT * FROM table').all();
        res.json(data);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
```

2. **Mount the route** in `src/index.js`:
```javascript
const newfeatureRoutes = require('./routes/newfeature');
app.use('/api/newfeature', newfeatureRoutes);
```

#### SQL Server Collector Service
The `src/services/sqlServerCollector.js` handles all SQL Server connectivity:

```javascript
const { collectInstanceMetadata } = require('../services/sqlServerCollector');

// Collect metadata from a SQL Server instance
const metadata = await collectInstanceMetadata({
    host: 'server.domain.com',
    port: 1433,
    username: 'reader',
    password: 'decrypted_password',
    encrypt: false,
    trustServerCertificate: true
});
```

**Key functions:**
- `collectInstanceMetadata(config)`: Full instance scan (databases, logins, etc.)
- `collectDatabaseObjects(config, dbName)`: Tables, indexes, procedures for one DB
- `testConnection(config)`: Verify connectivity

### Frontend Architecture

#### State Management
Uses React Context for authentication state:

```javascript
// Access auth context in any component
import { useAuth } from '../context/AuthContext';

function MyComponent() {
    const { user, token, logout } = useAuth();
    // user.role is 'admin' or 'dba'
}
```

#### API Client
Centralized API calls via `src/services/api.js`:

```javascript
import api from '../services/api';

// GET request
const response = await api.get('/instances');

// POST request
const response = await api.post('/instances', { name: 'Server1' });

// The api client automatically:
// - Adds Authorization header with JWT token
// - Sets base URL to /api
// - Handles token from localStorage
```

#### Adding a New Page

1. **Create page component** in `src/pages/`:
```javascript
// src/pages/NewPage.js
import React, { useState, useEffect } from 'react';
import api from '../services/api';

function NewPage() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const response = await api.get('/newfeature');
            setData(response.data);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="loading">Loading...</div>;

    return (
        <div className="page-container">
            <h1>New Feature</h1>
            {/* Your content */}
        </div>
    );
}

export default NewPage;
```

2. **Add route** in `src/App.js`:
```javascript
import NewPage from './pages/NewPage';

// Inside Routes component
<Route path="/newfeature" element={<NewPage />} />
```

3. **Add sidebar link** in `src/components/Layout.js`:
```javascript
<NavLink to="/newfeature" className={({isActive}) => isActive ? 'active' : ''}>
    New Feature
</NavLink>
```

### Database Schema

#### Core Tables

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('admin', 'dba')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SQL Server instances
CREATE TABLE sql_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_name TEXT NOT NULL,
    environment TEXT,
    host TEXT NOT NULL,
    port INTEGER DEFAULT 1433,
    username TEXT,
    password_encrypted TEXT,
    is_active INTEGER DEFAULT 1,
    disabled_reason TEXT,
    disabled_type TEXT CHECK (disabled_type IN ('permanent', 'temporary')),
    disabled_at DATETIME,
    -- ... more fields
);

-- Databases
CREATE TABLE databases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    instance_id INTEGER REFERENCES sql_instances(id),
    database_name TEXT NOT NULL,
    -- ... more fields
);

-- Applications
CREATE TABLE applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

-- Junction tables for many-to-many relationships
CREATE TABLE instance_applications (
    instance_id INTEGER REFERENCES sql_instances(id),
    application_id INTEGER REFERENCES applications(id),
    PRIMARY KEY (instance_id, application_id)
);

CREATE TABLE database_applications (
    database_id INTEGER REFERENCES databases(id),
    application_id INTEGER REFERENCES applications(id),
    PRIMARY KEY (database_id, application_id)
);
```

#### Adding a New Migration

1. **Create migration file** in `src/migrations/`:
```javascript
// src/migrations/002_new_feature.js
module.exports = {
    up: (db) => {
        db.exec(`
            ALTER TABLE sql_instances ADD COLUMN new_field TEXT;

            CREATE TABLE new_table (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL
            );
        `);
    },
    down: (db) => {
        // Rollback logic (optional)
    }
};
```

2. **Update migration runner** in `src/migrations/run.js` to include new migration.

### Encryption & Security

#### Password Encryption for SQL Credentials
```javascript
const crypto = require('crypto');
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 chars
const IV_LENGTH = 16;

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
```

#### JWT Authentication
```javascript
const jwt = require('jsonwebtoken');

// Generate token
const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
);

// Verify token (in middleware)
const decoded = jwt.verify(token, process.env.JWT_SECRET);
```

### Common Patterns

#### Input Validation with express-validator
```javascript
const { body, param, validationResult } = require('express-validator');

router.post('/',
    authenticateToken,
    [
        body('name').trim().notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email required'),
        body('count').optional().isInt({ min: 0 })
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        // Process valid request
    }
);
```

#### Pagination Pattern
```javascript
router.get('/items', authenticateToken, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const items = db.prepare(`
        SELECT * FROM items
        LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM items').get().count;

    res.json({
        data: items,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    });
});
```

#### CSV Export Pattern
```javascript
router.get('/export', authenticateToken, (req, res) => {
    const data = db.prepare('SELECT * FROM table').all();

    const headers = ['Column1', 'Column2', 'Column3'];
    const rows = data.map(row => [
        row.column1,
        row.column2,
        row.column3
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
    res.send(csv);
});
```

### Testing Locally

```bash
# Backend only (with auto-reload)
cd backend
npm run dev

# Frontend only (with hot-reload)
cd frontend
npm start

# Reset database
cd backend
rm data/inventory.db
npm run migrate
npm run seed
```

### Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| PORT | No | Backend port (default: 3001) |
| NODE_ENV | No | development or production |
| JWT_SECRET | Yes | Secret for JWT signing |
| ENCRYPTION_KEY | Yes | 32-char key for AES encryption |
| DB_PATH | No | SQLite database path |
| ADMIN_USERNAME | No | Default admin username for seeding |
| ADMIN_PASSWORD | No | Default admin password for seeding |
| MSSQL_ENCRYPT | No | Encrypt SQL connections (default: false) |
| MSSQL_TRUST_SERVER_CERTIFICATE | No | Trust self-signed certs (default: true) |

### Extending the SQL Collector

To collect additional SQL Server metadata, edit `src/services/sqlServerCollector.js`:

```javascript
// Add new query in collectInstanceMetadata function
const newData = await pool.request().query(`
    SELECT column1, column2
    FROM sys.some_view
`);

// Return in metadata object
return {
    ...existingData,
    newData: newData.recordset
};
```

### Frontend Styling

The app uses a dark theme defined in `src/index.css`. Key CSS variables:

```css
:root {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-card: #1f2940;
    --text-primary: #eee;
    --text-secondary: #aaa;
    --accent: #4f8cff;
    --success: #27ae60;
    --warning: #f39c12;
    --danger: #e74c3c;
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Contribution Guidelines

- Follow existing code patterns and naming conventions
- Add input validation for all new endpoints
- Update this README if adding new features
- Test with both admin and DBA roles
- Ensure no sensitive data is logged or exposed

---



---

## Acknowledgments

- Built with Node.js and React
- SQL Server connectivity via [node-mssql](https://github.com/tediousjs/node-mssql)
- Icons and styling inspired by modern dashboard designs

---

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/yourusername/sqlinventory/issues) page.
