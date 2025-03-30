import mongoose from 'mongoose';

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    members: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        role: { 
            type: String, 
            enum: ['admin', 'moderator', 'member'], 
            default: 'member' 
        },
        status: { 
            type: String, 
            enum: ['active', 'banned'], 
            default: 'active' 
        },
        banUntil: Date
    }],
    posts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    privacy: { 
        type: String, 
        enum: ['public', 'private'], 
        default: 'public' 
    }
}, { timestamps: true });

const Group = mongoose.model('Group', groupSchema);

export default Group;