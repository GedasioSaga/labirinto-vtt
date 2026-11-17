import { Container, Graphics } from 'pixi.js'
import type { Abismo, BrilhoDoAbismo, RegionPoint } from '../types/map'
import { abismosDoPiso, caixaDoAbismo, centroDoContorno, pontoNoAbismo, profundidadeDoAbismo } from '../lib/abismo'
import { PALETA_MEIO_TERMO } from '../texturas/meioTermo/paleta'
import { contornoDoTom } from '../texturas/meioTermo/barranco'
import { misturar, rgb, type Rgb } from '../texturas/ruido'

/**
 * DESENHO DO ABISMO (`lib/abismo.ts`), no editor do mestre e na tela do
 * jogador e da TV. Vetor, refeito só quando o abismo muda (o mapa é imutável:
 * a referência basta; cada abismo guarda o seu desenho).
 *
 * Vista de 3/4, como o resto do Meio-Termo: a boca deslocada para baixo, em
 * camadas cada vez mais escuras, mostra a parede de cima descendo até o fundo
 * (a parede de baixo fica de costas, escondida); tudo cortado pela própria boca
 * (máscara). Por cima, a beira esfarelada: o contorno escuro do Meio-Termo,
 * lascas de pedra soltas de tamanho e passo irregulares e poucas trincas para
 * fora. Nada de hachura, listra ou detalhe repetido. O brilho do fundo (brasa
 * ou verde) é um halo de faixas de alfa baixo e algumas faíscas paradas.
 *
 * ILHA (`Abismo.ilhas`, o abismo por pincel): chão de pé dentro do buraco. O
 * alto dela fica de fora da máscara (o chão do mapa aparece), a parede dela
 * desce até o fundo como um pilar, na frente do halo, e a beira esfarelada dá
 * a volta nela também, com as lascas e as trincas para o lado do chão.
 */

const PEDRA = rgb(PALETA_MEIO_TERMO.pedra.base)
const ARDOSIA = rgb(PALETA_MEIO_TERMO.ardosia.base)
const TERRA = rgb(PALETA_MEIO_TERMO.barranco.sombra)
/** O alto da parede: ardósia puxada para a terra (pedra úmida, nem cinza nem barro). */
const PAREDE_EM_CIMA = misturar(ARDOSIA, TERRA, 0.35)
/** O fundo sem brilho: quase preto, quente. */
const ESCURO = rgb('#17120f')
// As lascas da beira: pedra de meio-tom (a clara demais virava colar de pérolas no zoom de longe).
const BEIRA_CLARA = misturar(misturar(PEDRA, ARDOSIA, 0.38), TERRA, 0.12)
const BEIRA_ESCURA = misturar(ARDOSIA, TERRA, 0.3)
const CONTORNO = contornoDoTom(PAREDE_EM_CIMA)
const COR_DA_ESCOLHA = 0xd9a441
/** Camadas da parede, do lábio ao fundo (o degradê sai delas; muitas e próximas para não virar listra). */
const CAMADAS = 26
/** O expoente do degradê da parede: escurece depressa no começo (a luz de fora some logo abaixo do lábio) e devagar no fim. */
const QUEDA_DA_LUZ = 0.62
/** Quanto o pé do pilar da ilha pega do tom do brilho (o fundo aceso o ilumina por baixo). */
const BRILHO_NO_PE_DO_PILAR = 0.82
/** As alturas (frações da descida) em que a faísca confere se há ilha logo acima dela (ali é parede de pilar, não fundo). */
const ALTURAS_SEM_PILAR: readonly number[] = [0.3, 0.6]

interface TintaDoBrilho {
  /** O tom que o brilho dá ao fundo e ao pé da parede. */
  fundo: Rgb
  /** O miolo do halo. */
  miolo: Rgb
  faiscas: readonly Rgb[]
}

