/*
 * A FOLHA da Pintura: monta as imagens de aprovação com o desenho de fonte/desenho.js.
 * gerarTudo() devolve { 'arquivo.png': dataURL } para o fonte/gerar.cjs gravar.
 */
(function (raiz) {
  'use strict';
  const P = raiz.Pintura;

  const LARGURA = 1800;
  const MARGEM = 40;
  const COR = {
    fundo: '#1c1b19',
    cartao: '#24221f',
    borda: '#3a3631',
    texto: '#ebe5d6',
    suave: '#a39c8e',
    fraco: '#7d776c',
    acento: '#d4b26e',
    acentoFundo: '#3a3226',
  };
  const FONTE = '"Segoe UI", system-ui, sans-serif';
  const PINTURA_CURTA = ['', '1 Paisagem', '2 Retrato', '3 Nat.-morta', '4 Mar', '5 Castelo', '6 Abstrato'];
  const NOME_DO_ESTILO = { atual: 'Atual', desenhado: 'Desenhado', simples: 'Simples' };

  // ------------------------------------------------------------ texto

  function fonte(g, tam, peso) {
    g.font = (peso || 400) + ' ' + tam + 'px ' + FONTE;
  }
  function escrever(g, s, x, y, o) {
    const op = o || {};
    fonte(g, op.tam || 13, op.peso);
    g.fillStyle = op.cor || COR.texto;
    g.textAlign = op.alinhar || 'left';
    g.textBaseline = 'alphabetic';
    g.fillText(s, x, y);
    return g.measureText(s).width;
  }
  /** Parágrafo com quebra de linha; devolve o y da próxima linha. */
  function paragrafo(g, s, x, y, largura, o) {
    const op = o || {};
    const tam = op.tam || 13;
    const entre = op.entre || Math.round(tam * 1.5);
    fonte(g, tam, op.peso);
    g.fillStyle = op.cor || COR.texto;
    g.textAlign = 'left';
    let linhaAtual = '';
    let yy = y;
    for (const palavra of s.split(' ')) {
      const tentativa = linhaAtual ? linhaAtual + ' ' + palavra : palavra;
      if (g.measureText(tentativa).width > largura && linhaAtual) {
        g.fillText(linhaAtual, x, yy);
        linhaAtual = palavra;
        yy += entre;
      } else linhaAtual = tentativa;
    }
    if (linhaAtual) g.fillText(linhaAtual, x, yy);
    return yy + entre;
  }
  function tituloDaSecao(g, numero, titulo, sub, y) {
    const larg = LARGURA - 2 * MARGEM;
    g.fillStyle = COR.borda;
    g.fillRect(MARGEM, y, larg, 1);
    escrever(g, numero, MARGEM, y + 34, { tam: 20, peso: 600, cor: COR.acento });
    escrever(g, titulo, MARGEM + 30, y + 34, { tam: 20, peso: 600 });
    return sub ? paragrafo(g, sub, MARGEM + 30, y + 58, larg - 30, { tam: 13, cor: COR.suave }) + 6 : y + 52;
  }
  function pilula(g, s, cx, cy) {
    fonte(g, 11, 600);
    const w = g.measureText(s).width + 12;
    g.fillStyle = 'rgba(20,18,16,0.82)';
    g.beginPath();
    g.roundRect(cx - w / 2, cy - 9, w, 18, 9);
    g.fill();
    g.fillStyle = COR.texto;
    g.textAlign = 'center';
    g.fillText(s, cx, cy + 4);
    g.textAlign = 'left';
  }
  function cartao(g, x, y, w, h) {
    g.fillStyle = COR.cartao;
    g.beginPath();
    g.roundRect(x, y, w, h, 10);
    g.fill();
    g.strokeStyle = COR.borda;
    g.lineWidth = 1;
    g.stroke();
  }
  function recortar(g, x, y, w, h, fn) {
    g.save();
    g.beginPath();
    g.rect(x, y, w, h);
    g.clip();
    fn();
    g.restore();
  }

  // ------------------------------------------------------------ cabeçalho

  function cabecalho(g, y) {
    escrever(g, 'Pintura · quadro de parede', MARGEM, y + 40, { tam: 30, peso: 600 });
    escrever(g, 'Folha para aprovar, 27/11/2026. Só o desenho: nada foi encaixado no app.', MARGEM, y + 66, { tam: 14, cor: COR.acento });
    let yy = paragrafo(g, '3 tamanhos × 3 molduras × 6 pinturas = 54 combinações, numeradas de 1 a 54. Cada número sai nos 3 estilos do mapa (Atual, Simples e Desenhado), e o mestre ainda pode trocar a pintura por uma imagem dele.', MARGEM, y + 96, 1100, { tam: 14 });
    yy = paragrafo(g, 'Desenho próprio, por código e sempre igual (mesma entrada, mesma imagem). Cores contidas, sem listra, contorno no tom escuro da própria cor. As 6 pinturas são originais e genéricas: nada copiado de obra nenhuma.', MARGEM, yy, 1100, { tam: 13, cor: COR.suave });
    // Legenda dos tamanhos, à direita.
    const lx = 1230;
    escrever(g, 'Tamanhos (pegada em casas)', lx, y + 40, { tam: 13, peso: 600 });
    const linhas = [
      ['P', 'Pequeno, em pé', '0,5 × 0,72'],
      ['M', 'Médio, deitado', '1 × 0,82'],
      ['G', 'Grande, retrato de corpo', '1 × 1,66'],
    ];
    linhas.forEach(([k, n, m], i) => {
      const ly = y + 64 + i * 22;
      escrever(g, k, lx, ly, { tam: 13, peso: 600, cor: COR.acento });
      escrever(g, n, lx + 22, ly, { tam: 13 });
      escrever(g, m, lx + 260, ly, { tam: 13, cor: COR.suave });
    });
    escrever(g, 'A pegada inclui a faixa do prego e do cordão (0,12 casa).', lx, y + 140, { tam: 12, cor: COR.fraco });
    return Math.max(yy, y + 150) + 10;
  }

  // ------------------------------------------------------------ 1. as pinturas

  function janelaNominal(tamanho, s) {
    const g = P.geometria({ x: 0, y: 0, s, tamanho, moldura: 'madeira' });
    return { w: g.J.w, h: g.J.h };
  }

  function secaoPinturas(g, y) {
    let yy = tituloDaSecao(g, '1', 'As 6 pinturas de fábrica', 'Cada pintura se arruma sozinha no formato da moldura: deitada no Médio, em pé no Pequeno e de corpo inteiro no Grande (o retrato ganha pernas e capa; a paisagem e o mar ganham céu). Em cima, no Atual; embaixo, a mesma pintura no Desenhado e o glifo do Simples.', y);
    const s = 150;
    const colW = (LARGURA - 2 * MARGEM) / 6;
    const jG = janelaNominal('G', s);
    const jM = janelaNominal('M', s);
    const jP = janelaNominal('P', s);
    const topo = yy + 8;
    for (let i = 0; i < 6; i++) {
      const n = i + 1;
      const x0 = MARGEM + i * colW;
      escrever(g, n + ' · ' + P.PINTURAS[i].nome, x0, topo, { tam: 14, peso: 600 });
      const ty = topo + 14;
      const blocos = [
        ['G', x0, ty, jG],
        ['M', x0 + jG.w + 14, ty, jM],
        ['P', x0 + jG.w + 14, ty + jM.h + 26, jP],
      ];
      for (const [k, x, yb, j] of blocos) {
        g.drawImage(P.telaDaPintura(n, j.w, j.h, 'atual', s, 1), x, yb, j.w, j.h);
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, yb + 0.5, Math.round(j.w) - 1, Math.round(j.h) - 1);
        escrever(g, k, x, yb + j.h + 15, { tam: 11, peso: 600, cor: COR.suave });
      }
      const by = ty + jG.h + 34;
      g.drawImage(P.telaDaPintura(n, jM.w, jM.h, 'desenhado', s, 1), x0, by, jM.w, jM.h);
      escrever(g, 'Desenhado', x0, by + jM.h + 15, { tam: 11, cor: COR.suave });
      const sx = x0 + jM.w + 12;
      g.fillStyle = P.CHAO_SIMPLES;
      g.fillRect(sx, by, jM.w, jM.h);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(sx, by, jM.w, jM.h);
      P.glifoDaPintura(g, { x: sx, y: by, w: jM.w, h: jM.h }, n);
      escrever(g, 'Simples', sx, by + jM.h + 15, { tam: 11, cor: COR.suave });
    }
    return topo + 14 + jG.h + 34 + jM.h + 40;
  }

  // ------------------------------------------------------------ 2. molduras × estilos

  function quadroNoMapa(g, x, y, w, h, s, o, chao, estilo, semente) {
    const parede = 0.26 * s;
    const pw = P.TAMANHOS[o.tamanho].pegada[0] * s;
    recortar(g, x, y, w, h, () => {
      P.chao(g, x, y, w, h, chao, s, semente);
      P.paredeDeCima(g, x - 4, y, x + w + 4, y + parede, s, estilo, semente + 3, 'baixo');
      P.desenharQuadro(g, Object.assign({}, o, { x: x + (w - pw) / 2, y: y + parede, s, estilo }));
    });
  }
  function quadroDeFrente(g, x, y, w, h, s, o, estilo) {
    const pw = P.TAMANHOS[o.tamanho].pegada[0] * s;
    const ph = P.TAMANHOS[o.tamanho].pegada[1] * s;
    recortar(g, x, y, w, h, () => {
      P.paredeDeFrente(g, x, y, w, h, s, estilo, 9);
      P.desenharQuadro(g, Object.assign({}, o, { x: x + (w - pw) / 2, y: y + (h - ph) / 2, s, estilo }));
    });
  }

  function secaoMolduras(g, y) {
    let yy = tituloDaSecao(g, '2', 'As 3 molduras nos 3 estilos', 'No mapa a pintura fica como a tapeçaria e a arandela: de frente, com a parede na beira de cima (o prego e o cordão encostam nela); a 3/4 usa o mesmo desenho e o giro deita a imagem. "De frente" é como ela aparece em pé (ficha do objeto, espiada). De lado ela é uma tábua fina: fica só de referência, o app não precisa dessa vista.', y);
    const linhas = [
      { moldura: 'madeira', pintura: 1, detalhe: ['Nogueira #5f4532', 'perfil 0,055 casa', 'veio solto, sem listra'] },
      { moldura: 'dourada', pintura: 2, detalhe: ['Latão velho #9f8650', 'perfil 0,085 casa', 'rosetas, conchas e contas'] },
      { moldura: 'ferro', pintura: 4, detalhe: ['Ferro #4c4e51', 'perfil 0,05 casa', 'cantoneiras com rebite'] },
    ];
    const s = 140;
    const colRotulo = 168;
    const larguraNormal = 158;
    const larguraLado = 66;
    const larguraZoom = 118;
    const vao = 8;
    const altura = 172;
    const colunas = [
      { tipo: 'mapa', estilo: 'atual', chao: 'lajotasEscuras', rotulo: 'no mapa · lajotas escuras' },
      { tipo: 'mapa', estilo: 'atual', chao: 'chaoDoApp', rotulo: 'no mapa · chão do app' },
      { tipo: 'mapa', estilo: 'atual', chao: 'lajotasClaras', rotulo: 'no mapa · lajotas claras' },
      { tipo: 'frente', estilo: 'atual', rotulo: 'de frente' },
      { tipo: 'lado', estilo: 'atual', rotulo: 'de lado' },
      { tipo: 'mapa', estilo: 'desenhado', chao: 'assoalhoDesenhado', rotulo: 'no mapa · assoalho' },
      { tipo: 'frente', estilo: 'desenhado', rotulo: 'de frente' },
      { tipo: 'mapa', estilo: 'simples', chao: 'simples', rotulo: 'no mapa' },
      { tipo: 'frente', estilo: 'simples', rotulo: 'de frente' },
      { tipo: 'zoom', rotulo: '100% e 50%' },
    ];
    let x = MARGEM + colRotulo;
    for (const c of colunas) {
      c.x = x;
      c.w = c.tipo === 'lado' ? larguraLado : c.tipo === 'zoom' ? larguraZoom : larguraNormal;
      x += c.w + vao;
    }
    // Cabeçalho em dois níveis: o estilo por cima do grupo de colunas, a vista em cada coluna.
    const grupos = [['Atual (Meio-Termo)', 0, 4], ['Desenhado', 5, 6], ['Simples', 7, 8], ['Leitura no zoom', 9, 9]];
    const hy = yy + 6;
    for (const [nome, a, b] of grupos) {
      const x0 = colunas[a].x;
      const x1 = colunas[b].x + colunas[b].w;
      escrever(g, nome, x0, hy + 12, { tam: 13, peso: 600, cor: COR.acento });
      g.fillStyle = COR.borda;
      g.fillRect(x0, hy + 18, x1 - x0, 1);
    }
    for (const c of colunas) escrever(g, c.rotulo, c.x, hy + 36, { tam: 11, cor: COR.suave });
    yy = hy + 46;
    linhas.forEach((ln, i) => {
      const ty = yy + i * (altura + 14);
      const tam = 'M';
      const numero = P.numeroDaCombinacao(tam, ln.moldura, ln.pintura);
      escrever(g, (i + 1) + ' · ' + P.MOLDURAS[ln.moldura].nome, MARGEM, ty + 18, { tam: 14, peso: 600 });
      escrever(g, 'nº ' + numero + ' (M · ' + P.PINTURAS[ln.pintura - 1].nome.toLowerCase() + ')', MARGEM, ty + 40, { tam: 12, cor: COR.acento });
      ln.detalhe.forEach((d, k) => escrever(g, d, MARGEM, ty + 62 + k * 18, { tam: 12, cor: COR.suave }));
      const o = { tamanho: tam, moldura: ln.moldura, pintura: ln.pintura, semente: 1 };
      for (const c of colunas) {
        if (c.tipo === 'mapa') quadroNoMapa(g, c.x, ty, c.w, altura, s, o, c.chao, c.estilo, 21 + i);
        else if (c.tipo === 'frente') quadroDeFrente(g, c.x, ty, c.w, altura, s, o, c.estilo);
        else if (c.tipo === 'lado') {
          recortar(g, c.x, ty, c.w, altura, () => {
            P.paredeDeFrente(g, c.x, ty, c.w, altura, s, 'atual', 3);
            g.fillStyle = '#7d715d';
            g.fillRect(c.x, ty, 16, altura);
            g.fillStyle = '#5b5244';
            g.fillRect(c.x + 15, ty, 1, altura);
            P.desenharPerfil(g, { x: c.x + 16, y: ty + (altura - 0.82 * s) / 2, s, tamanho: tam, moldura: ln.moldura, estilo: 'atual' });
          });
        } else {
          // 100% e 50%: os três estilos, um por faixa.
          const faixa = altura / 3;
          const estilos = [['atual', 'chaoDoApp'], ['desenhado', 'assoalhoDesenhado'], ['simples', 'simples']];
          estilos.forEach(([est, ch], k) => {
            const fy = ty + k * faixa;
            recortar(g, c.x, fy, c.w, faixa - 2, () => {
              P.chao(g, c.x, fy, c.w, faixa, ch, P.G, 40 + k);
              P.paredeDeCima(g, c.x - 2, fy, c.x + c.w + 2, fy + 8, P.G, est, 50 + k, 'baixo');
              P.desenharQuadro(g, Object.assign({}, o, { x: c.x + 6, y: fy + 8, s: P.G, estilo: est }));
              P.desenharQuadro(g, Object.assign({}, o, { x: c.x + 6 + P.G + 12, y: fy + 8, s: P.G / 2, estilo: est }));
            });
          });
        }
      }
    });
    return yy + 3 * (altura + 14) + 10;
  }

  // ------------------------------------------------------------ 3. as 54 combinações

  function blocoDaMatriz(g, x, y, tamanho, estilo, s) {
    const T = P.TAMANHOS[tamanho];
    const colRotulo = 118;
    const cw = Math.round(T.pegada[0] * s + 26);
    const ch = Math.round(T.pegada[1] * s + 34);
    const cabeca = 40;
    const faixa = { P: '1 a 18', M: '19 a 36', G: '37 a 54' }[tamanho];
    escrever(g, T.nome, x, y + 16, { tam: 15, peso: 600 });
    escrever(g, 'nº ' + faixa, x, y + 34, { tam: 12, cor: COR.acento });
    for (let p = 1; p <= 6; p++) escrever(g, PINTURA_CURTA[p], x + colRotulo + (p - 1) * cw + cw / 2, y + 34, { tam: 11, cor: COR.suave, alinhar: 'center' });
    P.ORDEM_DAS_MOLDURAS.forEach((mol, li) => {
      const ly = y + cabeca + li * ch;
      escrever(g, P.MOLDURAS[mol].nome, x, ly + ch / 2 - 4, { tam: 12, peso: 600 });
      for (let p = 1; p <= 6; p++) {
        const cx = x + colRotulo + (p - 1) * cw;
        const fundoH = ch - 22;
        recortar(g, cx + 2, ly + 2, cw - 4, fundoH, () => {
          P.paredeDeFrente(g, cx + 2, ly + 2, cw - 4, fundoH, s, estilo, 3 + p + li);
          P.desenharQuadro(g, { x: cx + (cw - T.pegada[0] * s) / 2, y: ly + 2 + (fundoH - T.pegada[1] * s) / 2, s, tamanho, moldura: mol, pintura: p, estilo, semente: 1 });
        });
        escrever(g, 'nº ' + P.numeroDaCombinacao(tamanho, mol, p), cx + cw / 2, ly + ch - 6, { tam: 12, peso: 600, alinhar: 'center' });
      }
    });
    return { w: colRotulo + 6 * cw, h: cabeca + 3 * ch };
  }

  // ------------------------------------------------------------ 4. a cena

  const CENA = {
    casas: [10, 6],
    parede: 0.35,
    porta: [6.4, 7.4],
    quadros: [
      { x: 1.0, tamanho: 'G', moldura: 'dourada', pintura: 2 },
      { x: 2.6, tamanho: 'M', moldura: 'madeira', pintura: 1 },
      { x: 4.2, tamanho: 'M', moldura: 'dourada', pintura: 4 },
      { x: 5.9, tamanho: 'P', moldura: 'madeira', pintura: 3 },
      { x: 6.7, tamanho: 'P', moldura: 'ferro', pintura: 6 },
    ],
    naEsquerda: { y: 3.0, tamanho: 'M', moldura: 'ferro', pintura: 5 },
    ficha: [5.6, 3.9],
  };

  function ficha(g, cx, cy, r, estilo) {
    g.save();
    if (estilo === 'simples') {
      g.strokeStyle = P.LINHA_SIMPLES;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    } else {
      g.fillStyle = 'rgba(52,36,24,0.3)';
      g.beginPath();
      g.arc(cx + r * 0.08, cy + r * 0.12, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#55697a';
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#d9cfb8';
      g.beginPath();
      g.arc(cx, cy - r * 0.25, r * 0.28, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(cx, cy + r * 0.45, r * 0.5, r * 0.32, 0, Math.PI, 0);
      g.fill();
      g.strokeStyle = estilo === 'desenhado' ? '#2f3a44' : '#d8c9a2';
      g.lineWidth = estilo === 'desenhado' ? 2 : 1.5;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  function cena(g, x0, y0, estilo, s, comNumeros) {
    const [cw, ch] = CENA.casas;
    const t = CENA.parede * s;
    const W = cw * s;
    const H = ch * s;
    const chao = estilo === 'atual' ? 'assoalhoAtual' : estilo === 'desenhado' ? 'assoalhoDesenhado' : 'simples';
    recortar(g, x0, y0, W, H, () => {
      P.chao(g, x0, y0, W, H, chao, s, 61);
      P.paredeDeCima(g, x0, y0, x0 + W, y0 + t, s, estilo, 71, 'baixo');
      P.paredeDeCima(g, x0, y0, x0 + t, y0 + H, s, estilo, 72, 'dir');
      P.paredeDeCima(g, x0 + W - t, y0, x0 + W, y0 + H, s, estilo, 73, 'esq');
      P.paredeDeCima(g, x0, y0 + H - t, x0 + CENA.porta[0] * s, y0 + H, s, estilo, 74, 'cima');
      P.paredeDeCima(g, x0 + CENA.porta[1] * s, y0 + H - t, x0 + W, y0 + H, s, estilo, 75, 'cima');
      ficha(g, x0 + CENA.ficha[0] * s, y0 + CENA.ficha[1] * s, s * 0.45, estilo);
      CENA.quadros.forEach((q, i) => {
        P.desenharQuadro(g, { x: x0 + q.x * s, y: y0 + t, s, tamanho: q.tamanho, moldura: q.moldura, pintura: q.pintura, estilo, semente: 1 + i });
      });
      const e = CENA.naEsquerda;
      const T = P.TAMANHOS[e.tamanho];
      g.save();
      g.translate(x0 + t, y0 + e.y * s + T.pegada[0] * s);
      g.rotate(-Math.PI / 2);
      P.desenharQuadro(g, { x: 0, y: 0, s, tamanho: e.tamanho, moldura: e.moldura, pintura: e.pintura, estilo, semente: 9 });
      g.restore();
    });
    if (comNumeros) {
      for (const q of CENA.quadros) {
        const T = P.TAMANHOS[q.tamanho];
        pilula(g, 'nº ' + P.numeroDaCombinacao(q.tamanho, q.moldura, q.pintura), x0 + (q.x + T.pegada[0] / 2) * s, y0 + t + T.pegada[1] * s + 12);
      }
      const e = CENA.naEsquerda;
      const T = P.TAMANHOS[e.tamanho];
      pilula(g, 'nº ' + P.numeroDaCombinacao(e.tamanho, e.moldura, e.pintura), x0 + t + T.pegada[1] * s + 26, y0 + (e.y + T.pegada[0] / 2) * s);
    }
    return { W, H };
  }

  /** Opção B, só para comparar: de cima de verdade a pintura vira um risco encostado na parede. */
  function cenaDeCimaDeVerdade(g, x0, y0, s) {
    const W = CENA.casas[0] * s;
    const H = 1.25 * s;
    const t = CENA.parede * s;
    recortar(g, x0, y0, W, H, () => {
      P.chao(g, x0, y0, W, H, 'assoalhoAtual', s, 61);
      P.paredeDeCima(g, x0, y0, x0 + W, y0 + t, s, 'atual', 71, 'baixo');
      for (const q of CENA.quadros) {
        const T = P.TAMANHOS[q.tamanho];
        const M = P.MOLDURAS[q.moldura];
        const fw = T.moldura[0] * s;
        const cx = x0 + (q.x + T.pegada[0] / 2) * s;
        const prof = Math.max(2, M.perfil * s);
        g.fillStyle = 'rgba(52,36,24,0.35)';
        g.fillRect(cx - fw / 2 + 1, y0 + t + 1, fw, prof + 1.5);
        g.fillStyle = P.tom(M.atual, 1.15);
        g.fillRect(cx - fw / 2, y0 + t, fw, prof);
        g.fillStyle = P.tom(M.atual, 0.6);
        g.fillRect(cx - fw / 2, y0 + t + prof - 1, fw, 1);
      }
    });
    return { W, H };
  }

  function secaoCena(g, y) {
    let yy = tituloDaSecao(g, '4', 'Cena de exemplo: a parede de um salão, a 100% de zoom', 'Seis quadros numa sala de 10 × 6 casas, nos 3 estilos. O da parede da esquerda está girado (o giro deita a imagem, como na tapeçaria). A bolinha é uma ficha de jogador, para dar a escala. Os números são os da seção 3.', y);
    const s = P.G;
    const vao = 20;
    const larg = CENA.casas[0] * s;
    ['atual', 'desenhado', 'simples'].forEach((est, i) => {
      const x = MARGEM + i * (larg + vao);
      escrever(g, NOME_DO_ESTILO[est], x, yy + 12, { tam: 14, peso: 600, cor: COR.acento });
      cena(g, x, yy + 22, est, s, true);
    });
    yy += 22 + CENA.casas[1] * s + 30;
    escrever(g, 'Opção B, só para comparar (não recomendada): de cima de verdade', MARGEM, yy + 12, { tam: 14, peso: 600 });
    cenaDeCimaDeVerdade(g, MARGEM, yy + 22, s);
    const tx = MARGEM + larg + vao;
    paragrafo(g, 'Visto de cima de verdade, o quadro tem 2 a 3 px de fundo a 100%: some a pintura e some a imagem do mestre. Por isso a recomendação é a opção A (as três cenas de cima), igual à tapeçaria e à arandela que já estão no app: a pintura deitada de frente, encostada na parede.', tx, yy + 40, 1100, { tam: 13, cor: COR.suave });
    return yy + 22 + 1.25 * s + 24;
  }

  // ------------------------------------------------------------ 5. imagem do mestre

  function botao(g, x, y, w, h, s, ativo, primario) {
    g.fillStyle = primario ? COR.acento : ativo ? COR.acentoFundo : '#2c2a26';
    g.beginPath();
    g.roundRect(x, y, w, h, 6);
    g.fill();
    g.strokeStyle = ativo || primario ? COR.acento : COR.borda;
    g.lineWidth = 1;
    g.stroke();
    escrever(g, s, x + w / 2, y + h / 2 + 4, { tam: 12, peso: ativo || primario ? 600 : 400, cor: primario ? '#1c1b19' : ativo ? COR.acento : COR.texto, alinhar: 'center' });
  }

  function secaoImagemDoMestre(g, x, y, largura) {
    escrever(g, '5', x, y + 16, { tam: 20, peso: 600, cor: COR.acento });
    escrever(g, 'Proposta: o mestre escolhe a imagem de dentro', x + 30, y + 16, { tam: 20, peso: 600 });
    let yy = paragrafo(g, 'Na ficha do objeto, "Imagem" tem duas escolhas: De fábrica (as 6 pinturas) ou Minha imagem. A imagem do mestre é recortada para caber na janela da moldura.', x + 30, y + 42, largura - 30, { tam: 13, cor: COR.suave });
    const mapa = P.mapaAntigo(800, 600);
    const foco = { fx: 0.64, fy: 0.5, zoom: 1.25 };
    // A: a ficha do objeto.
    const ax = x;
    const ay = yy + 6;
    const aw = 250;
    const ah = 330;
    cartao(g, ax, ay, aw, ah);
    escrever(g, 'Pintura', ax + 16, ay + 28, { tam: 15, peso: 600 });
    escrever(g, 'Objeto · quadro de parede', ax + 16, ay + 46, { tam: 11, cor: COR.suave });
    escrever(g, 'Tamanho', ax + 16, ay + 72, { tam: 11, cor: COR.suave });
    ['P', 'M', 'G'].forEach((k, i) => botao(g, ax + 16 + i * 74, ay + 78, 70, 26, k, k === 'G'));
    escrever(g, 'Moldura', ax + 16, ay + 124, { tam: 11, cor: COR.suave });
    P.ORDEM_DAS_MOLDURAS.forEach((mol, i) => {
      const bx = ax + 16 + i * 74;
      const ativo = mol === 'dourada';
      g.fillStyle = ativo ? COR.acentoFundo : '#2c2a26';
      g.beginPath();
      g.roundRect(bx, ay + 130, 70, 44, 6);
      g.fill();
      g.strokeStyle = ativo ? COR.acento : COR.borda;
      g.stroke();
      P.desenharQuadro(g, { x: bx + 15, y: ay + 130 - 2, s: 40, tamanho: 'M', moldura: mol, pintura: 1, estilo: 'atual' });
    });
    escrever(g, 'Imagem', ax + 16, ay + 196, { tam: 11, cor: COR.suave });
    botao(g, ax + 16, ay + 202, 106, 26, 'De fábrica', false);
    botao(g, ax + 126, ay + 202, 108, 26, 'Minha imagem', true);
    g.drawImage(mapa, ax + 16, ay + 240, 96, 72);
    g.strokeStyle = COR.borda;
    g.strokeRect(ax + 16.5, ay + 240.5, 95, 71);
    escrever(g, 'mapa-antigo.png', ax + 122, ay + 254, { tam: 11, cor: COR.suave });
    botao(g, ax + 122, ay + 262, 112, 22, 'Trocar imagem…', false);
    botao(g, ax + 122, ay + 288, 112, 22, 'Encaixar de novo…', false);
    escrever(g, 'A ficha do objeto', ax, ay + ah + 18, { tam: 12, cor: COR.suave });
    // B: a janela de encaixar.
    const bx = ax + aw + 16;
    const bw = largura - aw - 16;
    const bh = ah;
    cartao(g, bx, ay, bw, bh);
    escrever(g, 'Encaixar a imagem', bx + 16, ay + 28, { tam: 15, peso: 600 });
    const area = { x: bx + 16, y: ay + 42, w: bw - 32, h: 190 };
    g.fillStyle = '#151412';
    g.fillRect(area.x, area.y, area.w, area.h);
    const esc = Math.min(area.w / 800, area.h / 600);
    const iw = 800 * esc;
    const ih = 600 * esc;
    const ix = area.x + (area.w - iw) / 2;
    const iy = area.y + (area.h - ih) / 2;
    g.drawImage(mapa, ix, iy, iw, ih);
    // A janela: a parte da imagem que aparece no Grande com esse foco e zoom.
    const geo = P.geometria({ x: 0, y: 0, s: 100, tamanho: 'G', moldura: 'dourada' });
    const escImg = Math.max(geo.J.w / 800, geo.J.h / 600) * foco.zoom;
    const vw = geo.J.w / escImg;
    const vh = geo.J.h / escImg;
    const fp = P.prenderFoco(800, 600, geo.J.w, geo.J.h, foco.fx, foco.fy, foco.zoom);
    const jx = ix + (fp.fx * 800 - vw / 2) * esc;
    const jy = iy + (fp.fy * 600 - vh / 2) * esc;
    const jw = vw * esc;
    const jh = vh * esc;
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.58)';
    g.beginPath();
    g.rect(ix, iy, iw, ih);
    g.rect(jx, jy, jw, jh);
    g.fill('evenodd');
    g.strokeStyle = COR.acento;
    g.lineWidth = 1.5;
    g.strokeRect(jx, jy, jw, jh);
    g.restore();
    escrever(g, 'Aproximar', area.x, area.y + area.h + 24, { tam: 11, cor: COR.suave });
    const tx0 = area.x + 70;
    const tx1 = area.x + area.w;
    g.fillStyle = COR.borda;
    g.fillRect(tx0, area.y + area.h + 19, tx1 - tx0, 3);
    const kx = tx0 + (tx1 - tx0) * ((foco.zoom - 1) / 2);
    g.fillStyle = COR.acento;
    g.fillRect(tx0, area.y + area.h + 19, kx - tx0, 3);
    g.beginPath();
    g.arc(kx, area.y + area.h + 20.5, 7, 0, Math.PI * 2);
    g.fill();
    paragrafo(g, 'Arraste para mover · a roda do mouse aproxima · setas e + / − no teclado · Enter encaixa · Esc cancela', area.x, area.y + area.h + 48, area.w, { tam: 11, cor: COR.suave });
    botao(g, bx + bw - 206, ay + bh - 42, 92, 28, 'Cancelar', false);
    botao(g, bx + bw - 106, ay + bh - 42, 90, 28, 'Encaixar', false, true);
    escrever(g, 'A janela de encaixar (a moldura escolhida dá o formato)', bx, ay + bh + 18, { tam: 12, cor: COR.suave });
    // C: o resultado no mapa e as regras.
    const cy = ay + ah + 40;
    const s = 136;
    const cw = 172;
    const chh = 1.66 * s + 0.26 * s + 12;
    recortar(g, ax, cy, cw, chh, () => {
      P.chao(g, ax, cy, cw, chh, 'chaoDoApp', s, 31);
      P.paredeDeCima(g, ax - 2, cy, ax + cw + 2, cy + 0.26 * s, s, 'atual', 32, 'baixo');
      P.desenharQuadro(g, { x: ax + (cw - s) / 2, y: cy + 0.26 * s, s, tamanho: 'G', moldura: 'dourada', pintura: { img: mapa, fx: foco.fx, fy: foco.fy, zoom: foco.zoom }, estilo: 'atual' });
    });
    escrever(g, 'No mapa: nº 44 com a imagem', ax, cy + chh + 18, { tam: 12, cor: COR.suave });
    const rx = ax + cw + 20;
    const rw = largura - cw - 20;
    let ry = cy + 8;
    const regras = [
      'A imagem cobre a janela inteira, sem faixa vazia. O mestre arrasta para escolher a parte que aparece e aproxima se quiser.',
      'Trocar o tamanho ou a moldura mantém o enquadramento: o mesmo ponto no meio e a mesma aproximação.',
      'A imagem aparece igual nos 3 estilos; só a moldura muda. No Simples ela aparece também, um pouco escurecida: pode ser uma pista para os jogadores.',
      'Na index.html desta pasta dá para testar com uma imagem sua (ela fica só no seu navegador).',
      'Fica para o plano do encaixe: onde a imagem é guardada e como ela chega aos jogadores.',
    ];
    for (const r of regras) {
      g.fillStyle = COR.acento;
      g.beginPath();
      g.arc(rx + 4, ry - 4, 2.5, 0, Math.PI * 2);
      g.fill();
      ry = paragrafo(g, r, rx + 14, ry, rw - 14, { tam: 13 }) + 6;
    }
    return Math.max(cy + chh + 30, ry);
  }

  // ------------------------------------------------------------ montagem

  function telaGrande(altura) {
    const c = P.tela(LARGURA, altura);
    const g = c.getContext('2d');
    g.fillStyle = COR.fundo;
    g.fillRect(0, 0, LARGURA, altura);
    return { c, g };
  }
  function cortar(c, altura) {
    const out = P.tela(LARGURA, altura);
    const g = out.getContext('2d');
    g.drawImage(c, 0, 0);
    return out;
  }

  function folha() {
    const { c, g } = telaGrande(4200);
    let y = cabecalho(g, 20);
    y = secaoPinturas(g, y + 10);
    y = secaoMolduras(g, y + 10);
    y = tituloDaSecao(g, '3', 'As 54 combinações (estilo Atual, de frente)', 'nº 1 a 18 Pequeno, 19 a 36 Médio, 37 a 54 Grande. Em cada bloco: linha = moldura, coluna = pintura. Os mesmos números valem no Desenhado e no Simples (folhas à parte: combinacoes-desenhado.png e combinacoes-simples.png).', y + 10);
    const s = 120;
    const bp = blocoDaMatriz(g, MARGEM, y + 6, 'P', 'atual', s);
    const bm = blocoDaMatriz(g, MARGEM + bp.w + 40, y + 6, 'M', 'atual', s);
    y += 6 + Math.max(bp.h, bm.h) + 24;
    const bg = blocoDaMatriz(g, MARGEM, y, 'G', 'atual', s);
    const ex = MARGEM + bg.w + 40;
    const fimE = secaoImagemDoMestre(g, ex, y, LARGURA - MARGEM - ex);
    y = Math.max(y + bg.h, fimE) + 24;
    y = secaoCena(g, y);
    escrever(g, 'Fonte: docs/design/pintura-objeto/fonte/ · gerar de novo: node docs/design/pintura-objeto/fonte/gerar.cjs', MARGEM, y + 20, { tam: 12, cor: COR.fraco });
    return cortar(c, y + 40);
  }

  function folhaDaMatriz(estilo) {
    const { c, g } = telaGrande(1900);
    escrever(g, 'Pintura · as 54 combinações no estilo ' + NOME_DO_ESTILO[estilo], MARGEM, 56, { tam: 26, peso: 600 });
    escrever(g, 'Mesmos números da folha principal (folha.png). De frente, como no mapa.', MARGEM, 82, { tam: 14, cor: COR.suave });
    let y = 104;
    const s = 120;
    const bp = blocoDaMatriz(g, MARGEM, y, 'P', estilo, s);
    const bm = blocoDaMatriz(g, MARGEM + bp.w + 40, y, 'M', estilo, s);
    y += Math.max(bp.h, bm.h) + 24;
    const bg = blocoDaMatriz(g, MARGEM, y, 'G', estilo, s);
    const tx = MARGEM + bg.w + 40;
    const notas = estilo === 'simples'
      ? ['Simples = o desenho de linhas: a silhueta translúcida (preto a 0,35) com o fio claro de 1 px, igual aos outros objetos.', 'A moldura se reconhece pelos cantos: madeira lisa, dourada com losangos, ferro com rebites.', 'Cada pintura de fábrica vira um glifo (morro, busto, jarra, barco, castelo, círculo).', 'A imagem do mestre aparece mesmo no Simples, um pouco escurecida (pode ser pista).']
      : ['Desenhado = formas chapadas e calmas, contorno grosso no tom escuro da própria cor, sem grão.', 'A dourada perde as contas miúdas (regra do Desenhado: nada de detalhe repetido); ficam as rosetas e as conchas.', 'As pinturas são as mesmas da folha principal, em formas chapadas.'];
    let ny = y + 30;
    for (const n of notas) ny = paragrafo(g, n, tx, ny, LARGURA - MARGEM - tx, { tam: 14, cor: COR.suave }) + 8;
    return cortar(c, Math.max(y + bg.h, ny) + 40);
  }

  raiz.gerarTudo = function () {
    return {
      'folha.png': folha().toDataURL('image/png'),
      'combinacoes-desenhado.png': folhaDaMatriz('desenhado').toDataURL('image/png'),
      'combinacoes-simples.png': folhaDaMatriz('simples').toDataURL('image/png'),
    };
  };
  raiz.PinturaFolha = { folha, folhaDaMatriz, cena };
})(window);
