# SQLVault Pro Desktop Application

This folder contains everything needed to build SQLVault Pro as a Windows desktop application with an installer.

## Prerequisites

- **Node.js 18+** - [Download](https://nodejs.org/)
- **npm 9+** (comes with Node.js)
- **Windows 10/11** (for building Windows installer)

## Quick Build

### On Windows

Double-click `build.bat` or run from command prompt:

```batch
cd desktop
build.bat
```

### On Any Platform (Node.js)

```bash
cd desktop
node build.js
```

## Manual Build Steps

If you prefer to build step-by-step:

```bash
# 1. Install and build frontend
cd frontend
npm install
npm run build

# 2. Install backend dependencies
cd ../backend
npm install --production

# 3. Install desktop dependencies
cd ../desktop
npm install

# 4. Build the Windows installer
npm run dist
```

## Output

After building, you'll find the installer in the `dist` folder:

- `SQLVault-Pro-Setup-1.0.0.exe` - Windows installer (NSIS)

## Application Icon

The `assets` folder should contain:

- `icon.svg` - Source icon (included)
- `icon.ico` - Windows icon file (required for build)
- `icon.png` - PNG icon (optional, for Linux/macOS)

### Creating icon.ico

If `icon.ico` is missing, create it from the SVG:

1. **Online**: Use [CloudConvert](https://cloudconvert.com/svg-to-ico) or [ConvertICO](https://convertico.com/)
2. **Inkscape**: Export SVG as 256x256 PNG, then convert to ICO
3. **ImageMagick**:
   ```bash
   convert icon.svg -define icon:auto-resize=256,128,64,48,32,16 icon.ico
   ```

## Development Mode

To run the app in development mode (with DevTools):

```bash
cd desktop
npm run start:dev
```

## Configuration

The desktop app stores data in the user's app data folder:

- **Windows**: `%APPDATA%\sqlvault-pro\`
  - `data/inventory.db` - SQLite database
  - `secrets.json` - Auto-generated encryption keys

## Troubleshooting

### "native module" errors

The app uses `better-sqlite3` which requires native compilation. If you see errors:

```bash
cd desktop
npm rebuild better-sqlite3
```

### Build fails with "electron-builder" errors

Ensure you have the latest npm:

```bash
npm install -g npm@latest
```

### App doesn't start

Check the logs in:
- Windows: `%APPDATA%\sqlvault-pro\logs\`

## Customization

### Changing the App ID

Edit `desktop/package.json`:

```json
"build": {
  "appId": "com.yourcompany.sqlvault"
}
```

### Changing Default Credentials

Edit the `main.js` file, in the `startBackend()` function:

```javascript
ADMIN_USERNAME: 'your-username',
ADMIN_PASSWORD: 'your-password',
```

### Adding Mac/Linux Support

The current configuration targets Windows only. To add other platforms:

```json
"build": {
  "mac": {
    "target": "dmg"
  },
  "linux": {
    "target": "AppImage"
  }
}
```

Then run:
```bash
npm run dist -- --mac --linux
```
