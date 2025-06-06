
const transporter = require("./mailer")





const sendWelcomeEmail = async (name, email) => {
  try {
    const mailOptions = {
      from: '"Arbilo" <hello@arbilo.com>', // Sender email
      to: `"${name}" <${email}>`, // Ensure name is included properly
      subject: "Welcome to Arbilo! 🚀",
      html: `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Arbilo</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8f8f8; font-family: Arial, sans-serif; color: #333;">
        <table width="100%" bgcolor="#f8f8f8" cellpadding="0" cellspacing="0">
            <tr>
                <td align="center">
                    <table width="600" bgcolor="#ffffff" cellpadding="0" cellspacing="0" style="border-radius: 8px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);">
                        <tr>
                            <td align="center" bgcolor="#222222" style="padding: 20px;">
                                <img src="https://res.cloudinary.com/dp50h8gbe/image/upload/v1738745363/gwkvk5vkbzvb5b7hosxj.png" alt="Arbilo Logo" width="120" style="display: block;">
                            </td>
                        </tr>
                        <tr>
                            <td align="center" bgcolor="#222222" style="padding: 20px; color: #ffffff; font-size: 24px; font-weight: bold;">
                                Welcome to Arbilo, ${name}!
                            </td>
                        </tr>
                        <tr>
                            <td align="center" style="padding: 30px; color: #444; font-size: 16px;">
                                <p>Dear <strong>${name}</strong>,</p>
                                <p>We’re thrilled to have you onboard! Get ready to explore real-time arbitrage signals and premium features.</p>
                                <p>Click the button below to log in and start your journey:</p>
                                <a href="https://arbilo.com/login" style="display: inline-block; background-color: #222222; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-size: 16px; margin-top: 20px; font-weight: bold;">Get Started</a>
                            </td>
                        </tr>
                        <tr>
                            <td align="center" bgcolor="#eeeeee" style="padding: 15px; font-size: 14px; color: #555;">
                                <p><strong>Stay Connected</strong></p>
                                <table cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td><a href="https://facebook.com/yourpage"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="30" alt="Facebook"></a></td>
                                        <td width="15"></td>
                                        <td><a href="https://twitter.com/yourpage"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="30" alt="Twitter"></a></td>
                                        <td width="15"></td>
                                        <td><a href="https://instagram.com/yourpage"><img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" width="30" alt="Instagram"></a></td>
                                    </tr>
                                </table>
                                <p style="margin-top: 15px;">&copy; 2025 Arbilo. All rights reserved.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>`,
    };

    await transporter.sendMail(mailOptions);
    console.log("Welcome email sent successfully");
  } catch (err) {
    console.error("Error sending welcome email:", err);
    throw new Error("Failed to send welcome email");
  }
};


