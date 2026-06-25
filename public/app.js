// AMIGAS - CLIENT APP CONTROLLER

// State Store
let state = {
  activeView: 'view-dashboard',
  categories: [],
  items: [],
  dashboard: {},
  filterCategory: 'all',
  searchQuery: '',
  // Holds selected size for each item (itemId -> selectedSize)
  selectedSizes: {},
  outputsCart: []
};

// DOM Elements & Initialization
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Register Form Submit
  const addItemForm = document.getElementById('add-item-form');
  if (addItemForm) {
    addItemForm.addEventListener('submit', handleAddItemSubmit);
  }

  // Register Saída Form events
  const addOutputForm = document.getElementById('add-output-form');
  if (addOutputForm) {
    addOutputForm.addEventListener('submit', handleAddOutputSubmit);
  }

  const outputItemSelect = document.getElementById('output-item-select');
  if (outputItemSelect) {
    outputItemSelect.addEventListener('change', handleOutputItemChange);
  }

  const outputSizeSelect = document.getElementById('output-size-select');
  if (outputSizeSelect) {
    outputSizeSelect.addEventListener('change', handleOutputSizeChange);
  }

  // Register Cart Submit Button event
  const btnSubmitCart = document.getElementById('btn-submit-cart');
  if (btnSubmitCart) {
    btnSubmitCart.addEventListener('click', handleSubmitCart);
  }

  // Register Search Input events
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      if (state.searchQuery) {
        searchClear.classList.remove('hidden');
      } else {
        searchClear.classList.add('hidden');
      }
      renderInventory();
    });
  }

  if (searchClear) {
    searchClear.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      searchClear.classList.add('hidden');
      renderInventory();
    });
  }

  // Dashboard low stock card click event
  const alertCard = document.getElementById('card-alert-trigger');
  if (alertCard) {
    alertCard.addEventListener('click', () => {
      const panel = document.getElementById('low-stock-panel');
      if (panel) {
        panel.classList.toggle('hidden');
      }
    });
  }

  // Handle category form helper hint
  const catSelect = document.getElementById('form-category');
  const catHint = document.getElementById('category-hint');
  if (catSelect && catHint) {
    catSelect.addEventListener('change', (e) => {
      const selectedOption = e.target.options[e.target.selectedIndex];
      const requiresSizes = selectedOption.getAttribute('data-sizes') === '1';
      if (requiresSizes) {
        catHint.textContent = '💡 Esta categoria requer controle de tamanhos (PP, P, M, G, GG).';
      } else {
        catHint.textContent = '💡 Esta categoria usa controle de quantidade única geral.';
      }
    });
  }

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('Service Worker registered successfully.', reg))
        .catch(err => console.log('Service Worker registration failed:', err));
    });
  }

  // Listen to connectivity changes
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
});

// App Entry Point
async function initApp() {
  showLoader();
  try {
    await fetchCategories();
    await fetchDashboard();
    await fetchItems();
    
    // Check url hash for deep links
    const hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById(hash)) {
      navigateTo(hash);
    } else {
      navigateTo('view-dashboard');
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showToast('Erro ao carregar dados do servidor.');
  } finally {
    hideLoader();
  }
}

// Check network status
function updateOnlineStatus() {
  const badge = document.getElementById('online-status');
  if (badge) {
    if (navigator.onLine) {
      badge.innerHTML = '<span class="status-badge status-online">Online</span>';
    } else {
      badge.innerHTML = '<span class="status-badge status-offline">Offline</span>';
    }
  }
}

// Navigation controller
function navigateTo(viewId) {
  // Hide all sections
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.remove('active');
  });

  // Show target section
  const target = document.getElementById(viewId);
  if (target) {
    target.classList.add('active');
    state.activeView = viewId;
    window.location.hash = viewId;
  }

  // Update navbar items active state
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.remove('active');
  });
  const navBtn = document.getElementById(`nav-btn-${viewId}`);
  if (navBtn) {
    navBtn.classList.add('active');
  }

  // Reload data for target view
  if (viewId === 'view-dashboard') {
    fetchDashboard();
    fetchItems();
  } else if (viewId === 'view-inventory') {
    fetchItems();
  } else if (viewId === 'view-outputs') {
    fetchItems();
    fetchOutputsHistory();
  }
}

