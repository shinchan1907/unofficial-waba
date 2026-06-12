const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');
const whatsappManager = require('./whatsappManager');
const logService = require('./logService');

let messageQueue = [];
let isProcessing = false;

const initQueue = () => {
    try {
        if (fs.existsSync(config.storagePaths.queue)) {
            messageQueue = JSON.parse(fs.readFileSync(config.storagePaths.queue, 'utf8'));
            logger.info(`Loaded ${messageQueue.length} pending messages from queue storage.`);
        } else {
            fs.writeFileSync(config.storagePaths.queue, JSON.stringify([]));
        }
    } catch (e) {
        logger.error('Failed to init queue storage');
    }
    
    // Check queue every 3 seconds
    setInterval(processQueue, 3000);
};

const saveQueue = () => {
    try {
        fs.writeFileSync(config.storagePaths.queue, JSON.stringify(messageQueue, null, 2));
    } catch (e) {
        logger.error('Failed to save queue storage');
    }
};

const addToQueue = (accountId, to, message, media = null) => {
    const msgId = 'msg_' + Date.now() + Math.floor(Math.random() * 1000);
    messageQueue.push({
        id: msgId,
        accountId,
        to,
        message,
        media,
        status: 'PENDING',
        createdAt: new Date().toISOString()
    });
    saveQueue();
    
    logService.writeLog(accountId, 'MESSAGE_QUEUED', `To: ${to}`);
    return msgId;
};

const processQueue = async () => {
    if (isProcessing || messageQueue.length === 0) return;
    isProcessing = true;

    try {
        // Find first pending message
        const index = messageQueue.findIndex(m => m.status === 'PENDING');
        if (index === -1) {
            isProcessing = false;
            return;
        }

        const task = messageQueue[index];
        const socket = whatsappManager.getSession(task.accountId);

        if (!socket) {
            logger.warn({ accountId: task.accountId }, 'Socket not found or disconnected. Skipping message.');
            // Mark failed so we don't get stuck in an infinite loop
            task.status = 'FAILED';
            task.error = 'Account disconnected';
            saveQueue();
            logService.writeLog(task.accountId, 'MESSAGE_FAILED', `To: ${task.to} (Disconnected)`);
            isProcessing = false;
            return;
        }

        // Send the message
        const jid = `${task.to}@s.whatsapp.net`;
        
        let msgPayload = { text: task.message };
        
        if (task.media) {
            if (task.media.type === 'image') {
                msgPayload = { image: { url: task.media.url }, caption: task.message };
            } else if (task.media.type === 'video') {
                msgPayload = { video: { url: task.media.url }, caption: task.message };
            } else if (task.media.type === 'document') {
                msgPayload = { 
                    document: { url: task.media.url }, 
                    caption: task.message,
                    fileName: task.media.fileName || 'document',
                    mimetype: task.media.mimetype || 'application/octet-stream'
                };
            }
        }
        
        await socket.sendMessage(jid, msgPayload);
        
        // Remove from queue upon success to keep file lightweight
        messageQueue.splice(index, 1);
        saveQueue();
        
        logger.info({ msgId: task.id }, 'Message sent successfully');
        logService.writeLog(task.accountId, 'MESSAGE_SENT', `To: ${task.to}`);

        // Anti-ban delay: Wait 1 to 3 seconds before next message
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    } catch (error) {
        logger.error({ error: error.message }, 'Queue processing error');
        if (isProcessing && messageQueue.length > 0) {
             const failedTask = messageQueue.find(m => m.status === 'PENDING');
             if (failedTask) logService.writeLog(failedTask.accountId, 'MESSAGE_ERROR', error.message);
        }
    } finally {
        isProcessing = false;
    }
};

module.exports = { initQueue, addToQueue };
