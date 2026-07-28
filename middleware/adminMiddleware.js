const jwt = require("jsonwebtoken");
const db = require("../config/db_settings");
const { jwtSecret } = require("../config/dotenvConfig");

const adminAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, jwtSecret);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: "Invalid token structure" });
    }

    const admin = await db.select(
      "tbl_admins",
      "id, name, email, session_token, created_at",
      "id = ?",
      [decoded.id]
    );

    if (!admin) {
      return res.status(401).json({ message: "Admin not found" });
    }

    if (!admin.session_token || admin.session_token !== token) {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }

    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token is not valid" });
  }
};

module.exports = adminAuthMiddleware;
