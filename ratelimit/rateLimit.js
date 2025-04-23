const rateLimit = require("express-rate-limit");

// Rate limiter for signup (limits to 5 requests per hour)
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 signup requests per hour
  message: { message: "Too many signup attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for login (limits to 10 requests per 15 minutes)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per 15 minutes
  message: { message: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { signupLimiter, loginLimiter };
