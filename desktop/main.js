const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');
const Module = require('module');

// Keep a global reference of the window object
let mainWindow = null;
const PORT = 3001;

// Determine if we're in development or production
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Get the path to backend source files
function getBackendSrcPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'backend', 'src');
    }
    return path.join(process.resourcesPath, 'backend', 'src');
}

// Get the path to the frontend build
function getFrontendPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'frontend', 'build');
    }
    return path.join(process.resourcesPath, 'frontend', 'build');
}

// Get the database path (in user data folder for persistence)
function getDatabasePath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'data', 'inventory.db');
}

// Ensure data directory exists
function ensureDataDirectory() {
    const dataDir = path.dirname(getDatabasePath());
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
}

// Generate secure random keys if not set
function generateSecureKey(length) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
}

// Get or create persistent secrets
function getSecrets() {
    const secretsPath = path.join(app.getPath('userData'), 'secrets.json');

    if (fs.existsSync(secretsPath)) {
        try {
            return JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
        } catch (e) {
            // If corrupted, regenerate
        }
    }

    const secrets = {
        JWT_SECRET: generateSecureKey(32),
        ENCRYPTION_KEY: generateSecureKey(16)
    };

    fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2));
    return secrets;
}

// Setup module resolution to use electron app's node_modules
function setupModuleResolution() {
    const electronNodeModules = path.join(__dirname, 'node_modules');
    const appNodeModules = isDev
        ? path.join(__dirname, 'node_modules')
        : path.join(path.dirname(app.getPath('exe')), 'resources', 'app.asar', 'node_modules');

    // Add our node_modules to the front of the module search path
    const originalResolveLookupPaths = Module._resolveLookupPaths;
    Module._resolveLookupPaths = function(request, parent) {
        const result = originalResolveLookupPaths.call(this, request, parent);
        if (result && result.length > 0) {
            // Add electron app's node_modules at the start
            if (!result.includes(electronNodeModules)) {
                result.unshift(electronNodeModules);
            }
        }
        return result;
    };
}

// Start the backend server
function startBackend() {
    return new Promise((resolve, reject) => {
        try {
            ensureDataDirectory();
            const secrets = getSecrets();
            const backendSrcPath = getBackendSrcPath();

            // Set environment variables
            process.env.NODE_ENV = 'production';
            process.env.PORT = PORT.toString();
            process.env.DB_PATH = getDatabasePath();
            process.env.STATIC_PATH = getFrontendPath();
            process.env.JWT_SECRET = secrets.JWT_SECRET;
            process.env.ENCRYPTION_KEY = secrets.ENCRYPTION_KEY;
            process.env.ADMIN_USERNAME = 'admin';
            process.env.ADMIN_PASSWORD = 'Admin@123';
            process.env.MSSQL_ENCRYPT = 'false';
            process.env.MSSQL_TRUST_SERVER_CERTIFICATE = 'true';

            console.log('Backend src path:', backendSrcPath);
            console.log('Database path:', getDatabasePath());
            console.log('Frontend path:', getFrontendPath());

            // Setup module resolution BEFORE requiring backend modules
            setupModuleResolution();

            // Check if database needs initialization
            const dbExists = fs.existsSync(getDatabasePath());

            if (!dbExists) {
                console.log('Database not found, running migrations...');
                try {
                    const migrationsPath = path.join(backendSrcPath, 'migrations', 'run.js');
                    require(migrationsPath);
                    console.log('Migrations complete');

                    // Clear cache and run seed
                    const seedPath = path.join(backendSrcPath, 'migrations', 'seed.js');
                    delete require.cache[require.resolve(seedPath)];
                    require(seedPath);
                    console.log('Seeding complete');
                } catch (err) {
                    console.error('Migration error:', err);
                }
            }

            // Start Express server
            console.log('Starting Express server...');
            const indexPath = path.join(backendSrcPath, 'index.js');

            // Clear any cached backend modules
            Object.keys(require.cache).forEach(key => {
                if (key.includes('backend')) {
                    delete require.cache[key];
                }
            });

            require(indexPath);
            console.log('Backend server started on port', PORT);

            setTimeout(() => resolve(), 1500);

        } catch (error) {
            console.error('Failed to start backend:', error);
            reject(error);
        }
    });
}

// Wait for backend to be ready
function waitForBackend(maxAttempts = 30) {
    return new Promise((resolve, reject) => {
        let attempts = 0;

        const checkServer = () => {
            attempts++;
            const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    retry();
                }
            });

            req.on('error', retry);
            req.setTimeout(1000, () => {
                req.destroy();
                retry();
            });
        };

        const retry = () => {
            if (attempts < maxAttempts) {
                setTimeout(checkServer, 500);
            } else {
                reject(new Error('Backend failed to start'));
            }
        };

        checkServer();
    });
}

// Create the main window
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        backgroundColor: '#1a1a2e'
    });

    const menuTemplate = [
        {
            label: 'File',
            submenu: [{ role: 'quit' }]
        },
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                { role: 'toggleDevTools' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About SQLVault Pro',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'About SQLVault Pro',
                            message: 'SQLVault Pro',
                            detail: 'Version 1.0.1\n\nSQL Server Inventory Management System'
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Open Data Folder',
                    click: () => shell.openPath(app.getPath('userData'))
                }
            ]
        }
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
    mainWindow.loadURL(`http://localhost:${PORT}`);
    mainWindow.once('ready-to-show', () => mainWindow.show());

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => { mainWindow = null; });
}

// Create splash window
function createSplashWindow() {
    const splash = new BrowserWindow({
        width: 400,
        height: 300,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    splash.loadFile(path.join(__dirname, 'splash.html'));
    return splash;
}

// App ready handler
app.whenReady().then(async () => {
    const splash = createSplashWindow();

    try {
        await startBackend();
        await waitForBackend();
        createWindow();
        mainWindow.once('ready-to-show', () => splash.destroy());
    } catch (error) {
        splash.destroy();
        dialog.showErrorBox('Startup Error',
            `Failed to start SQLVault Pro:\n${error.message}\n\n` +
            `Backend: ${getBackendSrcPath()}\n` +
            `Database: ${getDatabasePath()}\n` +
            `Frontend: ${getFrontendPath()}`
        );
        app.quit();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    dialog.showErrorBox('Error', error.message);
});
