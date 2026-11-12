/**
 * BRASEIRO de cima com volume (lote 13 dos objetos novos, 11/11/2026, grupo
 * Templo e masmorra): o braseiro de templo ou de masmorra. Uma BACIA larga de
 * ferro batido, com a BORDA chata rebitada e escura de fuligem, cheia de
 * carvão em brasa, erguida num TRIPÉ alto de ferro forjado: as três pernas
 * presas na borda por uma tala, cada uma com um pé de bola no chão (duas
 * abertas para a frente, uma para trás, como o candelabro de chão).
 *
 * De cima: o anel da borda com os rebites, o monte de carvão afundado nele
 * (as brasas e o halo quente, ou o carvão frio e a cinza), a cabeça das três
 * pernas na beira, os pés saindo de debaixo da bacia e a SOMBRA: a bacia
 * erguida deixa a sombra dela longe, para baixo à direita, e cada perna risca
 * o chão até lá. É a sombra que diz "erguido" visto do alto.
 *
 * ACESO (variante 0) e APAGADO (variante 1), como a lareira e o forno de pão:
 * a chama é a camada animada do fogo de casa (`lib/mobilia/fogoDeCasa.ts`), e
 * a imagem parada só tem o fogo parado (o halo e as brasas) ou o carvão frio
 * e a cinza. `BRASEIRO` é a disposição que a chama lê.
 *
 * NA 3/4 a bacia sobe no tripé, pelo que `tresQuartos.ts` faz com as sombras
 * (cada sombra com altura é uma estrutura; cada peça sobe com a mais alta que
 * contém o meio da caixa dela; as estruturas saem do norte para o sul pela
 * base da caixa e, na mesma base, a mais baixa antes):
 * - cada PERNA é uma coluna da altura da borda; a tala e a cabeça dela sobem
 *   junto e assentam na borda;
 * - a BACIA são dois PINOS (pontos sem sombra, como no caldeirão): o do BOJO
 *   o sobe um pouco menos que a borda, e a parte de baixo dele aparece
 *   redonda debaixo da borda; o da BOCA sobe a borda, os rebites, o carvão e
 *   o fogo. Toda peça da boca tem a caixa centrada no pino dela. Os dois
 *   pinos têm a mesma caixa: empatados na base, sai antes o mais baixo;
 * - as pernas que ficam na frente NA TELA têm a caixa esticada até a frente
 *   da pegada, para sair depois da bacia e passar na frente do bojo; a de
 *   trás sai antes e some atrás dela (só a cabeça aparece por cima da borda).
 *   Por isso o desenho lê `c.giro`, o quarto de volta que a 3/4 pinta; a
 *   sombra da bacia no chão também fica para baixo à direita na tela;
 * - os pés ficam no chão (a caixa de cada um é centrada na ponta, fora da
 *   perna).
 *
 * A 25% de zoom sobram o anel escuro com o miolo quente e os três pés: é o
 * que diz "braseiro" e não "caldeirão" (o disco castanho do caldo) nem
 * "fogueira" (a roda de pedras). Tudo sai do menor lado da pegada (0,8 x 0,8
 * casa de partida): esticado, o braseiro fica oval, como o barril. Material:
 * `metal` (a bacia e o tripé). O carvão, a cinza e o fogo são fixos.
 */
import { hash, limitar01, misturar, type Rgb } from '../../ruido'
import { anel, capsula, elipse, poligono, uniao, type Caixa, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type Peca, type Textura } from './motor'
import { CINZA, G, type MontarMovel } from './contexto'
import { FOGO_PARADO, texBrasa, texCinza, texHalo } from './fogoDeCasa'
import { BRASA_QUENTE, BRASA_VIVA } from './fogueira'

/**
 * A disposição do braseiro, que a imagem parada e a chama animada leem juntas: `fogo` é o meio do monte de
 * carvão, onde as línguas nascem, em frações da pegada a partir do centro (x da largura, y da altura), sem
 * giro, como `FORNO_DE_PAO`; `alturaDaBorda` é a altura da borda em fração do menor lado (0,72 casa no
 * braseiro de 0,8). O carvão queima rente à borda: na 3/4 a chama sobe essa altura.
 */
export const BRASEIRO = {
  fogo: { x: 0, y: 0 },
  alturaDaBorda: 0.9,
} as const

