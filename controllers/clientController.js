const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const uniqid = require('uniqid');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const s3 = require('../utils/s3');
const AppError = require('../utils/appError');
const Client = require('../models/clientModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');

const multerStorage = multer.memoryStorage();

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

exports.uploadClientImages = upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'images', maxCount: 6 },
]);

exports.resizeClientImages = catchAsync(async (req, res, next) => {
    console.log(req.files);
    if (!req?.files?.coverImage && !req?.files?.images) return next();

    // 1) coverImage
    if (req.files.coverImage) {
        // meaning if we are sending an update request use the previous filename
        if (req.params.id) {
            const doc = await Client.findById(req.params.id);
            req.body.coverImage = doc.coverImage;
        } else {
            // if we're sending a create request, usea a unique filename
            req.body.coverImage = `${uniqid('img-')}-${Date.now()}-cover.jpeg`;
        }

        const buffer = await sharp(req.files.coverImage[0].buffer)
            .resize({ width: 700 })
            .toFormat('jpeg')
            .jpeg({ quality: 90 })
            .toBuffer();

        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: req.body.coverImage,
            Body: buffer,
            ContentType: req.files.coverImage[0].mimetype,
        });

        await s3.send(command);
    }

    if (req.files.images) {
        req.body.images = [];
        // Using promise.all makes sure that we wait till the loops finishes with all async function (sharp) running
        // before we move to the next() function, because an async funtion is running inside the loop. await sharp happens inside one of callback functions of the loop methods
        // and we use map() so we can save the promises returned from d loop, so we can await all of them using Promise.all(), only after that we call d next()
        await Promise.all(
            req.files.images.map(async (file, i) => {
                const filename = `${uniqid('img-')}-${Date.now()}-${i + 1}.jpeg`;

                const buffer = await sharp(file.buffer)
                    .resize({ width: 700 })
                    .toFormat('jpeg')
                    .jpeg({ quality: 90 })
                    .toBuffer();

                const command = new PutObjectCommand({
                    Bucket: process.env.BUCKET_NAME,
                    Key: filename,
                    Body: buffer,
                    ContentType: file.mimetype,
                });

                await s3.send(command);
                req.body.images.push(filename);
            }),
        );
    }
    next();
});

exports.deletePreviousClientImages = catchAsync(async (req, res, next) => {
    if (!req?.files?.images) return next();

    const doc = await Client.findById(req.params.id);

    // if we are updating d images array and if there are previous images in the bucket
    if (req.files?.images && doc?.images?.length > 0) {
        await Promise.all(
            doc.images.map(async (curFileName) => {
                const command2 = new DeleteObjectCommand({
                    Bucket: process.env.BUCKET_NAME,
                    Key: curFileName,
                });
                await s3.send(command2);
            }),
        );
    }

    next();
});

exports.deleteClientImages = catchAsync(async (req, res, next) => {
    const doc = await Client.findById(req.params.id);

    if (!doc) {
        return next(new AppError('No document found with that ID', 404));
    }

    // Delete the cover image in the bucket
    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: doc.coverImage,
    };
    const command = new DeleteObjectCommand(params);
    await s3.send(command);

    // delete all the client images in the images in the bucket
    if (doc?.images?.length > 0) {
        await Promise.all(
            doc.images.map(async (curFileName) => {
                const command2 = new DeleteObjectCommand({
                    Bucket: process.env.BUCKET_NAME,
                    Key: curFileName,
                });
                await s3.send(command2);
            }),
        );
    }

    next();
});

exports.createClient = factory.createOne(Client);
exports.updateClient = factory.updateOne(Client);

exports.getAllClients = factory.getAll(Client, true, 'coverImage', 'coverImageUrl');
exports.getClient = factory.getOne(Client, true, 'coverImage', 'coverImageUrl');
exports.deleteClient = factory.deleteOne(Client);
