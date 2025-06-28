// Customers Module
class CustomerManager {
    constructor() {
        this.currentCustomerProfile = null;
        this.init();
    }
    
    init() {
        this.attachEventListeners();
    }
    
    attachEventListeners() {
        // Global customer event listeners
        document.addEventListener('click', (e) => {
            if (e.target.matches('.view-profile-btn')) {
                const customerName = e.target.getAttribute('data-customer');
                this.showCustomerProfile(customerName);
            }
        });
    }
    
    // Customer list management
    async refreshCustomers() {
        const container = document.getElementById('customersContainer');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading customers...</div>';
        
        try {
            const data = await window.api.getCustomers();
            
            if (!data || !data.success) {
                container.innerHTML = '<div class="empty-state">Error loading customers</div>';
                return;
            }
            
            const customers = data.customers || [];
            if (customers.length === 0) {
                container.innerHTML = '<div class="empty-state">No customers found</div>';
                return;
            }
            
            this.renderCustomersList(customers);
            
        } catch (error) {
            console.error('Error loading customers:', error);
            container.innerHTML = '<div class="empty-state">Error loading customers</div>';
            window.utils.showNotification('Error loading customers', 'error');
        }
    }
    
    renderCustomersList(customers) {
        const container = document.getElementById('customersContainer');
        if (!container) return;
        
        // Sort customers alphabetically by name
        customers.sort((a, b) => a.name.localeCompare(b.name));
        
        // Group customers by first letter
        const groupedCustomers = {};
        customers.forEach(customer => {
            const firstLetter = customer.name.charAt(0).toUpperCase();
            if (!groupedCustomers[firstLetter]) {
                groupedCustomers[firstLetter] = [];
            }
            groupedCustomers[firstLetter].push(customer);
        });
        
        // Create HTML for grouped customers
        const groupedHTML = Object.keys(groupedCustomers).sort().map(letter => {
            const customersInGroup = groupedCustomers[letter];
            const customersHTML = customersInGroup.map(customer => this.createCustomerCard(customer)).join('');
            
            return `
                <div class="customer-category-section">
                    <div class="customer-category-header" onclick="this.parentElement.querySelector('.customer-category-items').classList.toggle('collapsed')">
                        <span class="category-title"><b>${letter}</b></span>
                        <i class="fas fa-chevron-down"></i>
                    </div>
                    <div class="customer-category-items">
                        ${customersHTML}
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = groupedHTML;
    }
    
    createCustomerCard(customer) {
        const age = customer.age || 'N/A';
        const sex = customer.sex || 'N/A';
        const address = customer.address || 'N/A';
        const profileUrl = `/customer_profile?name=${encodeURIComponent(customer.name)}`;
        const profilePic = customer.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.name)}&background=3498db&color=fff&size=64`;
        return `
            <div class="customer-item-card">
                <div class="customer-item-main">
                    <img class="customer-card-pic" src="${profilePic}" alt="Profile Picture" />
                    <div class="customer-info-block">
                        <div class="customer-info-row">
                            <span class="customer-item-name">${window.utils.escapeHtml(customer.name)}</span>,
                            <span class="customer-item-age">${age}</span>
                        </div>
                        <div class="customer-info-row">
                            <span class="customer-item-label">Sex:</span> <span class="customer-item-value">${sex}</span>
                        </div>
                        <div class="customer-info-row">
                            <span class="customer-item-label">Address:</span> <span class="customer-item-value">${address}</span>
                        </div>
                        <div class="customer-info-row">
                            <a class="view-profile-btn" href="${profileUrl}">
                                <i class='fas fa-user'></i> View Profile
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Customer profile management
    async showCustomerProfile(customerName) {
        this.currentCustomerProfile = customerName;
        
        // Hide all sections and show customer profile
        window.posApp.hideAllSections();
        const profileSection = document.getElementById('customer-profile');
        if (profileSection) {
            profileSection.style.display = 'block';
        }
        
        window.posApp.updateNavigationActiveState('customer-profile');
        
        // Load customer profile data
        await this.loadCustomerProfileData(customerName);
    }
    
    async loadCustomerProfileData(customerName) {
        const container = document.getElementById('customerProfileContainer');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="loading-state"><i class="fas fa-spinner fa-spin"></i> Loading profile...</div>';
        
        try {
            const data = await window.api.getCustomerProfile(customerName);
            
            if (!data || !data.success) {
                container.innerHTML = '<div class="empty-state">Error loading customer profile</div>';
                return;
            }
            
            this.renderCustomerProfile(data.customer);
            
        } catch (error) {
            console.error('Error loading customer profile:', error);
            container.innerHTML = '<div class="empty-state">Error loading customer profile</div>';
            window.utils.showNotification('Error loading customer profile', 'error');
        }
    }
    
    renderCustomerProfile(customer) {
        const container = document.getElementById('customerProfileContainer');
        if (!container) return;
        
        const totalSpent = window.utils.formatCurrency(customer.total_spent || 0);
        const avgOrderValue = window.utils.formatCurrency(customer.avg_order_value || 0);
        const firstPurchase = customer.first_purchase ? window.utils.formatDate(customer.first_purchase) : 'N/A';
        const lastPurchase = customer.last_purchase ? window.utils.formatDate(customer.last_purchase) : 'N/A';
        
        container.innerHTML = `
            <div class="customer-profile-header">
                <div class="customer-profile-avatar">
                    ${customer.profile_picture ? 
                        `<img src="${customer.profile_picture}" alt="Profile Picture" class="profile-picture">` :
                        `<span class="profile-avatar-text">${customer.name.charAt(0).toUpperCase()}</span>`
                    }
                </div>
                <div class="customer-profile-info">
                    <h2 class="customer-profile-name">${window.utils.escapeHtml(customer.name)}</h2>
                    <div class="customer-profile-meta">
                        <span><i class="fas fa-shopping-cart"></i> ${customer.total_sales || 0} purchases</span>
                        <span><i class="fas fa-money-bill-wave"></i> ${totalSpent} total spent</span>
                    </div>
                    <div class="customer-additional-info">
                        ${customer.age ? `<span><i class="fas fa-birthday-cake"></i> Age: ${customer.age}</span>` : ''}
                        ${customer.sex ? `<span><i class="fas fa-venus-mars"></i> ${customer.sex}</span>` : ''}
                        ${customer.phone ? `<span><i class="fas fa-phone"></i> ${window.utils.escapeHtml(customer.phone)}</span>` : ''}
                        ${customer.email ? `<span><i class="fas fa-envelope"></i> ${window.utils.escapeHtml(customer.email)}</span>` : ''}
                    </div>
                    ${customer.address ? `
                        <div class="customer-address">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${window.utils.escapeHtml(customer.address)}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="customer-profile-stats">
                <div class="profile-stat-item">
                    <div class="profile-stat-icon">
                        <i class="fas fa-chart-line"></i>
                    </div>
                    <div class="profile-stat-content">
                        <div class="profile-stat-number">${avgOrderValue}</div>
                        <div class="profile-stat-label">Average Order</div>
                    </div>
                </div>
                <div class="profile-stat-item">
                    <div class="profile-stat-icon">
                        <i class="fas fa-calendar-plus"></i>
                    </div>
                    <div class="profile-stat-content">
                        <div class="profile-stat-number">${firstPurchase}</div>
                        <div class="profile-stat-label">First Purchase</div>
                    </div>
                </div>
                <div class="profile-stat-item">
                    <div class="profile-stat-icon">
                        <i class="fas fa-calendar-check"></i>
                    </div>
                    <div class="profile-stat-content">
                        <div class="profile-stat-number">${lastPurchase}</div>
                        <div class="profile-stat-label">Last Purchase</div>
                    </div>
                </div>
            </div>
            
            <div class="purchase-history-container">
                <h3 class="purchase-history-title">Recent Purchase History</h3>
                <div class="purchase-history-list" id="purchaseHistoryList">
                    ${this.renderPurchaseHistory(customer.recent_sales || [])}
                </div>
            </div>
            
            <div class="profile-actions">
                <button class="action-btn" onclick="window.customerManager.showEditCustomerPage()">
                    <i class="fas fa-edit"></i> Edit Profile
                </button>
                <button class="action-btn secondary" onclick="window.customerManager.showCustomersList()">
                    <i class="fas fa-arrow-left"></i> Back to Customers
                </button>
            </div>
        `;
    }
    
    renderPurchaseHistory(sales) {
        if (sales.length === 0) {
            return '<div class="empty-purchase-history">No purchase history available</div>';
        }
        
        return sales.map(sale => {
            const saleDate = window.utils.formatDate(sale.date);
            const saleTotal = window.utils.formatCurrency(sale.total);
            const itemsSummary = sale.items ? sale.items.map(item => 
                `${item.name} (${item.quantity})`
            ).join(', ') : 'No items';
            
            return `
                <div class="purchase-history-item">
                    <div class="purchase-date">${saleDate}</div>
                    <div class="purchase-amount">${saleTotal}</div>
                    <div class="purchase-items">${window.utils.escapeHtml(itemsSummary)}</div>
                </div>
            `;
        }).join('');
    }
    
    // Edit customer profile
    showEditCustomerPage() {
        if (!this.currentCustomerProfile) {
            window.utils.showNotification('No customer selected', 'error');
            return;
        }
        
        // Set customer name in hidden field
        const nameField = document.getElementById('editCustomerName');
        if (nameField) {
            nameField.value = this.currentCustomerProfile;
        }
        
        const titleField = document.getElementById('editCustomerPageTitle');
        if (titleField) {
            titleField.textContent = `Edit Profile: ${this.currentCustomerProfile}`;
        }
        
        // Load current customer data
        this.loadCustomerDataForEdit(this.currentCustomerProfile);
        
        // Hide all sections and show edit page
        window.posApp.hideAllSections();
        const editSection = document.getElementById('edit-customer-profile');
        if (editSection) {
            editSection.style.display = 'block';
        }
        
        window.posApp.updateNavigationActiveState('edit-customer-profile');
    }
    
    async loadCustomerDataForEdit(customerName) {
        try {
            const data = await window.api.getCustomerProfile(customerName);
            
            if (!data || !data.success) {
                window.utils.showNotification('Error loading customer data', 'error');
                return;
            }
            
            const customer = data.customer;
            
            // Populate form fields
            const fields = ['Age', 'Sex', 'Address', 'Phone', 'Email', 'Notes'];
            fields.forEach(field => {
                const element = document.getElementById(`editCustomer${field}`);
                if (element) {
                    element.value = customer[field.toLowerCase()] || '';
                }
            });
            
            // Load profile picture if exists
            if (customer.profile_picture) {
                const preview = document.getElementById('profilePicturePreview');
                const placeholder = document.getElementById('profilePicturePlaceholder');
                if (preview && placeholder) {
                    preview.src = customer.profile_picture;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                }
            } else {
                this.resetProfilePicturePreview();
            }
            
        } catch (error) {
            console.error('Error loading customer data:', error);
            window.utils.showNotification('Error loading customer data', 'error');
        }
    }
    
    resetProfilePicturePreview() {
        const preview = document.getElementById('profilePicturePreview');
        const placeholder = document.getElementById('profilePicturePlaceholder');
        if (preview && placeholder) {
            preview.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    }
    
    attachEditListeners() {
        this.attachProfilePictureListener();
        this.attachEditFormListener();
    }
    
    attachProfilePictureListener() {
        const fileInput = document.getElementById('profilePicture');
        if (fileInput) {
            fileInput.removeEventListener('change', this.handleProfilePictureChange.bind(this));
            fileInput.addEventListener('change', this.handleProfilePictureChange.bind(this));
        }
    }
    
    handleProfilePictureChange(e) {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                window.utils.showNotification('File size too large. Please select an image under 5MB.', 'error');
                this.value = '';
                return;
            }
            
            const reader = new FileReader();
            reader.onload = (e) => {
                const preview = document.getElementById('profilePicturePreview');
                const placeholder = document.getElementById('profilePicturePlaceholder');
                if (preview && placeholder) {
                    preview.src = e.target.result;
                    preview.style.display = 'block';
                    placeholder.style.display = 'none';
                }
            };
            reader.readAsDataURL(file);
        }
    }
    
    attachEditFormListener() {
        const form = document.getElementById('editCustomerForm');
        if (form) {
            form.removeEventListener('submit', this.handleEditFormSubmit.bind(this));
            form.addEventListener('submit', this.handleEditFormSubmit.bind(this));
        }
    }
    
    async handleEditFormSubmit(e) {
        e.preventDefault();
        
        console.log('Form submission started');
        
        const formData = new FormData(e.target);
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Log form data for debugging
        console.log('Form data contents:');
        for (let [key, value] of formData.entries()) {
            console.log(`${key}: ${value}`);
        }
        
        // Show loading state
        window.utils.showLoading(submitBtn, 'Saving...');
        
        console.log('Sending request to /api/customers/update');
        
        try {
            const data = await window.api.updateCustomerProfile(formData);
            
            console.log('Response data:', data);
            
            if (data && data.success) {
                window.utils.showNotification('Customer profile updated successfully!', 'success');
                // Navigate back to customer profile page
                this.showCustomerProfilePage();
            } else {
                const errorMessage = data ? (data.message || data.error || 'Error updating customer profile') : 'Error updating customer profile';
                window.utils.showNotification(errorMessage, 'error');
            }
            
        } catch (error) {
            console.error('Error updating customer:', error);
            window.utils.showNotification('Error updating customer profile', 'error');
        } finally {
            // Hide loading state
            window.utils.hideLoading(submitBtn);
        }
    }
    
    showCustomerProfilePage() {
        if (!this.currentCustomerProfile) {
            this.showCustomersList();
            return;
        }
        
        // Hide all sections and show customer profile
        window.posApp.hideAllSections();
        const profileSection = document.getElementById('customer-profile');
        if (profileSection) {
            profileSection.style.display = 'block';
        }
        
        window.posApp.updateNavigationActiveState('customer-profile');
        
        // Refresh customer profile data
        this.loadCustomerProfileData(this.currentCustomerProfile);
    }
    
    showCustomersList() {
        window.posApp.showSection('customers');
    }
}

// Global customer manager instance
window.customerManager = new CustomerManager(); 