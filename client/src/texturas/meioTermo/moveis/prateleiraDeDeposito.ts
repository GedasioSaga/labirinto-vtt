/**
 * PRATELEIRA DE DEPÓSITO de cima com volume (lote 2 dos objetos novos,
 * 11/11/2026): a estante rústica de armazém, de tábuas pregadas em montantes,
 * com a CARGA à mostra. De cima aparece o TAMPO de tábuas, com os pregos em
 * cima de cada montante, e, na frente, a prateleira de cima: o rolo de corda,
 * os potinhos arrolhados, as caixinhas e o saquinho.
 *
 * NA 3/4 A FRENTE MOSTRA AS TRÊS PRATELEIRAS, cada uma mais alta que a de
 * cima dela: embaixo a carga pesada (o caixote, os sacos de estopa, os jarros
 * de duas asas, a pilha de caixotes), no meio os potes de barro com a faixa de
 * esmalte e a boca coberta de pano, e em cima a miudeza. Os montantes vão do
 * chão ao tampo, na frente das tábuas, com um prego em cada cruzamento; por
 * baixo da prateleira de baixo fica o vão escuro entre os pés. O fundo de cada
 * vão é o tampo da prateleira, claro na beira e escuro debaixo da tábua de cima.
 *
 * Não é a estante de livros (`estanteDeLivros.ts`): lá é um móvel fechado de
 * nogueira com fileiras iguais de lombadas; aqui são montantes e tábuas (de
 * partida, carvalho), pés, vãos de alturas diferentes e vultos gordos de
 * barro, pano, pinho e corda.
 *
 * A frente é desenhada de frente, uma vez, e FATIADA como a do guarda-roupa
 * (`guardaRoupa.ts`, de onde vêm `naFaixa` e `fatiar`: cada faixa guardada
 * debaixo do tampo, com a fresta dela, e a textura escondendo o que passa do
 * corte). Aqui a frente desenhada começa rente ao chão (os pés e o vão escuro),
 * então o perfil da 3/4 tem de ser `{ modo: 'derivado', espessura: 0 }`: com a
 * beirada padrão dos tampos soltos, a da faixa de baixo cairia no chão, na
 * frente da prateleira.
 *
 * O número de vãos sai da largura (um por casa) e a carga enche cada vão até
 * onde cabe. A 25% de zoom sobram as faixas de madeira e, entre elas, os
 * vultos claros e redondos da carga. A carga é fixa. Material: `madeira`.
 */
import { hash, type Rgb } from '../../ruido'
import { anel, cadeia, caixa, capsula, dentroDe, elipse, poligono, uniao, type Forma } from './formas'
import { contato, luminanciaLinear, ruido, texturaDaClasse, TOM_DA_CORDA, type CriarPeca, type MaterialDaPeca, type OpcoesDaPeca, type Peca, type Textura } from './motor'
import { BURACO, LENCOL, PREGO, QUARTO, materialDaPeca, type MontarMovel } from './contexto'

/** Altura da prateleira em casas (a sombra; na 3/4, a frente). */
const ALTURA = 1.5
/** A grossura de uma tábua vista de frente (px do protótipo). */
const TABUA = 3.4
/** A altura do lado de baixo de cada prateleira, em casas a partir do chão; o tampo é a tábua do alto. */
const PRATELEIRAS: readonly number[] = [0.09, 0.6, 1.12]
/** A faixa de cima (a que aparece na vista de cima) vai do tampo até a prateleira de cima, sem passar desta parte da profundidade. */
const PARTE_DA_FAIXA_DE_CIMA = 0.66
/** Um vão entre montantes a cada tanto de largura, em casas, e a largura do montante (px do protótipo). */
const LARGURA_DO_VAO = 1
const MONTANTE = 4.2

// ---------- a frente em faixas (a mesma de `guardaRoupa.ts`) ----------

