# SQL Inventory Hub

**A modern web application for Database Administrators to centrally manage, monitor, and document SQL Server infrastructure.**

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

### Dashboard - Databases View
Browse all databases across instances with backup status and size information.

### Instance Detail
Detailed view of a single instance with databases, logins, and backup history tabs.

### Database Detail
Complete database information including tables, indexes, stored procedures, and users.

### Export Options
Select specific data to export as CSV files.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Built with Node.js and React
- SQL Server connectivity via [node-mssql](https://github.com/tediousjs/node-mssql)
- Icons and styling inspired by modern dashboard designs

---

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/yourusername/sqlinventory/issues) page.
