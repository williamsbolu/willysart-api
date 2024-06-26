const multer = require('multer');
const sharp = require('sharp');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

const s3 = require('../utils/s3');
const factory = require('./handlerFactory');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const cloudFront = require('../utils/cloudFront');

// Store files in memory(buffer)
const multerStorage = multer.memoryStorage();

// Test if d uploaded file is an image. To allow only images to be uploaded (true or false)
const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true);
    } else {
        cb(new AppError('Not an image! Please upload only images', 400), false);
    }
};

const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter,
});

exports.uploadUserPhoto = upload.single('photo');

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
    if (!req?.file) return next();
    // console.log('Running file upload and caching');

    const doc = await User.findById(req.user.id);

    // ('default) means when d user updates the profile img for d first time we create a unique filename
    if (doc.photo.startsWith('default')) {
        req.file.filename = `user-${req.user.id}-${Date.now()}.jpg`; // so we can use it in the updateMe middleware
    } else {
        // when d user is not updating for d first time we use the previous generated unique filename
        req.file.filename = doc.photo;
    }

    const buffer = await sharp(req.file.buffer)
        .resize(500, 500)
        .toFormat('jpg')
        .jpeg({ quality: 90 })
        .toBuffer();

    const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: `users/${req.file.filename}`,
        Body: buffer,
        ContentType: 'image/jpeg',
    });

    await s3.send(command);

    // this code dosen't run when the user updates the image for the first time, because the file dosent exist on s3 yet
    if (!doc.photo.startsWith('default')) {
        // invalidate the cloud front cache for the updated image
        const callerReferenceValue = `${req.file.filename}-${Date.now()}`;

        const invalidationParams = {
            DistributionId: process.env.USERS_DISTRIBUTION_ID,
            InvalidationBatch: {
                CallerReference: callerReferenceValue,
                Paths: {
                    Quantity: 1,
                    Items: ['/' + req.file.filename],
                },
            },
        };
        const invalidationCommand = new CreateInvalidationCommand(invalidationParams);
        await cloudFront.send(invalidationCommand);
    }

    next();
});

const filterObj = (obj, ...allowedFields) => {
    const newObj = {};

    Object.keys(obj).forEach((el) => {
        // if the current fields is one of the allowed fields
        if (allowedFields.includes(el)) newObj[el] = obj[el];
    });

    return newObj;
};

exports.updateMe = catchAsync(async (req, res, next) => {
    // 1. Create error if user tries to update the password
    if (req.body.password || req.body.passwordConfirm) {
        return next(
            new AppError(
                'This route is not for password updates, please use /updateMyPassword',
                401,
            ),
        );
    }

    // 2. Filtered out unwanted fields names that are not allowed to be updated.
    const fliteredBody = filterObj(req.body, 'firstName', 'lastName');
    if (req.file) fliteredBody.photo = req.file.filename; // Runs if we're updating the photo and adds a photo property to be updated

    // 3. Update user document
    const updatedUser = await User.findByIdAndUpdate(req.user.id, fliteredBody, {
        new: true,
        runValidators: true,
    });

    res.status(200).json({
        status: 'success',
        data: {
            user: updatedUser,
        },
    });
});

exports.getMe = (req, res, next) => {
    req.params.id = req.user.id; // adds d user id gotten fro d "protect" to the parameter
    next();
};

exports.deleteUserImage = catchAsync(async (req, res, next) => {
    const doc = await User.findById(req.params.id);

    if (!doc) {
        return next(new AppError('No document found with that ID', 404));
    }

    // if the uses has not uploaded a profile image
    if (doc.photo.startsWith('default')) return next();

    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: `users/${doc.photo}`,
    };

    const command = new DeleteObjectCommand(params);
    await s3.send(command);

    try {
        // invalidate the cloud front cache for the deleted image
        const invalidationParams = {
            DistributionId: process.env.USERS_DISTRIBUTION_ID,
            InvalidationBatch: {
                CallerReference: doc.photo,
                Paths: {
                    Quantity: 1,
                    Items: ['/' + doc.photo],
                },
            },
        };
        const invalidationCommand = new CreateInvalidationCommand(invalidationParams);
        await cloudFront.send(invalidationCommand);
    } catch (error) {
        next();
    }

    next();
});

exports.deleteMe = catchAsync(async (req, res, next) => {
    await User.findByIdAndUpdate(req.user.id, { active: false });

    res.status(204).json({
        status: 'success',
        data: null,
    });
});

exports.createUser = (req, res) => {
    res.status(500).json({
        status: 'error',
        message: 'This route is not defined! Please use /signup instead',
    });
};

exports.getAllUsers = factory.getAll(User);
// false because we don't want it to create a user url by default
exports.getUser = factory.getOne(User, false, 'photo', 'imageUrl');

// do NOT update the password with this
exports.updateUser = factory.updateOne(User);
exports.deleteUser = factory.deleteOne(User);
