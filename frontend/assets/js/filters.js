// frontend/assets/js/library/filters.js

class DocumentFilters {
    constructor() {
        this.allDocuments = [];
        this.currentPage = 1;
        this.documentsPerPage = 10;
        this.filteredDocuments = [];
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        this.searchInput = document.getElementById('search-input');
        this.deptToggle = document.getElementById('dept-toggle');
        this.deptDropdown = document.getElementById('dept-dropdown');
        this.deptCheckboxes = document.querySelectorAll('.dept-checkbox');
        this.visibilityFilter = document.getElementById('visibility-filter');
        this.filteredCount = document.getElementById('filtered-count');
        this.totalCount = document.getElementById('total-count');
        this.deptSelectedText = document.getElementById('dept-selected-text');
        this.paginationContainer = document.getElementById('pagination-container');
        this.paginationInfo = document.getElementById('pagination-info');
        this.currentPageSpan = document.getElementById('current-page');
        this.totalPagesSpan = document.getElementById('total-pages');
        this.prevPageBtn = document.getElementById('prev-page');
        this.nextPageBtn = document.getElementById('next-page');
    }

    initEventListeners() {
        // Búsqueda
        this.searchInput?.addEventListener('input', () => this.filterDocuments());
        
        // Toggle de departamentos
        this.deptToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deptDropdown.classList.toggle('hidden');
        });
        
        // Cerrar dropdown al hacer clic fuera
        document.addEventListener('click', (e) => {
            if (!this.deptToggle?.contains(e.target) && !this.deptDropdown?.contains(e.target)) {
                this.deptDropdown?.classList.add('hidden');
            }
        });
        
        // Checkboxes de departamentos
        this.deptCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleDeptCheckbox(e));
        });
        
        // Filtro de visibilidad
        this.visibilityFilter?.addEventListener('change', () => this.filterDocuments());

        // Paginación
        this.prevPageBtn?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextPageBtn?.addEventListener('click', () => this.goToPage(this.currentPage + 1));
    }

    handleDeptCheckbox(e) {
        const checkbox = e.target;
        
        if (checkbox.value === 'all') {
            this.deptCheckboxes.forEach(cb => {
                if (cb.value !== 'all') cb.checked = checkbox.checked;
            });
        } else {
            if (!checkbox.checked) {
                document.querySelector('.dept-checkbox[value="all"]').checked = false;
            } else {
                const specificCheckboxes = Array.from(this.deptCheckboxes).filter(cb => cb.value !== 'all');
                const allChecked = specificCheckboxes.every(cb => cb.checked);
                document.querySelector('.dept-checkbox[value="all"]').checked = allChecked;
            }
        }
        
        this.updateDeptText();
        this.filterDocuments();
    }

    updateDeptText() {
        const selectedCheckboxes = Array.from(this.deptCheckboxes).filter(cb => cb.checked && cb.value !== 'all');
        if (selectedCheckboxes.length === 0) {
            this.deptSelectedText.textContent = 'Ningún departamento';
        } else if (selectedCheckboxes.length === 1) {
            this.deptSelectedText.textContent = selectedCheckboxes[0].nextElementSibling.textContent;
        } else if (selectedCheckboxes.length === Array.from(this.deptCheckboxes).filter(cb => cb.value !== 'all').length) {
            this.deptSelectedText.textContent = 'Todos los departamentos';
        } else {
            this.deptSelectedText.textContent = `${selectedCheckboxes.length} departamentos`;
        }
    }

    setDocuments(documents) {
        this.allDocuments = documents;
        this.totalCount.textContent = documents.length;
        this.filterDocuments();
    }

    filterDocuments() {
        const searchTerm = this.searchInput?.value.toLowerCase() || '';
        const selectedDepts = Array.from(this.deptCheckboxes)
            .filter(cb => cb.checked && cb.value !== 'all')
            .map(cb => cb.value);
        const visibility = this.visibilityFilter?.value || 'all';
        
        let filteredDocs = this.allDocuments;
        
        // Aplicar filtros
        if (searchTerm) {
            filteredDocs = filteredDocs.filter(doc => 
                doc.filename.toLowerCase().includes(searchTerm)
            );
        }
        
        if (selectedDepts.length > 0) {
            filteredDocs = filteredDocs.filter(doc => 
                selectedDepts.includes(doc.owner_department)
            );
        }
        
        if (visibility !== 'all') {
            filteredDocs = filteredDocs.filter(doc => 
                doc.access_level === visibility
            );
        }
        
        // Actualizar documentos filtrados
        this.filteredDocuments = filteredDocs;
        this.filteredCount.textContent = filteredDocs.length;
        
        // Reiniciar a la primera página
        this.currentPage = 1;
        
        // Renderizar y actualizar UI
        this.renderCurrentPage();
        this.updatePaginationUI();
        
        return filteredDocs;
    }

    
    // PAGINACIÓN
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredDocuments.length / this.documentsPerPage);
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.renderCurrentPage();
            this.updatePaginationUI();
        }
    }

    renderCurrentPage() {
        const startIndex = (this.currentPage - 1) * this.documentsPerPage;
        const endIndex = startIndex + this.documentsPerPage;
        const pageDocuments = this.filteredDocuments.slice(startIndex, endIndex);
        
        renderDocumentTable(pageDocuments, document.querySelector('tbody'));
    }

    updatePaginationUI() {
        const totalPages = Math.ceil(this.filteredDocuments.length / this.documentsPerPage);
        
        // Actualizar texto
        this.currentPageSpan.textContent = this.currentPage;
        this.totalPagesSpan.textContent = totalPages;
        
        // Mostrar/ocultar paginación
        if (totalPages <= 1) {
            this.paginationContainer.classList.add('hidden');
        } else {
            this.paginationContainer.classList.remove('hidden');
            this.paginationInfo.classList.remove('hidden');
        }
        
        // Actualizar estado de botones
        this.prevPageBtn.disabled = this.currentPage <= 1;
        this.prevPageBtn.classList.toggle('opacity-50', this.currentPage <= 1);
        this.prevPageBtn.classList.toggle('cursor-not-allowed', this.currentPage <= 1);
        
        this.nextPageBtn.disabled = this.currentPage >= totalPages;
        this.nextPageBtn.classList.toggle('opacity-50', this.currentPage >= totalPages);
        this.nextPageBtn.classList.toggle('cursor-not-allowed', this.currentPage >= totalPages);
    }
}

// ✅ Exportar instancia global
window.DocumentFilters = new DocumentFilters();