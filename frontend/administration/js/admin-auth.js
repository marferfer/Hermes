// frontend/assets/js/admin/admin-auth.js
/**
 * Validación de acceso para páginas de administración
 * Requiere rol 'admin' en el token de Keycloak
 */

(function() {
    // Verificar si auth.js está cargado
    if (typeof auth === 'undefined') {
        console.error('❌ auth.js no está cargado. Revisa la carga de scripts.');
        showAccessDenied("auth.js no está cargado. Revisa la carga de scripts.");
        return;
    }

    // Verificar autenticación
    if (!auth.isAuthenticated()) {
        console.warn('⚠️ Sesión no válida. Revisa la autenticación.');
        showAccessDenied("Sesión no válida. Revisa la autenticación.");
        return;
    }

    // Verificar rol de administrador
    if (!auth.hasRole('admin')) {
        console.warn('🚫 Acceso denegado: se requiere rol "admin"');
        showAccessDenied("Acceso denegado: se requiere rol 'admin'");
        // 👇 👇 👇
        // COMENTADO TEMPORALMENTE PARA VER EL ERROR
        // setTimeout(() => redirectToSafePage(), 3000);
        // 👆 👆 👆
        return;
    }

    // ✅ Acceso permitido - continuar con la carga de la página
    console.log('✅ Acceso de administrador verificado');
    
    // Función para redirigir a página segura
    function redirectToSafePage() {
        // Solo redirigir si no estamos en una página de administración
        if (!window.location.pathname.includes('/administration/')) {
            window.location.href = '/frontend/chat.html';
        }
    }

    // Mostrar mensaje de acceso denegado
    function showAccessDenied(message) {
        // Eliminar contenido actual para evitar flash de información sensible
        document.body.innerHTML = `
            
        `;
    }
})();