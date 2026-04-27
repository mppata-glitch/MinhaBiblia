-- Create FTS5 table for full-text search on verses
CREATE VIRTUAL TABLE "Verse_fts" USING fts5(text, content='Verse', content_rowid='id');

-- Triggers to keep FTS index in sync
CREATE TRIGGER "verse_ai" AFTER INSERT ON "Verse" BEGIN
  INSERT INTO "Verse_fts"(rowid, text) VALUES (new.id, new.text);
END;

CREATE TRIGGER "verse_ad" AFTER DELETE ON "Verse" BEGIN
  INSERT INTO "Verse_fts"("Verse_fts", rowid, text) VALUES('delete', old.id, old.text);
END;

CREATE TRIGGER "verse_au" AFTER UPDATE ON "Verse" BEGIN
  INSERT INTO "Verse_fts"("Verse_fts", rowid, text) VALUES('delete', old.id, old.text);
  INSERT INTO "Verse_fts"(rowid, text) VALUES (new.id, new.text);
END;