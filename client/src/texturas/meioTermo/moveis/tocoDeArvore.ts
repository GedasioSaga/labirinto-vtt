/**
 * TOCO DE ÁRVORE de cima com volume (11/11/2026, lote 7 dos objetos novos): o
 * que sobrou de uma árvore cortada há tempo. De baixo para cima: as RAÍZES
 * abrindo no chão em volta (cinco grossas, em rumos desiguais, largas na saída
 * e afinando até a ponta, e três galhos finos), a CASCA grossa em roda, de contorno torto e mais larga
 * onde cada raiz sai, e o TOPO SERRADO, com os anéis de crescimento em volta
 * do miolo (um pouco fora do centro), o coração mais escuro, o alburno claro
 * junto à casca, o cinza do tempo, a RACHADURA que vai do miolo à casca e três
 * fendas curtas na beira. Musgo na casca e ao pé, e dois COGUMELOS ao pé, na
 * frente, do lado da luz.
 *
 * Não tem machado, cunha nem serragem: é o toco velho e quieto (o "toco com
 * machado cravado" é outro objeto). A 25% de zoom sobram a roda clara com os
 * anéis dentro do aro escuro da casca e as raízes em estrela: é o que diz
 * "toco" e não "barril" (aduelas e aros) nem "mesa redonda" (tampo liso).
 *
 * Na 3/4 (`tresQuartos.ts`: cada sombra com altura é uma estrutura, e cada
 * peça sobe com a estrutura mais alta que contém o meio da caixa dela):
 * - o TRONCO é uma coluna do contorno da casca: sobe o topo, e a frente sai da
 *   casca, com as fendas de pé;
 * - as RAÍZES ficam no chão (sem altura, só o contato e um halo): o meio da
 *   caixa de cada uma fica FORA do tronco, senão ela subiria com o topo;
 * - cada COGUMELO é um pé (coluna) e um chapéu (tampo solto) da mesma altura.
 *   O pé fica fora do meio do chapéu: assim o meio do chapéu não cai no pé (a
 *   peça do chapéu é dele), e o pé tem a peça dele, clara, que dá a cor da
 *   coluna. A beirada do chapéu é a padrão dos tampos.
 *
 * As medidas saem do menor lado da pegada (1 x 1 casa de partida): o toco
 * continua redondo no objeto esticado. Material: `lenha` (a casca, como a dos
 * troncos; o cerne do corte sai dela). O musgo e os cogumelos são fixos.
 */
import { hash, limitar01, misturar, rgb, type Rgb } from '../../ruido'
import { tomDoMeio } from '../materiais'
import { cadeia, dentroDe, elipse, poligono, type Forma, type Ponto } from './formas'
import { contato, ruido, type CriarPeca, type MaterialDaPeca, type Peca, type Textura } from './motor'
import type { MontarMovel } from './contexto'

const VOLTA = Math.PI * 2

/** Altura do toco, em casas: abaixo do joelho. */
const ALTURA_DO_TOCO = 0.36
/** O raio do tronco e a grossura da casca, em fração do menor meio lado. */
const RAIO_DO_TRONCO = 0.57
const CASCA = 0.115
/** Quanto o contorno da casca incha onde sai cada raiz grossa (fração do raio) e a abertura do inchaço (radianos). */
const SALIENCIA_DA_RAIZ = 0.09
const ABERTURA_DA_RAIZ = 0.26
/** Quanto do torto do contorno da casca o topo serrado guarda: o corte é mais redondo que a casca. */
const TORTO_DO_TOPO = 0.6
/** Amostras da roda do contorno: o raio é lido da tabela, e não refeito a cada pixel. */
const AMOSTRAS_DA_RODA = 256

