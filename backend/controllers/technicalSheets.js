const TechnicalSheet = require('../models/TechnicalSheet');

class TechnicalSheetController {
    static async getAllTechnicalSheets(req, res) {
        try {
            const technicalSheets = await TechnicalSheet.findAll();
            res.json({ success: true, data: technicalSheets });
        } catch (error) {
            console.error('Erreur récupération fiches techniques:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async getTechnicalSheet(req, res) {
        try {
            const technicalSheet = await TechnicalSheet.findById(req.params.id);
            if (!technicalSheet) {
                return res.status(404).json({ success: false, error: 'Fiche technique non trouvée' });
            }
            res.json({ success: true, data: technicalSheet });
        } catch (error) {
            console.error('Erreur récupération fiche technique:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async createTechnicalSheet(req, res) {
        try {
            const { article_id, reference, specifications } = req.body;
            let document_path = null;

            // Validation
            if (!article_id) {
                return res.status(400).json({ success: false, error: 'L\'article est obligatoire' });
            }

            // Vérifier si une fiche existe déjà pour cet article
            const existingSheet = await TechnicalSheet.findByArticleId(article_id);
            if (existingSheet) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Une fiche technique existe déjà pour cet article' 
                });
            }

            // Gérer le fichier uploadé
            if (req.files && req.files.document) {
                document_path = await TechnicalSheet.saveDocument(req.files.document, null);
            }

            const technicalSheetData = {
                article_id,
                reference,
                specifications,
                document_path,
                created_by: req.user.id
            };

            const sheetId = await TechnicalSheet.create(technicalSheetData);

            // Mettre à jour le chemin du document avec l'ID
            if (document_path) {
                const newDocumentPath = await TechnicalSheet.saveDocument(req.files.document, sheetId);
                await TechnicalSheet.update(sheetId, { document_path: newDocumentPath });
            }

            res.status(201).json({ 
                success: true, 
                message: 'Fiche technique créée avec succès',
                data: { id: sheetId }
            });

        } catch (error) {
            console.error('Erreur création fiche technique:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async updateTechnicalSheet(req, res) {
        try {
            const { article_id, reference, specifications } = req.body;
            const sheetId = req.params.id;
            let document_path = null;

            // Gérer le fichier uploadé
            if (req.files && req.files.document) {
                document_path = await TechnicalSheet.saveDocument(req.files.document, sheetId);
            }

            const updateData = { reference, specifications };
            if (document_path) {
                updateData.document_path = document_path;
            }

            const updated = await TechnicalSheet.update(sheetId, updateData);

            if (!updated) {
                return res.status(404).json({ success: false, error: 'Fiche technique non trouvée' });
            }

            res.json({ success: true, message: 'Fiche technique modifiée avec succès' });

        } catch (error) {
            console.error('Erreur modification fiche technique:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async deleteTechnicalSheet(req, res) {
        try {
            const deleted = await TechnicalSheet.delete(req.params.id);
            
            if (!deleted) {
                return res.status(404).json({ success: false, error: 'Fiche technique non trouvée' });
            }

            res.json({ success: true, message: 'Fiche technique supprimée avec succès' });

        } catch (error) {
            console.error('Erreur suppression fiche technique:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }

    static async downloadDocument(req, res) {
        try {
            const technicalSheet = await TechnicalSheet.findById(req.params.id);
            
            if (!technicalSheet || !technicalSheet.document_path) {
                return res.status(404).json({ success: false, error: 'Document non trouvé' });
            }

            const filePath = path.join(__dirname, '..', '..', technicalSheet.document_path);
            res.download(filePath);

        } catch (error) {
            console.error('Erreur téléchargement document:', error);
            res.status(500).json({ success: false, error: 'Erreur serveur' });
        }
    }
}

module.exports = TechnicalSheetController;