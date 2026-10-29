// Gerador de páginas estáticas por aeronave (SEO) — lê o Supabase e escreve HTML pronto.
// Roda no GitHub Action (Node 22) e também localmente: `node build/generate.mjs`.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, unlinkSync } from 'node:fs';
import sharp from 'sharp';
import { CATS, esc, slug as slugify, fotosDe, thumb, thumbName, THUMB_W, selecionar, listaHTML, assinatura, buscarAeronaves } from '../assets/catalogo.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://v4aeroflight.com';
const WA = '5565981476175';
const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });

const precoTxt = (av) => (av.valor==null || +av.valor===0) ? null : (av.moeda==='USD'?'US$ ':'R$ ')+nf.format(av.valor);
// texto puro da descrição (sem **negrito**, marcadores ou separadores)
const textoPuro = md => (md || '').split('\n').map(l => l.trim()).filter(l => l && l !== '---' && !/^#{1,6}\s/.test(l))
  .map(l => l.replace(/^[-*]\s+/, '').replace(/\*\*/g, '').replace(/[:.]$/, '')).join('. ').replace(/\s+/g, ' ');
const corta = (t, n) => t.length > n ? t.slice(0, n - 1).replace(/[\s,;.]+\S*$/, '') + '…' : t;
const metaDesc = (av) => {
  const cat = CATS[av.categoria] || av.categoria || 'Aeronave';
  const p = precoTxt(av);
  const base = `${av.nome} à venda: ${cat.toLowerCase()}${p ? ', ' + p : ''}.`;
  const det = textoPuro(av.descricao);
  return corta(det ? `${base} ${det}` : `${base} Ficha técnica, fotos e condições com a V4 Aero Flight.`, 158);
};
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
    if(/^#{1,6}\s/.test(line)){ flush(); continue; }   // "## 31. Modelo Ano": título colado do material interno, repete o H1
    const h = line.match(/^\*\*(.+)\*\*$/);
    if(h){ flush(); html += `<h4 class="ds-h">${esc(h[1])}</h4>`; continue; }
    if(/^[-*]\s+/.test(line)){ list.push(line.replace(/^[-*]\s+/, '')); continue; }
    flush(); html += `<p>${inlineMd(line)}</p>`;
  }
  flush();
  return html;
}

