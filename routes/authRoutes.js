const express = require("express");
const {
  signup,
  login,
  googleLogin, // Add this import
  logout,
  getLoginStats,
  forgotPassword,
  resetPassword,
  getUserProfile,
  updateUserName,
  changePassword,
  contactUs,
} = require("../controllers/authController");
const combinedMiddleware = require("../middleware/userMiddleware");
// const {signupLimiter,loginLimiter}  = require('../ratelimit/rateLimit')

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleLogin); // Add this route for Google OAuth
router.post("/logout", combinedMiddleware, logout); // Add logout route
router.get("/login-stats", combinedMiddleware, getLoginStats); // Add login stats route

router.post("/contact-us", contactUs);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/dashboard", combinedMiddleware, getUserProfile);
router.put("/update-name", combinedMiddleware, updateUserName);
router.put("/change-password", combinedMiddleware, changePassword);

module.exports = router;