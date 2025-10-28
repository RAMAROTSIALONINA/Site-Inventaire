// frontend/js/api.js - VERSION COMPLÈTE AVEC HISTORIQUE

class ApiService {
    static baseURL = 'http://localhost:3000/api';
    static token = localStorage.getItem('authToken');

    // 🔥 MÉTHODE request CORRIGÉE
static async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    console.log(`🔗 API ${options.method || 'GET'} ${url}`, options.body || '');

    const config = {
        headers: {
            'Content-Type': 'application/json',
            ...(this.token && { 'Authorization': `Bearer ${this.token}` })
        },
        ...options
    };

    if (options.body && typeof options.body === 'object') {
        config.body = JSON.stringify(options.body);
    }

    try {
        const response = await fetch(url, config);
        console.log(`📡 Réponse ${response.status} ${url}`);

        if (response.status === 204) {
            return { success: true };
        }

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorData.message || errorMessage;
            } catch (e) {
                const text = await response.text();
                if (text) errorMessage = text;
            }
            throw new Error(errorMessage);
        }

        const text = await response.text();
        if (text) {
            return JSON.parse(text);
        } else {
            return { success: true };
        }
        
    } catch (error) {
        console.error(`❌ API ${url} - Erreur:`, error);
        throw error;
    }
}

    static setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    // ==================== AUTHENTIFICATION ====================
    static async login(credentials) {
        try {
            const response = await this.request('/auth/login', {
                method: 'POST',
                body: credentials
            });
            
            if (response.token) {
                this.setToken(response.token);
            }
            
            return response;
        } catch (error) {
            console.error('❌ Erreur login:', error);
            throw error;
        }
    }

    static async getCurrentUser() {
        return this.request('/auth/me');
    }

    // ==================== ARTICLES ====================
    static async getArticles(params = {}) {
        const query = new URLSearchParams(params).toString();
        return this.request(`/articles?${query}`);
    }

    static async getArticle(id) {
        return this.request(`/articles/${id}`);
    }

    static async createArticle(articleData) {
    // 🔥 VALIDATION RENFORCÉE côté API
    const validationErrors = this.validateArticleData(articleData);
    if (validationErrors.length > 0) {
        throw new Error(`Données invalides: ${validationErrors.join(', ')}`);
    }

    // Vérifier l'existence des références
    await this.validateReferences(articleData);

    const validatedData = {
        code: articleData.code.trim(),
        name: articleData.name.trim(),
        category_id: parseInt(articleData.category_id),
        site_id: parseInt(articleData.site_id),
        unit_id: parseInt(articleData.unit_id),
        current_stock: parseFloat(articleData.current_stock),
        alert_threshold: parseFloat(articleData.alert_threshold),
        order_quantity: articleData.order_quantity || 10,
        cost_price: articleData.cost_price || 0
    };
    
    console.log('📦 Données article validées:', validatedData);
    
    return this.request('/articles', {
        method: 'POST',
        body: validatedData
    });
}

// AJOUTER cette méthode dans ApiService
static async validateReferences(articleData) {
    try {
        // Vérifier que la catégorie existe
        const categories = await this.getCategories();
        const categoryExists = categories.data.some(cat => cat.id === articleData.category_id);
        if (!categoryExists) {
            throw new Error('La catégorie sélectionnée n\'existe pas');
        }

        // Vérifier que le site existe
        const sites = await this.getSites();
        const siteExists = sites.data.some(site => site.id === articleData.site_id);
        if (!siteExists) {
            throw new Error('Le site sélectionné n\'existe pas');
        }

        // Vérifier que l'unité existe
        const units = await this.getUnits();
        const unitExists = units.data.some(unit => unit.id === articleData.unit_id);
        if (!unitExists) {
            throw new Error('L\'unité sélectionnée n\'existe pas');
        }

    } catch (error) {
        console.error('❌ Erreur validation références:', error);
        throw new Error(`Erreur de validation: ${error.message}`);
    }
}

