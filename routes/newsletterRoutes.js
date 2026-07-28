const express = require("express");
const router = express.Router();
const {
  subscribeNewsletter,
  confirmSubscription,
  unsubscribeNewsletter,
  getAllSubscribers,
  toggleSubscriberActiveStatus,
  sendNewsletter,
  uploadImage
} = require("../controllers/newsletterController");
const adminAuthMiddleware = require("../middleware/adminMiddleware");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, or WEBP uploads are allowed"));
    }
  },
});

router.post("/subscribe", subscribeNewsletter);
router.get("/confirm", confirmSubscription);
router.get("/unsubscribe", unsubscribeNewsletter);
router.get("/subscribers", adminAuthMiddleware, getAllSubscribers);
router.patch("/subscribers/:subscriberId/toggle", adminAuthMiddleware, toggleSubscriberActiveStatus);
router.post("/send", adminAuthMiddleware, sendNewsletter);
router.post("/upload-image", adminAuthMiddleware, upload.single("image"), uploadImage);

module.exports = router;
