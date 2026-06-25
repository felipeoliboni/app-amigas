-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    requires_sizes INTEGER NOT NULL DEFAULT 0 -- 1 for Conjuntos (PP, P, M, G, GG), 0 for others (U)
);

-- Items table
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    min_stock INTEGER NOT NULL DEFAULT 5, -- Limit for low stock alert
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Stock table
-- Unique constraint ensures only one quantity record per item and size combination
CREATE TABLE IF NOT EXISTS stock (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    size TEXT NOT NULL, -- 'PP', 'P', 'M', 'G', 'GG' (for Conjuntos) or 'U' (for others)
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    UNIQUE(item_id, size)
);

-- Stock history table to log all stock movements
CREATE TABLE IF NOT EXISTS stock_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    size TEXT NOT NULL,
    type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    value REAL DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Cash flow table to log financial transactions (entries and exits of money)
CREATE TABLE IF NOT EXISTS cash_flow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('IN', 'OUT')) NOT NULL, -- 'IN' for Entrada (cash inflow), 'OUT' for Saída (cash outflow)
    description TEXT NOT NULL,
    value REAL NOT NULL CHECK (value >= 0),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- Seed initial categories as requested
INSERT OR IGNORE INTO categories (name, requires_sizes) VALUES
('Conjuntos', 1),
('Sapatinhos', 0),
('Luvas', 0),
('Toucas', 0),
('Porta bico', 0),
('Básicas', 0),
('Calças', 0),
('Manta soft', 0),
('Mantas malhas', 0),
('Edredom', 0);