// AJOUTER validation statique des données
static validateArticleData(articleData) {
    const errors = [];

    if (!articleData.code || articleData.code.trim().length === 0) {
        errors.push('Code article requis');
    }

    if (!articleData.name || articleData.name.trim().length === 0) {
        errors.push('Nom article requis');
    }

    if (!articleData.category_id || isNaN(articleData.category_id)) {
        errors.push('Catégorie invalide');
    }

    if (!articleData.site_id || isNaN(articleData.site_id)) {
        errors.push('Site invalide');
    }

    if (!articleData.unit_id || isNaN(articleData.unit_id)) {
        errors.push('Unité invalide');
    }

    if (isNaN(articleData.current_stock)) {
        errors.push('Stock actuel invalide');
    }

    if (isNaN(articleData.alert_threshold)) {
        errors.push('Seuil d\'alerte invalide');
    }

    return errors;
}

    static async updateArticle(id, articleData) {
        const validatedData = {
            code: articleData.code,
            name: articleData.name,
            category_id: parseInt(articleData.category_id),
            site_id: parseInt(articleData.site_id),
            unit_id: parseInt(articleData.unit_id),
            current_stock: parseFloat(articleData.current_stock),
            alert_threshold: parseFloat(articleData.alert_threshold),
            order_quantity: articleData.order_quantity || 10,
            cost_price: articleData.cost_price || 0
        };
        
        return this.request(`/articles/${id}`, {
            method: 'PUT',
            body: validatedData
        });
    }

    static async deleteArticle(id) {
        return this.request(`/articles/${id}`, {
            method: 'DELETE'
        });
    }

    static async getStats() {
        return this.request('/articles/stats');
    }

    // Dans frontend/js/api.js - Méthode checkCodeUnique
