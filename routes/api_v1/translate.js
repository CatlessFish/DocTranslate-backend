var express = require('express');
var router = express.Router();

const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { JWT_SECRET } = require('../../config');

const Response = require('../../utils/generalResponse');
const AssertParam = require('../../utils/assertParam');
const { handleInternalError } = require('../../utils/internalError');
const { RequestError, handleRequestError } = require('../../utils/requestError');
const getTranslation_NAI = require('../../functions/translate_v1_NAI');
const getTranslation_CTX = require('../../functions/translate_v1_CTX');
const getTranslation_PRE = require('../../functions/translate_v1_PRE');
const getTranslation_BOTH = require('../../functions/translate_v1_BOTH');
const getTranslation_FULL = require('../../functions/translate_v1_FULL');
const getTranslation_gpt4 = require('../../functions/translate_gpt4');
const getTranslation_gpt4_NAI = require('../../functions/translate_gpt4_NAI');
const getTranslation_deepseek = require('../../functions/translate_deepseek');
// const getTranslation = require('../../functions/translate');

router.post('/NAI', async function (req, res, next) {
    const { text } = req.body;
    console.log('[NAI] Text length:', text.length);
    try {
        const result = await getTranslation_NAI(text);
        res.send(Response.success({ ...result }));
    } catch (error) {
        console.error(error)
        handleRequestError(req, res, error)
    }
});

router.post('/CTX', async function (req, res, next) {
    const { text } = req.body;
    console.log('[CTX] Text length:', text.length);
    try {
        const result = await getTranslation_CTX(text);
        res.send(Response.success({ ...result }));
    } catch (error) {
        console.error(error)
        handleRequestError(req, res, error)
    }
});

router.post('/PRE', async function (req, res, next) {
    const { text } = req.body;
    console.log('[PRE] Text length:', text.length);
    try {
        const result = await getTranslation_PRE(text);
        res.send(Response.success({ ...result }));
    } catch (error) {
        console.error(error)
        handleRequestError(req, res, error)
    }
});

router.post('/BOTH', async function (req, res, next) {
    const { text } = req.body;
    console.log('[BOTH] Text length:', text.length);
    try {
        const result = await getTranslation_BOTH(text);
        res.send(Response.success({ ...result }));
    } catch (error) {
        console.error(error)
        handleRequestError(req, res, error)
    }
});

router.post('/FULL', async function (req, res, next) {
    const { text, dict, prompts } = req.body;
    console.log('[FULL] Text length:', text.length);
    try {
        const result = await getTranslation_FULL(text, dict, prompts);
        res.send(Response.success({ ...result }));
    } catch (error) {
        console.error(error)
        handleRequestError(req, res, error)
    }
});

router.post('/gpt4', async function (req, res, next) {
    const { text } = req.body;
    console.log('[GPT4] Text length:', text.length);
    try {
        const result = await getTranslation_gpt4(text);
        res.send(Response.success({ ...result }));
    } catch (error) {
        console.error(error)
        handleRequestError(req, res, error)
    }
});

router.post('/gpt4_NAI', async function (req, res, next) {
    const { text } = req.body;
    console.log('[GPT4] Text length:', text.length);
    try {
        const result = await getTranslation_gpt4_NAI(text);
        res.send(Response.success({ ...result }));
    } catch (error) {
        console.error(error)
        handleRequestError(req, res, error)
    }
});

router.post('/deepseek', async function (req, res, next) {
    const { text } = req.body;
    console.log('[DeepSeek] Text length:', text.length);
    try {
        const result = await getTranslation_deepseek(text);
        res.send(Response.success({ ...result }));
    } catch (error) {
        console.error(error)
        handleRequestError(req, res, error)
    }
});

module.exports = router;