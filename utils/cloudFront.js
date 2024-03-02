const { CloudFrontClient } = require('@aws-sdk/client-cloudfront');

const cloudFront = new CloudFrontClient({
    credentials: {
        accessKeyId: process.env.ACCESS_KEY,
        secretAccessKey: process.env.SECRET_ACCESS_KEY,
    },
});

module.exports = cloudFront;

// The accessKey and secretAccessKey of the IAM user
