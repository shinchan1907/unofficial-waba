const logger = require('../utils/logger');
const logService = require('./logService');

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

        // Get specific account webhook, fallback to global env
        const accounts = require('./whatsappManager').getAccounts();
        const account = accounts.find(a => a.id === accountId);
        
        const webhookUrl = (account && account.webhookUrl) ? account.webhookUrl : process.env.WEBHOOK_URL;
        
        if (!webhookUrl) return;

        const payload = {
            account: accountId,
            sender: sender,
            text: text,
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
        
    } catch (error) {
        logger.error({ error: error.message }, 'Error parsing incoming message');
    }
};

module.exports = { handleIncomingMessage };