/** O braseiro foi medido no tamanho de partida (0,8 casa, 22,4 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.4 * G
const GRAUS = Math.PI / 180

/** Os raios da bacia, em fração da meia pegada: a borda chata por fora e por dentro, a roda dos rebites, o carvão e o bojo. */
const BORDA_DE_FORA = 0.82
const BORDA_DE_DENTRO = 0.675
const RAIO_DOS_REBITES = 0.748
const REBITES = 14
/** O raio da cabeça do rebite, em px do tamanho de partida. */
const RAIO_DO_REBITE = 1.05
const RAIO_DO_CARVAO = 0.7
/** O bojo fica por baixo da borda, escondido de cima; na 3/4 desce `DESCIDA_DO_BOJO` (fração do menor meio lado) e aparece redondo. */
const RAIO_DO_BOJO = 0.8
const DESCIDA_DO_BOJO = 0.26

/** As pernas: o ângulo de cada uma (90 = a frente), o raio em que ficam e a grossura, em fração da meia pegada. */
const PERNAS: readonly number[] = [30, 150, 270]
const RAIO_DAS_PERNAS = 0.9
const GROSSURA_DA_PERNA = 0.085
/** A cabeça da perna (o botão por cima da tala), de onde a tala sai da borda e a grossura dela. */
const RAIO_DA_CABECA = 0.088
const TALA_DE = 0.7
const GROSSURA_DA_TALA = 0.05
/** O pé: do pé da perna para fora até `PONTA_DO_PE`, e a bola na ponta (o meio dela fica fora da perna: o pé não sobe com ela). */
const PONTA_DO_PE = 1
const GROSSURA_DO_PE = 0.052
const RAIO_DA_BOLA = 0.068

/** O raio do pino, em fração do menor meio lado: um décimo de px no tamanho de partida (só o meio exato da peça cai nele). */
const RAIO_DO_PINO = 0.004
/** A caixa comum aos dois pinos da bacia (px): os dois ficam dentro dela, e ela gira igual para os dois. */
const CAIXA_DOS_PINOS: Caixa = [-1, -1, 1, 1]

/**
 * O ferro: o bojo (visto só na 3/4, com menos luz), a borda batida, os rebites polidos pelo uso, as pernas e os
 * pés, no chão e na sombra da bacia. O brilho é o do ferro velho (o metal novo é 0,42).
 */
const TOM_DO_BOJO = 0.74
const TOM_DA_BORDA = 1.02
const TOM_DO_REBITE = 1.34
const TOM_DA_TALA = 0.9
const TOM_DA_CABECA = 1.12
const TOM_DO_PE = 0.8
const BRILHO_DO_FERRO = 0.3
/**
 * O escuro em que o pixel escuro demais é levantado: o cinza-escuro quente do canhão, do caldeirão e do cofre.
 * Com o piso padrão (a nogueira) o lado da sombra do ferro saía marrom, como madeira.
 */
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** A fuligem da borda: escurece da beira de fora (nada) até a de dentro, manchada. */
const FULIGEM_NA_BORDA = 0.34
/** As covinhas do martelo: a escala do ruído e quanto clareiam ou escurecem. */
const ESCALA_DAS_COVINHAS = 0.6
const FORCA_DAS_COVINHAS = 0.2

/** O fogo parado: o halo no carvão e o brilho que pega a beira de dentro da borda (alfa no mais forte). */
const RAIO_DO_HALO = 0.74
const ALFA_DO_HALO = 0.26
const ALFA_DO_BRILHO_NA_BORDA = 0.16

/**
 * O monte de carvão: quantos torrões, até onde vão (fração da meia pegada) e o tamanho (px de partida). Os
 * torrões quase se encostam: aceso, a brasa do leito aparece só nas frestas, e é isso que diz "carvão em brasa"
 * (as brasas soltas num leito liso liam como feijão).
 */
