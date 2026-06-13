const express = require('express');
const router = express.Router();
const flowController = require('../controllers/flowController');
const { adminAuth } = require('../middleware/authMiddleware');

router.get('/:accountId', adminAuth, flowController.getFlows);
router.post('/:accountId/:flowId', adminAuth, flowController.saveFlow);
router.delete('/:accountId/:flowId', adminAuth, flowController.deleteFlow);
router.get('/webhook/latest/:accountId', adminAuth, flowController.getLatestWebhook);
router.post('/webhook/:accountId/:flowId?', flowController.executeWebhook);

module.exports = router;
