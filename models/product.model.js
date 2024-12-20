const pool = require('../config/database');

class Product {
  constructor(data) {
    this.id = data.id;
    this.category_id = data.category_id;
    this.name = data.name;
    this.description = data.description;
    this.price = data.price;
    this.stock = data.stock;
    this.image_url = data.image_url;
    this.status = data.status;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.images = data.images || [];
    this.attributes = data.attributes || [];
  }

  static async create(data) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 创建商品
      const [result] = await conn.execute(
        'INSERT INTO products (category_id, name, description, price, stock, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [data.category_id, data.name, data.description, data.price, data.stock, data.image_url, data.status || 'active']
      );

      const productId = result.insertId;

      // 添加商品图片
      if (data.images && data.images.length > 0) {
        const imageValues = data.images.map(img => [productId, img.url, img.is_primary || false]);
        await conn.query(
          'INSERT INTO product_images (product_id, image_url, is_primary) VALUES ?',
          [imageValues]
        );
      }

      // 添加商品属性
      if (data.attributes && data.attributes.length > 0) {
        const attrValues = data.attributes.map(attr => [productId, attr.name, attr.value]);
        await conn.query(
          'INSERT INTO product_attributes (product_id, name, value) VALUES ?',
          [attrValues]
        );
      }

      await conn.commit();
      return this.findById(productId);
    } catch (error) {
      await conn.rollback();
      console.error('Error creating product:', error);
      throw error;
    } finally {
      conn.release();
    }
  }

  static async findById(id) {
    try {
      // 获取商品基本信息
      const [products] = await pool.execute(
        'SELECT * FROM products WHERE id = ?',
        [id]
      );

      if (!products[0]) return null;

      // 获取商品图片
      const [images] = await pool.execute(
        'SELECT * FROM product_images WHERE product_id = ?',
        [id]
      );

      // 获取商品属性
      const [attributes] = await pool.execute(
        'SELECT * FROM product_attributes WHERE product_id = ?',
        [id]
      );

      const productData = {
        ...products[0],
        images,
        attributes
      };

      return new Product(productData);
    } catch (error) {
      console.error('Error finding product by id:', error);
      throw error;
    }
  }

  static async findAll(options = {}) {
    try {
      let query = 'SELECT * FROM products';
      const values = [];
      const conditions = [];

      if (options.category_id) {
        conditions.push('category_id = ?');
        values.push(options.category_id);
      }

      if (options.status) {
        conditions.push('status = ?');
        values.push(options.status);
      }

      if (options.search) {
        conditions.push('(name LIKE ? OR description LIKE ?)');
        values.push(`%${options.search}%`, `%${options.search}%`);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      if (options.orderBy) {
        query += ` ORDER BY ${options.orderBy} ${options.order || 'ASC'}`;
      }

      if (options.limit) {
        query += ' LIMIT ?';
        values.push(parseInt(options.limit));

        if (options.offset) {
          query += ' OFFSET ?';
          values.push(parseInt(options.offset));
        }
      }

      const [rows] = await pool.execute(query, values);
      
      // 获取所有商品的图片和属��
      const products = await Promise.all(rows.map(async row => {
        const [images] = await pool.execute(
          'SELECT * FROM product_images WHERE product_id = ?',
          [row.id]
        );
        const [attributes] = await pool.execute(
          'SELECT * FROM product_attributes WHERE product_id = ?',
          [row.id]
        );
        return new Product({ ...row, images, attributes });
      }));

      return products;
    } catch (error) {
      console.error('Error finding products:', error);
      throw error;
    }
  }

  async update(data) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const updates = [];
      const values = [];

      if (data.category_id) {
        updates.push('category_id = ?');
        values.push(data.category_id);
      }
      if (data.name) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }
      if (data.price !== undefined) {
        updates.push('price = ?');
        values.push(data.price);
      }
      if (data.stock !== undefined) {
        updates.push('stock = ?');
        values.push(data.stock);
      }
      if (data.image_url) {
        updates.push('image_url = ?');
        values.push(data.image_url);
      }
      if (data.status) {
        updates.push('status = ?');
        values.push(data.status);
      }

      if (updates.length > 0) {
        values.push(this.id);
        await conn.execute(
          `UPDATE products SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          values
        );
      }

      // 更新商品图片
      if (data.images) {
        await conn.execute('DELETE FROM product_images WHERE product_id = ?', [this.id]);
        if (data.images.length > 0) {
          const imageValues = data.images.map(img => [this.id, img.url, img.is_primary || false]);
          await conn.query(
            'INSERT INTO product_images (product_id, image_url, is_primary) VALUES ?',
            [imageValues]
          );
        }
      }

      // 更新商品属性
      if (data.attributes) {
        await conn.execute('DELETE FROM product_attributes WHERE product_id = ?', [this.id]);
        if (data.attributes.length > 0) {
          const attrValues = data.attributes.map(attr => [this.id, attr.name, attr.value]);
          await conn.query(
            'INSERT INTO product_attributes (product_id, name, value) VALUES ?',
            [attrValues]
          );
        }
      }

      await conn.commit();
      return Product.findById(this.id);
    } catch (error) {
      await conn.rollback();
      console.error('Error updating product:', error);
      throw error;
    } finally {
      conn.release();
    }
  }

  static async delete(id) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM products WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // 更新库存
  async updateStock(quantity, type = 'increment') {
    try {
      const operator = type === 'increment' ? '+' : '-';
      const [result] = await pool.execute(
        `UPDATE products SET stock = stock ${operator} ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock ${operator} ? >= 0`,
        [quantity, this.id, quantity]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating product stock:', error);
      throw error;
    }
  }

  // 搜索商品
  static async search(query, options = {}) {
    try {
      let sql = `
        SELECT p.*, 
          GROUP_CONCAT(DISTINCT pi.image_url) as image_urls,
          GROUP_CONCAT(DISTINCT CONCAT(pa.name, ':', pa.value)) as attribute_pairs
        FROM products p
        LEFT JOIN product_images pi ON p.id = pi.product_id
        LEFT JOIN product_attributes pa ON p.id = pa.product_id
        WHERE (p.name LIKE ? OR p.description LIKE ?)
      `;
      const values = [`%${query}%`, `%${query}%`];

      if (options.category_id) {
        sql += ' AND p.category_id = ?';
        values.push(options.category_id);
      }

      if (options.min_price) {
        sql += ' AND p.price >= ?';
        values.push(options.min_price);
      }

      if (options.max_price) {
        sql += ' AND p.price <= ?';
        values.push(options.max_price);
      }

      sql += ' GROUP BY p.id';

      if (options.orderBy) {
        sql += ` ORDER BY ${options.orderBy} ${options.order || 'ASC'}`;
      }

      if (options.limit) {
        sql += ' LIMIT ?';
        values.push(parseInt(options.limit));

        if (options.offset) {
          sql += ' OFFSET ?';
          values.push(parseInt(options.offset));
        }
      }

      const [rows] = await pool.execute(sql, values);

      return rows.map(row => {
        const images = row.image_urls ? row.image_urls.split(',').map(url => ({ url })) : [];
        const attributes = row.attribute_pairs ? 
          row.attribute_pairs.split(',').map(pair => {
            const [name, value] = pair.split(':');
            return { name, value };
          }) : [];
        
        delete row.image_urls;
        delete row.attribute_pairs;
        
        return new Product({ ...row, images, attributes });
      });
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }
}

module.exports = Product; 