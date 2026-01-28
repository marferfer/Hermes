// frontend/assets/js/auth.js

// Configuración
const CONFIG = {
    keycloakUrl: 'http://localhost:8080',
    realm: 'hermes',
    clientId: 'hermes-app',
    // ✅ CORREGIR redirectUri para que apunte a tu estructura real
    redirectUri: 'http://localhost:5500/frontend/chat.html'
};

// Función para obtener el código de la URL
function getCallbackCode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('code');
}

// Función para intercambiar el código por tokens
async function exchangeCodeForTokens(code) {
    console.log("🔄 Intercambiando código por tokens...");

    try {
        const response = await fetch('http://localhost:8000/api/keycloak/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ code })
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${await response.text()}`);
        }

        const tokens = await response.json();
        console.log("✅ Tokens recibidos");

        // Verificar que los tokens sean válidos
        if (!tokens || !tokens.access_token) {
            throw new Error("No se recibió access_token");
        }

        // Intentar decodificar el JWT
        const user = parseJwt(tokens.access_token);
        console.log("👤 Usuario decodificado:", user.preferred_username);

        // Guardar solo si todo fue bien
        saveTokens(tokens);

        return tokens;

    } catch (error) {
        console.error('❌ Error al obtener tokens:', error);
        Swal.fire({
            icon: "error",
            title: "Autenticación fallida",
            text: "No se pudo completar la autenticación. Por favor, inténtalo de nuevo.",
        });
        return null;
    }
}

// Función para decodificar el token JWT
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = atob(base64);
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("❌ JWT inválido:", e.message || e);
        return { sub: "unknown", preferred_username: "Usuario", realm_access: { roles: [] } };
    }
}

// ✅ USAR sessionStorage EN LUGAR DE localStorage (más seguro)
function saveTokens(tokens) {
    try {
        if (!tokens || !tokens.access_token) {
            throw new Error("No access token in response");
        }
        
        const user = parseJwt(tokens.access_token);
        
        if (!user || !user.sub) {
            throw new Error("Invalid user data in token");
        }
        
        // ✅ sessionStorage es más seguro para tokens
        sessionStorage.setItem('hermes_tokens', JSON.stringify(tokens));
        sessionStorage.setItem('hermes_user', JSON.stringify(user));
        console.log("✅ Sesión guardada correctamente");
        
    } catch (e) {
        console.error("❌ Error al guardar sesión:", e);
        sessionStorage.removeItem('hermes_tokens');
        sessionStorage.removeItem('hermes_user');
        Swal.fire({
            icon: "error",
            title: "Error de sesión",
            text: "Error al procesar la autenticación. Por favor, inténtalo de nuevo.",
        });
    }
}

// Función para redirigir a Keycloak
function redirectToKeycloak() {
    const authUrl = `${CONFIG.keycloakUrl}/realms/${CONFIG.realm}/protocol/openid-connect/auth` +
        `?client_id=${CONFIG.clientId}` +
        `&redirect_uri=${encodeURIComponent(CONFIG.redirectUri)}` +
        `&response_type=code` +
        `&scope=openid profile email`;
    
    window.location.href = authUrl;
}

// ✅ NUEVA FUNCIÓN: verificar si hay sesión activa
function isAuthenticated() {
    const tokens = sessionStorage.getItem('hermes_tokens');
    if (!tokens) return false;
    
    try {
        const parsed = JSON.parse(tokens);
        const user = parseJwt(parsed.access_token);
        const now = Math.floor(Date.now() / 1000);
        return user.exp > now;
    } catch (e) {
        return false;
    }
}

// ✅ NUEVA FUNCIÓN: obtener información del usuario
function getUserInfo() {
    const userStr = sessionStorage.getItem('hermes_user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

// Función principal de inicialización
async function initAuth() {
    const code = getCallbackCode();
    
    if (code) {
        // Estamos en el callback de Keycloak
        const tokens = await exchangeCodeForTokens(code);
        if (tokens) {
            // Eliminar el código de la URL y redirigir a chat.html
            window.history.replaceState({}, document.title, window.location.origin + '/frontend/chat.html');
            window.location.href = '/frontend/chat.html';
        }
    } else {
        // Verificar si ya estamos autenticados
        if (isAuthenticated()) {
            return true;
        } else {
            // No autenticado
            if (window.location.pathname.includes('index.html')) {
                return false;
            } else {
                // Redirigir a login
                redirectToKeycloak();
                return false;
            }
        }
    }
}

// Event listener para el botón de login
document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', redirectToKeycloak);
    }
});

// Función para cerrar sesión
function logout() {
    sessionStorage.removeItem('hermes_tokens');
    sessionStorage.removeItem('hermes_user');
    
    // Redirigir a logout de Keycloak
    const clientId = 'hermes-app';
    const postLogoutRedirectUri = encodeURIComponent(window.location.origin + '/index.html');
    window.location.href = `http://localhost:8080/realms/hermes/protocol/openid-connect/logout?client_id=${clientId}&post_logout_redirect_uri=${postLogoutRedirectUri}`;
}

// Exportar funciones globales
window.isAuthenticated = isAuthenticated;
window.getUserInfo = getUserInfo;
window.logout = logout;