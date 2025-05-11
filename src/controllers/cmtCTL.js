import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import Comment from "../models/comment.js";
import Post from "../models/post.js";
import Notification from "../models/notification.js";
import { getIO } from "../config/socketConfig.js";
import Friendship from "../models/friendship.js";
import { createNotification } from "../services/notificationService.js";
import mongoose from "mongoose";
import User from "../models/user.js";

// Lấy bình luận
export const getComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: "Error fetching comment", error });
  }
};
export const getCommentPost = async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Không tìm thấy bài đăng" });
    }

    const comments = await Comment.find({
      post: postId, 
      active: true,
    })
      .sort({ createdAt: -1 }) // Mới nhất trước
    //   .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate("author", "firstName lastName avatar")
      .populate("mentions.id", "firstName lastName avatar")
      .populate("hashtags.user", "firstName lastName avatar");

    // Đếm tổng số bình luận gốc (idCmt = null)
    const total = await Comment.countDocuments({
      post: postId,
      idCmt: null,
      active: true,
    });

    res.status(200).json({
      comments,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({ message: "Lỗi khi lấy danh sách bình luận" });
  }
};
// Lấy tất cả bình luận
export const getComments = async (req, res) => {
  try {
    const comments = await Comment.find();
    res.json(comments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching comments", error });
  }
    try {
        const { page = 1, limit = 10, search = '' } = req.query;
        const query = {};

        if (search) {
            query.$or = [
                { content: { $regex: search, $options: 'i' } }
            ];
        }

        const comments = await Comment.find(query)
            .populate('author', 'firstName lastName avatar')
            .populate('post', 'content')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Comment.countDocuments(query);

        res.json({
            comments,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Xóa bình luận
export const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    try {
        const { commentId } = req.params;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Không tìm thấy bình luận' });
        }

    await comment.delete();
    res.json({ message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting comment", error });
  }
        await comment.delete();

        res.json({ message: 'Đã xóa bình luận thành công' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

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
        `Bạn chỉ có thể gắn thẻ tối đa ${MAX_MENTIONS} người trong một bình luận`
      );
    }

    return mentions;
  } catch (error) {
    console.error("Error extracting mentions:", error);
    throw error;
  }
};

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

// Đăng bình luận
export const createComment = async (req, res) => {
  const { content, idCmt } = req.body;
  const { postId } = req.params;
  const media = req.files;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Không tìm thấy bài đăng" });
    }

    // Nếu là trả lời bình luận, kiểm tra bình luận gốc
    let parentComment = null;
    if (idCmt) {
      parentComment = await Comment.findById(idCmt);
      if (!parentComment) {
        return res
          .status(404)
          .json({ message: "Không tìm thấy bình luận gốc" });
      }
      if (parentComment.post.toString() !== postId) {
        return res
          .status(400)
          .json({ message: "Bình luận gốc không thuộc bài đăng này" });
      }
    }

    // Xử lý media nếu có
    const mediaArray = media
      ? media.map((file) => ({
          type: file.mimetype.startsWith("image/") ? "image" : "video",
          url: file.path,
          status: true,
        }))
      : [];

    // Xử lý hashtags
    const hashtags = await extractHashtags(content, req.user._id);

    // Xử lý mentions
    let mentions = [];
    try {
      mentions = await extractMentions(content, req.user._id);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    const newComment = new Comment({
      author: req.user._id,
      post: postId,
      content: content.trim(),
      media: mediaArray,
      idCmt: idCmt || null,
      hashtags,
      mentions,
      active: true,
    });

    await newComment.save();

    // Populate thông tin tác giả
    await Comment.populate("author", "firstName lastName avatar");

    // Thêm comment vào post
    post.comments.push(newComment._id);
    await post.save();

    // Tạo và gửi thông báo cho những người được mention
    try {
      const notifications = await Promise.all(
        mentions.map(async (mention) => {
          try {
            const notification = await createNotification({
              recipient: mention.id,
              sender: req.user._id,
              type: "COMMENT_MENTION",
              reference: newComment._id,
              referenceModel: "Comment",
              content: `${req.user.firstName} ${req.user.lastName} đã nhắc đến bạn trong một bình luận`,
            });

            if (notification) {
              // Gửi thông báo realtime
              getIO()
                .to(`user_${mention.id}`)
                .emit("notification", {
                  type: "COMMENT_MENTION",
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
      // Không trả về lỗi vì comment đã được tạo thành công
    }

    // Trả về comment đã được populate với thông tin author và mentions
    const populatedComment = await Comment.findById(newComment._id)
      .populate("author", "firstName lastName avatar")
      .populate("mentions.id", "firstName lastName avatar")
      .populate("hashtags.user", "firstName lastName avatar");

    res.status(201).json(populatedComment);
  } catch (error) {
    console.error("Create comment error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const updateComment = async (req, res) => {
  const { content } = req.body;
  const media = req.files; // Lấy các tệp đã tải lên

  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    // Cập nhật nội dung nếu có
    if (content) {
      comment.content = content.trim();
    }

    // Cập nhật media nếu có tệp mới được tải lên
    if (media && media.length > 0) {
      comment.media = media.map((file) => file.path);
    }

    await comment.save();
    res.json(comment);
  } catch (error) {
    res.status(500).json({ message: "Error updating comment", error });
  }
};



// Lấy danh sách trả lời của một bình luận
export const getCommentReplies = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const filter = {
      idCmt: commentId,
      active: true,
    };

    const replies = await Comment.find(filter)
      .populate("author", "firstName lastName avatar")
      .populate({
        path: "hashtags.user",
        select: "firstName lastName avatar",
      })
      .sort("createdAt")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Comment.countDocuments(filter);

    res.json({
      replies,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Ban/Unban bình luận
export const toggleCommentBan = async (req, res) => {
    try {
        const { commentId } = req.params;

        const comment = await Comment.findById(commentId);
        if (!comment) {
            return res.status(404).json({ message: 'Không tìm thấy bình luận' });
        }

        comment.active = !comment.active;
        await comment.save();

        res.json(comment);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
