import express from 'express';
import TechnicalSheetController from '../controllers/technicalSheets.js';
import technicalSheetMiddleware from '../middleware/technicalSheets.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware.authenticate);

// Routes pour les fiches techniques
router.get('/', TechnicalSheetController.getAllTechnicalSheets);
router.get('/:id', technicalSheetMiddleware.checkTechnicalSheetExists, TechnicalSheetController.getTechnicalSheet);
router.post('/', authMiddleware.authorize(['admin', 'manager', 'reference']), technicalSheetMiddleware.validateTechnicalSheetData, technicalSheetMiddleware.validateFileUpload, TechnicalSheetController.createTechnicalSheet);
router.put('/:id', authMiddleware.authorize(['admin', 'manager', 'reference']), technicalSheetMiddleware.checkTechnicalSheetExists, technicalSheetMiddleware.validateTechnicalSheetData, technicalSheetMiddleware.validateFileUpload, TechnicalSheetController.updateTechnicalSheet);
router.delete('/:id', authMiddleware.authorize(['admin', 'manager', 'reference']), technicalSheetMiddleware.checkTechnicalSheetExists, TechnicalSheetController.deleteTechnicalSheet);

// Route pour télécharger le document
router.get('/:id/download', technicalSheetMiddleware.checkTechnicalSheetExists, TechnicalSheetController.downloadDocument);

export default router;