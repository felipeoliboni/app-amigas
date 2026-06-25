const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'estoque.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure the directory for the database exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', DB_PATH);
    initDatabase();
  }
});

// Helper wrapper to use Promise with db.run
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        // Return this object containing lastID and changes
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// Helper wrapper to use Promise with db.get
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Helper wrapper to use Promise with db.all
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Initialize database schema
function initDatabase() {
  try {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema, (err) => {
      if (err) {
        console.error('Error running schema initialization:', err);
      } else {
        console.log('Database initialized successfully.');
        // Migration to add 'value' column to stock_history if database already existed
        db.run("ALTER TABLE stock_history ADD COLUMN value REAL DEFAULT 0", (alterErr) => {
          // Ignore error (e.g. duplicate column name) as it means it's already there
          seedSampleDataIfEmpty();
        });
      }
    });
  } catch (err) {
    console.error('Error reading schema.sql file:', err);
  }
}

// Seed sample data for testing if no items exist
// Seed sample data for testing if no items exist
async function seedSampleDataIfEmpty() {
  try {
    const itemCheck = await get('SELECT COUNT(*) as count FROM items');
    if (itemCheck.count === 0) {
      console.log('No items found. Seeding initial categories and items...');

      const targetCategories = [
        { name: 'Conjuntos', requiresSizes: 1 },
        { name: 'Sapatinhos', requiresSizes: 0 },
        { name: 'Luvas', requiresSizes: 0 },
        { name: 'Toucas', requiresSizes: 0 },
        { name: 'Porta bico', requiresSizes: 0 },
        { name: 'Básicas', requiresSizes: 0 },
        { name: 'Calças', requiresSizes: 0 },
        { name: 'Manta soft', requiresSizes: 0 },
        { name: 'Mantas malhas', requiresSizes: 0 },
        { name: 'Edredom', requiresSizes: 0 }
      ];

      for (const catInfo of targetCategories) {
        // Ensure category exists
        let category = await get('SELECT id FROM categories WHERE name = ?', [catInfo.name]);
        let categoryId;
        if (!category) {
          const catResult = await run('INSERT INTO categories (name, requires_sizes) VALUES (?, ?)', 
            [catInfo.name, catInfo.requiresSizes]);
          categoryId = catResult.lastID;
        } else {
          categoryId = category.id;
        }

        // Insert item under this category with the same name
        const itemResult = await run('INSERT INTO items (category_id, name, description, min_stock) VALUES (?, ?, ?, 0)',
          [categoryId, catInfo.name, `Controle de ${catInfo.name.toLowerCase()}`]);
        const itemId = itemResult.lastID;

        // Initialize stock placeholders to 0 quantity
        if (catInfo.requiresSizes === 1) {
          const sizes = ['PP', 'P', 'M', 'G', 'GG'];
          for (const size of sizes) {
            await run('INSERT INTO stock (item_id, size, quantity) VALUES (?, ?, 0)', [itemId, size]);
          }
        } else {
          await run('INSERT INTO stock (item_id, size, quantity) VALUES (?, ?, 0)', [itemId, 'U']);
        }
      }

      console.log('Initial categories and items seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  }
}

module.exports = {
  run,
  get,
  all,
  db
};
