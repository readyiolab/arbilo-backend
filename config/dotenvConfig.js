const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  dbHost: process.env.DB_HOST,
  dbUser: process.env.DB_USER,
  dbPass: process.env.DB_PASS,
  dbName: process.env.DB_NAME,
  jwtSecret: process.env.JWT_SECRET,
  jwtSignupSecret: process.env.JWT_SIGNUP_SECRET,
  jwtLoginSecret: process.env.JWT_LOGIN_SECRET,
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT,
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  cryptoPanicKey:process.env.CRYPTO_PANIC_API_KEY,
  newsApiKey:process.env.NEWSAPI_KEY
};
