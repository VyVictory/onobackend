import mongoose from 'mongoose';

const bookMarkSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    savedAt: { type: Date, default: Date.now }
});

bookMarkSchema.index({ user: 1, post: 1 }, { unique: true });

const Bookmark = mongoose.model('Bookmark', bookMarkSchema);
export default Bookmark;
