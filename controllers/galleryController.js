const multer = require('multer');
const sharp = require('sharp');
const uniqid = require('uniqid');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { CreateInvalidationCommand } = require('@aws-sdk/client-cloudfront');
const s3 = require('../utils/s3');
const cloudFront = require('../utils/cloudFront');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const Gallery = require('../models/galleryModel');
const factory = require('./handlerFactory');

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

exports.uploadGalleryPhoto = upload.single('image');

exports.resizeGalleryPhoto = catchAsync(async (req, res, next) => {
    // if there is no file
    if (!req?.file) return next();

    // meaning if we are sending an update request use the previous ffilename
    if (req.params.id) {
        const doc = await Gallery.findById(req.params.id);
        req.file.filename = doc.image;
    } else {
        // if we're sending a create request, usea a unique filename
        req.file.filename = `${uniqid('img-')}-${Date.now()}.jpeg`;
    }

    const buffer = await sharp(req.file.buffer)
        .resize({ width: 700 })
        .toFormat('jpeg')
        .jpeg({ quality: 100 })
        .toBuffer();

    const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: req.file.filename,
        Body: buffer,
        ContentType: req.file.mimetype,
    });

    await s3.send(command);

    // if we are updating an image, we update the cloudFront cache
    if (req.params.id) {
        const callerReferenceValue = `${req.file.filename}-${Date.now()}`;

        const invalidationParams = {
            DistributionId: process.env.DISTRIBUTION_ID,
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

// checks if there is an image, it true update the image file name in the request body
exports.checkAddImageHandler = catchAsync(async (req, res, next) => {
    if (!req?.file)
        return next(
            new AppError(
                'No file was found! Add the image file from the input field to continue',
                400,
            ),
        );

    req.body.image = req.file.filename;
    next();
});

exports.deleteGalleryImage = catchAsync(async (req, res, next) => {
    const doc = await Gallery.findById(req.params.id);

    if (!doc) {
        return next(new AppError('No document found with that ID', 404));
    }

    const params = {
        Bucket: process.env.BUCKET_NAME,
        Key: doc.image,
    };

    const command = new DeleteObjectCommand(params);
    await s3.send(command);

    // if we are deleting the image, we update the cloudFront cache immediately
    const invalidationParams = {
        DistributionId: process.env.DISTRIBUTION_ID,
        InvalidationBatch: {
            CallerReference: doc.image,
            Paths: {
                Quantity: 1,
                Items: ['/' + doc.image],
            },
        },
    };
    const invalidationCommand = new CreateInvalidationCommand(invalidationParams);
    await cloudFront.send(invalidationCommand);

    next();
});

exports.createGallerItem = factory.createOne(Gallery);
exports.getAllGalleryItems = factory.getAll(Gallery, true, 'image', 'imageUrl');
exports.getGalleryItem = factory.getOne(Gallery, true, 'image', 'imageUrl');
exports.updateGalleryItem = factory.updateOne(Gallery);
exports.deleteGalleryItem = factory.deleteOne(Gallery);
