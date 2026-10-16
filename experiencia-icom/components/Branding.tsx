'use client';
import {createContext,useContext,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {brandText,DEFAULT_BRANDING,type Branding} from '@/lib/branding';
const BrandingContext=createContext<{branding:Branding;setBranding:(value:Branding)=>void}>({branding:DEFAULT_BRANDING,setBranding:()=>{}});
export function BrandingProvider({initial,children}:{initial:Branding;children:ReactNode}){const [branding,setBranding]=useState(initial);return <BrandingContext.Provider value={{branding,setBranding}}>{children}</BrandingContext.Provider>}
export function useBranding(){const context=useContext(BrandingContext);return {...context,text:(value:string)=>brandText(value,context.branding.company_name)}}
export function BrandMark({branding}:{branding:Branding}){return <div className="brand-mark">{branding.logo_url&&<img src={branding.logo_url} alt={`Logo de ${branding.company_name}`} width={192} height={80}/>}<strong>{branding.company_name}</strong><span>EXPERIÊNCIA</span></div>}
export function Brand(){const {branding}=useBranding();return <Link className="brand customizable-brand" href="/experiencia" aria-label={`${branding.company_name} · Experiência`}><BrandMark branding={branding}/></Link>}
