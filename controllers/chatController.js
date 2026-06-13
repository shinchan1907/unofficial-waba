const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

const getChatFile = (accountId) => {
    return path.join(path.dirname(config.storagePaths.accounts), `chats_${accountId}.json`);
};

exports.logMessage = (accountId, phone, senderType, text, messageType = 'text') => {
    try {
        const file = getChatFile(accountId);
        let chats = {};
        
        if (fs.existsSync(file)) {
            chats = JSON.parse(fs.readFileSync(file, 'utf8'));
        }
        
        if (!chats[phone]) {
            chats[phone] = { messages: [], lastUpdate: Date.now() };
        }
        
        chats[phone].messages.push({
            sender: senderType, // 'bot' or 'user'
            text: text,
            type: messageType,
            timestamp: new Date().toISOString()
        });
        
        chats[phone].lastUpdate = Date.now();
        
        fs.writeFileSync(file, JSON.stringify(chats, null, 2));
    } catch(e) {
        logger.error({ error: e.message }, 'Failed to log chat message');
    }
};

exports.getChats = (req, res) => {
    try {
        const { accountId } = req.params;
        const file = getChatFile(accountId);
        
        if (fs.existsSync(file)) {
            const chats = JSON.parse(fs.readFileSync(file, 'utf8'));
            res.json({ success: true, chats });
        } else {
            res.json({ success: true, chats: {} });
        }
    } catch(e) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

exports.updateStatus = (req, res) => {
    try {
        const { accountId, phone } = req.params;
        const { status } = req.body; // 'bot' or 'human'
        
        const file = getChatFile(accountId);
        let chats = {};
        if (fs.existsSync(file)) chats = JSON.parse(fs.readFileSync(file, 'utf8'));
        
        if (!chats[phone]) chats[phone] = { messages: [], lastUpdate: Date.now() };
        chats[phone].status = status;
        
        fs.writeFileSync(file, JSON.stringify(chats, null, 2));
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

exports.isBotPaused = (accountId, phone) => {
    try {
        const file = getChatFile(accountId);
        if (!fs.existsSync(file)) return false;
        const chats = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (chats[phone] && chats[phone].status === 'human') {
            return true;
        }
        return false;
    } catch(e) {
        return false;
    }
};
