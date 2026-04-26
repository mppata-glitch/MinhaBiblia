package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"

	_ "modernc.org/sqlite"
)

type Book struct {
	Abbrev   string     `json:"abbrev"`
	Name     string     `json:"name"`
	Chapters [][]string `json:"chapters"`
}

func main() {
	jsonURL := os.Getenv("BIBLE_JSON_URL")
	if jsonURL == "" {
		jsonURL = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/pt_nvi.json"
	}

	fmt.Printf("Baixando Bíblia NVI de %s...\n", jsonURL)
	resp, err := http.Get(jsonURL)
	if err != nil {
		log.Fatalf("Erro ao baixar JSON: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Erro ao ler resposta: %v", err)
	}

	body = bytes.TrimPrefix(body, []byte("\xef\xbb\xbf")) // Remove UTF-8 BOM if present

	var books []Book
	err = json.Unmarshal(body, &books)
	if err != nil {
		log.Fatalf("Erro ao fazer parse do JSON: %v", err)
	}

	fmt.Printf("Encontrados %d livros. Criando banco de dados...\n", len(books))

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "../../db/biblia.db"
	}

	// Remove existing db if any
	os.Remove(dbPath)

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Erro ao abrir banco: %v", err)
	}
	defer db.Close()

	queries := []string{
		`CREATE TABLE books (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			abbrev TEXT UNIQUE,
			name TEXT
		);`,
		`CREATE TABLE verses (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			book_id INTEGER,
			chapter INTEGER,
			verse INTEGER,
			text TEXT,
			FOREIGN KEY(book_id) REFERENCES books(id)
		);`,
		`CREATE VIRTUAL TABLE verses_fts USING fts5(text, content='verses', content_rowid='id');`,
		`CREATE TRIGGER verses_ai AFTER INSERT ON verses BEGIN
			INSERT INTO verses_fts(rowid, text) VALUES (new.id, new.text);
		END;`,
	}

	for _, q := range queries {
		_, err := db.Exec(q)
		if err != nil {
			log.Fatalf("Erro ao criar tabela: %v", err)
		}
	}

	tx, err := db.Begin()
	if err != nil {
		log.Fatalf("Erro ao iniciar transação: %v", err)
	}

	fmt.Println("Inserindo dados no SQLite...")

	bookStmt, err := tx.Prepare("INSERT INTO books (abbrev, name) VALUES (?, ?)")
	if err != nil {
		log.Fatal(err)
	}
	defer bookStmt.Close()

	verseStmt, err := tx.Prepare("INSERT INTO verses (book_id, chapter, verse, text) VALUES (?, ?, ?, ?)")
	if err != nil {
		log.Fatal(err)
	}
	defer verseStmt.Close()

	for bookIndex, book := range books {
		name := book.Name
		if name == "" {
			name = book.Abbrev 
		}

		res, err := bookStmt.Exec(book.Abbrev, name)
		if err != nil {
			log.Fatalf("Erro ao inserir livro %s: %v", book.Abbrev, err)
		}

		bookID, _ := res.LastInsertId()

		for chapterIndex, chapter := range book.Chapters {
			for verseIndex, text := range chapter {
				_, err := verseStmt.Exec(bookID, chapterIndex+1, verseIndex+1, text)
				if err != nil {
					log.Fatalf("Erro ao inserir versículo: %v", err)
				}
			}
		}
		fmt.Printf("Livro %d/%d importado: %s\n", bookIndex+1, len(books), name)
	}

	err = tx.Commit()
	if err != nil {
		log.Fatalf("Erro ao commitar transação: %v", err)
	}

	fmt.Printf("\n✅ Banco de dados criado com sucesso em %s!\n", dbPath)
}
