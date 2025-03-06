import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js'; 
import routerUser from './routes/user.js';
import routerPost from './routes/postApi.js';
import routerCmt from './routes/cmtApi.js';
import routerGroup from './routes/groupApi.js';
import routerNotifi from './routes/notifiApi.js';
import passport from 'passport';
const app = express();

// Enable CORS for your frontend (localhost:3000)
app.use(
  cors({
    origin: [
      "http://localhost:3000", 
      "https://ono-ono.vercel.app",
    ], // Allow only requests from localhost:3000
    methods: "GET,POST,PUT,DELETE", // Allow specific HTTP methods
    allowedHeaders: "Content-Type, Authorization", // Allow specific headers
  })
);

app.use(express.json());
app.use(passport.initialize());

app.use("/auth", authRoutes);
app.use("/user", routerUser);
app.use("/post", routerPost);
app.use("/cmt", routerCmt);
app.use("/group", routerGroup);
app.use("/noti", routerNotifi);
app.use((err, req, res, next) => {
  console.error("Server Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

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
    // Start the server after successful connection
    app.listen(3001, () => {
      console.log("Server is running on port 3001");
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
