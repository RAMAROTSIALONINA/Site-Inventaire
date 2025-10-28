import pool from '../config/database.js';

// GET tous les articles
export const getArticles = async (req, res) => {
  try {
    const { search, site_id, category_id, status } = req.query;
    
    let query = `
      SELECT a.*, s.name as site_name, c.name as category_name, u.symbol as unit_symbol
      FROM articles a
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN units u ON a.unit_id = u.id
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

    query += ' ORDER BY a.name';

    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Erreur getArticles:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// GET un article
export const getArticle = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT a.*, s.name as site_name, c.name as category_name, u.symbol as unit_symbol
       FROM articles a
       LEFT JOIN sites s ON a.site_id = s.id
       LEFT JOIN categories c ON a.category_id = c.id
       LEFT JOIN units u ON a.unit_id = u.id
       WHERE a.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Article non trouvé' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur getArticle:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// POST créer un article
export const createArticle = async (req, res) => {
  try {
    const {
      code, name, description, category_id, department, site_id, unit_id,
      current_stock, alert_threshold, order_quantity, cost_price, supplier_id
    } = req.body;

    const result = await pool.query(
      `INSERT INTO articles (
        code, name, description, category_id, department, site_id, unit_id,
        current_stock, alert_threshold, order_quantity, cost_price, supplier_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [code, name, description, category_id, department, site_id, unit_id,
       current_stock, alert_threshold, order_quantity, cost_price, supplier_id]
    );

    // Ajouter mouvement de stock
    await pool.query(
      `INSERT INTO stock_movements (article_id, article_name, movement_type, quantity, site_id, reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [result.rows[0].id, name, 'initial', current_stock, site_id, 'Création article']
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Article créé avec succès'
    });

  } catch (error) {
    console.error('Erreur createArticle:', error);
    res.status(500).json({ error: 'Erreur création article' });
  }
};

// PUT modifier un article
export const updateArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = [];
    const values = [];
    let paramCount = 0;

    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        paramCount++;
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
      }
    });

    paramCount++;
    fields.push('updated_at = CURRENT_TIMESTAMP');
    paramCount++;
    values.push(id);

    const query = `UPDATE articles SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    
    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Article modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur updateArticle:', error);
    res.status(500).json({ error: 'Erreur modification article' });
  }
};

// DELETE supprimer un article
export const deleteArticle = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query('UPDATE articles SET is_active = false WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Article supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur deleteArticle:', error);
    res.status(500).json({ error: 'Erreur suppression article' });
  }
};

// GET statistiques
export const getStats = async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_items,
        COUNT(CASE WHEN current_stock <= alert_threshold THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_items,
        COALESCE(SUM(current_stock * cost_price), 0) as total_value
      FROM articles 
      WHERE is_active = true
    `);

    const categories = await pool.query(`
      SELECT c.name, COUNT(a.id) as count
      FROM categories c
      LEFT JOIN articles a ON c.id = a.category_id AND a.is_active = true
      GROUP BY c.id, c.name
    `);

    const alerts = await pool.query(`
      SELECT a.*, s.name as site_name
      FROM articles a
      LEFT JOIN sites s ON a.site_id = s.id
      WHERE a.current_stock <= a.alert_threshold AND a.is_active = true
      ORDER BY a.current_stock / a.alert_threshold ASC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        stats: stats.rows[0],
        categories: categories.rows,
        alerts: alerts.rows
      }
    });

  } catch (error) {
    console.error('Erreur getStats:', error);
    res.status(500).json({ error: 'Erreur statistiques' });
  }
};