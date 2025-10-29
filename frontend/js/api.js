// frontend/js/api.js - VERSION COMPLÈTE CORRIGÉE
class ApiService {
    static baseURL = 'http://localhost:3000/api';
    static token = localStorage.getItem('authToken');

    // 🔥 MÉTHODE REQUEST CORRIGÉE POUR LES EXPORTS
    static async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        
        console.log(`🔗 API ${options.method || 'GET'} ${url}`);

        // Configuration des headers
        const headers = {
            ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
            ...options.headers
        };

        // Ne pas ajouter Content-Type pour les FormData
        if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            headers,
            credentials: 'include',
            ...options
        };

        // Gérer le body selon le type
        if (options.body) {
            if (options.body instanceof FormData) {
                config.body = options.body;
                delete config.headers['Content-Type'];
            } else if (typeof options.body === 'object') {
                config.body = JSON.stringify(options.body);
            }
        }

        try {
            const response = await fetch(url, config);
            console.log(`📡 Réponse ${response.status} ${url}`);

            // Gérer les réponses sans contenu
            if (response.status === 204) {
                return { success: true };
            }

            // 🔥 DÉTECTION DES TYPES DE RÉPONSE
            const contentType = response.headers.get('content-type') || '';
            const isPDF = contentType.includes('application/pdf');
            const isCSV = contentType.includes('text/csv') || contentType.includes('application/csv');
            const isJSON = contentType.includes('application/json');
            
            console.log('📄 Content-Type:', contentType);
            console.log('📊 Type détecté - PDF:', isPDF, 'CSV:', isCSV, 'JSON:', isJSON);

            // 🔥 GESTION DES EXPORTS (PDF ET CSV)
            // 🔥 SOLUTION 2 - Gestion robuste des réponses
if (isPDF || isCSV) {
    console.log('📄 Réponse de type fichier détectée');
    
    // Lire d'abord le contenu pour identifier le type réel
    const responseClone = response.clone();
    const buffer = await responseClone.arrayBuffer();
    const firstBytes = new Uint8Array(buffer).subarray(0, 4);
    
    // Vérifier les signatures de fichiers
    const isRealPDF = firstBytes[0] === 0x25 && firstBytes[1] === 0x50 && firstBytes[2] === 0x44 && firstBytes[3] === 0x46; // %PDF
    const isRealCSV = !isPDF; // Simplification
    
    console.log('🔍 Signature fichier:', {
        firstBytes: Array.from(firstBytes),
        isRealPDF,
        isRealCSV,
        contentLength: buffer.byteLength
    });
    
    if (!response.ok) {
        // Essayer de lire comme texte pour voir l'erreur
        const errorText = new TextDecoder().decode(buffer);
        
        if (errorText.startsWith('<') || errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
            console.error('❌ Page HTML reçue au lieu du PDF');
            
            // Extraire des informations de la page HTML
            let errorInfo = `Erreur ${response.status} - `;
            if (errorText.includes('404')) errorInfo += 'Endpoint non trouvé';
            else if (errorText.includes('401') || errorText.includes('login')) errorInfo += 'Non authentifié';
            else if (errorText.includes('500')) errorInfo += 'Erreur serveur';
            else errorInfo += 'Page HTML d\'erreur';
            
            throw new Error(errorInfo);
        }
        
        throw new Error(`Erreur ${response.status}: ${errorText.substring(0, 100)}`);
    }
    
    // Si la réponse est OK mais que ce n'est pas un PDF, vérifier
    if (isPDF && !isRealPDF) {
        const contentPreview = new TextDecoder().decode(buffer.subarray(0, 200));
        console.warn('⚠️ Content-Type dit PDF mais signature incorrecte:', contentPreview);
    }
    
    const blob = new Blob([buffer], { type: isPDF ? 'application/pdf' : 'text/csv' });
    
    if (blob.size === 0) {
        throw new Error('Fichier vide généré');
    }
    
    console.log('📦 Blob créé:', { size: blob.size, type: blob.type });
    
    const filename = this.getFilenameFromResponse(response) || 
                   `inventaire_${new Date().toISOString().split('T')[0]}.${isPDF ? 'pdf' : 'csv'}`;
    
    this.downloadBlob(blob, filename);
    return { 
        success: true, 
        filename, 
        blobSize: blob.size,
        blobType: blob.type
    };
}

// 🔥 NOUVEAU CODE CORRIGÉ
const responseText = await response.text();

if (!response.ok) {
    let errorMessage = `Erreur ${response.status}`;
    
    // Si c'est du HTML, ne pas essayer de le parser en JSON
    if (responseText.startsWith('<') || responseText.includes('<!DOCTYPE') || responseText.includes('<html')) {
        // Analyser le type d'erreur HTML
        if (responseText.includes('404') || responseText.includes('Not Found')) {
            errorMessage = `Endpoint non trouvé (404): ${url}`;
        } else if (responseText.includes('401') || responseText.includes('Unauthorized') || responseText.includes('login')) {
            errorMessage = 'Accès non autorisé - Veuillez vous reconnecter';
        } else if (responseText.includes('500')) {
            errorMessage = 'Erreur interne du serveur (500)';
        } else {
            errorMessage = `Le serveur a retourné une page HTML (${response.status})`;
        }
    } 
    // Si ça ressemble à du JSON, essayer de le parser
    else if (responseText.trim().startsWith('{') || responseText.includes('"error"')) {
        try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
            errorMessage = responseText.substring(0, 200) || errorMessage;
        }
    } 
    // Autre type de contenu
    else {
        errorMessage = responseText.substring(0, 200) || errorMessage;
    }
    
    throw new Error(errorMessage);
}

