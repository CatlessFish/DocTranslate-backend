const mongoose = require('mongoose');

const SquareEntrySchema = new mongoose.Schema({
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
    msgBoxId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MsgBox',
        required: true,
    },
});

const SquareEntryModel = mongoose.model('SquareEntry', SquareEntrySchema, 'square_entries');

module.exports = SquareEntryModel;