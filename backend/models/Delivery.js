const db = require('../config/database');

class Delivery {
    static async createTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS deliveries (
                id INT AUTO_INCREMENT PRIMARY KEY,
                delivery_number VARCHAR(100) UNIQUE NOT NULL,
                supplier_id INT NOT NULL,
                delivery_date DATE NOT NULL,
                reference VARCHAR(255),
                status ENUM('pending', 'delivered', 'cancelled') DEFAULT 'pending',
                total_amount DECIMAL(15,2) DEFAULT 0,
                created_by INT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
            )
        `;
        await db.query(sql);
    }

    static async createDeliveryItemsTable() {
        const sql = `
            CREATE TABLE IF NOT EXISTS delivery_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                delivery_id INT NOT NULL,
                article_id INT NOT NULL,
                quantity DECIMAL(15,3) NOT NULL,
                unit_price DECIMAL(15,2) NOT NULL,
                total_price DECIMAL(15,2) AS (quantity * unit_price) STORED,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
                FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT
            )
        `;
        await db.query(sql);
    }

    static async findAll() {
        const sql = `
            SELECT d.*, s.name as supplier_name, 
                   COUNT(di.id) as items_count,
                   u.username as created_by_name
            FROM deliveries d
            LEFT JOIN suppliers s ON d.supplier_id = s.id
            LEFT JOIN delivery_items di ON d.id = di.delivery_id
            LEFT JOIN users u ON d.created_by = u.id
            GROUP BY d.id
            ORDER BY d.delivery_date DESC
        `;
        const [rows] = await db.query(sql);
        return rows;
    }

    static async findById(id) {
        const sql = `
            SELECT d.*, s.name as supplier_name, s.contact, s.phone, s.email,
                   u.username as created_by_name
            FROM deliveries d
            LEFT JOIN suppliers s ON d.supplier_id = s.id
            LEFT JOIN users u ON d.created_by = u.id
            WHERE d.id = ?
        `;
        const [rows] = await db.query(sql, [id]);
        return rows[0];
    }

    static async findItemsByDeliveryId(deliveryId) {
        const sql = `
            SELECT di.*, a.name as article_name, a.code as article_code, u.symbol as unit_symbol
            FROM delivery_items di
            LEFT JOIN articles a ON di.article_id = a.id
            LEFT JOIN units u ON a.unit_id = u.id
            WHERE di.delivery_id = ?
        `;
        const [rows] = await db.query(sql, [deliveryId]);
        return rows;
    }

    static async create(deliveryData) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Générer un numéro de livraison unique
            const date = new Date();
            const deliveryNumber = `LIV-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

            const deliverySql = `INSERT INTO deliveries SET ?`;
            const [deliveryResult] = await connection.query(deliverySql, {
                ...deliveryData,
                delivery_number: deliveryNumber
            });
            const deliveryId = deliveryResult.insertId;

            // Insérer les articles de la livraison
            if (deliveryData.items && deliveryData.items.length > 0) {
                let totalAmount = 0;
                
                for (const item of deliveryData.items) {
                    const itemSql = `INSERT INTO delivery_items SET ?`;
                    await connection.query(itemSql, {
                        delivery_id: deliveryId,
                        article_id: item.article_id,
                        quantity: item.quantity,
                        unit_price: item.unit_price
                    });

                    totalAmount += item.quantity * item.unit_price;

                    // Mettre à jour le stock de l'article
                    const updateStockSql = `
                        UPDATE articles 
                        SET current_stock = current_stock + ? 
                        WHERE id = ?
                    `;
                    await connection.query(updateStockSql, [item.quantity, item.article_id]);
                }

                // Mettre à jour le montant total
                const updateTotalSql = `UPDATE deliveries SET total_amount = ? WHERE id = ?`;
                await connection.query(updateTotalSql, [totalAmount, deliveryId]);
            }

            await connection.commit();
            return deliveryId;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async delete(id) {
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            // Récupérer les articles avant suppression pour ajuster les stocks
            const items = await this.findItemsByDeliveryId(id);
            
            // Réajuster les stocks
            for (const item of items) {
                const updateStockSql = `
                    UPDATE articles 
                    SET current_stock = current_stock - ? 
                    WHERE id = ?
                `;
                await connection.query(updateStockSql, [item.quantity, item.article_id]);
            }

            // Supprimer la livraison (les items seront supprimés par CASCADE)
            const sql = `DELETE FROM deliveries WHERE id = ?`;
            const [result] = await connection.query(sql, [id]);

            await connection.commit();
            return result.affectedRows > 0;

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    static async generateDeliveryNumber() {
        const date = new Date();
        return `LIV-${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }
}

module.exports = Delivery;