const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        // trim: true,
        minlength: 3
    },
    password: {
        type: String,
        required: true,
        set(val) {
            return bcrypt.hashSync(val, 10)
        },
        minlength: 3
    },
    email: {
        type: String,
        required: false,
        // unique: true,
    },
});

// Params: model name, schema, collection name
const UserModel = mongoose.model('User', UserSchema, 'users');

module.exports = UserModel;