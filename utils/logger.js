const pino = require('pino');
const config = require('../config/config');

const logger = pino({
    level: config.env === 'development' ? 'debug' : 'info',
    transport: config.env === 'development' ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard'
        }
    } : undefined
});

module.exports = logger;
