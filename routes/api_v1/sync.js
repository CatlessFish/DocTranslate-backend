var express = require('express');
var router = express.Router();

const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { User, Prompt, Dict } = require('../../db/models');
const { JWT_SECRET } = require('../../config');

const Response = require('../../utils/generalResponse');
const AssertParam = require('../../utils/assertParam');
const { handleInternalError } = require('../../utils/internalError');
const { RequestError, handleRequestError } = require('../../utils/requestError');
const auth = require('../../middleware/auth');
const { isValidObjectId } = require('mongoose');

router.post('/upload', auth, async function (req, res, next) {
    const user = req.user;
    const { syncType, data } = req.body;
    // console.log(req.body);
    const returnData = new Promise(async (resolve, reject) => {
        switch (syncType) {
            case 'chat':
                resolve();
                break;
            case 'userdict':
                const dict = data.userdict;
                if (dict) {
                    const query = Dict.findByIdAndUpdate(
                        dict.id,
                        {
                            ...dict,
                            owner_id: user._id,
                        },
                        {
                            upsert: true,
                            select: '_id',
                        }
                    );
                    query.then((updated_doc) => {
                        resolve({ updated: updated_doc._id.toString() });
                        console.log(updated_doc._id.toString());
                    })
                } else {
                    reject('Invalid Param');
                }
                break;
            case 'userprompt':
                const prompts = data.userprompt;
                if (prompts instanceof Array) {
                    const queries = Promise.all(prompts.map(async (prompt) => {
                        console.log(prompt.id, prompt.content);
                        return Prompt.findByIdAndUpdate(
                            prompt.id,
                            {
                                content: prompt.content,
                                owner_id: user._id,
                            },
                            {
                                upsert: true,
                                new: true,
                                select: '_id',
                            },
                        );
                    }));
                    queries.then((updated_docs) => {
                        const result = updated_docs.map((doc) => {
                            return doc._id.toString();
                        });
                        // console.log(result);
                        resolve({ updated: result });
                    });
                    Prompt.deleteMany({ _id: { $nin: prompts.map((p) => { return p.id }) } }).exec();
                } else {
                    // Not an array
                    reject('Invalid Param');
                }
                // console.log('[upload] Prompts:', prompts);
                break;
        }
    });
    returnData.then(
        (value) => { res.send(Response.success(value)); },
        (reason) => { res.send(Response.error(400, reason)) },
    )
});

router.post('/download', auth, async function (req, res, next) {
    const user = req.user;
    const { syncType, data } = req.body;
    const returnData = new Promise(async (resolve, reject) => {
        switch (syncType) {
            case 'chat':
                resolve();
                break;
            case 'userdict':
                const dict = await Dict.findOne({ owner_id: user._id }, ['_id', 'name', 'entries']);
                // console.log('dict:', dict);
                if (dict) {
                    resolve({
                        id: dict._id,
                        entries: dict.entries.map((entry) => {
                            // Remove the _id of each entry
                            return {
                                source: entry.source,
                                target: entry.target,
                            };
                        }),
                        name: dict.name,
                    });
                } else {
                    reject('Dict Not Found');
                }
                break;
            case 'userprompt':
                const prompts = await Prompt.find({ owner_id: user._id }, ['_id', 'content']);
                const result = prompts.map((doc) => {
                    return {
                        id: doc._id,
                        content: doc.content,
                    };
                });
                resolve({ prompts: result });
                break;
        }
    });
    returnData.then(
        (value) => { res.send(Response.success(value)); },
        (reason) => { res.send(Response.error(400, reason)) },
    )
});

module.exports = router