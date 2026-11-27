/*
 * PINTURA (quadro de parede): desenho por código, determinístico (mesma entrada, mesma
 * imagem). Folha de aprovação de 27/11/2026 em docs/design/pintura-objeto/. NADA daqui
 * está no app: é a proposta para o dono aprovar antes do encaixe.
 *
 * Convenção do app para objeto de parede (tapeçaria, arandela, quadro de chaves): EM PÉ,
 * desenhado DE FRENTE, com a PAREDE na beira de cima da pegada; a 3/4 usa o mesmo desenho
 * (perfil 'em-pe' em client/src/texturas/meioTermo/moveis/tresQuartos.ts). O giro deita a
 * imagem. Aqui o prego fica na parede e o cordão em V desce até as duas argolas da moldura.
 *
 * Três estilos, os do mapa (client/src/lib/estiloDoMapa.ts):
 * - 'atual': o Meio-Termo (volume com luz de cima e da esquerda, contorno no tom escuro da
 *   própria cor, grão leve, pintura com pincelada);
 * - 'desenhado': formas chapadas e calmas, contorno grosso no tom escuro da própria cor;
 * - 'simples': a silhueta translúcida com o fio claro e o glifo (drawPropSilhouettes.ts).
 *
 * Usado pela folha (fonte/folha.js) e pela página (index.html, a prova do recorte).
 */
