/*
 * AURAS DA FICHA: a lógica pura, sem DOM. É a parte que vai para o Pixi 8.
 *
 * Cada aura é uma conta do tempo: estadoDaAura(tipo, t, raio, semente, saida)
 * escreve em `saida.itens` a lista de sprites do quadro. Cada item diz:
 *   camada  0 = atrás da ficha, 1 = na frente (só raio e faísca, sempre fora do rosto)
 *   mistura 0 = normal (o corpo, que lê na grama clara), 1 = somada (a luz, que brilha no escuro)
 *   pincel  índice em `aura.pinceis` (forma + rampa de cor). O pincel 0 é sempre o brilho.
 *   cor     ponto na rampa, de 0 a 1 (no Pixi vira `tint`)
 *   x, y    centro do sprite em px de tela, origem no centro da ficha, y para baixo
 *   w, h    tamanho em px de tela; rot = giro em radianos
 *   alfa    transparência
 *
 * Nada guarda estado de um quadro para o outro. Por isso:
 *   - o mesmo t dá o mesmo quadro (mestre e jogador veem igual, sem rede);
 *   - tudo repete exatamente a cada PERIODO: t pode ser guardado como t mod 12 sem salto;
 *   - o quadro parado do movimento reduzido é só um t escolhido (poseDaAura).
 *
 * `raio` é o raio da ficha na tela (30 px no zoom normal). Tudo escala com ele.
 * As formas (FORMAS) são texturas cinza com alfa, geradas por conta, como a
 * bolha de `client/src/pixi/particulasDoMapa.ts`; a cor entra pelo tint.
 */
