// Inventory Module
class InventoryManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.attachEventListeners();
    }
    
    attachEventListeners() {
        // Global inventory event listeners
        document.addEventListener('click', (e) => {
            // Handle edit button clicks (button or icon)
            const editBtn = e.target.closest('.edit-inventory-btn');
            if (editBtn) {
                const itemId = editBtn.getAttribute('data-item-id');
                this.editInventoryItem(itemId);
            }
            
            // Handle delete button clicks (button or icon)
            const deleteBtn = e.target.closest('.delete-inventory-btn');
            if (deleteBtn) {
                const itemId = deleteBtn.getAttribute('data-item-id');
                this.deleteInventoryItem(itemId);
            }
        });
    }
    
    // Inventory table management
    async refreshInventoryTable() {
        const tbody = document.getElementById('inventoryTableBody');
        if (!tbody) return;
        
        // Show loading state
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading inventory...</td></tr>';
        
        try {
            const data = await window.api.getInventory();
            
            if (!data || !data.success) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Error: ${window.utils.escapeHtml(data?.message || 'Failed to load inventory.')}</td></tr>`;
                return;
            }
            
            const inventory = data.inventory || [];
            if (inventory.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center">No inventory items found.</td></tr>';
                // Update summary with empty data
                this.updateInventorySummary([]);
                return;
            }
            
            this.renderInventoryTable(inventory);
            // Update summary cards with current inventory data
            this.updateInventorySummary(inventory);
            
        } catch (error) {
            console.error('Error loading inventory:', error);
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading inventory. Please try again.</td></tr>';
            window.utils.showNotification('Error loading inventory', 'error');
        }
    }
    
    renderInventoryTable(inventory) {
        const tbody = document.getElementById('inventoryTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = inventory.map(item => `
            <tr data-item-id="${item.id}">
                <td>${window.utils.escapeHtml(item.name || 'N/A')}</td>
                <td>${window.utils.escapeHtml(item.category || 'N/A')}</td>
                <td>
                    <span class="stock-badge ${parseInt(item.stock) <= 5 ? 'low-stock' : 'in-stock'}">
                        ${window.utils.formatNumber(item.stock || 0)}
                    </span>
                </td>
                <td>${window.utils.formatCurrency(item.price || 0)}</td>
                <td>${window.utils.escapeHtml(item.supplier || 'N/A')}</td>
                <td>
                    <span class="status-badge ${parseInt(item.stock) > 0 ? 'in-stock' : 'out-of-stock'}">
                        ${parseInt(item.stock) > 0 ? 'In Stock' : 'Out of Stock'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn secondary btn-sm edit-inventory-btn" data-item-id="${item.id}" title="Edit Item">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn danger btn-sm delete-inventory-btn" data-item-id="${item.id}" title="Delete Item">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // Inventory item management
    async editInventoryItem(itemId) {
        try {
            const data = await window.api.getInventoryItem(itemId);
            
            if (!data || !data.success) {
                window.utils.showNotification(data?.message || 'Error loading item details', 'error');
                return;
            }
            
            const item = data.item;
            
            // Populate the form
            document.getElementById('inventoryModalTitle').textContent = 'Edit Inventory Item';
            document.getElementById('inventoryId').value = itemId;
            document.getElementById('itemName').value = item.name || '';
            document.getElementById('itemQuantity').value = item.stock || 0;
            document.getElementById('itemPrice').value = item.price || 0;
            
            // Load categories and suppliers first, then set the values
            await Promise.all([
                this.loadCategoriesForDropdown(),
                this.loadSuppliersForDropdown()
            ]);
            
            // Set category value
            const categorySelect = document.getElementById('itemCategory');
            if (categorySelect) {
                categorySelect.value = item.category || '';
            }
            
            // Set supplier value
            const supplierSelect = document.getElementById('itemSupplier');
            if (supplierSelect) {
                supplierSelect.value = item.supplier || '';
            }
            
            // Show modal
            this.openInventoryModal();
            
        } catch (error) {
            console.error('Error loading item details:', error);
            window.utils.showNotification('Error loading item details', 'error');
        }
    }
    
    async deleteInventoryItem(itemId) {
        console.log('Starting delete for item:', itemId);
        
        if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
            console.log('Delete cancelled by user');
            return;
        }
        
        // Find the delete button and row for visual feedback
        const deleteBtn = document.querySelector(`.delete-inventory-btn[data-item-id="${itemId}"]`);
        const row = document.querySelector(`tr[data-item-id="${itemId}"]`);
        
        console.log('Found elements:', { deleteBtn: !!deleteBtn, row: !!row });
        
        // Show loading state on button
        if (deleteBtn) {
            const originalContent = deleteBtn.innerHTML;
            deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            deleteBtn.disabled = true;
        }
        
        // Dim the row
        if (row) {
            row.style.opacity = '0.5';
            row.style.pointerEvents = 'none';
        }
        
        try {
            console.log('Making API call to delete item:', itemId);
            const data = await window.api.deleteInventoryItem(itemId);
            console.log('API response:', data);
            
            if (data && data.success) {
                console.log('Delete successful, removing row');
                // Remove the row immediately for better UX
                if (row) {
                    row.remove();
                }
                
                window.utils.showNotification('Item deleted successfully', 'success');
                
                // Refresh the table to ensure consistency
                console.log('Refreshing table...');
                await this.refreshInventoryTable();
                console.log('Table refresh complete');
                
                // Refresh filter options
                this.refreshFilterOptions();
                
                // Refresh categories if on categories page
                if (document.getElementById('categoriesTableBody')) {
                    this.refreshCategories();
                }
            } else {
                console.log('Delete failed:', data);
                // Restore the row and button if deletion failed
                if (row) {
                    row.style.opacity = '1';
                    row.style.pointerEvents = 'auto';
                }
                if (deleteBtn) {
                    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                    deleteBtn.disabled = false;
                }
                
                const errorMessage = data ? (data.message || 'Error deleting item') : 'Error deleting item';
                window.utils.showNotification(errorMessage, 'error');
            }
            
        } catch (error) {
            console.error('Exception during delete:', error);
            // Restore the row and button if deletion failed
            if (row) {
                row.style.opacity = '1';
                row.style.pointerEvents = 'auto';
            }
            if (deleteBtn) {
                deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
                deleteBtn.disabled = false;
            }
            
            window.utils.showNotification('Error deleting item', 'error');
        }
    }
    
    // Modal management
    openInventoryModal() {
        const modal = document.getElementById('inventoryModal');
        if (modal) {
            modal.style.display = 'block';
            // Load dropdowns for new items
            this.loadCategoriesForDropdown();
            this.loadSuppliersForDropdown();
        }
    }
    
    closeInventoryModal() {
        const modal = document.getElementById('inventoryModal');
        if (modal) {
            modal.style.display = 'none';
            this.resetInventoryForm();
        }
    }
    
    resetInventoryForm() {
        const form = document.getElementById('inventoryForm');
        if (form) {
            form.reset();
        }
        
        document.getElementById('inventoryId').value = '';
        document.getElementById('inventoryModalTitle').textContent = 'Add Inventory Item';
    }
    
    // Form submission
    async handleInventoryFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const itemId = formData.get('inventoryId');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        window.utils.showLoading(submitBtn, 'Saving...');
        try {
            const itemData = {
                name: formData.get('itemName'),
                category: formData.get('itemCategory'),
                stock: parseInt(formData.get('itemQuantity')),
                price: parseFloat(formData.get('itemPrice')),
                supplier: formData.get('itemSupplier')
            };
            let data;
            if (itemId) {
                data = await window.api.updateInventoryItem(itemId, itemData);
            } else {
                data = await window.api.createInventoryItem(itemData);
            }
            if (data && data.success) {
                window.utils.showNotification(
                    itemId ? 'Item updated successfully' : 'Item created successfully',
                    'success'
                );
                this.closeInventoryModal();
                this.refreshInventoryTable();
                this.refreshFilterOptions();
                if (document.getElementById('categoriesTableBody')) {
                    this.refreshCategories();
                }
            } else {
                // Enhanced error logging
                console.error('Save inventory error:', data);
                const errorMessage = data ? (data.message || 'Error saving item') : 'Error saving item';
                window.utils.showNotification(errorMessage, 'error');
            }
        } catch (error) {
            // Enhanced error logging
            if (error.response) {
                error.response.text().then(text => {
                    console.error('Error saving item (response):', text);
                });
            }
            console.error('Error saving item (exception):', error);
            window.utils.showNotification('Error saving item', 'error');
        } finally {
            window.utils.hideLoading(submitBtn);
        }
    }
    
    // Dropdown loading
    async loadCategoriesForDropdown() {
        const select = document.getElementById('itemCategory');
        if (!select) return;
        
        try {
            const data = await window.api.getCategories();
            
            if (data && data.success) {
                const categories = data.categories || [];
                select.innerHTML = '<option value="">Select Category</option>' +
                    categories.map(cat => `<option value="${window.utils.escapeHtml(cat.name)}">${window.utils.escapeHtml(cat.name)}</option>`).join('');
            }
            
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }
    
    async loadSuppliersForDropdown() {
        const select = document.getElementById('itemSupplier');
        if (!select) return;
        
        try {
            const data = await window.api.getSuppliers();
            
            if (data && data.success) {
                const suppliers = data.suppliers || [];
                select.innerHTML = '<option value="">Select Supplier</option>' +
                    suppliers.map(supp => `<option value="${window.utils.escapeHtml(supp.name)}">${window.utils.escapeHtml(supp.name)}</option>`).join('');
            }
            
        } catch (error) {
            console.error('Error loading suppliers:', error);
        }
    }
    
    // Refresh filter options
    async refreshFilterOptions() {
        try {
            // Refresh categories
            const categoriesData = await window.api.getCategories();
            if (categoriesData && categoriesData.success) {
                const categoryFilter = document.getElementById('categoryFilter');
                if (categoryFilter) {
                    const categories = categoriesData.categories || [];
                    const currentValue = categoryFilter.value;
                    categoryFilter.innerHTML = '<option value="">All Categories</option>' +
                        categories.map(cat => `<option value="${window.utils.escapeHtml(cat.name)}">${window.utils.escapeHtml(cat.name)}</option>`).join('');
                    categoryFilter.value = currentValue;
                }
            }
            
            // Refresh suppliers
            const suppliersData = await window.api.getSuppliers();
            if (suppliersData && suppliersData.success) {
                const supplierFilter = document.getElementById('supplierFilter');
                if (supplierFilter) {
                    const suppliers = suppliersData.suppliers || [];
                    const currentValue = supplierFilter.value;
                    supplierFilter.innerHTML = '<option value="">All Suppliers</option>' +
                        suppliers.map(supp => `<option value="${window.utils.escapeHtml(supp.name)}">${window.utils.escapeHtml(supp.name)}</option>`).join('');
                    supplierFilter.value = currentValue;
                }
            }
            
        } catch (error) {
            console.error('Error refreshing filter options:', error);
        }
    }
    
    // Update inventory summary cards
    updateInventorySummary(inventory) {
        try {
            let totalItems = 0;
            let lowStockItems = 0;
            let outOfStockItems = 0;
            let totalValue = 0;
            
            inventory.forEach(item => {
                const stock = parseInt(item.stock) || 0;
                const price = parseFloat(item.price) || 0;
                
                totalItems++;
                totalValue += stock * price;
                
                if (stock === 0) {
                    outOfStockItems++;
                } else if (stock <= 5) {
                    lowStockItems++;
                }
            });
            
            // Update the summary cards
            const totalItemsElement = document.getElementById('totalItems');
            const lowStockItemsElement = document.getElementById('lowStockItems');
            const outOfStockItemsElement = document.getElementById('outOfStockItems');
            const totalValueElement = document.getElementById('totalValue');
            
            if (totalItemsElement) totalItemsElement.textContent = window.utils.formatNumber(totalItems);
            if (lowStockItemsElement) lowStockItemsElement.textContent = window.utils.formatNumber(lowStockItems);
            if (outOfStockItemsElement) outOfStockItemsElement.textContent = window.utils.formatNumber(outOfStockItems);
            if (totalValueElement) totalValueElement.textContent = window.utils.formatCurrency(totalValue);
            
        } catch (error) {
            console.error('Error updating inventory summary:', error);
        }
    }
    
    // Update inventory summary from visible table rows
    updateInventorySummaryFromVisible(visibleItems) {
        try {
            let totalItems = 0;
            let lowStockItems = 0;
            let outOfStockItems = 0;
            let totalValue = 0;
            
            visibleItems.forEach(item => {
                const stock = item.stock || 0;
                const price = item.price || 0;
                
                totalItems++;
                totalValue += stock * price;
                
                if (stock === 0) {
                    outOfStockItems++;
                } else if (stock <= 5) {
                    lowStockItems++;
                }
            });
            
            // Update the summary cards
            const totalItemsElement = document.getElementById('totalItems');
            const lowStockItemsElement = document.getElementById('lowStockItems');
            const outOfStockItemsElement = document.getElementById('outOfStockItems');
            const totalValueElement = document.getElementById('totalValue');
            
            if (totalItemsElement) totalItemsElement.textContent = window.utils.formatNumber(totalItems);
            if (lowStockItemsElement) lowStockItemsElement.textContent = window.utils.formatNumber(lowStockItems);
            if (outOfStockItemsElement) outOfStockItemsElement.textContent = window.utils.formatNumber(outOfStockItems);
            if (totalValueElement) totalValueElement.textContent = window.utils.formatCurrency(totalValue);
            
        } catch (error) {
            console.error('Error updating inventory summary from visible items:', error);
        }
    }
    
    // Suppliers management
    async refreshSuppliers() {
        const tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;
        
        // Show loading state
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Loading suppliers...</td></tr>';
        
        try {
            const data = await window.api.getSuppliers();
            
            if (!data || !data.success) {
                tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error: ${window.utils.escapeHtml(data?.message || 'Failed to load suppliers.')}</td></tr>`;
                return;
            }
            
            const suppliers = data.suppliers || [];
            if (suppliers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No suppliers found.</td></tr>';
                return;
            }
            
            this.renderSuppliersTable(suppliers);
            
        } catch (error) {
            console.error('Error loading suppliers:', error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading suppliers. Please try again.</td></tr>';
            window.utils.showNotification('Error loading suppliers', 'error');
        }
    }
    
    renderSuppliersTable(suppliers) {
        const tbody = document.getElementById('suppliersTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = suppliers.map(supplier => `
            <tr>
                <td>${window.utils.escapeHtml(supplier.name || 'N/A')}</td>
                <td>${window.utils.escapeHtml(supplier.contact_person || 'N/A')}</td>
                <td>${window.utils.escapeHtml(supplier.email || 'N/A')}</td>
                <td>${window.utils.escapeHtml(supplier.phone || 'N/A')}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn secondary btn-sm" onclick="window.inventoryManager.editSupplier('${supplier.id}')" title="Edit Supplier">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn danger btn-sm" onclick="window.inventoryManager.deleteSupplier('${supplier.id}')" title="Delete Supplier">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // Supplier management functions
    async editSupplier(supplierId) {
        try {
            const data = await window.api.getSupplier(supplierId);
            
            if (!data || !data.success) {
                window.utils.showNotification(data?.message || 'Error loading supplier details', 'error');
                return;
            }
            
            const supplier = data.supplier;
            
            // Populate the form
            document.getElementById('supplierModalTitle').textContent = 'Edit Supplier';
            document.getElementById('supplierId').value = supplierId;
            document.getElementById('supplierName').value = supplier.name || '';
            document.getElementById('contactPerson').value = supplier.contact_person || '';
            document.getElementById('contactNumber').value = supplier.phone || '';
            document.getElementById('supplierEmail').value = supplier.email || '';
            document.getElementById('supplierAddress').value = supplier.address || '';
            
            // Show modal
            const modal = document.getElementById('supplierModal');
            if (modal) {
                modal.style.display = 'block';
            }
            
        } catch (error) {
            console.error('Error loading supplier details:', error);
            window.utils.showNotification('Error loading supplier details', 'error');
        }
    }
    
    async deleteSupplier(supplierId) {
        if (!confirm('Are you sure you want to delete this supplier?')) {
            return;
        }
        
        try {
            const data = await window.api.deleteSupplier(supplierId);
            
            if (data && data.success) {
                window.utils.showNotification('Supplier deleted successfully', 'success');
                this.refreshSuppliers();
            } else {
                const errorMessage = data ? (data.message || 'Error deleting supplier') : 'Error deleting supplier';
                window.utils.showNotification(errorMessage, 'error');
            }
            
        } catch (error) {
            console.error('Error deleting supplier:', error);
            window.utils.showNotification('Error deleting supplier', 'error');
        }
    }
    
    // Supplier form submission
    async handleSupplierFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const supplierId = formData.get('supplierId');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Show loading state
        window.utils.showLoading(submitBtn, 'Saving...');
        
        try {
            const supplierData = {
                name: formData.get('supplierName'),
                contact_person: formData.get('contactPerson'),
                phone: formData.get('contactNumber'),
                email: formData.get('supplierEmail'),
                address: formData.get('supplierAddress')
            };
            
            let data;
            if (supplierId) {
                // Update existing supplier
                data = await window.api.updateSupplier(supplierId, supplierData);
            } else {
                // Create new supplier
                data = await window.api.createSupplier(supplierData);
            }
            
            if (data && data.success) {
                window.utils.showNotification(
                    supplierId ? 'Supplier updated successfully' : 'Supplier created successfully', 
                    'success'
                );
                this.closeSupplierModal();
                this.refreshSuppliers();
            } else {
                const errorMessage = data ? (data.message || 'Error saving supplier') : 'Error saving supplier';
                window.utils.showNotification(errorMessage, 'error');
            }
            
        } catch (error) {
            console.error('Error saving supplier:', error);
            window.utils.showNotification('Error saving supplier', 'error');
        } finally {
            // Hide loading state
            window.utils.hideLoading(submitBtn);
        }
    }
    
    closeSupplierModal() {
        const modal = document.getElementById('supplierModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('supplierForm').reset();
        }
        
        document.getElementById('supplierId').value = '';
        document.getElementById('supplierModalTitle').textContent = 'Add Supplier';
    }
    
    // Categories management
    async refreshCategories() {
        const tbody = document.getElementById('categoriesTableBody');
        if (!tbody) return;
        
        // Show loading state
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Loading categories...</td></tr>';
        
        try {
            const data = await window.api.getCategories();
            
            if (!data || !data.success) {
                tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">Error: ${window.utils.escapeHtml(data?.message || 'Failed to load categories.')}</td></tr>`;
                return;
            }
            
            const categories = data.categories || [];
            if (categories.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">No categories found.</td></tr>';
                return;
            }
            
            this.renderCategoriesTable(categories);
            
        } catch (error) {
            console.error('Error loading categories:', error);
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Error loading categories. Please try again.</td></tr>';
            window.utils.showNotification('Error loading categories', 'error');
        }
    }
    
    renderCategoriesTable(categories) {
        const tbody = document.getElementById('categoriesTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = categories.map(category => `
            <tr>
                <td>${window.utils.escapeHtml(category.name || 'N/A')}</td>
                <td>${window.utils.formatNumber(category.item_count || 0)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn secondary btn-sm" onclick="window.inventoryManager.editCategory('${category.id}')" title="Edit Category">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn danger btn-sm" onclick="window.inventoryManager.deleteCategory('${category.id}')" title="Delete Category">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    // Category management functions
    async editCategory(categoryId) {
        try {
            const data = await window.api.getCategory(categoryId);
            
            if (!data || !data.success) {
                window.utils.showNotification(data?.message || 'Error loading category details', 'error');
                return;
            }
            
            const category = data.category;
            
            // Populate the form
            document.getElementById('categoryModalTitle').textContent = 'Edit Category';
            document.getElementById('categoryId').value = categoryId;
            document.getElementById('categoryName').value = category.name || '';
            
            // Show modal
            const modal = document.getElementById('categoryModal');
            if (modal) {
                modal.style.display = 'block';
            }
            
        } catch (error) {
            console.error('Error loading category details:', error);
            window.utils.showNotification('Error loading category details', 'error');
        }
    }
    
    async deleteCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category?')) {
            return;
        }
        
        try {
            const data = await window.api.deleteCategory(categoryId);
            
            if (data && data.success) {
                window.utils.showNotification('Category deleted successfully', 'success');
                this.refreshCategories();
            } else {
                const errorMessage = data ? (data.message || 'Error deleting category') : 'Error deleting category';
                window.utils.showNotification(errorMessage, 'error');
            }
            
        } catch (error) {
            console.error('Error deleting category:', error);
            window.utils.showNotification('Error deleting category', 'error');
        }
    }
    
    // Category form submission
    async handleCategoryFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const categoryId = formData.get('categoryId');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Show loading state
        window.utils.showLoading(submitBtn, 'Saving...');
        
        try {
            const categoryData = {
                name: formData.get('categoryName')
            };
            
            let data;
            if (categoryId) {
                // Update existing category
                data = await window.api.updateCategory(categoryId, categoryData);
            } else {
                // Create new category
                data = await window.api.createCategory(categoryData);
            }
            
            if (data && data.success) {
                window.utils.showNotification(
                    categoryId ? 'Category updated successfully' : 'Category created successfully', 
                    'success'
                );
                this.closeCategoryModal();
                this.refreshCategories();
            } else {
                const errorMessage = data ? (data.message || 'Error saving category') : 'Error saving category';
                window.utils.showNotification(errorMessage, 'error');
            }
            
        } catch (error) {
            console.error('Error saving category:', error);
            window.utils.showNotification('Error saving category', 'error');
        } finally {
            // Hide loading state
            window.utils.hideLoading(submitBtn);
        }
    }
    
    closeCategoryModal() {
        const modal = document.getElementById('categoryModal');
        if (modal) {
            modal.style.display = 'none';
            document.getElementById('categoryForm').reset();
        }
        
        document.getElementById('categoryId').value = '';
        document.getElementById('categoryModalTitle').textContent = 'Add Category';
    }
}

// Global inventory manager instance
window.inventoryManager = new InventoryManager(); 