const QUANTOS_TORROES = 60
const ALCANCE_DOS_TORROES = 0.63
const TAMANHO_DO_TORRAO = 2.45
const LADOS_DO_TORRAO = 6
const ANGULO_DOURADO = 2.39996
/** Aceso, parte dos torrões do miolo (fração da meia pegada) é brasa: o miolo quente, a beira escura. */
const MIOLO_QUENTE = 0.34
const CHANCE_DE_BRASA = 0.4
/** Apagado, a cinza fria por cima do carvão: manchas macias e meio transparentes (x, y e raio em fração da meia pegada). */
const MANCHAS_DE_CINZA: readonly (readonly [number, number, number])[] = [
  [-0.2, -0.14, 0.17],
  [0.04, -0.3, 0.1],
  [0.24, 0.12, 0.13],
  [-0.08, 0.24, 0.09],
  [0.3, -0.18, 0.07],
]
const ALFA_DA_CINZA = 0.7
/** O carvão: um quase-preto neutro (o carvão frio da lareira é castanho e, aqui, lia como feijão). */
const CARVAO: MaterialDaPeca = { classe: 'liso', rgb: [0x42, 0x3d, 0x39] }
/** A brasa debaixo do carvão: o vermelho fundo na beira do leito, até o laranja da brasa no miolo. */
const BRASA_FUNDA: Rgb = [0x5c, 0x33, 0x29]
/** Quanto do leito em brasa é emissão: o resto pega a sombra da borda, e o leito afunda nela. */
const EMISSAO_DO_LEITO = 0.82

/** Os torrões: x e y em fração da meia pegada e o tamanho (px de partida), em girassol, sempre nos mesmos lugares. */
const TORROES: readonly (readonly [number, number, number])[] = Array.from({ length: QUANTOS_TORROES }, (_, i) => {
  const a = i * ANGULO_DOURADO + (hash(i, 1, 1314) - 0.5) * 0.5
  const d = Math.sqrt((i + 0.5) / QUANTOS_TORROES) * ALCANCE_DOS_TORROES
  return [Math.cos(a) * d, Math.sin(a) * d, TAMANHO_DO_TORRAO * (0.8 + 0.45 * hash(i, 2, 1314))] as const
})
/** As sombras no chão: a da bacia erguida e a risca de cada perna. */
const FORCA_DA_SOMBRA_DA_BACIA = 0.26
const SOMBRA_DA_PERNA = { suave: 1.2, forca: 0.3 } as const

const DO_METAL = texturaDaClasse('metal')

/** Os quartos de volta do giro que a 3/4 pinta (0 fora dela). */
function quartosDoGiro(giro: number): number {
  return ((Math.round(giro / 90) % 4) + 4) % 4
}

/** O ponto (x, y) do desenho NA TELA, depois do quarto de volta que a 3/4 pinta (`girarCena`). */
function naTela(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [-y, x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [y, -x] : [x, y]
}

/** A direção do desenho que cai em (x, y) NA TELA depois do quarto de volta (o avesso de `naTela`). */
function doDesenho(x: number, y: number, quartos: number): Ponto {
  return quartos === 1 ? [y, -x] : quartos === 2 ? [-x, -y] : quartos === 3 ? [-y, x] : [x, y]
}

/**
 * A mesma forma com a caixa de pintura centrada em (mx, my): o desenho não muda (fora da forma nada pinta),
 * mas o meio da caixa, que é o que a 3/4 lê para saber com que estrutura a peça sobe, cai onde se quer.
 */
function comMeioEm(forma: Forma, mx: number, my: number): Forma {
  const ex = Math.max(mx - forma.b[0], forma.b[2] - mx)
  const ey = Math.max(my - forma.b[1], forma.b[3] - my)
  return { b: [mx - ex, my - ey, mx + ex, my + ey], d: (x, y) => forma.d(x, y) }
}

/**
 * A mesma forma com a caixa esticada até `ate` px do centro, do lado que fica embaixo NA TELA: a 3/4 pinta as
 * estruturas pela base da caixa, e a esticada sai depois das que acabam antes dela.
 */
function esticadaParaAFrente(forma: Forma, ate: number, quartos: number): Forma {
  const [dx, dy] = doDesenho(0, 1, quartos)
  const [x0, y0, x1, y1] = forma.b
  const b: Caixa =
    dx > 0.5 ? [x0, y0, Math.max(x1, ate), y1] : dx < -0.5 ? [Math.min(x0, -ate), y0, x1, y1] : dy > 0.5 ? [x0, y0, x1, Math.max(y1, ate)] : [x0, Math.min(y0, -ate), x1, y1]
  return { b, d: forma.d }
}

/** A forma andada (dx, dy): a sombra da bacia, pintada no chão já longe dela. */
function deslocada(f: Forma, dx: number, dy: number): Forma {
  return { b: [f.b[0] + dx, f.b[1] + dy, f.b[2] + dx, f.b[3] + dy], d: (x, y) => f.d(x - dx, y - dy) }
}

/** Um PINO: a estrutura da 3/4 do tamanho de um ponto. Só a peça com o meio da caixa nele sobe com ele. */
function pino(x: number, y: number, r: number, caixa: Caixa): Forma {
  return { b: caixa, d: (px, py) => Math.hypot(px - x, py - y) - r }
}

/** Os rebites numa forma só: uma cabeça redonda de raio `r` em cada ponto. */
function rebites(pontos: readonly Ponto[], r: number): Forma {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of pontos) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return {
    b: [x0 - r, y0 - r, x1 + r, y1 + r],
    d(x, y) {
      let menor = Infinity
      for (const [px, py] of pontos) {
        const dd = (x - px) * (x - px) + (y - py) * (y - py)
        if (dd < menor) menor = dd
      }
      return Math.sqrt(menor) - r
    },
  }
}

