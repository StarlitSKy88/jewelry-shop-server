const express = require('express');
const cartController = require('../controllers/cart.controller');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

// 所有购物车路由都需要登录
router.use(authMiddleware.protect);

// 获取购物车
router.get('/', cartController.getCart);

// 添加商品到购物车
router.post('/items', cartController.addToCart);

// 更新购物车商品数量
router.patch('/items/:id', cartController.updateCartItem);

// 删除购物车商品
router.delete('/items/:id', cartController.deleteCartItem);

// 清空购物车
router.delete('/', cartController.clearCart);

module.exports = router; 