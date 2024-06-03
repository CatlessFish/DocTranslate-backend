const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    user_text: { type: String, required: true },
    result_text: { type: String, required: true },
    original_result_text: { type: String, required: true },
    user_text_chunks: [{ chunk_num: { type: Number, required: true }, text: { type: String, required: true } }],
    result_text_chunks: [{ chunk_num: { type: Number, required: true }, text: { type: String, required: true } }],
    original_result_text_chunks: [{ chunk_num: { type: Number, required: true }, text: { type: String, required: true } }],
    user_dict_index: { type: Number, required: true },
});

const ChatSchema = new mongoose.Schema({
    _id: 'UUID',
    title: { type: String, required: true },
    task: { type: TaskSchema, required: true },
    owner_id: { type: mongoose.Types.ObjectId, require: true },
});

// Params: model name, schema, collection name
const ChatModel = mongoose.model('Chat', ChatSchema, 'chats');

module.exports = ChatModel;