class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor); // ignore 😅
    }
}

module.exports = AppError;

// constructor method is called each time we create a new object out of this class
// startsWith check what d value of d status code start with so we return d correct errorMessage

// Error.captureStackTrace(this, this.constructor);
// when a new object is created and d constructur funct is called, that function is not going to appear on the stack trace, and not polute it

// isOperational: we mark all the error we create using (AppError class) isOperational set to true
// all errors we create ourselves will be operational errors and its only these operational errors for which we want to send the error message to the client.
// so whenever we have like a programing error, or unknown error from a third party package, we dont
// want to send any error about that to the client in (production)
