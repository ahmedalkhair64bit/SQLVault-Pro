#!/usr/bin/env node

/**
 * SQLVault Pro Desktop Build Script
 *
 * This script handles the complete build process for creating
 * the Windows installer.
 *
 * Usage:
 *   node build.js          - Build everything
 *   node build.js --quick  - Skip npm install (for rebuilds)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DESKTOP_DIR = __dirname;
const FRONTEND_DIR = path.join(ROOT_DIR, 'frontend');
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');

const isQuick = process.argv.includes('--quick');

function log(message) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${message}`);
    console.log('='.repeat(60));
}

function run(command, cwd = DESKTOP_DIR) {
    console.log(`> ${command}`);
    execSync(command, { cwd, stdio: 'inherit' });
}

async function build() {
    try {
        log('SQLVault Pro Desktop Build');
        console.log(`Quick mode: ${isQuick}`);

        // Step 1: Install frontend dependencies and build
        log('Step 1: Building Frontend');
        if (!isQuick) {
            run('npm install', FRONTEND_DIR);
        }
        run('npm run build', FRONTEND_DIR);

        // Step 2: Install backend dependencies
        log('Step 2: Preparing Backend');
        if (!isQuick) {
            run('npm install --production', BACKEND_DIR);
        }

        // Step 3: Install desktop dependencies
        log('Step 3: Preparing Desktop');
        if (!isQuick) {
            run('npm install', DESKTOP_DIR);
        }

        // Step 4: Ensure icon exists
        log('Step 4: Checking Assets');
        const iconPath = path.join(DESKTOP_DIR, 'assets', 'icon.ico');
        if (!fs.existsSync(iconPath)) {
            console.log('Warning: icon.ico not found in assets folder.');
            console.log('The build will use the default Electron icon.');
            console.log('To add a custom icon, place icon.ico in the assets folder.');
        }

        // Step 5: Build the Electron app
        log('Step 5: Building Windows Installer');
        run('npm run dist', DESKTOP_DIR);

        log('Build Complete!');
        console.log(`\nInstaller created in: ${path.join(DESKTOP_DIR, 'dist')}`);
        console.log('\nFiles:');

        const distDir = path.join(DESKTOP_DIR, 'dist');
        if (fs.existsSync(distDir)) {
            const files = fs.readdirSync(distDir);
            files.forEach(file => {
                const filePath = path.join(distDir, file);
                const stats = fs.statSync(filePath);
                if (stats.isFile()) {
                    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    console.log(`  - ${file} (${sizeMB} MB)`);
                }
            });
        }

    } catch (error) {
        console.error('\nBuild failed:', error.message);
        process.exit(1);
    }
}

build();
