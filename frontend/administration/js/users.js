// frontend/administration/js/users.js
class UserManagement {
    constructor() {
        this.tableBody = document.querySelector('tbody');
        this.searchInput = document.querySelector('input[placeholder*="Buscar"]');
        this.departmentFilter = document.querySelector('select:nth-child(1)');
        this.statusFilter = document.querySelector('select:nth-child(2)');
        this.exportButton = document.querySelector('[title="Exportar CSV"]');
        
        this.users = [];
        this.filteredUsers = [];
        
        this.init();
    }
    
    async init() {
        try {
            await this.loadUsers();
            this.bindEvents();
            this.renderUsers();
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            this.showError('No se pudieron cargar los usuarios. Verifica la conexión con Keycloak.');
        }
    }
    
    async loadUsers() {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${this.getToken()}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${await response.text()}`);
        }
        
        this.users = await response.json();
        this.filteredUsers = [...this.users];
    }
    
    getToken() {
        const tokens = sessionStorage.getItem('hermes_tokens');
        if (tokens) {
            return JSON.parse(tokens).access_token;
        }
        return null;
    }
    
    bindEvents() {
        // Búsqueda
        this.searchInput?.addEventListener('input', (e) => {
            this.filterUsers(e.target.value, this.departmentFilter?.value, this.statusFilter?.value);
        });
        
        // Filtros
        this.departmentFilter?.addEventListener('change', (e) => {
            this.filterUsers(this.searchInput?.value || '', e.target.value, this.statusFilter?.value);
        });
        
        this.statusFilter?.addEventListener('change', (e) => {
            this.filterUsers(this.searchInput?.value || '', this.departmentFilter?.value || '', e.target.value);
        });
        
        // Exportar
        this.exportButton?.addEventListener('click', () => {
            this.exportToCSV();
        });
        
        // Eventos delegados para botones de acción
        this.tableBody?.addEventListener('click', (e) => {
            const editBtn = e.target.closest('[title="Editar"]');
            const deleteBtn = e.target.closest('[title="Eliminar"]');
            
            if (editBtn) {
                const userId = editBtn.closest('tr').dataset.userId;
                this.editUser(userId);
            }
            
            if (deleteBtn) {
                const userId = deleteBtn.closest('tr').dataset.userId;
                this.deleteUser(userId);
            }
        });
    }
    
    filterUsers(searchTerm, department, status) {
        this.filteredUsers = this.users.filter(user => {
            const matchesSearch = !searchTerm || 
                user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                user.id.includes(searchTerm);
                
            const matchesDepartment = !department || department === 'Todos los Depts.' || 
                (user.attributes?.department?.[0] || 'Sin departamento') === this.getDepartmentName(department);
                
            const matchesStatus = !status || status === 'Estado: Todos' || 
                (status === 'Activos' && user.enabled) || 
                (status === 'Inactivos' && !user.enabled);
                
            return matchesSearch && matchesDepartment && matchesStatus;
        });
        
        this.renderUsers();
    }
    
    getDepartmentName(filterValue) {
        const mapping = {
            'Tecnología (IT)': 'IT',
            'Recursos Humanos': 'RRHH',
            'Marketing': 'Marketing',
            'Ventas': 'Ventas'
        };
        return mapping[filterValue] || filterValue;
    }
    
    renderUsers() {
        if (!this.tableBody) return;
        
        if (this.filteredUsers.length === 0) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-4 text-center text-slate-500 dark:text-slate-400">
                        No se encontraron usuarios
                    </td>
                </tr>
            `;
            return;
        }
        
