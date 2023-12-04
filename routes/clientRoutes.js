const express = require('express');
const clientController = require('../controllers/clientController');
const authController = require('../controllers/authController');

const router = express.Router();

router
    .route('/')
    .get(clientController.getAllClients)
    .post(
        authController.protect,
        authController.restrictTo('lead-asist', 'admin'),
        clientController.uploadClientImages,
        clientController.resizeClientImages,
        clientController.createClient,
    );

router
    .route('/:id')
    .get(clientController.getClient)
    .patch(
        authController.protect,
        authController.restrictTo('lead-asist', 'admin'),
        clientController.uploadClientImages,
        clientController.resizeClientImages,
        clientController.deleteOutdatedImages,
        clientController.updateClient,
    )
    .delete(
        authController.protect,
        authController.restrictTo('lead-asist', 'admin'),
        clientController.deleteAllClientImages,
        clientController.deleteClient,
    );

module.exports = router;
