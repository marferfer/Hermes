// frontend/administration/js/utils.js

// ✅ FUNCIÓN DE LOGOUT REAL
function logout() {
    sessionStorage.removeItem('hermes_tokens');
    sessionStorage.removeItem('hermes_user');
    localStorage.removeItem('hermes_tokens');
    localStorage.removeItem('hermes_user');
    
    const sidebarUser = document.getElementById('sidebar-username');
    const sidebarDept = document.getElementById('sidebar-department');
    if (sidebarUser) sidebarUser.textContent = 'Invitado';
    if (sidebarDept) sidebarDept.textContent = 'Sin departamento';
    
    Swal.fire({
        icon: 'success',
        title: 'Sesión cerrada',
        text: 'Has cerrado sesión correctamente.',
        timer: 2000,
        showConfirmButton: false
    }).then(() => {
        window.location.href = '/frontend/index.html';
    });
}

// ✅ CARGAR CONFIGURACIÓN DESDE API (estructura correcta)
async function loadAdminConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) throw new Error('Error al cargar configuración');
        const fullConfig = await response.json();
        // Extraer solo las features que necesitamos
        return {
            chatEnabled: fullConfig.features?.chatEnabled ?? true,
            documentUploadEnabled: fullConfig.features?.documentUploadEnabled ?? true,
            moderationEnabled: fullConfig.features?.moderationEnabled ?? false
        };
    } catch (error) {
        console.warn('⚠️ Configuración no disponible, usando valores por defecto');
        return {
            chatEnabled: true,
            documentUploadEnabled: true,
            moderationEnabled: false
        };
    }
}

// ✅ GUARDAR CONFIGURACIÓN EN API
async function saveAdminConfig(config) {
    try {
        // Obtener configuración actual completa para preservar otras secciones
        const currentConfigResponse = await fetch('/api/config');
        let currentConfig = {};
        if (currentConfigResponse.ok) {
            currentConfig = await currentConfigResponse.json();
        }
        
        // Actualizar solo la sección de features
        const newConfig = {
            ...currentConfig,
            features: {
                ...(currentConfig.features || {}),
                chatEnabled: config.chatEnabled,
                documentUploadEnabled: config.documentUploadEnabled,
                moderationEnabled: config.moderationEnabled
            }
        };
        
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newConfig)
        });
        if (!response.ok) throw new Error('Error al guardar configuración');
        
        Swal.fire({
            icon: 'success',
            title: '✅ Configuración guardada',
            text: 'Los cambios se han aplicado correctamente',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: error.message || 'No se pudo guardar la configuración'
        });
    }
}

// Mapeo de navegación
const PAGE_MAP = {
  'home.html': 'nav-home',
  'documents_config.html': 'nav-documents',
  'users_config.html': 'nav-users',
  'settings.html': 'nav-settings'
};

function getCurrentPage() {
  const path = window.location.pathname.split('/').pop();
  return path || 'settings.html';
}

function updateActiveNav() {
  const currentPage = getCurrentPage();
  const activeId = PAGE_MAP[currentPage] || 'nav-settings';

  document.querySelectorAll('[data-nav]').forEach(el => {
    el.className = "flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group";
  });

  const activeElement = document.getElementById(activeId);
  if (activeElement) {
    activeElement.className = "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary transition-colors";
  }
}

async function loadSidebar() {
  try {
    const response = await fetch('sidebar.html');
    const sidebarHtml = await response.text();
    document.getElementById('sidebar').innerHTML = sidebarHtml;
    updateActiveNav();
  } catch (error) {
    console.error('Error al cargar el sidebar:', error);
  }
}

// ✅ INICIALIZACIÓN SEGURA (solo ejecuta si los elementos existen)
document.addEventListener('DOMContentLoaded', async () => {
    // Validación de administrador
    if (typeof auth === 'undefined') {
        console.error('❌ auth.js no está cargado');
        Swal.fire({ icon: 'error', title: 'Error crítico', text: 'Sistema de autenticación no disponible' }).then(() => {
            window.location.href = '/frontend/index.html';
        });
        return;
    }

    if (!auth.isAuthenticated()) {
        Swal.fire({ icon: 'warning', title: 'Sesión expirada', text: 'Debes iniciar sesión', timer: 2500 }).then(() => {
            window.location.href = '/frontend/index.html';
        });
        return;
    }

    if (!auth.hasRole('admin')) {
        Swal.fire({ icon: 'error', title: 'Acceso denegado', text: 'Necesitas rol admin', timer: 3000 }).then(() => {
            window.location.href = '/frontend/chat.html';
        });
        return;
    }

    // ✅ Cargar configuración y configurar toggles SOLO SI EXISTEN
    const config = await loadAdminConfig();
    
    // Configurar toggles existentes
    const chatToggle = document.getElementById('chat-toggle');
    const uploadToggle = document.getElementById('upload-toggle');
    const moderationToggle = document.getElementById('moderation-toggle');
    
    if (chatToggle) chatToggle.checked = config.chatEnabled;
    if (uploadToggle) uploadToggle.checked = config.documentUploadEnabled;
    if (moderationToggle) moderationToggle.checked = config.moderationEnabled;
    
    // Event listeners solo para elementos existentes
    if (chatToggle) {
        chatToggle.addEventListener('change', (e) => {
            saveAdminConfig({ ...config, chatEnabled: e.target.checked });
        });
    }
    
    if (uploadToggle) {
        uploadToggle.addEventListener('change', (e) => {
            saveAdminConfig({ ...config, documentUploadEnabled: e.target.checked });
        });
    }
    
    if (moderationToggle) {
        moderationToggle.addEventListener('change', (e) => {
            saveAdminConfig({ ...config, moderationEnabled: e.target.checked });
        });
    }
    
    // Botón de guardar
    const saveBtn = document.querySelector('button.flex.items-center.gap-2.bg-primary');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            saveAdminConfig({
                chatEnabled: chatToggle?.checked ?? config.chatEnabled,
                documentUploadEnabled: uploadToggle?.checked ?? config.documentUploadEnabled,
                moderationEnabled: moderationToggle?.checked ?? config.moderationEnabled
            });
        });
    }
    
    applyFeatureRestrictions();
});

function applyFeatureRestrictions() {
    // Implementación mínima para evitar errores
    console.log('Restricciones aplicadas');
}