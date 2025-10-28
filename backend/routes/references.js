import express from 'express';
import { 
  // Catégories
  getCategories, createCategory, updateCategory, deleteCategory,
  // Sites
  getSites, createSite, updateSite, deleteSite,
  // Unités
  getUnits, createUnit, updateUnit, deleteUnit
} from '../controllers/references.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

// Toutes les routes nécessitent une authentification admin
router.use(authenticate);
router.use(authorize(['admin']));

// Routes catégories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Routes sites
router.get('/sites', getSites);
router.post('/sites', createSite);
router.put('/sites/:id', updateSite);
router.delete('/sites/:id', deleteSite);

// Routes unités
router.get('/units', getUnits);
router.post('/units', createUnit);
router.put('/units/:id', updateUnit);
router.delete('/units/:id', deleteUnit);

export default router;