// Réponse OK - vérifier si c'est du JSON avant de parser
// Réponse OK - vérifier si c'est du JSON avant de parser
if (responseText && responseText.trim()) {
    try {
        // Vérifier que c'est bien du JSON avant de parser
        if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
            return JSON.parse(responseText);
        } else {
            // Si ce n'est pas du JSON, analyser ce que c'est
            console.warn('⚠️ Réponse non-JSON reçue pour:', url);
            
            if (responseText.startsWith('<') || responseText.includes('<!DOCTYPE')) {
                // 🔥 ANALYSER LA PAGE HTML
                const htmlAnalysis = this.analyzeHTMLResponse(responseText, url);
                
                // Si on attendait un PDF mais on a reçu du HTML, c'est une erreur
                if (url.includes('/export/pdf') || url.includes('/pdf')) {
                    throw new Error(`L'endpoint PDF retourne une page HTML: ${htmlAnalysis.errorType} - ${htmlAnalysis.title}`);
                }
                
                // Pour les autres cas, retourner l'analyse
                return { 
                    success: false, 
                    error: `Page HTML reçue: ${htmlAnalysis.errorType}`,
                    htmlAnalysis 
                };
            }
            
            // Autres types de contenu (texte simple, etc.)
            return { success: true, data: responseText };
        }
    } catch (parseError) {
        console.error('❌ Erreur parsing réponse:', parseError);
        throw new Error(`Réponse invalide du serveur: ${parseError.message}`);
    }
} else {
    return { success: true };
}
            
        } catch (error) {
            console.error(`❌ API ${url} - Erreur:`, error);
            throw error;
        }
    }
    // 🔥 ANALYSE DE LA PAGE HTML
