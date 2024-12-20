const CartItem = require('../models/cart.model');
const AppError = require('../utils/appError');

exports.addToCart = async (req, res, next) => {
  try {
    const { product_id, quantity } = req.body;
    const user_id = req.user.id;

    if (!product_id || !quantity) {
      return next(new AppError('请提供商品ID和数量', 400));
    }

    const cartItem = await CartItem.create({
      user_id,
      product_id,
      quantity
    });

    res.status(201).json({
      status: 'success',
      data: {
        cartItem
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCart = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const cartItems = await CartItem.findByUserId(user_id);
    const total = await CartItem.getTotal(user_id);

    res.status(200).json({
      status: 'success',
      data: {
        cartItems,
        total
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const user_id = req.user.id;

    if (!quantity) {
      return next(new AppError('请提供更新数量', 400));
    }

    const cartItem = await CartItem.findById(id);

    if (!cartItem) {
      return next(new AppError('购物车商品不存在', 404));
    }

    if (cartItem.user_id !== user_id) {
      return next(new AppError('无权限修改此购物车商品', 403));
    }

    const updatedCartItem = await cartItem.update({ quantity });

    res.status(200).json({
      status: 'success',
      data: {
        cartItem: updatedCartItem
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteCartItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const cartItem = await CartItem.findById(id);

    if (!cartItem) {
      return next(new AppError('购物车商品不存在', 404));
    }

    if (cartItem.user_id !== user_id) {
      return next(new AppError('无权限删除此购物车商品', 403));
    }

    await CartItem.delete(id);

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

exports.clearCart = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    await CartItem.deleteByUserId(user_id);

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error) {
    next(error);
  }
}; 