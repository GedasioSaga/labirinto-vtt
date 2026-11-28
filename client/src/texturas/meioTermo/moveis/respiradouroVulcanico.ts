/**
 * RESPIRADOURO VULCÂNICO (lote L09 do plano de arte por tema, 28/11/2026, `docs/design/arte-temas/PLANO.md`; tema
 * Lava): a boca por onde o chão de lava respira. De cima com volume: a CROSTA de basalto em volta, rachada em placas,
 * com a beira roída que some no chão; as LÍNGUAS de lava que desceram e endureceram em cordas; o CONE baixo, com a
 * encosta acesa do lado de cima à esquerda; a CRATERA no alto (a beira, a parede de dentro, que pega a luz ao
 * contrário da encosta, e a GARGANTA no fundo). O ENXOFRE gruda em crosta na beira e na parede, mais do lado do vento.
 *
 * As duas versões (a mesma pegada, o mesmo cone):
 * - ATIVO: a lava acesa na garganta (vinho na beira, laranja no meio, as ilhas de crosta boiando), o clarão que ela
 *   joga na cratera, a língua que ainda corre por dentro e as rachaduras da crosta com a brasa. O VAPOR é do animador
 *   `vapor` (`lib/mobilia/animadores.ts`), com o pivô no meio da garganta (`ANIMACAO_DO_RESPIRADOURO_VULCANICO`): os
 *   fios sobem dela e somem; a imagem não tem peça que mexe;
 * - ADORMECIDO: a garganta tampada pela lava que esfriou, com a brasa funda só nas frestas do meio; mais enxofre e as
 *   rachaduras da crosta escuras. Não solta vapor.
 *
 * NA 3/4, como o caldeirão (`caldeirao.ts`), as estruturas são PINOS cravados no meio das peças que sobem: o cone sobe
 * um pouco e a cratera sobe mais; a crosta e as línguas ficam no chão (o meio da crosta foge um nada do meio do cone,
 * para nenhum pino cair nele). As línguas saem dos lados e de trás: na frente, o cone subido deixaria um vão entre ele
 * e a língua.
 *
 * Na 1ª folha (28/11/2026) o cone era uma elipse de bisel largo e lia bola escura (uma bomba), as escorridas em raio
 * liam pernas e o enxofre em contas lia um anel de pílulas: a cratera é desenhada pela luz da encosta e da parede.
 *
 * O desenho é feito numa casa (56 x 56 px) e escala com o menor lado. Sem material no painel: o basalto, a lava e o
 * enxofre são fixos (a rocha da lava, como a rocha vulcânica dos carimbos).
 */
