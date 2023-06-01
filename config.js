const dotenv = require('dotenv');
const result = dotenv.config();

// If .env file not found, use env from process.env
if (result.error) {
    // console.table(result.error);
    // console.log(process.env)
    if (process.env.MONGO_ADDRESS && process.env.JWT_SECRET) {
        console.group('Warning: .env file not found, using env from process.env')
        console.log('MONGO_ADDRESS: ' + process.env.MONGO_ADDRESS);
        console.log('JWT_SECRET: ' + process.env.JWT_SECRET);
        console.groupEnd();
        result.parsed = {
            ...result.parsed,
            MONGO_ADDRESS: process.env.MONGO_ADDRESS,
            JWT_SECRET: process.env.JWT_SECRET,
        }
    } else {
        throw result.error;
    }
}

module.exports = result.parsed;