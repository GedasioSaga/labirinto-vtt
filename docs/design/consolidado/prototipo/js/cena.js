/*
 * Prévia viva da animação do cenário (a revelação do local), dentro da ficha
 * do pino. Miniatura da coreografia aprovada no app
 * (client/src/cenario/revelacao/tempo.ts), com os mesmos tempos e curvas:
 *   véu 0 a 0,3 s · moldura entra 0 a 1,0 s (easeOutCubic, desfoque de
 *   movimento que some com a velocidade) · postigo na dobradiça 0,45 a 1,15 s
 *   (mola com trava: chega e para, sem quique) · título 0,98 a 1,26 s ·
 *   texto à máquina 1,2 a 4,25 s · câmera e ambiente assentam até 4,6 s.
 * Movimento reduzido: só fades curtos (imagem 0 a 0,2 s, painel 0,1 a 0,3 s)
 * e o texto inteiro de uma vez.
 * Fora do "Assistir", a prévia mostra o quadro final, parado.
 */
(function () {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const FIM_S = 4.6;
  const TEXTO_DE_S = 1.2;
  const TEXTO_ATE_S = 4.25;
  const CURSOR_SOME_S = 0.12;
  const CURVA = {
    saida: 'cubic-bezier(0.23, 1, 0.32, 1)',
    onda: 'cubic-bezier(0.37, 0, 0.63, 1)',
    grua: 'cubic-bezier(0.65, 0, 0.35, 1)',
  };
  /* a câmera é 16% mais larga que a vista: a panorâmica anda essa sobra */
  const SOBRA_DA_PAN = '-13.79%';

  /* mola criticamente amortecida que mira 5% além do fim e trava em 1 (tempo.ts) */
  const ALVO_DA_MOLA = 1.05;
  const X_DA_TRAVA = (function () {
    const alvo = 1 - 1 / ALVO_DA_MOLA;
    let x = 4;
    for (let i = 0; i < 40; i++) x -= ((1 + x) * Math.exp(-x) - alvo) / (-x * Math.exp(-x));
    return x;
  })();
  const mola = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : Math.min(1, ALVO_DA_MOLA * (1 - (1 + X_DA_TRAVA * u) * Math.exp(-X_DA_TRAVA * u))));

  function amostrar(n, quadro) {
    const k = [];
    for (let i = 0; i <= n; i++) k.push(Object.assign({ offset: i / n }, quadro(i / n)));
    return k;
  }
  /* moldura: easeOutCubic na posição; o desfoque cresce com o quadrado da velocidade */
  const ENTRADA_DA_MOLDURA = amostrar(20, (s) => {
    const p = 1 - Math.pow(1 - s, 3);
    return { transform: 'translateX(' + ((1 - p) * 112).toFixed(2) + '%)', filter: 'blur(' + (1.2 * Math.pow(1 - s, 4)).toFixed(3) + 'px)' };
  });
  /* postigo: dobrado atrás da imagem (100°), só aparece abaixo de 90° */
  const GIRO_DO_POSTIGO = amostrar(24, (u) => ({ transform: 'rotateX(' + (-100 * (1 - mola(u))).toFixed(2) + 'deg)' }));
  const SOMBRA_DO_POSTIGO = amostrar(24, (u) => ({ opacity: (0.62 * (1 - mola(u))).toFixed(3) }));

  const PARTICULAS = [[62, 58], [70, 40], [78, 66], [55, 30], [84, 48], [66, 74], [90, 34], [48, 62], [74, 22]];

  /* a cena desenhada (sem imagem externa): fim de tarde no cais, três caixas, uma pinga */
  const ILUSTRACAO = '<svg class="cena__img" viewBox="0 0 464 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
    '<defs><linearGradient id="ce-ceu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4b3527"/><stop offset="0.55" stop-color="#2c2a2d"/><stop offset="1" stop-color="#1b2329"/></linearGradient>' +
    '<radialGradient id="ce-sol" cx="0.72" cy="0.5" r="0.45"><stop offset="0" stop-color="#f3ba66" stop-opacity="0.45"/><stop offset="1" stop-color="#f3ba66" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="ce-mar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22394a"/><stop offset="1" stop-color="#0f1c25"/></linearGradient>' +
    '<radialGradient id="ce-lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#f6cb84" stop-opacity="0.55"/><stop offset="1" stop-color="#f6cb84" stop-opacity="0"/></radialGradient></defs>' +
    '<rect width="464" height="112" fill="url(#ce-ceu)"/><rect width="464" height="200" fill="url(#ce-sol)"/>' +
    '<path d="M0 112V86h34v-8h26v16h40V72l18-12 18 12v20h30v-14h22v34h44V80h28v-6h20v20h36v-30l16-10 16 10v28h24v20h34v-12h20v24z" fill="#171b20"/>' +
    '<rect y="110" width="464" height="90" fill="url(#ce-mar)"/>' +
    '<path d="M300 122h46M312 130h30M296 138h22M330 146h34" stroke="#f3ba66" stroke-opacity="0.28" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M150 200l28-50h286v50z" fill="#3b3128"/><path d="M171 162h293M164 175h300M157 188h307" stroke="#29211a" stroke-width="2"/>' +
    '<circle cx="182" cy="100" r="34" fill="url(#ce-lamp)"/><path d="M182 150V104" stroke="#14161a" stroke-width="3"/><rect x="177" y="94" width="10" height="12" rx="1.5" fill="#f6cb84" stroke="#2a2118" stroke-width="1.5"/>' +
    '<rect x="206" y="138" width="9" height="14" rx="2" fill="#2a2420"/>' +
    '<g transform="translate(336 152) scale(1.3) translate(-336 -152)"><g stroke="#3a2a19" stroke-width="2" stroke-linejoin="round"><rect x="300" y="118" width="38" height="34" fill="#7a5a38"/><path d="M300 118l38 34M338 118l-38 34" fill="none"/>' +
    '<rect x="340" y="126" width="32" height="26" fill="#6e5133"/><path d="M340 126l32 26M372 126l-32 26" fill="none"/>' +
    '<rect x="314" y="92" width="32" height="26" fill="#836141"/><path d="M314 105h32" fill="none"/></g>' +
    '<circle cx="319" cy="135" r="6" fill="#a8463b" stroke="#5e211b" stroke-width="1.2"/><circle cx="319" cy="135" r="2.4" fill="#cf6a5c"/>' +
    '<path d="M356 154c0 0-3 4-3 6a3 3 0 0 0 6 0c0-2-3-6-3-6z" fill="#79a9cc"/><ellipse cx="356" cy="164" rx="8" ry="1.8" fill="#79a9cc" fill-opacity="0.4"/></g>' +
    '</svg>';

  function fx(lista, nome) { return (lista || []).indexOf(nome) >= 0; }

  function palco(d) {
    const efeitos = d.efeitos || [];
    const camera = d.camera || 'pan';
    return '<div class="cena" data-camera="' + esc(camera) + '" data-nevoa="' + fx(efeitos, 'nevoa') + '" data-sol="' + fx(efeitos, 'sol') + '" data-part="' + fx(efeitos, 'part') + '" data-vento="' + fx(efeitos, 'vento') + '" role="img" aria-label="Prévia da revelação do local ' + esc(d.nome) + '">' +
      '<div class="cena__veu"></div>' +
      '<div class="cena__grupo">' +
        '<div class="cena__quadro"><div class="cena__vista">' +
          '<div class="cena__camera">' + ILUSTRACAO + '</div>' +
          '<div class="cena__fx cena__fx--sol"><i></i></div>' +
          '<div class="cena__fx cena__fx--nevoa"><i></i><i></i></div>' +
          '<div class="cena__fx cena__fx--part"><i>' + PARTICULAS.map((p) => '<b style="left:' + p[0] + '%;top:' + p[1] + '%"></b>').join('') + '</i></div>' +
          '<span class="cena__vento"><svg viewBox="0 0 12 10" aria-hidden="true"><path d="M1 3.5h6.5a1.8 1.8 0 1 0-1.8-1.8M1 6.5h8.5a1.8 1.8 0 1 1-1.8 1.8"/></svg><span class="cena__barras"><i></i><i></i><i></i></span>Vento</span>' +
        '</div></div>' +
        '<div class="cena__trilho"><span class="cena__cano"></span><span class="cena__cano"></span>' +
          '<div class="cena__postigo"><i class="cena__sombra"></i>' +
            '<p class="cena__nome">' + esc(d.nome) + '</p>' +
            '<p class="cena__texto"><span class="cena__dig">' + esc(d.desc) + '</span><span class="cena__cursor"></span><span class="cena__falta"></span></p>' +
          '</div></div>' +
      '</div></div>';
  }

  /* bloco = palco + botões. grande = a versão do diálogo "Ver grande" */
  function html(d) {
    return '<div class="cena-bloco' + (d.grande ? ' cena-bloco--grande' : '') + '" data-sc="' + esc(d.sc || '') + '" data-estado="parada">' + palco(d) +
      '<div class="cena-bloco__acoes">' +
        '<button type="button" class="bt bt--latao bt--p" data-acao="cena-tocar">' + window.ic('play', 'ic--p') + '<span>Assistir</span></button>' +
        (d.grande ? '' : '<button type="button" class="bt bt--fantasma bt--p" data-acao="cena-grande">Ver grande</button>') +
        '<span class="cena-bloco__dur">4,6 s</span>' +
      '</div></div>';
  }

  function botao(bloco, tocando) {
    const b = bloco.querySelector('[data-acao="cena-tocar"]');
    if (!b) return;
    b.innerHTML = window.ic(tocando ? 'pausa' : 'play', 'ic--p') + '<span>' + (tocando ? 'Parar' : 'Assistir') + '</span>';
  }

  function texto(bloco, n) {
    const t = bloco._texto || '';
    bloco.querySelector('.cena__dig').textContent = t.slice(0, n);
    bloco.querySelector('.cena__falta').textContent = t.slice(n);
  }

  function parar(bloco) {
    if (!bloco) return;
    (bloco._anims || []).forEach((a) => a.cancel());
    bloco._anims = [];
    bloco._t0 = null;
    if (bloco._texto != null) texto(bloco, bloco._texto.length);
    const c = bloco.querySelector('.cena__cursor');
    if (c) c.classList.remove('vis');
    bloco.dataset.estado = 'parada';
    bloco.querySelector('.cena').classList.remove('tocando');
    botao(bloco, false);
  }

  function tocar(bloco) {
    if (!bloco) return;
    parar(bloco);
    const raiz = bloco.querySelector('.cena');
    const q = (s) => raiz.querySelector(s);
    const dig = q('.cena__dig');
    bloco._texto = dig.textContent + q('.cena__falta').textContent;
    const anims = [];
    const anima = (el, k, o) => { if (el) anims.push(el.animate(k, Object.assign({ fill: 'both' }, o))); };
    const reduz = reduzido();
    const fimS = reduz ? 0.4 : FIM_S;

    if (reduz) {
      anima(q('.cena__veu'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' });
      anima(q('.cena__quadro'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease' });
      anima(q('.cena__postigo'), [{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: 100, easing: 'ease' });
    } else {
      anima(q('.cena__veu'), [{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: CURVA.saida });
      anima(q('.cena__grupo'), ENTRADA_DA_MOLDURA, { duration: 1000, easing: 'linear' });
      anima(q('.cena__postigo'), GIRO_DO_POSTIGO, { duration: 700, delay: 450, easing: 'linear' });
      anima(q('.cena__sombra'), SOMBRA_DO_POSTIGO, { duration: 700, delay: 450, easing: 'linear' });
      anima(q('.cena__nome'), [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: 280, delay: 980, easing: CURVA.saida });
      const cam = raiz.dataset.camera;
      if (cam === 'pan') anima(q('.cena__camera'), [{ transform: 'translateX(0)' }, { transform: 'translateX(' + SOBRA_DA_PAN + ')' }], { duration: 4400, delay: 100, easing: CURVA.grua });
      if (cam === 'aprox') anima(q('.cena__camera'), [{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }], { duration: 4400, delay: 100, easing: CURVA.onda });
      anima(q('.cena__fx--nevoa'), [{ opacity: 0 }, { opacity: 1 }], { duration: 1000, delay: 200, easing: CURVA.onda });
      q('.cena__fx--nevoa').querySelectorAll('i').forEach((el, i) => anima(el, [{ transform: 'translateX(' + (i ? 6 : -8) + '%)' }, { transform: 'translateX(0)' }], { duration: 4500, delay: 100, easing: CURVA.onda }));
      anima(q('.cena__fx--part i'), [{ opacity: 0, transform: 'translateY(10%)' }, { opacity: 1, transform: 'translateY(4%)', offset: 0.2 }, { opacity: 1, transform: 'translateY(0)' }], { duration: 4500, delay: 100, easing: CURVA.onda });
      anima(q('.cena__fx--sol i'), [{ opacity: 0 }, { opacity: 1, offset: 0.35 }, { opacity: 0.8 }], { duration: 4300, delay: 300, easing: CURVA.onda });
    }
    bloco._anims = anims;
    raiz.classList.add('tocando');
    bloco.dataset.estado = 'tocando';
    botao(bloco, true);

    const cursor = q('.cena__cursor');
    const total = bloco._texto.length;
    if (reduz) texto(bloco, total); else texto(bloco, 0);
    const t0 = performance.now();
    bloco._t0 = t0;
    let escritas = reduz ? total : 0;
    (function quadro(agora) {
      if (!bloco.isConnected || bloco._t0 !== t0) return;
      const t = Math.max(0, (agora - t0) / 1000);
      if (!reduz) {
        const n = t >= TEXTO_ATE_S ? total : Math.max(0, Math.min(total, Math.floor(((t - TEXTO_DE_S) / (TEXTO_ATE_S - TEXTO_DE_S)) * total)));
        /* só mexe no texto quando cai uma letra nova: nada de layout à toa a cada quadro */
        if (n !== escritas) { escritas = n; texto(bloco, n); }
        cursor.classList.toggle('vis', t >= TEXTO_DE_S - 0.1 && t < TEXTO_ATE_S + CURSOR_SOME_S);
      }
      if (t < fimS) requestAnimationFrame(quadro);
      else parar(bloco);
    })(t0);
  }

  function alternar(bloco) {
    if (bloco.dataset.estado === 'tocando') parar(bloco); else tocar(bloco);
  }

  /* muda nome, texto, câmera e efeitos sem tocar de novo (a prévia é viva) */
  function atualizar(bloco, d) {
    const raiz = bloco.querySelector('.cena');
    const efeitos = d.efeitos || [];
    raiz.dataset.camera = d.camera || 'pan';
    ['nevoa', 'sol', 'part', 'vento'].forEach((e) => { raiz.dataset[e] = String(fx(efeitos, e)); });
    raiz.setAttribute('aria-label', 'Prévia da revelação do local ' + (d.nome || ''));
    bloco.querySelector('.cena__nome').textContent = d.nome || '';
    const novo = d.desc || '';
    if (bloco.dataset.estado === 'tocando') {
      const ja = bloco.querySelector('.cena__dig').textContent.length;
      bloco._texto = novo;
      texto(bloco, Math.min(ja, novo.length));
    } else {
      bloco._texto = novo;
      texto(bloco, novo.length);
    }
  }

  window.GR_CENA = { html: html, tocar: tocar, parar: parar, alternar: alternar, atualizar: atualizar };
})();
