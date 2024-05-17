const default_endpoint = 'https://api.openai.com/v1/chat/completions';

const default_model = 'gpt-4-turbo';

const default_config = {
    temperature: 0.1, // Low temp is better for translation tasks
    presence_penalty: 0,
    top_p: 1,
    frequency_penalty: 0,
    max_tokens: 4096,
    response_format: { "type": "json_object" },
};

module.exports = { default_config, default_endpoint, default_model };