/** A fresta de cada faixa (px do protótipo) e as cantoneiras que fecham as frestas dos dois lados, como na estante. */
const FRESTA = 0.25
const CANTONEIRA = 0.5
/** A faixa guardada fica a esta distância do fundo da pegada, no mínimo, e as frestas cabem nesta sobra da frente. */
const FOLGA_DO_GUARDADO = 2.5
const SOBRA_DAS_FRESTAS = 2.5
/** Por mais rasa que o mestre deixe a pegada, a faixa não fica menor que isto (px do protótipo). */
const FAIXA_MINIMA = 8
/** Quanto uma faixa passa por cima da vizinha (px do protótipo): sem isso sobraria um fio da frente lisa entre as duas. */
const EMENDA = 0.2
/**
 * Até onde a forma de uma cópia continua valendo depois do corte (px do
 * protótipo): mais que o alcance do passo do chanfro, que lê a distância ali
 * perto. Dali para fora a cópia não existe.
 */
const FOLGA_DO_CORTE = 3
const FORA_DA_FAIXA = 1e3
/** Onde a frente desenhada começa (px do protótipo a partir do chão): rente ao chão, só acima da fresta da faixa de baixo. */
const PE_DA_FRENTE = FRESTA

/** Uma faixa da frente: as alturas que ela cobre (px do protótipo a partir do chão) e onde fica guardada. */
interface Faixa {
  readonly pe: number
  readonly topo: number
  /** O y da vista de cima em que o pé da faixa fica: o começo da fresta dela. */
  readonly base: number
  /** A altura da fresta (o quanto a faixa sobe na 3/4). */
  readonly z: number
}

/** A peça da frente não projeta sombra nem tem deslocamento: a cópia de uma faixa escureceria a da outra. */
type OpcoesDaFrente = Omit<OpcoesDaPeca, 'dx' | 'dy' | 'projeta' | 'polar' | 'arco' | 'ruga' | 'curvaY'>

/** Uma peça desenhada DE FRENTE: x como na pegada, y = 0 no chão e negativo para cima. */
interface PecaDaFrente {
  readonly forma: Forma
  readonly mat: MaterialDaPeca
  readonly o: OpcoesDaFrente
}

/** Põe uma peça na frente (a lista vai de trás para a frente). */
type Por = (forma: Forma, mat: MaterialDaPeca, o: OpcoesDaFrente) => void

/**
 * A cópia da peça da frente que cabe à faixa, ou nada se a peça não passa por
 * ela. A forma é a peça inteira, descida para o lugar guardado, com a caixa de
 * pintura espelhada em volta do meio da fresta (é o meio da caixa que a 3/4 lê
 * para saber em que estrutura a peça está). A textura esconde o que passa da
 * faixa e devolve ao material as coordenadas da frente.
 */
function naFaixa(P: CriarPeca, peca: PecaDaFrente, fx: Faixa): Peca | null {
  const f = peca.forma
  const desce = fx.base + fx.pe
  const visivel0 = Math.max(fx.base - (fx.topo - fx.pe), f.b[1] + desce) - EMENDA
  const visivel1 = Math.min(fx.base, f.b[3] + desce) + EMENDA
  if (visivel1 - visivel0 <= 2 * EMENDA) return null
  const corte0 = visivel0 - FOLGA_DO_CORTE
  const corte1 = visivel1 + FOLGA_DO_CORTE
  const meio = fx.base + FRESTA / 2
  const forma: Forma = {
    b: [f.b[0], corte0, f.b[2], 2 * meio - corte0],
    d: (x, y) => (y < corte0 || y > corte1 ? FORA_DA_FAIXA : f.d(x, y - desce)),
  }
  const eixo = peca.o.eixo ?? 0
  const du = -desce * Math.sin(eixo)
  const dv = -desce * Math.cos(eixo)
  const doMaterial = peca.o.textura ?? texturaDaClasse(peca.mat.classe)
  const textura: Textura = (u, v, x, y, p, s, escala) => {
    if (y < visivel0 || y > visivel1) {
      s[5] = 0
      return
    }
    if (doMaterial !== null) doMaterial(u + du, v + dv, x, y - desce, p, s, escala)
  }
  return P(forma, peca.mat, { ...peca.o, textura })
}

