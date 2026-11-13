import {test} from 'node:test';
import assert from 'node:assert/strict';
import {columnValue,groupEntries,csv} from './model.js';
test('custom regex and capture group retain JavaScript semantics',()=>{
 assert.equal(columnValue({name:'feat(écran)'},{source:'name',regex:'(?<=feat\\()(.*)(?=\\))',group:1}),'écran');
});
test('UTC grouping, chronological order, totals',()=>{
 const groups=groupEntries([{date:'2026-11-13T00:30:00+02:00',duration:30},{date:'2026-11-12T20:00:00Z',duration:15}]);
 assert.equal(groups.length,1);assert.equal(groups[0].day,'2026-11-12');assert.equal(groups[0].minutes,45);assert.equal(groups[0].entries[0].duration,15);
});
test('CSV includes BOM CRLF and escapes data without interpreting HTML',()=>{
 assert.equal(csv(['Tâche'],[['a,"b"\nc'],['<script>']]),'\uFEFFTâche\r\n"a,""b""\nc"\r\n<script>');
});
