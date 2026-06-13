const express = require('express');
const router = express.Router();
const agentController = require('../controllers/agentController');
const { adminAuth } = require('../middleware/authMiddleware');

router.get('/', adminAuth, agentController.getAgents);
router.post('/', adminAuth, agentController.addAgent);
router.delete('/:id', adminAuth, agentController.deleteAgent);

module.exports = router;
