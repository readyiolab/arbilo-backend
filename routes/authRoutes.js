const express = require('express');
const { 
  signup, 
  login, 
  forgotPassword, 
  resetPassword, 
  getUserProfile, 
  updateUserName, 
  changePassword,
 createUserAndSendCredentials,
 contactUs
  // Import the sendBulkEmail function
} = require('../controllers/authController');
const combinedMiddleware = require('../middleware/userMiddleware');
// const {signupLimiter,loginLimiter}  = require('../ratelimit/rateLimit')

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);

router.post('/contact-us', contactUs);
router.post('/create-user', createUserAndSendCredentials);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/dashboard', combinedMiddleware, getUserProfile);
router.put('/update-name', combinedMiddleware, updateUserName);
router.put('/change-password', combinedMiddleware, changePassword);



module.exports = router;
