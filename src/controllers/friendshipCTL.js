import Friendship from "../models/friendship.js";
import User from "../models/user.js";
import Notification from "../models/notification.js";
import { getIO } from "../config/socketConfig.js";

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
    }

    // Tạo mối quan hệ bạn bè mới
    const newFriendship = new Friendship({
      requester: requesterId,
      recipient: recipientId,
      users: [requesterId, recipientId],
      status: "pending",
    });

    await newFriendship.save();

    // Tạo thông báo
    const notification = new Notification({
      recipient: recipientId,
      sender: requesterId,
      type: "FRIEND_REQUEST",
      reference: newFriendship._id,
      referenceModel: "Friendship",
      content: `${requester.firstName} ${requester.lastName} đã gửi lời mời kết bạn`,
    });

    await notification.save();

    // Gửi thông báo realtime
    getIO()
      .to(`user_${recipientId}`)
      .emit("notification", {
        type: "FRIEND_REQUEST",
        notification: await notification.populate(
          "sender",
          "firstName lastName avatar"
        ),
      });

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
    console.log('idsen:'+ senderId+ "recepid:"+userId)
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
          message: "Lỗi phương thức xử lý lời mời kết bạn status là `accepted` or `rejected`",
          error: error.message,
        });
    }

    await friendship.save();

    if (status === "accepted") {
      // Tạo thông báo chấp nhận kết bạn
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
          type: "FRIEND_ACCEPTED",
          notification: await notification.populate(
            "sender",
            "firstName lastName avatar"
          ),
        });
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

    res.json({ message: "Đã hủy lời mời kết bạn" });
  } catch (error) {
    console.error("Cancel friend request error:", error);
    res.status(500).json({ message: "Lỗi khi hủy lời mời kết bạn", error });
  }
};
// Lấy danh sách bạn bè
export const getFriends = async (req, res) => {
  try {
    const userId = req.user._id;
    const friendships = await Friendship.find({
      users: userId,
      status: "accepted",
    }).populate("users", "firstName lastName avatar email");

    // Lọc ra danh sách bạn bè (không bao gồm user hiện tại)
    const friends = friendships.map((friendship) => {
      const friend = friendship.users.find(
        (user) => user._id.toString() !== userId.toString()
      );
      return friend;
    });

    res.json(friends);
  } catch (error) {
    res.status(500).json({ message: "Lỗi khi lấy danh sách bạn bè", error });
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
            status: 'accepted'
        })
        .sort({ createdAt: -1 })
        .skip(parseInt(start))
        .limit(parseInt(limit))
        .populate('users', 'firstName lastName avatar email');

        const total = await Friendship.countDocuments({
            users: userId,
            status: 'accepted'
        });

        // Lọc ra danh sách bạn bè (không bao gồm user hiện tại)
        const friends = friendships.map(friendship => {
            return friendship.users.find(user => user._id.toString() !== userId.toString());
        });

        res.json({
            friends,
            total,
            hasMore: total > parseInt(start) + friends.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi lấy danh sách bạn bè', error: error.message });
    }
};

// Tìm kiếm bạn bè
export const searchFriends = async (req, res) => {
    try {
        const { userId } = req.params;
        const { search, start = 0, limit = 10 } = req.query;

        const friendships = await Friendship.find({
            users: userId,
            status: 'accepted'
        }).populate({
            path: 'users',
            match: {
                $or: [
                    { firstName: { $regex: search, $options: 'i' } },
                    { lastName: { $regex: search, $options: 'i' } }
                ]
            },
            select: 'firstName lastName avatar email'
        });

        // Lọc ra những friendship có user match với search
        const filteredFriendships = friendships.filter(friendship => 
            friendship.users.length === 2
        );

        const paginatedFriendships = filteredFriendships
            .slice(parseInt(start), parseInt(start) + parseInt(limit));

        const friends = paginatedFriendships.map(friendship => 
            friendship.users.find(user => user._id.toString() !== userId.toString())
        );

        res.json({
            friends,
            total: filteredFriendships.length,
            hasMore: filteredFriendships.length > parseInt(start) + friends.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi khi tìm kiếm bạn bè', error: error.message });
    }
};
