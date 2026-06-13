const express = require('express');
const router = express.Router();
const flowController = require('../controllers/flowController');
const { adminAuth } = require('../middleware/authMiddleware');

router.get('/:accountId', adminAuth, flowController.getFlow);
router.post('/:accountId', adminAuth, flowController.saveFlow);
router.post('/webhook/:accountId', flowController.executeWebhook);

module.exports = router;
