import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Chuyển về ObjectId tự động
    lastName: { type: String, required: true },
    firstName: { type: String, required: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    birthDate: { type: Date, required: true },
    gender: { type: String, enum: ["Male", "Female", "Other"], required: true },

    avatar: { type: String, default: "" },
    coverPhoto: { type: String, default: "" },
    status: { type: Boolean, default: true },
    role: { type: String, required: true, default: 0 },
    banned: { type: Boolean, default: false },
    education: { type: Object, default: [] }, // học vấn
    address: {
      street: { type: String, default: "" }, // Số nhà + Tên đường
      ward: { type: String, default: "" }, // Phường/Xã
      district: { type: String, default: "" }, // Quận/Huyện
      city: { type: String, default: "" }, // Thành phố/Tỉnh
      country: { type: String, default: "Vietnam" }, // Quốc gia (Mặc định là Việt Nam)
    },
    title: { type: String, default: "" }, // Danh sưng
    authProvider: { type: String, enum: ['local', 'google', 'facebook', 'twitter'], default: 'local' },
    authProviderId: { type: String },
    // Các tính năng mạng xã hội
  },
  { timestamps: true }
);
const User = mongoose.model("User", userSchema);
export default User;
