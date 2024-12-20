const pool = require('../db');

// 用户管理
const getUsers = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, email, role, status, created_at FROM users'
    );
    res.json(users);
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ message: '获取用户列表失败' });
  }
};

const getUser = async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, email, role, status, created_at FROM users WHERE id = ?',
      [req.params.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('获取用户详情错误:', error);
    res.status(500).json({ message: '获取用户详情失败' });
  }
};

const updateUser = async (req, res) => {
  const { username, email, role, status } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE users SET username = ?, email = ?, role = ?, status = ? WHERE id = ?',
      [username, email, role, status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ message: '用户信息更新成功' });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ message: '更新用户信息失败' });
  }
};

const deleteUser = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM users WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ message: '用户删除成功' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ message: '删除用户失败' });
  }
};

// 商品管理
const getProducts = async (req, res) => {
  try {
    const [products] = await pool.query(
      'SELECT * FROM products'
    );
    res.json(products);
  } catch (error) {
    console.error('获取商品列表错误:', error);
    res.status(500).json({ message: '获取商品列表失败' });
  }
};

const createProduct = async (req, res) => {
  const {
    name,
    description,
    price,
    stock,
    category_id,
    images,
    specifications
  } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO products (name, description, price, stock, category_id, images, specifications) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description, price, stock, category_id, JSON.stringify(images), JSON.stringify(specifications)]
    );

    res.status(201).json({
      message: '商品创建成功',
      productId: result.insertId
    });
  } catch (error) {
    console.error('创建商品错误:', error);
    res.status(500).json({ message: '创建商品失败' });
  }
};

const getProduct = async (req, res) => {
  try {
    const [products] = await pool.query(
      'SELECT * FROM products WHERE id = ?',
      [req.params.id]
    );

    if (products.length === 0) {
      return res.status(404).json({ message: '商品不存在' });
    }

    res.json(products[0]);
  } catch (error) {
    console.error('获取商品详情错误:', error);
    res.status(500).json({ message: '获取商品详情失败' });
  }
};

const updateProduct = async (req, res) => {
  const {
    name,
    description,
    price,
    stock,
    category_id,
    images,
    specifications
  } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE products SET name = ?, description = ?, price = ?, stock = ?, category_id = ?, images = ?, specifications = ? WHERE id = ?',
      [name, description, price, stock, category_id, JSON.stringify(images), JSON.stringify(specifications), req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '商品不存在' });
    }

    res.json({ message: '商品更新成功' });
  } catch (error) {
    console.error('更新商品错误:', error);
    res.status(500).json({ message: '更新商品失败' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM products WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '商品不存在' });
    }

    res.json({ message: '商品删除成功' });
  } catch (error) {
    console.error('删除商品错误:', error);
    res.status(500).json({ message: '删除商品失败' });
  }
};

// 订单管理
const getOrders = async (req, res) => {
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders'
    );
    res.json(orders);
  } catch (error) {
    console.error('获取订单列表错误:', error);
    res.status(500).json({ message: '获取订单列表失败' });
  }
};

const getOrder = async (req, res) => {
  try {
    const [orders] = await pool.query(
      'SELECT * FROM orders WHERE id = ?',
      [req.params.id]
    );

    if (orders.length === 0) {
      return res.status(404).json({ message: '订单不存在' });
    }

    // 获取订单商品
    const [orderItems] = await pool.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [req.params.id]
    );

    const order = {
      ...orders[0],
      items: orderItems
    };

    res.json(order);
  } catch (error) {
    console.error('获取订单详情错误:', error);
    res.status(500).json({ message: '获取订单详情失败' });
  }
};

const updateOrderStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE orders SET status = ? WHERE id = ?',
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '订单不存在' });
    }

    res.json({ message: '订单状态更新成功' });
  } catch (error) {
    console.error('更新订单状态错误:', error);
    res.status(500).json({ message: '更新订单状态失败' });
  }
};

