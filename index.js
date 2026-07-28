const express = require("express");
const cors = require("cors");
const http = require("http");
const helmet = require("helmet");
const compression = require("compression");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const arbitrageRoutes = require("./routes/arbitrageRoutes");
const spotFuturesRoutes = require("./routes/spotFuturesRoutes");
const blogRoutes = require("./routes/blogRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const commonRoutes = require("./routes/commonRoutes");
const db = require("./config/db_settings");
const { checkTrialExpirations } = require("./controllers/adminController");

const initDb = async () => {
  try {
    await db.queryAll(`
      CREATE TABLE IF NOT EXISTS tbl_support_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        subject VARCHAR(255),
        message TEXT,
        status VARCHAR(50) DEFAULT 'open',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.queryAll(`
      CREATE TABLE IF NOT EXISTS tbl_feedback (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255),
        email VARCHAR(255),
        rating INT,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Support and Feedback tables checked/created");
  } catch (error) {
    console.error("Error initializing DB tables:", error.message);
  }
};

initDb();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

const allowedOrigins = [
  "https://arbilo.com",
  "https://www.arbilo.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
];

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "unsafe-none" },
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false,
  })
);
app.use(compression());

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("CORS blocked origin:", origin);
        callback(new Error("CORS not allowed"));
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    allowedHeaders:
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    credentials: true,
  })
);

app.options("*", cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.get("/api/health", async (req, res) => {
  try {
    await db.queryOne("SELECT 1 as ok");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "degraded", error: "database unavailable" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/arbitrage", arbitrageRoutes);
app.use("/api/spot-futures", spotFuturesRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api", commonRoutes);

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  const status = err.message === "CORS not allowed" ? 403 : 500;
  res.status(status).json({
    message: status === 403 ? "CORS not allowed" : "Internal server error",
  });
});

// Daily trial expiration check (runs every 24h after start)
checkTrialExpirations().catch(() => {});
setInterval(() => {
  checkTrialExpirations().catch((err) =>
    console.error("Trial expiration check failed:", err.message)
  );
}, 24 * 60 * 60 * 1000);

const shutdown = async (signal) => {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    try {
      await db.end();
    } catch (_) {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
