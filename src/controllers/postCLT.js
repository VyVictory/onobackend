import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import Post from "../models/post.js";
import Notification from "../models/notification.js";
import User from "../models/user.js";
import { getIO } from "../config/socketConfig.js";
import { uploadMedia, deleteMedia } from "../services/mediaService.js";
import {
  deactivateNotifications,
  createNotification,
} from "../services/notificationService.js";
import mongoose from "mongoose";
import Friendship from "../models/friendship.js";
import Comment from "../models/comment.js";

const MAX_MENTIONS = 10;

// Hàm xử lý tìm mentions trong nội dung
const extractMentions = async (content, userId) => {
  try {
    // Regex cho cả hai format: @[Tên] và @[Tên](id)
    const mentionRegex = /@\[([^\]]+)\](?:\(([^)]+)\))?/g;
    const mentions = [];
    let match;
    const processedUsers = new Set(); // Để tránh mention trùng lặp

    while ((match = mentionRegex.exec(content)) !== null) {
      const [fullMatch, username, mentionedUserId] = match;

      let userIdToCheck;

      // Nếu có ID trong format @[Tên](id)
      if (mentionedUserId) {
        userIdToCheck = mentionedUserId;
      } else {
        // Nếu chỉ có tên @[Tên], tìm user theo tên
        const user = await User.findOne({
          $or: [
            { firstName: { $regex: new RegExp(`^${username}$`, "i") } },
            { lastName: { $regex: new RegExp(`^${username}$`, "i") } },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ["$firstName", " ", "$lastName"] },
                  regex: new RegExp(`^${username}$`, "i"),
                },
              },
            },
          ],
        });

        if (!user) {
          continue; // Bỏ qua nếu không tìm thấy user
        }
        userIdToCheck = user._id.toString();
      }

      // Kiểm tra userId hợp lệ
      if (!mongoose.Types.ObjectId.isValid(userIdToCheck)) {
        continue;
      }

      // Kiểm tra không mention chính mình
      if (userIdToCheck === userId.toString()) {
        continue;
      }

      // Kiểm tra không mention trùng lặp
      if (processedUsers.has(userIdToCheck)) {
        continue;
      }

      // Kiểm tra người dùng tồn tại
      const mentionedUser = await User.findById(userIdToCheck);
      if (!mentionedUser) {
        continue;
      }

      // Kiểm tra quyền mention (có thể là bạn bè hoặc public profile)
      const friendship = await Friendship.findOne({
        users: { $all: [userId, userIdToCheck] },
        status: "accepted",
      });

      const mentionedUserProfile = await User.findById(userIdToCheck).select(
        "privacy"
      );

      // Cho phép mention nếu là bạn bè hoặc profile public
      if (friendship || mentionedUserProfile?.privacy === "public") {
        mentions.push({
          id: userIdToCheck,
          index: match.index,
        });
        processedUsers.add(userIdToCheck);
      }
    }

    // Kiểm tra giới hạn số lượng mentions
    if (mentions.length > MAX_MENTIONS) {
      throw new Error(
        `Bạn chỉ có thể gắn thẻ tối đa ${MAX_MENTIONS} người trong một bài viết`
      );
    }

    return mentions;
  } catch (error) {
    console.error("Error extracting mentions:", error);
    throw error;
  }
};

// Hàm xử lý hashtags
const extractHashtags = async (content, userId) => {
  const hashtags = [];
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    const hashtagRegex = /#(\w+)/g;
    let match;

    while ((match = hashtagRegex.exec(line)) !== null) {
      hashtags.push({
        tag: match[1].toLowerCase(),
        user: userId,
        line: index + 1,
        status: true,
      });
    }
  });

  return hashtags;
};
export const isNotification = async (req, res) => {
  const { chane } = req.body;
  if (chane != false && chane != true) {
    return;
  }
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: "Comment not found" });
    }
    post.isNotification = chane;
    await post.save();

    res.status(200).json({ message: "chane success" });
  } catch (error) {
    res.status(500).json({ message: "Error chane notifi", error });
  }
};
// Đăng bài
export const createPost = async (req, res) => {
  try {
    const { security } = req.body;
    const files = req.files;
    const author = req.user._id;
    let content = ""; // Dùng let thay vì const

    if (req?.body?.content) {
      content = req.body.content;
    }

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
    let mentions = [];
    try {
      mentions = await extractMentions(content || "", author);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // Xử lý hashtags
    const hashtags = await extractHashtags(content || "", author);

    const newPost = new Post({
      author,
      content: content || " ",
      security: security,
      media: mediaResults,
      mentions,
      hashtags,
      active: true,
    });

    await newPost.save();

    // Populate thông tin tác giả
    const populatedPost = await Post.findById(newPost._id)
      .populate("author", "firstName lastName avatar")
      .populate("mentions.id", "firstName lastName avatar")
      .populate("hashtags.user", "firstName lastName avatar");
    // Xử lý mentions: thêm name vào từng mention
    if (populatedPost.mentions && populatedPost.mentions.length > 0) {
      populatedPost.mentions = populatedPost.mentions.map((mention) => {
        const user = mention.id;
        return {
          id: user._id,
          index: mention.index,
          name: `${user.firstName} ${user.lastName}`,
        };
      });
    }
    // Tạo và gửi thông báo cho những người được mention
    try {
      const notifications = await Promise.all(
        mentions.map(async (mention) => {
          try {
            const notification = await createNotification({
              recipient: mention.id,
              sender: author,
              type: "POST_MENTION",
              reference: newPost._id,
              referenceModel: "Post",
              content: `${req.user.firstName} ${req.user.lastName} đã nhắc đến bạn trong một bài viết`,
            });

            if (notification) {
              // Gửi thông báo realtime
              getIO()
                .to(`user_${mention.id}`)
                .emit("notification", {
                  type: "POST_MENTION",
                  notification: await notification.populate(
                    "sender",
                    "firstName lastName avatar"
                  ),
                });
            }

            return notification;
          } catch (error) {
            console.error("Error creating notification for mention:", error);
            return null;
          }
        })
      );
    } catch (error) {
      console.error("Error creating notifications:", error);
      // Không trả về lỗi vì post đã được tạo thành công
    }

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
    const { page = 1, limit = 10, search = "" } = req.query;
    const query = {};

    if (search) {
      query.$or = [{ content: { $regex: search, $options: "i" } }];
    }

    const posts = await Post.find(query)
      .populate("author", "firstName lastName avatar")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Ban/Unban bài viết
export const togglePostBan = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Không tìm thấy bài viết" });
    }

    post.active = !post.active;

    await post.save();

    // Nếu ban bài viết, cũng sẽ ban tất cả bình luận của bài viết đó
    if (!post.active) {
      await Comment.updateMany({ post: postId }, { active: false });
    }

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Xóa bài viết
export const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Không tìm thấy bài viết" });
    }

    // Xóa tất cả bình luận của bài viết
    await Comment.deleteMany({ post: postId });

    // Xóa bài viết
    await post.delete();

    res.json({ message: "Đã xóa bài viết thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    const posts = await Post.find({ active: true })
      .sort({ createdAt: -1 })
      .skip(parseInt(startIndex))
      .limit(parseInt(limitCount))
      .populate("author", "firstName lastName avatar _id")
      .populate("mentions.id", "firstName lastName avatar")
      .populate("hashtags.user", "firstName lastName avatar")
      .populate({
        path: "comments",
        populate: {
          path: "author",
          select: "firstName lastName avatar",
        },
      });

    const total = await Post.countDocuments({ active: true });

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
