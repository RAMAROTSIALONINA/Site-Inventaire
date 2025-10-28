import pool from '../config/database.js';

// ========== CATÉGORIES ==========
export const getCategories = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM categories ORDER BY name'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erreur getCategories:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    
    const result = await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Catégorie créée avec succès'
    });
  } catch (error) {
    console.error('Erreur createCategory:', error);
    res.status(500).json({ error: 'Erreur création catégorie' });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const result = await pool.query(
      'UPDATE categories SET name = $1, description = $2 WHERE id = $3 RETURNING *',
      [name, description, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Catégorie modifiée avec succès'
    });
  } catch (error) {
    console.error('Erreur updateCategory:', error);
    res.status(500).json({ error: 'Erreur modification catégorie' });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si la catégorie est utilisée
    const articlesCount = await pool.query(
      'SELECT COUNT(*) FROM articles WHERE category_id = $1',
      [id]
    );
    
    if (parseInt(articlesCount.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer : catégorie utilisée par des articles' 
      });
    }
    
    const result = await pool.query('DELETE FROM categories WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Catégorie non trouvée' });
    }
    
    res.json({ success: true, message: 'Catégorie supprimée avec succès' });
  } catch (error) {
    console.error('Erreur deleteCategory:', error);
    res.status(500).json({ error: 'Erreur suppression catégorie' });
  }
};

// ========== SITES ==========
export const getSites = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sites ORDER BY name'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erreur getSites:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const createSite = async (req, res) => {
  try {
    const { name, address } = req.body;
    
    const result = await pool.query(
      'INSERT INTO sites (name, address) VALUES ($1, $2) RETURNING *',
      [name, address]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Site créé avec succès'
    });
  } catch (error) {
    console.error('Erreur createSite:', error);
    res.status(500).json({ error: 'Erreur création site' });
  }
};

export const updateSite = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address } = req.body;
    
    const result = await pool.query(
      'UPDATE sites SET name = $1, address = $2 WHERE id = $3 RETURNING *',
      [name, address, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Site non trouvé' });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Site modifié avec succès'
    });
  } catch (error) {
    console.error('Erreur updateSite:', error);
    res.status(500).json({ error: 'Erreur modification site' });
  }
};

export const deleteSite = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si le site est utilisé
    const articlesCount = await pool.query(
      'SELECT COUNT(*) FROM articles WHERE site_id = $1',
      [id]
    );
    
    if (parseInt(articlesCount.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer : site utilisé par des articles' 
      });
    }
    
    const result = await pool.query('DELETE FROM sites WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Site non trouvé' });
    }
    
    res.json({ success: true, message: 'Site supprimé avec succès' });
  } catch (error) {
    console.error('Erreur deleteSite:', error);
    res.status(500).json({ error: 'Erreur suppression site' });
  }
};

// ========== UNITÉS ==========
export const getUnits = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM units ORDER BY name'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Erreur getUnits:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const createUnit = async (req, res) => {
  try {
    const { name, symbol } = req.body;
    
    const result = await pool.query(
      'INSERT INTO units (name, symbol) VALUES ($1, $2) RETURNING *',
      [name, symbol]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Unité créée avec succès'
    });
  } catch (error) {
    console.error('Erreur createUnit:', error);
    res.status(500).json({ error: 'Erreur création unité' });
  }
};

export const updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, symbol } = req.body;
    
    const result = await pool.query(
      'UPDATE units SET name = $1, symbol = $2 WHERE id = $3 RETURNING *',
      [name, symbol, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Unité non trouvée' });
    }
    
    res.json({
      success: true,
      data: result.rows[0],
      message: 'Unité modifiée avec succès'
    });
  } catch (error) {
    console.error('Erreur updateUnit:', error);
    res.status(500).json({ error: 'Erreur modification unité' });
  }
};

export const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Vérifier si l'unité est utilisée
    const articlesCount = await pool.query(
      'SELECT COUNT(*) FROM articles WHERE unit_id = $1',
      [id]
    );
    
    if (parseInt(articlesCount.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Impossible de supprimer : unité utilisée par des articles' 
      });
    }
    
    const result = await pool.query('DELETE FROM units WHERE id = $1', [id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Unité non trouvée' });
    }
    
    res.json({ success: true, message: 'Unité supprimée avec succès' });
  } catch (error) {
    console.error('Erreur deleteUnit:', error);
    res.status(500).json({ error: 'Erreur suppression unité' });
  }
};