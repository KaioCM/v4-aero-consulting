// Renderização do catálogo — compartilhada pelo navegador (index.html / aeronaves/) e pelo gerador (build/generate.mjs),
// para o HTML pré-renderizado e o atualizado ao vivo serem idênticos.
export const SB_URL = 'https://hobtolagifjjxcmxreip.supabase.co';
export const SB_KEY = 'sb_publishable_29hmID65I5x-X0Ieot6f5Q_eLOk_Pkl';
export const CAMPOS = 'id,nome,categoria,situacao,moeda,valor,fotos,foto_url,descricao,created_at,updated_at';
export const HOME_MAX = 6;   // home: 3 na porta "comprar" + 3 em "Também à venda"
export const HERO_N = 3;

// categorias da aeronave (coluna aeronaves.categoria + check constraint no banco)
export const CATS = { monomotor_pistao:'Monomotor a pistão', monomotor_turboelice:'Monomotor turboélice', bimotor_pistao:'Bimotor a pistão', bimotor_turboelice:'Bimotor turboélice', jato:'Jato', helicoptero:'Helicóptero' };
const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 });
export const esc = s => (s ?? '').toString().replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export const slug = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'aeronave';
export const fotosDe = av => (Array.isArray(av.fotos) ? av.fotos : []).filter(Boolean);

// Miniatura WebP gerada pelo build (assets/thumbs/<arquivo>-<largura>.webp). Se ainda não existir
// (foto recém-subida, antes do próximo build), o <img> cai na foto original via onerror.
export const THUMB_W = [480, 160];
export const thumbName = (url, w) => { const m = /\/aeronaves\/([^/?#]+)\.[a-z0-9]+$/i.exec(url || ''); return m ? `${m[1]}-${w}.webp` : null; };
export const thumb = (url, w) => { const n = thumbName(url, w); return n ? `/assets/thumbs/${n}` : url; };

export const vendida = av => /vend/i.test(av.situacao || '');
// home: as HOME_MAX mais recentes ainda à venda · catálogo: todas
export const selecionar = (data, catalogo) => catalogo ? data : data.filter(av => !vendida(av)).slice(0, HOME_MAX);
// assinatura do conteúdo: se o banco não mudou desde o build, o navegador não re-renderiza nada
export const assinatura = data => { let h = 5381; const s = data.map(a => a.id + ':' + a.updated_at).join('|'); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

function valorCell(av){
  if (av.valor == null || +av.valor === 0) return `<span class="c-valor tbc" data-label="Valor">[a confirmar]</span>`;
  const m = av.moeda === 'USD' ? 'US$' : 'R$';
  return `<span class="c-valor" data-label="Valor"><span class="vwrap"><span class="moeda">${m}</span><span class="cifra">${nf.format(av.valor)}</span></span></span>`;
}

export function rowHTML(av, i = 9){
  const nome = esc(av.nome || '[a confirmar]');
  const dv = av.valor == null ? '0' : String(av.valor);
  const orig = fotosDe(av)[0] || av.foto_url || '';
  const img = orig
    ? `<img src="${esc(thumb(orig, 480))}" data-orig="${esc(orig)}" onerror="this.onerror=null;this.src=this.dataset.orig" alt="${nome}" width="480" height="360"${i < 3 ? (i === 0 ? ' fetchpriority="high"' : '') : ' loading="lazy"'} decoding="async">`
    : `<img src="/assets/logo-mark.svg" alt="" width="480" height="360">`;
  const sit = av.situacao || 'Disponível';
  const sitCls = /reserv/i.test(sit) ? 'reservada' : vendida(av) ? 'vendida' : '';
  return `<div class="av" data-tipo="${esc(av.categoria)}" data-moeda="${esc(av.moeda || 'BRL')}" data-valor="${dv}" data-criado="${Date.parse(av.created_at) || 0}" data-nome="${nome}">
      <a class="av-row" href="/aeronaves/${slug(av.nome)}/">
        <span class="c-img">${img}</span>
        <span class="c-nome"><b>${nome}</b><span class="cat">${CATS[av.categoria] || esc(av.categoria)}</span></span>
        <span class="c-sit" data-label="Situação"><span class="sit ${sitCls}">${esc(sit)}</span></span>
        ${valorCell(av)}
        <span class="c-caret" aria-hidden="true"><svg class="ic" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg></span>
      </a>
    </div>`;
}

// Porta "comprar" da home: foto 4:3 + nome + preço (mesmos dados dos cards)
export function tileHTML(av, i = 0){
  const nome = esc(av.nome || '[a confirmar]');
  const orig = fotosDe(av)[0] || av.foto_url || '';
  const img = orig
    ? `<img src="${esc(thumb(orig, 480))}" data-orig="${esc(orig)}" onerror="this.onerror=null;this.src=this.dataset.orig" alt="${nome}" width="480" height="360"${i === 0 ? ' fetchpriority="high"' : ''} decoding="async">`
    : '';
  const sit = av.situacao || 'Disponível';
  const selo = /reserv/i.test(sit) ? `<span class="sit reservada">${esc(sit)}</span>` : '';
  const preco = (av.valor == null || +av.valor === 0)
    ? '<span class="pr tbc tnum">Valor sob consulta</span>'
    : `<span class="pr tnum">${av.moeda === 'USD' ? 'US$' : 'R$'} ${nf.format(av.valor)}</span>`;
  return `<a class="tile" href="/aeronaves/${slug(av.nome)}/"><span class="ph">${img}${selo}</span><b>${nome}</b>${preco}</a>`;
}
export const tilesHTML = arr => arr.map(tileHTML).join('');

export const listaHTML = shown => shown.length
  ? shown.map(rowHTML).join('')
  : '<p class="cat-note" style="grid-column:1/-1;text-align:center;padding:2rem 0">Nenhuma aeronave disponível no momento. Fale conosco no WhatsApp.</p>';

export async function buscarAeronaves(){
  const r = await fetch(`${SB_URL}/rest/v1/aeronaves?ativo=eq.true&order=created_at.desc&select=${CAMPOS}`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } });
  if (!r.ok) throw new Error('Supabase ' + r.status);
  return r.json();
}