// 营销管理
const getPromotions = async (req, res) => {
  try {
    const [promotions] = await pool.query(
      'SELECT * FROM promotions'
    );
    res.json(promotions);
  } catch (error) {
    console.error('获取促销活动列表错误:', error);
    res.status(500).json({ message: '获取促销活动列表失败' });
  }
};

const createPromotion = async (req, res) => {
  const {
    name,
    description,
    type,
    discount,
    start_time,
    end_time,
    product_ids
  } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO promotions (name, description, type, discount, start_time, end_time, product_ids) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, description, type, discount, start_time, end_time, JSON.stringify(product_ids)]
    );

    res.status(201).json({
      message: '促销活动创建成功',
      promotionId: result.insertId
    });
  } catch (error) {
    console.error('创建促销活动错误:', error);
    res.status(500).json({ message: '创建促销活动失败' });
  }
};

const getPromotion = async (req, res) => {
  try {
    const [promotions] = await pool.query(
      'SELECT * FROM promotions WHERE id = ?',
      [req.params.id]
    );

    if (promotions.length === 0) {
      return res.status(404).json({ message: '促销活动不存在' });
    }

    res.json(promotions[0]);
  } catch (error) {
    console.error('获取促销活动详情错误:', error);
    res.status(500).json({ message: '获取促销活动详情失败' });
  }
};

const updatePromotion = async (req, res) => {
  const {
    name,
    description,
    type,
    discount,
    start_time,
    end_time,
    product_ids
  } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE promotions SET name = ?, description = ?, type = ?, discount = ?, start_time = ?, end_time = ?, product_ids = ? WHERE id = ?',
      [name, description, type, discount, start_time, end_time, JSON.stringify(product_ids), req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '促销活动不存在' });
    }

    res.json({ message: '促销活动更新成功' });
  } catch (error) {
    console.error('更新促销活动错误:', error);
    res.status(500).json({ message: '更新促销活动失败' });
  }
};

const deletePromotion = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM promotions WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '促销活动不存在' });
    }

    res.json({ message: '促销活动删除成功' });
  } catch (error) {
    console.error('删除促销活动错误:', error);
    res.status(500).json({ message: '删除促销活动失败' });
  }
};

// 优惠券管理
const getCoupons = async (req, res) => {
  try {
    const [coupons] = await pool.query(
      'SELECT * FROM coupons'
    );
    res.json(coupons);
  } catch (error) {
    console.error('获取优惠券列表错误:', error);
    res.status(500).json({ message: '获取优惠券列表失败' });
  }
};

const createCoupon = async (req, res) => {
  const {
    code,
    type,
    value,
    min_purchase,
    start_time,
    end_time,
    quantity
  } = req.body;

  try {
    const [result] = await pool.query(
      'INSERT INTO coupons (code, type, value, min_purchase, start_time, end_time, quantity) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [code, type, value, min_purchase, start_time, end_time, quantity]
    );

    res.status(201).json({
      message: '优惠券创建成功',
      couponId: result.insertId
    });
  } catch (error) {
    console.error('创建优惠券错误:', error);
    res.status(500).json({ message: '创建优惠券失败' });
  }
};

const getCoupon = async (req, res) => {
  try {
    const [coupons] = await pool.query(
      'SELECT * FROM coupons WHERE id = ?',
      [req.params.id]
    );

    if (coupons.length === 0) {
      return res.status(404).json({ message: '优惠券不存在' });
    }

    res.json(coupons[0]);
  } catch (error) {
    console.error('获取优惠券详情错误:', error);
    res.status(500).json({ message: '获取优惠券详情失败' });
  }
};

const updateCoupon = async (req, res) => {
  const {
    code,
    type,
    value,
    min_purchase,
    start_time,
    end_time,
    quantity
  } = req.body;

  try {
    const [result] = await pool.query(
      'UPDATE coupons SET code = ?, type = ?, value = ?, min_purchase = ?, start_time = ?, end_time = ?, quantity = ? WHERE id = ?',
      [code, type, value, min_purchase, start_time, end_time, quantity, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '优惠券不存在' });
    }

    res.json({ message: '优惠券更新成功' });
  } catch (error) {
    console.error('更新优惠券错误:', error);
    res.status(500).json({ message: '更新优惠券失败' });
  }
};

