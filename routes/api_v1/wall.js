var express = require('express');
var router = express.Router();

const Response = require('../../utils/generalResponse');
const { handleInternalError } = require('../../utils/internalError');
const { RequestError, handleRequestError } = require('../../utils/requestError');
const AssertParam = require('../../utils/assertParam');
const WallEntryModel = require('../../db/models').WallEntry;
const PostModel = require('../../db/models').Post;

// All request sent here should have been authenticated
// and thus have req.user

// TODO: Add transaction to ensure the atomicity of the database operations
// TODO: Export Handlers to reuse them in test api


// Operations on the wall entry list:
// - Get all wall entries
// TODO: Get wall entries by page
// - Create a new wall entry
// - Delete a wall entry

async function getAllEntriesHandler(req, res, next) {
    try {
        const wallEntries = await WallEntryModel.find();
        res.send(Response.success(wallEntries));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
}

async function createOneEntryHandler(req, res, next) {
    try {
        const postContent = req.body.content;
        const owner = req.user._id;
        AssertParam('postContent', postContent, 'object');
        AssertParam('owner', owner, 'object');

        // Create a new post
        const initialPost = await PostModel.create({
            owner,
            private: false,
            visibleTo: [],
            entryAt: {},
            content: postContent,
        });

        // Create a new wall entry
        const newWallEntry = await WallEntryModel.create({
            owner,
            initialPost: initialPost._id,
            posts: [initialPost._id],
        });

        // Update the initial post's entryAt
        initialPost.entryAt = {
            type: 'wallEntry',
            id: newWallEntry._id,
        }
        await initialPost.save();
        res.send(Response.success(newWallEntry));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
}

async function deleteOneEntryHandler(req, res, next) {
    try {
        const wallEntryId = req.body.wallEntryId;
        const userId = req.user._id;
        AssertParam('wallEntryId', wallEntryId, 'string');
        AssertParam('user', userId, 'object');

        const entry = await WallEntryModel.findById(wallEntryId);
        if (!entry) {
            throw new RequestError(-1, 'Wall entry not found');
        }

        // Check if the user is the owner of this wall entry
        if (!entry.owner.equals(userId)) {
            throw new RequestError(-1, 'You are not the owner of this wall entry');
        }

        // Delete all posts in the entry
        await PostModel.deleteMany({
            _id: {
                $in: entry.posts,
            }
        });

        // Delete the entry
        await entry.deleteOne();

        res.send(Response.success(null));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
}


// Operations on the post list in a wall entry:
// - Get all posts in a wall entry
// - Add a new post to a wall entry
// - Delete a post from a wall entry
// - Update a post in a wall entry
// TODO: Get posts in a wall entry by page

async function getAllPostInEntryHandler(req, res, next) {
    try {
        const wallEntryId = req.body.wallEntryId;
        AssertParam('wallEntryId', wallEntryId, 'string');

        // Get the wall entry
        const entry = await WallEntryModel.findById(wallEntryId);
        if (!entry) {
            throw new RequestError(-1, 'Wall entry not found');
        }

        // Get all posts in the entry
        const posts = await PostModel.find({
            _id: {
                $in: entry.posts,
            }
        });
        res.send(Response.success(posts));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
}

async function addPostToEntryHandler(req, res, next) {
    try {
        const wallEntryId = req.body.wallEntryId;
        const postContent = req.body.content;
        const owner = req.user._id;
        AssertParam('wallEntryId', wallEntryId, 'string');
        AssertParam('postContent', postContent, 'object');
        AssertParam('owner', owner, 'object');

        // Create a new post
        const newPost = await PostModel.create({
            owner,
            private: false,
            visibleTo: [],
            entryAt: {
                type: 'wallEntry',
                id: wallEntryId,
            },
            content: postContent,
        });

        // Add the post to the entry
        const entry = await WallEntryModel.findById(wallEntryId);
        if (!entry) {
            throw new RequestError(-1, 'Wall entry not found');
        }
        entry.posts.push(newPost._id);
        entry.updatedAt = Date.now();
        await entry.save();

        res.send(Response.success(newPost));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
}

async function deletePostInEntryHandler(req, res, next) {
    try {
        const wallEntryId = req.body.wallEntryId;
        const postId = req.body.postId;
        const userId = req.user._id;
        AssertParam('wallEntryId', wallEntryId, 'string');
        AssertParam('postId', postId, 'string');
        AssertParam('user', userId, 'object');

        const entry = await WallEntryModel.findById(wallEntryId);
        if (!entry) {
            throw new RequestError(-1, 'Wall entry not found');
        }

        // Cannot delete a post that is not in the entry
        if (!entry.posts.includes(postId)) {
            res.status(400).send(Response.error(400, 'Cannot delete a post that is not in the entry'));
            return;
        }

        // Cannot delete the initial post
        if (postId == entry.initialPost) {
            res.status(400).send(Response.error(400, 'Cannot delete the initial post'));
            return;
        }

        const post = await PostModel.findById(postId);

        // Cannot delete a post that is not owned by the user
        if (!post.owner.equals(userId)) {
            throw new RequestError(-1, 'You are not the owner of this post');
        }

        // Delete the post
        await post.deleteOne();

        // Delete the post from the entry
        await WallEntryModel.findByIdAndUpdate(wallEntryId, {
            $pull: {
                posts: postId,
            },
            updatedAt: Date.now(),
        });

        res.send(Response.success(null));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
}

async function updatePostInEntryHandler(req, res, next) {
    try {
        const wallEntryId = req.body.wallEntryId;
        const postId = req.body.postId;
        const postContent = req.body.content;
        AssertParam('wallEntryId', wallEntryId, 'string');
        AssertParam('postId', postId, 'string');
        AssertParam('postContent', postContent, 'object');

        // Cannot update a post that is not in the entry
        const entry = await WallEntryModel.findById(wallEntryId);
        if (!entry) {
            throw new RequestError(-1, 'Wall entry not found');
        }

        if (!entry.posts.includes(postId)) {
            res.status(400).send(Response.error(400, 'Cannot update a post that is not in the entry'));
            return;
        }

        const post = await PostModel.findById(postId);

        // Cannot update a post that is not owned by the user
        if (!post.owner.equals(req.user._id)) {
            throw new RequestError(-1, 'You are not the owner of this post');
        }

        // Update the post
        await post.updateOne({
            content: postContent,
            updatedAt: Date.now(),
        })

        // Update the entry
        await entry.updateOne({
            updatedAt: Date.now(),
        });

        res.send(Response.success(updatedPost));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
}

router.get('/getAllEntries', getAllEntriesHandler);
router.post('/createOneEntry', createOneEntryHandler);
router.post('/deleteOneEntry', deleteOneEntryHandler);

router.post('/getAllPostsInEntry', getAllPostInEntryHandler);
router.post('/addPostToEntry', addPostToEntryHandler);
router.post('/deletePostInEntry', deletePostInEntryHandler);
router.post('/updatePostInEntry', updatePostInEntryHandler);

module.exports = router;