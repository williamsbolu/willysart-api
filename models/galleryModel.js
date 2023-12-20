const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema({
    type: {
        type: String,
        enum: {
            values: ['cover-art', 'illustration'],
            message: 'Type can be either: cover-art or illustration',
        },
        required: [true, 'A gallery item must have a specified type'],
    },
    description: {
        type: String,
        trim: true,
        required: [true, 'An image must have a description'],
        minlength: [5, 'Your description must not have less than 5 characters'],
        maxlength: [40, 'Your description must not have more than 40 characters'],
    },
    image: {
        type: String,
        required: [true, 'A gallery item must have an image'],
    },
    createdAt: {
        type: Date,
        default: Date.now(),
    },
    imageUrl: String,
});

const Gallery = mongoose.model('Gallery', gallerySchema);

module.exports = Gallery;
