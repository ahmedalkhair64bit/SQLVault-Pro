// Preload script for Electron
// This runs in the renderer process but has access to Node.js APIs

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // App info
    getVersion: () => process.env.npm_package_version || '1.0.0',
    getPlatform: () => process.platform,

    // Window controls (if needed)
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),

    // Check if running in Electron
    isElectron: true
});

// Log that preload script loaded
console.log('SQLVault Pro Desktop - Preload script loaded');