// API Requests
async function fetchCategories() {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Failed to fetch categories');
  state.categories = await res.json();
  
  // Populate category filter pill container
  const filterBar = document.getElementById('category-filter-bar');
  if (filterBar) {
    // Keep 'All' pill, delete others
    filterBar.innerHTML = '<button class="category-pill active" id="pill-all" onclick="filterCategory(\'all\')">Todos</button>';
    state.categories.forEach(cat => {
      const button = document.createElement('button');
      button.className = 'category-pill';
      button.id = `pill-${cat.id}`;
      button.textContent = cat.name;
      button.onclick = () => filterCategory(cat.id);
      filterBar.appendChild(button);
    });
  }

  // Populate Add Item category dropdown
  const catSelect = document.getElementById('form-category');
  if (catSelect) {
    catSelect.innerHTML = '<option value="" disabled selected>Selecione uma categoria</option>';
    state.categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.name;
      option.setAttribute('data-sizes', cat.requires_sizes);
      catSelect.appendChild(option);
    });
  }
}

async function fetchDashboard() {
  const res = await fetch('/api/dashboard');
  if (!res.ok) throw new Error('Failed to fetch dashboard metrics');
  state.dashboard = await res.json();
  
  // Update dashboard views
  const totalStockEl = document.getElementById('dash-total-stock');
  if (totalStockEl) {
    totalStockEl.textContent = state.dashboard.totalStock;
  }
}

async function fetchItems() {
  const res = await fetch('/api/items');
  if (!res.ok) throw new Error('Failed to fetch items');
  state.items = await res.json();
  
  // Default sizes for Conjuntos setup
  state.items.forEach(item => {
    if (!state.selectedSizes[item.id]) {
      if (item.requires_sizes === 1) {
        state.selectedSizes[item.id] = 'PP'; // Default selection
      } else {
        state.selectedSizes[item.id] = 'U';
      }
    }
  });

  renderInventory();
  renderDashboardItemsList();
  populateOutputsForm();
}

// Category filter action
function filterCategory(catId) {
  state.filterCategory = catId;
  
  // Update UI Pills
  document.querySelectorAll('.category-pill').forEach(pill => {
    pill.classList.remove('active');
  });

  const activePill = document.getElementById(`pill-${catId}`);
  if (activePill) {
    activePill.classList.add('active');
    
    // Auto scroll category bar to center active chip
    activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  renderInventory();
}

// Adjust inventory action (IN / OUT)
async function adjustStock(itemId, type) {
  itemId = parseInt(itemId);
  const size = state.selectedSizes[itemId];
  const qty = 1; // Quick tap increments/decrements by 1 unit
  
  // Optimistic UI update to make the app feel instant and native
  const itemIndex = state.items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return;
  
  const item = state.items[itemIndex];
  const sizeObj = item.stock.find(s => s.size === size);
  
  if (!sizeObj) return;

  if (type === 'OUT' && sizeObj.quantity === 0) {
    showToast('Estoque já está zerado!');
    return;
  }

  // Lock buttons or show immediate changes
  const prevQty = sizeObj.quantity;
  if (type === 'IN') {
    sizeObj.quantity += qty;
    item.total_quantity += qty;
  } else {
    sizeObj.quantity -= qty;
    item.total_quantity -= qty;
  }
  
  // Check low stock state change locally
  item.is_low_stock = item.total_quantity < item.min_stock;
  
  // Render immediately for native responsiveness
  renderInventory();

  try {
    const res = await fetch('/api/stock/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, size, type, quantity: qty })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server error');
    }

    // Success - play haptic feedback if available (simple toast)
    showToast(`${type === 'IN' ? 'Entrada (+1)' : 'Saída (-1)'} salva!`);
    fetchDashboard();
  } catch (error) {
    console.error('Error adjusting stock:', error);
    showToast('Erro ao sincronizar. Revertendo...');
    // Revert optimistic changes on failure
    sizeObj.quantity = prevQty;
    if (type === 'IN') {
      item.total_quantity -= qty;
    } else {
      item.total_quantity += qty;
    }
    item.is_low_stock = item.total_quantity < item.min_stock;
    renderInventory();
  }
}

// Change active size pill in card
function selectItemSize(itemId, size) {
  itemId = parseInt(itemId);
  state.selectedSizes[itemId] = size;
  renderInventory();
}

