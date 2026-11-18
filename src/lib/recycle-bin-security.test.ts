import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const owner = '11111111-1111-1111-1111-111111111111';
const farm = '22222222-2222-2222-2222-222222222222';
const id = '33333333-3333-3333-3333-333333333333';
const migration = readFileSync('drizzle/migrations/0031_secure_owner_recycle_restore.sql', 'utf8');
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE farms(id uuid,owner_id uuid);
    CREATE TABLE deleted_records(id uuid,farm_id uuid,table_name text,row_id uuid,data jsonb,batch_id bigint,deleted_at timestamptz);`);
  for (const [, name] of migration.matchAll(/WHEN '([^']+)' THEN INSERT/g)) {
    await db.exec(`CREATE TABLE ${name}(id uuid PRIMARY KEY,farm_id uuid);`);
  }
  await db.exec(migration);
});
afterAll(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec(`RESET ROLE; DELETE FROM farms; DELETE FROM deleted_records; DELETE FROM health_records;
    INSERT INTO farms VALUES ('${farm}','${owner}'); SET test.uid = '${owner}';`);
});
async function saved(table='health_records', payloadFarm=farm) {
  await db.query(`INSERT INTO deleted_records VALUES ($1,$2,$3,$1,$4,1,now())`,[id,farm,table,JSON.stringify({id,farm_id:payloadFarm})]);
}
it('keeps owner recovery and removes the recovered bin entry',async () => {
  await saved(); await db.exec('SET ROLE authenticated;');
  expect((await db.query<{n:number}>(`SELECT recycle_bin_restore('${id}') n`)).rows[0]?.n).toBe(1);
  await db.exec('RESET ROLE;');
  expect((await db.query('SELECT * FROM health_records')).rows).toHaveLength(1);
  expect((await db.query('SELECT * FROM deleted_records')).rows).toHaveLength(0);
});
it('rejects another farmer',async () => {
  await saved(); await db.exec(`SET test.uid='44444444-4444-4444-4444-444444444444'; SET ROLE authenticated;`);
  await expect(db.query(`SELECT recycle_bin_restore('${id}')`)).rejects.toThrow('not the farm owner');
});
it('rejects mismatched stored farm ownership',async () => {
  await saved('health_records',owner);
  await expect(db.query(`SELECT recycle_bin_restore('${id}')`)).rejects.toThrow('does not match');
});
it('rejects unsupported privileged targets',async () => {
  await saved('user_roles');
  await expect(db.query(`SELECT recycle_bin_restore('${id}')`)).rejects.toThrow('Unsupported');
});
it('denies anonymous execution',async () => {
  await saved(); await db.exec('SET ROLE anon;');
  await expect(db.query(`SELECT recycle_bin_restore('${id}')`)).rejects.toThrow('permission denied');
});
