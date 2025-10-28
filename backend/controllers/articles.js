// backend/controllers/articles.js - VERSION COMPLÈTE AVEC SUPPRESSION RÉELLE
import { logHistory } from '../middleware/logger.js';
import pool from '../config/database.js';

// 🔥 FONCTIONS DE VALIDATION AMÉLIORÉES
const validateArticleData = (data, isUpdate = false) => {
  const errors = [];

  // Validation du code
  if (!data.code || data.code.trim().length === 0) {
    errors.push('Le code est obligatoire');
  } else if (data.code.trim().length > 50) {
    errors.push('Le code ne doit pas dépasser 50 caractères');
  }

  // Validation du nom
  if (!data.name || data.name.trim().length === 0) {
    errors.push('Le nom est obligatoire');
  } else if (data.name.trim().length > 100) {
    errors.push('Le nom ne doit pas dépasser 100 caractères');
  }

  // Validation des IDs
  if (!data.category_id || isNaN(parseInt(data.category_id))) {
    errors.push('La catégorie est obligatoire');
  }
  if (!data.site_id || isNaN(parseInt(data.site_id))) {
    errors.push('Le site est obligatoire');
  }
  if (!data.unit_id || isNaN(parseInt(data.unit_id))) {
    errors.push('L\'unité est obligatoire');
  }

  // Validation des valeurs numériques
  const currentStock = parseFloat(data.current_stock);
  const alertThreshold = parseFloat(data.alert_threshold);

  if (isNaN(currentStock) || currentStock < 0) {
    errors.push('Le stock actuel doit être un nombre positif ou zéro');
  }

  if (isNaN(alertThreshold) || alertThreshold < 0) {
    errors.push('Le seuil d\'alerte doit être un nombre positif ou zéro');
  }

  return errors;
};

// Validation des références
const validateReferences = async (category_id, site_id, unit_id) => {
  try {
    console.log('🔍 Validation références:', { category_id, site_id, unit_id });

    // Vérifier la catégorie
    const categoryCheck = await pool.query('SELECT id, name FROM categories WHERE id = $1', [parseInt(category_id)]);
    if (categoryCheck.rows.length === 0) {
      throw new Error(`Catégorie ID ${category_id} non trouvée`);
    }

    // Vérifier le site
    const siteCheck = await pool.query('SELECT id, name FROM sites WHERE id = $1', [parseInt(site_id)]);
    if (siteCheck.rows.length === 0) {
      throw new Error(`Site ID ${site_id} non trouvé`);
    }

    // Vérifier l'unité
    const unitCheck = await pool.query('SELECT id, name FROM units WHERE id = $1', [parseInt(unit_id)]);
    if (unitCheck.rows.length === 0) {
      throw new Error(`Unité ID ${unit_id} non trouvée`);
    }

    console.log('✅ Références validées:', {
      category: categoryCheck.rows[0].name,
      site: siteCheck.rows[0].name,
      unit: unitCheck.rows[0].name
    });

  } catch (error) {
    console.error('❌ Erreur validation références:', error);
    throw error;
  }
};

