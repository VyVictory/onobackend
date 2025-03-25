import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import authGetProfile from "../middleware/authGetProfile.js";
import multer from "multer";
import cloudinary from "../config/cloudinaryConfig.js";
import {CloudinaryStorage} from 'multer-storage-cloudinary';
import { uploadUserPhotos } from '../middleware/uploadMiddleware.js';
import {
  getCurrentUser,
  getProfile,
  getUsersByUsername,
  searchFriendsForMention,
  searchUsers,
  updateUserProfile
} from "../controllers/userCTL.js";

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
      folder: 'users', // Thư mục trên Cloudinary
      allowed_formats: ['jpg', 'png', 'gif','jfif'], // Các định dạng cho phép
  },
});
const routerUser = express.Router();

routerUser.get("/profile", authMiddleware, getProfile);
routerUser.get("/profile/:id",authGetProfile, getCurrentUser); //xem profile người khác
routerUser.get("/finduser/:name", getUsersByUsername);
routerUser.get('/mention-suggestions', authMiddleware, searchFriendsForMention);
routerUser.get('/search', authMiddleware, searchUsers);
routerUser.put('/profile/update', authMiddleware,uploadUserPhotos, updateUserProfile);

export default routerUser;
