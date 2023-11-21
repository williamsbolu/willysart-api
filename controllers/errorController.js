const AppError = require('../utils/appError');

const handleCastError = (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;

    // return an error object with d Operational error property
    return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
    // my solution: Object.values() returns an array
    const value = Object.values(err.keyValue)[0];
    // console.log(value);

    const message = `Duplicate field value: ${value}. Please use another value`;
    return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
    const errors = Object.values(err.errors).map((el) => el.message);
    // console.log(errors);

    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
};

const handleJWTError = () => new AppError('Invalid Token. Please log in again!', 401);

const handleJWTExpiredError = () =>
    new AppError('Your token has expired! Please log in again.', 401);

const sendErrorDev = (err, res) => {
    // receives d res and error object fro the error middleware
    res.status(err.statusCode).json({
        status: err.status,
        error: err,
        message: err.message,
        stack: err.stack,
    });
};

const sendErrorProd = (err, res) => {
    // Operational, trusted error: send this message to d client
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message,
        });
    }

    // programming or other unknown errors: dont leak error details to client
    console.error('Error 💥', err);

    // send generic message
    return res.status(500).json({
        status: 'error',
        message: 'Something went wrong!',
    });
};

module.exports = (err, req, res, next) => {
    // Don't forget that we're manipulating the err object
    // console.log(err.stack); // traces where d error originated

    // we do this in case the error is not an operational error
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, res);
    } else {
        // CastError: error gotten from invalid id in mongoose (Get "Model")
        if (err.name === 'CastError') err = handleCastError(err);

        // Mongoose duplicate key/fields (Create :Model)
        if (err.code === 11000) err = handleDuplicateFieldsDB(err);

        // Mongoose validation error (update "Model")
        if (err.name === 'ValidationError') err = handleValidationErrorDB(err);

        // json web token error "jwt.verify()": Invalid Token
        if (err.name === 'JsonWebTokenError') err = handleJWTError();

        // json web token error "jwt.verify()": Expired Token
        if (err.name === 'TokenExpiredError') err = handleJWTExpiredError();

        sendErrorProd(err, res);
    }
};
