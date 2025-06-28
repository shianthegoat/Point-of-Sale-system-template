// API Module - Handles all HTTP requests
class API {
    constructor() {
        this.baseURL = '';
        this.init();
    }
    
    init() {
        // Initialize API configuration
    }
    
    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin' // Include cookies for session
        };
        
        const config = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };
        
        try {
            const response = await fetch(url, config);
            
            // Handle session expiration
            if (response.status === 401) {
                window.utils.showNotification('Session expired. Please login again.', 'error');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
                return null;
            }
            
            // Handle other errors
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('API request failed:', error);
            window.utils.showNotification('Network error. Please try again.', 'error');
            return null;
        }
    }
    
    // GET request
    async get(endpoint) {
        return this.request(endpoint, {
            method: 'GET'
        });
    }
    
    // POST request
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }
    
    // PUT request
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }
    
    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, {
            method: 'DELETE'
        });
    }
    
    // POST with FormData (for file uploads)
    async postFormData(endpoint, formData) {
        return this.request(endpoint, {
            method: 'POST',
            body: formData,
            headers: {} // Let browser set Content-Type for FormData
        });
    }
    
    // Sales API methods
    async getSales() {
        return this.get('/api/sales');
    }
    
    async getRecentSales() {
        return this.get('/api/sales/recent');
    }
    
    async getTopSellingItems(limit = 5, period = 'all') {
        const params = new URLSearchParams({
            limit: limit.toString(),
            period: period
        });
        return this.get(`/api/sales/top-items?${params}`);
    }
    
    async getFilteredSales(filters, page = 1) {
        const params = new URLSearchParams({
            page: page.toString(),
            ...filters
        });
        return this.get(`/api/sales/filtered?${params}`);
    }
    
    async createSale(saleData) {
        return this.post('/api/sales', saleData);
    }
    
    async updateSale(saleId, saleData) {
        return this.put(`/api/sales/${saleId}`, saleData);
    }
    
    async deleteSale(saleId) {
        return this.delete(`/api/sales/${saleId}`);
    }
    
    // Inventory API methods
    async getInventory() {
        return this.get('/api/inventory');
    }
    
    async getInventoryBySupplier(supplierName) {
        return this.get(`/api/inventory/supplier/${encodeURIComponent(supplierName)}`);
    }
    
    async createInventoryItem(itemData) {
        return this.post('/api/inventory', itemData);
    }
    
    async updateInventoryItem(itemId, itemData) {
        return this.put(`/api/inventory/${itemId}`, itemData);
    }
    
    async deleteInventoryItem(itemId) {
        return this.delete(`/api/inventory/${itemId}`);
    }
    
    async getInventoryItem(itemId) {
        return this.get(`/api/inventory/${itemId}`);
    }
    
    // Customers API methods
    async getCustomers() {
        return this.get('/api/customers');
    }
    
    async getCustomerProfile(customerName) {
        return this.get(`/api/customers/${encodeURIComponent(customerName)}`);
    }
    
    async updateCustomerProfile(formData) {
        return this.postFormData('/api/customers/update', formData);
    }
    
    async getCustomerSales(customerName, page = 1, limit = 20) {
        return this.get(`/api/customers/${encodeURIComponent(customerName)}/sales?page=${page}&limit=${limit}`);
    }
    
    // Suppliers API methods
    async getSuppliers() {
        return this.get('/api/suppliers');
    }
    
    async getSupplier(supplierId) {
        return this.get(`/api/suppliers/${supplierId}`);
    }
    
    async createSupplier(supplierData) {
        return this.post('/api/suppliers', supplierData);
    }
    
    async updateSupplier(supplierId, supplierData) {
        return this.put(`/api/suppliers/${supplierId}`, supplierData);
    }
    
    async deleteSupplier(supplierId) {
        return this.delete(`/api/suppliers/${supplierId}`);
    }
    
    // Categories API methods
    async getCategories() {
        return this.get('/api/categories');
    }
    
    async getCategory(categoryId) {
        return this.get(`/api/categories/${categoryId}`);
    }
    
    async createCategory(categoryData) {
        return this.post('/api/categories', categoryData);
    }
    
    async updateCategory(categoryId, categoryData) {
        return this.put(`/api/categories/${categoryId}`, categoryData);
    }
    
    async deleteCategory(categoryId) {
        return this.delete(`/api/categories/${categoryId}`);
    }
    
    // Users API methods
    async getUsers() {
        return this.get('/api/users');
    }
    
    async createUser(userData) {
        return this.post('/api/users', userData);
    }
    
    async updateUser(userId, userData) {
        return this.put(`/api/users/${userId}`, userData);
    }
    
    async deleteUser(userId) {
        return this.delete(`/api/users/${userId}`);
    }
    
    // Error handling
    handleError(error, context = 'operation') {
        console.error(`Error during ${context}:`, error);
        
        let message = 'An error occurred. Please try again.';
        
        if (error.response) {
            // Server responded with error status
            const status = error.response.status;
            switch (status) {
                case 400:
                    message = 'Invalid request. Please check your input.';
                    break;
                case 401:
                    message = 'Session expired. Please login again.';
                    break;
                case 403:
                    message = 'Access denied. You don\'t have permission.';
                    break;
                case 404:
                    message = 'Resource not found.';
                    break;
                case 500:
                    message = 'Server error. Please try again later.';
                    break;
                default:
                    message = `Server error (${status}). Please try again.`;
            }
        } else if (error.request) {
            // Network error
            message = 'Network error. Please check your connection.';
        }
        
        window.utils.showNotification(message, 'error');
        return null;
    }
    
    // Retry mechanism for failed requests
    async retryRequest(requestFn, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                
                console.warn(`Request failed (attempt ${attempt}/${maxRetries}), retrying...`);
                await this.sleep(delay * attempt); // Exponential backoff
            }
        }
    }
    
    // Utility method for delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global API instance
window.api = new API(); 