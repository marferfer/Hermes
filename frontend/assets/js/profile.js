// assets/js/profile.js

class ProfileEditor {
    constructor() {
        this.modal = document.getElementById('edit-profile-modal');
        this.editBtn = document.getElementById('edit-profile-btn');
        this.closeBtn = document.getElementById('close-edit-modal');
        this.cancelBtn = document.getElementById('cancel-edit');
        this.form = document.getElementById('profile-edit-form');
        this.avatarUpload = document.getElementById('avatar-upload');
        this.previewAvatar = document.getElementById('preview-avatar');
        
        this.initEventListeners();
        this.loadProfileData();
    }
    
    initEventListeners() {
        if (this.editBtn) {
            this.editBtn.addEventListener('click', () => this.openModal());
        }
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.closeModal());
        }
        
        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.closeModal());
        }
        
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
        
        if (this.avatarUpload) {
            this.avatarUpload.addEventListener('change', (e) => this.handleAvatarChange(e));
        }
        
        // Cerrar modal al hacer clic fuera
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) {
                    this.closeModal();
                }
            });
        }
    }
    
    loadProfileData() {
        // ✅ USAR auth.getUserInfo() en lugar de localStorage
        const userData = auth.getUserInfo() || {};
        
        // Nombre de usuario
        const usernameInput = document.getElementById('edit-username');
        if (usernameInput) {
            usernameInput.value = userData.preferred_username || '';
        }
        
        // Departamentos
        const departments = this.getUserDepartments();
        const deptCheckboxes = document.querySelectorAll('input[name="departments"]');
        deptCheckboxes.forEach(checkbox => {
            checkbox.checked = departments.includes(checkbox.value);
        });
        
        // Avatar
        const avatarUrl = this.getUserAvatar();
        if (this.previewAvatar) {
            this.previewAvatar.src = avatarUrl;
        }
    }
    
    getUserDepartments() {
        // ✅ USAR auth.getUserInfo() en lugar de localStorage
        const user = auth.getUserInfo();
        const roles = user?.realm_access?.roles || [];
        const validDepartments = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"];
        return roles.filter(role => validDepartments.includes(role));
    }
    
    getUserAvatar() {
        // Aquí puedes obtener el avatar real del usuario
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuBE5ypuuVVWtjF8DS-IKYeHH2-ulpRTnzyIhUXRGgI9X30dsdjRgt2ctqcYmSyqHiFB7t8pagzdeQ-kn4L8ZyLTDi1FX7p8yVIf3QtI5HGwdCeBXV7gJQ7ISKLZ-I8tQs419VFkoYT3c38NSSTrf2vTKC92mNHwukBy7gd7zEQKOLUBPTM_MtXDr5UkVm6n63gnQeqVbRUWED_7ND3IlD_Zr47vIbm_vHJH1PAVL5v6KmZH3gQ6cdZaEXFP1IbVTtEKVYXt-zrtVUAf';
    }
    
    handleAvatarChange(e) {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (this.previewAvatar) {
                    this.previewAvatar.src = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
    }
    
    validatePassword(password) {
        // Mínimo 8 caracteres, al menos un número y un carácter especial
        const hasNumber = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
        return password.length >= 8 && hasNumber && hasSpecialChar;
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        console.log("🔍 [PROFILE] Iniciando proceso de actualización...");
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Validación de contraseña
        if (newPassword || confirmPassword) {
            if (!currentPassword) {
                Swal.fire({ icon: "info", title: "Contraseña requerida", text: "Debes introducir tu contraseña actual para cambiarla" });
                console.warn("⚠️ [PROFILE] Validación fallida: contraseña actual vacía");
                return;
            }
            if (newPassword !== confirmPassword) {
                Swal.fire({ icon: "warning", title: "Contraseñas no coinciden", text: "Las nuevas contraseñas no coinciden" });
                console.warn("⚠️ [PROFILE] Validación fallida: contraseñas nuevas no coinciden");
                return;
            }
            if (!this.validatePassword(newPassword)) {
                Swal.fire({ icon: "info", title: "Contraseña inválida", text: "La nueva contraseña debe tener al menos 8 caracteres, un número y un carácter especial" });
                console.warn("⚠️ [PROFILE] Validación fallida: contraseña nueva no cumple requisitos");
                return;
            }
        }
        
        // Obtener departamentos seleccionados
        const selectedDepartments = Array.from(document.querySelectorAll('input[name="departments"]:checked'))
            .map(cb => cb.value);
        
        if (selectedDepartments.length === 0) {
            Swal.fire({ icon: "info", title: "Departamento requerido", text: "Debes seleccionar al menos un departamento" });
            console.warn("⚠️ [PROFILE] Validación fallida: ningún departamento seleccionado");
            return;
        }
        
        // Preparar datos para enviar
        const formData = {
            username: document.getElementById('edit-username').value.trim(),
            departments: selectedDepartments
        };

        // ✅ Solo incluir campos de contraseña si realmente se está cambiando
        if (newPassword && newPassword.trim()) {
            formData.currentPassword = currentPassword;
            formData.newPassword = newPassword;
            console.log("🔑 [PROFILE] Incluyendo cambio de contraseña en la solicitud");
        } else {
            console.log("✏️ [PROFILE] Solo actualizando username y departamentos (sin cambio de contraseña)");
        }
        
        console.log("📤 [PROFILE] Datos a enviar:", JSON.stringify(formData, null, 2));
        
        // ✅ OBTENER TOKEN CON VALIDACIÓN COMPLETA
        const tokensStr = sessionStorage.getItem('hermes_tokens');
        if (!tokensStr) {
            Swal.fire({ icon: "error", title: "Sesión expirada", text: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente." });
            console.error("❌ [PROFILE] Token no encontrado en sessionStorage");
            return;
        }
        
        let token;
        try {
            const tokens = JSON.parse(tokensStr);
            console.log("🛡️ [PROFILE] Token cargado de sessionStorage. Access token (primeros 50 chars):", tokens.access_token?.substring(0, 50) + "...");
            
            if (auth && typeof auth.isTokenValid === 'function') {
                const isValid = auth.isTokenValid(tokens);
                console.log("✅ [PROFILE] Token válido:", isValid);
                if (!isValid) {
                    throw new Error('Token expirado');
                }
            }
            token = tokens.access_token;
            
            // ✅ EXTRA: Verificar contenido del token
            try {
                const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                console.log("📄 [PROFILE] Payload del token:", {
                    preferred_username: payload.preferred_username,
                    sub: payload.sub,
                    exp: new Date(payload.exp * 1000).toISOString()
                });
            } catch (e) {
                console.warn("⚠️ [PROFILE] No se pudo decodificar el payload del token:", e.message);
            }
        } catch (e) {
            console.error("❌ [PROFILE] Error al procesar token:", e);
            Swal.fire({ icon: "error", title: "Error de autenticación", text: "Sesión inválida. Por favor, inicia sesión nuevamente." });
            return;
        }
        
        // ✅ ENVIAR SOLICITUD AL BACKEND CON MANEJO DE ERRORES COMPLETO
        console.log("📡 [PROFILE] Enviando solicitud PUT a /api/profile/update...");
        try {
            const response = await fetch('http://localhost:8000/api/profile/update', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });
            
            console.log(`📨 [PROFILE] Respuesta recibida: ${response.status} ${response.statusText}`);
            
            // ✅ MANEJO DE RESPUESTA NO JSON
            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
                console.log("📥 [PROFILE] Respuesta JSON:", result);
            } else {
                const textResponse = await response.text();
                console.warn("⚠️ [PROFILE] Respuesta NO JSON recibida:", textResponse.substring(0, 500));
                result = { detail: `Error del servidor (${response.status}): ${textResponse.substring(0, 200)}` };
            }
            
            // ✅ MANEJO DE RESPUESTA EXITOSA
            if (response.ok) {
                console.log("✅ [PROFILE] Actualización exitosa:", result);
                if (result.passwordChanged) {
                    Swal.fire({
                        icon: 'success',
                        title: '¡Perfil actualizado!',
                        text: 'Tu contraseña ha sido cambiada. Serás redirigido para iniciar sesión con tu nueva contraseña.',
                        timer: 3500,
                        showConfirmButton: false
                    }).then(() => {
                        auth.logout();
                    });
                } else {
                    this.updateProfileDisplay();
                    Swal.fire({
                        icon: 'success',
                        title: '¡Perfil actualizado!',
                        text: 'Los cambios se han guardado correctamente.'
                    });
                    this.closeModal();
                }
                return;
            }
            
            // ✅ MANEJO DE ERRORES ESPECÍFICOS
            console.error(`❌ [PROFILE] Error ${response.status}:`, result);
            switch(response.status) {
                case 400:
                    let errorMsg = result.detail || "Error al actualizar el perfil (400)";
                    if (errorMsg.includes("Contraseña actual incorrecta")) {
                        errorMsg = "La contraseña actual es incorrecta. Verifica e intenta de nuevo.";
                    }
                    Swal.fire({
                        icon: 'error',
                        title: 'Error de validación (400)',
                        text: errorMsg,
                        footer: `<small>Detalles: ${result.detail || 'Sin detalles'}</small>`
                    });
                    break;
                    
                case 401:
                    Swal.fire({
                        icon: "error",
                        title: "Sesión expirada (401)",
                        text: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
                        footer: `<small>Detalles: ${result.detail || 'Token inválido o expirado'}</small>`
                    });
                    break;
                    
                case 403:
                    Swal.fire({
                        icon: 'error',
                        title: 'Acceso denegado (403)',
                        text: 'No tienes permisos para realizar esta acción',
                        footer: `<small>Detalles: ${result.detail || 'Permiso insuficiente'}</small>`
                    });
                    break;
                    
                case 500:
                    Swal.fire({
                        icon: 'error',
                        title: 'Error del servidor (500)',
                        text: result.detail || 'Ocurrió un error al procesar tu solicitud. Inténtalo más tarde.',
                        footer: `<small>Detalles: ${result.detail || 'Error interno'}</small>`
                    });
                    break;
                    
                default:
                    Swal.fire({
                        icon: 'error',
                        title: `Error ${response.status}`,
                        text: result.detail || `No se pudo actualizar el perfil (Error ${response.status})`,
                        footer: `<small>Detalles: ${JSON.stringify(result)}</small>`
                    });
            }
            
        } catch (error) {
            console.error('💥 [PROFILE] Error de conexión al actualizar perfil:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de conexión',
                text: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
                footer: `<small>${error.message}</small>`
            });
        }
    }
    
    updateProfileDisplay() {
        // Actualizar la vista del perfil con los nuevos datos
        const username = document.getElementById('edit-username').value;
        const departments = Array.from(document.querySelectorAll('input[name="departments"]:checked'))
            .map(cb => cb.value);
        
        if (username) {
            document.getElementById('profile-name').textContent = username;
            document.getElementById('profile-username').textContent = username;
        }
        
        if (departments.length > 0) {
            document.getElementById('profile-department').textContent = departments[0];
        }
    }
    
    openModal() {
        this.modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
    
    closeModal() {
        this.modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    loadSidebar();
    new ProfileEditor();
});