// CONTEXT, no PREV

const { getChatCompletion, getChatCompletionStream } = require('./api');
// import { encode, isWithinTokenLimit } from 'gpt-tokenizer';
const { encode, isWithinTokenLimit, encodeChat } = require('gpt-tokenizer');
const { systemLog, fileAsConsole } = require('../utils/systemLog');
const { default_config } = require('./configuration');
// const fileAsConsole = console;

const _defaultSystemMessage = `\
You are a English-Chinese Translator. Follow all the given instructions and constrictions carefully,\
 and generate translation step by step. Do not add any explanations.\
`

const init_prompt = `\
Step 1: Translate. The English text given by USER is called "CURR_EN", it consists one or several segments.\
Each segment is formatted as "{{SEGMENT_NUMBER}}{text_to_translate}".\
Translate every segment into Simplified Chinese, do not omit any segments. And for each segment, you should translate all the text after the line number.\
Generate an empty translation for a segment if the text in it is empty.\
Step 2: Summarize. You should summarize the information in your translation and form a CONTEXT,\
for the following tasks to reference. The context should not exceeds 500 tokens.\
`

const following_prompt = `\
Task: Translate. In this task, there will be a piece of text given by USER, named "CURR_EN", a piece of text named "PREV_EN", \
and another piece of text given by USER named "CONTEXT"
"PREV_EN" and "CONTEXT" contains some context and background knowledge with respect to CURR_EN.\
You need to translate the text in "CURR_EN" into Simplified Chinese, considering the context in "CONTEXT" and "PREV_EN".\
"CURR_EN" consists one or several segments. Each segment is formatted as "{{SEGMENT_NUMBER}}{text_to_translate}".\
Requirements: Translate every segment between the START and END of CURR_EN, do not omit any segments. And for each segment, you should translate all the text after the line number.\
Generate an empty translation for a segment if the text in it is empty.\
Do not translate the text in "CONTEXT".
`

const init_format_prompt = `\
The translation result should be a list of translated segments of text.\
The length of the list must equal to the number of segments given in CURR_EN.\
Return in JSON, which has the structure as \
{"seg_num":the number of segments given in "CURR_EN", "text":[a list of the text of tranlated segments], "context":the summarized context}.\
The list of texts should not contain the line number. Do not add any other things into the result.\
`

const following_format_prompt = `\
The translation result should be a list of translated segments of text.\
The length of the list must equal to the number of segments given in CURR_EN.\
Return in JSON, which has the structure as \
{"seg_num":the number of segments given in "CURR_EN", "text":[a list of the text of tranlated segments]}.\
The list of texts should not contain the line number. Do not add any other things into the result.\
`

const context_update_prompt = `\
Summarize the information in the given text and generate an abstract.\
The length of the abstract should be less than 300 words.
You should return in JSON format. The JSON should have a structure like:\
"{"context":the abstract}" Do not add any other things in the result.
`

const dictEntryFilter = (text, dict) => {
    // text: string
    // dict: UserDictInterface
    // RETURNS: UserDictEntryInterface[]
    const result = [];
    if (!Array.isArray(dict.entries) || dict.entries.length == 0) return result;
    dict.entries.forEach((entry) => {
        const words = entry.source.split(' ');
        // console.debug(words, text);
        let count = 0;
        words.forEach((word) => {
            if (text.includes(word)) count += 1;
        })
        if (count >= words.length)
            result.push(entry);
    })
    console.log(`${result.length} dict entries matched.`);
    return result;
}

const dictEntryToPrompt = (entry) => {
    return `You should translate "${entry.source}" into "${entry.target}"`;
}

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

        // UserDict
        const referencedEntries = dictEntryFilter(usertext, dict);
        referencedEntries.forEach((entry) => {
            messages.push({ 'role': 'system', 'content': dictEntryToPrompt(entry) });
        });

        // UserPrompt
        if (Array.isArray(prompts) && prompts.length > 0) {
            prompts.forEach((prompt) => {
                messages.push({ 'role': 'system', 'content': prompt.content });
            });
        }

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
    messages.push({ 'role': 'user', 'content': ctx + '\n' + translation.join('\n') });
    fileAsConsole.debug(`Adjusting context, text with ${translation.length} lines, ctx with ${encode(ctx).length} tokens.`);
    const res = await getChatCompletion(
        messages,
        config = {
            ...default_config,
            max_tokens: 600,
        },
    );
    const pTok = res.usage?.prompt_tokens || 0;
    const cTok = res.usage?.completion_tokens || 0;
    const rawJson = JSON.parse(res.choices[0].message.content);
    const { context } = rawJson;
    fileAsConsole.debug(`New context (${encode(context).length} tokens):`, rawJson);
    return { context, pTok, cTok };
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

const getTranslation_v1_FULL = async (usertext, userdict = {}, userprompt = []) => {
    console.log(`Dict length: ${userdict.entries?.length}, Prompt num: ${userprompt.length}`);
    const chunks = textTrunc(usertext);
    const constructedMessagesChunks = constructPrompt(chunks, userdict, userprompt);
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
                // restrict length
                messages.push({ 'role': 'user', 'content': '\n===BEGIN OF CONTEXT===\n' + curr_ctx + '\n===END OF CONTEXT===\n' });
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
                fileAsConsole.debug('TEXT:', _text);
                if (_text.length == 0 || seg_num > _text.length || (_text.length - seg_num > 3)) {
                    fileAsConsole.error('text length error.\nRetrying...');
                    continue;
                }

                if (i == 0) {
                    curr_ctx = context;
                } else {
                    // Parallize?
                    const adjust_result = await doContextAdjust(_text, curr_ctx);
                    curr_ctx = adjust_result.context
                    promptTokenCount.push(adjust_result.pTok);
                    completionTokenCount.push(adjust_result.cTok);
                }
                generatedContext.push(curr_ctx);

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

module.exports = getTranslation_v1_FULL;