// Gerador de páginas estáticas por aeronave (SEO) — lê o Supabase e escreve HTML pronto.
// Roda no GitHub Action (Node 20+) e também localmente: `node build/generate.mjs`.
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://v4aeroflight.com';
const WA = '5565981476175';
const SB_URL = 'https://hobtolagifjjxcmxreip.supabase.co';
const SB_KEY = 'sb_publishable_29hmID65I5x-X0Ieot6f5Q_eLOk_Pkl';
const CATS = { monomotor:'Monomotor', bimotor:'Bimotor', turboelice:'Turboélice', helicoptero:'Helicóptero' };
const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });

const esc = s => (s ?? '').toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const slugify = s => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'aeronave';
const metaDesc = (av) => {
  const base = (av.descricao || '').replace(/\s+/g,' ').trim();
  const txt = base || `${CATS[av.categoria]||av.categoria} à venda na V4 Aero Flight. Fale conosco para ficha técnica e condições.`;
  return txt.length > 155 ? txt.slice(0,152).trimEnd()+'…' : txt;
};
const precoTxt = (av) => (av.valor==null || +av.valor===0) ? null : (av.moeda==='USD'?'US$ ':'R$ ')+nf.format(av.valor);
const availability = (s) => /vend/i.test(s)?'https://schema.org/SoldOut' : /reserv/i.test(s)?'https://schema.org/LimitedAvailability' : 'https://schema.org/InStock';
const waLink = (nome) => `https://wa.me/${WA}?text=`+encodeURIComponent(`Olá, tenho interesse na aeronave ${nome} anunciada no site.`);

// Renderiza a descrição em Markdown simples: **Seção** = rótulo, "- item" = lista, resto = parágrafo.
const inlineMd = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
function renderDescricao(txt){
  const lines = (txt || '').split('\n');
  let html = '', list = [];
  const flush = () => { if(list.length){ html += '<ul>'+list.map(li=>`<li>${inlineMd(li)}</li>`).join('')+'</ul>'; list = []; } };
  for(const raw of lines){
    const line = raw.trim();
    if(line === '' || line === '---'){ flush(); continue; }
    const h = line.match(/^\*\*(.+)\*\*$/);
    if(h){ flush(); html += `<h4 class="ds-h">${esc(h[1])}</h4>`; continue; }
    if(/^[-*]\s+/.test(line)){ list.push(line.replace(/^[-*]\s+/, '')); continue; }
    flush(); html += `<p>${inlineMd(line)}</p>`;
  }
  flush();
  return html;
}

async function fetchAeronaves(){
  const url = `${SB_URL}/rest/v1/aeronaves?ativo=eq.true&order=ordem.asc&select=*`;
  const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if(!r.ok) throw new Error('Supabase '+r.status+' '+await r.text());
  return r.json();
}

