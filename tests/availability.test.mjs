import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leesHtml, scriptUit, zandbak } from './atlas.mjs';

test('Beschikbaarheid: overlappen, aansluitende huur, annulering en terugkomst', () => {
  const a = zandbak(scriptUit(leesHtml()));
  const car = {id:'car1'};
  a.RENTALS = [{id:'r1',vehicleId:'car1',from:'2026-10-02',to:'2026-10-04'}];
  assert.equal(a.vrijeAuto(car,'2026-10-03','2026-10-05'),false);
  assert.equal(a.vrijeAuto(car,'2026-10-04','2026-10-05'),true);
  assert.equal(a.huurConflict(car,'2026-10-03','2026-10-05','r1'),null);
  a.RENTALS[0].cancelled=true;
  assert.equal(a.vrijeAuto(car,'2026-10-03','2026-10-05'),true);
  a.RENTALS[0].cancelled=false;
  a.RENTALS[0].depart={}; a.RENTALS[0].retour={};
  assert.equal(a.vrijeAuto(car,'2026-10-03','2026-10-05'),true);
});

test('Te laat teruggebrachte auto blokkeert ook de nieuwe contractcontrole', () => {
  const a = zandbak(scriptUit(leesHtml()));
  const car = {id:'car1'};
  a.RENTALS=[{id:'late',vehicleId:'car1',from:'2026-09-28',to:'2026-10-01',depart:{}}];
  assert.equal(a.vrijeAuto(car,'2026-10-02','2026-10-03'),false);
  assert.equal(a.huurConflict(car,'2026-10-02','2026-10-03').id,'late');
  assert.equal(a.vrijeAuto(car,'2026-10-02','2026-10-02'),false);
});

test('Dubbele klik start slechts één opslag en de vergrendeling wordt vrijgegeven', async () => {
  const a=zandbak(scriptUit(leesHtml()));
  let calls=0, finish;
  a.saveRentalEcht=()=>{ calls++; return new Promise(resolve=>{finish=resolve;}); };
  const first=a.saveRental();
  await a.saveRental();
  assert.equal(calls,1);
  finish(); await first;
  assert.equal(a.HUURBEWAREN,false);
  a.saveRentalEcht=async()=>{throw new Error('storage unavailable');};
  await assert.rejects(a.saveRental(),/storage unavailable/);
  assert.equal(a.HUURBEWAREN,false);
});
