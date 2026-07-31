import{describe,expect,it}from'vitest';import fixture from'../fixtures/ocr/tory-burch.json';import{parseEbthScreenshot}from'./ebthScreenshotParser';import type{OcrLine}from'../ocr/types';
const line=(text:string,y:number,confidence=95,height=30):OcrLine=>({text,confidence,boundingBox:{x:20,y,width:300,height}});
describe('EBTH screenshot parser',()=>{
 it('parses a multiline Tory Burch title, brand, separate bid and count, shipping, and condition',()=>{const x=parseEbthScreenshot(fixture as OcrLine[],1200);expect(x.parsed).toMatchObject({brand:'Tory Burch',title:'Tory Burch Perry Triple Compartment Tote Handbag',currentBidCents:125050,bidCount:9,shippingCents:1895,condition:'Pre-owned'});expect(x.parsed.currentBidCents).not.toBe(125059)});
 it.each([['$5',500],['$45',4500],['$45.00',4500],['$1,250',125000],['$1,250.50',125050]])('parses bid %s', (amount,want)=>expect(parseEbthScreenshot([line('Current Bid',300),line(amount,340)],800).parsed.currentBidCents).toBe(want));
 it('parses singular and plural bid counts',()=>{expect(parseEbthScreenshot([line('1 Bid',300)],800).parsed.bidCount).toBe(1);expect(parseEbthScreenshot([line('12 bids',300)],800).parsed.bidCount).toBe(12)});
 it('does not create shipping when it is not visible',()=>expect(parseEbthScreenshot([line('Current Bid $20',300)],800).parsed.shippingCents).toBeUndefined());
 it('does not invent an unknown brand',()=>expect(parseEbthScreenshot([line('Artisan Leather Handbag',200)],800).parsed.brand).toBeUndefined());
 it.each([['YSL Envelope Handbag','Saint Laurent'],['Salvatore Ferragamo Leather Shoes','Ferragamo']])('normalizes %s', (title,brand)=>expect(parseEbthScreenshot([line(title,200)],800).parsed.brand).toBe(brand));
 it('excludes navigation text from title',()=>expect(parseEbthScreenshot([line('Sign In',100),line('Search',140),line('Kate Spade Leather Tote',220)],800).parsed.title).toBe('Kate Spade Leather Tote'));
 it('marks weak OCR titles for review',()=>expect(parseEbthScreenshot([line('Vintage Leather Handbag',350,25,18)],800).confidence.title).toBeLessThan(.78));
});
