-- CreateTable
CREATE TABLE "Version" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Book" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "abbrev" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chapters" INTEGER NOT NULL DEFAULT 1,
    "versionId" INTEGER NOT NULL,
    CONSTRAINT "Book_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "Version" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Verse" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookId" INTEGER NOT NULL,
    "chapter" INTEGER NOT NULL,
    "verse" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    CONSTRAINT "Verse_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Version_name_key" ON "Version"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Book_abbrev_versionId_key" ON "Book"("abbrev", "versionId");

-- CreateIndex
CREATE INDEX "Verse_chapter_idx" ON "Verse"("chapter");

-- CreateIndex
CREATE INDEX "Verse_verse_idx" ON "Verse"("verse");
