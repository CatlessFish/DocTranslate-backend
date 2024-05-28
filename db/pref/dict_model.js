const mongoose = require('mongoose');

const DictSchema = new mongoose.Schema({
    _id: 'UUID',
    owner_id: {
        type: mongoose.Types.ObjectId,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    entries: {
        type: [{
            source: { type: String, required: true },
            target: { type: String, required: true },
        }],
    }
});

// Params: model name, schema, collection name
const DictModel = mongoose.model('Dict', DictSchema, 'dicts');

module.exports = DictModel;