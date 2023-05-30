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
    MsgBox: require('./msgBox/msg_box_model'),
    MsgBoxEntry: require('./msgBox/msg_box_entry_model'),
    SquareEntry: require('./square/square_entry_model'),
};

module.exports = models;