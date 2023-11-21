const multer = require('multer');
const sharp = require('sharp');
const uniqid = require('uniqid');
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
    // console.log(req.files);

    if (!req.files.coverImage && !req.files.images) return next();

    // 1) coverImage
    if (req.files.coverImage) {
        req.body.coverImage = `${uniqid('img-')}-${Date.now()}-cover.jpeg`;
        await sharp(req.files.coverImage[0].buffer)
            .resize({ width: 700 })
            .toFormat('jpeg')
            .jpeg({ quality: 90 })
            .toFile(`public/img/client/${req.body.coverImage}`);
    }

    if (req.files.images) {
        req.body.images = [];
        // Using promise.all makes sure that we wait till the loops finishes with all async function (sharp) running
        // before we move to the next() function, because an async funtion is running inside the loop. await sharp happens inside one of callback functions of the loop methods
        // and we use map() so we can save the promises returned from d loop, so we can await all of them using Promise.all(), only after that we call d next()
        await Promise.all(
            req.files.images.map(async (file, i) => {
                const filename = `${uniqid('img-')}-${Date.now()}-${i + 1}.jpeg`;

                await sharp(file.buffer)
                    .resize({ width: 700 })
                    .toFormat('jpeg')
                    .jpeg({ quality: 90 })
                    .toFile(`public/img/client/${filename}`);

                req.body.images.push(filename);
            }),
        );
    }
    next();
});

exports.createClient = factory.createOne(Client);

exports.updateClient = factory.updateOne(Client);

exports.getAllClients = factory.getAll(Client);
exports.getClient = factory.getOne(Client);
exports.deleteClient = factory.deleteOne(Client);
