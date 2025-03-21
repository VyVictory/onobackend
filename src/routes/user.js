import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authGetProfile from "../middleware/authGetProfile.js";
import {
  getCurrentUser,
  getProfile,
  getUsersByUsername,
  searchFriendsForMention,
  searchUsers
} from "../controllers/userCTL.js";

const routerUser = express.Router();

routerUser.get("/profile", authMiddleware, getProfile);
routerUser.get("/profile/:id",authGetProfile, getCurrentUser); //xem profile người khác
routerUser.get("/finduser/:name", getUsersByUsername);
routerUser.get('/mention-suggestions', authMiddleware, searchFriendsForMention);
routerUser.get('/search', authMiddleware, searchUsers);

export default routerUser;
