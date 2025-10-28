// Base de données dynamique pour l'inventaire Swis Madagascar
class InventoryDatabase {
    constructor() {
        this.db = null;
        this.useLocalStorage = true; // Par défaut localStorage
        this.init();
    }

    async init() {
        try {
            // Essayer d'utiliser SQL.js si disponible
            if (typeof initSqlJs === 'function') {
                const SQL = await initSqlJs({
                    locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/${file}`
                });
                
                this.db = new SQL.Database();
                this.useLocalStorage = false;
                this.createTables();
                console.log("Base de données SQLite initialisée");
            } else {
                throw new Error('SQL.js non disponible');
            }
        } catch (error) {
            console.log("Utilisation de localStorage comme base de données");
            this.useLocalStorage = true;
            this.initLocalStorage();
        }
    }

    createTables() {
        if (this.useLocalStorage) return;

        // Table des articles
        this.db.run(`
            CREATE TABLE IF NOT EXISTS articles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                code TEXT UNIQUE,
                name TEXT NOT NULL,
                description TEXT,
                category TEXT NOT NULL,
                department TEXT NOT NULL,
                site TEXT NOT NULL,
                unit TEXT NOT NULL,
                current_stock REAL NOT NULL DEFAULT 0,
                alert_threshold REAL NOT NULL DEFAULT 0,
                order_quantity REAL NOT NULL DEFAULT 0,
                cost_price REAL DEFAULT 0,
                selling_price REAL DEFAULT 0,
                supplier TEXT,
                barcode TEXT,
                notes TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Table des sites
        this.db.run(`
            CREATE TABLE IF NOT EXISTS sites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                code TEXT UNIQUE,
                address TEXT,
                phone TEXT,
                manager TEXT,
                email TEXT,
                is_active BOOLEAN DEFAULT 1
            )
        `);

        // Table des fournisseurs
        this.db.run(`
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                code TEXT UNIQUE,
                contact_person TEXT,
                phone TEXT,
                email TEXT,
                address TEXT,
                payment_terms TEXT,
                is_active BOOLEAN DEFAULT 1
            )
        `);

        // Table des commandes
        this.db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT UNIQUE,
                site TEXT NOT NULL,
                supplier_id INTEGER,
                status TEXT DEFAULT 'draft',
                total_amount REAL DEFAULT 0,
                order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                expected_delivery DATE,
                notes TEXT
            )
        `);

        // Table des mouvements de stock
        this.db.run(`
            CREATE TABLE IF NOT EXISTS stock_movements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                article_id INTEGER,
                article_name TEXT,
                movement_type TEXT,
                quantity REAL,
                previous_stock REAL,
                new_stock REAL,
                site TEXT,
                reason TEXT,
                movement_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                user_id TEXT
            )
        `);

        this.insertInitialData();
    }

    insertInitialData() {
        if (this.useLocalStorage) return;

        // Insérer les sites
        const sites = [
            { name: 'Bypass', code: 'BY001', address: '123 Rue Bypass, Antananarivo', phone: '+261 20 123 45', manager: 'Jean Rakoto' },
            { name: 'Isoraka', code: 'IS002', address: '456 Avenue Isoraka, Antananarivo', phone: '+261 20 456 78', manager: 'Marie Ravao' },
            { name: 'Ivato', code: 'IV003', address: '789 Boulevard Ivato, Antananarivo', phone: '+261 20 789 01', manager: 'Paul Randria' }
        ];

        sites.forEach(site => {
            try {
                this.db.run(
                    "INSERT OR IGNORE INTO sites (name, code, address, phone, manager) VALUES (?, ?, ?, ?, ?)",
                    [site.name, site.code, site.address, site.phone, site.manager]
                );
            } catch (e) {}
        });

        // Insérer les fournisseurs
        const suppliers = [
            { name: 'Centrale C2A', code: 'C2A001', contact_person: 'M. Dupont', phone: '+261 20 111 222', email: 'c2a@supplier.mg' },
            { name: 'Fresh Market Madagascar', code: 'FRM002', contact_person: 'Mme. Sophie', phone: '+261 20 333 444', email: 'fresh@market.mg' },
            { name: 'Meat Suppliers MG', code: 'MTS003', contact_person: 'M. Robert', phone: '+261 20 555 666', email: 'meat@suppliers.mg' },
            { name: 'Beverage Distributors', code: 'BVD004', contact_person: 'M. Thomas', phone: '+261 20 777 888', email: 'beverage@distributors.mg' }
        ];

        suppliers.forEach(supplier => {
            try {
                this.db.run(
                    "INSERT OR IGNORE INTO suppliers (name, code, contact_person, phone, email) VALUES (?, ?, ?, ?, ?)",
                    [supplier.name, supplier.code, supplier.contact_person, supplier.phone, supplier.email]
                );
            } catch (e) {}
        });
    }

    // ==================== GESTION DES ARTICLES ====================

    getAllArticles(filters = {}) {
        if (this.useLocalStorage) {
            let articles = this.getFromLocalStorage('articles') || [];
            
            // Appliquer les filtres
            if (filters.site) {
                articles = articles.filter(a => a.site === filters.site);
            }
            if (filters.category) {
                articles = articles.filter(a => a.category === filters.category);
            }
            if (filters.department) {
                articles = articles.filter(a => a.department === filters.department);
            }
            if (filters.search) {
                const searchTerm = filters.search.toLowerCase();
                articles = articles.filter(a => 
                    a.name.toLowerCase().includes(searchTerm) || 
                    a.code?.toLowerCase().includes(searchTerm)
                );
            }
            
            return articles;
        }

        let query = `SELECT * FROM articles WHERE is_active = 1`;
        const params = [];
        
        if (filters.site) {
            query += ` AND site = ?`;
            params.push(filters.site);
        }
        if (filters.category) {
            query += ` AND category = ?`;
            params.push(filters.category);
        }
        if (filters.search) {
            query += ` AND (name LIKE ? OR code LIKE ?)`;
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        query += ` ORDER BY site, category, name`;
        
        try {
            const result = this.db.exec(query, params);
            if (result.length === 0) return [];
            
            return result[0].values.map(row => this.mapArticleRow(row));
        } catch (error) {
            console.error('Erreur getAllArticles:', error);
            return [];
        }
    }

    getArticle(id) {
        if (this.useLocalStorage) {
            const articles = this.getFromLocalStorage('articles') || [];
            return articles.find(a => a.id === id);
        }

        try {
            const result = this.db.exec("SELECT * FROM articles WHERE id = ?", [id]);
            if (result.length === 0) return null;
            
            return this.mapArticleRow(result[0].values[0]);
        } catch (error) {
            console.error('Erreur getArticle:', error);
            return null;
        }
    }

    addArticle(articleData) {
        const article = {
            code: articleData.code || `ART${Date.now()}`,
            name: articleData.name,
            description: articleData.description || '',
            category: articleData.category,
            department: articleData.department,
            site: articleData.site,
            unit: articleData.unit,
            current_stock: articleData.current_stock || 0,
            alert_threshold: articleData.alert_threshold || 0,
            order_quantity: articleData.order_quantity || 0,
            cost_price: articleData.cost_price || 0,
            selling_price: articleData.selling_price || 0,
            supplier: articleData.supplier || '',
            barcode: articleData.barcode || '',
            notes: articleData.notes || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (this.useLocalStorage) {
            const articles = this.getFromLocalStorage('articles') || [];
            article.id = Date.now();
            articles.push(article);
            this.saveToLocalStorage('articles', articles);
            
            // Enregistrer le mouvement de stock
            this.addStockMovement({
                article_id: article.id,
                article_name: article.name,
                movement_type: 'creation',
                quantity: article.current_stock,
                previous_stock: 0,
                new_stock: article.current_stock,
                site: article.site,
                reason: 'Création article'
            });
            
            return article.id;
        }

        try {
            const result = this.db.run(
                `INSERT INTO articles (
                    code, name, description, category, department, site, unit, 
                    current_stock, alert_threshold, order_quantity, cost_price, 
                    selling_price, supplier, barcode, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    article.code, article.name, article.description, article.category,
                    article.department, article.site, article.unit, article.current_stock,
                    article.alert_threshold, article.order_quantity, article.cost_price,
                    article.selling_price, article.supplier, article.barcode, article.notes
                ]
            );
            
            const id = this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
            
            this.addStockMovement({
                article_id: id,
                article_name: article.name,
                movement_type: 'creation',
                quantity: article.current_stock,
                previous_stock: 0,
                new_stock: article.current_stock,
                site: article.site,
                reason: 'Création article'
            });
            
            return id;
        } catch (error) {
            console.error('Erreur addArticle:', error);
            return null;
        }
    }

