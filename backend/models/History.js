// backend/models/History.js - AJOUTER LES MÉTHODES MANQUANTES
import pool from '../config/database.js';

export const createHistoryTables = async () => {
  try {
    console.log('🔄 Création des tables d\'historique...');

    // Table history
    const historyTableQuery = `
      CREATE TABLE IF NOT EXISTS history (
        id SERIAL PRIMARY KEY,
        action VARCHAR(50) NOT NULL,
        entity VARCHAR(50) NOT NULL,
        entity_id INTEGER,
        description TEXT,
        changes JSONB,
        user_id INTEGER NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Table daily_stocks
    const dailyStocksTableQuery = `
      CREATE TABLE IF NOT EXISTS daily_stocks (
        id SERIAL PRIMARY KEY,
        article_id INTEGER NOT NULL,
        stock_quantity DECIMAL(10,3) NOT NULL,
        date_recorded DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
        UNIQUE(article_id, date_recorded)
      )
    `;

    // Index pour les performances
    const indexesQueries = [
      'CREATE INDEX IF NOT EXISTS idx_history_user_id ON history(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_history_entity ON history(entity, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at DESC)',
      'CREATE INDEX IF NOT EXISTS idx_daily_stocks_date ON daily_stocks(date_recorded DESC)',
      'CREATE INDEX IF NOT EXISTS idx_daily_stocks_article ON daily_stocks(article_id)'
    ];

    await pool.query(historyTableQuery);
    console.log('✅ Table history créée');

    await pool.query(dailyStocksTableQuery);
    console.log('✅ Table daily_stocks créée');

    // Créer les index
    for (const indexQuery of indexesQueries) {
      await pool.query(indexQuery);
    }
    console.log('✅ Index créés');

    console.log('🎉 Tables d\'historique créées avec succès');

  } catch (error) {
    console.error('❌ Erreur création tables historique:', error);
    throw error;
  }
};

export class DailyStock {
  // 🔥 AJOUTER CETTE MÉTHODE MANQUANTE
  static async hasTodaySnapshot() {
    try {
      const query = `
        SELECT COUNT(*) as count 
        FROM daily_stocks 
        WHERE date_recorded = CURRENT_DATE
      `;
      
      const result = await pool.query(query);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Erreur hasTodaySnapshot:', error);
      return false;
    }
  }

  // 🔥 AJOUTER CETTE MÉTHODE MANQUANTE
  static async takeDailySnapshot() {
    try {
      // Vérifier si un snapshot existe déjà aujourd'hui
      const hasSnapshot = await this.hasTodaySnapshot();
      if (hasSnapshot) {
        console.log('📅 Snapshot quotidien déjà pris aujourd\'hui');
        return { alreadyExists: true };
      }

      console.log('📸 Prise du snapshot quotidien...');
      
      const query = `
        INSERT INTO daily_stocks (article_id, stock_quantity, date_recorded)
        SELECT id, current_stock, CURRENT_DATE 
        FROM articles
        WHERE current_stock > 0
        RETURNING *
      `;
      
      const result = await pool.query(query);
      console.log(`✅ Snapshot quotidien pris: ${result.rows.length} articles enregistrés`);
      
      return {
        alreadyExists: false,
        snapshot: result.rows,
        count: result.rows.length
      };
    } catch (error) {
      console.error('❌ Erreur takeDailySnapshot:', error);
      throw error;
    }
  }

  static async takeSnapshot() {
    try {
      const query = `
        INSERT INTO daily_stocks (article_id, stock_quantity, date_recorded)
        SELECT id, current_stock, CURRENT_DATE 
        FROM articles
        WHERE current_stock > 0
        RETURNING *
      `;
      
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Erreur takeSnapshot:', error);
      throw error;
    }
  }

  static async getStockHistory({ page = 1, limit = 50, start_date, end_date, article_id, site_id }) {
    try {
      let query = `
        SELECT ds.*, a.name as article_name, a.code as article_code, s.name as site_name
        FROM daily_stocks ds
        LEFT JOIN articles a ON ds.article_id = a.id
        LEFT JOIN sites s ON a.site_id = s.id
        WHERE 1=1
      `;
      
      const values = [];
      let paramCount = 0;

      if (start_date) {
        paramCount++;
        query += ` AND ds.date_recorded >= $${paramCount}`;
        values.push(start_date);
      }

      if (end_date) {
        paramCount++;
        query += ` AND ds.date_recorded <= $${paramCount}`;
        values.push(end_date);
      }

      if (article_id) {
        paramCount++;
        query += ` AND ds.article_id = $${paramCount}`;
        values.push(article_id);
      }

      if (site_id) {
        paramCount++;
        query += ` AND a.site_id = $${paramCount}`;
        values.push(site_id);
      }

      query += ` ORDER BY ds.date_recorded DESC, ds.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      values.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

      const result = await pool.query(query, values);
      
      // Count query
      let countQuery = `
        SELECT COUNT(*) 
        FROM daily_stocks ds
        LEFT JOIN articles a ON ds.article_id = a.id
        WHERE 1=1
      `;
      const countParams = [];

      if (start_date) {
        countParams.push(start_date);
        countQuery += ` AND ds.date_recorded >= $${countParams.length}`;
      }

      if (end_date) {
        countParams.push(end_date);
        countQuery += ` AND ds.date_recorded <= $${countParams.length}`;
      }

      if (article_id) {
        countParams.push(article_id);
        countQuery += ` AND ds.article_id = $${countParams.length}`;
      }

      if (site_id) {
        countParams.push(site_id);
        countQuery += ` AND a.site_id = $${countParams.length}`;
      }

      const countResult = await pool.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0].count);

      return {
        history: result.rows,
        total
      };

    } catch (error) {
      console.error('Erreur getStockHistory:', error);
      throw error;
    }
  }

  static async getDailyStats({ start_date, end_date }) {
    try {
      const query = `
        SELECT 
          date_recorded,
          COUNT(*) as total_articles,
          SUM(stock_quantity) as total_stock,
          AVG(stock_quantity) as average_stock
        FROM daily_stocks
        WHERE date_recorded BETWEEN $1 AND $2
        GROUP BY date_recorded
        ORDER BY date_recorded DESC
      `;

      const result = await pool.query(query, [start_date, end_date]);
      return result.rows;

    } catch (error) {
      console.error('Erreur getDailyStats:', error);
      throw error;
    }
  }

  // 🔥 AJOUTER CETTE MÉTHODE POUR LES STATISTIQUES
  static async getSnapshotStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_snapshots,
          COUNT(DISTINCT date_recorded) as total_days,
          MIN(date_recorded) as first_snapshot,
          MAX(date_recorded) as last_snapshot
        FROM daily_stocks
      `;

      const result = await pool.query(query);
      return result.rows[0];

    } catch (error) {
      console.error('Erreur getSnapshotStats:', error);
      throw error;
    }
  }
}

export default { createHistoryTables, DailyStock };