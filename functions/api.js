// const { default_config, default_endpoint, default_model } = require("./configuration_4");
// const { default_config, default_endpoint, default_model } = require("./configuration_ds");
const { default_config, default_endpoint, default_model } = require("./configuration");
const { API_KEY } = require('../config');

const getChatCompletion = async (
    messages,
    config = default_config,
    endpoint = default_endpoint,
    model = default_model,
    apiKey = API_KEY,
    customHeaders = {}
) => {
    const headers = {
        'Content-Type': 'application/json',
        ...customHeaders,
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            messages,
            ...config,
            model,
        }),
    });
    if (!response.ok) {
        // console.log(await response.text());
        throw new Error(await response.text());
    };

    const data = await response.json();
    // console.log(response)
    return data;
};

const getChatCompletionStream = async (
    messages,
    endpoint = default_endpoint,
    model = default_model,
    config = default_config,
    apiKey = API_KEY,
    customHeaders = {}
) => {
    const headers = {
        'Content-Type': 'application/json',
        ...customHeaders,
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            messages,
            ...config,
            model,
            max_tokens: undefined,
            stream: true,
        }),
    });

    if (response.status === 404 || response.status === 405) {
        const text = await response.text();

        if (text.includes('model_not_found')) {
            throw new Error(
                text +
                'Model Not Found!'
            );
        } else {
            throw new Error(
                'Invalid API endpoint!'
            );
        }
    }

    if (response.status === 429 || !response.ok) {
        const text = await response.text();
        let error = text;
        if (text.includes('insufficient_quota')) {
            error +=
                '\nInsufficient Quota!';
        } else if (response.status === 429) {
            error += '\nRate limited!';
        }
        throw new Error(error);
    }

    const stream = response.body;
    return stream;
};

module.exports = { getChatCompletion, getChatCompletionStream };