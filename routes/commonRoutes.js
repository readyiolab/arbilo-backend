const express = require('express');
const router = express.Router();
const commonController = require('../controllers/commonController');

router.post('/support', commonController.createSupportTicket);
router.post('/feedback', commonController.createFeedback);

module.exports = router;
