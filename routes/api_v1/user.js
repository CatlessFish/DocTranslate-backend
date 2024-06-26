var express = require('express');
var router = express.Router();

const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { User } = require('../../db/models')
const { JWT_SECRET } = require('../../config');

const Response = require('../../utils/generalResponse');
const AssertParam = require('../../utils/assertParam');
const { handleInternalError } = require('../../utils/internalError');
const { RequestError, handleRequestError } = require('../../utils/requestError');

router.get('/getAll', async function (req, res, next) {
    const users = await User.find();
    res.send(Response.success(users));
});

router.post('/login', async function (req, res, next) {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
        res.status(400).send(Response.error(400, 'Username not found'));
        return;
    }

    const isPasswordCorrect = bcryptjs.compareSync(password, user.password);
    if (!isPasswordCorrect) {
        res.status(400).send(Response.error(400, 'Password incorrect'));
        return;
    }

    const token = jwt.sign({ id: user._id, }, JWT_SECRET);
    res.send(Response.success({ token }));
});

router.post('/register', async function (req, res, next) {
    const { username, password, email } = req.body;
    const isUsernameExist = (await User.find({ username })).length > 0;
    if (isUsernameExist) {
        res.status(400).send(Response.error(400, 'Username already exist'));
        return;
    }

    try {
        const newUser = await User.create({
            username,
            password,
            email,
        })
        res.send(Response.success(newUser));
        // await User.findByIdAndDelete(newUser._id);
    }
    catch (e) {
        res.status(400).send(Response.error(400, e.message));
        return;
    }
});

const auth = require('../../middleware/auth');
const { isValidObjectId } = require('mongoose');

router.get('/profile', auth, async function (req, res, next) {
    // console.log('profile', req.user);
    res.send(Response.success(req.user));
});

router.get('/getUserById', auth, async function (req, res, next) {
    try {
        const { userId } = req.query;
        AssertParam('userId', userId, 'string')
        if (!isValidObjectId(userId)) {
            throw new RequestError(-1, 'Invalid userId');
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) {
            throw new RequestError(-1, 'User not found');
        }

        const responseUserInfo = {
            _id: targetUser._id,
            username: targetUser.username,
            email: targetUser.email,
        }
        res.send(Response.success(responseUserInfo));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

module.exports = router;