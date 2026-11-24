/**
 * FOSSO DE BRASAS de cima com volume (construção do lote L03 de 24/11/2026,
 * Tortura e fogo; desenho ORIGINAL, junta a ideia do "fosso de brasa com
 * grade" e a da "fornalha de incineração" dos mapas de referência): a COVA
 * quadrada no chão da masmorra, com a BORDA de pedras assentadas (os quatro
 * cunhais e três pedras de cada lado, com manchas de fuligem e o calor
 * tingindo a beira de dentro; uma pedra lascada e outra fora do prumo), as
 * PAREDES de tijolo descendo até o LEITO de carvão em brasa viva e, por cima,
 * a GRELHA de forja: cinco barras quadradas e grossas num rumo e cinco no
 * outro, cruzadas, com as pontas sobrando, deitada na borda sobre quatro
 * CALÇOS de ferro nos cunhais. Sem quadro, dobradiça nem argola: não é
 * alçapão nem janela de cela, é uma grelha pousada.
 *
 * Do alto vê-se a FUNDURA: a parede de dentro aparece larga no lado de trás e
 * no da esquerda (o tijolo quase preto na boca, laranja junto do leito) e só
 * como lasca no da frente e no da direita; a borda de trás e a da esquerda
 * fazem sombra no leito.
 *
 * O leito é uma textura só (`texBrasasVivas`): torrões de tamanhos misturados,
 * escuros com a cinza na crista, a brasa correndo nas frestas entre eles e,
 * mais para o meio, torrões inteiros acesos. As barras pegam o fogo POR
 * BAIXO: o lombo é ferro escuro e a beira de baixo de cada uma, o laranja da
 * brasa. O brilho do desenho é contido (regra 5 do estilo): quem ilumina é a
 * entrada em `LUZ_DOS_OBJETOS`.
 *
 * NA 3/4 é derivado (`tresQuartos.ts`): a borda é uma coluna em anel
 * (`ALTURA` casa) e a grelha, um tampo solto em cima dos calços; as peças da
 * cova (as paredes, o leito, o halo) têm a caixa centrada num vão da grelha,
 * fora de qualquer estrutura, e ficam no chão; a grelha sai depois da borda,
 * por cima das pedras. Nada lê o giro.
 *
 * A 25% de zoom sobram o quadrado de pedra, o miolo quente e o xadrez escuro
 * da grelha por cima: é o que diz "fosso de brasas", e não poço (a água), ralo
 * (rente e pequeno) ou fogueira (a roda de pedras, sem grelha). Materiais:
 * `pedra` (a borda) e `metal` (a grelha). Tudo sai de frações da pegada (2 x 2
 * casas de partida).
 */
import { hash, limitar01, misturar, passoSuave, type Rgb } from '../../ruido'
import { caixa, capsula, elipse, menos, poligono, uniao, type Forma, type Ponto } from './formas'
import { contato, ruido, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm, emOrdem, solta } from './andaimeDaTresQuartos'
import { FOGO_PARADO, texHalo } from './fogoDeCasa'
import { BRASA_QUENTE, BRASA_VIVA } from './fogueira'

/** O fosso foi medido no tamanho de partida (2 casas, 56 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = G
/** A altura da borda, em casas do lado: um degrau baixo de pedra. */
const ALTURA = 0.09

/** Em fração da meia pegada: a borda por fora e por dentro (a boca da cova). */
const BORDA_DE_FORA = 0.95
const BOCA = 0.7
/**
 * A parede de dentro que se vê do alto, em fração da meia pegada: larga no lado de trás e no da esquerda (olha-se a
 * cova de cima e um pouco de frente, com a luz de cima à esquerda) e só uma lasca no da frente e no da direita.
 */
