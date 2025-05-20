const db = require("../config/db_settings");
const { body, validationResult } = require("express-validator");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const spacesClient = require("../config/spacesConfig");
const path = require("path");

// Create a new blog post (Admin only)
const createBlog = async (req, res) => {
  try {
    console.log('req.body:', req.body);
    console.log('req.file:', req.file);

    // Parse tags if sent as a JSON string
    if (req.body.tags && typeof req.body.tags === 'string') {
      try {
        req.body.tags = JSON.parse(req.body.tags);
      } catch (err) {
        return res.status(400).json({ errors: [{ msg: 'Tags must be a valid JSON array', path: 'tags' }] });
      }
    }

    // Validate request body
    await body("title").notEmpty().withMessage("Title is required").isLength({ max: 255 }).withMessage("Title must be less than 255 characters").run(req);
    await body("excerpt").notEmpty().withMessage("Excerpt is required").run(req);
    await body("content").notEmpty().withMessage("Content is required").run(req);
    await body("category").notEmpty().withMessage("Category is required").isLength({ max: 50 }).withMessage("Category must be less than 50 characters").run(req);
    await body("author").notEmpty().withMessage("Author is required").isLength({ max: 100 }).withMessage("Author name must be less than 100 characters").run(req);
    await body("author_bio").optional().isLength({ max: 500 }).withMessage("Author bio must be less than 500 characters").run(req);
    await body("status").isIn(["draft", "published"]).withMessage("Status must be either 'draft' or 'published'").run(req);
    await body("read_time").optional().isLength({ max: 20 }).withMessage("Read time must be less than 20 characters").run(req);
    await body("tags").isArray().withMessage("Tags must be an array").run(req);
    await body("is_featured").optional().isBoolean().withMessage("Featured must be a boolean").run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      excerpt,
      content,
      category,
      author,
      author_bio,
      status,
      read_time,
      tags = [],
      is_featured = false,
    } = req.body;

    let imageUrl = null;
    if (req.file) {
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      if (![".jpg", ".jpeg", ".png"].includes(fileExtension)) {
        return res.status(400).json({ message: "Only JPG, JPEG, or PNG files are allowed" });
      }

      const fileName = `blogs/${Date.now()}-${req.file.originalname}`;
      const uploadParams = {
        Bucket: "igrowbig",
        Key: fileName,
        Body: req.file.buffer,
        ACL: "public-read",
        ContentType: req.file.mimetype,
      };

      await spacesClient.send(new PutObjectCommand(uploadParams));
      imageUrl = `https://igrowbig.blr1.digitaloceanspaces.com/${fileName}`;
    }

    const published_at = status === "published" ? new Date() : null;
    const created_at = new Date();
    const updated_at = new Date();

    // Convert is_featured to 0 or 1
    const isFeaturedNumeric = is_featured ? 1 : 0;

    const blog = await db.insert("tbl_blogs", {
      title,
      excerpt,
      content,
      category,
      image: imageUrl,
      author,
      author_bio,
      status,
      read_time,
      tags: JSON.stringify(tags),
      is_featured: isFeaturedNumeric, // Use numeric value
      published_at,
      created_at,
      updated_at,
    });

    console.log('Created blog:', { id: blog.insertId, status });

    // Return a parsed blog object matching getAllBlogs format
    res.status(201).json({
      message: "Blog created successfully",
      blog: {
        id: blog.insertId,
        title,
        excerpt,
        content,
        category,
        image: imageUrl,
        author,
        author_bio,
        status,
        read_time,
        tags,
        is_featured,
        likes: 0,
        shares: 0,
        comments: 0,
        created_at,
        updated_at,
        published_at,
        date: published_at ? published_at.toISOString().split("T")[0] : null,
      },
    });
  } catch (err) {
    console.error('Error in createBlog:', err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
};

// Update an existing blog post (Admin only)
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate request body
    await body("title")
      .optional()
      .isLength({ max: 255 })
      .withMessage("Title must be less than 255 characters")
      .run(req);
    await body("excerpt")
      .optional()
      .notEmpty()
      .withMessage("Excerpt cannot be empty")
      .run(req);
    await body("content")
      .optional()
      .notEmpty()
      .withMessage("Content cannot be empty")
      .run(req);
    await body("category")
      .optional()
      .isLength({ max: 50 })
      .withMessage("Category must be less than 50 characters")
      .run(req);
    await body("author")
      .optional()
      .isLength({ max: 100 })
      .withMessage("Author name must be less than 100 characters")
      .run(req);
    await body("author_bio")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Author bio must be less than 500 characters")
      .run(req);
    await body("status")
      .optional()
      .isIn(["draft", "published"])
      .withMessage("Status must be either 'draft' or 'published'")
      .run(req);
    await body("read_time")
      .optional()
      .isLength({ max: 20 })
      .withMessage("Read time must be less than 20 characters")
      .run(req);
    await body("tags")
      .optional()
      .isArray()
      .withMessage("Tags must be an array")
      .run(req);
    await body("is_featured")
      .optional()
      .isBoolean()
      .withMessage("Featured must be a boolean")
      .run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      excerpt,
      content,
      category,
      author,
      author_bio,
      status,
      read_time,
      tags,
      is_featured,
    } = req.body;

    // Check if blog exists
    const blog = await db.select("tbl_blogs", "*", `id=${id}`);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Handle image upload
    let imageUrl = blog.image;
    if (req.file) {
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      if (![".jpg", ".jpeg", ".png"].includes(fileExtension)) {
        return res
          .status(400)
          .json({ message: "Only JPG, JPEG, or PNG files are allowed" });
      }

      const fileName = `blogs/${Date.now()}-${req.file.originalname}`;
      const uploadParams = {
        Bucket: "igrowbig",
        Key: fileName,
        Body: req.file.buffer,
        ACL: "public-read",
        ContentType: req.file.mimetype,
      };

      await spacesClient.send(new PutObjectCommand(uploadParams));
      imageUrl = `https://igrowbig.blr1.digitaloceanspaces.com/${fileName}`;
    }

    // Prepare update data
    const updateData = {};
    if (title) updateData.title = title;
    if (excerpt) updateData.excerpt = excerpt;
    if (content) updateData.content = content;
    if (category) updateData.category = category;
    if (imageUrl !== blog.image) updateData.image = imageUrl;
    if (author) updateData.author = author;
    if (author_bio) updateData.author_bio = author_bio;
    if (status) {
      updateData.status = status;
      updateData.published_at =
        status === "published" && !blog.published_at
          ? new Date()
          : blog.published_at;
    }
    if (read_time) updateData.read_time = read_time;
    if (tags) updateData.tags = JSON.stringify(tags);
    if (typeof is_featured === "boolean") updateData.is_featured = is_featured;
    updateData.updated_at = new Date();

    // Update blog post
    if (Object.keys(updateData).length > 0) {
      await db.update("tbl_blogs", updateData, `id=${id}`);
      // Fetch updated blog
      const updatedBlog = await db.select("tbl_blogs", "*", `id=${id}`);
      console.log('Updated blog:', { id, status: updatedBlog.status });
      res.json({
        message: "Blog updated successfully",
        blog: {
          ...updatedBlog,
          tags: JSON.parse(updatedBlog.tags || '[]'),
          date: updatedBlog.published_at
            ? updatedBlog.published_at.toISOString().split("T")[0]
            : null,
        },
      });
    } else {
      res.status(400).json({ message: "No data provided for update" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get all blog posts (Public for published, Admin sees all)
const getAllBlogs = async (req, res) => {
  try {
    const isAdmin = !!req.admin; // Check if user is admin
    const whereClause = isAdmin ? "" : "status='published'";

    // Fetch blog posts
    const blogs = await db.selectAll(
      "tbl_blogs",
      "id, title, excerpt, content, category, image, author, author_bio, status, read_time, tags, is_featured, likes, shares, comments, created_at, updated_at, published_at",
      whereClause
    );

    // Parse tags and format date
    const parsedBlogs = blogs.map((blog) => {
      console.log('Blog from getAllBlogs:', { id: blog.id, status: blog.status });
      return {
        ...blog,
        tags: JSON.parse(blog.tags || '[]'),
        date: blog.published_at
          ? blog.published_at.toISOString().split("T")[0]
          : null,
      };
    });

    res.json({ blogs: parsedBlogs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get a specific blog post by ID (Public for published, Admin sees all)
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = !!req.admin;

    // Fetch blog post
    const blog = await db.select(
      "tbl_blogs",
      "id, title, excerpt, content, category, image, author, author_bio, status, read_time, tags, is_featured, likes, shares, comments, created_at, updated_at, published_at",
      `id=${id}`
    );

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Non-admins can only see published blogs
    if (!isAdmin && blog.status !== "published") {
      return res.status(403).json({ message: "Access denied" });
    }

    console.log('Blog from getBlogById:', { id: blog.id, status: blog.status });

    // Parse tags and format date
    const parsedBlog = {
      ...blog,
      tags: JSON.parse(blog.tags || '[]'),
      date: blog.published_at
        ? blog.published_at.toISOString().split("T")[0]
        : null,
    };

    res.json({ blog: parsedBlog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Delete a blog post (Admin only)
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if blog exists
    const blog = await db.select("tbl_blogs", "id", `id=${id}`);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Delete blog post (comments are automatically deleted via ON DELETE CASCADE)
    await db.delete("tbl_blogs", `id=${id}`);
    res.json({ message: "Blog deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Like a blog post (Public)
const likeBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if blog exists
    const blog = await db.select("tbl_blogs", "id, likes", `id=${id}`);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Increment likes
    await db.update("tbl_blogs", { likes: blog.likes + 1 }, `id=${id}`);
    res.json({ message: "Blog liked successfully", likes: blog.likes + 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Share a blog post (Public)
const shareBlog = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if blog exists
    const blog = await db.select("tbl_blogs", "id, shares", `id=${id}`);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Increment shares
    await db.update("tbl_blogs", { shares: blog.shares + 1 }, `id=${id}`);
    res.json({ message: "Blog shared successfully", shares: blog.shares + 1 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Add a comment to a blog post (Public)
const addComment = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate request body
    await body("name")
      .notEmpty()
      .withMessage("Name is required")
      .isLength({ max: 100 })
      .withMessage("Name must be less than 100 characters")
      .run(req);
    await body("email")
      .isEmail()
      .withMessage("Please enter a valid email address")
      .run(req);
    await body("comment")
      .notEmpty()
      .withMessage("Comment is required")
      .isLength({ max: 1000 })
      .withMessage("Comment must be less than 1000 characters")
      .run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, comment } = req.body;

    // Check if blog exists
    const blog = await db.select("tbl_blogs", "id, comments", `id=${id}`);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Insert comment
    const newComment = await db.insert("tbl_comments", {
      blog_id: id,
      name,
      email,
      comment,
    });

    // Increment comments count
    await db.update("tbl_blogs", { comments: blog.comments + 1 }, `id=${id}`);

    res
      .status(201)
      .json({ message: "Comment added successfully", comment: newComment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get comments for a blog post (Public)
const getComments = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if blog exists
    const blog = await db.select("tbl_blogs", "id", `id=${id}`);
    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    // Fetch comments
    const comments = await db.selectAll(
      "tbl_comments",
      "id, name, email, comment, created_at",
      `blog_id=${id}`
    );

    res.json({ comments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  getBlogById,
  updateBlog,
  deleteBlog,
  likeBlog,
  shareBlog,
  addComment,
  getComments,
};