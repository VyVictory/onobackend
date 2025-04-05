import Friendship from "../models/friendship.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import { getIO } from "../config/socketConfig.js";
import {
  createNotification,
  deactivateNotifications,
} from "../services/notificationService.js";
import Message from "../models/message.js";
import checkNotifi from "../middleware/checkNotifi.js";
// Gửi lời mời kết bạn
export const sendFriendRequest = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const requesterId = req.user._id;

    console.log("Sending friend request:", {
      requesterId,
      recipientId,
      body: req.body,
    });

    // Kiểm tra người dùng tồn tại
    const [recipient, requester] = await Promise.all([
      User.findById(recipientId),
      User.findById(requesterId),
    ]);

    if (!recipient) {
      return res.status(404).json({ message: "Người dùng không tồn tại" });
    }

    // Kiểm tra xem đã có mối quan hệ bạn bè chưa
    const existingFriendship = await Friendship.findOne({
      users: { $all: [requesterId, recipientId] },
    });

    if (existingFriendship) {
      if (existingFriendship.status === "accepted") {
        return res.status(400).json({ message: "Đã là bạn bè" });
      }
      if (existingFriendship.status === "pending") {
        return res
          .status(400)
          .json({ message: "Đã gửi lời mời kết bạn trước đó" });
      }
      if (existingFriendship.status === "rejected") {
        await Friendship.findByIdAndDelete(existingFriendship._id);
      }
    }
    const newFriendship = new Friendship({
      requester: requesterId,
      recipient: recipientId,
      users: [requesterId, recipientId],
      status: "pending",
    });
    await newFriendship.save();
    const existingNotification = await checkNotifi(requesterId, recipientId);
    console.log(existingNotification);
    if (!existingNotification) {
      // Tạo mối quan hệ bạn bè mới

      // Tạo thông báo
      const notification = await createNotification({
        recipient: recipientId,
        sender: requesterId,
        type: "FRIEND_REQUEST",
        reference: newFriendship._id,
        referenceModel: "Friendship",
        content: `${requester.firstName} ${requester.lastName} đã gửi lời mời kết bạn`,
        isActive: true,
        isRead: false,
      });

      // Gửi thông báo realtime
      getIO()
        .to(`user_${recipientId}`)
        .emit("notification", {
          _id: notification._id,
          type: "FRIEND_REQUEST",
          content: notification.content,
          createdAt: notification.createdAt,
          updatedAt: notification.updatedAt,
          isActive: notification.isActive,
          isRead: notification.isRead,
          recipient: notification.recipient,
          sender: {
            _id: requester._id,
            firstName: requester.firstName,
            lastName: requester.lastName,
            avatar: requester.avatar || "",
          },
          reference: notification.reference,
          referenceModel: notification.referenceModel,
          __v: 0,
        });
    }

    res.json({
      message: "Đã gửi lời mời kết bạn",
      friendship: newFriendship,
    });
  } catch (error) {
    console.error("Friend request error:", error);
    res.status(500).json({
      message: "Lỗi khi gửi lời mời kết bạn",
      error: error.message,
    });
  }
};

// Phản hồi lời mời kết bạn
export const respondToFriendRequest = async (req, res) => {
  try {
    const { senderId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;
    console.log("idsen:" + senderId + "recepid:" + userId);
    const friendship = await Friendship.findOne({
      requester: senderId,
      recipient: userId,
      status: "pending",
    }).populate("requester", "firstName lastName");

    if (!friendship) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy lời mời kết bạn" });
    }
    switch (status) {
      case "accepted":
        friendship.status = "accepted";
        break;
      case "rejected":
        friendship.status = "rejected";
        break;
      default:
        return res.status(500).json({
          message:
            "Lỗi phương thức xử lý lời mời kết bạn status là `accepted` or `rejected`",
          error: error.message,
        });
    }

    await friendship.save();

    if (status === "accepted") {
      const existingNotification = await checkNotifi(
        friendship.requester._id,
        userId
      );
      if (!existingNotification) {
        const notification = new Notification({
          recipient: friendship.requester._id,
          sender: userId,
          type: "FRIEND_ACCEPTED",
          reference: friendship._id,
          referenceModel: "Friendship",
          content: `${req.user.firstName} ${req.user.lastName} đã chấp nhận lời mời kết bạn của bạn`,
        });
        await notification.save();

        // Gửi thông báo realtime
        getIO()
          .to(`user_${friendship.requester._id}`)
          .emit("notification", {
            _id: notification._id,
            type: "FRIEND_ACCEPTED",
            content: notification.content,
            createdAt: notification.createdAt,
            updatedAt: notification.updatedAt,
            isActive: true,
            isRead: false,
            recipient: notification.recipient,
            sender: {
              _id: req.user._id,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              avatar: req.user.avatar || "",
            },
            reference: notification.reference,
            referenceModel: notification.referenceModel,
            __v: 0,
          });
      }
    }

    res.json({
      message:
        status === "accepted"
          ? "Đã chấp nhận lời mời kết bạn"
          : "Đã từ chối lời mời kết bạn",
      friendship,
    });
  } catch (error) {
    console.error("Friend response error:", error);
    res.status(500).json({
      message: "Lỗi khi xử lý lời mời kết bạn",
      error: error.message,
    });
  }
};

