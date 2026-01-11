// frontend/assets/js/chat/chat.js

class ChatManager {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.textarea = document.querySelector('textarea[placeholder="Escribe tu pregunta sobre los documentos..."]');
        this.sendButton = document.querySelector('button .material-symbols-outlined[text="send"]')?.closest('button');
        this.attachButton = document.querySelector('button[title="Adjuntar archivo"]');

        this.sendButton = document.getElementById('send-message-btn');
        this.initEventListeners();
        this.loadWelcomeMessage();
    }

    initEventListeners() {
        // Enviar con botón
        this.sendButton?.addEventListener('click', () => this.sendMessage());

        // Enviar con Enter (sin Shift)
        this.textarea?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Ajustar altura del textarea
        this.textarea?.addEventListener('input', () => this.adjustTextareaHeight());
    }

    adjustTextareaHeight() {
        const textarea = this.textarea;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
        }
    }

    loadWelcomeMessage() {
        const welcomeMessage = `
            <div class="flex items-start gap-4 max-w-3xl">
                <div class="bg-gradient-to-br from-primary to-blue-600 rounded-full size-10 flex items-center justify-center shrink-0 shadow-sm text-white">
                    <img src="assets/img/HermesLogo.svg" alt="Hermes Logo" class="h-6 w-auto filter invert brightness-0" />
                </div>
                <div class="flex flex-col gap-1">
                    <div class="flex items-baseline gap-2">
                        <span class="text-sm font-semibold text-slate-900 dark:text-white">Hermes</span>
                        <span class="text-xs text-slate-500">${this.getCurrentTime()}</span>
                    </div>
                    <div class="p-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none shadow-sm text-slate-700 dark:text-slate-200 text-[15px] leading-relaxed">
                        <p>Hola. Soy Hermes, tu asistente de conocimiento corporativo. Tengo acceso a los documentos de la empresa. ¿Qué necesitas consultar hoy?</p>
                    </div>
                </div>
            </div>
        `;
        this.chatContainer.innerHTML = welcomeMessage;
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async sendMessage() {
        const message = this.textarea?.value.trim();
        if (!message) return;

        // Mostrar mensaje del usuario
        this.addUserMessage(message);
        this.textarea.value = '';
        this.adjustTextareaHeight();

        // Mostrar indicador de "pensando"
        const thinkingId = this.showThinkingIndicator();

        try {
            // Llamar al backend RAG
            const response = await fetch('http://localhost:8000/api/chat/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ question: message })
            });

            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }

            const data = await response.json();

            // Ocultar indicador de "pensando"
            this.hideThinkingIndicator(thinkingId);

            // Mostrar respuesta del sistema
            this.addSystemResponse(data.response, data.sources || []);

        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            this.hideThinkingIndicator(thinkingId);
            this.addSystemResponse('Lo siento, ha ocurrido un error al procesar tu pregunta. Por favor, inténtalo de nuevo.');
        }
    }

    // Reemplaza addUserMessage()
    addUserMessage(message) {
        const userAvatar = this.getUserAvatar();
        const html = `
            <div class="flex items-start gap-4 max-w-3xl ml-auto flex-row-reverse">
                <div class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 shrink-0 ring-2 ring-white shadow-sm"
                    style="background-image: url('${userAvatar}');">
                </div>
                <div class="flex flex-col gap-1 items-end">
                    <div class="flex items-baseline gap-2 flex-row-reverse">
                        <span class="text-sm font-semibold text-slate-900 dark:text-white">Tú</span>
                        <span class="text-xs text-slate-500">${this.getCurrentTime()}</span>
                    </div>
                    <div class="p-4 bg-primary text-white rounded-2xl rounded-tr-none shadow-md text-[15px] leading-relaxed">
                        <p>${this.escapeHtml(message)}</p>
                    </div>
                </div>
            </div>
        `;
        this.chatContainer.insertAdjacentHTML('beforeend', html);
        this.scrollToBottom();
    }


    // Reemplaza addSystemResponse()
    addSystemResponse(response, sources = []) {
        let sourcesHtml = '';
        if (sources.length > 0) {
            const sourceItems = sources.map(source => `
            <a class="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 hover:border-primary/30 hover:bg-slate-50 dark:hover:bg-slate-800 bg-slate-50/50 dark:bg-slate-800/50 transition-all group/doc"
               href="#" onclick="showDocumentPreview('${source}'); return false;">
                <div class="size-8 rounded bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 shrink-0">
                    <span class="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                </div>
                <div class="flex flex-col overflow-hidden">
                    <span class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover/doc:text-primary transition-colors">${source}</span>
                    <span class="text-[11px] text-slate-400">Documento fuente</span>
                </div>
                <span class="material-symbols-outlined ml-auto text-slate-300 text-[20px] group-hover/doc:text-primary">open_in_new</span>
            </a>
        `).join('');

            sourcesHtml = `
            <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
                <details class="group">
                    <summary class="flex items-center cursor-pointer list-none select-none text-xs font-semibold text-slate-500 uppercase tracking-wide hover:text-primary transition-colors mb-3">
                        <div class="flex items-center gap-1">
                            <span class="material-symbols-outlined text-[18px]">library_books</span>
                            Fuentes consultadas (${sources.length})
                        </div>
                        <span class="material-symbols-outlined ml-auto text-[18px] transform group-open:rotate-180 transition-transform">expand_more</span>
                    </summary>
                    <div class="space-y-2 animate-fadeIn">
                        ${sourceItems}
                    </div>
                </details>
            </div>
        `;
        }

        const html = `
        <div class="flex items-start gap-4 max-w-3xl w-full">
            <div class="bg-gradient-to-br from-primary to-blue-600 rounded-full size-10 flex items-center justify-center shrink-0 shadow-sm">
                <img src="assets/img/HermesLogo.svg" alt="Hermes Logo" class="h-6 w-auto filter invert brightness-0" />
            </div>
            <div class="flex flex-col gap-1 w-full max-w-2xl">
                <div class="flex items-baseline gap-2">
                    <span class="text-sm font-semibold text-slate-900 dark:text-white">Hermes</span>
                    <span class="text-xs text-slate-500">${this.getCurrentTime()}</span>
                </div>
                <div class="p-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none shadow-sm text-slate-700 dark:text-slate-200 text-[15px] leading-relaxed">
                    <p>${this.escapeHtml(response)}</p>
                    ${sourcesHtml}
                </div>
            </div>
        </div>
    `;
        this.chatContainer.insertAdjacentHTML('beforeend', html);
        this.scrollToBottom();
    }

    showThinkingIndicator() {
        const id = 'thinking-' + Date.now();
        const html = `
            <div id="${id}" class="flex items-center gap-2 text-xs text-slate-400 ml-16 pl-2 animate-pulse">
                <span class="material-symbols-outlined text-[16px] animate-spin">sync</span>
                Generando respuesta...
            </div>
        `;
        this.chatContainer.insertAdjacentHTML('beforeend', html);
        this.scrollToBottom();
        return id;
    }

    hideThinkingIndicator(id) {
        const element = document.getElementById(id);
        if (element) element.remove();
    }

    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getUserAvatar() {
        // Aquí puedes obtener el avatar real del usuario
        return 'https://lh3.googleusercontent.com/aida-public/AB6AXuBE5ypuuVVWtjF8DS-IKYeHH2-ulpRTnzyIhUXRGgI9X30dsdjRgt2ctqcYmSyqHiFB7t8pagzdeQ-kn4L8ZyLTDi1FX7p8yVIf3QtI5HGwdCeBXV7gJQ7ISKLZ-I8tQs419VFkoYT3c38NSSTrf2vTKC92mNHwukBy7gd7zEQKOLUBPTM_MtXDr5UkVm6n63gnQeqVbRUWED_7ND3IlD_Zr47vIbm_vHJH1PAVL5v6KmZH3gQ6cdZaEXFP1IbVTtEKVYXt-zrtVUAf';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    await loadSidebar();
    new ChatManager();
});