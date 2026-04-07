// frontend/assets/js/upload/upload.js

const UploadState = {
    PENDING: 'pending',
    SUCCESS: 'success',
    DUPLICATE: 'duplicate',
    ERROR: 'error'
};

// Estado de los archivos seleccionados
let selectedFiles = [];

// Configuración por defecto
const defaultConfig = {
    department: "[1014] Sistemas",
    visibility: "departamento"
};

function showUploadPanel() {
    document.getElementById('upload-status-panel').classList.remove('hidden');
}

function createStatusItem(fileName, state, message) {
    const config = {
        pending: {
            border: 'border-slate-200 dark:border-slate-700',
            bg: 'bg-slate-50 dark:bg-slate-800/40',
            iconBg: 'bg-slate-200 dark:bg-slate-700',
            icon: 'upload',
            text: 'text-slate-600'
        },
        success: {
            border: 'border-green-200 dark:border-green-900',
            bg: 'bg-green-50 dark:bg-green-900/20',
            iconBg: 'bg-green-100 dark:bg-green-800',
            icon: 'description',
            text: 'text-green-600'
        },
        duplicate: {
            border: 'border-yellow-200 dark:border-yellow-900',
            bg: 'bg-yellow-50 dark:bg-yellow-900/20',
            iconBg: 'bg-yellow-100 dark:bg-yellow-800',
            icon: 'warning',
            text: 'text-yellow-600'
        },
        error: {
            border: 'border-red-200 dark:border-red-900',
            bg: 'bg-red-50 dark:bg-red-900/20',
            iconBg: 'bg-red-100 dark:bg-red-800',
            icon: 'error',
            text: 'text-red-600'
        }
    };

    const c = config[state];
    const div = document.createElement('div');

    div.className = `flex items-center justify-between p-3 rounded-lg border ${c.border} ${c.bg}`;

    div.innerHTML = `
    <div class="flex items-center gap-3 overflow-hidden">
      <div class="${c.iconBg} p-1.5 rounded ${c.text}">
        <span class="material-symbols-outlined text-[20px]">${c.icon}</span>
      </div>
      <div class="flex flex-col min-w-0">
        <p class="text-sm font-medium text-slate-900 dark:text-white truncate">
          ${fileName}
        </p>
        <p class="text-xs ${c.text}">${message}</p>
      </div>
    </div>
    <button class="text-slate-400 hover:text-red-500 transition-colors">
      <span class="material-symbols-outlined">close</span>
    </button>
  `;

    div.querySelector('button').onclick = () => div.remove();

    return div;
}

// Función para obtener el departamento del usuario
function getUserDepartment() {
    // ✅ USAR sessionStorage
    const user = JSON.parse(sessionStorage.getItem('hermes_user'));
    const roles = user?.realm_access?.roles || [];
    const validDepartments = ["[1014] Sistemas", "IT", "Finanzas", "RRHH", "Marketing", "Dirección"];
    return roles.find(role => validDepartments.includes(role)) || "IT";
}

function getUserDepartmentUser() {
    return getCurrentUsername(); // ✅ Usa la función global
}

// Validar archivo
function validateFile(file) {
    const maxSize = 25 * 1024 * 1024; // 25MB
    const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (file.size > maxSize) {
        return { valid: false, error: 'Excede el tamaño máximo de 25MB' };
    }

    if (!validTypes.includes(file.type)) {
        return { valid: false, error: 'Tipo de archivo no soportado' };
    }

    return { valid: true };
}

// Obtener info del archivo
function getFileInfo(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    let format = extension.toUpperCase();
    let icon = "description";
    let iconColor = "blue";

    if (extension === 'pdf') {
        icon = "picture_as_pdf";
        iconColor = "red";
    } else if (['xlsx', 'xls'].includes(extension)) {
        icon = "table_view";
        iconColor = "green";
        format = "Excel";
    } else if (extension === 'docx') {
        icon = "description";
        iconColor = "blue";
        format = "Word";
    } else if (extension === 'pptx') {
        icon = "slideshow";
        iconColor = "orange";
        format = "PowerPoint";
    } else if (extension === 'txt') {
        icon = "text_snippet";
        iconColor = "purple";
        format = "Texto";
    }

    return { extension, format, icon, iconColor };
}

// Simular cálculo de hash
function calculateHash(file) {
    return new Promise((resolve) => {
        const hash = 'f6d8741d8e8ab7dc3b3e72754d2f0a60406d12c3a36cc872129043b1c86e1a3b';
        resolve(hash);
    });
}

