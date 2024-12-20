const pool = require('../config/database');

class Category {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.parent_id = data.parent_id;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async create(data) {
    try {
      const [result] = await pool.execute(
        'INSERT INTO categories (name, description, parent_id) VALUES (?, ?, ?)',
        [data.name, data.description, data.parent_id]
      );
      return this.findById(result.insertId);
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM categories WHERE id = ?',
        [id]
      );
      return rows[0] ? new Category(rows[0]) : null;
    } catch (error) {
      console.error('Error finding category by id:', error);
      throw error;
    }
  }

  static async findAll() {
    try {
      const [rows] = await pool.execute('SELECT * FROM categories');
      return rows.map(row => new Category(row));
    } catch (error) {
      console.error('Error finding all categories:', error);
      throw error;
    }
  }

  static async findByParentId(parentId) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM categories WHERE parent_id = ?',
        [parentId]
      );
      return rows.map(row => new Category(row));
    } catch (error) {
      console.error('Error finding categories by parent id:', error);
      throw error;
    }
  }

  async update(data) {
    try {
      const updates = [];
      const values = [];

      if (data.name) {
        updates.push('name = ?');
        values.push(data.name);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }
      if (data.parent_id !== undefined) {
        updates.push('parent_id = ?');
        values.push(data.parent_id);
      }

      if (updates.length === 0) return this;

      values.push(this.id);
      const [result] = await pool.execute(
        `UPDATE categories SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      if (result.affectedRows > 0) {
        return Category.findById(this.id);
      }
      return this;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const [result] = await pool.execute(
        'DELETE FROM categories WHERE id = ?',
        [id]
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  // 获取分类树
  static async getTree() {
    try {
      const categories = await this.findAll();
      return this.buildTree(categories);
    } catch (error) {
      console.error('Error getting category tree:', error);
      throw error;
    }
  }

  // 构建分类树
  static buildTree(categories, parentId = null) {
    const tree = [];
    for (const category of categories) {
      if (category.parent_id === parentId) {
        const children = this.buildTree(categories, category.id);
        if (children.length) {
          category.children = children;
        }
        tree.push(category);
      }
    }
    return tree;
  }
}

module.exports = Category; 