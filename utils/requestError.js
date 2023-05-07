const GeneralResponse = require('./generalResponse');

/*
 * The class RequestError is used in router functions.
 * Use this to represent any error that is caused by invalid request,
 * such as missing parameters, invalid parameters, etc.
 * Note that the code here is not the HTTP status code. Instead, it will be
 * contained in the response body as a field named 'code'.
 * Example: throw new RequestError(-1, 'Invalid parameter');
 */

class RequestError extends Error {
    constructor(code, message) {
        super(message);
        this.code = code;
    }
}

/*
 * The routine handleRequestError() is used in router functions.
 * Any error that is an instance of RequestError should be caught and handled
 * by this routine.
 * Note that this routine will always return an HTTP 400 response.
 * 
 * Parameters:
 * - req: the request object in the router function
 * - res: the response object in the router function
 * - err: the error caught
 */

const handleRequestError = (req, res, err) => {
    console.error(err);
    // console.log('request Info', req);
    console.log('Request Body: \n', req.body);
    res.status(400).send(GeneralResponse.error(err.code, err.message));
};

module.exports = { RequestError, handleRequestError };