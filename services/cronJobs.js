// backend/services/cronJobs.js (add to existing file)
const cron = require('node-cron');
const { format } = require('date-fns');
const db = require('../config/db_settings');
const transporter = require('../services/mailer');

// Existing updateSubscriptionStatuses
const updateSubscriptionStatuses = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const formattedDate = format(today, 'yyyy-MM-dd');

    await db.query(
      `
      UPDATE tbl_users 
      SET is_active = 0,
          subscription_status = 'expired'
      WHERE 
        DATE(trial_end_date) = ? 
        AND subscription_status = 'trial'
        AND is_active = 1
    `,
      [formattedDate]
    );

    await db.query(
      `
      UPDATE tbl_users 
      SET is_active = 1,
          subscription_status = 'active'
      WHERE 
        DATE(subscription_start_date) = ? 
        AND subscription_status = 'pending'
    `,
      [formattedDate]
    );

    await db.query(
      `
      UPDATE tbl_users 
      SET is_active = 0,
          subscription_status = 'expired'
      WHERE 
        DATE(subscription_end_date) < ? 
        AND is_active = 1
    `,
      [formattedDate]
    );

    console.log(`Subscription status check completed for ${formattedDate}`);
  } catch (error) {
    console.error('Error updating subscription statuses:', error);
  }
};

// Existing sendTrialReminder (from above)
const sendTrialReminder = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reminderDate1 = new Date(today);
    reminderDate1.setDate(today.getDate() + 1); // 1 day before
    const reminderDate2 = new Date(today);
    reminderDate2.setDate(today.getDate() + 2); // 2 days before
    const formattedDate1 = format(reminderDate1, 'yyyy-MM-dd');
    const formattedDate2 = format(reminderDate2, 'yyyy-MM-dd');

    const users = await db.query(
      `
      SELECT * FROM tbl_users 
      WHERE trial_end_date IN (?, ?) 
      AND subscription_status = 'trial' 
      AND is_active = 1
    `,
      [formattedDate1, formattedDate2]
    );

    for (const user of users) {
      await transporter.sendMail({
        from: 'hello@arbilo.com',
        to: user.email,
        subject: 'Your Arbilo Trial Ends Soon!',
        html: `
          <h2>Hi ${user.name},</h2>
          <p>Your 7-day free trial ends on ${format(user.trial_end_date, 'yyyy-MM-dd')}. Subscribe to continue accessing premium features:</p>
          <p><a href="https://whop.com/checkout/plan_9RzOL8KjwzHS8/">Monthly ($49)</a></p>
          <p><a href="https://whop.com/checkout/plan_oo91x9FgSm2jL/">6-Month ($249)</a></p>
          <p>After subscribing, our team will update your account within 24 hours.</p>
          <p>Best regards,<br>Arbilo Team</p>
        `,
      });
    }
    console.log(`Trial reminder emails sent for ${formattedDate1} and ${formattedDate2}`);
  } catch (error) {
    console.error('Error sending trial reminder emails:', error);
  }
};

// Schedule cron jobs
cron.schedule('0 0 * * *', updateSubscriptionStatuses); // Run at midnight daily
cron.schedule('0 9 * * *', sendTrialReminder); // Run at 9 AM daily

module.exports = {
  sendTrialReminder,
  updateSubscriptionStatuses,
};