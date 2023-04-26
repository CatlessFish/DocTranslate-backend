const mongoose = require('mongoose');

const MsgBoxEntrySchema = new mongoose.Schema({
    // mid: {
    //     type: Number,
    // },
    boxOwner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    msgOwner: {
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
    public: {
        type: Boolean,
        default: false,
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

const MsgBoxEntryModel = mongoose.model('MsgBoxEntry', MsgBoxEntrySchema, 'msg_box_entries');

module.exports = MsgBoxEntryModel;