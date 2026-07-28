import { afterEach, describe, expect, it } from 'vitest';
import { createApp, normalizeCaptureError, validateCaptureUrl } from '../server.mjs';
import type { Server } from 'node:http';
let server:Server|undefined;afterEach(()=>server?.close());
async function serve(app:ReturnType<typeof createApp>){await new Promise<void>(resolve=>{server=app.listen(0,resolve)});const address=server.address();return `http://127.0.0.1:${typeof address==='object'&&address?address.port:0}`}
const publicDns=async()=>[{address:'93.184.216.34',family:4}];
describe('capture server',()=>{
 it('reports successful health',async()=>{const base=await serve(createApp({health:async()=>({status:'ok',service:'bidlens-capture-api',playwright:'available',browser:'chromium',timestamp:'now'})}));expect(await (await fetch(`${base}/api/health`)).json()).toMatchObject({status:'ok',playwright:'available'})});
 it('reports browser-unavailable health',async()=>{const base=await serve(createApp({health:async()=>{throw Object.assign(new Error('Chromium is not installed.'),{code:'BROWSER_UNAVAILABLE',status:503})}}));const r=await fetch(`${base}/api/health`);expect(r.status).toBe(503);expect(await r.json()).toMatchObject({code:'BROWSER_UNAVAILABLE'})});
 it('rejects invalid and unsupported URLs',async()=>{await expect(validateCaptureUrl('bad',publicDns)).rejects.toMatchObject({code:'INVALID_URL'});await expect(validateCaptureUrl('https://example.com',publicDns)).rejects.toMatchObject({code:'UNSUPPORTED_DOMAIN'})});
 it('rejects private DNS destinations',async()=>expect(validateCaptureUrl('https://www.ebth.com/a',async()=>[{address:'127.0.0.1',family:4}])).rejects.toMatchObject({code:'BLOCKED_DESTINATION'}));
 it('normalizes capture timeouts',()=>expect(normalizeCaptureError(new Error('page.goto: Timeout 20000ms exceeded'))).toMatchObject({code:'CAPTURE_TIMEOUT',status:408}));
 it('preserves a zero-product partial screenshot',async()=>{const result={capture:{sourceUrl:'https://www.ebth.com/a',pageTitle:'A',capturedAt:'now',width:1,height:1,status:'partial',warnings:['No products'],screenshotUrl:'data:image/jpeg;base64,AA=='},products:[],warnings:[{code:'NO_PRODUCTS_FOUND'}]};const base=await serve(createApp({capture:async()=>result}));const data=await (await fetch(`${base}/api/capture`,{method:'POST',headers:{'content-type':'application/json'},body:'{"url":"https://www.ebth.com/a"}'})).json();expect(data.capture.status).toBe('partial');expect(data.products).toEqual([])});
 it('preserves products with row warnings',async()=>{const result={capture:{status:'partial'},products:[{id:'1',extractionWarnings:['Missing bid.']}],warnings:[{code:'PARTIAL_EXTRACTION'}]};const base=await serve(createApp({capture:async()=>result}));const data=await (await fetch(`${base}/api/capture`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).json();expect(data.products[0].extractionWarnings).toEqual(['Missing bid.'])});
});
