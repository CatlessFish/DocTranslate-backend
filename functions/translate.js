const { getChatCompletion, getChatCompletionStream } = require('./api');
// import { encode, isWithinTokenLimit } from 'gpt-tokenizer';
const { encode, isWithinTokenLimit } = require('gpt-tokenizer');
const { systemLog } = require('../utils/systemLog');

const _defaultSystemMessage = `\
You are a English-Chinese Translator. Follow all the given instructions and constrictions carefully,\
 and generate translation step by step. Do not add any explanations.\
`

const init_prompt = `\
Step 1: Translate. The English text given by USER is called "CURR_EN", it consists one or several lines.\
Each line is formatted as "[LINE_NUMBER][text_to_translate].\
For each line, all the text after the [LINE_NUMBER] at the very beginning should be translated.\
Generate an empty translation for a line if the text in it is empty.\
Step 2: Summarize. You should summarize the information in your translation and form a CONTEXT,\
for the following tasks to reference. The context should not exceeds 500 tokens.\
`

const following_prompt = `\
Step 1: Translate. In this task, there will be two pieces of text given by USER, namely "PREV_EN" and "CURR_EN".\
"PREV_EN" and "CURR_EN" are originally consequent text. You need to translate the text in "CURR_EN" into Chinese, considering the context and coreference in "PREV_EN".\
"CURR_EN" consists one or several lines, each line is formatted as "[LINE_NUMBER][text_to_translate].\
All the text after the [LINE_NUMBER] at the very beginning should be translated.\
Generate an empty translation for a line if the text in it is empty.\
`

const context_prompt = `\
Step 2: Revision. There will be another piece of text given by the USER named "CONTEXT". It contains the information of those text\
prior to the given text in this task. Please adjust your tranlation result according to the context.\
Step 3: Summarize. In this step, first compress the original context to no more than 400 tokens;\
Next generate a piece of abstract of the given text CURR_EN, the length of the abstract should be under 100 tokens.\
Then update the context by adding the compressed context and the abstract together.\
The updated context should not exceeds 500 tokens in total. You should return the updated context.\
`

const format_prompt = `\
The translation result should be a list of translated lines of text, correspoding to the "CURR_EN" text.
Return in JSON, which has the structure as\
{"chunk_num":the number of lines given in "CURR_EN", "text":[a list of the tranlated text], "context":the updated context}.\
Do not add any other things into the result.\
`

const constructPrompt = (chunkedUserText, dict = {}, prompts = []) => {
    // ChunkedUserText: string[]
    // dict: UserDictInterface
    // prompts: UserPromptInterface[]
    // RETURNS: MessageChunkInterface[]
    const chunks = chunkedUserText.map((usertext, idx) => {
        const messages = [];
        messages.push({ 'role': 'system', 'content': _defaultSystemMessage });
        // Task introduction
        if (idx == 0) {
            messages.push({ 'role': 'system', 'content': init_prompt });
        } else {
            messages.push({ 'role': 'system', 'content': following_prompt });
        }
        // messages.push({ 'role': 'system', 'content': linebreak_prompt });
        messages.push({ 'role': 'system', 'content': format_prompt });

        // User Preferences, including vocab and prompt
        // const referencedEntries = dictEntryFilter(usertext, dict);
        // referencedEntries.forEach((entry) => {
        //     messages.push({ 'role': 'system', 'content': dictEntryToPrompt(entry) });
        // });
        prompts.forEach((prompt) => {
            messages.push({ 'role': 'system', 'content': prompt.content });
        })

        // Text to translate
        const usertext_with_lines = usertext.split('\n');
        // const usertext_with_lines = usertext;
        if (idx == 0) {
            usertext_with_lines.forEach((line, linenum) => {
                messages.push({
                    'role': 'user',
                    'content': 'CURR_EN:\n' + `【${linenum}】` + '\n' + line
                });
            });
        } else {
            messages.push({ 'role': 'user', 'content': 'PREV_EN:\n' + chunkedUserText[idx - 1] });
            usertext_with_lines.forEach((line, linenum) => {
                messages.push({
                    'role': 'user',
                    'content': 'CURR_EN:\n' + `【${linenum}】` + '\n' + line
                });
            });
        }
        return messages;
    });
    return chunks;
};

