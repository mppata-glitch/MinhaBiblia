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
        
        const urlParams = new URLSearchParams(window.location.search);
        const book = urlParams.get('book');
        const chapter = urlParams.get('chapter');
        const search = urlParams.get('search');

        if (book && chapter) {
            const b = this.state.books.find(x => x.abbrev === book);
            if (b) {
                this.loadBook(book, b.name, parseInt(chapter), false);
            } else {
                this.renderHome();
            }
        } else if (search) {
            document.getElementById('search-input').value = search;
            this.performSearch(search, false);
        } else {
            this.renderHome();
        }

        window.addEventListener('popstate', () => {
            const params = new URLSearchParams(window.location.search);
            const b = params.get('book');
            const c = params.get('chapter');
            const s = params.get('search');
            
            if (b && c) {
                const bookObj = this.state.books.find(x => x.abbrev === b);
                if (bookObj) this.loadBook(b, bookObj.name, parseInt(c), false);
            } else if (s) {
                document.getElementById('search-input').value = s;
                this.performSearch(s, false);
            } else {
                this.showHome(false);
            }
        });
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

    // toggleSearch removido pois a barra agora é fixa

    async loadBooks() {
        try {
            const res = await fetch('/api/books');
            this.state.books = await res.json();
            this.renderSidebar(); // Gera o menu lateral quando os livros carregam
        } catch (e) {
            console.error("Erro ao carregar livros", e);
            document.getElementById('main-content').innerHTML = `<p class="text-red-500 text-center">Error loading books. Are you offline without cache?</p>`;
        }
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar.classList.contains('-translate-x-full')) {
            // Abrir
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        } else {
            // Fechar
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300); // 300ms = duration-300 no CSS
        }
    },

    toggleSidebarBook(abbrev) {
        const content = document.getElementById(`sidebar-book-${abbrev}`);
        const icon = document.getElementById(`sidebar-icon-${abbrev}`);
        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            icon.classList.add('rotate-180');
        } else {
            content.classList.add('hidden');
            icon.classList.remove('rotate-180');
        }
    },

    renderSidebar() {
        const container = document.getElementById('sidebar-content');
        if (!container) return;
        
        let html = '';
        
        this.state.books.forEach(b => {
            html += `
                <div class="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                    <button onclick="app.toggleSidebarBook('${b.abbrev}')" class="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors text-left">
                        <span class="font-medium text-slate-700 dark:text-slate-300">${b.name}</span>
                        <svg id="sidebar-icon-${b.abbrev}" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <div id="sidebar-book-${b.abbrev}" class="hidden p-2 grid grid-cols-5 gap-1 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg mb-2">
            `;
            
            // Loop de botões para cada capítulo do livro (1 a N)
            const maxChapters = b.chapters || 1; // Usando a nova propriedade que vem da API
            for (let i = 1; i <= maxChapters; i++) {
                html += `
                    <button onclick="app.toggleSidebar(); app.loadBook('${b.abbrev}', '${b.name}', ${i})" class="p-2 text-center text-sm rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/60 hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-300 transition-colors">
                        ${i}
                    </button>
                `;
            }
            
            html += `</div></div>`;
        });
        
        container.innerHTML = html;
    },

    showHome(updateUrl = true) {
        if (updateUrl) {
            history.pushState(null, '', '/');
        }
        this.disconnectObserver();
        this.renderHome();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
    },

    toggleHomeBook(abbrev) {
        const content = document.getElementById(`home-chapters-${abbrev}`);
        if (content) {
            content.classList.toggle('hidden');
        }
    },

    toggleSearchBook(abbrev) {
        const content = document.getElementById(`search-chapters-${abbrev}`);
        if (content) {
            content.classList.toggle('hidden');
        }
    },

    renderHome() {
        const main = document.getElementById('main-content');
        let html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">';
        
        this.state.books.forEach(b => {
            html += `
                <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow">
                    <div onclick="app.toggleHomeBook('${b.abbrev}')" class="p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div>
                            <h3 class="font-bold text-slate-800 dark:text-slate-200 text-lg">${b.name}</h3>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                    <div id="home-chapters-${b.abbrev}" class="hidden p-4 grid grid-cols-5 sm:grid-cols-6 gap-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
            `;
            
            const maxChapters = b.chapters || 1;
            for (let i = 1; i <= maxChapters; i++) {
                html += `
                    <button onclick="app.loadBook('${b.abbrev}', '${b.name}', ${i})" class="py-2 text-center text-sm rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-colors font-medium">
                        ${i}
                    </button>
                `;
            }
            html += `</div></div>`;
        });
        
        html += '</div>';
        main.innerHTML = html;
        window.scrollTo(0,0);
    },

    async loadBook(abbrev, name, startChapter = 1, updateUrl = true) {
        if (updateUrl) {
            history.pushState(null, '', `?book=${abbrev}&chapter=${startChapter}`);
        }
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
                
                const container = document.getElementById('reading-container');
                if (container && isAppend) {
                    const endDiv = document.createElement('div');
                    endDiv.className = "text-center py-10 mt-10 border-t border-slate-200 dark:border-slate-800";
                    endDiv.innerHTML = `<p class="text-slate-500 mb-4">End of the book of ${this.state.currentBook.name}.</p><button onclick="app.showHome()" class="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium">Back to Books</button>`;
                    container.appendChild(endDiv);
                }
                return;
            }
            
            const verses = await res.json();
            this.state.currentChapter = chapterNum;
            this.renderChapter(verses, isAppend);

            // Atualiza a URL ao fazer scroll infinito para tracking do Analytics
            if (isAppend) {
                history.replaceState(null, '', `?book=${abbrev}&chapter=${chapterNum}`);
            }

        } catch (e) {
            console.error(e);
            if (!isAppend) {
                document.getElementById('main-content').innerHTML = `
                    <div class="text-center py-10">
                        <p class="text-slate-500 mb-4">Chapter not found or connection error.</p>
                        <button onclick="app.showHome()" class="text-indigo-600 underline">Back to Home</button>
                    </div>
                `;
            }
        } finally {
            if (indicator) indicator.classList.add('hidden');
            this.loadingNext = false;
            // Configurar observer apenas após liberar o loading e renderizar o DOM
            setTimeout(() => this.setupInfiniteScroll(), 50);
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
            this.performSearch(q);
        }, 400);
    },

    normalizeString(str) {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    },

    async performSearch(query, updateUrl = true) {
        if (!query) {
            this.renderHome();
            return;
        }

        if (updateUrl) {
            history.pushState(null, '', `?search=${encodeURIComponent(query)}`);
        }

        this.disconnectObserver();
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="flex justify-center h-40 items-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>`;
        
        try {
            // Pesquisa local de livros ignorando acentos
            const qNormalized = this.normalizeString(query);
            const matchedBooks = this.state.books.filter(b => 
                this.normalizeString(b.name).includes(qNormalized) || 
                this.normalizeString(b.abbrev).includes(qNormalized)
            );

            const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            const results = await res.json();
            
            let html = `
                <div class="max-w-3xl mx-auto">
                    <h2 class="text-2xl font-bold mb-6">Results for "${query}"</h2>
            `;

            // Se encontrou livros, exibe eles primeiro!
            if (matchedBooks.length > 0) {
                html += `
                    <div class="mb-8">
                        <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">Books Found</h3>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                `;
                matchedBooks.forEach(b => {
                    html += `
                        <div class="bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 rounded-xl overflow-hidden shadow-sm">
                            <div onclick="app.toggleSearchBook('${b.abbrev}')" class="p-3 cursor-pointer flex justify-between items-center bg-indigo-50/50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                                <span class="font-bold text-indigo-700 dark:text-indigo-400">${b.name}</span>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                            <div id="search-chapters-${b.abbrev}" class="hidden p-3 grid grid-cols-5 sm:grid-cols-6 gap-2 border-t border-indigo-100 dark:border-indigo-800/50">
                    `;
                    
                    const maxChapters = b.chapters || 1;
                    for (let i = 1; i <= maxChapters; i++) {
                        html += `
                            <button onclick="app.loadBook('${b.abbrev}', '${b.name}', ${i})" class="py-2 text-center text-sm rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 dark:hover:text-white transition-colors font-medium">
                                ${i}
                            </button>
                        `;
                    }
                    html += `</div></div>`;
                });
                html += `</div></div>`;
            }

            html += `<h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">Verses Found (${results ? results.length : 0})</h3>`;
            html += `<div class="space-y-4">`;

            if (results && results.length > 0) {
                results.forEach(r => {
                    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    const highlightedText = r.text.replace(regex, '<mark class="bg-yellow-200 dark:bg-indigo-900 dark:text-white px-1 rounded">$1</mark>');
                    
                    html += `
                        <div class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-500 transition-colors" onclick="app.loadBook('${r.book_abbrev}', '${r.book_name}', ${r.chapter})">
                            <div class="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2">${r.book_name} ${r.chapter}:${r.verse}</div>
                            <div class="text-slate-700 dark:text-slate-300">${highlightedText}</div>
                        </div>
                    `;
                });
            } else {
                html += `<p class="text-slate-500">No verses found with these words.</p>`;
            }

            html += `</div></div>`;
            main.innerHTML = html;
            
        } catch (e) {
            console.error(e);
            main.innerHTML = `<p class="text-red-500 text-center mt-10">Error performing search.</p>`;
        }
    }
};

window.addEventListener('DOMContentLoaded', () => {
    app.init();
    
    document.getElementById('search-input').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
        }
    });

    document.getElementById('search-input').addEventListener('input', function (e) {
        app.handleSearchInput();
    });
});
