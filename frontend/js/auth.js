// frontend/js/auth.js - AJOUT DU DEBUG
class AuthService {
    static async login(username, password) {
        try {
            console.log('🔐 Tentative de connexion:', username);
            
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();
            
            console.log('📥 Réponse login:', data);

            if (data.success) {
                // 🆕 DEBUG DÉTAILLÉ
                console.log('=== DEBUG CONNEXION RÉUSSIE ===');
                console.log('✅ Token reçu:', data.data.token ? data.data.token.substring(0, 20) + '...' : 'NULL');
                console.log('👤 Données utilisateur:', data.data.user);
                console.log('🎯 Rôle:', data.data.user?.role);
                console.log('👤 Username:', data.data.user?.username);
                console.log('🆔 ID:', data.data.user?.id);
                console.log('==============================');
                
                // Stocker les informations
                localStorage.setItem('token', data.data.token);
                localStorage.setItem('user', JSON.stringify(data.data.user));
                
                // 🆕 Vérifier le stockage
                const storedUser = localStorage.getItem('user');
                console.log('💾 Utilisateur stocké:', storedUser);
                
                return { success: true, user: data.data.user };
            } else {
                console.error('❌ Erreur login:', data.error);
                return { success: false, error: data.error };
            }
        } catch (error) {
            console.error('❌ Erreur réseau login:', error);
            return { success: false, error: 'Erreur réseau' };
        }
    }

    static getCurrentUser() {
        const userData = localStorage.getItem('user');
        console.log('🔍 Récupération utilisateur depuis localStorage:', userData);
        
        if (userData) {
            try {
                const user = JSON.parse(userData);
                console.log('👤 Utilisateur parsé:', user);
                return user;
            } catch (error) {
                console.error('❌ Erreur parsing user data:', error);
                return null;
            }
        }
        return null;
    }

    static logout() {
        console.log('🚪 Déconnexion - Données avant suppression:');
        console.log('🔑 Token:', localStorage.getItem('token') ? 'PRÉSENT' : 'ABSENT');
        console.log('👤 User:', localStorage.getItem('user'));
        
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        console.log('✅ Déconnexion effectuée');
        window.location.href = '/login.html';
    }
}