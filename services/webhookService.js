const logger = require('../utils/logger');
const logService = require('./logService');

global._flowState = global._flowState || {};

const handleIncomingMessage = async (accountId, message) => {
    try {
        if (!message.message) return; // Not a standard message
        if (message.key.fromMe) return; // Ignore messages sent by the bot itself
        
        const sender = message.key.remoteJid.split('@')[0];
        if (sender === 'status') return; // Ignore WhatsApp status updates
        
        const msgType = Object.keys(message.message)[0];
        
        let text = '';
        if (msgType === 'conversation') {
            text = message.message.conversation;
        } else if (msgType === 'extendedTextMessage') {
            text = message.message.extendedTextMessage.text;
        } else if (msgType === 'imageMessage') {
            text = message.message.imageMessage.caption || '[Image]';
        } else if (msgType === 'videoMessage') {
            text = message.message.videoMessage.caption || '[Video]';
        } else if (msgType === 'documentMessage') {
            text = message.message.documentMessage.fileName || '[Document]';
        } else {
            text = `[${msgType}]`; // Other media types like audio, stickers, etc.
        }

        // Log the received message to the UI
        logService.writeLog(accountId, 'MESSAGE_RECEIVED', `From: ${sender}`);

        // Update global flow state for incoming messages
        global._flowState[accountId] = global._flowState[accountId] || {};
        global._flowState[accountId][sender] = global._flowState[accountId][sender] || {};
        global._flowState[accountId][sender].replied = true;
        global._flowState[accountId][sender].lastMessage = text;

        // Get specific account webhook, fallback to global env
        const accounts = require('./whatsappManager').getAccounts();
        const account = accounts.find(a => a.id === accountId);
        
        const webhookUrl = (account && account.webhookUrl) ? account.webhookUrl : process.env.WEBHOOK_URL;
        
        if (!webhookUrl) return;

        const payload = {
            event: 'message_received',
            account: accountId,
            sender: sender,
            text: text,
            messageId: message.key.id,
            messageType: msgType,
            timestamp: new Date().toISOString()
        };

        // Fire and forget the webhook
        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(err => {
            logger.error({ err: err.message }, 'Failed to deliver webhook');
        });
        // Also trigger internal flow engine if the incoming node exists!
        // We do this by hitting our own internal webhook endpoint locally
        fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/flows/webhook/${accountId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
        
    } catch (error) {
        logger.error({ error: error.message }, 'Error parsing incoming message');
    }
};

const handleMessageStatus = async (accountId, update) => {
    try {
        if (!update.update || !update.update.status) return;
        
        // WhatsApp Status Mapping
        // 2: SERVER_ACK, 3: DELIVERY_ACK, 4: READ, 5: PLAYED
        const statusMap = { 2: 'SENT', 3: 'DELIVERED', 4: 'READ', 5: 'PLAYED' };
        const statusName = statusMap[update.update.status];
        if (!statusName) return;

        const recipient = update.key.remoteJid.split('@')[0];
        if (recipient === 'status') return;

        // Log the read receipt to dashboard
        if (statusName === 'READ') {
            logService.writeLog(accountId, 'MESSAGE_READ', `By: ${recipient}`);
            
            // Update global flow state for seen
            global._flowState[accountId] = global._flowState[accountId] || {};
            global._flowState[accountId][recipient] = global._flowState[accountId][recipient] || {};
            global._flowState[accountId][recipient].seen = true;
        }

        const accounts = require('./whatsappManager').getAccounts();
        const account = accounts.find(a => a.id === accountId);
        const webhookUrl = (account && account.webhookUrl) ? account.webhookUrl : process.env.WEBHOOK_URL;
        if (!webhookUrl) return;

        const payload = {
            event: 'message_status',
            account: accountId,
            recipient: recipient,
            messageId: update.key.id,
            status: statusName,
            timestamp: new Date().toISOString()
        };

        fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(() => {});
        
    } catch (error) {
        logger.error({ error: error.message }, 'Error parsing message status');
    }
};

module.exports = { handleIncomingMessage, handleMessageStatus };
