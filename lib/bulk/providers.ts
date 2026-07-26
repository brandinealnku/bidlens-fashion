import { z } from 'zod';

export const bulkListingSchema = z.object({
  title: z.string().trim().min(1), description: z.string().default(''), category: z.string().trim().min(1),
  currentBidCents: z.number().int().nonnegative(), sourceMarketplace: z.string().default('USER_IMPORT'),
  sourceUrl: z.string().url().optional(), auctionEndAt: z.string().datetime().optional(),
});
export type BulkListing = z.infer<typeof bulkListingSchema>;
export type BulkRow = { rowNumber: number; value?: BulkListing; error?: string };
const limit = (rows: BulkRow[]) => { if (rows.length > 50) throw new Error('Scanner batches are limited to 50 listings'); return rows; };
export function parseJsonBulk(input: string): BulkRow[] {
  const parsed: unknown = JSON.parse(input); if (!Array.isArray(parsed)) throw new Error('JSON import must be an array');
  return limit(parsed.map((value,row)=>{const result=bulkListingSchema.safeParse(value);return result.success?{rowNumber:row+1,value:result.data}:{rowNumber:row+1,error:result.error.issues.map(x=>x.message).join(', ')}}));
}
function csvCells(line:string){const out:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){value+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===','&&!quoted){out.push(value);value='';}else value+=c}out.push(value);return out}
export function parseCsvBulk(input:string):BulkRow[]{const lines=input.trim().split(/\r?\n/).filter(Boolean);if(lines.length<2)return[];const headers=csvCells(lines[0]);return limit(lines.slice(1).map((line,row)=>{const cells=csvCells(line),raw=Object.fromEntries(headers.map((h,i)=>[h.trim(),cells[i]?.trim()]));const result=bulkListingSchema.safeParse({title:raw.title,description:raw.description??'',category:raw.category,currentBidCents:Math.round(Number(raw.currentBid)*100),sourceMarketplace:raw.sourceMarketplace||'CSV',sourceUrl:raw.sourceUrl||undefined,auctionEndAt:raw.auctionEndAt||undefined});return result.success?{rowNumber:row+1,value:result.data}:{rowNumber:row+1,error:result.error.issues.map(x=>x.message).join(', ')}}));}
export const demoBulkListings:BulkListing[]=[
  {title:'Maison Aurelia Marais leather satchel',description:'Demo leather handbag with light corner wear.',category:'HANDBAG',currentBidCents:18000,sourceMarketplace:'DEMO'},
  {title:'Atelier No. 8 suede pumps',description:'Demo block heel pumps.',category:'SHOE',currentBidCents:9500,sourceMarketplace:'DEMO'},
  {title:'Ridge Heritage vintage leather jacket',description:'Demo 1990s jacket.',category:'VINTAGE_APPAREL',currentBidCents:8000,sourceMarketplace:'DEMO'},
];
export function providerRows(provider:string,payload?:string):BulkRow[]{if(provider==='DEMO')return demoBulkListings.map((value,i)=>({rowNumber:i+1,value}));if(provider==='JSON')return parseJsonBulk(payload??'');if(provider==='CSV')return parseCsvBulk(payload??'');if(provider==='MANUAL')return parseJsonBulk(`[${payload}]`);throw new Error('Screenshot imports require user transcription; image extraction is not configured.');}
