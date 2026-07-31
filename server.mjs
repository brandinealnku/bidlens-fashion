import express from 'express';
import { chromium } from 'playwright';
import dns from 'node:dns/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchEbayComparables, EbayProviderError } from './ebay-provider.mjs';
import { installMobileImportRoutes } from './mobile-import.mjs';
import { installMobileImportRoutes } from './mobile-import.mjs';
import { GeminiVisualIdentificationProvider, GeminiGroundedComparableProvider, GoogleVisionWebDetectionProvider, ResearchProviderError } from './gemini-provider.mjs';

export class CaptureError extends Error {
  constructor(code, message, status, guidance) { super(message); this.code = code; this.status = status; this.guidance = guidance; }
}
const errorDefinitions = {
  INVALID_URL: [400, 'Enter a valid HTTP(S) URL.'], UNSUPPORTED_DOMAIN: [403, 'Only public EBTH pages are supported.'],
  BLOCKED_DESTINATION: [403, 'Private or restricted network destinations are blocked.'], CAPTURE_TIMEOUT: [408, 'The page did not finish loading before the capture timeout.'],
  NAVIGATION_FAILED: [422, 'The EBTH page could not be loaded.'], AUTOMATION_BLOCKED: [422, 'EBTH blocked automated access.'], CAPTCHA_CHALLENGE: [422, 'EBTH presented a CAPTCHA or access challenge.'],
  BROWSER_UNAVAILABLE: [503, 'Chromium is not installed or cannot launch.'], SCREENSHOT_TOO_LARGE: [422, 'The screenshot exceeded the configured size limit.'],
  SERVER_MISCONFIGURATION: [500, 'The capture service is misconfigured.'], UNEXPECTED_CAPTURE_ERROR: [500, 'The capture service encountered an unexpected error.'],
};
const fail = (code, message, guidance) => { const [status, fallback] = errorDefinitions[code]; throw new CaptureError(code, message || fallback, status, guidance); };
export function isBlockedAddress(ip) {
  if (net.isIPv4(ip)) { const p=ip.split('.').map(Number); return p[0]===0||p[0]===10||p[0]===127||p[0]>=224||p[0]===169&&p[1]===254||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31; }
  return ip==='::'||ip==='::1'||/^f[cd]/i.test(ip)||/^fe[89ab]/i.test(ip);
}
export async function validateCaptureUrl(raw, lookup=dns.lookup) {
  let url; try { url = new URL(raw); } catch { fail('INVALID_URL'); }
  if (!['http:','https:'].includes(url.protocol)) fail('INVALID_URL');
  if (url.username || url.password || url.port) fail('BLOCKED_DESTINATION');
  if (!(url.hostname==='ebth.com'||url.hostname.endsWith('.ebth.com'))) fail('UNSUPPORTED_DOMAIN');
  let addresses; try { addresses=await lookup(url.hostname,{all:true}); } catch { fail('NAVIGATION_FAILED','The EBTH hostname could not be resolved.'); }
  if (!addresses.length || addresses.some(({address})=>isBlockedAddress(address))) fail('BLOCKED_DESTINATION');
  return url;
}
export function normalizeCaptureError(error) {
  if (error instanceof CaptureError) return error;
  if (error && typeof error === 'object' && typeof error.code === 'string' && typeof error.status === 'number') return new CaptureError(error.code, error.message || errorDefinitions[error.code]?.[1], error.status, error.guidance);
  const message=error instanceof Error?error.message:'';
  if (/timeout/i.test(message)) return new CaptureError('CAPTURE_TIMEOUT',errorDefinitions.CAPTURE_TIMEOUT[1],408);
  if (/executable.*doesn.t exist|browser.*not found|host system is missing dependencies/i.test(message)) return new CaptureError('BROWSER_UNAVAILABLE',errorDefinitions.BROWSER_UNAVAILABLE[1],503,'Run npm run playwright:install (or playwright:install:with-deps).');
  return new CaptureError('UNEXPECTED_CAPTURE_ERROR',errorDefinitions.UNEXPECTED_CAPTURE_ERROR[1],500);
}
export async function checkBrowserAvailability(chromiumImpl=chromium) {
  const executable=chromiumImpl.executablePath();
  const fs=await import('node:fs/promises');
  try { await fs.access(executable); return {status:'ok',service:'bidlens-capture-api',playwright:'available',browser:'chromium',timestamp:new Date().toISOString()}; }
  catch { fail('BROWSER_UNAVAILABLE','Chromium is not installed.','Run npm run playwright:install in the development environment.'); }
}
export async function getServiceHealth(browserHealth=checkBrowserAvailability, env=process.env) {
  let captureAvailable=true;
  try { await browserHealth(); } catch { captureAvailable=false; }
  const geminiAvailable=Boolean(env.GEMINI_API_KEY);
  const googleVisionAvailable=Boolean(env.GOOGLE_CLOUD_PROJECT&&env.GOOGLE_APPLICATION_CREDENTIALS);
  return {
    status:'ok',
    service:'bidlens-api',
    timestamp:new Date().toISOString(),
    capabilities:{
      geminiComparables:{available:geminiAvailable,reason:geminiAvailable?'configured':'GEMINI_API_KEY is not configured'},
      capture:{available:captureAvailable,reason:captureAvailable?'Chromium available':'Chromium is not installed'},
      googleVision:{available:googleVisionAvailable,reason:googleVisionAvailable?'configured':'not configured'},
    },
  };
}
async function detectChallenge(page) {
  const sample=(await page.locator('body').innerText({timeout:3000}).catch(()=>'' )).slice(0,20000).toLowerCase();
  if (/captcha|verify you are human|challenge-platform/.test(sample)) fail('CAPTCHA_CHALLENGE');
  if (/access denied|automated access|temporarily blocked|request blocked/.test(sample)) fail('AUTOMATION_BLOCKED');
}
export async function lazyLoad(page) { for(let i=0;i<5;i++){await page.evaluate(()=>scrollBy(0,innerHeight));await page.waitForTimeout(350);} await page.evaluate(()=>scrollTo(0,0)); }
export async function extractProducts(page) {
  return page.locator('[data-testid*="item"],article,.lot-card,[class*="product-card"],[class*="item-card"]').evaluateAll((els,source)=>els.slice(0,50).map((el,i)=>{const r=el.getBoundingClientRect(),a=el.querySelector('a[href]'),img=el.querySelector('img'),text=el.textContent||'',bid=text.match(/(?:current bid|bid)\s*\$?([\d,.]+)/i),warnings=[];if(!bid)warnings.push('Missing bid.');if(!a)warnings.push('Missing listing URL.');if(!img)warnings.push('Missing image.');return{id:`live-${i+1}`,sourcePageUrl:source,listingUrl:a?.href,title:(el.querySelector('h2,h3,[class*="title"]')?.textContent||text.split('\n')[0])?.trim().slice(0,180),currentBidCents:bid?Math.round(parseFloat(bid[1].replaceAll(',',''))*100):undefined,bidText:bid?.[0],imageUrl:img?.currentSrc||img?.src,screenshotBoundingBox:{x:Math.round(r.x),y:Math.round(r.y+scrollY),width:Math.round(r.width),height:Math.round(r.height)},extractionConfidence:bid&&img&&a?85:55,extractionWarnings:warnings}}),page.url());
}
export async function capturePage(rawUrl, options={}) {
  const started=Date.now(), timeout=Number(process.env.CAPTURE_TIMEOUT_MS)||20000, maxBytes=Number(process.env.MAX_SCREENSHOT_BYTES)||12000000;
  const submitted=await validateCaptureUrl(rawUrl, options.lookup); console.info('[capture]',{event:'validated',hostname:submitted.hostname});
  let browser; try {
    browser=await (options.chromium||chromium).launch({headless:true});
    const page=await browser.newPage({viewport:{width:1440,height:1000},userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'});
    await page.route('**/*',async route=>{if(!route.request().isNavigationRequest())return route.continue();try{await validateCaptureUrl(route.request().url(),options.lookup);await route.continue();}catch{await route.abort('blockedbyclient');}});
    let redirects=0; page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&++redirects>7) page.close().catch(()=>{});});
    console.info('[capture]',{event:'navigation-start',url:submitted.toString()});
    const response=await page.goto(submitted.toString(),{waitUntil:'domcontentloaded',timeout});
    const finalUrl=page.url(); await validateCaptureUrl(finalUrl,options.lookup); console.info('[capture]',{event:'navigation-complete',finalUrl,status:response?.status()});
    await detectChallenge(page); await lazyLoad(page); const products=await extractProducts(page);
    const body=await page.locator('body').boundingBox(), screenshot=await page.screenshot({fullPage:true,type:'jpeg',quality:72});
    if(screenshot.length>maxBytes) fail('SCREENSHOT_TOO_LARGE');
    const partial=products.length===0||products.some(p=>p.extractionWarnings.length);
    const warnings=products.length?products.flatMap(p=>p.extractionWarnings.map(message=>({code:'PARTIAL_EXTRACTION',productId:p.id,message}))):[{code:'NO_PRODUCTS_FOUND',message:'No supported product-card structure was detected. Add products manually from the screenshot.'}];
    console.info('[capture]',{event:'complete',products:products.length,screenshotBytes:screenshot.length,durationMs:Date.now()-started});
    return {capture:{sourceUrl:finalUrl,pageTitle:(await page.title()).replace(/[<>]/g,'').slice(0,200),capturedAt:new Date().toISOString(),width:Math.round(body?.width||1440),height:Math.min(12000,Math.round(body?.height||1000)),status:partial?'partial':'success',warnings:warnings.map(w=>w.message),screenshotUrl:`data:image/jpeg;base64,${screenshot.toString('base64')}`},products,warnings};
  } catch(error) { const normalized=normalizeCaptureError(error); console.error('[capture]',{event:'failed',code:normalized.code,durationMs:Date.now()-started}); throw normalized; }
  finally { await browser?.close().catch(()=>{}); }
}
function controlledCors(req,res,next) { const origin=req.get('origin'),allowed=new Set((process.env.ALLOWED_ORIGINS||'http://localhost:5173,http://127.0.0.1:5173').split(',').map(x=>x.trim()).filter(Boolean));if(origin&&!allowed.has(origin))return next(new CaptureError('UNSUPPORTED_DOMAIN','This browser origin is not allowed by the capture API.',403,'Add the trusted frontend origin to ALLOWED_ORIGINS.'));if(origin){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.set('Access-Control-Allow-Headers','Content-Type');}if(req.method==='OPTIONS')return res.sendStatus(204);next(); }
export function createApp(deps={}) {
  const app=express(); app.disable('x-powered-by'); app.use(controlledCors); installMobileImportRoutes(app,{store:deps.mobileImportStore,env:deps.env||process.env}); app.use(express.json({limit:'10mb'}));
  // Browser readiness is capability metadata for the service-wide probe, but a
  // hard requirement for the capture-specific probe. Keep the dependency named
  // accordingly so research routes cannot accidentally acquire a browser gate.
  const captureHealth=deps.captureHealth||deps.health||checkBrowserAvailability;
  app.get('/api/health',async(_req,res)=>res.status(200).json(await getServiceHealth(captureHealth,deps.env||process.env)));
  app.get('/api/capture/health',async(_req,res,next)=>{try{res.json(await captureHealth());}catch(e){next(e);}});
  app.post('/api/identify/product',async(req,res,next)=>{try{const provider=deps.identifyProvider||new GeminiVisualIdentificationProvider();res.json(await provider.identify(req.body||{}))}catch(e){next(e);}});
  app.post('/api/comparables/search',async(req,res,next)=>{try{const product=req.body||{};if(deps.searchComparables)return res.json(await deps.searchComparables(product));const visual=new GeminiVisualIdentificationProvider(),grounded=new GeminiGroundedComparableProvider();const identification=product.identification||await visual.identify(product);let vision;try{vision=await (deps.visionProvider||new GoogleVisionWebDetectionProvider()).detect(product)}catch(e){if(!(e instanceof ResearchProviderError)||e.code!=='PROVIDER_UNAVAILABLE')console.warn('[research]',{event:'vision-skipped',code:e?.code||'PROVIDER_ERROR'})}res.json({...await grounded.search(product,identification,vision),identification,vision})}catch(e){next(e);}});
  app.post('/api/capture',async(req,res,next)=>{try{console.info('[capture]',{event:'submitted',url:req.body?.url});res.json(await (deps.capture||capturePage)(req.body?.url));}catch(e){next(e);}});
  app.use(express.static('dist')); app.get(/^(?!\/api\/).*/,(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
  app.use((error,_req,res,_next)=>{if(error instanceof EbayProviderError||error instanceof ResearchProviderError)return res.status(error.status).json({error:error.message,code:error.code,retryable:error.retryable,...(error instanceof ResearchProviderError&&error.upstreamStatus?{upstreamStatus:error.upstreamStatus,upstreamErrorStatus:error.upstreamErrorStatus,upstreamMessage:error.upstreamMessage,upstreamReason:error.upstreamReason,model:error.model,operation:error.operation,guidance:error.guidance}: {})});const e=normalizeCaptureError(error);res.status(e.status).json({error:e.message,code:e.code,...(e.guidance&&{guidance:e.guidance})});}); return app;
}
export function startServer(port=Number(process.env.PORT)||4174) { const server=createApp().listen(port,()=>console.info(`[api] Capture API listening on http://localhost:${port}`));server.on('error',e=>{console.error(`[api] Unable to listen on port ${port}: ${e.message}`);process.exitCode=1;});return server; }
if(process.argv[1]===fileURLToPath(import.meta.url)) startServer();
