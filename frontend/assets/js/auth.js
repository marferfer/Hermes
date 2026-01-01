// frontend/assets/js/auth.js

// Configuración
const CONFIG = {
    keycloakUrl: 'http://localhost:8080',
    realm: 'hermes',
    clientId: 'hermes-app',
    redirectUri: 'http://localhost:8081/'
};

// Función para obtener el código de la URL
function getCallbackCode() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('code');
}

// Función para intercambiar el código por tokens (versión con logging)
async function exchangeCodeForTokens(code) {
    console.log("🔄 Intercambiando código por tokens. Código:", code);

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
        console.log("✅ Tokens recibidos:", tokens);

        // Verificar que los tokens sean válidos
        if (!tokens || !tokens.access_token) {
            throw new Error("No se recibió access_token");
        }

        // Intentar decodificar el JWT
        const user = parseJwt(tokens.access_token);
        console.log("👤 Usuario decodificado:", user);

        // Guardar solo si todo fue bien
        saveTokens(tokens);

        return tokens;

    } catch (error) {
        console.error('❌ Error al obtener tokens:', error);
        alert('❌ Error de autenticación. Por favor, contacta con soporte.');
        return null;
    }
}

// Función para decodificar el token JWT (CORREGIDA)
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = atob(base64); // ← Solo atob, sin decodeURIComponent
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("❌ JWT inválido:", e.message || e);
        return { sub: "unknown", preferred_username: "Usuario", realm_access: { roles: [] } };
    }
}

// Función para guardar tokens en localStorage (versión robusta)
function saveTokens(tokens) {
    try {
        if (!tokens || !tokens.access_token) {
            throw new Error("No access token in response");
        }
        
        const user = parseJwt(tokens.access_token);
        
        // Validar que el usuario tenga datos mínimos
        if (!user || !user.sub) {
            throw new Error("Invalid user data in token");
        }
        
        localStorage.setItem('hermes_tokens', JSON.stringify(tokens));
        localStorage.setItem('hermes_user', JSON.stringify(user));
        console.log("✅ Sesión guardada correctamente");
        console.log("👤 Usuario:", user.preferred_username || user.sub);
        
    } catch (e) {
        console.error("❌ Error al guardar sesión:", e);
        localStorage.removeItem('hermes_tokens');
        localStorage.removeItem('hermes_user');
        alert("Error al procesar la autenticación. Por favor, inténtalo de nuevo.");
    }
}

// Función para redirigir a Keycloak
function redirectToKeycloak() {
    const authUrl = `${CONFIG.keycloakUrl}/realms/${CONFIG.realm}/protocol/openid-connect/auth` +
        `?client_id=${CONFIG.clientId}` +
        `&redirect_uri=${encodeURIComponent(CONFIG.redirectUri)}` +
        `&response_type=code` +
        `&scope=openid profile email roles`;
    
    window.location.href = authUrl;
}

// Función principal de inicialización
async function initAuth() {
    const code = getCallbackCode();
    
    if (code) {
        // Estamos en el callback de Keycloak
        const tokens = await exchangeCodeForTokens(code);
        if (tokens) {
            saveTokens(tokens);
            // 🔥 ELIMINAR EL CÓDIGO DE LA URL ANTES DE REDIRIGIR
            window.history.replaceState({}, document.title, window.location.origin + '/');
            window.location.href = 'chat.html';
        }
    } else {
        // Verificar si ya estamos autenticados
        const tokens = localStorage.getItem('hermes_tokens');
        if (tokens) {
            // Ya autenticado, ir al chat
            window.location.href = 'chat.html';
        }
        // Si no, mostrar el botón de login (ya está en el HTML)
    }
}

// Event listener para el botón de login
document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.getElementById('login-button');
    if (loginButton) {
        loginButton.addEventListener('click', redirectToKeycloak);
    }
    
    // Inicializar autenticación
    initAuth();
});

// Función para cerrar sesión
function logout() {
    localStorage.removeItem('hermes_tokens');
    localStorage.removeItem('hermes_user');
    window.location.href = 'index.html';
}