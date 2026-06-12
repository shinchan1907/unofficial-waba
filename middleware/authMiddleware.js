const fs = require('fs');
const config = require('../config/config');

const adminAuth = (req, res, next) => {
    const rawKey = req.headers['x-api-key'] || req.query.api_key;
    const apiKey = rawKey ? rawKey.trim() : null;
    
    if (!apiKey || apiKey !== config.apiKey) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing Admin API Key' });
    }
    next();
};

const accountAuth = (req, res, next) => {
    const rawKey = req.headers['x-api-key'] || req.query.api_key;
    const apiKey = rawKey ? rawKey.trim() : null;
    
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing API Key' });
    }
    
    // Admin key overrides account keys
    if (apiKey === config.apiKey) {
        return next();
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
                return res.status(401).json({ 
                    success: false, 
                    error: 'Unauthorized: API Key mismatch'
                });
            }
        } else {
            return res.status(401).json({ success: false, error: 'Unauthorized: accounts database not found' });
        }
    } catch (e) {
        return res.status(500).json({ success: false, error: 'Internal Server Error reading accounts' });
    }
};

const dashboardAuth = (req, res, next) => {
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');

    if (login === config.dashboard.username && password === config.dashboard.password) {
        return next();
    }

    res.set('WWW-Authenticate', 'Basic realm="WhatsApp Server Dashboard"');
    res.status(401).send('Authentication required.');
};

module.exports = { adminAuth, accountAuth, dashboardAuth };
