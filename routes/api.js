var express = require('express');
var router = express.Router();
const auth = require('../middleware/auth');

// const jwt = require('jsonwebtoken');
// const bcryptjs = require('bcryptjs');
// const { User } = require('../db/models')

router.get('/', function (req, res, next) {
  res.send('api');
});

router.use('/user', require('./api_v1/user'));

module.exports = router;