import type { Rgb } from '../../ruido'
import type { AnimacaoDoMovel } from '../../../lib/mobilia/animadores'
import { anel, cadeia, elipse, elipseGirada, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, type Cena, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { ContextoDoMovel, MontarMovel } from './contexto'

/** O lado do desenho (px do protótipo): uma casa. */
const LADO_DO_DESENHO = 56
const GRAUS = Math.PI / 180

// ---------- as medidas (px do desenho, meio da pegada em 0, 0) ----------

/** A crosta: os raios e o meio, que foge um nada do meio do cone (nenhum pino cai nele). */
const CROSTA = { x: 0.7, y: 0.9, rx: 25.5, ry: 21, beira: 0.88, recorte: 0.14, esfumado: 0.08 }
/** O pé do cone baixo. */
const CONE = { rx: 17.5, ry: 16.5 }
/** A cratera, um nada para trás do meio: a beira (o alto do cone) e a garganta no fundo. */
const BOCA_Y = -0.8
const BEIRA = { rx: 10.4, ry: 9.8 }
const GARGANTA = { rx: 6, ry: 5.5 }
/**
 * Quanto o cone e a cratera sobem na 3/4 (px do desenho). A crosta é mais larga que alta (21 de raio em y): subido, o
 * cone passa da beira de cima dela, e a 3/4 mostra a cratera no alto do morrinho.
 */
const ALTURA_DO_CONE = 5.5
const ALTURA_DA_BOCA = 10
/** O raio do pino (px do desenho): um décimo de px, só o meio exato da peça cai nele. */
const RAIO_DO_PINO = 0.1
/**
 * Um pino a mais na altura da boca, sem peça, ao sul do pino do cone (px do desenho, para a frente do meio): a 3/4
 * pinta as estruturas do norte para o sul (`tresQuartos.ts`), e a cratera tem de vir depois do cone, por cima dele.
 */
const PINO_AO_SUL_DA_BOCA = 1.5
/**
 * As línguas de lava endurecida no pé do cone: o ângulo (graus, 0 = direita, 90 = frente), quanto passam do pé e a
 * largura (px). Dos lados e de trás (ver o cabeçalho); a primeira é a que ainda corre no Ativo.
 */
const LINGUAS: readonly (readonly [number, number, number])[] = [
  [196, 5.5, 4.4],
  [334, 4, 3.6],
  // Nenhuma bem atrás: passaria do alto do cone, e a 3/4 não teria o que subir (o tampo é o pixel mais alto).
  [226, 3.2, 3.2],
]
/** As rachaduras da crosta: o ângulo de saída (graus) e a volta que elas dão. */
const RACHADURAS: readonly (readonly [number, number])[] = [
  [8, 9],
  [72, -12],
  [131, 10],
  [196, -8],
  [252, 11],
  [312, -10],
]
/** Os respingos de lava que esfriaram na crosta (o Ativo cospe): x, y e tamanho (px). */
const RESPINGOS: readonly (readonly [number, number, number])[] = [
  [-19.5, -6.5, 1.2],
  [14.5, -15.5, 1],
  [19.5, 10, 1.3],
]
/** Onde o enxofre junta (o lado do vento, para cima à esquerda): o peso dele e quanto a mais no Adormecido. */
const VENTO = { x: -0.8, y: -0.6, peso: 0.35 }
const ENXOFRE_A_MAIS = 0.16

// ---------- as cores (fixas) ----------

const BASALTO: MaterialDaPeca = { classe: 'pedra', rgb: [0x4e, 0x48, 0x44], pedra: 'granito' }
const BASALTO_DO_CONE: MaterialDaPeca = { classe: 'pedra', rgb: [0x62, 0x5a, 0x53], pedra: 'granito' }
const LAVA_FRIA: MaterialDaPeca = { classe: 'liso', rgb: [0x53, 0x4c, 0x47] }
const LUZ_DA_BEIRA: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x84, 0x7a] }
const FRESTA: MaterialDaPeca = { classe: 'liso', rgb: [0x34, 0x2e, 0x2c] }
const ENXOFRE: Rgb = [0xa8, 0x9a, 0x5c]
const ENXOFRE_CLARO: Rgb = [0xcc, 0xc0, 0x8c]
const RESPINGO: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x40, 0x38] }
/** A lava: a beira funda, o meio e o claro; a crosta que boia nela; o clarão na cratera. */
const LAVA_FUNDA: Rgb = [0x7a, 0x36, 0x26]
const LAVA: Rgb = [0xc4, 0x6a, 0x3e]
const LAVA_CLARA: Rgb = [0xdc, 0xaa, 0x7e]
const CROSTA_DA_LAVA: Rgb = [0x46, 0x3c, 0x36]
const BRASA_FUNDA_RGB: Rgb = [0x8a, 0x40, 0x2c]
const CLARAO: MaterialDaPeca = { classe: 'liso', rgb: [0xc8, 0x78, 0x48] }
const BRASA_NA_FRESTA: MaterialDaPeca = { classe: 'liso', rgb: [0xc4, 0x7a, 0x4c] }
const BRASA_FUNDA: MaterialDaPeca = { classe: 'liso', rgb: BRASA_FUNDA_RGB }
/** O escuro em que o pixel escuro demais é levantado: o do basalto (o da nogueira avermelhava a sombra). */
const ESCURO_DO_BASALTO: Rgb = [0x40, 0x3b, 0x38]

// ---------- ajudantes ----------

function limitar(t: number, a: number, b: number): number {
  return t < a ? a : t > b ? b : t
}

function suave(a: number, b: number, t: number): number {
  const u = limitar((t - a) / (b - a), 0, 1)
  return u * u * (3 - 2 * u)
}

