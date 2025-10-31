// Application principale
class App {
    constructor() {
        this.currentUser = null;
        this.articles = [];
        this.categories = [];
        this.sites = [];
        this.units = [];
        this.categoriesList = [];
        this.sitesList = [];
        this.unitsList = [];
        this.users = [];
        this.roles = [];
        this.suppliers = [];
        this.deliveries = [];
        this.technicalSheets = [];
        this.deliveryItems = []; // Pour gérer les articles dans les livraisons

        
        this.init();
    }

    async init() {
        await this.checkAuth();
        this.setupEventListeners();
        
        if (this.currentUser) {
            await this.loadData();
            this.showMainContent();
            this.checkPermissions();
        } else {
            this.showLogin();
        }
    }

    async checkAuth() {
        const token = ApiService.token;
        const savedUser = localStorage.getItem('user');
        
        if (token && savedUser) {
            try {
                this.currentUser = JSON.parse(savedUser);
                await ApiService.getStats();
            } catch (error) {
                ApiService.setToken(null);
                localStorage.removeItem('user');
                this.currentUser = null;
            }
        }
    }

    checkPermissions() {
        if (!this.currentUser) return;
        
        const userRole = this.currentUser.role || 'user';
        const tabs = document.querySelectorAll('.tab');
        
        console.log(`🔐 Rôle utilisateur: ${userRole}`);
        
        tabs.forEach(tab => {
            const tabText = tab.textContent.toLowerCase();
            
            if (userRole === 'admin') {
                tab.style.display = 'flex';
                return;
            }
            
            if (userRole === 'user') {
                if (tabText.includes('dashboard') || tabText.includes('inventaire')) {
                    tab.style.display = 'flex';
                } else {
                    tab.style.display = 'none';
                }
                return;
            }
            
            if (userRole === 'manager') {
                if (tabText.includes('utilisateurs')) {
                    tab.style.display = 'none';
                } else {
                    tab.style.display = 'flex';
                }
                return;
            }

            if (userRole === 'reference') {
                if (tabText.includes('dashboard') || tabText.includes('références')) {
                    tab.style.display = 'flex';
                } else {
                    tab.style.display = 'none';
                }
                return;
            }

            // Pour les rôles personnalisés, utiliser les permissions stockées
            const customRole = this.roles.find(r => r.name === userRole);
            if (customRole) {
                const permissions = customRole.permissions || [];
                if (tabText.includes('dashboard')) {
                    tab.style.display = 'flex';
                } else if (tabText.includes('inventaire') && (permissions.includes('inventory-read') || permissions.includes('inventory-write'))) {
                    tab.style.display = 'flex';
                } else if (tabText.includes('utilisateurs') && permissions.includes('users')) {
                    tab.style.display = 'flex';
                } else if (tabText.includes('références') && permissions.includes('references')) {
                    tab.style.display = 'flex';
                } else {
                    tab.style.display = 'none';
                }
            }
        });

        this.showAuthorizedContent();
    }

    showAuthorizedContent() {
        if (!this.currentUser) return;
        
        const userRole = this.currentUser.role || 'user';
        const adminOnlyElements = document.querySelectorAll('[data-role="admin"]');
        const managerPlusElements = document.querySelectorAll('[data-role="manager-plus"]');
        const referenceElements = document.querySelectorAll('[data-role="reference"]');
        
        // Trouver le rôle personnalisé pour les permissions
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];

