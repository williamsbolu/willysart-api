const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
    console.log('UNCAUGHT EXCEPTION! 💥 shutting down...');
    // console.log(err.name, err.message);
    console.log(err);

    process.exit(1); // terminate/exit d server
});

dotenv.config({
    path: './config.env',
});

const app = require('./app');

// Gets the database connection string and replace the password
const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

mongoose.connect(DB).then((con) => {
    console.log('Db connection successful!');
});
// .catch((err) => console.log('Error'));

console.log(process.env.NODE_ENV);

const port = process.env.port || 3000;
const server = app.listen(port, () => {
    console.log(`App running on port${port}...`);
});

// Handling Unhandled Rejections (promise) for (async) code // for errors outside express (eg: mongodb database connection)
process.on('unhandledRejection', (err) => {
    console.log('UNHANDLED REJECTION! 💥 shutting down...');
    console.log(err.name, err.message);

    // finishes all current and pending request and close
    server.close(() => {
        process.exit(1); // terminate/exit d serer
    });
});

process.on('SIGTERM', () => {
    console.log('✋ SIGTERM RECEIVED. Shutting down gracefully');

    // finishes all current and pending request and close
    server.close(() => {
        console.log('💥 Process terminated!');
    });

    // process.exit(1) // we dont need this cuz SIGTERM automatically cause d application to shut down
});
