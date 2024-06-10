const mongoose = require('mongoose');

const SessionSchema = new mongoose.Schema({
    _id: 'UUID',
    owner_id: { type: mongoose.Types.ObjectId, require: true },
    title: { type: String, required: true },
    folder: { type: String, required: false },

    user_text: { type: String, required: true },
    user_text_chunks: [{ chunk_num: { type: Number, required: true }, text: { type: String, required: true } }],
    result_text_chunks: [{ chunk_num: { type: Number, required: true }, text: { type: String, required: true } }],
    original_result_text_chunks: [{ chunk_num: { type: Number, required: true }, text: { type: String, required: true } }],

    user_dict_index: { type: Number, required: true },
    user_prompt_set_index: { type: Number, required: false },
    // no need to backup messagechunks
});

// Params: model name, schema, collection name
const SessionModel = mongoose.model('Session', SessionSchema, 'sessions');

module.exports = SessionModel;