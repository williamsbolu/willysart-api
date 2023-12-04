const express = require('express');
const galleryController = require('../controllers/galleryController');
const authController = require('../controllers/authController');

const router = express.Router();

router
    .route('/')
    .get(galleryController.getAllGalleryItems)
    .post(
        authController.protect,
        authController.restrictTo('lead-asist', 'admin'),
        galleryController.uploadGalleryPhoto,
        galleryController.resizeGalleryPhoto,
        galleryController.createGallerItem,
    );

router
    .route('/:id')
    .get(galleryController.getGalleryItem)
    .patch(
        authController.protect,
        authController.restrictTo('lead-asist', 'admin'),
        galleryController.uploadGalleryPhoto,
        galleryController.resizeGalleryPhoto,
        galleryController.updateGalleryItem,
    )
    .delete(
        authController.protect,
        authController.restrictTo('lead-asist', 'admin'),
        galleryController.deleteGalleryImage,
        galleryController.deleteGalleryItem,
    );

module.exports = router;
