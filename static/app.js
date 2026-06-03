const app = {
    state: {
        books: [],
        versions: [],
        currentVersion: localStorage.bibleVersion || 'NVI',
        currentBook: null,
        currentChapter: 1,
        highlights: [] // Guarda os itens grifados locais
    },
    observer: null,
    loadingNext: false,
    searchTimeout: null,
    i18n: {
        'pt-br': {
            searchPlaceholder: "Pesquisar livro ou versículo...",
            toc: "Sumário",
            donationTitle: "Gostou do projeto e quer ajudar?",
            donationButton: "Apoiar via PIX",
            resultsFor: "Resultados para",
            booksFound: "Livros Encontrados",
            versesFound: "Versículos Encontrados",
            noVerses: "Nenhum versículo encontrado.",
            endOfBook: "Fim do livro de",
            backToBooks: "Voltar para Livros",
            errorLoading: "Erro ao carregar. Você está offline?",
            chapterNotFound: "Capítulo não encontrado ou erro de conexão.",
            backToHome: "Voltar para o Início",
            highlightedItems: "Itens Grifados",
            noHighlights: "Nenhum versículo grifado ainda.",
            highlightTooltip: "Clique para grifar ou remover",
            btnHighlight: "Grifar",
            btnUnhighlight: "Desgrifar"
        },
        'en-us': {
            searchPlaceholder: "Search book or verse...",
            toc: "Table of Contents",
            donationTitle: "Enjoying the project? Support us!",
            donationButton: "Support via PIX",
            resultsFor: "Results for",
            booksFound: "Books Found",
            versesFound: "Verses Found",
            noVerses: "No verses found.",
            endOfBook: "End of the book of",
            backToBooks: "Back to Books",
            errorLoading: "Error loading. Are you offline?",
            chapterNotFound: "Chapter not found or connection error.",
            backToHome: "Back to Home",
            highlightedItems: "Highlighted Verses",
            noHighlights: "No highlighted verses yet.",
            highlightTooltip: "Click to highlight or remove",
            btnHighlight: "Highlight",
            btnUnhighlight: "Remove Highlight"
        }
    },

    t(key) {
        let lang = 'pt-br';
        if (Array.isArray(this.state.versions)) {
            const versionObj = this.state.versions.find(v => v.name === this.state.currentVersion);
            if (versionObj && versionObj.language) {
                lang = versionObj.language;
            }
        }
        const dictionary = this.i18n[lang.toLowerCase()] || this.i18n['pt-br'];
        return dictionary[key] || key;
    },

    updateUIStrings() {
        document.getElementById('search-input').placeholder = this.t('searchPlaceholder');
        document.getElementById('sidebar-toc-title').textContent = this.t('toc');
        document.getElementById('footer-donation-text').textContent = this.t('donationTitle');
        document.getElementById('footer-donation-button-text').textContent = this.t('donationButton');
        this.renderSidebarDonation();
    },

    renderSidebarDonation() {
        const sidebar = document.getElementById('sidebar-content');
        if (!sidebar) return;
        
        // Remove existing donation block if any
        const existing = document.getElementById('sidebar-donation');
        if (existing) existing.remove();

        const donationHtml = `
            <div id="sidebar-donation" class="mt-4 p-4 mx-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-xl">
                <p class="text-xs text-emerald-700 dark:text-emerald-400 mb-2 font-medium">${this.t('donationTitle')}</p>
                <a href="https://nubank.com.br/cobrar/38y8q/69ef5c65-a3f0-49a6-86b6-02a2893ddff5" target="_blank" rel="noopener noreferrer"
                    class="flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                    ${this.t('donationButton')}
                </a>
            </div>
        `;
        sidebar.insertAdjacentHTML('beforeend', donationHtml);
    },

    async init() {
        this.updateThemeIcon();
        await this.loadVersions();
        this.updateUIStrings();
        await this.loadBooks();
        await this.loadHighlights(); // Carrega os grifos persistidos
        
        const urlParams = new URLSearchParams(window.location.search);
        const book = urlParams.get('book');
        const chapter = urlParams.get('chapter');
        const search = urlParams.get('search');
        const view = urlParams.get('view');

        if (view === 'highlights') {
            this.showHighlightsPage(false);
        } else if (book && chapter) {
            const b = this.state.books.find(x => x.abbrev.toLowerCase() === book.toLowerCase());
            if (b) {
                this.loadBook(b.abbrev, b.name, parseInt(chapter), false);
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
            const v = params.get('v');
            const b = params.get('book');
            const c = params.get('chapter');
            const s = params.get('search');
            const viewParam = params.get('view');
            
            if (v && v !== this.state.currentVersion) {
                this.state.currentVersion = v;
                document.getElementById('version-selector').value = v;
                this.loadBooks();
            }

            if (viewParam === 'highlights') {
                this.showHighlightsPage(false);
            } else if (b && c) {
                const bookObj = this.state.books.find(x => x.abbrev.toLowerCase() === b.toLowerCase());
                if (bookObj) this.loadBook(bookObj.abbrev, bookObj.name, parseInt(c), false);
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

    async loadVersions() {
        const flagMap = {
            'pt-br': '🇧🇷',
            'en-us': '🇺🇸',
            'pt': '🇧🇷',
            'en': '🇺🇸'
        };
        try {
            const res = await fetch('/api/versions');
            const data = await res.json();
            if (Array.isArray(data)) {
                this.state.versions = data;
            } else {
                this.state.versions = [];
                throw new Error("Versions is not an array");
            }
            
            if (!localStorage.bibleVersion) {
                const nviVersion = this.state.versions.find(v => v.name.toUpperCase() === 'NVI');
                if (nviVersion) {
                    this.state.currentVersion = nviVersion.name;
                    localStorage.bibleVersion = nviVersion.name;
                } else {
                    const ptVersion = this.state.versions.find(v => v.language.toLowerCase().startsWith('pt'));
                    if (ptVersion) {
                        this.state.currentVersion = ptVersion.name;
                        localStorage.bibleVersion = ptVersion.name;
                    } else if (this.state.versions.length > 0) {
                        this.state.currentVersion = this.state.versions[0].name;
                    }
                }
            }

            const selector = document.getElementById('version-selector');
            if (selector) {
                selector.innerHTML = this.state.versions.map(v => {
                    const flag = flagMap[v.language.toLowerCase()] || '🌐';
                    return `<option value="${v.name}" ${v.name === this.state.currentVersion ? 'selected' : ''}>${flag} ${v.name}</option>`;
                }).join('');
            }
        } catch (e) {
            console.error("Error loading versions", e);
            this.state.versions = [];
        }
    },

    async changeVersion(v) {
        const main = document.getElementById('main-content');
        main.classList.add('opacity-0');
        await new Promise(resolve => setTimeout(resolve, 300));

        const oldBook = this.state.currentBook;
        this.state.currentVersion = v;
        localStorage.bibleVersion = v;
        
        await this.loadVersions();
        this.updateUIStrings();
        await this.loadBooks();
        await this.loadHighlights(); // Recarrega grifos correspondentes à versão nova
        
        if (oldBook) {
            const newBook = this.state.books.find(b => b.number === oldBook.number);
            if (newBook) {
                await this.loadBook(newBook.abbrev, newBook.name, this.state.currentChapter, true);
            } else {
                this.showHome();
            }
        } else {
            this.showHome();
        }

        main.classList.remove('opacity-0');
    },

    async loadBooks() {
        try {
            const res = await fetch(`/api/books?v=${this.state.currentVersion}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                this.state.books = data;
            } else {
                this.state.books = [];
                throw new Error("Books is not an array");
            }
            this.renderSidebar();
            this.renderSidebarDonation();
        } catch (e) {
            console.error("Erro ao carregar livros", e);
            this.state.books = [];
            const main = document.getElementById('main-content');
            if (main) {
                main.innerHTML = `<p class="text-red-500 text-center">${this.t('errorLoading')}</p>`;
            }
        }
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (sidebar.classList.contains('-translate-x-full')) {
            sidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.remove('opacity-0'), 10);
        } else {
            sidebar.classList.add('-translate-x-full');
            overlay.classList.add('opacity-0');
            setTimeout(() => overlay.classList.add('hidden'), 300);
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
        
        // Link para Itens Grifados no início da sidebar
        let html = `
            <div class="mb-4 px-2">
                <button onclick="app.toggleSidebar(); app.showHighlightsPage()" class="w-full flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all text-left">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                    </svg>
                    <span>${this.t('highlightedItems')}</span>
                </button>
            </div>
        `;
        
        this.state.books.forEach(b => {
            html += `
                <div class="border-b border-slate-100 dark:border-slate-800/50 last:border-0">
                    <button onclick="app.toggleSidebarBook('${b.abbrev}')" class="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors text-left">
                        <span class="font-medium text-slate-700 dark:text-slate-300">${b.name}</span>
                        <svg id="sidebar-icon-${b.abbrev}" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                    <div id="sidebar-book-${b.abbrev}" class="hidden p-2 grid grid-cols-5 gap-1 bg-slate-50/50 dark:bg-slate-800/30 rounded-lg mb-2">
            `;
            
            const maxChapters = b.chapters || 1;
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
            history.pushState(null, '', `/?v=${this.state.currentVersion}`);
        }
        this.disconnectObserver();
        this.state.currentBook = null;
        this.renderHome();
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
            document.getElementById('search-clear').classList.add('hidden');
        }
    },

    clearSearch() {
        const input = document.getElementById('search-input');
        input.value = '';
        input.focus();
        document.getElementById('search-clear').classList.add('hidden');
        this.showHome();
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
        if (!this.state.books || this.state.books.length === 0) {
            const main = document.getElementById('main-content');
            if (main && !main.innerHTML.includes(this.t('errorLoading'))) {
                main.innerHTML = `<p class="text-red-500 text-center mt-10 font-medium">${this.t('errorLoading')}</p>`;
            }
            return;
        }
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
            history.pushState(null, '', `?v=${this.state.currentVersion}&book=${abbrev}&chapter=${startChapter}`);
        }
        
        const bookObj = this.state.books.find(x => x.abbrev === abbrev);
        this.state.currentBook = bookObj || { abbrev, name };
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
            const res = await fetch(`/api/books/${abbrev}/${chapterNum}?v=${this.state.currentVersion}`);
            if (!res.ok) {
                this.disconnectObserver();
                if (indicator) indicator.classList.add('hidden');
                
                const container = document.getElementById('reading-container');
                if (container && isAppend && !document.getElementById('end-of-book-marker')) {
                    const endDiv = document.createElement('div');
                    endDiv.id = 'end-of-book-marker';
                    endDiv.className = "text-center py-12 mt-10 border-t border-slate-200 dark:border-slate-800";
                    endDiv.innerHTML = `
                        <p class="text-slate-500 mb-6 text-lg">${this.t('endOfBook')} <span class="font-bold">${this.state.currentBook.name}</span>.</p>
                        
                        <div class="max-w-sm mx-auto mb-8 p-6 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 rounded-2xl shadow-sm">
                            <p class="text-emerald-800 dark:text-emerald-300 mb-4 font-medium">${this.t('donationTitle')}</p>
                            <a href="https://nubank.com.br/cobrar/38y8q/69ef5c65-a3f0-49a6-86b6-02a2893ddff5" target="_blank" rel="noopener noreferrer"
                                class="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-md">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
                                ${this.t('donationButton')}
                            </a>
                        </div>

                        <button onclick="app.showHome()" class="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-md">
                            ${this.t('backToBooks')}
                        </button>
                    `;
                    container.appendChild(endDiv);
                }
                
                this.loadingNext = false;
                return;
            }
            
            const verses = await res.json();
            this.state.currentChapter = chapterNum;
            this.renderChapter(verses, isAppend);

            if (isAppend) {
                history.replaceState(null, '', `?v=${this.state.currentVersion}&book=${abbrev}&chapter=${chapterNum}`);
            }

            if (indicator) indicator.classList.add('hidden');
            this.loadingNext = false;
            setTimeout(() => this.setupInfiniteScroll(), 50);

        } catch (e) {
            console.error(e);
            if (!isAppend) {
                document.getElementById('main-content').innerHTML = `
                    <div class="text-center py-10">
                        <p class="text-slate-500 mb-4">${this.t('chapterNotFound')}</p>
                        <button onclick="app.showHome()" class="text-indigo-600 underline">${this.t('backToHome')}</button>
                    </div>
                `;
            }
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
            const isHighlighted = this.isVerseHighlighted(b.abbrev, c, v.verse);
            const hlClass = isHighlighted ? 'bg-yellow-200/80 dark:bg-yellow-900/40 border-l-4 border-yellow-500 pl-2' : '';
            
            html += `
                <p id="v-${b.abbrev}-${c}-${v.verse}" 
                   onclick="app.handleVerseClick('${b.abbrev}', '${b.name.replace(/'/g, "\\'")}', ${c}, ${v.verse}, '${v.text.replace(/'/g, "\\'")}')" 
                   title="${this.t('highlightTooltip')}"
                   class="hover:bg-slate-100 dark:hover:bg-slate-850/50 p-2 rounded transition-colors group cursor-pointer relative ${hlClass}">
                    <sup class="text-indigo-500 dark:text-indigo-400 font-sans font-bold mr-1 text-xs opacity-70 group-hover:opacity-100">${v.verse}</sup>
                    <span>${v.text}</span>
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
                const nextChapter = this.state.currentChapter + 1;
                this.loadChapter(this.state.currentBook.abbrev, nextChapter, true);
            }
        }, {
            rootMargin: "200px"
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
        const input = document.getElementById('search-input');
        const clearBtn = document.getElementById('search-clear');
        const q = input.value;
        
        if (q.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }

        if (q.length === 0) {
            this.showHome();
            return;
        }
        
        if (q.trim().length < 2) return;

        this.searchTimeout = setTimeout(() => {
            this.performSearch(q.trim());
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
            const newUrl = `?v=${this.state.currentVersion}&search=${encodeURIComponent(query)}`;
            if (window.location.search.includes('search=')) {
                history.replaceState(null, '', newUrl);
            } else {
                history.pushState(null, '', newUrl);
            }
        }

        this.disconnectObserver();
        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="flex justify-center h-40 items-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>`;
        
        try {
            const qNormalized = this.normalizeString(query);
            const matchedBooks = this.state.books.filter(b => 
                this.normalizeString(b.name).includes(qNormalized) || 
                this.normalizeString(b.abbrev).includes(qNormalized)
            );

            const res = await fetch(`/api/search?v=${this.state.currentVersion}&q=${encodeURIComponent(query)}`);
            const results = await res.json();
            
            let html = `
                <div class="max-w-3xl mx-auto">
                    <h2 class="text-2xl font-bold mb-6">${this.t('resultsFor')} "${query}"</h2>
            `;

            if (matchedBooks.length > 0) {
                html += `
                    <div class="mb-8">
                        <h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">${this.t('booksFound')}</h3>
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

            html += `<h3 class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-3 border-b border-slate-200 dark:border-slate-800 pb-2">${this.t('versesFound')} (${results ? results.length : 0})</h3>`;
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
                html += `<p class="text-slate-500">${this.t('noVerses')}</p>`;
            }

            html += `</div></div>`;
            main.innerHTML = html;
            
        } catch (e) {
            console.error(e);
            main.innerHTML = `<p class="text-red-500 text-center mt-10">Error performing search.</p>`;
        }
    },

    // --- Sistema de Grifos (Highlights) ---

    async loadHighlights() {
        try {
            const res = await fetch(`/api/highlights`);
            if (res.ok) {
                const data = await res.json();
                this.state.highlights = Array.isArray(data) ? data : [];
            } else {
                this.state.highlights = [];
            }
        } catch (e) {
            console.error("Erro ao carregar grifos", e);
            this.state.highlights = [];
        }
    },

    isVerseHighlighted(bookAbbrev, chapter, verse) {
        return this.state.highlights.some(h => 
            h.book_abbrev === bookAbbrev && 
            h.chapter === parseInt(chapter) && 
            h.verse === parseInt(verse) &&
            h.version_name === this.state.currentVersion
        );
    },

    async handleVerseClick(bookAbbrev, bookName, chapter, verse, text) {
        const isHighlighted = this.isVerseHighlighted(bookAbbrev, chapter, verse);
        
        if (isHighlighted) {
            // Remove o grifo
            try {
                const res = await fetch(`/api/highlights?book=${bookAbbrev}&chapter=${chapter}&verse=${verse}&v=${this.state.currentVersion}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    this.state.highlights = this.state.highlights.filter(h => 
                        !(h.book_abbrev === bookAbbrev && h.chapter === chapter && h.verse === verse && h.version_name === this.state.currentVersion)
                    );
                    const el = document.getElementById(`v-${bookAbbrev}-${chapter}-${verse}`);
                    if (el) {
                        el.className = el.className.replace(/bg-yellow-200\/80|dark:bg-yellow-900\/40|border-l-4|border-yellow-500|pl-2/g, '').trim();
                    }
                }
            } catch (e) {
                console.error("Erro ao remover grifo", e);
            }
        } else {
            // Adiciona o grifo
            const newHighlight = {
                book_abbrev: bookAbbrev,
                book_name: bookName,
                chapter: parseInt(chapter),
                verse: parseInt(verse),
                text: text,
                version_name: this.state.currentVersion
            };
            try {
                const res = await fetch('/api/highlights', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newHighlight)
                });
                if (res.ok) {
                    const saved = await res.json();
                    if (saved && saved.id) {
                        this.state.highlights.push(saved);
                    } else {
                        this.state.highlights.push(newHighlight);
                    }
                    const el = document.getElementById(`v-${bookAbbrev}-${chapter}-${verse}`);
                    if (el) {
                        el.classList.add('bg-yellow-200/80', 'dark:bg-yellow-900/40', 'border-l-4', 'border-yellow-500', 'pl-2');
                    }
                }
            } catch (e) {
                console.error("Erro ao adicionar grifo", e);
            }
        }
    },

    async showHighlightsPage(updateUrl = true) {
        if (updateUrl) {
            history.pushState(null, '', `?v=${this.state.currentVersion}&view=highlights`);
        }
        this.disconnectObserver();
        this.state.currentBook = null;

        const main = document.getElementById('main-content');
        main.innerHTML = `<div class="flex justify-center h-40 items-center"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>`;

        await this.loadHighlights();

        let html = `
            <div class="max-w-3xl mx-auto">
                <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                    </div>
                    <h2 class="text-2xl md:text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">${this.t('highlightedItems')}</h2>
                </div>
                <div class="space-y-4">
        `;

        if (this.state.highlights.length > 0) {
            this.state.highlights.forEach(h => {
                html += `
                    <div class="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm cursor-pointer hover:border-indigo-500 transition-colors" 
                         onclick="app.loadBook('${h.book_abbrev}', '${h.book_name}', ${h.chapter})">
                        <div class="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
                            ${h.book_name} ${h.chapter}:${h.verse} <span class="text-xs text-slate-400 font-normal">(${h.version_name})</span>
                        </div>
                        <div class="text-slate-700 dark:text-slate-300 font-serif italic border-l-2 border-yellow-500 pl-3">
                            ${h.text}
                        </div>
                    </div>
                `;
            });
        } else {
            html += `<p class="text-slate-500 text-center py-10">${this.t('noHighlights')}</p>`;
        }

        html += `</div></div>`;
        main.innerHTML = html;
        window.scrollTo(0,0);
    }
};

window.addEventListener('DOMContentLoaded', () => {
    try {
        app.init();
    } catch (err) {
        console.error("Fatal initialization error:", err);
        const main = document.getElementById('main-content');
        if (main) {
            main.innerHTML = `<p class="text-red-500 text-center">Erro crítico ao iniciar aplicação. Por favor, limpe os dados do site no navegador e recarregue.</p>`;
        }
    }
    
    const searchInput = document.getElementById('search-input');
    
    searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(app.searchTimeout);
            const q = this.value.trim();
            if (q.length >= 2) {
                app.performSearch(q);
                this.blur();
            }
        }
    });

    searchInput.addEventListener('input', function (e) {
        app.handleSearchInput();
    });

    searchInput.addEventListener('focus', function() {
        setTimeout(() => {
            this.setSelectionRange(0, this.value.length);
        }, 50);
    });
});