/** As faixas da frente, de baixo para cima (a última é a de cima), e onde o corpo acaba e as frestas começam. */
function fatiar(H: number, pe: number, deCima: number, h: number, hh: number): { faixas: Faixa[]; frente: number } {
  const maxima = Math.max(FAIXA_MINIMA, h - FOLGA_DO_GUARDADO - SOBRA_DAS_FRESTAS)
  const guardadas = Math.max(1, Math.ceil((H - deCima - pe) / maxima))
  const passo = (H - deCima - pe) / guardadas
  const frente = hh - (guardadas + 1) * FRESTA
  const faixas: Faixa[] = []
  for (let k = 0; k < guardadas; k += 1) {
    // A de baixo fica na fresta da frente: a 3/4 pinta do fundo para a frente, e cada faixa cobre a emenda da de cima.
    const base = frente + (guardadas - k) * FRESTA
    faixas.push({ pe: pe + k * passo, topo: pe + (k + 1) * passo, base, z: pe + k * passo + (base - frente) })
  }
  faixas.push({ pe: H - deCima, topo: H, base: frente, z: H - deCima })
  return { faixas, frente }
}

// ---------- a carga ----------

/** O barro dos potes (a terracota contida do vaso), o esmalte escuro da faixa e o verde-petróleo dos potinhos. */
const BARRO: MaterialDaPeca = { classe: 'liso', rgb: [0xa8, 0x73, 0x5a] }
const ESMALTE: MaterialDaPeca = { classe: 'liso', rgb: [0x5a, 0x3a, 0x2c] }
const VIDRADO: MaterialDaPeca = { classe: 'liso', rgb: [0x5c, 0x78, 0x74] }
/** A rolha dos potinhos. */
const ROLHA: MaterialDaPeca = { classe: 'liso', rgb: [0xb8, 0x96, 0x68] }
/** A estopa dos sacos (a dos sacos de grão): bege de juta, com a trama do linho. */
const ESTOPA: MaterialDaPeca = { classe: 'tecido', fio: 'linho', rgb: [0xc4, 0xae, 0x86] }
/** A corda da amarra e a linha da costura: sisal escuro, para riscar o pano claro. */
const SISAL: MaterialDaPeca = { classe: 'liso', rgb: [0x86, 0x6c, 0x48] }
/** O rolo de corda: a palha clara da corda da cerca, com a torção. */
const CORDA: MaterialDaPeca = { classe: 'corda', rgb: TOM_DA_CORDA }
/** O pinho dos caixotes (o da caixa do catálogo). */
const PINHO = materialDaPeca('pinho')
/** A sombra que cada carga faz no tampo da prateleira, meio transparente. */
const SOMBRA: MaterialDaPeca = { classe: 'liso', rgb: [0x2e, 0x21, 0x18] }
const SEM_BORDA: OpcoesDaFrente = { bisel: 0, contorno: 0 }

/** O barro: manchas largas de queima e um grão miúdo, sem listra. */
const texDoBarro: Textura = (_u, _v, x, y, p, s) => {
  s[3] += ruido(x * 0.3 + p.su, y * 0.3 + p.sv) * 0.08 + ruido(x * 1.1 + p.sv, y * 1.1) * 0.03
}

/** O que a prateleira guarda. */
type Carga = 'caixote' | 'pilha' | 'saco' | 'saquinho' | 'jarro' | 'pote' | 'potinho' | 'caixinha' | 'rolo'

/** A largura que cada carga ocupa na prateleira e a altura dela (px do protótipo); na pilha, as do caixote de baixo. */
const LARGURA_DA_CARGA: Readonly<Record<Carga, number>> = {
  caixote: 16,
  pilha: 19,
  saco: 15,
  saquinho: 10.5,
  jarro: 12,
  pote: 12.5,
  potinho: 7.5,
  caixinha: 12,
  rolo: 16,
}
const ALTURA_DA_CARGA: Readonly<Record<Carga, number>> = {
  caixote: 16,
  pilha: 9,
  saco: 17,
  saquinho: 10.5,
  jarro: 19,
  pote: 12.5,
  potinho: 8.5,
  caixinha: 8,
  rolo: 8,
}
/** O caixote de cima da pilha: a largura, a altura e o quanto ele fica para dentro do de baixo. */
const CAIXOTE_DE_CIMA = { larg: 12, alt: 7.5, recuo: 4.2 }

