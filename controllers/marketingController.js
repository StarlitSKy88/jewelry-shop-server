const pool = require('../db');

// 促销活动
const getPromotions = async (req, res) => {
  try {
    const [promotions] = await pool.query(
      'SELECT * FROM promotions WHERE status = "active" AND NOW() BETWEEN start_time AND end_time'
    );
    res.json(promotions);
  } catch (error) {
    console.error('获取促销活动列表错误:', error);
    res.status(500).json({ message: '获取促销活动列表失败' });
  }
};

const getPromotion = async (req, res) => {
  try {
    const [promotions] = await pool.query(
      'SELECT * FROM promotions WHERE id = ? AND status = "active" AND NOW() BETWEEN start_time AND end_time',
      [req.params.id]
    );

    if (promotions.length === 0) {
      return res.status(404).json({ message: '促销活动不存在或已过期' });
    }

    res.json(promotions[0]);
  } catch (error) {
    console.error('获取促销活动详情错误:', error);
    res.status(500).json({ message: '获取促销活动详情失败' });
  }
};

const getPromotionsByCategory = async (req, res) => {
  try {
    const [promotions] = await pool.query(
      `SELECT p.* FROM promotions p
      JOIN promotion_categories pc ON p.id = pc.promotion_id
      WHERE pc.category_id = ? AND p.status = "active" AND NOW() BETWEEN p.start_time AND p.end_time`,
      [req.params.categoryId]
    );
    res.json(promotions);
  } catch (error) {
    console.error('获取分类促销活动错误:', error);
    res.status(500).json({ message: '获取分类促销活动失败' });
  }
};

const getPromotionsByProduct = async (req, res) => {
  try {
    const [promotions] = await pool.query(
      `SELECT p.* FROM promotions p
      JOIN promotion_products pp ON p.id = pp.promotion_id
      WHERE pp.product_id = ? AND p.status = "active" AND NOW() BETWEEN p.start_time AND p.end_time`,
      [req.params.productId]
    );
    res.json(promotions);
  } catch (error) {
    console.error('获取商品促销活动错误:', error);
    res.status(500).json({ message: '获取商品促销活动失败' });
  }
};

// 优惠券
const getUserCoupons = async (req, res) => {
  try {
    const [coupons] = await pool.query(
      `SELECT c.*, uc.used_at FROM coupons c
      JOIN user_coupons uc ON c.id = uc.coupon_id
      WHERE uc.user_id = ? AND (uc.used_at IS NULL OR c.allow_multiple_use = 1)
      AND NOW() BETWEEN c.start_time AND c.end_time`,
      [req.user.id]
    );
    res.json(coupons);
  } catch (error) {
    console.error('��取用户优惠券错误:', error);
    res.status(500).json({ message: '获取用户优惠券失败' });
  }
};

const claimCoupon = async (req, res) => {
  const { code } = req.params;

  try {
    // 检查优惠券是否存在且有效
    const [coupons] = await pool.query(
      'SELECT * FROM coupons WHERE code = ? AND status = "active" AND NOW() BETWEEN start_time AND end_time',
      [code]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ message: '优惠券不存在或已过期' });
    }

    const coupon = coupons[0];

    // 检查优惠券数量
    if (coupon.quantity !== null && coupon.quantity <= 0) {
      return res.status(400).json({ message: '优惠券已被领完' });
    }

    // 检查用户是否已领取过
    const [existingClaims] = await pool.query(
      'SELECT * FROM user_coupons WHERE user_id = ? AND coupon_id = ?',
      [req.user.id, coupon.id]
    );

    if (existingClaims.length > 0 && !coupon.allow_multiple_claim) {
      return res.status(400).json({ message: '您已领取过该优惠券' });
    }

    // 领取优惠券
    await pool.query(
      'INSERT INTO user_coupons (user_id, coupon_id) VALUES (?, ?)',
      [req.user.id, coupon.id]
    );

    // 更新优惠券数量
    if (coupon.quantity !== null) {
      await pool.query(
        'UPDATE coupons SET quantity = quantity - 1 WHERE id = ?',
        [coupon.id]
      );
    }

    res.json({ message: '优惠券领取成功' });
  } catch (error) {
    console.error('领取优惠券错误:', error);
    res.status(500).json({ message: '领取优惠券失败' });
  }
};

