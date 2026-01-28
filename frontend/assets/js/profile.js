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
        // Cargar datos actuales del perfil
        const userData = JSON.parse(localStorage.getItem('hermes_user')) || {};
        
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
        const user = JSON.parse(localStorage.getItem('hermes_user'));
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
        
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        // Validación de contraseña
        if (newPassword || confirmPassword) {
            if (!currentPassword) {
                alert('Debes introducir tu contraseña actual para cambiarla');
                return;
            }
            
            if (newPassword !== confirmPassword) {
                alert('Las nuevas contraseñas no coinciden');
                return;
            }
            
            if (!this.validatePassword(newPassword)) {
                alert('La nueva contraseña debe tener al menos 8 caracteres, un número y un carácter especial');
                return;
            }
        }
        
        // Obtener departamentos seleccionados
        const selectedDepartments = Array.from(document.querySelectorAll('input[name="departments"]:checked'))
            .map(cb => cb.value);
        
        if (selectedDepartments.length === 0) {
            alert('Debes seleccionar al menos un departamento');
            return;
        }
        
        // Aquí iría la llamada al backend para guardar los cambios
        console.log('Datos a guardar:', {
            username: document.getElementById('edit-username').value,
            departments: selectedDepartments,
            changePassword: newPassword ? true : false,
            newPassword: newPassword
        });
        
        // Simular guardado exitoso
        alert('Perfil actualizado correctamente');
        this.closeModal();
        
        // Actualizar datos en la página
        this.updateProfileDisplay();
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