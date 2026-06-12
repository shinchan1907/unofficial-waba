const config = require('../config/config');

const apiAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    if (!apiKey || apiKey !== config.apiKey) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing API Key' });
    }
    next();
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

module.exports = { apiAuth, dashboardAuth };
