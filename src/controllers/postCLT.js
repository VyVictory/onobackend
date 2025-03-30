import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import Post from "../models/post.js";
import Notification from "../models/notification.js";
import User from "../models/user.js";
import { getIO } from "../config/socketConfig.js";
import { uploadMedia, deleteMedia } from "../services/mediaService.js";
import { deactivateNotifications } from "../services/notificationService.js"; 

// Hàm xử lý tìm mentions trong nội dung
const extractMentions = async (content) => {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const mentions = [];
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    const [fullMatch, username, userId] = match;
    mentions.push({
      user: userId,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
    });
  }

  return mentions;
};

const MAX_MENTIONS = 10;

// Đăng bài
export const createPost = async (req, res) => {
  try {
    const { content, security } = req.body;
    const files = req.files;
    const author = req.user._id;
    if (!content && (!files || files.length === 0)) {
      return res.status(400).json({
        message: "Bài đăng phải có nội dung hoặc media",
      });
    }

    // Xử lý upload nhiều file
    const mediaPromises = files
      ? files.map(async (file) => {
          const type = file.mimetype.startsWith("image/gif")
            ? "gif"
            : file.mimetype.startsWith("image/")
            ? "image"
            : file.mimetype.startsWith("video/")
            ? "video"
            : null;

          if (!type) throw new Error("Invalid file type");

          return await uploadMedia(file, type);
        })
      : [];
    const mediaResults = await Promise.all(mediaPromises);

    // Xử lý mentions
    const mentions = await extractMentions(content);

    // Kiểm tra giới hạn mentions
    if (mentions.length > MAX_MENTIONS) {
      return res.status(400).json({
        message: `Bạn chỉ có thể gắn thẻ tối đa ${MAX_MENTIONS} người trong một bài viết`,
      });
    }

    const newPost = new Post({
      author,
      content: content || "",
      security: security,
      media: mediaResults,
      mentions,
    });

    await newPost.save();

    const populatedPost = await Post.findById(newPost._id).populate(
      "author",
      "firstName lastName avatar"
    );
    // Tạo và gửi thông báo
    const notifications = await Promise.all(
      mentions.map(async (mention) => {
        const notification = new Notification({
          recipient: mention.user,
          sender: req.user._id,
          type: "POST_MENTION",
          security: security,
          reference: newPost._id,
          referenceModel: "Post",
          content: `${req.user.firstName} ${req.user.lastName} đã nhắc đến bạn trong một bài viết`,
        });
        await notification.save();

        // Gửi thông báo realtime
        getIO()
          .to(`user_${mention.user}`)
          .emit("notification", {
            type: "POST_MENTION",
            notification: await notification.populate(
              "sender",
              "firstName lastName avatar"
            ),
          });

        return notification;
      })
    );

    res.status(201).json(populatedPost);
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({
      message: "Lỗi khi tạo bài đăng",
      error: error.message,
    });
  }
};

// Share bài viết
export const sharePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    if (!post.shares.includes(req.user.id)) {
      post.shares.push(req.user.id);
      await post.save();
    }

    res.json({ message: "Post shared" });
  } catch (error) {
    res.status(500).json({ message: "Error sharing post", error });
  }
};

// Thu hồi bài viết
export const recallPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    post.isRecalled = true;
    await post.save();

    res.json({ message: "Post recalled" });
  } catch (error) {
    res.status(500).json({ message: "Error recalling post", error });
  }
};

// Lấy bài viết
export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Error fetching post", error });
  }
};

