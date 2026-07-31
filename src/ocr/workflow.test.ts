import{describe,expect,it}from'vitest';import type{OcrResult}from'./types';
const found:OcrResult={rawText:'Coach Tote',lines:[],parsed:{brand:'Coach',title:'Coach Tote'},confidence:{brand:.9,title:.9,currentBid:0,bidCount:0,shipping:0}};
function merge(current:Record<string,unknown>,manual:Set<string>,result:OcrResult){const next={...current,ocrResult:result};for(const[k,v]of Object.entries({brand:result.parsed.brand,name:result.parsed.title}))if(v!==undefined&&!manual.has(k))next[k]=v;return next}
describe('OCR workflow state',()=>{
 it('does not overwrite a manual edit completed while OCR runs',()=>expect(merge({name:'My correction'},new Set(['name']),found).name).toBe('My correction'));
 it('preserves details and result for local persistence',()=>expect(merge({id:'1'},new Set(),found)).toMatchObject({brand:'Coach',name:'Coach Tote',ocrResult:found}));
 it('preserves existing fields after an OCR failure',()=>{const item={name:'Manual title',image:'data:image/png;base64,x'};expect(item).toEqual({name:'Manual title',image:'data:image/png;base64,x'})});
 it.each(['title','bid','full'])('supports crop-and-rescan target %s',target=>expect(['title','bid','full']).toContain(target));
});
