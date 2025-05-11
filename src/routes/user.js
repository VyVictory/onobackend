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
  updateUserProfile,
  getUsers,
  toggleUserBan,
  deleteUser
} from "../controllers/userCTL.js";
import { isAdmin } from "../middleware/authMiddleware.js";

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
routerUser.get('/admin/users',authMiddleware,isAdmin, getUsers);
routerUser.put('/admin/users/:userId/ban',authMiddleware, isAdmin, toggleUserBan);
routerUser.delete('/admin/users/:userId',authMiddleware, isAdmin, deleteUser);

export default routerUser;
