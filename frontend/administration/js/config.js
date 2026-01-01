// frontend/assets/js/core/config.js

// URL del archivo de configuración JSON (ajusta según tu estructura)
const CONFIG_FILE_URL = 'config.json';

// Configuración por defecto (fallback si falla la carga)
const DEFAULT_CONFIG = {
  chatEnabled: true,
  documentUploadEnabled: true,
  moderationEnabled: false,
  language: "es",
  timezone: "mx",
  weeklyReports: true,
  openaiApiKey: "",
  storageProvider: "local",
  ssoEndpoint: ""
};

// Variable para cachear la configuración
let cachedConfig = null;

// Cargar configuración desde el archivo JSON
async function loadConfigFromFile() {
  try {
    const response = await fetch(CONFIG_FILE_URL);
    if (response.ok) {
      const config = await response.json();
      // Combinar con valores por defecto para asegurar todas las propiedades
      cachedConfig = { ...DEFAULT_CONFIG, ...config };
      return cachedConfig;
    } else {
      console.warn('No se pudo cargar administration/config.json, usando valores por defecto');
      cachedConfig = { ...DEFAULT_CONFIG };
      return cachedConfig;
    }
  } catch (error) {
    console.error('Error al cargar configuración:', error);
    cachedConfig = { ...DEFAULT_CONFIG };
    return cachedConfig;
  }
}

// Obtener configuración (con caché)
async function getSystemConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }
  return await loadConfigFromFile();
}

// Guardar configuración (requiere backend, por ahora usa localStorage como fallback)
async function saveConfigToStorage(config) {
  try {
    // Intentar guardar en el backend (si está disponible)
    const backendResponse = await fetch('http://localhost:8000/api/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(config)
    });
    
    if (backendResponse.ok) {
      cachedConfig = { ...DEFAULT_CONFIG, ...config };
      console.log('✅ Configuración guardada en backend');
      return true;
    } else {
      throw new Error('Backend no disponible');
    }
  } catch (error) {
    // Fallback: guardar en localStorage si el backend falla
    console.warn('Backend no disponible, usando localStorage como fallback');
    localStorage.setItem('hermes_system_config', JSON.stringify(config));
    cachedConfig = { ...DEFAULT_CONFIG, ...config };
    return false;
  }
}

// Obtener configuración de localStorage (fallback de emergencia)
function getConfigFromStorage() {
  const savedConfig = localStorage.getItem('hermes_system_config');
  if (savedConfig) {
    return { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
  }
  return { ...DEFAULT_CONFIG };
}

// Verificar permisos de forma segura
async function hasFeatureAccess(feature) {
  // Intentar obtener configuración del backend/caché
  let config;
  if (cachedConfig) {
    config = cachedConfig;
  } else {
    // Intentar cargar del archivo
    try {
      config = await getSystemConfig();
    } catch (error) {
      // Último fallback: localStorage
      config = getConfigFromStorage();
    }
  }
  
  switch(feature) {
    case 'chat':
      return config.chatEnabled;
    case 'documentUpload':
      return config.documentUploadEnabled;
    case 'moderation':
      return config.moderationEnabled;
    default:
      return true;
  }
}

// Inicializar configuración la primera vez
document.addEventListener('DOMContentLoaded', async () => {
  // Cargar configuración inicial
  await getSystemConfig();
  
  // También cargar de localStorage como backup
  if (!cachedConfig) {
    const localStorageConfig = localStorage.getItem('hermes_system_config');
    if (localStorageConfig) {
      cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(localStorageConfig) };
    }
  }
});

// Exportar funciones (manteniendo tu interfaz existente)
window.HermesConfig = {
  get: getSystemConfig,
  hasFeatureAccess: hasFeatureAccess,
  save: saveConfigToStorage
};