// backend/server.js - CODE COMPLET
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware CORS corrigé
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080', 'http://192.168.1.100:8080'],
    credentials: true
}));

app.use(express.json());

// Routes
import authRoutes from './routes/auth.js';
import articlesRoutes from './routes/articles.js';
import usersRoutes from './routes/users.js';
import referencesRoutes from './routes/references.js';
import historyRoutes from './routes/history.js';

// Import des modèles historiques
import { createHistoryTables, DailyStock } from './models/History.js';

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
  }, 60000); // Vérifier toutes les minutes
};

// Initialiser les tables et le scheduler
createHistoryTables().then(() => {
  console.log('✅ Tables historiques initialisées');
  scheduleDailySnapshot();
}).catch(console.error);

// Utiliser les routes
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
        features: {
            daily_snapshot: true,
            stock_history: true,
            automatic_backup: true
        }
    });
});

// Route pour forcer un snapshot manuel (pour test)
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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Serveur démarré sur http://0.0.0.0:${PORT}`);
    console.log(`📊 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📅 Système de snapshot quotidien activé (23h59)`);
});