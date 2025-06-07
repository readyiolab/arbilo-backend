
// app.js
const express = require('express');
const cors = require('cors');
const http = require('http');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const arbitrageRoutes = require('./routes/arbitrageRoutes');
const blogRoutes = require('./routes/blogRoutes');
const newsletterRoutes = require("./routes/newsletterRoutes");
const { sendTrialReminder, updateSubscriptionStatuses } = require('./services/cronJobs')
const app = express();
const server = http.createServer(app);
const port = 5000;

const allowedOrigins = [
    'https://arbilo.com',
    'https://www.arbilo.com',
    'http://localhost:5174'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed'));
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    credentials: true
}));

app.options('*', cors());

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/arbitrage', arbitrageRoutes);
app.use('/api/blogs', blogRoutes);
app.use("/api/newsletter", newsletterRoutes);


// Initialize cron jobs (they start automatically)
console.log('Cron jobs initialized');

server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});