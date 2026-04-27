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

	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Erro ao abrir banco de dados: %v", err)
	}
	defer db.Close()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/books", getBooks)
	mux.HandleFunc("GET /api/books/{abbrev}/{chapter}", getChapter)
	mux.HandleFunc("GET /api/search", searchVerses)
	mux.HandleFunc("GET /api/versions", getVersions)

	staticPath := os.Getenv("STATIC_PATH")
	if staticPath == "" {
		staticPath = "../../static"
		if _, err := os.Stat(staticPath); os.IsNotExist(err) {
			staticPath = "static"
		}
	}
	
	fs := http.FileServer(http.Dir(staticPath))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
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
	log.Fatal(http.ListenAndServe(port, mux))
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
	rows, err := db.Query(`SELECT id, name, language FROM "Version"`)
	if err != nil {
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
	rows, err := db.Query(`
		SELECT id, number, abbrev, name, chapters 
		FROM "Book" 
		WHERE versionId = ? 
		ORDER BY id
	`, versionID)
	if err != nil {
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

	rows, err := db.Query(`
		SELECT v.id, v.bookId, v.chapter, v.verse, v.text 
		FROM "Verse" v
		JOIN "Book" b ON b.id = v.bookId
		WHERE b.abbrev = ? AND v.chapter = ? AND b.versionId = ?
		ORDER BY v.verse
	`, abbrev, chapter, versionID)
	if err != nil {
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
		http.NotFound(w, r)
		return
	}

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
