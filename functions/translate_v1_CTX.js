// CONTEXT, no PREV

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
Step 1: Translate. The English text given by USER is called "CURR_EN", it consists one or several segments.\
Each segment is formatted as "{{SEGMENT_NUMBER}}{text_to_translate}".\
Translate every segment, do not omit any segments. And for each segment, you should translate all the text after the line number.\
Generate an empty translation for a segment if the text in it is empty.\
Step 2: Summarize. You should summarize the information in your translation and form a CONTEXT,\
for the following tasks to reference. The context should not exceeds 500 tokens.\
`

const following_prompt = `\
Step 1: Translate. In this task, there will be a piece of text given by USER, named "CURR_EN", \
and another piece of text given by SYSTEM named "CONTEXT"
"CONTEXT" contains some context and background knowledge with respect to CURR_EN.\
You need to translate the text in "CURR_EN" into Chinese, considering the context in "CONTEXT".\
"CURR_EN" consists one or several segments. Each segment is formatted as "{{SEGMENT_NUMBER}}{text_to_translate}".\
Translate every segment between the START and END of CURR_EN, do not omit any segments. And for each segment, you should translate all the text after the line number.\
Generate an empty translation for a segment if the text in it is empty.\
Do not translate the text in "CONTEXT".
`

const init_format_prompt = `\
The translation result should be a list of translated segments of text.\
The length of the list must equal to the number of segments given in CURR_EN.\
Return in JSON, which has the structure as \
{"seg_num":the number of segments given in "CURR_EN", "text":[a list of the tranlated segments], "context":the summarized context}.\
Do not add any other things into the result.\
`

const following_format_prompt = `\
The translation result should be a list of translated segments of text.\
The length of the list must equal to the number of segments given in CURR_EN.\
Return in JSON, which has the structure as \
{"seg_num":the number of segments given in "CURR_EN", "text":[a list of the tranlated segments]}.\
Do not add any other things into the result.\
`

const context_update_prompt = `\
You will be given a piece of text by the USER named "CONTEXT" and another piece of text named "USERTEXT".\
Each piece of text is wrapped between an "BEGIN" and "END" pair. Follow the instructions below, do it step by step.
Step 1: Compress. In this step, compress the original context to no more than 400 tokens.\
Step 2: Summarize. Generate a piece of abstract of the given text USERTEXT, the length of the abstract should be under 100 tokens.\
Step 3: Update. Now generate an updated context, do this by adding the compressed context and the abstract together.\
The updated context should not exceeds 500 tokens in total.\
You should return the updated context in JSON format. The JSON should have a structure like:\
"{"context":the updated context}" Do not add any other things in the result.
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

const doContextAdjust = async (translation, ctx) => {
    // translation: string[]
    // context: string
    const messages = [];
    messages.push({ 'role': 'system', 'content': context_update_prompt });
    messages.push({ 'role': 'user', 'content': '\n===BEGIN OF CONTEXT===\n' + ctx + '\n===END OF CONTEXT===\n' });
    messages.push({ 'role': 'user', 'content': '\n===BEGIN OF USERTEXT===\n' });
    translation.forEach((line, idx) => {
        messages.push({ 'role': 'user', 'content': `USERTEXT:\n${idx}\n` + line });
    });
    messages.push({ 'role': 'user', 'content': '\n===END OF USERTEXT===\n' });
    fileAsConsole.debug(`Adjusting context, text with ${translation.length} lines, ctx with ${encode(ctx).length} tokens.`);
    const res = await getChatCompletion(messages);
    const rawJson = JSON.parse(res.choices[0].message.content);
    fileAsConsole.debug('Context Result:', rawJson);
    const { context } = rawJson;
    return context;
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

const getTranslation_v1_CTX = async (usertext) => {
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

            // Insert Context
            if (i != 0) {
                messages.push({ 'role': 'system', 'content': '\n===BEGIN OF CONTEXT===\n' + curr_ctx + '\n===END OF CONTEXT===\n' });
            };

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
                const rawJson = JSON.parse(ith_result.choices[0].message.content);
                // fileAsConsole.debug(`Messages [${i}] got response:`, rawJson);
                let { seg_num, context } = rawJson;
                _text = rawJson.text;
                fileAsConsole.debug(`Message Chunk [${i}] got response, seg_num=${seg_num}, line_num=${_text.length}`,);
                if (_text.length == 0) { fileAsConsole.error('text length = 0.\nRetrying...'); continue; }

                if (i == 0) {
                    curr_ctx = context;
                } else {
                    curr_ctx = doContextAdjust(_text, curr_ctx);
                }

                break;
            }

            // Some post-process
            let text;
            if (Array.isArray(_text)) {
                text = _text.join('\n');
            }
            else { text = _text; }

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

module.exports = getTranslation_v1_CTX;