const jwt = require("jsonwebtoken");
const { jwtSignupSecret, jwtLoginSecret } = require("../config/dotenvConfig");

const authMiddleware = (req, res, next) => {
  const authHeader = req.header("Authorization");
  console.log("Authorization Header:", authHeader);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.error("Missing or invalid Authorization header");
    return res.status(401).json({ error: "Authorization token is required" });
  }

  const token = authHeader.split(" ")[1];
  console.log("Extracted Token:", token);

  try {
    let decodedToken;
    let source;

    try {
      decodedToken = jwt.verify(token, jwtSignupSecret);
      source = "signup";
    } catch (signupErr) {
      console.warn("Signup token verification failed, trying login secret...");
      decodedToken = jwt.verify(token, jwtLoginSecret);
      source = "login";
    }

    console.log("Decoded Token:", decodedToken);
    console.log("Token Source:", source);

    req.userId = decodedToken.id || decodedToken.userId;
    req.tokenSource = source;

    next();
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

module.exports = authMiddleware;
