import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import routerUser from "./routes/user.js";
import routerPost from "./routes/postApi.js";
import routerCmt from "./routes/cmtApi.js";
import routerGroup from "./routes/groupApi.js";
import routerNotifi from "./routes/notifiApi.js";
import { createServer } from "http";
import { initSocket } from "./config/socketConfig.js";
import routerFriendship from "./routes/friendshipApi.js";
import routerMessage from "./routes/mesApi.js";
import routerBookmark from "./routes/bookmarkApi.js";
import routerFollow from "./routes/followApi.js";
import passport from "./config/passport.js";
import routerReport from './routes/reportRoutes.js';
import routerLike from "./routes/likeApi.js";

const app = express();

// Enable CORS for your frontend (localhost:3000)
app.use(
  cors({
    origin: ["http://localhost:3000", "https://ono-ono.vercel.app"], // Allow only requests from localhost:3000
    methods: "GET,POST,PUT,DELETE", // Allow specific HTTP methods
    allowedHeaders: "Content-Type, Authorization",
    credentials: true,
  })
);

app.use(express.json());
app.use(passport.initialize());
app.use("/auth", authRoutes);
app.use("/user", routerUser);
app.use("/post", routerPost);
app.use("/like", routerLike);
app.use("/cmt", routerCmt);
app.use("/group", routerGroup);
app.use("/noti", routerNotifi);
app.use("/friend", routerFriendship);
app.use("/message", routerMessage);
app.use("/bookmark", routerBookmark);
app.use("/follow", routerFollow);
app.use('/report', routerReport);
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

const httpServer = createServer(app);
const io = initSocket(httpServer);


setInterval(() => {
  fetch("https://ono-wtxp.onrender.com")
    .then(() => console.log("Pinged Render!"))
    .catch((err) => console.error("Ping failed:", err));
}, 600000); // 10 phút
const PORT = process.env.PORT || 3001;
mongoose
  .connect(
    "mongodb+srv://vyvictory:1234567899@cluster0.vahim.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("Connected to MongoDB");
    httpServer.listen(PORT, () => {
      console.log("Server is running on port 3001");
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
  