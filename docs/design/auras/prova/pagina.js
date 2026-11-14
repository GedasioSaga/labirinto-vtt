/*
 * A página de prova. Pinta as auras de auras.js em canvas 2D do jeito que o
 * Pixi vai pintar: um sprite por item, uma textura só por aura (as formas
 * tingidas pela rampa, lado a lado), mistura normal ('source-over') ou somada
 * ('lighter'), e nada de filtro. A aura em si mora em auras.js; aqui é o pincel,
 * o chão, a ficha de exemplo, o relógio e o medidor.
 */
(function () {
  'use strict';

  const A = window.Auras;
  const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));

  /** Tamanhos em px CSS. raio 30 = a ficha de 60 px do zoom normal. */
  const VISTAS = {
    grande: { lado: 288, raio: 60, cy: 0.545 },
    escuro: { lado: 140, raio: 30, cy: 0.55 },
    grama: { lado: 140, raio: 30, cy: 0.55 },
    mini: { lado: 48, raio: 13, cy: 0.56 },
  };
  /** Lado da casa do mapa no zoom normal: a ficha de 60 px cabe numa. */
  const CASA = 64;
  /** De quanto em quanto tempo o medidor troca o número. */
  const MEDIDOR_MS = 500;
  /** Quanto a borda do cartão fica acesa depois do clique no menu (a rolagem suave leva perto disso). */
  const MARCA_MS = 900;

  // ---------------------------------------------------------------- pincel

  /** Uma textura por aura: cada linha é uma forma, cada coluna um passo da rampa. */
  function assarAtlas(aura) {
    const linhas = [];
    let largura = 0;
    let altura = 0;
    for (const [nomeForma, nomeRampa] of aura.pinceis) {
      const f = A.FORMAS[nomeForma];
      const passos = A.passosDaRampa(nomeRampa);
      linhas.push({ forma: f, rampa: nomeRampa, passos, volta: A.rampaDaVolta(nomeRampa), w: f.w, h: f.h, y: altura });
      largura = Math.max(largura, passos * (f.w + 2));
      altura += f.h + 2;
    }
    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    for (const L of linhas) {
      const img = ctx.createImageData(L.w, L.h);
      const d = img.data;
      const n = L.w * L.h;
      for (let c = 0; c < L.passos; c += 1) {
        const u = L.volta ? c / L.passos : L.passos > 1 ? c / (L.passos - 1) : 0;
        const rgb = A.corDaRampa(L.rampa, u);
        for (let i = 0, p = 0; i < n; i += 1, p += 4) {
          const l = L.forma.lum[i];
          d[p] = Math.round(rgb[0] * l * 255);
          d[p + 1] = Math.round(rgb[1] * l * 255);
          d[p + 2] = Math.round(rgb[2] * l * 255);
          d[p + 3] = Math.round(L.forma.alfa[i] * 255);
        }
        ctx.putImageData(img, c * (L.w + 2) + 1, L.y + 1);
      }
    }
    return { canvas, linhas };
  }

  /** Pinta os itens de uma camada. `v` traz o atlas e o centro da ficha no canvas. */
  function pintarCamada(v, camada) {
    const ctx = v.ctx;
    const s = v.saida;
    const atlas = v.atlas;
    const k = dpr;
    const e = v.cx * dpr;
    const f = v.cy * dpr;
    let mistura = -1;
    for (let i = 0; i < s.n; i += 1) {
      const it = s.itens[i];
      if (it.camada !== camada) continue;
      if (it.mistura !== mistura) {
        mistura = it.mistura;
        ctx.globalCompositeOperation = mistura === A.SOMA ? 'lighter' : 'source-over';
      }
      const L = atlas.linhas[it.pincel];
      let col;
      if (L.volta) {
        col = Math.round(it.cor * L.passos) % L.passos;
        if (col < 0) col += L.passos;
      } else {
        col = Math.min(L.passos - 1, Math.max(0, Math.round(it.cor * (L.passos - 1))));
      }
      const c = Math.cos(it.rot) * k;
      const sn = Math.sin(it.rot) * k;
      ctx.setTransform(c, sn, -sn, c, e + k * it.x, f + k * it.y);
      ctx.globalAlpha = it.alfa;
      ctx.drawImage(atlas.canvas, col * (L.w + 2) + 1, L.y + 1, L.w, L.h, -it.w / 2, -it.h / 2, it.w, it.h);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- chão

  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function misturar(a, b, t) {
    const x = hexRgb(a);
    const y = hexRgb(b);
    return `rgb(${Math.round(x[0] + (y[0] - x[0]) * t)}, ${Math.round(x[1] + (y[1] - x[1]) * t)}, ${Math.round(x[2] + (y[2] - x[2]) * t)})`;
  }
  /** Sorteio preso à posição no mundo: a vista ampliada mostra o mesmo chão, só que maior. */
  function noMundo(a, b, c) {
    return A.sorteio(a + 7777, b, c);
  }

  /** Masmorra: lajes escuras em fileiras, rejunte e um grão fino. */
  function pintarPedra(ctx, x0, y0, x1, y1) {
    ctx.fillStyle = '#25221f';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let fila = Math.floor(y0 / 32) - 1; fila * 32 < y1; fila += 1) {
      const fy = fila * 32;
      let fx = -480 + noMundo(fila, 0, 1) * 30;
      for (let n = 0; fx < x1; n += 1) {
        const larg = 30 + noMundo(fila, n, 2) * 26;
        if (fx + larg > x0) {
          ctx.fillStyle = misturar('#302d29', '#413d38', noMundo(fila, n, 3));
          ctx.fillRect(fx + 0.7, fy + 0.7, larg - 1.4, 30.6);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
          ctx.fillRect(fx + 0.7, fy + 0.7, larg - 1.4, 1);
          ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
          ctx.fillRect(fx + 0.7, fy + 30.3, larg - 1.4, 1);
        }
        fx += larg;
      }
    }
    for (let gy = Math.floor(y0 / 8); gy * 8 < y1; gy += 1) {
      for (let gx = Math.floor(x0 / 8); gx * 8 < x1; gx += 1) {
        const r = noMundo(gx, gy, 4);
        ctx.fillStyle = r < 0.66 ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(gx * 8 + noMundo(gx, gy, 5) * 7, gy * 8 + noMundo(gx, gy, 6) * 7, 1, 1);
      }
    }
  }

  /** Grama do Meio-Termo (docs/design/vila-meio-termo): #8cbf80, manchas, tufos e flor rara. */
  function pintarGrama(ctx, x0, y0, x1, y1) {
    ctx.fillStyle = '#8cbf80';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let gy = Math.floor(y0 / 48) - 1; gy * 48 < y1 + 48; gy += 1) {
      for (let gx = Math.floor(x0 / 48) - 1; gx * 48 < x1 + 48; gx += 1) {
        const x = gx * 48 + noMundo(gx, gy, 10) * 48;
        const y = gy * 48 + noMundo(gx, gy, 11) * 48;
        const r = 22 + noMundo(gx, gy, 12) * 20;
        const cor = noMundo(gx, gy, 13) < 0.5 ? '162, 204, 146' : '118, 172, 109';
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${cor}, 0.38)`);
        g.addColorStop(1, `rgba(${cor}, 0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    for (let gy = Math.floor(y0 / 6); gy * 6 < y1; gy += 1) {
      for (let gx = Math.floor(x0 / 6); gx * 6 < x1; gx += 1) {
        ctx.fillStyle = noMundo(gx, gy, 20) < 0.5 ? 'rgba(122, 176, 112, 0.55)' : 'rgba(156, 203, 141, 0.5)';
        ctx.fillRect(gx * 6 + noMundo(gx, gy, 21) * 5, gy * 6 + noMundo(gx, gy, 22) * 5, 1.2, 1.2);
      }
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 0.9;
    for (let gy = Math.floor(y0 / 24) - 1; gy * 24 < y1 + 8; gy += 1) {
      for (let gx = Math.floor(x0 / 24) - 1; gx * 24 < x1 + 8; gx += 1) {
        if (noMundo(gx, gy, 30) > 0.38) continue;
        const x = gx * 24 + noMundo(gx, gy, 31) * 24;
        const y = gy * 24 + noMundo(gx, gy, 32) * 24;
        ctx.strokeStyle = noMundo(gx, gy, 33) < 0.5 ? '#5f9a58' : '#6aa462';
        ctx.beginPath();
        for (const ang of [-2.05, -1.57, -1.1]) {
          const l = 3 + noMundo(gx, gy, 34 + ang * 10) * 2.5;
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(ang) * l, y + Math.sin(ang) * l);
        }
        ctx.stroke();
      }
    }
    for (let gy = Math.floor(y0 / 40) - 1; gy * 40 < y1; gy += 1) {
      for (let gx = Math.floor(x0 / 40) - 1; gx * 40 < x1; gx += 1) {
        if (noMundo(gx, gy, 40) > 0.14) continue;
        const x = gx * 40 + noMundo(gx, gy, 41) * 40;
        const y = gy * 40 + noMundo(gx, gy, 42) * 40;
        ctx.fillStyle = '#f4f1e6';
        for (let p = 0; p < 4; p += 1) {
          ctx.beginPath();
          ctx.arc(x + Math.cos(p * 1.571) * 1.1, y + Math.sin(p * 1.571) * 1.1, 0.95, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#e8c95a';
        ctx.beginPath();
        ctx.arc(x, y, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /** O chão da vista, pintado uma vez. Mundo com a origem no centro da ficha. */
  function pintarFundo(v) {
    const c = document.createElement('canvas');
    c.width = v.canvas.width;
    c.height = v.canvas.height;
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (v.chao === 'menu') {
      ctx.fillStyle = '#212127';
      ctx.fillRect(0, 0, v.lado, v.lado);
      return c;
    }
    const zoom = v.raio / 30;
    ctx.translate(v.cx, v.cy);
    ctx.scale(zoom, zoom);
    const x0 = -v.cx / zoom;
    const y0 = -v.cy / zoom;
    const x1 = (v.lado - v.cx) / zoom;
    const y1 = (v.lado - v.cy) / zoom;
    if (v.chao === 'escuro') pintarPedra(ctx, x0, y0, x1, y1);
    else pintarGrama(ctx, x0, y0, x1, y1);
    // a grade do mapa: casas de 64 com a ficha no meio de uma
    ctx.strokeStyle = v.chao === 'escuro' ? 'rgba(255, 255, 255, 0.07)' : 'rgba(34, 64, 26, 0.14)';
    ctx.lineWidth = 1 / zoom;
    ctx.beginPath();
    for (let gx = Math.floor((x0 - CASA / 2) / CASA) * CASA + CASA / 2; gx <= x1; gx += CASA) {
      ctx.moveTo(gx, y0);
      ctx.lineTo(gx, y1);
    }
    for (let gy = Math.floor((y0 - CASA / 2) / CASA) * CASA + CASA / 2; gy <= y1; gy += CASA) {
      ctx.moveTo(x0, gy);
      ctx.lineTo(x1, gy);
    }
    ctx.stroke();
    return c;
  }

  // ---------------------------------------------------------------- ficha de exemplo

  const FICHAS = {};

  /** Retrato genérico (busto em silhueta) dentro da moldura de latão do app (TOKEN_FRAME_COLOR, 4 px a 100%). */
  function fichaDe(R) {
    if (FICHAS[R]) return FICHAS[R];
    const lado = 2 * R + 4;
    const c = document.createElement('canvas');
    c.width = Math.ceil(lado * dpr);
    c.height = Math.ceil(lado * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, (lado / 2) * dpr, (lado / 2) * dpr);
    const moldura = (R * 4) / 30;
    const Rf = R - moldura;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, Rf, 0, Math.PI * 2);
    ctx.clip();
    const fundo = ctx.createRadialGradient(-0.28 * Rf, -0.38 * Rf, 0.05 * Rf, 0, 0, Rf * 1.15);
    fundo.addColorStop(0, '#a9b4bb');
    fundo.addColorStop(0.55, '#6f7b85');
    fundo.addColorStop(1, '#434d57');
    ctx.fillStyle = fundo;
    ctx.fillRect(-Rf, -Rf, 2 * Rf, 2 * Rf);
    ctx.fillStyle = '#2a3039';
    ctx.beginPath();
    ctx.ellipse(0, Rf * 1.02, Rf * 0.86, Rf * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-Rf * 0.13, Rf * 0.1, Rf * 0.26, Rf * 0.42);
    ctx.beginPath();
    ctx.arc(0, -Rf * 0.12, Rf * 0.34, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(196, 210, 220, 0.4)';
    ctx.lineWidth = Math.max(0.6, Rf * 0.045);
    ctx.beginPath();
    ctx.arc(0, -Rf * 0.12, Rf * 0.31, -Math.PI * 0.95, -Math.PI * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, Rf * 1.02, Rf * 0.83, Rf * 0.57, 0, -Math.PI * 0.93, -Math.PI * 0.68);
    ctx.stroke();
    ctx.restore();
    // moldura
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.arc(0, 0, Rf, 0, Math.PI * 2, true);
    ctx.fillStyle = '#e0a44a';
    ctx.fill();
    ctx.lineWidth = Math.max(0.6, R * 0.028);
    ctx.strokeStyle = '#6b4a1a';
    ctx.beginPath();
    ctx.arc(0, 0, R - ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#8f6726';
    ctx.beginPath();
    ctx.arc(0, 0, Rf + ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(250, 214, 150, 0.75)';
    ctx.lineWidth = Math.max(0.6, R * 0.035);
    ctx.beginPath();
    ctx.arc(0, 0, R - moldura / 2, -Math.PI * 0.92, -Math.PI * 0.6);
    ctx.stroke();
    FICHAS[R] = { canvas: c, lado };
    return FICHAS[R];
  }

  // ---------------------------------------------------------------- vistas

  const ATLAS = {};
  const vistas = [];
  /** As 27 dos cartões, em ordem: as 9 do chão escuro primeiro (é a medida "do tamanho do mapa"). */
  let vistasDosCartoes = [];
  const minisAnimando = new Set();

  function sementeDe(id) {
    return A.LISTA.findIndex((a) => a.id === id) * 7919 + 13;
  }

  function criarVista(canvas) {
    const tipo = canvas.dataset.aura;
    const vista = canvas.dataset.vista;
    const T = VISTAS[vista];
    canvas.style.width = T.lado + 'px';
    canvas.style.height = T.lado + 'px';
    canvas.width = Math.round(T.lado * dpr);
    canvas.height = Math.round(T.lado * dpr);
    const semente = sementeDe(tipo);
    const v = {
      canvas,
      ctx: canvas.getContext('2d'),
      tipo,
      vista,
      lado: T.lado,
      raio: T.raio,
      cx: T.lado / 2,
      cy: Math.round(T.lado * T.cy),
      semente,
      pose: A.poseDaAura(tipo, semente),
      saida: A.criarSaida(),
      atlas: ATLAS[tipo],
      ficha: fichaDe(T.raio),
      chao: vista === 'grama' ? 'grama' : vista === 'mini' ? 'menu' : 'escuro',
      fundo: null,
      desde: 0,
    };
    v.fundo = pintarFundo(v);
    vistas.push(v);
    return v;
  }

  function pintarChaoDaVista(v) {
    const ctx = v.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(v.fundo, 0, 0);
  }

  function pintarFichaDaVista(v) {
    const ctx = v.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const f = v.ficha;
    ctx.drawImage(f.canvas, v.cx - f.lado / 2, v.cy - f.lado / 2, f.lado, f.lado);
  }

  function desenharTudo(v, t) {
    pintarChaoDaVista(v);
    A.estadoDaAura(v.tipo, t, v.raio, v.semente, v.saida);
    pintarCamada(v, A.ATRAS);
    pintarFichaDaVista(v);
    pintarCamada(v, A.FRENTE);
  }

  // ---------------------------------------------------------------- relógio e medidor

  let reduzido = false;
  let pessoaMexeu = false;
  let pedido = 0;
  let inicio = 0;
  let paradoMs = 0;

  const janela = { quadros: 0, desde: 0, todas: 0, mapa: 0 };
  let gravacao = null;
  let ultimoQuadro = 0;
  const longas = [];

  function quadro(agora) {
    pedido = 0;
    if (reduzido) return;
    const tg = (agora - inicio) / 1000;
    const lista = vistasDosCartoes;
    for (let i = 0; i < lista.length; i += 1) pintarChaoDaVista(lista[i]);
    const m0 = performance.now();
    let mapaAtras = m0;
    for (let i = 0; i < lista.length; i += 1) {
      const v = lista[i];
      A.estadoDaAura(v.tipo, v.pose + tg, v.raio, v.semente, v.saida);
      pintarCamada(v, A.ATRAS);
      if (i === 8) mapaAtras = performance.now();
    }
    const m1 = performance.now();
    for (let i = 0; i < lista.length; i += 1) pintarFichaDaVista(lista[i]);
    const m2 = performance.now();
    let mapaFrente = m2;
    for (let i = 0; i < lista.length; i += 1) {
      pintarCamada(lista[i], A.FRENTE);
      if (i === 8) mapaFrente = performance.now();
    }
    const m3 = performance.now();
    // as miniaturas sob o mouse ficam fora da medida
    for (const v of minisAnimando) desenharTudo(v, v.pose + (agora - v.desde) / 1000);
    registrar(agora, m1 - m0 + (m3 - m2), mapaAtras - m0 + (mapaFrente - m2));
    pedido = requestAnimationFrame(quadro);
  }

  function registrar(agora, msTodas, msMapa) {
    if (ultimoQuadro > 0 && gravacao) {
      gravacao.intervalos.push(agora - ultimoQuadro);
      gravacao.todas.push(msTodas);
      gravacao.mapa.push(msMapa);
    }
    ultimoQuadro = agora;
    janela.quadros += 1;
    janela.todas += msTodas;
    janela.mapa += msMapa;
    if (janela.desde === 0) janela.desde = agora;
    const passou = agora - janela.desde;
    if (passou >= MEDIDOR_MS) {
      escreverMedidor((janela.quadros - 1) / (passou / 1000), janela.todas / janela.quadros, janela.mapa / janela.quadros);
      janela.quadros = 0;
      janela.todas = 0;
      janela.mapa = 0;
      janela.desde = agora;
    }
  }

  const fmt1 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt0 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

  function escreverMedidor(qps, msTodas, msMapa) {
    document.getElementById('m-linha-1').innerHTML = `<b>${fmt0.format(qps)}</b> quadros por segundo`;
    document.getElementById('m-linha-2').innerHTML = `<b>${fmt2.format(msTodas)} ms</b> por quadro, as 27 vistas`;
    document.getElementById('m-linha-3').innerHTML = `<b>${fmt2.format(msMapa)} ms</b> só as 9 do tamanho do mapa`;
  }

  function escreverMedidorParado() {
    document.getElementById('m-linha-1').innerHTML = '<b>Parado</b>, sem relógio';
    document.getElementById('m-linha-2').innerHTML = `<b>${fmt1.format(paradoMs)} ms</b> para pintar as 27 vistas uma vez`;
    document.getElementById('m-linha-3').textContent = 'Nada é redesenhado até o movimento voltar.';
  }

  function desenharParado() {
    const m0 = performance.now();
    for (const v of vistasDosCartoes) desenharTudo(v, v.pose);
    paradoMs = performance.now() - m0;
    for (const v of vistas) if (v.vista === 'mini') desenharTudo(v, v.pose);
    escreverMedidorParado();
  }

  function ligarRelogio() {
    if (pedido) return;
    inicio = performance.now();
    ultimoQuadro = 0;
    janela.quadros = 0;
    janela.desde = 0;
    janela.todas = 0;
    janela.mapa = 0;
    pedido = requestAnimationFrame(quadro);
  }

  function definirMovimento(valor) {
    reduzido = valor;
    const botao = document.getElementById('movimento');
    botao.setAttribute('aria-pressed', String(valor));
    if (valor) {
      if (pedido) cancelAnimationFrame(pedido);
      pedido = 0;
      minisAnimando.clear();
      desenharParado();
    } else {
      ligarRelogio();
    }
  }

  // ---------------------------------------------------------------- montagem

  function montarCartoes() {
    const lugar = document.getElementById('cartoes');
    const menu = document.getElementById('menu-grade');
    for (const aura of A.LISTA) {
      const art = document.createElement('article');
      art.className = 'cartao';
      art.id = 'aura-' + aura.id;
      art.tabIndex = -1;
      art.setAttribute('aria-labelledby', 'nome-' + aura.id);
      art.innerHTML = `
        <div class="cartao-cabeca">
          <h2 id="nome-${aura.id}">${aura.nome}</h2>
          <p class="frase">${aura.frase}</p>
        </div>
        <figure class="vista vista-grande">
          <canvas data-aura="${aura.id}" data-vista="grande" role="img" aria-label="${aura.nome}, ampliada duas vezes, no chão escuro"></canvas>
          <figcaption>Ampliada 2x, <span data-chao-grande>chão escuro</span></figcaption>
        </figure>
        <div class="vistas-mapa">
          <figure class="vista">
            <canvas data-aura="${aura.id}" data-vista="escuro" role="img" aria-label="${aura.nome}, no tamanho do mapa, no chão escuro"></canvas>
            <figcaption>Tamanho do mapa, chão escuro</figcaption>
          </figure>
          <figure class="vista">
            <canvas data-aura="${aura.id}" data-vista="grama" role="img" aria-label="${aura.nome}, no tamanho do mapa, na grama"></canvas>
            <figcaption>Tamanho do mapa, grama</figcaption>
          </figure>
        </div>
        <p class="conta" data-conta="${aura.id}"></p>`;
      lugar.appendChild(art);

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu-item';
      item.dataset.ir = aura.id;
      item.innerHTML = `<canvas data-aura="${aura.id}" data-vista="mini" aria-hidden="true"></canvas><span>${aura.nome}</span>`;
      menu.appendChild(item);
    }
  }

  /** Um temporizador por cartão: o segundo clique recomeça a marca inteira, sem o primeiro apagá-la antes. */
  const apagarMarca = new Map();

  /** O clique no menu leva ao cartão e acende a borda dele por um instante. */
  function irParaAura(id) {
    const cartao = document.getElementById('aura-' + id);
    if (!cartao) return;
    cartao.scrollIntoView({ behavior: reduzido ? 'auto' : 'smooth', block: 'center' });
    cartao.focus({ preventScroll: true });
    window.clearTimeout(apagarMarca.get(cartao));
    cartao.classList.remove('marcado');
    void cartao.offsetWidth;
    cartao.classList.add('marcado');
    apagarMarca.set(cartao, window.setTimeout(() => cartao.classList.remove('marcado'), MARCA_MS));
  }

  function ligarMenu() {
    for (const item of document.querySelectorAll('.menu-item')) {
      const v = vistas.find((x) => x.vista === 'mini' && x.tipo === item.dataset.ir);
      const anima = () => {
        if (reduzido || minisAnimando.has(v)) return;
        v.desde = performance.now();
        minisAnimando.add(v);
      };
      const para = () => {
        if (!minisAnimando.has(v)) return;
        minisAnimando.delete(v);
        desenharTudo(v, v.pose);
      };
      // só o mouse paira; no toque, o toque já é o clique que leva ao cartão
      item.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') anima();
      });
      item.addEventListener('pointerleave', para);
      item.addEventListener('focus', anima);
      item.addEventListener('blur', para);
      item.addEventListener('click', () => irParaAura(item.dataset.ir));
    }
  }

  function ligarChaoDaAmpliacao() {
    for (const radio of document.querySelectorAll('input[name="chao-grande"]')) {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        const chao = radio.value;
        const nome = chao === 'grama' ? 'grama' : 'chão escuro';
        for (const v of vistas) {
          if (v.vista !== 'grande') continue;
          v.chao = chao;
          v.fundo = pintarFundo(v);
          const aura = A.POR_ID[v.tipo];
          v.canvas.setAttribute('aria-label', `${aura.nome}, ampliada duas vezes, ${chao === 'grama' ? 'na grama' : 'no chão escuro'}`);
          if (reduzido) desenharTudo(v, v.pose);
        }
        for (const s of document.querySelectorAll('[data-chao-grande]')) s.textContent = nome;
      });
    }
  }

  function ligarMovimento() {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
    document.getElementById('movimento').addEventListener('click', () => {
      pessoaMexeu = true;
      definirMovimento(!reduzido);
    });
    consulta.addEventListener('change', (e) => {
      if (!pessoaMexeu) definirMovimento(e.matches);
    });
    return consulta.matches;
  }

  function pausa() {
    return new Promise((ok) => window.setTimeout(ok, 0));
  }

  async function iniciar() {
    if ('PerformanceObserver' in window) {
      try {
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) longas.push(Math.round(e.duration));
        }).observe({ type: 'longtask', buffered: true });
      } catch (_) {
        /* navegador sem longtask: o medidor segue sem essa conta */
      }
    }
    montarCartoes();
    const comecaParado = ligarMovimento();
    // uma aura por vez, para a abertura não travar a página
    for (const aura of A.LISTA) {
      ATLAS[aura.id] = assarAtlas(aura);
      for (const c of document.querySelectorAll(`canvas[data-aura="${aura.id}"]`)) {
        const v = criarVista(c);
        desenharTudo(v, v.pose);
      }
      const conta = document.querySelector(`[data-conta="${aura.id}"]`);
      const maximo = A.maximoDeParticulas(aura.id, sementeDe(aura.id));
      conta.textContent = `Até ${maximo} partículas e 1 brilho por quadro.`;
      await pausa();
    }
    const ordem = { escuro: 0, grama: 1, grande: 2 };
    vistasDosCartoes = vistas.filter((v) => v.vista !== 'mini').sort((a, b) => ordem[a.vista] - ordem[b.vista]);
    ligarMenu();
    ligarChaoDaAmpliacao();
    definirMovimento(comecaParado);
    window.__auras.pronto = true;
  }

  function p95(lista) {
    if (!lista.length) return 0;
    const o = lista.slice().sort((a, b) => a - b);
    return o[Math.min(o.length - 1, Math.floor(o.length * 0.95))];
  }
  function media(lista) {
    return lista.length ? lista.reduce((a, b) => a + b, 0) / lista.length : 0;
  }

  /** Ganchos para conferir de fora (o roteiro de medida chama). */
  window.__auras = {
    pronto: false,
    dpr,
    medir(segundos) {
      return new Promise((ok) => {
        longas.length = 0;
        gravacao = { intervalos: [], todas: [], mapa: [] };
        window.setTimeout(() => {
          const g = gravacao;
          gravacao = null;
          ok({
            quadros: g.intervalos.length,
            qps: g.intervalos.length ? 1000 / media(g.intervalos) : 0,
            intervaloP95Ms: p95(g.intervalos),
            msTodasMedia: media(g.todas),
            msTodasP95: p95(g.todas),
            msMapaMedia: media(g.mapa),
            msMapaP95: p95(g.mapa),
            tarefasLongas: longas.slice(),
            vistas: vistasDosCartoes.length,
            dpr,
          });
        }, segundos * 1000);
      });
    },
    movimentoReduzido(valor) {
      pessoaMexeu = true;
      definirMovimento(!!valor);
    },
    poses() {
      const o = {};
      for (const a of A.LISTA) o[a.id] = A.poseDaAura(a.id, sementeDe(a.id));
      return o;
    },
  };

  iniciar();
})();