/** O cerne do corte de cada madeira, claro e quente, contido: os mesmos dos troncos (`troncos.ts`). */
const CERNE_DO_CARVALHO: Rgb = [0xb0, 0x8a, 0x5e]
const CERNE_DO_PINHO: Rgb = [0xbf, 0x9b, 0x69]
const CERNE_DA_BETULA: Rgb = [0xc6, 0xb2, 0x8b]
/** A casca do pinho (a lenha x 1,1) é a mais clara das duas fendidas: a luz dela separa do carvalho. */
const VERMELHO_DA_CASCA_DO_PINHO = 115
/** O anel escuro do corte e o coração da árvore, em vezes o cerne. */
const FATOR_DO_ANEL = 0.72
const QUANTO_DE_ANEL = 0.75
const FATOR_DO_CORACAO = 0.84
/** Anéis por raio do topo: cinco faixas, de 2,5 px do protótipo, que ainda leem no tamanho de mesa. */
const ANEIS = 5
/** Até onde vai o coração (fração do raio), a borda dele e quanto ele escurece. */
const CORACAO = 0.5
const BORDA_DO_CORACAO = 0.14
const QUANTO_DE_CORACAO = 0.6
/** O alburno, a faixa clara junto à casca: de onde começa (fração do raio). */
const ALBURNO = 0.8
/** O ponto escuro do miolo (fração do raio) e onde ele fica, fora do centro (a árvore cresceu torta). */
const MIOLO = 0.07
const MIOLO_X = -0.1
const MIOLO_Y = 0.08
/** O cinza do tempo no corte velho, em manchas largas, e quanto ele toma do cerne. */
const CINZA_DO_TEMPO: Rgb = [0x9c, 0x94, 0x86]
const QUANTO_DE_TEMPO = 0.34
/** A rachadura e as fendas: o cerne bem escuro, sem virar preto. */
const FATOR_DA_RACHADURA = 0.38
/** A rachadura: o rumo (radianos), os lances (fração do caminho, desvio de lado e meia largura, em px do protótipo). */
const RUMO_DA_RACHADURA = 0.95
const LANCES_DA_RACHADURA: readonly (readonly [number, number, number])[] = [
  [0, 0, 0.14],
  [0.3, 0.9, 0.4],
  [0.62, -0.7, 0.62],
  [1.04, 0.4, 0.9],
]
/** As fendas curtas da beira: o rumo e de onde até onde, em fração do raio do topo. */
const FENDAS: readonly (readonly [number, number, number])[] = [
  [-2.3, 0.6, 1.02],
  [-0.7, 0.68, 1.02],
  [2.75, 0.56, 1.02],
]

interface Raiz {
  /** O rumo em que ela sai do tronco (radianos de tela: 0 = leste, positivo desce). */
  readonly ang: number
  /** De onde ela começa e até onde vai, em fração do menor meio lado. */
  readonly de: number
  readonly ate: number
  /** A grossura na saída, em fração do menor meio lado. */
  readonly grossura: number
  /** Quanto ela vira até a ponta (radianos). */
  readonly curva: number
  /** A raiz grossa incha a casca onde sai; o galho sai de outra raiz. */
  readonly grossa: boolean
}

/**
 * As raízes grossas começam na borda do tronco, debaixo do inchaço da casca, e nenhuma é curta: o meio da
 * caixa de cada uma fica fora do tronco (dentro dele, a raiz subiria com o topo na 3/4).
 */
const SAIDA_DA_RAIZ = RAIO_DO_TRONCO

/** Cinco raízes grossas em rumos desiguais (seis iguais em roda liam como patas) e três galhos, cada um saindo de uma delas. */
const RAIZES: readonly Raiz[] = [
  { ang: -2.55, de: SAIDA_DA_RAIZ, ate: 0.95, grossura: 0.3, curva: 0.16, grossa: true },
  { ang: -1.25, de: SAIDA_DA_RAIZ, ate: 0.86, grossura: 0.26, curva: -0.14, grossa: true },
  { ang: -0.2, de: SAIDA_DA_RAIZ, ate: 0.97, grossura: 0.3, curva: 0.18, grossa: true },
  { ang: 1, de: SAIDA_DA_RAIZ, ate: 0.87, grossura: 0.28, curva: -0.16, grossa: true },
  { ang: 2.55, de: SAIDA_DA_RAIZ, ate: 0.93, grossura: 0.3, curva: 0.14, grossa: true },
  { ang: -2.5, de: 0.72, ate: 0.92, grossura: 0.14, curva: -0.38, grossa: false },
  { ang: -0.15, de: 0.72, ate: 0.9, grossura: 0.14, curva: -0.36, grossa: false },
  { ang: 2.58, de: 0.7, ate: 0.88, grossura: 0.13, curva: -0.34, grossa: false },
]
/** O tom das raízes da bétula, em vezes o branco da casca dela: um castanho-acinzentado escuro. */
const RAIZ_DA_BETULA = 0.5
/** Pontos da linha do meio de cada raiz, a meia largura da ponta (px do protótipo) e o quanto ela afina logo na saída. */
const LANCES_DA_RAIZ = 7
const PONTA_DA_RAIZ = 0.8
const AFINA_DA_RAIZ = 1.35

