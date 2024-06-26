const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const uniqid = require('uniqid');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');

const s3 = require('../utils/s3');
const AppError = require('../utils/appError');
const Client = require('../models/clientModel');
const factory = require('./handlerFactory');
const catchAsync = require('../utils/catchAsync');
const cloudFront = require('../utils/cloudFront');

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
    if (!req?.files?.coverImage && !req?.files?.images) return next();

    // 1) coverImage
    if (req.files.coverImage) {
        // meaning if we are sending an update request use the previous filename
        if (req.params.id) {
            const doc = await Client.findById(req.params.id);
            req.body.coverImage = doc.coverImage;
            req.coverImageinvalidationKey = doc.coverImage;
        } else {
            // if we're sending a create request, usea a unique filename
            req.body.coverImage = `${uniqid('img-')}-${Date.now()}-cover.jpg`;
        }

        const buffer = await sharp(req.files.coverImage[0].buffer)
            .resize({ width: 700 })
            .toFormat('jpg')
            .jpeg({ quality: 90 })
            .toBuffer();

        const command = new PutObjectCommand({
            Bucket: process.env.BUCKET_NAME,
            Key: `artworks/${req.body.coverImage}`,
            Body: buffer,
            ContentType: 'image/jpeg',
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
                const filename = `${uniqid('img-')}-${Date.now()}-${i + 1}.jpg`;

                const buffer = await sharp(file.buffer)
                    .resize({ width: 700 })
                    .toFormat('jpg')
                    .jpeg({ quality: 90 })
                    .toBuffer();

                const command = new PutObjectCommand({
                    Bucket: process.env.BUCKET_NAME,
                    Key: `artworks/${filename}`,
                    Body: buffer,
                    ContentType: 'image/jpeg',
                });

                await s3.send(command);
                req.body.images.push(filename);
            }),
        );
    }

    // if we're updating the cover image
    if (req.files.coverImage && req.params.id) {
        const callerReferenceValue = `${req.coverImageinvalidationKey}-${Date.now()}`;

        const invalidationParams = {
            DistributionId: process.env.ARTWORKS_DISTRIBUTION_ID,
            InvalidationBatch: {
                CallerReference: callerReferenceValue,
                Paths: {
                    Quantity: 1,
                    Items: ['/' + req.coverImageinvalidationKey],
                },
            },
        };
        const invalidationCommand = new CreateInvalidationCommand(invalidationParams);
        await cloudFront.send(invalidationCommand);
    }
    next();
});

exports.deletePreviousClientImages = catchAsync(async (req, res, next) => {
    if (!req?.files?.images) return next();

    const doc = await Client.findById(req.params.id);

    try {
        // if we are updating d images array and if there are previous images in the bucket
        if (req.files?.images && doc?.images?.length > 0) {
            await Promise.all(
                doc.images.map(async (curFileName) => {
                    const command2 = new DeleteObjectCommand({
                        Bucket: process.env.BUCKET_NAME,
                        Key: `artworks/${curFileName}`,
                    });
                    await s3.send(command2);
                }),
            );

            // delete from cloudfront cache
            await Promise.all(
                doc.images.map(async (curKey) => {
                    const invalidationParams = {
                        DistributionId: process.env.ARTWORKS_DISTRIBUTION_ID,
                        InvalidationBatch: {
                            CallerReference: curKey,
                            Paths: {
                                Quantity: 1,
                                Items: ['/' + curKey],
                            },
                        },
                    };
                    const invalidationCommand = new CreateInvalidationCommand(
                        invalidationParams,
                    );
                    await cloudFront.send(invalidationCommand);
                }),
            );
        }
    } catch (error) {
        next();
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
        Key: `artworks/${doc.coverImage}`,
    };
    const command = new DeleteObjectCommand(params);
    await s3.send(command);

    // delete all the client images in the images in the bucket
    if (doc?.images?.length > 0) {
        await Promise.all(
            doc.images.map(async (curFileName) => {
                const command2 = new DeleteObjectCommand({
                    Bucket: process.env.BUCKET_NAME,
                    Key: `artworks/${curFileName}`,
                });
                await s3.send(command2);
            }),
        );
    }

    req.coverImageinvalidationKey = doc.coverImage;
    req.imagesInvalidationKeyArray = doc.images;

    next();
});

exports.clearCloudfrontImageCache = catchAsync(async (req, res, next) => {
    try {
        // invalidate the cloud front cache for the coverImage
        const invalidationParams = {
            DistributionId: process.env.ARTWORKS_DISTRIBUTION_ID,
            InvalidationBatch: {
                CallerReference: req.coverImageinvalidationKey,
                Paths: {
                    Quantity: 1,
                    Items: ['/' + req.coverImageinvalidationKey],
                },
            },
        };
        const invalidationCommand = new CreateInvalidationCommand(invalidationParams);
        await cloudFront.send(invalidationCommand);

        // invalidate the cloud front cache for the images
        if (req.imagesInvalidationKeyArray?.length > 0) {
            await Promise.all(
                req.imagesInvalidationKeyArray.map(async (curKey) => {
                    const invalidationParams = {
                        DistributionId: process.env.ARTWORKS_DISTRIBUTION_ID,
                        InvalidationBatch: {
                            CallerReference: curKey,
                            Paths: {
                                Quantity: 1,
                                Items: ['/' + curKey],
                            },
                        },
                    };
                    const invalidationCommand = new CreateInvalidationCommand(
                        invalidationParams,
                    );
                    await cloudFront.send(invalidationCommand);
                }),
            );
        }
    } catch (error) {
        console.log(error);
        next();
    }

    next();
});

exports.getClientSlug = catchAsync(async (req, res, next) => {
    const doc = await Client.findOne({ slug: req.params.slug });

    if (!doc) {
        next(new AppError('There is no client with that name.', 404));
    }

    doc.coverImageUrl = process.env.ARTWORKS_CLOUD_FRONT_URL + doc?.coverImage;

    if (doc.images && doc.images.length > 0) {
        for (const imgPath of doc.images) {
            const curUrl = process.env.ARTWORKS_CLOUD_FRONT_URL + imgPath;
            doc.imagesUrl.push(curUrl);
        }
    }

    res.status(200).json({
        status: 'success',
        data: doc,
    });
});

exports.createClient = factory.createOne(Client);
exports.updateClient = factory.updateOne(Client);

exports.getAllClients = factory.getAll(Client, true, 'coverImage', 'coverImageUrl');
exports.getClient = factory.getOne(Client, true, 'coverImage', 'coverImageUrl');
exports.deleteClient = factory.deleteOne(Client);