const getAvailableCoupons = async (req, res) => {
  try {
    const [coupons] = await pool.query(
      `SELECT * FROM coupons 
      WHERE status = "active" 
      AND NOW() BETWEEN start_time AND end_time
      AND (quantity IS NULL OR quantity > 0)`
    );
    res.json(coupons);
  } catch (error) {
    console.error('获取可用优惠券错误:', error);
    res.status(500).json({ message: '获取可用优惠券失败' });
  }
};

const validateCoupon = async (req, res) => {
  const { code } = req.params;
  const { amount } = req.query;

  try {
    // 检查优惠券是否存在且有效
    const [coupons] = await pool.query(
      `SELECT c.* FROM coupons c
      JOIN user_coupons uc ON c.id = uc.coupon_id
      WHERE c.code = ? AND c.status = "active" 
      AND NOW() BETWEEN c.start_time AND c.end_time
      AND uc.user_id = ? AND uc.used_at IS NULL`,
      [code, req.user.id]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ message: '优惠券不存在、已使用或已过期' });
    }

    const coupon = coupons[0];

    // 检查最低消费
    if (coupon.min_purchase && amount < coupon.min_purchase) {
      return res.status(400).json({
        message: `订单金额未达到优惠券使用条件，最低消费${coupon.min_purchase}元`
      });
    }

    // 计算优惠金额
    let discountAmount = 0;
    if (coupon.type === 'fixed') {
      discountAmount = coupon.value;
    } else if (coupon.type === 'percentage') {
      discountAmount = (amount * coupon.value) / 100;
    }

    // 如果有最大优惠限额
    if (coupon.max_discount && discountAmount > coupon.max_discount) {
      discountAmount = coupon.max_discount;
    }

    res.json({
      valid: true,
      discountAmount,
      coupon
    });
  } catch (error) {
    console.error('验证优惠券错误:', error);
    res.status(500).json({ message: '验证优惠券失败' });
  }
};

// 限时特价
const getFlashSales = async (req, res) => {
  try {
    const [flashSales] = await pool.query(
      'SELECT * FROM flash_sales WHERE status = "active" AND NOW() BETWEEN start_time AND end_time'
    );
    res.json(flashSales);
  } catch (error) {
    console.error('获取限时特价列表错误:', error);
    res.status(500).json({ message: '获取限时特价列表失败' });
  }
};

const getFlashSale = async (req, res) => {
  try {
    const [flashSales] = await pool.query(
      'SELECT * FROM flash_sales WHERE id = ? AND status = "active" AND NOW() BETWEEN start_time AND end_time',
      [req.params.id]
    );

    if (flashSales.length === 0) {
      return res.status(404).json({ message: '限时特价活动不存在或已过期' });
    }

    // 获取特价商品
    const [products] = await pool.query(
      `SELECT p.*, fs.flash_price, fs.stock as flash_stock
      FROM products p
      JOIN flash_sale_products fs ON p.id = fs.product_id
      WHERE fs.flash_sale_id = ?`,
      [req.params.id]
    );

    const flashSale = {
      ...flashSales[0],
      products
    };

    res.json(flashSale);
  } catch (error) {
    console.error('获取限时特价详情错误:', error);
    res.status(500).json({ message: '获取限时特价详情失败' });
  }
};