/** A fresta escura entre as tábuas de um caixote e a largura da ripa de cada ponta (px do protótipo). */
const FRESTA_DO_CAIXOTE = 0.5
const RIPA = 2.2

/** Um caixote de frente: as tábuas deitadas com a fresta escura entre elas e uma ripa pregada em cada ponta. */
function caixote(por: Por, x: number, a: number, larg: number, alt: number, semente: number): void {
  por(caixa(x + 0.5, -a - alt + 0.5, x + larg - 0.5, -a - 0.3), BURACO, SEM_BORDA)
  const tabuas = alt > 11 ? 3 : 2
  const alto = (alt - (tabuas - 1) * FRESTA_DO_CAIXOTE) / tabuas
  for (let k = 0; k < tabuas; k += 1) {
    const y1 = -a - k * (alto + FRESTA_DO_CAIXOTE)
    por(caixa(x, y1 - alto, x + larg, y1, 0.4), PINHO, { tabua: 0, bisel: 0.7, tom: 0.88 + 0.12 * hash(k, semente, 871), semente: semente + k })
  }
  for (const xr of [x + 0.8, x + larg - 0.8 - RIPA]) {
    por(caixa(xr, -a - alt, xr + RIPA, -a, 0.4), PINHO, { eixo: QUARTO, tabua: 0, bisel: 0.7, tom: 1.04, semente: semente + 5 })
    for (const an of [a + 1.5, a + alt - 1.5]) por(elipse(xr + RIPA / 2, -an, 0.45, 0.45), PREGO, { bisel: 0.4, contorno: 0, metal: 0.2 })
  }
}

/** Como a boca do pote está fechada. */
type Tampa = 'pano' | 'rolha'

/** A boca do pote: coberta de pano amarrado com um fio, ou arrolhada. */
function tampar(por: Por, cx: number, topo: number, meiaBoca: number, tampa: Tampa, semente: number): void {
  if (tampa === 'rolha') {
    por(caixa(cx - meiaBoca * 0.62, topo - 1.5, cx + meiaBoca * 0.62, topo + 0.9, 0.6), ROLHA, { bisel: 0.6, contorno: 0.22 })
    return
  }
  por(uniao(elipse(cx, topo + 0.5, meiaBoca + 0.9, 1.5), caixa(cx - meiaBoca - 0.7, topo + 0.5, cx + meiaBoca + 0.7, topo + 2.5, 0.5)), LENCOL, { bisel: 1.1, contorno: 0.24, tom: 0.96, semente })
  por(capsula(cx - meiaBoca - 0.5, topo + 2, cx + meiaBoca + 0.5, topo + 2, 0.45), SISAL, { bisel: 0.3, contorno: 0.1 })
}

/** Um pote bojudo de frente: o pé, o bojo com a faixa de esmalte no ombro e a boca larga. */
function pote(por: Por, x: number, a: number, larg: number, alt: number, barro: MaterialDaPeca, tampa: Tampa, semente: number): void {
  const cx = x + larg / 2
  const ry = alt * 0.43
  const cy = -a - ry - 0.5
  const topo = -a - alt
  const tom = 0.95 + 0.1 * hash(1, semente, 873)
  por(caixa(cx - larg * 0.27, -a - 2, cx + larg * 0.27, -a, 0.5), barro, { bisel: 0.5, tom: 0.76, contorno: 0.2, textura: texDoBarro, semente })
  por(elipse(cx, cy, larg / 2, ry), barro, { bisel: larg * 0.42, contorno: 0.24, tom, textura: texDoBarro, semente: semente + 1 })
  por(dentroDe(elipse(cx, cy, larg / 2 - 0.5, ry - 0.5), caixa(x, cy - ry * 0.52, x + larg, cy - ry * 0.2)), ESMALTE, { ...SEM_BORDA, alfa: 0.5 })
  por(caixa(cx - larg * 0.3, topo, cx + larg * 0.3, topo + alt * 0.17 + 0.6, 0.9), barro, { bisel: 0.9, tom: tom * 0.9, contorno: 0.24, textura: texDoBarro, semente: semente + 2 })
  tampar(por, cx, topo, larg * 0.3, tampa, semente + 3)
}

