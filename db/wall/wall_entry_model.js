const mongoose = require('mongoose');

const WallEntrySchema = new mongoose.Schema({
    // wid: {
    //     type: Number,
    // },
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
    initialPost: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
        required: true,
    },
    posts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post',
    }],
});

const WallEntryModel = mongoose.model('WallEntry', WallEntrySchema, 'wall_entries');

module.exports = WallEntryModel;