// Adjust stock by custom quantity X
async function adjustStockCustom(itemId, type) {
  itemId = parseInt(itemId);
  const size = state.selectedSizes[itemId];
  const inputEl = document.getElementById(`custom-qty-${itemId}`);
  if (!inputEl) return;
  
  const qty = parseInt(inputEl.value);
  if (isNaN(qty) || qty <= 0) {
    showToast('Por favor, insira um número válido maior que 0.');
    return;
  }
  
  // Optimistic UI update to make the app feel instant and native
  const itemIndex = state.items.findIndex(i => i.id === itemId);
  if (itemIndex === -1) return;
  
  const item = state.items[itemIndex];
  const sizeObj = item.stock.find(s => s.size === size);
  
  if (!sizeObj) return;

  if (type === 'OUT' && sizeObj.quantity < qty) {
    showToast('Quantidade excede o estoque atual!');
    return;
  }

  // Lock buttons or show immediate changes
  const prevQty = sizeObj.quantity;
  if (type === 'IN') {
    sizeObj.quantity += qty;
    item.total_quantity += qty;
  } else {
    sizeObj.quantity -= qty;
    item.total_quantity -= qty;
  }
  
  // Check low stock state change locally
  item.is_low_stock = item.total_quantity < item.min_stock;
  
  // Render immediately for native responsiveness
  renderInventory();

  try {
    const res = await fetch('/api/stock/adjust', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, size, type, quantity: qty })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Server error');
    }

    // Success - play haptic feedback if available (simple toast)
    showToast(`${type === 'IN' ? 'Entrada (+' + qty + ')' : 'Saída (-' + qty + ')'} salva!`);
    inputEl.value = 1; // reset input
    
    // Refresh dashboard total stock
    fetchDashboard();
  } catch (error) {
    console.error('Error adjusting stock:', error);
    showToast('Erro ao sincronizar. Revertendo...');
    // Revert optimistic changes on failure
    sizeObj.quantity = prevQty;
    if (type === 'IN') {
      item.total_quantity -= qty;
    } else {
      item.total_quantity += qty;
    }
    item.is_low_stock = item.total_quantity < item.min_stock;
    renderInventory();
  }
}

// Add Item form submission
async function handleAddItemSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('form-name').value;
  const description = document.getElementById('form-description').value;

  try {
    const res = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    showToast('Peça cadastrada com sucesso!');
    e.target.reset();
    const catHint = document.getElementById('category-hint');
    if (catHint) catHint.textContent = '';
    
    // Refresh lists and head to inventory view
    await fetchItems();
    navigateTo('view-inventory');
  } catch (error) {
    console.error('Add item error:', error);
    showToast(error.message || 'Erro ao cadastrar peça.');
  }
}

// RENDERING FUNCTIONS

