import { describe, expect, it, vi } from 'vitest';
import { CaptureApiError, parseApiResponse, captureAuction } from './api';
import { getCaptureConfig } from './config';
const response=(body:string,status=200,type='application/json')=>new Response(body,{status,headers:{'content-type':type}});
describe('defensive API parsing',()=>{
  it('parses successful JSON',async()=>expect(await parseApiResponse<{ok:boolean}>(response('{"ok":true}'))).toEqual({ok:true}));
  it('rejects an empty response',async()=>expect(parseApiResponse(response('',200))).rejects.toMatchObject({code:'INVALID_API_RESPONSE'}));
  it('rejects invalid JSON',async()=>expect(parseApiResponse(response('{',200))).rejects.toThrow('invalid JSON'));
  it('rejects HTML errors without exposing the body',async()=>expect(parseApiResponse(response('<h1>Proxy error</h1>',502,'text/html'))).rejects.toThrow('non-JSON'));
  it('preserves an API error message',async()=>expect(parseApiResponse(response('{"error":"Chromium missing","code":"BROWSER_UNAVAILABLE"}',503))).rejects.toMatchObject({message:'Chromium missing',code:'BROWSER_UNAVAILABLE'}));
  it('distinguishes a network failure',async()=>{vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('fetch failed')));await expect(captureAuction('https://www.ebth.com/a')).rejects.toMatchObject({code:'NETWORK_ERROR'});vi.unstubAllGlobals()});
});
describe('capture configuration',()=>{
  it('uses the relative API in development',()=>expect(getCaptureConfig({PROD:false,VITE_CAPTURE_ENABLED:'true'})).toEqual({apiBaseUrl:'',liveCaptureEnabled:true,demoOnly:false}));
  it('makes an unconfigured static production build demo-only',()=>expect(getCaptureConfig({PROD:true,VITE_CAPTURE_ENABLED:'true'}).demoOnly).toBe(true));
  it('enables an external production API',()=>expect(getCaptureConfig({PROD:true,VITE_CAPTURE_ENABLED:'true',VITE_CAPTURE_API_URL:'https://api.example/'}).apiBaseUrl).toBe('https://api.example'));
});