const PAREDE_DE_TRAS = 0.07
const PAREDE_DA_ESQUERDA = 0.06
const LASCA_DE_PAREDE = 0.016
/** O tijolo da parede: o comprimento (px de partida) e quantas fiadas cabem na faixa. */
const TIJOLO = 9.5
const FIADAS = 2
/** As pedras da borda: onde cada lado é cortado (frações entre os dois cunhais) e a junta (px de partida). */
const CORTES_DO_LADO: readonly (readonly number[])[] = [
  [0, 0.36, 0.7, 1],
  [0, 0.3, 0.63, 1],
  [0, 0.38, 0.66, 1],
  [0, 0.32, 0.7, 1],
]
const JUNTA = 1
/** A pedra fora do prumo (o lado e qual pedra dele): o quanto sai para fora (px de partida) e o quanto entorta (rad). */
const FORA_DO_PRUMO = { lado: 1, pedra: 0, sai: 1.5, entorta: 0.045 }
/** O cunhal lascado (o de cima à direita): o tamanho da lasca que falta na quina de fora (px de partida). */
const LASCA_DO_CUNHAL = 5.2
/**
 * A pedra: o grão do granito cai à metade (a 4x o pontilhado preto e branco lia como sal e pimenta) e a fuligem vem em
 * manchas macias, mais forte na beira de dentro. O calor tinge só o trecho mais perto da boca.
 */
const GRAO_DA_BORDA = 0.5
const FULIGEM = 0.3
const MANCHA_DE_FULIGEM = 0.16
const CLARO_DO_FOGO_NA_BORDA = 0.5
const TRECHO_QUENTE_DA_BORDA = 0.15

/** A grelha: onde fica cada barra (fração da meia pegada, as de fora deitadas na borda), até onde as pontas vão e a meia largura da barra (px de partida). */
const BARRAS: readonly number[] = [-0.77, -0.385, 0, 0.385, 0.77]
const PONTA_DA_BARRA = 0.895
/**
 * Onde o meio da caixa de uma peça pode ficar para NÃO cair debaixo de uma barra (frações da meia pegada): a faixa da
 * borda por fora da barra de fora, a distância mínima do eixo de qualquer barra e o ponto livre do vão do meio da cova.
 * A peça sobe com a estrutura que contém o meio da caixa dela: a pedra, com a borda; o que é da cova fica no chão.
 */
const FAIXA_LIVRE_DA_BORDA = 0.845
const FOLGA_DA_BARRA = 0.1
const VAO_LIVRE = 0.1
const RAIO_DA_BARRA = 2.4
/** Os calços de ferro nos cunhais, debaixo dos cruzamentos de fora: o meio lado e a altura (px de partida). */
const MEIO_CALCO = 5.4
const ALTURA_DO_CALCO = 2.2
/** O rim light da brasa na beira de baixo de cada barra: o quanto tinge no ponto mais quente. */
const RIM_DA_BRASA = 0.5

/**
 * O leito: o lado médio do torrão (px de partida), o quanto o sorteio engorda cada um (fração do lado: os tamanhos saem
 * de uns 0,6 a 1,4 do médio), a largura da fresta em brasa e até onde o miolo é quente (fração).
 */
const TORRAO = 5.8
const ENGORDA_DO_TORRAO = 0.34
const FRESTA = 0.22
const RAIO_DO_CALOR = 0.7
const ALFA_DO_HALO = 0.13

const TOM_DO_FERRO = 0.8
const BRILHO_DO_FERRO = 0.3
/** A frente da borda na 3/4 (a face de fora e a de dentro da cova): a pedra um pouco mais no escuro que o alto dela. */
const TOM_DA_FRENTE_DA_BORDA = 0.84
/** A argamassa das juntas, escura. */
const TOM_DA_ARGAMASSA = 0.56
const ESCURO_DA_PEDRA: Rgb = [0x45, 0x40, 0x3b]
/** O carvão e a cinza da crista dele; a brasa funda das frestas da beira e o miolo mais claro dos torrões acesos. */
const CARVAO: Rgb = [0x40, 0x3a, 0x36]
const CINZA_DO_CARVAO: Rgb = [0x82, 0x7b, 0x73]
const BRASA_FUNDA: Rgb = [0x66, 0x38, 0x2c]
const MIOLO_DA_BRASA: Rgb = [0xda, 0x9c, 0x62]
/** A parede da cova: o tijolo quase preto na boca e laranja quente junto do leito. */
const PAREDE_NA_BOCA: Rgb = [0x2c, 0x25, 0x22]
const PAREDE_JUNTO_DO_FOGO: Rgb = [0xa6, 0x64, 0x40]
const PAREDE: MaterialDaPeca = { classe: 'liso', rgb: PAREDE_NA_BOCA }
const SOMBRA_NA_COVA: MaterialDaPeca = { classe: 'liso', rgb: [0x2c, 0x22, 0x1f] }

