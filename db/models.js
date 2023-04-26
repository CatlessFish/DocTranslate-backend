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
    Post: require('./post/post_model'),
    WallEntry: require('./wall/wall_entry_model'),
};

module.exports = models;