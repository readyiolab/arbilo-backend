const express = require("express");
const router = express.Router();
const {adminLogin,adminSignup,getAllUsers,toggleUserActiveStatus ,getAdminProfile,updateAdminProfile, updateUser, createUserAndSendCredentials} = require("../controllers/adminController");
const adminAuthMiddleware = require("../middleware/adminMiddleware");


// Admin Registration
router.post("/signup", adminSignup);

// Admin Login
router.post("/login", adminLogin);
router.get('/profile', adminAuthMiddleware, getAdminProfile);
router.put('/profile', adminAuthMiddleware, updateAdminProfile);
router.post('/create-user',adminAuthMiddleware, createUserAndSendCredentials)
router.post('/update-subscription',adminAuthMiddleware,updateUser)
router.get("/users", adminAuthMiddleware, getAllUsers);
router.put("/users/:userId/toggle-active", adminAuthMiddleware, toggleUserActiveStatus);

module.exports = router;