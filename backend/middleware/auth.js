import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Accès non autorisé' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
    
    // Vérifier que l'utilisateur existe toujours
    const userResult = await pool.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    req.user = userResult.rows[0];
    next();
    
  } catch (error) {
    console.error('Erreur authentification:', error);
    res.status(401).json({ error: 'Token invalide' });
  }
};

// NOUVELLE FONCTION authorize - AJOUTEZ-CECI
export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Accès non autorisé' });
    }

    // Si roles est un string, le convertir en tableau
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Accès refusé. Permissions insuffisantes.' 
      });
    }

    next();
  };
};

// Export par défaut pour la compatibilité
export default { authenticate, authorize };