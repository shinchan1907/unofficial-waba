const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');

router.post('/', accountController.createAccount);
router.get('/', accountController.getAccounts);
router.get('/:id/qr', accountController.getQrCode);
router.get('/:id/status', accountController.getStatus);
router.post('/:id/logout', accountController.logoutAccount);

// Update account webhook URL
router.put('/:id/webhook', accountController.updateWebhook);

module.exports = router;
