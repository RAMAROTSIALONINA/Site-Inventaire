const db = require('../config/database');
const fs = require('fs').promises;
const path = require('path');

class TechnicalSheet {
    static async createTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS technical_sheets (
                id INT AUTO_INCREMENT PRIMARY KEY,
                article_id INT NOT NULL,
                reference VARCHAR(255),
                specifications TEXT,
                document_path VARCHAR(500),
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
                UNIQUE KEY unique_article (article_id)
            )
        `;
        await db.query(sql);
    }

    static async findAll() {
        const sql = `
            SELECT ts.*, a.name as article_name, a.code as article_code,
                   u.username as created_by_name
            FROM technical_sheets ts
            LEFT JOIN articles a ON ts.article_id = a.id
            LEFT JOIN users u ON ts.created_by = u.id
            ORDER BY ts.updated_at DESC
        `;
        const [rows] = await db.query(sql);
        return rows;
    }

    static async findById(id) {
        const sql = `
            SELECT ts.*, a.name as article_name, a.code as article_code,
                   u.username as created_by_name
            FROM technical_sheets ts
            LEFT JOIN articles a ON ts.article_id = a.id
            LEFT JOIN users u ON ts.created_by = u.id
            WHERE ts.id = ?
        `;
        const [rows] = await db.query(sql, [id]);
        return rows[0];
    }

    static async findByArticleId(articleId) {
        const sql = `SELECT * FROM technical_sheets WHERE article_id = ?`;
        const [rows] = await db.query(sql, [articleId]);
        return rows[0];
    }

    static async create(technicalSheetData) {
        const sql = `INSERT INTO technical_sheets SET ?`;
        const [result] = await db.query(sql, technicalSheetData);
        return result.insertId;
    }

    static async update(id, technicalSheetData) {
        const sql = `UPDATE technical_sheets SET ? WHERE id = ?`;
        const [result] = await db.query(sql, [technicalSheetData, id]);
        return result.affectedRows > 0;
    }

    static async delete(id) {
        // Récupérer le document avant suppression pour le supprimer du système de fichiers
        const sheet = await this.findById(id);
        if (sheet && sheet.document_path) {
            try {
                await fs.unlink(path.join(__dirname, '..', '..', sheet.document_path));
            } catch (error) {
                console.warn('Impossible de supprimer le document:', error.message);
            }
        }

        const sql = `DELETE FROM technical_sheets WHERE id = ?`;
        const [result] = await db.query(sql, [id]);
        return result.affectedRows > 0;
    }

    static async saveDocument(file, technicalSheetId) {
        const uploadsDir = path.join(__dirname, '..', '..', 'frontend', 'uploads', 'technical-sheets');
        
        // Créer le dossier s'il n'existe pas
        await fs.mkdir(uploadsDir, { recursive: true });

        const fileExtension = path.extname(file.name);
        const filename = `tech-sheet-${technicalSheetId}${fileExtension}`;
        const filepath = path.join(uploadsDir, filename);
        const relativePath = path.join('uploads', 'technical-sheets', filename);

        await file.mv(filepath);
        return relativePath;
    }
}

module.exports = TechnicalSheet;