const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const config = require('./config/config');
const logger = require('./utils/logger');
const { dashboardAuth } = require('./middleware/authMiddleware');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve dashboard static files with Basic Auth
const dashboardPath = path.join(__dirname, 'dashboard');
if (!fs.existsSync(dashboardPath)) {
    fs.mkdirSync(dashboardPath, { recursive: true });
}
app.use('/', dashboardAuth, express.static(dashboardPath));

// Ensure storage directories exist
const setupStorage = () => {
    const dirs = [config.storagePaths.sessions, config.storagePaths.storage];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // Initialize JSON files if they don't exist
    if (!fs.existsSync(config.storagePaths.accounts)) {
        fs.writeFileSync(config.storagePaths.accounts, JSON.stringify([], null, 2));
    }
    if (!fs.existsSync(config.storagePaths.logs)) {
        fs.writeFileSync(config.storagePaths.logs, JSON.stringify([], null, 2));
    }
};

setupStorage();

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Start server
app.listen(config.port, () => {
    logger.info(`Server started on port ${config.port} in ${config.env} mode`);
});
