-- Base de données Inventaire Swis Madagascar
CREATE DATABASE swis_inventory;
\c swis_inventory;

-- Table des sites
CREATE TABLE sites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(20) UNIQUE,
    address TEXT,
    phone VARCHAR(20),
    manager VARCHAR(100),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des fournisseurs
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    contact_person VARCHAR(100),
    phone VARCHAR(20),
    email VARCHAR(100),
    address TEXT,
    payment_terms VARCHAR(100),
    delivery_lead_time INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des catégories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des unités de mesure
CREATE TABLE units (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Table principale des articles
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id INTEGER REFERENCES categories(id),
    department VARCHAR(100),
    site_id INTEGER REFERENCES sites(id),
    unit_id INTEGER REFERENCES units(id),
    current_stock DECIMAL(12,3) DEFAULT 0,
    min_stock DECIMAL(12,3) DEFAULT 0,
    max_stock DECIMAL(12,3) DEFAULT 0,
    alert_threshold DECIMAL(12,3) DEFAULT 0,
    order_quantity DECIMAL(12,3) DEFAULT 0,
    cost_price DECIMAL(12,2) DEFAULT 0,
    selling_price DECIMAL(12,2) DEFAULT 0,
    supplier_id INTEGER REFERENCES suppliers(id),
    barcode VARCHAR(100),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_stock_take TIMESTAMP
);

-- Table des commandes
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    site_id INTEGER REFERENCES sites(id),
    supplier_id INTEGER REFERENCES suppliers(id),
    order_type VARCHAR(50) DEFAULT 'manual',
    status VARCHAR(50) DEFAULT 'draft',
    total_amount DECIMAL(12,2) DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expected_delivery DATE,
    actual_delivery TIMESTAMP,
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des lignes de commande
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES articles(id),
    article_name VARCHAR(200) NOT NULL,
    department VARCHAR(100),
    unit VARCHAR(50),
    quantity_ordered DECIMAL(12,3) NOT NULL,
    quantity_received DECIMAL(12,3) DEFAULT 0,
    unit_price DECIMAL(12,2) DEFAULT 0,
    total_price DECIMAL(12,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'ordered',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des mouvements de stock
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id),
    article_name VARCHAR(200) NOT NULL,
    movement_type VARCHAR(50) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    previous_stock DECIMAL(12,3),
    new_stock DECIMAL(12,3),
    site_id INTEGER REFERENCES sites(id),
    reference VARCHAR(100),
    reference_id INTEGER,
    reason VARCHAR(200),
    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(100),
    notes TEXT
);

-- Table des prix fournisseurs (C2A)
CREATE TABLE supplier_prices (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    article_id INTEGER REFERENCES articles(id),
    price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2),
    min_order_quantity DECIMAL(12,3) DEFAULT 1,
    lead_time_days INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table d'audit
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(100),
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(100),
    record_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les performances
CREATE INDEX idx_articles_site ON articles(site_id);
CREATE INDEX idx_articles_category ON articles(category_id);
CREATE INDEX idx_articles_supplier ON articles(supplier_id);
CREATE INDEX idx_stock_movements_article ON stock_movements(article_id);
CREATE INDEX idx_stock_movements_date ON stock_movements(movement_date);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_site ON orders(site_id);

-- Déclencheur pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Données initiales
INSERT INTO sites (name, code, address, phone, manager, email) VALUES
('Bypass', 'BY001', '123 Rue Bypass, Antananarivo', '+261 20 123 45', 'Jean Rakoto', 'bypass@swis.mg'),
('Isoraka', 'IS002', '456 Avenue Isoraka, Antananarivo', '+261 20 456 78', 'Marie Ravao', 'isoraka@swis.mg'),
('Ivato', 'IV003', '789 Boulevard Ivato, Antananarivo', '+261 20 789 01', 'Paul Randria', 'ivato@swis.mg');

INSERT INTO suppliers (name, code, contact_person, phone, email, address, payment_terms) VALUES
('Centrale C2A', 'C2A001', 'M. Dupont', '+261 20 111 222', 'c2a@supplier.mg', '123 Avenue de l''Indépendance', '30 jours'),
('Fresh Market Madagascar', 'FRM002', 'Mme. Sophie', '+261 20 333 444', 'fresh@market.mg', '456 Rue du Commerce', '15 jours'),
('Meat Suppliers MG', 'MTS003', 'M. Robert', '+261 20 555 666', 'meat@suppliers.mg', '789 Boulevard des Viandes', '30 jours');

INSERT INTO categories (name, description) VALUES
('Légumes', 'Légumes frais et produits de saison'),
('Viandes', 'Viandes et volailles'),
('Épicerie', 'Produits d''épicerie sèche'),
('Boissons', 'Boissons et liquides'),
('Produits Laitiers', 'Lait, fromage et produits dérivés'),
('Fruits', 'Fruits frais');

INSERT INTO units (name, symbol) VALUES
('Kilogramme', 'kg'),
('Gramme', 'g'),
('Litre', 'L'),
('Millilitre', 'ml'),
('Pièce', 'pièce'),
('Boîte', 'boîte'),
('Sachet', 'sachet'),
('Carton', 'carton');

INSERT INTO articles (code, name, description, category_id, department, site_id, unit_id, current_stock, min_stock, alert_threshold, order_quantity, cost_price, selling_price, supplier_id) VALUES
('TOM001', 'Tomates fraîches', 'Tomates rouges fraîches', 1, 'Primeurs', 1, 1, 15.0, 2.0, 5.0, 10.0, 1200.00, 1800.00, 2),
('POU002', 'Filet de poulet', 'Filet de poulet sans peau', 2, 'Boucherie', 1, 1, 2.0, 3.0, 5.0, 8.0, 8500.00, 12000.00, 3),
('RIZ003', 'Riz basmati', 'Riz basmati qualité premium', 3, 'Épicerie sèche', 2, 1, 25.0, 5.0, 10.0, 15.0, 3200.00, 4500.00, 1),
('LAI004', 'Lait entier', 'Lait entier UHT', 5, 'Produits frais', 3, 3, 8.0, 2.0, 4.0, 6.0, 2800.00, 3500.00, 2),
('COC005', 'Coca-Cola', 'Boisson gazeuse Coca-Cola 33cl', 4, 'Boissons', 1, 5, 3.0, 5.0, 6.0, 12.0, 1800.00, 2200.00, 1);