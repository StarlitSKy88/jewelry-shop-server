const express = require('express');
const router = express.Router();
const marketingController = require('../controllers/marketingController');
const { auth } = require('../middlewares/auth');

// 促销活动
router.get('/promotions', marketingController.getPromotions);
router.get('/promotions/:id', marketingController.getPromotion);
router.get('/promotions/category/:categoryId', marketingController.getPromotionsByCategory);
router.get('/promotions/product/:productId', marketingController.getPromotionsByProduct);

// 优惠券
router.get('/coupons', auth, marketingController.getUserCoupons);
router.post('/coupons/claim/:code', auth, marketingController.claimCoupon);
router.get('/coupons/available', auth, marketingController.getAvailableCoupons);
router.get('/coupons/validate/:code', auth, marketingController.validateCoupon);

// 限时特价
router.get('/flash-sales', marketingController.getFlashSales);
router.get('/flash-sales/:id', marketingController.getFlashSale);
router.get('/flash-sales/current', marketingController.getCurrentFlashSales);
router.get('/flash-sales/upcoming', marketingController.getUpcomingFlashSales);

// 积分���城
router.get('/points/products', auth, marketingController.getPointsProducts);
router.post('/points/redeem/:productId', auth, marketingController.redeemPointsProduct);
router.get('/points/history', auth, marketingController.getPointsHistory);
router.get('/points/balance', auth, marketingController.getPointsBalance);

module.exports = router; 