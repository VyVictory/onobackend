import mongoose from "mongoose";

const configSchema = new mongoose.Schema({
  GOOGLE_CLIENT_ID:  { type: String, required: true },
  GOOGLE_CLIENT_SECRET:  { type: String, required: true },
  CALLBACK_URL:  { type: String, required: true },
});

const Config = mongoose.model("Config", configSchema);

export default Config;