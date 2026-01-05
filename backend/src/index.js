const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const instancesRoutes = require('./routes/instances');
const databasesRoutes = require('./routes/databases');
const searchRoutes = require('./routes/search');
const exportRoutes = require('./routes/export');
const applicationsRoutes = require('./routes/applications');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/instances', instancesRoutes);
app.use('/api/databases', databasesRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/applications', applicationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    // Support both local build path and Docker container path
    const staticPath = process.env.STATIC_PATH || path.join(__dirname, '../../frontend/build');
    app.use(express.static(staticPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(staticPath, 'index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`SQL Inventory Hub API running on port ${PORT}`);
});