    updateArticle(id, articleData) {
        const oldArticle = this.getArticle(id);
        
        if (this.useLocalStorage) {
            const articles = this.getFromLocalStorage('articles') || [];
            const index = articles.findIndex(a => a.id === id);
            if (index !== -1) {
                articles[index] = { 
                    ...articles[index], 
                    ...articleData, 
                    updated_at: new Date().toISOString() 
                };
                this.saveToLocalStorage('articles', articles);
                
                // Enregistrer le mouvement si le stock a changé
                if (articleData.current_stock !== undefined && 
                    articleData.current_stock !== oldArticle.current_stock) {
                    this.addStockMovement({
                        article_id: id,
                        article_name: articles[index].name,
                        movement_type: 'adjustment',
                        quantity: articleData.current_stock - oldArticle.current_stock,
                        previous_stock: oldArticle.current_stock,
                        new_stock: articleData.current_stock,
                        site: articles[index].site,
                        reason: 'Ajustement manuel'
                    });
                }
            }
            return;
        }

        try {
            this.db.run(
                `UPDATE articles SET
                    name = ?, description = ?, category = ?, department = ?, site = ?, unit = ?,
                    current_stock = ?, alert_threshold = ?, order_quantity = ?, cost_price = ?,
                    selling_price = ?, supplier = ?, barcode = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [
                    articleData.name, articleData.description, articleData.category,
                    articleData.department, articleData.site, articleData.unit,
                    articleData.current_stock, articleData.alert_threshold,
                    articleData.order_quantity, articleData.cost_price,
                    articleData.selling_price, articleData.supplier,
                    articleData.barcode, articleData.notes, id
                ]
            );

            // Enregistrer le mouvement si le stock a changé
            if (articleData.current_stock !== undefined && 
                articleData.current_stock !== oldArticle.current_stock) {
                this.addStockMovement({
                    article_id: id,
                    article_name: articleData.name,
                    movement_type: 'adjustment',
                    quantity: articleData.current_stock - oldArticle.current_stock,
                    previous_stock: oldArticle.current_stock,
                    new_stock: articleData.current_stock,
                    site: articleData.site,
                    reason: 'Ajustement manuel'
                });
            }
        } catch (error) {
            console.error('Erreur updateArticle:', error);
        }
    }

    deleteArticle(id) {
        if (this.useLocalStorage) {
            const articles = this.getFromLocalStorage('articles') || [];
            const filtered = articles.filter(a => a.id !== id);
            this.saveToLocalStorage('articles', filtered);
            return;
        }

        try {
            this.db.run("DELETE FROM articles WHERE id = ?", [id]);
        } catch (error) {
            console.error('Erreur deleteArticle:', error);
        }
    }

    // ==================== GESTION DES SITES ====================

    getAllSites() {
        if (this.useLocalStorage) {
            return this.getFromLocalStorage('sites') || [];
        }

        try {
            const result = this.db.exec("SELECT * FROM sites WHERE is_active = 1");
            if (result.length === 0) return [];
            
            return result[0].values.map(row => ({
                id: row[0],
                name: row[1],
                code: row[2],
                address: row[3],
                phone: row[4],
                manager: row[5],
                email: row[6]
            }));
        } catch (error) {
            console.error('Erreur getAllSites:', error);
            return [];
        }
    }

    // ==================== GESTION DES FOURNISSEURS ====================

    getAllSuppliers() {
        if (this.useLocalStorage) {
            return this.getFromLocalStorage('suppliers') || [];
        }

        try {
            const result = this.db.exec("SELECT * FROM suppliers WHERE is_active = 1");
            if (result.length === 0) return [];
            
            return result[0].values.map(row => ({
                id: row[0],
                name: row[1],
                code: row[2],
                contact_person: row[3],
                phone: row[4],
                email: row[5],
                address: row[6],
                payment_terms: row[7]
            }));
        } catch (error) {
            console.error('Erreur getAllSuppliers:', error);
            return [];
        }
    }

    // ==================== MOUVEMENTS DE STOCK ====================

    addStockMovement(movement) {
        const movementData = {
            article_id: movement.article_id,
            article_name: movement.article_name,
            movement_type: movement.movement_type,
            quantity: movement.quantity,
            previous_stock: movement.previous_stock,
            new_stock: movement.new_stock,
            site: movement.site,
            reason: movement.reason || '',
            movement_date: new Date().toISOString(),
            user_id: 'admin'
        };

        if (this.useLocalStorage) {
            const movements = this.getFromLocalStorage('stock_movements') || [];
            movementData.id = Date.now();
            movements.push(movementData);
            this.saveToLocalStorage('stock_movements', movements);
            return movementData.id;
        }

        try {
            this.db.run(
                `INSERT INTO stock_movements (
                    article_id, article_name, movement_type, quantity, previous_stock,
                    new_stock, site, reason, user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    movementData.article_id, movementData.article_name,
                    movementData.movement_type, movementData.quantity,
                    movementData.previous_stock, movementData.new_stock,
                    movementData.site, movementData.reason, movementData.user_id
                ]
            );
            
            return this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        } catch (error) {
            console.error('Erreur addStockMovement:', error);
            return null;
        }
    }

