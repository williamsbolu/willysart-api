const express = require('express');
const morgan = require('morgan');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

const clientRouter = require('./routes/clientRoutes');
const galleryRouter = require('./routes/galleryRoutes');
const userRouter = require('./routes/userRoutes');
const globalErrorHandler = require('./controllers/errorController');
const AppError = require('./utils/appError');
const factory = require('./controllers/handlerFactory');

const app = express();

// (1) Implement all nodejs/express and third party middlewares below
app.set('trust proxy', 1);

// implement CORS
app.use(
    cors({
        origin: ['https://fascinating-pixie-f4fdfb.netlify.app', 'http://localhost:5173'],
        credentials: true,
    }),
);
app.options('*', cors());

// serving static files
app.use(express.static(path.join(__dirname, 'public')));

// Set security HTTP headers "helmet()"
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Limit request from same APIs
const limiter = rateLimit({
    limit: 100,
    windowMs: 60 * 60 * 1000, // 1hr in milliseconds
    message: 'Too many request from this IP, please try again in an hour!',
});

app.use('/api', limiter);

// Body Parser, Cookie parser, form data parser
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize());

// Data sanitization against xss
app.use(xss());

// Prevent parameter pollution // whitelist is an array of properties for which we allow duplicate in the queryString
// app.use(hpp());
app.use(
    hpp({
        whitelist: ['type'],
    }),
);

app.use((req, res, next) => {
    // console.log(req.headers['x-forwarded-proto']);
    // console.log('secure', req.secure);

    next();
});

app.use(compression());

// (2)
app.use('/api/v1/clients', clientRouter);
app.use('/api/v1/gallery', galleryRouter);
app.use('/api/v1/users', userRouter);
app.post('/api/v1/sendEmail', factory.SendEmail);

app.all('*', (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
