const express = require("express");
const cors = require("cors");
const http = require("http");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const arbitrageRoutes = require("./routes/arbitrageRoutes");
const blogRoutes = require("./routes/blogRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");


const app = express();
const server = http.createServer(app);
const port = 6000;

const allowedOrigins = [
  "https://arbilo.com",
  "https://www.arbilo.com",
  "http://localhost:5174",
  "http://localhost:3000",
];

// CORS configuration
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

// Security headers - UPDATED for Google OAuth
app.use((req, res, next) => {
  // Remove or modify these headers that are causing COOP issues
  res.removeHeader("Cross-Origin-Opener-Policy");
  res.removeHeader("Cross-Origin-Embedder-Policy");

  // Set more permissive headers for Google OAuth
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");

  next();
});

app.options("*", cors());
app.use(express.json({ limit: "10mb" }));

// Add request logging middleware
app.use((req, res, next) => {
  if (req.path.includes("/api/auth/google")) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    console.log("Request body:", req.body);
    console.log("Request headers:", req.headers);
  }
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/arbitrage", arbitrageRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/newsletter", newsletterRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res
    .status(500)
    .json({ message: "Internal server error", error: err.message });
});

// Initialize cron jobs
console.log("Cron jobs initialized");

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
