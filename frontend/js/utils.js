// Utilitaires
class Utils {
    static formatCurrency(amount) {
        return new Intl.NumberFormat('fr-MG', {
            style: 'currency',
            currency: 'MGA'
        }).format(amount || 0);
    }

    static formatNumber(number, decimals = 2) {
        return new Intl.NumberFormat('fr-FR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number);
    }

    static showMessage(message, type = 'info') {
        alert(`${type.toUpperCase()}: ${message}`);
    }

    static getStockStatus(currentStock, alertThreshold) {
        if (currentStock === 0) return 'danger';
        if (currentStock <= alertThreshold * 0.3) return 'danger';
        if (currentStock <= alertThreshold) return 'warning';
        return 'ok';
    }

    static debounce(func, wait) {
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
}