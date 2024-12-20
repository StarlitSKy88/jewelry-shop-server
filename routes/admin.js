const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { auth, isAdmin } = require('../middlewares/auth');

// 用户管理
router.get('/users', auth, isAdmin, adminController.getUsers);
router.get('/users/:id', auth, isAdmin, adminController.getUser);
router.put('/users/:id', auth, isAdmin, adminController.updateUser);
router.delete('/users/:id', auth, isAdmin, adminController.deleteUser);

// 商品管理
router.get('/products', auth, isAdmin, adminController.getProducts);
router.post('/products', auth, isAdmin, adminController.createProduct);
router.get('/products/:id', auth, isAdmin, adminController.getProduct);
router.put('/products/:id', auth, isAdmin, adminController.updateProduct);
router.delete('/products/:id', auth, isAdmin, adminController.deleteProduct);

// 订单管理
router.get('/orders', auth, isAdmin, adminController.getOrders);
router.get('/orders/:id', auth, isAdmin, adminController.getOrder);
router.put('/orders/:id/status', auth, isAdmin, adminController.updateOrderStatus);

// 营销管理
router.get('/promotions', auth, isAdmin, adminController.getPromotions);
router.post('/promotions', auth, isAdmin, adminController.createPromotion);
router.get('/promotions/:id', auth, isAdmin, adminController.getPromotion);
router.put('/promotions/:id', auth, isAdmin, adminController.updatePromotion);
router.delete('/promotions/:id', auth, isAdmin, adminController.deletePromotion);

// 优惠券管理
router.get('/coupons', auth, isAdmin, adminController.getCoupons);
router.post('/coupons', auth, isAdmin, adminController.createCoupon);
router.get('/coupons/:id', auth, isAdmin, adminController.getCoupon);
router.put('/coupons/:id', auth, isAdmin, adminController.updateCoupon);
router.delete('/coupons/:id', auth, isAdmin, adminController.deleteCoupon);

// 数据统计
router.get('/statistics/overview', auth, isAdmin, adminController.getOverviewStats);
router.get('/statistics/sales', auth, isAdmin, adminController.getSalesStats);
router.get('/statistics/users', auth, isAdmin, adminController.getUserStats);
router.get('/statistics/products', auth, isAdmin, adminController.getProductStats);

module.exports = router; 