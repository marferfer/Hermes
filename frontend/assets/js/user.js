// frontend/assets/js/core/user.js

function getUserInfo() {
    const userStr = sessionStorage.getItem('hermes_user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

function getCurrentUsername() {
    const user = getUserInfo();
    return user?.preferred_username || "unknown";
}

function getUserDepartment() {
    const user = getUserInfo();
    if (!user) return "IT";
    
    const roles = user.realm_access?.roles || [];
    const validDepartments = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"];
    return roles.find(role => validDepartments.includes(role)) || "IT";
}

// Exportar globalmente
window.getUserInfo = getUserInfo;
window.getCurrentUsername = getCurrentUsername;
window.getUserDepartment = getUserDepartment;