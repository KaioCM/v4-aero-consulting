// Formulário de captação de lead (modal em 2 etapas) — compartilhado pela home, páginas de aeronave e 404.
// Uso: <script src="/assets/lead.js" data-aero="Nome da aeronave" defer></script>  (data-aero é opcional)
// Qualquer elemento .js-lead abre o modal; um data-aero no próprio elemento tem prioridade sobre o do script.
(function(){
  if (window.V4Lead) return;
  var SB = 'https://hobtolagifjjxcmxreip.supabase.co';
  var KEY = 'sb_publishable_29hmID65I5x-X0Ieot6f5Q_eLOk_Pkl';
  var WA = '5565981476175';
  var me = document.currentScript;
  var DEF_AERO = (me && me.getAttribute('data-aero')) || null;

  // Origem da campanha: grava os UTMs da 1ª página da visita (sobrevive à navegação dentro do site).
  var UTM = null;
  try {
    var p = new URLSearchParams(location.search), o = {};
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){ var v = p.get(k); if (v) o[k] = v.slice(0, 120); });
    if (Object.keys(o).length) { sessionStorage.setItem('v4_utm', JSON.stringify(o)); UTM = o; }
    else UTM = JSON.parse(sessionStorage.getItem('v4_utm') || 'null');
  } catch (e) {}

  var Q = {
    intencao:  { req: true, opts: [['comprar','Comprar'],['vender','Vender minha aeronave'],['pesquisando','Só pesquisando']] },
    categoria: { opts: [['monomotor','Monomotor'],['bimotor','Bimotor'],['turboelice','Turboélice'],['jato','Jato'],['helicoptero','Helicóptero']] },
    faixa:     { opts: [['ate1','Até R$ 1 mi'],['1a3','R$ 1–3 mi'],['3a10','R$ 3–10 mi'],['10mais','Acima de R$ 10 mi'],['nd','Prefiro não dizer']] },
    prazo:     { opts: [['dias','Nos próximos dias'],['ate3m','Até 3 meses'],['3a12m','3 a 12 meses'],['sem_pressa','Sem pressa']] }
  };
  var ORDER = ['intencao','categoria','faixa','prazo'];
  function label(k, A){
    var v = A.intencao === 'vender';
    if (k === 'intencao') return 'O que você procura?';
    if (k === 'categoria') return v ? 'Categoria da sua aeronave' : 'Categoria de interesse';
    if (k === 'faixa') return v ? 'Valor estimado da aeronave' : 'Faixa de investimento';
    return v ? 'Quando pretende vender?' : 'Quando pretende fechar?';
  }
  function optLabel(k, val){ var o = Q[k].opts.filter(function(x){ return x[0] === val; })[0]; return o ? o[1] : null; }
  // quente: quer comprar/vender e fecha nos próximos dias ou em até 3 meses · frio: só pesquisando ou sem pressa · morno: o resto
  function score(A){
    if (!A.intencao || A.intencao === 'pesquisando' || A.prazo === 'sem_pressa') return 'frio';
    return (A.prazo === 'dias' || A.prazo === 'ate3m') ? 'quente' : 'morno';
  }

  var css =
    '.v4l{position:fixed;inset:0;z-index:150;background:rgba(6,20,35,.6);display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(2px);font-family:"IBM Plex Sans",system-ui,sans-serif}' +
    '.v4l[hidden],.v4l [hidden]{display:none!important}' +
    '.v4l-box{position:relative;box-sizing:border-box;background:#fff;border-radius:6px;padding:1.6rem 1.5rem 1.4rem;width:100%;max-width:480px;max-height:calc(100vh - 2rem);overflow-y:auto;box-shadow:0 12px 40px rgba(6,20,35,.28);color:#0B2137;line-height:1.5}' +
    '.v4l-x{position:absolute;top:.5rem;right:.7rem;background:none;border:0;font-size:1.7rem;line-height:1;color:#3E77AE;cursor:pointer;padding:.1rem .3rem}.v4l-x:hover{color:#0B2137}' +
    '.v4l-step{font-family:"IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.12em;font-size:.66rem;color:#2A5B8C;margin-bottom:.5rem}' +
    '.v4l-t{font-size:1.3rem;font-weight:600;margin:0 0 .25rem;color:#061423}' +
    '.v4l-sub{color:#2A5B8C;font-size:.9rem;margin:0 0 1.1rem}' +
    '.v4l-q{margin-bottom:1rem}' +
    '.v4l-ql{font-weight:600;font-size:.9rem;margin-bottom:.45rem}' +
    '.v4l-ql span{font-weight:400;font-size:.66rem;color:#2A5B8C;font-family:"IBM Plex Mono",monospace;text-transform:uppercase;letter-spacing:.08em;margin-left:.35rem}' +
    '.v4l-chips{display:flex;flex-wrap:wrap;gap:.4rem}' +
    '.v4l-chip{font:inherit;font-size:.86rem;padding:.5rem .8rem;border:1px solid #DCE9F3;background:#F1F5FA;color:#12314D;border-radius:3px;cursor:pointer;transition:.15s}' +
    '.v4l-chip:hover{border-color:#3E77AE}.v4l-chip.on{background:#0B2137;border-color:#0B2137;color:#fff}' +
    '.v4l-btn{display:block;width:100%;font:inherit;font-weight:500;font-size:.95rem;padding:.75rem 1rem;border:0;border-radius:3px;background:#0B2137;color:#fff;cursor:pointer;margin-top:.4rem}' +
    '.v4l-btn:hover{background:#12314D}.v4l-btn[disabled]{opacity:.45;cursor:default}' +
    '.v4l-s2{display:flex;flex-direction:column;gap:.6rem}' +
    '.v4l-row{display:flex;gap:.6rem}.v4l-row>*{flex:1;min-width:0}' +
    '.v4l input{width:100%;box-sizing:border-box;background:#fff;border:1px solid #DCE9F3;border-radius:3px;padding:.72rem .8rem;font:inherit;font-size:.92rem;color:#061423}' +
    '.v4l input::placeholder{color:#3E77AE;opacity:.7}' +
    '.v4l input:focus{outline:none;border-color:#3E77AE;box-shadow:0 0 0 2px rgba(62,119,174,.16)}' +
    '.v4l-back{background:none;border:0;font:inherit;font-size:.85rem;color:#2A5B8C;cursor:pointer;align-self:flex-start;padding:.2rem 0}' +
    '.v4l-note{font-size:.85rem;margin:.1rem 0 0}.v4l-note.ok{color:#1a7a4c}.v4l-note.err{color:#b3261e}' +
    '@media(max-width:560px){.v4l{align-items:flex-end;padding:0}.v4l-box{border-radius:10px 10px 0 0;max-height:92vh}.v4l-row{flex-direction:column}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var m = document.createElement('div');
  m.className = 'v4l'; m.hidden = true;
  m.innerHTML =
    '<div class="v4l-box" role="dialog" aria-modal="true" aria-labelledby="v4lT">' +
      '<button class="v4l-x" type="button" aria-label="Fechar">×</button>' +
      '<div class="v4l-step">Etapa <span class="v4l-n">1</span> de 2</div>' +
      '<h3 class="v4l-t" id="v4lT"></h3>' +
      '<p class="v4l-sub"></p>' +
      '<div class="v4l-s1"><div class="v4l-qs"></div><button type="button" class="v4l-btn v4l-next" disabled>Continuar</button></div>' +
      '<form class="v4l-s2" hidden novalidate>' +
        '<div class="v4l-row"><input name="nome" placeholder="Seu nome" autocomplete="name"><input name="tel" type="tel" inputmode="tel" placeholder="WhatsApp (com DDD)" autocomplete="tel"></div>' +
        '<input name="email" type="email" placeholder="E-mail (opcional)" autocomplete="email">' +
        '<button type="submit" class="v4l-btn">Continuar no WhatsApp</button>' +
        '<button type="button" class="v4l-back">‹ Voltar</button>' +
        '<p class="v4l-note" hidden></p>' +
      '</form>' +
    '</div>';
  document.body.appendChild(m);

  var $ = function(s){ return m.querySelector(s); };
  var qs = $('.v4l-qs'), next = $('.v4l-next'), f = $('.v4l-s2'), note = $('.v4l-note');
  var A = {}, AERO = null;

  function renderQs(){
    var h = '';
    ORDER.forEach(function(k){
      if (k === 'categoria' && AERO) return;
      h += '<div class="v4l-q"><div class="v4l-ql">' + label(k, A) + (Q[k].req ? '' : ' <span>opcional</span>') + '</div><div class="v4l-chips">';
      Q[k].opts.forEach(function(o){ h += '<button type="button" class="v4l-chip' + (A[k] === o[0] ? ' on' : '') + '" data-k="' + k + '" data-v="' + o[0] + '">' + o[1] + '</button>'; });
      h += '</div></div>';
    });
    qs.innerHTML = h;
    next.disabled = !A.intencao;
  }
  function go(n){
    $('.v4l-s1').hidden = n !== 1; f.hidden = n !== 2; $('.v4l-n').textContent = n;
    if (n === 2) setTimeout(function(){ f.elements.nome.focus(); }, 40);
  }
  function say(type, txt){ note.hidden = false; note.className = 'v4l-note ' + type; note.textContent = txt; }
  function open(aero){
    AERO = aero || DEF_AERO || null; A = {}; note.hidden = true;
    $('.v4l-t').textContent = AERO ? 'Tenho interesse' : 'Fale com a nossa equipe';
    $('.v4l-sub').textContent = AERO ? 'Sobre a aeronave ' + AERO + '. Responda em poucos toques.' : 'Responda em poucos toques e a gente continua no WhatsApp.';
    renderQs(); go(1); m.hidden = false;
  }
  function close(){ m.hidden = true; }

  qs.addEventListener('click', function(e){
    var b = e.target.closest('.v4l-chip'); if (!b) return;
    var k = b.getAttribute('data-k'), v = b.getAttribute('data-v');
    A[k] = (A[k] === v && !Q[k].req) ? undefined : v;   // opcionais: tocar de novo desmarca
    renderQs();
  });
  next.addEventListener('click', function(){ if (A.intencao) go(2); });
  $('.v4l-back').addEventListener('click', function(){ go(1); });
  $('.v4l-x').addEventListener('click', close);
  m.addEventListener('click', function(e){ if (e.target === m) close(); });
  addEventListener('keydown', function(e){ if (e.key === 'Escape' && !m.hidden) close(); });
  document.addEventListener('click', function(e){
    var el = e.target.closest && e.target.closest('.js-lead'); if (!el) return;
    e.preventDefault(); open(el.getAttribute('data-aero'));
  });

  function whatsText(nome){
    var vender = A.intencao === 'vender', cat = A.categoria ? optLabel('categoria', A.categoria) : null, t;
    if (AERO) {
      // link canônico da página (sem domínio local nem parâmetros) — o atendente identifica a aeronave na hora
      var url = 'https://v4aeroflight.com' + location.pathname.replace(/index\.html$/, '');
      return 'Olá! Encontrei essa aeronave no site ' + url + '. Gostaria de saber se ainda está disponível.' + (vender ? ' Também tenho uma aeronave para negociar.' : '');
    }
    else if (vender) t = 'Olá, sou ' + nome + '. Quero vender minha aeronave' + (cat ? ' (' + cat + ')' : '') + '.';
    else if (A.intencao === 'comprar') t = 'Olá, sou ' + nome + '. Quero comprar uma aeronave' + (cat ? ' (' + cat + ')' : '') + '.';
    else t = 'Olá, sou ' + nome + '. Estou pesquisando as aeronaves anunciadas no site.';
    if (A.faixa && A.faixa !== 'nd') t += (vender ? ' Valor estimado: ' : ' Investimento: ') + optLabel('faixa', A.faixa) + '.';
    if (A.prazo) t += ' Prazo: ' + optLabel('prazo', A.prazo).toLowerCase() + '.';
    return t;
  }

  f.addEventListener('submit', function(e){
    e.preventDefault();
    var nome = f.elements.nome.value.trim(), tel = f.elements.tel.value.trim(), email = f.elements.email.value.trim();
    if (!nome) return say('err', 'Informe seu nome.');
    if (tel.replace(/\D/g, '').length < 10) return say('err', 'Informe o WhatsApp com DDD.');
    var sc = score(A);
    var rec = {
      nome: nome, telefone: tel, email: email || null, mensagem: null,
      aeronave: AERO, origem: AERO ? 'aeronave:' + AERO : 'landing',
      intencao: A.intencao || null, categoria: A.categoria || null, faixa: A.faixa || null, prazo: A.prazo || null,
      utm: UTM
    };
    fetch(SB + '/rest/v1/leads', { method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY, Prefer: 'return=minimal' },
      body: JSON.stringify(rec) }).catch(function(){});
    try {
      if (window.fbq) {
        fbq('track', 'Lead', { content_name: AERO || 'Geral', content_category: A.intencao });
        if (sc === 'quente') fbq('trackCustom', 'LeadQualificado', { content_name: AERO || 'Geral', intencao: A.intencao, prazo: A.prazo });
      }
    } catch (err) {}
    try { if (window.gtag) gtag('event', 'generate_lead', { aircraft: AERO || 'Geral', intencao: A.intencao, lead_score: sc }); } catch (err) {}
    window.open('https://wa.me/' + WA + '?text=' + encodeURIComponent(whatsText(nome)), '_blank', 'noopener');
    say('ok', 'Perfeito! Abrindo o WhatsApp…');
    f.reset();
    setTimeout(close, 900);
  });

  window.V4Lead = { open: open };
})();