static analyzeHTMLResponse(html, url) {
    console.log('🔍 Analyse de la réponse HTML:');
    
    // Extraire le titre de la page
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'Titre non trouvé';
    
    // Chercher des indices d'erreur
    let errorType = 'Page HTML inconnue';
    if (html.includes('404') || html.includes('Not Found')) {
        errorType = 'Erreur 404 - Page non trouvée';
    } else if (html.includes('500') || html.includes('Internal Server Error')) {
        errorType = 'Erreur 500 - Serveur';
    } else if (html.includes('Cannot GET') || html.includes('Cannot POST')) {
        errorType = 'Endpoint inexistant';
    } else if (html.includes('login') || html.includes('Login')) {
        errorType = 'Page de login - Authentification requise';
    }
    
    console.log('📄 Titre de la page:', title);
    console.log('🚨 Type d\'erreur:', errorType);
    console.log('🔗 URL appelée:', url);
    
    return { title, errorType, preview: html.substring(0, 300) };
}

    // 🔥 MÉTHODES D'EXPORT SIMPLIFIÉES
    static async exportInventoryPDF(filters = {}) {
        try {
            console.log('📊 Début export PDF...');
            
            const params = new URLSearchParams();
            
            Object.keys(filters).forEach(key => {
                const value = filters[key];
                if (value !== undefined && value !== null && value !== '') {
                    params.append(key, value.toString());
                }
            });
            
            const endpoint = `/history/inventory/export/pdf?${params}`;
            
            console.log('🔗 Endpoint PDF:', endpoint);
            console.log('📋 Filtres:', Object.fromEntries(params));
            
            const response = await this.request(endpoint);
            return response;
            
        } catch (error) {
            console.error('❌ Erreur export PDF:', error);
            
            // Messages d'erreur plus explicites
            let userMessage = error.message;
            
            if (error.message.includes('HTML')) {
                userMessage = 'Le serveur ne retourne pas un PDF valide. Vérifiez que la route existe.';
            } else if (error.message.includes('401') || error.message.includes('non autorisé')) {
                userMessage = 'Session expirée. Veuillez vous reconnecter.';
            } else if (error.message.includes('404')) {
                userMessage = 'Fonction d\'export PDF non disponible.';
            } else if (error.message.includes('vide')) {
                userMessage = 'Aucune donnée à exporter.';
            }
            
            throw new Error(`Erreur export PDF: ${userMessage}`);
        }
    }

    static async exportInventoryCSV(filters = {}) {
        try {
            console.log('📄 Début export CSV...');
            
            const params = new URLSearchParams(filters);
            const endpoint = `/history/inventory/export/csv?${params}`;
            
            console.log('🔗 Endpoint CSV:', endpoint);
            
            const response = await this.request(endpoint);
            return response;
            
        } catch (error) {
            console.error('❌ Erreur export CSV:', error);
            throw new Error(`Erreur export CSV: ${error.message}`);
        }
    }
    static async testPDFEndpoint() {
    try {
        const testUrl = `${this.baseURL}/history/inventory/export/pdf`;
        console.log('🔍 Test endpoint:', testUrl);
        
        const response = await fetch(testUrl, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
            }
        });
        
        const content = await response.text();
        console.log('📄 Réponse serveur (premiers 500 caractères):', content.substring(0, 500));
        
        return content;
    } catch (error) {
        console.error('❌ Test endpoint failed:', error);
        throw error;
    }
}

    static async exportHistoryCSV(filters = {}) {
        try {
            console.log('📋 Début export historique CSV...');
            
            const params = new URLSearchParams(filters);
            const endpoint = `/history/export/csv?${params}`;
            
            console.log('🔗 Endpoint historique:', endpoint);
            
            const response = await this.request(endpoint);
            return response;
            
        } catch (error) {
            console.error('❌ Erreur export historique:', error);
            throw new Error(`Erreur export historique: ${error.message}`);
        }
    }

    // 🔥 MÉTHODES UTILITAIRES
    static downloadBlob(blob, filename) {
        try {
            if (!blob || blob.size === 0) {
                throw new Error('Fichier vide');
            }
            
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 100);
            
            console.log('✅ Téléchargement réussi:', filename);
            
        } catch (error) {
            console.error('❌ Erreur téléchargement:', error);
            throw error;
        }
    }

    static getFilenameFromResponse(response) {
        const contentDisposition = response.headers.get('content-disposition');
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="(.+)"/);
            if (filenameMatch) return filenameMatch[1];
            
            const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''(.+)/);
            if (filenameStarMatch) return decodeURIComponent(filenameStarMatch[1]);
        }
        return null;
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
        const validationErrors = this.validateArticleData(articleData);
        if (validationErrors.length > 0) {
            throw new Error(`Données invalides: ${validationErrors.join(', ')}`);
        }

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

    static async validateReferences(articleData) {
        try {
            const categories = await this.getCategories();
            const categoryExists = categories.data.some(cat => cat.id === articleData.category_id);
            if (!categoryExists) {
                throw new Error('La catégorie sélectionnée n\'existe pas');
            }

            const sites = await this.getSites();
            const siteExists = sites.data.some(site => site.id === articleData.site_id);
            if (!siteExists) {
                throw new Error('Le site sélectionné n\'existe pas');
            }

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

    static async checkCodeUnique(code, excludeId = null) {
        console.log('🔍 Vérification unicité code:', code, 'excludeId:', excludeId);
        
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
            return { data: { isUnique: true, existingArticle: null } };
        }
    }

    // ==================== HISTORIQUE ====================
    static async getMyHistory(filters = {}) {
        try {
            const params = new URLSearchParams();
            
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

    // ==================== RÉFÉRENCES ====================
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

    // ==================== RÔLES ====================
    static async getRoles() {
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

    static async deleteRole(id) {
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

    // ==================== HISTORIQUE QUOTIDIEN ====================
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
    
}

console.log('✅ ApiService chargé avec exports PDF/CSV corrigés');