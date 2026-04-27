package main

import (
	"encoding/json"
	"fmt"
	"os"
	"log"
)

func main() {
	fmt.Println("Downloading NVT.json...")
	// We can download it directly here if it's missing
	data, err := os.ReadFile("nvt.json")
	if err != nil {
		log.Fatal(err)
	}

	var books []interface{}
	err = json.Unmarshal(data, &books)
	if err != nil {
		log.Fatal(err)
	}

	for _, b := range books {
		book := b.(map[string]interface{})
		abbrev := book["abbrev"].(string)
		chapters := book["chapters"].([]interface{})

		newChapters := make([][]string, len(chapters))
		for j, ch := range chapters {
			verses := ch.([]interface{})
			for k, v := range verses {
				switch val := v.(type) {
				case string:
					newChapters[j] = append(newChapters[j], val)
				case []interface{}:
					fmt.Printf("Fixed book %s chapter %d verse %d (nested array found)\n", abbrev, j+1, k+1)
					for _, inner := range val {
						if str, ok := inner.(string); ok {
							newChapters[j] = append(newChapters[j], str)
						}
					}
				default:
					fmt.Printf("Unknown type in %s %d:%d -> %T\n", abbrev, j+1, k+1, v)
				}
			}
		}
		book["chapters"] = newChapters
	}

	out, _ := json.Marshal(books)
	os.WriteFile("nvt_fixed.json", out, 0644)
	fmt.Println("Done. nvt_fixed.json created.")
}
