import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  checkLikeStatus,
  getLikeStats,
  like,
  unlike,
} from "../controllers/likeCTL.js";
const routerLike = express.Router();

routerLike.post("/like", authMiddleware, like);
routerLike.post("/unlike", authMiddleware, unlike);
routerLike.post("/check", authMiddleware, checkLikeStatus);
routerLike.post("/count", getLikeStats);
export default routerLike;
