import { exec } from 'child_process';

console.log('📦 Création de la base swis_inventory...');

// Créer la base
exec('createdb -U postgres swis_inventory', (error) => {
    if (error && !error.message.includes('already exists')) {
        console.error('❌ Erreur création base:', error.message);
        return;
    }
    
    console.log('✅ Base créée ou existe déjà');
    
    // Exécuter le script SQL
    exec('psql -U postgres -d swis_inventory -f scripts/init-db.sql', (error) => {
        if (error) {
            console.error('❌ Erreur script SQL:', error.message);
        } else {
            console.log('🎉 Setup terminé avec succès!');
        }
    });
});