export type FashionBrand={name:string;aliases:string[]};

/** Canonical names and OCR-friendly aliases. Add brands here rather than in parser logic. */
export const fashionBrands:FashionBrand[]=[
 {name:'Tory Burch',aliases:[]},{name:'Coach',aliases:[]},{name:'Kate Spade',aliases:[]},{name:'Michael Kors',aliases:[]},
 {name:'Louis Vuitton',aliases:['LV']},{name:'Gucci',aliases:[]},{name:'Prada',aliases:[]},{name:'Chanel',aliases:[]},
 {name:'Burberry',aliases:[]},{name:'Fendi',aliases:[]},{name:'Celine',aliases:['Céline']},{name:'Saint Laurent',aliases:['YSL','Yves Saint Laurent']},
 {name:'Balenciaga',aliases:[]},{name:'Bottega Veneta',aliases:[]},{name:'Dior',aliases:['Christian Dior']},{name:'Hermès',aliases:['Hermes']},
 {name:'Ferragamo',aliases:['Salvatore Ferragamo']},{name:'Versace',aliases:[]},{name:'Valentino',aliases:[]},{name:'Givenchy',aliases:[]},
 {name:'Marc Jacobs',aliases:[]},{name:'Dooney & Bourke',aliases:['Dooney and Bourke']},{name:'Longchamp',aliases:[]},{name:'Tumi',aliases:[]},
 {name:'Ralph Lauren',aliases:[]},{name:'Polo Ralph Lauren',aliases:[]},{name:'Lululemon',aliases:[]},{name:'Nike',aliases:[]},
 {name:'Adidas',aliases:[]},{name:'Patagonia',aliases:[]},{name:'The North Face',aliases:[]},{name:'Anthropologie',aliases:[]},
 {name:'Free People',aliases:[]},{name:'Madewell',aliases:[]},{name:'Reformation',aliases:[]}
];

const escaped=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function findFashionBrand(text:string){
 for(const brand of [...fashionBrands].sort((a,b)=>Math.max(b.name.length,...b.aliases.map(x=>x.length))-Math.max(a.name.length,...a.aliases.map(x=>x.length)))){
  for(const candidate of [brand.name,...brand.aliases])if(new RegExp(`(?:^|[^a-z0-9])${escaped(candidate)}(?:$|[^a-z0-9])`,'i').test(text))return brand.name;
 }
}
