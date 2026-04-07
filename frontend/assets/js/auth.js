// frontend/assets/js/auth.js

class KeycloakAuth {
    constructor() {
        this.token = null;
        this.userInfo = null;
        this.inactivityTimeout = null;
        this.inactivityTime = 5 * 60 * 1000; // 5 minutos en milisegundos
        this.init();
    }
    
    init() {
        // Cargar token desde sessionStorage
        const storedToken = sessionStorage.getItem('hermes_tokens');
        if (storedToken) {
            try {
                const parsed = JSON.parse(storedToken);
                if (this.isTokenValid(parsed)) {
                    this.token = parsed.access_token;
                    this.userInfo = this.parseToken(this.token);
                    // Iniciar temporizador de inactividad
                    this.startInactivityTimer();
                } else {
                    this.clearSession();
                }
            } catch (e) {
                console.error('Error parsing stored token:', e);
                this.clearSession();
            }
        }
        
        // Escuchar eventos de actividad del usuario
        this.setupActivityListeners();
    }
    
    // Verificar si el token es válido
    isTokenValid(tokenData) {
        if (!tokenData || !tokenData.access_token) return false;
        const payload = this.parseToken(tokenData.access_token);
        const now = Math.floor(Date.now() / 1000);
        return payload.exp > now;
    }
    
    // Parsear JWT token
    parseToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = atob(base64); // ✅ Usar solo atob, sin decodeURIComponent
            return JSON.parse(jsonPayload);
        } catch (e) {
            console.error('Error parsing token:', e);
            return null;
        }
    }
    
    // Obtener información del usuario
    getUserInfo() {
        return this.userInfo;
    }
    
    // Verificar si el usuario tiene un rol
    hasRole(role) {
        if (!this.userInfo || !this.userInfo.realm_access) return false;
        return this.userInfo.realm_access.roles.includes(role);
    }
    
    // Verificar permisos (helper para MVP)
    hasPermission(action) {
        const userRoles = this.getUserInfo()?.realm_access?.roles || [];
        
        switch(action) {
            case 'upload_documents':
                return userRoles.includes('admin') || userRoles.includes('[1014] Sistemas');
            case 'delete_documents':
                return userRoles.includes('admin');
            case 'view_all_departments':
                return userRoles.includes('admin');
            default:
                return true;
        }
    }
    
    // Iniciar sesión
    login() {
        const clientId = 'hermes-app';
        // ✅ USAR LA URL CORRECTA
        const redirectUri = encodeURIComponent('http://localhost:5500/frontend/chat.html');
        const authUrl = `${CONFIG.keycloakUrl}/realms/${CONFIG.realm}/protocol/openid-connect/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid profile email`;
        
        window.location.href = authUrl;
    }
    
    // Procesar callback de Keycloak
    async handleCallback(code) {
        try {
            // Limpiar cualquier sesión anterior
            this.clearSession();
            
            const response = await fetch('http://localhost:8000/api/keycloak/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });
            
            if (!response.ok) {
                throw new Error('Authentication failed');
            }
            
            const tokenData = await response.json();
            console.log("Token recibido:", tokenData); // ← Verás expires_in: 60 (1 minuto)
            
            if (!tokenData.access_token) {
                throw new Error('No access token received');
            }
            
            sessionStorage.setItem('hermes_tokens', JSON.stringify(tokenData));
            
            this.token = tokenData.access_token;
            this.userInfo = this.parseToken(this.token);
            
            // Iniciar temporizador de inactividad
            this.startInactivityTimer();
            
            // Redirigir a chat.html
            window.location.href = '/frontend/chat.html';
            
            return true;
        } catch (error) {
            console.error('Login error:', error);
            this.clearSession();
            Swal.fire({
                icon: "error",
                title: "Error de autenticación",
                text: "No se pudo completar la autenticación. Por favor, inténtalo de nuevo.",
            });
            return false;
        }
    }
    
    // Cerrar sesión
    logout() {
        this.clearSession();
        
        const clientId = 'hermes-app';
        const postLogoutRedirectUri = encodeURIComponent('http://localhost:5500/frontend/index.html');
        window.location.href = `http://localhost:8080/realms/hermes/protocol/openid-connect/logout?client_id=${clientId}&post_logout_redirect_uri=${postLogoutRedirectUri}`;
    }
    
    // Limpiar sesión
    clearSession() {
        sessionStorage.removeItem('hermes_tokens');
        sessionStorage.removeItem('hermes_user');
        this.token = null;
        this.userInfo = null;
        this.stopInactivityTimer();
    }
    
    // Verificar sesión activa
    isAuthenticated() {
        return this.token !== null && this.isTokenValid({ access_token: this.token });
    }
    
    // Gestionar inactividad
    startInactivityTimer() {
        this.stopInactivityTimer();
        this.inactivityTimeout = setTimeout(() => {
            this.handleInactivity();
        }, this.inactivityTime);
    }
    
    stopInactivityTimer() {
        if (this.inactivityTimeout) {
            clearTimeout(this.inactivityTimeout);
            this.inactivityTimeout = null;
        }
    }
    
    handleInactivity() {
        Swal.fire({
            icon: "warning",
            title: "Sesión expirada",
            text: "Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.",
            confirmButtonText: "Aceptar"
        }).then(() => {
            this.logout();
        });
    }
    
    // Detectar actividad del usuario
    setupActivityListeners() {
        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(event => {
            document.addEventListener(event, () => {
                if (this.isAuthenticated()) {
                    this.resetInactivityTimer();
                }
            }, true);
        });
    }
    
    resetInactivityTimer() {
        this.startInactivityTimer();
    }
}

// Configuración
const CONFIG = {
    keycloakUrl: 'http://localhost:8080',
    realm: 'hermes',
    clientId: 'hermes-app'
};

// Exportar instancia global
const auth = new KeycloakAuth();

// Manejar callback si hay código en la URL
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('code')) {
    auth.handleCallback(urlParams.get('code'));
}

// Exportar para uso global
window.auth = auth;