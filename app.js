// Application d'inventaire Swis Madagascar
class InventoryApp {
    constructor() {
        this.currentTab = 'dashboard';
        this.inventoryItems = [];
        this.sites = [];
        this.suppliers = [];
        this.filteredItems = [];
        this.currentPage = 1;
        this.itemsPerPage = 15;
        this.selectedItems = new Set();
        this.charts = {};
        
        this.init();
    }

    async init() {
        // Attendre que la base de données soit initialisée
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await this.loadData();
        this.setupEventListeners();
        this.renderDashboard();
        this.populateSelects();
        this.showToast('Système d\'inventaire Swis Madagascar initialisé', 'success');
    }

    async loadData() {
        try {
            this.inventoryItems = inventoryDB.getAllArticles();
            this.sites = inventoryDB.getAllSites();
            this.suppliers = inventoryDB.getAllSuppliers();
            this.filteredItems = [...this.inventoryItems];
            
            this.updateStats();
            this.renderInventoryTable();
        } catch (error) {
            console.error('Erreur chargement données:', error);
            this.showToast('Erreur lors du chargement des données', 'error');
        }
    }

    populateSelects() {
        // Peupler les filtres de catégorie
        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            const categories = inventoryDB.getCategories();
            categoryFilter.innerHTML = `
                <option value="">Toutes les catégories</option>
                ${categories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
            `;
        }

        // Peupler les filtres de site
        const siteFilter = document.getElementById('site-filter');
        if (siteFilter) {
            siteFilter.innerHTML = `
                <option value="">Tous les sites</option>
                ${this.sites.map(site => `<option value="${site.name}">${site.name}</option>`).join('')}
            `;
        }

        // Peupler le formulaire d'article
        const articleSite = document.getElementById('article-site');
        if (articleSite) {
            articleSite.innerHTML = `
                <option value="">Sélectionner un site</option>
                ${this.sites.map(site => `<option value="${site.name}">${site.name}</option>`).join('')}
            `;
        }