/** O musgo: o verde-oliva do Meio-Termo puxado para a casca. */
const TOM_DO_MUSGO: Rgb = rgb(tomDoMeio('musgo', 0.86))
const QUANTO_DE_CASCA_NO_MUSGO = 0.12
const RAIO_DA_BOLINHA = 1.3
/**
 * Os tufos de musgo, cada um num arco em volta do toco: o rumo do meio, a meia abertura (radianos), de onde
 * até onde (fração do menor meio lado) e quantas bolinhas. O primeiro sobe pela casca até a beira do corte; o
 * segundo forra o chão onde nascem os cogumelos; o terceiro pega a raiz do sudeste, perto da saída.
 */
const TUFOS_DE_MUSGO: readonly (readonly [number, number, number, number, number])[] = [
  [-1.92, 0.4, 0.42, 0.62, 16],
  [1.9, 0.34, 0.68, 0.94, 15],
  [1, 0.1, 0.62, 0.8, 6],
]

/** Os cogumelos: o chapéu castanho-claro, o pé e as pintas cor de creme. */
const CHAPEU: MaterialDaPeca = { classe: 'liso', rgb: [0xb6, 0x8a, 0x6a] }
const PE: MaterialDaPeca = { classe: 'liso', rgb: [0xe0, 0xd4, 0xba] }
const PINTA: MaterialDaPeca = { classe: 'liso', rgb: [0xec, 0xe2, 0xcc] }
/** Cada cogumelo: o rumo e a distância do meio do toco e o raio do chapéu (frações do menor meio lado) e a altura (casas). */
const COGUMELOS: readonly { readonly ang: number; readonly longe: number; readonly raio: number; readonly altura: number }[] = [
  { ang: 1.86, longe: 0.8, raio: 0.13, altura: 0.16 },
  { ang: 2.05, longe: 0.9, raio: 0.085, altura: 0.115 },
]
/** O pé, em raios do chapéu: onde fica (fora do meio do chapéu) e o raio dele. */
const PE_X = 0.44
const PE_Y = 0.1
const RAIO_DO_PE = 0.34
/** As pintas do chapéu, em raios dele: o lugar e o raio. */
const PINTAS: readonly (readonly [number, number, number])[] = [
  [-0.42, -0.3, 0.17],
  [0.12, -0.52, 0.13],
  [-0.14, 0.38, 0.15],
]

function vezes(c: Rgb, k: number): Rgb {
  return [c[0] * k, c[1] * k, c[2] * k]
}

/** O cerne que combina com a casca escolhida: a bétula pela textura, o pinho pela luz da casca. */
function cerneDa(casca: MaterialDaPeca): Rgb {
  if (casca.casca === 'betula') return CERNE_DA_BETULA
  return casca.rgb[0] >= VERMELHO_DA_CASCA_DO_PINHO ? CERNE_DO_PINHO : CERNE_DO_CARVALHO
}

/** O torto do contorno, em fração do raio: três ondas largas em volta do toco. */
function tortoDoContorno(teta: number): number {
  return 0.03 * Math.cos(2 * teta + 0.7) + 0.025 * Math.cos(3 * teta - 1.1) + 0.018 * Math.cos(5 * teta + 2.3)
}

/** O inchaço da casca onde saem as raízes grossas, em fração do raio. */
function inchacoDasRaizes(teta: number): number {
  let soma = 0
  for (const raiz of RAIZES) {
    if (!raiz.grossa) continue
    let d = teta - raiz.ang
    d -= Math.round(d / VOLTA) * VOLTA
    soma += SALIENCIA_DA_RAIZ * Math.exp(-(d * d) / (2 * ABERTURA_DA_RAIZ * ABERTURA_DA_RAIZ))
  }
  return soma
}

interface Roda {
  /** O raio no rumo `teta` (radianos, de -π a π), lido da tabela. */
  raio(teta: number): number
  readonly maior: number
}

