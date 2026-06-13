require('dotenv').config();
const path = require('path');

module.exports = {
    port: process.env.PORT || 3000,
    apiKey: process.env.API_KEY || 'default-secret-key',
    env: process.env.NODE_ENV || 'development',
    storagePaths: {
        sessions: path.join(__dirname, '../sessions'),
        storage: path.join(__dirname, '../storage'),
        accounts: path.join(__dirname, '../storage/accounts.json'),
        queue: path.join(__dirname, '../storage/queue.json'),
        logs: path.join(__dirname, '../storage/logs.json'),
        flows: path.join(__dirname, '../storage/flows.json')
    },
    dashboard: {
        username: process.env.DASHBOARD_USERNAME || 'admin',
        password: process.env.DASHBOARD_PASSWORD || 'admin123'
    }
};