const addContextToPrompt = (messages, context = '') => {
    // messages: MessageChunkInterface
    // context: string
    messages.push({ 'role': 'system', 'content': context_prompt });
    messages.push({ 'role': 'user', 'content': 'CONTEXT:\n' + context });
    return messages;
}

// Truncate long text into smaller pieces
const textTrunc = (text) => {
    // text: string

    // Strategy: consider '\n\n' as a deliminator of a paragraph
    let result = [];
    const tokenLimit = 2048; // gpt-3.5-turbo supports maximum 4096 tokens in completion
    const MAX_SEGMENT_LENGTH = 1600;

    const segments = text.split('\n\n').filter((value) => value);
    segments.forEach((segment) => {
        let curr_seg = '';
        segment.split('\n').forEach((line) => {
            if (isWithinTokenLimit(curr_seg + line, tokenLimit)) {
                // if (curr_seg.length + line.length <= MAX_SEGMENT_LENGTH) {
                curr_seg += line + '\n';
            } else {
                result.push(curr_seg);
                curr_seg = line + '\n';
            }
        })
        if (curr_seg != '')
            result.push(curr_seg);
    })

    // result.forEach((seg) => {
    //     console.log(seg);
    // })
    return result;
}

const getTranslation = async (usertext) => {
    const chunks = textTrunc(usertext);
    const constructedMessagesChunks = constructPrompt(chunks);
    // For performance Analysis
    systemLog({ type: 'ConstructedMessages', constructedMessagesChunks });
    const promptTokenCount = [];
    const completionTokenCount = [];
    const startTime = Date.now();
    const generatedContext = [];

    let result = '';
    try {
        for (let i = 0, len = constructedMessagesChunks.length; i < len; i++) {
            const messages = constructedMessagesChunks[i];
            let ith_result;
            // Limit messages token
            if (messages.length === 0) throw new Error('Message exceed max token!');
            console.debug(`[handleSubmit] Submitting Messages ${i}: `, messages);
            // console.log(JSON.stringify(messages));

            ith_result = await getChatCompletion(
                messages,
            );

            // Process the result
            // console.log(ith_result)
            promptTokenCount.push(ith_result.usage?.prompt_tokens || 0);
            completionTokenCount.push(ith_result.usage?.completion_tokens || 0);
            const reason = ith_result.choices[0].finish_reason;
            if (reason != 'stop') {
                console.error('Unexpected finish reason:', reason, 'result:', ith_result);
                continue;
            }
            const rawJson = JSON.parse(ith_result.choices[0].message.content);
            console.debug(`Messages [${i}] got response:`, rawJson);
            // console.log(JSON.stringify(rawJson));
            const { chunk_num, text: _text, context } = rawJson;
            generatedContext.push(context);
            // Some post-process
            let text;
            if (Array.isArray(_text))
                text = _text.join('\n')
            else
                text = _text
            // console.debug(text.split('\n').length);

            // Feature: use context
            if (i + 1 < len)
                constructedMessagesChunks[i + 1] = addContextToPrompt(constructedMessagesChunks[i + 1], context);

            result += text + '\n';
        } // end for
    } catch (e) {
        console.log(e);
        const err = e.message;
        console.error(err);
    }

    // Performance Analysis
    const endTime = Date.now();
    const pTok = promptTokenCount.reduce((prev, curr) => { return prev + curr }, 0);
    const cTok = completionTokenCount.reduce((prev, curr) => { return prev + curr }, 0);
    const price = pTok * 0.5 / 1000000 + cTok * 1.5 / 1000000;
    console.debug(`Time Consumed: ${endTime - startTime}ms.`)
    console.debug(`Total Usage: ${pTok} tokens in prompt, ${cTok} tokens in completion.\n$${price} in total.`)
    console.debug(`User text: ${usertext.split('\n').length} lines. Result text ${result.split('\n').length} lines.`)
    systemLog({
        type: 'Context',
        generatedContext,
    });
    const logMessage = {
        type: 'TaskDigest',
        textLength: usertext.length,
        textTokens: encode(usertext).length,
        chunkNum: constructedMessagesChunks.length,
        promptTokens: pTok,
        completionTokens: cTok,
        totalTokens: pTok + cTok,
        totalPrice: price,
        timeConsumed: endTime - startTime,
    }
    systemLog(logMessage);

    return result;
}

module.exports = getTranslation;