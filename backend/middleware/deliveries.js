const Delivery = require('../models/Delivery');

const deliveryMiddleware = {
    validateDeliveryData: (req, res, next) => {
        const { supplier_id, delivery_date, items } = req.body;

        if (!supplier_id) {
            return res.status(400).json({ success: false, error: 'Le fournisseur est obligatoire' });
        }

        if (!delivery_date) {
            return res.status(400).json({ success: false, error: 'La date de livraison est obligatoire' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Au moins un article est requis' });
        }

        // Valider chaque article
        for (const item of items) {
            if (!item.article_id || !item.quantity || item.quantity <= 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Chaque article doit avoir un ID et une quantité positive' 
                });
            }
        }

        next();
    },

    checkDeliveryExists: async (req, res, next) => {
        try {
            const delivery = await Delivery.findById(req.params.id);
            if (!delivery) {
                return res.status(404).json({ success: false, error: 'Livraison non trouvée' });
            }
            req.delivery = delivery;
            next();
        } catch (error) {
            console.error('Erreur vérification livraison:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }
};

module.exports = deliveryMiddleware;