const GeneralResponse = require('./generalResponse');

/*
 * The routine handleInternalError() is used in router functions.
 * Any unexpected error should be caught and handled by this routine.
 * Catch an error and call handleInternalError() to send a 500 response.
 * 
 * Parameters:
 * - req: the request object in the router function
 * - res: the response object in the router function
 * - err: the error caught
 */

const handleInternalError = (req, res, err) => {
  console.error(err);
  // console.log('request Info', req);
  console.log('Request Body: \n', req.body);
  res.status(500).send(GeneralResponse.error(-1, 'Internal Server Error'));
};

module.exports = { handleInternalError };