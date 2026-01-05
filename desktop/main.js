const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// Keep a global reference of the window object
let mainWindow = null;
let backendProcess = null;
const PORT = 3001;

// Determine if we're in development or production
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Get the path to backend resources
function getBackendPath() {
    if (isDev) {
        return path.join(__dirname, '..', 'backend');
    }
    return path.join(process.resourcesPath, 'backend');
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
    const fs = require('fs');
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
    const fs = require('fs');
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
        ENCRYPTION_KEY: generateSecureKey(16) // 32 hex chars = 16 bytes
    };

    fs.writeFileSync(secretsPath, JSON.stringify(secrets, null, 2));
    return secrets;
}

// Start the backend server
function startBackend() {
    return new Promise((resolve, reject) => {
        ensureDataDirectory();
        const secrets = getSecrets();

        const backendPath = getBackendPath();
        const nodePath = process.execPath;

        // Environment variables for the backend
        const env = {
            ...process.env,
            NODE_ENV: 'production',
            PORT: PORT.toString(),
            DB_PATH: getDatabasePath(),
            STATIC_PATH: getFrontendPath(),
            JWT_SECRET: secrets.JWT_SECRET,
            ENCRYPTION_KEY: secrets.ENCRYPTION_KEY,
            ADMIN_USERNAME: 'admin',
            ADMIN_PASSWORD: 'Admin@123',
            MSSQL_ENCRYPT: 'false',
            MSSQL_TRUST_SERVER_CERTIFICATE: 'true'
        };

        // For packaged app, use the bundled node
        const scriptPath = path.join(backendPath, 'src', 'index.js');

        console.log('Starting backend from:', scriptPath);
        console.log('Database path:', getDatabasePath());
        console.log('Frontend path:', getFrontendPath());

        // Run migrations first
        const migrationsPath = path.join(backendPath, 'src', 'migrations', 'run.js');
        const seedPath = path.join(backendPath, 'src', 'migrations', 'seed.js');

        // Check if database needs initialization
        const fs = require('fs');
        const dbExists = fs.existsSync(getDatabasePath());

        if (!dbExists) {
            console.log('Database not found, running migrations...');
            try {
                // Run migrations synchronously before starting server
                require(migrationsPath);
                console.log('Migrations complete');

                require(seedPath);
                console.log('Seeding complete');
            } catch (err) {
                console.error('Migration error:', err);
            }
        }

        // Start the backend server
        backendProcess = spawn(nodePath, [scriptPath], {
            cwd: backendPath,
            env: env,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        backendProcess.stdout.on('data', (data) => {
            console.log(`Backend: ${data}`);
            if (data.toString().includes('running on port')) {
                resolve();
            }
        });

        backendProcess.stderr.on('data', (data) => {
            console.error(`Backend Error: ${data}`);
        });

        backendProcess.on('error', (err) => {
            console.error('Failed to start backend:', err);
            reject(err);
        });

        backendProcess.on('close', (code) => {
            console.log(`Backend process exited with code ${code}`);
            if (code !== 0 && mainWindow) {
                dialog.showErrorBox('Backend Error', 'The backend server stopped unexpectedly.');
            }
        });

        // Give it a moment to start, then resolve anyway
        setTimeout(() => resolve(), 3000);
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

            req.on('error', () => {
                retry();
            });

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

    // Create application menu
    const menuTemplate = [
        {
            label: 'File',
            submenu: [
                { role: 'quit' }
            ]
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
                { role: 'togglefullscreen' }
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
                            detail: 'Version 1.0.0\n\nSQL Server Inventory Management System\n\nA modern tool for DBAs to manage and monitor SQL Server infrastructure.'
                        });
                    }
                },
                { type: 'separator' },
                {
                    label: 'Open Data Folder',
                    click: () => {
                        shell.openPath(app.getPath('userData'));
                    }
                }
            ]
        }
    ];

    // Add DevTools in development
    if (isDev) {
        menuTemplate[2].submenu.push(
            { type: 'separator' },
            { role: 'toggleDevTools' }
        );
    }

    const menu = Menu.buildFromTemplate(menuTemplate);
    Menu.setApplicationMenu(menu);

    // Load the app
    mainWindow.loadURL(`http://localhost:${PORT}`);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Create splash/loading window
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
    // Show splash screen
    const splash = createSplashWindow();

    try {
        // Start backend
        await startBackend();

        // Wait for it to be ready
        await waitForBackend();

        // Create main window
        createWindow();

        // Close splash after main window is ready
        mainWindow.once('ready-to-show', () => {
            splash.destroy();
        });
    } catch (error) {
        splash.destroy();
        dialog.showErrorBox('Startup Error', `Failed to start SQLVault Pro:\n${error.message}`);
        app.quit();
    }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Cleanup on quit
app.on('before-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    dialog.showErrorBox('Error', error.message);
});
