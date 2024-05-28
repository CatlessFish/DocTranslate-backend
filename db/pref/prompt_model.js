const mongoose = require('mongoose');

const PromptSchema = new mongoose.Schema({
    _id: 'UUID',
    content: {
        type: String,
        required: true,
    },
    owner_id: {
        type: mongoose.Types.ObjectId,
        required: true,
    },
});

// Params: model name, schema, collection name
const PromptModel = mongoose.model('Prompt', PromptSchema, 'prompts');

module.exports = PromptModel;