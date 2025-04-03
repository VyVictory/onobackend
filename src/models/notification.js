import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "FRIEND_REQUEST",
        "FRIEND_ACCEPTED",
        "POST",
        "COMMENT",
        "COMMENT_MENTION",
        "POST_MENTION",
        "LIKE",
        "NEW_FOLLOWER",
      ],
    },
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      required: false,
      // Có thể reference đến nhiều model khác nhau tùy type
      refPath: "referenceModel",
    },
    referenceModel: {
      type: String,
      enum: ["Post", "Comment", "Friendship","Follow"],
    },
    content: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Thêm index để tối ưu việc tìm kiếm
notificationSchema.index({ recipient: 1, read: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, reference: 1 });

export default mongoose.model("Notification", notificationSchema);
