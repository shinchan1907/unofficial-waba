const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs');
const path = require('path');
const config = require('./config/config');
const logger = require('./utils/logger');
const { dashboardAuth, adminAuth, accountAuth } = require('./middleware/authMiddleware');
const accountRoutes = require('./routes/accountRoutes');
const messageRoutes = require('./routes/messageRoutes');
const queueService = require('./services/queueService');

const app = express();

// Middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files publicly (so CSS/JS load without auth issues)
const dashboardPath = path.join(__dirname, 'dashboard');
if (!fs.existsSync(dashboardPath)) {
    fs.mkdirSync(dashboardPath, { recursive: true });
}
app.use(express.static(dashboardPath, { index: false }));

// Protect the main HTML entry point with Basic Auth
app.get('/', dashboardAuth, (req, res) => {
    res.sendFile(path.join(dashboardPath, 'index.html'));
});

// API Routes
app.use('/api/accounts', adminAuth, accountRoutes);
app.use('/api/messages', accountAuth, messageRoutes);

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

const { initAllSessions } = require('./services/whatsappManager');

// Basic health check route
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// Start server
app.listen(config.port, async () => {
    logger.info(`Server started on port ${config.port} in ${config.env} mode`);
    await initAllSessions();
    queueService.initQueue();
});
