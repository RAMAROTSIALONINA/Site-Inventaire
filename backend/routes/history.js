// backend/routes/history.js - VERSION COMPLÈTE
import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { 
  getUserHistory, 
  getEntityHistory, 
  getHistoryStats,
  getRecentActivity,
  getDailyStockHistory,
  getDailyStockStats,
  takeDailySnapshot,
  getInventorySnapshot,
  getInventoryComparison,
  getArticleHistory,
  getAvailableSnapshotDates,
  getDailyHistory,
  getPeriodStats,
  getStockEvolution,
  getTopModifiedArticles,
  exportInventoryCSV,
  exportInventoryPDF,
  deleteHistoryEntry,
  clearAllHistory,
  exportHistoryCSV,
  exportHistoryPDF
} from '../controllers/history.js';

const router = express.Router();

// Routes principales
router.get('/my-history', authenticate, getUserHistory);
router.get('/entity/:entity/:entityId', authenticate, getEntityHistory);
router.get('/stats', authenticate, getHistoryStats);
router.get('/recent-activity', authenticate, getRecentActivity);

// Routes stock quotidien
router.get('/daily-stock', authenticate, getDailyStockHistory);
router.get('/daily-stock/stats', authenticate, getDailyStockStats);
router.post('/daily-snapshot', authenticate, takeDailySnapshot);

// Routes inventaire
router.get('/inventory/snapshot', authenticate, getInventorySnapshot);
router.get('/inventory/comparison', authenticate, getInventoryComparison);
router.get('/articles/:id/history', authenticate, getArticleHistory);
router.get('/inventory/available-dates', authenticate, getAvailableSnapshotDates);

// Routes analytiques
router.get('/daily', authenticate, getDailyHistory);
router.get('/period-stats', authenticate, getPeriodStats);
router.get('/stock-evolution', authenticate, getStockEvolution);
router.get('/top-modified', authenticate, getTopModifiedArticles);

// Routes d'export inventaire
router.get('/inventory/export/csv', authenticate, exportInventoryCSV);
router.get('/inventory/export/pdf', authenticate, exportInventoryPDF);

// Routes d'export historique
router.get('/export/csv', authenticate, exportHistoryCSV);
router.get('/export/pdf', authenticate, exportHistoryPDF);

// Routes de suppression
router.delete('/entry/:id', authenticate, deleteHistoryEntry);
router.delete('/clear', authenticate, clearAllHistory);

export default router;