const db = require("../config/db_settings");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { jwtSecret } = require("../config/dotenvConfig");
const generator = require("generate-password");
const { format, addDays, addMonths } = require("date-fns");
const { sendCredentialsEmail } = require("../services/emailService");
// Secret for JWT
const JWT_SECRET = jwtSecret;

// Admin Signup
const adminSignup = async (req, res) => {
  try {
    // Validate email and password using express-validator
    await body("email")
      .isEmail()
      .withMessage("Please enter a valid email address")
      .run(req);
    await body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters long")
      .run(req);

    const errors = validationResult(req);

    // If there are validation errors, send a detailed response
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, confirmPassword } = req.body;

    // Check if the passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Check if admin already exists
    const existingAdmin = await db.select(
      "tbl_admins",
      "*",
      `email='${email}'`
    );
    if (existingAdmin) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new admin into the database
    await db.insert("tbl_admins", { name, email, password: hashedPassword });

    // Send success response
    res.status(201).json({ message: "Admin registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin Login
const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if admin exists
    const admin = await db.select("tbl_admins", "*", `email='${email}'`);
    if (!admin) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Password Incorrect" });
    }

    // Generate a new session token
    const sessionToken = jwt.sign(
      { id: admin.id, email: admin.email },
      JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    // Update the admin's session token in the database
    await db.update(
      "tbl_admins",
      { session_token: sessionToken },
      `id=${admin.id}`
    );

    // Return the session token and admin data in the response
    res.json({
      message: "Login successful",
      token: sessionToken,
      admin, // Include the admin data in the response
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get Admin Profile
const getAdminProfile = async (req, res) => {
  try {
    // Get admin ID from the authenticated request
    const adminId = req.admin.id; // This comes from the auth middleware

    // Fetch admin details from database
    const admin = await db.select(
      "tbl_admins",
      "id, name, email, created_at", // Only select non-sensitive fields
      `id=${adminId}`
    );

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Return admin data
    res.json({ admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Update Admin Profile
const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.id; // From auth middleware
    const { name, email, currentPassword, newPassword } = req.body;

    // Fetch current admin data
    const admin = await db.select("tbl_admins", "*", `id=${adminId}`);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Prepare update data
    const updateData = {};

    // Update name if provided
    if (name) {
      updateData.name = name;
    }

    // Update email if provided
    if (email && email !== admin.email) {
      // Check if new email already exists
      const emailExists = await db.select(
        "tbl_admins",
        "id",
        `email='${email}' AND id!=${adminId}`
      );
      if (emailExists) {
        return res.status(400).json({ message: "Email already in use" });
      }
      updateData.email = email;
    }

    // Update password if provided
    if (currentPassword && newPassword) {
      // Verify current password
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        admin.password
      );
      if (!isPasswordValid) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }

      // Hash new password
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Update admin profile
    if (Object.keys(updateData).length > 0) {
      await db.update("tbl_admins", updateData, `id=${adminId}`);
      res.json({ message: "Profile updated successfully" });
    } else {
      res.status(400).json({ message: "No data provided for update" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get All Users
const getAllUsers = async (req, res) => {
  try {
    // Fetch all users from the database
    const users = await db.selectAll("tbl_users", "*", true);
    console.log(users);

    // Send the users data in the response
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const toggleUserActiveStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    // Validate that is_active is either 1 or 0
    if (is_active !== 0 && is_active !== 1) {
      return res
        .status(400)
        .json({ message: "Invalid value for is_active. It must be 0 or 1." });
    }

    // If user is being deactivated, reset subscription-related fields
    const updatedFields =
      is_active === 0
        ? {
            is_active,
            subscription_type: null,
            subscription_status: null,
            subscription_start_date: null,
            subscription_end_date: null,
          }
        : { is_active }; // If user is being activated, no need to change subscription fields

    // Update the user's active status and subscription fields in the database
    const result = await db.update(
      "tbl_users",
      updatedFields,
      `id = ${userId}`
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User active status updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const createUserAndSendCredentials = async (req, res) => {
  try {
    const { email, name, subscription_type, start_date } = req.body;

    // Validate required fields
    if (!email || !name || !subscription_type || !start_date) {
      return res.status(400).json({
        message: "Email, Name, Subscription Type, and Start Date are required",
      });
    }

    // Validate subscription type
    const validTypes = ["monthly", "6-months"];
    if (!validTypes.includes(subscription_type)) {
      return res.status(400).json({ message: "Invalid subscription type" });
    }

    // Check if user already exists
    const existingUser = await db.selectAll("tbl_users", "*", `email='${email}'`);
    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // Generate a random password of 8 characters
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
    let password = "";
    for (let i = 0; i < 8; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Calculate dates
    const startDate = new Date(start_date);
    startDate.setHours(0, 0, 0, 0);

    // Trial period: 7 days from start date
    const trialEndDate = addDays(startDate, 7);

    // Subscription starts after trial
    const subscriptionStartDate = addDays(trialEndDate, 1);

    // Calculate subscription end date
    const subscriptionEndDate =
      subscription_type === "monthly"
        ? addMonths(subscriptionStartDate, 1)
        : addMonths(subscriptionStartDate, 6);

    // Insert new user into the database
    await db.insert("tbl_users", {
      email,
      name,
      password: hashedPassword,
      subscription_type,
      subscription_status: "trial",
      subscription_start_date: format(subscriptionStartDate, "yyyy-MM-dd"),
      subscription_end_date: format(subscriptionEndDate, "yyyy-MM-dd"),
      trial_end_date: format(trialEndDate, "yyyy-MM-dd"),
      is_active: 1,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Send credentials email
    await sendCredentialsEmail(name, email, password);

    // Add logging to verify password length (remove in production)
    console.log(`Generated password length: ${password.length}`);

    res.status(201).json({
      message: "User created and credentials sent successfully",
      subscription_details: {
        trial_end_date: format(trialEndDate, "yyyy-MM-dd"),
        subscription_start_date: format(subscriptionStartDate, "yyyy-MM-dd"),
        subscription_end_date: format(subscriptionEndDate, "yyyy-MM-dd"),
        subscription_status: "trial",
        is_active: 1,
      },
    });
  } catch (err) {
    console.error("Error in createUserAndSendCredentials:", err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};
// Cron job to update subscription statuses
const checkTrialExpirations = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find users whose trial has ended and haven't paid
    const expiredTrials = await db.select(
      "tbl_users",
      "*",
      `trial_end_date <= '${format(
        today,
        "yyyy-MM-dd"
      )}' AND subscription_status = 'trial'`
    );

    for (const user of expiredTrials) {
      // Update user to inactive since trial ended without payment
      await db.update(
        "tbl_users",
        {
          is_active: 0,
          subscription_status: "expired",
          updated_at: new Date(),
        },
        `id = ${user.id}`
      );
    }
  } catch (err) {
    console.error("Error in checkTrialExpirations:", err);
  }
};

// Update User Subscription
const updateUser = async (req, res) => {
  try {
    const { email, subscription_type, start_date } = req.body;

    // Validate required fields
    if (!email || !subscription_type) {
      return res
        .status(400)
        .json({ message: "Email and subscription type are required" });
    }

    // Validate subscription type
    const validTypes = ["monthly", "6-months"];
    if (!validTypes.includes(subscription_type)) {
      return res.status(400).json({ message: "Invalid subscription type" });
    }

    // Check if user exists
    const user = await db.select("tbl_users", "*", `email='${email}'`);
    if (!user || user.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    // Use provided start_date or default to today
    const startDate = start_date ? new Date(start_date) : new Date();
    startDate.setHours(0, 0, 0, 0);

    // Calculate trial and subscription dates
    const trialEndDate = addDays(startDate, 7);
    const subscriptionStartDate = addDays(trialEndDate, 1);
    const subscriptionEndDate =
      subscription_type === "monthly"
        ? addMonths(subscriptionStartDate, 1)
        : addMonths(subscriptionStartDate, 6);

    // If user is being activated (e.g., after payment), set status to 'active'
    const subscriptionStatus = user.is_active === 0 ? "active" : "trial";

    // Update user subscription info
    await db.update(
      "tbl_users",
      {
        subscription_type,
        subscription_status: subscriptionStatus,
        subscription_start_date: format(subscriptionStartDate, "yyyy-MM-dd"),
        subscription_end_date: format(subscriptionEndDate, "yyyy-MM-dd"),
        trial_end_date: format(trialEndDate, "yyyy-MM-dd"),
        is_active: 1,
        updated_at: new Date(),
      },
      `email = '${email}'`
    );

    return res.status(200).json({
      message: "Subscription updated successfully",
      subscription_details: {
        subscription_type,
        subscription_start_date: format(subscriptionStartDate, "yyyy-MM-dd"),
        subscription_end_date: format(subscriptionEndDate, "yyyy-MM-dd"),
        trial_end_date: format(trialEndDate, "yyyy-MM-dd"),
        subscription_status: subscriptionStatus,
        is_active: 1,
      },
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  adminSignup,
  adminLogin,
  getAdminProfile,
  updateAdminProfile,
  getAllUsers,
  toggleUserActiveStatus,
  updateUser,
  createUserAndSendCredentials,
  checkTrialExpirations,
};
