const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const uniqid = require('uniqid');
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
    if (!req.file) return next();

    req.file.filename = `${uniqid('img-')}-${Date.now()}.jpeg`;

    await sharp(req.file.buffer)
        .resize({ width: 700 })
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/gallery/${req.file.filename}`);

    next();
});

exports.createGallerItem = catchAsync(async (req, res, next) => {
    if (!req.file)
        return next(
            new AppError(
                'No file was found! Add the image file from the input field to continue',
                400,
            ),
        );

    req.body.image = req.file.filename;

    const data = await Gallery.create(req.body);

    res.status(201).json({
        status: 'success',
        data,
    });
});

exports.updateGalleryItem = catchAsync(async (req, res, next) => {
    // if there's a file upload, we update the image field with the newly uploaded file name
    if (req.file) {
        req.body.image = req.file.filename;

        const doc = await Gallery.findById(req.params.id);
        // console.log(doc.image);

        // delete the previous used image
        fs.unlink(`public/img/gallery/${doc.image}`, (err) => {
            if (err) {
                console.log(`Error deleting previous image file: ${err}`);
            } else {
                console.log(`${doc.image} was deleted`);
            }
        });
    }

    const updatedItem = await Gallery.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
    });

    res.status(200).json({
        status: 'success',
        data: updatedItem,
    });
});

exports.deleteGalleryImage = async (req, res, next) => {
    const doc = await Gallery.findById(req.params.id);

    fs.unlink(`public/img/gallery/${doc.image}`, (err) => {
        if (err) {
            console.log(`Error deleting gallery image file: ${err}`);
        } else {
            console.log(`${doc.image} was deleted`);
        }
    });

    next();
};

exports.getAllGalleryItems = factory.getAll(Gallery);
exports.getGalleryItem = factory.getOne(Gallery);
exports.deleteGalleryItem = factory.deleteOne(Gallery);
