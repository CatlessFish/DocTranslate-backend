const { getChatCompletion, getChatCompletionStream } = require('./api');
// import { encode, isWithinTokenLimit } from 'gpt-tokenizer';
const { encode, isWithinTokenLimit } = require('gpt-tokenizer');
const { systemLog, } = require('../utils/systemLog');
const fileAsConsole = console;

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
Step 1: Translate. In this task, there will be a piece of text given by USER, named "CURR_EN", \
and another piece of text given by SYSTEM, named "PREV_EN".
"PREV_EN" and "CURR_EN" are originally consequent text. You need to translate the text in "CURR_EN" into Chinese, considering the context and coreference in "PREV_EN".\
"CURR_EN" consists one or several lines, each line is formatted as "[LINE_NUMBER][text_to_translate].\
All the text after the [LINE_NUMBER] at the very beginning should be translated.\
Generate an empty translation for a line if the text in it is empty.\
`

const init_format_prompt = `\
The translation result should be a list of translated lines of text, correspoding to the "CURR_EN" text.
Return in JSON, which has the structure as\
{"chunk_num":the number of lines given in "CURR_EN", "text":[a list of the tranlated text], "context":the updated context}.\
Do not add any other things into the result.\
`

const following_format_prompt = `\
The translation result should be a list of translated lines of text, the length of the list must equal to\
the number of lines in CURR_EN.
Return in JSON, which has the structure as\
{"chunk_num":the number of lines given in "CURR_EN", "text":[a list of the tranlated text]}.\
Do not add any other things into the result.\
`

const context_alone_prompt = `\
Step 1: Revision. You will be given a piece of text by the USER named "CONTEXT" and another piece of text named "USERTEXT".\
"USERTEXT" consists one or several lines, each line is formatted as "[LINE_NUMBER][text_of_usertext].\
"CONTEXT" contains some background knowledge and previous information which are useful to "USERTEXT".\
You need to slightly adjust the "USERTEXT" according to the "CONTEXT" and make it looks natural.\
You should not change the meaning of USERTEXT, and don't add or remove any information. You need to return the revised usertext.\
Step 2: Compress. In this step, compress the original context to no more than 400 tokens.\
Step 3: Summarize. Generate a piece of abstract of the given text USERTEXT, the length of the abstract should be under 100 tokens.\
Step 4: Update. Now generate an updated context, do this by adding the compressed context and the abstract together.\
The updated context should not exceeds 500 tokens in total.\
`

const context_alone_format_prompt = `\
You should return the revised translation and the updated context in JSON format. The JSON should have a structure like:\
"{"context":the updated context, "text":[a list of lines of the revised usertext], "linenum":the number of lines in the revised usertext}"\
Do not add any other things in the result.
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
            messages.push({ 'role': 'system', 'content': init_format_prompt });
        } else {
            messages.push({ 'role': 'system', 'content': following_prompt });
            messages.push({ 'role': 'system', 'content': following_format_prompt });
        }
        prompts.forEach((prompt) => {
            messages.push({ 'role': 'system', 'content': prompt.content });
        });

        if (idx != 0) {
            messages.push({ 'role': 'system', 'content': 'PREV_EN:\n' + chunkedUserText[idx - 1] });
        }
        // Text to translate
        const usertext_with_lines = usertext.split('\n');
        // const usertext_with_lines = usertext;
        usertext_with_lines.forEach((line, linenum) => {
            const msg = linenum == 0 ? 'CURR_EN:\n' + `【${linenum + 1}】` + '\n' + line : `【${linenum + 1}】` + '\n' + line;
            messages.push({
                'role': 'user',
                'content': msg,
            });
        });
        return messages;
    });
    return chunks;
};

const doContextAdjust = async (translation, ctx) => {
    // translation: string[]
    // context: string
    const messages = [];
    messages.push({ 'role': 'system', 'content': context_alone_prompt });
    messages.push({ 'role': 'system', 'content': context_alone_format_prompt });
    messages.push({ 'role': 'user', 'content': 'CONTEXT:\n' + ctx });
    translation.forEach((line, idx) => {
        messages.push({ 'role': 'user', 'content': `USERTEXT:\n${idx}\n` + line });
    });
    fileAsConsole.debug(`Adjusting context, text with ${translation.length} lines, ctx with ${encode(ctx).length} tokens.`);
    fileAsConsole.debug(messages);
    const res = await getChatCompletion(messages);
    const rawJson = JSON.parse(res.choices[0].message.content);
    fileAsConsole.debug('Context Result:', rawJson);
    const { context, text, linenum } = rawJson;
    return { context, text };
}

// Truncate long text into smaller pieces
const textTrunc = (text) => {
    // text: string

    let result = [];
    const tokenLimit = 1500; // gpt-3.5-turbo supports maximum 4096 tokens in completion
    const lineLimit = 20;
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
        let curr_ctx = '';
        for (let i = 0, len = constructedMessagesChunks.length; i < len; i++) {
            const messages = constructedMessagesChunks[i];
            let ith_result;
            // Limit messages token
            if (messages.length === 0) throw new Error('Message exceed max token!');
            const userline = messages.filter((msg) => { return msg.role == 'user' }).length;
            fileAsConsole.debug(`Submitting Message Chunk ${i} with ${userline} lines.`);
            // console.debug(messages);
            // fileAsConsole.log(JSON.stringify(messages));

            ith_result = await getChatCompletion(
                messages,
            );

            // Process the result
            // fileAsConsole.log(ith_result)
            promptTokenCount.push(ith_result.usage?.prompt_tokens || 0);
            completionTokenCount.push(ith_result.usage?.completion_tokens || 0);
            const reason = ith_result.choices[0].finish_reason;
            // fileAsConsole.debug('Stop reason:' + reason);
            if (reason != 'stop') {
                fileAsConsole.error('Unexpected finish reason:', reason, 'result:', ith_result);
                continue;
            }
            const rawJson = JSON.parse(ith_result.choices[0].message.content);
            // fileAsConsole.debug(`Messages [${i}] got response:`, rawJson);
            let { chunk_num, text: _text, context } = rawJson;
            fileAsConsole.debug(`Message Chunk [${i}] got response, chunk_num=${chunk_num}, line_num=${_text.length}`,);

            // Feature: use context
            // if (i == 0) {
            //     if (!context) throw new Error('Context not found.')
            //     curr_ctx = context;
            // } else {
            //     tmp = await doContextAdjust(_text, curr_ctx);
            //     _text = tmp._text;
            //     curr_ctx = tmp.context;
            // }
            // generatedContext.push(curr_ctx);

            // Some post-process
            let text;
            if (Array.isArray(_text)) {
                if (_text.length == 0) { console.error('text length = 0'); }
                text = _text.join('\n')
            }
            else
                text = _text
            result += text + '\n';
        } // end for
    } catch (e) {
        fileAsConsole.log(e);
        const err = e.message;
        fileAsConsole.error(err);
    }
    console.debug(promptTokenCount);
    console.debug(completionTokenCount);

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

    return result;
}

module.exports = getTranslation;