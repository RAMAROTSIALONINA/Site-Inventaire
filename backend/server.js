// backend/server.js - VERSION SIMPLIFIÉE
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Correction __dirname pour ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware CORS
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://192.168.1.100:8080'],
    credentials: true
}));

app.use(express.json());

// Servir les fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, '../frontend/uploads')));

// Routes existantes
import authRoutes from './routes/auth.js';
import articlesRoutes from './routes/articles.js';
import usersRoutes from './routes/users.js';
import referencesRoutes from './routes/references.js';
import historyRoutes from './routes/history.js';

// Import des modèles historiques
import { createHistoryTables, DailyStock } from './models/History.js';

// Fonction d'initialisation des tables
const initializeDatabase = async () => {
    try {
        console.log('🔄 Initialisation des tables de base de données...');
        
        // Tables historiques existantes
        await createHistoryTables();
        console.log('✅ Tables historiques initialisées');
        
        console.log('🎉 Tables principales prêtes !');
        
    } catch (error) {
        console.error('❌ Erreur initialisation base de données:', error);
        throw error;
    }
};

// Fonction pour prendre le snapshot quotidien automatique
const scheduleDailySnapshot = () => {
    // Prendre un snapshot au démarrage si pas déjà fait aujourd'hui
    DailyStock.hasTodaySnapshot().then(hasSnapshot => {
        if (!hasSnapshot) {
            console.log('📊 Prise du snapshot initial...');
            DailyStock.takeSnapshot().catch(console.error);
        } else {
            console.log('✅ Snapshot déjà pris aujourd\'hui');
        }
    }).catch(console.error);
    
    // Programmer le snapshot quotidien à 23h59
    setInterval(async () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // Exécuter à 23h59
        if (hours === 23 && minutes === 59) {
            try {
                console.log('🕒 Prise du snapshot quotidien automatique...');
                await DailyStock.takeSnapshot();
                console.log('✅ Snapshot quotidien terminé');
            } catch (error) {
                console.error('❌ Erreur snapshot automatique:', error);
            }
        }
    }, 60000);
};

// Initialiser l'application
const initializeApp = async () => {
    try {
        // Initialiser la base de données
        await initializeDatabase();
        
        // Démarrer le scheduler de snapshot
        scheduleDailySnapshot();
        
        console.log('🚀 Application initialisée avec succès');
        
    } catch (error) {
        console.error('❌ Erreur initialisation application:', error);
        process.exit(1);
    }
};

// Utiliser les routes existantes (UNIQUEMENT CELLES QUI FONCTIONNENT)
app.use('/api/auth', authRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/references', referencesRoutes);
app.use('/api/history', historyRoutes);

// Route santé
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: '✅ API Swis Inventory Opérationnelle',
        timestamp: new Date().toISOString(),
        version: '1.0',
        features: {
            daily_snapshot: true,
            stock_history: true,
            automatic_backup: true,
            new_features: 'coming_soon' // Nouvelles fonctionnalités en développement
        }
    });
});

// Route pour forcer un snapshot manuel
app.post('/api/force-snapshot', async (req, res) => {
    try {
        const snapshot = await DailyStock.takeSnapshot();
        res.json({
            success: true,
            message: `Snapshot forcé: ${snapshot.length} articles`,
            data: snapshot
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Erreur snapshot forcé'
        });
    }
});

// Middleware de gestion d'erreurs
app.use((error, req, res, next) => {
    console.error('❌ Erreur serveur:', error);
    
    res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur'
    });
});

// Route 404
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint non trouvé'
    });
});

// Démarrer le serveur
const startServer = async () => {
    await initializeApp();
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n🚀 Serveur démarré sur http://0.0.0.0:${PORT}`);
        console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
        console.log(`📅 Système de snapshot quotidien activé (23h59)`);
        console.log(`\n✅ Prêt à recevoir des requêtes !\n`);
    });
};

// Démarrer l'application
startServer().catch(error => {
    console.error('❌ Erreur démarrage serveur:', error);
    process.exit(1);
});