/**
 * O ferro batido: as covinhas do martelo por cima da textura do metal e, na borda, a fuligem que sobe do
 * carvão, mais forte na beira de dentro (`fuligem` = 0 sem fuligem).
 */
function texFerroBatido(hw: number, hh: number, fuligem: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    const covinha = Math.abs(ruido(x * ESCALA_DAS_COVINHAS + p.su, y * ESCALA_DAS_COVINHAS + p.sv))
    s[3] += (0.14 - covinha) * FORCA_DAS_COVINHAS
    if (fuligem <= 0) return
    const t = limitar01((BORDA_DE_FORA - Math.hypot(x / hw, y / hh)) / (BORDA_DE_FORA - BORDA_DE_DENTRO))
    s[3] -= fuligem * t * t * (0.75 + ruido(x * 0.35 + 9, y * 0.35) * 0.9)
  }
}

/** Um torrão de carvão: um polígono de `LADOS_DO_TORRAO` pontas de raio sorteado em volta de `r`, girado. */
function torrao(cx: number, cy: number, r: number, semente: number): Forma {
  const giro = hash(semente, 1, 1309) * Math.PI * 2
  const pontos: Ponto[] = []
  for (let i = 0; i < LADOS_DO_TORRAO; i += 1) {
    const a = giro + (i / LADOS_DO_TORRAO) * Math.PI * 2
    const raio = r * (0.72 + 0.5 * hash(semente, i + 2, 1309))
    pontos.push([cx + Math.cos(a) * raio, cy + Math.sin(a) * raio * 0.9])
  }
  return poligono(pontos)
}

/** O leito em brasa debaixo do carvão: do vermelho fundo na beira ao laranja quente no miolo, manchado. */
function texLeitoEmBrasa(hw: number, hh: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const rr = Math.hypot(x / hw, y / hh) / RAIO_DO_CARVAO
    const t = limitar01(1.05 - rr + ruido(x * 0.4 + 3, y * 0.4 + 7) * 0.5)
    const cor = t < 0.5 ? misturar(BRASA_FUNDA, BRASA_VIVA, t * 2) : misturar(BRASA_VIVA, BRASA_QUENTE, (t - 0.5) * 2)
    s[0] = cor[0]
    s[1] = cor[1]
    s[2] = cor[2]
    s[4] = EMISSAO_DO_LEITO
  }
}

/** O brilho do fogo na beira de dentro da borda: o tom do miolo das brasas, mais forte junto do carvão. */
function texBrilhoNaBorda(hw: number, hh: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const t = limitar01((BORDA_DE_FORA - Math.hypot(x / hw, y / hh)) / (BORDA_DE_FORA - BORDA_DE_DENTRO))
    s[0] = BRASA_QUENTE[0]
    s[1] = BRASA_QUENTE[1]
    s[2] = BRASA_QUENTE[2]
    s[4] = 1
    s[5] = ALFA_DO_BRILHO_NA_BORDA * t * t
  }
}

