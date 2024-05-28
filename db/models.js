const { MONGO_ADDRESS } = require('../config');
const mongoose = require('mongoose');
mongoose.connect(MONGO_ADDRESS, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // useCreateIndex: true,
});

// export models here
const models = {
    User: require('./user/user_model'),
    Prompt: require('./pref/prompt_model'),
    Dict: require('./pref/dict_model'),
};

module.exports = models;