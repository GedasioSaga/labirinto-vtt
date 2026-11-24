/**
 * BRASEIRO COM FERROS DE MARCAR de cima com volume (lote L03 de 24/11/2026,
 * Tortura e fogo; versão do Braseiro, desenho ORIGINAL): a bacia do carrasco.
 * Um TACHO baixo e BOJUDO de ferro batido (a boca mais estreita que a
 * barriga), de borda chata rebitada e escura de fuligem, sobre três pés curtos
 * quase escondidos debaixo do bojo, com duas ARGOLAS de carregar caídas contra
 * ele; dentro, o carvão em BRASA VIVA; e, enfiados nele, TRÊS FERROS DE
 * MARCAR: a haste de ferro que entra em brasa e SOME debaixo de um monte de
 * carvão (a marca fica enterrada, esquentando) e o PUNHO de madeira com a
 * virola, apoiado na borda e sobrando para fora.
 *
 * Revisão do diretor de arte (24/11/2026): as três marcas acesas à mostra
 * (argola, cruz e triângulo) liam como os botões de um controle, ícone de
 * interface. Saíram: nenhuma forma geométrica limpa em cima do leito. O calor
 * do leito fica concentrado no lado dos ferros, e os torrões têm tamanhos
 * misturados (nada de mosaico regular).
 *
 * É o que o separa do Braseiro (a bacia alta no tripé, só brasa): este é
 * baixo, sem tripé, e os três punhos em leque dizem para que serve. A brasa é
 * parada, sem chama: não entra na disposição do fogo de casa
 * (`lib/mobilia/fogoDeCasa.ts`). O brilho do desenho é contido; quem ilumina é
 * a entrada em `LUZ_DOS_OBJETOS` (laranja).
 *
 * NA 3/4 é derivado (`tresQuartos.ts`), com dois PINOS (pontos sem sombra,
 * como a bacia do Braseiro): o do BOJO sobe a barriga menos que a boca, e a
 * parte de baixo dela aparece redonda debaixo da borda, com a luz de um
 * cilindro (o claro à esquerda, o escuro à direita); o da BOCA sobe a borda,
 * o leito, os ferros e os punhos, que ficam no ar por cima da borda. Os pés
 * ficam no chão. A sombra de cada punho nasce na sombra do tacho, para não
 * virar vareta solta. Nada lê o giro.
 *
 * A 25% de zoom sobram o anel escuro com o miolo quente e os três riscos dos
 * punhos saindo para baixo à direita. Material: `metal` (o tacho e as hastes).
 * A madeira dos punhos, o carvão e o fogo são fixos. Tudo sai do menor lado da
 * pegada (1 x 1 casa de partida).
 */
import { hash, limitar01, misturar, passoSuave, type Rgb } from '../../ruido'
import { anel, barra, capsula, elipse, poligono, uniao, type Forma, type Ponto } from './formas'
import { bordaDaSombra, contato, ruido, SOMBRA_X, SOMBRA_Y, texturaDaClasse, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm, deslocada, pino, solta } from './andaimeDaTresQuartos'
import { FOGO_PARADO, texBrasa, texHalo } from './fogoDeCasa'
import { BRASA_QUENTE, BRASA_VIVA } from './fogueira'

/** O braseiro foi medido no tamanho de partida (1 casa, 28 px de meio lado): as medidas miúdas escalam por aqui. */
const MEIO_LADO_DE_PARTIDA = 0.5 * G
const GRAUS = Math.PI / 180
/** A altura da boca do tacho, em casas do lado, e a da barriga (a parte mais larga), em fração dela. */
const ALTURA = 0.2
const ALTURA_DO_BOJO = 0.42

