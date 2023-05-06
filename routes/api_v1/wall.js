var express = require('express');
var router = express.Router();

const Response = require('../../utils/generalResponse');
const WallEntryModel = require('../../db/models').WallEntry;
const PostModel = require('../../db/models').Post;

// All request sent here should have been authenticated
// and thus have req.user

// TODO: Validate request parameters before doing any database queries
// console.assert does not stop the execution of the program


// Operations on the wall entry list:
// - Get all wall entries
// - Create a new wall entry
// - Delete a wall entry

router.get('/getAllEntries', async function (req, res, next) {
    const wallEntries = await WallEntryModel.find();
    const response = Response.success(wallEntries);
    res.send(response);
});

router.post('/createOneEntry', async function (req, res, next) {
    const postContent = req.body.content;
    const owner = req.user._id;
    console.assert(postContent, 'postContent is required');
    console.assert(owner, 'owner is required');

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
});

router.post('/deleteOneEntry', async function (req, res, next) {
    const wallEntryId = req.body.wallEntryId;
    console.assert(wallEntryId, 'wallEntryId is required');

    try {
        await WallEntryModel.findByIdAndDelete(wallEntryId);
    } catch (error) {
        res.status(400).send(Response.error(400, error.message));
        return
    }
    res.send(Response.success(null));
});


// Operations on the post list in a wall entry:
// - Get all posts in a wall entry
// - Add a new post to a wall entry
// - Delete a post from a wall entry
// - Update a post in a wall entry
// TODO: Get posts in a wall entry by page

router.post('/getAllPostsInEntry', async function (req, res, next) {
    const wallEntryId = req.body.wallEntryId;
    console.assert(wallEntryId, 'wallEntryId is required');

    // Get the wall entry
    const entry = await WallEntryModel.findById(wallEntryId);
    console.assert(entry, 'entry not found');

    // Get all posts in the entry
    const posts = await PostModel.find({
        _id: {
            $in: entry.posts,
        }
    });
    res.send(Response.success(posts));
});

router.post('/addPostToEntry', async function (req, res, next) {
    const wallEntryId = req.body.wallEntryId;
    const postContent = req.body.content;
    const owner = req.user._id;
    console.assert(wallEntryId, 'wallEntryId is required');
    console.assert(postContent, 'postContent is required');
    console.assert(owner, 'owner is required');

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
    console.assert(entry, 'entry not found');
    entry.posts.push(newPost._id);
    entry.updatedAt = Date.now();
    await entry.save();

    res.send(Response.success(newPost));
});

router.post('/deletePostInEntry', async function (req, res, next) {
    const wallEntryId = req.body.wallEntryId;
    const postId = req.body.postId;
    const entry = await WallEntryModel.findById(wallEntryId);
    console.assert(wallEntryId, 'wallEntryId is required');
    console.assert(postId, 'postId is required');
    console.assert(entry, 'entry not found');

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

    // Delete the post
    await PostModel.findByIdAndDelete(postId);

    // Delete the post from the entry
    await WallEntryModel.findByIdAndUpdate(wallEntryId, {
        $pull: {
            posts: postId,
        },
        updatedAt: Date.now(),
    });

    res.send(Response.success(null));
});

router.post('/updatePostInEntry', async function (req, res, next) {
    const wallEntryId = req.body.wallEntryId;
    const postId = req.body.postId;
    const postContent = req.body.content;
    console.assert(wallEntryId, 'wallEntryId is required');
    console.assert(postId, 'postId is required');
    console.assert(postContent, 'postContent is required');

    // Cannot update a post that is not in the entry
    const entry = WallEntryModel.findById(wallEntryId);
    console.assert(entry, 'entry not found');
    if (!entry.posts.includes(postId)) {
        res.status(400).send(Response.error(400, 'Cannot update a post that is not in the entry'));
        return;
    }

    // Update the post
    const updatedPost = await PostModel.findByIdAndUpdate(postId, {
        content: postContent,
        updatedAt: Date.now(),
    });

    // Update the entry
    await WallEntryModel.findByIdAndUpdate(wallEntryId, {
        updatedAt: Date.now(),
    });

    res.send(Response.success(updatedPost));
});

module.exports = router;