/** Um jarro alto de frente: o bojo embaixo, o gargalo, a boca e as duas asas. */
function jarro(por: Por, x: number, a: number, larg: number, alt: number, semente: number): void {
  const cx = x + larg / 2
  const ry = alt * 0.33
  const cy = -a - ry - 0.5
  const topo = -a - alt
  const tom = 0.9 + 0.1 * hash(2, semente, 873)
  por(caixa(cx - larg * 0.25, -a - 2, cx + larg * 0.25, -a, 0.5), BARRO, { bisel: 0.5, tom: 0.74, contorno: 0.2, textura: texDoBarro, semente })
  for (const lado of [-1, 1]) {
    por(anel(cx + lado * larg * 0.31, topo + alt * 0.27, 2.4, 3, 1.2, 1.8), BARRO, { bisel: 0.6, tom: tom * 0.86, contorno: 0.24, textura: texDoBarro, semente: semente + 4 })
  }
  por(elipse(cx, cy, larg / 2, ry), BARRO, { bisel: larg * 0.42, contorno: 0.24, tom, textura: texDoBarro, semente: semente + 1 })
  por(caixa(cx - larg * 0.19, topo + 1, cx + larg * 0.19, cy - ry * 0.72, 1), BARRO, { bisel: 1.6, tom: tom * 0.96, contorno: 0.2, textura: texDoBarro, semente: semente + 2 })
  por(caixa(cx - larg * 0.29, topo, cx + larg * 0.29, topo + 2.6, 1), BARRO, { bisel: 0.9, tom: tom * 0.9, contorno: 0.24, textura: texDoBarro, semente: semente + 3 })
  por(elipse(cx, topo + 1, larg * 0.17, 0.55), ESMALTE, SEM_BORDA)
}

/** Um saco de estopa em pé: o corpo gordo assentado na tábua, a costura do lado, a amarra e a boca franzida acima dela. */
function saco(por: Por, x: number, a: number, larg: number, alt: number, semente: number): void {
  const cx = x + larg / 2
  const corpo = alt * 0.8
  const amarra = -a - corpo + 0.9
  const topo = -a - alt
  por(poligono([[cx - 2.2, amarra], [cx + 2.2, amarra], [cx + 4.2, topo + 0.2], [cx + 1.3, topo + 1.5], [cx - 0.9, topo + 0.4], [cx - 4, topo + 0.8]]), ESTOPA, { bisel: 0.8, tom: 0.9, contorno: 0.24, semente })
  por(uniao(elipse(cx, -a - corpo * 0.54, larg / 2 - 0.5, corpo * 0.46), caixa(x, -a - corpo * 0.66, x + larg, -a, larg * 0.3)), ESTOPA, { bisel: larg * 0.36, contorno: 0.24, tom: 0.96 + 0.08 * hash(3, semente, 873), semente: semente + 1 })
  por(capsula(cx + larg * 0.2, -a - corpo * 0.74, cx + larg * 0.25, -a - 1.6, 0.3), SISAL, { ...SEM_BORDA, alfa: 0.55 })
  por(capsula(cx - 2.6, amarra, cx + 2.6, amarra, 0.75), SISAL, { bisel: 0.6, contorno: 0.16 })
}

/** Quantas voltas o rolo mostra e o quanto a ponta solta desce na frente da tábua (px do protótipo). */
const VOLTAS_DO_ROLO = 3
const PONTA_SOLTA = 4.6

