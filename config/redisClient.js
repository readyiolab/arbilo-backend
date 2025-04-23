const redis = require("redis");
const { redisHost, redisPort } = require("./dotenvConfig");

const client = redis.createClient({
  socket: {
    host: redisHost,
    port: redisPort,
  },
});

client.on("error", (err) => {
  console.error("❌ Redis Connection Error:", err);
});

client.connect()
  .then(() => console.log("✅ Connected to Redis"))
  .catch((err) => console.error("❌ Redis Connection Failed:", err));

module.exports = client;