function pageHTML(av, canonical){
  const nome = av.nome || 'Aeronave';
  const cat = CATS[av.categoria] || av.categoria || '';
  const fotos = fotosDe(av);
  const capa = fotos[0] || `${SITE}/assets/og.jpg`;
  const preco = precoTxt(av);
  const sitClass = /reserv/i.test(av.situacao)?'reservada' : /vend/i.test(av.situacao)?'vendida' : '';
  const desc = metaDesc(av);
  // ViewContent (Meta) / view_item (GA4): content_ids = slug, o mesmo id do futuro catálogo de anúncios
  const item = { id: canonical.split('/').filter(Boolean).pop(), name: nome, category: cat,
    ...(preco ? { value: +av.valor, currency: av.moeda || 'BRL' } : {}) };
  const viewTrack = `<script>(function(i){try{if(window.fbq)fbq('track','ViewContent',Object.assign({content_ids:[i.id],content_type:'product',content_name:i.name,content_category:i.category},i.value?{value:i.value,currency:i.currency}:{}));if(window.gtag)gtag('event','view_item',Object.assign({items:[{item_id:i.id,item_name:i.name,item_category:i.category,price:i.value}]},i.value?{value:i.value,currency:i.currency}:{}));}catch(e){}})(${JSON.stringify(item).replace(/</g, String.fromCharCode(92)+'u003c')});</script>`;
  const descrBlock = av.descricao && av.descricao.trim()
    ? `<div class="descr">${renderDescricao(av.descricao)}</div>`
    : `<div class="descr tbc">Ficha técnica sob consulta. Fale conosco no WhatsApp.</div>`;

  const gal = fotos.length ? `
      <div class="gal">
        <button type="button" class="gal-main" data-i="0" aria-label="Ampliar foto"><img src="${esc(fotos[0])}" data-orig="${esc(fotos[0])}" alt="${esc(nome)}" width="1200" height="800" fetchpriority="high"><span class="gal-zoom">⤢ ampliar</span></button>
        ${fotos.length>1?`<div class="gal-ths">${fotos.map((f,i)=>`<button type="button" class="gal-th${i===0?' on':''}" aria-label="Foto ${i+1}"><img src="${esc(thumb(f,160))}" data-orig="${esc(f)}" onerror="this.onerror=null;this.src=this.dataset.orig" alt="" width="160" height="120" loading="lazy" decoding="async"></button>`).join('')}</div>`:''}
      </div>` : `<div class="gal-empty">Fotos sob consulta</div>`;

  const ld = { '@context':'https://schema.org', '@graph':[
    { '@type':'Product', name: nome, description: desc, image: fotos.length?fotos.slice(0,10):[capa], category: cat, url: canonical,
      itemCondition:'https://schema.org/UsedCondition',
      ...(preco ? { offers:{ '@type':'Offer', priceCurrency: av.moeda||'BRL', price: String(av.valor),
        availability: availability(av.situacao), itemCondition:'https://schema.org/UsedCondition', url: canonical,
        seller:{ '@type':'Organization', name:'V4 Aero Flight', url: SITE+'/' } } } : {}) },
    { '@type':'BreadcrumbList', itemListElement:[
      { '@type':'ListItem', position:1, name:'Início', item: SITE+'/' },
      { '@type':'ListItem', position:2, name:'Aeronaves', item: SITE+'/aeronaves/' },
      { '@type':'ListItem', position:3, name: nome, item: canonical } ] }
  ] };

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
${viewTrack}
<meta property="og:type" content="product">
<meta property="og:site_name" content="V4 Aero Flight">
<meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${esc(nome)} à venda — V4 Aero Flight">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(capa)}">
<meta property="og:image:alt" content="${esc(nome)}">
<meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/logo-mark.svg" type="image/svg+xml">
<link rel="icon" href="/assets/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<meta name="theme-color" content="#0B2137">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, String.fromCharCode(92)+'u003c')}</script>
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
  .gal-main img{width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;display:block}
  .gal-main .gal-zoom{position:absolute;right:.5rem;bottom:.5rem;background:rgba(6,20,35,.72);color:#fff;font-size:.72rem;padding:.14rem .45rem;border-radius:2px;font-family:'IBM Plex Mono',monospace}
  .gal-ths{display:flex;gap:.45rem;flex-wrap:wrap}
  .gal-th{width:62px;height:46px;padding:0;border:1px solid var(--blue-100);background:var(--blue-050);cursor:pointer;border-radius:2px;overflow:hidden}
  .gal-th.on{border-color:var(--blue-500);border-width:2px}
  .gal-th img{width:100%;height:100%;object-fit:cover;display:block}
  .gal-empty{display:flex;align-items:center;justify-content:center;aspect-ratio:3/2;color:var(--blue-600);font-family:'IBM Plex Mono',monospace;font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;background:var(--blue-050);border:1px dashed var(--blue-100)}
  .cta{margin-top:1.4rem;display:flex;gap:.7rem;flex-wrap:wrap}
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
  <nav class="crumb"><a href="/">Início</a> › <a href="/aeronaves/">Aeronaves</a> › ${esc(nome)}</nav>
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
  <a class="back mono" href="/aeronaves/">‹ Ver todas as aeronaves</a>
</div></main>
<footer><div class="wrap">© ${new Date().getFullYear()} V4 Aero Flight · Compra, venda e intermediação de aeronaves · <a href="/privacidade/">Política de privacidade</a></div></footer>
<script src="/assets/lead.js" data-aero="${esc(nome)}" defer></script>
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
    if(th){var ths=[].slice.call(gal.querySelectorAll('.gal-th'));var i=ths.indexOf(th);gal.querySelector('.gal-main img').src=th.querySelector('img').dataset.orig;gal.querySelector('.gal-main').dataset.i=i;ths.forEach(function(t){t.classList.toggle('on',t===th);});return;}
    var main=e.target.closest('.gal-main');
    if(main){var t2=[].slice.call(gal.querySelectorAll('.gal-th img'));var f=t2.length?t2.map(function(x){return x.dataset.orig;}):[gal.querySelector('.gal-main img').dataset.orig];open(f,+main.dataset.i||0);}
  });
})();
</script>
</body>
</html>`;
}

// Miniaturas WebP (assets/thumbs/): 480px da capa (cards) e 160px de todas as fotos (tira da galeria).
// Só baixa o que ainda não existe; apaga as que não são mais usadas.
async function gerarMiniaturas(list){
  const dir = join(ROOT, 'assets', 'thumbs');
  mkdirSync(dir, { recursive:true });
  const usadas = new Set(), porUrl = new Map();
  for(const av of list) fotosDe(av).forEach((url, i) => {
    for(const w of (i === 0 ? THUMB_W : [160])){
      const n = thumbName(url, w); if(!n) continue;
      usadas.add(n);
      if(!existsSync(join(dir, n))){ if(!porUrl.has(url)) porUrl.set(url, []); porUrl.get(url).push({ w, n }); }
    }
  });
  const fila = [...porUrl.entries()]; let novas = 0, falhas = 0;
  const worker = async () => { while(fila.length){
    const [url, alvos] = fila.shift();
    try{
      const r = await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      for(const { w, n } of alvos){
        await sharp(buf).rotate().resize(w, Math.round(w*0.75), { fit:'cover' }).webp({ quality: w > 200 ? 72 : 62 }).toFile(join(dir, n));
        novas++;
      }
    }catch(e){ falhas++; console.warn('miniatura falhou:', url, e.message); }
  }};
  await Promise.all(Array.from({ length: 6 }, worker));
  let removidas = 0;
  for(const f of readdirSync(dir)) if(!usadas.has(f)){ unlinkSync(join(dir, f)); removidas++; }
  console.log(`miniaturas: ${novas} novas, ${removidas} removidas, ${falhas} falhas, ${usadas.size} no total`);
}

// Injeta a lista já renderizada (mesma função do navegador) entre <!--CAT-ROWS--> … <!--/CAT-ROWS-->.
function preRender(html, data, catalogo){
  const shown = selecionar(data, catalogo);
  return html
    .replace(/<!--CAT-ROWS-->[\s\S]*?<!--\/CAT-ROWS-->/,() => `<!--CAT-ROWS-->${listaHTML(shown)}<!--/CAT-ROWS-->`)
    .replace(/(id="catList" data-sig=")[^"]*"/, `$1${assinatura(shown)}"`)
    .replace(/(<span class="count mono" id="count">)[^<]*/, `$1${String(shown.length).padStart(2,'0')} aeronave${shown.length === 1 ? '' : 's'}`);
}

