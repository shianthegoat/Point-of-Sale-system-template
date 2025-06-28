// Utilities Module
class Utils {
    constructor() {
        this.init();
    }
    
    init() {
        // Initialize utility functions
    }
    
    // HTML escaping utility
    escapeHtml(text) {
        if (!text && text !== 0) return 'N/A';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    // Notification system
    showNotification(message, type = 'info') {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'notification-overlay';
        document.body.appendChild(overlay);
        
        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="notification-icon"></span>
            ${message}
        `;
        document.body.appendChild(notification);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            this.removeNotification(notification, overlay);
        }, 3000);
        
        // Allow clicking overlay to dismiss
        overlay.addEventListener('click', () => {
            this.removeNotification(notification, overlay);
        });
    }
    
    removeNotification(notification, overlay) {
        // Add removing animation classes
        notification.classList.add('removing');
        overlay.classList.add('removing');
        
        // Remove elements after animation
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
            if (overlay.parentNode) {
                overlay.remove();
            }
        }, 300);
    }
    
    // Loading state management
    showLoading(element, text = 'Loading...') {
        if (element) {
            element.disabled = true;
            const originalText = element.innerHTML;
            element.setAttribute('data-original-text', originalText);
            element.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${text}`;
        }
    }
    
    hideLoading(element) {
        if (element) {
            element.disabled = false;
            const originalText = element.getAttribute('data-original-text');
            if (originalText) {
                element.innerHTML = originalText;
                element.removeAttribute('data-original-text');
            }
        }
    }
    
    // Form validation
    validateEmail(email) {
        const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return pattern.test(email);
    }
    
    validatePhone(phone) {
        const pattern = /^[\+]?[1-9][\d]{0,15}$/;
        return pattern.test(phone.replace(/\s/g, ''));
    }
    
    // Date formatting
    formatDate(dateString) {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return dateString;
        }
    }
    
    // Currency formatting
    formatCurrency(amount) {
        if (amount === null || amount === undefined) return '₱0.00';
        return `₱${this.formatNumber(parseFloat(amount).toFixed(2))}`;
    }
    
    // Number formatting with commas
    formatNumber(number) {
        if (number === null || number === undefined) return '0';
        return parseFloat(number).toLocaleString('en-US');
    }
    
    // File size formatting
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // Check if element is in viewport
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }
    
    // Smooth scroll to element
    scrollToElement(element, offset = 0) {
        if (element) {
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - offset;
            
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
        }
    }
    
    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Copied to clipboard!', 'success');
        } catch (err) {
            console.error('Failed to copy text: ', err);
            this.showNotification('Failed to copy text', 'error');
        }
    }
    
    // Download file
    downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}

// Global utility functions
function escapeHtml(text) {
    return window.utils.escapeHtml(text);
}

function showNotification(message, type) {
    window.utils.showNotification(message, type);
}

function formatCurrency(amount) {
    return window.utils.formatCurrency(amount);
}

function formatDate(dateString) {
    return window.utils.formatDate(dateString);
} 