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

	fmt.Println("Checking abbreviations for '2 Kings' / '2 Reis':")
	rows, err := db.Query(`
		SELECT v.name, b.abbrev, b.name 
		FROM "Book" b 
		JOIN "Version" v ON b.versionId = v.id 
		WHERE b.name LIKE '%Reis%' OR b.name LIKE '%Kings%'
	`)
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var vName, abbrev, bName string
		rows.Scan(&vName, &abbrev, &bName)
		fmt.Printf("Version: %s, Abbrev: %s, Book Name: %s\n", vName, abbrev, bName)
	}
}
