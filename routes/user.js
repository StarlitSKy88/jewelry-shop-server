const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { auth } = require('../middlewares/auth');

// 用户信息路由
router.get('/profile', auth, userController.getProfile);
router.put('/profile', auth, userController.updateProfile);
router.put('/password', auth, userController.changePassword);

// 收货地址路由
router.get('/addresses', auth, userController.getAddresses);
router.post('/addresses', auth, userController.createAddress);
router.put('/addresses/:id', auth, userController.updateAddress);
router.delete('/addresses/:id', auth, userController.deleteAddress);
router.put('/addresses/:id/default', auth, userController.setDefaultAddress);

// 收藏路由
router.get('/favorites', auth, userController.getFavorites);
router.post('/favorites/:productId', auth, userController.addFavorite);
router.delete('/favorites/:productId', auth, userController.removeFavorite);

// 优惠券路由
router.get('/coupons', auth, userController.getCoupons);
router.post('/coupons/:code', auth, userController.claimCoupon);

// 订单路由
router.get('/orders', auth, userController.getOrders);
router.get('/orders/:id', auth, userController.getOrder);

module.exports = router; 