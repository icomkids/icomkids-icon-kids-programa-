import {bankAuthorize,bankError,BankError} from '@/lib/icom-bank/server';
import {fipeGet,catalogOptions,fipeQuote,latestReference} from '@/lib/icom-bank/fipe-server';
import {catalogSelection} from '@/lib/icom-bank/vehicle-catalog';
export async function GET(req:Request){try{
 await bankAuthorize();const q=new URL(req.url).searchParams,brand=q.get('brand'),model=q.get('model'),year=q.get('year');
 if(brand&&!/^\d{1,6}$/.test(brand)||model&&(!brand||!/^\d{1,6}$/.test(model))||year&&(!brand||!model))throw new BankError('Consulta inválida.',400);
 const headers={'Cache-Control':'private, no-store'};
 if(year)return Response.json({vehicle:await fipeQuote(catalogSelection({brand_id:brand,model_id:model,year_id:year}))},{headers});
 const reference=await latestReference();const path=!brand?'cars/brands':!model?`cars/brands/${brand}/models`:`cars/brands/${brand}/models/${model}/years`;
 return Response.json({options:catalogOptions(await fipeGet(path+'?reference='+reference))},{headers});
}catch(e){return bankError(e);}}
