const db = require("../config/db_settings");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require('google-auth-library');
const transporter = require('../services/mailer');
const {
  sendPasswordChangeNotification,
  sendWelcomeEmail,
  sendContactUsNotification,
} = require("../services/emailService");
const { jwtSecret } = require('../config/dotenvConfig');
require("dotenv").config();

// Secret for JWT
const JWT_SECRET = jwtSecret;

// Google OAuth2 Client
const googleClient = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.NODE_ENV === 'production'
    ? process.env.GOOGLE_REDIRECT_URI_PROD
    : process.env.GOOGLE_REDIRECT_URI_DEV,
});

// User Signup (Regular Email/Password)
const signup = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await db.select("tbl_users", "*", "email = ?", [normalizedEmail]);
    if (existingUser) {
      return res.status(400).json({ message: "Email is already registered. Please log in." });
    }

    // Check if free user limit (2000 users) has been reached
    const result = await db.selectAll("tbl_users", "COUNT(*) as count", "");
    const userCount = result.length > 0 ? result[0].count : 0;
    
    if (userCount >= 2000) {
      return res.status(400).json({ 
        message: "Free user limit reached (2000 users). Please check back later for updates.",
        limitReached: true 
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new user into the database
    const newUser = await db.insert("tbl_users", {
      name,
      email: normalizedEmail,
      password: hashedPassword,
      is_active: 1,
      is_verified: 1,
      is_free_user: 1,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    });

    // Send welcome email
    await sendWelcomeEmail(name, normalizedEmail);

    res.status(201).json({ 
      message: "User registered successfully! Welcome to Arbilo - Your free access is ready.",
      is_free_user: true
    });
  } catch (err) {
    console.error("Signup error:", err.stack);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Email is already registered. Please log in." });
    }
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// User Login (Email/Password)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    const user = await db.select("tbl_users", "*", "email = ?", [normalizedEmail]);
    
    if (!user) {
      return res.status(400).json({ message: "User not registered" });
    }

    // Check if user is a Google OAuth user
    if (user.google_id) {
      return res.status(400).json({ message: "Please use Google login for this account" });
    }

    // Check password
    if (!user.password) {
      return res.status(400).json({ message: "No password set for this account. Please use Google login." });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: "Password incorrect" });
    }

    // Generate a new session token
    const sessionToken = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "2d" }
    );

    // Update the user's session token in the database
    await db.update(
      "tbl_users",
      { session_token: sessionToken },
      "id = ?",
      [user.id]
    );

    // Capture the user's IP address
    const ipAddress =
      req.headers["x-forwarded-for"] || req.connection.remoteAddress;

    // Store the login activity in the database with login time
    const loginTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.insert("tbl_login_activity", {
      user_id: user.id,
      ip_address: ipAddress,
      login_time: loginTime,
      login_date: new Date().toISOString().split('T')[0],
    });

    // Return the session token and user data in the response
    res.json({
      message: "Login successful",
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_active: user.is_active,
        is_verified: user.is_verified,
        is_free_user: user.is_free_user || 0
      }
    });
  } catch (err) {
    console.error("Login error:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Google OAuth Login
const googleLogin = async (req, res) => {
  try {
    console.log('Google login request received:', req.body);
    
    const { token } = req.body;

    if (!token) {
      console.error('No token provided in request');
      return res.status(400).json({ message: "Token is required" });
    }

    // Verify Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log('Google payload:', payload);

    const { email, name, sub: googleId } = payload;

    if (!email || !name) {
      console.error('Missing email or name in Google payload');
      return res.status(400).json({ message: "Invalid Google token payload" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    let user = await db.select("tbl_users", "*", "email = ?", [normalizedEmail]);

    if (!user) {
      // Check if free user limit (2000 users) has been reached
      const result = await db.selectAll("tbl_users", "COUNT(*) as count", "");
      const userCount = result.length > 0 ? result[0].count : 0;
      
      if (userCount >= 2000) {
        return res.status(400).json({ 
          message: "Free user limit reached (2000 users). Please check back later for updates.",
          limitReached: true 
        });
      }

      console.log('Creating new user for:', normalizedEmail);
      // Create new user
      const newUserData = {
        name,
        email: normalizedEmail,
        password: null, // Password is null for Google users
        is_active: 1,
        is_verified: 1,
        is_free_user: 1,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        google_id: googleId,
        session_token: null,
      };

      await db.insert("tbl_users", newUserData);

      // Fetch the newly created user
      user = await db.select("tbl_users", "*", "email = ?", [normalizedEmail]);
      
      if (!user) {
        throw new Error('Failed to create new user');
      }

      await sendWelcomeEmail(name, normalizedEmail);
    } else if (!user.google_id) {
      // Link Google ID to existing user (optional, based on your requirements)
      await db.update(
        "tbl_users",
        { google_id: googleId },
        "id = ?",
        [user.id]
      );
      user.google_id = googleId;
    }

    // Generate JWT token
    const sessionToken = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "2d" }
    );

    // Update session token
    await db.update(
      "tbl_users",
      { session_token: sessionToken },
      "id = ?",
      [user.id]
    );

    // Log login activity with session time tracking
    const ipAddress = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    const loginTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await db.insert("tbl_login_activity", {
      user_id: user.id,
      ip_address: ipAddress,
      login_time: loginTime,
      login_date: new Date().toISOString().split('T')[0],
    });

    console.log('Google login successful for user:', user.id);

    res.json({
      message: "Google login successful",
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_active: user.is_active,
        is_verified: user.is_verified,
        is_free_user: user.is_free_user || 1
      }
    });
  } catch (err) {
    console.error("Google login error:", err.stack);
    if (err.code === "ER_BAD_NULL_ERROR") {
      return res.status(500).json({
        message: "Database error: Password column cannot be null. Please contact support."
      });
    }
    res.status(500).json({ 
      message: "Failed to process Google login",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Get User Profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      console.error("User ID not found in request");
      return res.status(400).json({ error: "User not authenticated" });
    }

    const userData = await db.select(
      "tbl_users",
      "*",
      "id = ?",
      [userId]
    );

    if (!userData) {
      console.error("No user data found for User ID:", userId);
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({ userData });
  } catch (error) {
    console.error("Error fetching user data:", error.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Forgot Password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await db.select("tbl_users", "*", "email = ?", [email]);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.google_id) {
      return res.status(400).json({ message: "This account uses Google login. Please use Google to sign in." });
    }

    const resetToken = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: "5m" }
    );

    const resetLink = `https://arbilo.com/reset-password/${resetToken}`;

    await transporter.sendMail({
      from: `"Arbilo Password Reset" <hello@arbilo.com>`,
      to: email,
      subject: "Password Reset",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f7f7f7; padding: 20px;">
          <table align="center" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td align="center" style="background-color: #222222; padding: 20px;">
                <img src="https://res.cloudinary.com/dp50h8gbe/image/upload/v1738745363/gwkvk5vkbzvb5b7hosxj.png" alt="Arbilo Logo" width="120" style="display: block;">
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <p style="font-size: 16px;">Dear ${user.name},</p>
                <p>Click the button below to reset your password. The link will expire in 5 minutes:</p>
                <p style="text-align: center;">
                  <a href="${resetLink}" style="background-color: #4CAF50; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold;">Reset Password</a>
                </p>
                <p>If you didn't request this, please ignore this email.</p>
                <p>Regards,<br>Arbilo</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="background-color: #f1f1f1; padding: 20px;">
                <p>Connect with us:</p>
                <p>
                  <a href="https://www.instagram.com/arbilo01/"><img src="https://img.icons8.com/ios-filled/24/instagram-new.png" alt="Instagram" style="margin: 0 8px;"></a>
                  <a href="https://www.facebook.com/profile.php?id=61576167397019"><img src="https://img.icons8.com/ios-filled/24/facebook.png" alt="Facebook" style="margin: 0 8px;"></a>
                  <a href="https://www.youtube.com/@Arbilo-p2p"><img src="https://img.icons8.com/ios-filled/24/youtube-play.png" alt="YouTube" style="margin: 0 8px;"></a>
                  <a href="https://www.linkedin.com/company/arbilo"><img src="https://img.icons8.com/ios-filled/24/linkedin.png" alt="LinkedIn" style="margin: 0 8px;"></a>
                </p>
              </td>
            </tr>
          </table>
        </div>
      `,
    });

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("Error sending password reset email:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Reset Password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (newPassword.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return res.status(400).json({
          message: "The reset link has expired. Please request a new one.",
        });
      }
      return res.status(400).json({ message: "Invalid or tampered token." });
    }

    const userId = decoded.id;

    const user = await db.select("tbl_users", "*", "id = ?", [userId]);
    if (user.google_id) {
      return res.status(400).json({ message: "This account uses Google login. Please use Google to sign in." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await db.update(
      "tbl_users",
      { password: hashedPassword },
      "id = ?",
      [userId]
    );

    if (result.affected_rows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Reset password error:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Update User Name
const updateUserName = async (req, res) => {
  try {
    const userId = req.userId;
    const { newName } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!newName || newName.trim() === "") {
      return res.status(400).json({ message: "New name cannot be empty" });
    }

    const result = await db.update("tbl_users", { name: newName }, "id = ?", [userId]);

    if (result.affected_rows === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "Name updated successfully", newName });
  } catch (err) {
    console.error("Error during name update:", err.stack);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// Change Password
const changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!userId) {
      console.log("No userId found in request");
      return res.status(400).json({ message: "User not authenticated" });
    }

    if (newPassword !== confirmPassword) {
      console.log("Password mismatch");
      return res.status(400).json({ message: "New passwords do not match" });
    }

    const user = await db.select("tbl_users", "*", "id = ?", [userId]);

    if (!user) {
      console.log("No user found with ID:", userId);
      return res.status(404).json({ message: "User not found" });
    }

    if (user.google_id) {
      return res.status(400).json({ message: "This account uses Google login. Please use Google to sign in." });
    }

    if (!user.password) {
      return res.status(400).json({ message: "No password set for this account. Please use Google login." });
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await db.update(
      "tbl_users",
      { password: hashedPassword },
      "id = ?",
      [userId]
    );

    if (result.affected_rows === 0) {
      console.log("Update failed - no rows affected");
      return res.status(404).json({ message: "User not found" });
    }

    await sendPasswordChangeNotification(user.name, user.email);

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("Error in changePassword:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Contact Us
const contactUs = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    await db.insert("tbl_contact_us", {
      name,
      email: normalizedEmail,
      message,
    });

    await sendContactUsNotification(name, email, message);

    res.status(201).json({
      message: "Your message has been received. We'll get back to you shortly!"
    });
  } catch (err) {
    console.error("Contact us error:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// User Logout - Track session duration
const logout = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ message: "User not authenticated" });
    }

    const logoutTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Get the last login activity for this user today
    const today = new Date().toISOString().split('T')[0];
    const lastActivity = await db.select(
      "tbl_login_activity",
      "*",
      "user_id = ? AND login_date = ? ORDER BY id DESC LIMIT 1",
      [userId, today]
    );

    if (lastActivity) {
      // Update the last login activity with logout time
      await db.update(
        "tbl_login_activity",
        { logout_time: logoutTime },
        "id = ?",
        [lastActivity.id]
      );
    }

    // Clear session token
    await db.update(
      "tbl_users",
      { session_token: null },
      "id = ?",
      [userId]
    );

    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get user login statistics
const getLoginStats = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(400).json({ message: "User not authenticated" });
    }

    // Get login statistics for the user
    const stats = await db.selectAll(
      "tbl_login_activity",
      "*",
      "user_id = ?",
      [userId],
      "login_time DESC"
    );

    // Calculate session durations
    const statsWithDuration = stats.map(stat => {
      let duration = null;
      if (stat.login_time && stat.logout_time) {
        const loginTime = new Date(stat.login_time);
        const logoutTime = new Date(stat.logout_time);
        duration = Math.round((logoutTime - loginTime) / 1000 / 60); // Duration in minutes
      }
      return {
        ...stat,
        session_duration_minutes: duration
      };
    });

    res.json({
      message: "Login statistics retrieved",
      stats: statsWithDuration
    });
  } catch (err) {
    console.error("Error fetching login stats:", err.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
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
};