/** O raio em volta do meio posto em tabela: a forma e a textura o leem a cada pixel. */
function emRoda(raio: (teta: number) => number): Roda {
  const tabela = new Float32Array(AMOSTRAS_DA_RODA + 1)
  let maior = 0
  for (let i = 0; i <= AMOSTRAS_DA_RODA; i += 1) {
    tabela[i] = raio((i / AMOSTRAS_DA_RODA) * VOLTA - Math.PI)
    maior = Math.max(maior, tabela[i])
  }
  return {
    maior,
    raio(teta) {
      const f = ((teta + Math.PI) / VOLTA) * AMOSTRAS_DA_RODA
      const i = Math.min(AMOSTRAS_DA_RODA - 1, Math.max(0, Math.floor(f)))
      return tabela[i] + (tabela[i + 1] - tabela[i]) * (f - i)
    },
  }
}

/** A forma de contorno torto em volta do meio do toco: a distância pelo raio, boa perto da borda, onde importa. */
function formaDaRoda(roda: Roda): Forma {
  const m = roda.maior
  return { b: [-m, -m, m, m], d: (x, y) => Math.hypot(x, y) - roda.raio(Math.atan2(y, x)) }
}

function misturarEm(s: Float32Array, cor: Rgb, t: number): void {
  s[0] += (cor[0] - s[0]) * t
  s[1] += (cor[1] - s[1]) * t
  s[2] += (cor[2] - s[2]) * t
}

/**
 * O CORTE do toco: os anéis em volta do miolo (`mx`, `my`), levemente tortos
 * pelo ruído e acompanhando o contorno do topo; o coração mais escuro, o
 * alburno claro junto à casca, o cinza do tempo em manchas e o miolo, um ponto
 * escuro. Entre os anéis, um veio fino que só aparece de perto.
 */
function texDoCorte(mx: number, my: number, topo: Roda, cerne: Rgb): Textura {
  const anel = vezes(cerne, FATOR_DO_ANEL)
  const coracao = vezes(cerne, FATOR_DO_CORACAO)
  return (_u, _v, x, y, _p, s) => {
    const dx = x - mx
    const dy = y - my
    const q = Math.hypot(dx, dy) / topo.raio(Math.atan2(dy, dx)) + ruido(x * 0.3 + 17, y * 0.3) * 0.05
    misturarEm(s, coracao, limitar01((CORACAO - q) / BORDA_DO_CORACAO) * QUANTO_DE_CORACAO)
    const onda = Math.sin(q * ANEIS * VOLTA)
    misturarEm(s, anel, onda > 0.3 ? ((onda - 0.3) / 0.7) * QUANTO_DE_ANEL : 0)
    misturarEm(s, CINZA_DO_TEMPO, limitar01(ruido(x * 0.12 + 5, y * 0.12 + 9) * 2.2 + 0.3) * QUANTO_DE_TEMPO)
    s[3] += Math.sin(q * ANEIS * 3 * VOLTA + 1.3) * 0.015 + (q > ALBURNO ? 0.05 : 0) - q * 0.04 + ruido(x * 0.9, y * 0.9) * 0.03
    if (q < MIOLO) s[3] -= 0.2 * (1 - q / MIOLO)
  }
}

/** O chapéu do cogumelo visto de cima: o meio mais escuro, a beira clara e uns riscos finos do meio para a beira. */
function texDoChapeu(cx: number, cy: number, r: number): Textura {
  return (_u, _v, x, y, _p, s) => {
    const dx = x - cx
    const dy = y - cy
    const q = Math.hypot(dx, dy) / r
    s[3] += (q < 0.45 ? -0.14 * (1 - q / 0.45) : 0) + (q > 0.78 ? 0.09 : 0) + Math.sin(Math.atan2(dy, dx) * 9) * 0.025 * q
  }
}

/** A linha torta de `pontos` engrossada: cada ponto com a meia largura dele, um lado na ida e o outro na volta. */
function fita(pontos: readonly Ponto[], meias: readonly number[]): Forma {
  const ida: Ponto[] = []
  const volta: Ponto[] = []
  const ultimo = pontos.length - 1
  pontos.forEach(([x, y], k) => {
    const [xa, ya] = pontos[Math.max(0, k - 1)]
    const [xb, yb] = pontos[Math.min(ultimo, k + 1)]
    const l = Math.hypot(xb - xa, yb - ya) || 1
    const nx = (-(yb - ya) / l) * meias[k]
    const ny = ((xb - xa) / l) * meias[k]
    ida.push([x + nx, y + ny])
    volta.push([x - nx, y - ny])
  })
  return poligono([...ida, ...volta.reverse()])
}

