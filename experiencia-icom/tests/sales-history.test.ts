import {test} from 'node:test';
import assert from 'node:assert/strict';
import {salesHistory,saleDate} from '../lib/sales-history.ts';
import type {Experience} from '../lib/experience.ts';
const row=(id:string,date:string,done=false)=>({id,purchase_date:date,created_at:'2026-10-02',salesperson_id:'joao',salespeople:{name:'João'},status:'aberta',is_demo:false,completed_at:done?'2026-10-02':null,rating_scale:10,experience_responses:done?[{answers:{salesperson_rating:8}}]:[]} as unknown as Experience);
test('sale month uses purchase date even for later links and feedback, counts pending sales',()=>{const rows=[row('a','2026-09-25',true),row('b','2026-10-01'),row('b','2026-10-01'),{...row('c','2026-10-01'),is_demo:true},{...row('d','2026-10-01'),status:'arquivada'}];const h=salesHistory(rows);assert.equal(h[0].month,'2026-10');assert.equal(h[0].sales,1);assert.equal(h[0].responses,0);assert.equal(h[1].month,'2026-09');assert.equal(h[1].responses,1);assert.equal(h[1].quality.mean,8)});
test('sale date rejects missing future and impossible dates',()=>{assert.equal(saleDate('2026-09-30','2026-10-02'),'2026-09-30');for(const v of ['', '2026-10-03','2026-02-30','2026-9-1'])assert.throws(()=>saleDate(v,'2026-10-02'))});
