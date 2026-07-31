declare module'tesseract.js'{export function createWorker(language?:string,oem?:number,options?:{logger?:(event:{status:string;progress:number})=>void}):Promise<any>}
