// backend/middleware/auth.js - CORRECTION POUR LES EXPORTS
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false,
        error: 'Token manquant' 
      });
    }

    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;

    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token invalide' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'votre_clé_secrète');
    
    // Vérifier que l'utilisateur existe toujours
    const userResult = await pool.query(
      'SELECT id, username, email, full_name, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: 'Utilisateur non trouvé ou inactif' 
      });
    }

    req.user = userResult.rows[0];
    next();
    
  } catch (error) {
    console.error('❌ Erreur authentification:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false,
        error: 'Token invalide' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false,
        error: 'Token expiré' 
      });
    }

    return res.status(500).json({ 
      success: false,
      error: 'Erreur d\'authentification' 
    });
  }
};

// 🆕 MIDDLEWARE SPÉCIAL POUR LES EXPORTS
export const authenticateExport = async (req, res, next) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ 
        success: false,
        error: 'Token manquant pour l\'export' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'votre_clé_secrète');
    
    const userResult = await pool.query(
      'SELECT id, username, email, full_name, role FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        error: 'Utilisateur non autorisé pour l\'export' 
      });
    }

    req.user = userResult.rows[0];
    next();
    
  } catch (error) {
    console.error('❌ Erreur authentification export:', error);
    return res.status(401).json({ 
      success: false,
      error: 'Token invalide pour l\'export' 
    });
  }
};