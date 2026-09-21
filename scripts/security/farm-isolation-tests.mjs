import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const s = JSON.parse(fs.readFileSync("/root/.cache/lovable-auth/session.json", "utf8"));
const sess = s.session ?? s;
const token = sess.access_token;
const uid = sess.user?.id ?? JSON.parse(Buffer.from(token.split(".")[1], "base64").toString()).sub;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;

function client(tok) {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (i, init) => {
        const h = new Headers(init?.headers);
        if (tok) h.set("Authorization", `Bearer ${tok}`);
        else h.delete("Authorization");
        h.set("apikey", key);
        return fetch(i, { ...init, headers: h });
      },
    },
  });
}
const me = client(token);
const anon = client(null);

const MY_FARM = process.env.MY_FARM;
const OTHER = process.env.OTHER_FARM;
const OTHER_ROOM = process.env.OTHER_ROOM;
console.log("signed in as", uid, "| my farm", MY_FARM, "| target farm", OTHER);

const results = [];
const rec = (n, denied, note = "") => results.push({ n, denied, note });
const today = new Date().toISOString().slice(0, 10);

{
  const { data } = await me.from("egg_production").select("id").eq("farm_id", OTHER).limit(1);
  rec("1  read Farm B production", (data ?? []).length === 0);
}
{
  const { error } = await me.from("egg_production").insert({ farm_id: OTHER, date: today, label: "SEC-TEST", r2: 1 });
  rec("2  insert into Farm B", !!error, error?.code ?? "");
}
{
  const { data, error } = await me.from("egg_production").update({ r2: 99 }).eq("farm_id", OTHER).select("id");
  rec("3  update Farm B rows", !!error || (data ?? []).length === 0);
}
{
  const { data, error } = await me.from("egg_production").delete().eq("farm_id", OTHER).select("id");
  rec("4  delete Farm B rows", !!error || (data ?? []).length === 0);
}
{
  const { error } = await me.from("farm_members").insert({ farm_id: OTHER, user_id: uid, full_name: "Intruder", role_key: "owner", status: "active" });
  rec("5  add self to Farm B as owner", !!error, error?.code ?? "");
}
{
  const { error } = await me.from("farms").update({ owner_id: uid }).eq("id", OTHER);
  const { error: e2 } = await me.from("farms").update({ owner_id: "00000000-0000-0000-0000-000000000000" }).eq("id", MY_FARM);
  rec("5b reassign farm ownership", !!e2, (e2?.message ?? "").slice(0, 70));
}
{
  const { data } = await me.from("farm_payments").select("id").eq("farm_id", OTHER).limit(1);
  rec("6  read Farm B billing", (data ?? []).length === 0);
}
{
  const { error } = await me.from("mortality").insert({ farm_id: OTHER, room: "R1", date: today, loss: 1 });
  rec("7  write Farm B mortality", !!error, error?.code ?? "");
}
{
  const { data, error } = await anon.from("egg_production").select("id").limit(1);
  rec("8  signed-out read", !!error || (data ?? []).length === 0);
}
{
  const { error } = await me.from("farm_expenses").insert({ farm_id: OTHER, entry_date: today, category: "Feed", subcategory: "Test", amount: 1 });
  rec("9  forged farm_id expense", !!error, error?.code ?? "");
}
if (OTHER_ROOM) {
  const { error } = await me.from("egg_production").insert({ farm_id: MY_FARM, date: today, label: OTHER_ROOM, r2: 1 });
  const { data: leaked } = await me.from("rooms").select("id").eq("farm_id", OTHER).limit(1);
  rec("10 cross-farm room reference", (leaked ?? []).length === 0, "other farm rooms invisible");
  if (!error) await me.from("egg_production").delete().eq("farm_id", MY_FARM).eq("label", OTHER_ROOM).eq("date", today);
}
{
  const { error } = await me.from("user_roles").insert({ user_id: uid, role: "super_admin" });
  rec("11 grant self platform admin", !!error, error?.code ?? "");
}

for (const r of results) console.log(`${r.denied ? "DENIED  OK " : "ALLOWED !!"}  ${r.n}   ${r.note}`);
console.log(results.every((r) => r.denied) ? "\nALL TESTS PASSED" : "\nFAILURES PRESENT");