    // ==================== STATISTIQUES ====================

    getInventoryStats() {
        const articles = this.getAllArticles();
        const totalItems = articles.length;
        
        const lowStock = articles.filter(a => 
            a.current_stock <= a.alert_threshold && 
            a.current_stock > a.alert_threshold * 0.5
        ).length;
        
        const criticalStock = articles.filter(a => 
            a.current_stock <= a.alert_threshold * 0.5
        ).length;
        
        const totalValue = articles.reduce((sum, a) => 
            sum + (a.current_stock * (a.cost_price || 0)), 0
        );

        const itemsToReorder = articles.filter(a => 
            a.current_stock <= a.alert_threshold
        ).length;

        return { 
            totalItems, 
            lowStock, 
            criticalStock, 
            totalValue,
            itemsToReorder
        };
    }

    getStockAlerts() {
        const articles = this.getAllArticles();
        return articles.filter(a => a.current_stock <= a.alert_threshold);
    }

    // ==================== UTILITAIRES ====================

    mapArticleRow(row) {
        return {
            id: row[0],
            code: row[1],
            name: row[2],
            description: row[3],
            category: row[4],
            department: row[5],
            site: row[6],
            unit: row[7],
            current_stock: row[8],
            alert_threshold: row[9],
            order_quantity: row[10],
            cost_price: row[11],
            selling_price: row[12],
            supplier: row[13],
            barcode: row[14],
            notes: row[15],
            created_at: row[18],
            updated_at: row[19]
        };
    }