/** Um rolo de corda deitado: as voltas empilhadas, o miolo escuro na de cima e a ponta solta caindo pela beira da tábua. */
function rolo(por: Por, x: number, a: number, larg: number, alt: number, semente: number): void {
  const cx = x + larg / 2
  const ry = alt * 0.3
  const passo = (alt - 2 * ry) / (VOLTAS_DO_ROLO - 1)
  por(cadeia([[cx + larg * 0.3, -a - 1.4], [cx + larg * 0.47, -a - 0.4], [cx + larg * 0.5, -a + PONTA_SOLTA * 0.5], [cx + larg * 0.46, -a + PONTA_SOLTA]], 0.75), CORDA, { eixo: QUARTO, bisel: 0.6, contorno: 0.24, semente })
  for (let k = 0; k < VOLTAS_DO_ROLO; k += 1) {
    por(elipse(cx, -a - ry - k * passo, larg / 2 - 0.25 * k, ry), CORDA, { bisel: 1.1, contorno: 0.28, tom: 0.94 + 0.05 * k, semente: semente + 1 + k })
  }
  const cyDeCima = -a - ry - (VOLTAS_DO_ROLO - 1) * passo
  por(elipse(cx, cyDeCima, larg / 2 - 3.1, ry - 1.3), BURACO, { ...SEM_BORDA, recesso: { k: 0.8, forca: 0.3 } })
}

/** Pinta uma carga com o canto de baixo à esquerda em (x, a). */
function pintarCarga(por: Por, carga: Carga, x: number, a: number, semente: number): void {
  const larg = LARGURA_DA_CARGA[carga]
  const alt = ALTURA_DA_CARGA[carga]
  switch (carga) {
    case 'caixote':
    case 'caixinha':
      caixote(por, x, a, larg, alt, semente)
      return
    case 'pilha':
      caixote(por, x, a, larg, alt, semente)
      caixote(por, x + CAIXOTE_DE_CIMA.recuo, a + alt, CAIXOTE_DE_CIMA.larg, CAIXOTE_DE_CIMA.alt, semente + 8)
      return
    case 'saco':
    case 'saquinho':
      saco(por, x, a, larg, alt, semente)
      return
    case 'jarro':
      jarro(por, x, a, larg, alt, semente)
      return
    case 'pote':
      pote(por, x, a, larg, alt, BARRO, 'pano', semente)
      return
    case 'potinho':
      // Metade dos potinhos é de barro vidrado, verde-petróleo.
      pote(por, x, a, larg, alt, hash(4, semente, 873) < 0.5 ? VIDRADO : BARRO, 'rolha', semente)
      return
    case 'rolo':
      rolo(por, x, a, larg, alt, semente)
  }
}

/**
 * A arrumação de cada prateleira, de baixo para cima: a carga de um vão par e
 * a de um vão ímpar, da esquerda para a direita. O vão mais largo repete a
 * lista; o mais estreito fica com o que cabe.
 */
const ARRUMACAO: readonly (readonly [readonly Carga[], readonly Carga[]])[] = [
  [['caixote', 'saco', 'jarro'], ['jarro', 'pilha', 'saco']],
  [['pote', 'jarro', 'caixote'], ['caixote', 'potinho', 'pote', 'potinho']],
  [['rolo', 'potinho', 'caixinha', 'potinho'], ['caixinha', 'saquinho', 'potinho', 'rolo']],
]
/** O menor espaço entre duas cargas (px do protótipo) e o quanto a carga fica para trás da beira da tábua. */
const ENTRE_CARGAS = 1.1
const RECUO_DA_CARGA = 1.3
/** A semente da carga: cada vão tem a dele, e a `variante` do objeto troca todas (os tons e o vidrado dos potinhos). */
const SEMENTE_DA_CARGA = 1000
const SEMENTES_POR_VARIANTE = 977
const SEMENTES_POR_VAO = 160
const VAOS_POR_PRATELEIRA = 16

/** A carga de um vão, de `x0` a `x1`, apoiada na altura `a`: o que cabe da lista, com a folga repartida por igual. */
function arrumar(por: Por, lista: readonly Carga[], x0: number, x1: number, a: number, semente: number): void {
  const cabem: Carga[] = []
  let soma = 0
  for (let i = 0; ; i += 1) {
    const carga = lista[i % lista.length]
    if (soma + LARGURA_DA_CARGA[carga] + (cabem.length + 2) * ENTRE_CARGAS > x1 - x0) break
    cabem.push(carga)
    soma += LARGURA_DA_CARGA[carga]
  }
  const folga = (x1 - x0 - soma) / (cabem.length + 1)
  let x = x0 + folga
  cabem.forEach((carga, i) => {
    const larg = LARGURA_DA_CARGA[carga]
    por(elipse(x + larg / 2 + 0.8, -a + 0.2, larg / 2 + 0.6, 1.5), SOMBRA, { ...SEM_BORDA, alfa: 0.34, suave: 1.4 })
    pintarCarga(por, carga, x, a, semente + i * 16)
    x += larg + folga
  })
}

