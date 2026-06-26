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
          seedMembersAndPaymentsIfEmpty();
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

async function seedMembersAndPaymentsIfEmpty() {
  try {
    const memberCheck = await get('SELECT COUNT(*) as count FROM members');
    if (memberCheck.count === 0) {
      console.log('No members found. Seeding initial members and historical payments...');
      
      // Default monthly fee
      await run("INSERT OR IGNORE INTO settings (key, value) VALUES ('monthly_fee', '50.00')");
      
      const membersSeed = [
        { name: 'ADRIANA', paidMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { name: 'ALICIA', paidMonths: [1, 2, 3, 4, 5, 6, 7] },
        { name: 'ARLEANE', paidMonths: [1, 2, 3, 4, 5, 6] },
        { name: 'BEATRIZ', paidMonths: [1, 2, 3, 4, 5, 6, 7] },
        { name: 'CARMEN', paidMonths: [1, 2, 3, 4, 5, 6] },
        { name: 'CLARI', paidMonths: [1, 2, 3, 4, 5] },
        { name: 'ELI MARIA', paidMonths: [1, 2, 3, 4, 5] },
        { name: 'ELIZETE', paidMonths: [1, 2, 3, 4, 5, 6, 7, 8] },
        { name: 'FERNANDA', paidMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { name: 'LIGIA', paidMonths: [1, 2, 3] },
        { name: 'MALIZE', paidMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { name: 'MARILENE', paidMonths: [] },
        { name: 'MORGANA', paidMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
        { name: 'PAOLA', paidMonths: [1, 2, 3, 4, 5, 6] },
        { name: 'RITA', paidMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { name: 'SILVIA', paidMonths: [1, 2, 3, 4, 5, 6] },
        { name: 'TANIA', paidMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
      ];

      for (const m of membersSeed) {
        const result = await run('INSERT INTO members (name) VALUES (?)', [m.name]);
        const memberId = result.lastID;
        
        for (const month of m.paidMonths) {
          await run(
            'INSERT INTO monthly_payments (member_id, year, month, paid, value, is_historical) VALUES (?, ?, ?, 1, 50.00, 1)',
            [memberId, 2026, month]
          );
        }
      }
      console.log('Members and monthly payments seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding members:', err);
  }
}

module.exports = {
  run,
  get,
  all,
  db
};
