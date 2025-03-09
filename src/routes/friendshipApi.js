import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  sendFriendRequest,
  respondToFriendRequest,
  getFriends,
  getReceivedFriendRequests,
  getSentFriendRequests,
  unfriend,
  blockUser,
  getStatusFriend,
} from "../controllers/friendshipCTL.js";
import {
  validateFriendRequest,
  validateFriendResponse,
} from "../middleware/validateRequest.js";

const routerFriendship = express.Router();

routerFriendship.post(
  "/request",
  authMiddleware,
  validateFriendRequest,
  sendFriendRequest
);

routerFriendship.post(
  "/respond/:requestId",
  authMiddleware,
  validateFriendResponse,
  respondToFriendRequest
);

routerFriendship.get("/friends", authMiddleware, getFriends);
routerFriendship.get(
  "/requests/received",
  authMiddleware,
  getReceivedFriendRequests
);
routerFriendship.get("/requests/sent", authMiddleware, getSentFriendRequests);
routerFriendship.delete("/unfriend/:friendId", authMiddleware, unfriend);
routerFriendship.post("/block/:userId", authMiddleware, blockUser);
routerFriendship.get("/status/:userId", authMiddleware, getStatusFriend);

export default routerFriendship;
