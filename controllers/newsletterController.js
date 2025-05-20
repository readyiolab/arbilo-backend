const db = require("../config/db_settings");
const { v4: uuidv4 } = require("uuid");
const transporter = require("../services/mailer");
const { body, validationResult } = require("express-validator");
const sanitizeHtml = require("sanitize-html");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const spacesClient = require("../config/spacesConfig");
const path = require("path");
const { doSpaceBucket, doSpaceRegion } = require("../config/dotenvConfig");

// Subscribe to Newsletter
const subscribeNewsletter = async (req, res) => {
  try {
    await body("email")
      .isEmail()
      .withMessage("Please enter a valid email address")
      .run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    const existingSubscriber = await db.select(
      "tbl_newsletter_subscribers",
      "*",
      `email='${email}'`
    );

    if (existingSubscriber) {
      if (existingSubscriber.is_active) {
        return res.status(400).json({ message: "Email is already subscribed" });
      }
      const subscriptionToken = uuidv4();
      const unsubscribeToken = uuidv4();

      await db.update(
        "tbl_newsletter_subscribers",
        {
          subscription_token: subscriptionToken,
          unsubscribe_token: unsubscribeToken,
          subscribed_at: new Date(),
        },
        `id=${existingSubscriber.id}`
      );

      const confirmationLink = `https://arbilo.com/newsletter/confirm?token=${subscriptionToken}`;
      await transporter.sendMail({
        from: '"Arbilo" <hello@arbilo.com>',
        to: email,
        subject: "Confirm Your Arbilo Newsletter Subscription",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Confirm Your Subscription</title>
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
                        Confirm Your Subscription
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 30px; color: #444; font-size: 16px;">
                        <p>Thank you for subscribing to the Arbilo Newsletter!</p>
                        <p>Please click the button below to confirm your subscription:</p>
                        <a href="${confirmationLink}" style="display: inline-block; background-color: #222222; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-size: 16px; margin-top: 20px; font-weight: bold;">Confirm Subscription</a>
                        <p>If you did not request this, please ignore this email.</p>
                      </td>
                    </tr>
                    <tr>
  <td align="center" bgcolor="#eeeeee" style="padding: 15px; font-size: 14px; color: #555;">
    <p><strong>Stay Connected</strong></p>
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <a href="https://www.facebook.com/profile.php?id=61576167397019">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="30" alt="Facebook">
          </a>
        </td>
        <td width="15"></td>
        <td>
          <a href="https://www.youtube.com/@Arbilo-p2p">
            <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" width="30" alt="YouTube">
          </a>
        </td>
        <td width="15"></td>
        <td>
          <a href="https://www.instagram.com/arbilo01/">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" width="30" alt="Instagram">
          </a>
        </td>
        <td width="15"></td>
        <td>
          <a href="https://www.linkedin.com/company/arbilo">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" width="30" alt="LinkedIn">
          </a>
        </td>
      </tr>
    </table>
    <p style="margin-top: 15px;">© 2025 Arbilo. All rights reserved.</p>
  </td>
</tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
      });

      return res.status(201).json({
        message:
          "A new confirmation email has been sent. Please check your email.",
      });
    }

    const subscriptionToken = uuidv4();
    const unsubscribeToken = uuidv4();

    await db.insert("tbl_newsletter_subscribers", {
      email,
      subscription_token: subscriptionToken,
      unsubscribe_token: unsubscribeToken,
      is_active: false,
    });

    const confirmationLink = `https://arbilo.com/newsletter/confirm?token=${subscriptionToken}`;
    await transporter.sendMail({
      from: '"Arbilo" <hello@arbilo.com>',
      to: email,
      subject: "Confirm Your Arbilo Newsletter Subscription",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Confirm Your Subscription</title>
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
                        Confirm Your Subscription
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style="padding: 30px; color: #444; font-size: 16px;">
                        <p>Thank you for subscribing to the Arbilo Newsletter!</p>
                        <p>Please click the button below to confirm your subscription:</p>
                        <a href="${confirmationLink}" style="display: inline-block; background-color: #222222; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-size: 16px; margin-top: 20px; font-weight: bold;">Confirm Subscription</a>
                        <p>If you did not request this, please ignore this email.</p>
                      </td>
                    </tr>
                    <tr>
  <td align="center" bgcolor="#eeeeee" style="padding: 15px; font-size: 14px; color: #555;">
    <p><strong>Stay Connected</strong></p>
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <a href="https://www.facebook.com/profile.php?id=61576167397019">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="30" alt="Facebook">
          </a>
        </td>
        <td width="15"></td>
        <td>
          <a href="https://www.youtube.com/@Arbilo-p2p">
            <img src="https://cdn-icons-png.flaticon.com/512/1384/1384060.png" width="30" alt="YouTube">
          </a>
        </td>
        <td width="15"></td>
        <td>
          <a href="https://www.instagram.com/arbilo01/">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" width="30" alt="Instagram">
          </a>
        </td>
        <td width="15"></td>
        <td>
          <a href="https://www.linkedin.com/company/arbilo">
            <img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" width="30" alt="LinkedIn">
          </a>
        </td>
      </tr>
    </table>
    <p style="margin-top: 15px;">© 2025 Arbilo. All rights reserved.</p>
  </td>
</tr>

                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
    });

    res.status(201).json({
      message: "Subscription request sent. Please check your email to confirm.",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Confirm Subscription
const confirmSubscription = async (req, res) => {
  try {
    const { token } = req.query;
    const subscriber = await db.select(
      "tbl_newsletter_subscribers",
      "*",
      `subscription_token='${token}'`
    );
    if (!subscriber) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    await db.update(
      "tbl_newsletter_subscribers",
      { is_active: true, confirmed_at: new Date() },
      `id=${subscriber.id}`
    );
    res.json({ message: "Subscription confirmed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Unsubscribe from Newsletter
const unsubscribeNewsletter = async (req, res) => {
  try {
    const { token } = req.query;
    const subscriber = await db.select(
      "tbl_newsletter_subscribers",
      "*",
      `unsubscribe_token='${token}'`
    );
    if (!subscriber) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }
    await db.delete("tbl_newsletter_subscribers", `id=${subscriber.id}`);
    await transporter.sendMail({
      from: '"Arbilo" <hello@arbilo.com>',
      to: subscriber.email,
      subject: "Unsubscribed from Arbilo Newsletter",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Unsubscribed</title>
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
                      Unsubscribed Successfully
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 30px; color: #444; font-size: 16px;">
                      <p>You have successfully unsubscribed from the Arbilo Newsletter.</p>
                      <p>If this was a mistake, you can resubscribe at any time:</p>
                      <a href="https://arbilo.com" style="display: inline-block; background-color: #222222; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 5px; font-size: 16px; margin-top: 20px; font-weight: bold;">Resubscribe</a>
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
                      <p style="margin-top: 15px;">© 2025 Arbilo. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });
    res.json({ message: "Unsubscribed successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: Get All Subscribers
const getAllSubscribers = async (req, res) => {
  try {
    const subscribers = await db.selectAll(
      "tbl_newsletter_subscribers",
      "*",
      true
    );
    res.json({ subscribers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: Toggle Subscriber Active Status
const toggleSubscriberActiveStatus = async (req, res) => {
  try {
    const { subscriberId } = req.params;
    const { is_active } = req.body;
    if (is_active !== 0 && is_active !== 1) {
      return res
        .status(400)
        .json({ message: "Invalid value for is_active. It must be 0 or 1." });
    }
    const result = await db.update(
      "tbl_newsletter_subscribers",
      { is_active },
      `id=${subscriberId}`
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Subscriber not found" });
    }
    res.json({ message: "Subscriber active status updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Admin: Upload Image to DigitalOcean Spaces
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    if (![".jpg", ".jpeg", ".png"].includes(fileExtension)) {
      return res
        .status(400)
        .json({ message: "Only JPG, JPEG, or PNG files are allowed" });
    }

    const fileName = `arbilo-newsletter-images/${Date.now()}-${
      req.file.originalname
    }`;
    const bucketName = doSpaceBucket;

    if (!bucketName) {
      return res.status(500).json({ message: "Bucket name not configured" });
    }

    const uploadParams = {
      Bucket: bucketName,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: "public-read",
    };

    await spacesClient.send(new PutObjectCommand(uploadParams));

    const imageUrl = `https://${bucketName}.${doSpaceRegion}.digitaloceanspaces.com/${fileName}`;
    res.json({ url: imageUrl });
  } catch (err) {
    console.error("Upload error:", err);
    res
      .status(500)
      .json({ message: "Failed to upload image", error: err.message });
  }
};

const sendNewsletter = async (req, res) => {
  try {
    await body("subject")
      .notEmpty()
      .withMessage("Subject is required")
      .run(req);
    await body("content")
      .notEmpty()
      .withMessage("Content is required")
      .run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let { subject, content } = req.body;

    // Sanitize HTML content
    content = sanitizeHtml(content, {
      allowedTags: [
        "p",
        "b",
        "i",
        "u",
        "a",
        "img",
        "ul",
        "ol",
        "li",
        "blockquote",
        "h1",
        "h2",
        "h3",
      ],
      allowedAttributes: {
        a: ["href"],
        img: ["src", "alt", "width"],
      },
      transformTags: {
        img: (tagName, attribs) => ({
          tagName,
          attribs: {
            ...attribs,
            alt: attribs.alt || "Newsletter Image",
            width: "600", // Fixed width for compatibility
          },
        }),
      },
    });

    // Move img outside p tags
    content = content.replace(
      /<p>(.*)<img(.*?)>(.*?)<\/p>/g,
      "<p>$1</p><img$2><p>$3</p>"
    );

    console.log("Sanitized content:", content);

    const subscribers = await db.selectAll(
      "tbl_newsletter_subscribers",
      "email, unsubscribe_token",
      "is_active = true"
    );

    if (!subscribers || subscribers.length === 0) {
      return res.status(400).json({ message: "No active subscribers found" });
    }

    const sendPromises = subscribers.map(async (subscriber) => {
      const unsubscribeLink = `https://arbilo.com/newsletter/unsubscribe?token=${subscriber.unsubscribe_token}`;
      const viewInBrowserLink = `https://arbilo.com/newsletter/view?id=${Date.now()}`;
      const emailContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${subject}</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f8f8; font-family: Arial, Helvetica, sans-serif; color: #333;">
          <table width="100%" bgcolor="#f8f8f8" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td align="center" style="padding: 20px 0;">
                <table width="600" bgcolor="#ffffff" cellpadding="0" cellspacing="0" style="border-radius: 8px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td align="right" style="padding: 10px; font-size: 12px; color: #555;">
                      <a href="${viewInBrowserLink}" style="color: #222222; text-decoration: underline;">View in browser</a>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" bgcolor="#222222" style="padding: 20px;">
                      <img src="https://res.cloudinary.com/dp50h8gbe/image/upload/v1738745363/gwkvk5vkbzvb5b7hosxj.png" alt="Arbilo Logo" width="120" style="display: block; max-width: 100%;">
                    </td>
                  </tr>
                  <tr>
                    <td align="center" bgcolor="#222222" style="padding: 15px; color: #ffffff; font-size: 24px; font-weight: bold;">
                      ${subject}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 30px; color: #444; font-size: 16px; line-height: 1.5;">
                      <p style="margin: 0 0 20px;">Having trouble viewing this email? <a href="${viewInBrowserLink}" style="color: #222222;">View it in your browser</a>.</p>
                      <p style="margin: 0 0 20px;">Dear Subscriber,</p>
                      ${content}
                      <p style="margin: 20px 0 0; font-size: 14px; color: #555;">
                        Want to stop receiving these emails? 
                        <a href="${unsubscribeLink}" style="color: #222222; text-decoration: underline;">Unsubscribe</a>
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" bgcolor="#eeeeee" style="padding: 15px; font-size: 14px; color: #555;">
                      <p style="margin: 0 0 10px;"><strong>Stay Connected</strong></p>
                      <table cellpadding="0" cellspacing="0" role="presentation">
                        <tr>
                          <td style="padding: 0 5px;">
                            <a href="https://facebook.com/yourpage"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="30" alt="Facebook" style="display: block;"></a>
                          </td>
                          <td style="padding: 0 5px;">
                            <a href="https://twitter.com/yourpage"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="30" alt="Twitter" style="display: block;"></a>
                          </td>
                          <td style="padding: 0 5px;">
                            <a href="https://instagram.com/yourpage"><img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" width="30" alt="Instagram" style="display: block;"></a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 10px 0 0;">© 2025 Arbilo. All rights reserved.</p>
                      <p style="margin: 5px 0 0;">Arbilo, Your City, Your Country</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      console.log(
        `Sending email to ${subscriber.email} with content:`,
        emailContent
      );

      return transporter.sendMail({
        from: '"Arbilo" <hello@arbilo.com>',
        to: subscriber.email,
        subject,
        html: emailContent,
      });
    });

    await Promise.all(sendPromises);

    res.json({
      message: `Newsletter sent to ${subscribers.length} subscribers`,
    });
  } catch (err) {
    console.error("Newsletter send error:", err);
    res
      .status(500)
      .json({ message: "Failed to send newsletter", error: err.message });
  }
};

module.exports = {
  subscribeNewsletter,
  confirmSubscription,
  unsubscribeNewsletter,
  getAllSubscribers,
  toggleSubscriberActiveStatus,
  uploadImage,
  sendNewsletter,
};
