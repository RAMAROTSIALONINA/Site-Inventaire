const db = require('../config/database');

class Supplier {
    static async createTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS suppliers (
                id INT AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                contact VARCHAR(255),
                phone VARCHAR(50),
                email VARCHAR(255),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `;
        await db.query(sql);
    }

    static async findAll() {
        const sql = `SELECT * FROM suppliers ORDER BY name`;
        const [rows] = await db.query(sql);
        return rows;
    }

    static async findById(id) {
        const sql = `SELECT * FROM suppliers WHERE id = ?`;
        const [rows] = await db.query(sql, [id]);
        return rows[0];
    }

    static async findByCode(code) {
        const sql = `SELECT * FROM suppliers WHERE code = ?`;
        const [rows] = await db.query(sql, [code]);
        return rows[0];
    }

    static async create(supplierData) {
        const sql = `INSERT INTO suppliers SET ?`;
        const [result] = await db.query(sql, supplierData);
        return result.insertId;
    }

    static async update(id, supplierData) {
        const sql = `UPDATE suppliers SET ? WHERE id = ?`;
        const [result] = await db.query(sql, [supplierData, id]);
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const sql = `DELETE FROM suppliers WHERE id = ?`;
        const [result] = await db.query(sql, [id]);
        return result.affectedRows > 0;
    }

    static async checkCodeUnique(code, excludeId = null) {
        let sql = `SELECT id, name FROM suppliers WHERE code = ?`;
        const params = [code];
        
        if (excludeId) {
            sql += ` AND id != ?`;
            params.push(excludeId);
        }
        
        const [rows] = await db.query(sql, params);
        return rows.length === 0 ? null : rows[0];
    }
}

module.exports = Supplier;