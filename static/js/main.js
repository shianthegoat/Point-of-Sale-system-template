// Main Application JavaScript
class POSApp {
    constructor() {
        this.lastInventoryRefresh = 0;
        this.lastSaleRefresh = 0;
        this.REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes
        
        this.init();
    }
    
    init() {
        this.attachGlobalEventListeners();
        this.initializeModules();
    }
    
    attachGlobalEventListeners() {
        // Auto-refresh when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.handleAutoRefresh();
            }
        });
    }
    
    initializeModules() {
        // Initialize all modules
        window.customerManager = new CustomerManager();
        window.salesManager = new SalesManager();
        window.inventoryManager = new InventoryManager();
        window.utils = new Utils();
    }
    
    handleAutoRefresh() {
        const currentTime = Date.now();
        
        // Check inventory page
        const inventorySection = document.getElementById('inventory');
        if (inventorySection && inventorySection.style.display !== 'none') {
            if (currentTime - this.lastInventoryRefresh > this.REFRESH_THRESHOLD) {
                console.log('Auto-refreshing inventory data (stale data detected)');
                window.inventoryManager.refreshInventoryTable();
                this.lastInventoryRefresh = currentTime;
            }
        }
        
        // Check make-sale page
        const makeSaleSection = document.getElementById('make-sale');
        if (makeSaleSection && makeSaleSection.style.display !== 'none') {
            if (currentTime - this.lastSaleRefresh > this.REFRESH_THRESHOLD) {
                console.log('Auto-refreshing sale inventory data (stale data detected)');
                window.salesManager.refreshSaleInventory();
                this.lastSaleRefresh = currentTime;
            }
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.posApp = new POSApp();
});

// Global utility functions
function showNotification(message, type = 'success') {
    if (window.utils) {
        window.utils.showNotification(message, type);
    }
} 