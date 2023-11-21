const mongoose = require('mongoose');
const slugify = require('slugify');

const clientSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        required: [true, 'A client name is required'],
        maxlength: [20, 'Client name must not have more than 20 characters'],
    },
    projectName: {
        type: String,
        trim: true,
        required: [true, 'The project name is required'],
        minlength: [5, 'Project name must not be less than 5 characters'],
        maxlength: [30, 'Project name must not have more than 30 characters'],
    },
    coverImage: {
        type: String,
        required: [true, 'A cover image is required'],
    },
    images: [String],
    description: {
        type: String,
        trim: true,
        required: [true, 'A project description is required'],
    },
    createdAt: {
        type: Date,
        default: Date.now(),
        select: false,
    },
    slug: String,
});

clientSchema.pre('save', function (next) {
    this.slug = slugify(this.projectName, { lower: true });
    next();
});

const Client = mongoose.model('Client', clientSchema);

module.exports = Client;
