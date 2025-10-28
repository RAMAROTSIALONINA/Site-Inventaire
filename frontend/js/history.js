// frontend/js/history.js - VERSION COMPLÈTE CORRIGÉE
class HistoryService {
    constructor() {
        this.currentFilters = {
            page: 1,
            limit: 50,
            entity: '',
            action: '',
            start_date: this.getDefaultStartDate(),
            end_date: this.getDefaultEndDate(),
            search: ''
        };
        
        this.inventoryFilters = {
            date: new Date().toISOString().split('T')[0],
            site_id: '',
            category_id: '',
            low_stock_only: false,
            search: ''
        };
        
        this.isLoading = false;
        this.currentView = 'activities';
        this.availableDates = [];
        this.sites = [];
        this.categories = [];
        this.groupedHistory = {};
    }

    getDefaultStartDate() {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    }

    getDefaultEndDate() {
        return new Date().toISOString().split('T')[0];
    }

    // Initialisation
    async init() {
        console.log('🚀 Initialisation HistoryService...');
        await this.loadReferenceData();
        await this.renderHistory();
        this.setupEventListeners();
    }

    async loadReferenceData() {
        try {
            console.log('🔄 Chargement des données de référence...');
            
            // Charger les sites
            const sitesResponse = await ApiService.getSites();
            if (sitesResponse.success) {
                this.sites = sitesResponse.data || sitesResponse;
                console.log('✅ Sites chargés:', this.sites.length);
            } else {
                console.log('❌ Erreur chargement sites:', sitesResponse.error);
                this.sites = [];
            }

            // Charger les catégories
            const categoriesResponse = await ApiService.getCategories();
            if (categoriesResponse.success) {
                this.categories = categoriesResponse.data || categoriesResponse;
                console.log('✅ Catégories chargées:', this.categories.length);
            } else {
                console.log('❌ Erreur chargement catégories:', categoriesResponse.error);
                this.categories = [];
            }

            // Charger les dates disponibles
            try {
                const datesResponse = await ApiService.request('/history/inventory/available-dates');
                if (datesResponse.success) {
                    this.availableDates = datesResponse.data.available_dates;
                    console.log('✅ Dates disponibles:', this.availableDates.length);
                }
            } catch (datesError) {
                console.log('⚠️ Dates non disponibles:', datesError.message);
                this.availableDates = [];
            }

        } catch (error) {
            console.error('❌ Erreur chargement données référence:', error);
            this.sites = [];
            this.categories = [];
            this.availableDates = [];
        }
    }