static async checkCodeUnique(code, excludeId = null) {
    console.log('🔍 Vérification unicité code:', code, 'excludeId:', excludeId);
    
    // Éviter les appels inutiles
    if (!code || code.trim() === '') {
        return { data: { isUnique: true, existingArticle: null } };
    }

    const params = { code: code.trim() };
    if (excludeId) params.excludeId = excludeId;
    
    const query = new URLSearchParams(params).toString();
    
    try {
        const response = await this.request(`/articles/check/code?${query}`);
        console.log('✅ Réponse vérification code:', response);
        return response;
    } catch (error) {
        console.error('❌ Erreur vérification code:', error);
        // En cas d'erreur, considérer comme unique pour ne pas bloquer
        return { data: { isUnique: true, existingArticle: null } };
    }
}

    // ==================== HISTORIQUE ====================
    static async getMyHistory(filters = {}) {
        try {
            const params = new URLSearchParams();
            
            // Ajouter tous les filtres
            Object.keys(filters).forEach(key => {
                if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
                    params.append(key, filters[key]);
                }
            });

            console.log('🔍 Chargement historique avec params:', params.toString());
            
            const response = await this.request(`/history/my-history?${params}`);
            return response;
        } catch (error) {
            console.error('❌ Erreur getMyHistory:', error);
            return { success: false, error: error.message };
        }
    }

    static async getHistoryStats() {
        try {
            const response = await this.request('/history/stats');
            return response;
        } catch (error) {
            console.error('❌ Erreur getHistoryStats:', error);
            return { success: false, error: error.message };
        }
    }


    // ==================== RÉFÉRENCES - CATÉGORIES ====================
    static async getCategories() {
        return this.request('/references/categories');
    }

    static async createCategory(categoryData) {
        const validatedData = {
            name: categoryData.name,
            description: categoryData.description || ''
        };
        
        return this.request('/references/categories', {
            method: 'POST',
            body: validatedData
        });
    }

    static async updateCategory(id, categoryData) {
        const validatedData = {
            name: categoryData.name,
            description: categoryData.description || ''
        };
        
        return this.request(`/references/categories/${id}`, {
            method: 'PUT',
            body: validatedData
        });
    }

    static async deleteCategory(id) {
        try {
            // D'abord vérifier si la catégorie est utilisée
            const articlesResponse = await this.getArticles();
            const articles = articlesResponse.data || articlesResponse;
            const articlesUsingCategory = articles.filter(article => article.category_id == id);
            
            if (articlesUsingCategory.length > 0) {
                throw new Error(`Impossible de supprimer : catégorie utilisée par ${articlesUsingCategory.length} article(s)`);
            }
            
            return this.request(`/references/categories/${id}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('❌ Erreur vérification avant suppression catégorie:', error);
            throw error;
        }
    }

    // ==================== RÉFÉRENCES - SITES ====================
    static async getSites() {
        return this.request('/references/sites');
    }

    static async createSite(siteData) {
        const validatedData = {
            name: siteData.name,
            address: siteData.address || ''
        };
        
        return this.request('/references/sites', {
            method: 'POST',
            body: validatedData
        });
    }

    static async updateSite(id, siteData) {
        const validatedData = {
            name: siteData.name,
            address: siteData.address || ''
        };
        
        return this.request(`/references/sites/${id}`, {
            method: 'PUT',
            body: validatedData
        });
    }

    static async deleteSite(id) {
        return this.request(`/references/sites/${id}`, {
            method: 'DELETE'
        });
    }

    // ==================== RÉFÉRENCES - UNITÉS ====================
    static async getUnits() {
        return this.request('/references/units');
    }

    static async createUnit(unitData) {
        const validatedData = {
            name: unitData.name,
            symbol: unitData.symbol
        };
        
        return this.request('/references/units', {
            method: 'POST',
            body: validatedData
        });
    }

    static async updateUnit(id, unitData) {
        const validatedData = {
            name: unitData.name,
            symbol: unitData.symbol
        };
        
        return this.request(`/references/units/${id}`, {
            method: 'PUT',
            body: validatedData
        });
    }

    static async deleteUnit(id) {
        return this.request(`/references/units/${id}`, {
            method: 'DELETE'
        });
    }

    // ==================== UTILISATEURS ====================
    static async getUsers() {
        return this.request('/users');
    }

    static async getUser(id) {
        return this.request(`/users/${id}`);
    }

    static async createUser(userData) {
        const validatedData = {
            username: userData.username,
            full_name: userData.full_name,
            email: userData.email || '',
            role: userData.role,
            password: userData.password
        };
        
        // Vérifier que le mot de passe est fourni pour la création
        if (!validatedData.password) {
            throw new Error('Le mot de passe est requis pour créer un utilisateur');
        }
        
        return this.request('/users', {
            method: 'POST',
            body: validatedData
        });
    }

    static async updateUser(id, userData) {
        const validatedData = {
            username: userData.username,
            full_name: userData.full_name,
            email: userData.email || '',
            role: userData.role
        };
        
        // Ajouter le mot de passe seulement s'il est fourni
        if (userData.password) {
            validatedData.password = userData.password;
        }
        
        return this.request(`/users/${id}`, {
            method: 'PUT',
            body: validatedData
        });
    }

    static async deleteUser(id) {
        return this.request(`/users/${id}`, {
            method: 'DELETE'
        });
    }

    // ==================== RÔLES (pour la démo) ====================
    static async getRoles() {
        // Pour la démo, simuler une requête API
        return new Promise((resolve) => {
            setTimeout(() => {
                const savedRoles = localStorage.getItem('customRoles');
                if (savedRoles) {
                    resolve({ data: JSON.parse(savedRoles) });
                } else {
                    resolve({ 
                        data: [
                            { 
                                id: 1, 
                                name: 'user', 
                                description: 'Utilisateur standard - Lecture seule', 
                                permissions: ['dashboard', 'inventory-read'] 
                            },
                            { 
                                id: 2, 
                                name: 'reference', 
                                description: 'Gestionnaire références - Inventaire + Références', 
                                permissions: ['dashboard', 'inventory-read', 'inventory-write', 'references'] 
                            },
                            { 
                                id: 3, 
                                name: 'manager', 
                                description: 'Gestionnaire - Inventaire + Références', 
                                permissions: ['dashboard', 'inventory-read', 'inventory-write', 'references', 'reports'] 
                            },
                            { 
                                id: 4, 
                                name: 'admin', 
                                description: 'Administrateur - Accès complet', 
                                permissions: ['dashboard', 'inventory-read', 'inventory-write', 'references', 'users', 'reports'] 
                            }
                        ] 
                    });
                }
            }, 100);
        });
    }

    static async createRole(roleData) {
        // Pour la démo, sauvegarder dans localStorage
        return new Promise((resolve) => {
            setTimeout(() => {
                const savedRoles = localStorage.getItem('customRoles');
                const roles = savedRoles ? JSON.parse(savedRoles) : [];
                const newRole = {
                    id: Date.now(),
                    ...roleData
                };
                roles.push(newRole);
                localStorage.setItem('customRoles', JSON.stringify(roles));
                resolve({ data: newRole });
            }, 100);
        });
    }

    static async updateRole(id, roleData) {
        // Pour la démo, mettre à jour dans localStorage
        return new Promise((resolve) => {
            setTimeout(() => {
                const savedRoles = localStorage.getItem('customRoles');
                const roles = savedRoles ? JSON.parse(savedRoles) : [];
                const index = roles.findIndex(role => role.id == id);
                if (index !== -1) {
                    roles[index] = { ...roles[index], ...roleData };
                    localStorage.setItem('customRoles', JSON.stringify(roles));
                    resolve({ data: roles[index] });
                } else {
                    resolve({ error: 'Rôle non trouvé' });
                }
            }, 100);
        });
    }
        static async getDailyStockHistory(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/history/daily-stock?${query}`);
    }

    static async getDailyStockStats(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return this.request(`/history/daily-stock/stats?${query}`);
    }

    static async takeDailySnapshot() {
        return this.request('/history/daily-snapshot', {
            method: 'POST'
        });
    }

    static async deleteRole(id) {
        // Pour la démo, supprimer de localStorage
        return new Promise((resolve) => {
            setTimeout(() => {
                const savedRoles = localStorage.getItem('customRoles');
                const roles = savedRoles ? JSON.parse(savedRoles) : [];
                const filteredRoles = roles.filter(role => role.id != id);
                localStorage.setItem('customRoles', JSON.stringify(filteredRoles));
                resolve({ success: true });
            }, 100);
        });
    }
}



console.log('✅ ApiService chargé avec méthodes historiques');