import mongoose from "mongoose";
import Like from "../models/like";

export const like = async (req, res) => {
  const { type, refId, isLike } = req.body;
  const author = req.user._id;

  if (!author || !type || !refId || typeof isLike !== "boolean") {
    return res.status(400).json({ error: "Thiếu hoặc sai dữ liệu." });
  }

  try {
    // Tìm nhóm Like cho đối tượng theo type và refId
    const likesGroup = await Like.findOne({
      type,
      refId: refId,
    });

    // Nếu đã có nhóm likes cho đối tượng này
    if (likesGroup) {
      // Kiểm tra người dùng đã thích hay không (true: like, false: dislike)
      const likeIndex = likesGroup.likes.findIndex(
        (l) => l.author.toString() === author.toString()
      );

      if (likeIndex !== -1) {
        // Người dùng đã like hoặc dislike, chỉ cần cập nhật trạng thái
        likesGroup.likes[likeIndex].isLike = isLike; // Cập nhật lại trạng thái like/dislike
        await likesGroup.save();
        return res.json({
          message: isLike ? "Đã like" : "Đã dislike",
          data: likesGroup,
        });
      } else {
        // Người dùng chưa like hoặc dislike, thêm mới
        likesGroup.likes.push({ author, isLike });
        await likesGroup.save();
        return res.status(201).json({
          message: isLike ? "Đã like" : "Đã dislike",
          data: likesGroup,
        });
      }
    } else {
      // Nếu chưa có nhóm likes, tạo mới
      const newLike = new Like({ type, refId, likes: [{ author, isLike }] });
      await newLike.save();
      return res.status(201).json({
        message: isLike ? "Đã like" : "Đã dislike",
        data: newLike,
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};
export const unlike = async (req, res) => {
  const { type, refId } = req.body;
  const author = req.user._id;

  if (!author || !type || !refId) {
    return res.status(400).json({ error: "Thiếu hoặc sai dữ liệu." });
  }

  try {
    // Tìm nhóm like của đối tượng theo type và refId
    const likesGroup = await Like.findOne({
      type,
      refId: refId,
    });

    // Nếu không tìm thấy nhóm likes, trả về lỗi
    if (!likesGroup) {
      return res.status(404).json({ message: "Không tìm thấy like của bạn" });
    }

    // Tìm và xóa like của người dùng khỏi nhóm likes
    const updatedLikes = likesGroup.likes.filter(
      (like) => like.author.toString() !== author.toString()
    );

    // Nếu không có like của người dùng, trả về thông báo lỗi
    if (updatedLikes.length === likesGroup.likes.length) {
      return res.status(404).json({ message: "Không tìm thấy like của bạn" });
    }

    // Cập nhật lại danh sách likes sau khi xóa
    likesGroup.likes = updatedLikes;
    await likesGroup.save();

    return res.json({ message: "Đã bỏ like", data: likesGroup });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};
export const checkLikeStatus = async (req, res) => {
  const { type, refId } = req.body;
  const author = req.user._id; // Lấy ID người dùng từ token hoặc session

  if (!author || !type || !refId) {
    return res.status(400).json({ error: "Thiếu hoặc sai dữ liệu." });
  }

  try {
    // Tìm nhóm like của đối tượng theo type và refId
    const likesGroup = await Like.findOne({
      type,
      refId: refId,
    });

    // Nếu không tìm thấy nhóm like, trả về trạng thái "chưa like"
    if (!likesGroup) {
      return res
        .status(200)
        .json({ message: "Chưa like hoặc dislike", status: "none" });
    }

    // Kiểm tra xem người dùng đã like, dislike hay chưa
    const userLike = likesGroup.likes.find(
      (like) => like.author.toString() === author.toString()
    );

    if (!userLike) {
      return res
        .status(200)
        .json({ message: "Chưa like hoặc dislike", status: "none" });
    }

    // Trả về trạng thái like hoặc dislike của người dùng
    return res.status(200).json({
      message: userLike.isLike ? "Đã like" : "Đã dislike",
      status: userLike.isLike ? "like" : "dislike",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lỗi server" });
  }
};
export const getLikeStats = async (req, res) => {
  const { type, refId } = req.body;

  if (!type || !refId) {
    return res.status(400).json({ error: "Thiếu type hoặc refId." });
  }

  try {
    const likesGroup = await Like.findOne({
      type,
      refId: new mongoose.Types.ObjectId(refId),
    });

    if (!likesGroup) {
      return res.json({ likeCount: 0, dislikeCount: 0 });
    }

    const likeCount = likesGroup.likes.filter((l) => l.isLike === true).length;
    const dislikeCount = likesGroup.likes.filter(
      (l) => l.isLike === false
    ).length;

    return res.json({ likeCount, dislikeCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Lỗi server." });
  }
};
