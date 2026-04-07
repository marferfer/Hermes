// frontend/assets/js/utils.js

// ✅ ELIMINAR MOCK_USER - ahora usamos autenticación real
// Mapa de rutas → IDs de navegación
const PAGE_MAP = {
  'chat.html': 'nav-chat',
  'library.html': 'nav-library', 
  'upload.html': 'nav-upload',
  'perfil.html': 'nav-perfil'
};

// Función para determinar la página actual
function getCurrentPage() {
  const path = window.location.pathname.split('/').pop();
  return path || 'chat.html';
}

// Función para actualizar navegación activa
function updateActiveNav() {
  const currentPage = getCurrentPage();
  const activeId = PAGE_MAP[currentPage] || 'nav-chat';

  // Quitar clase activa de todos
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.className = "flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors group";
  });

  // Añadir clase activa al actual
  const activeElement = document.getElementById(activeId);
  if (activeElement) {
    activeElement.className = "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary group transition-colors";
  }
}

// ✅ NUEVA FUNCIÓN: obtener departamento del usuario real
function getUserDepartment() {
    const user = auth.getUserInfo();
    if (!user) return "IT";
    
    const roles = user.realm_access?.roles || [];
    const validDepartments = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"];
    return roles.find(role => validDepartments.includes(role)) || "IT";
}

// ✅ NUEVA FUNCIÓN: obtener username real
function getCurrentUsername() {
    const user = auth.getUserInfo(); // Esta función viene de auth.js
    return user?.preferred_username || "unknown";
}

// Función para cargar el perfil del usuario (sidebar)
function loadUserProfile() {
  const user = auth.getUserInfo();
  if (!user) return;
  
  const department = getUserDepartment();
  
  // Sidebar
  const usernameElement = document.getElementById('sidebar-username');
  const departmentElement = document.getElementById('sidebar-department');
  
  if (usernameElement) usernameElement.textContent = user.preferred_username;
  if (departmentElement) departmentElement.textContent = department;
  
  // Header del chat (si existe)
  const chatHeader = document.querySelector('#chat-department-header');
  if (chatHeader) chatHeader.textContent = `Conectado a la base de datos de ${department}`;
}

// ✅ NUEVA FUNCIÓN: carga el perfil completo en perfil.html
function loadFullProfile() {
  // Solo ejecutar si estamos en perfil.html
  if (getCurrentPage() !== 'perfil.html') return;
  
  // ✅ USAR auth.getUserInfo() en lugar de getUserInfo()
  const user = auth.getUserInfo();
  if (!user) return;
  
  const roles = user.realm_access?.roles || [];
  const department = getUserDepartment();
  
  // Actualizar todos los elementos del perfil
  setTextContent('profile-name', user.name || user.preferred_username);
  setTextContent('profile-username', user.preferred_username);
  setTextContent('profile-sub', user.sub);
  setTextContent('profile-email', user.email);
  setTextContent('profile-email-detail', user.email);
  setTextContent('profile-department', department);
  setTextContent('profile-last-login', getCurrentDateTime());
  
  // Avatar
  const avatarUrl = user.picture || "https://lh3.googleusercontent.com/aida-public/AB6AXuCHdVtt7YdJfi375z6H-H-uctzfgW2HO8GePYK9sXRd5DMAyaWogrcLH7s0tH_rpKt2kS4kpquor-868kECWdb1DcHyTPC4OCvQAPfOBdHVE-1rsM8yDQw0sJuI-b040LU2ai_kUawTC-vF6ayZdI-v8vERgManQYDYaDwuGtCY2o81qyiuxI83hu5xYKQT0GokgwJXoQsTslaAgDC6RQtrWsRAVa0cQgZlBQA5RxJ-iLUCAS-M47N2eEyaFXS01RZizKgOEXcfeUce";
  const avatarElement = document.getElementById('profile-avatar');
  if (avatarElement) avatarElement.style.backgroundImage = `url('${avatarUrl}')`;
  
  // Roles
  const rolesContainer = document.getElementById('profile-roles-container');
  if (rolesContainer) {
    rolesContainer.innerHTML = '';
    roles.forEach(role => {
      const roleBadge = document.createElement('span');
      roleBadge.className = 'inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-300 border border-primary/20';
      roleBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-primary mr-2"></span>${role}`;
      rolesContainer.appendChild(roleBadge);
    });
  }
}

// Función auxiliar para actualizar texto
function setTextContent(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text || '-';
}

// Función auxiliar para fecha/hora actual
function getCurrentDateTime() {
  const now = new Date();
  return now.toLocaleDateString('es-ES', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  }) + ', ' + now.toLocaleTimeString('es-ES', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

// Función para cargar el sidebar
async function loadSidebar() {
  try {
    const response = await fetch('sidebar.html');
    const sidebarHtml = await response.text();
    document.getElementById('sidebar').innerHTML = sidebarHtml;
    
    // Actualizar todo lo relacionado con el usuario
    updateActiveNav();
    loadUserProfile();
    loadFullProfile();
    
  } catch (error) {
    console.error('Error al cargar el sidebar:', error);
  }
}

function isAuthenticated() {
    return auth.isAuthenticated();
}

// Reemplazar la función de logout
function logout() {
    auth.logout();
}