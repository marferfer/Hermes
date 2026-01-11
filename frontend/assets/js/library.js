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
    
    // Verificar si el usuario actual es el propietario
    const currentUser = getCurrentUsername();
    const isOwner = doc.owner_user === currentUser;
    
    // Botón de eliminar (solo si es propietario)
    const deleteButton = isOwner ? 
        `<button class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all delete-btn" data-filename="${doc.filename}" title="Eliminar archivo">
            <span class="material-symbols-outlined text-[20px]">delete</span>
        </button>` : 
        `<span class="text-slate-300 dark:text-slate-600" title="Solo el propietario puede eliminar">—</span>`;

    return `
        <tr class="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center gap-4">
                    <div class="h-10 w-10 rounded-lg bg-${iconColor}-50 text-${iconColor}-600 flex items-center justify-center shrink-0">
                        <span class="material-symbols-outlined">${icon}</span>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors cursor-pointer" onclick="showDocumentPreview('${doc.filename}')">${doc.filename}</span>
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
                <!-- Botón de descarga -->
                <a href="http://localhost:8000/api/documents/${encodeURIComponent(doc.filename)}/download" 
                   class="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all mr-2" 
                   title="Descargar archivo">
                    <span class="material-symbols-outlined text-[20px]">download</span>
                </a>
                <!-- Botón de eliminar -->
                ${deleteButton}
            </td>
        </tr>
    `;
}

// Obtener username actual
function getCurrentUsername() {
    const user = JSON.parse(localStorage.getItem('hermes_user'));
    return user?.preferred_username || "unknown";
}

// Renderiza la tabla de documentos

