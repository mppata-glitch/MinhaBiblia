package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "modernc.org/sqlite"
)

var db *sql.DB

type Book struct {
	ID     int    `json:"id"`
	Abbrev string `json:"abbrev"`
	Name   string `json:"name"`
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

	// Opcional: Permitir sobrescrever a pasta estática via variável
	staticPath := os.Getenv("STATIC_PATH")
	if staticPath == "" {
		staticPath = "../../static"
		if _, err := os.Stat(staticPath); os.IsNotExist(err) {
			staticPath = "static" // Tenta caminho local se rodar da raiz
		}
	}
	
	fs := http.FileServer(http.Dir(staticPath))
	mux.Handle("/", fs)

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

func getBooks(w http.ResponseWriter, r *http.Request) {
	rows, err := db.Query("SELECT id, abbrev, name FROM books ORDER BY id")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var books []Book
	for rows.Next() {
		var b Book
		if err := rows.Scan(&b.ID, &b.Abbrev, &b.Name); err != nil {
			continue
		}
		books = append(books, b)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(books)
}

func getChapter(w http.ResponseWriter, r *http.Request) {
	abbrev := r.PathValue("abbrev")
	chapter := r.PathValue("chapter")

	rows, err := db.Query(`
		SELECT v.id, v.book_id, v.chapter, v.verse, v.text 
		FROM verses v
		JOIN books b ON b.id = v.book_id
		WHERE b.abbrev = ? AND v.chapter = ?
		ORDER BY v.verse
	`, abbrev, chapter)
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
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Parâmetro 'q' obrigatório", http.StatusBadRequest)
		return
	}

	rows, err := db.Query(`
		SELECT v.id, v.book_id, v.chapter, v.verse, v.text 
		FROM verses_fts f
		JOIN verses v ON f.rowid = v.id
		WHERE verses_fts MATCH ?
		ORDER BY rank
		LIMIT 50
	`, query)
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
		_ = db.QueryRow("SELECT name, abbrev FROM books WHERE id = ?", sr.BookID).Scan(&sr.BookName, &sr.BookAbbrev)
		results = append(results, sr)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(results)
}