const dia = d => (d ? new Date(d) : new Date()).toISOString().slice(0, 10);

async function run(){
  const list = await buscarAeronaves();
  const aeronavesDir = join(ROOT, 'aeronaves');
  if(existsSync(aeronavesDir)) rmSync(aeronavesDir, { recursive:true, force:true });
  mkdirSync(aeronavesDir, { recursive:true });

  await gerarMiniaturas(list);

  const used = new Set();
  const urls = [];
  for(const av of list){
    let slug = slugify(av.nome); let s = slug, n = 2;
    while(used.has(s)){ s = slug+'-'+n; n++; }
    used.add(s);
    const canonical = `${SITE}/aeronaves/${s}/`;
    mkdirSync(join(aeronavesDir, s), { recursive:true });
    writeFileSync(join(aeronavesDir, s, 'index.html'), pageHTML(av, canonical));
    urls.push({ loc: canonical, lastmod: dia(av.updated_at || av.created_at), nome: av.nome });
  }
  console.log(`páginas: ${urls.length} aeronave(s)`);

  // Home: lista pré-renderizada (5 mais recentes à venda)
  const home = preRender(readFileSync(join(ROOT, 'index.html'), 'utf8'), list, false);
  writeFileSync(join(ROOT, 'index.html'), home);

  // Catálogo completo em /aeronaves/: derivado do index.html (mesmo visual e script), sem as seções HOME-ONLY.
  const catDesc = 'Catálogo completo de aviões e helicópteros à venda na V4 Aero Flight: monomotores, bimotores, turboélices, jatos e helicópteros, com fotos, ficha técnica e valor.';
  const catLd = { '@context':'https://schema.org', '@graph':[
    { '@type':'CollectionPage', name:'Aeronaves à venda — catálogo completo', url: SITE+'/aeronaves/', inLanguage:'pt-BR',
      isPartOf:{ '@id': SITE+'/#website' },
      mainEntity:{ '@type':'ItemList', numberOfItems: urls.length,
        itemListElement: urls.map((u, i) => ({ '@type':'ListItem', position: i+1, url: u.loc, name: u.nome })) } },
    { '@type':'BreadcrumbList', itemListElement:[
      { '@type':'ListItem', position:1, name:'Início', item: SITE+'/' },
      { '@type':'ListItem', position:2, name:'Aeronaves', item: SITE+'/aeronaves/' } ] }
  ] };
  let cat = preRender(home, list, true)
    .replace(/<!--HOME-ONLY-->[\s\S]*?<!--\/HOME-ONLY-->/g, '')
    .replace('<body>', '<body class="catalogo">')
    .replace(/<title>[\s\S]*?<\/title>/,'<title>Aeronaves à venda — catálogo completo | V4 Aero Flight</title>')
    .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${SITE}/aeronaves/"`)
    .replace(/(<meta name="description" content=")[^"]*"/, `$1${catDesc}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, '$1Aeronaves à venda — catálogo completo | V4 Aero Flight"')
    .replace(/(<meta property="og:description" content=")[^"]*"/, `$1${catDesc}"`)
    .replace(/(<meta property="og:url" content=")[^"]*"/, `$1${SITE}/aeronaves/"`)
    .replace(/<!--LD-->[\s\S]*?<!--\/LD-->/,() => `<!--LD--><script type="application/ld+json">${JSON.stringify(catLd).replace(/</g, String.fromCharCode(92)+'u003c')}</script><!--/LD-->`)
    .replace(/href="#aeronaves"/g, 'href="/aeronaves/"')
    .replace(/href="#/g, 'href="/#')
    .replace(/(["'(])assets\//g, '$1/assets/');
  writeFileSync(join(aeronavesDir, 'index.html'), cat);

  // lastmod = data real da última alteração (não "hoje"), para o robô não commitar todo dia à toa
  const ultima = urls.map(u => u.lastmod).sort().pop() || dia();
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
` +
    `  <url><loc>${SITE}/</loc><lastmod>${ultima}</lastmod><priority>1.0</priority></url>
` +
    `  <url><loc>${SITE}/aeronaves/</loc><lastmod>${ultima}</lastmod><priority>0.9</priority></url>
` +
    urls.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>0.8</priority></url>`).join('\n') +
    `
  <url><loc>${SITE}/privacidade/</loc><lastmod>2026-10-29</lastmod><priority>0.2</priority></url>` +
    `
</urlset>
`;
  writeFileSync(join(ROOT, 'sitemap.xml'), sitemap);

  const robots = `User-agent: *
Allow: /
Disallow: /admin.html

Sitemap: ${SITE}/sitemap.xml
`;
  writeFileSync(join(ROOT, 'robots.txt'), robots);

  console.log(`OK: ${urls.length} aeronave(s), home + catálogo pré-renderizados, sitemap.xml, robots.txt`);
}
run().catch(e => { console.error(e); process.exit(1); });
