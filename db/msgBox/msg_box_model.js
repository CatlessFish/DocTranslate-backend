const mongoose = require('mongoose');

const MsgBoxSchema = new mongoose.Schema({
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
    content: {
        type: Object,
        // 文字，背景图片，...
    },
    settings: {
        type: Object,
        // 是否允许提问，是否允许匿名，...
    },
    entries: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MsgBoxEntry',
    }],
});

const MsgBoxModel = mongoose.model('MsgBox', MsgBoxSchema, 'msg_boxes');

module.exports = MsgBoxModel;