// Subir archivo al servidor
async function uploadFileToServer(file, meta) {
    const formData = new FormData();
    formData.append('files', file);
    formData.append('metadata', JSON.stringify([meta]));
    
    // ✅ OBTENER EL TOKEN DE AUTENTICACIÓN
    const tokens = sessionStorage.getItem('hermes_tokens');
    let headers = {};
    
    if (tokens) {
        try {
            const parsed = JSON.parse(tokens);
            headers = { 'Authorization': `Bearer ${parsed.access_token}` };
        } catch (e) {
            console.error('Error parsing tokens:', e);
        }
    }

    const response = await fetch('http://localhost:8000/api/documents/upload', {
        method: 'POST',
        headers: headers, // ✅ INCLUIR LOS HEADERS
        body: formData
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Error desconocido" }));
        throw new Error(error.detail || "Error en la subida");
    }

    return await response.json();
}

// CREAR TABLA DE PREVISUALIZACIÓN
function createPreviewTable() {
    const container = document.getElementById('preview-table-container');
    if (!container) return;

    if (selectedFiles.length === 0) {
        container.classList.add('hidden');
        updateSubmitButton();
        return;
    }

    container.classList.remove('hidden');

    let tableHTML = `
        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table class="w-full text-left border-collapse">
                <thead class="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                        <th class="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Archivo</th>
                        <th class="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Formato</th>
                        <th class="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Departamento</th>
                        <th class="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Visibilidad</th>
                        <th class="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado</th>
                        <th class="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Acciones</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Fila de control masivo - SIN BOTÓN APLICAR
    tableHTML += `
    <tr class="bg-slate-100 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-700">
        <td class="px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            Aplicar a todos los documentos
        </td>
        <td class="px-4 py-3"></td>
        <td class="px-4 py-2" colspan="2">
            <div class="flex gap-2">
                <select class="w-full h-10 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2" id="mass-department">
                    <option value="">Seleccionar...</option>
                    <option value="[1014] Sistemas">[1014] Sistemas</option>
                    <option value="RRHH">Recursos Humanos</option>
                    <option value="Finanzas">Finanzas</option>
                    <option value="IT">Tecnología (TI)</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Dirección">Dirección</option>
                </select>
                <select class="w-full h-10 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2" id="mass-visibility">
                    <option value="">Seleccionar...</option>
                    <option value="departamento">Solo mi departamento</option>
                    <option value="publico">Público</option>
                    <option value="privado">Privado</option>
                </select>
            </div>
        </td>
        <td class="px-4 py-2"></td>
        <td class="px-4 py-2 text-center">
            <button id="remove-all-files" class="p-1.5 text-slate-400 hover:text-red-600 transition-colors">
                <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
        </td>
    </tr>
`;

    // Filas de archivos
    selectedFiles.forEach((file, index) => {
        const fileInfo = getFileInfo(file);
        tableHTML += `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30" data-index="${index}">
                <td class="px-4 py-3">
                    <div class="flex items-center gap-3">
                        <div class="h-8 w-8 rounded-lg bg-${fileInfo.iconColor}-50 text-${fileInfo.iconColor}-600 flex items-center justify-center">
                            <span class="material-symbols-outlined text-[16px]">${fileInfo.icon}</span>
                        </div>
                        <span class="text-sm font-medium text-slate-900 dark:text-white">${file.name}</span>
                    </div>
                </td>
                
                <td class="px-4 py-3">
                    <span class="text-sm text-slate-600 dark:text-slate-400">${fileInfo.format}</span>
                </td>
                <td class="px-4 py-3">
                    <select class="w-full h-10 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 file-dept" data-index="${index}">
                        <option value="">Seleccionar...</option>
                        <option value="[1014] Sistemas">[1014] Sistemas</option>
                        <option value="RRHH">Recursos Humanos</option>
                        <option value="Finanzas">Finanzas</option>
                        <option value="IT">Tecnología (TI)</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Dirección">Dirección</option>
                    </select>
                </td>
                <td class="px-4 py-3">
                    <select class="w-full h-10 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 file-visibility" data-index="${index}">
                        <option value="departamento">Solo mi departamento</option>
                        <option value="publico">Público</option>
                        <option value="privado">Privado</option>
                    </select>
                </td>
                <td class="px-4 py-3">
                    <div class="text-sm text-slate-500 dark:text-slate-400" id="status-${index}">Pendiente</div>
                </td>
                <td class="px-4 py-3 text-center">
                    <button class="p-1.5 text-slate-400 hover:text-red-600 transition-colors remove-file-btn" data-index="${index}">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </td>
            </tr>
        `;
    });

    tableHTML += '</tbody></table></div>';
    container.innerHTML = tableHTML;

    // Añadir eventos
    const applyBtn = document.getElementById('apply-mass-config');
    const removeAllBtn = document.getElementById('remove-all-files');
    const removeBtns = document.querySelectorAll('.remove-file-btn');

    // Eventos de eliminación
    if (removeAllBtn) {
        removeAllBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres eliminar todos los documentos?')) {
                removeAllFiles();
            }
        });
    }
    removeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            if (confirm('¿Estás seguro de que quieres eliminar este documento?')) {
                removeFile(index);
            }
        });
    });

    // Eventos automáticos para dropdowns masivos
    const massDeptSelect = document.getElementById('mass-department');
    const massVisSelect = document.getElementById('mass-visibility');

    if (massDeptSelect) {
        massDeptSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            document.querySelectorAll('.file-dept').forEach(select => {
                select.value = value;
            });
        });
    }

    if (massVisSelect) {
        massVisSelect.addEventListener('change', (e) => {
            const value = e.target.value;
            document.querySelectorAll('.file-visibility').forEach(select => {
                select.value = value;
            });
        });
    }

    updateSubmitButton();
}

//////////////////////FUNCION QUE APLICA BORRADO COMPLETO///////////////
// function applyMassConfiguration() {
//     const massDept = document.getElementById('mass-department')?.value;
//     const massVis = document.getElementById('mass-visibility')?.value;

//     // Si ambos están vacíos, resetear todos
//     if (massDept === '' && massVis === '') {
//         selectedFiles.forEach((_, index) => {
//             const deptSelect = document.querySelector(`select.file-dept[data-index="${index}"]`);
//             const visSelect = document.querySelector(`select.file-visibility[data-index="${index}"]`);

//             if (deptSelect) deptSelect.value = '';
//             if (visSelect) visSelect.value = '';
//         });
//         return;
//     }

//     // Aplicar valores seleccionados
//     selectedFiles.forEach((_, index) => {
//         const deptSelect = document.querySelector(`select.file-dept[data-index="${index}"]`);
//         const visSelect = document.querySelector(`select.file-visibility[data-index="${index}"]`);

//         if (massDept !== undefined && deptSelect) deptSelect.value = massDept;
//         if (massVis !== undefined && visSelect) visSelect.value = massVis;
//     });
// }

function updateSubmitButton() {
    const submitBtn = document.getElementById('upload-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = selectedFiles.length === 0;
    }
}

// SUBIR ARCHIVOS
async function uploadSelectedFiles() {
    const deptSelects = document.querySelectorAll('.file-dept');
    const visSelects = document.querySelectorAll('.file-visibility');

    // Validar configuración
    let hasErrors = false;
    selectedFiles.forEach((_, index) => {
        const dept = deptSelects[index]?.value;
        const vis = visSelects[index]?.value;
        const statusEl = document.getElementById(`status-${index}`);

        if (!dept || !vis) {
            if (statusEl) statusEl.innerHTML = '<span class="text-red-600">Configurar</span>';
            hasErrors = true;
        }
    });

    if (hasErrors) {
        showResults('Configura todos los documentos antes de subir', 'error');
        return;
    }

    // Subir cada archivo
    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const dept = deptSelects[i].value;
        const vis = visSelects[i].value;

        const statusEl = document.getElementById(`status-${i}`);
        if (statusEl) statusEl.innerHTML = '<span class="text-amber-600">Subiendo...</span>';

        try {
            const contentHash = await calculateHash(file);
            const meta = {
                access_level: vis,
                owner_department: dept,
                owner_user: getUserDepartmentUser(), // ← NUEVA FUNCIÓN
                content_hash: contentHash,
                upload_date: new Date().toISOString(),
                mime_type: file.type,
                original_filename: file.name
            };


            await uploadFileToServer(file, meta);

            if (statusEl) statusEl.innerHTML = '<span class="text-green-600">✓ Subido</span>';
        } catch (error) {
            if (statusEl) statusEl.innerHTML = '<span class="text-red-600">✗ Error</span>';
            console.error('Error subiendo archivo:', error);
        }
    }

    // Mostrar resumen
    const successCount = Array.from(document.querySelectorAll('[id^="status-"]'))
        .filter(el => el.innerHTML.includes('✓')).length;

    showResults(`${successCount} de ${selectedFiles.length} archivos subidos`, 'success');
}

function showResults(message, type = 'success') {
    const resultsDiv = document.getElementById('upload-results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `<div class="mt-4 p-3 rounded ${type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }">${message}</div>`;
        setTimeout(() => resultsDiv.innerHTML = '', 5000);
    }
}

// AÑADIR ARCHIVOS
function addFiles(newFiles) {
    const validFiles = newFiles.filter(file => {
        const validation = validateFile(file);
        if (!validation.valid) {
            showResults(`${file.name}: ${validation.error}`, 'error');
        }
        return validation.valid;
    });

    if (validFiles.length === 0) return;

    selectedFiles.push(...validFiles);
    createPreviewTable();
}

// INICIALIZAR
function initUpload() {
    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.querySelector('.file-input');
    const submitBtn = document.getElementById('upload-submit-btn');

    if (!uploadArea || !fileInput) return;

    // Drag & drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('border-blue-500', 'bg-blue-50');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            addFiles(Array.from(files));
        }
    });

    // Click
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    // File selection
    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            addFiles(Array.from(files));
        }
    });

    // Submit button
    if (submitBtn) {
        submitBtn.addEventListener('click', uploadSelectedFiles);
    }

    // Inicializar tabla vacía
    createPreviewTable();
}

// Eliminar un archivo específico
function removeFile(index) {
    if (index >= 0 && index < selectedFiles.length) {
        selectedFiles.splice(index, 1);
        createPreviewTable();
    }
}

// Eliminar todos los archivos
function removeAllFiles() {
    selectedFiles = [];
    createPreviewTable();
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initUpload);