function entre(a: Rgb, b: Rgb, t: number): Rgb {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}

/** De 1 (virado para a luz, em cima à esquerda) a -1 (virado para lá), para a direção (dx, dy) que sai do meio. */
function voltadoParaALuz(dx: number, dy: number): number {
  return -(dx + dy) / ((Math.hypot(dx, dy) || 1) * Math.SQRT2)
}

/** A peça acende: a cor dela não pega luz nem sombra (`forca` de 0 a 1). */
function texAcesa(forca: number): Textura {
  return (_u, _v, _x, _y, _p, s) => {
    s[4] = forca
  }
}

/** A crosta: as placas (a fresta escura onde o ruído passa por zero), o grão e a beira roída que some no chão. */
function texCrosta(k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const xd = x / k
    const yd = y / k
    const rr = Math.hypot((xd - CROSTA.x) / CROSTA.rx, (yd - CROSTA.y) / CROSTA.ry)
    const placa = Math.abs(ruido(xd * 0.2 + 7, yd * 0.2 + 3))
    s[3] += ruido(xd * 0.9, yd * 0.9) * 0.05 - 0.22 * (1 - suave(0.02, 0.07, placa)) + (rr - 0.5) * 0.06
    const beira = CROSTA.beira + ruido(xd * 0.18 + 31, yd * 0.18 + 5) * CROSTA.recorte
    s[5] = suave(beira, beira - CROSTA.esfumado, rr)
  }
}

/** A encosta do cone: acesa do lado de cima à esquerda e apagada do lado de lá, mais no meio dela; os sulcos e o grão. */
function texEncosta(k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const xd = x / k
    const yd = y / k
    const r = Math.hypot(xd / CONE.rx, yd / CONE.ry)
    const inclina = suave(0.52, 0.68, r) * (1 - 0.4 * suave(0.86, 1, r))
    const sulco = Math.sin(Math.atan2(yd, xd) * 13 + ruido(xd * 0.2, yd * 0.2) * 4) * 0.022
    s[3] += (voltadoParaALuz(xd, yd) * 0.26 + sulco) * inclina + ruido(xd * 1.1 + 3, yd * 1.1) * 0.05
  }
}

/** A parede de dentro da cratera: a luz ao contrário da encosta, e mais escura quanto mais funda. */
function texParede(k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const xd = x / k
    const yd = y / k - BOCA_Y
    const r = Math.hypot(xd / BEIRA.rx, yd / BEIRA.ry)
    s[3] += -voltadoParaALuz(xd, yd) * 0.13 - (1 - r) * 0.3 + ruido(xd * 1.3, yd * 1.3 + 7) * 0.04
  }
}

/** A beira da cratera: o fio de luz da crista, mais forte do lado da luz. */
function texBeira(k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    s[5] *= 0.12 + 0.4 * Math.max(0, voltadoParaALuz(x / k, y / k - BOCA_Y))
  }
}

/** O enxofre: crosta em manchas tortas (o ruído) e mais do lado do vento; o cristal claro aqui e ali. */
function texEnxofre(k: number, aMais: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const xd = x / k
    const yd = y / k - BOCA_Y
    const lado = (xd * VENTO.x + yd * VENTO.y) / (Math.hypot(xd, yd) || 1)
    const n = ruido(xd * 0.55 + 11, yd * 0.55 + 4) + 0.5 * ruido(xd * 1.4, yd * 1.4 + 9)
    const mancha = suave(0.22 - aMais, 0.42 - aMais, n + lado * VENTO.peso)
    const cor = entre(ENXOFRE, ENXOFRE_CLARO, suave(0.5, 0.75, ruido(xd * 2.6 + 1, yd * 2.6)) * 0.6)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[5] *= mancha * 0.85
  }
}

