const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.password = data.password;
    this.role = data.role || 'user';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static async findByEmail(email) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE email = ?',
        [email]
      );
      return rows[0] ? new User(rows[0]) : null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );
      return rows[0] ? new User(rows[0]) : null;
    } catch (error) {
      console.error('Error finding user by id:', error);
      throw error;
    }
  }

  static async create(data) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 12);
      const [result] = await pool.execute(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [data.username, data.email, hashedPassword, data.role || 'user']
      );
      return this.findById(result.insertId);
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async verifyPassword(password) {
    try {
      return await bcrypt.compare(password, this.password);
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  }

  async update(data) {
    try {
      const updates = [];
      const values = [];

      if (data.username) {
        updates.push('username = ?');
        values.push(data.username);
      }
      if (data.email) {
        updates.push('email = ?');
        values.push(data.email);
      }
      if (data.password) {
        updates.push('password = ?');
        values.push(await bcrypt.hash(data.password, 12));
      }
      if (data.role) {
        updates.push('role = ?');
        values.push(data.role);
      }

      if (updates.length === 0) return this;

      values.push(this.id);
      const [result] = await pool.execute(
        `UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );

      if (result.affectedRows > 0) {
        return User.findById(this.id);
      }
      return this;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  toJSON() {
    const { password, ...userWithoutPassword } = this;
    return userWithoutPassword;
  }
}

module.exports = User; 