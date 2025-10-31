const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'swis_inventory',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

// Middleware
app.use(cors());
app.use(express.json());

// Middleware d'authentification
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token d\'accès requis' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'swis_secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token invalide' });
        }
        req.user = user;
        next();
    });
};

// Routes pour les articles
app.get('/api/articles', authenticateToken, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 15,
            search,
            site_id,
            category_id,
            department,
            status
        } = req.query;

        let query = `
            SELECT 
                a.*,
                s.name as site_name,
                c.name as category_name,
                u.symbol as unit_symbol,
                sup.name as supplier_name,
                CASE 
                    WHEN a.current_stock = 0 THEN 'danger'
                    WHEN a.current_stock <= a.alert_threshold * 0.3 THEN 'danger'
                    WHEN a.current_stock <= a.alert_threshold THEN 'warning'
                    ELSE 'ok'
                END as stock_status
            FROM articles a
            LEFT JOIN sites s ON a.site_id = s.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN units u ON a.unit_id = u.id
            LEFT JOIN suppliers sup ON a.supplier_id = sup.id
            WHERE a.is_active = true
        `;

        const params = [];
        let paramCount = 0;

        if (search) {
            paramCount++;
            query += ` AND (a.name ILIKE $${paramCount} OR a.code ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        if (site_id) {
            paramCount++;
            query += ` AND a.site_id = $${paramCount}`;
            params.push(site_id);
        }

        if (category_id) {
            paramCount++;
            query += ` AND a.category_id = $${paramCount}`;
            params.push(category_id);
        }

        if (department) {
            paramCount++;
            query += ` AND a.department = $${paramCount}`;
            params.push(department);
        }

        // Pagination
        const offset = (page - 1) * limit;
        paramCount++;
        query += ` ORDER BY a.name LIMIT $${paramCount}`;
        params.push(limit);

        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(offset);

        const result = await pool.query(query, params);
        
        // Count total
        const countQuery = `
            SELECT COUNT(*) 
            FROM articles a 
            WHERE a.is_active = true
            ${search ? 'AND (a.name ILIKE $1 OR a.code ILIKE $1)' : ''}
        `;
        const countParams = search ? [`%${search}%`] : [];
        const countResult = await pool.query(countQuery, countParams);
        const total = parseInt(countResult.rows[0].count);

        res.json({
            articles: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Erreur GET /api/articles:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/api/articles/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const query = `
            SELECT 
                a.*,
                s.name as site_name,
                c.name as category_name,
                u.symbol as unit_symbol,
                sup.name as supplier_name
            FROM articles a
            LEFT JOIN sites s ON a.site_id = s.id
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN units u ON a.unit_id = u.id
            LEFT JOIN suppliers sup ON a.supplier_id = sup.id
            WHERE a.id = $1
        `;
        
        const result = await pool.query(query, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Article non trouvé' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erreur GET /api/articles/:id:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.post('/api/articles', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const {
            code, name, description, category_id, department, site_id, unit_id,
            current_stock, min_stock, max_stock, alert_threshold, order_quantity,
            cost_price, selling_price, supplier_id, barcode, notes
        } = req.body;

        // Vérifier si le code existe déjà
        const existingArticle = await client.query(
            'SELECT id FROM articles WHERE code = $1',
            [code]
        );
        
        if (existingArticle.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Le code article existe déjà' });
        }

        // Insérer l'article
        const articleQuery = `
            INSERT INTO articles (
                code, name, description, category_id, department, site_id, unit_id,
                current_stock, min_stock, max_stock, alert_threshold, order_quantity,
                cost_price, selling_price, supplier_id, barcode, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `;
        
        const articleParams = [
            code, name, description, category_id, department, site_id, unit_id,
            current_stock, min_stock, max_stock, alert_threshold, order_quantity,
            cost_price, selling_price, supplier_id, barcode, notes
        ];
        
        const articleResult = await client.query(articleQuery, articleParams);
        const article = articleResult.rows[0];

        // Enregistrer le mouvement de stock initial
        const movementQuery = `
            INSERT INTO stock_movements (
                article_id, article_name, movement_type, quantity,
                previous_stock, new_stock, site_id, reason, user_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        
        await client.query(movementQuery, [
            article.id, article.name, 'creation', current_stock,
            0, current_stock, site_id, 'Création article', req.user.userId
        ]);

        // Journal d'audit
        const auditQuery = `
            INSERT INTO audit_log (user_id, action, table_name, record_id, new_values)
            VALUES ($1, $2, $3, $4, $5)
        `;
        
        await client.query(auditQuery, [
            req.user.userId, 'CREATE', 'articles', article.id,
            JSON.stringify(article)
        ]);

        await client.query('COMMIT');
        
        res.status(201).json(article);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur POST /api/articles:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    } finally {
        client.release();
    }
});

