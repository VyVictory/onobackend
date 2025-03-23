import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, auto: true }, // Chuyển về ObjectId tự động
    lastName: { type: String, required: function() {
        return !this.googleId; // Chỉ bắt buộc nếu không phải tài khoản Google
    }},
    firstName: { type: String, required: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: function() {
        return !this.googleId; // Chỉ bắt buộc nếu không phải tài khoản Google
    }},
    birthDate: { type: Date, required: function() {
        return !this.googleId; // Chỉ bắt buộc nếu không phải tài khoản Google
    }},
    gender: { type: String, enum: ["Male", "Female", "Other"], required: function() {
        return !this.googleId; // Chỉ bắt buộc nếu không phải tài khoản Google
    }},
    avatar: { type: String, default: "" },
    coverPhoto: { type: String, default: "" },
    status: { type: Boolean, default: false },
    role: { type: String, required: true, default: 0 },                          //role = admin update
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
    resetPasswordToken: String,
    resetPasswordExpiry: Date,
    googleId: { type: String },
    // Các tính năng mạng xã hội
  },
  { timestamps: true }
);

// Thêm indexes
userSchema.index({ firstName: 1 });
userSchema.index({ lastName: 1 });
userSchema.index({ email: 1 });
userSchema.index({ firstName: 'text', lastName: 'text' }); // Text search index

const User = mongoose.model("User", userSchema);
export default User;
