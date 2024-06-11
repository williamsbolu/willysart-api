const nodemailer = require('nodemailer');

const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');

exports.deleteOne = (Model) =>
    catchAsync(async (req, res, next) => {
        const doc = await Model.findByIdAndDelete(req.params.id);

        if (!doc) {
            // if null: there's no tour // This logic is for handlers querying documents based on id
            return next(new AppError('No document found with that ID', 404));
        }

        res.status(204).json({
            status: 'success',
            data: null,
        });
    });

exports.updateOne = (Model) =>
    catchAsync(async (req, res, next) => {
        const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        if (!doc) {
            // if null: there's no document // This logic is for handlers querying documents based on id
            return next(new AppError('No document found with that ID', 404));
        }

        res.status(200).json({
            status: 'success',
            data: doc,
        });
    });

exports.createOne = (Model) =>
    catchAsync(async (req, res, next) => {
        const doc = await Model.create(req.body); // saves d document in d database & returns d newly creatd document with d id

        res.status(201).json({
            status: 'success',
            data: doc,
        });
    });

exports.getOne = (Model, imageFile = false, ...imgPathInfo) =>
    catchAsync(async (req, res, next) => {
        const doc = await Model.findById(req.params.id);

        if (!doc) {
            // if null: there's no document // This logic is for handlers querying documents based on id
            return next(new AppError('No document found with that ID', 404));
        }

        const CLOUD_FRONT_URL =
            imgPathInfo[0] === 'photo'
                ? process.env.USERS_CLOUD_FRONT_URL
                : process.env.ARTWORKS_CLOUD_FRONT_URL;

        // user condition is for the User model
        if (imageFile || doc?.photo.startsWith('user')) {
            doc[imgPathInfo[1]] = CLOUD_FRONT_URL + doc[imgPathInfo[0]];

            if (doc.images && doc.images.length > 0) {
                for (const imgPath of doc.images) {
                    const curUrl = CLOUD_FRONT_URL + imgPath;
                    doc.imagesUrl.push(curUrl);
                }
            }
        }

        res.status(200).json({
            status: 'success',
            data: doc,
        });
    });

exports.getAll = (Model, imageFile = false, ...imgPathInfo) =>
    catchAsync(async (req, res, next) => {
        // for caculating the total document count without pagination
        const queryObj = { ...req.query };
        const excludedFields = ['page', 'sort', 'limit', 'fields'];
        excludedFields.forEach((el) => delete queryObj[el]);
        const count = await Model.countDocuments(queryObj);

        const features = new APIFeatures(Model.find().select('+createdAt'), req.query)
            .filter()
            .sort()
            .limitFields()
            .paginate();

        const doc = await features.query;

        const CLOUD_FRONT_URL =
            imgPathInfo[0] === 'photo'
                ? process.env.USERS_CLOUD_FRONT_URL
                : process.env.ARTWORKS_CLOUD_FRONT_URL;

        if (imageFile) {
            for (const curDoc of doc) {
                curDoc[imgPathInfo[1]] = CLOUD_FRONT_URL + curDoc[imgPathInfo[0]];
            }
        }

        // SEND RESPONSE
        res.status(200).json({
            status: 'success',
            count,
            results: doc.length,
            data: doc,
        });
    });

// exports.SendEmail = catchAsync(async (req, res, next) => {
//     const mailInfo = req.body;

//     const transporter = nodemailer.createTransport({
//         host: 'sandbox.smtp.mailtrap.io',
//         port: 587,
//         auth: {
//             user: 'ce00746e6cc01f',
//             pass: '1ea926ddb0d811',
//         },
//     });

//     await transporter.sendMail({
//         from: `${`${mailInfo.firstName} ${mailInfo.lastName}`} ${mailInfo.email}`,
//         to: 'iamwillysart@gmail.com',
//         subject: mailInfo.subject,
//         text: mailInfo.message,
//     });

//     res.status(200).json({
//         status: 'success',
//         message: 'Email submitted sucessfully',
//     });
// });

// exports.SendEmail = catchAsync(async (req, res, next) => {
//     const mailInfo = req.body;

//     const transporter = nodemailer.createTransport({
//         service: 'gmail',
//         auth: {
//             user: 'williams.bolu99@gmail.com',
//             pass: 'dggjbtvzclugwouf',
//         },
//     });

//     await transporter.sendMail({
//         from: mailInfo.email,
//         to: 'williams.bolu99@gmail.com',
//         replyTo: mailInfo.email,
//         subject: mailInfo.subject,
//         text: mailInfo.message,
//     });

//     res.status(200).json({
//         status: 'success',
//         message: 'Email submitted sucessfully',
//     });
// });

exports.SendEmail = catchAsync(async (req, res, next) => {
    const mailInfo = req.body;

    const transporter = nodemailer.createTransport({
        host: process.env.BREVO_HOST,
        port: 587,
        auth: {
            user: process.env.BREVO_USERNAME,
            pass: process.env.BREVO_PASSWORD,
        },
    });

    await transporter.sendMail({
        from: `${`${mailInfo.firstName} ${mailInfo.lastName}`} ${
            process.env.BREVO_EMAIL_FROM
        }`,
        replyTo: mailInfo.email,
        to: 'williams.precious999@gmail.com', // change admin email
        subject: mailInfo.subject,
        text: mailInfo.message,
    });

    res.status(200).json({
        status: 'success',
        message: 'Email sent successfully',
    });
});
