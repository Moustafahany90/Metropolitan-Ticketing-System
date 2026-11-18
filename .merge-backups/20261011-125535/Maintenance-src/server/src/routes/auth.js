const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Public auth routes
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.get('/me', authController.me);
router.get('/ad-status', authController.adStatus);

module.exports = router;