        this.tableBody.innerHTML = this.filteredUsers.map(user => `
            <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors" data-user-id="${user.id}">
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="size-10 rounded-full bg-cover bg-center"
                            style='background-image: url("${this.getAvatarUrl(user)}");'>
                        </div>
                        <div>
                            <p class="font-semibold text-slate-900 dark:text-white text-sm">${this.getUserName(user)}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400">${user.email || 'Sin email'}</p>
                        </div>
                    </div>
                </td>
                <td class="p-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        this.getDepartmentClass(user)
                    }">
                        ${this.getDepartmentDisplay(user)}
                    </span>
                </td>
                <td class="p-4 text-sm text-slate-600 dark:text-slate-300">
                    ${this.getUserRole(user)}
                </td>
                <td class="p-4 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
                    ${this.getLastLogin(user)}
                </td>
                <td class="p-4">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.enabled ? 
                        'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }">
                        <span class="size-1.5 rounded-full ${
                            user.enabled ? 'bg-emerald-500' : 'bg-slate-400'
                        }"></span>
                        ${user.enabled ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="p-4 text-right">
                    <div class="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="p-1.5 text-slate-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors" title="Editar">
                            <span class="material-symbols-outlined" style="font-size: 20px;">edit</span>
                        </button>
                        <button class="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Eliminar">
                            <span class="material-symbols-outlined" style="font-size: 20px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }
    
    getAvatarUrl(user) {
        // Puedes personalizar esto según tus necesidades
        return user.attributes?.avatar?.[0] || 
               `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=4a8fe3&color=fff`;
    }
    
    getUserName(user) {
        return user.firstName && user.lastName ? 
               `${user.firstName} ${user.lastName}` : 
               user.username;
    }
    
    getDepartmentDisplay(user) {
        const dept = user.attributes?.department?.[0] || 'Sin departamento';
        const displayNames = {
            'IT': 'Tecnología (IT)',
            'RRHH': 'Recursos Humanos',
            'Marketing': 'Marketing',
            'Ventas': 'Ventas'
        };
        return displayNames[dept] || dept;
    }
    
    getDepartmentClass(user) {
        const dept = user.attributes?.department?.[0] || 'Sin departamento';
        const classes = {
            'IT': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
            'RRHH': 'bg-pink-50 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
            'Marketing': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
            'Ventas': 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
        };
        return classes[dept] || 'bg-gray-50 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    }
    
    getUserRole(user) {
        const roles = user.realmRoles || [];
        if (roles.includes('admin')) return 'Administrador';
        if (roles.includes('editor')) return 'Editor';
        return 'Visualizador';
    }
    
    getLastLogin(user) {
        // Keycloak no proporciona lastLogin por defecto
        // Necesitarías habilitar eventos o usar un atributo personalizado
        return 'Último acceso no disponible';
    }
    
    editUser(userId) {
        // Implementar modal de edición
        Swal.fire({
            title: 'Editar Usuario',
            html: `
                <input id="edit-username" class="swal2-input" placeholder="Username" value="${this.users.find(u => u.id === userId)?.username || ''}">
                <input id="edit-email" class="swal2-input" placeholder="Email" value="${this.users.find(u => u.id === userId)?.email || ''}">
                <select id="edit-department" class="swal2-select">
                    <option value="">Seleccionar departamento</option>
                    <option value="IT">Tecnología (IT)</option>
                    <option value="RRHH">Recursos Humanos</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Ventas">Ventas</option>
                </select>
            `,
            focusConfirm: false,
            preConfirm: () => {
                return {
                    username: document.getElementById('edit-username').value,
                    email: document.getElementById('edit-email').value,
                    department: document.getElementById('edit-department').value
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                this.updateUser(userId, result.value);
            }
        });
    }
    
    async updateUser(userId, userData) {
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (response.ok) {
                Swal.fire('¡Actualizado!', 'El usuario ha sido actualizado.', 'success');
                await this.loadUsers();
                this.renderUsers();
            } else {
                throw new Error(await response.text());
            }
        } catch (error) {
            Swal.fire('Error', `No se pudo actualizar el usuario: ${error.message}`, 'error');
        }
    }
    
    async deleteUser(userId) {
        const user = this.users.find(u => u.id === userId);
        const result = await Swal.fire({
            title: '¿Eliminar usuario?',
            html: `Esta acción eliminará permanentemente a <strong>${this.getUserName(user)}</strong> del sistema. No se puede deshacer.`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#d33'
        });
        
        if (result.isConfirmed) {
            try {
                const response = await fetch(`/api/admin/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.getToken()}`
                    }
                });
                
                if (response.ok) {
                    Swal.fire('¡Eliminado!', 'El usuario ha sido eliminado.', 'success');
                    await this.loadUsers();
                    this.renderUsers();
                } else {
                    throw new Error(await response.text());
                }
            } catch (error) {
                Swal.fire('Error', `No se pudo eliminar el usuario: ${error.message}`, 'error');
            }
        }
    }
    
    exportToCSV() {
        const csvContent = [
            ['Usuario', 'Email', 'Departamento', 'Rol', 'Estado'],
            ...this.filteredUsers.map(user => [
                this.getUserName(user),
                user.email || '',
                this.getDepartmentDisplay(user),
                this.getUserRole(user),
                user.enabled ? 'Activo' : 'Inactivo'
            ])
        ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'usuarios_hermes.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    showError(message) {
        if (this.tableBody) {
            this.tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="p-4 text-center text-red-600 dark:text-red-400">
                        ${message}
                    </td>
                </tr>
            `;
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new UserManagement();
});