const getCurrentFlashSales = async (req, res) => {
  try {
    const [flashSales] = await pool.query(
      `SELECT * FROM flash_sales 
      WHERE status = "active" 
      AND NOW() BETWEEN start_time AND end_time
      ORDER BY start_time ASC`
    );
    res.json(flashSales);
  } catch (error) {
    console.error('获取当前限时特价错误:', error);
    res.status(500).json({ message: '获取当前限时特价失败' });
  }
};

const getUpcomingFlashSales = async (req, res) => {
  try {
    const [flashSales] = await pool.query(
      `SELECT * FROM flash_sales 
      WHERE status = "active" 
      AND start_time > NOW()
      ORDER BY start_time ASC
      LIMIT 5`
    );
    res.json(flashSales);
  } catch (error) {
    console.error('获取即将开始的限时特价错误:', error);
    res.status(500).json({ message: '获取即将开始的限时特价失败' });
  }
};

// 积分商城
const getPointsProducts = async (req, res) => {
  try {
    const [products] = await pool.query(
      'SELECT * FROM points_products WHERE status = "active"'
    );
    res.json(products);
  } catch (error) {
    console.error('获取积分商品列表错误:', error);
    res.status(500).json({ message: '获取积分商品列表失败' });
  }
};

const redeemPointsProduct = async (req, res) => {
  const { productId } = req.params;

  try {
    // 获取积分商品信息
    const [products] = await pool.query(
      'SELECT * FROM points_products WHERE id = ? AND status = "active"',
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({ message: '积分商品不存在' });
    }

    const product = products[0];

    // 检查库存
    if (product.stock <= 0) {
      return res.status(400).json({ message: '商品��存不足' });
    }

    // 获取用户积分
    const [users] = await pool.query(
      'SELECT points FROM users WHERE id = ?',
      [req.user.id]
    );

    const userPoints = users[0].points;

    // 检查积分是否足够
    if (userPoints < product.points_price) {
      return res.status(400).json({ message: '积分不足' });
    }

    // 开始事务
    await pool.query('START TRANSACTION');

    try {
      // 扣除积分
      await pool.query(
        'UPDATE users SET points = points - ? WHERE id = ?',
        [product.points_price, req.user.id]
      );

      // 减少库存
      await pool.query(
        'UPDATE points_products SET stock = stock - 1 WHERE id = ?',
        [productId]
      );

      // 记录兑换记录
      await pool.query(
        'INSERT INTO points_redemptions (user_id, product_id, points_cost) VALUES (?, ?, ?)',
        [req.user.id, productId, product.points_price]
      );

      await pool.query('COMMIT');
      res.json({ message: '商品兑换成功' });
    } catch (error) {
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('兑换积分商品错误:', error);
    res.status(500).json({ message: '兑换积分商品失败' });
  }
};

const getPointsHistory = async (req, res) => {
  try {
    const [history] = await pool.query(
      `SELECT pr.*, pp.name as product_name
      FROM points_redemptions pr
      JOIN points_products pp ON pr.product_id = pp.id
      WHERE pr.user_id = ?
      ORDER BY pr.created_at DESC`,
      [req.user.id]
    );
    res.json(history);
  } catch (error) {
    console.error('获取积分历史错误:', error);
    res.status(500).json({ message: '获取积分历史失败' });
  }
};

const getPointsBalance = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT points FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ points: users[0].points });
  } catch (error) {
    console.error('获取积分余额错误:', error);
    res.status(500).json({ message: '获取积分余额失败' });
  }
};

module.exports = {
  // 促销活动
  getPromotions,
  getPromotion,
  getPromotionsByCategory,
  getPromotionsByProduct,

  // 优惠券
  getUserCoupons,
  claimCoupon,
  getAvailableCoupons,
  validateCoupon,

  // 限时特价
  getFlashSales,
  getFlashSale,
  getCurrentFlashSales,
  getUpcomingFlashSales,

  // 积分商城
  getPointsProducts,
  redeemPointsProduct,
  getPointsHistory,
  getPointsBalance
}; 