async function renderDocuments() {
    const tableBody = document.querySelector('tbody');
    
    try {
        const allDocuments = await fetchDocuments();
        
        if (window.DocumentFilters && typeof window.DocumentFilters.setDocuments === 'function') {
            window.DocumentFilters.setDocuments(allDocuments);
        } else {
            // Fallback sin paginación
            renderDocumentTable(allDocuments, tableBody);
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

// Función separada para renderizar la tabla
function renderDocumentTable(documents, tableBody) {
    if (documents.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-12 text-center">
                    <div class="flex flex-col items-center justify-center">
                        <div class="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                            <span class="material-symbols-outlined text-3xl text-slate-400">folder_off</span>
                        </div>
                        <h3 class="text-lg font-semibold text-slate-900 dark:text-white mb-1">No se encontraron documentos</h3>
                        <p class="text-slate-500 dark:text-slate-400 text-sm max-w-md">
                            Ajusta tus filtros para encontrar los documentos que necesitas.
                        </p>
                    </div>
                </td>
            </tr>
        `;
    } else {
        tableBody.innerHTML = documents.map(createDocumentRow).join('');
        
        // Añadir eventos a los botones de eliminar
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const filename = e.currentTarget.dataset.filename;
                showDeleteConfirmation(filename);
            });
        });
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
            //alert('Error al eliminar el documento');
            Swal.fire({
                icon: "error",
                title: "Oops...",
                text: "❌ Error al eliminar el documento",
                //footer: '<a href="#">Why do I have this issue?</a>'
            });
        }
    };
}

// Mostrar vista previa de documento
// Cargar PDF.js dinámicamente
// async function loadPdfJs() {
//     return new Promise((resolve, reject) => {
//         if (typeof pdfjsLib !== 'undefined') {
//             resolve();
//             return;
//         }
        
//         const script = document.createElement('script');
//         // ✅ URL CORRECTA
//         script.src = '//mozilla.github.io/pdf.js/build/pdf.mjs';
//         script.async = true;
        
//         script.onload = () => {
//             if (typeof pdfjsLib !== 'undefined') {
//                 resolve();
//             } else {
//                 reject(new Error('PDF.js cargado pero no disponible'));
//             }
//         };
        
//         script.onerror = () => {
//             reject(new Error('Error al cargar PDF.js desde CDN'));
//         };
        
//         document.head.appendChild(script);
//     });
// }

// Mostrar/ocultar botón de descarga según el tipo de archivo
function toggleDownloadButton(filename, show = false) {
    const downloadBtn = document.getElementById('download-pdf');
    if (!downloadBtn) return;
    
    if (show) {
        downloadBtn.classList.remove('hidden');
        downloadBtn.onclick = () => {
            window.open(`http://localhost:8000/api/documents/${encodeURIComponent(filename)}/download`, '_blank');
        };
    } else {
        downloadBtn.classList.add('hidden');
    }
}


// Mostrar vista previa de documento
async function showDocumentPreview(filename) {
    const modal = document.getElementById('preview-modal');
    const previewContent = document.getElementById('preview-content');
    const previewFilename = document.getElementById('preview-filename');
    
    previewFilename.textContent = filename;
    modal.classList.remove('hidden');
    
    // Ocultar botón de descarga por defecto
    toggleDownloadButton(filename, false);
    
    try {
        const extension = filename.split('.').pop().toLowerCase();
        
        if (extension === 'pdf') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.5.207/pdf.worker.min.js';
            await previewPDF(filename, previewContent);
            // El botón se muestra dentro de previewPDF()
        } else if (['txt'].includes(extension)) {
            await previewText(filename, previewContent);
            // ✅ Mostrar botón para TXT
            toggleDownloadButton(filename, true);
        } 
        // Documentos de Office - mensaje informativo
        else if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt'].includes(extension)) {
            const formatName = getFormatName(extension);
            previewContent.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center max-w-md p-6">
                        <div class="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 text-3xl">description</span>
                        </div>
                        <h4 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">${formatName}</h4>
                        <p class="text-slate-600 dark:text-slate-400 mb-4">
                            La vista previa no está disponible para este tipo de archivo.
                        </p>
                        <a href="http://localhost:8000/api/documents/${encodeURIComponent(filename)}/download" 
                           class="inline-flex items-center gap-2 bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            <span class="material-symbols-outlined">download</span>
                            Descargar archivo
                        </a>
                    </div>
                </div>
            `;
            // Ocultar botón (ya está oculto por defecto)
        } else {
            previewContent.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <p class="text-slate-500 dark:text-slate-400">Vista previa no disponible para este formato</p>
                </div>
            `;
            // Ocultar botón (ya está oculto por defecto)
        }
    } catch (error) {
        console.error('Error en vista previa:', error);
        previewContent.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="text-center">
                    <div class="bg-red-100 dark:bg-red-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="material-symbols-outlined text-red-600 dark:text-red-400 text-3xl">error</span>
                    </div>
                    <p class="text-red-600 dark:text-red-400">Error: ${error.message || 'No se pudo cargar la vista previa'}</p>
                </div>
            </div>
        `;
        toggleDownloadButton(filename, false);
    }
}

// Función auxiliar para nombre del formato
function getFormatName(extension) {
    const names = {
        'docx': 'Documento Word',
        'doc': 'Documento Word',
        'xlsx': 'Hoja de cálculo Excel',
        'xls': 'Hoja de cálculo Excel',
        'pptx': 'Presentación PowerPoint',
        'ppt': 'Presentación PowerPoint'
    };
    return names[extension] || 'Documento';
}

// Vista previa de PDF - versión adaptada del ejemplo oficial
async function previewPDF(filename, container) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.5.207/pdf.worker.min.js';
        
        container.innerHTML = '<div class="flex items-center justify-center h-full"><div class="text-center"><div class="animate-spin h-8 w-8 border-2 border-primary rounded-full mb-3"></div><p class="text-slate-600 dark:text-slate-400">Cargando PDF...</p></div></div>';
        
        const pdfUrl = `http://localhost:8000/api/documents/${filename}/download`;
        const pdf = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        const totalPages = pdf.numPages;
        
        const pagesContainer = document.createElement('div');
        pagesContainer.className = 'flex flex-col items-center gap-6';
        
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const scale = 1.2;
            const viewport = page.getViewport({ scale: scale });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            const pageContainer = document.createElement('div');
            pageContainer.className = 'flex flex-col items-center';
            pageContainer.innerHTML = `<div class="text-sm text-slate-500 dark:text-slate-400 mb-2">Página ${pageNum} de ${totalPages}</div>`;
            pageContainer.appendChild(canvas);
            pagesContainer.appendChild(pageContainer);
        }
        
        if (totalPages > 1) {
            const pageInfo = document.createElement('div');
            pageInfo.className = 'text-center mt-4 text-slate-600 dark:text-slate-400 text-sm';
            pageInfo.textContent = `${totalPages} páginas en total`;
            pagesContainer.appendChild(pageInfo);
        }
        
        container.innerHTML = '';
        container.appendChild(pagesContainer);
        
        // ✅ AÑADIDO: Mostrar botón de descarga
        const downloadBtn = document.getElementById('download-pdf');
        if (downloadBtn) {
            downloadBtn.classList.remove('hidden');
            downloadBtn.onclick = () => {
                window.open(`http://localhost:8000/api/documents/${encodeURIComponent(filename)}/download`, '_blank');
            };
        }
        
    } catch (error) {
        console.error('Error en PDF:', error);
        container.innerHTML = `
            <div class="flex items-center justify-center h-full">
                <div class="text-center p-4">
                    <div class="bg-red-100 dark:bg-red-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span class="material-symbols-outlined text-red-600 dark:text-red-400 text-2xl">error</span>
                    </div>
                    <p class="text-red-600 dark:text-red-400 text-sm">Error al cargar PDF</p>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${error.message}</p>
                </div>
            </div>
        `;
        
        // Ocultar botón de descarga en caso de error
        const downloadBtn = document.getElementById('download-pdf');
        if (downloadBtn) {
            downloadBtn.classList.add('hidden');
        }
    }
}

// // Vista previa de documentos de Office usando Google Docs Viewer
// async function previewOfficeDocument(filename, container) {
//     try {
//         // URL del documento en tu backend
//         const documentUrl = `http://localhost:8000/api/documents/${filename}/download`;
        
//         // Google Docs Viewer URL
//         const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(documentUrl)}&embedded=true`;
        