    setupEventListeners() {
        // Recherche en temps réel
        document.addEventListener('input', (e) => {
            if (e.target.id === 'history-search') {
                this.debounce(() => {
                    this.currentFilters.search = e.target.value;
                    this.currentFilters.page = 1;
                    console.log('🔍 Recherche:', this.currentFilters.search);
                    this.renderHistory();
                }, 500)();
            }
        });

        // Raccourcis clavier
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case '1':
                        e.preventDefault();
                        this.showView('activities');
                        break;
                    case '2':
                        e.preventDefault();
                        this.showView('inventory');
                        break;
                    case 'Delete':
                        e.preventDefault();
                        this.confirmClearAll();
                        break;
                }
            }
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // 🔄 Afficher la vue activités ou inventaire
    showView(viewType) {
        this.currentView = viewType;
        this.currentFilters.page = 1;
        this.renderHistory();
    }

    async renderHistory() {
        const container = document.getElementById('history-content');
        if (!container) {
            console.error('❌ Conteneur historique non trouvé');
            return;
        }

        if (this.isLoading) return;
        this.isLoading = true;

        try {
            console.log(`🔄 Chargement ${this.currentView} avec filtres:`, this.currentFilters);
            
            container.innerHTML = this.renderLoadingState();

            let response;
            
            if (this.currentView === 'inventory') {
                console.log('📊 Chargement de l\'inventaire...');
                response = await ApiService.request(`/history/inventory/snapshot?${new URLSearchParams(this.inventoryFilters)}`);
                
                console.log('📊 Réponse inventaire:', response);
                
                if (response.success) {
                    container.innerHTML = this.renderInventoryUI(response.data);
                } else {
                    throw new Error(response.error || 'Erreur de chargement inventaire');
                }
            } else {
                console.log('📝 Chargement des activités...');
                
                const params = new URLSearchParams(this.currentFilters);
                const historyResponse = await ApiService.request(`/history/my-history?${params}`);
                const statsResponse = await ApiService.request('/history/stats');
                
                console.log('📋 Réponse historique:', historyResponse);
                console.log('📊 Réponse stats:', statsResponse);
                
                if (historyResponse.success) {
                    console.log('📝 Données historiques brutes:', historyResponse.data.history);
                    
                    if (historyResponse.data.history && historyResponse.data.history.length > 0) {
                        this.groupedHistory = this.groupHistoryByDate(historyResponse.data.history);
                        console.log('📅 Historique groupé:', this.groupedHistory);
                    } else {
                        this.groupedHistory = {};
                        console.log('📭 Aucune donnée historique trouvée');
                    }
                    
                    container.innerHTML = this.renderHistoryUI(
                        historyResponse.data.history, 
                        historyResponse.data.pagination,
                        statsResponse.success ? statsResponse.data : null
                    );
                } else {
                    throw new Error(historyResponse.error || 'Erreur de chargement historique');
                }
            }

            this.attachEvents();

        } catch (error) {
            console.error(`❌ Erreur chargement ${this.currentView}:`, error);
            container.innerHTML = this.renderErrorState(error);
        } finally {
            this.isLoading = false;
        }
    }

    // 🆕 GROUPER L'HISTORIQUE PAR DATE AVEC RECHERCHE
    groupHistoryByDate(history) {
        console.log('🔧 Début du groupement par date avec recherche...');
        
        if (!history || !Array.isArray(history)) {
            console.warn('⚠️ Historique vide ou invalide pour le groupement');
            return {};
        }

        const searchTerm = this.currentFilters.search ? this.currentFilters.search.toLowerCase() : '';
        console.log('🔍 Terme de recherche:', searchTerm);

        const grouped = {};
        let entriesCount = 0;
        
        history.forEach((entry, index) => {
            if (!entry || !entry.created_at) {
                console.warn(`⚠️ Entrée historique invalide à l'index ${index}:`, entry);
                return;
            }

            try {
                // 🔍 FILTRER PAR RECHERCHE
                if (searchTerm) {
                    const searchableText = [
                        entry.description || '',
                        entry.entity || '',
                        entry.action || '',
                        entry.full_name || '',
                        entry.username || '',
                        this.getEntityText(entry.entity) || '',
                        this.getActionText(entry.action) || ''
                    ].join(' ').toLowerCase();

                    if (!searchableText.includes(searchTerm)) {
                        return;
                    }
                }

                const date = new Date(entry.created_at);
                if (isNaN(date.getTime())) {
                    console.warn(`⚠️ Date invalide à l'index ${index}:`, entry.created_at);
                    return;
                }

                const dateKey = date.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                
                if (!grouped[dateKey]) {
                    grouped[dateKey] = {
                        date: entry.created_at,
                        entries: [],
                        count: 0
                    };
                }
                
                grouped[dateKey].entries.push(entry);
                grouped[dateKey].count++;
                entriesCount++;
                
            } catch (error) {
                console.error(`❌ Erreur lors du groupement de l'entrée ${index}:`, entry, error);
            }
        });
        
        console.log('📊 Historique groupé après recherche:', Object.keys(grouped).length, 'jours,', entriesCount, 'entrées');
        return grouped;
    }

    renderLoadingState() {
        return `
            <div class="history-container">
                <div class="history-header">
                    <h2>${this.currentView === 'inventory' ? '📊 Inventaire Historique' : '📝 Historique des Activités'}</h2>
                </div>
                <div class="loading-container">
                    <div class="loading-spinner"></div>
                    <p>Chargement ${this.currentView === 'inventory' ? 'de l\'inventaire' : 'de l\'historique'}...</p>
                </div>
            </div>
        `;
    }

    renderErrorState(error) {
        return `
            <div class="history-container">
                <div class="history-header">
                    <h2>${this.currentView === 'inventory' ? '📊 Inventaire Historique' : '📝 Historique des Activités'}</h2>
                </div>
                <div class="error-message">
                    <div class="error-icon">❌</div>
                    <h3>Erreur de chargement</h3>
                    <p class="error-details">${error.message || 'Impossible de charger les données'}</p>
                    <div class="error-actions">
                        <button onclick="historyService.renderHistory()" class="btn btn-primary">
                            🔄 Réessayer
                        </button>
                        <button onclick="historyService.resetFilters()" class="btn btn-secondary">
                            🗑️ Réinitialiser les filtres
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 📝 INTERFACE ACTIVITÉS AMÉLIORÉE
    renderHistoryUI(history, pagination, stats) {
        console.log('🎨 Rendu interface historique avec recherche...');
        
        const hasEntries = history && history.length > 0;
        const hasGroupedEntries = Object.keys(this.groupedHistory).length > 0;
        const searchTerm = this.currentFilters.search;
        
        console.log('🔍 Recherche active:', searchTerm);
        console.log('✅ Entrées après recherche:', hasGroupedEntries);

        return `
            <div class="history-container">
                <!-- Sélecteur de vue -->
                <div class="view-selector">
                    <button class="view-btn ${this.currentView === 'activities' ? 'active' : ''}" 
                            onclick="historyService.showView('activities')" title="Activités (Ctrl+1)">
                        📝 Activités
                    </button>
                    <button class="view-btn ${this.currentView === 'inventory' ? 'active' : ''}" 
                            onclick="historyService.showView('inventory')" title="Inventaire (Ctrl+2)">
                        📊 Inventaire
                    </button>
                </div>

                <!-- En-tête activités -->
                <div class="history-header">
                    <div class="header-title">
                        <h2>📝 Historique des Activités</h2>
                        <div class="header-badges">
                            <span class="badge badge-info">${pagination?.total || 0} actions</span>
                            ${searchTerm ? `<span class="badge badge-warning">Recherche: "${searchTerm}"</span>` : ''}
                            ${this.currentFilters.entity ? `<span class="badge badge-entity">${this.getEntityText(this.currentFilters.entity)}</span>` : ''}
                            ${this.currentFilters.action ? `<span class="badge badge-action">${this.getActionText(this.currentFilters.action)}</span>` : ''}
                        </div>
                    </div>
                    <div class="history-controls">
                        ${this.renderFilters()}
                        <div class="header-actions">
                            <button onclick="historyService.exportHistory()" class="btn btn-outline btn-sm" title="Exporter en CSV">
                                📄 Exporter
                            </button>
                            <button onclick="historyService.confirmClearAll()" class="btn btn-danger btn-sm" title="Tout supprimer">
                                🗑️ Tout supprimer
                            </button>
                        </div>
                    </div>
                </div>

                ${stats ? this.renderQuickStats(stats) : ''}

                <!-- Barre de recherche AMÉLIORÉE -->
                <div class="search-container">
                    <div class="search-input-wrapper">
                        <input type="text" id="history-search" class="form-control search-input" 
                               placeholder="🔍 Rechercher par mot-clé, utilisateur, action..." 
                               value="${searchTerm || ''}">
                        ${searchTerm ? `
                            <button onclick="historyService.clearSearch()" class="search-clear" title="Effacer la recherche">
                                ✕
                            </button>
                        ` : ''}
                    </div>
                    ${searchTerm ? `
                        <div class="search-help">
                            <small>Recherche dans: descriptions, utilisateurs, types d'actions</small>
                        </div>
                    ` : ''}
                </div>

                <!-- Liste des activités -->
                <div class="history-list">
                    ${hasGroupedEntries ? 
                        this.renderGroupedHistory() : 
                        this.renderEmptyState(searchTerm)
                    }
                </div>

                ${hasEntries ? this.renderPagination(pagination) : ''}
            </div>
        `;
    }

    // 🆕 RENDU GROUPÉ PAR DATE
    renderGroupedHistory() {
        console.log('🎨 Rendu groupé...');
        
        let html = '';
        const groupedDates = Object.keys(this.groupedHistory).sort((a, b) => {
            try {
                return new Date(this.groupedHistory[b].date) - new Date(this.groupedHistory[a].date);
            } catch (error) {
                console.error('❌ Erreur tri des dates:', error);
                return 0;
            }
        });

        console.log('📅 Jours à afficher:', groupedDates);

        groupedDates.forEach(dateKey => {
            const dayData = this.groupedHistory[dateKey];
            console.log(`📋 Rendu du jour ${dateKey}:`, dayData.entries.length, 'entrées');
            
            html += `
                <div class="history-day-group">
                    <div class="history-date-header">
                        <div class="date-info">
                            <h3>📅 ${dateKey}</h3>
                            <span class="day-count">${dayData.count} activité(s)</span>
                        </div>
                        <button onclick="historyService.toggleDayGroup('${dateKey}')" 
                                class="btn btn-sm btn-outline toggle-day-btn" 
                                title="Développer/Réduire">
                            ▼
                        </button>
                    </div>
                    <div class="history-day-entries" id="day-${dateKey}">
                        ${dayData.entries.map(entry => {
                            try {
                                return this.renderHistoryEntry(entry);
                            } catch (error) {
                                console.error('❌ Erreur rendu entrée:', entry, error);
                                return '<div class="error-entry">Erreur affichage entrée</div>';
                            }
                        }).join('')}
                    </div>
                </div>
            `;
        });
        
        console.log('✅ Rendu groupé terminé');
        return html;
    }

    toggleDayGroup(dateKey) {
        const entriesDiv = document.getElementById(`day-${dateKey}`);
        const toggleBtn = document.querySelector(`[onclick="historyService.toggleDayGroup('${dateKey}')"]`);
        
        if (entriesDiv) {
            entriesDiv.classList.toggle('collapsed');
            toggleBtn.textContent = entriesDiv.classList.contains('collapsed') ? '▶' : '▼';
        }
    }

    // 🔄 ENTRÉE HISTORIQUE AVEC BOUTON SUPPRIMER
    renderHistoryEntry(entry) {
        const formattedDate = new Date(entry.created_at).toLocaleString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const icon = this.getActionIcon(entry.action);
        const entityText = this.getEntityText(entry.entity);
        const actionText = this.getActionText(entry.action);
        const isToday = new Date(entry.created_at).toDateString() === new Date().toDateString();

        return `
            <div class="history-entry ${isToday ? 'today-entry' : ''}" data-id="${entry.id}">
                <div class="history-icon">${icon}</div>
                
                <div class="history-content">
                    <div class="history-main">
                        <div class="history-description">
                            <strong>${entry.description}</strong>
                            ${this.renderEntryDetails(entry)}
                        </div>
                        <div class="history-badges">
                            <span class="badge badge-entity">${entityText}</span>
                            <span class="badge badge-action badge-${entry.action.toLowerCase()}">${actionText}</span>
                            ${entry.changes && entry.changes !== 'null' ? 
                                '<span class="badge badge-changes">Modifications</span>' : ''}
                        </div>
                    </div>
                    
                    <div class="history-meta">
                        <div class="meta-info">
                            <span class="history-time">🕒 ${formattedDate}</span>
                            <span class="history-user">👤 ${entry.full_name || entry.username || 'Utilisateur'}</span>
                        </div>
                        <div class="entry-actions">
                            <button onclick="historyService.showEntryDetails(${entry.id})" 
                                    class="btn btn-sm btn-outline" title="Voir les détails">
                                👁️
                            </button>
                            <button onclick="historyService.confirmDeleteEntry(${entry.id})" 
                                    class="btn btn-sm btn-danger delete-entry-btn" 
                                    title="Supprimer cette entrée">
                                🗑️
                            </button>
                        </div>
                    </div>
                    
                    ${this.renderChanges(entry.changes)}
                </div>
            </div>
        `;
    }

    renderEntryDetails(entry) {
        let details = '';
        
        if (entry.entity_id) {
            details += `<div class="entry-detail">ID: ${entry.entity_id}</div>`;
        }
        
        if (entry.entity === 'ARTICLE' && entry.changes) {
            try {
                const changes = typeof entry.changes === 'string' ? JSON.parse(entry.changes) : entry.changes;
                if (changes.old_stock !== undefined && changes.new_stock !== undefined) {
                    details += `<div class="entry-detail">
                        Stock: ${changes.old_stock} → ${changes.new_stock}
                    </div>`;
                }
            } catch (e) {
                // Ignorer les erreurs de parsing
            }
        }
        
        return details ? `<div class="entry-details">${details}</div>` : '';
    }

    renderQuickStats(stats) {
        if (!stats) return '';

        return `
            <div class="quick-stats">
                <div class="stat-card" onclick="historyService.filterToday()" title="Voir les activités d'aujourd'hui">
                    <div class="stat-value">${stats.actions_today || 0}</div>
                    <div class="stat-label">Aujourd'hui</div>
                </div>
                <div class="stat-card" onclick="historyService.filterThisWeek()" title="Voir cette semaine">
                    <div class="stat-value">${stats.actions_week || 0}</div>
                    <div class="stat-label">Cette semaine</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.total_actions || 0}</div>
                    <div class="stat-label">Total</div>
                </div>
                <div class="stat-card" onclick="historyService.filterCreations()" title="Voir les créations">
                    <div class="stat-value">${stats.creations || 0}</div>
                    <div class="stat-label">Créations</div>
                </div>
                <div class="stat-card" onclick="historyService.filterModifications()" title="Voir les modifications">
                    <div class="stat-value">${stats.modifications || 0}</div>
                    <div class="stat-label">Modifications</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${stats.active_users || 1}</div>
                    <div class="stat-label">Utilisateurs</div>
                </div>
            </div>
        `;
    }

    renderFilters() {
        return `
            <div class="history-filters">
                <!-- Période -->
                <div class="filter-group">
                    <label for="filter-start-date">Du</label>
                    <input type="date" id="filter-start-date" value="${this.currentFilters.start_date}" 
                           class="form-control" max="${this.getDefaultEndDate()}">
                </div>
                <div class="filter-group">
                    <label for="filter-end-date">Au</label>
                    <input type="date" id="filter-end-date" value="${this.currentFilters.end_date}" 
                           class="form-control" max="${this.getDefaultEndDate()}">
                </div>

                <!-- Entité -->
                <select id="history-entity" class="form-select">
                    <option value="">Toutes les entités</option>
                    <option value="ARTICLE" ${this.currentFilters.entity === 'ARTICLE' ? 'selected' : ''}>Articles</option>
                    <option value="USER" ${this.currentFilters.entity === 'USER' ? 'selected' : ''}>Utilisateurs</option>
                    <option value="CATEGORY" ${this.currentFilters.entity === 'CATEGORY' ? 'selected' : ''}>Catégories</option>
                    <option value="SITE" ${this.currentFilters.entity === 'SITE' ? 'selected' : ''}>Sites</option>
                    <option value="UNIT" ${this.currentFilters.entity === 'UNIT' ? 'selected' : ''}>Unités</option>
                </select>

                <!-- Action -->
                <select id="history-action" class="form-select">
                    <option value="">Toutes les actions</option>
                    <option value="CREATE" ${this.currentFilters.action === 'CREATE' ? 'selected' : ''}>Création</option>
                    <option value="UPDATE" ${this.currentFilters.action === 'UPDATE' ? 'selected' : ''}>Modification</option>
                    <option value="DELETE" ${this.currentFilters.action === 'DELETE' ? 'selected' : ''}>Suppression</option>
                    <option value="VIEW" ${this.currentFilters.action === 'VIEW' ? 'selected' : ''}>Consultation</option>
                    <option value="STOCK_IN" ${this.currentFilters.action === 'STOCK_IN' ? 'selected' : ''}>Entrée stock</option>
                    <option value="STOCK_OUT" ${this.currentFilters.action === 'STOCK_OUT' ? 'selected' : ''}>Sortie stock</option>
                </select>

                <!-- Actions -->
                <button onclick="historyService.applyFilters()" class="btn btn-primary btn-sm">
                    🔍 Appliquer
                </button>
                <button onclick="historyService.resetFilters()" class="btn btn-secondary btn-sm">
                    🔄 Réinitialiser
                </button>
            </div>
        `;
    }

    // 🆕 FILTRES RAPIDES
    filterToday() {
        const today = new Date().toISOString().split('T')[0];
        this.currentFilters.start_date = today;
        this.currentFilters.end_date = today;
        this.currentFilters.page = 1;
        this.renderHistory();
    }

    filterThisWeek() {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        
        this.currentFilters.start_date = startOfWeek.toISOString().split('T')[0];
        this.currentFilters.end_date = today.toISOString().split('T')[0];
        this.currentFilters.page = 1;
        this.renderHistory();
    }

    filterCreations() {
        this.currentFilters.action = 'CREATE';
        this.currentFilters.page = 1;
        this.renderHistory();
    }

    filterModifications() {
        this.currentFilters.action = 'UPDATE';
        this.currentFilters.page = 1;
        this.renderHistory();
    }

    clearSearch() {
        this.currentFilters.search = '';
        this.currentFilters.page = 1;
        console.log('🧹 Recherche effacée');
        this.renderHistory();
    }

    // 🆕 MÉTHODES DE SUPPRESSION
    async confirmDeleteEntry(entryId) {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette entrée d\'historique ? Cette action est irréversible.')) {
            await this.deleteHistoryEntry(entryId);
        }
    }

    async deleteHistoryEntry(entryId) {
        try {
            const response = await ApiService.request(`/history/entry/${entryId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                this.showNotification('✅ Entrée supprimée avec succès', 'success');
                const entryElement = document.querySelector(`[data-id="${entryId}"]`);
                if (entryElement) {
                    entryElement.style.opacity = '0';
                    setTimeout(() => {
                        entryElement.remove();
                        this.updateDayCounts();
                    }, 300);
                }
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('❌ Erreur suppression entrée:', error);
            this.showNotification('❌ Erreur lors de la suppression', 'error');
        }
    }

    async confirmClearAll() {
        if (confirm('🚨 Êtes-vous ABSOLUMENT sûr de vouloir supprimer TOUT votre historique ?\n\nCette action est IRRÉVERSIBLE et supprimera définitivement toutes vos activités.')) {
            if (confirm('⚠️  Dernière confirmation : Cette action ne peut pas être annulée !')) {
                await this.clearAllHistory();
            }
        }
    }

    async clearAllHistory() {
        try {
            const response = await ApiService.request('/history/clear', {
                method: 'DELETE'
            });

            if (response.success) {
                this.showNotification('✅ Historique complètement effacé', 'success');
                await this.renderHistory();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('❌ Erreur effacement historique:', error);
            this.showNotification('❌ Erreur lors de l\'effacement', 'error');
        }
    }

    updateDayCounts() {
        Object.keys(this.groupedHistory).forEach(dateKey => {
            const entriesDiv = document.getElementById(`day-${dateKey}`);
            if (entriesDiv) {
                const entriesCount = entriesDiv.querySelectorAll('.history-entry').length;
                const countElement = entriesDiv.closest('.history-day-group').querySelector('.day-count');
                if (countElement) {
                    countElement.textContent = `${entriesCount} activité(s)`;
                }
                
                if (entriesCount === 0) {
                    entriesDiv.closest('.history-day-group').remove();
                }
            }
        });
    }

    // 🆕 AFFICHAGE DÉTAILS ENTRÉE
    async showEntryDetails(entryId) {
        try {
            const entry = this.findEntryById(entryId);
            if (entry) {
                this.showEntryDetailsModal(entry);
            }
        } catch (error) {
            console.error('❌ Erreur détails entrée:', error);
            this.showNotification('❌ Erreur lors du chargement des détails', 'error');
        }
    }

    findEntryById(entryId) {
        for (const dateKey in this.groupedHistory) {
            const entry = this.groupedHistory[dateKey].entries.find(e => e.id == entryId);
            if (entry) return entry;
        }
        return null;
    }

    showEntryDetailsModal(entry) {
        const formattedDate = new Date(entry.created_at).toLocaleString('fr-FR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const modalContent = `
            <div class="entry-details-modal">
                <div class="modal-header">
                    <h3>📋 Détails de l'activité</h3>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="detail-section">
                        <h4>Informations générales</h4>
                        <div class="detail-grid">
                            <div class="detail-item">
                                <label>Description:</label>
                                <span>${entry.description}</span>
                            </div>
                            <div class="detail-item">
                                <label>Date et heure:</label>
                                <span>${formattedDate}</span>
                            </div>
                            <div class="detail-item">
                                <label>Utilisateur:</label>
                                <span>${entry.full_name || entry.username || 'N/A'}</span>
                            </div>
                            <div class="detail-item">
                                <label>Entité:</label>
                                <span class="badge badge-entity">${this.getEntityText(entry.entity)}</span>
                            </div>
                            <div class="detail-item">
                                <label>Action:</label>
                                <span class="badge badge-action badge-${entry.action.toLowerCase()}">
                                    ${this.getActionText(entry.action)}
                                </span>
                            </div>
                            ${entry.entity_id ? `
                            <div class="detail-item">
                                <label>ID Entité:</label>
                                <span>${entry.entity_id}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    ${this.renderChanges(entry.changes, true)}
                    
                    <div class="modal-actions">
                        <button onclick="historyService.confirmDeleteEntry(${entry.id})" class="btn btn-danger">
                            🗑️ Supprimer cette entrée
                        </button>
                        <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal('Détails de l\'activité', modalContent);
    }

    renderChanges(changes, detailed = false) {
        try {
            if (!changes || changes === 'null' || changes === 'undefined') return '';
            
            let parsedChanges = changes;
            
            if (typeof changes === 'string') {
                try {
                    parsedChanges = JSON.parse(changes);
                } catch (e) {
                    console.log('❌ Impossible de parser les changements:', changes);
                    return '';
                }
            }
            
            if (typeof parsedChanges !== 'object' || parsedChanges === null) return '';
            
            const displayChanges = { ...parsedChanges };
            delete displayChanges._metadata;
            
            const changesArray = Object.entries(displayChanges);
            if (changesArray.length === 0) return '';

            if (detailed) {
                return `
                    <div class="detail-section">
                        <h4>Modifications détaillées</h4>
                        <div class="changes-list detailed">
                            ${changesArray.map(([key, value]) => {
                                if (value && typeof value === 'object' && value.from !== undefined && value.to !== undefined) {
                                    return `
                                        <div class="change-item detailed">
                                            <div class="change-field">${this.getFieldName(key)}</div>
                                            <div class="change-values">
                                                <span class="change-from">${this.formatValue(value.from)}</span>
                                                <span class="change-arrow">→</span>
                                                <span class="change-to">${this.formatValue(value.to)}</span>
                                            </div>
                                        </div>
                                    `;
                                } else {
                                    return `
                                        <div class="change-item detailed">
                                            <div class="change-field">${this.getFieldName(key)}</div>
                                            <div class="change-value">${this.formatValue(value)}</div>
                                        </div>
                                    `;
                                }
                            }).join('')}
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="history-changes">
                        <details>
                            <summary>📋 Voir les modifications (${changesArray.length})</summary>
                            <div class="changes-list">
                                ${changesArray.map(([key, value]) => {
                                    if (value && typeof value === 'object' && value.from !== undefined && value.to !== undefined) {
                                        return `
                                            <div class="change-item">
                                                <span class="change-field">${this.getFieldName(key)}:</span>
                                                <span class="change-from">${this.formatValue(value.from)}</span>
                                                <span class="change-arrow">→</span>
                                                <span class="change-to">${this.formatValue(value.to)}</span>
                                            </div>
                                        `;
                                    } else {
                                        return `
                                            <div class="change-item">
                                                <span class="change-field">${this.getFieldName(key)}:</span>
                                                <span class="change-value">${this.formatValue(value)}</span>
                                            </div>
                                        `;
                                    }
                                }).join('')}
                            </div>
                        </details>
                    </div>
                `;
            }
        } catch (error) {
            console.error('❌ Erreur rendu des changements:', error, changes);
            return '';
        }
    }

    renderEmptyState(searchTerm = '') {
        const hasFilters = this.currentFilters.entity || this.currentFilters.action || 
                          this.currentFilters.start_date !== this.getDefaultStartDate() ||
                          searchTerm;
        
        if (hasFilters) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <h3>Aucune activité trouvée</h3>
                    <p>Aucune activité ne correspond à vos critères de recherche.</p>
                    ${searchTerm ? `<p class="search-term">Recherche: "<strong>${searchTerm}</strong>"</p>` : ''}
                    <div class="empty-actions">
                        <button onclick="historyService.clearSearch()" class="btn btn-primary">
                            🔍 Effacer la recherche
                        </button>
                        <button onclick="historyService.resetFilters()" class="btn btn-secondary">
                            🔄 Voir tout l'historique
                        </button>
                    </div>
                    <div class="search-tips">
                        <h4>Conseils de recherche :</h4>
                        <ul>
                            <li>Vérifiez l'orthographe des mots-clés</li>
                            <li>Essayez des termes plus généraux</li>
                            <li>Recherchez par nom d'utilisateur</li>
                            <li>Recherchez par type d'action (création, modification, etc.)</li>
                        </ul>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📭</div>
                    <h3>Aucune activité récente</h3>
                    <p>Les actions que vous effectuez apparaîtront ici.</p>
                    <p class="empty-hint">Créez ou modifiez des articles pour voir l'historique.</p>
                    <div class="empty-actions">
                        <button onclick="location.reload()" class="btn btn-primary">
                            🔄 Actualiser
                        </button>
                    </div>
                </div>
            `;
        }
    }

    renderPagination(pagination) {
        if (!pagination || pagination.totalPages <= 1) return '';

        return `
            <div class="history-pagination">
                <button 
                    class="btn btn-sm ${pagination.page <= 1 ? 'btn-disabled' : 'btn-secondary'}" 
                    ${pagination.page <= 1 ? 'disabled' : ''}
                    onclick="historyService.previousPage()"
                >
                    ← Précédent
                </button>
                
                <div class="pagination-info">
                    <span>Page ${pagination.page} sur ${pagination.totalPages}</span>
                    <span class="pagination-total">(${pagination.total} actions)</span>
                </div>
                
                <button 
                    class="btn btn-sm ${pagination.page >= pagination.totalPages ? 'btn-disabled' : 'btn-secondary'}"
                    ${pagination.page >= pagination.totalPages ? 'disabled' : ''}
                    onclick="historyService.nextPage()"
                >
                    Suivant →
                </button>
            </div>
        `;
    }

    // 🏪 INTERFACE INVENTAIRE
    renderInventoryUI(data) {
        if (!data || !data.inventory) {
            console.error('❌ Données d\'inventaire manquantes:', data);
            return this.renderErrorState(new Error('Données d\'inventaire invalides'));
        }

        const { inventory, totals, snapshot_date } = data;
        const formattedDate = snapshot_date ? new Date(snapshot_date).toLocaleDateString('fr-FR') : 'Date invalide';
        
        return `
            <div class="inventory-container">
                <!-- Sélecteur de vue -->
                <div class="view-selector">
                    <button class="view-btn ${this.currentView === 'activities' ? 'active' : ''}" 
                            onclick="historyService.showView('activities')">
                        📝 Activités
                    </button>
                    <button class="view-btn ${this.currentView === 'inventory' ? 'active' : ''}" 
                            onclick="historyService.showView('inventory')">
                        📊 Inventaire
                    </button>
                </div>

                <!-- En-tête inventaire -->
                <div class="inventory-header">
                    <h2>📊 État de l'Inventaire</h2>
                    <div class="inventory-controls">
                        ${this.renderInventoryFilters()}
                    </div>
                </div>

                <!-- Date du snapshot -->
                <div class="snapshot-info">
                    <span class="snapshot-date">📅 ${formattedDate}</span>
                    <span class="snapshot-total">📦 ${totals?.total_articles || 0} articles</span>
                    <span class="snapshot-value">💰 Valeur totale: ${this.formatCurrency(totals?.total_value || 0)}</span>
                </div>

                <!-- Statistiques rapides -->
                <div class="inventory-stats">
                    <div class="stat-card stat-ok">
                        <div class="stat-value">${totals?.ok_items || 0}</div>
                        <div class="stat-label">✅ En stock</div>
                    </div>
                    <div class="stat-card stat-warning">
                        <div class="stat-value">${totals?.alert_items || 0}</div>
                        <div class="stat-label">⚠️ En alerte</div>
                    </div>
                    <div class="stat-card stat-danger">
                        <div class="stat-value">${totals?.out_of_stock || 0}</div>
                        <div class="stat-label">❌ Rupture</div>
                    </div>
                    <div class="stat-card stat-info">
                        <div class="stat-value">${this.formatNumber(totals?.total_stock || 0)}</div>
                        <div class="stat-label">📦 Stock total</div>
                    </div>
                </div>

                <!-- Tableau inventaire -->
                <div class="inventory-table-container">
                    <table class="inventory-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Nom</th>
                                <th>Catégorie</th>
                                <th>Site</th>
                                <th>Stock</th>
                                <th>Seuil</th>
                                <th>Statut</th>
                                <th>Valeur</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${inventory.length > 0 ? 
                                inventory.map(item => this.renderInventoryRow(item)).join('') :
                                this.renderInventoryEmptyState()
                            }
                        </tbody>
                    </table>
                </div>

                <!-- Actions globales -->
                <div class="inventory-actions">
                    <button onclick="historyService.exportInventory()" class="btn btn-secondary">
                        📄 Exporter CSV
                    </button>
                    <button onclick="historyService.exportInventoryPDF()" class="btn btn-primary">
                        📊 Exporter PDF
                    </button>
                    <button onclick="historyService.compareWithToday()" class="btn btn-outline">
                        🔄 Comparer avec aujourd'hui
                    </button>
                </div>
            </div>
        `;
    }

    renderInventoryFilters() {
        const sitesOptions = this.sites.map(site => 
            `<option value="${site.id}" ${this.inventoryFilters.site_id == site.id ? 'selected' : ''}>${site.name}</option>`
        ).join('');

        const categoriesOptions = this.categories.map(cat => 
            `<option value="${cat.id}" ${this.inventoryFilters.category_id == cat.id ? 'selected' : ''}>${cat.name}</option>`
        ).join('');

        return `
            <div class="inventory-filters">
                <div class="filter-group">
                    <label for="inventory-date">Date</label>
                    <input type="date" id="inventory-date" value="${this.inventoryFilters.date}" 
                           class="form-control" list="available-dates">
                    <datalist id="available-dates">
                        ${this.availableDates.map(date => `<option value="${date}">`).join('')}
                    </datalist>
                </div>
                <div class="filter-group">
                    <label for="inventory-site">Site</label>
                    <select id="inventory-site" class="form-select">
                        <option value="">Tous les sites</option>
                        ${sitesOptions}
                    </select>
                </div>
                <div class="filter-group">
                    <label for="inventory-category">Catégorie</label>
                    <select id="inventory-category" class="form-select">
                        <option value="">Toutes les catégories</option>
                        ${categoriesOptions}
                    </select>
                </div>
                <div class="filter-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="low-stock-only" ${this.inventoryFilters.low_stock_only ? 'checked' : ''}>
                        Afficher seulement les alertes
                    </label>
                </div>
                <button onclick="historyService.applyInventoryFilters()" class="btn btn-primary">
                    🔍 Appliquer
                </button>
            </div>
        `;
    }

    renderInventoryRow(item) {
        const statusClass = this.getStatusClass(item.status);
        const statusIcon = this.getStatusIcon(item.status);
        
        return `
            <tr class="inventory-row ${statusClass}">
                <td class="code-cell">
                    <span class="article-code">${item.code}</span>
                </td>
                <td class="name-cell">
                    <strong>${item.name}</strong>
                </td>
                <td class="category-cell">
                    ${item.category_name || 'N/A'}
                </td>
                <td class="site-cell">
                    ${item.site_name || 'N/A'}
                </td>
                <td class="stock-cell">
                    <span class="stock-value">${this.formatNumber(item.current_stock)}</span>
                    <span class="unit">${item.unit_symbol || ''}</span>
                </td>
                <td class="threshold-cell">
                    ${this.formatNumber(item.alert_threshold)} ${item.unit_symbol || ''}
                </td>
                <td class="status-cell">
                    <span class="status-badge ${statusClass}">
                        ${statusIcon} ${item.status}
                    </span>
                </td>
                <td class="value-cell">
                    ${this.formatCurrency(item.stock_value)}
                </td>
                <td class="actions-cell">
                    <button onclick="historyService.viewArticleHistory(${item.id})" 
                            class="btn btn-sm btn-outline" title="Voir l'historique">
                        📊
                    </button>
                    <button onclick="historyService.compareArticle(${item.id})" 
                            class="btn btn-sm btn-outline" title="Comparer">
                        🔄
                    </button>
                </td>
            </tr>
        `;
    }

    renderInventoryEmptyState() {
        return `
            <tr>
                <td colspan="9" class="empty-table">
                    <div class="empty-state">
                        <div class="empty-icon">📭</div>
                        <h3>Aucun article trouvé</h3>
                        <p>Aucun article ne correspond aux critères de recherche.</p>
                        <button onclick="historyService.resetInventoryFilters()" class="btn btn-primary">
                            Voir tout l'inventaire
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // 🎯 MÉTHODES INVENTAIRE
    async applyInventoryFilters() {
        this.inventoryFilters.date = document.getElementById('inventory-date').value;
        this.inventoryFilters.site_id = document.getElementById('inventory-site').value;
        this.inventoryFilters.category_id = document.getElementById('inventory-category').value;
        this.inventoryFilters.low_stock_only = document.getElementById('low-stock-only').checked;
        
        await this.renderHistory();
    }

    resetInventoryFilters() {
        this.inventoryFilters = {
            date: new Date().toISOString().split('T')[0],
            site_id: '',
            category_id: '',
            low_stock_only: false
        };
        this.renderHistory();
    }

    // 📄 MÉTHODES D'EXPORT CORRIGÉES
    async exportInventory() {
        try {
            console.log('📄 Début export CSV inventaire...');
            
            const params = new URLSearchParams(this.inventoryFilters);
            const url = `${ApiService.baseURL}/history/inventory/export/csv?${params}`;
            console.log('🔗 URL export CSV:', url);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `inventaire_${this.inventoryFilters.date || new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('📄 Export CSV généré avec succès', 'success');
            
        } catch (error) {
            console.error('❌ Erreur export CSV:', error);
            this.showNotification('❌ Erreur lors de l\'export CSV: ' + error.message, 'error');
        }
    }

    async exportInventoryPDF() {
        try {
            console.log('📄 Début export PDF inventaire...');
            
            const params = new URLSearchParams(this.inventoryFilters);
            const url = `${ApiService.baseURL}/history/inventory/export/pdf?${params}`;
            
            console.log('🔗 URL export PDF:', url);
            
            window.open(url, '_blank');
            
            this.showNotification('📊 Export PDF généré avec succès', 'success');
            
        } catch (error) {
            console.error('❌ Erreur export PDF:', error);
            this.showNotification('❌ Erreur lors de l\'export PDF: ' + error.message, 'error');
        }
    }

    async exportHistory() {
        try {
            console.log('📄 Début export historique activités...');
            
            const params = new URLSearchParams(this.currentFilters);
            const url = `${ApiService.baseURL}/history/export/csv?${params}`;
            
            console.log('🔗 URL export historique:', url);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `historique_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification('📄 Export historique CSV généré avec succès', 'success');
            
        } catch (error) {
            console.error('❌ Erreur export historique:', error);
            this.showNotification('❌ Erreur lors de l\'export historique: ' + error.message, 'error');
        }
    }

    // MÉTHODES EXISTANTES
    attachEvents() {
        const searchInput = document.getElementById('history-search');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.currentFilters.search = searchInput.value;
                this.currentFilters.page = 1;
                this.renderHistory();
            }, 500));
        }

        console.log('✅ Événements historiques attachés');
    }

    applyFilters() {
        this.currentFilters.start_date = document.getElementById('filter-start-date').value;
        this.currentFilters.end_date = document.getElementById('filter-end-date').value;
        this.currentFilters.entity = document.getElementById('history-entity').value;
        this.currentFilters.action = document.getElementById('history-action').value;
        this.currentFilters.page = 1;
        this.renderHistory();
    }

    resetFilters() {
        this.currentFilters = {
            page: 1,
            limit: 50,
            entity: '',
            action: '',
            start_date: this.getDefaultStartDate(),
            end_date: this.getDefaultEndDate(),
            search: ''
        };
        this.renderHistory();
    }

    nextPage() {
        this.currentFilters.page++;
        this.renderHistory();
    }

    previousPage() {
        if (this.currentFilters.page > 1) {
            this.currentFilters.page--;
            this.renderHistory();
        }
    }

    async viewArticleHistory(articleId) {
        try {
            const response = await ApiService.request(`/history/articles/${articleId}/history?limit=20`);
            if (response.success) {
                this.showArticleHistoryModal(response.data);
            }
        } catch (error) {
            console.error('❌ Erreur chargement historique article:', error);
            this.showNotification('Erreur lors du chargement de l\'historique', 'error');
        }
    }

    showArticleHistoryModal(data) {
        const modalContent = `
            <div class="modal-header">
                <h3>📊 Historique: ${data.article.name} (${data.article.code})</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="article-history">
                    ${data.history.map(entry => this.renderArticleHistoryEntry(entry)).join('')}
                </div>
            </div>
        `;
        
        this.showModal('Historique Article', modalContent);
    }

    renderArticleHistoryEntry(entry) {
        const formattedDate = new Date(entry.created_at).toLocaleString('fr-FR');
        
        return `
            <div class="article-history-entry">
                <div class="entry-header">
                    <span class="entry-action">${this.getActionIcon(entry.action)} ${this.getActionText(entry.action)}</span>
                    <span class="entry-date">${formattedDate}</span>
                </div>
                <div class="entry-user">Par: ${entry.full_name || entry.username}</div>
                ${entry.details ? `<div class="entry-details">${entry.details}</div>` : ''}
                ${entry.stock_snapshot !== null ? `
                    <div class="entry-stock">
                        Stock à cette date: <strong>${entry.stock_snapshot}</strong>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async compareArticle(articleId) {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];

        try {
            const response = await ApiService.request(`/history/inventory/comparison?date1=${weekAgoStr}&date2=${today}&article_id=${articleId}`);
            if (response.success) {
                this.showComparisonModal(response.data);
            }
        } catch (error) {
            console.error('❌ Erreur comparaison article:', error);
            this.showNotification('Erreur lors de la comparaison', 'error');
        }
    }

    async compareWithToday() {
        const today = new Date().toISOString().split('T')[0];
        const selectedDate = this.inventoryFilters.date;

        if (selectedDate === today) {
            this.showNotification('Sélectionnez une date différente d\'aujourd\'hui', 'warning');
            return;
        }

        try {
            const response = await ApiService.request(`/history/inventory/comparison?date1=${selectedDate}&date2=${today}`);
            if (response.success) {
                this.showComparisonModal(response.data);
            }
        } catch (error) {
            console.error('❌ Erreur comparaison globale:', error);
            this.showNotification('Erreur lors de la comparaison', 'error');
        }
    }

    showComparisonModal(data) {
        const modalContent = `
            <div class="modal-header">
                <h3>🔄 Comparaison: ${data.date1} vs ${data.date2}</h3>
                <button class="modal-close" onclick="this.closest('.modal').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="comparison-stats">
                    <div class="stat-card">
                        <div class="stat-value">${data.statistics.increased_stock}</div>
                        <div class="stat-label">📈 Augmentations</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${data.statistics.decreased_stock}</div>
                        <div class="stat-label">📉 Diminutions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${data.statistics.unchanged_stock}</div>
                        <div class="stat-label">➡️ Inchangés</div>
                    </div>
                </div>
                <div class="comparison-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Article</th>
                                <th>Stock ${data.date1}</th>
                                <th>Stock ${data.date2}</th>
                                <th>Variation</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.comparison.map(item => `
                                <tr>
                                    <td>${item.name} (${item.code})</td>
                                    <td>${item.stock_date1}</td>
                                    <td>${item.stock_date2}</td>
                                    <td class="${item.stock_variation > 0 ? 'positive' : item.stock_variation < 0 ? 'negative' : ''}">
                                        ${item.stock_variation > 0 ? '+' : ''}${item.stock_variation}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        this.showModal('Comparaison d\'inventaire', modalContent);
    }

    // 🛠️ UTILITAIRES
    getStatusClass(status) {
        const classes = {
            'OK': 'status-ok',
            'ALERTE': 'status-warning',
            'RUPTURE': 'status-danger'
        };
        return classes[status] || 'status-unknown';
    }

    getStatusIcon(status) {
        const icons = {
            'OK': '✅',
            'ALERTE': '⚠️',
            'RUPTURE': '❌'
        };
        return icons[status] || '❓';
    }

    formatNumber(value) {
        return parseFloat(value).toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    formatCurrency(value) {
        return parseFloat(value).toLocaleString('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        });
    }

    getActionIcon(action) {
        const icons = {
            'CREATE': '➕',
            'UPDATE': '✏️',
            'DELETE': '🗑️',
            'VIEW': '👁️',
            'LOGIN': '🔐',
            'STOCK_IN': '📥',
            'STOCK_OUT': '📤'
        };
        return icons[action] || '📝';
    }

    getActionText(action) {
        const actions = {
            'CREATE': 'Création',
            'UPDATE': 'Modification',
            'DELETE': 'Suppression',
            'VIEW': 'Consultation',
            'LOGIN': 'Connexion',
            'STOCK_IN': 'Entrée stock',
            'STOCK_OUT': 'Sortie stock'
        };
        return actions[action] || action;
    }

    getEntityText(entity) {
        const entities = {
            'ARTICLE': 'Article',
            'USER': 'Utilisateur',
            'CATEGORY': 'Catégorie',
            'SITE': 'Site',
            'UNIT': 'Unité',
            'SYSTEM': 'Système'
        };
        return entities[entity] || entity;
    }

    getFieldName(field) {
        const fields = {
            'code': 'Code',
            'name': 'Nom',
            'description': 'Description',
            'stock': 'Stock',
            'current_stock': 'Stock actuel',
            'alert_threshold': 'Seuil d\'alerte',
            'category_id': 'Catégorie',
            'site_id': 'Site',
            'unit_id': 'Unité',
            'cost_price': 'Prix de revient',
            'department': 'Département',
            'supplier_id': 'Fournisseur',
            'order_quantity': 'Quantité commande',
            'old_stock': 'Ancien stock',
            'new_stock': 'Nouveau stock',
            'quantity_change': 'Variation'
        };
        return fields[field] || field;
    }

    formatValue(value) {
        if (value === null || value === undefined) return 'Non défini';
        if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
        if (typeof value === 'number') return value.toString();
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    }

    // Dans frontend/js/history.js - CORRECTION DES MODALS

// Utilitaires d'interface CORRIGÉS
showModal(title, content, modalClass = 'history-modal') {
    // Fermer les modals existants
    this.closeAllModals();
    
    const modal = document.createElement('div');
    modal.className = `modal ${modalClass}`;
    modal.innerHTML = `
        <div class="modal-overlay" onclick="historyService.closeModal(this)"></div>
        <div class="modal-dialog">
            <div class="modal-content">
                ${content}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Empêcher la propagation des événements
    const modalContent = modal.querySelector('.modal-content');
    modalContent.addEventListener('click', (e) => {
        e.stopPropagation();
    });
}

closeModal(overlay) {
    const modal = overlay.closest('.modal');
    if (modal) {
        modal.remove();
    }
}

closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.remove());
}

// 🆕 MÉTHODE SPÉCIFIQUE POUR LES MODALS DE DÉTAILS
showEntryDetailsModal(entry) {
    const formattedDate = new Date(entry.created_at).toLocaleString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const modalContent = `
        <div class="modal-header">
            <h3>📋 Détails de l'activité</h3>
            <button class="modal-close" onclick="historyService.closeModal(this.closest('.modal-overlay'))">×</button>
        </div>
        <div class="modal-body">
            <div class="detail-section">
                <h4>Informations générales</h4>
                <div class="detail-grid">
                    <div class="detail-item">
                        <label>Description:</label>
                        <span>${entry.description}</span>
                    </div>
                    <div class="detail-item">
                        <label>Date et heure:</label>
                        <span>${formattedDate}</span>
                    </div>
                    <div class="detail-item">
                        <label>Utilisateur:</label>
                        <span>${entry.full_name || entry.username || 'N/A'}</span>
                    </div>
                    <div class="detail-item">
                        <label>Entité:</label>
                        <span class="badge badge-entity">${this.getEntityText(entry.entity)}</span>
                    </div>
                    <div class="detail-item">
                        <label>Action:</label>
                        <span class="badge badge-action badge-${entry.action.toLowerCase()}">
                            ${this.getActionText(entry.action)}
                        </span>
                    </div>
                    ${entry.entity_id ? `
                    <div class="detail-item">
                        <label>ID Entité:</label>
                        <span>${entry.entity_id}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            ${this.renderChanges(entry.changes, true)}
            
            <div class="modal-actions">
                <button onclick="historyService.confirmDeleteEntry(${entry.id})" class="btn btn-danger">
                    🗑️ Supprimer cette entrée
                </button>
                <button onclick="historyService.closeModal(this.closest('.modal-overlay'))" class="btn btn-secondary">
                    Fermer
                </button>
            </div>
        </div>
    `;
    
    this.showModal('Détails de l\'activité', modalContent, 'history-modal details-modal');
}

// 🆕 MÉTHODE POUR LES MODALS DE COMPARAISON
showComparisonModal(data) {
    const modalContent = `
        <div class="modal-header">
            <h3>🔄 Comparaison: ${data.date1} vs ${data.date2}</h3>
            <button class="modal-close" onclick="historyService.closeModal(this.closest('.modal-overlay'))">×</button>
        </div>
        <div class="modal-body">
            <div class="comparison-stats">
                <div class="stat-card">
                    <div class="stat-value">${data.statistics.increased_stock}</div>
                    <div class="stat-label">📈 Augmentations</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.statistics.decreased_stock}</div>
                    <div class="stat-label">📉 Diminutions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${data.statistics.unchanged_stock}</div>
                    <div class="stat-label">➡️ Inchangés</div>
                </div>
            </div>
            <div class="comparison-table">
                <table>
                    <thead>
                        <tr>
                            <th>Article</th>
                            <th>Stock ${data.date1}</th>
                            <th>Stock ${data.date2}</th>
                            <th>Variation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.comparison.map(item => `
                            <tr>
                                <td>${item.name} (${item.code})</td>
                                <td>${item.stock_date1}</td>
                                <td>${item.stock_date2}</td>
                                <td class="${item.stock_variation > 0 ? 'positive' : item.stock_variation < 0 ? 'negative' : ''}">
                                    ${item.stock_variation > 0 ? '+' : ''}${item.stock_variation}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="modal-actions">
                <button onclick="historyService.closeModal(this.closest('.modal-overlay'))" class="btn btn-primary">
                    Fermer
                </button>
            </div>
        </div>
    `;
    
    this.showModal('Comparaison d\'inventaire', modalContent, 'history-modal comparison-modal');
}
    // Utilitaires d'interface
    showModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.closest('.modal').remove()"></div>
            <div class="modal-dialog">
                <div class="modal-content">
                    ${content}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Instance globale
console.log('🚀 HistoryService complet chargé !');
const historyService = new HistoryService();

// Initialiser au chargement de la page
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('history-content')) {
        console.log('🎯 Initialisation HistoryService...');
        historyService.init();
    }
});