// Function to send password change notification email
const sendPasswordChangeNotification = async (name, email) => {
  try {
    const mailOptions = {
      from: '"Arbilo" <hello@arbilo.com>',
      to: email,
      subject: "Your Password Has Been Changed Successfully",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f7f7f7; padding: 20px;">
          <table align="center" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td align="center" style="background-color: #222222; padding: 20px;">
                <img src="https://res.cloudinary.com/dp50h8gbe/image/upload/v1738745363/gwkvk5vkbzvb5b7hosxj.png" alt="Arbilo Logo" width="120" style="display: block;">
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <p>Dear ${name},</p>

                <p>We wanted to inform you that your password has been successfully changed.</p>

                <p>If you did not request this change, please reset your password immediately and contact our support team at <a href="mailto:hello@arbilo.com">hello@arbilo.com</a>.</p>

                <p>Best Regards,<br>The Arbilo Team</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="background-color: #f1f1f1; padding: 20px;">
                <p>Connect with us:</p>
                <p>
                  <a href="https://www.instagram.com/arbilo01/"><img src="https://img.icons8.com/ios-filled/24/instagram-new.png" alt="Instagram" style="margin: 0 8px;"></a>
                  <a href="https://www.facebook.com/profile.php?id=61576167397019"><img src="https://img.icons8.com/ios-filled/24/facebook.png" alt="Facebook" style="margin: 0 8px;"></a>
                  <a href="https://www.youtube.com/@Arbilo-p2p"><img src="https://img.icons8.com/ios-filled/24/youtube-play.png" alt="YouTube" style="margin: 0 8px;"></a>
                  <a href="https://www.linkedin.com/company/arbilo"><img src="https://img.icons8.com/ios-filled/24/linkedin.png" alt="LinkedIn" style="margin: 0 8px;"></a>
                </p>
              </td>
            </tr>
          </table>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log("Password change notification email sent successfully");
  } catch (err) {
    console.error("Error sending password change notification email:", err);
    throw new Error("Failed to send password change notification email");
  }
};


const sendCredentialsEmail = async (name, email, password) => {
  try {
    await transporter.sendMail({
      from: `"Arbilo" <hello@arbilo.com>`,
      to: `"${name}" <${email}>`,
      subject: "Your Arbilo Premium Access is Ready! 🎉",
      html: `
        <div style="font-family: Arial, sans-serif; background-color: #f7f7f7; padding: 20px;">
          <table align="center" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
            <tr>
              <td align="center" style="background-color: #222222; padding: 20px;">
                <img src="https://res.cloudinary.com/dp50h8gbe/image/upload/v1738745363/gwkvk5vkbzvb5b7hosxj.png" alt="Arbilo Logo" width="120" style="display: block;">
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <p>Dear ${name},</p>
                <p>Your Arbilo-Arbitrage Premium Plan access is now fully set up!</p>

                <p><strong>Your Login Credentials:</strong></p>
                <ul>
                  <li><strong>Platform:</strong> <a href="https://arbilo.com">https://arbilo.com</a></li>
                  <li><strong>Email:</strong> ${email}</li>
                  <li><strong>Password:</strong> ${password}</li>
                </ul>

                <p><strong>For security reasons, please change your password after logging in.</strong></p>

                <p><strong>Getting Started:</strong></p>
                <ul>
                  <li>✅ Log in and explore <strong>ArbiPair</strong> and <strong>ArbiTrack</strong></li>
                  <li>✅ Manage your account settings</li>
                </ul>

                <p>If you need help, contact us at <a href="mailto:hello@arbilo.com">hello@arbilo.com</a></p>
                <p>Welcome aboard! 🚀</p>

                <p>Best Regards,<br>The Arbilo Team</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="background-color: #f1f1f1; padding: 20px;">
                <p>Connect with us:</p>
                <p>
                  <a href="https://www.instagram.com/arbilo01/"><img src="https://img.icons8.com/ios-filled/24/instagram-new.png" alt="Instagram" style="margin: 0 8px;"></a>
                  <a href="https://www.facebook.com/profile.php?id=61576167397019"><img src="https://img.icons8.com/ios-filled/24/facebook.png" alt="Facebook" style="margin: 0 8px;"></a>
                  <a href="https://www.youtube.com/@Arbilo-p2p"><img src="https://img.icons8.com/ios-filled/24/youtube-play.png" alt="YouTube" style="margin: 0 8px;"></a>
                  <a href="https://www.linkedin.com/company/arbilo"><img src="https://img.icons8.com/ios-filled/24/linkedin.png" alt="LinkedIn" style="margin: 0 8px;"></a>
                </p>
              </td>
            </tr>
          </table>
        </div>
      `,
    });
  } catch (err) {
    console.error("Error sending credentials email:", err);
    throw err;
  }
};



const sendContactUsNotification = async (name, email, message) => {
  try {
   

    const adminEmail = "hello@arbilo.com"; // Admin's receiving email
    const subject = "New Contact Us Message";
    const text = `
      You have received a new message from the Contact Us form:

      Name: ${name}
      Email: ${email}
      Message: ${message}
    `;

    await transporter.sendMail({
      from: `"Arbilo Contact Form" <hello@arbilo.com>`, // Use your verified domain email
      to: adminEmail,
      subject: subject,
      text: text,
      replyTo: email, // Allows the admin to reply to the user directly
    });

    console.log("Contact Us notification sent successfully!");
  } catch (err) {
    console.error("Error sending Contact Us notification:", err);
  }
};


module.exports = {
  sendWelcomeEmail,
  sendPasswordChangeNotification,
  sendCredentialsEmail,
  sendContactUsNotification,
};