// 🔥 GET tous les articles - MODIFIÉ POUR SUPPRESSION RÉELLE
export const getArticles = async (req, res) => {
  try {
    console.log('📋 GET /articles - Début');

    const query = `
      SELECT a.*, 
             c.name as category_name,
             s.name as site_name, 
             u.symbol as unit_symbol
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN units u ON a.unit_id = u.id
      ORDER BY a.name
    `;
    
    const result = await pool.query(query);
    
    console.log(`✅ GET /articles - ${result.rows.length} articles trouvés`);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('❌ GET /articles - Erreur:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la récupération des articles',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🔥 GET un article par ID - MODIFIÉ POUR SUPPRESSION RÉELLE
export const getArticle = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 GET /articles/' + id + ' - Début');

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        error: 'ID d\'article invalide'
      });
    }

    const articleId = parseInt(id);

    const query = `
      SELECT a.*, 
             c.name as category_name,
             s.name as site_name, 
             u.symbol as unit_symbol
      FROM articles a
      LEFT JOIN categories c ON a.category_id = c.id
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN units u ON a.unit_id = u.id
      WHERE a.id = $1
    `;
    
    const result = await pool.query(query, [articleId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Article non trouvé'
      });
    }

    console.log('✅ GET /articles/' + id + ' - Article trouvé:', result.rows[0].name);

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ GET /articles/' + req.params.id + ' - Erreur:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la récupération de l\'article',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🔥 CREATE nouvel article - CORRIGÉ POUR SUPPRESSION RÉELLE
export const createArticle = async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    
    const { 
      code, name, category_id, site_id, unit_id, 
      current_stock, alert_threshold, order_quantity, cost_price 
    } = req.body;

    console.log('📦 POST /articles - Données reçues:', req.body);

    // Validation basique
    if (!code || !name || !category_id || !site_id || !unit_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Données manquantes: code, nom, catégorie, site et unité sont obligatoires'
      });
    }

    // Vérifier si le code existe déjà (TOUS les articles, pas seulement actifs)
    const checkQuery = 'SELECT id, name FROM articles WHERE code = $1';
    const checkResult = await client.query(checkQuery, [code.trim()]);
    
    if (checkResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE_CODE',
        message: `Un article avec le code "${code}" existe déjà`
      });
    }

    // Insertion simple
    const insertQuery = `
      INSERT INTO articles (
        code, name, category_id, site_id, unit_id, 
        current_stock, alert_threshold, order_quantity, cost_price
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      code.trim(),
      name.trim(),
      parseInt(category_id),
      parseInt(site_id),
      parseInt(unit_id),
      parseFloat(current_stock) || 0,
      parseFloat(alert_threshold) || 0,
      parseInt(order_quantity) || 10,
      parseFloat(cost_price) || 0
    ];

    console.log('🚀 POST /articles - Exécution avec valeurs:', values);

    const result = await client.query(insertQuery, values);
    const newArticle = result.rows[0];

    console.log('✅ POST /articles - Article créé avec ID:', newArticle.id);

    // Logger la création
    try {
      await logHistory(req, 'CREATE', 'ARTICLE', newArticle.id, `Création article: ${name}`);
    } catch (logError) {
      console.log('⚠️  Journalisation échouée:', logError);
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: newArticle,
      message: 'Article créé avec succès'
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ POST /articles - Erreur:', error);
    
    if (error.code === '23505') {
      res.status(400).json({
        success: false,
        error: 'DUPLICATE_CODE',
        message: 'Un article avec ce code existe déjà'
      });
    } else if (error.code === '23503') {
      res.status(400).json({
        success: false,
        error: 'REFERENCE_ERROR',
        message: 'Une des références (catégorie, site, unité) n\'existe pas'
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la création de l\'article',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } finally {
    if (client) client.release();
  }
};

// 🔥 UPDATE article - CORRIGÉ POUR SUPPRESSION RÉELLE
export const updateArticle = async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { id } = req.params;
    console.log('✏️ PUT /articles/' + id + ' - Début');

    if (!id || isNaN(parseInt(id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'ID d\'article invalide'
      });
    }

    const articleId = parseInt(id);
    const { 
      code, name, category_id, site_id, unit_id, 
      current_stock, alert_threshold, order_quantity, cost_price 
    } = req.body;

    console.log('✏️ PUT /articles/' + id + ' - Données:', req.body);

    // Validation basique
    if (!code || !name || !category_id || !site_id || !unit_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'Données manquantes'
      });
    }

    // Vérifier si l'article existe
    const checkArticleQuery = 'SELECT id FROM articles WHERE id = $1';
    const articleResult = await client.query(checkArticleQuery, [articleId]);
    
    if (articleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Article non trouvé'
      });
    }

    // Vérifier si le code existe pour un autre article
    const checkCodeQuery = 'SELECT id, name FROM articles WHERE code = $1 AND id != $2';
    const codeResult = await client.query(checkCodeQuery, [code.trim(), articleId]);
    
    if (codeResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE_CODE',
        message: `Un autre article avec le code "${code}" existe déjà`
      });
    }

    // Mise à jour
    const updateQuery = `
      UPDATE articles 
      SET code = $1, name = $2, category_id = $3, site_id = $4, unit_id = $5,
          current_stock = $6, alert_threshold = $7, order_quantity = $8, cost_price = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `;

    const values = [
      code.trim(),
      name.trim(),
      parseInt(category_id),
      parseInt(site_id),
      parseInt(unit_id),
      parseFloat(current_stock) || 0,
      parseFloat(alert_threshold) || 0,
      parseInt(order_quantity) || 10,
      parseFloat(cost_price) || 0,
      articleId
    ];

    console.log('🚀 PUT /articles/' + id + ' - Exécution avec valeurs:', values);

    const result = await client.query(updateQuery, values);
    
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Article non trouvé après mise à jour'
      });
    }

    console.log('✅ PUT /articles/' + id + ' - Article modifié');

    // Logger
    try {
      await logHistory(req, 'UPDATE', 'ARTICLE', articleId, `Modification article: ${name}`);
    } catch (logError) {
      console.log('⚠️  Journalisation échouée:', logError);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Article modifié avec succès'
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ PUT /articles/' + req.params.id + ' - Erreur:', error);
    
    if (error.code === '23505') {
      res.status(400).json({
        success: false,
        error: 'DUPLICATE_CODE',
        message: 'Un article avec ce code existe déjà'
      });
    } else if (error.code === '23503') {
      res.status(400).json({
        success: false,
        error: 'REFERENCE_ERROR',
        message: 'Une des références (catégorie, site, unité) n\'existe pas'
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Erreur lors de la modification de l\'article',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  } finally {
    if (client) client.release();
  }
};
// 🔥 DELETE article - VERSION AVEC TOUTES LES DÉPENDANCES
export const deleteArticle = async (req, res) => {
  let client;
  
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const { id } = req.params;
    console.log('💥 DELETE /articles/' + id + ' - SUPPRESSION COMPLÈTE');

    if (!id || isNaN(parseInt(id))) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'ID d\'article invalide'
      });
    }

    const articleId = parseInt(id);

    // Vérifier si l'article existe
    const articleQuery = 'SELECT * FROM articles WHERE id = $1';
    const articleResult = await client.query(articleQuery, [articleId]);
    
    if (articleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Article non trouvé'
      });
    }

    const article = articleResult.rows[0];

    // 💥 SUPPRESSION DE TOUTES LES DÉPENDANCES
    console.log('🗑️  Nettoyage complet des dépendances pour l\'article', articleId);
    
    // 1. Supprimer les mouvements de stock
    await client.query('DELETE FROM stock_movements WHERE article_id = $1', [articleId]);
    
    // 2. Supprimer les snapshots quotidiens (daily_stocks)
    await client.query('DELETE FROM daily_stocks WHERE article_id = $1', [articleId]);
    
    // 3. 🔥 NOUVEAU : Supprimer les daily_stock_snapshot
    await client.query('DELETE FROM daily_stock_snapshot WHERE article_id = $1', [articleId]);
    
    // 4. Supprimer l'historique
    await client.query('DELETE FROM history WHERE entity_id = $1 AND entity = $2', [articleId, 'ARTICLE']);

    // 💥 SUPPRESSION PHYSIQUE DE L'ARTICLE
    const deleteQuery = 'DELETE FROM articles WHERE id = $1';
    const deleteResult = await client.query(deleteQuery, [articleId]);

    console.log('💥 DELETE /articles/' + id + ' - Article SUPPRIMÉ avec toutes ses dépendances:', article.name);
    console.log('💥 Résultat:', deleteResult.rowCount, 'ligne(s) supprimée(s)');

    // Logger
    try {
      await logHistory(req, 'DELETE', 'ARTICLE', articleId, `SUPPRESSION COMPLÈTE: ${article.name} (${article.code})`);
    } catch (logError) {
      console.log('⚠️  Journalisation échouée:', logError);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Article et toutes ses données associées supprimés définitivement'
    });

  } catch (error) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ DELETE /articles/' + req.params.id + ' - Erreur:', error);
    
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la suppression',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (client) client.release();
  }
};

// 🔥 Vérifier l'unicité du code - CORRIGÉ POUR SUPPRESSION RÉELLE
export const checkCodeUnique = async (req, res) => {
  try {
    const { code } = req.query;
    const { id } = req.params;

    console.log('🔍 GET /articles/check/code - Code:', code, 'Exclude ID:', id);

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Paramètre "code" manquant'
      });
    }

    let query = 'SELECT id, name FROM articles WHERE code = $1';
    const values = [code.trim()];

    if (id && !isNaN(parseInt(id))) {
      query += ' AND id != $2';
      values.push(parseInt(id));
    }

    const result = await pool.query(query, values);
    
    console.log('✅ GET /articles/check/code - Résultat:', result.rows.length > 0 ? 'existe' : 'unique');

    res.json({
      success: true,
      data: {
        isUnique: result.rows.length === 0,
        existingArticle: result.rows.length > 0 ? result.rows[0] : null
      }
    });

  } catch (error) {
    console.error('❌ GET /articles/check/code - Erreur:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la vérification du code',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 🔥 Statistiques - CORRIGÉ POUR SUPPRESSION RÉELLE
export const getArticleStats = async (req, res) => {
  try {
    console.log('📊 GET /articles/stats - Début');

    const query = `
      SELECT 
        COUNT(*) as total_articles,
        COUNT(CASE WHEN current_stock <= alert_threshold THEN 1 END) as low_stock_items,
        COUNT(CASE WHEN current_stock = 0 THEN 1 END) as out_of_stock_items,
        SUM(current_stock * cost_price) as total_value
      FROM articles
    `;
    
    const result = await pool.query(query);
    const stats = result.rows[0];

    res.json({
      success: true,
      data: {
        stats: {
          total_items: parseInt(stats.total_articles) || 0,
          low_stock_items: parseInt(stats.low_stock_items) || 0,
          out_of_stock_items: parseInt(stats.out_of_stock_items) || 0,
          total_value: parseFloat(stats.total_value) || 0
        }
      }
    });

  } catch (error) {
    console.error('❌ GET /articles/stats - Erreur:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erreur lors de la récupération des statistiques'
    });
  }
};

// 🔥 Santé - CORRIGÉ POUR SUPPRESSION RÉELLE
export const healthCheck = async (req, res) => {
  try {
    await pool.query('SELECT 1');
    const countResult = await pool.query('SELECT COUNT(*) FROM articles');
    
    res.json({
      success: true,
      data: {
        database: 'connected',
        total_articles: parseInt(countResult.rows[0].count),
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Health check failed:', error);
    res.status(500).json({
      success: false,
      error: 'Service unhealthy'
    });
  }
};

// 🔥 DEBUG - Vérifier un article spécifique
export const debugArticle = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🐛 DEBUG /articles/debug/' + id + ' - Début');
    
    const query = 'SELECT * FROM articles WHERE id = $1';
    const result = await pool.query(query, [parseInt(id)]);
    
    if (result.rows.length === 0) {
      console.log('🐛 DEBUG - Article ' + id + ' : SUPPRIMÉ DÉFINITIVEMENT');
      return res.json({ 
        exists: false,
        message: 'Article complètement supprimé de la BDD'
      });
    } else {
      console.log('🐛 DEBUG - Article ' + id + ' : EXISTE TOUJOURS', result.rows[0]);
      return res.json({ 
        exists: true, 
        data: result.rows[0],
        message: 'Article toujours présent dans la BDD'
      });
    }
  } catch (error) {
    console.error('❌ DEBUG erreur:', error);
    res.status(500).json({ error: 'Erreur debug' });
  }
};

// 🔥 DEBUG - Voir tous les articles
export const debugAllArticles = async (req, res) => {
  try {
    console.log('🐛 DEBUG /articles/debug/all - Début');
    
    const query = 'SELECT id, code, name, is_active FROM articles ORDER BY id';
    const result = await pool.query(query);
    
    console.log('🐛 DEBUG - Tous les articles:');
    result.rows.forEach(article => {
      console.log(`🐛 ${article.id} | ${article.code} | ${article.name} | actif: ${article.is_active}`);
    });

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      message: `Found ${result.rows.length} articles total`
    });
  } catch (error) {
    console.error('❌ DEBUG /articles/debug/all - Erreur:', error);
    res.status(500).json({ error: 'Erreur debug' });
  }
};