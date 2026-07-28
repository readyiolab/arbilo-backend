const express = require("express");
const router = express.Router();
const {
  adminLogin,
  adminSignup,
  getAllUsers,
  toggleUserActiveStatus,
  getAdminProfile,
  updateAdminProfile,
  updateUser,
  createUserAndSendCredentials,
  getFreeUserCount,
  getUserLoginStats,
  getOverallStats,
  getSupportTickets,
  getFeedback,
} = require("../controllers/adminController");
const adminAuthMiddleware = require("../middleware/adminMiddleware");
const { signupLimiter, loginLimiter } = require("../ratelimit/rateLimit");

// Bootstrap: allow first admin signup without auth when no admins exist;
// otherwise require an existing admin session.
const conditionalAdminSignup = async (req, res, next) => {
  try {
    const db = require("../config/db_settings");
    const existing = await db.queryOne("SELECT id FROM tbl_admins LIMIT 1");
    if (!existing) {
      return adminSignup(req, res);
    }
    return adminAuthMiddleware(req, res, () => adminSignup(req, res));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

router.post("/signup", signupLimiter, conditionalAdminSignup);
router.post("/login", loginLimiter, adminLogin);
router.get("/profile", adminAuthMiddleware, getAdminProfile);
router.put("/profile", adminAuthMiddleware, updateAdminProfile);
router.post("/create-user", adminAuthMiddleware, createUserAndSendCredentials);
router.post("/update-subscription", adminAuthMiddleware, updateUser);
router.get("/users", adminAuthMiddleware, getAllUsers);
router.put(
  "/users/:userId/toggle-active",
  adminAuthMiddleware,
  toggleUserActiveStatus
);

router.get("/stats/free-users", adminAuthMiddleware, getFreeUserCount);
router.get("/stats/user-login/:userId", adminAuthMiddleware, getUserLoginStats);
router.get("/stats/overall", adminAuthMiddleware, getOverallStats);

router.get("/support", adminAuthMiddleware, getSupportTickets);
router.get("/feedback", adminAuthMiddleware, getFeedback);

module.exports = router;
