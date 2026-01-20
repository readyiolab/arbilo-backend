const db = require('../config/db_settings');

exports.createSupportTicket = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        if (!subject || !message) {
            return res.status(400).json({ success: false, message: 'Subject and message are required' });
        }

        const data = {
            name: name || 'Anonymous',
            email: email || '',
            subject,
            message,
            status: 'open',
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };

        const result = await db.insert('tbl_support_tickets', data);

        if (result.status) {
            res.status(201).json({ success: true, message: 'Support ticket created', id: result.insertId });
        } else {
            res.status(500).json({ success: false, message: 'Failed to create ticket' });
        }
    } catch (error) {
        console.error('Create Ticket Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.createFeedback = async (req, res) => {
    try {
        const { name, email, rating, message } = req.body;

        if (!rating || !message) {
            return res.status(400).json({ success: false, message: 'Rating and message are required' });
        }

        const data = {
            name: name || 'Anonymous',
            email: email || '',
            rating,
            message,
            created_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
        };

        const result = await db.insert('tbl_feedback', data);

        if (result.status) {
            res.status(201).json({ success: true, message: 'Feedback submitted', id: result.insertId });
        } else {
            res.status(500).json({ success: false, message: 'Failed to submit feedback' });
        }
    } catch (error) {
        console.error('Create Feedback Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
