const pool = require('../config/database');

class CartItem {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.product_id = data.product_id;
    this.quantity = data.quantity;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.product = data.product;
  }

  static async create(data) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)',
        [data.user_id, data.product_id, data.quantity]
      );
      return this.findById(result.insertId || result.updateId);
    } catch (error) {
      console.error('Error creating cart item:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT ci.*, 
          p.name as product_name, 
          p.price as product_price,
          p.image_url as product_image,
          p.stock as product_stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.id = ?
      `, [id]);

      if (!rows[0]) return null;

      const cartItem = rows[0];
      cartItem.product = {
        id: cartItem.product_id,
        name: cartItem.product_name,
        price: cartItem.product_price,
        image_url: cartItem.product_image,
        stock: cartItem.product_stock
      };

      delete cartItem.product_name;
      delete cartItem.product_price;
      delete cartItem.product_image;
      delete cartItem.product_stock;

      return new CartItem(cartItem);
    } catch (error) {
      console.error('Error finding cart item by id:', error);
      throw error;
    }
  }

  static async findByUserIdAndProductId(userId, productId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?',
        [userId, productId]
      );
      return rows[0] ? new CartItem(rows[0]) : null;
    } catch (error) {
      console.error('Error finding cart item:', error);
      throw error;
    }
  }

  static async findByUserId(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT ci.*, 
          p.name as product_name, 
          p.price as product_price,
          p.image_url as product_image,
          p.stock as product_stock
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
      `, [userId]);

      return rows.map(row => {
        row.product = {
          id: row.product_id,
          name: row.product_name,
          price: row.product_price,
          image_url: row.product_image,
          stock: row.product_stock
        };

        delete row.product_name;
        delete row.product_price;
        delete row.product_image;
        delete row.product_stock;

        return new CartItem(row);
      });
    } catch (error) {
      console.error('Error finding cart items by user id:', error);
      throw error;
    }
  }

  async update(data) {
    try {
      const [result] = await pool.execute(
        'UPDATE cart_items SET quantity = ? WHERE id = ?',
        [data.quantity, this.id]
      );

      if (result.affectedRows > 0) {
        return CartItem.findById(this.id);
      }
      return this;
    } catch (error) {
      console.error('Error updating cart item:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM cart_items WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting cart item:', error);
      throw error;
    }
  }

  static async deleteByUserId(userId) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM cart_items WHERE user_id = ?',
        [userId]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting user cart items:', error);
      throw error;
    }
  }

  static async getTotal(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT SUM(ci.quantity * p.price) as total
        FROM cart_items ci
        JOIN products p ON ci.product_id = p.id
        WHERE ci.user_id = ?
      `, [userId]);

      return rows[0].total || 0;
    } catch (error) {
      console.error('Error calculating cart total:', error);
      throw error;
    }
  }
}

module.exports = CartItem; 