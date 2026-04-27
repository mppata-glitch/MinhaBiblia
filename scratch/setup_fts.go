package main

import (
	"database/sql"
	"fmt"
	"log"
	_ "modernc.org/sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "db/biblia.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	fmt.Println("Creating FTS5 table and triggers...")
	
	sqlStatements := []string{
		`CREATE VIRTUAL TABLE IF NOT EXISTS "Verse_fts" USING fts5(text, content='Verse', content_rowid='id');`,
		`CREATE TRIGGER IF NOT EXISTS "verse_ai" AFTER INSERT ON "Verse" BEGIN
		  INSERT INTO "Verse_fts"(rowid, text) VALUES (new.id, new.text);
		END;`,
		`CREATE TRIGGER IF NOT EXISTS "verse_ad" AFTER DELETE ON "Verse" BEGIN
		  INSERT INTO "Verse_fts"("Verse_fts", rowid, text) VALUES('delete', old.id, old.text);
		END;`,
		`CREATE TRIGGER IF NOT EXISTS "verse_au" AFTER UPDATE ON "Verse" BEGIN
		  INSERT INTO "Verse_fts"("Verse_fts", rowid, text) VALUES('delete', old.id, old.text);
		  INSERT INTO "Verse_fts"(rowid, text) VALUES (new.id, new.text);
		END;`,
	}

	for _, stmt := range sqlStatements {
		_, err := db.Exec(stmt)
		if err != nil {
			log.Fatalf("Error executing SQL (%s): %v", stmt, err)
		}
	}

	fmt.Println("FTS5 setup successfully!")
}
