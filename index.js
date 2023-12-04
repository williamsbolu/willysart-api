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

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(DB);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.log(error);
        process.exit(1);
    }
};

// console.log(process.env.NODE_ENV);

const PORT = process.env.PORT || 3000;

connectDB().then(() => {
    const server = app.listen(PORT, () => {
        console.log('listening for requests');
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
});
