const db = require('../models/db');
const logger = require('../utils/logger');

// 创建属性
exports.createAttribute = async (req, res) => {
    try {
        const { name, input_type, is_required, options } = req.body;

        if (!name || !input_type) {
            return res.status(400).json({ message: '属性名称和输入类型为必填项' });
        }

        // 检查属性名是否已存在
        const [existingAttribute] = await db.query(
            'SELECT id FROM product_attributes WHERE name = ?',
            [name]
        );

        if (existingAttribute.length > 0) {
            return res.status(400).json({ message: '属性名称已存在' });
        }

        // 创建属性
        const [result] = await db.query(
            'INSERT INTO product_attributes (name, input_type, is_required, options) VALUES (?, ?, ?, ?)',
            [name, input_type, is_required || false, options ? JSON.stringify(options) : null]
        );

        logger.info(`新商品属性创建成功: ${name}`);
        res.status(201).json({
            message: '商品属性创建成功',
            attributeId: result.insertId
        });
    } catch (error) {
        logger.error('创建商品属性失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取属性列表
exports.getAttributes = async (req, res) => {
    try {
        const { page = 1, limit = 10, search } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM product_attributes';
        let countQuery = 'SELECT COUNT(*) as total FROM product_attributes';
        let params = [];

        if (search) {
            query += ' WHERE name LIKE ?';
            countQuery += ' WHERE name LIKE ?';
            params.push(`%${search}%`);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [attributes] = await db.query(query, params);
        const [totalCount] = await db.query(countQuery, search ? [params[0]] : []);

        // 获取每个属性的使用次数
        for (let attr of attributes) {
            const [useCount] = await db.query(
                'SELECT COUNT(DISTINCT product_id) as count FROM product_attribute_values WHERE attribute_id = ?',
                [attr.id]
            );
            attr.useCount = useCount[0].count;

            // 解析选项
            if (attr.options) {
                try {
                    attr.options = JSON.parse(attr.options);
                } catch (e) {
                    attr.options = [];
                }
            }
        }

        res.json({
            attributes,
            pagination: {
                total: totalCount[0].total,
                page: parseInt(page),
                limit: parseInt(limit)
            }
        });
    } catch (error) {
        logger.error('获取商品属性列表失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 获取单个属性
exports.getAttribute = async (req, res) => {
    try {
        const { id } = req.params;

        const [attribute] = await db.query(
            'SELECT * FROM product_attributes WHERE id = ?',
            [id]
        );

        if (attribute.length === 0) {
            return res.status(404).json({ message: '属性不存在' });
        }

        // 解析选项
        if (attribute[0].options) {
            try {
                attribute[0].options = JSON.parse(attribute[0].options);
            } catch (e) {
                attribute[0].options = [];
            }
        }

        // 获取使用该属性的商品列表
        const [products] = await db.query(
            `SELECT p.*, pav.value 
            FROM products p
            JOIN product_attribute_values pav ON p.id = pav.product_id
            WHERE pav.attribute_id = ?
            ORDER BY p.created_at DESC`,
            [id]
        );

        attribute[0].products = products;

        res.json(attribute[0]);
    } catch (error) {
        logger.error('获取商品属性信息失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 更新属性
exports.updateAttribute = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, input_type, is_required, options } = req.body;

        if (!name || !input_type) {
            return res.status(400).json({ message: '属性名称和输入类型为必填项' });
        }

        // 检查属性是否存在
        const [attribute] = await db.query(
            'SELECT id FROM product_attributes WHERE id = ?',
            [id]
        );

        if (attribute.length === 0) {
            return res.status(404).json({ message: '属性不存在' });
        }

        // 检查新名称是否与其他属性重复
        const [existingAttribute] = await db.query(
            'SELECT id FROM product_attributes WHERE name = ? AND id != ?',
            [name, id]
        );

        if (existingAttribute.length > 0) {
            return res.status(400).json({ message: '属性名称已存在' });
        }

        await db.query(
            'UPDATE product_attributes SET name = ?, input_type = ?, is_required = ?, options = ? WHERE id = ?',
            [name, input_type, is_required, options ? JSON.stringify(options) : null, id]
        );

        logger.info(`商品属性更新成功: ${id}`);
        res.json({ message: '商品属性更新成功' });
    } catch (error) {
        logger.error('更新商品属性失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 删除属性
exports.deleteAttribute = async (req, res) => {
    try {
        const { id } = req.params;

        // 检查属性是否存在
        const [attribute] = await db.query(
            'SELECT id FROM product_attributes WHERE id = ?',
            [id]
        );

        if (attribute.length === 0) {
            return res.status(404).json({ message: '属性不存在' });
        }

        // 检查是否有商品使用该属性
        const [products] = await db.query(
            'SELECT DISTINCT product_id FROM product_attribute_values WHERE attribute_id = ?',
            [id]
        );

        if (products.length > 0) {
            return res.status(400).json({
                message: '无法删除属性，该属性正在被商品使用',
                productCount: products.length
            });
        }

        await db.query('DELETE FROM product_attributes WHERE id = ?', [id]);

        logger.info(`商品属性删除成功: ${id}`);
        res.json({ message: '商品属性删除成功' });
    } catch (error) {
        logger.error('删除商品属性失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
};

// 批量设置商品属性值
exports.batchSetAttributeValues = async (req, res) => {
    try {
        const { productIds, attributeValues } = req.body;

        if (!Array.isArray(productIds) || productIds.length === 0 || 
            !Array.isArray(attributeValues) || attributeValues.length === 0) {
            return res.status(400).json({ message: '无效的商品ID或属性值列表' });
        }

        // 开始事务
        await db.beginTransaction();

        try {
            for (const productId of productIds) {
                for (const attr of attributeValues) {
                    // 删除现有的属性值
                    await db.query(
                        'DELETE FROM product_attribute_values WHERE product_id = ? AND attribute_id = ?',
                        [productId, attr.attribute_id]
                    );

                    // 添加新的属性值
                    await db.query(
                        'INSERT INTO product_attribute_values (product_id, attribute_id, value) VALUES (?, ?, ?)',
                        [productId, attr.attribute_id, attr.value]
                    );
                }
            }

            await db.commit();
            logger.info(`批量设置商品属性值成功: 商品[${productIds.join(',')}]`);
            res.json({ message: '商品属性值设置成功' });
        } catch (error) {
            await db.rollback();
            throw error;
        }
    } catch (error) {
        logger.error('批量设置商品属性值失败:', error);
        res.status(500).json({ message: '服务器错误' });
    }
}; 