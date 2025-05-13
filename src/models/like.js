import mongoose from "mongoose";
const likeSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["post", "comment"], required: true },
    refId: { type: mongoose.Schema.Types.ObjectId, required: true }, // post or comment ID
    likes: [
      {
        author: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        isLike: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

const Like = mongoose.model("Like", likeSchema);

export default Like;
