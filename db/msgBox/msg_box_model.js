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
    description: {
        type: Object,
    },
    entries: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MsgBoxEntry',
    }],
});

const MsgBoxModel = mongoose.model('MsgBox', MsgBoxSchema, 'msg_boxes');

module.exports = MsgBoxModel;