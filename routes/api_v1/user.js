var express = require('express');
var router = express.Router();

const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { User } = require('../../db/models')
const { JWT_SECRET } = require('../../config');

router.get('/getAll', async function (req, res, next) {
    const users = await User.find();
    res.send(users);
});

router.post('/login', async function (req, res, next) {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
        res.status(400).send('Username not found');
        return;
    }

    const isPasswordValid = bcryptjs.compareSync(password, user.password);
    if (!isPasswordValid) {
        res.status(400).send('Password is not valid');
        return;
    }

    const token = jwt.sign({ id: user._id, }, JWT_SECRET);
    res.send(token);
});

router.post('/register', async function (req, res, next) {
    const { username, password, email } = req.body;
    const isUsernameExist = (await User.find({ username })).length > 0;
    if (isUsernameExist) {
        res.status(400).send('Username already exist');
        return;
    }

    try {
        const newUser = await User.create({
            username,
            password,
            email,
        })
        res.send(newUser);
    }
    catch (e) {
        res.status(400).send(e.message);
        return;
    }
});

const auth = require('../../middleware/auth');

router.get('/profile', auth, async function (req, res, next) {
    // console.log('profile', req.user);
    res.send(req.user);
});

module.exports = router;