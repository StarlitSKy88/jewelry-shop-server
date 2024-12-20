const db = require('../models/db');
const logger = require('../utils/logger');
const { validateAmount } = require('../utils/validators');

// 创建订单
exports.createOrder = async (req, res) => {
    try {
        const {
            products,
            shipping_address,
            total_amount,
            payment_method,
            coupon_id
        } = req.body;
        const user_id = req.user.id;

        if (!products || !Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: '订单商品列表不能为空' });
        }

        if (!shipping_address) {
            return res.status(400).json({ message: '收货地址为必填项' });
        }

        if (!validateAmount(total_amount)) {
            return res.status(400).json({ message: '订单金额格式不正确' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            // 创建订单
            const [orderResult] = await db.query(
                'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, "pending")',
                [user_id, total_amount]
            );

            const order_id = orderResult.insertId;

            // 添加订单商品
            for (const product of products) {
                // 检查库存
                const [stockResult] = await db.query(
                    'SELECT stock FROM products WHERE id = ?',
                    [product.product_id]
                );

                if (stockResult.length === 0 || stockResult[0].stock < product.quantity) {
                    await db.rollback();
                    return res.status(400).json({ message: `商品 ${product.product_id} 库存不足` });
                }

                // 添加订单详情
                await db.query(
                    `INSERT INTO order_details 
                    (order_id, product_id, sku_id, quantity, unit_price, total_amount)
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        order_id,
                        product.product_id,
                        product.sku_id,
                        product.quantity,
                        product.unit_price,
                        product.quantity * product.unit_price
                    ]
                );

                // 更新库存
                await db.query(
                    'UPDATE products SET stock = stock - ? WHERE id = ?',
                    [product.quantity, product.product_id]
                );

                if (product.sku_id) {
                    await db.query(
                        'UPDATE product_skus SET stock = stock - ? WHERE id = ?',
                        [product.quantity, product.sku_id]
                    );
                }
            }

            // 添加收货地址
            await db.query(
                `INSERT INTO shipping_addresses 
                (order_id, receiver_name, phone, province, city, district, address, zip_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    order_id,
                    shipping_address.receiver_name,
                    shipping_address.phone,
                    shipping_address.province,
                    shipping_address.city,
                    shipping_address.district,
                    shipping_address.address,
                    shipping_address.zip_code
                ]
            );

            // 添加订单状态日志
            await db.query(
                'INSERT INTO order_status_logs (order_id, status, operator_id) VALUES (?, "pending", ?)',
                [order_id, user_id]
            );

            // 如果使用了优惠券，更新优惠券状态
            if (coupon_id) {
                await db.query(
                    `UPDATE user_coupons 
                    SET status = 'used', used_time = CURRENT_TIMESTAMP 
                    WHERE user_id = ? AND coupon_id = ?`,
                    [user_id, coupon_id]
                );

                await db.query(
                    'UPDATE coupons SET used_count = used_count + 1 WHERE id = ?',
                    [coupon_id]
                );
            }

            await db.commit();

            logger.info(`订单创建成功: ${order_id}`);
            res.status(201).json({
                message: '订单创建成功',
                orderId: order_id
            });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('创建订单失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取订单列表
exports.getOrders = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            start_date,
            end_date,
            search
        } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT o.*, 
                   u.username as user_name,
                   sa.receiver_name,
                   sa.phone,
                   sa.address
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN shipping_addresses sa ON o.id = sa.order_id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM orders o';
        let conditions = [];
        let params = [];

        if (status) {
            conditions.push('o.status = ?');
            params.push(status);
        }

        if (start_date) {
            conditions.push('o.created_at >= ?');
            params.push(start_date);
        }

        if (end_date) {
            conditions.push('o.created_at <= ?');
            params.push(end_date);
        }

        if (search) {
            conditions.push('(sa.receiver_name LIKE ? OR sa.phone LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [orders] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, params.slice(0, -2));

        // 获取订单详情
        for (let order of orders) {
            const [details] = await db.query(
                `SELECT od.*, p.name as product_name
                FROM order_details od
                LEFT JOIN products p ON od.product_id = p.id
                WHERE od.order_id = ?`,
                [order.id]
            );
            order.details = details;

            const [statusLogs] = await db.query(
                `SELECT osl.*, u.username as operator_name
                FROM order_status_logs osl
                LEFT JOIN users u ON osl.operator_id = u.id
                WHERE osl.order_id = ?
                ORDER BY osl.created_at DESC`,
                [order.id]
            );
            order.statusLogs = statusLogs;
        }

        res.json({
            orders,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取订单列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取订单详情
exports.getOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const [order] = await db.query(
            `SELECT o.*, 
                    u.username as user_name,
                    sa.receiver_name,
                    sa.phone,
                    sa.province,
                    sa.city,
                    sa.district,
                    sa.address,
                    sa.zip_code
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN shipping_addresses sa ON o.id = sa.order_id
            WHERE o.id = ?`,
            [id]
        );

        if (order.length === 0) {
            return res.status(404).json({ message: '订单不存在' });
        }

        // 获取订单详情
        const [details] = await db.query(
            `SELECT od.*, p.name as product_name
            FROM order_details od
            LEFT JOIN products p ON od.product_id = p.id
            WHERE od.order_id = ?`,
            [id]
        );
        order[0].details = details;

        // 获取订单状态日志
        const [statusLogs] = await db.query(
            `SELECT osl.*, u.username as operator_name
            FROM order_status_logs osl
            LEFT JOIN users u ON osl.operator_id = u.id
            WHERE osl.order_id = ?
            ORDER BY osl.created_at DESC`,
            [id]
        );
        order[0].statusLogs = statusLogs;

        res.json(order[0]);
    } catch (error) {
        logger.error('获取订单详情失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新订单状态
exports.updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remark } = req.body;
        const operator_id = req.user.id;

        // 开始事务
        await db.beginTransaction();

        try {
            // 检查订单是否存在
            const [order] = await db.query('SELECT status FROM orders WHERE id = ?', [id]);
            if (order.length === 0) {
                await db.rollback();
                return res.status(404).json({ message: '订单不存在' });
            }

            // 更新订单状态
            await db.query(
                'UPDATE orders SET status = ? WHERE id = ?',
                [status, id]
            );

            // 添加状态变更日志
            await db.query(
                'INSERT INTO order_status_logs (order_id, status, operator_id, remark) VALUES (?, ?, ?, ?)',
                [id, status, operator_id, remark]
            );

            await db.commit();

            logger.info(`订单状态更新成功: ${id}`);
            res.json({ message: '订单状态更新成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('更新订单状态失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 取消订单
exports.cancelOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const operator_id = req.user.id;

        // 开始事务
        await db.beginTransaction();

        try {
            // 检查订单是否存在
            const [order] = await db.query('SELECT status FROM orders WHERE id = ?', [id]);
            if (order.length === 0) {
                await db.rollback();
                return res.status(404).json({ message: '订单不存在' });
            }

            if (order[0].status === 'cancelled') {
                await db.rollback();
                return res.status(400).json({ message: '订单已取消' });
            }

            if (!['pending', 'paid'].includes(order[0].status)) {
                await db.rollback();
                return res.status(400).json({ message: '当前订单状态不允许取消' });
            }

            // 获取订单商品
            const [orderDetails] = await db.query(
                'SELECT * FROM order_details WHERE order_id = ?',
                [id]
            );

            // 恢复库存
            for (const detail of orderDetails) {
                await db.query(
                    'UPDATE products SET stock = stock + ? WHERE id = ?',
                    [detail.quantity, detail.product_id]
                );

                if (detail.sku_id) {
                    await db.query(
                        'UPDATE product_skus SET stock = stock + ? WHERE id = ?',
                        [detail.quantity, detail.sku_id]
                    );
                }
            }

            // 更新订单状态
            await db.query(
                'UPDATE orders SET status = "cancelled" WHERE id = ?',
                [id]
            );

            // 添加状态变更日志
            await db.query(
                'INSERT INTO order_status_logs (order_id, status, operator_id, remark) VALUES (?, "cancelled", ?, ?)',
                [id, operator_id, reason]
            );

            await db.commit();

            logger.info(`订单取消成功: ${id}`);
            res.json({ message: '订单取消成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('取消订单失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 批量更新订单状态
exports.batchUpdateStatus = async (req, res) => {
    try {
        const { orderIds, status, remark } = req.body;
        const operator_id = req.user.id;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({ message: '无效的订单ID列表' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            // 更新订单状态
            await db.query(
                'UPDATE orders SET status = ? WHERE id IN (?)',
                [status, orderIds]
            );

            // 添加状态变更日志
            for (const orderId of orderIds) {
                await db.query(
                    'INSERT INTO order_status_logs (order_id, status, operator_id, remark) VALUES (?, ?, ?, ?)',
                    [orderId, status, operator_id, remark]
                );
            }

            await db.commit();

            logger.info(`批量更新订单状态成功: ${orderIds.join(',')}`);
            res.json({ message: '订单状态更新成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('批量更新订单状态失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
}; 