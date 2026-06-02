package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"unicode/utf16"

	_ "modernc.org/sqlite"
)

var db *sql.DB

type Book struct {
	ID       int    `json:"id"`
	Number   int    `json:"number"`
	Abbrev   string `json:"abbrev"`
	Name     string `json:"name"`
	Chapters int    `json:"chapters"`
}

type Verse struct {
	ID      int    `json:"id"`
	BookID  int    `json:"book_id"`
	Chapter int    `json:"chapter"`
	Verse   int    `json:"verse"`
	Text    string `json:"text"`
}

func main() {
	var err error

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "../../db/biblia.db"
		if _, err := os.Stat(dbPath); os.IsNotExist(err) {
			dbPath = "db/biblia.db" // Tenta caminho local se rodar da raiz
		}
	}

	log.Printf("Tentando abrir banco de dados SQLite em: %q", dbPath)
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Erro ao abrir banco de dados: %v", err)
	}
	defer db.Close()

	// Força abertura real do arquivo e valida conexão
	if err = db.Ping(); err != nil {
		log.Fatalf("Falha ao pingar/abrir o arquivo do banco de dados SQLite: %v", err)
	}
	log.Println("Conexão com banco SQLite estabelecida (Ping ok)")

	// Executa query simples para atestar existência e consistência das tabelas
	var versionCount int
	err = db.QueryRow(`SELECT count(*) FROM "Version"`).Scan(&versionCount)
	if err != nil {
		log.Printf("AVISO: Falha ao consultar tabela Version (SELECT falhou): %v. Verifique se o banco de dados está migrado/correto.", err)
	} else {
		log.Printf("Banco de dados SQLite validado com sucesso! Encontradas %d versões de bíblia.", versionCount)
	}

	// Criação da tabela de Destaques (Highlights) caso não exista
	_, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS "Highlight" (
			"id" INTEGER PRIMARY KEY AUTOINCREMENT,
			"bookAbbrev" TEXT NOT NULL,
			"bookName" TEXT NOT NULL,
			"chapter" INTEGER NOT NULL,
			"verse" INTEGER NOT NULL,
			"text" TEXT NOT NULL,
			"versionName" TEXT NOT NULL,
			"createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		log.Fatalf("Erro ao inicializar tabela Highlight: %v", err)
	}

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/books", getBooks)
	mux.HandleFunc("GET /api/books/{abbrev}/{chapter}", getChapter)
	mux.HandleFunc("GET /api/search", searchVerses)
	mux.HandleFunc("GET /api/versions", getVersions)
	mux.HandleFunc("GET /api/highlights", getHighlights)
	mux.HandleFunc("POST /api/highlights", addHighlight)
	mux.HandleFunc("DELETE /api/highlights", deleteHighlight)

	staticPath := os.Getenv("STATIC_PATH")
	if staticPath == "" {
		staticPath = "../../static"
		if _, err := os.Stat(staticPath); os.IsNotExist(err) {
			staticPath = "static"
		}
	}

	fs := http.FileServer(http.Dir(staticPath))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Serve os arquivos app.js e sw.js fisicamente de forma dinâmica usando caminhos versionados
		// Isso força a invalidação do cache do Cloudflare (CDN) de forma transparente
		if strings.HasPrefix(r.URL.Path, "/app-v") && strings.HasSuffix(r.URL.Path, ".js") {
			content, err := os.ReadFile(filepath.Join(staticPath, "app.js"))
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			content, err = convertUTF16LEToUTF8(content)
			if err != nil {
				http.Error(w, "Erro ao processar UTF-16: "+err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
			w.Write(content)
			return
		}
		if strings.HasPrefix(r.URL.Path, "/sw-v") && strings.HasSuffix(r.URL.Path, ".js") {
			content, err := os.ReadFile(filepath.Join(staticPath, "sw.js"))
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			content, err = convertUTF16LEToUTF8(content)
			if err != nil {
				http.Error(w, "Erro ao processar UTF-16: "+err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
			w.Write(content)
			return
		}

		if r.URL.Path != "/" && r.URL.Path != "/index.html" {
			fs.ServeHTTP(w, r)
			return
		}

		indexPath := filepath.Join(staticPath, "index.html")
		t, err := template.ParseFiles(indexPath)
		if err != nil {
			fs.ServeHTTP(w, r)
			return
		}

		data := struct {
			AnalyticsID string
		}{
			AnalyticsID: os.Getenv("ANALYTICS_ID"),
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		t.Execute(w, data)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	if port[0] != ':' {
		port = ":" + port
	}

	fmt.Printf("🔥 Servidor rodando em http://localhost%s\n", port)
	
	// Middleware simples de log para registrar todas as chamadas HTTP
	loggingHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("Requisição: %s %s - Cliente: %s", r.Method, r.URL.String(), r.RemoteAddr)
		mux.ServeHTTP(w, r)
	})

	log.Fatal(http.ListenAndServe(port, loggingHandler))
}

func getVersionID(r *http.Request) int {
	vName := r.URL.Query().Get("v")
	if vName == "" {
		// Pega a primeira versão se não especificada
		var id int
		_ = db.QueryRow(`SELECT id FROM "Version" LIMIT 1`).Scan(&id)
		return id
	}
	var id int
	_ = db.QueryRow(`SELECT id FROM "Version" WHERE name = ?`, vName).Scan(&id)
	return id
}

func getVersions(w http.ResponseWriter, r *http.Request) {
	log.Println("Acessando endpoint: GET /api/versions")
	rows, err := db.Query(`SELECT id, name, language FROM "Version"`)
	if err != nil {
		log.Printf("ERRO em getVersions ao consultar banco: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Version struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
		Lang string `json:"language"`
	}
	var versions []Version
	for rows.Next() {
		var v Version
		if err := rows.Scan(&v.ID, &v.Name, &v.Lang); err == nil {
			versions = append(versions, v)
		}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(versions)
}

func getBooks(w http.ResponseWriter, r *http.Request) {
	versionID := getVersionID(r)
	log.Printf("Acessando endpoint: GET /api/books (versionID=%d)", versionID)
	rows, err := db.Query(`
		SELECT id, number, abbrev, name, chapters 
		FROM "Book" 
		WHERE versionId = ? 
		ORDER BY id
	`, versionID)
	if err != nil {
		log.Printf("ERRO em getBooks ao buscar livros (versionID=%d): %v", versionID, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var books []Book
	for rows.Next() {
		var b Book
		if err := rows.Scan(&b.ID, &b.Number, &b.Abbrev, &b.Name, &b.Chapters); err != nil {
			continue
		}
		books = append(books, b)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(books)
}

func getChapter(w http.ResponseWriter, r *http.Request) {
	versionID := getVersionID(r)
	abbrev := r.PathValue("abbrev")
	chapter := r.PathValue("chapter")
	log.Printf("Acessando endpoint: GET /api/books/%s/%s (versionID=%d)", abbrev, chapter, versionID)

	rows, err := db.Query(`
		SELECT v.id, v.bookId, v.chapter, v.verse, v.text 
		FROM "Verse" v
		JOIN "Book" b ON b.id = v.bookId
		WHERE b.abbrev = ? AND v.chapter = ? AND b.versionId = ?
		ORDER BY v.verse
	`, abbrev, chapter, versionID)
	if err != nil {
		log.Printf("ERRO em getChapter ao buscar %s %s (versionID=%d): %v", abbrev, chapter, versionID, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var verses []Verse
	for rows.Next() {
		var v Verse
		if err := rows.Scan(&v.ID, &v.BookID, &v.Chapter, &v.Verse, &v.Text); err != nil {
			continue
		}
		verses = append(verses, v)
	}

	if len(verses) == 0 {
		log.Printf("AVISO em getChapter: Nenhum versículo encontrado para %s %s (versionID=%d)", abbrev, chapter, versionID)
		http.NotFound(w, r)
		return
	}

	log.Printf("getChapter: Retornados %d versículos para %s %s (versionID=%d)", len(verses), abbrev, chapter, versionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(verses)
}

func searchVerses(w http.ResponseWriter, r *http.Request) {
	versionID := getVersionID(r)
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Query parameter 'q' is required", http.StatusBadRequest)
		return
	}
	log.Printf("Acessando endpoint: GET /api/search (query=%q, versionID=%d)", query, versionID)

	rows, err := db.Query(`
		SELECT v.id, v.bookId, v.chapter, v.verse, v.text 
		FROM "Verse_fts" f
		JOIN "Verse" v ON f.rowid = v.id
		JOIN "Book" b ON b.id = v.bookId
		WHERE "Verse_fts" MATCH ? AND b.versionId = ?
		ORDER BY rank
		LIMIT 50
	`, query, versionID)
	if err != nil {
		log.Printf("ERRO em searchVerses para %q (versionID=%d): %v", query, versionID, err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type SearchResult struct {
		Verse
		BookName   string `json:"book_name"`
		BookAbbrev string `json:"book_abbrev"`
	}

	var results []SearchResult
	for rows.Next() {
		var sr SearchResult
		if err := rows.Scan(&sr.ID, &sr.BookID, &sr.Chapter, &sr.Verse, &sr.Text); err != nil {
			continue
		}
		_ = db.QueryRow(`SELECT name, abbrev FROM "Book" WHERE id = ?`, sr.BookID).Scan(&sr.BookName, &sr.BookAbbrev)
		results = append(results, sr)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}

// convertUTF16LEToUTF8 detecta e converte bytes codificados em UTF-16 LE (com BOM) para UTF-8 nativo
func convertUTF16LEToUTF8(utf16Bytes []byte) ([]byte, error) {
	if len(utf16Bytes) < 2 || utf16Bytes[0] != 0xff || utf16Bytes[1] != 0xfe {
		// Sem BOM de UTF-16 LE, retorna os bytes originais intactos
		return utf16Bytes, nil
	}

	data := utf16Bytes[2:]
	if len(data)%2 != 0 {
		return nil, fmt.Errorf("comprimento de dados UTF-16 invalido")
	}

	u16s := make([]uint16, len(data)/2)
	for i := 0; i < len(u16s); i++ {
		u16s[i] = uint16(data[2*i]) | (uint16(data[2*i+1]) << 8)
	}

	runes := utf16.Decode(u16s)
	return []byte(string(runes)), nil
}

type Highlight struct {
	ID          int    `json:"id"`
	BookAbbrev  string `json:"book_abbrev"`
	BookName    string `json:"book_name"`
	Chapter     int    `json:"chapter"`
	Verse       int    `json:"verse"`
	Text        string `json:"text"`
	VersionName string `json:"version_name"`
}

func getHighlights(w http.ResponseWriter, r *http.Request) {
	versionName := r.URL.Query().Get("v")
	var rows *sql.Rows
	var err error

	if versionName != "" {
		rows, err = db.Query(`
			SELECT id, bookAbbrev, bookName, chapter, verse, text, versionName
			FROM "Highlight"
			WHERE versionName = ?
			ORDER BY id DESC
		`, versionName)
	} else {
		rows, err = db.Query(`
			SELECT id, bookAbbrev, bookName, chapter, verse, text, versionName
			FROM "Highlight"
			ORDER BY id DESC
		`)
	}

	if err != nil {
		log.Printf("ERRO em getHighlights: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var highlights []Highlight
	for rows.Next() {
		var h Highlight
		if err := rows.Scan(&h.ID, &h.BookAbbrev, &h.BookName, &h.Chapter, &h.Verse, &h.Text, &h.VersionName); err == nil {
			highlights = append(highlights, h)
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(highlights)
}

func addHighlight(w http.ResponseWriter, r *http.Request) {
	var h Highlight
	if err := json.NewDecoder(r.Body).Decode(&h); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if h.BookAbbrev == "" || h.BookName == "" || h.Chapter <= 0 || h.Verse <= 0 || h.Text == "" || h.VersionName == "" {
		http.Error(w, "Campos obrigatorios ausentes", http.StatusBadRequest)
		return
	}

	// Verifica se ja existe
	var exists bool
	err := db.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM "Highlight"
			WHERE bookAbbrev = ? AND chapter = ? AND verse = ? AND versionName = ?
		)
	`, h.BookAbbrev, h.Chapter, h.Verse, h.VersionName).Scan(&exists)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if exists {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"status": "already_exists"})
		return
	}

	res, err := db.Exec(`
		INSERT INTO "Highlight" (bookAbbrev, bookName, chapter, verse, text, versionName)
		VALUES (?, ?, ?, ?, ?, ?)
	`, h.BookAbbrev, h.BookName, h.Chapter, h.Verse, h.Text, h.VersionName)

	if err != nil {
		log.Printf("ERRO em addHighlight: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	id, _ := res.LastInsertId()
	h.ID = int(id)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(h)
}

func deleteHighlight(w http.ResponseWriter, r *http.Request) {
	bookAbbrev := r.URL.Query().Get("book")
	chapter := r.URL.Query().Get("chapter")
	verse := r.URL.Query().Get("verse")
	versionName := r.URL.Query().Get("v")

	if bookAbbrev == "" || chapter == "" || verse == "" || versionName == "" {
		http.Error(w, "Parametros book, chapter, verse e v sao obrigatorios", http.StatusBadRequest)
		return
	}

	_, err := db.Exec(`
		DELETE FROM "Highlight"
		WHERE bookAbbrev = ? AND chapter = ? AND verse = ? AND versionName = ?
	`, bookAbbrev, chapter, verse, versionName)

	if err != nil {
		log.Printf("ERRO em deleteHighlight: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

