// frontend/assets/js/upload/upload.js

const UploadState = {
    PENDING: 'pending',
    SUCCESS: 'success',
    DUPLICATE: 'duplicate',
    ERROR: 'error'
};

function showUploadPanel() {
    document
        .getElementById('upload-status-panel')
        .classList.remove('hidden');
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


// Función para obtener el departamento del usuario (simulado)
function getUserDepartment() {
    // En producción, esto vendría de localStorage o una API
    // Por ahora, usamos un valor fijo para pruebas
    return "[1014] Sistemas";
}

// Validar archivo
function validateFile(file) {
    const maxSize = 25 * 1024 * 1024; // 25MB
    const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'text/plain', // .txt
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' // .xlsx
    ];

    if (file.size > maxSize) {
        return { valid: false, error: 'Excede el tamaño máximo de 25MB' };
    }

    if (!validTypes.includes(file.type)) {
        return { valid: false, error: 'Tipo de archivo no soportado' };
    }

    return { valid: true };
}

// Simular cálculo de hash
function calculateHash(file) {
    return new Promise((resolve) => {
        // Simulación simple
        const hash = 'f6d8741d8e8ab7dc3b3e72754d2f0a60406d12c3a36cc872129043b1c86e1a3b';
        resolve(hash);
    });
}


async function uploadFileToServer(file, meta) {
    const formData = new FormData();
    formData.append('files', file);
    formData.append('metadata', JSON.stringify(meta));

    const response = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formData
    });

    return await response.json();
}

// Procesar y subir archivos
async function processFiles(files) {
    const uploadArea = document.querySelector('.upload-area');
    const uploadBtn = document.querySelector('.upload-btn');
    const resultsDiv = document.getElementById('upload-results');

    // Deshabilitar durante la subida
    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span class="animate-spin">↻</span> Subiendo...';
    }

    const successful = [];
    const errors = [];

    for (const file of files) {
        try {
            const validation = validateFile(file);
            if (!validation.valid) {
                errors.push(`${file.name}: ${validation.error}`);
                continue;
            }

            const department = getUserDepartment();
            const contentHash = await calculateHash(file);

            const meta = {
                access_level: "departamento",
                owner_department: department,
                content_hash: contentHash
            };

            const success = await uploadFileToServer(file, meta);
            if (success) {
                successful.push(file.name);
            } else {
                errors.push(`${file.name}: Error en la subida`);
            }

        } catch (error) {
            console.error('Error procesando archivo:', file.name, error);
            errors.push(`${file.name}: Error de procesamiento`);
        }
    }


    // Mostrar resultados
    if (resultsDiv) {
        let html = '<div class="mt-4 p-3 rounded">';

        if (successful.length > 0) {
            html += `<div class="text-green-600 mb-2">
                ✅ ${successful.length} archivo(s) procesado(s) correctamente
            </div>`;
        }

        if (errors.length > 0) {
            html += `<div class="text-red-600">
                ❌ Errores: ${errors.join(', ')}
            </div>`;
        }

        html += '</div>';
        resultsDiv.innerHTML = html;

        // Limpiar resultados después de 5 segundos
        if (errors.length === 0) {
            setTimeout(() => {
                resultsDiv.innerHTML = '';
            }, 5000);
        }
    }

    // Restaurar botón
    if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = 'Subir Archivos';
    }
}

// Inicializar drag & drop
function initUpload() {
    const uploadArea = document.querySelector('.upload-area');
    const fileInput = document.querySelector('.file-input');

    if (!uploadArea || !fileInput) return;

    // Drag over
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('border-blue-500', 'bg-blue-50');
    });

    // Drag leave
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
    });

    // Drop
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('border-blue-500', 'bg-blue-50');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            processFiles(Array.from(files));
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
            processFiles(Array.from(files));
        }
    });
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initUpload);