/** O meio do tacho na pegada (fração do meio lado): para cima à esquerda, para os punhos caberem. */
const MEIO: Ponto = [-0.15, -0.15]
/** Os raios, em fração do meio lado: a borda por fora e por dentro, a roda dos rebites, o leito e o bojo (a boca é 8% mais estreita que ele). */
const BORDA_DE_FORA = 0.66
const BORDA_DE_DENTRO = 0.54
const RAIO_DOS_REBITES = 0.6
const REBITES = 12
const RAIO_DO_LEITO = 0.56
const RAIO_DO_BOJO = 0.72
/** Os pés (o ângulo de cada um, 90 = a frente): curtos, de debaixo da borda até pouco além dela. */
const PES: readonly number[] = [128, 248, 8]
const PE_DE = BORDA_DE_FORA - 0.06
const PE_ATE = BORDA_DE_FORA + 0.04
/** As argolas de carregar, encostadas no bojo: o ângulo de cada uma, o raio em que o meio dela fica e os raios do anel (px de partida). */
const ARGOLAS: readonly number[] = [188, 282]
const RAIO_DAS_ARGOLAS = BORDA_DE_FORA + 0.02
const ARGOLA = { fora: 2.6, dentro: 1.5 }
/**
 * Os ferros: o ângulo (graus), onde o punho começa e onde acaba (fração do meio lado a partir do meio do tacho).
 * A ponta de todos some no carvão em `PONTA_ENTERRADA`.
 */
const FERROS: readonly { readonly graus: number; readonly punho: number; readonly fim: number }[] = [
  { graus: 18, punho: 0.86, fim: 1.2 },
  { graus: 48, punho: 0.9, fim: 1.27 },
  { graus: 78, punho: 0.84, fim: 1.17 },
]
const PONTA_ENTERRADA = 0.31
const RAIO_DA_HASTE = 0.95
const RAIO_DO_PUNHO = 1.9
/** Até onde a haste fica em brasa, a partir do meio do tacho (fração do meio lado). */
const HASTE_EM_BRASA = 0.72
/**
 * O MONTE de carvão que enterra as pontas: o ângulo (graus) e o raio (fração do meio lado) de cada torrão, a partir do
 * meio do tacho, e o tamanho dele (px de partida). Da haste sobra à vista 0,15 do meio lado, entre a borda e o monte.
 */
const MONTE: readonly (readonly [number, number, number])[] = [
  [48, 0.1, 2.9],
  [17, 0.28, 3.1],
  [79, 0.28, 3],
  [48, 0.3, 3.4],
]
/** A brasa que aparece por baixo de cada torrão do monte (px de partida a mais que ele): um fio aceso rente à base. */
const BRASA_DEBAIXO_DO_TORRAO = 0.55

/**
 * O leito: o lado médio do torrão (px de partida), o quanto o sorteio engorda cada um (fração do lado: os tamanhos saem
 * de uns 0,6 a 1,4 do médio) e a largura da fresta em brasa no ponto mais quente.
 */
const TORRAO = 5.6
const ENGORDA_DO_TORRAO = 0.34
const FRESTA = 0.24
/** O meio do calor: o ângulo e o raio (fração do meio lado), no lado dos ferros; e até onde ele chega (fração do raio do leito). */
const CALOR = { graus: 48, raio: 0.16, alcance: 1.05 }
const ALFA_DO_HALO = 0.14

const TOM_DO_BOJO = 0.78
const TOM_DA_BORDA = 1.02
const TOM_DO_REBITE = 1.34
const TOM_DO_PE = 0.6
const BRILHO_DO_FERRO = 0.3
const FULIGEM_NA_BORDA = 0.34
/** A luz de cilindro do bojo: onde fica o claro (de -1, a esquerda, a 1), quanto clareia lá e a quanto a direita cai. */
const CLARO_DO_BOJO = -0.4
const LUZ_NO_CLARO_DO_BOJO = 0.14
const QUEDA_NA_ESQUERDA_DO_BOJO = 0.2
const ESCURO_NA_DIREITA_DO_BOJO = 0.55
/** O quanto a barriga escurece onde vira para baixo, junto da beira. */
const VIRADA_DO_BOJO = 0.22
/** A sombra dos punhos no chão: fraca, e nascendo dentro da sombra do tacho. */
const FORCA_DA_SOMBRA_DOS_PUNHOS = 0.16
const ESCURO_DO_FERRO: Rgb = [0x4a, 0x45, 0x41]
/** O carvão e a cinza da crista dele; a fresta fria, a brasa funda e o miolo mais claro dos torrões acesos. */
const CARVAO: Rgb = [0x40, 0x3a, 0x36]
const CINZA_DO_CARVAO: Rgb = [0x82, 0x7b, 0x73]
const FRESTA_FRIA: Rgb = [0x30, 0x27, 0x24]
const BRASA_FUNDA: Rgb = [0x66, 0x38, 0x2c]
const MIOLO_DA_BRASA: Rgb = [0xda, 0x9c, 0x62]
const CARVAO_DO_MONTE: MaterialDaPeca = { classe: 'liso', rgb: CARVAO }
/** A madeira escura dos punhos (a nogueira do Meio-Termo, um pouco mais clara). */
const PUNHO: MaterialDaPeca = { classe: 'madeira', rgb: [0x80, 0x5e, 0x42] }

