const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { adminAuth } = require('../middleware/authMiddleware');

router.get('/:accountId', adminAuth, chatController.getChats);
router.post('/:accountId/:phone/status', adminAuth, chatController.updateStatus);

module.exports = router;