const deleteCoupon = async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM coupons WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '优惠券不存在' });
    }

    res.json({ message: '优惠券删除成功' });
  } catch (error) {
    console.error('删除优惠券错误:', error);
    res.status(500).json({ message: '删除优惠券失败' });
  }
};

// 数据统计
const getOverviewStats = async (req, res) => {
  try {
    // 获取用户总数
    const [userStats] = await pool.query(
      'SELECT COUNT(*) as total FROM users'
    );

    // 获取商品总数
    const [productStats] = await pool.query(
      'SELECT COUNT(*) as total FROM products'
    );

    // 获取订单总数和总金额
    const [orderStats] = await pool.query(
      'SELECT COUNT(*) as total, SUM(total_amount) as revenue FROM orders WHERE status != "cancelled"'
    );

    res.json({
      users: userStats[0].total,
      products: productStats[0].total,
      orders: orderStats[0].total,
      revenue: orderStats[0].revenue || 0
    });
  } catch (error) {
    console.error('获取概览统计错误:', error);
    res.status(500).json({ message: '获取概览统计失败' });
  }
};

const getSalesStats = async (req, res) => {
  try {
    // 获取每日销售额
    const [dailySales] = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as orders,
        SUM(total_amount) as revenue
      FROM orders
      WHERE status != "cancelled"
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30`
    );

    // 获取热销商品
    const [topProducts] = await pool.query(
      `SELECT 
        p.id,
        p.name,
        COUNT(*) as orders,
        SUM(oi.quantity) as quantity
      FROM order_items oi
      JOIN products p ON p.id = oi.product_id
      JOIN orders o ON o.id = oi.order_id
      WHERE o.status != "cancelled"
      GROUP BY p.id
      ORDER BY quantity DESC
      LIMIT 10`
    );

    res.json({
      dailySales,
      topProducts
    });
  } catch (error) {
    console.error('获取销售统计错误:', error);
    res.status(500).json({ message: '获取销售统计失败' });
  }
};

const getUserStats = async (req, res) => {
  try {
    // 获取用户增长
    const [userGrowth] = await pool.query(
      `SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_users
      FROM users
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30`
    );

    // 获取用户分布
    const [userDistribution] = await pool.query(
      `SELECT 
        role,
        COUNT(*) as count
      FROM users
      GROUP BY role`
    );

    res.json({
      userGrowth,
      userDistribution
    });
  } catch (error) {
    console.error('获取用户统计错误:', error);
    res.status(500).json({ message: '获取用户统计失败' });
  }
};

const getProductStats = async (req, res) => {
  try {
    // 获取商品分类分布
    const [categoryDistribution] = await pool.query(
      `SELECT 
        c.name as category,
        COUNT(*) as count
      FROM products p
      JOIN categories c ON c.id = p.category_id
      GROUP BY c.id`
    );

    // 获取库存预警商品
    const [lowStockProducts] = await pool.query(
      `SELECT 
        id,
        name,
        stock
      FROM products
      WHERE stock <= 10
      ORDER BY stock ASC`
    );

    res.json({
      categoryDistribution,
      lowStockProducts
    });
  } catch (error) {
    console.error('获取商品统计错误:', error);
    res.status(500).json({ message: '获取商品统计失败' });
  }
};

module.exports = {
  // 用户管理
  getUsers,
  getUser,
  updateUser,
  deleteUser,

  // 商品管理
  getProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,

  // 订单管理
  getOrders,
  getOrder,
  updateOrderStatus,

  // 营销管理
  getPromotions,
  createPromotion,
  getPromotion,
  updatePromotion,
  deletePromotion,

  // 优惠券管理
  getCoupons,
  createCoupon,
  getCoupon,
  updateCoupon,
  deleteCoupon,

  // 数据统计
  getOverviewStats,
  getSalesStats,
  getUserStats,
  getProductStats
}; 