/** As cordas da lava fria: os rolos atravessados no caminho, curvos para a frente (o meio corre mais que a beira). */
function texCordas(k: number, angulo: number): Textura {
  const ux = Math.cos(angulo)
  const uy = Math.sin(angulo)
  return (_u, _v, x, y, _p, s) => {
    const xd = x / k
    const yd = y / k
    const aoLongo = xd * ux + yd * uy
    const deLado = -xd * uy + yd * ux
    s[3] += Math.sin(aoLongo * 2.4 + deLado * deLado * 0.18) * 0.045 + ruido(xd * 1.2 + 5, yd * 1.2) * 0.04
  }
}

/** A lava da garganta: mais quente no meio, as ilhas de crosta boiando (que não acendem). */
function texLava(k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const xd = x / k
    const yd = y / k
    const rr = Math.min(1, Math.hypot(xd / GARGANTA.rx, (yd - BOCA_Y) / GARGANTA.ry))
    const n = ruido(xd * 0.85 + 2, yd * 0.85) + 0.5 * ruido(xd * 2 + 5, yd * 2)
    const crosta = suave(0.32, 0.55, n + rr * 0.45)
    const calor = 1 - rr * 0.8
    const cor = entre(calor < 0.5 ? entre(LAVA_FUNDA, LAVA, calor / 0.5) : entre(LAVA, LAVA_CLARA, (calor - 0.5) / 0.5), CROSTA_DA_LAVA, crosta)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = 1 - crosta * 0.9
  }
}

/** A tampa da garganta do Adormecido: a lava fria, com a brasa funda nas frestas do meio (onde o ruído passa por zero). */
function texTampa(k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const xd = x / k
    const yd = y / k - BOCA_Y
    const rr = Math.min(1, Math.hypot(xd / GARGANTA.rx, yd / GARGANTA.ry))
    const fenda = 1 - suave(0.03, 0.1, Math.abs(ruido(xd * 0.42 + 4, yd * 0.42 + 2)))
    const brasa = fenda * (1 - suave(0.3, 0.85, rr))
    const cor = entre(CROSTA_DA_LAVA, BRASA_FUNDA_RGB, brasa)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[3] += -0.12 * fenda * (1 - brasa)
    s[4] = brasa * 0.7
  }
}

/** O meio da caixa da peça: onde a 3/4 procura a estrutura dela, e onde o pino é cravado. */
function meioDaPeca(p: Peca): Ponto {
  const b = p.forma.b
  return [(b[0] + b[2]) / 2 + p.dx, (b[1] + b[3]) / 2 + p.dy]
}

/** Os pinos de uma altura: um disco de raio `r` em cada ponto, numa forma só (o molde de `caldeirao.ts`). */
function pinos(pontos: readonly Ponto[], r: number): Forma {
  const xs = pontos.map(([x]) => x)
  const ys = pontos.map(([, y]) => y)
  return {
    b: [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r],
    d(x, y) {
      let menor = Infinity
      for (const [px, py] of pontos) menor = Math.min(menor, (x - px) * (x - px) + (y - py) * (y - py))
      return Math.sqrt(menor) - r
    },
  }
}

// ---------- as partes ----------

/** A crosta do chão e as rachaduras dela (metade acesa no Ativo); os respingos de lava fria. */
function crostaDoChao(c: ContextoDoMovel, cena: Cena, k: number, ativo: boolean): void {
  const P = c.peca
  const L = cena.partes
  L.push(P(elipse(CROSTA.x * k, CROSTA.y * k, CROSTA.rx * k, CROSTA.ry * k), BASALTO, { bisel: 0, contorno: 0, tabua: 0, textura: texCrosta(k), semente: 9300 }))
  RACHADURAS.forEach(([graus, volta], i) => {
    const pontos: Ponto[] = []
    // Dentro da crosta (que é mais larga que alta): na 1ª folha (28/11/2026) passavam da beira e liam pernas.
    for (let j = 0; j <= 4; j += 1) {
      const dist = CONE.rx * 0.92 + j * 1.15
      // Meia volta: a volta inteira, com a brasa só no começo, desenhava um "<" aceso (2ª folha).
      const a = (graus + volta * 0.5 * Math.sin(j * 1.3)) * GRAUS
      pontos.push([Math.cos(a) * dist * k, Math.sin(a) * dist * (CROSTA.ry / CROSTA.rx) * 0.98 * k])
    }
    const acesa = ativo && i % 2 === 0
    if (acesa) L.push(P(cadeia(pontos, 1.4 * k), BRASA_FUNDA, { bisel: 0, contorno: 0, alfa: 0.26, suave: 1.2 * k, textura: texAcesa(1), semente: 9310 + i }))
    L.push(P(cadeia(pontos, 0.36 * k), FRESTA, { bisel: 0, contorno: 0, alfa: 0.55, semente: 9320 + i }))
    if (acesa) L.push(P(cadeia(pontos.slice(0, 3), 0.24 * k), BRASA_NA_FRESTA, { bisel: 0, contorno: 0, alfa: 0.85, textura: texAcesa(1), semente: 9330 + i }))
  })
  if (!ativo) return
  RESPINGOS.forEach(([x, y, r], i) => {
    L.push(P(elipseGirada(x * k, y * k, r * k, r * 0.7 * k, i * 0.9), RESPINGO, { bisel: 0.5 * k, contorno: 0.2, semente: 9340 + i, projeta: { dist: 0.4 * k, forca: 0.22 } }))
  })
}