    // ==================== LOCALSTORAGE ====================

    initLocalStorage() {
        // Données d'initialisation pour localStorage
        const initialSites = [
            { id: 1, name: 'Bypass', code: 'BY001', address: '123 Rue Bypass, Antananarivo', phone: '+261 20 123 45', manager: 'Jean Rakoto', email: 'bypass@swis.mg' },
            { id: 2, name: 'Isoraka', code: 'IS002', address: '456 Avenue Isoraka, Antananarivo', phone: '+261 20 456 78', manager: 'Marie Ravao', email: 'isoraka@swis.mg' },
            { id: 3, name: 'Ivato', code: 'IV003', address: '789 Boulevard Ivato, Antananarivo', phone: '+261 20 789 01', manager: 'Paul Randria', email: 'ivato@swis.mg' }
        ];

        const initialSuppliers = [
            { id: 1, name: 'Centrale C2A', code: 'C2A001', contact_person: 'M. Dupont', phone: '+261 20 111 222', email: 'c2a@supplier.mg', address: '123 Avenue de l\'Indépendance', payment_terms: '30 jours' },
            { id: 2, name: 'Fresh Market Madagascar', code: 'FRM002', contact_person: 'Mme. Sophie', phone: '+261 20 333 444', email: 'fresh@market.mg', address: '456 Rue du Commerce', payment_terms: '15 jours' },
            { id: 3, name: 'Meat Suppliers MG', code: 'MTS003', contact_person: 'M. Robert', phone: '+261 20 555 666', email: 'meat@suppliers.mg', address: '789 Boulevard des Viandes', payment_terms: '30 jours' }
        ];

        const initialArticles = [
            { 
                id: 1, code: 'TOM001', name: 'Tomates fraîches', 
                description: 'Tomates rouges fraîches', category: 'Légumes', department: 'Primeurs',
                site: 'Bypass', unit: 'kg', current_stock: 15, alert_threshold: 5, order_quantity: 10,
                cost_price: 1200, selling_price: 1800, supplier: 'Fresh Market Madagascar',
                barcode: '1234567890123', notes: 'À conserver au frais',
                created_at: new Date().toISOString(), updated_at: new Date().toISOString()
            },
            { 
                id: 2, code: 'POU002', name: 'Filet de poulet', 
                description: 'Filet de poulet sans peau', category: 'Viandes', department: 'Boucherie',
                site: 'Bypass', unit: 'kg', current_stock: 2, alert_threshold: 5, order_quantity: 8,
                cost_price: 8500, selling_price: 12000, supplier: 'Meat Suppliers MG',
                barcode: '1234567890124', notes: 'Congelé',
                created_at: new Date().toISOString(), updated_at: new Date().toISOString()
            },
            { 
                id: 3, code: 'RIZ003', name: 'Riz basmati', 
                description: 'Riz basmati qualité premium', category: 'Épicerie', department: 'Épicerie sèche',
                site: 'Isoraka', unit: 'kg', current_stock: 25, alert_threshold: 10, order_quantity: 15,
                cost_price: 3200, selling_price: 4500, supplier: 'Centrale C2A',
                barcode: '1234567890125', notes: 'Stockage sec',
                created_at: new Date().toISOString(), updated_at: new Date().toISOString()
            }
        ];

        if (!this.getFromLocalStorage('sites')) {
            this.saveToLocalStorage('sites', initialSites);
        }

        if (!this.getFromLocalStorage('suppliers')) {
            this.saveToLocalStorage('suppliers', initialSuppliers);
        }

        if (!this.getFromLocalStorage('articles')) {
            this.saveToLocalStorage('articles', initialArticles);
        }

        if (!this.getFromLocalStorage('stock_movements')) {
            this.saveToLocalStorage('stock_movements', []);
        }

        if (!this.getFromLocalStorage('orders')) {
            this.saveToLocalStorage('orders', []);
        }
    }

    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(`swis_inventory_${key}`, JSON.stringify(data));
        } catch (error) {
            console.error('Erreur sauvegarde localStorage:', error);
        }
    }

    getFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(`swis_inventory_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Erreur lecture localStorage:', error);
            return null;
        }
    }

    // ==================== SAUVEGARDE/RESTAURATION ====================

    exportData() {
        const data = {
            articles: this.getFromLocalStorage('articles') || [],
            sites: this.getFromLocalStorage('sites') || [],
            suppliers: this.getFromLocalStorage('suppliers') || [],
            stock_movements: this.getFromLocalStorage('stock_movements') || [],
            orders: this.getFromLocalStorage('orders') || [],
            export_date: new Date().toISOString()
        };
        return JSON.stringify(data, null, 2);
    }

    importData(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            if (data.articles) this.saveToLocalStorage('articles', data.articles);
            if (data.sites) this.saveToLocalStorage('sites', data.sites);
            if (data.suppliers) this.saveToLocalStorage('suppliers', data.suppliers);
            if (data.stock_movements) this.saveToLocalStorage('stock_movements', data.stock_movements);
            if (data.orders) this.saveToLocalStorage('orders', data.orders);
            
            return true;
        } catch (error) {
            console.error('Erreur import données:', error);
            return false;
        }
    }

    // ==================== RECHERCHE AVANCÉE ====================

    searchArticles(query) {
        const articles = this.getAllArticles();
        const searchTerm = query.toLowerCase();
        
        return articles.filter(article =>
            article.name.toLowerCase().includes(searchTerm) ||
            article.code.toLowerCase().includes(searchTerm) ||
            article.description.toLowerCase().includes(searchTerm) ||
            article.category.toLowerCase().includes(searchTerm) ||
            article.supplier.toLowerCase().includes(searchTerm)
        );
    }

    // ==================== CATÉGORIES ET DÉPARTEMENTS ====================

    getCategories() {
        const articles = this.getAllArticles();
        const categories = [...new Set(articles.map(a => a.category))];
        return categories.sort();
    }

    getDepartments() {
        const articles = this.getAllArticles();
        const departments = [...new Set(articles.map(a => a.department))];
        return departments.sort();
    }

    getUnits() {
        return ['kg', 'g', 'L', 'ml', 'pièce', 'boîte', 'sachet', 'carton', 'pack'];
    }
}

// Initialiser la base de données globale
const inventoryDB = new InventoryDatabase();