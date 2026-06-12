const express = require('express');
const router = express.Router();
const logService = require('../services/logService');

router.get('/logs', (req, res) => {
    try {
        const logs = logService.getLogs();
        
        // Count stats from logs
        const sent = logs.filter(l => l.event === 'MESSAGE_SENT').length;
        const received = logs.filter(l => l.event === 'MESSAGE_RECEIVED').length;
        
        res.json({ success: true, logs, stats: { sent, received } });
    } catch(e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
