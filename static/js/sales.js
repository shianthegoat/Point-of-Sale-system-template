// Sales Module
class SalesManager {
    constructor() {
        this.cart = [];
        console.log('[Make Sale] SalesManager instance created:', this);
        this.init();
    }
    
    init() {
        this.attachEventListeners();
    }
    
    attachEventListeners() {
        // Prevent double event binding
        if (SalesManager._eventListenersAttached) return;
        SalesManager._eventListenersAttached = true;
        // Global sales event listeners
        document.addEventListener('click', (e) => {
            if (e.target.matches('.add-to-cart-btn')) {
                const itemId = e.target.getAttribute('data-item-id');
                this.addToCart(itemId);
            }
            if (e.target.matches('.quantity-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const itemId = e.target.getAttribute('data-item-id');
                const action = e.target.getAttribute('data-action');
                this.updateQuantity(itemId, action);
            }
        });
    }
    
    // Sales history management
    async refreshSales() {
        const tbody = document.getElementById('salesTableBody');
        if (!tbody) return;
        
        // Show loading state
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading sales history...</td></tr>';
        
        try {
            const data = await window.api.getSales();
            
            if (!data || !data.success) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${window.utils.escapeHtml(data?.message || 'Failed to load sales history.')}</td></tr>`;
                return;
            }
            
            const sales = data.sales || [];
            if (sales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No sales found.</td></tr>';
                // Update summary with empty data
                this.updateSalesSummary([]);
                return;
            }
            
            this.renderSalesTable(sales);
            
        } catch (error) {
            console.error('Error loading sales:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading sales history. Please try again.</td></tr>';
            window.utils.showNotification('Error loading sales history', 'error');
        }
    }
    
    // Refresh sales with filters
    async refreshSalesWithFilters(filters, page = 1) {
        const tbody = document.getElementById('salesTableBody');
        if (!tbody) return;
        
        // Show loading state
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading filtered sales...</td></tr>';
        
        try {
            const data = await window.api.getFilteredSales(filters, page);
            
            if (!data || !data.success) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${window.utils.escapeHtml(data?.message || 'Failed to load filtered sales.')}</td></tr>`;
                return;
            }
            
            const sales = data.sales || [];
            if (sales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No sales found with the selected filters.</td></tr>';
                // Update summary with empty data
                this.updateSalesSummary([]);
                // Update pagination
                if (window.updatePagination) {
                    window.updatePagination(0);
                }
                return;
            }
            
            this.renderSalesTable(sales);
            
            // Update summary cards with filtered totals (not just current page)
            this.updateSalesSummaryFromFilteredData(data);
            
            // Update pagination
            if (window.updatePagination) {
                window.updatePagination(data.total, data.limit);
            }
            
        } catch (error) {
            console.error('Error loading filtered sales:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading filtered sales. Please try again.</td></tr>';
            window.utils.showNotification('Error loading filtered sales', 'error');
        }
    }
    
    renderSalesTable(sales) {
        const tbody = document.getElementById('salesTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = sales.map(sale => `
            <tr>
                <td>${window.utils.escapeHtml(sale.date || 'N/A')}</td>
                <td>
                    <span class="customer-name">
                        ${window.utils.escapeHtml(sale.customer_name || 'Walk-in Customer')}
                    </span>
                </td>
                <td>
                    <div class="items-summary" title="${window.utils.escapeHtml(sale.items_display || '')}">
                        ${window.utils.escapeHtml(sale.items_display || 'No items')}
                    </div>
                </td>
                <td>
                    <span class="sale-total">
                        ${window.utils.formatCurrency(sale.total || 0)}
                    </span>
                </td>
                <td>
                    <span class="salesperson-name">
                        ${window.utils.escapeHtml(sale.staff_name || 'Unknown')}
                    </span>
                </td>
            </tr>
        `).join('');
        
        // Update summary cards with sales data
        this.updateSalesSummary(sales);
    }
    
    // Update sales summary cards
    updateSalesSummary(sales) {
        try {
            let totalSalesAmount = 0;
            let totalTransactions = 0;
            let averageOrder = 0;
            
            sales.forEach(sale => {
                const total = parseFloat(sale.total) || 0;
                totalSalesAmount += total;
                totalTransactions++;
            });
            
            // Calculate average order value
            averageOrder = totalTransactions > 0 ? totalSalesAmount / totalTransactions : 0;
            
            // Update the summary cards
            const totalSalesAmountElement = document.getElementById('totalSalesAmount');
            const totalTransactionsElement = document.getElementById('totalTransactions');
            const averageOrderElement = document.getElementById('averageOrder');
            
            if (totalSalesAmountElement) totalSalesAmountElement.textContent = window.utils.formatCurrency(totalSalesAmount);
            if (totalTransactionsElement) totalTransactionsElement.textContent = window.utils.formatNumber(totalTransactions);
            if (averageOrderElement) averageOrderElement.textContent = window.utils.formatCurrency(averageOrder);
            
        } catch (error) {
            console.error('Error updating sales summary:', error);
        }
    }
    
    // Dashboard recent sales
    async loadRecentSalesActivity() {
        // Check if we're on dashboard (table format) or sales page (list format)
        const tableContainer = document.getElementById('recentSalesTable');
        const listContainer = document.getElementById('recentSalesList');
        
        if (!tableContainer && !listContainer) {
            console.warn('[SalesManager] No recent sales container found');
            return;
        }
        
        try {
            const data = await window.api.getRecentSales();
            
            if (!data || !data.success) {
                const errorMsg = 'Error loading recent sales';
                if (tableContainer) {
                    tableContainer.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${errorMsg}</td></tr>`;
                }
                if (listContainer) {
                    listContainer.innerHTML = `<div class="empty-state">${errorMsg}</div>`;
                }
                return;
            }
            
            const sales = data.sales || [];
            if (sales.length === 0) {
                const emptyMsg = 'No recent sales';
                if (tableContainer) {
                    tableContainer.innerHTML = `<tr><td colspan="4" class="text-center">${emptyMsg}</td></tr>`;
                }
                if (listContainer) {
                    listContainer.innerHTML = `<div class="empty-state">${emptyMsg}</div>`;
                }
                return;
            }
            
            // Render the recent sales (already limited to 5 from the API)
            this.renderRecentSales(sales);
            
        } catch (error) {
            console.error('Error loading recent sales:', error);
            const errorMsg = 'Error loading recent sales';
            if (tableContainer) {
                tableContainer.innerHTML = `<tr><td colspan="4" class="text-center text-danger">${errorMsg}</td></tr>`;
            }
            if (listContainer) {
                listContainer.innerHTML = `<div class="empty-state">${errorMsg}</div>`;
            }
        }
    }
    
    renderRecentSales(sales) {
        // Check if we're on dashboard (table format) or sales page (list format)
        const tableContainer = document.getElementById('recentSalesTable');
        const listContainer = document.getElementById('recentSalesList');
        
        if (tableContainer) {
            // Dashboard table format
            if (!sales || sales.length === 0) {
                tableContainer.innerHTML = '<tr><td colspan="4" class="text-center">No recent sales</td></tr>';
                return;
            }
            
            tableContainer.innerHTML = sales.map(sale => `
                <tr>
                    <td>${window.utils.formatDate(sale.date)}</td>
                    <td>${window.utils.escapeHtml(sale.customer_name || 'Walk-in Customer')}</td>
                    <td>
                        <div>${window.utils.escapeHtml(sale.items_display || 'No items')}</div>
                        <div class="sale-amount">${window.utils.formatCurrency(sale.total || 0)}</div>
                    </td>
                    <td>${window.utils.escapeHtml(sale.staff_name || 'Unknown')}</td>
                </tr>
            `).join('');
        } else if (listContainer) {
            // Sales page list format
            if (!sales || sales.length === 0) {
                listContainer.innerHTML = '<div class="empty-state">No recent sales</div>';
                return;
            }
            
            listContainer.innerHTML = sales.map(sale => `
                <div class="recent-sale-item">
                    <div class="sale-info">
                        <div class="sale-customer">
                            <i class="fas fa-user"></i>
                            <span>${window.utils.escapeHtml(sale.customer_name || 'Walk-in Customer')}</span>
                        </div>
                        <div class="sale-details">
                            <div class="sale-amount">${window.utils.formatCurrency(sale.total || 0)}</div>
                            <div class="sale-date">${window.utils.formatDate(sale.date)}</div>
                        </div>
                    </div>
                    <div class="sale-salesperson">
                        <i class="fas fa-user-tie"></i>
                        <span>${window.utils.escapeHtml(sale.staff_name || 'Unknown')}</span>
                    </div>
                </div>
            `).join('');
        }
    }
    
    // Make sale functionality
    async refreshSaleInventory() {
        const container = document.getElementById('itemsCategories');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading inventory...</div>';
        
        try {
            const data = await window.api.getInventory();
            
            if (!data || !data.success) {
                container.innerHTML = '<div class="empty-state">Error loading inventory</div>';
                return;
            }
            
            const inventory = data.inventory || [];
            if (inventory.length === 0) {
                container.innerHTML = '<div class="empty-state">No inventory items found</div>';
                return;
            }
            
            this.renderSaleInventory(inventory);
            
        } catch (error) {
            console.error('Error loading sale inventory:', error);
            container.innerHTML = '<div class="empty-state">Error loading inventory</div>';
            window.utils.showNotification('Error loading inventory', 'error');
        }
    }
    
    renderSaleInventory(inventory) {
        const container = document.getElementById('itemsCategories');
        if (!container) return;
        
        // Group items by category
        const categories = {};
        inventory.forEach(item => {
            const category = item.category || 'Uncategorized';
            if (!categories[category]) {
                categories[category] = [];
            }
            categories[category].push(item);
        });
        
        const categoriesHTML = Object.keys(categories).map(category => {
            const items = categories[category];
            const itemsHTML = items.map(item => this.createItemCard(item)).join('');
            
            return `
                <div class="category-section">
                    <div class="category-header" onclick="this.parentElement.querySelector('.category-items').classList.toggle('collapsed')">
                        <h3>${window.utils.escapeHtml(category)}</h3>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="category-items">
                        ${itemsHTML}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = categoriesHTML;
    }
    
    createItemCard(item) {
        const stockStatus = parseInt(item.stock) > 0 ? 'in-stock' : 'out-of-stock';
        const stockColor = parseInt(item.stock) <= 5 ? 'low-stock' : 'in-stock';
        
        return `
            <div class="item-card">
                <div class="item-info">
                    <div class="item-name">${window.utils.escapeHtml(item.name)}</div>
                    <div class="item-details">
                        <span class="item-price">${window.utils.formatCurrency(item.price)}</span>
                        <span class="item-stock ${stockColor}">Stock: ${window.utils.formatNumber(item.stock)}</span>
                    </div>
                </div>
                <div class="item-actions">
                    <div class="quantity-controls">
                        <button class="quantity-btn" data-item-id="${item.id}" data-action="decrease" ${parseInt(item.stock) === 0 ? 'disabled' : ''}>-</button>
                        <span class="quantity-display" id="quantity-${item.id}">0</span>
                        <button class="quantity-btn" data-item-id="${item.id}" data-action="increase" ${parseInt(item.stock) === 0 ? 'disabled' : ''}>+</button>
                    </div>
                    <button class="add-to-cart-btn" data-item-id="${item.id}" ${parseInt(item.stock) === 0 ? 'disabled' : ''}>
                        Add to Cart
                    </button>
                </div>
            </div>
        `;
    }
    
    // Cart management
    addToCart(itemId) {
        const quantityElement = document.getElementById(`quantity-${itemId}`);
        const quantity = parseInt(quantityElement.textContent) || 0;
        if (quantity <= 0) {
            window.utils.showNotification('Please select a quantity first', 'error');
            return;
        }
        // Find item in inventory
        const itemCard = document.querySelector(`[data-item-id="${itemId}"]`).closest('.item-card');
        const itemName = itemCard.querySelector('.item-name').textContent;
        const itemPrice = parseFloat(itemCard.querySelector('.item-price').textContent.replace(/[₱,]/g, ''));
        // Check if item already in cart
        const existingItem = this.cart.find(item => item.id === itemId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            this.cart.push({
                id: itemId,
                name: itemName,
                price: itemPrice,
                quantity: quantity
            });
        }
        // Reset quantity display
        quantityElement.textContent = '0';
        // Update cart display
        this.updateCartDisplay();
        window.utils.showNotification(`${quantity}x ${itemName} added to cart`, 'success');
        console.log('[Make Sale] Cart after addToCart:', JSON.stringify(this.cart));
    }
    
    updateQuantity(itemId, action) {
        const quantityElement = document.getElementById(`quantity-${itemId}`);
        let quantity = parseInt(quantityElement.textContent) || 0;
        console.log('[Make Sale] updateQuantity called:', {itemId, action, before: quantity});
        if (action === 'increase') {
            quantity++;
        } else if (action === 'decrease') {
            quantity = Math.max(0, quantity - 1);
        }
        quantityElement.textContent = quantity;
        console.log('[Make Sale] updateQuantity after:', {itemId, action, after: quantity});
        // No backend inventory update here; inventory is updated after sale is completed.
    }
    
    updateCartDisplay() {
        const container = document.getElementById('cartItems');
        if (!container) return;
        
        if (this.cart.length === 0) {
            container.innerHTML = '<div class="empty-cart">Cart is empty</div>';
            document.getElementById('cartSubtotal').textContent = '₱0.00';
            document.getElementById('cartTax').textContent = '₱0.00';
            document.getElementById('cartTotal').textContent = '₱0.00';
            return;
        }
        
        const cartHTML = this.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <div class="cart-item-name">${window.utils.escapeHtml(item.name)}</div>
                    <div class="cart-item-price">${window.utils.formatCurrency(item.price)} x ${window.utils.formatNumber(item.quantity)}</div>
                </div>
                <div class="cart-item-actions">
                    <button class="action-btn danger btn-sm" onclick="window.salesManager.removeFromCart('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = cartHTML;
        
        // Calculate subtotal, tax, and total
        const subtotal = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const tax = subtotal * 0.12;
        const total = subtotal + tax;
        document.getElementById('cartSubtotal').textContent = window.utils.formatCurrency(subtotal);
        document.getElementById('cartTax').textContent = window.utils.formatCurrency(tax);
        document.getElementById('cartTotal').textContent = window.utils.formatCurrency(total);
    }
    
    removeFromCart(itemId) {
        console.log('[Make Sale] removeFromCart called with:', itemId);
        this.cart = this.cart.filter(item => item.id !== itemId);
        this.updateCartDisplay();
        window.utils.showNotification('Item removed from cart', 'info');
        console.log('[Make Sale] Cart after removeFromCart:', JSON.stringify(this.cart));
    }
    
    clearCart() {
        this.cart = [];
        this.updateCartDisplay();
        window.utils.showNotification('Cart cleared', 'info');
    }
    
    async completeSale() {
        console.log('[Make Sale] Cart at completeSale:', JSON.stringify(this.cart));
        if (this.cart.length === 0) {
            window.utils.showNotification('Cart is empty', 'error');
            console.error('[Make Sale] Attempted to complete sale with empty cart:', this.cart);
            return;
        }
        
        // Validate customer information
        const customerType = document.querySelector('input[name="customerType"]:checked').value;
        const customerNameDropdown = document.getElementById('customerNameDropdown');
        const customerNameInput = document.getElementById('customerNameInput');
        const validationMessage = document.getElementById('customerValidationMessage');
        
        let customerName = '';
        
        if (customerType === 'existing') {
            customerName = customerNameDropdown.value.trim();
        } else {
            customerName = customerNameInput.value.trim();
        }
        
        // Check for validation errors
        if (customerNameInput.classList.contains('error') || customerNameDropdown.classList.contains('error')) {
            window.utils.showNotification('Please fix customer validation errors before completing the sale.', 'error');
            return;
        }
        
        // Validate customer type and name
        if (customerType === 'new' && customerName.length === 0) {
            window.utils.showNotification('Please enter a customer name for new customers.', 'error');
            customerNameInput.focus();
            return;
        }
        
        if (customerType === 'existing' && customerName.length === 0) {
            window.utils.showNotification('Please select an existing customer.', 'error');
            customerNameDropdown.focus();
            return;
        }
        
        // For existing customers, ensure the customer exists
        if (customerType === 'existing' && customerName.length > 0) {
            try {
                const data = await window.api.getCustomers();
                if (data && data.success) {
                    const customers = data.customers || [];
                    const existingCustomer = customers.find(customer => 
                        customer.name.toLowerCase() === customerName.toLowerCase()
                    );
                    
                    if (!existingCustomer) {
                        window.utils.showNotification('Customer not found. Please select a valid existing customer.', 'error');
                        customerNameDropdown.focus();
                        return;
                    }
                }
            } catch (error) {
                console.error('Error validating existing customer:', error);
                window.utils.showNotification('Error validating customer. Please try again.', 'error');
                return;
            }
        }
        
        const finalCustomerName = customerName || 'Walk-in Customer';
        const saleData = {
            customerName: finalCustomerName,
            customerType: customerType,
            items: this.cart.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                quantity: item.quantity
            })),
            total: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };
        
        try {
            const data = await window.api.createSale(saleData);
            if (data && data.success) {
                window.utils.showNotification('Sale completed successfully!', 'success');
                this.clearCart();
                
                // Reset customer form
                customerNameInput.value = '';
                customerNameDropdown.value = '';
                validationMessage.textContent = '';
                validationMessage.className = 'customer-validation-message';
                customerNameInput.classList.remove('error');
                customerNameDropdown.classList.remove('error');
                
                // Reset customer type to existing
                document.getElementById('existingCustomer').checked = true;
                customerNameDropdown.style.display = 'block';
                customerNameInput.style.display = 'none';
                
                // Refresh customer dropdown to include any new customers
                if (typeof loadExistingCustomers === 'function') {
                    loadExistingCustomers();
                } else if (window.refreshCustomerDropdown) {
                    window.refreshCustomerDropdown();
                }
                
                // Refresh sales data
                this.refreshSales();
                this.loadRecentSalesActivity();
                // Refresh inventory after sale
                this.refreshSaleInventory();
            } else {
                const errorMessage = data ? (data.message || 'Error completing sale') : 'Error completing sale';
                window.utils.showNotification(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error completing sale:', error);
            window.utils.showNotification('Error completing sale', 'error');
        }
        console.log('[Make Sale] Cart at end of completeSale:', JSON.stringify(this.cart));
    }
    
    // Update summary cards with filtered totals (not just current page)
    updateSalesSummaryFromFilteredData(data) {
        try {
            const summary = data.summary || {};
            const totalSalesAmount = summary.total_sales_amount || 0;
            const totalTransactions = summary.total_transactions || 0;
            const averageOrder = summary.average_order || 0;
            
            // Update the summary cards
            const totalSalesAmountElement = document.getElementById('totalSalesAmount');
            const totalTransactionsElement = document.getElementById('totalTransactions');
            const averageOrderElement = document.getElementById('averageOrder');
            
            if (totalSalesAmountElement) totalSalesAmountElement.textContent = window.utils.formatCurrency(totalSalesAmount);
            if (totalTransactionsElement) totalTransactionsElement.textContent = window.utils.formatNumber(totalTransactions);
            if (averageOrderElement) averageOrderElement.textContent = window.utils.formatCurrency(averageOrder);
            
        } catch (error) {
            console.error('Error updating sales summary from filtered data:', error);
        }
    }
} 