const DA_PEDRA = texturaDaClasse('pedra')
const DO_METAL = texturaDaClasse('metal')

/** A distância "quadrada" ao meio, em fração da meia pegada: 1 na beira da pegada, igual nos quatro lados. */
function quadrada(x: number, y: number, hw: number, hh: number): number {
  return Math.max(Math.abs(x) / hw, Math.abs(y) / hh)
}

/** A fração `v` (ao longo de um lado da borda) empurrada para fora do eixo da barra mais perto, se cair debaixo dela. */
function entreAsBarras(v: number): number {
  for (const b of BARRAS) if (Math.abs(v - b) < FOLGA_DA_BARRA) return b + (v >= b ? FOLGA_DA_BARRA : -FOLGA_DA_BARRA)
  return v
}

/** A forma girada `angulo` rad em volta de (cx, cy), com a caixa `folga` px maior: a pedra fora do prumo. */
function entortada(f: Forma, cx: number, cy: number, angulo: number, folga: number): Forma {
  const co = Math.cos(angulo)
  const si = Math.sin(angulo)
  return {
    b: [f.b[0] - folga, f.b[1] - folga, f.b[2] + folga, f.b[3] + folga],
    d: (x, y) => f.d(cx + (x - cx) * co + (y - cy) * si, cy - (x - cx) * si + (y - cy) * co),
  }
}

/**
 * O LEITO de carvão em brasa viva, numa textura só: torrões de TAMANHOS MISTURADOS (cada célula ganha um tanto sorteado
 * de raio, para as frestas não saírem iguais como um mosaico), o carvão escuro com a cinza do lado da luz, a brasa nas
 * frestas e, quanto mais perto do meio (mx, my), mais torrões inteiros acesos. `lado` = o tamanho médio do torrão (px).
 */
function texBrasasVivas(hw: number, hh: number, lado: number, semente: number, mx: number, my: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const gx = x / lado
    const gy = y / lado
    const ix = Math.floor(gx)
    const iy = Math.floor(gy)
    let perto = 9
    let segunda = 9
    let sorte = 0
    let dx = 0
    let dy = 0
    for (let j = -2; j <= 2; j += 1) {
      for (let i = -2; i <= 2; i += 1) {
        const [a, b] = [ix + i, iy + j]
        const ex = gx - (a + 0.1 + 0.8 * hash(a, b, semente))
        const ey = gy - (b + 0.1 + 0.8 * hash(a, b, semente + 1))
        const d = Math.hypot(ex, ey) - ENGORDA_DO_TORRAO * hash(a, b, semente + 3)
        if (d < perto) {
          segunda = perto
          perto = d
          sorte = hash(a, b, semente + 2)
          dx = ex
          dy = ey
        } else if (d < segunda) segunda = d
      }
    }
    const calor = limitar01(1.08 - Math.hypot((x - mx) / hw, (y - my) / hh) / RAIO_DO_CALOR + ruido(x * 0.09 + 5, y * 0.09 + 13) * 0.5)
    const fresta = limitar01(1 - (segunda - perto) / (FRESTA * (0.45 + 0.55 * calor)))
    const acesa = sorte < 0.05 + 0.46 * calor
    let cor: Rgb
    let emissao: number
    if (acesa) {
      // A brasa: o miolo mais claro, com a crosta escurecendo em manchas.
      const miolo = limitar01(1 - Math.hypot(dx, dy) * 1.5)
      cor = misturar(BRASA_VIVA, MIOLO_DA_BRASA, limitar01(miolo * (0.35 + 0.65 * calor) + ruido(x * 0.5 + 3, y * 0.5 + 8) * 0.5))
      emissao = 0.9
    } else {
      // O carvão: a cinza e a luz ficam do lado de cima à esquerda do torrão (nada de bola com brilho no meio).
      const crista = limitar01(1 - Math.hypot(dx + 0.16, dy + 0.13) * 1.9)
      cor = misturar(CARVAO, CINZA_DO_CARVAO, crista * crista * (0.5 - 0.3 * calor))
      emissao = 0.1
      s[3] += -(dx * 0.62 + dy * 0.48) * 0.34 + ruido(x * 0.6 + 11, y * 0.6 + 2) * 0.1
    }
    const naFresta = misturar(BRASA_FUNDA, BRASA_QUENTE, 0.15 + 0.85 * calor)
    const t = fresta * (acesa ? 0.35 : 0.9)
    s[0] = cor[0] + (naFresta[0] - cor[0]) * t
    s[1] = cor[1] + (naFresta[1] - cor[1]) * t
    s[2] = cor[2] + (naFresta[2] - cor[2]) * t
    s[4] = emissao + (0.92 - emissao) * fresta
  }
}

