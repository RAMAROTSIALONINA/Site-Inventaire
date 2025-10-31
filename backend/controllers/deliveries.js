const Delivery = require('../models/Delivery');

class DeliveryController {
    static async getAllDeliveries(req, res) {
        try {
            const deliveries = await Delivery.findAll();
            res.json({ success: true, data: deliveries });
        } catch (error) {
            console.error('Erreur récupération livraisons:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async getDelivery(req, res) {
        try {
            const delivery = await Delivery.findById(req.params.id);
            if (!delivery) {
                return res.status(404).json({ success: false, error: 'Livraison non trouvée' });
            }

            const items = await Delivery.findItemsByDeliveryId(req.params.id);
            delivery.items = items;

            res.json({ success: true, data: delivery });
        } catch (error) {
            console.error('Erreur récupération livraison:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async createDelivery(req, res) {
        try {
            const { supplier_id, delivery_date, reference, items } = req.body;

            // Validation
            if (!supplier_id || !delivery_date || !items || items.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Fournisseur, date et au moins un article sont obligatoires' 
                });
            }

            const deliveryData = {
                supplier_id,
                delivery_date,
                reference,
                created_by: req.user.id
            };

            const deliveryId = await Delivery.create(deliveryData);

            res.status(201).json({ 
                success: true, 
                message: 'Livraison créée avec succès',
                data: { id: deliveryId }
            });

        } catch (error) {
            console.error('Erreur création livraison:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async updateDelivery(req, res) {
        try {
            // Pour simplifier, on supprime et recrée la livraison
            // Dans une version avancée, on ferait un update avec gestion des différences de stock
            await Delivery.delete(req.params.id);

            const { supplier_id, delivery_date, reference, items } = req.body;
            const deliveryData = {
                supplier_id,
                delivery_date,
                reference,
                created_by: req.user.id
            };

            const deliveryId = await Delivery.create(deliveryData);

            res.json({ 
                success: true, 
                message: 'Livraison modifiée avec succès',
                data: { id: deliveryId }
            });

        } catch (error) {
            console.error('Erreur modification livraison:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async deleteDelivery(req, res) {
        try {
            const deleted = await Delivery.delete(req.params.id);
            
            if (!deleted) {
                return res.status(404).json({ success: false, error: 'Livraison non trouvée' });
            }

            res.json({ success: true, message: 'Livraison supprimée avec succès' });

        } catch (error) {
            console.error('Erreur suppression livraison:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async updateDeliveryStatus(req, res) {
        try {
            const { status } = req.body;
            const validStatuses = ['pending', 'delivered', 'cancelled'];
            
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ success: false, error: 'Statut invalide' });
            }

            const sql = `UPDATE deliveries SET status = ? WHERE id = ?`;
            const [result] = await db.query(sql, [status, req.params.id]);

            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, error: 'Livraison non trouvée' });
            }

            res.json({ success: true, message: 'Statut mis à jour avec succès' });

        } catch (error) {
            console.error('Erreur mise à jour statut:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }
}

module.exports = DeliveryController;