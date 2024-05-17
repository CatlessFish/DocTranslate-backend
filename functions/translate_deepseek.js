// NAIVE, no PREV, no CONTEXT

const { getChatCompletion, getChatCompletionStream } = require('./api');
// import { encode, isWithinTokenLimit } from 'gpt-tokenizer';
const { encode, isWithinTokenLimit, encodeChat } = require('gpt-tokenizer');
const { systemLog, fileAsConsole } = require('../utils/systemLog');
// const fileAsConsole = console;

const _defaultSystemMessage = `\
You are a English-Chinese Translator. Follow all the given instructions and constrictions carefully,\
 and generate translation step by step. Do not add any explanations.\
`

const init_prompt = `\
The English text given by USER is called "CURR_EN", it consists one or several segments.\
Each segment is formatted as "{{SEGMENT_NUMBER}}{text_to_translate}".\
Translate every segment, do not omit any segments. And for each segment, you should translate all the text after the line number.\
Generate an empty translation for a segment if the text in it is empty.\
`

const init_format_prompt = `\
You should return the text in the translated segments. The translation of two segments should be seperated by a linebreak('\n).\
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
        messages.push({ 'role': 'system', 'content': init_prompt });
        messages.push({ 'role': 'system', 'content': init_format_prompt });

        // Text to translate
        const usertext_with_lines = usertext.split('\n');
        // const usertext_with_lines = usertext;
        messages.push({ 'role': 'user', 'content': '\n===START OF CURR_EN===\n' });
        usertext_with_lines.forEach((line, linenum) => {
            if (linenum == usertext_with_lines.length - 1 && line == '') return; // Avoid the last empty line
            formatted = `{SEGMENT_${linenum + 1}}\n` + line;
            messages.push({
                'role': 'user',
                'content': formatted,
            });
        });
        messages.push({ 'role': 'user', 'content': '\n===END OF CURR_EN===\n' });
        return messages;
    });
    return chunks;
};

// Truncate long text into smaller pieces
const textTrunc = (text) => {
    // text: string

    let result = [];
    const tokenLimit = 2000; // gpt-3.5-turbo supports maximum 4096 tokens in completion
    const lineLimit = 30;
    const MAX_SEGMENT_LENGTH = 1600;

    const segments = text.split('\n\n').filter((value) => value);
    segments.forEach((segment) => {
        let curr_seg = '';
        let linecount = 0;
        segment.split('\n').forEach((line) => {
            // console.log(`CurrSeg: ${encode(curr_seg).length} tokens, line: ${encode(line).length} tokens.`)
            if (linecount < lineLimit && isWithinTokenLimit(curr_seg + line, tokenLimit)) {
                // if (curr_seg.length + line.length <= MAX_SEGMENT_LENGTH) {
                curr_seg += line + '\n';
                linecount += 1;
            } else {
                result.push(curr_seg);
                curr_seg = line + '\n';
                linecount = 1;
            }
        })
        if (curr_seg != '')
            result.push(curr_seg);
        result[result.length - 1] = result[result.length - 1].trimEnd();
    })
    fileAsConsole.debug(`${result.length} Chunks in total.`)
    return result;
}

const getTranslation_deepseek = async (usertext) => {
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
        let curr_ctx = '';
        for (let i = 0, len = constructedMessagesChunks.length; i < len; i++) {
            const messages = constructedMessagesChunks[i];
            const messages_tokencount = encodeChat(messages, model = 'gpt-3.5-turbo').length;
            let ith_result;
            let _text;
            // Limit messages token
            if (messages.length === 0) throw new Error('Message exceed max token!');
            const userline = messages.filter((msg) => { return msg.role == 'user' }).length;
            fileAsConsole.debug(`Submitting Message Chunk ${i} with ${userline} lines.`);
            // console.debug(messages);
            // continue;
            // fileAsConsole.log(JSON.stringify(messages));
            let num_try = 0;
            const max_try = 3;
            while (true) {
                if (num_try >= max_try) {
                    fileAsConsole.error(`Abort Chunk ${i} after ${num_try} times.`);
                    fileAsConsole.error(`Aborted chunk with ${messages_tokencount} tokens:`, messages);
                    break;
                }
                num_try += 1;
                ith_result = await getChatCompletion(
                    messages,
                );
                // fileAsConsole.log(ith_result)

                // Process the result
                promptTokenCount.push(ith_result.usage?.prompt_tokens || 0);
                completionTokenCount.push(ith_result.usage?.completion_tokens || 0);
                const reason = ith_result.choices[0].finish_reason;
                // fileAsConsole.debug('Stop reason:' + reason);
                if (reason != 'stop') {
                    fileAsConsole.error('Unexpected finish reason:', reason, 'result:', ith_result, '\nRetrying...');
                    continue;
                }
                _text = ith_result.choices[0].message.content;
                console.log(ith_result.choices[0].message.content);
                fileAsConsole.debug(`Message Chunk [${i}] got response, text length = ${_text.length}`,);

                if (_text.length == 0) { fileAsConsole.error('text length = 0.\nRetrying...'); }
                else break;
            }

            // Some post-process
            let text;
            // if (Array.isArray(_text)) {
            //     text = _text.join('\n');
            // }
            // else { text = _text; }
            text = _text

            if (i != len - 1) { result += text + '\n'; }
            else { result += text; }
        } // end for
    } catch (e) {
        fileAsConsole.log(e);
        const err = e.message;
        fileAsConsole.error(err);
    }
    fileAsConsole.debug(promptTokenCount);
    fileAsConsole.debug(completionTokenCount);

    // Performance Analysis
    const endTime = Date.now();
    const pTok = promptTokenCount.reduce((prev, curr) => { return prev + curr }, 0);
    const cTok = completionTokenCount.reduce((prev, curr) => { return prev + curr }, 0);
    const price = pTok * 0.5 / 1000000 + cTok * 1.5 / 1000000;
    fileAsConsole.debug(`Time Consumed: ${endTime - startTime}ms.`)
    fileAsConsole.debug(`Total Usage: ${pTok} tokens in prompt, ${cTok} tokens in completion.\n$${price} in total.`)
    fileAsConsole.debug(`User text: ${usertext.split('\n').length} lines. Result text ${result.split('\n').length} lines.`)
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

    return { text: result, ...logMessage };
}

module.exports = getTranslation_deepseek;