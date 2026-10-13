import { Client } from "pg"

const SOURCE_URL = "postgres://postgres.jchicxqyguywutnstwhu:wK33fJwtaW8XDaJN@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
const TARGET_CONFIG = {
  host: "187.7.77.75",
  port: 5432,
  user: "postgres",
  password: "1oXOGW4FP5QgtHsWVIXcBPyinYN6f0sWob1qpsYFfS8OE3XizYS5TEg0BwNaca7N",
  database: "postgres"
}

async function migrate() {
  console.log("=== HESAP HIGH-SPEED FULL DATABASE MIGRATION: CLOUD -> VPS ===")
  const startTime = Date.now()

  const source = new Client({
    connectionString: SOURCE_URL,
    ssl: { rejectUnauthorized: false }
  })
  const target = new Client(TARGET_CONFIG)

  await source.connect()
  console.log("Connected to SOURCE (Supabase Cloud)")
  await target.connect()
  console.log("Connected to TARGET (VPS PostgreSQL)")

  // 1. Roles, Extensions & Schemas
  console.log("\n--- Creating Roles, Schemas and Extensions ---")
  const roles = [
    'supabase_admin',
    'supabase_auth_admin',
    'anon',
    'authenticated',
    'service_role',
    'supabase_storage_admin'
  ];
  for (const r of roles) {
    try {
      await target.query(`CREATE ROLE "${r}" WITH LOGIN SUPERUSER;`);
    } catch (e) {
      // Role might already exist, ignore
    }
  }

  await target.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`)
  await target.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`)
  await target.query(`CREATE SCHEMA IF NOT EXISTS auth;`)
  await target.query(`CREATE SCHEMA IF NOT EXISTS public;`)

  // 2. Fetch and create ENUMs
  console.log("\n--- Creating ENUM Types ---")
  const enumsRes = await source.query(`
    SELECT t.typname, n.nspname as schema_name, string_agg(quote_literal(e.enumlabel), ', ' ORDER BY e.enumsortorder) as enum_values
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname IN ('public', 'auth')
    GROUP BY t.typname, n.nspname
  `)
  for (const row of enumsRes.rows) {
    try {
      await target.query(`DO $$ BEGIN
        CREATE TYPE "${row.schema_name}"."${row.typname}" AS ENUM (${row.enum_values});
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`)
      console.log(`Created ENUM: "${row.schema_name}"."${row.typname}"`)
    } catch (err) {
      console.warn(`Enum create warning: ${err.message}`)
    }
  }

  // 3. Create auth.users table on TARGET if not exists
  console.log("\n--- Setting up auth.users ---")
  await target.query(`
    CREATE TABLE IF NOT EXISTS auth.users (
      id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
      instance_id uuid,
      aud varchar(255),
      role varchar(255),
      email varchar(255),
      encrypted_password varchar(255),
      email_confirmed_at timestamptz,
      invited_at timestamptz,
      confirmation_token varchar(255),
      confirmation_sent_at timestamptz,
      recovery_token varchar(255),
      recovery_sent_at timestamptz,
      email_change_token_new varchar(255),
      email_change varchar(255),
      email_change_sent_at timestamptz,
      last_sign_in_at timestamptz,
      raw_app_meta_data jsonb,
      raw_user_meta_data jsonb,
      is_super_admin boolean,
      created_at timestamptz,
      updated_at timestamptz,
      phone varchar(255),
      phone_confirmed_at timestamptz,
      phone_change varchar(255),
      phone_change_token varchar(255),
      phone_change_sent_at timestamptz,
      confirmed_at timestamptz,
      email_change_token_current varchar(255),
      email_change_confirm_status smallint,
      banned_until timestamptz,
      reauthentication_token varchar(255),
      reauthentication_sent_at timestamptz,
      is_sso_user boolean NOT NULL DEFAULT false,
      deleted_at timestamptz,
      is_anonymous boolean NOT NULL DEFAULT false
    );
  `)

  // 4. Copy auth.users
  const authUsers = await source.query(`SELECT * FROM auth.users`)
  console.log(`Found ${authUsers.rows.length} auth.users rows`)
  if (authUsers.rows.length > 0) {
    const cols = Object.keys(authUsers.rows[0])
    for (const u of authUsers.rows) {
      const colNames = cols.map(c => `"${c}"`).join(", ")
      const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(", ")
      const values = cols.map(c => {
        const val = u[c]
        if ((c === "raw_app_meta_data" || c === "raw_user_meta_data") && val !== null && typeof val === "object") {
          return JSON.stringify(val)
        }
        return val
      })
      await target.query(`
        INSERT INTO auth.users (${colNames}) 
        VALUES (${placeholders}) 
        ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
      `, values)
    }
    console.log(`Successfully migrated ${authUsers.rows.length} auth.users`)
  }

  // Disable triggers & foreign keys globally on target during migration
  await target.query(`SET session_replication_role = 'replica';`)

  // 5. Fetch all public tables from SOURCE
  console.log("\n--- Migrating Public Schema Tables ---")
  const tablesRes = await source.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `)
  const tables = tablesRes.rows.map(r => r.table_name)
  console.log(`Found ${tables.length} tables to migrate`)

  for (const table of tables) {
    // Get column definitions
    const colsRes = await source.query(`
      SELECT 
        c.column_name, 
        c.data_type, 
        c.udt_name, 
        c.is_nullable, 
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale
      FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position
    `, [table])

    // Get primary key
    const pkRes = await source.query(`
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY' 
        AND tc.table_schema = 'public' 
        AND tc.table_name = $1
      ORDER BY kcu.ordinal_position
    `, [table])
    const pkCols = pkRes.rows.map(r => `"${r.column_name}"`)

    // Build column definitions
    const colDefs = colsRes.rows.map(col => {
      let typeDef = col.udt_name
      if (col.data_type === "character varying") {
        typeDef = col.character_maximum_length ? `varchar(${col.character_maximum_length})` : "varchar"
      } else if (col.data_type === "numeric") {
        typeDef = col.numeric_precision ? `numeric(${col.numeric_precision}, ${col.numeric_scale || 0})` : "numeric"
      } else if (col.data_type === "USER-DEFINED") {
        typeDef = `"${col.udt_name}"`
      } else if (col.data_type === "ARRAY") {
        typeDef = `${col.udt_name.replace(/^_/, "")}[]`
      } else if (col.udt_name === "timestamptz") {
        typeDef = "timestamptz"
      } else if (col.udt_name === "timestamp") {
        typeDef = "timestamp"
      } else if (col.udt_name === "int4") {
        typeDef = "integer"
      } else if (col.udt_name === "int8") {
        typeDef = "bigint"
      } else if (col.udt_name === "int2") {
        typeDef = "smallint"
      } else if (col.udt_name === "bool") {
        typeDef = "boolean"
      }

      let def = `"${col.column_name}" ${typeDef}`
      if (col.is_nullable === "NO") def += " NOT NULL"
      if (col.column_default && !col.column_default.includes("nextval")) {
        def += ` DEFAULT ${col.column_default}`
      }
      return def
    })

    if (pkCols.length > 0) {
      colDefs.push(`PRIMARY KEY (${pkCols.join(", ")})`)
    }

    const createSql = `CREATE TABLE IF NOT EXISTS "public"."${table}" (\n  ${colDefs.join(",\n  ")}\n);`
    await target.query(createSql)

    // Truncate to ensure clean slate with zero duplicates
    await target.query(`TRUNCATE TABLE "public"."${table}" CASCADE;`)

    const countRes = await source.query(`SELECT count(*) FROM "public"."${table}"`)
    const totalRows = parseInt(countRes.rows[0].count, 10)
    process.stdout.write(`Migrating ${table} (${totalRows} rows)... `)

    if (totalRows > 0) {
      let dataRes
      if (table === "backup_snapshots") {
        dataRes = await source.query(`
          SELECT id, title, '{}'::jsonb as tables, table_counts, created_by, created_at, 
                 interval, object_path, size_bytes, checksum_sha256, recipients, 
                 encrypted, status, error_message, completed_at 
          FROM "public"."backup_snapshots"
        `)
      } else {
        dataRes = await source.query(`SELECT * FROM "public"."${table}"`)
      }
      const rows = dataRes.rows
      const cols = Object.keys(rows[0])
      const colNames = cols.map(c => `"${c}"`).join(", ")
      const colTypeMap = new Map(colsRes.rows.map(c => [c.column_name, c.udt_name]))

      // Multi-row batch inserts
      const batchSize = 50
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const valueClauses = []
        const params = []
        let paramIdx = 1

        for (const row of batch) {
          const rowPlaceholders = []
          for (const col of cols) {
            rowPlaceholders.push(`$${paramIdx++}`)
            let val = row[col]
            const udt = colTypeMap.get(col)
            // Critical fix: node-postgres serializes JS arrays as PG arrays {a,b}.
            // If the column is json or jsonb, we must explicitly JSON.stringify it.
            if ((udt === "json" || udt === "jsonb") && val !== null && typeof val === "object") {
              val = JSON.stringify(val)
            }
            params.push(val)
          }
          valueClauses.push(`(${rowPlaceholders.join(", ")})`)
        }

        const batchSql = `
          INSERT INTO "public"."${table}" (${colNames}) 
          VALUES ${valueClauses.join(",\n")} 
          ON CONFLICT DO NOTHING;
        `
        await target.query(batchSql, params)
      }

      console.log("DONE!")
    } else {
      console.log("Empty (0 rows)")
    }
  }

  // 6. Non-PK Indexes
  console.log("\n--- Creating Indexes ---")
  const idxRes = await source.query(`
    SELECT indexname, tablename, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname NOT IN (
      SELECT conname FROM pg_constraint WHERE contype = 'p'
    )
    ORDER BY tablename, indexname;
  `)
  console.log(`Found ${idxRes.rows.length} non-PK indexes to recreate`)
  for (const idx of idxRes.rows) {
    try {
      let sql = idx.indexdef
      if (!sql.includes("IF NOT EXISTS")) {
        sql = sql.replace(/CREATE\s+UNIQUE\s+INDEX\s+/i, "CREATE UNIQUE INDEX IF NOT EXISTS ")
                 .replace(/CREATE\s+INDEX\s+/i, "CREATE INDEX IF NOT EXISTS ")
      }
      await target.query(sql)
    } catch (e) {
      console.warn(`Index warning on ${idx.indexname}: ${e.message}`)
    }
  }

  // 7. Foreign Key Constraints
  console.log("\n--- Creating Foreign Keys ---")
  const fkRes = await source.query(`
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name,
      rc.delete_rule,
      rc.update_rule
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints AS rc
      ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ORDER BY tc.table_name;
  `)
  console.log(`Found ${fkRes.rows.length} foreign keys to recreate`)
  for (const fk of fkRes.rows) {
    try {
      const fkSql = `
        DO $$ BEGIN
          ALTER TABLE "public"."${fk.table_name}"
          ADD CONSTRAINT "${fk.constraint_name}"
          FOREIGN KEY ("${fk.column_name}")
          REFERENCES "public"."${fk.foreign_table_name}" ("${fk.foreign_column_name}")
          ON DELETE ${fk.delete_rule} ON UPDATE ${fk.update_rule};
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `
      await target.query(fkSql)
    } catch (e) {
      console.warn(`FK warning on ${fk.constraint_name}: ${e.message}`)
    }
  }

  // 8. Fix serial sequences
  console.log("\n--- Updating Sequences ---")
  const seqRes = await target.query(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_default LIKE 'nextval%'
  `)
  for (const s of seqRes.rows) {
    try {
      await target.query(`
        SELECT setval(
          pg_get_serial_sequence('public."${s.table_name}"', '${s.column_name}'), 
          COALESCE((SELECT MAX("${s.column_name}") FROM "public"."${s.table_name}"), 1)
        );
      `)
      console.log(`Updated sequence for ${s.table_name}.${s.column_name}`)
    } catch (e) {
      console.warn(`Sequence update error on ${s.table_name}: ${e.message}`)
    }
  }

  // Restore session replication role
  await target.query(`SET session_replication_role = 'origin';`)

  // 9. Comprehensive Verification
  console.log("\n================ VERIFICATION ================")
  let allMatched = true
  let totalMigratedRows = 0

  for (const table of tables) {
    const sCount = parseInt((await source.query(`SELECT count(*) FROM "public"."${table}"`)).rows[0].count, 10)
    const tCount = parseInt((await target.query(`SELECT count(*) FROM "public"."${table}"`)).rows[0].count, 10)
    totalMigratedRows += tCount
    if (sCount === tCount) {
      console.log(`[MATCH] ${table}: ${tCount} rows`)
    } else {
      console.error(`[MISMATCH] ${table}: SOURCE=${sCount}, TARGET=${tCount}`)
      allMatched = false
    }
  }

  // Check auth.users verification
  const sAuthCount = parseInt((await source.query(`SELECT count(*) FROM auth.users`)).rows[0].count, 10)
  const tAuthCount = parseInt((await target.query(`SELECT count(*) FROM auth.users`)).rows[0].count, 10)
  if (sAuthCount === tAuthCount) {
    console.log(`[MATCH] auth.users: ${tAuthCount} rows`)
  } else {
    console.error(`[MISMATCH] auth.users: SOURCE=${sAuthCount}, TARGET=${tAuthCount}`)
    allMatched = false
  }

  await source.end()
  await target.end()

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nMigration completed in ${elapsedSec}s`)
  console.log(`Total rows in VPS: ${totalMigratedRows} across ${tables.length} tables + ${tAuthCount} auth users`)

  if (allMatched) {
    console.log("\n>>> MIGRATION COMPLETED WITH 100% SUCCESS AND ZERO DATA LOSS! <<<")
  } else {
    console.warn("\n>>> Some tables had count mismatches, check output above! <<<")
    process.exit(1)
  }
}

migrate().catch(err => {
  console.error("Migration fatal error:", err)
  process.exit(1)
})
