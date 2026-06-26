const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static frontend files (ensure sw.js is not cached by the browser)
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (path.basename(filePath) === 'sw.js') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// 1. Dashboard summary API
app.get('/api/dashboard', async (req, res) => {
  try {
    // Total physical items in stock across all items and sizes
    const totalStock = await db.get('SELECT COALESCE(SUM(quantity), 0) as total FROM stock');

    // Count of unique items below min_stock based on combined size stock vs min_stock
    const lowStockItems = await db.all(`
      SELECT i.id, i.name, i.min_stock, COALESCE(SUM(s.quantity), 0) as total_qty
      FROM items i
      LEFT JOIN stock s ON i.id = s.item_id
      GROUP BY i.id
      HAVING total_qty < i.min_stock
    `);

    // Top recent movements
    const movements = await db.all(`
      SELECT h.id, h.size, h.type, h.quantity, h.timestamp, i.name as item_name, c.name as category_name
      FROM stock_history h
      JOIN items i ON h.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      ORDER BY h.timestamp DESC
      LIMIT 15
    `);

    // Total products registered
    const totalProducts = await db.get('SELECT COUNT(*) as count FROM items');

    res.json({
      totalStock: totalStock.total,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems,
      recentMovements: movements,
      totalProducts: totalProducts.count
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar dados do painel.' });
  }
});

// 2. Get categories API
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await db.all('SELECT * FROM categories ORDER BY name ASC');
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar categorias.' });
  }
});

// 3. Get all items (with sizes and aggregated quantities)
app.get('/api/items', async (req, res) => {
  try {
    const items = await db.all(`
      SELECT i.id, i.name, i.description, i.min_stock, i.category_id,
             c.name as category_name, c.requires_sizes
      FROM items i
      JOIN categories c ON i.category_id = c.id
      ORDER BY i.name ASC
    `);

    const stock = await db.all('SELECT * FROM stock');

    // Group stock details by item_id
    const stockMap = {};
    stock.forEach(s => {
      if (!stockMap[s.item_id]) {
        stockMap[s.item_id] = [];
      }
      stockMap[s.item_id].push({
        size: s.size,
        quantity: s.quantity
      });
    });

    // Merge stock into items
    const itemsWithStock = items.map(item => {
      const itemStock = stockMap[item.id] || [];
      const totalQty = itemStock.reduce((acc, curr) => acc + curr.quantity, 0);
      return {
        ...item,
        stock: itemStock,
        total_quantity: totalQty,
        is_low_stock: totalQty < item.min_stock
      };
    });

    res.json(itemsWithStock);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar itens.' });
  }
});

// 4. Create new item
app.post('/api/items', async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nome é obrigatório.' });
  }

  try {
    // Determine if it requires sizes (e.g. name contains "conjunto")
    const requiresSizes = name.toLowerCase().includes('conjunto') ? 1 : 0;

    // Check if category with this name already exists
    let category = await db.get('SELECT * FROM categories WHERE name = ?', [name]);
    let categoryId;
    if (!category) {
      const catResult = await db.run(
        'INSERT INTO categories (name, requires_sizes) VALUES (?, ?)',
        [name, requiresSizes]
      );
      categoryId = catResult.lastID;
    } else {
      categoryId = category.id;
    }

    // Insert item
    const result = await db.run(
      'INSERT INTO items (category_id, name, description, min_stock) VALUES (?, ?, ?, 0)',
      [categoryId, name, description || '']
    );

    const itemId = result.lastID;

    // Create stock placeholders
    if (requiresSizes === 1) {
      const sizes = ['PP', 'P', 'M', 'G', 'GG'];
      for (const size of sizes) {
        await db.run('INSERT INTO stock (item_id, size, quantity) VALUES (?, ?, 0)', [itemId, size]);
      }
    } else {
      await db.run('INSERT INTO stock (item_id, size, quantity) VALUES (?, ?, 0)', [itemId, 'U']);
    }

    res.status(201).json({ id: itemId, message: 'Item cadastrado com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar item.' });
  }
});

// 5. Quick stock adjustment
app.post('/api/stock/adjust', async (req, res) => {
  const { itemId, size, type, quantity, value } = req.body; // type: 'IN' or 'OUT', quantity: positive integer, value: optional price

  if (!itemId || !size || !type || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Dados de ajuste inválidos.' });
  }

  try {
    // Check if stock entry exists
    const stockEntry = await db.get('SELECT * FROM stock WHERE item_id = ? AND size = ?', [itemId, size]);
    if (!stockEntry) {
      return res.status(404).json({ error: 'Registro de estoque não encontrado para este item/tamanho.' });
    }

    let newQty = stockEntry.quantity;
    if (type === 'IN') {
      newQty += quantity;
    } else if (type === 'OUT') {
      newQty -= quantity;
      if (newQty < 0) {
        return res.status(400).json({ error: 'Quantidade de saída excede o estoque atual.' });
      }
    } else {
      return res.status(400).json({ error: 'Tipo de movimentação inválida.' });
    }

    // Update database inside a transaction simulation (run sequentially)
    await db.run('UPDATE stock SET quantity = ? WHERE item_id = ? AND size = ?', [newQty, itemId, size]);
    await db.run('INSERT INTO stock_history (item_id, size, type, quantity, value) VALUES (?, ?, ?, ?, ?)', [itemId, size, type, quantity, value || 0]);

    // If it's a valued outflow, automatically register in cash flow as IN (sale/revenue)
    if (type === 'OUT' && value && value > 0) {
      const product = await db.get('SELECT name FROM items WHERE id = ?', [itemId]);
      const pName = product ? product.name : `ID ${itemId}`;
      const totalValue = value * quantity;
      await db.run(
        'INSERT INTO cash_flow (type, description, value) VALUES (?, ?, ?)',
        ['IN', `Saída: ${pName} (${size === 'U' ? 'Único' : size}) x${quantity}`, totalValue]
      );
    }

    res.json({ success: true, newQuantity: newQty });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao ajustar estoque.' });
  }
});