const DO_METAL = texturaDaClasse('metal')

/** O ferro batido: as covinhas do martelo por cima da textura do metal e, na borda, a fuligem crescendo para dentro. */
function texFerroBatido(cx: number, cy: number, R: number, fuligem: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    s[3] += (0.14 - Math.abs(ruido(x * 0.6 + p.su, y * 0.6 + p.sv))) * 0.2
    if (fuligem <= 0) return
    const t = limitar01((BORDA_DE_FORA - Math.hypot(x - cx, y - cy) / R) / (BORDA_DE_FORA - BORDA_DE_DENTRO))
    s[3] -= fuligem * t * t * (0.75 + ruido(x * 0.35 + 9, y * 0.35) * 0.9)
  }
}

/**
 * O BOJO: o ferro batido com a luz de um CILINDRO deitado na largura (o claro a 30% dela, a partir da esquerda; a
 * direita cai a `ESCURO_NA_DIREITA_DO_BOJO`) e a barriga escurecendo onde vira para baixo. É o que faz a lateral da 3/4
 * ler redonda, e não lata.
 */
function texDoBojo(cx: number, cy: number, raio: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    s[3] += (0.14 - Math.abs(ruido(x * 0.6 + p.su, y * 0.6 + p.sv))) * 0.2
    const t = (x - cx) / raio
    s[3] +=
      t < CLARO_DO_BOJO
        ? LUZ_NO_CLARO_DO_BOJO - QUEDA_NA_ESQUERDA_DO_BOJO * passoSuave(0, 1, (CLARO_DO_BOJO - t) / (1 + CLARO_DO_BOJO))
        : LUZ_NO_CLARO_DO_BOJO - (LUZ_NO_CLARO_DO_BOJO + 1 - ESCURO_NA_DIREITA_DO_BOJO) * passoSuave(0, 1, (t - CLARO_DO_BOJO) / (1 - CLARO_DO_BOJO))
    s[3] -= VIRADA_DO_BOJO * passoSuave(0.76, 1, Math.hypot(x - cx, y - cy) / raio)
  }
}

/**
 * O LEITO de carvão em brasa viva, numa textura só: torrões de TAMANHOS MISTURADOS (cada célula ganha um tanto sorteado
 * de raio: sem isso as frestas saíam finas e iguais, e o leito lia como grelha), o carvão escuro com a cinza do lado da
 * luz, e o CALOR concentrado em volta de (qx, qy), onde os ferros estão enterrados: lá os torrões viram brasa e as
 * frestas abrem e acendem; longe, o carvão é frio e a fresta, um risco escuro.
 */
function texBrasasVivas(raio: number, lado: number, semente: number, qx: number, qy: number): Textura {
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
    const calor = limitar01(1.1 - Math.hypot(x - qx, y - qy) / (raio * CALOR.alcance) + ruido(x * 0.12 + 5, y * 0.12 + 13) * 0.4)
    const fresta = limitar01(1 - (segunda - perto) / (FRESTA * (0.4 + 0.6 * calor)))
    const acesa = sorte < 0.03 + 0.66 * calor * calor
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
    const naFresta = calor < 0.4 ? misturar(FRESTA_FRIA, BRASA_FUNDA, calor / 0.4) : misturar(BRASA_FUNDA, BRASA_QUENTE, (calor - 0.4) / 0.6)
    const t = fresta * (acesa ? 0.35 : 0.9)
    s[0] = cor[0] + (naFresta[0] - cor[0]) * t
    s[1] = cor[1] + (naFresta[1] - cor[1]) * t
    s[2] = cor[2] + (naFresta[2] - cor[2]) * t
    s[4] = emissao + (0.92 * limitar01(calor * 2) - emissao) * fresta
  }
}