function pageHTML(av, canonical){
  const nome = av.nome || 'Aeronave';
  const cat = CATS[av.categoria] || av.categoria || '';
  const fotos = (Array.isArray(av.fotos)?av.fotos:[]).filter(Boolean);
  const capa = fotos[0] || `${SITE}/assets/hero.png`;
  const preco = precoTxt(av);
  const sitClass = /reserv/i.test(av.situacao)?'reservada' : /vend/i.test(av.situacao)?'vendida' : '';
  const desc = metaDesc(av);
  const descrBlock = av.descricao && av.descricao.trim()
    ? `<div class="descr">${renderDescricao(av.descricao)}</div>`
    : `<div class="descr tbc">Ficha técnica sob consulta. Fale conosco no WhatsApp.</div>`;

  const gal = fotos.length ? `
      <div class="gal">
        <button type="button" class="gal-main" data-i="0" aria-label="Ampliar foto"><img src="${esc(fotos[0])}" alt="${esc(nome)}"><span class="gal-zoom">⤢ ampliar</span></button>
        ${fotos.length>1?`<div class="gal-ths">${fotos.map((f,i)=>`<button type="button" class="gal-th${i===0?' on':''}" aria-label="Foto ${i+1}"><img src="${esc(f)}" alt="" loading="lazy"></button>`).join('')}</div>`:''}
      </div>` : `<div class="gal-empty">Fotos sob consulta</div>`;

  const ld = {
    '@context':'https://schema.org','@type':'Product', name: nome, description: desc,
    image: fotos.length?fotos:[capa], category: cat, url: canonical,
    ...(preco ? { offers:{ '@type':'Offer', priceCurrency: av.moeda||'BRL', price: String(av.valor),
      availability: availability(av.situacao), url: canonical,
      seller:{ '@type':'Organization', name:'V4 Aero Flight' } } } : {})
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<title>${esc(nome)} à venda — V4 Aero Flight</title>
<meta name="description" content="${esc(desc)}">
<script>window.V4_TRACK={META_PIXEL_ID:'2357400451462284',GA4_ID:''};</script>
<script>(function(){var id=window.V4_TRACK.META_PIXEL_ID;if(!id)return;!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',id);fbq('track','PageView');})();</script>
<script>(function(){var id=window.V4_TRACK.GA4_ID;if(!id)return;var s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id='+id;document.head.appendChild(s);window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag('js',new Date());gtag('config',id);})();</script>
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(nome)} à venda — V4 Aero Flight">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(capa)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/logo-mark.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  :root{--blue-950:#061423;--blue-900:#0B2137;--blue-800:#12314D;--blue-700:#1B4269;--blue-600:#2A5B8C;--blue-500:#3E77AE;--blue-300:#8FB0D8;--blue-100:#DCE9F3;--blue-050:#F1F5FA;--white:#FFFFFF;--ease:cubic-bezier(.4,0,.2,1)}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'IBM Plex Sans',system-ui,sans-serif;color:var(--blue-900);background:var(--white);line-height:1.65;-webkit-font-smoothing:antialiased}
  .mono{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.12em;font-size:.7rem;color:var(--blue-600)}
  a{color:var(--blue-500);text-decoration:none}
  .wrap{max-width:1080px;margin:0 auto;padding:0 clamp(1.1rem,4vw,2.2rem)}
  header{position:sticky;top:0;z-index:20;background:var(--white);border-bottom:1px solid var(--blue-100)}
  header .bar{display:flex;align-items:center;justify-content:space-between;padding:.8rem 0;gap:1rem}
  .logo{display:inline-flex;align-items:center;gap:.6rem;color:var(--blue-900)}
  .logo svg{height:38px;width:auto;flex:none}
  .logo .wm{display:flex;flex-direction:column;line-height:1.05}
  .logo .wm b{font-weight:700;font-size:1.24rem;letter-spacing:-.01em}.logo .wm b i{font-style:normal;color:var(--blue-500)}
  .logo .wm small{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.28em;font-size:.62rem;color:var(--blue-600);margin-top:3px}
  .btn{display:inline-flex;align-items:center;gap:.4rem;font-weight:500;font-size:.9rem;padding:.6rem 1.05rem;border-radius:3px;border:1px solid transparent;cursor:pointer;transition:.18s}
  .btn-p{background:var(--blue-900);color:#fff;border-color:var(--blue-900)}.btn-p:hover{background:var(--blue-800)}
  main{padding:1.8rem 0 3rem}
  .crumb{font-size:.8rem;margin-bottom:1.2rem}.crumb a{color:var(--blue-600)}
  .top{display:grid;grid-template-columns:minmax(0,1.1fr) 1fr;gap:2rem;align-items:start}
  h1{font-size:clamp(1.5rem,3.4vw,2.2rem);font-weight:600;letter-spacing:-.01em;line-height:1.15}
  .cat{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.14em;font-size:.72rem;color:var(--blue-600);margin:.5rem 0 1rem}
  .sit{display:inline-block;font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.08em;font-size:.64rem;padding:.18rem .5rem;border-radius:2px;border:1px solid var(--blue-300);color:var(--blue-700)}
  .sit.reservada{background:var(--blue-700);border-color:var(--blue-700);color:#fff}
  .sit.vendida{background:var(--blue-900);border-color:var(--blue-900);color:#fff;text-decoration:line-through}
  .preco{font-family:'IBM Plex Mono',monospace;font-variant-numeric:tabular-nums;font-size:1.7rem;font-weight:600;color:var(--blue-900);margin:1.2rem 0}
  .preco small{font-size:.9rem;color:var(--blue-600);font-weight:400;margin-right:.4rem}
  .preco.tbc{font-size:1rem;color:var(--blue-600);font-weight:400}
  .descr{font-size:.96rem;color:var(--blue-800);line-height:1.7;margin:1.2rem 0;border-top:1px solid var(--blue-100);padding-top:1.4rem}
  .descr.tbc{color:var(--blue-600);font-style:italic}
  .descr .ds-h{font-family:'IBM Plex Mono',monospace;text-transform:uppercase;letter-spacing:.12em;font-size:.72rem;font-weight:600;color:var(--blue-600);margin:1.6rem 0 .55rem;padding-bottom:.35rem;border-bottom:1px solid var(--blue-100)}
  .descr .ds-h:first-child{margin-top:0}
  .descr ul{list-style:none;margin:0 0 .3rem;padding:0;display:flex;flex-direction:column;gap:.3rem}
  .descr li{position:relative;padding-left:1.1rem}
  .descr li::before{content:'';position:absolute;left:.15rem;top:.62em;width:5px;height:5px;background:var(--blue-500);border-radius:50%}
  .descr p{margin:.4rem 0 .8rem}
  .descr strong{color:var(--blue-900);font-weight:600}
  .gal{display:flex;flex-direction:column;gap:.55rem}
  .gal-main{position:relative;display:block;width:100%;padding:0;border:1px solid var(--blue-100);background:var(--blue-050);cursor:zoom-in}
  .gal-main img{width:100%;aspect-ratio:3/2;object-fit:cover;display:block}
  .gal-main .gal-zoom{position:absolute;right:.5rem;bottom:.5rem;background:rgba(6,20,35,.72);color:#fff;font-size:.72rem;padding:.14rem .45rem;border-radius:2px;font-family:'IBM Plex Mono',monospace}
  .gal-ths{display:flex;gap:.45rem;flex-wrap:wrap}
  .gal-th{width:62px;height:46px;padding:0;border:1px solid var(--blue-100);background:var(--blue-050);cursor:pointer;border-radius:2px;overflow:hidden}
  .gal-th.on{border-color:var(--blue-500);border-width:2px}
  .gal-th img{width:100%;height:100%;object-fit:cover;display:block}
  .gal-empty{display:flex;align-items:center;justify-content:center;aspect-ratio:3/2;color:var(--blue-600);font-family:'IBM Plex Mono',monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;background:var(--blue-050);border:1px dashed var(--blue-100)}
  .cta{margin-top:1.4rem;display:flex;gap:.7rem;flex-wrap:wrap}
  .lead-modal{position:fixed;inset:0;z-index:120;background:rgba(6,20,35,.6);display:flex;align-items:center;justify-content:center;padding:1.2rem;backdrop-filter:blur(2px)}
  .lead-modal[hidden]{display:none}
  .lead-box{position:relative;background:#fff;border-radius:6px;padding:1.8rem 1.6rem 1.6rem;width:100%;max-width:440px;box-shadow:0 12px 40px rgba(6,20,35,.28)}
  .lead-box h3{font-size:1.3rem;margin-bottom:.3rem;color:var(--blue-950)}
  .lm-sub{color:var(--blue-600);font-size:.92rem;margin-bottom:1.1rem}
  .lm-x{position:absolute;top:.6rem;right:.8rem;background:none;border:0;font-size:1.7rem;line-height:1;color:var(--blue-500);cursor:pointer;padding:.1rem .3rem}
  .lm-x:hover{color:var(--blue-900)}
  .lead-form{display:flex;flex-direction:column;gap:.55rem;max-width:440px}
  .lead-form textarea{width:100%;background:#fff;border:1px solid var(--blue-100);border-radius:3px;padding:.7rem .8rem;font:inherit;font-size:.92rem;color:var(--blue-950);resize:vertical;min-height:70px}
  .lead-form textarea::placeholder{color:var(--blue-500);opacity:.7}
  .lead-form textarea:focus{outline:none;border-color:var(--blue-500);box-shadow:0 0 0 2px rgba(62,119,174,.16)}
  .lf-row{display:flex;gap:.55rem}.lf-row>*{flex:1;min-width:0}
  .lead-form input{width:100%;background:#fff;border:1px solid var(--blue-100);border-radius:3px;padding:.7rem .8rem;font:inherit;font-size:.92rem;color:var(--blue-950)}
  .lead-form input::placeholder{color:var(--blue-500);opacity:.7}
  .lead-form input:focus{outline:none;border-color:var(--blue-500);box-shadow:0 0 0 2px rgba(62,119,174,.16)}
  .lead-form .btn{margin-top:.2rem;border:none;cursor:pointer}
  .lf-note{font-size:.85rem;margin:.1rem 0 0}.lf-note.ok{color:#1a7a4c}.lf-note.err{color:#b3261e}
  @media(max-width:560px){.lf-row{flex-direction:column}}
  .back{display:inline-block;margin-top:2.4rem;font-size:.9rem}
  footer{border-top:1px solid var(--blue-100);padding:1.6rem 0;color:var(--blue-600);font-size:.82rem}
  .lb{position:fixed;inset:0;z-index:200;background:rgba(6,20,35,.93);display:none;align-items:center;justify-content:center}
  .lb.open{display:flex}
  .lb img{max-width:92vw;max-height:86vh;object-fit:contain}
  .lb .x{position:absolute;top:.8rem;right:1.1rem;font-size:2rem;color:#fff;background:none;border:0;cursor:pointer}
  .lb .nav{position:absolute;top:50%;transform:translateY(-50%);font-size:2.6rem;color:#fff;background:none;border:0;cursor:pointer;padding:.3rem .9rem;opacity:.85}
  .lb .prev{left:.2rem}.lb .next{right:.2rem}
  .lb .count{position:absolute;bottom:1rem;left:0;right:0;text-align:center;color:#fff;font-family:'IBM Plex Mono',monospace;font-size:.78rem;letter-spacing:.1em}
  @media (max-width:760px){.top{grid-template-columns:1fr;gap:1.4rem}}
</style>
</head>
<body>
<header><div class="wrap bar">
  <a class="logo" href="/" aria-label="V4 Aero Flight — início">
    <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="none" stroke="#3E77AE" stroke-width="2.4"/><path d="M24 10 L16 33 L24 28 Z" fill="#061423"/><path d="M24 10 L32 33 L24 28 Z" fill="#3E77AE"/></svg>
    <span class="wm"><b>V4 <i>Aero</i></b><small>Flight</small></span>
  </a>
  <a class="btn btn-p js-lead" href="${waLink(nome)}">Falar no WhatsApp</a>
</div></header>
<main><div class="wrap">
  <nav class="crumb"><a href="/">Início</a> › <a href="/#aeronaves">Aeronaves</a> › ${esc(nome)}</nav>
  <div class="top">
    <div>${gal}</div>
    <div>
      <h1>${esc(nome)}</h1>
      <div class="cat">${esc(cat)} · <span class="sit ${sitClass}">${esc(av.situacao||'Disponível')}</span></div>
      ${preco ? `<div class="preco"><small>${av.moeda==='USD'?'US$':'R$'}</small>${esc(nf.format(av.valor))}</div>` : `<div class="preco tbc">Valor sob consulta</div>`}
      ${descrBlock}
      <div class="cta"><a class="btn btn-p js-lead" href="${waLink(nome)}">Consultar esta aeronave</a></div>
    </div>
  </div>
  <a class="back mono" href="/#aeronaves">‹ Ver todas as aeronaves</a>
</div></main>
<div class="lead-modal" id="leadModal" hidden>
  <div class="lead-box" role="dialog" aria-modal="true" aria-labelledby="lmTitle">
    <button class="lm-x" id="lmX" type="button" aria-label="Fechar">×</button>
    <h3 id="lmTitle">Tenho interesse</h3>
    <p class="lm-sub">Preencha e continue no WhatsApp com tudo pronto.</p>
    <form class="lead-form" id="leadForm">
      <div class="lf-row">
        <input type="text" id="lf_nome" placeholder="Seu nome" required autocomplete="name">
        <input type="tel" id="lf_tel" placeholder="WhatsApp (com DDD)" required autocomplete="tel">
      </div>
      <input type="email" id="lf_email" placeholder="E-mail (opcional)" autocomplete="email">
      <textarea id="lf_msg" placeholder="Alguma observação? (opcional)"></textarea>
      <button type="submit" class="btn btn-p" id="lf_btn">Continuar no WhatsApp</button>
      <p class="lf-note" id="lf_note" hidden></p>
    </form>
  </div>
</div>
<footer><div class="wrap">© ${new Date().getFullYear()} V4 Aero Flight · Compra, venda e intermediação de aeronaves · WhatsApp ${WA}</div></footer>
<script>
(function(){
  var f=document.getElementById('leadForm'); if(!f) return;
  var AERO=${JSON.stringify(nome)}, WA=${JSON.stringify(WA)}, SB=${JSON.stringify(SB_URL)}, KEY=${JSON.stringify(SB_KEY)};
  var modal=document.getElementById('leadModal'), note=document.getElementById('lf_note');
  function track(){try{if(window.fbq)fbq('track','Lead',{content_name:AERO});}catch(e){}try{if(window.gtag)gtag('event','generate_lead',{aircraft:AERO});}catch(e){}}
  function openModal(){note.hidden=true;note.textContent='';modal.hidden=false;setTimeout(function(){document.getElementById('lf_nome').focus();},40);}
  function closeModal(){modal.hidden=true;}
  Array.prototype.forEach.call(document.querySelectorAll('.js-lead'),function(el){el.addEventListener('click',function(ev){ev.preventDefault();openModal();});});
  document.getElementById('lmX').addEventListener('click',closeModal);
  modal.addEventListener('click',function(ev){if(ev.target===modal)closeModal();});
  addEventListener('keydown',function(ev){if(ev.key==='Escape'&&!modal.hidden)closeModal();});
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    var nome=document.getElementById('lf_nome').value.trim();
    var tel=document.getElementById('lf_tel').value.trim();
    var email=document.getElementById('lf_email').value.trim();
    var msg=document.getElementById('lf_msg').value.trim();
    if(!nome||!tel){note.hidden=false;note.className='lf-note err';note.textContent='Preencha nome e WhatsApp.';return;}
    fetch(SB+'/rest/v1/leads',{method:'POST',headers:{'Content-Type':'application/json',apikey:KEY,Authorization:'Bearer '+KEY,Prefer:'return=minimal'},body:JSON.stringify({nome:nome,telefone:tel,email:email||null,mensagem:msg||null,aeronave:AERO,origem:'aeronave:'+AERO})}).catch(function(){});
    track();
    var base='Olá, sou '+nome+'. Tenho interesse na aeronave '+AERO+' anunciada no site.';
    var txt=msg?base+' '+msg:base;
    window.open('https://wa.me/'+WA+'?text='+encodeURIComponent(txt),'_blank','noopener');
    note.hidden=false;note.className='lf-note ok';note.textContent='Perfeito! Abrindo o WhatsApp…';
    f.reset();setTimeout(closeModal,900);
  });
})();
</script>
<script>
(function(){
  var lb=document.createElement('div');lb.className='lb';
  lb.innerHTML='<button class="x" aria-label="Fechar">×</button><button class="nav prev" aria-label="Anterior">‹</button><img alt=""><button class="nav next" aria-label="Próxima">›</button><div class="count"></div>';
  document.body.appendChild(lb);
  var img=lb.querySelector('img'),count=lb.querySelector('.count'),prev=lb.querySelector('.prev'),next=lb.querySelector('.next');
  var F=[],I=0;
  function render(){img.src=F[I]||'';count.textContent=F.length>1?(I+1)+' / '+F.length:'';prev.style.visibility=next.style.visibility=F.length>1?'visible':'hidden';}
  function open(f,i){F=f;I=i||0;render();lb.classList.add('open');}
  function close(){lb.classList.remove('open');img.src='';}
  prev.onclick=function(){I=(I-1+F.length)%F.length;render();};
  next.onclick=function(){I=(I+1)%F.length;render();};
  lb.querySelector('.x').onclick=close;lb.addEventListener('click',function(e){if(e.target===lb)close();});
  document.addEventListener('keydown',function(e){if(!lb.classList.contains('open'))return;if(e.key==='Escape')close();else if(e.key==='ArrowLeft'&&F.length>1)prev.onclick();else if(e.key==='ArrowRight'&&F.length>1)next.onclick();});
  var gal=document.querySelector('.gal');if(!gal)return;
  gal.addEventListener('click',function(e){
    var th=e.target.closest('.gal-th');
    if(th){var ths=[].slice.call(gal.querySelectorAll('.gal-th'));var i=ths.indexOf(th);gal.querySelector('.gal-main img').src=th.querySelector('img').src;gal.querySelector('.gal-main').dataset.i=i;ths.forEach(function(t){t.classList.toggle('on',t===th);});return;}
    var main=e.target.closest('.gal-main');
    if(main){var t2=[].slice.call(gal.querySelectorAll('.gal-th img'));var f=t2.length?t2.map(function(x){return x.src;}):[gal.querySelector('.gal-main img').src];open(f,+main.dataset.i||0);}
  });
})();
</script>
</body>
</html>`;
}

function run(){
  return fetchAeronaves().then(list => {
    const aeronavesDir = join(ROOT, 'aeronaves');
    if(existsSync(aeronavesDir)) rmSync(aeronavesDir, { recursive:true, force:true });
    mkdirSync(aeronavesDir, { recursive:true });

    const used = new Set();
    const urls = [];
    for(const av of list){
      let slug = slugify(av.nome); let s = slug, n = 2;
      while(used.has(s)){ s = slug+'-'+n; n++; }
      used.add(s);
      const canonical = `${SITE}/aeronaves/${s}/`;
      mkdirSync(join(aeronavesDir, s), { recursive:true });
      writeFileSync(join(aeronavesDir, s, 'index.html'), pageHTML(av, canonical));
      urls.push({ loc: canonical });
      console.log('gerada:', canonical);
    }

    const today = new Date().toISOString().slice(0,10);
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url><loc>${SITE}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>\n` +
      urls.map(u=>`  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`).join('\n') +
      `\n</urlset>\n`;
    writeFileSync(join(ROOT,'sitemap.xml'), sitemap);

    const robots = `User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: ${SITE}/sitemap.xml\n`;
    writeFileSync(join(ROOT,'robots.txt'), robots);

    console.log(`OK: ${urls.length} aeronave(s), sitemap.xml, robots.txt`);
  });
}
run().catch(e => { console.error(e); process.exit(1); });