/** As línguas de lava fria que saem de debaixo do pé do cone (no chão); no Ativo, a primeira ainda corre por dentro. */
function linguas(c: ContextoDoMovel, cena: Cena, k: number, ativo: boolean): void {
  const P = c.peca
  LINGUAS.forEach(([graus, comprido, largura], i) => {
    const a = graus * GRAUS
    const dobra = (i % 2 === 0 ? 1 : -1) * 0.1
    const noPe = (fora: number, desvio: number): Ponto => [Math.cos(a + desvio) * (CONE.rx + fora) * k, Math.sin(a + desvio) * (CONE.ry + fora) * k]
    // Lóbulos chatos e largos, quase da cor da crosta: em tubo de ponta redonda (2ª folha) liam canos ou pernas.
    const pontos = [noPe(-1, 0), noPe(comprido * 0.5, dobra), noPe(comprido, dobra * 1.7)]
    const lobulo = (p: Ponto, rx: number, ry: number): Forma => elipseGirada(p[0], p[1], rx * largura * k, ry * largura * k, a)
    const forma = uniao(uniao(lobulo(pontos[0], 1.15, 0.6), lobulo(pontos[1], 1.05, 0.54)), lobulo(pontos[2], 0.8, 0.46))
    cena.partes.push(P(forma, LAVA_FRIA, { bisel: 0.6 * k, tabua: 0, contorno: 0.04, textura: texCordas(k, a + dobra), semente: 9360 + i, projeta: { dist: 0.4 * k, forca: 0.16 } }))
    if (!ativo || i > 0) return
    const corre = [noPe(-2, 0), pontos[1]]
    cena.partes.push(
      P(cadeia(corre, 1.2 * k), BRASA_FUNDA, { bisel: 0, contorno: 0, alfa: 0.28, suave: 1 * k, textura: texAcesa(1), semente: 9366 }),
      P(cadeia(corre, 0.3 * k), BRASA_NA_FRESTA, { bisel: 0, contorno: 0, alfa: 0.85, textura: texAcesa(1), semente: 9367 }),
    )
  })
}

/** O cone: a encosta, que sobe pouco na 3/4. */
function cone(c: ContextoDoMovel, cena: Cena, k: number): Peca[] {
  const forma = elipse(0, 0, CONE.rx * k, CONE.ry * k)
  cena.sombras.push(contato(forma, 0.3))
  return [c.peca(forma, BASALTO_DO_CONE, { bisel: 2.2 * k, tabua: 0, contorno: 0.24, textura: texEncosta(k), semente: 9350, projeta: { dist: 1.2 * k, forca: 0.28 } })]
}