/**
 * A pedra da borda: a textura da pedra com o grão à metade, a fuligem em manchas macias (mais forte para a boca da
 * cova) e o calor tingindo só o trecho mais perto da boca.
 */
function texDaBorda(hw: number, hh: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DA_PEDRA !== null) DA_PEDRA(u, v, x, y, p, s, escala)
    s[6] *= GRAO_DA_BORDA
    const t = limitar01((BORDA_DE_FORA - quadrada(x, y, hw, hh)) / (BORDA_DE_FORA - BOCA))
    const mancha = limitar01(0.35 + ruido(x * 0.075 + 9, y * 0.075 + 2) * 2.4)
    s[3] -= MANCHA_DE_FULIGEM * mancha * (0.35 + 0.65 * t) + FULIGEM * t * t * (0.6 + 0.4 * mancha)
    const quente = CLARO_DO_FOGO_NA_BORDA * passoSuave(1 - TRECHO_QUENTE_DA_BORDA, 1, t)
    if (quente <= 0) return
    s[0] += (BRASA_QUENTE[0] - s[0]) * quente
    s[1] += (BRASA_QUENTE[1] - s[1]) * quente
    s[2] += (BRASA_QUENTE[2] - s[2]) * quente
    s[4] = quente * 0.6
  }
}

/**
 * A PAREDE da cova, vista do alto: em cada lado, `t` vai de 0 (o pé dela, junto do leito) a 1 (a boca). O tijolo é
 * laranja quente embaixo e quase preto na boca, em fiadas com a junta escura; a parede da esquerda fica um pouco mais
 * no escuro que a de trás. No lado da frente e no da direita só cabe a lasca.
 */
function texDaParede(hw: number, hh: number, k: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const fx = x / hw
    const fy = y / hh
    const deTras = (-fy - (BOCA - PAREDE_DE_TRAS)) / PAREDE_DE_TRAS
    const daEsquerda = (-fx - (BOCA - PAREDE_DA_ESQUERDA)) / PAREDE_DA_ESQUERDA
    const daFrente = (fy - (BOCA - LASCA_DE_PAREDE)) / LASCA_DE_PAREDE
    const daDireita = (fx - (BOCA - LASCA_DE_PAREDE)) / LASCA_DE_PAREDE
    const t = limitar01(Math.max(deTras, daEsquerda, daFrente, daDireita))
    const naEsquerda = daEsquerda > deTras && daEsquerda > 0
    const cor = misturar(PAREDE_JUNTO_DO_FOGO, PAREDE_NA_BOCA, Math.pow(t, 1.25))
    // As fiadas de tijolo: a junta deitada entre duas fiadas e as juntas em pé, desencontradas de uma fiada para a outra.
    const fiada = Math.min(FIADAS - 1, Math.floor(t * FIADAS))
    const naFiada = t * FIADAS - fiada
    const aoLongo = ((naEsquerda ? y : x) / (TIJOLO * k) + fiada * 0.5) % 1
    const junta = naFiada < 0.14 || Math.abs(((aoLongo + 1) % 1) - 0.5) > 0.46 ? 0.78 : 1
    const luz = (naEsquerda ? 0.84 : 1) * junta * (1 + ruido(x * 0.4 + 7, y * 0.4) * 0.16)
    s[0] = cor[0] * luz
    s[1] = cor[1] * luz
    s[2] = cor[2] * luz
    s[4] = 0.62 * (1 - t)
  }
}

/**
 * O ferro de uma barra da grelha: escuro no lombo e, na BEIRA DE BAIXO (a da frente na barra deitada, a da direita na
 * barra em pé), o laranja da brasa que sobe por baixo; só em cima da cova, e mais forte no meio dela.
 */
