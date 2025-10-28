// backend/middleware/logger.js - CRÉER CE FICHIER
import pool from '../config/database.js';

export const logHistory = async (req, action, entity, entityId, description, changes = {}) => {
  try {
    if (!req.user) {
      console.log('⚠️  Aucun utilisateur connecté pour l\'historique');
      return;
    }

    const query = `
      INSERT INTO history (action, entity, entity_id, description, user_id, changes, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      action, 
      entity, 
      entityId, 
      description, 
      req.user.id, 
      changes ? JSON.stringify(changes) : null, 
      req.ip || req.connection.remoteAddress,
      req.get('User-Agent') || 'Unknown'
    ];

    const result = await pool.query(query, values);
    console.log(`📝 Historique enregistré: ${action} ${entity} ${entityId}`);
    return result.rows[0];

  } catch (error) {
    console.error('❌ Erreur journalisation historique:', error);
    throw error;
  }
};

export default { logHistory };