// Get outputs history
app.get('/api/outputs', async (req, res) => {
  try {
    const outputs = await db.all(`
      SELECT h.id, h.size, h.type, h.quantity, h.timestamp, i.name as item_name, c.name as category_name
      FROM stock_history h
      JOIN items i ON h.item_id = i.id
      JOIN categories c ON i.category_id = c.id
      WHERE h.type = 'OUT'
      ORDER BY h.timestamp DESC
      LIMIT 50
    `);
    res.json(outputs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao carregar histórico de saídas.' });
  }
});

// Batch stock adjustment (for shopping cart output checkouts)
app.post('/api/stock/adjust/batch', async (req, res) => {
  const { items, totalValue } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Lista de itens vazia ou inválida.' });
  }

  // First pass: validate request data
  for (const item of items) {
    const { itemId, size, type, quantity } = item;
    if (!itemId || !size || !type || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Dados de item inválidos no carrinho.' });
    }
  }

  try {
    // Run all adjustments inside a database transaction for data safety
    await db.run('BEGIN TRANSACTION');

    const itemDescriptions = [];

    for (const item of items) {
      const { itemId, size, type, quantity, value } = item;

      const stockEntry = await db.get('SELECT * FROM stock WHERE item_id = ? AND size = ?', [itemId, size]);
      if (!stockEntry) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: `Estoque não encontrado para o produto ID ${itemId} / tamanho ${size}.` });
      }

      let newQty = stockEntry.quantity;
      if (type === 'IN') {
        newQty += quantity;
      } else if (type === 'OUT') {
        newQty -= quantity;
        if (newQty < 0) {
          await db.run('ROLLBACK');
          const product = await db.get('SELECT name FROM items WHERE id = ?', [itemId]);
          const pName = product ? product.name : `ID ${itemId}`;
          return res.status(400).json({ error: `A saída de "${pName}" (${size}) excede o estoque disponível.` });
        }
      } else {
        await db.run('ROLLBACK');
        return res.status(400).json({ error: 'Tipo de movimentação inválido.' });
      }

      await db.run('UPDATE stock SET quantity = ? WHERE item_id = ? AND size = ?', [newQty, itemId, size]);
      await db.run('INSERT INTO stock_history (item_id, size, type, quantity, value) VALUES (?, ?, ?, ?, ?)', [itemId, size, type, quantity, value || 0]);

      // Collect product name and size for description if totalValue is present
      if (totalValue && totalValue > 0) {
        const product = await db.get('SELECT name FROM items WHERE id = ?', [itemId]);
        const pName = product ? product.name : `ID ${itemId}`;
        const sizeDesc = size === 'U' ? 'Único' : size;
        itemDescriptions.push(`${quantity}x ${pName} (${sizeDesc})`);
      }
    }

    // Register a single entry in cash flow if totalValue is provided and positive
    if (totalValue && totalValue > 0) {
      const description = `Saída de Sacola: ${itemDescriptions.join(', ')}`;
      await db.run(
        'INSERT INTO cash_flow (type, description, value) VALUES (?, ?, ?)',
        ['IN', description, totalValue]
      );
    }

    await db.run('COMMIT');
    res.json({ success: true, message: 'Carrinho processado com sucesso.' });
  } catch (error) {
    try {
      await db.run('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Rollback failed:', rollbackErr);
    }
    console.error('Batch adjustment error:', error);
    res.status(500).json({ error: 'Erro no servidor ao processar carrinho de saídas.' });
  }
});

// 6. Get cash flow logs and summaries
app.get('/api/cashflow', async (req, res) => {
  try {
    const transactions = await db.all('SELECT * FROM cash_flow ORDER BY timestamp DESC LIMIT 100');
    
    const summary = await db.get(`
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'IN' THEN value ELSE 0 END), 0) as totalIn,
        COALESCE(SUM(CASE WHEN type = 'OUT' THEN value ELSE 0 END), 0) as totalOut
      FROM cash_flow
    `);

    res.json({
      transactions,
      totalIn: summary.totalIn,
      totalOut: summary.totalOut,
      balance: summary.totalIn - summary.totalOut
    });
  } catch (error) {
    console.error('Error fetching cashflow:', error);
    res.status(500).json({ error: 'Erro ao carregar dados do financeiro/caixa.' });
  }
});

// 7. Add manual cash flow transaction
app.post('/api/cashflow', async (req, res) => {
  const { type, description, value } = req.body;

  if (!type || !description || value === undefined || value < 0) {
    return res.status(400).json({ error: 'Dados de transação inválidos.' });
  }

  try {
    await db.run(
      'INSERT INTO cash_flow (type, description, value) VALUES (?, ?, ?)',
      [type, description, value]
    );
    res.status(201).json({ success: true, message: 'Lançamento financeiro registrado.' });
  } catch (error) {
    console.error('Error creating cashflow transaction:', error);
    res.status(500).json({ error: 'Erro ao registrar lançamento financeiro.' });
  }
});

// 8. Delete cash flow transaction
app.delete('/api/cashflow/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await db.run('DELETE FROM cash_flow WHERE id = ?', [id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Lançamento não encontrado.' });
    }
    res.json({ success: true, message: 'Lançamento financeiro removido.' });
  } catch (error) {
    console.error('Error deleting cashflow transaction:', error);
    res.status(500).json({ error: 'Erro ao remover lançamento financeiro.' });
  }
});

// Fallback index.html for Single Page Application navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
