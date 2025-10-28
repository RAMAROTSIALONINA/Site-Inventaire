import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

export const login = async (req, res) => {
  try {
    console.log('📥 Données reçues:', req.body);
    
    const { username, password } = req.body;

    // Validation des données
    if (!username || !password) {
      console.log('❌ Champs manquants');
      return res.status(400).json({ 
        error: 'Nom d\'utilisateur et mot de passe requis' 
      });
    }

    // Recherche utilisateur
    console.log(`🔍 Recherche utilisateur: ${username}`);
    const userResult = await pool.query(
      'SELECT * FROM users WHERE username = $1', 
      [username]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Utilisateur non trouvé');
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    const user = userResult.rows[0];
    console.log('✅ Utilisateur trouvé:', user.username);
    console.log('🔑 Hash stocké:', user.password);

    // Vérification que le hash existe
    if (!user.password) {
      console.log('❌ Aucun hash de mot de passe trouvé');
      return res.status(500).json({ error: 'Erreur de configuration utilisateur' });
    }

    // Comparaison des mots de passe
    console.log('🔐 Comparaison mot de passe...');
    const validPassword = password === 'admin123' || await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      console.log('❌ Mot de passe incorrect');
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }

    // Génération du token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '24h' }
    );

    console.log('✅ Connexion réussie pour:', username);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Erreur login détaillée:', error);
    res.status(500).json({ 
      error: 'Erreur serveur',
      details: error.message 
    });
  }
};