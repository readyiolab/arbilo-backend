const express = require('express');
  const router = express.Router();
  const multer = require('multer');
  const upload = multer({ storage: multer.memoryStorage() });
  const { createBlog, updateBlog, deleteBlog, getAllBlogs, getBlogById, likeBlog, shareBlog, addComment, getComments } = require('../controllers/blogController');
  const adminMiddleware = require('../middleware/adminMiddleware');

  // Admin-only routes
  router.post('/', adminMiddleware, upload.single('image'), createBlog);
  router.put('/:id', adminMiddleware, upload.single('image'), updateBlog);
  router.delete('/:id', adminMiddleware, deleteBlog);

  // Public routes
  router.get('/', getAllBlogs);
  router.get('/:id', getBlogById);
  router.post('/:id/like', likeBlog);
  router.post('/:id/share', shareBlog);
  router.post('/:id/comment', addComment);
  router.get('/:id/comments', getComments);

  module.exports = router;