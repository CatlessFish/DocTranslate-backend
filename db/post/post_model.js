const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    private: {
        type: Boolean,
        default: false,
    },
    visibleTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    entryAt: {
        type: Object,
        required: true,
    },
    content: {
        type: Object,
        required: true,
    },
});

const PostModel = mongoose.model('Post', postSchema, 'posts');

module.exports = PostModel;