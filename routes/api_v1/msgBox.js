var express = require('express');
var router = express.Router();

const Response = require('../../utils/generalResponse');
const AssertParam = require('../../utils/assertParam');
const { handleInternalError } = require('../../utils/internalError');
const { RequestError, handleRequestError } = require('../../utils/requestError');

const PostModel = require('../../db/models').Post;
const MsgBoxModel = require('../../db/models').MsgBox;
const MsgBoxEntryModel = require('../../db/models').MsgBoxEntry;

// TO-DOs:
// TODO: Add transaction to ensure the atomicity of the database operations

// Operations on MsgBox:
// - Get my MsgBox(Each user has only one MsgBox)
// - Create a new MsgBox
// - Update a MsgBox
// - Delete a MsgBox

const MsgBoxOwnershipValidation = async function (req, res, next) {
    // TODO
    next();
};

router.get('/getMsgBoxByOwnerId', async function (req, res, next) {
    try {
        const ownerId = req.query.ownerId;
        AssertParam('ownerId', ownerId, 'string');

        const msgBox = await MsgBoxModel.findOne({ owner: ownerId });
        res.send(Response.success(msgBox));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.get('/getMsgBoxById', async function (req, res, next) {
    try {
        const msgBoxId = req.query.msgBoxId;
        AssertParam('msgBoxId', msgBoxId, 'string');

        const msgBox = await MsgBoxModel.findById(msgBoxId);
        res.send(Response.success(msgBox));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/createOneMsgBox', async function (req, res, next) {
    try {
        const ownerId = req.user._id;
        const content = req.body.content;
        AssertParam('ownerId', ownerId, 'object');
        AssertParam('MsgBoxContent', content, 'object');

        // TODO: Check if the user already has a MsgBox

        const settings = {} // TODO: Add MsgBox settings
        const newMsgBox = await MsgBoxModel.create({
            owner: ownerId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            content,
            settings,
            entries: [],
        });
        res.send(Response.success(newMsgBox));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/updateOneMsgBox', MsgBoxOwnershipValidation, async function (req, res, next) {
    try {
        const msgBoxId = req.body.msgBoxId;
        const content = req.body.content;
        const settings = req.body.settings;
        AssertParam('msgBoxId', msgBoxId, 'string');
        AssertParam('MsgBoxContent', content, 'object');
        AssertParam('MsgBoxSettings', settings, 'object', true);

        const msgBox = await MsgBoxModel.findById(msgBoxId);
        msgBox.content = content;
        msgBox.settings = settings;
        msgBox.updatedAt = Date.now();
        await msgBox.save();
        res.send(Response.success(msgBox));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

// NOT TESTED
// Don't use this API unless you know what you are doing
router.post('/deleteMsgBoxById', MsgBoxOwnershipValidation, async function (req, res, next) {
    try {
        const msgBoxId = req.body.msgBoxId;
        AssertParam('msgBoxId', msgBoxId, 'string');

        const msgBox = await MsgBoxModel.findById(msgBoxId);
        msgBox.entries.forEach(async (entryId) => {
            // Cascadingly delete MsgBoxEntry and Post
            const entry = await MsgBoxEntryModel.findById(entryId);
            entry.posts.forEach(async (postId) => {
                const post = await PostModel.findById(postId);
                await post.deleteOne();
            });
            await entry.deleteOne();
        });
        await msgBox.deleteOne();
        res.send(Response.success());

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});


// Operations on MsgBoxEntry:
// - Get all MsgBoxEntry
// TODO: Get MsgBoxEntry by page
// - Create a new MsgBoxEntry
// - Delete a MsgBoxEntry
// TODO: Change the visibility of a MsgBoxEntry

router.get('/getAllEntriesInMsgBox', async function (req, res, next) {
    try {
        const msgBoxId = req.query.msgBoxId;
        const userId = req.user._id;
        AssertParam('msgBoxId', msgBoxId, 'string');
        AssertParam('userId', userId, 'object');

        const msgBox = await MsgBoxModel.findById(msgBoxId);
        const entries = await MsgBoxEntryModel.find({ _id: { $in: msgBox.entries } });
        // Check if the user has the permission to view the entry
        visibleEntries = entries.filter((entry) => {
            return entry.private === false
                || userId.equals(entry.entryOwner)
                || userId.equals(entry.boxOwner);
        });
        res.send(Response.success(visibleEntries));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/createOneEntryInMsgBox', async function (req, res, next) {
    // 可以给自己提问吗？
    try {
        const msgBoxId = req.body.msgBoxId;
        const content = req.body.content; // post content
        const userId = req.user._id;
        AssertParam('msgBoxId', msgBoxId, 'string');
        AssertParam('PostContent', content, 'object');
        AssertParam('userId', userId, 'object');

        const newPost = await PostModel.create({
            owner: userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            private: true,
            visibleTo: [
                userId,
                msgBox.owner,
            ],
            entryAt: {},
            content,
        });
        const newEntry = await MsgBoxEntryModel.create({
            boxOwner: msgBox.owner,
            entryOwner: userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            private: true,
            initialPost: newPost._id,
            posts: [newPost._id],
        });

        newPost.entryAt = {
            type: 'MsgBoxEntry',
            id: newEntry._id
        };
        await newPost.save();

        const msgBox = await MsgBoxModel.findById(msgBoxId);
        msgBox.entries.push(newEntry._id);
        msgBox.updatedAt = Date.now();
        await msgBox.save();

        res.send(Response.success(newEntry));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/deleteOneEntryInMsgBox', async function (req, res, next) {
    try {
        const msgBoxId = req.body.msgBoxId;
        const entryId = req.body.entryId;
        const userId = req.user._id;
        AssertParam('msgBoxId', msgBoxId, 'string');
        AssertParam('entryId', entryId, 'string');
        AssertParam('userId', userId, 'object');

        const msgBox = await MsgBoxModel.findById(msgBoxId);
        const entry = await MsgBoxEntryModel.findById(entryId);
        if (!msgBox.entries.includes(entryId)) {
            throw new RequestError(-1, 'The entry does not belong to the MsgBox');
        }
        // Check if the user has the permission to delete the entry
        if (!userId.equals(entry.entryOwner) && !userId.equals(entry.boxOwner)) {
            throw new RequestError(-1, 'You have no permission to delete this entry');
        }

        // Cascadingly delete MsgBoxEntry and its Posts
        entry.posts.forEach(async (postId) => {
            await PostModel.findByIdAndRemove(postId);
        });
        entry.deleteOne();

        await MsgBoxModel.findByIdAndUpdate(msgBoxId, {
            $pull: { entries: entryId },
            updatedAt: Date.now(),
        });

        res.send(Response.success());

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});


// Operations on the post list in a MsgBoxEntry:
// - Get all posts in a MsgBoxEntry
// TODO: Get posts in a MsgBoxEntry by page
// - Create a new post in a MsgBoxEntry
// - Delete a post in a MsgBoxEntry
// - Update a post in a MsgBoxEntry

const MsgBoxEntryOwnershipValidation = async function (req, res, next) {
    // 检查用户是否有权限对该 MsgBoxEntry 进行操作
    // 仅当用户为 MsgBoxEntry 的所有者或者 MsgBox 的所有者时，校验通过
    try {
        const entryId = req.body.entryId;
        const userId = req.user._id;
        AssertParam('entryId', entryId, 'string');
        AssertParam('userId', userId, 'object');

        const entry = await MsgBoxEntryModel.findById(entryId);
        if (!userId.equals(entry.entryOwner) && !userId.equals(entry.boxOwner)) {
            throw new RequestError(-1, 'You have no permission to operate posts in this entry');
        }
        next();

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
};

router.get('/getAllPostsInMsgBoxEntry', async function (req, res, next) {
    try {
        const entryId = req.query.entryId;
        const userId = req.user._id;
        AssertParam('entryId', entryId, 'string');
        AssertParam('userId', userId, 'object');

        const entry = await MsgBoxEntryModel.findById(entryId);
        if (entry.private
            && !userId.equals(entry.entryOwner)
            && !userId.equals(entry.boxOwner)) {
            throw new RequestError(-1, 'You have no permission to view this entry');
        }

        const posts = await PostModel.find({ _id: { $in: entry.posts } });
        res.send(Response.success(posts));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/createOnePostInMsgBoxEntry', MsgBoxEntryOwnershipValidation, async function (req, res, next) {
    try {
        const entryId = req.body.entryId;
        const content = req.body.content;
        const userId = req.user._id;
        AssertParam('entryId', entryId, 'string');
        AssertParam('PostContent', content, 'object');
        AssertParam('userId', userId, 'object');

        const entry = await MsgBoxEntryModel.findById(entryId);
        const newPost = await PostModel.create({
            owner: userId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            private: entry.private, // 帖子的可见性与所在的 MsgBoxEntry 一致
            visibleTo: [
                entry.entryOwner,
                entry.boxOwner,
            ],
            entryAt: {
                type: 'MsgBoxEntry',
                id: entryId,
            },
            content,
        });
        await MsgBoxEntryModel.findByIdAndUpdate(entryId, {
            $push: {
                posts: newPost._id,
            },
            updatedAt: Date.now(),
        });
        // TODO: Update the updatedAt field of the MsgBox
        res.send(Response.success(newPost));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/deleteOnePostInMsgBoxEntry', MsgBoxEntryOwnershipValidation, async function (req, res, next) {
    try {
        const entryId = req.body.entryId;
        const postId = req.body.postId;
        const userId = req.user._id;
        AssertParam('entryId', entryId, 'string');
        AssertParam('postId', postId, 'string');
        AssertParam('userId', userId, 'object');

        const entry = await MsgBoxEntryModel.findById(entryId);
        // Cannot delete the initial post
        if (entry.initialPost.equals(postId)) {
            throw new RequestError(-1, 'Cannot delete the initial post');
        }
        if (!entry.posts.includes(postId)) {
            throw new RequestError(-1, 'The post does not belong to the MsgBoxEntry');
        }
        // Check if the user has the permission to delete the post
        if (!userId.equals(post.owner)) {
            throw new RequestError(-1, 'You have no permission to delete this post');
        }

        await PostModel.findByIdAndRemove(postId);
        await MsgBoxEntryModel.findByIdAndUpdate(entryId, {
            $pull: {
                posts: postId,
            },
            updatedAt: Date.now(),
        });

        res.send(Response.success());
    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

router.post('/updateOnePostInMsgBoxEntry', MsgBoxEntryOwnershipValidation, async function (req, res, next) {
    try {
        const entryId = req.body.entryId;
        const postId = req.body.postId;
        const content = req.body.content;
        const userId = req.user._id;
        AssertParam('entryId', entryId, 'string');
        AssertParam('postId', postId, 'string');
        AssertParam('PostContent', content, 'object');
        AssertParam('userId', userId, 'object');

        const post = await PostModel.findById(postId);
        if (!userId.equals(post.owner)) {
            throw new RequestError(-1, 'You have no permission to update this post');
        }
        if (post.entryAt.type !== 'MsgBoxEntry' || !post.entryAt.id.equals(entryId)) {
            throw new RequestError(-1, 'The post does not belong to the MsgBoxEntry');
        }

        post.content = content;
        post.updatedAt = Date.now();
        await post.save();

        MsgBoxEntryModel.findByIdAndUpdate(entryId, {
            updatedAt: Date.now(),
        });

        res.send(Response.success(post));

    } catch (e) {
        if (e instanceof RequestError) {
            handleRequestError(req, res, e);
        } else {
            handleInternalError(req, res, e);
        }
    }
});

module.exports = router;