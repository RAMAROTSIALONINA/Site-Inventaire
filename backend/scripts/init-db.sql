-- SWIS INVENTORY - SCRIPT DE CREATION
-- Encodage UTF8 correct

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des sites
CREATE TABLE IF NOT EXISTS sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    address TEXT,
    phone VARCHAR(20),
    manager VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

-- Table des categories
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table des unites
CREATE TABLE IF NOT EXISTS units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    symbol VARCHAR(10) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table des fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE
);

-- Table des articles
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    department VARCHAR(100),
    site_id INTEGER REFERENCES sites(id) NOT NULL,
    unit_id INTEGER REFERENCES units(id) NOT NULL,
    current_stock DECIMAL(12,3) DEFAULT 0,
    alert_threshold DECIMAL(12,3) DEFAULT 0,
    order_quantity DECIMAL(12,3) DEFAULT 0,
    cost_price DECIMAL(12,2) DEFAULT 0,
    selling_price DECIMAL(12,2) DEFAULT 0,
    supplier_id INTEGER REFERENCES suppliers(id),
    barcode VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des mouvements de stock
CREATE TABLE IF NOT EXISTS stock_movements (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id),
    article_name VARCHAR(200) NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    site_id INTEGER REFERENCES sites(id),
    reason VARCHAR(200),
    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Tables pour les fournisseurs, livraisons et fiches techniques

-- Table des fournisseurs
CREATE TABLE IF NOT EXISTS suppliers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    contact VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table des livraisons
CREATE TABLE IF NOT EXISTS deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_number VARCHAR(100) UNIQUE NOT NULL,
    supplier_id INT NOT NULL,
    delivery_date DATE NOT NULL,
    reference VARCHAR(255),
    status ENUM('pending', 'delivered', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(15,2) DEFAULT 0,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Table des articles dans les livraisons
CREATE TABLE IF NOT EXISTS delivery_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_id INT NOT NULL,
    article_id INT NOT NULL,
    quantity DECIMAL(15,3) NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) AS (quantity * unit_price) STORED,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE RESTRICT
);

-- Table des fiches techniques
CREATE TABLE IF NOT EXISTS technical_sheets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    article_id INT NOT NULL,
    reference VARCHAR(255),
    specifications TEXT,
    document_path VARCHAR(500),
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_article (article_id)
);

-- Index pour améliorer les performances
CREATE INDEX idx_deliveries_supplier_id ON deliveries(supplier_id);
CREATE INDEX idx_deliveries_date ON deliveries(delivery_date);
CREATE INDEX idx_delivery_items_delivery_id ON delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_article_id ON delivery_items(article_id);
CREATE INDEX idx_technical_sheets_article_id ON technical_sheets(article_id);

-- DONNEES INITIALES

-- Utilisateur admin
INSERT INTO users (username, email, password_hash, full_name, role) VALUES 
('admin', 'admin@swis.mg', '$2a$10$8K1p/a0dRTlB0Z6bZ8BwE.ZK6d7kAD7kG8k8B8k8B8k8B8k8B8k8', 'Admin Swis', 'admin');

-- Sites
INSERT INTO sites (name, code, address, phone, manager) VALUES
('Bypass', 'BY001', '123 Rue Bypass, Antananarivo', '+261 20 123 45', 'Jean Rakoto'),
('Isoraka', 'IS002', '456 Avenue Isoraka, Antananarivo', '+261 20 456 78', 'Marie Ravao'),
('Ivato', 'IV003', '789 Boulevard Ivato, Antananarivo', '+261 20 789 01', 'Paul Randria');

-- Categories
INSERT INTO categories (name, description) VALUES
('Legumes', 'Legumes frais et produits de saison'),
('Viandes', 'Viandes et volailles'),
('Epicerie', 'Produits d''epicerie seche'),
('Boissons', 'Boissons et liquides'),
('Produits Laitiers', 'Lait, fromage et produits derives'),
('Fruits', 'Fruits frais');

-- Unites
INSERT INTO units (name, symbol) VALUES
('Kilogramme', 'kg'),
('Litre', 'L'),
('Piece', 'pc'),
('Boite', 'boite'),
('Sachet', 'sachet');

-- Fournisseurs
INSERT INTO suppliers (name, code, contact_person, phone, email) VALUES
('Centrale C2A', 'C2A001', 'M. Dupont', '+261 20 111 222', 'c2a@supplier.mg'),
('Fresh Market Madagascar', 'FRM002', 'Mme. Sophie', '+261 20 333 444', 'fresh@market.mg'),
('Meat Suppliers MG', 'MTS003', 'M. Robert', '+261 20 555 666', 'meat@suppliers.mg');

-- Articles
INSERT INTO articles (code, name, description, category_id, department, site_id, unit_id, current_stock, alert_threshold, order_quantity, cost_price, supplier_id) VALUES
('TOM001', 'Tomates fraiches', 'Tomates rouges fraiches', 1, 'Primeurs', 1, 1, 15.0, 5.0, 10.0, 1200.00, 2),
('POU002', 'Filet de poulet', 'Filet de poulet sans peau', 2, 'Boucherie', 1, 1, 2.0, 5.0, 8.0, 8500.00, 3),
('RIZ003', 'Riz basmati', 'Riz basmati qualite premium', 3, 'Epicerie seche', 2, 1, 25.0, 10.0, 15.0, 3200.00, 1),
('LAI004', 'Lait entier', 'Lait entier UHT 1L', 5, 'Produits frais', 3, 2, 8.0, 4.0, 6.0, 2800.00, 2),
('COC005', 'Coca-Cola 33cl', 'Boisson gazeuse Coca-Cola 33cl', 4, 'Boissons', 1, 3, 3.0, 6.0, 12.0, 1800.00, 1);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_articles_site ON articles(site_id);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category_id);
CREATE INDEX IF NOT EXISTS idx_articles_active ON articles(is_active) WHERE is_active = true;

-- Message de succes
DO $$ 
BEGIN
    RAISE NOTICE '✅ Base de donnees Swis Inventory creee avec succes!';
    RAISE NOTICE '👤 Compte admin: admin / admin';
    RAISE NOTICE '📦 Articles exemple: 5 articles crees';
END $$;