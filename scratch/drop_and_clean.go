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

	fmt.Println("Dropping triggers and virtual tables...")
	db.Exec(`DROP TRIGGER IF EXISTS verse_ai`)
	db.Exec(`DROP TRIGGER IF EXISTS verse_ad`)
	db.Exec(`DROP TRIGGER IF EXISTS verse_au`)
	db.Exec(`DROP TABLE IF EXISTS Verse_fts`)

	fmt.Println("Cleaning main tables...")
	_, err = db.Exec(`DELETE FROM "Verse"`)
	if err != nil {
		log.Fatal(err)
	}
	_, err = db.Exec(`DELETE FROM "Book"`)
	if err != nil {
		log.Fatal(err)
	}
	_, err = db.Exec(`DELETE FROM "Version"`)
	if err != nil {
		log.Fatal(err)
	}
	
	fmt.Println("Database cleaned successfully!")
}