export const montarBraseiro: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const ferro = c.m.metal
  const aceso = c.variante !== 1
  const quartos = quartosDoGiro(c.giro)
  const altura = 2 * R * BRASEIRO.alturaDaBorda
  const L = cena.partes
  cena.corDoPiso = ESCURO_DO_FERRO
  const oval = (f: number): Forma => elipse(0, 0, f * hw, f * hh)

  const pernas = PERNAS.map((graus) => {
    const co = Math.cos(graus * GRAUS)
    const si = Math.sin(graus * GRAUS)
    const em = (f: number): Ponto => [co * f * hw, si * f * hh]
    return { em, ponto: em(RAIO_DAS_PERNAS) }
  })

  // ---------- as sombras: a da bacia erguida, os dois pinos e a risca de cada perna ----------
  const pinoDaBoca: Ponto = [0, 0]
  const raioDoPino = RAIO_DO_PINO * R
  const pinoDoBojo: Ponto = [raioDoPino * 4, 0]
  const [sombraX, sombraY] = doDesenho(SOMBRA_X * altura, SOMBRA_Y * altura, quartos)
  cena.sombras.push(
    { forma: deslocada(oval(BORDA_DE_FORA), sombraX, sombraY), z: 0, suave: bordaDaSombra({ z: altura }), forca: FORCA_DA_SOMBRA_DA_BACIA },
    { forma: pino(pinoDoBojo[0], pinoDoBojo[1], raioDoPino, CAIXA_DOS_PINOS), z: altura - DESCIDA_DO_BOJO * R, solta: true, forca: 0 },
    { forma: pino(pinoDaBoca[0], pinoDaBoca[1], raioDoPino, CAIXA_DOS_PINOS), z: altura, solta: true, forca: 0 },
  )
  pernas.forEach(({ ponto: [px, py] }) => {
    const corpo = elipse(px, py, GROSSURA_DA_PERNA * R, GROSSURA_DA_PERNA * R)
    // A perna da frente na tela sai depois da bacia: passa na frente do bojo.
    const naFrente = naTela(px, py, quartos)[1] > R * 0.2
    cena.sombras.push({ forma: naFrente ? esticadaParaAFrente(corpo, R * 1.1, quartos) : corpo, z: altura, ...SOMBRA_DA_PERNA }, contato(corpo, 0.3))
  })

  // ---------- no chão: os pés ----------
  pernas.forEach(({ em, ponto: [px, py] }, i) => {
    const [tx, ty] = em(PONTA_DO_PE)
    const pe = capsula(px, py, tx, ty, GROSSURA_DO_PE * R)
    const bola = elipse(tx, ty, RAIO_DA_BOLA * R, RAIO_DA_BOLA * R)
    cena.sombras.push(contato(uniao(pe, bola), 0.3))
    L.push(P(comMeioEm(pe, tx, ty), ferro, { tabua: 0, bisel: GROSSURA_DO_PE * R, tom: TOM_DO_PE, metal: BRILHO_DO_FERRO, contorno: 0.26, textura: texFerroBatido(hw, hh, 0), semente: 13100 + i * 4 }))
    L.push(P(bola, ferro, { tabua: 0, bisel: RAIO_DA_BOLA * R * 0.9, tom: TOM_DO_PE * 1.08, metal: BRILHO_DO_FERRO, contorno: 0.26, semente: 13101 + i * 4 }))
  })

  // ---------- o bojo: escondido debaixo da borda de cima; na 3/4, a barriga da bacia ----------
  L.push(P(comMeioEm(oval(RAIO_DO_BOJO), pinoDoBojo[0], pinoDoBojo[1]), ferro, {
    tabua: 0,
    bisel: RAIO_DO_BOJO * R * 0.62,
    tom: TOM_DO_BOJO,
    metal: BRILHO_DO_FERRO,
    contorno: 0.3,
    textura: texFerroBatido(hw, hh, 0),
    semente: 13120,
  }))

  // ---------- a boca: o carvão, o fogo, a borda e os rebites (sobem juntos pelo pino da boca) ----------
  const boca: Peca[] = []
  // O leito: aceso, a brasa por baixo do carvão (aparece nas frestas entre os torrões); apagado, a cinza.
  boca.push(aceso
    ? P(oval(RAIO_DO_CARVAO), FOGO_PARADO, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 2.6 * k, forca: 0.42 }, textura: texLeitoEmBrasa(hw, hh), semente: 13130 })
    : P(oval(RAIO_DO_CARVAO), CINZA, { tabua: 0, bisel: 0.6 * k, tom: 0.6, contorno: 0, recesso: { k: 2.6 * k, forca: 0.42 }, textura: texCinza(0, 0, RAIO_DO_CARVAO * R), semente: 13130 }))
  // O monte de carvão: torrões escuros quase encostados; acesos, os do miolo viram brasa.
  TORROES.forEach(([fx, fy, tamanho], i) => {
    const x = fx * hw
    const y = fy * hh
    const r = tamanho * k
    const quente = aceso && Math.hypot(fx, fy) < MIOLO_QUENTE && hash(i, 7, 13140) < CHANCE_DE_BRASA
    const forma = torrao(x, y, r, 13140 + i)
    if (quente) boca.push(P(forma, FOGO_PARADO, { textura: texBrasa(x, y, r * 1.2), bisel: 0, contorno: 0.12, semente: 13140 + i }))
    else boca.push(P(forma, CARVAO, { tabua: 0, bisel: r * 0.7, tom: 0.86 + 0.3 * hash(i, 8, 13140), contorno: 0.16, semente: 13140 + i }))
  })
  if (aceso) {
    boca.push(P(oval(RAIO_DO_HALO), FOGO_PARADO, { textura: texHalo(0, 0, RAIO_DO_HALO * hw, RAIO_DO_HALO * hh, ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 13170 }))
  } else {
    // A cinza fria por cima do carvão, em manchas macias.
    MANCHAS_DE_CINZA.forEach(([fx, fy, f], i) => {
      boca.push(P(torrao(fx * hw, fy * hh, f * R, 13190 + i), CINZA, { tabua: 0, bisel: 0, tom: 1.32, contorno: 0, alfa: ALFA_DA_CINZA, suave: f * R * 0.45, textura: texCinza(fx * hw, fy * hh, f * R), semente: 13190 + i }))
    })
  }
  boca.push(P(anel(0, 0, BORDA_DE_FORA * hw, BORDA_DE_FORA * hh, BORDA_DE_DENTRO * hw, BORDA_DE_DENTRO * hh), ferro, {
    tabua: 0,
    bisel: 1.3 * k,
    tom: TOM_DA_BORDA,
    metal: BRILHO_DO_FERRO,
    contorno: 0.3,
    textura: texFerroBatido(hw, hh, FULIGEM_NA_BORDA),
    projeta: { dist: 1.4 * k, forca: 0.38 },
    semente: 13200,
  }))
  const roda: Ponto[] = []
  for (let i = 0; i < REBITES; i += 1) {
    const a = ((i + 0.5) / REBITES) * Math.PI * 2
    roda.push([Math.cos(a) * RAIO_DOS_REBITES * hw, Math.sin(a) * RAIO_DOS_REBITES * hh])
  }
  boca.push(P(rebites(roda, RAIO_DO_REBITE * k), ferro, { tabua: 0, bisel: RAIO_DO_REBITE * k, tom: TOM_DO_REBITE, metal: 0.55, contorno: 0.2, semente: 13201 }))
  if (aceso) boca.push(P(oval(BORDA_DE_FORA), FOGO_PARADO, { textura: texBrilhoNaBorda(hw, hh), bisel: 0, contorno: 0, semente: 13202 }))
  L.push(...boca.map((p) => ({ ...p, forma: comMeioEm(p.forma, pinoDaBoca[0], pinoDaBoca[1]) })))

  // ---------- as pernas: a tala presa na borda e a cabeça (sobem com a coluna da perna) ----------
  pernas.forEach(({ em, ponto: [px, py] }, i) => {
    const [tx, ty] = em(TALA_DE)
    L.push(P(comMeioEm(capsula(tx, ty, px, py, GROSSURA_DA_TALA * R), px, py), ferro, { tabua: 0, bisel: GROSSURA_DA_TALA * R, tom: TOM_DA_TALA, metal: BRILHO_DO_FERRO, contorno: 0.26, projeta: { dist: 0.9 * k, forca: 0.32 }, semente: 13210 + i * 2 }))
    L.push(P(elipse(px, py, RAIO_DA_CABECA * R, RAIO_DA_CABECA * R), ferro, { tabua: 0, bisel: RAIO_DA_CABECA * R * 0.9, tom: TOM_DA_CABECA, metal: 0.45, contorno: 0.26, projeta: { dist: 1 * k, forca: 0.32 }, semente: 13211 + i * 2 }))
  })
}
