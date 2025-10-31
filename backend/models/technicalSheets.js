const TechnicalSheet = require('../models/TechnicalSheet');

const technicalSheetMiddleware = {
    validateTechnicalSheetData: (req, res, next) => {
        const { article_id } = req.body;

        if (!article_id) {
            return res.status(400).json({ success: false, error: 'L\'article est obligatoire' });
        }

        next();
    },

    checkTechnicalSheetExists: async (req, res, next) => {
        try {
            const technicalSheet = await TechnicalSheet.findById(req.params.id);
            if (!technicalSheet) {
                return res.status(404).json({ success: false, error: 'Fiche technique non trouvée' });
            }
            req.technicalSheet = technicalSheet;
            next();
        } catch (error) {
            console.error('Erreur vérification fiche technique:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    },

    validateFileUpload: (req, res, next) => {
        if (req.files && req.files.document) {
            const file = req.files.document;
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
            const maxSize = 10 * 1024 * 1024; // 10MB

            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Type de fichier non autorisé. Formats acceptés: PDF, JPEG, PNG, DOC, DOCX' 
                });
            }

            if (file.size > maxSize) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Fichier trop volumineux. Taille maximale: 10MB' 
                });
            }
        }

        next();
    }
};

module.exports = technicalSheetMiddleware;