const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');
const logger = require('../utils/logger');
const qrcode = require('qrcode');

// In-memory store for active sockets and their latest QR codes
const sessions = new Map();
const qrCodes = new Map();

// Helper to update accounts.json
const updateAccountStatus = (id, status, number = '-') => {
    try {
        const accounts = JSON.parse(fs.readFileSync(config.storagePaths.accounts, 'utf8'));
        const index = accounts.findIndex(a => a.id === id);
        if (index > -1) {
            accounts[index].status = status;
            if (number !== '-') accounts[index].number = number;
            fs.writeFileSync(config.storagePaths.accounts, JSON.stringify(accounts, null, 2));
        }
    } catch (error) {
        logger.error({ error: error.message }, 'Failed to update accounts.json');
    }
};

const createAccountRecord = (id) => {
    try {
        let accounts = [];
        if (fs.existsSync(config.storagePaths.accounts)) {
            accounts = JSON.parse(fs.readFileSync(config.storagePaths.accounts, 'utf8'));
        }
        if (accounts.find(a => a.id === id)) return null;
        
        const apiKey = 'wa_' + crypto.randomBytes(16).toString('hex');
        accounts.push({ 
            id, 
            name: id, 
            status: 'INIT', 
            number: '-', 
            apiKey, 
            createdAt: new Date().toISOString() 
        });
        fs.writeFileSync(config.storagePaths.accounts, JSON.stringify(accounts, null, 2));
        return apiKey;
    } catch (e) {
        return null;
    }
};

const getAccounts = () => {
    try {
        return JSON.parse(fs.readFileSync(config.storagePaths.accounts, 'utf8'));
    } catch (error) {
        return [];
    }
};

const initSession = async (accountId) => {
    const sessionDir = path.join(config.storagePaths.sessions, accountId);
    
    // Ensure session directory exists
    if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const baileysLogger = pino({ level: 'silent' });

    const socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: baileysLogger,
        browser: ['WA Server', 'Chrome', '1.0.0']
    });

    sessions.set(accountId, socket);

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            logger.info({ accountId }, 'New QR Code generated');
            try {
                const qrBase64 = await qrcode.toDataURL(qr);
                qrCodes.set(accountId, qrBase64);
                updateAccountStatus(accountId, 'QR_READY');
            } catch (err) {
                logger.error({ err }, 'Failed to generate QR base64');
            }
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            
            logger.warn({ accountId, reason }, `Connection closed. Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                updateAccountStatus(accountId, 'DISCONNECTED');
                setTimeout(() => initSession(accountId), 5000);
            } else {
                updateAccountStatus(accountId, 'LOGGED_OUT');
                sessions.delete(accountId);
                qrCodes.delete(accountId);
                if (fs.existsSync(sessionDir)) {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                }
                logger.info({ accountId }, 'Session logged out and deleted');
            }
        }

        if (connection === 'open') {
            logger.info({ accountId }, 'Connection opened successfully');
            qrCodes.delete(accountId);
            
            const userJid = socket.user?.id || '';
            const number = userJid.split(':')[0] || '-';
            
            updateAccountStatus(accountId, 'CONNECTED', `+${number}`);
        }
    });

    return socket;
};

const initAllSessions = async () => {
    const accounts = getAccounts();
    logger.info(`Found ${accounts.length} accounts in storage. Restoring sessions...`);
    
    for (const acc of accounts) {
        if (acc.status !== 'LOGGED_OUT') {
            await initSession(acc.id);
        }
    }
};

const getSession = (accountId) => sessions.get(accountId);

const getQrCode = (accountId) => qrCodes.get(accountId);

const deleteSession = async (accountId) => {
    const socket = sessions.get(accountId);
    if (socket) {
        await socket.logout();
    } else {
        const sessionDir = path.join(config.storagePaths.sessions, accountId);
        if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true });
        }
        updateAccountStatus(accountId, 'LOGGED_OUT');
        
        try {
            let accounts = JSON.parse(fs.readFileSync(config.storagePaths.accounts, 'utf8'));
            accounts = accounts.filter(a => a.id !== accountId);
            fs.writeFileSync(config.storagePaths.accounts, JSON.stringify(accounts, null, 2));
        } catch (e) {}
    }
};

module.exports = {
    createAccountRecord,
    initSession,
    initAllSessions,
    getSession,
    getQrCode,
    deleteSession,
    getAccounts
};
