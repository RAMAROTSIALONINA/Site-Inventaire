// backend/routes/articles.js - VERSION CORRIGÉE AVEC SUPPRESSION RÉELLE
import express from 'express';
import { 
  getArticleStats,
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  checkCodeUnique,
  healthCheck,
  debugArticle,
  debugAllArticles
} from '../controllers/articles.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ======================
// 🐛 ROUTES DEBUG (sans auth pour test)
// ======================
router.get('/debug/:id', debugArticle);
router.get('/debug/all', debugAllArticles);

// ======================
// ✅ ROUTES NORMALES
// ======================
router.get('/health', healthCheck);
router.get('/stats', authenticate, getArticleStats);
router.get('/', authenticate, getArticles);
router.get('/:id', authenticate, getArticle);
router.post('/', authenticate, createArticle);
router.put('/:id', authenticate, updateArticle);
router.delete('/:id', authenticate, deleteArticle);
router.get('/check/code', authenticate, checkCodeUnique);

export default router;