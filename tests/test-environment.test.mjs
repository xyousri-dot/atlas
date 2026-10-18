import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {testEnvironment,TEST_URL,TEST_PROJECT} from '../scripts/test-environment.mjs';
import {scriptUit,statements} from './atlas.mjs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const output=testEnvironment(source);
test('preview contains only separate test database, no live gateway',()=>{
  assert.ok(output.includes(TEST_URL));
  assert.ok(!output.includes('mimpyfbitoiotxuqoymj'));
  assert.ok(!output.includes('sb_publishable_ULPcv7mCZw'));
  assert.ok(!output.includes('var gateway='));
  assert.ok(output.includes('TEST · Données fictives'));
  statements(scriptUit(output)); // entire generated script must parse
});
test('old browser data, sessions and queued writes stay outside test namespace',()=>{
  for(const key of ['local','config','session','queue','ocrkey'])assert.ok(output.includes('atlas-test-'+TEST_PROJECT+'-'+key));
  assert.ok(!output.includes('var LKEY2="atlas-local-2"'));
});
test('database URL cannot be overridden by stored/live settings',()=>{
  const statement=statements(scriptUit(output)).find(x=>x.node.type==='FunctionDeclaration'&&x.node.id.name==='sbBasis').src;
  const sandbox={SBSTANDAARD:{url:TEST_URL},SB:{url:'https://not-the-test-project.supabase.co'}};
  vm.createContext(sandbox); vm.runInContext(statement,sandbox);
  assert.equal(sandbox.sbBasis(),TEST_URL);
  assert.ok(output.includes('if(true){ /* Isolated preview'));
  assert.ok(!output.includes('SB={ url:$("stCloudUrl").value.trim()'));
});
test('unexpected source changes stop build rather than silently removing isolation',()=>{
  assert.throws(()=>testEnvironment(source.replace('var LKEY2="atlas-local-2";','var LKEY2="changed";')),/source changed/);
});