const BRILHOS: Readonly<Record<BrilhoDoAbismo, TintaDoBrilho>> = {
  brasa: { fundo: rgb('#5e1c10'), miolo: rgb(PALETA_MEIO_TERMO.laranja.base), faiscas: [rgb('#ffb36a'), rgb(PALETA_MEIO_TERMO.fogo.base), rgb('#d4532c')] },
  verde: { fundo: rgb('#123f2d'), miolo: rgb(PALETA_MEIO_TERMO.folha.base), faiscas: [rgb('#c4f2cf'), rgb('#86d9a0'), rgb('#4fae78')] },
}

function numero(c: Rgb): number {
  return (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2])
}

/** Sorteio repetível por abismo (mulberry32 com o id como semente): o mesmo abismo sai igual nas duas telas. */
function sorteioDe(id: string): () => number {
  let h = 2166136261
  for (let i = 0; i < id.length; i += 1) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  let s = h >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function deslocado(plano: readonly number[], dx: number, dy: number): number[] {
  return plano.map((v, i) => (i % 2 === 0 ? v + dx : v + dy))
}

function planoDe(pontos: readonly RegionPoint[]): number[] {
  return pontos.flatMap((p) => [p.x, p.y])
}

/** As ilhas que valem desenho, das de cima para as de baixo: o pilar da de baixo fica na frente. */
function ilhasDoAbismo(abismo: Abismo): RegionPoint[][] {
  const baixo = (ilha: readonly RegionPoint[]): number => ilha.reduce((y, p) => Math.max(y, p.y), -Infinity)
  return (abismo.ilhas ?? []).filter((ilha) => ilha.length >= 3).sort((a, b) => baixo(a) - baixo(b))
}

/** A parede descendo, o fundo, o brilho e os pilares das ilhas, num Graphics que a boca corta. */
function pintarFundo(g: Graphics, abismo: Abismo, plano: readonly number[], ilhas: readonly RegionPoint[][], grid: number, sorteio: () => number): void {
  const caixa = caixaDoAbismo(abismo)
  if (caixa === null) return
  const descida = profundidadeDoAbismo(abismo, grid)
  const tinta = abismo.brilho === undefined ? null : BRILHOS[abismo.brilho]
  // O fundo de verdade: com brilho, o escuro puxa para o tom dele.
  const fundo = tinta === null ? ESCURO : misturar(ESCURO, tinta.fundo, 0.55)
  g.rect(caixa.minX - 2, caixa.minY - 2, caixa.maxX - caixa.minX + 4, caixa.maxY - caixa.minY + 4).fill(numero(PAREDE_EM_CIMA))
  for (let k = 1; k <= CAMADAS; k += 1) {
    const t = k / CAMADAS
    g.poly(deslocado(plano, 0, descida * t), true).fill(numero(misturar(PAREDE_EM_CIMA, fundo, Math.pow(t, QUEDA_DA_LUZ))))
  }
  if (tinta !== null) {
    // O halo: elipses de alfa baixo em volta do meio do fundo; a de fora tinge o pé da parede.
    const centro = centroDoContorno(abismo.pontos)
    const cx = centro.x
    const cy = Math.min(caixa.maxY - descida * 0.2, centro.y + descida * 0.55)
    const rx = Math.max(grid * 0.6, (caixa.maxX - caixa.minX) * 0.46)
    const ry = Math.max(grid * 0.45, Math.min(rx * 0.7, (caixa.maxY - caixa.minY) * 0.45))
    // Muitas faixas de alfa bem baixo: a soma vira um degradê, sem anel à vista.
    const FAIXAS = 16
    for (let j = 0; j < FAIXAS; j += 1) {
      const f = 1 - j / FAIXAS
      g.ellipse(cx, cy, rx * f, ry * f).fill({ color: numero(misturar(tinta.fundo, tinta.miolo, Math.pow(1 - f, 1.4))), alpha: 0.075 })
    }
  }
  // O pilar de cada ilha, na frente do halo: a parede dela, da faixa mais funda (escura) à do lábio,
  // para a de cima cobrir a de baixo. O pé pega o tom do brilho.
  const pe = tinta === null ? fundo : misturar(ESCURO, tinta.fundo, BRILHO_NO_PE_DO_PILAR)
  for (const ilha of ilhas) {
    const planoDaIlha = planoDe(ilha)
    for (let k = CAMADAS; k >= 1; k -= 1) {
      const t = k / CAMADAS
      g.poly(deslocado(planoDaIlha, 0, descida * t), true).fill(numero(misturar(PAREDE_EM_CIMA, pe, Math.pow(t, QUEDA_DA_LUZ))))
    }
  }
  if (tinta === null) return
  // No fundo: dentro do buraco e com o buraco acima dele (não na parede de cima nem na de um pilar).
  const noFundo = (p: RegionPoint): boolean => {
    if (!pontoNoAbismo(abismo, p) || !pontoNoAbismo(abismo, { x: p.x, y: p.y - descida * 0.9 })) return false
    return ilhas.length === 0 || ALTURAS_SEM_PILAR.every((altura) => pontoNoAbismo(abismo, { x: p.x, y: p.y - descida * altura }))
  }
  // As faíscas: paradas, de tamanho e lugar sorteados, só onde o fundo aparece.
  const area = (caixa.maxX - caixa.minX) * (caixa.maxY - caixa.minY)
  const quantas = Math.min(36, Math.max(5, Math.round((area / (grid * grid)) * 1.1)))
  let postas = 0
  for (let tentativa = 0; tentativa < quantas * 6 && postas < quantas; tentativa += 1) {
    const p: RegionPoint = { x: caixa.minX + sorteio() * (caixa.maxX - caixa.minX), y: caixa.minY + sorteio() * (caixa.maxY - caixa.minY) }
    if (!noFundo(p)) continue
    const cor = tinta.faiscas[Math.floor(sorteio() * tinta.faiscas.length)]
    const raio = grid * (0.022 + sorteio() * 0.03)
    g.circle(p.x, p.y, raio * 2.6).fill({ color: numero(cor), alpha: 0.14 })
    g.circle(p.x, p.y, raio).fill({ color: numero(cor), alpha: 0.92 })
    postas += 1
  }
}

/**
 * A normal da aresta que aponta para o CHÃO (para fora do buraco): testada no
 * ponto, vale para contorno côncavo, em qualquer sentido, e para a beira de
 * uma ilha (o chão dela fica do lado de dentro do contorno).
 */
function normalParaOChao(abismo: Abismo, m: RegionPoint, a: RegionPoint, b: RegionPoint): RegionPoint {
  const comprimento = Math.hypot(b.x - a.x, b.y - a.y) || 1
  const n = { x: (b.y - a.y) / comprimento, y: -(b.x - a.x) / comprimento }
  return pontoNoAbismo(abismo, { x: m.x + n.x * 0.75, y: m.y + n.y * 0.75 }) ? { x: -n.x, y: -n.y } : n
}

/** Uma lasca: polígono torto de 5 a 7 cantos. */
function lasca(g: Graphics, centro: RegionPoint, raio: number, sorteio: () => number, cor: Rgb, contorno: number): void {
  const cantos = 5 + Math.floor(sorteio() * 3)
  const giro = sorteio() * Math.PI * 2
  const plano: number[] = []
  for (let i = 0; i < cantos; i += 1) {
    const ang = giro + (i / cantos) * Math.PI * 2
    const r = raio * (0.68 + sorteio() * 0.45)
    plano.push(centro.x + Math.cos(ang) * r, centro.y + Math.sin(ang) * r * 0.82)
  }
  g.poly(plano, true).fill(numero(cor)).stroke({ color: numero(CONTORNO), width: contorno, alpha: 0.85, join: 'round' })
}

/** A beira esfarelada de um contorno (a boca ou uma ilha): o contorno escuro, as lascas e as trincas. */
function pintarBeira(g: Graphics, abismo: Abismo, pontos: readonly RegionPoint[], grid: number, sorteio: () => number): void {
  const plano = planoDe(pontos)
  const fino = Math.max(1, grid * 0.024)
  // A sombra macia do lábio: uma faixa de alfa baixo; o contorno escuro do Meio-Termo por cima.
  g.poly(plano, true).stroke({ color: numero(CONTORNO), width: grid * 0.1, alpha: 0.12, join: 'round' })
  g.poly(plano, true).stroke({ color: numero(CONTORNO), width: Math.max(1.5, grid * 0.05), alpha: 0.95, join: 'round' })
  let falta = grid * (0.1 + sorteio() * 0.3)
  let proximaTrinca = grid * (0.8 + sorteio() * 1.2)
  for (let i = 0; i < pontos.length; i += 1) {
    const a = pontos[i]
    const b = pontos[(i + 1) % pontos.length]
    const tamanho = Math.hypot(b.x - a.x, b.y - a.y)
    let andado = 0
    while (andado + falta <= tamanho) {
      andado += falta
      const t = andado / tamanho
      const m = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
      const n = normalParaOChao(abismo, m, a, b)
      // Muitas miúdas e poucas grandes (o quadrado do sorteio puxa para o pequeno).
      const sorte = sorteio()
      const raio = grid * (0.04 + sorte * sorte * 0.12)
      // A maioria assenta na beira, puxada para fora (umas soltas mais longe); uma ou outra já caiu para dentro.
      const lugar = sorteio()
      const desvio = lugar < 0.16 ? -raio * 0.9 : lugar > 0.86 ? raio * (1.4 + sorteio() * 1.6) : raio * (0.15 + sorteio() * 0.35)
      const cor = misturar(BEIRA_ESCURA, BEIRA_CLARA, sorteio())
      lasca(g, { x: m.x + n.x * desvio, y: m.y + n.y * desvio }, raio, sorteio, desvio < 0 ? misturar(cor, ESCURO, 0.35) : cor, fino)
      proximaTrinca -= falta
      if (proximaTrinca <= 0) {
        // Trinca para fora: dois trechos com um desvio, curta e rara.
        const comprimento = grid * (0.18 + sorteio() * 0.2)
        const lado = (sorteio() - 0.5) * 0.9
        const meio = { x: m.x + (n.x + n.y * lado) * comprimento * 0.55, y: m.y + (n.y - n.x * lado) * comprimento * 0.55 }
        const ponta = { x: meio.x + n.x * comprimento * 0.5, y: meio.y + n.y * comprimento * 0.5 }
        g.moveTo(m.x, m.y).lineTo(meio.x, meio.y).lineTo(ponta.x, ponta.y).stroke({ color: numero(CONTORNO), width: fino, alpha: 0.55, cap: 'round', join: 'round' })
        proximaTrinca = grid * (0.9 + sorteio() * 1.4)
      }
      // Passo irregular: às vezes um amontoado, às vezes um vão de beira lisa.
      const passo = sorteio()
      falta = grid * (passo < 0.25 ? 0.07 + sorteio() * 0.08 : passo > 0.85 ? 0.6 + sorteio() * 0.5 : 0.18 + sorteio() * 0.3)
    }
    falta -= tamanho - andado
  }
}

/** Um abismo inteiro, no contêiner dele: o fundo (cortado pela boca, sem o alto das ilhas) e a beira por cima. */
function pintarAbismo(abismo: Abismo, grid: number): Container {
  const raiz = new Container()
  raiz.eventMode = 'none'
  const plano = planoDe(abismo.pontos)
  const ilhas = ilhasDoAbismo(abismo)
  const sorteio = sorteioDe(abismo.id)
  const boca = new Graphics()
  boca.poly(plano, true).fill(0xffffff)
  // O alto de cada ilha é chão: sai da máscara, e o mapa aparece ali.
  for (const ilha of ilhas) boca.poly(planoDe(ilha), true).cut()
  const fundo = new Graphics()
  pintarFundo(fundo, abismo, plano, ilhas, grid, sorteio)
  fundo.mask = boca
  const beira = new Graphics()
  pintarBeira(beira, abismo, abismo.pontos, grid, sorteio)
  for (const ilha of ilhas) pintarBeira(beira, abismo, ilha, grid, sorteio)
  raiz.addChild(fundo, boca, beira)
  return raiz
}

/** O que desenhar. `escolhido` só no editor (o abismo que a ferramenta escolheu). */
export interface EntradaDoAbismo {
  abismos: readonly Abismo[] | undefined
  piso: number
  grid: number
  escolhido?: string | null
}

export interface DesenhoDoAbismo {
  camada: Container
  atualizar: (entrada: EntradaDoAbismo | null) => void
  destroy: () => void
}

export function criarDesenhoDoAbismo(): DesenhoDoAbismo {
  const camada = new Container()
  camada.eventMode = 'none'
  camada.label = 'abismos'
  const abismosNaTela = new Container()
  abismosNaTela.eventMode = 'none'
  const escolha = new Graphics()
  escolha.eventMode = 'none'
  camada.addChild(abismosNaTela, escolha)
  // Pela ASSINATURA (id, brilho, boca e ilhas), não pela referência: o recorte do jogador chega
  // novo a cada mensagem, com os mesmos abismos, e não pode refazer o desenho de todos.
  let porAbismo = new Map<string, Container>()
  let gradeDosDesenhos = 0
  let ultima: EntradaDoAbismo | null = null
  const pontosDe = (contorno: readonly RegionPoint[]): string => contorno.map((p) => `${p.x},${p.y}`).join(';')
  const assinatura = (abismo: Abismo): string => {
    const base = `${abismo.id}|${abismo.brilho ?? ''}|${pontosDe(abismo.pontos)}`
    return abismo.ilhas === undefined ? base : `${base}|${abismo.ilhas.map(pontosDe).join('/')}`
  }

  const largar = (desenho: Container) => desenho.destroy({ children: true })

  const atualizar = (entrada: EntradaDoAbismo | null): void => {
    if (
      entrada !== null &&
      ultima !== null &&
      entrada.abismos === ultima.abismos &&
      entrada.piso === ultima.piso &&
      entrada.grid === ultima.grid &&
      (entrada.escolhido ?? null) === (ultima.escolhido ?? null)
    ) {
      return
    }
    ultima = entrada
    const doPiso = entrada === null ? [] : abismosDoPiso(entrada.abismos, entrada.piso).filter((a) => a.pontos.length >= 3)
    const grid = entrada?.grid ?? 0
    if (grid !== gradeDosDesenhos) {
      for (const desenho of porAbismo.values()) largar(desenho)
      porAbismo = new Map()
      gradeDosDesenhos = grid
    }
    // O abismo que não mudou (a mesma assinatura) guarda o desenho; o resto refaz.
    const novos = new Map<string, Container>()
    for (const abismo of doPiso) {
      const chave = assinatura(abismo)
      if (!novos.has(chave)) novos.set(chave, porAbismo.get(chave) ?? pintarAbismo(abismo, grid))
    }
    for (const [chave, desenho] of porAbismo) if (!novos.has(chave)) largar(desenho)
    porAbismo = novos
    abismosNaTela.removeChildren()
    for (const desenho of novos.values()) abismosNaTela.addChild(desenho)
    escolha.clear()
    const escolhido = entrada?.escolhido === undefined || entrada.escolhido === null ? undefined : doPiso.find((a) => a.id === entrada.escolhido)
    if (escolhido !== undefined) {
      const plano = planoDe(escolhido.pontos)
      escolha.poly(plano, true).stroke({ color: COR_DA_ESCOLHA, width: grid * 0.16, alpha: 0.22, join: 'round' })
      escolha.poly(plano, true).stroke({ color: COR_DA_ESCOLHA, width: Math.max(1.5, grid * 0.05), alpha: 0.95, join: 'round' })
    }
  }

  return {
    camada,
    atualizar,
    destroy: () => {
      for (const desenho of porAbismo.values()) largar(desenho)
      porAbismo = new Map()
      camada.destroy({ children: true })
    },
  }
}
