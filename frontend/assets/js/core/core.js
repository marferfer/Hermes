// frontend/assets/js/core/core.js

class HermesApp {
    constructor() {
        this.pageScripts = {
            'chat.html': () => import('../chat.js').then(module => module.default || module),
            'library.html': () => Promise.all([
                import('../filters.js'),
                import('../library.js')
            ]),
            'perfil.html': () => import('../profile.js'),
            'upload.html': () => import('./upload/upload.js'),
            'index.html': () => this.handleIndexPage()
        };
    }
    
    // Inicialización principal
    async init() {
        try {
            // Esperar a que auth.js esté listo
            if (typeof auth === 'undefined') {
                console.error('Auth no está cargado');
                return;
            }
            
            const currentPage = this.getCurrentPage();
            
            if (currentPage === 'index.html') {
                await this.handleIndexPage();
            } else {
                await this.handleAuthenticatedPage(currentPage);
            }
            
        } catch (error) {
            console.error('Error en la inicialización de Hermes:', error);
        }
    }
    
    getCurrentPage() {
        const path = window.location.pathname.split('/').pop();
        return path || 'chat.html';
    }
    
    async handleIndexPage() {
        // Verificar si hay sesión activa
        if (auth.isAuthenticated()) {
            window.location.href = 'chat.html';
            return;
        }
        
        // Configurar botón de login
        const loginButton = document.getElementById('login-button');
        if (loginButton) {
            loginButton.addEventListener('click', () => {
                auth.login();
            });
        }
    }
    
    async handleAuthenticatedPage(pageName) {
        // Verificar autenticación
        if (!auth.isAuthenticated()) {
            if (pageName !== 'index.html') {
                auth.login();
                return;
            }
        }
        
        // Cargar sidebar
        await loadSidebar();
        
        // Cargar scripts específicos de la página
        if (this.pageScripts[pageName]) {
            try {
                await this.pageScripts[pageName]();
            } catch (error) {
                console.error(`Error cargando scripts para ${pageName}:`, error);
            }
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const app = new HermesApp();
    app.init();
});

// Exportar globalmente si es necesario
window.HermesApp = HermesApp;