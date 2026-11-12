import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fitTrend,periodFor,createTrends} from '../src/trends.js';
import {geographicBrushBounds} from '../src/geo.js';
const years=Array.from({length:65},(_,i)=>1950+i);
test('OLS, missing values, baseline invariance and periods',()=>{
 const values=years.map(y=>.02*(y-1950));
 assert.ok(Math.abs(fitTrend(years,values,periodFor('full')).rate-.2)<1e-12);
 assert.ok(Math.abs(fitTrend(years,values.map(v=>v+100),periodFor('full')).rate-.2)<1e-12);
 assert.equal(fitTrend(years,values.map((v,i)=>i<50?null:v),periodFor('full')),null);
 assert.deepEqual(periodFor('moving',1979),{start:1950,end:1979});
 assert.deepEqual(periodFor('moving',2014),{start:1985,end:2014});
 assert.equal(geographicBrushBounds([[1,1],[2,2]],([x,y])=>[x-180,90-y]),null);
});
test('all regional windows finite, full-period fidelity and stable pair domain',()=>{
 const bundle=JSON.parse(readFileSync('data/regional_anomalies.json'));
 const regions=JSON.parse(readFileSync('data/regions.json')).regions;
 assert.deepEqual(bundle.regionIds,regions.map(r=>r.id));
 const trends=createTrends(bundle);let maxError=0;
 for(const season of bundle.seasons){
 const rates=trends.getRates(season,periodFor('full'));
 rates.forEach((r,i)=>{maxError=Math.max(maxError,Math.abs(r-regions[i].rates[season]));});
 for(let end=1979;end<=2014;end++)assert.ok(trends.getRates(season,periodFor('moving',end)).every(Number.isFinite));
 }
 console.log('Maximum full-period rate discrepancy:',maxError,'°C/decade');
 assert.ok(maxError<.0002);
 const domain=trends.getDomain('DJF','JJA');
 for(let end=1979;end<=2014;end++){
 const a=trends.getRates('DJF',periodFor('moving',end)),b=trends.getRates('JJA',periodFor('moving',end));
 assert.ok(a.every((r,i)=>Math.abs(r-b[i])<=domain[1]));
 }
 assert.strictEqual(domain,trends.getDomain('JJA','DJF'));
});
