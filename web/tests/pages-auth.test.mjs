import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {Store} from '../lib/store.ts';
const schema=readFileSync(new URL('../drizzle/0000_futuristic_forge.sql',import.meta.url),'utf8');
const catalogue=JSON.parse(readFileSync(new URL('../lib/catalogue.json',import.meta.url),'utf8'));
class DB {
 constructor(){this.conn=new DatabaseSync(':memory:');this.conn.exec('PRAGMA foreign_keys=ON');this.conn.exec(schema);this.conn.exec(readFileSync(new URL('../drizzle/0001_futuristic_anita_blake.sql',import.meta.url),'utf8'))}
 prepare(sql){const db=this;return new class {args=[];bind(...args){this.args=args;return this}exec(){const r=db.conn.prepare(sql).run(...this.args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}async run(){return this.exec()}async all(){return {results:db.conn.prepare(sql).all(...this.args)}}}}
 async batch(statements){this.conn.exec('BEGIN');try{const result=statements.map(s=>s.exec());this.conn.exec('COMMIT');return result}catch(e){this.conn.exec('ROLLBACK');throw e}}
}

import {PagesAuth,randomSecret,digest} from '../lib/pages-auth.ts';
import {allowedOrigin,cors,validApiMutation} from '../lib/http-policy.ts';
async function authSetup(){const db=new DB(),store=new Store(db,'alice');await store.ensureUser();return {db,auth:new PagesAuth(store)}}
test('proof-bound code is single use, hashed, expires and logout revokes',async()=>{const {db,auth}=await authSetup(),verifier=randomSecret(),state=randomSecret();const code=await auth.issue('alice',await digest(verifier),state,100);assert.notEqual(db.conn.prepare('SELECT code_hash FROM pages_auth_codes').get().code_hash,code);assert.equal(await auth.exchange(code,randomSecret(),state,101),null);assert.equal(await auth.exchange(code,verifier,randomSecret(),101),null);const session=await auth.exchange(code,verifier,state,101);assert.ok(session);assert.equal(await auth.exchange(code,verifier,state,101),null);assert.equal(await auth.identify(session.token,102),'alice');assert.equal(await auth.identify(session.token,session.expires),null);assert.notEqual(db.conn.prepare('SELECT token_hash FROM pages_sessions').get().token_hash,session.token);await auth.revoke(session.token);assert.equal(await auth.identify(session.token,102),null);const expired=await auth.issue('alice',await digest(verifier),state,200);assert.equal(await auth.exchange(expired,verifier,state,320),null)});
test('simultaneous exchanges have exactly one winner',async()=>{const {auth}=await authSetup(),v=randomSecret(),s=randomSecret(),c=await auth.issue('alice',await digest(v),s,100);const results=await Promise.all([auth.exchange(c,v,s,101),auth.exchange(c,v,s,101)]);assert.equal(results.filter(Boolean).length,1)});
test('CORS allows only exact Pages origin and mutations require JSON marker',()=>{const req=(origin)=>new Request('https://backend.example/api/data',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Navigator-Action':'1'}});const good=req('https://autumn-cyber-aka.github.io');assert.equal(allowedOrigin(good),true);assert.equal(validApiMutation(good),true);assert.equal(cors(good).get('Access-Control-Allow-Origin'),'https://autumn-cyber-aka.github.io');assert.equal(cors(good).has('Access-Control-Allow-Credentials'),false);for(const o of ['https://evil.example','https://autumn-cyber-aka.github.io.evil.example','null'])assert.equal(allowedOrigin(req(o)),false);good.headers.delete('X-Navigator-Action');assert.equal(validApiMutation(good),false)});