        const articleSupplier = document.getElementById('article-supplier');
        if (articleSupplier) {
            articleSupplier.innerHTML = `
                <option value="">Sélectionner un fournisseur</option>
                ${this.suppliers.map(supp => `<option value="${supp.name}">${supp.name}</option>`).join('')}
            `;
        }
    }

    setupEventListeners() {
        // Navigation par onglets
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Recherche et filtres
        document.getElementById('search').addEventListener('input', (e) => {
            this.filterItems();
        });

        ['category-filter', 'site-filter', 'status-filter'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    this.filterItems();
                });
            }
        });

        // Pagination
        document.getElementById('prev-page').addEventListener('click', () => {
            this.previousPage();
        });

        document.getElementById('next-page').addEventListener('click', () => {
            this.nextPage();
        });

        // Sélection multiple
        const selectAll = document.getElementById('select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                this.toggleSelectAll(e.target.checked);
            });
        }

        // Formulaire article
        const articleForm = document.getElementById('article-form');
        if (articleForm) {
            articleForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveArticle();
            });
        }

        // Génération automatique de code
        const articleName = document.getElementById('article-name');
        if (articleName) {
            articleName.addEventListener('blur', (e) => {
                this.generateArticleCode(e.target.value);
            });
        }
    }

    generateArticleCode(name) {
        if (!name) return;
        
        const codeInput = document.getElementById('article-code');
        if (codeInput && !codeInput.value) {
            // Générer un code basé sur le nom (3 premières lettres + timestamp)
            const prefix = name.substring(0, 3).toUpperCase();
            const timestamp = Date.now().toString().slice(-4);
            codeInput.value = `${prefix}${timestamp}`;
        }
    }

    switchTab(tabName) {
        this.currentTab = tabName;
        
        // Mettre à jour la navigation
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Afficher le contenu
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Actions spécifiques à chaque onglet
        switch(tabName) {
            case 'dashboard':
                this.renderDashboard();
                break;
            case 'inventory':
                this.renderInventoryTable();
                break;
            case 'commands':
                this.renderCommandList();
                break;
        }
    }

    updateStats() {
        const stats = inventoryDB.getInventoryStats();
        
        document.getElementById('total-items').textContent = stats.totalItems;
        document.getElementById('low-stock-items').textContent = stats.lowStock;
        document.getElementById('critical-items').textContent = stats.criticalStock;
        document.getElementById('pending-orders').textContent = stats.itemsToReorder;
        document.getElementById('total-value').textContent = this.formatCurrency(stats.totalValue);
    }

    renderDashboard() {
        this.updateStats();
        this.renderCategoryChart();
        this.renderAlertsChart();
        this.renderReorderList();
        this.renderRecentActivity();
    }

    renderCategoryChart() {
        const ctx = document.getElementById('categoryChart');
        if (!ctx) return;

        const categoryData = this.getCategoryDistribution();
        
        if (this.charts.categoryChart) {
            this.charts.categoryChart.destroy();
        }

        this.charts.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: categoryData.labels,
                datasets: [{
                    data: categoryData.values,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: { padding: 20 }
                    },
                    title: {
                        display: true,
                        text: 'Répartition par Catégorie',
                        font: { size: 16 }
                    }
                },
                cutout: '60%'
            }
        });
    }

    renderAlertsChart() {
        const ctx = document.getElementById('alertsChart');
        if (!ctx) return;

        const alertData = this.getAlertStatistics();
        
        if (this.charts.alertsChart) {
            this.charts.alertsChart.destroy();
        }

        this.charts.alertsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Stock Normal', 'Stock Faible', 'Stock Critique'],
                datasets: [{
                    label: 'Nombre d\'Articles',
                    data: [alertData.normal, alertData.low, alertData.critical],
                    backgroundColor: ['#27ae60', '#f39c12', '#e74c3c'],
                    borderColor: ['#219653', '#e67e22', '#c0392b'],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Alertes de Stock',
                        font: { size: 16 }
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    getCategoryDistribution() {
        const distribution = {};
        this.inventoryItems.forEach(item => {
            distribution[item.category] = (distribution[item.category] || 0) + 1;
        });

        return {
            labels: Object.keys(distribution),
            values: Object.values(distribution)
        };
    }

    getAlertStatistics() {
        let normal = 0, low = 0, critical = 0;
        
        this.inventoryItems.forEach(item => {
            if (item.current_stock === 0) {
                critical++;
            } else if (item.current_stock <= item.alert_threshold * 0.3) {
                critical++;
            } else if (item.current_stock <= item.alert_threshold) {
                low++;
            } else {
                normal++;
            }
        });

        return { normal, low, critical };
    }

    renderReorderList() {
        const reorderList = document.getElementById('reorder-list');
        if (!reorderList) return;

        const itemsToReorder = inventoryDB.getStockAlerts().slice(0, 8);

        if (itemsToReorder.length === 0) {
            reorderList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle success"></i>
                    <p>Tous les stocks sont suffisants</p>
                    <small>Aucun réapprovisionnement nécessaire</small>
                </div>
            `;
            return;
        }

        reorderList.innerHTML = itemsToReorder.map(item => {
            const status = this.getStockStatus(item);
            const statusClass = this.getStatusClass(status);
            
            return `
                <div class="reorder-item">
                    <div class="reorder-info">
                        <div class="reorder-header">
                            <strong>${item.name}</strong>
                            <span class="status-badge ${statusClass}">${this.getStatusText(status)}</span>
                        </div>
                        <div class="reorder-details">
                            <span class="site-tag site-${item.site.toLowerCase()}">${item.site}</span>
                            <span>Stock: <strong>${item.current_stock} ${item.unit}</strong></span>
                            <span>Seuil: ${item.alert_threshold} ${item.unit}</span>
                        </div>
                        <div class="reorder-supplier">
                            <small>Fournisseur: ${item.supplier || 'Non spécifié'}</small>
                        </div>
                    </div>
                    <div class="reorder-actions">
                        <button class="btn btn-primary btn-sm" onclick="app.quickOrderItem(${item.id})">
                            <i class="fas fa-cart-plus"></i>
                            Commander
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="app.adjustStock(${item.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderRecentActivity() {
        const activityFeed = document.getElementById('activity-feed');
        if (!activityFeed) return;

        // Récupérer les derniers mouvements de stock
        const movements = inventoryDB.getFromLocalStorage('stock_movements') || [];
        const recentActivities = movements
            .slice(-10)
            .reverse()
            .map(movement => this.formatActivity(movement));

        if (recentActivities.length === 0) {
            activityFeed.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>Aucune activité récente</p>
                    <small>Les actions apparaîtront ici</small>
                </div>
            `;
            return;
        }

        activityFeed.innerHTML = recentActivities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <p class="activity-text">${activity.text}</p>
                    <div class="activity-details">
                        <span class="activity-site">${activity.site}</span>
                        <span class="activity-time">${activity.time}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    formatActivity(movement) {
        const icons = {
            'creation': 'fa-box',
            'adjustment': 'fa-sliders-h',
            'incoming': 'fa-arrow-down',
            'outgoing': 'fa-arrow-up'
        };

        const types = {
            'creation': 'success',
            'adjustment': 'warning',
            'incoming': 'info',
            'outgoing': 'danger'
        };

        const texts = {
            'creation': `Article créé: ${movement.article_name}`,
            'adjustment': `Stock ajusté: ${movement.article_name} (${movement.quantity > 0 ? '+' : ''}${movement.quantity})`,
            'incoming': `Réception: ${movement.article_name} (${movement.quantity})`,
            'outgoing': `Sortie: ${movement.article_name} (${movement.quantity})`
        };

        return {
            icon: icons[movement.movement_type] || 'fa-info-circle',
            type: types[movement.movement_type] || 'info',
            text: texts[movement.movement_type] || `Mouvement: ${movement.article_name}`,
            site: movement.site,
            time: this.formatRelativeTime(movement.movement_date)
        };
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `Il y a ${diffMins} min`;
        if (diffHours < 24) return `Il y a ${diffHours} h`;
        if (diffDays < 7) return `Il y a ${diffDays} j`;
        return date.toLocaleDateString('fr-FR');
    }

    // ... (le reste des méthodes reste similaire mais adapté aux nouvelles structures de données)

    quickOrderItem(itemId) {
        const item = this.inventoryItems.find(i => i.id === itemId);
        if (item) {
            this.showToast(`Commande rapide: ${item.name}`, 'info');
            // Ouvrir le modal de commande avec l'article pré-rempli
        }
    }

    adjustStock(itemId) {
        const item = this.inventoryItems.find(i => i.id === itemId);
        if (item) {
            // Ouvrir un modal d'ajustement de stock
            const newStock = prompt(`Ajuster le stock de ${item.name} (actuel: ${item.current_stock} ${item.unit}):`, item.current_stock);
            if (newStock !== null) {
                const stockValue = parseFloat(newStock);
                if (!isNaN(stockValue)) {
                    this.updateArticle(item.id, { current_stock: stockValue });
                }
            }
        }
    }

    // Méthode utilitaire pour mettre à jour un article
    async updateArticle(id, updates) {
        try {
            inventoryDB.updateArticle(id, updates);
            this.showToast('Article mis à jour avec succès', 'success');
            await this.loadData();
        } catch (error) {
            this.showToast('Erreur lors de la mise à jour', 'error');
        }
    }
}

// Initialiser l'application
let app;

document.addEventListener('DOMContentLoaded', function() {
    app = new InventoryApp();
});

// Fonctions globales
function openArticleModal() {
    if (app) app.openArticleModal();
}

function closeArticleModal() {
    if (app) app.closeArticleModal();
}

// Rendre l'application disponible globalement
window.app = app;