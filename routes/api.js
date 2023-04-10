var express = require('express');
var router = express.Router();

// const jwt = require('jsonwebtoken');
// const bcryptjs = require('bcryptjs');
// const { User } = require('../db/models')

router.get('/', function (req, res, next) {
  res.send('api');
});

router.use('/user', require('./user'));

module.exports = router;
