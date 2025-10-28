import express from 'express';
import { 
  getUsers, 
  getUser, 
  createUser, 
  updateUser, 
  deleteUser 
} from '../controllers/users.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// Seul l'admin peut gérer les utilisateurs
router.get('/', authorize(['admin']), getUsers);
router.get('/:id', authorize(['admin']), getUser);
router.post('/', authorize(['admin']), createUser);
router.put('/:id', authorize(['admin']), updateUser);
router.delete('/:id', authorize(['admin']), deleteUser);

export default router;