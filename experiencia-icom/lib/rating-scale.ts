import type {Answers} from './experience.ts';
export const ordinalRatings:Record<string,string[]>={salesperson_understanding:['Não','Pouco','Parcialmente','Em grande parte','Sim, completamente'],documentation_experience:['Muito complicado','Um pouco complicado','Normal','Fácil','Muito fácil']};
export function ratingValue(answers:Answers,key:string,scale:number=5):number|null {
 const raw=answers[key];
 if(typeof raw==='string'&&ordinalRatings[key]){const index=ordinalRatings[key].indexOf(raw);return index>=0?(index+1)*2:null;}
 if(typeof raw!=='number'||!Number.isInteger(raw)||raw<(scale===10?0:1)||raw>(scale===10?10:5))return null;
 return scale===10?raw:raw*2;
}
