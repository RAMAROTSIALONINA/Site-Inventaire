const Supplier = require('../models/Supplier');

class SupplierController {
    static async getAllSuppliers(req, res) {
        try {
            const suppliers = await Supplier.findAll();
            res.json({ success: true, data: suppliers });
        } catch (error) {
            console.error('Erreur récupération fournisseurs:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async getSupplier(req, res) {
        try {
            const supplier = await Supplier.findById(req.params.id);
            if (!supplier) {
                return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
            }
            res.json({ success: true, data: supplier });
        } catch (error) {
            console.error('Erreur récupération fournisseur:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async createSupplier(req, res) {
        try {
            const { code, name, contact, phone, email, address } = req.body;

            // Validation
            if (!code || !name) {
                return res.status(400).json({ success: false, error: 'Code et nom sont obligatoires' });
            }

            // Vérifier l'unicité du code
            const existingSupplier = await Supplier.findByCode(code);
            if (existingSupplier) {
                return res.status(400).json({ success: false, error: 'Ce code fournisseur existe déjà' });
            }

            const supplierData = { code, name, contact, phone, email, address };
            const supplierId = await Supplier.create(supplierData);

            res.status(201).json({ 
                success: true, 
                message: 'Fournisseur créé avec succès',
                data: { id: supplierId }
            });

        } catch (error) {
            console.error('Erreur création fournisseur:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async updateSupplier(req, res) {
        try {
            const { code, name, contact, phone, email, address } = req.body;
            const supplierId = req.params.id;

            // Vérifier l'unicité du code (exclure l'ID actuel)
            const existingSupplier = await Supplier.checkCodeUnique(code, supplierId);
            if (existingSupplier) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Ce code fournisseur est déjà utilisé par: ${existingSupplier.name}` 
                });
            }

            const supplierData = { code, name, contact, phone, email, address };
            const updated = await Supplier.update(supplierId, supplierData);

            if (!updated) {
                return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
            }

            res.json({ success: true, message: 'Fournisseur modifié avec succès' });

        } catch (error) {
            console.error('Erreur modification fournisseur:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async deleteSupplier(req, res) {
        try {
            const deleted = await Supplier.delete(req.params.id);
            
            if (!deleted) {
                return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
            }

            res.json({ success: true, message: 'Fournisseur supprimé avec succès' });

        } catch (error) {
            console.error('Erreur suppression fournisseur:', error);
            
            if (error.code === 'ER_ROW_IS_REFERENCED_2') {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Impossible de supprimer ce fournisseur : il est utilisé dans des livraisons' 
                });
            }

            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async checkCode(req, res) {
        try {
            const { code } = req.query;
            const { id } = req.params;

            if (!code) {
                return res.json({ data: { isUnique: true, existingSupplier: null } });
            }

            const existingSupplier = await Supplier.checkCodeUnique(code, id || null);
            
            res.json({ 
                data: { 
                    isUnique: !existingSupplier,
                    existingSupplier: existingSupplier 
                } 
            });

        } catch (error) {
            console.error('Erreur vérification code:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }
}

module.exports = SupplierController;