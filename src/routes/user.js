import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getCurrentUser,
  getProfile,
  getUsersByUsername,
  searchFriendsForMention,
} from "../controllers/userCTL.js";

const routerUser = express.Router();

routerUser.get("/profile", authMiddleware, getProfile);
routerUser.get("/profile/:id", getCurrentUser); //xem profile người khác
routerUser.get("/finduser/:name", getUsersByUsername);
routerUser.get('/mention-suggestions', authMiddleware, searchFriendsForMention);

export default routerUser;
