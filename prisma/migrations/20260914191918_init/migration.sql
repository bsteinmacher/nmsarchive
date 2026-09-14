-- CreateTable
CREATE TABLE "Save" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "gameVersion" INTEGER,
    "formatHint" TEXT,
    "playerName" TEXT,
    "saveName" TEXT,
    "galaxy" INTEGER,
    "playTimeSec" BIGINT,
    "sha256" TEXT NOT NULL,
    "slotHint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArchivedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "screenshotPath" TEXT,
    "coordinates" TEXT,
    "galaxy" INTEGER,
    "sourceSaveId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArchivedItem_sourceSaveId_fkey" FOREIGN KEY ("sourceSaveId") REFERENCES "Save" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ItemTag" (
    "itemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("itemId", "tagId"),
    CONSTRAINT "ItemTag_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ArchivedItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ItemTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OperationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "category" TEXT,
    "itemId" TEXT,
    "saveId" TEXT,
    "detail" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OperationLog_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ArchivedItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "OperationLog_saveId_fkey" FOREIGN KEY ("saveId") REFERENCES "Save" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL
);

-- CreateIndex
CREATE INDEX "Save_sha256_idx" ON "Save"("sha256");

-- CreateIndex
CREATE INDEX "ArchivedItem_category_idx" ON "ArchivedItem"("category");

-- CreateIndex
CREATE INDEX "ArchivedItem_seed_idx" ON "ArchivedItem"("seed");

-- CreateIndex
CREATE INDEX "ArchivedItem_galaxy_idx" ON "ArchivedItem"("galaxy");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "ItemTag_tagId_idx" ON "ItemTag"("tagId");

-- CreateIndex
CREATE INDEX "OperationLog_action_idx" ON "OperationLog"("action");

-- CreateIndex
CREATE INDEX "OperationLog_createdAt_idx" ON "OperationLog"("createdAt");
