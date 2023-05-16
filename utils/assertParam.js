const { RequestError } = require('./requestError');

/*
 * This function is used to assert the type of a parameter in a coming request.
 * If the type of the parameter is not the expected type, a RequestError will be thrown.
 * If the parameter is not nullable but a null or undefined is found, a RequestError will be thrown.
 */

const assertParam = (name, param, type, nullable = false) => {
    if (nullable && (param === null || param === undefined)) {
        return true;
    }
    if (typeof param !== type) {
        throw new RequestError(-1, `parameter ${name} must be ${type}, got ${typeof param} instead`);
    }
    if (!nullable && param === null) {
        throw new RequestError(-1, `parameter ${name} must not be null`);
    }
}

module.exports = assertParam;