/** A raiz: a linha do meio, que vira aos poucos até a ponta, e a largura, que afina. */
function formaDaRaiz(raiz: Raiz, R: number): Forma {
  const pontos: Ponto[] = []
  const meias: number[] = []
  const meia = (R * raiz.grossura) / 2
  for (let k = 0; k <= LANCES_DA_RAIZ; k += 1) {
    const s = k / LANCES_DA_RAIZ
    const teta = raiz.ang + raiz.curva * s * s
    const longe = R * (raiz.de + (raiz.ate - raiz.de) * s)
    pontos.push([Math.cos(teta) * longe, Math.sin(teta) * longe])
    meias.push(PONTA_DA_RAIZ + (meia - PONTA_DA_RAIZ) * Math.pow(1 - s, AFINA_DA_RAIZ))
  }
  return fita(pontos, meias)
}

/**
 * Um tufo de musgo num arco em volta do toco: as bolinhas sorteadas no rumo e na distância, cada uma com o seu
 * tom. A bolinha com o meio debaixo de um chapéu (`chapeus`) fica de fora: de cima o chapéu a esconde, e na
 * 3/4 ela seria peça do cogumelo, e a maior dele (o pé sairia verde).
 */
function musgoEmArco(P: CriarPeca, L: Peca[], cor: MaterialDaPeca, R: number, [ang, abre, de, ate, bolinhas]: readonly [number, number, number, number, number], sem: number, chapeus: readonly Forma[]): void {
  for (let i = 0; i < bolinhas; i += 1) {
    // Mais bolinhas perto do meio do arco (a soma de dois sorteios).
    const teta = ang + (hash(i, sem, 191) + hash(i, sem, 192) - 1) * abre
    const longe = R * (de + (ate - de) * hash(i, sem, 193))
    const x = Math.cos(teta) * longe
    const y = Math.sin(teta) * longe
    if (chapeus.some((chapeu) => chapeu.d(x, y) <= 0)) continue
    const r = RAIO_DA_BOLINHA * (0.7 + 0.6 * hash(i, sem, 194))
    L.push(P(elipse(x, y, r, r * 0.86), cor, { bisel: r * 0.7, contorno: 0.26, tom: 0.82 + 0.3 * hash(i, sem, 195), semente: sem * 31 + i }))
  }
}