// Render main inventory view
function renderInventory() {
  const container = document.getElementById('inventory-items-container');
  if (!container) return;

  // Filter items
  let filtered = state.items;
  
  // Category Filter
  if (state.filterCategory !== 'all') {
    filtered = filtered.filter(item => item.category_id === parseInt(state.filterCategory));
  }
  
  // Search query filter
  if (state.searchQuery) {
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(state.searchQuery) ||
      (item.description && item.description.toLowerCase().includes(state.searchQuery)) ||
      item.category_name.toLowerCase().includes(state.searchQuery)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="timeline-empty" style="padding: 40px 10px;">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--text-light)" stroke-width="1.5" style="margin-bottom: 12px;"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>
        <p>Nenhuma peça encontrada.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    // Get selected size for this card
    const selectedSize = state.selectedSizes[item.id] || (item.requires_sizes === 1 ? 'PP' : 'U');
    const sizeStockObj = item.stock.find(s => s.size === selectedSize) || { quantity: 0 };
    
    let sizeSelectorHTML = '';
    
    // If category is "Conjuntos", show size selectors
    if (item.requires_sizes === 1) {
      sizeSelectorHTML = `
        <div class="size-selector-row">
          ${item.stock.map(s => `
            <div class="size-pill size-pill-${item.id} ${s.size === selectedSize ? 'active' : ''}" 
                 id="size-pill-${item.id}-${s.size}" 
                 onclick="selectItemSize(${item.id}, '${s.size}')">
              <span>${s.size}</span>
              <span class="size-qty-sub">${s.quantity}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="item-info">
        <div class="item-title-desc">
          <span class="item-title">${item.name}</span>
          <span class="item-desc">${item.description || 'Sem descrição'}</span>
        </div>
      </div>
      
      <div class="stock-control-group">
        ${sizeSelectorHTML}
        
        <div class="quick-counter-control">
          <button class="control-btn btn-minus" onclick="adjustStock(${item.id}, 'OUT')">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
          
          <div class="counter-value-container">
            <span class="counter-qty" id="counter-qty-${item.id}">${sizeStockObj.quantity}</span>
            <span class="counter-label" id="counter-lbl-${item.id}">${item.requires_sizes === 1 ? 'Tamanho ' + selectedSize : 'Estoque total'}</span>
          </div>
          
          <button class="control-btn btn-plus" onclick="adjustStock(${item.id}, 'IN')">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>

        <div class="custom-add-container">
          <input type="number" id="custom-qty-${item.id}" min="1" value="1" class="custom-qty-input">
          <button class="btn-custom-add" onclick="adjustStockCustom(${item.id}, 'IN')">Adicionar</button>
          <button class="btn-custom-remove" onclick="adjustStockCustom(${item.id}, 'OUT')">Remover</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// Render the items stock list in the dashboard (without alerts)
function renderDashboardItemsList() {
  const container = document.getElementById('dash-items-stock-list');
  if (!container) return;

  if (state.items.length === 0) {
    container.innerHTML = `
      <div class="timeline-empty">
        <p>Nenhuma peça cadastrada.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  state.items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'dash-item-row';
    
    // Quick click on the row navigates to the inventory page
    row.onclick = () => {
      navigateTo('view-inventory');
    };

    let sizesBreakdown = '';
    if (item.requires_sizes === 1) {
      sizesBreakdown = item.stock
        .map(s => `${s.size}: ${s.quantity}`)
        .join(' | ');
    }

    row.innerHTML = `
      <div class="dash-item-name">${item.name}</div>
      <div class="dash-item-details">
        <span class="dash-item-qty">${item.total_quantity} un</span>
        ${sizesBreakdown ? `<span class="dash-item-sizes">${sizesBreakdown}</span>` : ''}
      </div>
    `;
    
    container.appendChild(row);
  });
}

// Helper to format movement logs
function createTimelineItem(m) {
  const div = document.createElement('div');
  div.className = 'timeline-item';
  
  const isSizeU = m.size === 'U';
  const sizeDesc = isSizeU ? '' : ` (${m.size})`;
  const typeLabel = m.type === 'IN' ? '+ Entrada' : '- Saída';
  const typeClass = m.type === 'IN' ? 't-in' : 't-out';
  const quantityFormatted = m.type === 'IN' ? `+${m.quantity}` : `-${m.quantity}`;
  
  // Format Date (HH:MM - DD/MM)
  const dateObj = new Date(m.timestamp);
  const time = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const date = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  div.innerHTML = `
    <div class="timeline-badge ${typeClass}">${quantityFormatted}</div>
    <div class="timeline-info">
      <span class="timeline-title">${m.item_name}<span>${sizeDesc}</span></span>
      <span class="timeline-time">${time} - ${date}</span>
    </div>
  `;
  return div;
}

// Utility Loader / Toast functions
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2200);
}

function showLoader() {
  // Can add a subtle spinner if needed
}

function hideLoader() {
  // Can hide spinner if needed
}

// ----------------------------------------------------
// PDF EXPORT AND OUTPUTS MANAGEMENT
// ----------------------------------------------------

// Export stock report to PDF using jsPDF
function exportStockToPDF() {
  try {
    const { jsPDF } = window.jspdf;
    if (!jsPDF) {
      showToast('Erro: Biblioteca PDF não carregada.');
      return;
    }
    const doc = new jsPDF();
    
    // Header styling
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(43, 76, 22); // --text-primary (#2b4c16)
    doc.text("Amigas do Bem", 14, 20);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(90, 122, 64); // --text-secondary
    doc.text("Relatório de Controle de Estoque", 14, 27);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(139, 168, 115); // --text-light
    const now = new Date();
    const formattedDate = now.toLocaleDateString('pt-BR') + ' às ' + now.toLocaleTimeString('pt-BR');
    doc.text(`Gerado em: ${formattedDate}`, 14, 34);
    
    // Construct table rows
    const tableRows = [];
    state.items.forEach(item => {
      if (item.requires_sizes === 1) {
        item.stock.forEach(s => {
          tableRows.push([
            item.name,
            item.category_name,
            s.size,
            s.quantity.toString()
          ]);
        });
      } else {
        tableRows.push([
          item.name,
          item.category_name,
          'Único',
          item.total_quantity.toString()
        ]);
      }
    });
    
    doc.autoTable({
      startY: 40,
      head: [['Produto', 'Categoria', 'Tamanho', 'Quantidade']],
      body: tableRows,
      theme: 'grid',
      headStyles: { 
        fillColor: [122, 179, 41], // --primary
        textColor: [255, 255, 255],
        fontStyle: 'bold' 
      },
      styles: { 
        font: 'helvetica', 
        fontSize: 9,
        textColor: [43, 76, 22] 
      },
      alternateRowStyles: {
        fillColor: [245, 250, 240] // --bg-primary
      },
      margin: { top: 40 }
    });
    
    const fileDate = now.toISOString().split('T')[0];
    doc.save(`relatorio_estoque_${fileDate}.pdf`);
    showToast('PDF exportado com sucesso!');
  } catch (error) {
    console.error('PDF Export Error:', error);
    showToast('Erro ao exportar PDF.');
  }
}

// Populate the product dropdown in Saídas form
function populateOutputsForm() {
  const itemSelect = document.getElementById('output-item-select');
  if (!itemSelect) return;

  const previousValue = itemSelect.value;
  itemSelect.innerHTML = '<option value="" disabled selected>Selecione um produto</option>';
  
  state.items.forEach(item => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = item.name;
    itemSelect.appendChild(option);
  });

  if (previousValue && state.items.some(item => item.id == previousValue)) {
    itemSelect.value = previousValue;
  } else {
    const sizeSelect = document.getElementById('output-size-select');
    if (sizeSelect) {
      sizeSelect.innerHTML = '<option value="" disabled selected>Selecione um produto primeiro</option>';
    }
    const hint = document.getElementById('output-stock-hint');
    if (hint) hint.textContent = '';
  }
}

// Handle product change in Saídas form
function handleOutputItemChange(e) {
  const itemId = parseInt(e.target.value);
  const item = state.items.find(i => i.id === itemId);
  const sizeSelect = document.getElementById('output-size-select');
  const sizeGroup = document.getElementById('output-size-group');
  
  if (!item || !sizeSelect) return;
  
  sizeSelect.innerHTML = '';
  
  if (item.requires_sizes === 1) {
    sizeGroup.style.display = 'flex';
    sizeSelect.required = true;
    sizeSelect.innerHTML = '<option value="" disabled selected>Selecione o tamanho</option>';
    
    item.stock.forEach(s => {
      const option = document.createElement('option');
      option.value = s.size;
      option.textContent = `${s.size} (Disp: ${s.quantity})`;
      sizeSelect.appendChild(option);
    });
    
    // Clear hint until size is chosen
    const hint = document.getElementById('output-stock-hint');
    if (hint) hint.textContent = '';
  } else {
    sizeGroup.style.display = 'none';
    sizeSelect.required = false;
    sizeSelect.innerHTML = `<option value="U" selected>Único (Disp: ${item.total_quantity})</option>`;
    updateOutputStockHint(item, 'U');
  }
}

// Handle size change in Saídas form
function handleOutputSizeChange(e) {
  const itemId = parseInt(document.getElementById('output-item-select').value);
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  
  const size = e.target.value;
  updateOutputStockHint(item, size);
}

// Update output stock hint text (subtracting items currently staged in the cart)
function updateOutputStockHint(item, size) {
  const hint = document.getElementById('output-stock-hint');
  if (!hint) return;
  
  const stockObj = item.stock.find(s => s.size === size);
  const available = stockObj ? stockObj.quantity : 0;
  
  const cartItem = state.outputsCart.find(c => c.itemId === item.id && c.size === size);
  const cartQty = cartItem ? cartItem.quantity : 0;
  const remaining = available - cartQty;
  
  if (cartQty > 0) {
    hint.textContent = `Estoque disponível: ${available} unidade(s) (${remaining} restantes fora da sacola).`;
  } else {
    hint.textContent = `Estoque disponível: ${available} unidade(s).`;
  }
}

// Handle form submission to add an outflow item to the cart
function handleAddOutputSubmit(e) {
  e.preventDefault();
  
  const itemSelect = document.getElementById('output-item-select');
  const sizeSelect = document.getElementById('output-size-select');
  const qtyInput = document.getElementById('output-qty-input');
  
  if (!itemSelect || !sizeSelect || !qtyInput) return;
  
  const itemId = parseInt(itemSelect.value);
  const size = sizeSelect.value;
  const quantity = parseInt(qtyInput.value);
  
  if (!itemId || !size || isNaN(quantity) || quantity <= 0) {
    showToast('Dados inválidos. Preencha todos os campos corretamente.');
    return;
  }
  
  const item = state.items.find(i => i.id === itemId);
  if (!item) return;
  
  const stockObj = item.stock.find(s => s.size === size);
  const maxAvailable = stockObj ? stockObj.quantity : 0;
  
  // Calculate existing quantity of this item/size in the cart
  const existingIndex = state.outputsCart.findIndex(c => c.itemId === itemId && c.size === size);
  const cartQty = existingIndex !== -1 ? state.outputsCart[existingIndex].quantity : 0;
  
  if (cartQty + quantity > maxAvailable) {
    showToast(`Erro: Estoque insuficiente! Disponível: ${maxAvailable}, Na sacola: ${cartQty}`);
    return;
  }
  
  if (existingIndex !== -1) {
    state.outputsCart[existingIndex].quantity += quantity;
  } else {
    state.outputsCart.push({
      itemId,
      name: item.name,
      size,
      quantity
    });
  }
  
  showToast('Item adicionado à sacola!');
  qtyInput.value = 1;
  
  // Refresh cart rendering
  renderCart();
  
  // Update stock hint text to show remaining available
  updateOutputStockHint(item, size);
}

// Render cart contents in Saídas view
function renderCart() {
  const section = document.getElementById('outputs-cart-section');
  const container = document.getElementById('cart-items-container');
  if (!section || !container) return;
  
  if (state.outputsCart.length === 0) {
    section.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  
  section.classList.remove('hidden');
  container.innerHTML = '';
  
  state.outputsCart.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'cart-item-row';
    
    const sizeDesc = item.size === 'U' ? 'Tamanho Único' : `Tamanho ${item.size}`;
    
    row.innerHTML = `
      <div class="cart-item-info">
        <span class="cart-item-name">${item.name}</span>
        <span class="cart-item-details">${sizeDesc} <span class="cart-item-qty-badge">${item.quantity} un</span></span>
      </div>
      <button class="btn-cart-remove" onclick="removeFromCart(${index})">Remover</button>
    `;
    
    container.appendChild(row);
  });
}

// Remove item from cart list
function removeFromCart(index) {
  state.outputsCart.splice(index, 1);
  renderCart();
  
  // Trigger update to the dropdown hint
  const itemSelect = document.getElementById('output-item-select');
  if (itemSelect) {
    itemSelect.dispatchEvent(new Event('change'));
  }
  showToast('Item removido da sacola.');
}

// Submit all items in cart to the server as a batch
async function handleSubmitCart() {
  if (state.outputsCart.length === 0) return;
  
  showLoader();
  try {
    const payload = state.outputsCart.map(c => ({
      itemId: c.itemId,
      size: c.size,
      type: 'OUT',
      quantity: c.quantity
    }));
    
    const res = await fetch('/api/stock/adjust/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao finalizar saídas.');
    }
    
    showToast('Todas as saídas foram registradas com sucesso!');
    state.outputsCart = [];
    renderCart();
    
    // Refresh all lists and views
    await fetchItems();
    await fetchOutputsHistory();
    await fetchDashboard();
  } catch (error) {
    console.error('Error submitting batch outputs:', error);
    showToast(error.message || 'Erro ao processar sacola.');
  } finally {
    hideLoader();
  }
}

// Fetch and render the history of outputs
async function fetchOutputsHistory() {
  const container = document.getElementById('outputs-history-container');
  if (!container) return;
  
  try {
    const res = await fetch('/api/outputs');
    if (!res.ok) throw new Error('Failed to fetch output history');
    
    const outputs = await res.json();
    
    if (outputs.length === 0) {
      container.innerHTML = `
        <div class="timeline-empty" style="padding: 20px 10px;">
          <p>Nenhuma saída registrada recentemente.</p>
        </div>
      `;
      return;
    }
    
    container.innerHTML = '';
    outputs.forEach(m => {
      const isSizeU = m.size === 'U';
      const sizeDesc = isSizeU ? '' : ` (${m.size})`;
      
      // Format Date (HH:MM - DD/MM)
      const dateObj = new Date(m.timestamp);
      const time = dateObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const date = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      const div = document.createElement('div');
      div.className = 'timeline-item';
      
      div.innerHTML = `
        <div class="timeline-badge t-out">-${m.quantity}</div>
        <div class="timeline-info">
          <span class="timeline-title">${m.item_name}<span>${sizeDesc}</span></span>
          <span class="timeline-time">${time} - ${date}</span>
        </div>
      `;
      container.appendChild(div);
    });
  } catch (error) {
    console.error('Error fetching outputs history:', error);
    container.innerHTML = `<p style="color: var(--accent-out); font-size: 13px;">Erro ao carregar histórico.</p>`;
  }
}