        if (userRole === 'user') {
            adminOnlyElements.forEach(el => el.style.display = 'none');
            managerPlusElements.forEach(el => el.style.display = 'none');
            referenceElements.forEach(el => el.style.display = 'none');
            
            document.querySelectorAll('#inventory .btn-primary').forEach(btn => {
                if (btn.textContent.includes('Nouvel')) {
                    btn.style.display = 'none';
                }
            });
        } else if (userRole === 'manager') {
            adminOnlyElements.forEach(el => el.style.display = 'none');
            managerPlusElements.forEach(el => el.style.display = 'block');
            referenceElements.forEach(el => el.style.display = 'none');
        } else if (userRole === 'admin') {
            adminOnlyElements.forEach(el => el.style.display = 'block');
            managerPlusElements.forEach(el => el.style.display = 'block');
            referenceElements.forEach(el => el.style.display = 'block');
        } else if (userRole === 'reference') {
            adminOnlyElements.forEach(el => el.style.display = 'none');
            managerPlusElements.forEach(el => el.style.display = 'none');
            referenceElements.forEach(el => el.style.display = 'block');
            
            document.querySelectorAll('#inventory .btn-primary').forEach(btn => {
                if (btn.textContent.includes('Nouvel')) {
                    btn.style.display = 'block';
                }
            });
        } else if (customRole) {
            // Gestion des rôles personnalisés
            adminOnlyElements.forEach(el => el.style.display = 'none');
            
            // Boutons inventaire
            if (permissions.includes('inventory-write')) {
                managerPlusElements.forEach(el => el.style.display = 'block');
                document.querySelectorAll('#inventory .btn-primary').forEach(btn => {
                    if (btn.textContent.includes('Nouvel')) {
                        btn.style.display = 'block';
                    }
                });
            } else {
                managerPlusElements.forEach(el => el.style.display = 'none');
                document.querySelectorAll('#inventory .btn-primary').forEach(btn => {
                    if (btn.textContent.includes('Nouvel')) {
                        btn.style.display = 'none';
                    }
                });
            }
            
            // Boutons références
            if (permissions.includes('references')) {
                referenceElements.forEach(el => el.style.display = 'block');
            } else {
                referenceElements.forEach(el => el.style.display = 'none');
            }
        }
    }

    async login(credentials) {
        try {
            const response = await ApiService.login(credentials);
            this.currentUser = response.user;
            
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            
            await this.loadData();
            this.showMainContent();
            this.checkPermissions();
            Utils.showMessage('Connexion réussie', 'success');
        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    logout() {
        ApiService.setToken(null);
        this.currentUser = null;
        localStorage.removeItem('user');
        this.showLogin();
    }

    showLogin() {
        document.getElementById('login-container').style.display = 'flex';
        document.getElementById('main-content').style.display = 'none';
    }

    showMainContent() {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        document.getElementById('username').textContent = this.currentUser?.username || 'Utilisateur';
    }

    async loadData() {
        try {
            const [articlesResponse, statsResponse] = await Promise.all([
                ApiService.getArticles(),
                ApiService.getStats()
            ]);

            this.articles = articlesResponse.data;
            this.stats = statsResponse.data;

            await this.loadReferences();
            await this.loadRoles();
            await this.loadUsers();

        } catch (error) {
            console.error('Erreur chargement données:', error);
            this.loadMockData();
        }
    }

    async loadReferences() {
        try {
            console.log('🔄 Chargement des références...');
            
            const [categoriesResponse, sitesResponse, unitsResponse] = await Promise.all([
                ApiService.getCategories(),
                ApiService.getSites(),
                ApiService.getUnits()
            ]);

            this.categoriesList = categoriesResponse.data || categoriesResponse;
            this.sitesList = sitesResponse.data || sitesResponse;
            this.unitsList = unitsResponse.data || unitsResponse;

            this.categories = this.categoriesList;
            this.sites = this.sitesList;
            this.units = this.unitsList;

            this.renderCategories();
            this.renderSites();
            this.renderUnits();

        } catch (error) {
            console.error('❌ Erreur chargement références:', error);
            this.loadMockReferences();
        }
    }

    // GESTION DES RÔLES
    async loadRoles() {
        try {
            // Charger depuis localStorage d'abord
            const savedRoles = localStorage.getItem('customRoles');
            if (savedRoles) {
                this.roles = JSON.parse(savedRoles);
                console.log('📋 Rôles chargés depuis localStorage:', this.roles);
            } else {
                // Rôles par défaut
                this.roles = [
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
                ];
                
                // Sauvegarder les rôles par défaut
                localStorage.setItem('customRoles', JSON.stringify(this.roles));
                console.log('📋 Rôles par défaut créés:', this.roles);
            }
        } catch (error) {
            console.error('❌ Erreur chargement rôles:', error);
            // Rôles de secours
            this.roles = [
                { id: 1, name: 'user', description: 'Utilisateur standard', permissions: ['dashboard', 'inventory-read'] },
                { id: 2, name: 'admin', description: 'Administrateur', permissions: ['dashboard', 'inventory-read', 'inventory-write', 'references', 'users', 'reports'] }
            ];
        }
        
        // Mettre à jour la liste des rôles
        this.updateUserRoleSelect();
        this.renderRoles();
    }

    updateUserRoleSelect() {
        const roleSelect = document.getElementById('user-role');
        if (!roleSelect) return;

        roleSelect.innerHTML = '<option value="">Choisir...</option>';
        
        this.roles.forEach(role => {
            const roleName = role.name.charAt(0).toUpperCase() + role.name.slice(1);
            roleSelect.innerHTML += `<option value="${role.name}">${roleName}</option>`;
        });
    }

    // AFFICHER LA LISTE DES RÔLES
    renderRoles() {
        const container = document.getElementById('roles-table');
        if (!container) {
            console.log('❌ Conteneur roles-table non trouvé');
            return;
        }

        if (!this.roles || this.roles.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="no-data">Aucun rôle</td></tr>';
            return;
        }

        console.log('📋 Rendu des rôles:', this.roles);

        container.innerHTML = this.roles.map(role => {
            const systemRoles = ['user', 'manager', 'admin', 'reference'];
            const isSystemRole = systemRoles.includes(role.name);
            const roleName = role.name.charAt(0).toUpperCase() + role.name.slice(1);
            
            const permissionsText = (role.permissions || []).map(perm => {
                const permNames = {
                    'dashboard': 'Dashboard',
                    'inventory-read': 'Inventaire (lecture)',
                    'inventory-write': 'Inventaire (écriture)',
                    'references': 'Références',
                    'users': 'Utilisateurs',
                    'reports': 'Rapports'
                };
                return permNames[perm] || perm;
            }).join(', ');

            return `
                <tr>
                    <td>${roleName}</td>
                    <td>${role.description || '-'}</td>
                    <td>${permissionsText}</td>
                    <td>${isSystemRole ? 'Système' : 'Personnalisé'}</td>
                    <td>
                        <button class="btn btn-sm" onclick="app.editRole(${role.id})" ${isSystemRole ? 'disabled' : ''}>Modifier</button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteRole(${role.id})" ${isSystemRole ? 'disabled' : ''}>Supprimer</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    showRoleModal(roleId = null) {
        if (this.currentUser?.role !== 'admin') {
            Utils.showMessage('Action réservée aux administrateurs', 'error');
            return;
        }

        const modal = document.getElementById('role-modal');
        const title = document.getElementById('role-modal-title');
        
        if (roleId) {
            title.textContent = 'Modifier le rôle';
            this.fillRoleForm(roleId);
        } else {
            title.textContent = 'Nouveau rôle';
            this.clearRoleForm();
        }
        
        modal.style.display = 'block';
    }

    closeRoleModal() {
        document.getElementById('role-modal').style.display = 'none';
    }

    clearRoleForm() {
        document.getElementById('edit-role-id').value = '';
        document.getElementById('role-name').value = '';
        document.getElementById('role-description').value = '';
        
        // Réinitialiser les permissions
        const checkboxes = document.querySelectorAll('.permissions-grid input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            if (!checkbox.disabled) {
                checkbox.checked = false;
            }
        });
        
        // Cocher la lecture inventaire par défaut
        document.getElementById('perm-inventory-read').checked = true;
    }

    fillRoleForm(roleId) {
        try {
            const role = this.roles.find(r => r.id == roleId);
            if (role) {
                console.log('📋 Remplissage du formulaire pour le rôle:', role);
                document.getElementById('edit-role-id').value = role.id;
                document.getElementById('role-name').value = role.name;
                document.getElementById('role-description').value = role.description || '';
                
                // Pré-remplir les permissions
                this.setRolePermissions(role.permissions || []);
            }
        } catch (error) {
            console.error('❌ Erreur remplissage formulaire rôle:', error);
            Utils.showMessage('Erreur chargement rôle', 'error');
        }
    }

    setRolePermissions(permissions) {
        console.log('🔧 Définition des permissions:', permissions);
        
        // Réinitialiser toutes les cases (sauf dashboard)
        const checkboxes = document.querySelectorAll('.permissions-grid input[type="checkbox"]:not([disabled])');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });

        // Cocher les cases selon les permissions
        permissions.forEach(perm => {
            const checkbox = document.getElementById(`perm-${perm}`);
            if (checkbox && !checkbox.disabled) {
                checkbox.checked = true;
                console.log(`✅ Case cochée: perm-${perm}`);
            }
        });
    }

    async saveRole(event) {
        event.preventDefault();
        console.log('💾 Sauvegarde du rôle...');

        const roleData = {
            name: document.getElementById('role-name').value.toLowerCase().replace(/\s+/g, '_'),
            description: document.getElementById('role-description').value,
            permissions: this.getSelectedPermissions()
        };

        const roleId = document.getElementById('edit-role-id').value;
        console.log('📋 Données du rôle:', roleData);
        console.log('🆔 ID du rôle:', roleId);

        try {
            if (roleId) {
                // Modification de rôle existant
                const index = this.roles.findIndex(r => r.id == roleId);
                if (index !== -1) {
                    // CONSERVER LES PERMISSIONS EXISTANTES si aucune nouvelle permission n'est sélectionnée
                    const existingRole = this.roles[index];
                    if (roleData.permissions.length === 1 && roleData.permissions[0] === 'dashboard') {
                        roleData.permissions = existingRole.permissions || ['dashboard', 'inventory-read'];
                        console.log('🔧 Permissions conservées:', roleData.permissions);
                    }
                    
                    this.roles[index] = { ...existingRole, ...roleData };
                    Utils.showMessage('Rôle modifié avec succès', 'success');
                    console.log('✅ Rôle modifié:', this.roles[index]);
                }
            } else {
                // Création nouveau rôle - s'assurer d'avoir au moins les permissions de base
                if (roleData.permissions.length === 1 && roleData.permissions[0] === 'dashboard') {
                    roleData.permissions.push('inventory-read');
                }
                
                const newRole = {
                    id: Date.now(), // ID temporaire
                    ...roleData
                };
                this.roles.push(newRole);
                Utils.showMessage('Rôle créé avec succès', 'success');
                console.log('✅ Nouveau rôle créé:', newRole);
            }

            // Sauvegarder dans localStorage
            localStorage.setItem('customRoles', JSON.stringify(this.roles));
            console.log('💾 Rôles sauvegardés dans localStorage');
            
            // Mettre à jour la liste des rôles
            this.updateUserRoleSelect();
            this.renderRoles();
            
            this.closeRoleModal();

        } catch (error) {
            console.error('❌ Erreur sauvegarde rôle:', error);
            Utils.showMessage('Erreur lors de la sauvegarde du rôle', 'error');
        }
    }

    getSelectedPermissions() {
        const permissions = [];
        const checkboxes = document.querySelectorAll('.permissions-grid input[type="checkbox"]:checked');
        
        checkboxes.forEach(checkbox => {
            // Dashboard est toujours inclus
            if (checkbox.id !== 'perm-dashboard') {
                permissions.push(checkbox.id.replace('perm-', ''));
            }
        });
        
        // Ajouter dashboard automatiquement
        permissions.push('dashboard');
        
        console.log('🔧 Permissions sélectionnées:', permissions);
        return permissions;
    }

    async deleteRole(roleId) {
        if (this.currentUser?.role !== 'admin') {
            Utils.showMessage('Action réservée aux administrateurs', 'error');
            return;
        }

        const role = this.roles.find(r => r.id == roleId);
        if (!role) {
            Utils.showMessage('Rôle non trouvé', 'error');
            return;
        }

        // Empêcher la suppression des rôles système
        const systemRoles = ['user', 'manager', 'admin', 'reference'];
        if (systemRoles.includes(role.name)) {
            Utils.showMessage('Impossible de supprimer un rôle système', 'error');
            return;
        }

        // Vérifier si des utilisateurs utilisent ce rôle
        const usersWithRole = this.users.filter(user => user.role === role.name);
        if (usersWithRole.length > 0) {
            Utils.showMessage(`Impossible de supprimer ce rôle: ${usersWithRole.length} utilisateur(s) l'utilisent`, 'error');
            return;
        }

        if (!confirm(`Êtes-vous sûr de vouloir supprimer le rôle "${role.name}" ?`)) {
            return;
        }

        try {
            // Supprimer le rôle
            this.roles = this.roles.filter(r => r.id != roleId);
            
            // Sauvegarder dans localStorage
            localStorage.setItem('customRoles', JSON.stringify(this.roles));
            
            // Mettre à jour la liste des rôles
            this.updateUserRoleSelect();
            this.renderRoles();
            
            Utils.showMessage('Rôle supprimé avec succès', 'success');
            
        } catch (error) {
            Utils.showMessage('Erreur lors de la suppression du rôle', 'error');
        }
    }

    async editRole(id) {
        console.log('✏️ Modification du rôle ID:', id);
        this.showRoleModal(id);
    }

    // GESTION DES UTILISATEURS - AVEC ONGLETS
    async loadUsers() {
        if (this.currentUser?.role !== 'admin') {
            const container = document.getElementById('users-table');
            if (container) {
                container.innerHTML = '<tr><td colspan="6" class="no-data">Accès non autorisé</td></tr>';
            }
            return;
        }

        try {
            const response = await ApiService.getUsers();
            this.users = response.data || response;
            this.renderUsers();
        } catch (error) {
            console.error('Erreur chargement utilisateurs:', error);
            Utils.showMessage('Erreur chargement utilisateurs', 'error');
        }
    }

    renderUsers() {
        const container = document.getElementById('users-table');
        if (!container) return;
        
        if (!this.users || this.users.length === 0) {
            container.innerHTML = '<tr><td colspan="6" class="no-data">Aucun utilisateur</td></tr>';
            return;
        }

        container.innerHTML = this.users.map(user => {
            const roleName = user.role.charAt(0).toUpperCase() + user.role.slice(1);
            const roleText = {
                'admin': 'Administrateur',
                'manager': 'Gestionnaire', 
                'user': 'Utilisateur',
                'reference': 'Gestionnaire Références'
            }[user.role] || roleName;

            return `
                <tr>
                    <td>${user.username}</td>
                    <td>${user.full_name || user.fullname || '-'}</td>
                    <td>${user.email || '-'}</td>
                    <td><span class="role-badge role-${user.role}">${roleText}</span></td>
                    <td>${new Date(user.created_at || user.date_creation).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm" onclick="app.editUser(${user.id})">Modifier</button>
                        <button class="btn btn-sm btn-danger" onclick="app.deleteUser(${user.id})" ${user.id === this.currentUser.id ? 'disabled' : ''}>Supprimer</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    showUserModal(userId = null) {
        if (this.currentUser?.role !== 'admin') {
            Utils.showMessage('Action réservée aux administrateurs', 'error');
            return;
        }

        const modal = document.getElementById('user-modal');
        const title = document.getElementById('user-modal-title');
        const passwordHint = document.getElementById('password-hint');
        const passwordHelp = document.getElementById('password-help');
        
        if (userId) {
            title.textContent = 'Modifier l\'utilisateur';
            passwordHint.textContent = '';
            passwordHelp.style.display = 'block';
            this.fillUserForm(userId);
        } else {
            title.textContent = 'Nouvel utilisateur';
            passwordHint.textContent = '*';
            passwordHelp.style.display = 'none';
            this.clearUserForm();
        }
        
        modal.style.display = 'block';
    }

    closeUserModal() {
        document.getElementById('user-modal').style.display = 'none';
    }

    clearUserForm() {
        document.getElementById('edit-user-id').value = '';
        document.getElementById('user-username').value = '';
        document.getElementById('user-fullname').value = '';
        document.getElementById('user-email').value = '';
        document.getElementById('user-role').value = '';
        document.getElementById('user-password').value = '';
    }

    async fillUserForm(userId) {
        try {
            const response = await ApiService.getUser(userId);
            const user = response.data || response;

            document.getElementById('edit-user-id').value = user.id;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-fullname').value = user.full_name || user.fullname || '';
            document.getElementById('user-email').value = user.email || '';
            document.getElementById('user-role').value = user.role;

        } catch (error) {
            Utils.showMessage('Erreur chargement utilisateur', 'error');
        }
    }

    async saveUser(event) {
        event.preventDefault();

        const userData = {
            username: document.getElementById('user-username').value,
            full_name: document.getElementById('user-fullname').value,
            email: document.getElementById('user-email').value,
            role: document.getElementById('user-role').value
        };

        const password = document.getElementById('user-password').value;
        if (password) {
            userData.password = password;
        }

        const userId = document.getElementById('edit-user-id').value;

        try {
            if (userId) {
                await ApiService.updateUser(userId, userData);
                Utils.showMessage('Utilisateur modifié avec succès', 'success');
            } else {
                await ApiService.createUser(userData);
                Utils.showMessage('Utilisateur créé avec succès', 'success');
            }

            await this.loadUsers();
            this.closeUserModal();

        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    async editUser(id) {
        this.showUserModal(id);
    }

    async deleteUser(id) {
        if (this.currentUser?.role !== 'admin') {
            Utils.showMessage('Action réservée aux administrateurs', 'error');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) {
            return;
        }

        try {
            await ApiService.deleteUser(id);
            Utils.showMessage('Utilisateur supprimé avec succès', 'success');
            await this.loadUsers();
        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    // MÉTHODES POUR LES RÉFÉRENCES (CATÉGORIES, SITES, UNITÉS)
    renderCategories() {
        const container = document.getElementById('categories-table');
        if (!container) {
            console.log('❌ Conteneur categories-table non trouvé');
            return;
        }
        
        if (!this.categoriesList || this.categoriesList.length === 0) {
            container.innerHTML = '<tr><td colspan="3" class="no-data">Aucune catégorie</td></tr>';
            return;
        }

        console.log('📋 Rendu des catégories:', this.categoriesList);

        container.innerHTML = this.categoriesList.map(category => {
            const userRole = this.currentUser?.role || 'user';
            const customRole = this.roles.find(r => r.name === userRole);
            const permissions = customRole ? customRole.permissions : [];
            const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

            const actionButtons = !canEdit ? 
                '<td><em>Lecture seule</em></td>' :
                `
                <td>
                    <button class="btn btn-sm" onclick="app.editCategory(${category.id})">Modifier</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteCategory(${category.id})">Supprimer</button>
                </td>
                `;

            return `
                <tr>
                    <td>${category.name}</td>
                    <td>${category.description || '-'}</td>
                    ${actionButtons}
                </tr>
            `;
        }).join('');
    }

    renderSites() {
        const container = document.getElementById('sites-table');
        if (!container) {
            console.log('❌ Conteneur sites-table non trouvé');
            return;
        }
        
        if (!this.sitesList || this.sitesList.length === 0) {
            container.innerHTML = '<tr><td colspan="3" class="no-data">Aucun site</td></tr>';
            return;
        }

        console.log('🏢 Rendu des sites:', this.sitesList);

        container.innerHTML = this.sitesList.map(site => {
            const userRole = this.currentUser?.role || 'user';
            const customRole = this.roles.find(r => r.name === userRole);
            const permissions = customRole ? customRole.permissions : [];
            const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

            const actionButtons = !canEdit ? 
                '<td><em>Lecture seule</em></td>' :
                `
                <td>
                    <button class="btn btn-sm" onclick="app.editSite(${site.id})">Modifier</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteSite(${site.id})">Supprimer</button>
                </td>
                `;

            return `
                <tr>
                    <td>${site.name}</td>
                    <td>${site.address || '-'}</td>
                    ${actionButtons}
                </tr>
            `;
        }).join('');
    }

    renderUnits() {
        const container = document.getElementById('units-table');
        if (!container) {
            console.log('❌ Conteneur units-table non trouvé');
            return;
        }
        
        if (!this.unitsList || this.unitsList.length === 0) {
            container.innerHTML = '<tr><td colspan="3" class="no-data">Aucune unité</td></tr>';
            return;
        }

        console.log('📏 Rendu des unités:', this.unitsList);

        container.innerHTML = this.unitsList.map(unit => {
            const userRole = this.currentUser?.role || 'user';
            const customRole = this.roles.find(r => r.name === userRole);
            const permissions = customRole ? customRole.permissions : [];
            const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

            const actionButtons = !canEdit ? 
                '<td><em>Lecture seule</em></td>' :
                `
                <td>
                    <button class="btn btn-sm" onclick="app.editUnit(${unit.id})">Modifier</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteUnit(${unit.id})">Supprimer</button>
                </td>
                `;

            return `
                <tr>
                    <td>${unit.name}</td>
                    <td>${unit.symbol}</td>
                    ${actionButtons}
                </tr>
            `;
        }).join('');
    }

    // MÉTHODES POUR LES CATÉGORIES
    showCategoryModal(categoryId = null) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const modal = document.getElementById('category-modal');
        const title = document.getElementById('category-modal-title');
        
        if (categoryId) {
            title.textContent = 'Modifier la catégorie';
            this.fillCategoryForm(categoryId);
        } else {
            title.textContent = 'Nouvelle catégorie';
            this.clearCategoryForm();
        }
        
        modal.style.display = 'block';
    }

    closeCategoryModal() {
        document.getElementById('category-modal').style.display = 'none';
    }

    clearCategoryForm() {
        document.getElementById('edit-category-id').value = '';
        document.getElementById('category-name').value = '';
        document.getElementById('category-description').value = '';
    }

    async fillCategoryForm(categoryId) {
        try {
            const category = this.categoriesList.find(cat => cat.id === categoryId);
            if (category) {
                document.getElementById('edit-category-id').value = category.id;
                document.getElementById('category-name').value = category.name;
                document.getElementById('category-description').value = category.description || '';
            }
        } catch (error) {
            Utils.showMessage('Erreur chargement catégorie', 'error');
        }
    }

    async saveCategory(event) {
        event.preventDefault();

        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const categoryData = {
            name: document.getElementById('category-name').value,
            description: document.getElementById('category-description').value
        };

        const categoryId = document.getElementById('edit-category-id').value;

        try {
            if (categoryId) {
                await ApiService.updateCategory(categoryId, categoryData);
                Utils.showMessage('Catégorie modifiée avec succès', 'success');
            } else {
                await ApiService.createCategory(categoryData);
                Utils.showMessage('Catégorie créée avec succès', 'success');
            }

            await this.loadReferences();
            this.closeCategoryModal();

        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    // MÉTHODES CORRIGÉES POUR LES CATÉGORIES
    async editCategory(id) {
        console.log('✏️ Modification catégorie ID:', id);
        this.showCategoryModal(id);
    }

    async deleteCategory(id) {
    const userRole = this.currentUser?.role || 'user';
    const customRole = this.roles.find(r => r.name === userRole);
    const permissions = customRole ? customRole.permissions : [];
    const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

    if (!canEdit) {
        Utils.showMessage('Action non autorisée', 'error');
        return;
    }

    // Vérifier si la catégorie est utilisée par des articles
    try {
        const articlesResponse = await ApiService.getArticles();
        const articles = articlesResponse.data || articlesResponse;
        const articlesUsingCategory = articles.filter(article => article.category_id == id);
        
        if (articlesUsingCategory.length > 0) {
            Utils.showMessage(
                `Impossible de supprimer cette catégorie : elle est utilisée par ${articlesUsingCategory.length} article(s). ` +
                'Veuillez d\'abord modifier ou supprimer ces articles.', 
                'error'
            );
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer cette catégorie ?')) {
            return;
        }

        await ApiService.deleteCategory(id);
        Utils.showMessage('Catégorie supprimée avec succès', 'success');
        await this.loadReferences();
        
    } catch (error) {
        console.error('❌ Erreur suppression catégorie:', error);
        
        if (error.message.includes('catégorie utilisée') || error.message.includes('utilisée par des articles')) {
            Utils.showMessage(
                'Impossible de supprimer cette catégorie : elle est utilisée par des articles. ' +
                'Veuillez d\'abord modifier ou supprimer ces articles.', 
                'error'
            );
        } else {
            Utils.showMessage(error.message, 'error');
        }
    }
}

    // MÉTHODES POUR LES SITES
    showSiteModal(siteId = null) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const modal = document.getElementById('site-modal');
        const title = document.getElementById('site-modal-title');
        
        if (siteId) {
            title.textContent = 'Modifier le site';
            this.fillSiteForm(siteId);
        } else {
            title.textContent = 'Nouveau site';
            this.clearSiteForm();
        }
        
        modal.style.display = 'block';
    }

    closeSiteModal() {
        document.getElementById('site-modal').style.display = 'none';
    }

    clearSiteForm() {
        document.getElementById('edit-site-id').value = '';
        document.getElementById('site-name').value = '';
        document.getElementById('site-address').value = '';
    }

    async fillSiteForm(siteId) {
        try {
            const site = this.sitesList.find(s => s.id === siteId);
            if (site) {
                document.getElementById('edit-site-id').value = site.id;
                document.getElementById('site-name').value = site.name;
                document.getElementById('site-address').value = site.address || '';
            }
        } catch (error) {
            Utils.showMessage('Erreur chargement site', 'error');
        }
    }

    async saveSite(event) {
        event.preventDefault();

        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const siteData = {
            name: document.getElementById('site-name').value,
            address: document.getElementById('site-address').value
        };

        const siteId = document.getElementById('edit-site-id').value;

        try {
            if (siteId) {
                await ApiService.updateSite(siteId, siteData);
                Utils.showMessage('Site modifié avec succès', 'success');
            } else {
                await ApiService.createSite(siteData);
                Utils.showMessage('Site créé avec succès', 'success');
            }

            await this.loadReferences();
            this.closeSiteModal();

        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    // MÉTHODES CORRIGÉES POUR LES SITES
    async editSite(id) {
        console.log('✏️ Modification site ID:', id);
        this.showSiteModal(id);
    }

    async deleteSite(id) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer ce site ?')) {
            return;
        }

        try {
            await ApiService.deleteSite(id);
            Utils.showMessage('Site supprimé avec succès', 'success');
            await this.loadReferences();
        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    // MÉTHODES POUR LES UNITÉS
    showUnitModal(unitId = null) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const modal = document.getElementById('unit-modal');
        const title = document.getElementById('unit-modal-title');
        
        if (unitId) {
            title.textContent = 'Modifier l\'unité';
            this.fillUnitForm(unitId);
        } else {
            title.textContent = 'Nouvelle unité';
            this.clearUnitForm();
        }
        
        modal.style.display = 'block';
    }

    closeUnitModal() {
        document.getElementById('unit-modal').style.display = 'none';
    }

    clearUnitForm() {
        document.getElementById('edit-unit-id').value = '';
        document.getElementById('unit-name').value = '';
        document.getElementById('unit-symbol').value = '';
    }

    async fillUnitForm(unitId) {
        try {
            const unit = this.unitsList.find(u => u.id === unitId);
            if (unit) {
                document.getElementById('edit-unit-id').value = unit.id;
                document.getElementById('unit-name').value = unit.name;
                document.getElementById('unit-symbol').value = unit.symbol;
            }
        } catch (error) {
            Utils.showMessage('Erreur chargement unité', 'error');
        }
    }

    async saveUnit(event) {
        event.preventDefault();

        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const unitData = {
            name: document.getElementById('unit-name').value,
            symbol: document.getElementById('unit-symbol').value
        };

        const unitId = document.getElementById('edit-unit-id').value;

        try {
            if (unitId) {
                await ApiService.updateUnit(unitId, unitData);
                Utils.showMessage('Unité modifiée avec succès', 'success');
            } else {
                await ApiService.createUnit(unitData);
                Utils.showMessage('Unité créée avec succès', 'success');
            }

            await this.loadReferences();
            this.closeUnitModal();

        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    // MÉTHODES CORRIGÉES POUR LES UNITÉS
    async editUnit(id) {
        console.log('✏️ Modification unité ID:', id);
        this.showUnitModal(id);
    }

    async deleteUnit(id) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer cette unité ?')) {
            return;
        }

        try {
            await ApiService.deleteUnit(id);
            Utils.showMessage('Unité supprimée avec succès', 'success');
            await this.loadReferences();
        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    // MÉTHODES POUR LES ARTICLES
    loadDashboard() {
        if (!this.stats) return;

        const { stats, categories, alerts } = this.stats;

        document.getElementById('total-items').textContent = stats.total_items;
        document.getElementById('low-stock-items').textContent = stats.low_stock_items;
        document.getElementById('critical-items').textContent = stats.out_of_stock_items;
        document.getElementById('total-value').textContent = Utils.formatCurrency(stats.total_value);

        this.renderAlerts(alerts);
        this.renderArticles();
    }

    renderAlerts(alerts) {
        const container = document.getElementById('alerts-list');
        if (!container) return;
        
        if (!alerts || alerts.length === 0) {
            container.innerHTML = '<p class="no-data">Aucune alerte de stock</p>';
            return;
        }

        container.innerHTML = alerts.map(alert => {
            const status = Utils.getStockStatus(alert.current_stock, alert.alert_threshold);
            return `
                <div class="alert-item ${status}">
                    <strong>${alert.name}</strong>
                    <div>${alert.site_name} • Stock: ${alert.current_stock} ${alert.unit_symbol}</div>
                    <small>Seuil: ${alert.alert_threshold} ${alert.unit_symbol}</small>
                </div>
            `;
        }).join('');
    }

    renderArticles() {
        const container = document.getElementById('articles-table');
        if (!container) return;
        
        if (!this.articles || this.articles.length === 0) {
            container.innerHTML = '<tr><td colspan="8" class="no-data">Aucun article</td></tr>';
            return;
        }

        container.innerHTML = this.articles.map(article => {
            const category = this.categories?.find(cat => cat.id === article.category_id) || 
                            this.categoriesList?.find(cat => cat.id === article.category_id) || 
                            { name: 'Catégorie inconnue' };
            
            const site = this.sites?.find(s => s.id === article.site_id) || 
                        this.sitesList?.find(s => s.id === article.site_id) || 
                        { name: 'Site inconnu' };
            
            const unit = this.units?.find(u => u.id === article.unit_id) || 
                        this.unitsList?.find(u => u.id === article.unit_id) || 
                        { symbol: 'N/A' };

            const status = Utils.getStockStatus(article.current_stock, article.alert_threshold);
            const statusClass = `status-${status}`;
            const statusText = status === 'ok' ? 'OK' : status === 'warning' ? 'FAIBLE' : 'CRITIQUE';

            const userRole = this.currentUser?.role || 'user';
            const customRole = this.roles.find(r => r.name === userRole);
            const permissions = customRole ? customRole.permissions : [];
            const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('inventory-write');

            const actionButtons = !canEdit ? 
                '<td><em>Lecture seule</em></td>' :
                `
                <td>
                    <button class="btn btn-sm" onclick="app.editArticle(${article.id})">Modifier</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteArticle(${article.id})">Supprimer</button>
                </td>
                `;

            return `
                <tr>
                    <td>${article.code || 'N/A'}</td>
                    <td>${article.name}</td>
                    <td>${category.name}</td>
                    <td>${site.name}</td>
                    <td>${Utils.formatNumber(article.current_stock)} ${unit.symbol}</td>
                    <td>${Utils.formatNumber(article.alert_threshold)} ${unit.symbol}</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    ${actionButtons}
                </tr>
            `;
        }).join('');
    }

    async saveArticle(event) {
    event.preventDefault();

    const articleData = {
        code: document.getElementById('article-code').value.trim(),
        name: document.getElementById('article-name').value.trim(),
        category_id: parseInt(document.getElementById('article-category').value),
        site_id: parseInt(document.getElementById('article-site').value),
        unit_id: parseInt(document.getElementById('article-unit').value),
        current_stock: parseFloat(document.getElementById('article-stock').value) || 0,
        alert_threshold: parseFloat(document.getElementById('article-seuil').value) || 0,
        order_quantity: 10,
        cost_price: 0
    };

    // Validation du code
    if (!articleData.code) {
        Utils.showMessage('Le code est obligatoire', 'error');
        return;
    }

    const articleId = document.getElementById('edit-id').value;

    try {
        if (articleId) {
            await ApiService.updateArticle(articleId, articleData);
            Utils.showMessage('Article modifié avec succès', 'success');
        } else {
            await ApiService.createArticle(articleData);
            Utils.showMessage('Article créé avec succès', 'success');
        }

        await this.loadData();
        this.renderArticles();
        this.closeArticleModal();

    } catch (error) {
        console.error('Erreur sauvegarde article:', error);
        
        if (error.message.includes('DUPLICATE_CODE') || error.message.includes('existe déjà')) {
            Utils.showMessage(`Erreur : ${error.message}`, 'error');
        } else {
            Utils.showMessage(error.message || 'Erreur lors de la sauvegarde', 'error');
        }
    }
}

    showArticleModal(articleId = null) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('inventory-write');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const modal = document.getElementById('article-modal');
        const title = document.getElementById('modal-title');
        
        if (articleId) {
            title.textContent = 'Modifier l\'article';
            this.fillArticleForm(articleId);
        } else {
            title.textContent = 'Nouvel article';
            this.clearArticleForm();
        }
        
        this.populateSelects();
        modal.style.display = 'block';
    }

    closeArticleModal() {
        document.getElementById('article-modal').style.display = 'none';
    }

    populateSelects() {
        const categorySelect = document.getElementById('article-category');
        const siteSelect = document.getElementById('article-site');
        const unitSelect = document.getElementById('article-unit');

        if (categorySelect) {
            categorySelect.innerHTML = '<option value="">Choisir une catégorie...</option>';
            this.categories.forEach(category => {
                categorySelect.innerHTML += `<option value="${category.id}">${category.name}</option>`;
            });
        }

        if (siteSelect) {
            siteSelect.innerHTML = '<option value="">Choisir un site...</option>';
            this.sites.forEach(site => {
                siteSelect.innerHTML += `<option value="${site.id}">${site.name}</option>`;
            });
        }

        if (unitSelect) {
            unitSelect.innerHTML = '<option value="">Choisir une unité...</option>';
            this.units.forEach(unit => {
                unitSelect.innerHTML += `<option value="${unit.id}">${unit.name} (${unit.symbol})</option>`;
            });
        }
    }

    clearArticleForm() {
        document.getElementById('edit-id').value = '';
        document.getElementById('article-code').value = '';
        document.getElementById('article-name').value = '';
        document.getElementById('article-category').value = '';
        document.getElementById('article-site').value = '';
        document.getElementById('article-unit').value = '';
        document.getElementById('article-stock').value = '';
        document.getElementById('article-seuil').value = '';
    }
    // Dans la classe App - AJOUTER cette méthode
async loadHistory() {
  try {
    console.log('🔄 Chargement de l\'historique...');
    
    // Vérifier si le conteneur existe
    const historyContainer = document.getElementById('history-content');
    if (!historyContainer) {
      console.error('❌ Conteneur historique non trouvé');
      return;
    }

    // Utiliser directement historyService
    await historyService.renderHistory();
    
  } catch (error) {
    console.error('❌ Erreur chargement historique:', error);
    const historyContainer = document.getElementById('history-content');
    if (historyContainer) {
      historyContainer.innerHTML = `
        <div class="error-message">
          <p>❌ Erreur lors du chargement de l'historique</p>
          <button onclick="historyService.renderHistory()" class="btn btn-primary">Réessayer</button>
        </div>
      `;
    }
  }
}

    async fillArticleForm(articleId) {
        try {
            const response = await ApiService.getArticle(articleId);
            const article = response.data || response;

            document.getElementById('edit-id').value = article.id;
            document.getElementById('article-code').value = article.code || '';
            document.getElementById('article-name').value = article.name;
            document.getElementById('article-category').value = article.category_id;
            document.getElementById('article-site').value = article.site_id;
            document.getElementById('article-unit').value = article.unit_id;
            document.getElementById('article-stock').value = article.current_stock;
            document.getElementById('article-seuil').value = article.alert_threshold;

        } catch (error) {
            Utils.showMessage('Erreur chargement article', 'error');
        }
    }

    async editArticle(id) {
        this.showArticleModal(id);
    }

     // AJOUTER cette méthode pour charger l'historique
  async loadHistory() {
    try {
      console.log('🔄 Chargement de l\'historique...');
      
      // Vérifier si le conteneur existe
      const historyContainer = document.getElementById('history-content');
      if (!historyContainer) {
        console.error('❌ Conteneur historique non trouvé');
        return;
      }

      // Afficher un indicateur de chargement
      historyContainer.innerHTML = `
        <div class="loading-container">
          <div class="loading-spinner"></div>
          <p>Chargement de l'historique...</p>
        </div>
      `;

      // Charger l'historique
      await historyService.renderHistory();
      
    } catch (error) {
      console.error('❌ Erreur chargement historique:', error);
      const historyContainer = document.getElementById('history-content');
      if (historyContainer) {
        historyContainer.innerHTML = `
          <div class="error-message">
            <p>❌ Erreur lors du chargement de l'historique</p>
            <button onclick="app.loadHistory()" class="btn btn-primary">Réessayer</button>
          </div>
        `;
      }
    }
  }

    async deleteArticle(id) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('inventory-write');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) {
            return;
        }

        try {
            await ApiService.deleteArticle(id);
            Utils.showMessage('Article supprimé avec succès', 'success');
            await this.loadData();
            this.renderArticles();
        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    filterArticles() {
        const searchTerm = document.getElementById('search').value.toLowerCase();
        const rows = document.querySelectorAll('#articles-table tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    setupEventListeners() {
        const searchInput = document.getElementById('search');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(() => {
                this.filterArticles();
            }, 300));
        }
    }

    loadMockData() {
        this.loadMockReferences();
        
        // Charger les rôles depuis localStorage si disponibles
        const savedRoles = localStorage.getItem('customRoles');
        if (savedRoles) {
            this.roles = JSON.parse(savedRoles);
            this.updateUserRoleSelect();
            this.renderRoles();
        }
    }

    loadMockReferences() {
        this.categoriesList = [
            { id: 1, name: 'Légumes', description: 'Produits légumiers' },
            { id: 2, name: 'Viandes', description: 'Produits carnés' },
            { id: 3, name: 'Épicerie', description: 'Produits d\'épicerie' }
        ];
        
        this.sitesList = [
            { id: 1, name: 'Bypass', address: 'Antananarivo Bypass' },
            { id: 2, name: 'Isoraka', address: 'Antananarivo Isoraka' },
            { id: 3, name: 'Ivato', address: 'Aéroport Ivato' }
        ];
        
        this.unitsList = [
            { id: 1, name: 'Kilogramme', symbol: 'kg' },
            { id: 2, name: 'Litre', symbol: 'L' },
            { id: 3, name: 'Pièce', symbol: 'pc' },
            { id: 4, name: 'Mètre', symbol: 'm' }
        ];

        this.categories = this.categoriesList;
        this.sites = this.sitesList;
        this.units = this.unitsList;

        this.renderCategories();
        this.renderSites();
        this.renderUnits();
    }
        // === FONCTIONS FOURNISSEURS ===
    async loadSuppliers() {
        try {
            const response = await ApiService.getSuppliers();
            this.suppliers = response.data || response;
            this.renderSuppliersTable();
        } catch (error) {
            console.error('Erreur chargement fournisseurs:', error);
            Utils.showMessage('Erreur lors du chargement des fournisseurs', 'error');
        }
    }

    renderSuppliersTable() {
        const container = document.getElementById('suppliers-table');
        if (!container) return;
        
        if (!this.suppliers || this.suppliers.length === 0) {
            container.innerHTML = '<tr><td colspan="7" class="no-data">Aucun fournisseur</td></tr>';
            return;
        }

        container.innerHTML = this.suppliers.map(supplier => {
            const userRole = this.currentUser?.role || 'user';
            const customRole = this.roles.find(r => r.name === userRole);
            const permissions = customRole ? customRole.permissions : [];
            const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

            const actionButtons = !canEdit ? 
                '<td><em>Lecture seule</em></td>' :
                `
                <td>
                    <button class="btn btn-sm" onclick="app.editSupplier(${supplier.id})">Modifier</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteSupplier(${supplier.id})">Supprimer</button>
                </td>
                `;

            return `
                <tr>
                    <td>${Utils.escapeHtml(supplier.code)}</td>
                    <td>${Utils.escapeHtml(supplier.name)}</td>
                    <td>${Utils.escapeHtml(supplier.contact || '-')}</td>
                    <td>${Utils.escapeHtml(supplier.phone || '-')}</td>
                    <td>${Utils.escapeHtml(supplier.email || '-')}</td>
                    <td>${Utils.escapeHtml(supplier.address || '-')}</td>
                    ${actionButtons}
                </tr>
            `;
        }).join('');
    }

    showSupplierModal(supplierId = null) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const modal = document.getElementById('supplier-modal');
        const title = document.getElementById('supplier-modal-title');
        
        if (supplierId) {
            title.textContent = 'Modifier le fournisseur';
            this.fillSupplierForm(supplierId);
        } else {
            title.textContent = 'Nouveau fournisseur';
            this.clearSupplierForm();
        }
        
        modal.style.display = 'block';
    }

    closeSupplierModal() {
        document.getElementById('supplier-modal').style.display = 'none';
    }

    clearSupplierForm() {
        document.getElementById('edit-supplier-id').value = '';
        document.getElementById('supplier-code').value = '';
        document.getElementById('supplier-name').value = '';
        document.getElementById('supplier-contact').value = '';
        document.getElementById('supplier-phone').value = '';
        document.getElementById('supplier-email').value = '';
        document.getElementById('supplier-address').value = '';
    }

    async fillSupplierForm(supplierId) {
        try {
            const supplier = this.suppliers.find(s => s.id === supplierId);
            if (supplier) {
                document.getElementById('edit-supplier-id').value = supplier.id;
                document.getElementById('supplier-code').value = supplier.code;
                document.getElementById('supplier-name').value = supplier.name;
                document.getElementById('supplier-contact').value = supplier.contact || '';
                document.getElementById('supplier-phone').value = supplier.phone || '';
                document.getElementById('supplier-email').value = supplier.email || '';
                document.getElementById('supplier-address').value = supplier.address || '';
            }
        } catch (error) {
            Utils.showMessage('Erreur chargement fournisseur', 'error');
        }
    }

    async saveSupplier(event) {
        event.preventDefault();

        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const supplierData = {
            code: document.getElementById('supplier-code').value,
            name: document.getElementById('supplier-name').value,
            contact: document.getElementById('supplier-contact').value,
            phone: document.getElementById('supplier-phone').value,
            email: document.getElementById('supplier-email').value,
            address: document.getElementById('supplier-address').value
        };

        const supplierId = document.getElementById('edit-supplier-id').value;

        try {
            if (supplierId) {
                await ApiService.updateSupplier(supplierId, supplierData);
                Utils.showMessage('Fournisseur modifié avec succès', 'success');
            } else {
                await ApiService.createSupplier(supplierData);
                Utils.showMessage('Fournisseur créé avec succès', 'success');
            }

            await this.loadSuppliers();
            this.closeSupplierModal();

        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    async editSupplier(id) {
        this.showSupplierModal(id);
    }

    async deleteSupplier(id) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
            return;
        }

        try {
            await ApiService.deleteSupplier(id);
            Utils.showMessage('Fournisseur supprimé avec succès', 'success');
            await this.loadSuppliers();
        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    // === FONCTIONS LIVRAISONS ===
    async loadDeliveries() {
        try {
            const response = await ApiService.getDeliveries();
            this.deliveries = response.data || response;
            this.renderDeliveriesTable();
        } catch (error) {
            console.error('Erreur chargement livraisons:', error);
            Utils.showMessage('Erreur lors du chargement des livraisons', 'error');
        }
    }

    renderDeliveriesTable() {
        const container = document.getElementById('deliveries-table');
        if (!container) return;
        
        if (!this.deliveries || this.deliveries.length === 0) {
            container.innerHTML = '<tr><td colspan="7" class="no-data">Aucune livraison</td></tr>';
            return;
        }

        container.innerHTML = this.deliveries.map(delivery => {
            const statusClass = delivery.status === 'delivered' ? 'status-delivered' : 
                               delivery.status === 'pending' ? 'status-pending' : 'status-cancelled';
            const statusText = delivery.status === 'delivered' ? 'Livrée' : 
                              delivery.status === 'pending' ? 'En attente' : 'Annulée';

            const userRole = this.currentUser?.role || 'user';
            const customRole = this.roles.find(r => r.name === userRole);
            const permissions = customRole ? customRole.permissions : [];
            const canEdit = userRole === 'admin' || userRole === 'manager' || permissions.includes('inventory-write');

            const actionButtons = !canEdit ? 
                '<td><em>Lecture seule</em></td>' :
                `
                <td>
                    <button class="btn btn-sm" onclick="app.viewDelivery(${delivery.id})">Voir</button>
                    <button class="btn btn-sm" onclick="app.editDelivery(${delivery.id})">Modifier</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteDelivery(${delivery.id})">Supprimer</button>
                </td>
                `;

            return `
                <tr>
                    <td>${Utils.escapeHtml(delivery.delivery_number)}</td>
                    <td>${Utils.escapeHtml(delivery.supplier_name)}</td>
                    <td>${Utils.formatDate(delivery.delivery_date)}</td>
                    <td>${delivery.items_count} articles</td>
                    <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                    <td>${Utils.formatCurrency(delivery.total_amount)}</td>
                    ${actionButtons}
                </tr>
            `;
        }).join('');
    }

    showDeliveryModal(deliveryId = null) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || permissions.includes('inventory-write');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const modal = document.getElementById('delivery-modal');
        const title = document.getElementById('delivery-modal-title');
        
        if (deliveryId) {
            title.textContent = 'Modifier la livraison';
            this.fillDeliveryForm(deliveryId);
        } else {
            title.textContent = 'Nouvelle livraison';
            this.clearDeliveryForm();
        }
        
        this.populateDeliverySelects();
        modal.style.display = 'block';
    }

    closeDeliveryModal() {
        document.getElementById('delivery-modal').style.display = 'none';
    }

    clearDeliveryForm() {
        document.getElementById('edit-delivery-id').value = '';
        document.getElementById('delivery-supplier').value = '';
        document.getElementById('delivery-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('delivery-reference').value = '';
        this.deliveryItems = [];
        this.renderDeliveryItems();
    }

    populateDeliverySelects() {
        const supplierSelect = document.getElementById('delivery-supplier');
        if (supplierSelect) {
            supplierSelect.innerHTML = '<option value="">Choisir un fournisseur...</option>';
            this.suppliers.forEach(supplier => {
                supplierSelect.innerHTML += `<option value="${supplier.id}">${supplier.name}</option>`;
            });
        }
    }

    addDeliveryItem() {
        this.deliveryItems.push({
            article_id: '',
            quantity: 1,
            unit_price: 0
        });
        this.renderDeliveryItems();
    }

    removeDeliveryItem(index) {
        this.deliveryItems.splice(index, 1);
        this.renderDeliveryItems();
    }

    renderDeliveryItems() {
        const container = document.getElementById('delivery-items');
        if (!container) return;

        container.innerHTML = '';

        this.deliveryItems.forEach((item, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'delivery-item';
            itemDiv.innerHTML = `
                <select onchange="app.updateDeliveryItem(${index}, 'article_id', this.value)" required>
                    <option value="">Choisir un article...</option>
                    ${this.articles.map(article => `
                        <option value="${article.id}" ${item.article_id == article.id ? 'selected' : ''}>
                            ${Utils.escapeHtml(article.name)} (${Utils.escapeHtml(article.code)})
                        </option>
                    `).join('')}
                </select>
                <input type="number" step="0.001" min="0.001" placeholder="Quantité" 
                       value="${item.quantity}" 
                       onchange="app.updateDeliveryItem(${index}, 'quantity', this.value)" required>
                <input type="number" step="0.01" min="0" placeholder="Prix unitaire" 
                       value="${item.unit_price}" 
                       onchange="app.updateDeliveryItem(${index}, 'unit_price', this.value)" required>
                <button type="button" class="remove-item" onclick="app.removeDeliveryItem(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            container.appendChild(itemDiv);
        });
    }

    updateDeliveryItem(index, field, value) {
        if (this.deliveryItems[index]) {
            this.deliveryItems[index][field] = field === 'quantity' || field === 'unit_price' ? 
                parseFloat(value) : value;
        }
    }

    async saveDelivery(event) {
        event.preventDefault();

        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || permissions.includes('inventory-write');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        if (this.deliveryItems.length === 0) {
            Utils.showMessage('Veuillez ajouter au moins un article', 'error');
            return;
        }

        const deliveryData = {
            supplier_id: document.getElementById('delivery-supplier').value,
            delivery_date: document.getElementById('delivery-date').value,
            reference: document.getElementById('delivery-reference').value,
            items: this.deliveryItems
        };

        const deliveryId = document.getElementById('edit-delivery-id').value;

        try {
            if (deliveryId) {
                await ApiService.updateDelivery(deliveryId, deliveryData);
                Utils.showMessage('Livraison modifiée avec succès', 'success');
            } else {
                await ApiService.createDelivery(deliveryData);
                Utils.showMessage('Livraison créée avec succès', 'success');
            }

            await this.loadDeliveries();
            this.closeDeliveryModal();

        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    async editDelivery(id) {
        this.showDeliveryModal(id);
    }

    async deleteDelivery(id) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || permissions.includes('inventory-write');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer cette livraison ?')) {
            return;
        }

        try {
            await ApiService.deleteDelivery(id);
            Utils.showMessage('Livraison supprimée avec succès', 'success');
            await this.loadDeliveries();
        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    // === FONCTIONS FICHES TECHNIQUES ===
    async loadTechnicalSheets() {
        try {
            const response = await ApiService.getTechnicalSheets();
            this.technicalSheets = response.data || response;
            this.renderTechnicalSheetsTable();
        } catch (error) {
            console.error('Erreur chargement fiches techniques:', error);
            Utils.showMessage('Erreur lors du chargement des fiches techniques', 'error');
        }
    }

    renderTechnicalSheetsTable() {
        const container = document.getElementById('technical-sheets-table');
        if (!container) return;
        
        if (!this.technicalSheets || this.technicalSheets.length === 0) {
            container.innerHTML = '<tr><td colspan="5" class="no-data">Aucune fiche technique</td></tr>';
            return;
        }

        container.innerHTML = this.technicalSheets.map(sheet => {
            const userRole = this.currentUser?.role || 'user';
            const customRole = this.roles.find(r => r.name === userRole);
            const permissions = customRole ? customRole.permissions : [];
            const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

            const actionButtons = !canEdit ? 
                '<td><em>Lecture seule</em></td>' :
                `
                <td>
                    <button class="btn btn-sm" onclick="app.viewTechnicalSheet(${sheet.id})">Voir</button>
                    <button class="btn btn-sm" onclick="app.editTechnicalSheet(${sheet.id})">Modifier</button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteTechnicalSheet(${sheet.id})">Supprimer</button>
                </td>
                `;

            return `
                <tr>
                    <td>${Utils.escapeHtml(sheet.article_name)}</td>
                    <td>${Utils.escapeHtml(sheet.reference || '-')}</td>
                    <td>${Utils.escapeHtml(sheet.specifications ? sheet.specifications.substring(0, 100) + '...' : '-')}</td>
                    <td>${Utils.formatDate(sheet.updated_at)}</td>
                    ${actionButtons}
                </tr>
            `;
        }).join('');
    }

    showTechnicalSheetModal(sheetId = null) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const modal = document.getElementById('technical-sheet-modal');
        const title = document.getElementById('technical-sheet-modal-title');
        
        if (sheetId) {
            title.textContent = 'Modifier la fiche technique';
            this.fillTechnicalSheetForm(sheetId);
        } else {
            title.textContent = 'Nouvelle fiche technique';
            this.clearTechnicalSheetForm();
        }
        
        this.populateTechnicalSheetSelects();
        modal.style.display = 'block';
    }

    closeTechnicalSheetModal() {
        document.getElementById('technical-sheet-modal').style.display = 'none';
    }

    clearTechnicalSheetForm() {
        document.getElementById('edit-technical-sheet-id').value = '';
        document.getElementById('technical-sheet-article').value = '';
        document.getElementById('technical-sheet-reference').value = '';
        document.getElementById('technical-sheet-specifications').value = '';
        document.getElementById('technical-sheet-document').value = '';
    }

    populateTechnicalSheetSelects() {
        const articleSelect = document.getElementById('technical-sheet-article');
        if (articleSelect) {
            articleSelect.innerHTML = '<option value="">Choisir un article...</option>';
            this.articles.forEach(article => {
                articleSelect.innerHTML += `<option value="${article.id}">${article.name} (${article.code})</option>`;
            });
        }
    }

    async saveTechnicalSheet(event) {
        event.preventDefault();

        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('article_id', document.getElementById('technical-sheet-article').value);
        formData.append('reference', document.getElementById('technical-sheet-reference').value);
        formData.append('specifications', document.getElementById('technical-sheet-specifications').value);
        
        const fileInput = document.getElementById('technical-sheet-document');
        if (fileInput.files[0]) {
            formData.append('document', fileInput.files[0]);
        }

        const sheetId = document.getElementById('edit-technical-sheet-id').value;

        try {
            if (sheetId) {
                await ApiService.updateTechnicalSheet(sheetId, formData);
                Utils.showMessage('Fiche technique modifiée avec succès', 'success');
            } else {
                await ApiService.createTechnicalSheet(formData);
                Utils.showMessage('Fiche technique créée avec succès', 'success');
            }

            await this.loadTechnicalSheets();
            this.closeTechnicalSheetModal();

        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }

    async editTechnicalSheet(id) {
        this.showTechnicalSheetModal(id);
    }

    async deleteTechnicalSheet(id) {
        const userRole = this.currentUser?.role || 'user';
        const customRole = this.roles.find(r => r.name === userRole);
        const permissions = customRole ? customRole.permissions : [];
        const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'reference' || permissions.includes('references');

        if (!canEdit) {
            Utils.showMessage('Action non autorisée', 'error');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer cette fiche technique ?')) {
            return;
        }

        try {
            await ApiService.deleteTechnicalSheet(id);
            Utils.showMessage('Fiche technique supprimée avec succès', 'success');
            await this.loadTechnicalSheets();
        } catch (error) {
            Utils.showMessage(error.message, 'error');
        }
    }
}

// FONCTIONS GLOBALES AJOUTÉES
function showUserTab(tabName) {
    document.querySelectorAll('.user-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.user-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');

    if (tabName === 'users-list') {
        app.loadUsers();
    } else if (tabName === 'roles-list') {
        app.renderRoles();
    }
}

// Dans frontend/js/app.js - MODIFIER showTab()

// Dans frontend/js/app.js - MODIFIER showTab()
function showTab(tabName) {
  console.log('🔍 Changement d\'onglet:', tabName);
  
  // Cacher tous les contenus
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Désactiver tous les onglets
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Activer l'onglet sélectionné
  const targetTab = document.getElementById(tabName);
  if (targetTab) {
    targetTab.classList.add('active');
  }
  
  // Activer le bouton d'onglet - CORRECTION ICI
  const activeTab = document.querySelector(`.tab[onclick="showTab('${tabName}')"]`);
  if (activeTab) {
    activeTab.classList.add('active');
  }
  
  // Charger le contenu approprié
  if (tabName === 'dashboard') {
    app.loadDashboard();
  } else if (tabName === 'inventory') {
    app.renderArticles();
  } else if (tabName === 'users') {
    app.loadUsers();
  } else if (tabName === 'references') {
    app.loadReferences();
  } else if (tabName === 'history') {
    console.log('📝 Chargement de l\'historique...');
    historyService.renderHistory(); // 🔥 CORRECTION : utiliser historyService directement
  }
  // Dans la méthode showTab de la classe App
switch(tabName) {
    case 'dashboard':
        this.loadDashboard();
        break;
    case 'inventory':
        this.renderArticles();
        break;
    case 'users':
        this.loadUsers();
        break;
    case 'references':
        this.loadReferences();
        break;
    case 'history':
        console.log('📝 Chargement de l\'historique...');
        historyService.renderHistory();
        break;
    // 🔥 NOUVEAUX - Ajouter ces cas
    case 'suppliers':
        this.loadSuppliers();
        break;
    case 'deliveries':
        this.loadDeliveries();
        break;
    case 'technical-sheets':
        this.loadTechnicalSheets();
        break;
}
}

function showRefTab(tabName) {
    document.querySelectorAll('.ref-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.ref-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.getElementById(`${tabName}-ref`).classList.add('active');
    event.target.classList.add('active');
}

function login(event) {
    event.preventDefault();
    const credentials = {
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value
    };
    app.login(credentials);
}

function logout() {
    app.logout();
}

function showArticleModal() {
    app.showArticleModal();
}

function closeArticleModal() {
    app.closeArticleModal();
}

function saveArticle(event) {
    app.saveArticle(event);
}

function showUserModal() {
    app.showUserModal();
}

function closeUserModal() {
    app.closeUserModal();
}

function saveUser(event) {
    app.saveUser(event);
}

// FONCTIONS GLOBALES POUR LES RÔLES
function showRoleModal() {
    app.showRoleModal();
}

function closeRoleModal() {
    app.closeRoleModal();
}

function saveRole(event) {
    app.saveRole(event);
}

function showCategoryModal() {
    app.showCategoryModal();
}

function closeCategoryModal() {
    app.closeCategoryModal();
}

function saveCategory(event) {
    app.saveCategory(event);
}

function showSiteModal() {
    app.showSiteModal();
}

function closeSiteModal() {
    app.closeSiteModal();
}

function saveSite(event) {
    app.saveSite(event);
}

function showUnitModal() {
    app.showUnitModal();
}

function closeUnitModal() {
    app.closeUnitModal();
}

function saveUnit(event) {
    app.saveUnit(event);
}

function filterArticles() {
    app.filterArticles();
}
// 🔥 NOUVELLES FONCTIONS GLOBALES
function showSupplierModal() {
    app.showSupplierModal();
}

function closeSupplierModal() {
    app.closeSupplierModal();
}

function saveSupplier(event) {
    app.saveSupplier(event);
}

function showDeliveryModal() {
    app.showDeliveryModal();
}

function closeDeliveryModal() {
    app.closeDeliveryModal();
}

function saveDelivery(event) {
    app.saveDelivery(event);
}

function addDeliveryItem() {
    app.addDeliveryItem();
}

function showTechnicalSheetModal() {
    app.showTechnicalSheetModal();
}

function closeTechnicalSheetModal() {
    app.closeTechnicalSheetModal();
}

function saveTechnicalSheet(event) {
    app.saveTechnicalSheet(event);
}
// Initialiser l'application
const app = new App();