app.put('/api/articles/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;
        const updateFields = req.body;

        // Récupérer l'ancien article
        const oldArticleResult = await client.query(
            'SELECT * FROM articles WHERE id = $1',
            [id]
        );
        
        if (oldArticleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Article non trouvé' });
        }
        
        const oldArticle = oldArticleResult.rows[0];

        // Construire la requête de mise à jour dynamique
        const setClause = [];
        const params = [];
        let paramCount = 0;

        Object.keys(updateFields).forEach(key => {
            if (key !== 'id' && oldArticle[key] !== updateFields[key]) {
                paramCount++;
                setClause.push(`${key} = $${paramCount}`);
                params.push(updateFields[key]);
            }
        });

        if (setClause.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Aucune modification détectée' });
        }

        paramCount++;
        setClause.push(`updated_at = CURRENT_TIMESTAMP`);
        
        paramCount++;
        params.push(id);

        const updateQuery = `
            UPDATE articles 
            SET ${setClause.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const result = await client.query(updateQuery, params);
        const updatedArticle = result.rows[0];

        // Enregistrer le mouvement de stock si le stock a changé
        if (updateFields.current_stock !== undefined && 
            updateFields.current_stock !== oldArticle.current_stock) {
            
            const movementQuery = `
                INSERT INTO stock_movements (
                    article_id, article_name, movement_type, quantity,
                    previous_stock, new_stock, site_id, reason, user_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `;
            
            await client.query(movementQuery, [
                id, updatedArticle.name, 'adjustment',
                updateFields.current_stock - oldArticle.current_stock,
                oldArticle.current_stock, updateFields.current_stock,
                updatedArticle.site_id, 'Ajustement manuel', req.user.userId
            ]);
        }

        // Journal d'audit
        const auditQuery = `
            INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        await client.query(auditQuery, [
            req.user.userId, 'UPDATE', 'articles', id,
            JSON.stringify(oldArticle), JSON.stringify(updatedArticle)
        ]);

        await client.query('COMMIT');
        
        res.json(updatedArticle);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur PUT /api/articles/:id:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    } finally {
        client.release();
    }
});

app.delete('/api/articles/:id', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');
        
        const { id } = req.params;

        // Récupérer l'article avant suppression
        const oldArticleResult = await client.query(
            'SELECT * FROM articles WHERE id = $1',
            [id]
        );
        
        if (oldArticleResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Article non trouvé' });
        }
        
        const oldArticle = oldArticleResult.rows[0];

        // Soft delete
        await client.query(
            'UPDATE articles SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
            [id]
        );

        // Journal d'audit
        const auditQuery = `
            INSERT INTO audit_log (user_id, action, table_name, record_id, old_values)
            VALUES ($1, $2, $3, $4, $5)
        `;
        
        await client.query(auditQuery, [
            req.user.userId, 'DELETE', 'articles', id,
            JSON.stringify(oldArticle)
        ]);

        await client.query('COMMIT');
        
        res.json({ message: 'Article supprimé avec succès' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Erreur DELETE /api/articles/:id:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    } finally {
        client.release();
    }
});

// Routes pour les statistiques
app.get('/api/stats/dashboard', authenticateToken, async (req, res) => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_items,
                SUM(CASE WHEN current_stock <= alert_threshold AND current_stock > alert_threshold * 0.3 THEN 1 ELSE 0 END) as low_stock_items,
                SUM(CASE WHEN current_stock <= alert_threshold * 0.3 OR current_stock = 0 THEN 1 ELSE 0 END) as critical_items,
                SUM(current_stock * cost_price) as total_value,
                COUNT(CASE WHEN current_stock <= alert_threshold THEN 1 END) as items_to_reorder
            FROM articles 
            WHERE is_active = true
        `;
        
        const statsResult = await pool.query(statsQuery);
        const stats = statsResult.rows[0];

        // Répartition par catégorie
        const categoryQuery = `
            SELECT c.name, COUNT(a.id) as count
            FROM categories c
            LEFT JOIN articles a ON c.id = a.category_id AND a.is_active = true
            GROUP BY c.id, c.name
            ORDER BY count DESC
        `;
        
        const categoryResult = await pool.query(categoryQuery);

        // Articles à réapprovisionner
        const reorderQuery = `
            SELECT a.*, s.name as site_name, u.symbol as unit_symbol
            FROM articles a
            LEFT JOIN sites s ON a.site_id = s.id
            LEFT JOIN units u ON a.unit_id = u.id
            WHERE a.current_stock <= a.alert_threshold AND a.is_active = true
            ORDER BY a.current_stock / NULLIF(a.alert_threshold, 0) ASC
            LIMIT 10
        `;
        
        const reorderResult = await pool.query(reorderQuery);

        res.json({
            stats,
            categories: categoryResult.rows,
            reorderItems: reorderResult.rows
        });
    } catch (error) {
        console.error('Erreur GET /api/stats/dashboard:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Routes pour les sites
app.get('/api/sites', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sites WHERE is_active = true ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur GET /api/sites:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Routes pour les fournisseurs
app.get('/api/suppliers', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM suppliers WHERE is_active = true ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur GET /api/suppliers:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Routes pour les catégories
app.get('/api/categories', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM categories WHERE is_active = true ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur GET /api/categories:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Routes pour les unités
app.get('/api/units', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM units WHERE is_active = true ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Erreur GET /api/units:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Authentification (simplifiée pour l'exemple)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // En production, vérifier dans la table users
        if (username === 'admin' && password === 'admin') {
            const token = jwt.sign(
                { userId: 1, username: 'admin' },
                process.env.JWT_SECRET || 'swis_secret',
                { expiresIn: '24h' }
            );
            
            res.json({ token, user: { id: 1, username: 'admin', role: 'admin' } });
        } else {
            res.status(401).json({ error: 'Identifiants invalides' });
        }
    } catch (error) {
        console.error('Erreur POST /api/auth/login:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
    
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});