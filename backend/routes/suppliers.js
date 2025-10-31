import express from 'express';
import SupplierController from '../controllers/suppliers.js';
import supplierMiddleware from '../middleware/suppliers.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware.authenticate);

// Routes pour les fournisseurs
router.get('/', SupplierController.getAllSuppliers);
router.get('/:id', supplierMiddleware.checkSupplierExists, SupplierController.getSupplier);
router.post('/', authMiddleware.authorize(['admin', 'manager', 'reference']), supplierMiddleware.validateSupplierData, SupplierController.createSupplier);
router.put('/:id', authMiddleware.authorize(['admin', 'manager', 'reference']), supplierMiddleware.checkSupplierExists, supplierMiddleware.validateSupplierData, SupplierController.updateSupplier);
router.delete('/:id', authMiddleware.authorize(['admin', 'manager', 'reference']), supplierMiddleware.checkSupplierExists, SupplierController.deleteSupplier);

// Route pour vérifier l'unicité du code
router.get('/:id/check-code', SupplierController.checkCode);
router.get('/check-code/unique', SupplierController.checkCode);

export default router;