export const cancelRequest = async (req, res) => {
  const { userId } = req.params;
  const requesterId = req.user._id;
  try {
    const friendship = await Friendship.findOneAndDelete({
      requester: requesterId,
      recipient: userId,
      status: "pending",
    });

    if (!friendship) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy lời mời kết bạn" });
    }

    // Hủy kích hoạt thông báo liên quan
    await deactivateNotifications(friendship._id);

    res.json({ message: "Đã hủy lời mời kết bạn" });
  } catch (error) {
    console.error("Cancel friend request error:", error);
    res.status(500).json({ message: "Lỗi khi hủy lời mời kết bạn", error });
  }
};

// Lấy danh sách bạn bè
export const getFriends = async (req, res) => {
  try {
    const { startIndex = 0, limitCount = 2 } = req.query;
    const userId = req.user._id;

    const friendships = await Friendship.find({
      users: userId,
      status: "accepted",
    })
      .skip(parseInt(startIndex))
      .limit(parseInt(limitCount) + 1) // Lấy thêm 1 để kiểm tra hasMore
      .populate("users", "firstName lastName avatar email");

    // Lọc danh sách bạn bè, loại bỏ chính user hiện tại
    const friends = friendships.map((friendship) => {
      return friendship.users.find(
        (user) => user._id.toString() !== userId.toString()
      );
    });

    const hasMore = friends.length > parseInt(limitCount);
    if (hasMore) friends.pop(); // Xóa bạn bè dư ra để đúng limit

    const total = await Friendship.countDocuments({
      users: userId,
      status: "accepted",
    });

    res.json({
      friends,
      total,
      hasMore,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách bạn bè", error: error.message });
  }
};
export const getFriendsMess = async (req, res) => {
  try {
    const { start = 0, limit = 5, name } = req.query;
    const userId = req.user._id;
    const startIndex = parseInt(start) || 0;
    const limitCount = parseInt(limit) || 5;

    if (name && name.trim() === "") {
      return res.status(400).json({ message: "Tên tìm kiếm không hợp lệ" });
    }

    let query = { users: userId, status: "accepted" };

    const friendships = await Friendship.find(query).populate(
      "users",
      "firstName lastName avatar email"
    );
    if (name) {
      const regexPattern = new RegExp(name.trim(), "i");

      // Filter friendships based on the regex matching first or last name
      const filteredFriendships = friendships.filter((friendship) => {
        return friendship.users.some(
          (user) =>
            regexPattern.test(user.firstName) ||
            regexPattern.test(user.lastName)
        );
      }); 
      friendships.length = 0; // Clear the current array
      Array.prototype.push.apply(friendships, filteredFriendships);
    } 
    // Eliminate duplicates using a Set
    const friends = [];
    const seenUserIds = new Set();
    friendships.forEach((friendship) => {
      const friend = friendship.users.find(
        (user) => user._id.toString() !== userId.toString()
      );
      if (friend && !seenUserIds.has(friend._id.toString())) {
        friends.push(friend);
        seenUserIds.add(friend._id.toString());
      }
    });

    // Retrieve the last message for each friend
    const friendsWithLastMessage = await Promise.all(
      friends.map(async (friend) => {
        const lastMessage = await Message.findOne({
          $or: [
            { sender: userId, receiver: friend._id },
            { sender: friend._id, receiver: userId },
          ],
        }).sort({ createdAt: -1 });

        return {
          ...friend.toObject(),
          lastMessage: lastMessage || null,
        };
      })
    );

    // Sort friends by last message timestamp
    friendsWithLastMessage.sort((a, b) => {
      const lastMessageA = a.lastMessage ? a.lastMessage.createdAt : 0;
      const lastMessageB = b.lastMessage ? b.lastMessage.createdAt : 0;
      return lastMessageB - lastMessageA;
    });

    // Paginate the results
    const paginatedFriends = friendsWithLastMessage.slice(
      startIndex,
      startIndex + limitCount
    );

    const total = await Friendship.countDocuments(query);
    const hasMore = total > startIndex + limitCount;

    res.json({
      friends: paginatedFriends,
      total,
      hasMore,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách bạn bè", error: error.message });
  }
};

// Lấy danh sách lời mời kết bạn đã nhận
export const getReceivedFriendRequests = async (req, res) => {
  try {
    const requests = await Friendship.find({
      recipient: req.user._id,
      status: "pending",
    }).populate("requester", "firstName lastName avatar email");

    res.json(requests);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách lời mời kết bạn", error });
  }
};

// Lấy danh sách lời mời kết bạn đã gửi
export const getSentFriendRequests = async (req, res) => {
  try {
    const requests = await Friendship.find({
      requester: req.user._id,
      status: "pending",
    }).populate("recipient", "firstName lastName avatar email");

    res.json(requests);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách lời mời đã gửi", error });
  }
};

// Hủy kết bạn
export const unfriend = async (req, res) => {
  try {
    const { friendId } = req.params;
    const userId = req.user._id;

    await Friendship.findOneAndDelete({
      users: { $all: [userId, friendId] },
      status: "accepted",
    });

    res.json({ message: "Đã hủy kết bạn" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi hủy kết bạn", error });
  }
};

// Chặn người dùng
export const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const blockerId = req.user._id;

    const friendship = await Friendship.findOne({
      users: { $all: [userId, blockerId] },
    });

    if (friendship) {
      friendship.status = "blocked";
      await friendship.save();
    } else {
      const newFriendship = new Friendship({
        requester: blockerId,
        recipient: userId,
        users: [blockerId, userId],
        status: "blocked",
      });
      await newFriendship.save();
    }

    res.json({ message: "Đã chặn người dùng" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi chặn người dùng", error });
  }
};

export const getStatusFriend = async (req, res) => {
  try {
    const { userId } = req.params;
    const myId = req.user._id;

    // Kiểm tra nếu userId không phải ObjectId hợp lệ
    if (!userId) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    // Tìm trạng thái bạn bè giữa myId và userId
    const friendship = await Friendship.findOne({
      $or: [
        { requester: myId, recipient: userId },
        { requester: userId, recipient: myId },
      ],
    });

    // Nếu không tìm thấy, trả về trạng thái "noFriend"
    if (!friendship) {
      return res.status(200).json({ status: "noFriend" });
    }

    let status = "noFriend";
    if (friendship.status === "pending") {
      status = friendship.requester.equals(myId) ? "pending" : "waiting";
    } else if (friendship.status === "friend") {
      status = "friend";
    }

    return res.status(200).json({ status });
  } catch (error) {
    console.error("Lỗi khi lấy trạng thái kết bạn:", error);
    return res
      .status(500)
      .json({ message: "Lỗi khi lấy trạng thái kết bạn", error });
  }
};

// Lấy danh sách bạn bè theo range
export const getFriendsByRange = async (req, res) => {
  try {
    const { userId } = req.params;
    const { start = 0, limit = 10 } = req.query;

    const friendships = await Friendship.find({
      users: userId,
      status: "accepted",
    })
      .sort({ createdAt: -1 })
      .skip(parseInt(start))
      .limit(parseInt(limit))
      .populate("users", "firstName lastName avatar email");

    const total = await Friendship.countDocuments({
      users: userId,
      status: "accepted",
    });

    // Lọc ra danh sách bạn bè (không bao gồm user hiện tại)
    const friends = friendships.map((friendship) => {
      return friendship.users.find(
        (user) => user._id.toString() !== userId.toString()
      );
    });

    res.json({
      friends,
      total,
      hasMore: total > parseInt(start) + friends.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách bạn bè", error: error.message });
  }
};

// Tìm kiếm bạn bè
export const searchFriends = async (req, res) => {
  try {
    const { userId } = req.params;
    const { search, start = 0, limit = 10 } = req.query;

    const friendships = await Friendship.find({
      users: userId,
      status: "accepted",
    }).populate({
      path: "users",
      match: {
        $or: [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
        ],
      },
      select: "firstName lastName avatar email",
    });

    // Lọc ra những friendship có user match với search
    const filteredFriendships = friendships.filter(
      (friendship) => friendship.users.length === 2
    );

    const paginatedFriendships = filteredFriendships.slice(
      parseInt(start),
      parseInt(start) + parseInt(limit)
    );

    const friends = paginatedFriendships.map((friendship) =>
      friendship.users.find((user) => user._id.toString() !== userId.toString())
    );

    res.json({
      friends,
      total: filteredFriendships.length,
      hasMore: filteredFriendships.length > parseInt(start) + friends.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi tìm kiếm bạn bè", error: error.message });
  }
};
