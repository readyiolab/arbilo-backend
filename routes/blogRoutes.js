const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image uploads are allowed'));
    }
  },
});
const { createBlog, updateBlog, deleteBlog, getAllBlogs, getBlogById, likeBlog, shareBlog, addComment, getComments } = require('../controllers/blogController');
const adminMiddleware = require('../middleware/adminMiddleware');

router.post('/', adminMiddleware, upload.single('image'), createBlog);
router.put('/:id', adminMiddleware, upload.single('image'), updateBlog);
router.delete('/:id', adminMiddleware, deleteBlog);

router.get('/', getAllBlogs);
router.get('/:id', getBlogById);
router.post('/:id/like', likeBlog);
router.post('/:id/share', shareBlog);
router.post('/:id/comment', addComment);
router.get('/:id/comments', getComments);

module.exports = router;
