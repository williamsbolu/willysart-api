const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: [true, 'Please tell us your first name'],
    },
    lastName: {
        type: String,
        required: [true, 'Please tell us your last name'],
    },
    email: {
        type: String,
        required: [true, 'Please provide your email'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please provide a valid email'],
    },
    photo: {
        type: String,
        default: 'default.jpg',
    },
    role: {
        type: String,
        enum: ['lead-asist', 'admin', 'guest'],
        default: 'guest',
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [8, 'Password must not have less than 8 characters'],
        maxlength: [16, 'Password must not have more than 16 characters'],
        select: false,
    },
    passwordConfirm: {
        type: String,
        required: [true, 'Please confirm your password'],
        validate: {
            validator: function (el) {
                // "This" only works on CREATE and SAVE!!!
                // if passwordConfirm === password
                return el === this.password;
            },
            message: 'Passwords are not the same!',
        },
    },
    createdAt: {
        type: Date,
        default: Date.now(),
        select: false,
    },
    imageUrl: String,
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
        type: Boolean,
        default: true,
        select: false,
    },
});

// Document Middleware // "this" refers to d current document being processed
userSchema.pre('save', async function (next) {
    // if d "password" field has "not" been updated/modified: by default using Create, and updating/changing the password: isModified is truthy
    if (!this.isModified('password')) return next();

    // Encrypt d password: hash with a cost of 12
    this.password = await bcrypt.hash(this.password, 12); // Async: returns a promise

    // Delete the passwordConfirm field
    this.passwordConfirm = undefined;

    next();
});

userSchema.pre('save', function (next) {
    // if d "password" field has "not" been modified or if the document/field is new
    if (!this.isModified('password') || this.isNew) return next();

    this.passwordChangedAt = Date.now() - 1000; // because saving to the db is a bit slower than issueing the token, we set the passwordChangedAt to 1 seconds before d current time to ensure that it is created before the token

    next();
});

// Query Middleware
userSchema.pre(/^find/, function (next) {
    // this points to the current query
    this.find({ active: { $ne: false } });
    next();
});

// Instance Method: "this" points to current document
userSchema.methods.correctPassword = async function (candidatePassword, userPassword) {
    // this.password: is not available due to d "select: false "field

    // returns "true" if d password are d same if not "false"
    return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changePasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimeStamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10); // return timestamp in "seconds" not "milliseconds"

        // console.log(changedTimeStamp, JWTTimestamp);
        return JWTTimestamp < changedTimeStamp; // True means changed
    }

    // by default returns false means d user has not changed his password after d token was issued
    return false;
};

userSchema.methods.createPasswordResetToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');

    // By using "this" here in instance method, we did not save to the db, we "modify" the user document with the updated data
    // so later we "Save" the encrypted token "passwordResetToken" and "passwordResetExpires" to the db so we can compare with the token the user provides
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex'); // encrypt the token

    // console.log({ resetToken }, this.passwordResetToken);

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // current date + 10 minutes

    return resetToken; // return the plain token
};

const User = mongoose.model('User', userSchema);

module.exports = User;
