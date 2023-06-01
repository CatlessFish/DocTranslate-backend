var express = require('express');
var router = express.Router();

const Response = require('../../utils/generalResponse');
const AssertParam = require('../../utils/assertParam');
const { handleInternalError } = require('../../utils/internalError');
const { RequestError, handleRequestError } = require('../../utils/requestError');

const { SquareEntry, MsgBox } = require('../../db/models');

router.get('/getAll', async function (req, res, next) {
    try {
        const squareEntries = await SquareEntry.find();
        res.send(Response.success(squareEntries));
    }

    catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/addOne', async function (req, res, next) {
    try {
        const { owner, msgBoxId } = req.body;
        const userId = req.user._id;
        AssertParam('owner', owner, 'string');
        AssertParam('msgBoxId', msgBoxId, 'string');
        AssertParam('userId', userId, 'object');

        // check if the owner is the current user

        // check if msgBoxId exists
        const msgBox = await MsgBox.findById(msgBoxId);
        if (!msgBox) {
            throw new RequestError(`msgBoxId ${msgBoxId} does not exist`);
        }

        // check if this msgBox has already been added
        const currentSquareEntry = await SquareEntry.findOne({ msgBoxId });

        // if it has, update its updatedAt
        if (currentSquareEntry) {
            currentSquareEntry.updatedAt = Date.now();
            await currentSquareEntry.save();
            res.send(Response.success(currentSquareEntry));
        } else {
            // if it hasn't, create a new entry
            const newSquareEntry = await SquareEntry.create({
                owner,
                msgBoxId,
            });
            res.send(Response.success(newSquareEntry));
        }

    }
    catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/deleteOne', async function (req, res, next) {
    try {
        const { squareEntryId } = req.body;
        const userId = req.user._id;
        AssertParam('squareEntryId', squareEntryId, 'string');
        AssertParam('userId', userId, 'object');

        const squareEntry = await SquareEntry.findById(squareEntryId);
        if (!squareEntry) {
            throw new RequestError(`squareEntryId ${squareEntryId} does not exist`);
        }

        // check if the user is the owner of the squareEntry
        if (!squareEntry.owner.equals(userId)) {
            throw new RequestError(`user ${userId} is not the owner of squareEntry ${squareEntryId}`);
        }

        await squareEntry.deleteOne();
        res.send(Response.success());

    }
    catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/deleteOneByMsgBoxId', async function (req, res, next) {
    try {
        const { msgBoxId } = req.body;
        const userId = req.user._id;
        AssertParam('msgBoxId', msgBoxId, 'string');
        AssertParam('userId', userId, 'object');

        const squareEntry = await SquareEntry.findOne({ msgBoxId });
        if (!squareEntry) {
            throw new RequestError(`msgBoxId ${msgBoxId} does not exist`);
        }

        // check if the user is the owner of the squareEntry
        if (!squareEntry.owner.equals(userId)) {
            throw new RequestError(`user ${userId} is not the owner of squareEntry ${squareEntry._id}`);
        }

        await squareEntry.deleteOne();
        res.send(Response.success());

    }
    catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

module.exports = router;