/** A haste do ferro de marcar: o metal e, até `ate` px do meio do tacho, o ferro em brasa (mais claro para dentro). */
function texHasteEmBrasa(cx: number, cy: number, ate: number): Textura {
  return (u, v, x, y, p, s, escala) => {
    if (DO_METAL !== null) DO_METAL(u, v, x, y, p, s, escala)
    const t = limitar01(1 - Math.hypot(x - cx, y - cy) / ate)
    if (t <= 0) return
    const cor = misturar(BRASA_VIVA, BRASA_QUENTE, t * 1.5)
    const q = Math.min(1, t * 3.4)
    s[0] += (cor[0] - s[0]) * q
    s[1] += (cor[1] - s[1]) * q
    s[2] += (cor[2] - s[2]) * q
    s[4] = q * 0.85
  }
}

/** Um torrão de carvão do monte: um seixo de sete lados tortos em volta de (x, y). */
function torrao(x: number, y: number, r: number, semente: number): Forma {
  const lados = 7
  const pontos: Ponto[] = []
  for (let i = 0; i < lados; i += 1) {
    const a = ((i + hash(i, 1, semente) * 0.6) / lados) * Math.PI * 2
    const d = r * (0.78 + 0.34 * hash(i, 2, semente))
    pontos.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.92])
  }
  return poligono(pontos)
}

/** O carvão do monte: a cinza na crista, puxada para o lado da luz. */
function texTorraoDoMonte(x0: number, y0: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const q = limitar01(1 - Math.hypot(x - x0 + r * 0.28, y - y0 + r * 0.3) / (r * 0.8))
    const t = q * q * 0.5
    s[0] += (CINZA_DO_CARVAO[0] - s[0]) * t
    s[1] += (CINZA_DO_CARVAO[1] - s[1]) * t
    s[2] += (CINZA_DO_CARVAO[2] - s[2]) * t
    s[3] += ruido(x * 0.7 + 3, y * 0.7) * 0.1
  }
}

