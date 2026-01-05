@echo off
REM SQLVault Pro Windows Installer Build Script
REM
REM Prerequisites:
REM   - Node.js 18+ installed
REM   - npm installed
REM
REM Usage:
REM   build.bat          - Full build
REM   build.bat --quick  - Quick rebuild (skip npm install)

echo.
echo ============================================================
echo   SQLVault Pro - Windows Installer Build
echo ============================================================
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Display versions
echo Node.js version:
node --version
echo npm version:
npm --version
echo.

REM Run the build script
echo Starting build process...
echo.
node build.js %*

if %ERRORLEVEL% neq 0 (
    echo.
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   Build completed successfully!
echo   Check the 'dist' folder for the installer.
echo ============================================================
echo.
pause