// ---------- o desenho da frente ----------

/** O fundo de cada vão escurece da beira da tábua até aqui (px do protótipo) e perde esta parte da luz. */
const FUNDO_DO_VAO = 11
const ESCURO_DO_VAO = 0.4
/** A madeira vista de frente: o fundo dos vãos, os montantes e a beira das tábuas, que pega a luz. */
const TOM_DO_FUNDO = 0.92
const TOM_DO_MONTANTE = 0.9
const TOM_DA_BEIRA = 1.04

/** A luminância linear do escuro em que o pixel escuro demais é levantado: a do escuro padrão do motor (a nogueira). */
const LUZ_DO_ESCURO = 0.062
const PASSO_DO_ESCURO = 0.02

/**
 * O escuro da PRÓPRIA madeira: o tom dela descido até a luz do escuro padrão.
 * O fundo dos vãos e o vão dos pés caem abaixo do piso de luz e são levantados
 * para o escuro da cena; com o padrão (a nogueira) o fundo saía vermelho-queimado
 * numa prateleira de carvalho e marrom numa de madeira velha, cinza.
 */
function escuroDaMadeira(mad: MaterialDaPeca): Rgb {
  const escuro = (f: number): Rgb => [Math.round(mad.rgb[0] * f), Math.round(mad.rgb[1] * f), Math.round(mad.rgb[2] * f)]
  let f = 1
  while (f > PASSO_DO_ESCURO && luminanciaLinear(...escuro(f)) > LUZ_DO_ESCURO) f -= PASSO_DO_ESCURO
  return escuro(f)
}

function suave01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

/** O fundo de um vão que começa na altura `pe`: as tábuas do tampo da prateleira, claras na beira e escuras lá no fundo. */
function texDoVao(pe: number): Textura {
  const madeira = texturaDaClasse('madeira')
  return (u, v, x, y, p, s, escala) => {
    if (madeira !== null) madeira(u, v, x, y, p, s, escala)
    s[3] -= ESCURO_DO_VAO * suave01((-y - pe) / FUNDO_DO_VAO)
  }
}

/** A frente inteira, de frente: o vão dos pés, o fundo e a carga de cada prateleira, as beiras das tábuas e os montantes. */
function desenharFrente(hw: number, w: number, g: number, mad: MaterialDaPeca, variante: number): PecaDaFrente[] {
  const H = g * ALTURA
  const pecas: PecaDaFrente[] = []
  const por: Por = (forma, mat, o) => {
    pecas.push({ forma, mat, o })
  }
  const vaos = Math.max(1, Math.round(w / (g * LARGURA_DO_VAO)))
  const passo = (w - MONTANTE) / vaos
  /** O lado de baixo de cada tábua, de baixo para cima; a última é o tampo. */
  const tabuas = [...PRATELEIRAS.map((casas) => casas * g), H - TABUA]

  // O vão escuro entre os pés, por baixo da prateleira de baixo.
  por(caixa(-hw + 0.8, -tabuas[0] - 0.5, hw - 0.8, -PE_DA_FRENTE), BURACO, SEM_BORDA)
  // O fundo de cada vão.
  for (let n = 0; n < PRATELEIRAS.length; n += 1) {
    const pe = tabuas[n] + TABUA
    por(caixa(-hw + 0.8, -tabuas[n + 1] - 0.5, hw - 0.8, -pe + 0.5), mad, { tabua: 5, bisel: 0, contorno: 0, tom: TOM_DO_FUNDO, textura: texDoVao(pe), semente: 800 + n })
  }
  // A beira de cada tábua, um pedaço por vão (a emenda fica atrás do montante).
  tabuas.forEach((a, n) => {
    for (let i = 0; i < vaos; i += 1) {
      const x0 = -hw + MONTANTE / 2 + i * passo
      por(caixa(x0 - 0.3, -a - TABUA, x0 + passo + 0.3, -a, 0.4), mad, { tabua: 0, bisel: 0.9, tom: TOM_DA_BEIRA - 0.1 * hash(n, i, 877), semente: 810 + n * 4 + i })
    }
  })
  // A carga de cada vão, por cima das beiras: a ponta solta do rolo de corda cai na frente da tábua.
  for (let n = 0; n < PRATELEIRAS.length; n += 1) {
    for (let i = 0; i < vaos; i += 1) {
      const x0 = -hw + MONTANTE + i * passo
      const semente = SEMENTE_DA_CARGA + variante * SEMENTES_POR_VARIANTE + (n * VAOS_POR_PRATELEIRA + i) * SEMENTES_POR_VAO
      arrumar(por, ARRUMACAO[n][i % 2], x0, x0 + passo - MONTANTE, tabuas[n] + TABUA + RECUO_DA_CARGA, semente)
    }
  }
  // Os montantes, do chão ao tampo, na frente das tábuas, com um prego em cada cruzamento.
  for (let i = 0; i <= vaos; i += 1) {
    const x = -hw + MONTANTE / 2 + i * passo
    por(caixa(x - MONTANTE / 2, -H, x + MONTANTE / 2, -PE_DA_FRENTE, 0.5), mad, { eixo: QUARTO, tabua: 0, bisel: 1.1, tom: TOM_DO_MONTANTE, semente: 830 + i })
    for (const a of tabuas) por(elipse(x, -a - TABUA / 2, 0.55, 0.55), PREGO, { bisel: 0.5, contorno: 0, metal: 0.2 })
  }
  return pecas
}

