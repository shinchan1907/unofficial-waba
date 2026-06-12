const fs = require('fs');
const config = require('../config/config');

const writeLog = (account, event, details) => {
    try {
        let logs = [];
        if (fs.existsSync(config.storagePaths.logs)) {
            logs = JSON.parse(fs.readFileSync(config.storagePaths.logs, 'utf8'));
        }
        
        // Add to front of array
        logs.unshift({
            time: new Date().toISOString(),
            account,
            event,
            details
        });
        
        // Keep only the last 100 logs to save memory
        if (logs.length > 100) {
            logs = logs.slice(0, 100);
        }
        
        fs.writeFileSync(config.storagePaths.logs, JSON.stringify(logs, null, 2));
    } catch (e) {
        console.error("Failed to write log", e);
    }
};

const getLogs = () => {
    try {
        if (fs.existsSync(config.storagePaths.logs)) {
            return JSON.parse(fs.readFileSync(config.storagePaths.logs, 'utf8'));
        }
    } catch (e) {}
    return [];
};

module.exports = { writeLog, getLogs };
