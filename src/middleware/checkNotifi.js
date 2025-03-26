import Notification from "../models/notification.js";

const checkNotifi = async (recipientId, requesterId) => {
  console.log(recipientId, "id sender ", requesterId);
  const existingNotification = await Notification.findOne({
    recipient: requesterId,
    sender: recipientId,
    type: "FRIEND_REQUEST",
    referenceModel: "Friendship",
    isRead: false,
  });

  return !!existingNotification;
};

export default checkNotifi;
