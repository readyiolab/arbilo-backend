const express = require("express");
const {
  signup,
  login,
  googleLogin,
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
const { signupLimiter, loginLimiter } = require("../ratelimit/rateLimit");

const router = express.Router();

router.post("/signup", signupLimiter, signup);
router.post("/login", loginLimiter, login);
router.post("/google", loginLimiter, googleLogin);
router.post("/logout", combinedMiddleware, logout);
router.get("/login-stats", combinedMiddleware, getLoginStats);

router.post("/contact-us", contactUs);
router.post("/forgot-password", loginLimiter, forgotPassword);
router.post("/reset-password", loginLimiter, resetPassword);
router.get("/dashboard", combinedMiddleware, getUserProfile);
router.put("/update-name", combinedMiddleware, updateUserName);
router.put("/change-password", combinedMiddleware, changePassword);

module.exports = router;
