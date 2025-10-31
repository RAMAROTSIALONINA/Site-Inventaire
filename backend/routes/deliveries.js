import express from 'express';
import DeliveryController from '../controllers/deliveries.js';
import deliveryMiddleware from '../middleware/deliveries.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware.authenticate);

// Routes pour les livraisons
router.get('/', DeliveryController.getAllDeliveries);
router.get('/:id', deliveryMiddleware.checkDeliveryExists, DeliveryController.getDelivery);
router.post('/', authMiddleware.authorize(['admin', 'manager']), deliveryMiddleware.validateDeliveryData, DeliveryController.createDelivery);
router.put('/:id', authMiddleware.authorize(['admin', 'manager']), deliveryMiddleware.checkDeliveryExists, deliveryMiddleware.validateDeliveryData, DeliveryController.updateDelivery);
router.delete('/:id', authMiddleware.authorize(['admin', 'manager']), deliveryMiddleware.checkDeliveryExists, DeliveryController.deleteDelivery);

// Route pour mettre à jour le statut
router.patch('/:id/status', authMiddleware.authorize(['admin', 'manager']), deliveryMiddleware.checkDeliveryExists, DeliveryController.updateDeliveryStatus);

export default router;