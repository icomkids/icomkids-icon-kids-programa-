/* eslint-disable @next/next/no-img-element -- PNG generated locally as a data URL; no remote image optimization needed. */
'use client';
import {useEffect,useState} from 'react';
import QRCode from 'qrcode';
export default function QrCode({url}:{url:string}){const [image,setImage]=useState(''),[error,setError]=useState('');useEffect(()=>{let active=true;QRCode.toDataURL(url,{width:800,margin:3,errorCorrectionLevel:'M'}).then(v=>{if(active)setImage(v)}).catch(()=>{if(active)setError('Não foi possível gerar o QR Code.')});return()=>{active=false}},[url]);return <div className="qr">{image?<><img src={image} alt="QR Code para abrir esta experiência" width={200} height={200}/><a className="button" download="experiencia-icom-qr.png" href={image}>Baixar QR Code PNG</a></>:<p>{error||'Gerando QR Code…'}</p>}</div>}