function texDaBarra(meio: number, raio: number, deitada: boolean, hw: number, hh: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    if (quadrada(x, y, hw, hh) > BOCA) return
    const beira = limitar01((((deitada ? y : x) - meio) / raio - 0.05) / 0.75)
    if (beira <= 0) return
    const calor = limitar01(1.2 - Math.hypot(x / hw, y / hh) / BOCA)
    // Em média o tom pedido (`RIM_DA_BRASA`); na quina de baixo, onde a brasa pega em cheio, um pouco mais.
    const t = RIM_DA_BRASA * beira * (0.6 + 0.9 * beira) * (0.5 + 0.5 * calor)
    s[0] += (BRASA_QUENTE[0] - s[0]) * t
    s[1] += (BRASA_QUENTE[1] - s[1]) * t
    s[2] += (BRASA_QUENTE[2] - s[2]) * t
    s[4] = t * 1.3
  }
}

export const montarFossoDeBrasas: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const pedra = c.m.pedra
  const ferro = c.m.metal
  const L = cena.partes
  const altura = 2 * R * ALTURA
  cena.corDoPiso = ESCURO_DA_PEDRA
  const quadrado = (f: number, raio = 0): Forma => caixa(-f * hw, -f * hh, f * hw, f * hh, raio)
  const doFerro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 0.8 * k, contorno: 0.3, tom: TOM_DO_FERRO, metal: BRILHO_DO_FERRO, semente, ...mais })
  const [bx, by] = [BOCA * hw, BOCA * hh]
  const [fx, fy] = [BORDA_DE_FORA * hw, BORDA_DE_FORA * hh]
  const j = (JUNTA * k) / 2

  // ---------- as pedras da borda: os quatro cunhais (um lascado na quina de fora) e três de cada lado (uma fora do prumo) ----------
  // Cada pedra tem o `assento` (a argamassa escura do lugar dela, que aparece nas juntas e na lasca) e o `meio`: um
  // ponto dela que não fica debaixo de nenhuma barra, para a pedra subir com a borda, nunca com a grelha.
  const [livreX, livreY] = [FAIXA_LIVRE_DA_BORDA * hw, FAIXA_LIVRE_DA_BORDA * hh]
  const pedras: { forma: Forma; assento: Forma; meio: Ponto; semente: number; tom: number }[] = []
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const x0 = sx < 0 ? -fx : bx
      const y0 = sy < 0 ? -fy : by
      const assento = caixa(x0, y0, x0 + (fx - bx), y0 + (fy - by), 3 * k)
      let forma = caixa(x0 + j, y0 + j, x0 + (fx - bx) - j, y0 + (fy - by) - j, 2.4 * k)
      if (sx > 0 && sy < 0) {
        // A lasca: a quina de fora (a de cima à direita) saiu num corte torto.
        const l = LASCA_DO_CUNHAL * k
        forma = menos(forma, poligono([[fx - l * 1.25, -fy - 1], [fx + 1, -fy - 1], [fx + 1, -fy + l]]))
      }
      pedras.push({ forma, assento, meio: [sx * livreX, sy * livreY], semente: 24411 + sx + sy * 2, tom: 0.94 + 0.12 * hash(sx, sy, 24411) })
    }
  }
  let foraDoPrumo: Forma | null = null
  for (const [lado, cortes] of CORTES_DO_LADO.entries()) {
    for (let i = 0; i < cortes.length - 1; i += 1) {
      // Os lados 0 e 1 são o de trás e o da frente (as pedras correm em x); o 2 e o 3, a esquerda e a direita.
      const [a, b] = lado < 2 ? [-bx + 2 * bx * cortes[i], -bx + 2 * bx * cortes[i + 1]] : [-by + 2 * by * cortes[i], -by + 2 * by * cortes[i + 1]]
      const m = (a + b) / 2
      let assento =
        lado === 0 ? caixa(a, -fy, b, -by, 0.6 * k)
        : lado === 1 ? caixa(a, by, b, fy, 0.6 * k)
        : lado === 2 ? caixa(-fx, a, -bx, b, 0.6 * k)
        : caixa(bx, a, fx, b, 0.6 * k)
      let forma =
        lado === 0 ? caixa(a + j, -fy + j, b - j, -by - j, 2 * k)
        : lado === 1 ? caixa(a + j, by + j, b - j, fy - j, 2 * k)
        : lado === 2 ? caixa(-fx + j, a + j, -bx - j, b - j, 2 * k)
        : caixa(bx + j, a + j, fx - j, b - j, 2 * k)
      if (lado === FORA_DO_PRUMO.lado && i === FORA_DO_PRUMO.pedra) {
        const sai = FORA_DO_PRUMO.sai * k
        const [cx, cy] = [m, (by + fy) / 2 + sai]
        forma = entortada(caixa(a + j, by + j + sai, b - j, fy - j + sai, 2 * k), cx, cy, FORA_DO_PRUMO.entorta, 1.5 * k)
        // O assento acompanha a pedra que saiu (um fio maior que ela, para a caixa dele nunca ser menor que a dela).
        assento = uniao(assento, entortada(caixa(a, by + sai, b, fy + sai, 2 * k), cx, cy, FORA_DO_PRUMO.entorta, 1.5 * k + j))
        foraDoPrumo = forma
      }
      // O meio: na faixa livre da borda e fora do eixo de qualquer barra.
      const ao = entreAsBarras(m / (lado < 2 ? hw : hh)) * (lado < 2 ? hw : hh)
      const meio: Ponto = lado === 0 ? [ao, -livreY] : lado === 1 ? [ao, livreY] : lado === 2 ? [-livreX, ao] : [livreX, ao]
      pedras.push({ forma, assento, meio, semente: 24420 + lado * 4 + i, tom: 0.9 + 0.2 * hash(lado, i, 24420) })
    }
  }

  // ---------- as formas: a borda em anel (com a pedra que sai do prumo) e a grelha (cinco barras em cada rumo) ----------
  const cheia = quadrado(BORDA_DE_FORA, 3 * k)
  const porFora = foraDoPrumo === null ? cheia : uniao(cheia, foraDoPrumo)
  const borda = menos(porFora, quadrado(BOCA))
  const raio = RAIO_DA_BARRA * k
  const [pontaX, pontaY] = [PONTA_DA_BARRA * hw, PONTA_DA_BARRA * hh]
  const emPe = BARRAS.map((f) => ({ meio: f * hw, forma: caixa(f * hw - raio, -pontaY, f * hw + raio, pontaY, 0.5 * k) }))
  const deitadas = BARRAS.map((f) => ({ meio: f * hh, forma: caixa(-pontaX, f * hh - raio, pontaX, f * hh + raio, 0.5 * k) }))
  const grelha = [...emPe, ...deitadas].map((b) => b.forma).reduce((f, b) => uniao(f, b))
  const alturaDaGrelha = altura + ALTURA_DO_CALCO * k

  // ---------- as sombras: a borda (coluna em anel) e a grelha (tampo solto, só para a 3/4) ----------
  cena.sombras.push(contato(porFora, 0.34))
  cena.sombras.push({ forma: borda, z: altura, forca: 0.3 })
  // A grelha pousa EM CIMA da borda: na 3/4 ela sai depois da borda (a caixa cresce até passar a base dela), por cima das pedras.
  cena.sombras.push(solta(emOrdem([grelha], borda.b[3])[0], alturaDaGrelha))

  // ---------- a cova: as paredes de tijolo, o leito em brasa, a sombra da borda lá dentro e o halo (a caixa centrada num vão da grelha) ----------
  const noVao = (f: Forma): Forma => comMeioEm(f, VAO_LIVRE * hw, VAO_LIVRE * hh)
  const leito = { x0: -(BOCA - PAREDE_DA_ESQUERDA) * hw, y0: -(BOCA - PAREDE_DE_TRAS) * hh, x1: (BOCA - LASCA_DE_PAREDE) * hw, y1: (BOCA - LASCA_DE_PAREDE) * hh }
  const [mx, my] = [(leito.x0 + leito.x1) / 2, (leito.y0 + leito.y1) / 2]
  const naCova: Peca[] = []
  naCova.push(P(quadrado(BOCA + 0.01), PAREDE, { tabua: 0, bisel: 0, contorno: 0, textura: texDaParede(hw, hh, k), semente: 24401 }))
  naCova.push(P(caixa(leito.x0, leito.y0, leito.x1, leito.y1, 1.2 * k), FOGO_PARADO, { tabua: 0, bisel: 0, contorno: 0.16, textura: texBrasasVivas(hw, hh, TORRAO * k, 24402, mx, my), semente: 24402 }))
  // A borda de trás e a da esquerda fazem sombra no leito: é o que dá a fundura.
  naCova.push(P(capsula(leito.x0, leito.y0, leito.x1, leito.y0, 3.4 * k), SOMBRA_NA_COVA, { bisel: 0, contorno: 0, alfa: 0.46, suave: 6 * k, semente: 24403 }))
  naCova.push(P(capsula(leito.x0, leito.y0, leito.x0, leito.y1, 3.2 * k), SOMBRA_NA_COVA, { bisel: 0, contorno: 0, alfa: 0.4, suave: 6 * k, semente: 24404 }))
  const [haloX, haloY] = [(leito.x1 - leito.x0) / 2, (leito.y1 - leito.y0) / 2]
  naCova.push(P(elipse(mx, my, haloX, haloY), FOGO_PARADO, { textura: texHalo(mx, my, haloX, haloY, ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 24405 }))
  for (const p of naCova) L.push({ ...p, forma: noVao(p.forma) })

  // ---------- a borda: o assento de argamassa escura de cada pedra e, por cima, as pedras ----------
  // O assento é sempre maior que a pedra dele, então a maior peça da borda é um assento: a 3/4 tira dele o material da
  // FRENTE. Vai sem o grão do granito (o pontilhado preto e branco virava sal e pimenta na frente inteira): a pedra
  // escolhida, um pouco mais no escuro, com o ruído macio da ardósia.
  const semGrao: MaterialDaPeca = { classe: 'pedra', rgb: [pedra.rgb[0] * TOM_DA_FRENTE_DA_BORDA, pedra.rgb[1] * TOM_DA_FRENTE_DA_BORDA, pedra.rgb[2] * TOM_DA_FRENTE_DA_BORDA], pedra: 'ardosia' }
  for (const p of pedras) L.push(P(comMeioEm(p.assento, p.meio[0], p.meio[1]), semGrao, { tabua: 0, bisel: 1.2 * k, contorno: 0.3, tom: TOM_DA_ARGAMASSA / TOM_DA_FRENTE_DA_BORDA, semente: p.semente + 100 }))
  const texPedra = texDaBorda(hw, hh)
  for (const p of pedras) L.push(P(comMeioEm(p.forma, p.meio[0], p.meio[1]), pedra, { tabua: 0, bisel: 2 * k, contorno: 0.22, tom: p.tom, textura: texPedra, semente: p.semente }))

  // ---------- os calços de ferro nos cunhais, debaixo dos cruzamentos de fora da grelha ----------
  const meioCalco = MEIO_CALCO * k
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const [x, y] = [sx * BARRAS[4] * hw, sy * BARRAS[4] * hh]
      L.push(P(caixa(x - meioCalco, y - meioCalco, x + meioCalco, y + meioCalco, 0.9 * k), ferro, doFerro(24430 + sx + sy * 2, { bisel: 1.1 * k, tom: 0.66, metal: 0.2, projeta: { dist: 1 * k, forca: 0.32 } })))
    }
  }

  // ---------- a grelha de forja: as cinco barras em pé por baixo e as cinco deitadas por cima, quadradas, com as pontas sobrando ----------
  emPe.forEach((b, i) => {
    L.push(P(b.forma, ferro, doFerro(24441 + i, { eixo: Math.PI / 2, bisel: 1.1 * k, tom: TOM_DO_FERRO * (0.9 + 0.08 * hash(i, 2, 24441)), textura: texDaBarra(b.meio, raio, false, hw, hh), projeta: { dist: 1.3 * k, forca: 0.34 } })))
  })
  deitadas.forEach((b, i) => {
    L.push(P(b.forma, ferro, doFerro(24451 + i, { bisel: 1.1 * k, tom: TOM_DO_FERRO * (0.98 + 0.1 * hash(i, 3, 24451)), textura: texDaBarra(b.meio, raio, true, hw, hh), projeta: { dist: 1.5 * k, forca: 0.36 } })))
  })
}
