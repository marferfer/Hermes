// frontend/assets/js/library.js

// Función para obtener documentos del backend
async function fetchDocuments() {
    try {
        // Obtener la lista de archivos del backend
        const response = await fetch('http://localhost:8000/api/documents/list');
        if (!response.ok) {
            throw new Error('No se pudieron obtener los documentos');
        }
        return await response.json();
    } catch (error) {
        console.error('Error al obtener documentos del backend:', error);
        // Si falla, mostrar un array vacío
        return [];
    }
}

// Obtiene el departamento del usuario actual
function getUserDepartment() {
    const user = JSON.parse(localStorage.getItem('hermes_user'));
    const roles = user?.realm_access?.roles || [];
    const validDepartments = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"];
    return roles.find(role => validDepartments.includes(role)) || "IT";
}

// Verifica si un documento es accesible para el usuario
function isDocumentAccessible(doc) {
    const userDept = getUserDepartment();
    if (doc.access_level === "publico") return true;
    if (doc.access_level === "departamento" && doc.owner_department === userDept) return true;
    if (doc.access_level === "privado" && doc.owner_department === userDept) return true;
    return false;
}

// Formatea la fecha de actualización
function formatDate(dateString) {
    if (!dateString) return "Fecha desconocida";
    const now = new Date();
    const date = new Date(dateString);
    const diffHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Recién actualizado";
    if (diffHours < 24) return `Actualizado hace ${diffHours} hora${diffHours !== 1 ? 's' : ''}`;
    if (diffHours < 48) return "Actualizado ayer";
    
    return `Actualizado el ${date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}`;
}

// Obtiene el tamaño del archivo
async function getFileSize(filename) {
    try {
        const response = await fetch(`http://localhost:8000/api/documents/${filename}/size`);
        if (response.ok) {
            const data = await response.json();
            return data.size;
        }
    } catch (error) {
        console.warn('No se pudo obtener el tamaño del archivo:', filename, error);
    }
    return 0;
}

// Crea una fila de la tabla
function createDocumentRow(doc) {
    // Icono según la extensión
    const extension = doc.filename.split('.').pop().toLowerCase();
    let icon = "description";
    let iconColor = "blue";
    
    if (['pdf'].includes(extension)) {
        icon = "picture_as_pdf";
        iconColor = "red";
    } else if (['xlsx', 'xls', 'csv'].includes(extension)) {
        icon = "table_view";
        iconColor = "green";
    } else if (['docx', 'doc'].includes(extension)) {
        icon = "description";
        iconColor = "blue";
    } else if (['pptx', 'ppt'].includes(extension)) {
        icon = "slideshow";
        iconColor = "orange";
    } else if (['txt'].includes(extension)) {
        icon = "text_snippet";
        iconColor = "purple";
    }
    
    // Color de acceso
    let accessColor = "green";
    let accessText = "Público";
    if (doc.access_level === "departamento") {
        accessColor = "amber";
        accessText = "Restringido";
    } else if (doc.access_level === "privado") {
        accessColor = "red";
        accessText = "Privado";
    }
    
    return `
        <tr class="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-4">
                    <div class="h-10 w-10 rounded-lg bg-${iconColor}-50 text-${iconColor}-600 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">${icon}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors cursor-pointer">${doc.filename}</span>
                        <span class="text-xs text-slate-500">${formatDate(doc.upload_date)}</span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                    ${doc.owner_department}
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-${accessColor}-100 text-${accessColor}-700 dark:bg-${accessColor}-900/30 dark:text-${accessColor}-400 border border-${accessColor}-200 dark:border-${accessColor}-800">
                    <span class="w-1.5 h-1.5 rounded-full bg-${accessColor}-500"></span>
                    ${accessText}
                </div>
            </td>
            <td class="px-6 py-4 text-right text-sm text-slate-600 dark:text-slate-400 font-mono">
                ${doc.file_size ? (doc.file_size / 1024).toFixed(0) : '0'} KB
            </td>
            <td class="px-6 py-4 text-center">
                <button class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all delete-btn" data-filename="${doc.filename}" title="Eliminar archivo">
                    <span class="material-symbols-outlined text-[20px]">delete</span>
                </button>
            </td>
        </tr>
    `;
}

// Renderiza la tabla de documentos
async function renderDocuments() {
    const tableBody = document.querySelector('tbody');
    const counter = document.querySelector('.text-sm.text-slate-500.font-medium');
    
    try {
        const allDocuments = await fetchDocuments();
        
        // 👇 IMPRIMIR TODOS LOS DOCUMENTOS EN CONSOLA
        console.table(allDocuments); // Tabla legible
        console.log('📄 Todos los documentos:', allDocuments);
        
        const userDept = getUserDepartment();
        console.log('👤 Departamento del usuario:', userDept);
        
        const accessibleDocs = allDocuments; // ← Esto muestra TODOS los documentos
        console.log('✅ Documentos accesibles:', accessibleDocs);
        console.log('❌ Documentos NO accesibles:', allDocuments.filter(doc => !isDocumentAccessible(doc)));
        
        const totalCount = allDocuments.length;
        const visibleCount = accessibleDocs.length;
        
       // ✅ Contador actualizado
        counter.innerHTML = `<span class="text-slate-900 dark:text-white font-bold">${allDocuments.length}</span> documentos disponibles`;

        // Renderizar filas (solo accesibles)
        if (visibleCount === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-12 text-center">
                        <div class="flex flex-col items-center justify-center">
                            <div class="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                                <span class="material-symbols-outlined text-3xl text-slate-400">folder_off</span>
                            </div>
                            <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-1">No tienes acceso a ningún documento</h3>
                            <p class="text-slate-500 dark:text-slate-400 text-sm max-w-md">
                                Contacta con tu departamento para solicitar acceso a los documentos necesarios.
                            </p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = accessibleDocs.map(createDocumentRow).join('');
            
            // Añadir eventos a los botones de eliminar
            document.querySelectorAll('.delete-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const filename = e.currentTarget.dataset.filename;
                    showDeleteConfirmation(filename);
                });
            });
        }
    } catch (error) {
        console.error('Error al cargar documentos:', error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center text-red-600">
                    Error al cargar los documentos. Por favor, inténtalo de nuevo.
                </td>
            </tr>
        `;
    }
}

// Muestra el modal de confirmación
function showDeleteConfirmation(filename) {
    const modal = document.querySelector('.fixed.inset-0');
    const filenameSpan = modal.querySelector('span.font-semibold');
    const confirmButton = modal.querySelector('button.bg-red-600');
    
    filenameSpan.textContent = filename;
    modal.classList.remove('hidden');
    
    // Cerrar modal al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });
    
    // Evento de confirmación
    confirmButton.onclick = async () => {
        try {
            const response = await fetch(`http://localhost:8000/api/documents/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                console.log(`Documento eliminado: ${filename}`);
                modal.classList.add('hidden');
                renderDocuments(); // Recargar la tabla
            } else {
                throw new Error('Error en la respuesta del servidor');
            }
        } catch (error) {
            console.error('Error al eliminar:', error);
            alert('Error al eliminar el documento');
        }
    };
}

// Inicializa la biblioteca
document.addEventListener('DOMContentLoaded', async () => {
    await loadSidebar();
    renderDocuments();
    
    // Evento de búsqueda (implementado más adelante)
    const searchInput = document.querySelector('input[placeholder="Buscar por nombre..."]');
    if (searchInput) {
        searchInput.addEventListener('input', renderDocuments);
    }
});