import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
    credentials: true
}));
app.use(express.json());

// Données mock pour le développement
const mockData = {
    users: [
        {
            id: 1,
            username: 'admin',
            password_hash: '$2a$10$8K1p/a0dRTlB0Z6bZ8BwE.ZK6d7kAD7kG8k8B8k8B8k8B8k8B8k8',
            full_name: 'Administrateur',
            role: 'admin'
        }
    ],
    articles: [
        {
            id: 1,
            code: 'TOM001',
            name: 'Tomates fraîches',
            category_name: 'Légumes',
            site_name: 'Bypass',
            unit_symbol: 'kg',
            current_stock: 15.0,
            alert_threshold: 5.0,
            cost_price: 1200.00
        },
        {
            id: 2,
            code: 'POU002',
            name: 'Filet de poulet',
            category_name: 'Viandes',
            site_name: 'Bypass',
            unit_symbol: 'kg',
            current_stock: 2.0,
            alert_threshold: 5.0,
            cost_price: 8500.00
        },
        {
            id: 3,
            code: 'RIZ003',
            name: 'Riz basmati',
            category_name: 'Épicerie',
            site_name: 'Isoraka',
            unit_symbol: 'kg',
            current_stock: 25.0,
            alert_threshold: 10.0,
            cost_price: 3200.00
        }
    ]
};

// Routes mockées
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log('🔐 Tentative de connexion:', username);
    
    const user = mockData.users.find(u => u.username === username);
    
    if (user && password === 'admin') { // Mot de passe simple pour le dev
        res.json({
            success: true,
            token: 'dev-jwt-token-' + Date.now(),
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        });
    } else {
        res.status(401).json({
            success: false,
            error: 'Identifiants incorrects'
        });
    }
});

app.get('/api/articles', (req, res) => {
    console.log('📦 Récupération des articles');
    res.json({
        success: true,
        data: mockData.articles
    });
});

app.get('/api/articles/stats', (req, res) => {
    const stats = {
        total_items: mockData.articles.length,
        low_stock_items: mockData.articles.filter(a => a.current_stock <= a.alert_threshold).length,
        out_of_stock_items: mockData.articles.filter(a => a.current_stock === 0).length,
        total_value: mockData.articles.reduce((sum, a) => sum + (a.current_stock * a.cost_price), 0)
    };
    
    res.json({
        success: true,
        data: {
            stats,
            categories: [
                { name: 'Légumes', count: 1 },
                { name: 'Viandes', count: 1 },
                { name: 'Épicerie', count: 1 }
            ],
            alerts: mockData.articles.filter(a => a.current_stock <= a.alert_threshold)
        }
    });
});

// Route santé
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: '✅ API Dev Mode - Opérationnelle',
        mode: 'development',
        timestamp: new Date().toISOString()
    });
});

// Gestion des erreurs
app.use((error, req, res, next) => {
    console.error('💥 Erreur:', error);
    res.status(500).json({
        success: false,
        error: 'Erreur serveur en mode développement'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur de développement démarré sur le port ${PORT}`);
    console.log(`📊 Mode: DÉVELOPPEMENT (données mockées)`);
    console.log(`❤️  Santé: http://localhost:${PORT}/api/health`);
    console.log(`🔐 Login: admin / admin`);
    console.log(`📦 Articles: ${mockData.articles.length} articles mockés`);
});