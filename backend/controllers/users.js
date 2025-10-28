import pool from '../config/database.js';
import bcrypt from 'bcryptjs';

// GET tous les utilisateurs
export const getUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Erreur getUsers:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// GET un utilisateur
export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, created_at 
       FROM users 
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Erreur getUser:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// POST créer un utilisateur
export const createUser = async (req, res) => {
  try {
    const { username, password, email, full_name, role } = req.body;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Nom d\'utilisateur déjà utilisé' });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (username, password, email, full_name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, username, email, full_name, role, created_at`,
      [username, hashedPassword, email, full_name, role || 'user']
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Utilisateur créé avec succès'
    });

  } catch (error) {
    console.error('Erreur createUser:', error);
    res.status(500).json({ error: 'Erreur création utilisateur' });
  }
};

// PUT modifier un utilisateur
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, full_name, role, password } = req.body;

    let query = `UPDATE users SET 
                  username = $1, 
                  email = $2, 
                  full_name = $3, 
                  role = $4`;
    
    let params = [username, email, full_name, role];
    let paramCount = 4;

    // Si mot de passe fourni, le hasher et l'ajouter
    if (password) {
      paramCount++;
      query += `, password = $${paramCount}`;
      const hashedPassword = await bcrypt.hash(password, 10);
      params.push(hashedPassword);
    }

    paramCount++;
    query += ` WHERE id = $${paramCount} RETURNING id, username, email, full_name, role, created_at`;
    params.push(id);

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Utilisateur modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur updateUser:', error);
    res.status(500).json({ error: 'Erreur modification utilisateur' });
  }
};

// DELETE supprimer un utilisateur
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Ne pas permettre de se supprimer soi-même
    if (parseInt(id) === req.user.userId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }

    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    res.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur deleteUser:', error);
    res.status(500).json({ error: 'Erreur suppression utilisateur' });
  }
};