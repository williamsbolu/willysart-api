const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const sendEmail = require('../utils/email');

const signToken = (id) => {
    // returns d token value
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};

const createSendToken = (user, statusCode, req, res) => {
    // Create our Token // jwt.sign(payload, secret, options)
    const token = signToken(user._id);

    // send a cookie
    res.cookie('jwt', token, {
        expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
        ), // returns milliseconds timestamp 90 days from now
        httpOnly: true,
        sameSite: 'none',
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https', // returns true or false
    });
    // we only want to activate this part "secure: true," in production

    // remove the password from the output
    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        user,
    });
};

exports.signup = catchAsync(async (req, res, next) => {
    const newUser = await User.create({
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        role: req.body.role,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
    });

    createSendToken(newUser, 201, req, res);
});

exports.login = catchAsync(async (req, res, next) => {
    const { email, password } = req.body;

    // (1) check if email and password exist and "RETURN"
    if (!email || !password) {
        return next(new AppError('Please provide email and password', 400));
    }

    // (2) check if the user exist && password is correct
    // because of the "select: false" schema options on the password, the output of the findOne will not contain the password, so we need to explicitly select it "+"
    const user = await User.findOne({ email: email }).select('+password');

    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('Incorrect email or password', 401));
    }

    // (3) if everything is okay, send token to d client
    createSendToken(user, 200, req, res);
});

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 1 * 1000), // 1 sec from now(10 * 1000)
        httpOnly: true,
        sameSite: 'none',
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https', // returns true or false
    });

    res.status(200).json({
        status: 'success',
    });
};

exports.protect = catchAsync(async (req, res, next) => {
    // 1. Get the token and check if its there
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // console.log('auth header is set 🎆🎆🎆');
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        return next(
            new AppError('You are not logged in! Please log in to get access.', 401),
        );
    }

    // 2. Verify token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    // console.log(decoded);

    // 3. Check if d user still exists
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
        return next(
            new AppError('The user belonging to this token does no longer exist.', 401),
        );
    }

    // 4. Check if user changed password after the token was issued/created
    if (currentUser.changePasswordAfter(decoded.iat)) {
        return next(
            new AppError('User recently changed password! please log in again.', 401),
        );
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser; // save to req object to be used in restrictTo()
    next();
});

exports.isLoggedInApi = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        // console.log('auth header is set 🎆🎆🎆');
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }

    if (!token) {
        // By default if there is no token, or we dont have a cookie!
        return res.status(200).json({
            status: 'success',
            isLoggedIn: false,
        });
    }

    try {
        // "throws" an error if it couldnt verify d token. thats why we use the try/catch block
        const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

        // Check if d user still exists
        const currentUser = await User.findById(decoded.id);
        if (!currentUser) {
            return res.status(200).json({
                status: 'success',
                isLoggedIn: false,
            });
        }

        // Check if user changed password after the token was issued/created
        if (currentUser.changePasswordAfter(decoded.iat)) {
            return res.status(200).json({
                status: 'success',
                isLoggedIn: false,
            });
        }

        return res.status(200).json({
            status: 'success',
            user: currentUser,
            isLoggedIn: true,
        });
    } catch (err) {
        // THERE IS NO LOGGED IN USER. error from jwt.verify()
        return res.status(200).json({
            status: 'success',
            isLoggedIn: false,
        });
    }
};

// A function that returns a middleware function
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        // roles ['admin', 'user']. role=user = "error"
        if (!roles.includes(req.user.role)) {
            return next(
                new AppError('You do not have permission to perform this action', 403),
            );
        }

        next();
    };
};

exports.updatePassword = catchAsync(async (req, res, next) => {
    // 1. Get the user from collection
    const user = await User.findById(req.user.id).select('+password');

    // 2. Check if POSTED current password is correct
    if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
        return next(new AppError('Your current password is wrong', 401));
    }

    // 3. If the password is correct, Update password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save(); // validators are on
    // User.findByIdAndUpdate() we didnt use this function becus our pre save middleware and validator won't run for this method

    // 4. Log the user in and send jwt
    createSendToken(user, 200, req, res);
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
    // 1) Get user based on posted email
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        return next(
            new AppError('There is no user with the specified email address', 404),
        );
    }

    // 2) Generate the random reset token
    const resetToken = user.createPasswordResetToken();
    console.log(resetToken);

    // save d modified fields "passwordResetToken" and "passwordResetExpires" to the db
    await user.save({ validateBeforeSave: false }); // passes in an option for .save() to deactivate all d validators/required fields

    // 3) Send it to user's email
    try {
        const resetURL = `${req.protocol}://${req.get(
            'host',
        )}/api/v1/users/resetPassword/${resetToken}`;

        const message = `Forgot your password?, Submit a PATCH request with your new password and passwordConfirm: to ${resetURL}
    \nIf you didn't forget your password please ignore this email!`;

        await sendEmail({
            email: user.email,
            subject: 'Your password reset token (valid for 10 min)',
            message,
        });

        // await new Email(user, resetURL).sendPasswordReset(); // future use

        res.status(200).json({
            status: 'success',
            message: 'Token sent to email',
        });
    } catch (err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false }); // saves d update to d database

        next(new AppError('There was an error sending the email, Try again later!', 500));
    }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    // 1.  Get user based on the token
    const hashedToken = crypto
        .createHash('sha256')
        .update(req.params.token)
        .digest('hex'); // encrypt the token to compare with the database encrypted token

    // "IMPORTANT💥" Here we find the user based on the "token" and based on if passwordResetExpires is greater then d current time
    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }, // used an operator to also chek if d passwordResetExpires is greater then d curent time
    });
    // console.log(user);

    // 2. if the token has not expired, and there is a user, set the new password.
    if (!user) {
        return next(new AppError('Token is invalid or has expired', 400));
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save(); // save d modified fields to the db

    // 3. Update ChangedPasswordAt property for the user (Done in d user model 👌)

    // 3. Log the user in, Send JWT
    createSendToken(user, 200, req, res);
});
