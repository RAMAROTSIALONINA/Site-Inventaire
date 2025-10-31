const Supplier = require('../models/Supplier');

const supplierMiddleware = {
    validateSupplierData: (req, res, next) => {
        const { code, name } = req.body;

        if (!code || code.trim() === '') {
            return res.status(400).json({ success: false, error: 'Le code est obligatoire' });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({ success: false, error: 'Le nom est obligatoire' });
        }

        if (code.length > 50) {
            return res.status(400).json({ success: false, error: 'Le code ne doit pas dépasser 50 caractères' });
        }

        if (name.length > 255) {
            return res.status(400).json({ success: false, error: 'Le nom ne doit pas dépasser 255 caractères' });
        }

        next();
    },

    checkSupplierExists: async (req, res, next) => {
        try {
            const supplier = await Supplier.findById(req.params.id);
            if (!supplier) {
                return res.status(404).json({ success: false, error: 'Fournisseur non trouvé' });
            }
            req.supplier = supplier;
            next();
        } catch (error) {
            console.error('Erreur vérification fournisseur:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }
};

module.exports = supplierMiddleware;