export const montarTocoDeArvore: MontarMovel = (c, cena) => {
  const { g, peca: P } = c
  const R = Math.min(c.hw, c.hh)
  const casca = c.m.lenha
  const cerne = cerneDa(casca)
  const L = cena.partes
  const raioDoTronco = R * RAIO_DO_TRONCO
  const grossuraDaCasca = R * CASCA

  // O contorno da casca (torto, inchado nas raízes) e o do topo serrado (mais redondo, sem os inchaços).
  const rodaDaCasca = emRoda((teta) => raioDoTronco * (1 + tortoDoContorno(teta) + inchacoDasRaizes(teta)))
  const rodaDoTopo = emRoda((teta) => raioDoTronco * (1 + tortoDoContorno(teta) * TORTO_DO_TOPO) - grossuraDaCasca)
  const tronco = formaDaRoda(rodaDaCasca)
  const topo = formaDaRoda(rodaDoTopo)
  cena.sombras.push({ forma: tronco, z: g * ALTURA_DO_TOCO }, contato(tronco, 0.32))

  // As raízes, no chão: cada uma com o veio da casca ao comprido dela. A bétula é branca só no tronco: as
  // raízes dela são escuras e fendidas, como as das outras (brancas, liam como ossos em volta do toco).
  const cascaDasRaizes: MaterialDaPeca = casca.casca === 'betula' ? { classe: 'casca', casca: 'fendida', rgb: vezes(casca.rgb, RAIZ_DA_BETULA) } : casca
  RAIZES.forEach((raiz, k) => {
    const forma = formaDaRaiz(raiz, R)
    cena.sombras.push(contato(forma, 0.3), { forma, z: 0, suave: 2.4, forca: 0.2 })
    L.push(P(forma, cascaDasRaizes, { eixo: raiz.ang + raiz.curva * 0.4, bisel: R * raiz.grossura * 0.3, contorno: 0.24, tom: 0.86 + 0.12 * hash(k, 1, 196), semente: 7100 + k }))
  })

  // Os cogumelos: onde fica cada um, o chapéu e o pé (fora do meio do chapéu).
  const cogumelos = COGUMELOS.map((cogumelo) => {
    const cx = Math.cos(cogumelo.ang) * R * cogumelo.longe
    const cy = Math.sin(cogumelo.ang) * R * cogumelo.longe
    const r = R * cogumelo.raio
    return { cx, cy, r, z: g * cogumelo.altura, chapeu: elipse(cx, cy, r, r * 0.92), pe: elipse(cx + r * PE_X, cy + r * PE_Y, r * RAIO_DO_PE, r * RAIO_DO_PE) }
  })
  const chapeus = cogumelos.map((cogumelo) => cogumelo.chapeu)

  // O musgo do chão e o que sobe pela casca: o do chão por baixo do tronco, o da casca por cima dele.
  const musgo: MaterialDaPeca = { classe: 'folha', rgb: misturar(TOM_DO_MUSGO, casca.rgb, QUANTO_DE_CASCA_NO_MUSGO) }
  const [naCasca, ...noChao] = TUFOS_DE_MUSGO
  noChao.forEach((tufo, k) => musgoEmArco(P, L, musgo, R, tufo, 7300 + k, chapeus))

  // O tronco: a casca em roda, com as fendas saindo do meio para fora, e o topo serrado.
  L.push(P(tronco, casca, { polar: { cx: 0, cy: 0, r: raioDoTronco }, bisel: grossuraDaCasca * 0.95, contorno: 0.28, tom: 0.96, semente: 7001 }))
  const mx = rodaDoTopo.maior * MIOLO_X
  const my = rodaDoTopo.maior * MIOLO_Y
  L.push(P(topo, { classe: 'liso', rgb: cerne }, { bisel: 0.7, contorno: 0.22, textura: texDoCorte(mx, my, rodaDoTopo, cerne), semente: 7002 }))

  // A rachadura, do miolo até a casca, e as fendas curtas da beira.
  const escuro: MaterialDaPeca = { classe: 'liso', rgb: vezes(cerne, FATOR_DA_RACHADURA) }
  const caminho = rodaDoTopo.raio(RUMO_DA_RACHADURA)
  const co = Math.cos(RUMO_DA_RACHADURA)
  const si = Math.sin(RUMO_DA_RACHADURA)
  const rachadura = fita(
    LANCES_DA_RACHADURA.map(([s, desvio]): Ponto => [mx + co * caminho * s - si * desvio, my + si * caminho * s + co * desvio]),
    LANCES_DA_RACHADURA.map(([, , meia]) => meia),
  )
  L.push(P(dentroDe(rachadura, topo), escuro, { bisel: 0, contorno: 0, semente: 7010 }))
  FENDAS.forEach(([rumo, de, ate], k) => {
    const r = rodaDoTopo.raio(rumo)
    const meio = (de + ate) / 2
    const torta = rumo + 0.06
    const fenda = cadeia([[Math.cos(rumo) * r * de, Math.sin(rumo) * r * de], [Math.cos(torta) * r * meio, Math.sin(torta) * r * meio], [Math.cos(rumo) * r * ate, Math.sin(rumo) * r * ate]], 0.26)
    L.push(P(dentroDe(fenda, topo), escuro, { bisel: 0, contorno: 0, semente: 7011 + k }))
  })
  musgoEmArco(P, L, musgo, R, naCasca, 7310, chapeus)

  // Os cogumelos: o pé (escondido debaixo do chapéu, de cima), o chapéu e as pintas.
  cogumelos.forEach(({ cx, cy, r, z, chapeu, pe }, k) => {
    cena.sombras.push({ forma: pe, z }, { forma: chapeu, z, solta: true }, contato(pe, 0.3))
    L.push(P(pe, PE, { bisel: r * RAIO_DO_PE * 0.6, contorno: 0.2, semente: 7400 + k * 10 }))
    L.push(P(chapeu, CHAPEU, { bisel: r * 0.85, contorno: 0.3, textura: texDoChapeu(cx, cy, r), semente: 7401 + k * 10 }))
    PINTAS.forEach(([px, py, pr], n) => {
      L.push(P(elipse(cx + r * px, cy + r * py, r * pr, r * pr), PINTA, { bisel: 0, contorno: 0.1, semente: 7402 + k * 10 + n }))
    })
  })
}
