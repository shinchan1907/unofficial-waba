const fs = require('fs');
const config = require('../config/config');

const jwt = require('jsonwebtoken');

const JWT_SECRET = config.apiKey || 'fallback-secret-key';

const verifyJwt = (req) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (e) {
            return null;
        }
    }
    return null;
};

const adminAuth = (req, res, next) => {
    // 1. Check master API key
    const rawKey = req.headers['x-api-key'] || req.query.api_key;
    if (rawKey && rawKey.trim() === config.apiKey) {
        return next();
    }
    
    // 2. Check JWT for Admin role
    const decoded = verifyJwt(req);
    if (decoded && decoded.role === 'Admin') {
        req.user = decoded;
        return next();
    }
    
    return res.status(401).json({ success: false, error: 'Unauthorized: Admin access required' });
};

const jwtAuth = (req, res, next) => {
    const decoded = verifyJwt(req);
    if (decoded) {
        req.user = decoded;
        return next();
    }
    
    // Fallback to master API key for system calls
    const rawKey = req.headers['x-api-key'] || req.query.api_key;
    if (rawKey && rawKey.trim() === config.apiKey) {
        return next();
    }
    
    return res.status(401).json({ success: false, error: 'Unauthorized: Valid token required' });
};

const accountAuth = (req, res, next) => {
    // 1. Check JWT or Master API Key
    const decoded = verifyJwt(req);
    if (decoded) {
        req.user = decoded;
        return next();
    }
    
    const rawKey = req.headers['x-api-key'] || req.query.api_key;
    const apiKey = rawKey ? rawKey.trim() : null;
    
    if (apiKey === config.apiKey) {
        return next();
    }
    
    // 2. Check Account-specific API key (for Zapier/Webhooks)
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing API Key' });
    }

    const targetAccount = req.body.account || req.params.id;
    if (!targetAccount) {
        return res.status(400).json({ success: false, error: 'Account ID required in body or URL for authentication' });
    }

    try {
        if (fs.existsSync(config.storagePaths.accounts)) {
            const accounts = JSON.parse(fs.readFileSync(config.storagePaths.accounts, 'utf8'));
            const account = accounts.find(a => a.id === targetAccount);
            
            if (!account) {
                return res.status(401).json({ success: false, error: `Unauthorized: Account '${targetAccount}' not found in storage` });
            }
            
            if (account.apiKey === apiKey) {
                return next();
            } else {
                return res.status(401).json({ success: false, error: 'Unauthorized: API Key mismatch' });
            }
        } else {
            return res.status(401).json({ success: false, error: 'Unauthorized: accounts database not found' });
        }
    } catch (e) {
        return res.status(500).json({ success: false, error: 'Internal Server Error reading accounts' });
    }
};

const dashboardAuth = (req, res, next) => {
    // Basic Auth removed, let frontend handle JWT login screen
    return next();
};

module.exports = { adminAuth, accountAuth, dashboardAuth, jwtAuth };
