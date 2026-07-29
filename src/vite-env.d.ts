/// <reference types="vite/client" />

declare module "*.css";
declare module '../ebay-provider.mjs' {
  export class EbayProviderError extends Error { code:string; status:number; retryable:boolean }
  export function getEbayToken(env?:NodeJS.ProcessEnv,fetcher?:any):Promise<string>;
  export function searchEbayComparables(product:any,env?:NodeJS.ProcessEnv,fetcher?:any):Promise<any>;
  export function serverQueries(product:any):string[];
  export function resetTokenCache():void;
}
