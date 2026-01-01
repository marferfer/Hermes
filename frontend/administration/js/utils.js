
const PAGE_MAP = {
  'home.html': 'nav-home',
  'documents_config.html': 'nav-documents',
  'users_config.html': 'nav-users',
  'settings.html': 'nav-settings'
};


// Función para determinar la página actual
function getCurrentPage() {
  const path = window.location.pathname.split('/').pop();
  return path || 'settings.html';
}

// Función para actualizar navegación activa
function updateActiveNav() {
  const currentPage = getCurrentPage();
  const activeId = PAGE_MAP[currentPage] || 'nav-settings';

  // Quitar clase activa de todos
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.className = "flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group";
  });

  // Añadir clase activa al actual
  const activeElement = document.getElementById(activeId);
  if (activeElement) {
    activeElement.className = "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary transition-colors";
  }
}

// Función para cargar el sidebar
async function loadSidebar() {
  try {
    const response = await fetch('sidebar.html');
    const sidebarHtml = await response.text();
    document.getElementById('sidebar').innerHTML = sidebarHtml;
    
    // Actualizar todo lo relacionado con el usuario
    updateActiveNav();
    //loadUserProfile();
    //loadFullProfile(); // ← carga perfil si estamos en perfil.html
    
  } catch (error) {
    console.error('Error al cargar el sidebar:', error);
  }
}

// Función de logout
function logout() {
  alert("Logout deshabilitado en modo desarrollo");
}


/////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////// CONFIGURACIÓN DE LA APLICACIÓN ///////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////

// Cargar configuración y manejar eventos de administración
document.addEventListener('DOMContentLoaded', () => {
    // Cargar configuración actual
    const config = HermesConfig.get();
    
    // Actualizar checkboxes
    document.getElementById('chat-toggle').checked = config.chatEnabled;
    document.getElementById('upload-toggle').checked = config.documentUploadEnabled;
    document.getElementById('moderation-toggle').checked = config.moderationEnabled;
    
    // Manejar cambios en toggles
    document.getElementById('chat-toggle').addEventListener('change', (e) => {
        updateConfig({ chatEnabled: e.target.checked });
        applyFeatureRestrictions();
    });
    
    document.getElementById('upload-toggle').addEventListener('change', (e) => {
        updateConfig({ documentUploadEnabled: e.target.checked });
        applyFeatureRestrictions();
    });
    
    document.getElementById('moderation-toggle').addEventListener('change', (e) => {
        updateConfig({ moderationEnabled: e.target.checked });
    });
    
    // Botón de guardar
    document.querySelector('button.flex.items-center.gap-2.bg-primary').addEventListener('click', () => {
        // Aquí irían las validaciones y llamada a API real
        alert('✅ Configuración guardada');
    });
    
    // Aplicar restricciones inmediatamente
    applyFeatureRestrictions();
});

function updateConfig(updates) {
    const currentConfig = HermesConfig.get();
    const newConfig = { ...currentConfig, ...updates };
    HermesConfig.save(newConfig);
}

// Aplicar restricciones en toda la aplicación
function applyFeatureRestrictions() {
    const config = HermesConfig.get();
    
    // Restringir chat si está deshabilitado
    if (!config.chatEnabled) {
        // Ocultar completamente el chat si no estamos en la página de administración
        if (!window.location.pathname.includes('administration')) {
            // Esto se manejará mejor en la página de chat específica
            console.log('Chat deshabilitado para usuarios');
        }
    }
    
    // Restringir subida de documentos
    if (!config.documentUploadEnabled) {
        const uploadButtons = document.querySelectorAll('.upload-btn');
        uploadButtons.forEach(btn => {
            btn.style.display = 'none';
            btn.setAttribute('disabled', 'true');
        });
    }
}