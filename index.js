const express = require("express");
const cors = require("cors");

const adminRoutes = require("./routes/adminRoutes");
const authRoutes = require("./routes/authRoutes");
const arbitrageRoutes = require("./routes/arbitrageRoutes");


const app = express();
const port = 5000;

// Allowed origins
const allowedOrigins = [
  "https://arbilo.com",
  "https://www.arbilo.com",
  "http://localhost:5173", // Allow local development
];

// CORS Middleware
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    credentials: true,
  })
);

// Allow preflight OPTIONS requests for all routes
app.options("*", cors());

// Middleware
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/arbitrage", arbitrageRoutes);


// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
