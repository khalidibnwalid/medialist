// A lovely thing I discoverd about drizzle migrate that if it needs to drop-and-recreate a table (for schema change) it won't care about cascade rules
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

// Simple .env parser to avoid dependency issue
function loadEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"'))
          value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'"))
          value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const dbPath = process.env.DATABASE_PATH || "db/sqlite.db";
const db = new Database(dbPath);

const alphabet = "123456789ABCDEFGHJKLMNOPQRSTUVWXYZabcdefghjklmnpqrstuvwxyz";
function generateLongID() {
  let id = "";
  for (let i = 0; i < 20; i++) {
    id += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return id;
}

const USERS_DIR = path.join(process.cwd(), "public", "users");

async function performMediaRecovery(db, usersDir) {
  const stmtCheckMigration = db.prepare(
    "SELECT count FROM (SELECT count(*) as count FROM __drizzle_migrations)",
  );
  const stmtSelectUser = db.prepare("SELECT id FROM users WHERE id = ?");
  const stmtSelectItem = db.prepare(
    "SELECT id, poster_path, cover_path FROM items WHERE id = ? AND user_id = ?",
  );
  const stmtCheckMediaExists = db.prepare(
    "SELECT id, item_id FROM items_media WHERE path = ? AND user_id = ?",
  );
  const stmtUpdateMediaItemId = db.prepare(
    "UPDATE items_media SET item_id = ? WHERE id = ?",
  );
  const stmtInsertMedia = db.prepare(`
    INSERT INTO items_media (id, user_id, item_id, path, type, title, json_keywords, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Check migration count
  const migrationRow = stmtCheckMigration.get();
  const migrationCount = migrationRow ? migrationRow.count : 0;

  if (migrationCount > 3) {
    console.error(
      `Recovery Skipped: Migration count is ${migrationCount}, expected 2`,
    );
    return 0;
  }

  if (!fs.existsSync(usersDir)) {
    console.error("Users directory not found:", usersDir);
    return 0;
  }

  const userIds = fs.readdirSync(usersDir);
  let recoveredCount = 0;

  db.transaction(() => {
    for (const userId of userIds) {
      const userPath = path.join(usersDir, userId);
      if (!fs.statSync(userPath).isDirectory()) continue;

      const user = stmtSelectUser.get(userId);
      if (!user) {
        console.log(`User ${userId} not found in DB, skipping...`);
        continue;
      }

      const listIds = fs.readdirSync(userPath);
      for (const listId of listIds) {
        const listPath = path.join(userPath, listId);
        if (!fs.statSync(listPath).isDirectory()) continue;

        const itemIds = fs.readdirSync(listPath);
        for (const itemId of itemIds) {
          if (itemId === "thumbnails") continue;
          const itemPath = path.join(listPath, itemId);
          if (!fs.statSync(itemPath).isDirectory()) continue;

          const item = stmtSelectItem.get(itemId, userId);
          if (!item) {
            console.log(
              `Item ${itemId} not found in DB for user ${userId}, skipping...`,
            );
            continue;
          }

          const files = fs.readdirSync(itemPath);
          for (const filename of files) {
            if (filename === "thumbnails") continue;

            const filePath = path.join(itemPath, filename);
            if (fs.statSync(filePath).isDirectory()) continue;

            // Skip if it is already the item's poster or cover
            if (filename === item.poster_path || filename === item.cover_path) {
              continue;
            }

            // Check if the path exists for this user in the media table
            const existingMedia = stmtCheckMediaExists.get(filename, userId);
            if (existingMedia) {
              if (!existingMedia.item_id) {
                stmtUpdateMediaItemId.run(itemId, existingMedia.id);
                console.log(
                  `Recovered item_id ${itemId} for existing media ${filename} (ID: ${existingMedia.id})`,
                );
              }
              continue;
            }

            // Check if it has a corresponding 50xH thumbnail
            const thumbPath = path.join(
              itemPath,
              "thumbnails",
              `${filename}_size=50xH.webp`,
            );
            if (fs.existsSync(thumbPath)) continue;

            // Recover media record
            const stats = fs.statSync(filePath);
            const id = generateLongID();
            const now = Math.floor(stats.mtime.getTime() / 1000);

            console.log(
              `Recovering media record: ${filename} (ID: ${id}) for item ${itemId}`,
            );

            stmtInsertMedia.run(
              id,
              userId,
              itemId,
              filename,
              "image",
              "",
              "[]",
              now,
              now,
            );
            recoveredCount++;
          }
        }
      }
    }
  })();

  return recoveredCount;
}


async function performListIdsRecovery(db, usersDir) {
  if (!fs.existsSync(usersDir)) {
    console.error("Users directory not found:", usersDir);
    return 0;
  }

  const stmtUpdateItem = db.prepare(
    "UPDATE items SET list_id = ? WHERE id = ? AND list_id IS NULL",
  );

  const userIds = fs.readdirSync(usersDir);
  let recoveredCount = 0;

  db.transaction(() => {
    for (const userId of userIds) {
      const userPath = path.join(usersDir, userId);
      if (!fs.statSync(userPath).isDirectory()) continue;

      const listIds = fs.readdirSync(userPath);
      for (const listId of listIds) {
        const listPath = path.join(userPath, listId);
        if (!fs.statSync(listPath).isDirectory()) continue;

        const itemIds = fs.readdirSync(listPath);
        for (const itemId of itemIds) {
          if (itemId === "thumbnails") continue;
          const itemPath = path.join(listPath, itemId);
          if (!fs.statSync(itemPath).isDirectory()) continue;

          const result = stmtUpdateItem.run(listId, itemId);
          if (result.changes > 0) {
            console.log(`Recovered list_id ${listId} for item ${itemId}`);
            recoveredCount += result.changes;
          }
        }
      }
    }
  })();

  return recoveredCount;
}

async function recover() {
  console.log("Starting media and list ID recovery ...");
  console.log("Using database:", dbPath);

  const listRecoveredCount = await performListIdsRecovery(db, USERS_DIR);
  console.log(
    `List ID recovery complete. Recovered ${listRecoveredCount} records.`,
  );

  const mediaRecoveredCount = await performMediaRecovery(db, USERS_DIR);
  console.log(
    `Media recovery complete. Recovered ${mediaRecoveredCount} records.`,
  );

  db.close();
}

recover().catch((err) => {
  console.error("Recovery failed:", err);
  if (db) db.close();
  process.exit(1);
});