export const montarPrateleiraDeDeposito: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, g, peca: P } = c
  const mad = c.m.madeira
  const H = g * ALTURA
  const deCima = Math.min(H - PRATELEIRAS[PRATELEIRAS.length - 1] * g, h * PARTE_DA_FAIXA_DE_CIMA)
  const { faixas, frente } = fatiar(H, PE_DA_FRENTE, deCima, h, hh)
  const desenho = desenharFrente(hw, w, g, mad, c.variante)
  cena.corDoPiso = escuroDaMadeira(mad)

  // O corpo dá a sombra e a frente lisa por trás das faixas; as cantoneiras fecham as frestas dos dois lados.
  cena.sombras.push({ forma: caixa(-hw, -hh, hw, frente, 1), z: H }, contato(caixa(-hw, -hh, hw, hh, 1)))
  for (const xa of [-hw, hw - CANTONEIRA]) cena.sombras.push({ forma: caixa(xa, frente, xa + CANTONEIRA, hh), z: H })
  // A fresta de cada faixa não faz sombra no chão: só diz à 3/4 a altura da faixa.
  for (const fx of faixas) cena.sombras.push({ forma: caixa(-hw + CANTONEIRA, fx.base, hw - CANTONEIRA, fx.base + FRESTA), z: fx.z, solta: true, forca: 0 })

  const L = cena.partes
  const pintarFaixa = (fx: Faixa): void => {
    for (const peca of desenho) {
      const copia = naFaixa(P, peca, fx)
      if (copia !== null) L.push(copia)
    }
  }
  // As faixas guardadas primeiro, escondidas pelo tampo; depois o tampo e, na frente dele, a faixa de cima.
  faixas.slice(0, -1).forEach(pintarFaixa)
  L.push(P(caixa(-hw, -hh, hw, hh, 0.8), mad, { tabua: 8.4, bisel: 1.2, semente: 790 }))
  const vaos = Math.max(1, Math.round(w / (g * LARGURA_DO_VAO)))
  for (let i = 0; i <= vaos; i += 1) {
    const x = -hw + MONTANTE / 2 + (i * (w - MONTANTE)) / vaos
    for (const y of [-hh + MONTANTE / 2, hh - MONTANTE / 2]) L.push(P(elipse(x, y, 0.6, 0.6), PREGO, { bisel: 0.5, contorno: 0, metal: 0.2 }))
  }
  pintarFaixa(faixas[faixas.length - 1])
}
