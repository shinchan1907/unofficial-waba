const whatsappManager = require('../services/whatsappManager');

const createAccount = async (req, res) => {
    const { name } = req.body;
    if (!name || name.includes(' ')) {
        return res.status(400).json({ success: false, error: 'Invalid account name. No spaces allowed.' });
    }

    try {
        const existing = whatsappManager.getSession(name);
        if (existing) {
            return res.status(400).json({ success: false, error: 'Account already exists and is active.' });
        }

        const apiKey = whatsappManager.createAccountRecord(name);
        if (!apiKey) {
            return res.status(400).json({ success: false, error: 'Account already exists in storage.' });
        }

        await whatsappManager.initSession(name);
        res.json({ success: true, accountId: name, apiKey, message: 'Account creation initiated. Fetch QR code next.' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const getAccounts = (req, res) => {
    const accounts = whatsappManager.getAccounts();
    res.json({ success: true, accounts });
};

const getQrCode = (req, res) => {
    const { id } = req.params;
    const qrBase64 = whatsappManager.getQrCode(id);

    if (qrBase64) {
        res.json({ success: true, accountId: id, qr: qrBase64 });
    } else {
        const accounts = whatsappManager.getAccounts();
        const account = accounts.find(a => a.id === id);
        
        if (account && account.status === 'CONNECTED') {
            res.status(400).json({ success: false, error: 'Account is already connected.' });
        } else {
            res.status(404).json({ success: false, error: 'QR Code not ready or account not found. Wait a few seconds and retry.' });
        }
    }
};

const getStatus = (req, res) => {
    const { id } = req.params;
    const accounts = whatsappManager.getAccounts();
    const account = accounts.find(a => a.id === id);

    if (account) {
        res.json({ success: true, status: account.status, number: account.number });
    } else {
        res.status(404).json({ success: false, error: 'Account not found' });
    }
};

const logoutAccount = async (req, res) => {
    const { id } = req.params;
    try {
        await whatsappManager.deleteSession(id);
        res.json({ success: true, message: `Account ${id} logged out and deleted successfully.` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

const updateWebhook = (req, res) => {
    const { id } = req.params;
    const { webhookUrl } = req.body;
    
    if (webhookUrl && !webhookUrl.startsWith('http')) {
        return res.status(400).json({ success: false, error: 'Webhook URL must start with http/https' });
    }

    const success = whatsappManager.updateAccountWebhook(id, webhookUrl || null);
    
    if (success) {
        res.json({ success: true, message: 'Webhook URL updated successfully' });
    } else {
        res.status(404).json({ success: false, error: 'Account not found' });
    }
};

module.exports = {
    createAccount,
    getAccounts,
    getQrCode,
    getStatus,
    logoutAccount,
    updateWebhook
};
