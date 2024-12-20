const db = require('../models/db');
const logger = require('../utils/logger');

// 添加库存记录
exports.addInventoryRecord = async (req, res) => {
    try {
        const { product_id, sku_id, type, quantity, reason, remark } = req.body;
        const operator_id = req.user.id;

        if (!product_id || !type || !quantity) {
            return res.status(400).json({ message: '商品ID、操作类型和数量为必填项' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            // 获取当前库存
            const [product] = await db.query(
                'SELECT stock FROM products WHERE id = ?',
                [product_id]
            );

            if (product.length === 0) {
                await db.rollback();
                return res.status(404).json({ message: '商品不存在' });
            }

            let current_stock = product[0].stock;
            
            // 计算新库存
            if (type === 'in') {
                current_stock += quantity;
            } else if (type === 'out') {
                if (current_stock < quantity) {
                    await db.rollback();
                    return res.status(400).json({ message: '库存不足' });
                }
                current_stock -= quantity;
            }

            // 更新商品库存
            await db.query(
                'UPDATE products SET stock = ? WHERE id = ?',
                [current_stock, product_id]
            );

            // 如果有SKU，也更新SKU库存
            if (sku_id) {
                const [sku] = await db.query(
                    'SELECT stock FROM product_skus WHERE id = ?',
                    [sku_id]
                );

                if (sku.length > 0) {
                    let sku_stock = sku[0].stock;
                    if (type === 'in') {
                        sku_stock += quantity;
                    } else if (type === 'out') {
                        sku_stock -= quantity;
                    }

                    await db.query(
                        'UPDATE product_skus SET stock = ? WHERE id = ?',
                        [sku_stock, sku_id]
                    );
                }
            }

            // 添加库存记录
            const [result] = await db.query(
                `INSERT INTO inventory_records 
                (product_id, sku_id, type, quantity, current_stock, reason, operator_id, remark)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [product_id, sku_id, type, quantity, current_stock, reason, operator_id, remark]
            );

            await db.commit();

            // 检查是否需要触发库存预警
            await checkInventoryAlert(product_id, current_stock);

            logger.info(`库存记录添加成功: ${result.insertId}`);
            res.status(201).json({
                message: '库存记录添加成功',
                recordId: result.insertId
            });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('添加库存记录失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取库存记录列表
exports.getInventoryRecords = async (req, res) => {
    try {
        const { page = 1, limit = 10, product_id, type, start_date, end_date } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT ir.*, p.name as product_name, u.username as operator_name
            FROM inventory_records ir
            LEFT JOIN products p ON ir.product_id = p.id
            LEFT JOIN users u ON ir.operator_id = u.id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM inventory_records ir';
        let conditions = [];
        let params = [];

        if (product_id) {
            conditions.push('ir.product_id = ?');
            params.push(product_id);
        }

        if (type) {
            conditions.push('ir.type = ?');
            params.push(type);
        }

        if (start_date) {
            conditions.push('ir.created_at >= ?');
            params.push(start_date);
        }

        if (end_date) {
            conditions.push('ir.created_at <= ?');
            params.push(end_date);
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        query += ' ORDER BY ir.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [records] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, params.slice(0, -2));

        res.json({
            records,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取库存记录列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 创建库存预警规则
exports.createInventoryAlert = async (req, res) => {
    try {
        const { product_id, sku_id, min_stock, max_stock } = req.body;

        if (!product_id || !min_stock || !max_stock) {
            return res.status(400).json({ message: '商品ID、最小库存和最大库存为必填项' });
        }

        // 检查是否已存在预警规则
        const [existingAlert] = await db.query(
            'SELECT id FROM inventory_alerts WHERE product_id = ? AND sku_id = ?',
            [product_id, sku_id]
        );

        if (existingAlert.length > 0) {
            return res.status(400).json({ message: '该商品已存在库存预警规则' });
        }

        const [result] = await db.query(
            `INSERT INTO inventory_alerts 
            (product_id, sku_id, min_stock, max_stock, alert_type)
            VALUES (?, ?, ?, ?, 'low')`,
            [product_id, sku_id, min_stock, max_stock]
        );

        logger.info(`库存预警规则创建成功: ${result.insertId}`);
        res.status(201).json({
            message: '库存预警规则创建成功',
            alertId: result.insertId
        });
    } catch (error) {
        logger.error('创建库存预警规则失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取库存预警列表
exports.getInventoryAlerts = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, alert_type } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT ia.*, p.name as product_name, p.stock as current_stock
            FROM inventory_alerts ia
            LEFT JOIN products p ON ia.product_id = p.id
        `;
        let countQuery = 'SELECT COUNT(*) as total FROM inventory_alerts ia';
        let conditions = [];
        let params = [];

        if (status) {
            conditions.push('ia.status = ?');
            params.push(status);
        }

        if (alert_type) {
            conditions.push('ia.alert_type = ?');
            params.push(alert_type);
        }

        if (conditions.length > 0) {
            const whereClause = ' WHERE ' + conditions.join(' AND ');
            query += whereClause;
            countQuery += whereClause;
        }

        query += ' ORDER BY ia.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [alerts] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, params.slice(0, -2));

        res.json({
            alerts,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取库存预警列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新库存预警规则
exports.updateInventoryAlert = async (req, res) => {
    try {
        const { id } = req.params;
        const { min_stock, max_stock, status } = req.body;

        const [alert] = await db.query(
            'SELECT id FROM inventory_alerts WHERE id = ?',
            [id]
        );

        if (alert.length === 0) {
            return res.status(404).json({ message: '库存预警规则不存在' });
        }

        await db.query(
            `UPDATE inventory_alerts 
            SET min_stock = ?, max_stock = ?, status = ?
            WHERE id = ?`,
            [min_stock, max_stock, status, id]
        );

        logger.info(`库存预警规则更新成功: ${id}`);
        res.json({ message: '库存预警规则更新成功' });
    } catch (error) {
        logger.error('更新库存预警规则失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除库存预警规则
exports.deleteInventoryAlert = async (req, res) => {
    try {
        const { id } = req.params;

        const [alert] = await db.query(
            'SELECT id FROM inventory_alerts WHERE id = ?',
            [id]
        );

        if (alert.length === 0) {
            return res.status(404).json({ message: '库存预警规则不存在' });
        }

        await db.query('DELETE FROM inventory_alerts WHERE id = ?', [id]);

        logger.info(`库存预警规则删除成功: ${id}`);
        res.json({ message: '库存预警规则删除成功' });
    } catch (error) {
        logger.error('删除库存预警规则失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 检查库存预警
async function checkInventoryAlert(product_id, current_stock) {
    try {
        const [alerts] = await db.query(
            'SELECT * FROM inventory_alerts WHERE product_id = ? AND status = "active"',
            [product_id]
        );

        for (const alert of alerts) {
            let alert_type = null;

            if (current_stock <= alert.min_stock) {
                alert_type = 'low';
            } else if (current_stock >= alert.max_stock) {
                alert_type = 'high';
            }

            if (alert_type) {
                await db.query(
                    'UPDATE inventory_alerts SET alert_type = ? WHERE id = ?',
                    [alert_type, alert.id]
                );

                // TODO: 发送通知给相关人员
                logger.info(`库存预警触发: 商品ID ${product_id}, 类型 ${alert_type}`);
            }
        }
    } catch (error) {
        logger.error('检查库存预警失败:', error);
    }
} 