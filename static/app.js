const app = {
    state: {
        books: [],
        currentBook: null,
        currentChapter: 1,
    },
    observer: null,
    loadingNext: false,
    searchTimeout: null,

    async init() {
        this.updateThemeIcon();
        await this.loadBooks();
        this.renderHome();
    },

    toggleTheme() {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
        this.updateThemeIcon();
    },

    changeFontSize(step) {
        let size = parseInt(localStorage.fontSize || '100');
        size += (step * 10);
        // Limita o tamanho entre 80% e 200%
        if (size < 80) size = 80;
        if (size > 200) size = 200;
        localStorage.fontSize = size;
        document.documentElement.style.fontSize = size + '%';
    },

    updateThemeIcon() {
        const btn = document.getElementById('theme-toggle');
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
        } else {
            btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
        }
    },

    toggleSearch() {
        const bar = document.getElementById('search-bar');
        bar.classList.toggle('hidden');
        if (!bar.classList.contains('hidden')) {
            document.getElementById('search-input').focus();
        }
    },

    async loadBooks() {
        try {
            const res = await fetch('/api/books');
            this.state.books = await res.json();
        } catch (e) {
            console.error("Erro ao carregar livros", e);
            document.getElementById('main-content').innerHTML = `<p class="text-red-500 text-center">Erro ao carregar os livros. Você está offline sem cache?</p>`;
        }
    },

    showHome() {
        this.disconnectObserver();
        this.renderHome();
        document.getElementById('search-bar').classList.add('hidden');
    },

    renderHome() {
        const main = document.getElementById('main-content');
        
        let html = `<h1 class="text-3xl font-bold mb-6 text-indigo-700 dark:text-indigo-400">Livros da Bíblia</h1>`;
        html += `<div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">`;
        
        this.state.books.forEach(b => {
            html += `
                <button onclick="app.loadBook('${b.abbrev}', '${b.name}')" class="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:shadow-md hover:border-indigo-500 dark:hover:border-indigo-500 transition-all text-center flex flex-col justify-center items-center gap-2 group">
                    <span class="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">${b.name}</span>
                    <span class="text-xs text-slate-500 uppercase tracking-widest">${b.abbrev}</span>
                </button>
            `;
        });
        
        html += `</div>`;
        main.innerHTML = html;
        window.scrollTo(0,0);
    },

    async loadBook(abbrev, name, startChapter = 1) {
        this.state.currentBook = { abbrev, name };
        this.state.currentChapter = startChapter;
        this.disconnectObserver();
        
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="max-w-3xl mx-auto" id="reading-container"></div>
            <div id="infinite-scroll-trigger" class="h-20 flex justify-center items-center mt-8">
                 <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 hidden" id="loading-indicator"></div>
            </div>
        `;
        
        window.scrollTo(0,0);
        await this.loadChapter(abbrev, startChapter, false);
    },

    async loadChapter(abbrev, chapterNum, isAppend = false) {
        if (this.loadingNext) return;
        this.loadingNext = true;
        
        const indicator = document.getElementById('loading-indicator');
        if (indicator) indicator.classList.remove('hidden');

        try {
            const res = await fetch(`/api/books/${abbrev}/${chapterNum}`);
            if (!res.ok) {
                // Provavelmente chegou ao fim do livro
                this.disconnectObserver();
                if (indicator) indicator.classList.add('hidden');
                this.loadingNext = false;
                
                // Exibir um botão para voltar ao início se for o fim
                const container = document.getElementById('reading-container');
                if (container && isAppend) {
                    const endDiv = document.createElement('div');
                    endDiv.className = "text-center py-10 mt-10 border-t border-slate-200 dark:border-slate-800";
                    endDiv.innerHTML = `<p class="text-slate-500 mb-4">Fim do livro de ${this.state.currentBook.name}.</p><button onclick="app.showHome()" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">Voltar aos Livros</button>`;
                    container.appendChild(endDiv);
                }
                return;
            }
            
            const verses = await res.json();
            this.state.currentChapter = chapterNum;
            this.renderChapter(verses, isAppend);
            
            // Re-setup observer on the new trigger
            this.setupInfiniteScroll();

        } catch (e) {
            console.error(e);
            if (!isAppend) {
                document.getElementById('main-content').innerHTML = `
                    <div class="text-center py-10">
                        <p class="text-slate-500 mb-4">Capítulo não encontrado ou erro de conexão.</p>
                        <button onclick="app.showHome()" class="text-indigo-600 underline">Voltar ao Início</button>
                    </div>
                `;
            }
        } finally {
            if (indicator) indicator.classList.add('hidden');
            this.loadingNext = false;
        }
    },

    renderChapter(verses, isAppend) {
        const container = document.getElementById('reading-container');
        if (!container) return;

        const b = this.state.currentBook;
        const c = this.state.currentChapter;

        let html = `
            <div class="chapter-block mb-12 ${isAppend ? 'pt-8 border-t border-slate-200 dark:border-slate-800' : ''}">
                <div class="flex items-center justify-between mb-8">
                    <h2 class="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">${b.name} ${c}</h2>
                </div>
                
                <div class="space-y-4 text-lg leading-relaxed text-slate-800 dark:text-slate-200 font-serif">
        `;

        verses.forEach(v => {
            html += `
                <p class="hover:bg-slate-50 dark:hover:bg-slate-900/50 p-1 rounded transition-colors group">
                    <sup class="text-indigo-500 dark:text-indigo-400 font-sans font-bold mr-1 text-xs opacity-70 group-hover:opacity-100">${v.verse}</sup>
                    ${v.text}
                </p>
            `;
        });

        html += `
                </div>
            </div>
        `;
        
        if (isAppend) {
            container.insertAdjacentHTML('beforeend', html);
        } else {
            container.innerHTML = html;
        }
    },

    setupInfiniteScroll() {
        this.disconnectObserver();
        
        const trigger = document.getElementById('infinite-scroll-trigger');
        if (!trigger) return;

        this.observer = new IntersectionObserver((entries) => {
            const entry = entries[0];
            if (entry.isIntersecting && !this.loadingNext) {
                // Carrega o próximo capítulo
                const nextChapter = this.state.currentChapter + 1;
                this.loadChapter(this.state.currentBook.abbrev, nextChapter, true);
            }
        }, {
            rootMargin: "200px" // Inicia o carregamento 200px antes do fim da tela
        });

        this.observer.observe(trigger);
    },

    disconnectObserver() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    },

    handleSearchInput() {
        clearTimeout(this.searchTimeout);
        const q = document.getElementById('search-input').value.trim();
        
        // Se apagar tudo, volta para a home
        if (q.length === 0) {
            this.showHome();
            return;
        }
        
        // Só pesquisa se tiver pelo menos 2 letras
        if (q.length < 2) return;

        // Debounce de 400ms para não sobrecarregar
        this.searchTimeout = setTimeout(() => {
            this.search();
        }, 400);
    },

    async search() {
        const q = document.getElementById('search-input').value;
        if (!q) return;

        this.disconnectObserver();
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="flex justify-center h-40 items-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>`;
        
        try {
            // Filtrar livros localmente primeiro
            const qLower = q.toLowerCase().trim();
            const matchedBooks = this.state.books.filter(b => 
                b.name.toLowerCase().includes(qLower) || 
                b.abbrev.toLowerCase().includes(qLower)
            );

            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            const results = await res.json();
            
            let html = `
                <div class="max-w-3xl mx-auto">
                    <h2 class="text-2xl font-bold mb-6">Resultados para "${q}"</h2>
            `;

            // Se encontrou livros, exibe eles primeiro!
            if (matchedBooks.length > 0) {
                html += `
                    <div class="mb-8">
                        <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">Livros Encontrados</h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                `;
                matchedBooks.forEach(b => {
                    html += `
                        <button onclick="app.loadBook('${b.abbrev}', '${b.name}')" class="p-3 rounded-lg border border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors text-center">
                            <span class="font-semibold text-indigo-700 dark:text-indigo-400">${b.name}</span>
                        </button>
                    `;
                });
                html += `</div></div>`;
            }

            html += `<h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">Versículos Encontrados (${results ? results.length : 0})</h3>`;
            html += `<div class="space-y-4">`;

            if (results && results.length > 0) {
                results.forEach(r => {
                    const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    const highlightedText = r.text.replace(regex, '<mark class="bg-yellow-200 dark:bg-indigo-900 dark:text-white px-1 rounded">$1</mark>');
                    
                    html += `
                        <div class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-500 transition-colors" onclick="app.loadBook('${r.book_abbrev}', '${r.book_name}', ${r.chapter})">
                            <div class="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2">${r.book_name} ${r.chapter}:${r.verse}</div>
                            <div class="text-slate-700 dark:text-slate-300">${highlightedText}</div>
                        </div>
                    `;
                });
            } else {
                html += `<p class="text-slate-500">Nenhum versículo encontrado com estas palavras.</p>`;
            }

            html += `</div></div>`;
            main.innerHTML = html;
            
        } catch (e) {
            console.error(e);
            main.innerHTML = `<p class="text-red-500 text-center mt-10">Erro ao realizar a busca.</p>`;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    app.init();
    
    document.getElementById('search-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            app.search();
        }
    });

    document.getElementById('search-input').addEventListener('input', function (e) {
        app.handleSearchInput();
    });
});
