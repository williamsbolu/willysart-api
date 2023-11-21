module.exports = (fn) => {
    return (req, res, next) => {
        fn(req, res, next).catch(next);
        // fn(req, res, next).catch((err) => next(err)); // same as top
    };
};

// this (anonymous) function returned will be assigned to the express middleware function calling it
// this is the function that will be called by express (with access to req, res, next)

// we made the catchAsync function return another function to be assigned to express middleware function
// so that function can be called when necessary

// All errors caught here will be propagated/sent to the error handling middleware
