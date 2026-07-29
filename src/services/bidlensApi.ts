export const BID_LENS_ACTIONS = ['health','createSession','getSession','listSessions','saveProducts','updateProduct','saveAssumptions','calculateResults','getRankedResults'] as const;
export type BidLensAction = typeof BID_LENS_ACTIONS[number];
export type BidLensErrorCode = 'MISSING_API_URL'|'NETWORK_ERROR'|'EMPTY_RESPONSE'|'INVALID_JSON'|'API_ERROR';

export class BidLensApiError extends Error {
  constructor(public readonly code:BidLensErrorCode,message:string,public readonly status?:number){super(message);this.name='BidLensApiError'}
}

type ApiEnvelope<T>={ok?:boolean;success?:boolean;data?:T;result?:T;error?:string;message?:string};

export async function callBidLensApi<T=unknown>(action:BidLensAction,payload:Record<string,unknown>={}):Promise<T>{
  const apiUrl=import.meta.env.VITE_APPS_SCRIPT_API_URL?.trim();
  if(!apiUrl)throw new BidLensApiError('MISSING_API_URL','The Google Sheets backend is not configured.');
  let response:Response;
  try{
    response=await fetch(apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,payload}),redirect:'follow'});
  }catch{
    throw new BidLensApiError('NETWORK_ERROR','The Google Sheets backend could not be reached.');
  }
  const body=await response.text();
  if(!body.trim())throw new BidLensApiError('EMPTY_RESPONSE','The Google Sheets backend returned an empty response.',response.status);
  let parsed:ApiEnvelope<T>&T;
  try{parsed=JSON.parse(body)}catch{throw new BidLensApiError('INVALID_JSON','The Google Sheets backend returned invalid JSON.',response.status)}
  if(!response.ok||parsed.ok===false||parsed.success===false)throw new BidLensApiError('API_ERROR',parsed.error||parsed.message||'The Google Sheets backend rejected the request.',response.status);
  return (parsed.data??parsed.result??parsed) as T;
}
