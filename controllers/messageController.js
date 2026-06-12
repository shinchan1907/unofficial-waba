const queueService = require('../services/queueService');
const whatsappManager = require('../services/whatsappManager');

const sendMessage = async (req, res) => {
    const { account, number, message } = req.body;

    if (!account || !number || !message) {
        return res.status(400).json({ success: false, error: 'Missing required parameters: account, number, message' });
    }

    try {
        // We only check if session exists. If it's disconnected, queue processor will just mark it FAILED later.
        // But for better UX, we can check its current status
        const session = whatsappManager.getSession(account);
        if (!session) {
            return res.status(400).json({ success: false, error: 'Account is not connected or active.' });
        }

        const msgId = queueService.addToQueue(account, number, message);
        
        res.json({
            success: true,
            message: 'Message added to queue',
            msgId
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

module.exports = { sendMessage };