export const montarBraseiroComFerros: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  const R = Math.min(hw, hh)
  const k = R / MEIO_LADO_DE_PARTIDA
  const ferro = c.m.metal
  const L = cena.partes
  const altura = 2 * R * ALTURA
  cena.corDoPiso = ESCURO_DO_FERRO
  const [cx, cy] = [MEIO[0] * hw, MEIO[1] * hh]
  const disco = (f: number): Forma => elipse(cx, cy, f * R, f * R)
  const em = (graus: number, f: number): Ponto => [cx + Math.cos(graus * GRAUS) * f * R, cy + Math.sin(graus * GRAUS) * f * R]
  const doFerro = (semente: number, mais: OpcoesDaPeca = {}): OpcoesDaPeca => ({ tabua: 0, bisel: 0.9 * k, contorno: 0.28, metal: BRILHO_DO_FERRO, semente, ...mais })

  // ---------- as sombras: o tacho baixo (o bojo arrastado até a altura da boca), os dois pinos da 3/4 e a dos punhos ----------
  const [sx, sy] = [SOMBRA_X * altura, SOMBRA_Y * altura]
  const bordaDaAltura = bordaDaSombra({ z: altura })
  const pinoDaBoca: Ponto = [cx, cy]
  const pinoDoBojo: Ponto = [cx + 1.2 * k, cy]
  cena.sombras.push(
    contato(disco(RAIO_DO_BOJO), 0.34),
    // Um disco arrastado numa reta é uma cápsula: a sombra do tacho inteiro, do pé à boca.
    { forma: capsula(cx, cy, cx + sx, cy + sy, RAIO_DO_BOJO * R), z: 0, suave: bordaDaAltura, forca: 0.3 },
    solta(pino(pinoDoBojo[0], pinoDoBojo[1]), altura * ALTURA_DO_BOJO),
    solta(pino(pinoDaBoca[0], pinoDaBoca[1]), altura),
  )
  // A sombra de cada punho nasce dentro da sombra do tacho e vai até a ponta dele: sem vareta solta no chão da 3/4.
  for (const f of FERROS) {
    const [ax, ay] = em(f.graus, RAIO_DO_BOJO * 0.5)
    const [bx, by] = em(f.graus, f.fim)
    cena.sombras.push({ forma: deslocada(capsula(ax, ay, bx, by, RAIO_DO_PUNHO * k * 0.9), sx, sy), z: 0, suave: bordaDaAltura, forca: FORCA_DA_SOMBRA_DOS_PUNHOS })
  }
  const naBoca = (p: Peca): Peca => ({ ...p, forma: comMeioEm(p.forma, pinoDaBoca[0], pinoDaBoca[1]) })
  const noBojo = (p: Peca): Peca => ({ ...p, forma: comMeioEm(p.forma, pinoDoBojo[0], pinoDoBojo[1]) })

  // ---------- no chão: os três pés curtos e escuros, quase escondidos debaixo do bojo ----------
  PES.forEach((graus, i) => {
    const [ax, ay] = em(graus, PE_DE)
    const [bx, by] = em(graus, PE_ATE)
    const pe = uniao(capsula(ax, ay, bx, by, 1.5 * k), elipse(bx, by, 2 * k, 2 * k))
    cena.sombras.push(contato(pe, 0.3))
    L.push(P(pe, ferro, doFerro(24301 + i, { bisel: 1.5 * k, tom: TOM_DO_PE, textura: texFerroBatido(cx, cy, R, 0) })))
  })

  // ---------- o bojo (a barriga, mais larga que a boca) e as argolas de carregar caídas contra ele ----------
  L.push(noBojo(P(disco(RAIO_DO_BOJO), ferro, doFerro(24310, { bisel: 2.2 * k, tom: TOM_DO_BOJO, contorno: 0.3, textura: texDoBojo(cx, cy, RAIO_DO_BOJO * R) }))))
  ARGOLAS.forEach((graus, i) => {
    const [ax, ay] = em(graus, RAIO_DAS_ARGOLAS)
    L.push(noBojo(P(anel(ax, ay, ARGOLA.fora * k, ARGOLA.fora * k, ARGOLA.dentro * k, ARGOLA.dentro * k), ferro, doFerro(24360 + i, { bisel: 0.6 * k, tom: 0.9, metal: 0.36, projeta: { dist: 0.9 * k, forca: 0.3 } }))))
  })

  // ---------- a boca: o leito em brasa (o calor no lado dos ferros), o halo, a borda chata e os rebites ----------
  const [qx, qy] = em(CALOR.graus, CALOR.raio)
  const boca: Peca[] = []
  boca.push(P(disco(RAIO_DO_LEITO), FOGO_PARADO, { tabua: 0, bisel: 0, contorno: 0, recesso: { k: 2.4 * k, forca: 0.4 }, textura: texBrasasVivas(RAIO_DO_LEITO * R, TORRAO * k, 24311, qx, qy), semente: 24311 }))
  boca.push(P(disco(RAIO_DO_LEITO), FOGO_PARADO, { textura: texHalo(qx, qy, RAIO_DO_LEITO * R, RAIO_DO_LEITO * R, ALFA_DO_HALO), bisel: 0, contorno: 0, semente: 24312 }))
  boca.push(P(anel(cx, cy, BORDA_DE_FORA * R, BORDA_DE_FORA * R, BORDA_DE_DENTRO * R, BORDA_DE_DENTRO * R), ferro, doFerro(24340, { bisel: 1.3 * k, tom: TOM_DA_BORDA, contorno: 0.3, textura: texFerroBatido(cx, cy, R, FULIGEM_NA_BORDA), projeta: { dist: 1.4 * k, forca: 0.38 } })))
  for (let i = 0; i < REBITES; i += 1) {
    const graus = ((i + 0.5) * 360) / REBITES
    // Nenhum rebite debaixo de uma haste.
    if (FERROS.some((f) => Math.abs(graus - f.graus) < 9)) continue
    const [rx, ry] = em(graus, RAIO_DOS_REBITES)
    boca.push(P(elipse(rx, ry, 1.05 * k, 1.05 * k), ferro, doFerro(24341 + i, { bisel: 1.05 * k, tom: TOM_DO_REBITE, metal: 0.55, contorno: 0.2 })))
  }
  // O grampo de cada argola, na borda.
  ARGOLAS.forEach((graus, i) => {
    const [gx, gy] = em(graus, RAIO_DOS_REBITES + 0.02)
    boca.push(P(elipse(gx, gy, 1.6 * k, 1.6 * k), ferro, doFerro(24362 + i, { bisel: 1.2 * k, tom: 1.12, metal: 0.45, projeta: { dist: 0.8 * k, forca: 0.3 } })))
  })

  // ---------- os ferros de marcar: a haste em brasa entrando no leito e o punho de madeira com a virola ----------
  FERROS.forEach((f, i) => {
    const [px, py] = em(f.graus, PONTA_ENTERRADA)
    const [hx, hy] = em(f.graus, f.punho)
    const [fx, fy] = em(f.graus, f.fim)
    const rumo = f.graus * GRAUS
    boca.push(P(capsula(px, py, hx, hy, RAIO_DA_HASTE * k), ferro, doFerro(24324 + i, { eixo: rumo, bisel: RAIO_DA_HASTE * k, tom: 0.96, textura: texHasteEmBrasa(cx, cy, HASTE_EM_BRASA * R), projeta: { dist: 1.3 * k, forca: 0.3 } })))
    boca.push(P(capsula(hx, hy, fx, fy, RAIO_DO_PUNHO * k), PUNHO, { tabua: 0, eixo: rumo, bisel: RAIO_DO_PUNHO * k * 0.9, contorno: 0.3, tom: 0.94 + 0.12 * hash(i, 1, 24328), semente: 24328 + i, projeta: { dist: 1.4 * k, forca: 0.3 } }))
    // A virola de ferro onde a haste entra no punho, e o furo de pendurar na outra ponta.
    const [vx, vy] = em(f.graus, f.punho + 0.05)
    const [nx, ny] = [-Math.sin(rumo) * RAIO_DO_PUNHO * k, Math.cos(rumo) * RAIO_DO_PUNHO * k]
    boca.push(P(barra(vx - nx, vy - ny, vx + nx, vy + ny, 2 * k), ferro, doFerro(24332 + i, { bisel: 0.7 * k, tom: 1.16, metal: 0.42 })))
    const [ox, oy] = em(f.graus, f.fim - 0.04)
    boca.push(P(elipse(ox, oy, 0.7 * k, 0.7 * k), ferro, doFerro(24336 + i, { bisel: 0, tom: 0.6, contorno: 0, metal: 0 })))
  })

  // ---------- o monte de carvão que enterra as pontas: a brasa por baixo de cada torrão (uma fresta acesa rente a ele) e o torrão escuro por cima ----------
  MONTE.forEach(([graus, raio, tamanho], i) => {
    const [mx, my] = em(graus, raio)
    const r = tamanho * k
    boca.push(P(torrao(mx, my, r + BRASA_DEBAIXO_DO_TORRAO * k, 24370 + i), FOGO_PARADO, { textura: texBrasa(mx, my, r * 1.5), bisel: 0, contorno: 0, semente: 24370 + i }))
  })
  MONTE.forEach(([graus, raio, tamanho], i) => {
    const [mx, my] = em(graus, raio)
    const r = tamanho * k
    boca.push(P(torrao(mx, my, r, 24370 + i), CARVAO_DO_MONTE, { tabua: 0, bisel: r * 0.7, contorno: 0.2, tom: 0.92 + 0.22 * hash(i, 3, 24380), textura: texTorraoDoMonte(mx, my, r), semente: 24380 + i, projeta: { dist: 0.9 * k, forca: 0.26 } }))
  })
  L.push(...boca.map(naBoca))
}
