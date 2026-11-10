import {productInfo} from '../product-info.js';
import {esc,icon} from '../ui.js';

function productUrl(value,contact=false){
 try{
  const url=new URL(String(value||''));
  return ['https:','http:'].includes(url.protocol)||contact&&url.protocol==='mailto:'&&url.pathname?url.href:'';
 }catch{return '';}
}

export function aboutProduct(info=productInfo){
 const author=String(info.author?.name||'').trim(),authorUrl=productUrl(info.author?.url),project=productUrl(info.links?.project),contact=productUrl(info.links?.contact,true);
 const external=(label,url)=>`<a class="button quiet" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}${icon('export')}</a>`;
 return `<section class="settings-section about-product" aria-labelledby="settings-about-heading"><h2 id="settings-about-heading">关于${esc(info.name)}</h2><div class="about-identity"><img src="/assets/logo.svg" alt="" aria-hidden="true"><div><h3 class="about-name">${esc(info.name)}<span>${esc(info.englishName)}</span></h3><p class="about-version">版本 ${esc(info.version)}</p></div></div><p class="about-description">${esc(info.description)}</p>${author?`<dl class="about-details"><div><dt>作者</dt><dd>${authorUrl?`<a href="${esc(authorUrl)}" target="_blank" rel="noopener noreferrer">${esc(author)}</a>`:esc(author)}</dd></div></dl>`:''}${project||contact?`<div class="about-links">${project?external('项目主页',project):''}${contact?external('联系作者',contact):''}</div>`:''}</section>`;
}