//         container.innerHTML = `
//             <div class="h-full w-full flex flex-col">
//                 <div class="flex items-center justify-between p-3 bg-slate-100 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
//                     <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Vista previa de documento</span>
//                     <a href="${documentUrl}" target="_blank" class="text-xs text-primary hover:underline">
//                         Abrir en nueva pestaña
//                     </a>
//                 </div>
//                 <div class="flex-1 overflow-hidden">
//                     <iframe 
//                         src="${googleViewerUrl}" 
//                         class="w-full h-full border-0"
//                         style="min-height: 500px;"
//                         frameborder="0">
//                     </iframe>
//                 </div>
//                 <div class="text-xs text-slate-500 dark:text-slate-400 p-2 text-center">
//                     Vista previa proporcionada por Google Docs Viewer
//                 </div>
//             </div>
//         `;
        
//     } catch (error) {
//         console.error('Error en vista previa de Office:', error);
//         container.innerHTML = `
//             <div class="flex items-center justify-center h-full">
//                 <div class="text-center max-w-md p-6">
//                     <div class="bg-blue-100 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
//                         <span class="material-symbols-outlined text-blue-600 dark:text-blue-400 text-3xl">description</span>
//                     </div>
//                     <h4 class="text-lg font-semibold text-slate-900 dark:text-white mb-2">Vista previa no disponible</h4>
//                     <p class="text-slate-600 dark:text-slate-400 mb-4">
//                         No se pudo cargar la vista previa del documento. 
//                         Intenta abrirlo directamente.
//                     </p>
//                     <a href="http://localhost:8000/api/documents/${encodeURIComponent(filename)}/download"  
//                        target="_blank"
//                        class="inline-flex items-center gap-2 bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
//                         <span class="material-symbols-outlined">download</span>
//                         Descargar archivo
//                     </a>
//                 </div>
//             </div>
//         `;
//     }
// }



// Vista previa de texto
async function previewText(filename, container) {
    try {
        const response = await fetch(`http://localhost:8000/api/documents/${encodeURIComponent(filename)}/download`);
        const text = await response.text();
        
        container.innerHTML = `
            <div class="h-full overflow-auto">
                <pre class="whitespace-pre-wrap font-mono text-sm text-slate-700 dark:text-slate-300 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
${text}
                </pre>
            </div>
        `;
    } catch (error) {
        throw new Error('Error al cargar texto');
    }
}

// Cerrar modal
function closePreviewModal() {
    document.getElementById('preview-modal').classList.add('hidden');
}


// Exportar documentos a CSV
function exportDocumentsToCSV() {
    let documentsToExport = [];
    
    // Obtener documentos desde el sistema de filtros si está disponible
    if (window.DocumentFilters && window.DocumentFilters.filteredDocuments) {
        documentsToExport = window.DocumentFilters.filteredDocuments;
    } else {
        // Fallback: obtener todos los documentos de la tabla actual
        const tableRows = document.querySelectorAll('tbody tr');
        documentsToExport = Array.from(tableRows).map(row => {
            const cells = row.querySelectorAll('td');
            return {
                filename: cells[0].querySelector('.cursor-pointer')?.textContent || '',
                owner_department: cells[1].textContent.trim(),
                access_level: cells[2].textContent.trim(),
                file_size: cells[3].textContent.replace(' KB', '').trim()
            };
        }).filter(doc => doc.filename);
    }
    
    if (documentsToExport.length === 0) {
        alert('No hay documentos para exportar');
        return;
    }
    
    // Crear contenido CSV
    const headers = ['Nombre del Archivo', 'Departamento', 'Nivel de Acceso', 'Tamaño (KB)'];
    const csvContent = [
        headers.join(','),
        ...documentsToExport.map(doc => {
            // Escapar comillas y comas en los valores
            const escapeCsvValue = (value) => {
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            };
            
            const sizeKB = doc.file_size ? Math.round(doc.file_size / 1024) : 0;
            
            return [
                escapeCsvValue(doc.filename),
                escapeCsvValue(doc.owner_department),
                escapeCsvValue(getAccessText(doc.access_level)),
                sizeKB
            ].join(',');
        })
    ].join('\n');
    
    // Crear y descargar archivo
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `documentos_hermes_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Helper para texto de acceso
function getAccessText(accessLevel) {
    switch(accessLevel) {
        case 'publico': return 'Público';
        case 'departamento': return 'Restringido';
        case 'privado': return 'Privado';
        default: return accessLevel;
    }
}

// Inicializa la biblioteca
document.addEventListener('DOMContentLoaded', async () => {
    const closeBtn = document.getElementById('close-preview');
    const modal = document.getElementById('preview-modal');

    await loadSidebar();
    renderDocuments();
    
    // Evento de búsqueda (implementado más adelante)
    const searchInput = document.querySelector('input[placeholder="Buscar por nombre..."]');
    if (searchInput) {
        searchInput.addEventListener('input', renderDocuments);
    }

    //Gestión del modal de vista previa
    if (closeBtn) {
        closeBtn.addEventListener('click', closePreviewModal);
    }
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closePreviewModal();
            }
        });
    }

    // Evento de exportación CSV
    const exportBtn = document.getElementById('export-csv-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportDocumentsToCSV);
    }
});
