// backend/routes/historyExport.js
import express from 'express';
import PDFDocument from 'pdfkit';
import db from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// 🔥 ROUTE D'EXPORT PDF INVENTAIRE
router.get('/inventory/export/pdf', authenticate, async (req, res) => {
    try {
        console.log('📊 Début génération PDF...');
        const { date, site_id, category_id, low_stock_only, search } = req.query;

        let query = `
            SELECT 
                a.code, a.name, a.current_stock, a.alert_threshold,
                a.cost_price, (a.current_stock * a.cost_price) as stock_value,
                c.name as category_name,
                s.name as site_name,
                u.symbol as unit_symbol,
                CASE 
                    WHEN a.current_stock <= 0 THEN 'RUPTURE'
                    WHEN a.current_stock <= a.alert_threshold THEN 'ALERTE' 
                    ELSE 'OK'
                END as status
            FROM articles a
            LEFT JOIN categories c ON a.category_id = c.id
            LEFT JOIN sites s ON a.site_id = s.id
            LEFT JOIN units u ON a.unit_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (date) {
            paramCount++;
            query += ` AND DATE(a.updated_at) <= $${paramCount}`;
            params.push(date);
        }
        if (site_id) {
            paramCount++;
            query += ` AND a.site_id = $${paramCount}`;
            params.push(site_id);
        }
        if (category_id) {
            paramCount++;
            query += ` AND a.category_id = $${paramCount}`;
            params.push(category_id);
        }
        if (low_stock_only === 'true') {
            query += ` AND a.current_stock <= a.alert_threshold`;
        }
        if (search) {
            paramCount++;
            query += ` AND (a.code ILIKE $${paramCount}`;
            params.push(`%${search}%`);
            paramCount++;
            query += ` OR a.name ILIKE $${paramCount})`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY a.code`;

        console.log('📋 Requête:', query, 'Params:', params);

        const result = await db.query(query, params);
        const inventory = result.rows;

        if (!inventory || inventory.length === 0) {
            return res.status(404).json({ success: false, error: 'Aucun article trouvé' });
        }

        // ✅ Initialisation du PDF
        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="inventaire_${new Date().toISOString().split('T')[0]}.pdf"`);

        // ✅ Gestion des erreurs PDF
        doc.on('error', (err) => {
            console.error('Erreur PDFKit:', err);
            return res.status(500).json({ success: false, error: 'Erreur génération PDF' });
        });

        doc.pipe(res);

        // 🔷 EN-TÊTE
        doc.fontSize(20).text('INVENTAIRE DES ARTICLES', { align: 'center' });
        doc.moveDown();
        doc.fontSize(10).text(`📅 Date du rapport: ${new Date().toLocaleDateString('fr-FR')}`);
        doc.text(`📦 Total articles: ${inventory.length}`);
        doc.moveDown();

        // 🔷 TABLEAU
        const yStart = doc.y;
        let y = yStart + 20;

        doc.fontSize(12).text('Code | Nom | Stock | Statut', 50, yStart);
        doc.moveTo(50, yStart + 15).lineTo(550, yStart + 15).stroke();

        y += 15;

        inventory.forEach((item) => {
            const line = `${truncateText(item.code, 10)} | ${truncateText(item.name, 30)} | ${item.current_stock} ${item.unit_symbol} | ${item.status}`;
            doc.fontSize(9).text(line, 50, y);
            y += 12;

            if (y > 750) { // Changement de page automatique
                doc.addPage();
                y = 50;
            }
        });

        doc.end();
        console.log('✅ PDF généré avec succès');
    } catch (err) {
        console.error('❌ Erreur génération PDF:', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: err.message });
        }
    }
});

// 🔧 Fonction utilitaire pour tronquer du texte
function truncateText(text, maxLength) {
    if (!text) return 'N/A';
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

export default router;