// Lấy tất cả bài viết
export const getPosts = async (req, res) => {
  try {
      const userId = req.user._id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      // Lấy danh sách bạn bè
      const user = await User.findById(userId);
      const friendIds = user.friends.map(friend => friend.toString());

      // Xây dựng query dựa trên quyền xem
      const query = {
          $or: [
              { privacy: 'public' },
              { privacy: 'private', author: userId },
              { 
                  privacy: 'friends', 
                  author: { $in: friendIds },
              },
              {
                  group: { $exists: true },
                  $expr: {
                      $in: [userId, {
                          $map: {
                              input: "$group.members",
                              as: "member",
                              in: "$$member.user"
                          }
                      }]
                  }
              }
          ]
      };

      const posts = await Post.find(query)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('author', 'firstName lastName avatar')
          .populate('group', 'name')
          .populate({
              path: 'comments',
              populate: {
                  path: 'author',
                  select: 'firstName lastName avatar'
              }
          });

      const total = await Post.countDocuments(query);

      res.json({
          posts,
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          total
      });
  } catch (error) {
      res.status(500).json({ message: error.message });
  }
};
export const getPostByRange = async (req, res) => {
  try {
    const { start, limit } = req.query;
    const startIndex = parseInt(start) || 0;
    const limitCount = parseInt(limit) || 20;

    // Kiểm tra tham số hợp lệ
    if (
      isNaN(startIndex) ||
      isNaN(limitCount) ||
      startIndex < 0 ||
      limitCount < 1
    ) {
      return res.status(400).json({ message: "Invalid pagination parameters" });
    }

    // Truy vấn danh sách bài viết
    const posts = await Post.find({})
      .populate("author", "avatar _id firstName lastName") // Chỉ populate các trường cần thiết
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limitCount);

    if (!posts || posts.length === 0) {
      return res.status(200).json({ message: "No posts found", posts: [] });
    }
    
    // Lấy tổng số bài viết
    const total = await Post.countDocuments();

    // Chuẩn hóa dữ liệu trước khi trả về
    const formattedPosts = posts.map((post) => ({
      _id: post._id,
      author: post.author,
      content: post.content,
      security: post.security,
      media: post.media || [], // Đảm bảo media luôn có dạng array
      likes: post.likes || [],
      shares: post.shares || [],
      comments: post.comments || [],
      mentions: post.mentions || [],
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));

    res.json({
      posts: formattedPosts,
      total,
      hasMore: total > startIndex + formattedPosts.length,
    });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách bài viết:", error);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách bài viết",
      error: error.message,
    });
  }
};

// Xóa bài viết
export const deletePost = async (req, res) => {
  try {
    try {
      const userId = req.user._id;
      const { postId } = req.params;

      const post = await Post.findOne({
        _id: postId,
        author: userId,
      });

      if (!post) {
        return res.status(404).json({ message: "Không tìm thấy bài viết" });
      }

      // Xóa bài viết
      await post.remove();

      // Hủy kích hoạt tất cả thông báo liên quan đến bài viết
      await deactivateNotifications(postId);

      res.json({ message: "Đã xóa bài viết" });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }

    await Post.delete();
    res.json({ message: "Post deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting post", error });
  }
};

// Sửa bài đăng
export const updatePost = async (req, res) => {
  const { content } = req.body;
  const media = req.files; // Lấy các tệp đã tải lên

  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ message: "Post not found" });

    // Cập nhật nội dung nếu có
    if (content) {
      post.content = content.trim();
    }

    // Cập nhật media nếu có tệp mới được tải lên
    if (media && media.length > 0) {
      post.media = media.map((file) => file.path);
    }

    await post.save();
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: "Error updating post", error });
  }
};
// Lấy bài viết theo range
export const getPostsByRange = async (req, res) => {
  try {
    const { startIndex = 0, limitCount = 10 } = req.query;

    const posts = await Post.find()
      .sort({ createdAt: -1 })
      .skip(parseInt(startIndex))
      .limit(parseInt(limitCount))
      .populate("author", "firstName lastName avatar _id")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "firstName lastName avatar",
        },
      });

    const total = await Post.countDocuments();

    res.json({
      posts,
      total,
      hasMore: total > parseInt(startIndex) + posts.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy bài viết", error: error.message });
  }
};

// Tìm kiếm bài viết
export const searchPosts = async (req, res) => {
  try {
    const { search, start = 0, limit = 10 } = req.query;

    const query = search
      ? {
          $text: { $search: search },
        }
      : {};

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(start))
      .limit(parseInt(limit))
      .populate("author", "firstName lastName avatar");

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      total,
      hasMore: total > parseInt(start) + posts.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi tìm kiếm bài viết", error: error.message });
  }
};
