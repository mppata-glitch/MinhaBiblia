package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

// TestMainConfig setup da conexão do banco de dados temporariamente para os testes
func setupTestDB(t *testing.T) {
	var err error
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		// go test roda a partir do diretório cmd/server, então o banco de dados está dois níveis acima
		dbPath = "../../db/biblia.db"
	}

	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("Erro ao abrir banco SQLite de teste em %q: %v", dbPath, err)
	}

	if err = db.Ping(); err != nil {
		t.Fatalf("Falha no Ping do banco SQLite em %q: %v. Verifique se o arquivo do banco de dados existe e está correto.", dbPath, err)
	}

	// Garante a tabela de Destaques criada no teste
	_, _ = db.Exec(`
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
}

// TestGetVersions testa o endpoint /api/versions
func TestGetVersions(t *testing.T) {
	setupTestDB(t)
	defer db.Close()

	req, err := http.NewRequest("GET", "/api/versions", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(getVersions)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Código de status incorreto: obteve %v, queria %v", status, http.StatusOK)
	}

	var versions []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
		Lang string `json:"language"`
	}

	if err := json.Unmarshal(rr.Body.Bytes(), &versions); err != nil {
		t.Fatalf("Erro ao decodificar JSON de versões: %v", err)
	}

	if len(versions) == 0 {
		t.Error("Nenhuma versão de bíblia retornada")
	}

	// Verifica se a versão NVI está na lista
	foundNVI := false
	for _, v := range versions {
		if v.Name == "NVI" {
			foundNVI = true
			break
		}
	}
	if !foundNVI {
		t.Error("Versão 'NVI' não encontrada na resposta")
	}
}

// TestGetBooks testa o endpoint /api/books
func TestGetBooks(t *testing.T) {
	setupTestDB(t)
	defer db.Close()

	// Testa sem parâmetros (deve pegar a versão padrão)
	req, err := http.NewRequest("GET", "/api/books", nil)
	if err != nil {
		t.Fatal(err)
	}

	rr := httptest.NewRecorder()
	handler := http.HandlerFunc(getBooks)
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Código de status incorreto para /api/books: obteve %v, queria %v", status, http.StatusOK)
	}

	var books []Book
	if err := json.Unmarshal(rr.Body.Bytes(), &books); err != nil {
		t.Fatalf("Erro ao decodificar JSON de livros: %v", err)
	}

	if len(books) == 0 {
		t.Error("Nenhum livro retornado para a versão padrão")
	}

	// Testa explicitamente com a versão NVI
	reqNVI, err := http.NewRequest("GET", "/api/books?v=NVI", nil)
	if err != nil {
		t.Fatal(err)
	}

	rrNVI := httptest.NewRecorder()
	handler.ServeHTTP(rrNVI, reqNVI)

	if status := rrNVI.Code; status != http.StatusOK {
		t.Errorf("Código de status incorreto para /api/books?v=NVI: obteve %v, queria %v", status, http.StatusOK)
	}

	var booksNVI []Book
	if err := json.Unmarshal(rrNVI.Body.Bytes(), &booksNVI); err != nil {
		t.Fatalf("Erro ao decodificar JSON de livros NVI: %v", err)
	}

	// O primeiro livro da bíblia deve ser Gênesis
	if len(booksNVI) == 0 || booksNVI[0].Abbrev != "gn" {
		t.Errorf("Esperava primeiro livro ser 'gn', obteve %+v", booksNVI[0])
	}
}

// TestGetChapter testa o endpoint /api/books/{abbrev}/{chapter}
func TestGetChapter(t *testing.T) {
	setupTestDB(t)
	defer db.Close()

	req, err := http.NewRequest("GET", "/api/books/gn/1?v=NVI", nil)
	if err != nil {
		t.Fatal(err)
	}
	
	// Como getChapter usa r.PathValue para extrair parâmetros de rota no Go 1.22+,
	// httptest não resolve isso de forma automática se chamarmos a função handler diretamente sem registrar no mux.
	// Por isso, registramos no ServeMux do teste para o roteamento do PathValue funcionar perfeitamente.
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/books/{abbrev}/{chapter}", getChapter)

	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Código de status incorreto para capítulo: obteve %v, queria %v (corpo: %s)", status, http.StatusOK, rr.Body.String())
	}

	var verses []Verse
	if err := json.Unmarshal(rr.Body.Bytes(), &verses); err != nil {
		t.Fatalf("Erro ao decodificar JSON de versículos: %v", err)
	}

	if len(verses) == 0 {
		t.Error("Nenhum versículo retornado para Gênesis 1")
	}

	// Gênesis 1:1 deve começar com "No princípio Deus criou os céus e a terra." na NVI
	expectedText := "No princípio Deus criou os céus e a terra."
	if verses[0].Verse != 1 || verses[0].Text != expectedText {
		t.Errorf("Esperado Gênesis 1:1 com o texto %q, obteve Versículo %d: %q", expectedText, verses[0].Verse, verses[0].Text)
	}
}

// TestServingVersionedAssets testa o serviço de assets JavaScript versionados
func TestServingVersionedAssets(t *testing.T) {
	setupTestDB(t)
	defer db.Close()

	staticPath := os.Getenv("STATIC_PATH")
	if staticPath == "" {
		staticPath = "../../static"
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/app-v") && strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
			http.ServeFile(w, r, filepath.Join(staticPath, "app.js"))
			return
		}
		if strings.HasPrefix(r.URL.Path, "/sw-v") && strings.HasSuffix(r.URL.Path, ".js") {
			w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
			http.ServeFile(w, r, filepath.Join(staticPath, "sw.js"))
			return
		}
		http.NotFound(w, r)
	})

	// Testa /app-v1.2.2.js
	reqApp, err := http.NewRequest("GET", "/app-v1.2.2.js", nil)
	if err != nil {
		t.Fatal(err)
	}
	rrApp := httptest.NewRecorder()
	mux.ServeHTTP(rrApp, reqApp)

	if rrApp.Code != http.StatusOK {
		t.Errorf("Esperava 200 OK para app versionado, obteve %d", rrApp.Code)
	}

	contentTypeApp := rrApp.Header().Get("Content-Type")
	if contentTypeApp != "application/javascript; charset=utf-8" {
		t.Errorf("Esperava content-type 'application/javascript; charset=utf-8', obteve %q", contentTypeApp)
	}

	// Testa /sw-v1.2.2.js
	reqSW, err := http.NewRequest("GET", "/sw-v1.2.2.js", nil)
	if err != nil {
		t.Fatal(err)
	}
	rrSW := httptest.NewRecorder()
	mux.ServeHTTP(rrSW, reqSW)

	if rrSW.Code != http.StatusOK {
		t.Errorf("Esperava 200 OK para service worker versionado, obteve %d", rrSW.Code)
	}
}

// TestHighlights testa endpoints de grifar textos
func TestHighlights(t *testing.T) {
	setupTestDB(t)
	defer db.Close()

	// 1. Limpa a tabela temporariamente para o teste
	_, _ = db.Exec(`DELETE FROM "Highlight"`)

	// 2. Tenta criar um highlight via POST
	payload := `{"book_abbrev":"gn","book_name":"Gênesis","chapter":1,"verse":1,"text":"No princípio Deus criou os céus e a terra.","version_name":"NVI"}`
	reqPost, err := http.NewRequest("POST", "/api/highlights", strings.NewReader(payload))
	if err != nil {
		t.Fatal(err)
	}
	rrPost := httptest.NewRecorder()
	handlerPost := http.HandlerFunc(addHighlight)
	handlerPost.ServeHTTP(rrPost, reqPost)

	if rrPost.Code != http.StatusCreated && rrPost.Code != http.StatusOK {
		t.Errorf("Esperava StatusCreated ou StatusOK, obteve %d", rrPost.Code)
	}

	// 3. Testa listagem GET
	reqGet, err := http.NewRequest("GET", "/api/highlights", nil)
	if err != nil {
		t.Fatal(err)
	}
	rrGet := httptest.NewRecorder()
	handlerGet := http.HandlerFunc(getHighlights)
	handlerGet.ServeHTTP(rrGet, reqGet)

	if rrGet.Code != http.StatusOK {
		t.Errorf("Esperava 200 OK, obteve %d", rrGet.Code)
	}

	var list []Highlight
	if err := json.Unmarshal(rrGet.Body.Bytes(), &list); err != nil {
		t.Fatalf("Erro ao decodificar highlights: %v", err)
	}

	if len(list) != 1 {
		t.Errorf("Esperava 1 highlight, obteve %d", len(list))
	}

	// 4. Testa remoção DELETE
	reqDel, err := http.NewRequest("DELETE", "/api/highlights?book=gn&chapter=1&verse=1&v=NVI", nil)
	if err != nil {
		t.Fatal(err)
	}
	rrDel := httptest.NewRecorder()
	handlerDel := http.HandlerFunc(deleteHighlight)
	handlerDel.ServeHTTP(rrDel, reqDel)

	if rrDel.Code != http.StatusNoContent {
		t.Errorf("Esperava 204 No Content, obteve %d", rrDel.Code)
	}
}