(function (raiz) {
  'use strict';

  // ---------------------------------------------------------------- medidas e catálogo

  /** px por casa a 100% de zoom (client/src/texturas/meioTermo/moveis/contexto.ts). */
  const G = 56;
  /** A faixa do prego e do cordão, em casas, entre a parede e o topo da moldura. */
  const CORDAO = 0.12;

  const TAMANHOS = {
    P: { nome: 'Pequeno', moldura: [0.46, 0.56], pegada: [0.5, 0.72], k: 0.8 },
    M: { nome: 'Médio', moldura: [0.92, 0.66], pegada: [1, 0.82], k: 1 },
    G: { nome: 'Grande (retrato de corpo)', moldura: [0.8, 1.5], pegada: [1, 1.66], k: 1.15 },
  };
  const ORDEM_DOS_TAMANHOS = ['P', 'M', 'G'];

  /** Largura do perfil em casas (no Médio) e a cor base de cada estilo (paleta do Meio-Termo). */
  const MOLDURAS = {
    madeira: { nome: 'Madeira escura', largura: 0.055, atual: '#5f4532', desenhado: '#775739', perfil: 0.035 },
    dourada: { nome: 'Dourada trabalhada', largura: 0.085, atual: '#9f8650', desenhado: '#b89552', perfil: 0.055 },
    ferro: { nome: 'Ferro', largura: 0.05, atual: '#4c4e51', desenhado: '#5d6164', perfil: 0.024 },
  };
  const ORDEM_DAS_MOLDURAS = ['madeira', 'dourada', 'ferro'];

  const PINTURAS = [
    { n: 1, nome: 'Paisagem' },
    { n: 2, nome: 'Retrato de nobre' },
    { n: 3, nome: 'Natureza-morta' },
    { n: 4, nome: 'Mar com navio' },
    { n: 5, nome: 'Castelo' },
    { n: 6, nome: 'Abstrato escuro' },
  ];

  /** Número da combinação: 1-18 Pequeno, 19-36 Médio, 37-54 Grande; linha = moldura, coluna = pintura. */
  function numeroDaCombinacao(tamanho, moldura, pintura) {
    return ORDEM_DOS_TAMANHOS.indexOf(tamanho) * 18 + ORDEM_DAS_MOLDURAS.indexOf(moldura) * 6 + pintura;
  }

  /** O Simples (drawPropSilhouettes.ts): preto a 0,35 e o fio claro da parede a 0,5, 1 px de tela. */
  const FUNDO_SIMPLES = 'rgba(0,0,0,0.35)';
  const LINHA_SIMPLES = 'rgba(216,210,196,0.5)';
  const CHAO_SIMPLES = '#2b2b2b';
  /** A sombra marrom do Meio-Termo (52/36/24). */
  const SOMBRA = '#342418';

  // ---------------------------------------------------------------- cor e acaso

  function rgbDe(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function hexDe(c) {
    return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  /** Multiplica os canais: abaixo de 1 escurece, acima clareia sem perder o matiz. */
  function tom(hex, f) {
    return hexDe(rgbDe(hex).map((v) => v * f));
  }
  function misturar(a, b, t) {
    const x = rgbDe(a);
    const y = rgbDe(b);
    return hexDe(x.map((v, i) => v + (y[i] - v) * t));
  }
  function rgba(hex, a) {
    const c = rgbDe(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }
  /** Acaso com semente (mulberry32): a mesma semente dá sempre a mesma sequência. */
  function acaso(semente) {
    let a = semente >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function tela(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ---------------------------------------------------------------- caminhos

  function poli(pts) {
    const p = new Path2D();
    pts.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
    p.closePath();
    return p;
  }
  function linha(pts) {
    const p = new Path2D();
    pts.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
    return p;
  }
  function ret(x0, y0, x1, y1) {
    const p = new Path2D();
    p.rect(x0, y0, x1 - x0, y1 - y0);
    return p;
  }
  function elip(cx, cy, rx, ry, rot) {
    const p = new Path2D();
    p.ellipse(cx, cy, Math.abs(rx), Math.abs(ry === undefined ? rx : ry), rot || 0, 0, Math.PI * 2);
    return p;
  }
  /** Vários círculos ou elipses num caminho só (a união, pela regra nonzero). */
  function bolhas(lista) {
    const p = new Path2D();
    for (const [cx, cy, rx, ry, rot] of lista) {
      const a = rot || 0;
      p.moveTo(cx + Math.abs(rx) * Math.cos(a), cy + Math.abs(rx) * Math.sin(a));
      p.ellipse(cx, cy, Math.abs(rx), Math.abs(ry === undefined ? rx : ry), a, 0, Math.PI * 2);
    }
    return p;
  }
  /** Contorno fechado e suave que passa perto dos pontos (curvas pelos pontos médios). */
  function suave(pts) {
    const p = new Path2D();
    const n = pts.length;
    const meio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = meio(pts[n - 1], pts[0]);
    p.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const m = meio(a, pts[(i + 1) % n]);
      p.quadraticCurveTo(a[0], a[1], m[0], m[1]);
    }
    p.closePath();
    return p;
  }
  /** Beira de cima ondulada (pontos da esquerda para a direita, 3 ou mais) fechada pelo fundo. */
  function morro(pts, yFundo) {
    const p = new Path2D();
    const n = pts.length;
    p.moveTo(pts[0][0], yFundo);
    p.lineTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const fim = i === n - 2 ? b : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      p.quadraticCurveTo(a[0], a[1], fim[0], fim[1]);
    }
    p.lineTo(pts[n - 1][0], yFundo);
    p.closePath();
    return p;
  }
  function curvaAberta(pts) {
    const p = new Path2D();
    const n = pts.length;
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const fim = i === n - 2 ? b : [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      p.quadraticCurveTo(a[0], a[1], fim[0], fim[1]);
    }
    if (n === 2) p.lineTo(pts[1][0], pts[1][1]);
    return p;
  }

  // ---------------------------------------------------------------- texturas leves

  /** Grão: ruído suave em soft-light. `t` = tamanho do grão em px (grande vira mancha larga). */
  function grao(g, x, y, w, h, semente, forca, t) {
    const nw = Math.max(2, Math.ceil(w / t) + 1);
    const nh = Math.max(2, Math.ceil(h / t) + 1);
    const c = tela(nw, nh);
    const cg = c.getContext('2d');
    const img = cg.createImageData(nw, nh);
    const r = acaso(semente);
    for (let i = 0; i < nw * nh; i++) {
      const v = 128 + (r() - 0.5) * 210;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = forca;
    g.imageSmoothingEnabled = true;
    g.drawImage(c, x, y, nw * t, nh * t);
    g.restore();
  }

  /** Pinceladas curtas na cor do lugar, para a pintura do Atual parecer pintada (sem fileira: posições sorteadas). */
  function pinceladas(g, w, h, s, semente, angulo, densidade) {
    const W = g.canvas.width;
    const H = g.canvas.height;
    const dados = g.getImageData(0, 0, W, H).data;
    const r = acaso(semente);
    const lw = Math.max(1.1, s * 0.017);
    const comp = Math.max(3, s * 0.05);
    const n = Math.round(((w * h) / (lw * comp)) * (densidade || 0.55));
    g.save();
    g.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const x = r() * w;
      const y = r() * h;
      const o = (Math.min(H - 1, y | 0) * W + Math.min(W - 1, x | 0)) * 4;
      const f = 0.93 + r() * 0.13;
      const a = angulo + (r() - 0.5) * 0.8;
      const L = comp * (0.55 + r() * 0.9);
      const dx = (Math.cos(a) * L) / 2;
      const dy = (Math.sin(a) * L) / 2;
      g.strokeStyle = 'rgba(' + Math.min(255, dados[o] * f) + ',' + Math.min(255, dados[o + 1] * f) + ',' + Math.min(255, dados[o + 2] * f) + ',0.42)';
      g.lineWidth = lw * (0.7 + r() * 0.6);
      g.beginPath();
      g.moveTo(x - dx, y - dy);
      g.lineTo(x + dx, y + dy);
      g.stroke();
    }
    g.restore();
  }

  /** Verniz: a pintura escurece de leve nas beiras e esquenta um pouco (tela velha). */
  function verniz(g, w, h) {
    const gr = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.78);
    gr.addColorStop(0, 'rgba(40,28,14,0)');
    gr.addColorStop(1, 'rgba(40,28,14,0.34)');
    g.save();
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = 'rgba(236,222,190,0.5)';
    g.fillRect(0, 0, w, h);
    g.restore();
  }

  // ---------------------------------------------------------------- as 6 pinturas (camadas)
  //
  // Cada pintura é uma lista de camadas desenhada no tamanho da janela da moldura: ela se
  // arruma sozinha no formato (deitada, em pé ou de corpo inteiro). Camada:
  //   d: Path2D, cor | grad [y0, y1, c0, c1], alfa, macio (px de desfoque no Atual),
  //   linha (px: só traço), clip (Path2D: plano de luz ou sombra dentro de outra forma),
  //   contorno:false (sem contorno no Desenhado), so:'atual'|'desenhado'.

  function camadasPaisagem(w, h) {
    const L = [];
    const m = Math.min(w, h);
    const e = Math.max(3, m * 0.03);
    const alto = h / w > 1.35;
    const hy = h * (alto ? 0.5 : 0.47);
    L.push({ d: ret(-e, -e, w + e, hy + 2), grad: [0, hy, '#a3b6bf', '#dcd2b6'], contorno: false });
    L.push({ d: elip(w * 0.66, hy * 0.82, m * 0.26, m * 0.15), cor: '#e8dec2', alfa: 0.6, macio: m * 0.09, so: 'atual' });
    const nuvem = (cx, cy, k) => bolhas([[cx - k, cy + k * 0.12, k * 0.55, k * 0.3], [cx - k * 0.3, cy - k * 0.1, k * 0.7, k * 0.42], [cx + k * 0.45, cy + k * 0.02, k * 0.6, k * 0.34], [cx + k * 1.02, cy + k * 0.16, k * 0.4, k * 0.24]]);
    L.push({ d: nuvem(w * 0.28, hy * (alto ? 0.3 : 0.36), m * 0.12), cor: '#ece7d9', macio: m * 0.025 });
    if (alto) L.push({ d: nuvem(w * 0.72, hy * 0.62, m * 0.08), cor: '#e6e0d0', macio: m * 0.02 });
    const mm = m * 0.55;
    L.push({
      d: poli([[-e, hy + 2], [-e, hy - mm * 0.14], [w * 0.1, hy - mm * 0.22], [w * 0.2, hy - mm * 0.1], [w * 0.36, hy - mm * 0.3], [w * 0.5, hy - mm * 0.12], [w * 0.63, hy - mm * 0.24], [w * 0.78, hy - mm * 0.08], [w * 0.9, hy - mm * 0.17], [w + e, hy - mm * 0.1], [w + e, hy + 2]]),
      grad: [hy - mm * 0.3, hy, '#8a98a3', '#a2acaf'],
      macio: m * 0.008,
    });
    L.push({ d: morro([[-e, hy + h * 0.03], [w * 0.25, hy - h * 0.02], [w * 0.55, hy + h * 0.045], [w * 0.82, hy + h * 0.0], [w + e, hy + h * 0.03]], h + e), grad: [hy, h, '#8aa074', '#71875e'] });
    // Casinha na colina.
    const k = m * 0.05;
    const cx = w * 0.2;
    const cy = hy + h * 0.012;
    L.push({ d: ret(cx - k * 0.7, cy - k * 0.55, cx + k * 0.7, cy + k * 0.35), cor: '#d6cab0' });
    L.push({ d: poli([[cx - k * 0.95, cy - k * 0.5], [cx, cy - k * 1.25], [cx + k * 0.95, cy - k * 0.5]]), cor: '#a26a52' });
    const yf = hy + (h - hy) * 0.38;
    L.push({ d: morro([[-e, yf + h * 0.02], [w * 0.35, yf - h * 0.012], [w * 0.7, yf + h * 0.03], [w + e, yf]], h + e), grad: [yf, h, '#a4a46c', '#888c57'] });
    // O caminho que serpenteia até a colina.
    L.push({
      d: suave([[w * 0.3, h + e], [w * 0.4, h * 0.9], [w * 0.5, yf + (h - yf) * 0.35], [w * 0.62, hy + (h - hy) * 0.1], [w * 0.6, hy + (h - hy) * 0.1], [w * 0.47, yf + (h - yf) * 0.3], [w * 0.36, h * 0.9], [w * 0.5, h + e]]),
      grad: [hy, h, '#c9ad80', '#d3b98d'],
    });
    // A árvore da direita: tronco e copa de três lobos, com o lado da sombra.
    const tx = w * (alto ? 0.72 : 0.78);
    const tb = yf + (h - yf) * 0.3;
    const th = m * (alto ? 0.36 : 0.32);
    L.push({ d: poli([[tx - th * 0.05, tb], [tx - th * 0.025, tb - th * 0.58], [tx + th * 0.025, tb - th * 0.58], [tx + th * 0.05, tb]]), cor: '#5e4a37' });
    const copa = bolhas([[tx - th * 0.19, tb - th * 0.64, th * 0.24, th * 0.2], [tx + th * 0.17, tb - th * 0.67, th * 0.25, th * 0.21], [tx, tb - th * 0.87, th * 0.26, th * 0.23]]);
    L.push({ d: copa, cor: '#5d7c50' });
    L.push({ d: elip(tx + th * 0.2, tb - th * 0.58, th * 0.3, th * 0.16), cor: '#4c6943', clip: copa });
    L.push({ d: elip(tx - th * 0.12, tb - th * 0.95, th * 0.13, th * 0.08), cor: '#77955f', clip: copa, so: 'atual', macio: th * 0.04 });
    return L;
  }

  function camadasRetrato(w, h) {
    const L = [];
    const e = Math.max(3, Math.min(w, h) * 0.03);
    const alto = h / w > 1.35;
    const cx = w * 0.53;
    const U = alto ? Math.min(w * 0.11, h * 0.052) : Math.min(w * 0.13, h * 0.15);
    const cy = alto ? h * 0.17 : h * 0.37;
    L.push({ d: ret(-e, -e, w + e, h + e), grad: [0, h, '#4b4636', '#2c2920'], contorno: false });
    L.push({ d: elip(cx, cy + U * 0.8, U * 3.6, U * 3.1), cor: '#5d5641', alfa: 0.6, macio: U * 1.2, so: 'atual' });
    // A cortina vinho do canto de cima.
    const cortina = new Path2D();
    cortina.moveTo(-e, -e);
    cortina.lineTo(w * 0.34, -e);
    cortina.quadraticCurveTo(w * 0.2, h * 0.18, w * 0.13, h * 0.36);
    cortina.quadraticCurveTo(w * 0.08, h * 0.52, w * 0.1, h * 0.64);
    cortina.lineTo(-e, h * 0.68);
    cortina.closePath();
    L.push({ d: cortina, grad: [0, h * 0.68, '#743a3c', '#4c2528'] });
    L.push({ d: curvaAberta([[w * 0.2, -e], [w * 0.1, h * 0.25], [w * 0.05, h * 0.6]]), cor: '#3e1d20', linha: Math.max(0.8, U * 0.12), clip: cortina, macio: U * 0.1 });
    const pescoY = cy + U * 0.95;
    const ombroY = cy + U * 1.9;
    if (alto) {
      // De corpo inteiro: o chão, a capa, as pernas, os sapatos, o casaco até o joelho e a espada.
      const piso = h * 0.9;
      L.push({ d: ret(-e, piso, w + e, h + e), grad: [piso, h, '#3d372b', '#2b271f'], contorno: false });
      L.push({ d: poli([[cx - U * 2.4, ombroY], [cx + U * 2.4, ombroY], [cx + U * 3.6, piso - U * 0.3], [cx - U * 3.6, piso - U * 0.3]]), grad: [ombroY, piso, '#5c2b2f', '#47211f'] });
      const joelho = h * 0.66;
      L.push({ d: ret(cx - U * 1.15, h * 0.52, cx + U * 1.15, h * 0.69), cor: '#393c45' });
      for (const lado of [-1, 1]) {
        const x0 = lado < 0 ? cx - U * 1.05 : cx + U * 0.22;
        L.push({ d: ret(x0, joelho, x0 + U * 0.83, piso - U * 0.25), cor: '#cbc1ab' });
        L.push({ d: elip(x0 + U * 0.42 + lado * U * 0.15, piso - U * 0.2, U * 0.62, U * 0.24), cor: '#2c241f' });
      }
      L.push({ d: poli([[cx - U * 0.7, pescoY], [cx - U * 2.6, ombroY + U * 0.3], [cx - U * 2.9, joelho - U * 0.2], [cx + U * 2.9, joelho - U * 0.2], [cx + U * 2.6, ombroY + U * 0.3], [cx + U * 0.7, pescoY]]), grad: [ombroY, joelho, '#323849', '#272b38'] });
      L.push({ d: ret(cx - U * 0.42, pescoY + U * 1.2, cx + U * 0.42, h * 0.53), cor: '#7a5b3e' });
      L.push({ d: ret(cx - U * 2.75, h * 0.49, cx + U * 2.75, h * 0.515), cor: '#4a3a2a' });
      L.push({ d: linha([[cx + U * 2.15, h * 0.5], [cx + U * 3.25, h * 0.82]]), cor: '#8e9196', linha: Math.max(0.8, U * 0.22) });
      L.push({ d: linha([[cx + U * 1.75, h * 0.505], [cx + U * 2.55, h * 0.485]]), cor: '#b89552', linha: Math.max(0.8, U * 0.2) });
      L.push({ d: elip(cx - U * 2.65, h * 0.47, U * 0.34, U * 0.42), cor: '#c99f82' });
      L.push({ d: elip(cx + U * 2.1, h * 0.5, U * 0.36, U * 0.32), cor: '#c99f82' });
    } else {
      L.push({ d: poli([[cx - U * 0.7, pescoY], [cx - U * 3.0, ombroY + U * 0.4], [cx - U * 3.7, h + e], [cx + U * 3.7, h + e], [cx + U * 3.0, ombroY + U * 0.4], [cx + U * 0.7, pescoY]]), grad: [ombroY, h, '#333a4b', '#262a36'] });
      L.push({ d: elip(cx - U * 2.0, ombroY + U * 0.7, U * 1.0, U * 0.5), cor: '#465066', alfa: 0.6, macio: U * 0.4, so: 'atual' });
    }
    // Pescoço, gola de renda, corrente de ouro, rosto, cabelo e traços.
    L.push({ d: ret(cx - U * 0.34, cy + U * 0.55, cx + U * 0.34, pescoY + U * 0.35), cor: '#c49a7c' });
    L.push({ d: poli([[cx - U * 0.88, pescoY + U * 0.05], [cx + U * 0.88, pescoY + U * 0.05], [cx + U * 0.46, pescoY + U * 1.5], [cx, pescoY + U * 1.9], [cx - U * 0.46, pescoY + U * 1.5]]), cor: '#ddd5c1' });
    const corrente = new Path2D();
    corrente.moveTo(cx - U * 1.9, ombroY + U * 0.15);
    corrente.quadraticCurveTo(cx, ombroY + U * 2.3, cx + U * 1.9, ombroY + U * 0.15);
    L.push({ d: corrente, cor: '#b89552', linha: Math.max(0.8, U * 0.13) });
    L.push({ d: elip(cx, ombroY + U * 1.3, U * 0.24, U * 0.24), cor: '#c4a35e' });
    const rosto = elip(cx, cy, U * 0.74, U * 0.95);
    L.push({ d: rosto, cor: '#d3ac8d' });
    L.push({ d: elip(cx + U * 0.55, cy + U * 0.1, U * 0.5, U * 1.1), cor: '#bc9374', clip: rosto, macio: U * 0.15 });
    const cabelo = new Path2D();
    cabelo.moveTo(cx - U * 0.86, cy + U * 0.62);
    cabelo.quadraticCurveTo(cx - U * 1.0, cy - U * 1.2, cx, cy - U * 1.1);
    cabelo.quadraticCurveTo(cx + U * 1.0, cy - U * 1.2, cx + U * 0.86, cy + U * 0.62);
    cabelo.lineTo(cx + U * 0.62, cy + U * 0.5);
    cabelo.quadraticCurveTo(cx + U * 0.7, cy - U * 0.58, cx, cy - U * 0.64);
    cabelo.quadraticCurveTo(cx - U * 0.7, cy - U * 0.58, cx - U * 0.62, cy + U * 0.5);
    cabelo.closePath();
    L.push({ d: cabelo, cor: '#4a3628' });
    L.push({ d: bolhas([[cx - U * 0.28, cy - U * 0.06, U * 0.09, U * 0.06], [cx + U * 0.28, cy - U * 0.06, U * 0.09, U * 0.06]]), cor: '#3a2a20', contorno: false });
    L.push({ d: linha([[cx + U * 0.03, cy + U * 0.02], [cx + U * 0.09, cy + U * 0.3], [cx - U * 0.04, cy + U * 0.33]]), cor: '#a2775c', linha: Math.max(0.6, U * 0.06) });
    L.push({ d: linha([[cx - U * 0.2, cy + U * 0.52], [cx + U * 0.2, cy + U * 0.52]]), cor: '#93635a', linha: Math.max(0.6, U * 0.07) });
    return L;
  }

  function camadasNaturezaMorta(w, h) {
    const L = [];
    const e = Math.max(3, Math.min(w, h) * 0.03);
    const alto = h / w > 1.35;
    const tY = h * (alto ? 0.62 : 0.6);
    const K = Math.min(w * 0.2, tY * 0.5);
    L.push({ d: ret(-e, -e, w + e, h + e), grad: [0, h, '#4b4233', '#2d2821'], contorno: false });
    L.push({ d: elip(w * 0.25, h * 0.2, w * 0.5, h * 0.35), cor: '#62583f', alfa: 0.55, macio: Math.min(w, h) * 0.2, so: 'atual' });
    if (alto) {
      // No formato alto, uma prateleira na parede do fundo com garrafa e caneca (o alto não fica vazio).
      const yS = h * 0.32;
      L.push({ d: ret(-e, yS + h * 0.016, w + e, yS + h * 0.05), cor: '#241f19', alfa: 0.5, macio: h * 0.012, so: 'atual' });
      L.push({ d: ret(-e, yS, w + e, yS + h * 0.018), cor: '#5e4631' });
      const bx = w * 0.66;
      const bh = K * 1.4;
      const bw = K * 0.44;
      const garrafa = new Path2D();
      garrafa.moveTo(bx - bw / 2, yS);
      garrafa.lineTo(bx - bw / 2, yS - bh * 0.58);
      garrafa.quadraticCurveTo(bx - bw / 2, yS - bh * 0.76, bx - bw * 0.16, yS - bh * 0.8);
      garrafa.lineTo(bx - bw * 0.16, yS - bh);
      garrafa.lineTo(bx + bw * 0.16, yS - bh);
      garrafa.lineTo(bx + bw * 0.16, yS - bh * 0.8);
      garrafa.quadraticCurveTo(bx + bw / 2, yS - bh * 0.76, bx + bw / 2, yS - bh * 0.58);
      garrafa.lineTo(bx + bw / 2, yS);
      garrafa.closePath();
      L.push({ d: garrafa, cor: '#4f6b55' });
      L.push({ d: ret(bx + bw * 0.12, yS - bh, bx + bw, yS), cor: '#3c5442', clip: garrafa });
      L.push({ d: ret(bx - bw * 0.36, yS - bh * 0.62, bx - bw * 0.22, yS - bh * 0.12), cor: '#86a08a', clip: garrafa, alfa: 0.8, so: 'atual' });
      const cx = w * 0.32;
      L.push({ d: ret(cx - K * 0.24, yS - K * 0.42, cx + K * 0.24, yS), cor: '#b6ad9b' });
      L.push({ d: ret(cx + K * 0.06, yS - K * 0.42, cx + K * 0.24, yS), cor: '#9a917f', clip: ret(cx - K * 0.24, yS - K * 0.42, cx + K * 0.24, yS) });
    }
    L.push({ d: ret(-e, tY, w + e, tY + h * 0.09), grad: [tY, tY + h * 0.09, '#7f6042', '#6a4e35'] });
    L.push({ d: ret(-e, tY + h * 0.09, w + e, h + e), grad: [tY, h, '#4f3a28', '#3b2c1f'] });
    // A toalha de linho caindo pela beira da mesa: a queda é do tamanho dos objetos, não da pintura.
    const yBeira = tY + h * 0.09;
    const yQueda = Math.min(h * 0.97, yBeira + K * 0.95);
    const toalha = poli([[w * 0.04, tY + h * 0.015], [w * 0.52, tY + h * 0.01], [w * 0.47, yBeira], [w * 0.4, yQueda], [w * 0.2, yQueda - K * 0.12], [w * 0.11, yBeira]]);
    L.push({ d: toalha, grad: [tY, yQueda, '#d6c9a8', '#bcae8c'] });
    L.push({ d: poli([[w * 0.11, yBeira], [w * 0.47, yBeira], [w * 0.4, yQueda], [w * 0.2, yQueda - K * 0.12]]), cor: '#b3a582', clip: toalha, alfa: 0.7 });
    if (alto) {
      // No formato alto, um castiçal com vela no fundo da mesa.
      L.push({ d: elip(w * 0.14, tY - K * 1.5, K * 0.5, K * 0.5), cor: '#f2dc96', alfa: 0.5, macio: K * 0.3, so: 'atual' });
      L.push({ d: ret(w * 0.14 - K * 0.07, tY - K * 1.35, w * 0.14 + K * 0.07, tY - K * 0.4), cor: '#e3dbc6' });
      L.push({ d: poli([[w * 0.14 - K * 0.28, tY + h * 0.02], [w * 0.14 + K * 0.28, tY + h * 0.02], [w * 0.14 + K * 0.08, tY - K * 0.4], [w * 0.14 - K * 0.08, tY - K * 0.4]]), cor: '#a68848' });
      L.push({ d: elip(w * 0.14, tY - K * 1.45, K * 0.05, K * 0.1), cor: '#f0d07a' });
    }
    // A jarra de barro com alça.
    const jx = w * 0.3;
    const jb = tY + h * 0.035;
    const jarra = new Path2D();
    jarra.moveTo(jx - K * 0.5, jb);
    jarra.quadraticCurveTo(jx - K * 0.85, jb - K * 0.6, jx - K * 0.3, jb - K * 1.25);
    jarra.lineTo(jx - K * 0.34, jb - K * 1.5);
    jarra.lineTo(jx + K * 0.32, jb - K * 1.5);
    jarra.lineTo(jx + K * 0.28, jb - K * 1.25);
    jarra.quadraticCurveTo(jx + K * 0.85, jb - K * 0.6, jx + K * 0.5, jb);
    jarra.closePath();
    const alca = new Path2D();
    alca.moveTo(jx + K * 0.3, jb - K * 1.3);
    alca.quadraticCurveTo(jx + K * 0.95, jb - K * 1.3, jx + K * 0.6, jb - K * 0.55);
    L.push({ d: alca, cor: '#74493a', linha: Math.max(0.8, K * 0.12) });
    L.push({ d: jarra, cor: '#8a5a46' });
    L.push({ d: elip(jx + K * 0.42, jb - K * 0.6, K * 0.38, K * 0.9), cor: '#6f4637', clip: jarra, macio: K * 0.12 });
    L.push({ d: elip(jx - K * 0.32, jb - K * 0.72, K * 0.11, K * 0.28), cor: '#b07e63', clip: jarra, macio: K * 0.06, so: 'atual' });
    // A tigela com três frutas.
    const bx = w * 0.64;
    const bb = tY + h * 0.045;
    L.push({ d: elip(bx + K * 0.22, bb - K * 0.82, K * 0.24, K * 0.31), cor: '#b4a253' });
    L.push({ d: elip(bx - K * 0.3, bb - K * 0.66, K * 0.28, K * 0.26), cor: '#8f4a49' });
    L.push({ d: elip(bx + K * 0.0, bb - K * 0.8, K * 0.25, K * 0.25), cor: '#c48a45' });
    L.push({ d: elip(bx + K * 0.05, bb - K * 1.08, K * 0.12, K * 0.05, -0.5), cor: '#5d7c50' });
    const tigela = new Path2D();
    tigela.moveTo(bx - K * 0.78, bb - K * 0.48);
    tigela.ellipse(bx, bb - K * 0.48, K * 0.78, K * 0.46, 0, Math.PI, 0, true);
    tigela.closePath();
    L.push({ d: tigela, cor: '#9aa09c' });
    L.push({ d: elip(bx + K * 0.45, bb - K * 0.3, K * 0.45, K * 0.4), cor: '#7d827f', clip: tigela, macio: K * 0.1 });
    L.push({ d: elip(bx, bb - K * 0.48, K * 0.78, K * 0.1), cor: '#b9beba' });
    // O pão.
    const pao = elip(w * 0.86, tY + h * 0.055, K * 0.46, K * 0.22);
    L.push({ d: pao, cor: '#c49a62' });
    L.push({ d: curvaAberta([[w * 0.86 - K * 0.2, tY + h * 0.055 - K * 0.08], [w * 0.86 - K * 0.12, tY + h * 0.055], [w * 0.86 - K * 0.18, tY + h * 0.055 + K * 0.1]]), cor: '#9e7546', linha: Math.max(0.6, K * 0.05), clip: pao });
    L.push({ d: curvaAberta([[w * 0.86 + K * 0.08, tY + h * 0.055 - K * 0.1], [w * 0.86 + K * 0.16, tY + h * 0.055], [w * 0.86 + K * 0.1, tY + h * 0.055 + K * 0.12]]), cor: '#9e7546', linha: Math.max(0.6, K * 0.05), clip: pao });
    return L;
  }

  function camadasMar(w, h, semente) {
    const L = [];
    const m = Math.min(w, h);
    const e = Math.max(3, m * 0.03);
    const alto = h / w > 1.35;
    const hy = h * (alto ? 0.56 : 0.5);
    const r = acaso(semente * 31 + 5);
    L.push({ d: ret(-e, -e, w + e, hy + 2), grad: [0, hy, '#aebdc1', '#e0d6be'], contorno: false });
    L.push({ d: elip(w * 0.72, hy * 0.72, m * 0.26, m * 0.2), cor: '#efe3c2', alfa: 0.6, macio: m * 0.1, so: 'atual' });
    L.push({ d: elip(w * 0.72, hy * 0.74, m * 0.055, m * 0.055), cor: '#efe2bd', contorno: false });
    const nuvem = (cx, cy, k) => bolhas([[cx - k * 0.8, cy, k * 0.6, k * 0.18], [cx, cy - k * 0.08, k * 0.75, k * 0.24], [cx + k * 0.8, cy + k * 0.02, k * 0.5, k * 0.16]]);
    // A nuvem fica longe das velas (encostada nelas, parecia fumaça de vapor).
    L.push({ d: nuvem(w * 0.13, hy * 0.28, m * 0.13), cor: '#e9e3d4', macio: m * 0.02 });
    if (alto) L.push({ d: nuvem(w * 0.62, hy * 0.14, m * 0.22), cor: '#e4ddcc', macio: m * 0.02 });
    L.push({ d: poli([[-e, hy + 1], [-e, hy - m * 0.06], [w * 0.1, hy - m * 0.085], [w * 0.2, hy - m * 0.035], [w * 0.3, hy + 1]]), cor: '#7c8885' });
    L.push({ d: ret(-e, hy, w + e, h + e), grad: [hy, h, '#5a8890', '#30535d'] });
    L.push({ d: elip(w * 0.72, hy + (h - hy) * 0.28, m * 0.07, (h - hy) * 0.3), cor: '#8fb0ad', alfa: 0.35, macio: m * 0.04, so: 'atual' });
    // Cristas de onda sorteadas: comprimentos e lugares diferentes, nunca em fileira.
    for (let i = 0; i < 12; i++) {
      const t = 0.1 + 0.88 * Math.pow(r(), 1.3);
      const yy = hy + (h - hy) * t;
      const comp = w * (0.05 + 0.1 * t);
      const xx = r() * w;
      const p = new Path2D();
      p.moveTo(xx - comp / 2, yy);
      p.quadraticCurveTo(xx, yy - comp * 0.14, xx + comp / 2, yy);
      L.push({ d: p, cor: '#88a9aa', linha: Math.max(0.7, m * 0.012 * (0.5 + t)), alfa: 0.75, so: i < 7 ? undefined : 'atual' });
    }
    // O navio: casco, mastros, velas e bandeira.
    const k = Math.min(w * 0.46, h * 0.55);
    const sx = w * 0.45;
    const sy = hy + (h - hy) * (alto ? 0.2 : 0.26);
    L.push({ d: elip(sx, sy + k * 0.1, k * 0.45, k * 0.05), cor: '#253f48', alfa: 0.5, macio: k * 0.03, so: 'atual' });
    L.push({ d: linha([[sx - k * 0.15, sy - k * 0.08], [sx - k * 0.15, sy - k * 0.78]]), cor: '#3a2c21', linha: Math.max(0.8, k * 0.02) });
    L.push({ d: linha([[sx + k * 0.18, sy - k * 0.09], [sx + k * 0.18, sy - k * 0.64]]), cor: '#3a2c21', linha: Math.max(0.8, k * 0.02) });
    const vela = (x, topo, base, larg) => {
      const p = new Path2D();
      p.moveTo(x - larg * 0.5, topo);
      p.lineTo(x + larg * 0.45, topo);
      p.quadraticCurveTo(x + larg * 0.72, (topo + base) / 2, x + larg * 0.52, base);
      p.lineTo(x - larg * 0.55, base);
      p.quadraticCurveTo(x - larg * 0.3, (topo + base) / 2, x - larg * 0.5, topo);
      p.closePath();
      return p;
    };
    const velaG = vela(sx - k * 0.15, sy - k * 0.7, sy - k * 0.2, k * 0.4);
    const velaP = vela(sx + k * 0.18, sy - k * 0.58, sy - k * 0.22, k * 0.3);
    L.push({ d: velaG, cor: '#e4dcc8' });
    L.push({ d: ret(sx - k * 0.02, sy - k, sx + k * 0.3, sy), cor: '#cdc3ac', clip: velaG, alfa: 0.9 });
    L.push({ d: velaP, cor: '#e4dcc8' });
    L.push({ d: ret(sx + k * 0.28, sy - k, sx + k * 0.6, sy), cor: '#cdc3ac', clip: velaP, alfa: 0.9 });
    L.push({ d: poli([[sx + k * 0.2, sy - k * 0.6], [sx + k * 0.62, sy - k * 0.13], [sx + k * 0.22, sy - k * 0.15]]), cor: '#ddd4bf' });
    L.push({ d: poli([[sx - k * 0.15, sy - k * 0.78], [sx - k * 0.02, sy - k * 0.755], [sx - k * 0.15, sy - k * 0.73]]), cor: '#8f4a49' });
    const casco = poli([[sx - k * 0.5, sy - k * 0.09], [sx + k * 0.56, sy - k * 0.11], [sx + k * 0.42, sy + k * 0.06], [sx - k * 0.4, sy + k * 0.06]]);
    L.push({ d: casco, cor: '#4d392b' });
    L.push({ d: ret(sx - k * 0.6, sy - k * 0.12, sx + k * 0.6, sy - k * 0.06), cor: '#6e5139', clip: casco });
    return L;
  }

  function camadasCastelo(w, h) {
    const L = [];
    const m = Math.min(w, h);
    const e = Math.max(3, m * 0.03);
    const alto = h / w > 1.35;
    L.push({ d: ret(-e, -e, w + e, h + e), grad: [0, h * 0.7, '#9cafb8', '#e2d2b0'], contorno: false });
    L.push({ d: bolhas([[w * 0.2, h * 0.16, m * 0.14, m * 0.05], [w * 0.3, h * 0.14, m * 0.12, m * 0.06]]), cor: '#e9e2d1', macio: m * 0.02 });
    L.push({ d: morro([[-e, h * (alto ? 0.62 : 0.6)], [w * 0.3, h * (alto ? 0.58 : 0.55)], [w * 0.65, h * (alto ? 0.63 : 0.6)], [w + e, h * (alto ? 0.57 : 0.54)]], h + e), cor: '#99a69b' });
    const topo = h * (alto ? 0.44 : 0.5);
    L.push({ d: morro([[-e, h * 0.86], [w * 0.22, h * 0.66], [w * 0.5, topo], [w * 0.75, topo + h * 0.03], [w * 0.92, h * 0.72], [w + e, h * 0.8]], h + e), grad: [topo, h, '#748350', '#5b693f'] });
    L.push({ d: suave([[w * 0.18, h + e], [w * 0.3, h * 0.82], [w * 0.42, h * 0.7], [w * 0.5, topo + h * 0.04], [w * 0.49, topo + h * 0.04], [w * 0.38, h * 0.7], [w * 0.24, h * 0.82], [w * 0.28, h + e]]), cor: '#c4ab80' });
    // O castelo: muralha com ameias, duas torres de telhado cônico, a torre do meio com bandeira.
    const K = Math.min(w * 0.44, h * 0.4);
    const cx = w * 0.57;
    const by = topo + h * 0.02;
    const pedra = '#b0aa9b';
    L.push({ d: ret(cx - K * 0.5, by - K * 0.28, cx + K * 0.5, by), cor: pedra });
    const ameias = new Path2D();
    for (let i = 0; i < 6; i++) {
      const x = cx - K * 0.47 + i * K * 0.18;
      ameias.rect(x, by - K * 0.35, K * 0.08, K * 0.075);
    }
    L.push({ d: ameias, cor: pedra });
    for (const [x0, x1, alt] of [[-0.64, -0.43, 0.55], [0.42, 0.6, 0.5]]) {
      const torre = ret(cx + K * x0, by - K * alt, cx + K * x1, by);
      L.push({ d: torre, cor: '#a8a294' });
      L.push({ d: ret(cx + K * (x0 + (x1 - x0) * 0.6), by - K, cx + K * x1 + 1, by), cor: '#928d80', clip: torre });
      L.push({ d: poli([[cx + K * (x0 - 0.04), by - K * alt], [cx + K * (x0 + x1) / 2, by - K * (alt + 0.27)], [cx + K * (x1 + 0.04), by - K * alt]]), cor: '#5f6a66' });
      L.push({ d: ret(cx + K * ((x0 + x1) / 2 - 0.025), by - K * (alt - 0.12), cx + K * ((x0 + x1) / 2 + 0.025), by - K * (alt - 0.2)), cor: '#3d3a36', contorno: false });
    }
    const torreMeio = ret(cx - K * 0.17, by - K * 0.74, cx + K * 0.13, by - K * 0.2);
    L.push({ d: torreMeio, cor: '#bab4a5' });
    L.push({ d: ret(cx + K * 0.0, by - K, cx + K * 0.14, by), cor: '#a29d8f', clip: torreMeio });
    L.push({ d: poli([[cx - K * 0.21, by - K * 0.74], [cx - K * 0.02, by - K * 1.0], [cx + K * 0.17, by - K * 0.74]]), cor: '#5f6a66' });
    L.push({ d: linha([[cx - K * 0.02, by - K * 1.0], [cx - K * 0.02, by - K * 1.14]]), cor: '#3a2c21', linha: Math.max(0.6, K * 0.015) });
    L.push({ d: poli([[cx - K * 0.02, by - K * 1.14], [cx + K * 0.12, by - K * 1.1], [cx - K * 0.02, by - K * 1.06]]), cor: '#8f4a49' });
    L.push({ d: ret(cx - K * 0.06, by - K * 0.55, cx + K * 0.0, by - K * 0.45), cor: '#3d3a36', contorno: false });
    const portao = new Path2D();
    portao.moveTo(cx - K * 0.07, by);
    portao.lineTo(cx - K * 0.07, by - K * 0.1);
    portao.arc(cx, by - K * 0.1, K * 0.07, Math.PI, 0);
    portao.lineTo(cx + K * 0.07, by);
    portao.closePath();
    L.push({ d: portao, cor: '#3e3a35' });
    L.push({ d: bolhas([[w * 0.1, h * 0.88, m * 0.07, m * 0.06], [w * 0.17, h * 0.9, m * 0.06, m * 0.05]]), cor: '#55704a' });
    L.push({ d: bolhas([[w * 0.86, h * 0.84, m * 0.06, m * 0.055]]), cor: '#55704a' });
    return L;
  }

  function camadasAbstrato(w, h) {
    const L = [];
    const m = Math.min(w, h);
    const e = Math.max(3, m * 0.03);
    const alto = h / w > 1.35;
    L.push({ d: ret(-e, -e, w + e, h + e), grad: [0, h, '#2b2c31', '#1f1e23'], contorno: false });
    L.push({ d: ret(w * 0.1, h * 0.08, w * 0.9, h * (alto ? 0.42 : 0.47)), grad: [h * 0.08, h * 0.47, '#55303a', '#46262e'], macio: m * 0.035 });
    L.push({ d: ret(w * 0.1, h * (alto ? 0.5 : 0.55), w * 0.9, h * 0.9), grad: [h * 0.55, h * 0.9, '#36434d', '#2b353e'], macio: m * 0.035 });
    L.push({ d: elip(w * 0.67, h * 0.5, m * 0.17, m * 0.17), cor: '#8a7344', alfa: 0.92, macio: m * 0.012 });
    L.push({ d: linha([[w * 0.17, h * 0.8], [w * 0.55, h * 0.3]]), cor: '#b3a991', linha: Math.max(0.8, m * 0.014), alfa: 0.8 });
    return L;
  }

  const CAMADAS = [null, camadasPaisagem, camadasRetrato, camadasNaturezaMorta, camadasMar, camadasCastelo, camadasAbstrato];
  /** A direção geral da pincelada de cada pintura (radianos). */
  const ANGULO_DA_PINCELADA = [0, 0.05, -0.7, 0.35, 0.04, -0.25, 1.35];

  function preenchimento(g, L, estilo) {
    if (!L.grad) return L.cor;
    if (estilo === 'desenhado') return misturar(L.grad[2], L.grad[3], 0.45);
    const gr = g.createLinearGradient(0, L.grad[0], 0, L.grad[1]);
    gr.addColorStop(0, L.grad[2]);
    gr.addColorStop(1, L.grad[3]);
    return gr;
  }

  function pintarCamada(g, L, estilo, s) {
    g.save();
    if (L.clip) g.clip(L.clip);
    g.globalAlpha = L.alfa === undefined ? 1 : L.alfa;
    const tinta = preenchimento(g, L, estilo);
    const corBase = L.cor || L.grad[3];
    if (estilo === 'atual') {
      const b = L.macio === undefined ? 0.45 : L.macio;
      if (b > 0.3) g.filter = 'blur(' + b.toFixed(2) + 'px)';
    }
    if (L.linha) {
      g.strokeStyle = tinta;
      g.lineWidth = L.linha;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.stroke(L.d);
    } else {
      // Desenhado: o traço sai primeiro com o dobro da grossura; o recheio cobre a metade de dentro
      // (assim a união de bolhas não mostra os arcos de dentro).
      if (estilo === 'desenhado' && L.contorno !== false && !L.clip) {
        g.strokeStyle = tom(corBase, 0.55);
        g.lineWidth = 2 * Math.max(0.8, s * 0.009);
        g.lineJoin = 'round';
        g.stroke(L.d);
      }
      g.fillStyle = tinta;
      g.fill(L.d);
    }
    g.restore();
  }

  const cacheDasPinturas = new Map();

  /** A pintura n desenhada numa tela do tamanho da janela, no estilo pedido (com cache). */
  function telaDaPintura(n, w, h, estilo, s, semente) {
    const chave = [n, Math.round(w), Math.round(h), estilo, s, semente].join('|');
    const pronta = cacheDasPinturas.get(chave);
    if (pronta) return pronta;
    const c = tela(w, h);
    const g = c.getContext('2d');
    const camadas = CAMADAS[n](c.width, c.height, semente);
    for (const L of camadas) {
      if (L.so && L.so !== estilo) continue;
      pintarCamada(g, L, estilo, s);
    }
    if (estilo === 'atual') {
      pinceladas(g, c.width, c.height, s, semente * 97 + n, ANGULO_DA_PINCELADA[n], 0.55);
      grao(g, 0, 0, c.width, c.height, semente * 13 + n, 0.22, Math.max(1, s * 0.01));
      verniz(g, c.width, c.height);
    }
    cacheDasPinturas.set(chave, c);
    return c;
  }

  /** O glifo de linhas de cada pintura (Simples), dentro da janela J. */
  function glifoDaPintura(g, J, n) {
    const { x, y, w, h } = J;
    const m = Math.min(w, h);
    g.save();
    g.strokeStyle = LINHA_SIMPLES;
    g.lineWidth = 1;
    g.lineJoin = 'round';
    g.beginPath();
    switch (n) {
      case 1:
        g.moveTo(x + w * 0.1, y + h * 0.78);
        g.lineTo(x + w * 0.36, y + h * 0.4);
        g.lineTo(x + w * 0.52, y + h * 0.62);
        g.lineTo(x + w * 0.7, y + h * 0.34);
        g.lineTo(x + w * 0.9, y + h * 0.78);
        g.moveTo(x + w * 0.28 + m * 0.08, y + h * 0.24);
        g.arc(x + w * 0.28, y + h * 0.24, m * 0.08, 0, Math.PI * 2);
        break;
      case 2:
        g.moveTo(x + w * 0.5 + m * 0.15, y + h * 0.38);
        g.arc(x + w * 0.5, y + h * 0.38, m * 0.15, 0, Math.PI * 2);
        g.moveTo(x + w * 0.2, y + h * 0.92);
        g.quadraticCurveTo(x + w * 0.5, y + h * 0.48, x + w * 0.8, y + h * 0.92);
        break;
      case 3:
        g.moveTo(x + w * 0.1, y + h * 0.74);
        g.lineTo(x + w * 0.9, y + h * 0.74);
        g.moveTo(x + w * 0.24, y + h * 0.74);
        g.lineTo(x + w * 0.22, y + h * 0.42);
        g.lineTo(x + w * 0.38, y + h * 0.42);
        g.lineTo(x + w * 0.36, y + h * 0.74);
        g.moveTo(x + w * 0.64 + m * 0.11, y + h * 0.62);
        g.arc(x + w * 0.64, y + h * 0.62, m * 0.11, 0, Math.PI * 2);
        break;
      case 4:
        g.moveTo(x + w * 0.08, y + h * 0.74);
        g.quadraticCurveTo(x + w * 0.29, y + h * 0.66, x + w * 0.5, y + h * 0.74);
        g.quadraticCurveTo(x + w * 0.71, y + h * 0.82, x + w * 0.92, y + h * 0.74);
        g.moveTo(x + w * 0.3, y + h * 0.62);
        g.lineTo(x + w * 0.7, y + h * 0.62);
        g.lineTo(x + w * 0.62, y + h * 0.7);
        g.lineTo(x + w * 0.38, y + h * 0.7);
        g.closePath();
        g.moveTo(x + w * 0.5, y + h * 0.6);
        g.lineTo(x + w * 0.5, y + h * 0.22);
        g.lineTo(x + w * 0.68, y + h * 0.56);
        g.closePath();
        break;
      case 5: {
        const b = y + h * 0.78;
        const t = y + h * 0.46;
        g.moveTo(x + w * 0.14, b);
        g.lineTo(x + w * 0.14, y + h * 0.36);
        g.lineTo(x + w * 0.28, y + h * 0.36);
        g.lineTo(x + w * 0.28, t);
        for (let i = 0; i < 3; i++) {
          const x0 = x + w * (0.28 + i * 0.15);
          g.lineTo(x0 + w * 0.075, t);
          g.lineTo(x0 + w * 0.075, t - h * 0.06);
          g.lineTo(x0 + w * 0.15, t - h * 0.06);
          g.lineTo(x0 + w * 0.15, t);
        }
        g.lineTo(x + w * 0.73, y + h * 0.36);
        g.lineTo(x + w * 0.86, y + h * 0.36);
        g.lineTo(x + w * 0.86, b);
        g.closePath();
        break;
      }
      case 6:
        g.moveTo(x + w * 0.66 + m * 0.16, y + h * 0.48);
        g.arc(x + w * 0.66, y + h * 0.48, m * 0.16, 0, Math.PI * 2);
        g.moveTo(x + w * 0.16, y + h * 0.84);
        g.lineTo(x + w * 0.56, y + h * 0.24);
        break;
      default:
        // Imagem do mestre: o glifo genérico de imagem (morro e sol), quando a imagem não aparece.
        g.rect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.6);
    }
    g.stroke();
    g.restore();
  }

  // ---------------------------------------------------------------- imagem do mestre

  /**
   * Recorte "cobrir": a imagem cobre a janela inteira (sem faixa vazia). `fx`/`fy` (0 a 1) é o
   * ponto da imagem que fica no meio da janela; `zoom` (1 = o mínimo que cobre) aproxima.
   * Devolve o retângulo onde desenhar a imagem, já preso para nunca deixar a janela vazia.
   */
  function recorteCobrir(iw, ih, J, fx, fy, zoom) {
    const esc = Math.max(J.w / iw, J.h / ih) * Math.max(1, zoom || 1);
    const dw = iw * esc;
    const dh = ih * esc;
    let dx = J.x + J.w / 2 - (fx === undefined ? 0.5 : fx) * dw;
    let dy = J.y + J.h / 2 - (fy === undefined ? 0.5 : fy) * dh;
    dx = Math.min(J.x, Math.max(J.x + J.w - dw, dx));
    dy = Math.min(J.y, Math.max(J.y + J.h - dh, dy));
    return { dx, dy, dw, dh, esc };
  }

  /** Prende o foco para a janela ficar sempre coberta (o mesmo limite de `recorteCobrir`). */
  function prenderFoco(iw, ih, jw, jh, fx, fy, zoom) {
    const esc = Math.max(jw / iw, jh / ih) * Math.max(1, zoom || 1);
    const mx = jw / (2 * esc * iw);
    const my = jh / (2 * esc * ih);
    return { fx: Math.min(1 - mx, Math.max(mx, fx)), fy: Math.min(1 - my, Math.max(my, fy)) };
  }

  function desenharConteudo(g, J, pintura, estilo, s, semente) {
    if (typeof pintura === 'number') {
      if (estilo === 'simples') return;
      const c = telaDaPintura(pintura, J.w + 2, J.h + 2, estilo, s, semente);
      g.drawImage(c, J.x - 1, J.y - 1, J.w + 2, J.h + 2);
      return;
    }
    const img = pintura.img;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const R = recorteCobrir(iw, ih, J, pintura.fx, pintura.fy, pintura.zoom);
    g.save();
    g.beginPath();
    g.rect(J.x, J.y, J.w, J.h);
    g.clip();
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, R.dx, R.dy, R.dw, R.dh);
    if (estilo === 'atual') {
      // Só um verniz leve: a imagem do mestre é informação de jogo, não pode mudar.
      const gr = g.createRadialGradient(J.x + J.w / 2, J.y + J.h / 2, Math.min(J.w, J.h) * 0.3, J.x + J.w / 2, J.y + J.h / 2, Math.max(J.w, J.h) * 0.8);
      gr.addColorStop(0, 'rgba(40,28,14,0)');
      gr.addColorStop(1, 'rgba(40,28,14,0.18)');
      g.fillStyle = gr;
      g.fillRect(J.x, J.y, J.w, J.h);
    }
    if (estilo === 'simples') {
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(J.x, J.y, J.w, J.h);
    }
    g.restore();
  }

  // ---------------------------------------------------------------- molduras

  const LADOS = ['topo', 'dir', 'base', 'esq'];
  /** Face que olha para fora (para a luz de cima e da esquerda) e face que olha para a janela. */
  const LUZ_FORA = { topo: 1.2, esq: 1.1, dir: 0.84, base: 0.76 };
  const LUZ_DENTRO = { topo: 0.72, esq: 0.8, dir: 1.06, base: 1.14 };
  const iluminado = (lado) => lado === 'topo' || lado === 'esq';

  function trapezio(R, lado, a, b) {
    const { x0, y0, x1, y1 } = R;
    if (lado === 'topo') return poli([[x0 + a, y0 + a], [x1 - a, y0 + a], [x1 - b, y0 + b], [x0 + b, y0 + b]]);
    if (lado === 'dir') return poli([[x1 - a, y0 + a], [x1 - a, y1 - a], [x1 - b, y1 - b], [x1 - b, y0 + b]]);
    if (lado === 'base') return poli([[x1 - a, y1 - a], [x0 + a, y1 - a], [x0 + b, y1 - b], [x1 - b, y1 - b]]);
    return poli([[x0 + a, y1 - a], [x0 + a, y0 + a], [x0 + b, y0 + b], [x0 + b, y1 - b]]);
  }
  function gradienteDoLado(g, R, lado, a, b, c0, c1) {
    const { x0, y0, x1, y1 } = R;
    let gr;
    if (lado === 'topo') gr = g.createLinearGradient(0, y0 + a, 0, y0 + b);
    else if (lado === 'base') gr = g.createLinearGradient(0, y1 - a, 0, y1 - b);
    else if (lado === 'esq') gr = g.createLinearGradient(x0 + a, 0, x0 + b, 0);
    else gr = g.createLinearGradient(x1 - a, 0, x1 - b, 0);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    return gr;
  }
  /** O anel inteiro numa cor (embaixo das faces, para a emenda das esquadrias não vazar). */
  function anelCheio(g, R, a, b, cor) {
    const p = new Path2D();
    p.rect(R.x0 + a, R.y0 + a, R.x1 - R.x0 - 2 * a, R.y1 - R.y0 - 2 * a);
    p.rect(R.x0 + b, R.y0 + b, R.x1 - R.x0 - 2 * b, R.y1 - R.y0 - 2 * b);
    g.fillStyle = cor;
    g.fill(p, 'evenodd');
  }
  function anel(g, R, a, b, corDoLado) {
    for (const lado of LADOS) {
      const c = corDoLado(lado);
      g.fillStyle = Array.isArray(c) ? gradienteDoLado(g, R, lado, a, b, c[0], c[1]) : c;
      g.fill(trapezio(R, lado, a, b));
    }
  }

  /** Veios da madeira: riscos compridos e tortos, de lugar e tamanho sorteados (sem listra). */
  function veios(g, R, a, b, B, s, r) {
    for (const lado of LADOS) {
      g.save();
      g.clip(trapezio(R, lado, a, b));
      const horiz = lado === 'topo' || lado === 'base';
      const comp = horiz ? R.x1 - R.x0 : R.y1 - R.y0;
      const n = Math.max(3, Math.round(comp / (s * 0.016)));
      for (let i = 0; i < n; i++) {
        const t = a + r() * (b - a);
        const ini = r() * comp * 1.1 - comp * 0.1;
        const len = comp * (0.12 + r() * 0.45);
        const claro = r() < 0.45;
        g.strokeStyle = rgba(tom(B, claro ? 1.3 : 0.68), 0.14 + r() * 0.16);
        g.lineWidth = Math.max(0.5, s * (0.003 + r() * 0.004));
        const onda = (r() - 0.5) * s * 0.008;
        g.beginPath();
        if (horiz) {
          const yy = lado === 'topo' ? R.y0 + t : R.y1 - t;
          g.moveTo(R.x0 + ini, yy);
          g.quadraticCurveTo(R.x0 + ini + len / 2, yy + onda, R.x0 + ini + len, yy);
        } else {
          const xx = lado === 'esq' ? R.x0 + t : R.x1 - t;
          g.moveTo(xx, R.y0 + ini);
          g.quadraticCurveTo(xx + onda, R.y0 + ini + len / 2, xx, R.y0 + ini + len);
        }
        g.stroke();
      }
      g.restore();
    }
  }

  /** Ferro martelado: manchas suaves claras e escuras, e um pouco de ferrugem bem apagada. */
  function martelado(g, R, a, b, B, s, r) {
    g.save();
    const p = new Path2D();
    p.rect(R.x0 + a, R.y0 + a, R.x1 - R.x0 - 2 * a, R.y1 - R.y0 - 2 * a);
    p.rect(R.x0 + b, R.y0 + b, R.x1 - R.x0 - 2 * b, R.y1 - R.y0 - 2 * b);
    g.clip(p, 'evenodd');
    const per = 2 * (R.x1 - R.x0 + R.y1 - R.y0);
    const n = Math.round((per * (b - a)) / (s * s * 0.0012));
    g.filter = 'blur(' + Math.max(0.5, s * 0.004).toFixed(2) + 'px)';
    for (let i = 0; i < n; i++) {
      const x = R.x0 + r() * (R.x1 - R.x0);
      const y = R.y0 + r() * (R.y1 - R.y0);
      const ferrugem = r() < 0.08;
      g.fillStyle = ferrugem ? 'rgba(122,90,62,0.12)' : rgba(tom(B, r() < 0.5 ? 1.45 : 0.7), 0.13);
      g.beginPath();
      g.ellipse(x, y, s * (0.006 + r() * 0.01), s * (0.005 + r() * 0.008), r() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  function contornosDaMoldura(g, R, fw, B, s, fator, largura) {
    const lw = largura || Math.max(1, s * 0.008);
    g.save();
    g.strokeStyle = tom(B, fator);
    g.lineWidth = lw;
    g.lineJoin = 'miter';
    g.strokeRect(R.x0 + lw / 2, R.y0 + lw / 2, R.x1 - R.x0 - lw, R.y1 - R.y0 - lw);
    g.strokeRect(R.x0 + fw, R.y0 + fw, R.x1 - R.x0 - 2 * fw, R.y1 - R.y0 - 2 * fw);
    g.strokeStyle = rgba(tom(B, fator * 1.15), 0.6);
    g.lineWidth = Math.max(0.6, lw * 0.55);
    g.beginPath();
    for (const [ax, ay, bx, by] of [[R.x0, R.y0, R.x0 + fw, R.y0 + fw], [R.x1, R.y0, R.x1 - fw, R.y0 + fw], [R.x1, R.y1, R.x1 - fw, R.y1 - fw], [R.x0, R.y1, R.x0 + fw, R.y1 - fw]]) {
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
    }
    g.stroke();
    g.restore();
  }

  /** Forma pintada com o traço por fora (o traço sai primeiro, com o dobro da grossura). */
  function comContorno(g, d, recheio, corDoTraco, lw) {
    g.save();
    g.strokeStyle = corDoTraco;
    g.lineWidth = 2 * lw;
    g.lineJoin = 'round';
    g.stroke(d);
    g.fillStyle = recheio;
    g.fill(d);
    g.restore();
  }

  /** Roseta do canto da moldura dourada: miolo e quatro lóbulos (folhas). */
  function roseta(cx, cy, ro, giro) {
    const lista = [[cx, cy, ro * 0.44, ro * 0.44]];
    for (let i = 0; i < 4; i++) {
      const a = giro + (i * Math.PI) / 2;
      lista.push([cx + Math.cos(a) * ro * 0.55, cy + Math.sin(a) * ro * 0.55, ro * 0.42, ro * 0.3, a]);
    }
    return bolhas(lista);
  }
  /** Concha do meio do lado: leque de cinco lóbulos abertos para fora da moldura. */
  function concha(cx, cy, k, paraFora) {
    const lista = [];
    for (let i = -2; i <= 2; i++) {
      const a = paraFora + i * 0.5;
      lista.push([cx + Math.cos(a) * k * 0.45, cy + Math.sin(a) * k * 0.45, k * 0.42, k * 0.17, a]);
    }
    lista.push([cx, cy, k * 0.3, k * 0.3]);
    return bolhas(lista);
  }

  function ornamentosDourados(g, R, fw, B, s, estilo) {
    const ro = fw * 0.66;
    const lw = estilo === 'desenhado' ? Math.max(1.1, s * 0.012) : Math.max(0.8, s * 0.006);
    const traco = tom(B, estilo === 'desenhado' ? 0.38 : 0.45);
    const cantos = [[R.x0 + fw * 0.45, R.y0 + fw * 0.45], [R.x1 - fw * 0.45, R.y0 + fw * 0.45], [R.x1 - fw * 0.45, R.y1 - fw * 0.45], [R.x0 + fw * 0.45, R.y1 - fw * 0.45]];
    const recheio = (cx, cy, raio) => {
      if (estilo === 'desenhado') return tom(B, 1.12);
      const gr = g.createRadialGradient(cx - raio * 0.4, cy - raio * 0.45, raio * 0.1, cx, cy, raio * 1.2);
      gr.addColorStop(0, tom(B, 1.42));
      gr.addColorStop(0.55, B);
      gr.addColorStop(1, tom(B, 0.66));
      return gr;
    };
    for (const [cx, cy] of cantos) {
      comContorno(g, roseta(cx, cy, ro, Math.PI / 4), recheio(cx, cy, ro), traco, lw);
      comContorno(g, elip(cx, cy, ro * 0.2, ro * 0.2), estilo === 'desenhado' ? tom(B, 0.82) : tom(B, 0.78), traco, lw * 0.7);
    }
    const largura = R.x1 - R.x0;
    const altura = R.y1 - R.y0;
    const conchas = [];
    if (largura > fw * 6) conchas.push([(R.x0 + R.x1) / 2, R.y0 + fw * 0.5, -Math.PI / 2], [(R.x0 + R.x1) / 2, R.y1 - fw * 0.5, Math.PI / 2]);
    if (altura > fw * 9) conchas.push([R.x0 + fw * 0.5, (R.y0 + R.y1) / 2, Math.PI], [R.x1 - fw * 0.5, (R.y0 + R.y1) / 2, 0]);
    for (const [cx, cy, a] of conchas) comContorno(g, concha(cx, cy, fw * 1.05, a), recheio(cx, cy, fw * 0.6), traco, lw);
  }

  function contasDouradas(g, R, a, b, B, s) {
    const meio = (a + b) / 2;
    const raio = ((b - a) / 2) * 0.85;
    if (raio < 0.9) return;
    const passo = raio * 2.3;
    g.save();
    const caminhos = [
      [R.x0 + meio, R.y0 + meio, R.x1 - meio, R.y0 + meio],
      [R.x1 - meio, R.y0 + meio, R.x1 - meio, R.y1 - meio],
      [R.x1 - meio, R.y1 - meio, R.x0 + meio, R.y1 - meio],
      [R.x0 + meio, R.y1 - meio, R.x0 + meio, R.y0 + meio],
    ];
    for (const [ax, ay, bx, by] of caminhos) {
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.floor(len / passo);
      for (let i = 0; i <= n; i++) {
        const t = i / Math.max(1, n);
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        const gr = g.createRadialGradient(x - raio * 0.35, y - raio * 0.35, 0, x, y, raio);
        gr.addColorStop(0, tom(B, 1.32));
        gr.addColorStop(1, tom(B, 0.72));
        g.fillStyle = gr;
        g.beginPath();
        g.arc(x, y, raio, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
  }

  function rebite(g, x, y, raio, B, estilo, s) {
    if (estilo === 'desenhado') {
      comContorno(g, elip(x, y, raio, raio), tom(B, 1.35), tom(B, 0.36), Math.max(0.9, s * 0.009));
      return;
    }
    const gr = g.createRadialGradient(x - raio * 0.4, y - raio * 0.4, 0, x, y, raio * 1.1);
    gr.addColorStop(0, tom(B, 1.75));
    gr.addColorStop(0.6, tom(B, 1.05));
    gr.addColorStop(1, tom(B, 0.6));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, raio, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = tom(B, 0.5);
    g.lineWidth = Math.max(0.6, s * 0.004);
    g.stroke();
  }

  function ferragensDoFerro(g, R, fw, B, s, estilo) {
    const p = fw * 1.3;
    const lw = estilo === 'desenhado' ? Math.max(1.1, s * 0.012) : Math.max(0.8, s * 0.006);
    const cantos = [[R.x0, R.y0], [R.x1 - p, R.y0], [R.x1 - p, R.y1 - p], [R.x0, R.y1 - p]];
    for (const [x, y] of cantos) {
      const placa = ret(x, y, x + p, y + p);
      if (estilo === 'desenhado') comContorno(g, placa, tom(B, 1.1), tom(B, 0.36), lw);
      else {
        const gr = g.createLinearGradient(x, y, x + p, y + p);
        gr.addColorStop(0, tom(B, 1.3));
        gr.addColorStop(1, tom(B, 0.85));
        comContorno(g, placa, gr, tom(B, 0.5), lw * 0.7);
      }
      rebite(g, x + p / 2, y + p / 2, fw * 0.2, B, estilo, s);
    }
    const largura = R.x1 - R.x0;
    const altura = R.y1 - R.y0;
    if (largura > fw * 8) {
      rebite(g, (R.x0 + R.x1) / 2, R.y0 + fw * 0.55, fw * 0.16, B, estilo, s);
      rebite(g, (R.x0 + R.x1) / 2, R.y1 - fw * 0.55, fw * 0.16, B, estilo, s);
    }
    if (altura > fw * 8) {
      rebite(g, R.x0 + fw * 0.55, (R.y0 + R.y1) / 2, fw * 0.16, B, estilo, s);
      rebite(g, R.x1 - fw * 0.55, (R.y0 + R.y1) / 2, fw * 0.16, B, estilo, s);
    }
  }

  function molduraAtual(g, R, fw, tipo, s, semente) {
    const B = MOLDURAS[tipo].atual;
    const r = acaso(semente * 131 + tipo.length);
    anelCheio(g, R, 0, fw, B);
    if (tipo === 'madeira') {
      anel(g, R, 0, fw * 0.32, (l) => [tom(B, LUZ_FORA[l] * 1.06), tom(B, LUZ_FORA[l] * 0.92)]);
      anel(g, R, fw * 0.32, fw * 0.72, (l) => tom(B, iluminado(l) ? 1.03 : 0.93));
      veios(g, R, fw * 0.32, fw * 0.72, B, s, r);
      veios(g, R, 0, fw * 0.32, B, s, r);
      anel(g, R, fw * 0.72, fw * 0.8, () => tom(B, 0.62));
      anel(g, R, fw * 0.8, fw, (l) => tom(B, LUZ_DENTRO[l]));
      contornosDaMoldura(g, R, fw, B, s, 0.48);
    } else if (tipo === 'dourada') {
      anel(g, R, 0, fw * 0.16, (l) => [tom(B, LUZ_FORA[l] * 1.1), tom(B, LUZ_FORA[l] * 0.84)]);
      anel(g, R, fw * 0.16, fw * 0.6, (l) => (iluminado(l) ? [tom(B, 0.78), tom(B, 1.3)] : [tom(B, 1.06), tom(B, 0.7)]));
      anel(g, R, fw * 0.6, fw * 0.76, () => tom(B, 0.84));
      contasDouradas(g, R, fw * 0.6, fw * 0.76, B, s);
      anel(g, R, fw * 0.76, fw, (l) => tom(B, LUZ_DENTRO[l] * 0.94));
      contornosDaMoldura(g, R, fw, B, s, 0.44);
      ornamentosDourados(g, R, fw, B, s, 'atual');
    } else {
      anel(g, R, 0, fw * 0.24, (l) => [tom(B, LUZ_FORA[l] * 1.14), tom(B, LUZ_FORA[l] * 0.9)]);
      anel(g, R, fw * 0.24, fw * 0.86, (l) => tom(B, iluminado(l) ? 1.05 : 0.94));
      martelado(g, R, fw * 0.24, fw * 0.86, B, s, r);
      anel(g, R, fw * 0.86, fw, (l) => tom(B, LUZ_DENTRO[l] * 0.84));
      contornosDaMoldura(g, R, fw, B, s, 0.52);
      ferragensDoFerro(g, R, fw, B, s, 'atual');
    }
  }

  function molduraDesenhada(g, R, fw, tipo, s) {
    const B = MOLDURAS[tipo].desenhado;
    const cw = Math.max(1.4, s * 0.018);
    anelCheio(g, R, 0, fw, B);
    anel(g, R, 0, fw * 0.5, (l) => tom(B, iluminado(l) ? 1.18 : 0.8));
    anel(g, R, fw * 0.78, fw, (l) => tom(B, iluminado(l) ? 0.74 : 1.08));
    contornosDaMoldura(g, R, fw, B, s, 0.36, cw);
    if (tipo === 'dourada') ornamentosDourados(g, R, fw, B, s, 'desenhado');
    if (tipo === 'ferro') ferragensDoFerro(g, R, fw, B, s, 'desenhado');
  }

  function molduraSimples(g, R, fw, tipo) {
    g.save();
    g.fillStyle = FUNDO_SIMPLES;
    g.fillRect(R.x0, R.y0, R.x1 - R.x0, R.y1 - R.y0);
    g.strokeStyle = LINHA_SIMPLES;
    g.lineWidth = 1;
    g.strokeRect(Math.round(R.x0) + 0.5, Math.round(R.y0) + 0.5, Math.round(R.x1 - R.x0) - 1, Math.round(R.y1 - R.y0) - 1);
    g.strokeRect(Math.round(R.x0 + fw) + 0.5, Math.round(R.y0 + fw) + 0.5, Math.round(R.x1 - R.x0 - 2 * fw) - 1, Math.round(R.y1 - R.y0 - 2 * fw) - 1);
    const cantos = [[R.x0 + fw / 2, R.y0 + fw / 2], [R.x1 - fw / 2, R.y0 + fw / 2], [R.x1 - fw / 2, R.y1 - fw / 2], [R.x0 + fw / 2, R.y1 - fw / 2]];
    g.beginPath();
    for (const [x, y] of cantos) {
      const k = fw * 0.3;
      if (tipo === 'dourada') {
        g.moveTo(x, y - k);
        g.lineTo(x + k, y);
        g.lineTo(x, y + k);
        g.lineTo(x - k, y);
        g.closePath();
      } else if (tipo === 'ferro') {
        g.moveTo(x + k * 0.7, y);
        g.arc(x, y, k * 0.7, 0, Math.PI * 2);
      }
    }
    g.stroke();
    g.restore();
  }

  // ---------------------------------------------------------------- o quadro inteiro

  function geometria(o) {
    const T = TAMANHOS[o.tamanho];
    const s = o.s;
    const pw = T.pegada[0] * s;
    const fwid = T.moldura[0] * s;
    const fhei = T.moldura[1] * s;
    const R = { x0: o.x + (pw - fwid) / 2, y0: o.y + CORDAO * s, x1: o.x + (pw + fwid) / 2, y1: o.y + CORDAO * s + fhei };
    const fw = MOLDURAS[o.moldura].largura * s * T.k;
    const J = { x: R.x0 + fw, y: R.y0 + fw, w: fwid - 2 * fw, h: fhei - 2 * fw };
    return { R, J, fw, pw, ph: T.pegada[1] * s };
  }

  function sombraDoQuadro(g, R, s, estilo) {
    g.save();
    if (estilo === 'atual') {
      g.filter = 'blur(' + Math.max(0.6, s * 0.018).toFixed(2) + 'px)';
      g.fillStyle = rgba(SOMBRA, 0.36);
      g.fillRect(R.x0 + s * 0.02, R.y0 + s * 0.03, R.x1 - R.x0, R.y1 - R.y0);
    } else {
      g.filter = 'blur(' + Math.max(0.4, s * 0.006).toFixed(2) + 'px)';
      g.fillStyle = rgba(SOMBRA, 0.25);
      g.fillRect(R.x0 + s * 0.04, R.y0 + s * 0.05, R.x1 - R.x0, R.y1 - R.y0);
    }
    g.restore();
  }

  function sombraDoRebaixo(g, J, s) {
    const d = Math.max(1.5, s * 0.022);
    g.save();
    let gr = g.createLinearGradient(0, J.y, 0, J.y + d);
    gr.addColorStop(0, 'rgba(25,16,8,0.5)');
    gr.addColorStop(1, 'rgba(25,16,8,0)');
    g.fillStyle = gr;
    g.fillRect(J.x, J.y, J.w, d);
    gr = g.createLinearGradient(J.x, 0, J.x + d, 0);
    gr.addColorStop(0, 'rgba(25,16,8,0.38)');
    gr.addColorStop(1, 'rgba(25,16,8,0)');
    g.fillStyle = gr;
    g.fillRect(J.x, J.y, d, J.h);
    g.restore();
  }

  /** O prego na parede (a beira de cima da pegada) e o cordão em V até as duas argolas da moldura. */
  function cordao(g, cx, yParede, R, s, estilo, tipo) {
    const yPrego = yParede + s * 0.035;
    const dx = (R.x1 - R.x0) * 0.3;
    const yArgola = R.y0 + s * 0.004;
    if (estilo === 'simples') {
      g.save();
      g.strokeStyle = LINHA_SIMPLES;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx - dx, R.y0);
      g.lineTo(cx, yPrego);
      g.lineTo(cx + dx, R.y0);
      g.stroke();
      g.restore();
      return;
    }
    const B = estilo === 'desenhado' ? MOLDURAS[tipo].desenhado : MOLDURAS[tipo].atual;
    const metalDaArgola = tipo === 'dourada' ? B : tipo === 'ferro' ? tom(B, 1.2) : '#8a857c';
    const corda = estilo === 'desenhado' ? '#8f7a55' : '#857152';
    const lw = Math.max(1, s * 0.009);
    const v = linha([[cx - dx, yArgola], [cx, yPrego], [cx + dx, yArgola]]);
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    if (estilo === 'desenhado') {
      g.strokeStyle = tom(corda, 0.45);
      g.lineWidth = lw + 2 * Math.max(0.7, s * 0.007);
      g.stroke(v);
    }
    g.strokeStyle = corda;
    g.lineWidth = lw;
    g.stroke(v);
    const ra = Math.max(1.2, s * 0.012);
    for (const x of [cx - dx, cx + dx]) {
      if (estilo === 'desenhado') comContorno(g, elip(x, yArgola, ra, ra), metalDaArgola, tom(metalDaArgola, 0.4), Math.max(0.7, s * 0.007));
      else {
        g.strokeStyle = metalDaArgola;
        g.lineWidth = Math.max(0.8, ra * 0.55);
        g.beginPath();
        g.arc(x, yArgola, ra, 0, Math.PI * 2);
        g.stroke();
      }
    }
    const rp = Math.max(1.5, s * 0.016);
    if (estilo === 'desenhado') comContorno(g, elip(cx, yPrego, rp, rp), '#8a857b', '#3f3c37', Math.max(0.7, s * 0.007));
    else {
      const gr = g.createRadialGradient(cx - rp * 0.4, yPrego - rp * 0.4, 0, cx, yPrego, rp);
      gr.addColorStop(0, '#b3ada2');
      gr.addColorStop(1, '#55514b');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(cx, yPrego, rp, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }

  /**
   * O quadro inteiro (a pegada começa em x, y; a parede é a beira de cima).
   * o = { x, y, s, tamanho 'P'|'M'|'G', moldura, pintura 1-6 | { img, fx, fy, zoom }, estilo, semente }
   */
  function desenharQuadro(g, o) {
    const q = Object.assign({ tamanho: 'M', moldura: 'madeira', pintura: 1, estilo: 'atual', semente: 1 }, o);
    const { R, J, fw, pw } = geometria(q);
    if (q.estilo !== 'simples') sombraDoQuadro(g, R, q.s, q.estilo);
    cordao(g, q.x + pw / 2, q.y, R, q.s, q.estilo, q.moldura);
    if (q.estilo === 'simples') {
      molduraSimples(g, R, fw, q.moldura);
      if (typeof q.pintura === 'number') glifoDaPintura(g, J, q.pintura);
      else desenharConteudo(g, J, q.pintura, 'simples', q.s, q.semente);
      return { R, J };
    }
    g.save();
    g.beginPath();
    g.rect(J.x - 1, J.y - 1, J.w + 2, J.h + 2);
    g.clip();
    desenharConteudo(g, J, q.pintura, q.estilo, q.s, q.semente);
    g.restore();
    if (q.estilo === 'atual') {
      molduraAtual(g, R, fw, q.moldura, q.s, q.semente);
      sombraDoRebaixo(g, J, q.s);
    } else molduraDesenhada(g, R, fw, q.moldura, q.s);
    return { R, J };
  }

  /** De lado (perfil): a parede à esquerda (x = face da parede), a moldura em pé, um pouco inclinada. */
  function desenharPerfil(g, o) {
    const { x, y, s, tamanho, moldura, estilo } = o;
    const H = TAMANHOS[tamanho].moldura[1] * s;
    const prof = MOLDURAS[moldura].perfil * s;
    const yT = y + CORDAO * s;
    const yB = yT + H;
    const inclT = s * 0.03;
    const inclB = s * 0.004;
    const corpo = poli([[x + inclT, yT], [x + inclT + prof, yT + prof * 0.06], [x + inclB + prof, yB], [x + inclB, yB]]);
    const yPrego = y + s * 0.035;
    if (estilo === 'simples') {
      g.save();
      g.fillStyle = FUNDO_SIMPLES;
      g.fill(corpo);
      g.strokeStyle = LINHA_SIMPLES;
      g.lineWidth = 1;
      g.stroke(corpo);
      g.beginPath();
      g.moveTo(x, yPrego);
      g.lineTo(x + inclT + prof * 0.3, yT + H * 0.06);
      g.stroke();
      g.restore();
      return;
    }
    const B = estilo === 'desenhado' ? MOLDURAS[moldura].desenhado : MOLDURAS[moldura].atual;
    g.save();
    g.strokeStyle = estilo === 'desenhado' ? '#8f7a55' : '#857152';
    g.lineWidth = Math.max(1, s * 0.009);
    g.beginPath();
    g.moveTo(x + s * 0.012, yPrego);
    g.lineTo(x + inclT + prof * 0.3, yT + H * 0.06);
    g.stroke();
    g.fillStyle = estilo === 'desenhado' ? '#8a857b' : '#6e6a62';
    g.fillRect(x, yPrego - s * 0.007, s * 0.02, s * 0.014);
    if (estilo === 'desenhado') comContorno(g, corpo, B, tom(B, 0.36), Math.max(1.1, s * 0.012));
    else {
      const gr = g.createLinearGradient(x, 0, x + inclT + prof, 0);
      gr.addColorStop(0, tom(B, 0.7));
      gr.addColorStop(1, tom(B, 1.12));
      g.fillStyle = gr;
      g.fill(corpo);
      g.strokeStyle = tom(B, 0.48);
      g.lineWidth = Math.max(1, s * 0.006);
      g.stroke(corpo);
      g.fillStyle = tom(B, 1.3);
      g.fill(poli([[x + inclT, yT], [x + inclT + prof, yT + prof * 0.06], [x + inclT + prof * 0.9, yT + prof * 0.3], [x + inclT + prof * 0.05, yT + prof * 0.25]]));
    }
    g.restore();
  }

  // ---------------------------------------------------------------- chão e paredes (fundo das provas)

  function lajotas(g, x, y, w, h, s, base, junta, semente) {
    const r = acaso(semente);
    const tw = s * 0.62;
    const th = s * 0.31;
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    g.fillStyle = junta;
    g.fillRect(x, y, w, h);
    const lw = Math.max(1, s * 0.012);
    for (let lin = 0; lin * th < h + th; lin++) {
      const desloc = (lin % 2) * tw * 0.5 + r() * tw * 0.2;
      for (let col = -1; col * tw < w + tw; col++) {
        g.fillStyle = tom(base, 0.95 + r() * 0.1);
        g.fillRect(x + col * tw + desloc + lw / 2, y + lin * th + lw / 2, tw - lw, th - lw);
      }
    }
    grao(g, x, y, w, h, semente + 1, 0.3, Math.max(1, s * 0.012));
    grao(g, x, y, w, h, semente + 2, 0.2, s * 0.25);
    g.restore();
  }

  /** Fundo de chão. tipo: lajotasEscuras | chaoDoApp | lajotasClaras | assoalhoDesenhado | simples | assoalhoAtual */
  function chao(g, x, y, w, h, tipo, s, semente) {
    const sem = semente || 7;
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    if (tipo === 'lajotasEscuras') lajotas(g, x, y, w, h, s, '#4c4b48', '#3a3937', sem);
    else if (tipo === 'lajotasClaras') lajotas(g, x, y, w, h, s, '#cec7b7', '#b5ad9c', sem);
    else if (tipo === 'chaoDoApp') {
      g.fillStyle = '#a87567';
      g.fillRect(x, y, w, h);
      grao(g, x, y, w, h, sem, 0.18, s * 0.3);
      grao(g, x, y, w, h, sem + 1, 0.12, Math.max(1, s * 0.012));
    } else if (tipo === 'assoalhoDesenhado' || tipo === 'assoalhoAtual') {
      const r = acaso(sem);
      const desenhado = tipo === 'assoalhoDesenhado';
      const base = desenhado ? '#b08562' : '#8b6b47';
      // Tábua larga e emenda apagada: a fileira de tábuas não pode virar listra.
      const ph = s * 0.25;
      g.fillStyle = base;
      g.fillRect(x, y, w, h);
      for (let lin = 0; lin * ph < h + ph; lin++) {
        const yy = y + lin * ph;
        let xx = x - r() * s * 1.2;
        while (xx < x + w) {
          const comp = s * (0.9 + r() * 1.3);
          g.fillStyle = tom(base, 0.97 + r() * 0.06);
          g.fillRect(xx, yy, comp, ph);
          g.fillStyle = tom(base, desenhado ? 0.76 : 0.84);
          g.fillRect(xx + comp - Math.max(1, s * 0.01), yy, Math.max(1, s * 0.01), ph);
          xx += comp;
        }
        g.fillStyle = tom(base, desenhado ? 0.76 : 0.86);
        g.fillRect(x, yy + ph - Math.max(1, s * (desenhado ? 0.014 : 0.008)), w, Math.max(1, s * (desenhado ? 0.014 : 0.008)));
      }
      if (!desenhado) {
        grao(g, x, y, w, h, sem + 3, 0.28, Math.max(1, s * 0.01));
        grao(g, x, y, w, h, sem + 4, 0.16, s * 0.3);
      }
    } else {
      g.fillStyle = CHAO_SIMPLES;
      g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.05)';
      g.lineWidth = 1;
      g.beginPath();
      for (let gx = x + s; gx < x + w; gx += s) {
        g.moveTo(Math.round(gx) + 0.5, y);
        g.lineTo(Math.round(gx) + 0.5, y + h);
      }
      for (let gy = y + s; gy < y + h; gy += s) {
        g.moveTo(x, Math.round(gy) + 0.5);
        g.lineTo(x + w, Math.round(gy) + 0.5);
      }
      g.stroke();
    }
    g.restore();
  }

  /**
   * Parede vista de cima: o retângulo da parede, com a sala do lado `sala`
   * ('baixo' | 'cima' | 'esq' | 'dir'): ali fica a beira clara e a sombra no chão.
   */
  function paredeDeCima(g, x0, y0, x1, y1, s, estilo, semente, sala) {
    const w = x1 - x0;
    const h = y1 - y0;
    if (estilo === 'simples') {
      g.save();
      g.strokeStyle = '#d8d2c4';
      g.lineWidth = 2;
      g.beginPath();
      if (w >= h) {
        g.moveTo(x0, (y0 + y1) / 2);
        g.lineTo(x1, (y0 + y1) / 2);
      } else {
        g.moveTo((x0 + x1) / 2, y0);
        g.lineTo((x0 + x1) / 2, y1);
      }
      g.stroke();
      g.restore();
      return;
    }
    const r = acaso(semente || 11);
    const desenhado = estilo === 'desenhado';
    const base = desenhado ? '#938b7e' : '#78746c';
    const junta = desenhado ? '#4c463e' : '#5c5953';
    const deitada = w >= h;
    const sombra = s * 0.12;
    g.save();
    // A sombra da parede no chão da sala.
    let gr;
    if (sala === 'baixo') gr = g.createLinearGradient(0, y1, 0, y1 + sombra);
    else if (sala === 'cima') gr = g.createLinearGradient(0, y0, 0, y0 - sombra);
    else if (sala === 'dir') gr = g.createLinearGradient(x1, 0, x1 + sombra, 0);
    else gr = g.createLinearGradient(x0, 0, x0 - sombra, 0);
    gr.addColorStop(0, desenhado ? 'rgba(52,36,24,0.28)' : 'rgba(30,20,12,0.3)');
    gr.addColorStop(1, 'rgba(30,20,12,0)');
    g.fillStyle = gr;
    if (sala === 'baixo') g.fillRect(x0, y1, w, sombra);
    else if (sala === 'cima') g.fillRect(x0, y0 - sombra, w, sombra);
    else if (sala === 'dir') g.fillRect(x1, y0, sombra, h);
    else g.fillRect(x0 - sombra, y0, sombra, h);
    g.beginPath();
    g.rect(x0, y0, w, h);
    g.clip();
    g.fillStyle = junta;
    g.fillRect(x0, y0, w, h);
    const esp = deitada ? h : w;
    const bl = s * 0.6;
    const bh = esp / 2;
    const lw = Math.max(1, s * (desenhado ? 0.016 : 0.012));
    for (let lin = 0; lin < 2; lin++) {
      const desloc = lin * bl * 0.5;
      const comp = deitada ? w : h;
      for (let i = -1; i * bl < comp + bl; i++) {
        g.fillStyle = tom(base, (desenhado ? 0.97 : 0.93) + r() * (desenhado ? 0.06 : 0.14));
        if (deitada) g.fillRect(x0 + i * bl + desloc + lw / 2, y0 + lin * bh + lw / 2, bl - lw, bh - lw);
        else g.fillRect(x0 + lin * bh + lw / 2, y0 + i * bl + desloc + lw / 2, bh - lw, bl - lw);
      }
    }
    if (!desenhado) grao(g, x0, y0, w, h, (semente || 11) + 5, 0.3, Math.max(1, s * 0.012));
    // A beira do lado da sala, clara (a luz pega a quina).
    g.fillStyle = desenhado ? tom(base, 1.18) : '#a19c91';
    const beira = Math.max(1, s * 0.03);
    if (sala === 'baixo') g.fillRect(x0, y1 - beira, w, beira);
    else if (sala === 'cima') g.fillRect(x0, y0, w, beira);
    else if (sala === 'dir') g.fillRect(x1 - beira, y0, beira, h);
    else g.fillRect(x0, y0, beira, h);
    g.restore();
    if (desenhado) {
      g.save();
      g.strokeStyle = '#3f3a33';
      g.lineWidth = Math.max(1.4, s * 0.02);
      g.strokeRect(x0, y0, w, h);
      g.restore();
    }
  }

  /** A parede de frente (fundo da vista "de frente"): reboco. */
  function paredeDeFrente(g, x, y, w, h, s, estilo, semente) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    if (estilo === 'simples') {
      g.fillStyle = CHAO_SIMPLES;
      g.fillRect(x, y, w, h);
    } else if (estilo === 'desenhado') {
      g.fillStyle = '#c4b495';
      g.fillRect(x, y, w, h);
    } else {
      g.fillStyle = '#ad9f85';
      g.fillRect(x, y, w, h);
      grao(g, x, y, w, h, (semente || 5) + 1, 0.22, s * 0.28);
      grao(g, x, y, w, h, (semente || 5) + 2, 0.18, Math.max(1, s * 0.012));
    }
    g.restore();
  }

  // ---------------------------------------------------------------- imagem de exemplo do mestre

  /** "Mapa antigo": a imagem de exemplo do mestre (4:3), para mostrar o recorte. Desenho próprio. */
  function mapaAntigo(w, h) {
    const c = tela(w, h);
    const g = c.getContext('2d');
    const r = acaso(4242);
    g.fillStyle = '#d8c7a0';
    g.fillRect(0, 0, w, h);
    grao(g, 0, 0, w, h, 3, 0.35, w * 0.06);
    grao(g, 0, 0, w, h, 4, 0.2, 2);
    const tinta = '#6b5233';
    // A ilha: contorno sorteado em volta do meio.
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const raio = 0.3 + r() * 0.12;
      pts.push([w * 0.47 + Math.cos(a) * w * raio * 0.95, h * 0.5 + Math.sin(a) * h * raio * 0.9]);
    }
    const ilha = suave(pts);
    g.fillStyle = '#c8b183';
    g.fill(ilha);
    g.strokeStyle = tinta;
    g.lineWidth = w * 0.006;
    g.lineJoin = 'round';
    g.stroke(ilha);
    g.lineWidth = w * 0.004;
    g.strokeStyle = 'rgba(107,82,51,0.35)';
    g.save();
    g.translate(w * 0.47, h * 0.5);
    g.scale(1.08, 1.08);
    g.translate(-w * 0.47, -h * 0.5);
    g.stroke(ilha);
    g.restore();
    // Montanhas e árvores em glifo, o caminho tracejado e o X.
    g.strokeStyle = tinta;
    g.lineWidth = w * 0.005;
    g.lineCap = 'round';
    for (const [mx, my, k] of [[0.36, 0.38, 1], [0.43, 0.33, 1.25], [0.5, 0.39, 0.9]]) {
      g.beginPath();
      g.moveTo(w * (mx - 0.04 * k), h * (my + 0.05 * k));
      g.lineTo(w * mx, h * (my - 0.04 * k));
      g.lineTo(w * (mx + 0.04 * k), h * (my + 0.05 * k));
      g.stroke();
    }
    for (const [tx, ty] of [[0.58, 0.6], [0.62, 0.55], [0.55, 0.66], [0.33, 0.6]]) {
      g.beginPath();
      g.moveTo(w * tx, h * (ty + 0.04));
      g.lineTo(w * tx, h * ty);
      g.stroke();
      g.beginPath();
      g.arc(w * tx, h * (ty - 0.015), w * 0.014, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([w * 0.012, w * 0.012]);
    g.beginPath();
    g.moveTo(w * 0.26, h * 0.7);
    g.quadraticCurveTo(w * 0.4, h * 0.78, w * 0.48, h * 0.62);
    g.quadraticCurveTo(w * 0.55, h * 0.48, w * 0.66, h * 0.45);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = '#8f4a49';
    g.lineWidth = w * 0.011;
    g.beginPath();
    g.moveTo(w * 0.655, h * 0.415);
    g.lineTo(w * 0.695, h * 0.475);
    g.moveTo(w * 0.695, h * 0.415);
    g.lineTo(w * 0.655, h * 0.475);
    g.stroke();
    // Rosa dos ventos.
    const rx = w * 0.85;
    const ry = h * 0.78;
    const k = w * 0.06;
    g.fillStyle = tinta;
    g.beginPath();
    g.moveTo(rx, ry - k);
    g.lineTo(rx + k * 0.2, ry - k * 0.2);
    g.lineTo(rx + k, ry);
    g.lineTo(rx + k * 0.2, ry + k * 0.2);
    g.lineTo(rx, ry + k);
    g.lineTo(rx - k * 0.2, ry + k * 0.2);
    g.lineTo(rx - k, ry);
    g.lineTo(rx - k * 0.2, ry - k * 0.2);
    g.closePath();
    g.fill();
    g.strokeStyle = tinta;
    g.lineWidth = w * 0.003;
    g.beginPath();
    g.arc(rx, ry, k * 0.6, 0, Math.PI * 2);
    g.stroke();
    // Ondas soltas no mar, de lugar sorteado.
    g.lineWidth = w * 0.003;
    for (let i = 0; i < 9; i++) {
      const x = w * (0.08 + r() * 0.84);
      const y = h * (0.08 + r() * 0.84);
      const dx = x / w - 0.47;
      const dy = y / h - 0.5;
      if (dx * dx + dy * dy < 0.16) continue;
      g.beginPath();
      g.moveTo(x - w * 0.02, y);
      g.quadraticCurveTo(x - w * 0.01, y - h * 0.015, x, y);
      g.quadraticCurveTo(x + w * 0.01, y + h * 0.015, x + w * 0.02, y);
      g.stroke();
    }
    // Beira queimada.
    const gr = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    gr.addColorStop(0, 'rgba(110,80,40,0)');
    gr.addColorStop(1, 'rgba(110,80,40,0.55)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    return c;
  }

  raiz.Pintura = {
    G,
    CORDAO,
    TAMANHOS,
    ORDEM_DOS_TAMANHOS,
    MOLDURAS,
    ORDEM_DAS_MOLDURAS,
    PINTURAS,
    CHAO_SIMPLES,
    LINHA_SIMPLES,
    numeroDaCombinacao,
    geometria,
    desenharQuadro,
    desenharPerfil,
    telaDaPintura,
    glifoDaPintura,
    recorteCobrir,
    prenderFoco,
    chao,
    paredeDeCima,
    paredeDeFrente,
    mapaAntigo,
    tela,
    tom,
    rgba,
    acaso,
  };
})(window);
