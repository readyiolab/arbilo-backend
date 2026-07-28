const jwt = require("jsonwebtoken");
const db = require("../config/db_settings");
const {
  jwtSecret,
  jwtSignupSecret,
  jwtLoginSecret,
} = require("../config/dotenvConfig");

function verifyWithSecrets(token) {
  const secrets = [jwtSecret, jwtLoginSecret, jwtSignupSecret].filter(Boolean);
  let lastError;
  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("Invalid token");
}

const authMiddleware = async (req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization token is required" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decodedToken = verifyWithSecrets(token);
    const userId = decodedToken.id || decodedToken.userId;

    if (!userId) {
      return res.status(401).json({ error: "Invalid token structure" });
    }

    const user = await db.select(
      "tbl_users",
      "id, email, session_token, is_active",
      "id = ?",
      [userId]
    );

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.is_active === 0) {
      return res.status(403).json({ error: "Account is inactive" });
    }

    // Invalidate sessions after logout (session_token cleared)
    if (!user.session_token || user.session_token !== token) {
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