(function (raiz) {
  'use strict';

  /** Segundos de um laço. Toda onda, giro e vida de partícula fecha um número inteiro de vezes nele. */
  const PERIODO = 12;
  /** Orçamento por aura, fora o brilho. */
  const MAX_PARTICULAS = 80;
  const TAU = Math.PI * 2;
  const ATRAS = 0;
  const FRENTE = 1;
  const NORMAL = 0;
  const SOMA = 1;

  // ---------------------------------------------------------------- contas

  /** Sorteio determinístico em [0, 1): os mesmos números dão sempre o mesmo resultado. */
  function sorteio(a, b, c) {
    let x = Math.imul((a | 0) ^ 0x5bd1e995, 0x27d4eb2d);
    x = Math.imul(x ^ (b | 0) ^ (x >>> 15), 0x165667b1);
    x = Math.imul(x ^ (c | 0) ^ (x >>> 13), 0x85ebca6b);
    x ^= x >>> 16;
    x = Math.imul(x, 0xc2b2ae35);
    x ^= x >>> 13;
    return (x >>> 0) / 4294967296;
  }

  function liso(e0, e1, x) {
    let u = (x - e0) / (e1 - e0);
    u = u < 0 ? 0 : u > 1 ? 1 : u;
    return u * u * (3 - 2 * u);
  }

  /** Onda de `n` voltas por laço. Com n inteiro, fecha sem emenda. */
  function onda(t, n, fase) {
    return Math.sin(TAU * ((n * t) / PERIODO + fase));
  }

  /** Geração da última partícula consultada (0..k-1): sorteia a forma de cada vida. */
  let GER = 0;

  /** Idade (0..1) de uma partícula que vive `k` vezes por laço. Grava a geração em GER. */
  function idadeDe(t, k, fase) {
    const u = (t * k) / PERIODO + fase;
    const g = Math.floor(u);
    GER = ((g % k) + k) % k;
    return u - g;
  }

  function anguloEntre(a, b) {
    let d = (a - b) % TAU;
    if (d < -Math.PI) d += TAU;
    else if (d > Math.PI) d -= TAU;
    return Math.abs(d);
  }

  // ---------------------------------------------------------------- saída

  function criarSaida() {
    const itens = new Array(MAX_PARTICULAS + 8);
    for (let i = 0; i < itens.length; i += 1) {
      itens[i] = { camada: 0, mistura: 0, pincel: 0, cor: 0, x: 0, y: 0, w: 0, h: 0, rot: 0, alfa: 0 };
    }
    return { itens, n: 0, particulas: 0, brilhos: 0, cortadas: 0 };
  }

  function por(s, camada, mistura, pincel, cor, x, y, w, h, rot, alfa) {
    if (!(alfa > 0.004) || !(w > 0.05) || !(h > 0.05)) return;
    if (pincel === 0) {
      if (s.brilhos >= 1) return;
      s.brilhos += 1;
    } else {
      if (s.particulas >= MAX_PARTICULAS) {
        s.cortadas += 1;
        return;
      }
      s.particulas += 1;
    }
    const it = s.itens[s.n];
    s.n += 1;
    it.camada = camada;
    it.mistura = mistura;
    it.pincel = pincel;
    it.cor = cor;
    it.x = x;
    it.y = y;
    it.w = w;
    it.h = h;
    it.rot = rot;
    it.alfa = alfa > 1 ? 1 : alfa;
  }

  // ---------------------------------------------------------------- peças comuns

  /** As línguas de fogo vão do canto de baixo à esquerda, por cima, até o canto de baixo à direita. No fundo, subiriam escondidas atrás da ficha. */
  const ARCO_INI = -Math.PI / 2 - 1.95;
  const ARCO_FIM = -Math.PI / 2 + 1.95;

  /** Rascunho do eixo de uma língua: centro, giro e direção "para cima" da textura. */
  const EIXO = { x: 0, y: 0, rot: 0, ux: 0, uy: -1 };

  /**
   * Língua presa no aro, no ângulo `th` (0 = direita, PI/2 = baixo). Ela aponta
   * entre "para fora" e "para cima": em cima sobe reta, nos lados abre para fora.
   * `solta` é quanto ela já descolou da base, subindo.
   */
  function eixoDaLingua(th, R, h, solta, balanco) {
    let ux = Math.cos(th) * 0.9;
    let uy = Math.sin(th) * 0.9 - 1.25;
    const n = Math.hypot(ux, uy) || 1;
    ux /= n;
    uy /= n;
    const rot = Math.atan2(ux, -uy) + balanco;
    const vx = Math.sin(rot);
    const vy = -Math.cos(rot);
    const d = h * 0.45 + solta;
    EIXO.x = Math.cos(th) * R * 0.97 + vx * d;
    EIXO.y = Math.sin(th) * R * 0.97 + vy * d - solta * 0.35;
    EIXO.rot = rot;
    EIXO.ux = vx;
    EIXO.uy = vy;
  }

  /** Mesma vida de língua para os três fogos: nasce baixa, cresce, descola, afina e some. */
  const LINGUA = { h: 0, w: 0, solta: 0, env: 0 };
  function vidaDaLingua(a, H, W, R) {
    const cresce = liso(0, 0.28, a);
    LINGUA.h = H * (0.3 + 0.7 * cresce) * (1 - 0.3 * liso(0.6, 1, a));
    LINGUA.w = W * (0.72 + 0.28 * cresce) * (1 - 0.5 * liso(0.4, 1, a));
    LINGUA.solta = R * 0.4 * Math.pow(Math.max(0, a - 0.3), 1.5);
    LINGUA.env = liso(0, 0.1, a) * (1 - liso(0.5, 1, a));
  }

  /** Pontos do raio da vez (até 12 segmentos), reaproveitados. */
  function criarRaio() {
    return { n: 0, px: new Float64Array(13), py: new Float64Array(13), alfa: 0, ativo: false, centro: 0, meio: 0 };
  }

  /** Arco que corre ao longo do aro, entre os ângulos th0 e th1, com bojo para fora. */
  function arcoPolar(A, n, th0, th1, rBase, rBojo, tremor, sem, chave, R) {
    for (let k = 0; k <= n; k += 1) {
      const u = k / n;
      const ponta = k === 0 || k === n;
      const jr = ponta ? 0 : (sorteio(sem, chave, k) - 0.5) * 2 * tremor;
      const jt = ponta ? 0 : (sorteio(sem, chave, 40 + k) - 0.5) * 0.07;
      const th = th0 + (th1 - th0) * u + jt;
      const r = R * (rBase + rBojo * Math.sin(Math.PI * u) + jr);
      A.px[k] = Math.cos(th) * r;
      A.py[k] = Math.sin(th) * r;
    }
    A.n = n;
  }

  /** Espessura do miolo do raio: nunca abaixo de 0,9 px, para não sumir na miniatura. */
  function grossuraDoRaio(R) {
    return Math.max(0.9, 0.04 * R);
  }

  /** Um sprite deitado por segmento. A textura do traço tem a cápsula em 48 dos 64 px. */
  function porSegmentos(s, camada, mistura, pincel, cor, A, gross, alfa) {
    for (let k = 0; k < A.n; k += 1) {
      const x0 = A.px[k];
      const y0 = A.py[k];
      const x1 = A.px[k + 1];
      const y1 = A.py[k + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      por(s, camada, mistura, pincel, cor, (x0 + x1) / 2, (y0 + y1) / 2, (len * 64) / 48, gross, Math.atan2(dy, dx), alfa);
    }
  }

  /**
   * Evento num de E janelas iguais do laço (o raio da vez). Devolve quanto tempo
   * faz que ele começou, ou -1 se ainda não começou nesta janela. Grava em EV o
   * índice e a duração. Os eventos ficam dentro da janela, então não se encostam.
   */
  const EV = { j: 0, dur: 0 };
  function eventoDe(t, sem, slot, E, durMin, durVar, deslocar) {
    const janela = PERIODO / E;
    const j = Math.floor(t / janela) - (deslocar || 0);
    const jm = ((j % E) + E) % E;
    const inicio = j * janela + janela * (0.08 + 0.6 * sorteio(sem, 300 + slot, jm));
    EV.j = jm;
    EV.dur = durMin + durVar * sorteio(sem, 310 + slot, jm);
    const tl = t - inicio;
    return tl >= 0 ? tl : -1;
  }

  /** Clarão do brilho quando um raio estala: sobe na hora e cai em `cai` segundos. */
  function clarao(t, sem, slot, E, durMin, durVar, cai) {
    let v = 0;
    for (let d = 0; d <= 1; d += 1) {
      const tl = eventoDe(t, sem, slot, E, durMin, durVar, d);
      if (tl >= 0) v = Math.max(v, Math.exp(-tl / cai));
    }
    return v;
  }

  // ---------------------------------------------------------------- 1. almas roxas

  const CAMINHO = { x: 0, y: 0 };
  function caminhoDaAlma(a, th0, giro, sobe, fb, R) {
    const th = th0 + giro * a;
    const rr = R * (1.2 + 0.12 * a);
    CAMINHO.x = Math.cos(th) * rr + 0.13 * R * Math.sin(TAU * 1.2 * a + fb);
    CAMINHO.y = Math.sin(th) * rr * 0.9 - sobe * R * (0.25 * a + 0.75 * a * a);
  }

  function emitirAlmas(s, t, R, sem) {
    const resp = 0.5 + 0.5 * onda(t, 3, 0.1);
    por(s, ATRAS, NORMAL, 0, 0, 0, -0.08 * R, 3.5 * R * (1 + 0.03 * resp), 3.6 * R * (1 + 0.03 * resp), 0, 0.36 + 0.08 * resp);

    const N = 7;
    // passada 0: cauda; 1: halo (somado); 2: cabeça por cima
    for (let passada = 0; passada < 3; passada += 1) {
      for (let i = 0; i < N; i += 1) {
        const a = idadeDe(t, 4, (i + 0.37 * sorteio(sem, i, 1)) / N);
        const g = GER;
        const th0 = -Math.PI / 2 + (sorteio(sem, i, 20 + g * 6) - 0.5) * 3.9;
        const giro = (sorteio(sem, i, 21 + g * 6) - 0.5) * 1.6;
        const sobe = 0.75 + 0.35 * sorteio(sem, i, 22 + g * 6);
        const fb = sorteio(sem, i, 23 + g * 6) * TAU;
        const env = liso(0, 0.18, a) * (1 - liso(0.5, 0.95, a));
        const esc = 0.85 + 0.3 * a;
        if (passada === 0) {
          for (let j = 4; j >= 1; j -= 1) {
            const aj = a - 0.075 * j;
            if (aj < 0) continue;
            caminhoDaAlma(aj, th0, giro, sobe, fb, R);
            const tam = R * 0.3 * (1 - 0.15 * j) * esc;
            por(s, ATRAS, NORMAL, 1, Math.min(1, a + 0.08 * j), CAMINHO.x, CAMINHO.y, tam, tam, 0, env * (0.66 - 0.11 * j));
          }
          continue;
        }
        caminhoDaAlma(a, th0, giro, sobe, fb, R);
        const x = CAMINHO.x;
        const y = CAMINHO.y;
        caminhoDaAlma(Math.min(1, a + 0.02), th0, giro, sobe, fb, R);
        let rot = Math.atan2(CAMINHO.x - x, -(CAMINHO.y - y));
        if (rot > 0.6) rot = 0.6;
        else if (rot < -0.6) rot = -0.6;
        const w = R * 0.5 * esc;
        if (passada === 2) {
          por(s, ATRAS, NORMAL, 2, a, x, y, w, (w * 64) / 48, rot, 0.9 * env);
        } else {
          // o halo fica ATRÁS da cabeça (somado), para os olhos continuarem fundos;
          // a cabeça fica no alto da textura: 12 px acima do centro, em 48 de largura
          const hx = x + Math.sin(rot) * w * 0.25;
          const hy = y - Math.cos(rot) * w * 0.25;
          por(s, ATRAS, SOMA, 3, a, hx, hy, w * 1.35, w * 1.35, 0, 0.5 * env);
        }
      }
    }

    // poeira de alma: pontinhos que sobem do chão em volta
    for (let i = 0; i < 10; i += 1) {
      const a = idadeDe(t, 6, sorteio(sem, 50 + i, 1));
      const g = GER;
      const r1 = sorteio(sem, 50 + i, 10 + g * 3);
      const r2 = sorteio(sem, 50 + i, 11 + g * 3);
      const th = -Math.PI / 2 + (r1 - 0.5) * 4.2;
      const rr = R * (1.08 + 0.3 * r2);
      const x = Math.cos(th) * rr + 0.06 * R * Math.sin(TAU * a * 2 + r1 * 9);
      const y = Math.sin(th) * rr * 0.9 - R * 0.7 * a;
      const tam = Math.max(1.2, R * (0.1 - 0.045 * a));
      por(s, ATRAS, SOMA, 4, a, x, y, tam, tam, 0, 0.7 * liso(0, 0.2, a) * (1 - liso(0.45, 1, a)));
    }
  }

  // ---------------------------------------------------------------- 2. chamas negras

  function emitirChamasNegras(s, t, R, sem) {
    // a luz violeta atrás é o que deixa o preto ler no chão escuro
    const resp = 0.5 + 0.5 * onda(t, 4, 0.2);
    por(s, ATRAS, NORMAL, 0, 0, 0, -0.14 * R, 3.6 * R, 3.9 * R, 0, 0.42 + 0.1 * resp);

    const N = 18;
    // passada 0: a borda roxa de todas; 1: o miolo preto de todas, por cima
    for (let passada = 0; passada < 2; passada += 1) {
      for (let i = 0; i < N; i += 1) {
        const a = idadeDe(t, 12 + (i % 3), sorteio(sem, i, 1));
        const g = GER;
        const th = ARCO_INI + ((ARCO_FIM - ARCO_INI) * (i + 0.5)) / N + (sorteio(sem, i, 2) - 0.5) * 0.12;
        const topo = Math.max(0, -Math.sin(th));
        const H = R * (0.42 + 0.26 * topo + 0.2 * sorteio(sem, i, 16 + g * 4));
        const W = R * (0.44 + 0.1 * sorteio(sem, i, 17 + g * 4));
        vidaDaLingua(a, H, W, R);
        eixoDaLingua(th, R, LINGUA.h, LINGUA.solta, 0.14 * onda(t, 8 + (i % 5), sorteio(sem, i, 3)));
        if (passada === 0) {
          por(s, ATRAS, NORMAL, 1, a, EIXO.x + EIXO.ux * LINGUA.h * 0.04, EIXO.y + EIXO.uy * LINGUA.h * 0.04, LINGUA.w * 1.34, LINGUA.h * 1.16, EIXO.rot, 0.9 * LINGUA.env);
        } else {
          por(s, ATRAS, NORMAL, 2, a, EIXO.x, EIXO.y, LINGUA.w, LINGUA.h, EIXO.rot, 0.96 * LINGUA.env);
        }
      }
    }

    // brasas violeta que escapam
    for (let i = 0; i < 10; i += 1) {
      const a = idadeDe(t, 8, sorteio(sem, 100 + i, 1));
      const g = GER;
      const r1 = sorteio(sem, 100 + i, 10 + g * 4);
      const r2 = sorteio(sem, 100 + i, 11 + g * 4);
      const th = ARCO_INI + (ARCO_FIM - ARCO_INI) * r1;
      const r0 = R * (1.02 + 0.18 * r2);
      const sobe = R * (0.55 + 0.35 * r2) * (1 - (1 - a) * (1 - a));
      const x = Math.cos(th) * r0 + 0.12 * R * Math.sin(TAU * a + r1 * 7);
      const y = Math.sin(th) * r0 - sobe;
      const tam = Math.max(1.3, R * (0.1 - 0.05 * a));
      por(s, ATRAS, SOMA, 3, a, x, y, tam, tam, 0, 0.85 * liso(0, 0.1, a) * (1 - liso(0.45, 1, a)));
    }
  }

  // ---------------------------------------------------------------- 3. fogo e raios roxos

  const RAIOS_DA_MISTURA = [criarRaio(), criarRaio()];

  function emitirFogoERaios(s, t, R, sem) {
    // os raios da vez (calculados antes: o fogo perto deles fica roxo)
    let flash = 0;
    for (let q = 0; q < 2; q += 1) {
      const A = RAIOS_DA_MISTURA[q];
      const tl = eventoDe(t, sem, q, 12, 0.26, 0.14, 0);
      const dur = EV.dur;
      const j = EV.j;
      flash = Math.max(flash, clarao(t, sem, q, 12, 0.26, 0.14, 0.22));
      A.ativo = tl >= 0 && tl < dur;
      if (!A.ativo) continue;
      const forma = Math.floor(tl / 0.05);
      const chave = (q * 64 + j) * 64 + forma;
      const centro = -Math.PI / 2 + (sorteio(sem, 320 + q, j) - 0.5) * 3.2 + tl * 1.5 * (q === 0 ? 1 : -1);
      const meio = 0.4 + 0.25 * sorteio(sem, 330 + q, j);
      arcoPolar(A, 7, centro - meio, centro + meio, 1.12, 0.26, 0.08, sem, chave, R);
      A.alfa = (1 - liso(dur - 0.06, dur, tl)) * (0.85 + 0.15 * sorteio(sem, chave, 99));
      A.centro = centro;
      A.meio = meio;
    }

    // o brilho troca devagar entre o laranja e o roxo, e clareia quando o raio estala
    por(s, ATRAS, NORMAL, 0, 0.5 + 0.5 * onda(t, 2, 0), 0, -0.12 * R, 3.5 * R, 3.8 * R, 0, 0.34 + 0.2 * flash);

    const N = 14;
    const gross = grossuraDoRaio(R);
    // passada 0: corpo de todas; 1: faixa roxa dos raios; 2: miolo de todas; 3: miolo dos raios
    for (let passada = 0; passada < 4; passada += 1) {
      if (passada === 1 || passada === 3) {
        for (let q = 0; q < 2; q += 1) {
          const A = RAIOS_DA_MISTURA[q];
          if (!A.ativo) continue;
          if (passada === 1) porSegmentos(s, ATRAS, NORMAL, 3, 0, A, gross * 7, 0.62 * A.alfa);
          else porSegmentos(s, ATRAS, SOMA, 4, 0.2, A, gross * 5.6, A.alfa);
        }
        continue;
      }
      for (let i = 0; i < N; i += 1) {
        const k = 13 + (i % 3);
        const a = idadeDe(t, k, sorteio(sem, i, 1));
        const g = GER;
        const th = ARCO_INI + ((ARCO_FIM - ARCO_INI) * (i + 0.5)) / N + (sorteio(sem, i, 2) - 0.5) * 0.12;
        const topo = Math.max(0, -Math.sin(th));
        const H = R * (0.42 + 0.26 * topo + 0.2 * sorteio(sem, i, 16 + g * 4));
        const W = R * (0.46 + 0.1 * sorteio(sem, i, 17 + g * 4));
        vidaDaLingua(a, H, W, R);
        eixoDaLingua(th, R, LINGUA.h, LINGUA.solta, 0.13 * onda(t, 9 + (i % 4), sorteio(sem, i, 3)));
        // a mistura: cada língua nasce laranja ou roxa (e fica assim a vida toda); as
        // zonas roxas giram em volta da ficha. Rampa: 0 a 0,4 laranja, 0,6 a 1 roxo.
        const nasceu = t - (a * PERIODO) / k;
        const zona = 0.5 + 0.5 * Math.sin(2 * th - (TAU * 2 * nasceu) / PERIODO);
        const roxa = sorteio(sem, i, 18 + g * 4) < 0.2 + 0.6 * zona;
        const cor = roxa ? 0.6 + 0.4 * a : 0.4 * a;
        // perto do raio, o miolo acende
        let perto = 0;
        for (let q = 0; q < 2; q += 1) {
          const A = RAIOS_DA_MISTURA[q];
          if (!A.ativo) continue;
          const fora = Math.max(0, anguloEntre(th, A.centro) - A.meio);
          perto = Math.max(perto, (1 - liso(0, 0.35, fora)) * A.alfa);
        }
        if (passada === 0) {
          por(s, ATRAS, NORMAL, 1, cor, EIXO.x, EIXO.y, LINGUA.w, LINGUA.h, EIXO.rot, 0.95 * LINGUA.env);
        } else {
          const hm = LINGUA.h * 0.62;
          const d = (LINGUA.h - hm) * 0.42;
          por(s, ATRAS, SOMA, 2, cor, EIXO.x - EIXO.ux * d, EIXO.y - EIXO.uy * d, LINGUA.w * 0.55, hm, EIXO.rot, (0.5 + 0.4 * perto) * LINGUA.env);
        }
      }
    }

    // fagulhas das duas cores
    for (let i = 0; i < 8; i += 1) {
      const a = idadeDe(t, 10, sorteio(sem, 100 + i, 1));
      const g = GER;
      const r1 = sorteio(sem, 100 + i, 10 + g * 4);
      const r2 = sorteio(sem, 100 + i, 11 + g * 4);
      const th = ARCO_INI + (ARCO_FIM - ARCO_INI) * r1;
      const r0 = R * (1.02 + 0.2 * r2);
      const sobe = R * (0.6 + 0.4 * r2) * (1 - (1 - a) * (1 - a));
      const x = Math.cos(th) * r0 + 0.12 * R * Math.sin(TAU * a + r2 * 9);
      const y = Math.sin(th) * r0 - sobe;
      const tam = Math.max(1.3, R * (0.1 - 0.05 * a));
      por(s, ATRAS, SOMA, 5, i % 2 === 0 ? 0.15 : 0.85, x, y, tam, tam, 0, 0.9 * liso(0, 0.08, a) * (1 - liso(0.4, 1, a)));
    }
  }

  // ---------------------------------------------------------------- 4. fogo

  function emitirFogo(s, t, R, sem) {
    const tremor = 0.5 + 0.25 * onda(t, 7, 0.13) + 0.25 * onda(t, 11, 0.61);
    por(s, ATRAS, NORMAL, 0, 0, 0, -0.14 * R, 3.5 * R, 3.8 * R, 0, 0.3 + 0.08 * tremor);

    const N = 18;
    // passada 0: corpo de todas (normal); 1: miolo claro de todas (somado), por cima
    for (let passada = 0; passada < 2; passada += 1) {
      for (let i = 0; i < N; i += 1) {
        const a = idadeDe(t, 13 + (i % 3), sorteio(sem, i, 1));
        const g = GER;
        const th = ARCO_INI + ((ARCO_FIM - ARCO_INI) * (i + 0.5)) / N + (sorteio(sem, i, 2) - 0.5) * 0.12;
        const topo = Math.max(0, -Math.sin(th));
        const H = R * (0.4 + 0.28 * topo + 0.24 * sorteio(sem, i, 16 + g * 4));
        const W = R * (0.5 + 0.12 * sorteio(sem, i, 17 + g * 4));
        vidaDaLingua(a, H, W, R);
        eixoDaLingua(th, R, LINGUA.h, LINGUA.solta, 0.12 * onda(t, 9 + (i % 4), sorteio(sem, i, 3)));
        if (passada === 0) {
          por(s, ATRAS, NORMAL, 1, a, EIXO.x, EIXO.y, LINGUA.w, LINGUA.h, EIXO.rot, 0.95 * LINGUA.env);
        } else {
          const hm = LINGUA.h * 0.62;
          const d = (LINGUA.h - hm) * 0.42;
          por(s, ATRAS, SOMA, 2, a, EIXO.x - EIXO.ux * d, EIXO.y - EIXO.uy * d, LINGUA.w * 0.55, hm, EIXO.rot, 0.55 * LINGUA.env);
        }
      }
    }

    // brasas: sobem desacelerando, como as da fogueira
    for (let i = 0; i < 14; i += 1) {
      const a = idadeDe(t, 7, sorteio(sem, 100 + i, 1));
      const g = GER;
      const r1 = sorteio(sem, 100 + i, 10 + g * 4);
      const r2 = sorteio(sem, 100 + i, 11 + g * 4);
      const r3 = sorteio(sem, 100 + i, 12 + g * 4);
      const th = ARCO_INI + (ARCO_FIM - ARCO_INI) * r1;
      const r0 = R * (1.0 + 0.2 * r2);
      const sobe = R * (0.6 + 0.4 * r3) * (1 - (1 - a) * (1 - a));
      const x = Math.cos(th) * r0 + 0.15 * R * Math.sin(TAU * a + r2 * TAU);
      const y = Math.sin(th) * r0 - sobe;
      const tam = Math.max(1.3, R * (0.1 - 0.05 * a));
      const pisca = 0.78 + 0.22 * onda(t, 37 + i * 3, r3);
      por(s, ATRAS, SOMA, 3, a, x, y, tam, tam, 0, 0.9 * liso(0, 0.08, a) * (1 - liso(0.4, 1, a)) * pisca);
    }
  }

  // ---------------------------------------------------------------- 5. trevas

  function emitirTrevas(s, t, R, sem) {
    // a sombra respira a cada 4 s (mistura normal: escurece qualquer chão)
    const resp = 0.5 + 0.5 * onda(t, 3, 0);
    const lado = 3.5 * R * (1 + 0.06 * resp);
    por(s, ATRAS, NORMAL, 0, 0, 0, 0, lado, lado, 0, 0.62 + 0.12 * resp);

    // névoa que gira devagar e vai sendo puxada para dentro
    const giro = (-TAU * t) / PERIODO;
    for (let i = 0; i < 18; i += 1) {
      const a = idadeDe(t, 4, (i + 0.5 * sorteio(sem, i, 1)) / 18);
      const g = GER;
      const r1 = sorteio(sem, i, 10 + g * 4);
      const r2 = sorteio(sem, i, 11 + g * 4);
      const r3 = sorteio(sem, i, 12 + g * 4);
      const ang = r1 * TAU + giro + 0.5 * a;
      const r = R * (1.32 - 0.3 * a + 0.08 * r2);
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r - 0.1 * R * a;
      const tam = R * (0.5 + 0.2 * r3) * (0.85 + 0.3 * a) * (1 + 0.05 * resp);
      const env = liso(0, 0.25, a) * (1 - liso(0.6, 1, a));
      por(s, ATRAS, NORMAL, 1, a, x, y, tam, tam, r2 * TAU + 0.6 * a, 0.52 * env * (0.88 + 0.12 * resp));
    }

    // a luz em volta, puxada: devagar no começo, rápida no fim, girando como num ralo.
    // Cada ponto de luz estica na direção em que corre (mais rápido, mais comprido).
    const gross = Math.max(2.2, 0.13 * R);
    const fim = R * 1.03;
    for (let i = 0; i < 16; i += 1) {
      const a = idadeDe(t, 6, sorteio(sem, 40 + i, 1));
      const g = GER;
      const th0 = sorteio(sem, 40 + i, 10 + g * 4) * TAU;
      const r0 = R * (1.62 + 0.22 * sorteio(sem, 40 + i, 11 + g * 4));
      const voltas = 0.9 + 0.6 * sorteio(sem, 40 + i, 12 + g * 4);
      const aa = a * a;
      const r = fim + (r0 - fim) * (1 - aa);
      const th = th0 + voltas * aa;
      const x = Math.cos(th) * r;
      const y = Math.sin(th) * r;
      const dr = -2 * a * (r0 - fim);
      const dth = 2 * a * voltas;
      let vx = dr * Math.cos(th) - r * Math.sin(th) * dth;
      let vy = dr * Math.sin(th) + r * Math.cos(th) * dth;
      let vel = Math.hypot(vx, vy);
      if (vel < 1e-6) {
        vx = -Math.sin(th);
        vy = Math.cos(th);
        vel = 1;
      }
      const len = Math.max(gross, Math.min(R * 0.55, vel * 0.1));
      const env = liso(0, 0.2, a) * (1 - liso(0.86, 1, a));
      por(s, ATRAS, SOMA, 2, a, x - (vx / vel) * len * 0.3, y - (vy / vel) * len * 0.3, len, gross, Math.atan2(vy, vx), env);
    }
  }

  // ---------------------------------------------------------------- 6. elétricas

  const RAIOS_ELETRICOS = [criarRaio(), criarRaio(), criarRaio(), criarRaio(), criarRaio(), criarRaio(), criarRaio(), criarRaio()];
  /** Quanto as faíscas da amarela duram depois que o raio nasce (s). */
  const VIDA_DA_FAISCA = 0.4;
  const PONTAS = { x: new Float64Array(2), y: new Float64Array(2), th: new Float64Array(2), tl: new Float64Array(2), j: new Int32Array(2) };

  /**
   * estilo 0 (amarela): raios que SALTAM do aro para fora, com galho e faíscas.
   * estilo 1 (azul): arcos que CORREM em volta da ficha, colados no aro.
   */
  function emitirEletrica(s, t, R, sem, estilo) {
    const gross = grossuraDoRaio(R);
    let flash = 0;
    let usados = 0;

    if (estilo === 0) {
      for (let q = 0; q < 2; q += 1) {
        PONTAS.tl[q] = -1;
        const tl = eventoDe(t, sem, q, 9, 0.26, 0.16, 0);
        const dur = EV.dur;
        const j = EV.j;
        flash = Math.max(flash, clarao(t, sem, q, 9, 0.26, 0.16, 0.16));
        const th = sorteio(sem, 340 + q, j) * TAU;
        // a ponta é fixa no evento (só o meio do raio treme), para as faíscas não pularem
        const curva = (sorteio(sem, 345 + q, j) - 0.5) * 0.5;
        if (tl >= 0 && tl < VIDA_DA_FAISCA) {
          PONTAS.tl[q] = tl;
          PONTAS.th[q] = th + curva;
          PONTAS.j[q] = j;
          PONTAS.x[q] = Math.cos(th + curva) * R * 1.6;
          PONTAS.y[q] = Math.sin(th + curva) * R * 1.6;
        }
        if (!(tl >= 0 && tl < dur)) continue;
        const forma = Math.floor(tl / 0.045);
        const chave = (q * 64 + j) * 64 + forma;
        const alfa = (1 - liso(dur - 0.05, dur, tl)) * (0.85 + 0.15 * sorteio(sem, chave, 99));
        // tronco: 7 segmentos do aro até 1,6 raio
        const A = RAIOS_ELETRICOS[usados];
        usados += 1;
        for (let k = 0; k <= 7; k += 1) {
          const u = k / 7;
          const meio = k > 0 && k < 7;
          const thk = th + curva * u + (meio ? (sorteio(sem, chave, 60 + k) - 0.5) * 0.5 * u : 0);
          const rk = R * (0.98 + 0.62 * u + (meio ? (sorteio(sem, chave, 80 + k) - 0.5) * 0.1 : 0));
          A.px[k] = Math.cos(thk) * rk;
          A.py[k] = Math.sin(thk) * rk;
        }
        A.n = 7;
        A.alfa = alfa;
        A.ativo = true;
        // galho: sai do 3º ponto e abre para um lado
        const B = RAIOS_ELETRICOS[usados];
        usados += 1;
        const lado = sorteio(sem, chave, 90) < 0.5 ? -1 : 1;
        const x0 = A.px[3];
        const y0 = A.py[3];
        const th0 = Math.atan2(y0, x0);
        const r0 = Math.hypot(x0, y0);
        for (let k = 0; k <= 3; k += 1) {
          const u = k / 3;
          const thk = th0 + lado * 0.32 * u + (k > 0 ? (sorteio(sem, chave, 100 + k) - 0.5) * 0.12 : 0);
          const rk = r0 + R * 0.34 * u;
          B.px[k] = Math.cos(thk) * rk;
          B.py[k] = Math.sin(thk) * rk;
        }
        B.n = 3;
        B.alfa = alfa * 0.85;
        B.ativo = true;
      }
      // estalos curtos colados no aro, quase sempre algum aceso
      for (let q = 0; q < 3; q += 1) {
        const tl = eventoDe(t, sem, 2 + q, 16, 0.12, 0.08, 0);
        const dur = EV.dur;
        const j = EV.j;
        if (!(tl >= 0 && tl < dur)) continue;
        const A = RAIOS_ELETRICOS[usados];
        usados += 1;
        const th = sorteio(sem, 350 + q, j) * TAU;
        // por fora da moldura de latão: amarelo em cima do latão some
        arcoPolar(A, 3, th - 0.22, th + 0.22, 1.1, 0.1, 0.04, sem, (q * 64 + j) * 64 + Math.floor(tl / 0.045) + 5000, R);
        A.alfa = (1 - liso(dur - 0.04, dur, tl)) * 0.85;
        A.ativo = true;
      }
    } else {
      for (let q = 0; q < 3; q += 1) {
        const tl = eventoDe(t, sem, q, 7, 0.36, 0.18, 0);
        const dur = EV.dur;
        const j = EV.j;
        flash = Math.max(flash, clarao(t, sem, q, 7, 0.36, 0.18, 0.2));
        if (!(tl >= 0 && tl < dur)) continue;
        const A = RAIOS_ELETRICOS[usados];
        usados += 1;
        const sentido = sorteio(sem, 360 + q, j) < 0.5 ? -1 : 1;
        const centro = sorteio(sem, 370 + q, j) * TAU + sentido * 2.6 * tl;
        const meio = 0.45 + 0.25 * sorteio(sem, 380 + q, j);
        arcoPolar(A, 8, centro - meio, centro + meio, 1.05, 0.15, 0.05, sem, (q * 64 + j) * 64 + Math.floor(tl / 0.04), R);
        A.alfa = (1 - liso(dur - 0.08, dur, tl)) * (0.88 + 0.12 * sorteio(sem, j, 7 + q));
        A.ativo = true;
      }
      const tl = eventoDe(t, sem, 3, 24, 0.08, 0.05, 0);
      if (tl >= 0 && tl < EV.dur) {
        const A = RAIOS_ELETRICOS[usados];
        usados += 1;
        const th = sorteio(sem, 390, EV.j) * TAU;
        arcoPolar(A, 3, th - 0.18, th + 0.18, 1.01, 0.07, 0.04, sem, EV.j * 64 + Math.floor(tl / 0.04) + 7000, R);
        A.alfa = (1 - liso(EV.dur - 0.03, EV.dur, tl)) * 0.8;
        A.ativo = true;
      }
    }

    // brilho: uma luz baixa que clareia quando estala
    const base = estilo === 0 ? 0.2 : 0.26;
    por(s, ATRAS, NORMAL, 0, 0, 0, 0, 3.5 * R, 3.5 * R, 0, base + 0.24 * flash);

    if (estilo === 1) {
      // carga parada: pontinhos que piscam em volta (atrás)
      for (let i = 0; i < 8; i += 1) {
        const a = idadeDe(t, 12, sorteio(sem, 120 + i, 1));
        const g = GER;
        const th = sorteio(sem, 120 + i, 10 + g * 3) * TAU + 0.8 * a;
        const r = R * (1.12 + 0.35 * sorteio(sem, 120 + i, 11 + g * 3));
        const brilha = Math.pow(Math.sin(Math.PI * a), 2);
        const tam = Math.max(1.3, 0.075 * R);
        por(s, ATRAS, SOMA, 3, 0.4, Math.cos(th) * r, Math.sin(th) * r, tam, tam, 0, 0.75 * brilha);
      }
    }

    // faixa colorida (normal, lê na grama) e miolo claro (somado), na frente da ficha
    for (let passada = 0; passada < 2; passada += 1) {
      for (let k = 0; k < usados; k += 1) {
        const A = RAIOS_ELETRICOS[k];
        if (passada === 0) porSegmentos(s, FRENTE, NORMAL, 1, 0, A, gross * 6, 0.55 * A.alfa);
        else porSegmentos(s, FRENTE, SOMA, 2, 0.15, A, gross * 4.7, 0.97 * A.alfa);
      }
    }

    if (estilo === 0) {
      // faíscas que espirram da ponta do raio e duram um pouco mais que ele
      for (let q = 0; q < 2; q += 1) {
        const tl = PONTAS.tl[q];
        if (tl < 0) continue;
        const idade = tl / VIDA_DA_FAISCA;
        for (let f = 0; f < 5; f += 1) {
          const dir = PONTAS.th[q] + (sorteio(sem, 500 + q * 8 + f, PONTAS.j[q]) - 0.5) * 1.5;
          const alcance = R * (0.25 + 0.3 * sorteio(sem, 520 + q * 8 + f, PONTAS.j[q]));
          const d = alcance * idade * (2 - idade);
          const tam = Math.max(1.2, R * 0.07 * (1 - 0.5 * idade));
          por(s, FRENTE, SOMA, 3, idade, PONTAS.x[q] + Math.cos(dir) * d, PONTAS.y[q] + Math.sin(dir) * d, tam, tam, 0, 0.95 * (1 - idade));
        }
      }
    }
  }

  // ---------------------------------------------------------------- 7. vermelha rebelde

  /** Estouros fora de ritmo: 5 por laço, cada um sobe em 60 ms e cai em 0,4 s. */
  function surto(t, sem) {
    const E = 5;
    const janela = PERIODO / E;
    const j = Math.floor(t / janela);
    let v = 0;
    for (let d = 0; d <= 1; d += 1) {
      const jj = j - d;
      const jm = ((jj % E) + E) % E;
      const inicio = jj * janela + janela * 0.75 * sorteio(sem, 400, jm);
      const forca = 0.6 + 0.4 * sorteio(sem, 401, jm);
      const tl = t - inicio;
      if (tl < 0) continue;
      v = Math.max(v, forca * (tl < 0.06 ? tl / 0.06 : Math.exp(-(tl - 0.06) / 0.4)));
    }
    return v;
  }

  function intensidadeVermelha(t, sem) {
    const w = 0.5 + 0.22 * onda(t, 7, 0.1) + 0.16 * onda(t, 17, 0.37) + 0.12 * onda(t, 29, 0.71);
    return 0.45 * w + 0.75 * surto(t, sem);
  }

  function emitirVermelha(s, t, R, sem) {
    const I = intensidadeVermelha(t, sem);
    const Ic = Math.min(1, I);
    const lado = 3.5 * R * (1 + 0.05 * I);
    por(s, ATRAS, NORMAL, 0, 0, 0, -0.06 * R, lado, lado * 1.04, 0, 0.28 + 0.26 * Ic);

    const N = 20;
    // passada 0: corpo vermelho de todas as pontas; 1: miolo claro de todas
    for (let passada = 0; passada < 2; passada += 1) {
      for (let i = 0; i < N; i += 1) {
        const a = idadeDe(t, 24 + (i % 4) * 2, sorteio(sem, i, 1));
        const g = GER;
        const th = (TAU * (i + 0.5)) / N + (sorteio(sem, i, 16 + g * 4) - 0.5) * 0.22;
        const ox = Math.cos(th);
        const oy = Math.sin(th);
        let ux = ox;
        let uy = oy - 0.85;
        const n = Math.hypot(ux, uy) || 1;
        ux /= n;
        uy /= n;
        const topo = Math.max(0, -oy);
        // pontas compridas e curtas alternadas: a silhueta fica serrilhada
        const base = i % 2 === 0 ? 0.34 + 0.24 * sorteio(sem, i, 17 + g * 4) : 0.2 + 0.14 * sorteio(sem, i, 17 + g * 4);
        const Lmax = R * base * (0.75 + 0.35 * I) * (1 + 0.3 * topo);
        // estala para fora rápido e recolhe devagar
        const ext = a < 0.18 ? 1 - Math.pow(1 - a / 0.18, 3) : 1 - 0.6 * liso(0.18, 1, a);
        const h = Lmax * ext;
        const w = R * (0.28 + 0.1 * sorteio(sem, i, 18 + g * 4)) * (1 - 0.35 * liso(0.3, 1, a));
        const cx = ox * R * 0.97 + ux * h * 0.46;
        const cy = oy * R * 0.97 + uy * h * 0.46;
        const rot = Math.atan2(ux, -uy);
        const env = liso(0, 0.04, a) * (1 - liso(0.55, 1, a));
        if (passada === 0) {
          por(s, ATRAS, NORMAL, 1, a * 0.85, cx, cy, w, h, rot, 0.92 * env);
        } else {
          const hm = h * 0.68;
          const d = (h - hm) * 0.44;
          por(s, ATRAS, SOMA, 2, a * 0.8, cx - ux * d, cy - uy * d, w * 0.5, hm, rot, (0.6 + 0.4 * Ic) * env);
        }
      }
    }

    // riscos que disparam para fora, mais nos estouros (decidido na hora em que nascem)
    const gross = Math.max(0.9, 0.035 * R) * 4.7;
    for (let i = 0; i < 12; i += 1) {
      const k = 30;
      const a = idadeDe(t, k, sorteio(sem, 200 + i, 1));
      const g = GER;
      const nasceu = t - (a * PERIODO) / k;
      if (sorteio(sem, 200 + i, 10 + g * 3) > 0.25 + 0.6 * Math.min(1, intensidadeVermelha(nasceu, sem))) continue;
      const th = sorteio(sem, 200 + i, 11 + g * 3) * TAU;
      const r = R * (1.06 + 0.62 * a);
      const len = R * 0.34 * (1 - 0.6 * a);
      por(s, FRENTE, SOMA, 3, a, Math.cos(th) * r, Math.sin(th) * r, (len * 64) / 48, gross, th, 0.8 * Math.pow(1 - a, 1.5));
    }
  }

  // ---------------------------------------------------------------- 8. multicolorida

  function emitirMulticolorida(s, t, R, sem) {
    const giro = (TAU * t) / PERIODO;
    por(s, ATRAS, NORMAL, 0, (t / PERIODO) % 1, 0, 0, 3.5 * R, 3.5 * R, 0, 0.24);

    const N = 22;
    const ondaDoBrilho = (-TAU * 3 * t) / PERIODO;
    const fita = R * 0.3;
    const linha = Math.max(0.9, 0.05 * R) * 4.7;
    // passada 0: a fita de cores (normal, borda mais escura: lê no escuro e na grama);
    // passada 1: o brilho que corre ao contrário por cima dela (somado)
    for (let passada = 0; passada < 2; passada += 1) {
      for (let j = 0; j < N; j += 1) {
        const f0 = (TAU * j) / N;
        const f1 = (TAU * (j + 1)) / N;
        const r0 = R * (1.22 + 0.05 * Math.sin(3 * f0 - (TAU * 2 * t) / PERIODO));
        const r1 = R * (1.22 + 0.05 * Math.sin(3 * f1 - (TAU * 2 * t) / PERIODO));
        const x0 = Math.cos(f0 + giro) * r0;
        const y0 = Math.sin(f0 + giro) * r0;
        const x1 = Math.cos(f1 + giro) * r1;
        const y1 = Math.sin(f1 + giro) * r1;
        const corda = Math.hypot(x1 - x0, y1 - y0);
        const rot = Math.atan2(y1 - y0, x1 - x0);
        const cor = (j + 0.5) / N;
        if (passada === 0) {
          por(s, ATRAS, NORMAL, 1, cor, (x0 + x1) / 2, (y0 + y1) / 2, ((corda * 64) / 48) * 1.2, fita, rot, 0.78);
        } else {
          const meio = (f0 + f1) / 2 + giro;
          const d1 = Math.min(Math.PI / 2, anguloEntre(meio, ondaDoBrilho));
          const d2 = Math.min(Math.PI / 2, anguloEntre(meio, ondaDoBrilho + Math.PI));
          const brilho = Math.pow(Math.cos(d1), 6) + 0.45 * Math.pow(Math.cos(d2), 6);
          por(s, ATRAS, SOMA, 2, cor, (x0 + x1) / 2, (y0 + y1) / 2, ((corda * 64) / 48) * 1.1, linha, rot, 0.8 * brilho);
        }
      }
    }

    // faíscas pequenas que piscam uma vez cada, girando com o anel
    for (let i = 0; i < 12; i += 1) {
      const a = idadeDe(t, 8, sorteio(sem, 60 + i, 1));
      const g = GER;
      const r1 = sorteio(sem, 60 + i, 10 + g * 3);
      const r2 = sorteio(sem, 60 + i, 11 + g * 3);
      const r3 = sorteio(sem, 60 + i, 12 + g * 3);
      const ang = r1 * TAU + giro;
      const r = R * (1.12 + 0.48 * r2);
      const pisca = Math.pow(Math.sin(Math.PI * a), 3);
      const tam = Math.max(3, R * 0.24 * (0.55 + 0.45 * pisca));
      por(s, FRENTE, SOMA, 3, r3, Math.cos(ang) * r, Math.sin(ang) * r, tam, tam, 0.4 * a + r3, 0.85 * pisca);
    }
  }

  // ---------------------------------------------------------------- rampas de cor

  /** Listas de cor (de 0 a 1 na rampa) ou anel de matiz OKLCH (volta = a rampa dá a volta). */
  const RAMPAS = {
    almasBrilho: ['#7c50d8'],
    almas: ['#bb9cff', '#9c6ef2', '#8150da', '#6538b9', '#4a2794'],
    almasLuz: ['#f3ebff', '#d6c0ff', '#a983ec'],

    negrasBrilho: ['#7d3fe6'],
    negrasBorda: ['#a971ff', '#8c4cf2', '#6f31d2', '#4f1f98'],
    negrasMiolo: ['#0b0611', '#120a1a', '#1c1028', '#2b193b'],
    negrasBrasa: ['#ecdcff', '#b07cff', '#6a33bf'],

    misturaBrilho: ['#ff7a3a', '#c650ff'],
    // duas metades: 0 a 0,4 a língua laranja, 0,6 a 1 a roxa (o meio não é usado)
    misturaCorpo: ['#f4b25e', '#e98a3e', '#cf5d3c', '#a978ff', '#8448ee', '#6430c8'],
    misturaMiolo: ['#fff1cc', '#ffcf86', '#f59a62', '#f1e4ff', '#d0a8ff', '#a06cf0'],
    raioFaixa: ['#7a35e0'],
    raioNucleo: ['#f6eeff', '#d4b0ff'],
    misturaFaisca: ['#ffd9a0', '#ff9a5a', '#d58bff', '#9a52ff'],

    // a paleta da fogueira aprovada (docs/design/objeto-fogo)
    fogoBrilho: ['#e38a3e'],
    fogoCorpo: ['#eea65a', '#e39446', '#c4683a', '#a04a2c', '#7c3622'],
    fogoMiolo: ['#fff2d2', '#f6dca8', '#f0c98a', '#e39446'],
    fogoBrasa: ['#fff2d2', '#f6c27a', '#e3823f', '#a04a2c'],

    trevasBrilho: ['#07050b'],
    trevasNevoa: ['#151020', '#0d0a14', '#07050b'],
    trevasLuz: ['#f1edff', '#bdb1f2', '#7464b8', '#352c5c'],

    amarelaBrilho: ['#ffcc33'],
    amarelaFaixa: ['#d99a0e'],
    amarelaNucleo: ['#ffffff', '#fff6c4', '#ffe27a'],
    amarelaFaisca: ['#fffbe8', '#ffe066', '#ffae1f'],

    azulBrilho: ['#3d9bff'],
    azulFaixa: ['#1f6fe0'],
    azulNucleo: ['#ffffff', '#e0f4ff', '#a3daff'],
    azulFaisca: ['#f2fbff', '#90d4ff', '#2f86ff'],

    vermelhaBrilho: ['#ff2d2d'],
    vermelhaCorpo: ['#ff5a44', '#e8262e', '#b3121f', '#7a0a17', '#4e0610'],
    vermelhaMiolo: ['#ffe2d4', '#ff9c7c', '#ff5c3e'],
    vermelhaRisco: ['#ffd3c4', '#ff6c4c', '#cc1f2a'],

    // cores suaves (claridade alta, croma baixo): arco-íris sem cara de brinquedo
    prismaBrilho: { passos: 24, volta: true, oklch: [0.86, 0.06] },
    prisma: { passos: 24, volta: true, oklch: [0.8, 0.13] },
    prismaLuz: { passos: 24, volta: true, oklch: [0.93, 0.07] },
    prismaFaisca: ['#ffffff', '#f4efff', '#eaf6ff'],
  };

  function hexParaRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function oklchParaRgb(L, C, graus) {
    const h = (graus * Math.PI) / 180;
    const a = C * Math.cos(h);
    const b = C * Math.sin(h);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    return lin.map((x) => {
      const v = Math.max(0, Math.min(1, x));
      return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    });
  }

  function passosDaRampa(nome) {
    const r = RAMPAS[nome];
    if (!Array.isArray(r)) return r.passos;
    return r.length === 1 ? 1 : 16;
  }

  function rampaDaVolta(nome) {
    return !Array.isArray(RAMPAS[nome]);
  }

  /** Cor (r, g, b de 0 a 1) no ponto `u` da rampa. */
  function corDaRampa(nome, u) {
    const r = RAMPAS[nome];
    if (!Array.isArray(r)) return oklchParaRgb(r.oklch[0], r.oklch[1], (((u % 1) + 1) % 1) * 360 + 15);
    if (r.length === 1) return hexParaRgb(r[0]);
    const p = Math.max(0, Math.min(1, u)) * (r.length - 1);
    const i = Math.min(r.length - 2, Math.floor(p));
    const f = p - i;
    const a = hexParaRgb(r[i]);
    const b = hexParaRgb(r[i + 1]);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
  }

  // ---------------------------------------------------------------- formas (texturas)

  /** Textura cinza com alfa, pixel a pixel. lum = quanto da cor do tint (1 = ela inteira). */
  function criarForma(w, h, fn) {
    const lum = new Float32Array(w * h);
    const alfa = new Float32Array(w * h);
    const o = [1, 0];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        o[0] = 1;
        o[1] = 0;
        fn(x + 0.5, y + 0.5, o);
        lum[y * w + x] = o[0];
        alfa[y * w + x] = o[1] < 0 ? 0 : o[1] > 1 ? 1 : o[1];
      }
    }
    return { w, h, lum, alfa };
  }

  function distanciaAoSegmento(x, y) {
    const px = Math.max(8, Math.min(56, x));
    return Math.hypot(x - px, y - 8);
  }

  const FORMAS = {
    /** Disco macio (o mesmo da bolha do particulasDoMapa). */
    ponto: criarForma(32, 32, (x, y, o) => {
      const d = Math.min(1, Math.hypot(x - 16, y - 16) / 16);
      o[1] = (1 - d) * (1 - d);
    }),
    /** Ponto com miolo duro: brasa, faísca. */
    nucleo: criarForma(32, 32, (x, y, o) => {
      const d = Math.min(1, Math.hypot(x - 16, y - 16) / 16);
      o[1] = Math.min(1, Math.exp(-((d / 0.17) ** 2)) + 0.45 * (1 - d) ** 2.5);
    }),
    /** Língua de fogo em pé: fundo redondo, ponta fina um pouco torta. */
    lingua: criarForma(48, 96, (x, y, o) => {
      const vv = (1 - y / 96 - 0.04) / 0.94;
      if (vv <= 0 || vv >= 1) return;
      const u = (vv - 0.24) / 0.76;
      const hw = vv < 0.24 ? 0.92 * Math.sqrt(Math.max(0, 1 - ((0.24 - vv) / 0.24) ** 2)) : 0.92 * Math.pow(Math.max(0, 1 - Math.pow(u, 1.4)), 0.9) * (1 - 0.25 * u);
      const cx = 0.1 * Math.sin(vv * Math.PI * 1.2) * vv;
      const e = Math.abs((x - 24) / 24 - cx) / Math.max(hw, 1e-3);
      o[1] = (1 - liso(0.55, 1, e)) * (1 - liso(0.86, 1, vv)) * liso(0, 0.07, vv);
    }),
    /** Alma: cabeça redonda com olhos fundos e um rabo curto (o resto do rabo é o rastro). */
    alma: criarForma(48, 64, (x, y, o) => {
      let a = 1 - liso(0.62, 1, Math.hypot(x - 24, y - 20) / 14);
      if (y > 20) {
        const u = (y - 20) / 42;
        if (u < 1) {
          const hw = 14 * Math.pow(1 - u, 1.35);
          const cx = 24 + 3.2 * Math.sin(u * Math.PI);
          const e = Math.abs(x - cx) / Math.max(hw, 0.01);
          a = Math.max(a, (1 - liso(0.5, 1, e)) * (1 - 0.65 * u));
        }
      }
      o[1] = a;
      const olho = Math.min(Math.hypot((x - 18.8) / 2.9, (y - 19.5) / 3.9), Math.hypot((x - 29.2) / 2.9, (y - 19.5) / 3.9));
      o[0] = 1 - 0.88 * (1 - liso(0.7, 1.05, olho));
    }),
    /** Traço de raio: miolo fino e halo, deitado no eixo x (a cápsula ocupa de 8 a 56). */
    traco: criarForma(64, 16, (x, y, o) => {
      const d = distanciaAoSegmento(x, y);
      const nuc = Math.exp(-((d / 1.7) ** 2));
      const halo = 0.42 * Math.exp(-((d / 5) ** 2));
      o[1] = Math.min(1, nuc + halo) * (1 - liso(6.5, 8, d));
      o[0] = (nuc + halo * 0.62) / Math.max(1e-4, nuc + halo);
    }),
    /** Faixa macia por baixo do raio (mistura normal): é ela que dá cor ao raio na grama. */
    faixa: criarForma(64, 16, (x, y, o) => {
      o[1] = 1 - liso(1.5, 7.5, distanciaAoSegmento(x, y));
    }),
    /** Fita: miolo cheio da cor e borda mais escura (lum 0,5), deitada no eixo x como o traço. */
    fita: criarForma(64, 16, (x, y, o) => {
      // a borda escura é só nas laterais: nas pontas a fita só some, sem costura escura na emenda
      const dy = Math.abs(y - 8);
      const foraDaPonta = Math.max(0, Math.abs(x - 32) - 24);
      o[1] = (1 - liso(4.5, 7.6, dy)) * (1 - liso(0, 8, foraDaPonta));
      o[0] = 1 - 0.5 * liso(1.5, 6, dy);
    }),
    /** Ponta de energia: fina e afiada. */
    espinho: criarForma(32, 96, (x, y, o) => {
      const vv = (1 - y / 96 - 0.03) / 0.95;
      if (vv <= 0 || vv >= 1) return;
      const hw = 0.95 * Math.pow(1 - vv, 1.25) * Math.sqrt(liso(-0.02, 0.12, vv));
      const e = Math.abs((x - 16) / 16) / Math.max(hw, 1e-3);
      o[1] = (1 - liso(0.5, 1, e)) * (1 - liso(0.9, 1, vv));
    }),
    /** Estrela de 4 pontas, pequena. */
    estrela: criarForma(48, 48, (x, y, o) => {
      const dx = x - 24;
      const dy = y - 24;
      const r = Math.hypot(dx, dy);
      const bh = Math.exp(-((dy / 1.3) ** 2)) * Math.pow(Math.max(0, 1 - Math.abs(dx) / 23), 2.2);
      const bv = Math.exp(-((dx / 1.3) ** 2)) * Math.pow(Math.max(0, 1 - Math.abs(dy) / 23), 2.2);
      o[1] = Math.min(1, bh + bv + Math.exp(-((r / 3.2) ** 2)) + 0.25 * Math.exp(-((r / 8) ** 2)));
    }),
    /** Tufo de névoa de borda irregular. */
    nevoa: criarForma(64, 64, (x, y, o) => {
      const dx = x - 32;
      const dy = y - 32;
      const r = Math.hypot(dx, dy) / 32;
      const f = Math.atan2(dy, dx);
      const borda = 0.8 + 0.08 * Math.sin(3 * f + 1.3) + 0.06 * Math.sin(5 * f + 0.4) + 0.04 * Math.sin(9 * f + 2.1);
      const miolo = 0.82 + 0.18 * Math.sin(x * 0.33 + 2 * Math.sin(y * 0.21)) * Math.sin(y * 0.29 + 1.1);
      o[1] = (1 - liso(0.3, borda, r)) * miolo * (1 - liso(0.9, 1, r));
    }),
    /** O brilho: anel com pico em 1,05 raio da ficha (a borda da textura é 1,75 raio). */
    anel: criarForma(96, 96, (x, y, o) => {
      const p = Math.hypot(x - 48, y - 48) / 48;
      const s = p < 0.6 ? 0.12 : 0.2;
      o[1] = Math.exp(-(((p - 0.6) / s) ** 2)) * (1 - liso(0.86, 1, p));
    }),
  };

  // ---------------------------------------------------------------- as nove

  const AURAS = [
    {
      id: 'almas-roxas',
      nome: 'Almas roxas',
      frase: 'Almas roxas saem do chão em volta da ficha, sobem fazendo curva e somem no alto.',
      pinceis: [['anel', 'almasBrilho'], ['ponto', 'almas'], ['alma', 'almas'], ['ponto', 'almasLuz'], ['nucleo', 'almasLuz']],
      emitir: emitirAlmas,
    },
    {
      id: 'chamas-negras',
      nome: 'Chamas negras',
      frase: 'Fogo preto de borda roxa, lambendo para cima, com uma luz violeta por trás.',
      pinceis: [['anel', 'negrasBrilho'], ['lingua', 'negrasBorda'], ['lingua', 'negrasMiolo'], ['nucleo', 'negrasBrasa']],
      emitir: emitirChamasNegras,
    },
    {
      id: 'fogo-raios-roxos',
      nome: 'Fogo e raios roxos',
      frase: 'Fogo laranja com raios roxos correndo por dentro. Por onde o raio passa, a chama fica roxa.',
      pinceis: [['anel', 'misturaBrilho'], ['lingua', 'misturaCorpo'], ['lingua', 'misturaMiolo'], ['faixa', 'raioFaixa'], ['traco', 'raioNucleo'], ['nucleo', 'misturaFaisca']],
      emitir: emitirFogoERaios,
      raios: [3, 4],
    },
    {
      id: 'fogo',
      nome: 'Fogo',
      frase: 'Fogo natural, nas cores da fogueira do mapa: miolo claro, línguas laranja e brasas subindo.',
      pinceis: [['anel', 'fogoBrilho'], ['lingua', 'fogoCorpo'], ['lingua', 'fogoMiolo'], ['nucleo', 'fogoBrasa']],
      emitir: emitirFogo,
    },
    {
      id: 'trevas',
      nome: 'Trevas',
      frase: 'Uma névoa escura que respira devagar e puxa para dentro a luz em volta.',
      pinceis: [['anel', 'trevasBrilho'], ['nevoa', 'trevasNevoa'], ['nucleo', 'trevasLuz']],
      emitir: emitirTrevas,
    },
    {
      id: 'eletrica-amarela',
      nome: 'Elétrica amarela',
      frase: 'Raios amarelos que estalam e saltam da ficha para fora, soltando faíscas.',
      pinceis: [['anel', 'amarelaBrilho'], ['faixa', 'amarelaFaixa'], ['traco', 'amarelaNucleo'], ['nucleo', 'amarelaFaisca']],
      emitir: (s, t, R, sem) => emitirEletrica(s, t, R, sem, 0),
      raios: [1, 2],
    },
    {
      id: 'eletrica-azul',
      nome: 'Elétrica azul',
      frase: 'Arcos azuis que correm em volta da ficha, colados nela, sobre uma luz fria constante.',
      pinceis: [['anel', 'azulBrilho'], ['faixa', 'azulFaixa'], ['traco', 'azulNucleo'], ['nucleo', 'azulFaisca']],
      emitir: (s, t, R, sem) => emitirEletrica(s, t, R, sem, 1),
      raios: [1, 2],
    },
    {
      id: 'vermelha',
      nome: 'Vermelha rebelde',
      frase: 'Energia vermelha em pontas que estouram fora de ritmo. Intensa, quase agressiva.',
      pinceis: [['anel', 'vermelhaBrilho'], ['espinho', 'vermelhaCorpo'], ['espinho', 'vermelhaMiolo'], ['traco', 'vermelhaRisco']],
      emitir: emitirVermelha,
    },
    {
      id: 'multicolorida',
      nome: 'Multicolorida',
      frase: 'Um anel de cores suaves que gira devagar, com um brilho que corre ao contrário e faíscas pequenas.',
      pinceis: [['anel', 'prismaBrilho'], ['fita', 'prisma'], ['traco', 'prismaLuz'], ['estrela', 'prismaFaisca']],
      emitir: emitirMulticolorida,
    },
  ];

  const POR_ID = {};
  for (const aura of AURAS) POR_ID[aura.id] = aura;

  /** O quadro do tempo t. Escreve em `saida` e devolve quantos itens ela tem. */
  function estadoDaAura(tipo, t, raio, semente, saida) {
    saida.n = 0;
    saida.particulas = 0;
    saida.brilhos = 0;
    saida.cortadas = 0;
    const aura = POR_ID[tipo];
    if (!aura) return 0;
    aura.emitir(saida, ((t % PERIODO) + PERIODO) % PERIODO, raio, semente | 0);
    return saida.n;
  }

  const POSES = {};
  const MAXIMOS = {};

  /**
   * O quadro parado (movimento reduzido e miniatura do menu): o instante mais
   * cheio do laço, pesando os raios (são finos, mas são a cara das elétricas).
   */
  function poseDaAura(tipo, semente) {
    const chave = tipo + ':' + semente;
    if (POSES[chave] !== undefined) return POSES[chave];
    const aura = POR_ID[tipo];
    const s = criarSaida();
    const pesoDoRaio = {};
    for (const p of aura.raios || []) pesoDoRaio[p] = 6;
    let melhor = 0;
    let melhorT = 0;
    let maximo = 0;
    for (let k = 0; k < 360; k += 1) {
      const t = (k * PERIODO) / 360;
      estadoDaAura(tipo, t, 30, semente, s);
      maximo = Math.max(maximo, s.particulas);
      let nota = 0;
      for (let i = 0; i < s.n; i += 1) {
        const it = s.itens[i];
        if (it.pincel === 0) continue;
        nota += it.alfa * Math.sqrt(it.w * it.h) * (pesoDoRaio[it.pincel] || 1);
      }
      if (nota > melhor) {
        melhor = nota;
        melhorT = t;
      }
    }
    POSES[chave] = melhorT;
    MAXIMOS[chave] = maximo;
    return melhorT;
  }

  /** Quantas partículas a aura usa no quadro mais cheio do laço (amostrado a cada 1/30 s). */
  function maximoDeParticulas(tipo, semente) {
    poseDaAura(tipo, semente);
    return MAXIMOS[tipo + ':' + semente];
  }

  raiz.Auras = {
    PERIODO,
    MAX_PARTICULAS,
    ATRAS,
    FRENTE,
    NORMAL,
    SOMA,
    LISTA: AURAS,
    POR_ID,
    RAMPAS,
    FORMAS,
    sorteio,
    criarSaida,
    estadoDaAura,
    poseDaAura,
    maximoDeParticulas,
    corDaRampa,
    passosDaRampa,
    rampaDaVolta,
  };
})(typeof window !== 'undefined' ? window : globalThis);
