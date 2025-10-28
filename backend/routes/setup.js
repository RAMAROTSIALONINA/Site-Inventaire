import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

async function setupDatabase() {
  console.log('🚀 Configuration de la base de données...');
  
  try {
    // Vérifier PostgreSQL
    await execAsync('psql --version');
    console.log('✅ PostgreSQL détecté');
    
    // Créer la base si elle n'existe pas
    try {
      await execAsync('createdb swis_inventory');
      console.log('✅ Base de données créée');
    } catch (e) {
      console.log('ℹ️ Base existe déjà');
    }
    
    // Exécuter le script SQL
    const sqlPath = path.join(process.cwd(), 'scripts', 'init-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await execAsync(`psql -U postgres -d swis_inventory -c "${sql.replace(/\n/g, ' ')}"`);
    
    console.log('✅ Données initiales créées');
    console.log('👤 Compte: admin / admin');
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

setupDatabase();