/** A cratera: a parede de dentro, o enxofre e o fio de luz da beira (o fundo é da versão). */
function cratera(c: ContextoDoMovel, k: number, aMais: number): Peca[] {
  const P = c.peca
  const y = BOCA_Y * k
  return [
    P(anel(0, y, BEIRA.rx * k, BEIRA.ry * k, GARGANTA.rx * k, GARGANTA.ry * k), BASALTO_DO_CONE, { bisel: 0, tabua: 0, tom: 0.92, contorno: 0.14, textura: texParede(k), semente: 9371 }),
    P(anel(0, y, (BEIRA.rx + 1.1) * k, (BEIRA.ry + 1) * k, (GARGANTA.rx + 0.4) * k, (GARGANTA.ry + 0.4) * k), { classe: 'liso', rgb: ENXOFRE }, { bisel: 0.3 * k, contorno: 0, textura: texEnxofre(k, aMais), semente: 9380 }),
    P(anel(0, y, (BEIRA.rx + 0.3) * k, (BEIRA.ry + 0.3) * k, (BEIRA.rx - 0.7) * k, (BEIRA.ry - 0.7) * k), LUZ_DA_BEIRA, { bisel: 0, contorno: 0, textura: texBeira(k), semente: 9381 }),
  ]
}

/** A boca do ATIVO: a cratera, o clarão da lava nela e a lava acesa na garganta. */
function bocaAtiva(c: ContextoDoMovel, k: number): Peca[] {
  const P = c.peca
  const y = BOCA_Y * k
  return [
    ...cratera(c, k, 0),
    P(elipse(0, y, 12.2 * k, 11.6 * k), CLARAO, { bisel: 0, contorno: 0, alfa: 0.22, suave: 3.4 * k, textura: texAcesa(1), semente: 9370 }),
    P(elipse(0, y, GARGANTA.rx * k, GARGANTA.ry * k), { classe: 'liso', rgb: LAVA }, { bisel: 0, contorno: 0.2, textura: texLava(k), recesso: { k: 1.6 * k, forca: 0.3 }, semente: 9372 }),
  ]
}

/** A boca do ADORMECIDO: a cratera com mais enxofre e a garganta tampada pela lava fria, a brasa só nas frestas. */
function bocaAdormecida(c: ContextoDoMovel, k: number): Peca[] {
  const y = BOCA_Y * k
  return [
    ...cratera(c, k, ENXOFRE_A_MAIS),
    c.peca(elipse(0, y, GARGANTA.rx * k, GARGANTA.ry * k), { classe: 'liso', rgb: CROSTA_DA_LAVA }, { bisel: 1.2 * k, contorno: 0.2, textura: texTampa(k), recesso: { k: 1.8 * k, forca: 0.36 }, semente: 9373 }),
  ]
}

function respiradouro(ativo: boolean): MontarMovel {
  return (c, cena) => {
    const k = Math.min(c.w, c.h) / LADO_DO_DESENHO
    cena.corDoPiso = ESCURO_DO_BASALTO
    crostaDoChao(c, cena, k, ativo)
    linguas(c, cena, k, ativo)
    const doCone = cone(c, cena, k)
    const daBoca = ativo ? bocaAtiva(c, k) : bocaAdormecida(c, k)
    cena.partes.push(...doCone, ...daBoca)
    const pino = RAIO_DO_PINO * k
    cena.sombras.push(
      { forma: pinos(doCone.map(meioDaPeca), pino), z: ALTURA_DO_CONE * k, solta: true, forca: 0 },
      { forma: pinos([...daBoca.map(meioDaPeca), [0, PINO_AO_SUL_DA_BOCA * k]], pino), z: ALTURA_DA_BOCA * k, solta: true, forca: 0 },
    )
  }
}

/** ATIVO: a 1ª versão, o desenho de `MONTADORES` (o vapor é do animador). */
export const montarRespiradouroVulcanico: MontarMovel = respiradouro(true)
/** ADORMECIDO: a garganta tampada pela lava fria; não solta vapor. */
export const montarRespiradouroVulcanicoAdormecido: MontarMovel = respiradouro(false)

/** O vapor sai do meio da garganta: um fio a cada 2,8 s (o respiro lento da terra). Só no Ativo. */
export const ANIMACAO_DO_RESPIRADOURO_VULCANICO: AnimacaoDoMovel = {
  animador: 'vapor',
  pivo: { x: 0.5, y: (LADO_DO_DESENHO / 2 + BOCA_Y) / LADO_DO_DESENHO },
  periodoMs: 2800,
}
