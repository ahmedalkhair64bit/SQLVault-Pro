#!/bin/sh
set -e

# SQLVault Pro Docker Entrypoint
# Automatically runs migrations on first startup

echo "Starting SQLVault Pro..."

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Database not found. Running initial setup..."

    # Run migrations
    echo "Running migrations..."
    node src/migrations/run.js

    # Seed default admin user
    echo "Seeding default admin user..."
    node src/migrations/seed.js

    echo "Initial setup complete!"
else
    echo "Database found. Checking for pending migrations..."
    node src/migrations/run.js
fi

# Start the application
echo "Starting application on port ${PORT:-3001}..."
exec node src/index.js
