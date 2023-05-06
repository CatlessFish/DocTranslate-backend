const { JWT_SECRET } = require('../config');
const { User } = require('../db/models')
const jwt = require('jsonwebtoken');
const Response = require('../utils/generalResponse');

const auth = async function (req, res, next) {
    const headerAuth = req.headers.authorization;
    if (!headerAuth) {
        console.log('No auth in header');
        res.status(401).send(Response.error(401, 'No auth in header'));
        return;
    }
    const token = headerAuth.split(' ').pop();
    if (!token) {
        console.log('No token');
        res.status(401).send(Response.error(401, 'No token'));
        return;
    }

    var tokenData;
    try {
        tokenData = jwt.verify(token, JWT_SECRET);
    } catch (e) {
        console.log('Token verify error', e);
    } finally {
        if (!tokenData || !tokenData.id) {
            console.log('Invalid token', tokenData);
            res.status(401).send(Response.error(401, 'Invalid token'));
            return;
        }
    }

    const user = await User.findById(tokenData.id);
    if (!user) {
        console.log('User not found');
        res.status(401).send(Response.error(401, 'User not found'));
        return;
    }

    // const tokenSignedAt = new Date(tokenData.iat * 1000);
    req.user = user;
    // console.log('auth', req.user)
    next();
}

module.exports = auth;
