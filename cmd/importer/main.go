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

type BibleBook struct {
	Abbrev   string     `json:"abbrev"`
	Name     string     `json:"name"`
	Chapters [][]string `json:"chapters"`
}

func main() {
	cwd, _ := os.Getwd()
	fmt.Printf("Current working directory: %s\n", cwd)

	jsonURL := os.Getenv("BIBLE_JSON_URL")
	versionName := os.Getenv("BIBLE_VERSION")
	versionLang := os.Getenv("BIBLE_LANG")
	dbPath := os.Getenv("DB_PATH")
	fmt.Printf("DB_PATH: %s\n", dbPath)

	if jsonURL == "" {
		jsonURL = "https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json"
	}
	if versionName == "" {
		versionName = "KJV"
	}
	if versionLang == "" {
		versionLang = "en"
	}

	var body []byte
	var err error
	if _, err = os.Stat(jsonURL); err == nil {
		fmt.Printf("Reading local file %s...\n", jsonURL)
		body, err = os.ReadFile(jsonURL)
		if err != nil {
			log.Fatalf("Error reading local file: %v", err)
		}
	} else {
		fmt.Printf("Downloading %s Bible from %s...\n", versionName, jsonURL)
		var resp *http.Response
		resp, err = http.Get(jsonURL)
		if err != nil {
			log.Fatalf("Error downloading JSON: %v", err)
		}
		defer resp.Body.Close()

		body, err = io.ReadAll(resp.Body)
		if err != nil {
			log.Fatalf("Error reading response: %v", err)
		}
	}

	body = bytes.TrimPrefix(body, []byte("\xef\xbb\xbf")) // Remove UTF-8 BOM if present

	var books []BibleBook
	err = json.Unmarshal(body, &books)
	if err != nil {
		log.Fatalf("Error parsing JSON at unmarshal: %v", err)
	}

	fmt.Printf("Found %d books. Connecting to database...\n", len(books))

	if dbPath == "" {
		dbPath = "db/biblia.db"
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Error opening db: %v", err)
	}
	defer db.Close()

	var versionId int64
	err = db.QueryRow(`SELECT id FROM "Version" WHERE name = ?`, versionName).Scan(&versionId)
	if err == sql.ErrNoRows {
		res, err := db.Exec(`INSERT INTO "Version" (name, language) VALUES (?, ?)`, versionName, versionLang)
		if err != nil {
			log.Fatalf("Error inserting Version: %v", err)
		}
		versionId, _ = res.LastInsertId()
	} else if err != nil {
		log.Fatalf("Error checking Version: %v", err)
	}

	tx, err := db.Begin()
	if err != nil {
		log.Fatalf("Error starting transaction: %v", err)
	}

	fmt.Printf("Importing data for version %s (ID: %d)...\n", versionName, versionId)

	bookStmt, err := tx.Prepare(`INSERT OR REPLACE INTO "Book" (number, abbrev, name, chapters, versionId) VALUES (?, ?, ?, ?, ?)`)
	if err != nil {
		log.Fatal(err)
	}
	defer bookStmt.Close()

	verseStmt, err := tx.Prepare(`INSERT INTO "Verse" (bookId, chapter, verse, text) VALUES (?, ?, ?, ?)`)
	if err != nil {
		log.Fatal(err)
	}
	defer verseStmt.Close()

	for bookIndex, book := range books {
		name := book.Name
		if name == "" {
			name = book.Abbrev
		}

		res, err := bookStmt.Exec(bookIndex+1, book.Abbrev, name, len(book.Chapters), versionId)
		if err != nil {
			log.Fatalf("Error inserting book %s: %v", book.Abbrev, err)
		}

		bookID, _ := res.LastInsertId()

		for chapterIndex, chapter := range book.Chapters {
			for verseIndex, text := range chapter {
				_, err := verseStmt.Exec(bookID, chapterIndex+1, verseIndex+1, text)
				if err != nil {
					log.Fatalf("Error inserting verse: %v", err)
				}
			}
		}
		fmt.Printf("Book %d/%d imported: %s\n", bookIndex+1, len(books), name)
	}

	err = tx.Commit()
	if err != nil {
		log.Fatalf("Error committing transaction: %v", err)
	}

	fmt.Printf("\n✅ Data imported successfully into %s!\n", dbPath)
}
