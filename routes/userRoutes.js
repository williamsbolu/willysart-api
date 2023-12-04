const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const userController = require('../controllers/userController');

const authLimiter = rateLimit({
    limit: 7,
    windowMs: 5 * 60 * 1000,
    message: 'You have made too many request. Please wait 5 minutes before proceeding.',
});

const router = express.Router();

// getLogInStatus
router.get('/getLoggedInStatus', authController.isLoggedInApi);

router.post('/signup', authController.signup);
router.post('/login', authLimiter, authController.login);
router.get('/logout', authController.logout);

router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

router.use(authController.protect);

router.patch('/updateMyPassword', authController.updatePassword);
router.get('/me', userController.getMe, userController.getUser);
router.patch(
    '/updateMe',
    userController.uploadUserPhoto,
    userController.resizeUserPhoto,
    userController.updateMe,
);
router.delete('/deleteMe', userController.deleteMe);

router.use(authController.restrictTo('admin'));
router.route('/').get(userController.getAllUsers).post(userController.createUser);

router
    .route('/:id')
    .get(userController.getUser)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);

module.exports = router;
