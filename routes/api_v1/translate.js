var express = require('express');
var router = express.Router();

const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { JWT_SECRET } = require('../../config');

const Response = require('../../utils/generalResponse');
const AssertParam = require('../../utils/assertParam');
const { handleInternalError } = require('../../utils/internalError');
const { RequestError, handleRequestError } = require('../../utils/requestError');
const getTranslation = require('../../functions/translate');

router.post('/', async function (req, res, next) {
    const { text } = req.body;
    console.log('Text length:', text.length);
    try {
        const result = await getTranslation(text);
        res.send(Response.success({ text: result }));
    } catch (error) {
        console.error(error)
        handleRequestError(req, res, error)
    }
});

module.exports = router;