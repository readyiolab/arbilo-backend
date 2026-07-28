const db = require("../config/db_settings");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { jwtSecret } = require("../config/dotenvConfig");
const { format, addDays, addMonths } = require("date-fns");
const { sendCredentialsEmail } = require("../services/emailService");
const {
  stripSensitive,
  stripSensitiveList,
  USER_SAFE_COLUMNS,
  ADMIN_SAFE_COLUMNS,
} = require("../utils/sanitize");
const { parsePagination, paginatedResponse } = require("../utils/pagination");

const JWT_SECRET = jwtSecret;

const adminSignup = async (req, res) => {
  try {
    await body("email")
      .isEmail()
      .withMessage("Please enter a valid email address")
      .run(req);
    await body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingAdmin = await db.select(
      "tbl_admins",
      "id",
      "email = ?",
      [email]
    );
    if (existingAdmin) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.insert("tbl_admins", { name, email, password: hashedPassword });

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await db.select("tbl_admins", "*", "email = ?", [email]);
    if (!admin) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const sessionToken = jwt.sign(
      { id: admin.id, email: admin.email },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    await db.update(
      "tbl_admins",
      { session_token: sessionToken },
      "id = ?",
      [admin.id]
    );

    res.json({
      message: "Login successful",
      token: sessionToken,
      admin: stripSensitive(admin),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.id;

    const admin = await db.select(
      "tbl_admins",
      ADMIN_SAFE_COLUMNS,
      "id = ?",
      [adminId]
    );

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json({ admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { name, email, currentPassword, newPassword } = req.body;

    const admin = await db.select("tbl_admins", "*", "id = ?", [adminId]);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const updateData = {};

    if (name) {
      updateData.name = name;
    }

    if (email && email !== admin.email) {
      const emailExists = await db.select(
        "tbl_admins",
        "id",
        "email = ? AND id != ?",
        [email, adminId]
      );
      if (emailExists) {
        return res.status(400).json({ message: "Email already in use" });
      }
      updateData.email = email;
    }

    if (currentPassword && newPassword) {
      const isPasswordValid = await bcrypt.compare(
        currentPassword,
        admin.password
      );
      if (!isPasswordValid) {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }
      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length > 0) {
      await db.update("tbl_admins", updateData, "id = ?", [adminId]);
      res.json({ message: "Profile updated successfully" });
    } else {
      res.status(400).json({ message: "No data provided for update" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });

    const countRow = await db.queryOne(
      "SELECT COUNT(*) as count FROM tbl_users"
    );
    const total = countRow?.count || 0;

    const users = await db.queryAll(
      `SELECT ${USER_SAFE_COLUMNS} FROM tbl_users ORDER BY id DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      users: stripSensitiveList(users),
      ...paginatedResponse(users, total, page, limit).pagination && {
        pagination: paginatedResponse(users, total, page, limit).pagination,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const toggleUserActiveStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { is_active } = req.body;

    if (is_active !== 0 && is_active !== 1) {
      return res
        .status(400)
        .json({ message: "Invalid value for is_active. It must be 0 or 1." });
    }

    const updatedFields =
      is_active === 0
        ? {
            is_active,
            subscription_type: null,
            subscription_status: null,
            subscription_start_date: null,
            subscription_end_date: null,
          }
        : { is_active };

    const result = await db.update(
      "tbl_users",
      updatedFields,
      "id = ?",
      [userId]
    );

    if (result.affected_rows === 0) {
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

    if (!email || !name || !subscription_type || !start_date) {
      return res.status(400).json({
        message: "Email, Name, Subscription Type, and Start Date are required",
      });
    }

    const validTypes = ["monthly", "6-months"];
    if (!validTypes.includes(subscription_type)) {
      return res.status(400).json({ message: "Invalid subscription type" });
    }

    const existingUser = await db.select("tbl_users", "id", "email = ?", [
      email,
    ]);
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+";
    let password = "";
    for (let i = 0; i < 12; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const startDate = new Date(start_date);
    startDate.setHours(0, 0, 0, 0);

    const trialEndDate = addDays(startDate, 7);
    const subscriptionStartDate = addDays(trialEndDate, 1);
    const subscriptionEndDate =
      subscription_type === "monthly"
        ? addMonths(subscriptionStartDate, 1)
        : addMonths(subscriptionStartDate, 6);

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

    await sendCredentialsEmail(name, email, password);

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
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Email already exists" });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const checkTrialExpirations = async () => {
  try {
    const today = format(new Date(), "yyyy-MM-dd");

    await db.queryAll(
      `UPDATE tbl_users
       SET is_active = 0, subscription_status = 'expired', updated_at = NOW()
       WHERE trial_end_date <= ? AND subscription_status = 'trial'`,
      [today]
    );
  } catch (err) {
    console.error("Error in checkTrialExpirations:", err);
  }
};

const updateUser = async (req, res) => {
  try {
    const { email, subscription_type, start_date } = req.body;

    if (!email || !subscription_type) {
      return res
        .status(400)
        .json({ message: "Email and subscription type are required" });
    }

    const validTypes = ["monthly", "6-months"];
    if (!validTypes.includes(subscription_type)) {
      return res.status(400).json({ message: "Invalid subscription type" });
    }

    const user = await db.select("tbl_users", "*", "email = ?", [email]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const startDate = start_date ? new Date(start_date) : new Date();
    startDate.setHours(0, 0, 0, 0);

    const trialEndDate = addDays(startDate, 7);
    const subscriptionStartDate = addDays(trialEndDate, 1);
    const subscriptionEndDate =
      subscription_type === "monthly"
        ? addMonths(subscriptionStartDate, 1)
        : addMonths(subscriptionStartDate, 6);

    const subscriptionStatus = user.is_active === 0 ? "active" : "trial";

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
      "email = ?",
      [email]
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

const getFreeUserCount = async (req, res) => {
  try {
    const result = await db.queryOne(
      "SELECT COUNT(*) as count FROM tbl_users WHERE is_free_user = 1"
    );
    const freeUserCount = result?.count || 0;
    const remainingSlots = Math.max(0, 2000 - freeUserCount);

    res.json({
      message: "Free user count retrieved",
      free_user_count: freeUserCount,
      total_slots: 2000,
      remaining_slots: remainingSlots,
      percentage_filled: ((freeUserCount / 2000) * 100).toFixed(2),
    });
  } catch (error) {
    console.error("Error fetching free user count:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getUserLoginStats = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { page, limit, offset } = parsePagination(req.query, {
      defaultLimit: 50,
    });

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const countRow = await db.queryOne(
      "SELECT COUNT(*) as count FROM tbl_login_activity WHERE user_id = ?",
      [userId]
    );
    const total = countRow?.count || 0;

    const stats = await db.queryAll(
      `SELECT * FROM tbl_login_activity
       WHERE user_id = ?
       ORDER BY login_time DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );

    const statsWithDuration = stats.map((stat) => {
      let duration = null;
      if (stat.login_time && stat.logout_time) {
        const loginTime = new Date(stat.login_time);
        const logoutTime = new Date(stat.logout_time);
        duration = Math.round((logoutTime - loginTime) / 1000 / 60);
      }
      return {
        ...stat,
        session_duration_minutes: duration,
      };
    });

    res.json({
      message: "User login statistics retrieved",
      user_id: userId,
      total_sessions: total,
      stats: statsWithDuration,
      pagination: paginatedResponse(statsWithDuration, total, page, limit)
        .pagination,
    });
  } catch (err) {
    console.error("Error fetching user login stats:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getOverallStats = async (req, res) => {
  try {
    const totalRow = await db.queryOne(
      "SELECT COUNT(*) as count FROM tbl_users"
    );
    const total = totalRow?.count || 0;

    const freeRow = await db.queryOne(
      "SELECT COUNT(*) as count FROM tbl_users WHERE is_free_user = 1"
    );
    const freeCount = freeRow?.count || 0;
    const paidCount = total - freeCount;

    const today = new Date().toISOString().split("T")[0];
    const todayRow = await db.queryOne(
      "SELECT COUNT(*) as count FROM tbl_login_activity WHERE login_date = ?",
      [today]
    );
    const todayLoginCount = todayRow?.count || 0;

    const avgRow = await db.queryOne(
      `SELECT AVG(TIMESTAMPDIFF(MINUTE, login_time, logout_time)) as avg_duration
       FROM tbl_login_activity WHERE logout_time IS NOT NULL`
    );
    const avgDuration = avgRow?.avg_duration
      ? Math.round(avgRow.avg_duration)
      : 0;

    res.json({
      message: "Overall statistics retrieved",
      statistics: {
        total_users: total,
        free_users: freeCount,
        paid_users: paidCount,
        free_user_slots_remaining: Math.max(0, 2000 - freeCount),
        today_logins: todayLoginCount,
        average_session_duration_minutes: avgDuration,
        free_user_percentage: ((freeCount / 2000) * 100).toFixed(2),
      },
    });
  } catch (error) {
    console.error("Error fetching overall stats:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getSupportTickets = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const countRow = await db.queryOne(
      "SELECT COUNT(*) as count FROM tbl_support_tickets"
    );
    const total = countRow?.count || 0;

    const tickets = await db.queryAll(
      `SELECT * FROM tbl_support_tickets ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      tickets,
      pagination: paginatedResponse(tickets, total, page, limit).pagination,
    });
  } catch (error) {
    console.error("Error fetching support tickets:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const getFeedback = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);

    const countRow = await db.queryOne(
      "SELECT COUNT(*) as count FROM tbl_feedback"
    );
    const total = countRow?.count || 0;

    const feedback = await db.queryAll(
      `SELECT * FROM tbl_feedback ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    res.json({
      feedback,
      pagination: paginatedResponse(feedback, total, page, limit).pagination,
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    res.status(500).json({ message: "Internal Server Error" });
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
  getFreeUserCount,
  getUserLoginStats,
  getOverallStats,
  getSupportTickets,
  getFeedback,
};
