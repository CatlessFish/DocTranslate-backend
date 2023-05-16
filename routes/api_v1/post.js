var express = require('express');
var router = express.Router();

const Response = require('../../utils/generalResponse');
const AssertParam = require('../../utils/assertParam');
const { handleInternalError } = require('../../utils/internalError');
const { RequestError, handleRequestError } = require('../../utils/requestError');

const PostModel = require('../../db/models').Post;


const getOnePostByIdHandler = async function (req, res, next) {
    const postId = req.params.postId;
    AssertParam.assertId(postId);

    try {
        const post = await PostModel.findById(postId);
        if (!post) {
            throw new RequestError(-1, 'Post not found');
        }
        res.send(Response.success(post));
    }
    catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
}

router.get('/getOnePostById/:postId', getOnePostByIdHandler);

module.exports = router;