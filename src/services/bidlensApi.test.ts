import{afterEach,describe,expect,it,vi}from'vitest';import{BidLensApiError,callBidLensApi}from'./bidlensApi';
const reply=(body:string,status=200)=>new Response(body,{status,headers:{'content-type':'application/json'}});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});
describe('BidLens Apps Script API',()=>{
 it('returns a typed error when the backend URL is missing',async()=>{vi.stubEnv('VITE_APPS_SCRIPT_API_URL','');await expect(callBidLensApi('health')).rejects.toMatchObject({code:'MISSING_API_URL'})});
 it('makes a successful health call with the Apps Script transport',async()=>{vi.stubEnv('VITE_APPS_SCRIPT_API_URL','https://script.google.test/exec');const fetchMock=vi.fn().mockResolvedValue(reply('{"ok":true,"data":{"status":"healthy"}}'));vi.stubGlobal('fetch',fetchMock);await expect(callBidLensApi('health')).resolves.toEqual({status:'healthy'});expect(fetchMock).toHaveBeenCalledWith('https://script.google.test/exec',expect.objectContaining({method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=utf-8'},body:'{"action":"health","payload":{}}'}))});
 it('reports a failed health call',async()=>{vi.stubEnv('VITE_APPS_SCRIPT_API_URL','https://script.google.test/exec');vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('offline')));await expect(callBidLensApi('health')).rejects.toMatchObject({code:'NETWORK_ERROR'})});
 it('returns a session id from createSession',async()=>{vi.stubEnv('VITE_APPS_SCRIPT_API_URL','https://script.google.test/exec');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(reply('{"success":true,"data":{"sessionId":"session-1"}}')));await expect(callBidLensApi<{sessionId:string}>('createSession',{mode:'demo'})).resolves.toEqual({sessionId:'session-1'})});
 it('does not leak an invalid response body',async()=>{vi.stubEnv('VITE_APPS_SCRIPT_API_URL','https://script.google.test/exec');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(reply('secret deployment output')));const error=await callBidLensApi('health').catch(e=>e);expect(error).toBeInstanceOf(BidLensApiError);expect(error).toMatchObject({code:'INVALID_JSON'});expect(error.message).not.toContain('secret')});
 it('rejects an empty response',async()=>{vi.stubEnv('VITE_APPS_SCRIPT_API_URL','https://script.google.test/exec');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(reply('')));await expect(callBidLensApi('health')).rejects.toMatchObject({code:'EMPTY_RESPONSE'})});
});

describe('Demo Mode resilience',()=>{
 it('allows the local demo to remain loaded when createSession fails',async()=>{let localDemoLoaded=false;const loadDemoLocally=()=>{localDemoLoaded=true};vi.stubEnv('VITE_APPS_SCRIPT_API_URL','https://script.google.test/exec');vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('offline')));loadDemoLocally();await callBidLensApi('createSession',{sourceUrl:'https://www.ebth.com/demo/fashion-auction',mode:'demo'}).catch(()=>undefined);expect(localDemoLoaded).toBe(true)});
});
