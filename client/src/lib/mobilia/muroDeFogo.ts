/**
 * MURO DE FOGO (pedido do mestre de 15/11/2026: "faça mais alguns objetos:
 * 1-Um muro de fogo"). O fogo TRAÇADO: o mestre risca a linha à mão ou ponto a
 * ponto (`pixi/muroDeFogoNoEditor.ts`), reta ou curva, e o muro nasce com 1
 * casa de grossura, barrando a passagem. Sem luz, sem Aceso/Apagado e sem
 * tapar a visão (decisões do mestre no mesmo pedido).
 *
 * A linha mora em `Prop.tracado`, em frações 0..1 da caixa do objeto, sem
 * girar: mover, esticar e girar com as alças de sempre levam o traço junto.
 * Daqui saem a MESMA linha e a MESMA disposição de línguas para a imagem
 * parada (`texturas/meioTermo/moveis/muroDeFogo.ts`), a camada animada
 * (`pixi/fogosDoMapa.ts`), a colisão (`lib/obstaculosDeObjeto.ts`) e o clique
 * (`lib/cercaCurva.ts`): cada brasa pintada fica no pé de uma língua animada.
 *
 * A GROSSURA não é campo: é a folga entre o traço e a caixa (meia casa de cada
 * lado no nascimento, `muroDoTraco`). Esticar a caixa no comprimento não
 * engrossa o muro; apertar ou alargar a caixa inteira, sim. A régua das
 * línguas é a grossura (e não a casa do mapa): o muro fica igual em qualquer
 * grade, e a imagem e a camada animada contam as mesmas línguas.
 *
 * Sem import nenhum de Pixi nem de `types/map.ts`: função pura, testável.
 */

/** Um ponto do traço (a forma do `RegionPoint`, sem importar `types/map.ts`). */
export interface PontoDoMuro {
  readonly x: number
  readonly y: number
}

/** Teto de pontos de um traço gravado: o traço à mão mais longo, já afinado, fica bem abaixo. */
export const PONTOS_DO_MURO_MAX = 500
/** Traço mais curto que isto, em casas, não vira muro (o clique sem arrasto, o duplo clique no lugar). */
export const COMPRIMENTO_MINIMO_DO_MURO_EM_CASAS = 1
/** Meia grossura do muro que nasce, em casas: 1 casa de grossura. */
export const MEIA_GROSSURA_DO_MURO_EM_CASAS = 0.5
/** Traço encostado na borda da caixa (arquivo editado à mão): a faixa ainda tem esta fração do menor lado de meia grossura. */
const MEIA_MINIMA_NA_CAIXA = 0.04
/** Casas decimais das frações gravadas: 1e-5 da caixa (meio px num muro de 1000 casas). */
const PASSOS_DA_FRACAO = 1e5
/** Passo dos arcos do contorno (as pontas redondas e o lado de fora das quinas). */
const PASSO_DO_ARCO = Math.PI / 12
/** Quanto o contorno (o clique, a seleção, a colisão) pode sair da linha de verdade, em fração da meia grossura (0,05 casa no muro de 1 casa). */
export const TOLERANCIA_DO_CONTORNO = 0.1
/** Teto de línguas por muro: o muro que atravessa o mapa inteiro não vira milhares de nós. */
export const MAXIMO_DE_LINGUAS_DO_MURO = 90
/** Línguas por grossura de muro andada (2,5 por casa no muro de 1 casa). */
const LINGUAS_POR_GROSSURA = 2.5
/** A língua do muro, em grossuras: mais alta que a do Fogo de 1 casa (0,92), para ler como parede. */
const ALTURA_DA_LINGUA_EM_GROSSURAS = 1.35
/** Quanto a base da língua sai da linha, para um lado e para o outro, em fração da meia grossura. */
const DESVIO_MINIMO = 0.16
const DESVIO_SORTEADO = 0.2
/** Uma língua com fagulha a cada 2 grossuras e um fio de fumaça a cada 3, até os tetos. */
const GROSSURAS_POR_FAGULHA = 2
const GROSSURAS_POR_FIO = 3
const MAXIMO_DE_FAGULHAS = 10
const MAXIMO_DE_FIOS = 8

function ehPontoLimpo(valor: unknown): valor is PontoDoMuro {
  if (typeof valor !== 'object' || valor === null || !('x' in valor) || !('y' in valor)) return false
  const { x, y } = valor
  return typeof x === 'number' && typeof y === 'number' && x >= 0 && x <= 1 && y >= 0 && y <= 1
}

/** O traço já está como a leitura o deixaria? Então ele mesmo serve (a mesma referência: nada a consertar). */
function ehTracadoLimpo(valor: unknown): valor is PontoDoMuro[] {
  if (!Array.isArray(valor) || valor.length < 2 || valor.length > PONTOS_DO_MURO_MAX) return false
  const itens: readonly unknown[] = valor
  let anterior: PontoDoMuro | null = null
  for (const item of itens) {
    if (!ehPontoLimpo(item) || Object.keys(item).length !== 2) return false
    if (anterior !== null && anterior.x === item.x && anterior.y === item.y) return false
    anterior = item
  }
  return true
}

/** `teto` pontos espalhados por igual pelos índices, com o primeiro e o último. */
function reduzir(pontos: readonly PontoDoMuro[], teto: number): PontoDoMuro[] {
  const saida: PontoDoMuro[] = []
  for (let i = 0; i < teto; i += 1) saida.push(pontos[Math.round((i * (pontos.length - 1)) / (teto - 1))])
  return saida
}

/**
 * O traço como o arquivo (ou a travessia para o jogador) pode trazê-lo: só
 * pontos de números finitos, presos em 0..1, sem repetido seguido, até
 * `PONTOS_DO_MURO_MAX`. Ponto torto sai; com menos de 2 pontos bons o traço
 * inteiro some (`undefined` = a reta pelo meio da caixa). Limpo, devolve o
 * MESMO array.
 */
export function lerTracadoDoMuro(valor: unknown): PontoDoMuro[] | undefined {
  if (ehTracadoLimpo(valor)) return valor
  if (!Array.isArray(valor)) return undefined
  const itens: readonly unknown[] = valor
  const lidos: PontoDoMuro[] = []
  for (const item of itens) {
    if (typeof item !== 'object' || item === null || !('x' in item) || !('y' in item)) continue
    const { x, y } = item
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) continue
    const ponto = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) }
    const ultimo = lidos[lidos.length - 1]
    if (ultimo !== undefined && ultimo.x === ponto.x && ultimo.y === ponto.y) continue
    lidos.push(ponto)
  }
  if (lidos.length < 2) return undefined
  return lidos.length > PONTOS_DO_MURO_MAX ? reduzir(lidos, PONTOS_DO_MURO_MAX) : lidos
}

/** A linha do muro no referencial do objeto (centro na origem, sem giro), na unidade da largura e da altura dadas. */
export interface EixoDoMuro {
  readonly pontos: readonly PontoDoMuro[]
  /** Meia grossura da faixa. */
  readonly meia: number
  readonly comprimento: number
  /** Comprimento andado até cada ponto (o primeiro é 0). */
  readonly acumulado: readonly number[]
}

function comMedidas(pontos: readonly PontoDoMuro[], meia: number): EixoDoMuro {
  const acumulado = [0]
  for (let i = 1; i < pontos.length; i += 1) acumulado.push(acumulado[i - 1] + Math.hypot(pontos[i].x - pontos[i - 1].x, pontos[i].y - pontos[i - 1].y))
  return { pontos, meia, comprimento: acumulado[acumulado.length - 1], acumulado }
}

/** Sem traço: a reta pelo meio da caixa, no lado comprido, com a caixa inteira de grossura. */
function eixoReto(largura: number, altura: number): EixoDoMuro {
  const meia = Math.min(largura, altura) / 2
  const meio = Math.max(Math.max(largura, altura) / 2 - meia, meia * 0.01)
  return comMedidas(largura >= altura ? [{ x: -meio, y: 0 }, { x: meio, y: 0 }] : [{ x: 0, y: -meio }, { x: 0, y: meio }], meia)
}

function eixoDoTracado(largura: number, altura: number, tracado: readonly PontoDoMuro[]): EixoDoMuro {
  let minX = 1
  let maxX = 0
  let minY = 1
  let maxY = 0
  const pontos = tracado.map((p) => {
    minX = Math.min(minX, p.x)
    maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
    return { x: (p.x - 0.5) * largura, y: (p.y - 0.5) * altura }
  })
  // A grossura é a folga entre o traço e a caixa: a menor das quatro, para a faixa nunca sair da caixa.
  const folga = Math.min(minX * largura, (1 - maxX) * largura, minY * altura, (1 - maxY) * altura)
  return comMedidas(pontos, Math.max(folga, Math.min(largura, altura) * MEIA_MINIMA_NA_CAIXA))
}

const eixosGuardados = new WeakMap<readonly PontoDoMuro[], { readonly largura: number; readonly altura: number; readonly eixo: EixoDoMuro }>()

/**
 * A linha e a meia grossura do muro numa caixa de `largura` x `altura`.
 * `null` com medida que não se desenha (zero, negativa, não finita). O mesmo
 * traço na mesma caixa devolve a MESMA resposta, sem refazer a conta (o clique
 * e o cursor perguntam a cada movimento do ponteiro).
 */
export function eixoDoMuro(largura: number, altura: number, tracado: readonly PontoDoMuro[] | undefined): EixoDoMuro | null {
  if (!Number.isFinite(largura) || !Number.isFinite(altura) || !(largura > 0) || !(altura > 0)) return null
  const chave = typeof tracado === 'object' && tracado !== null ? tracado : undefined
  const guardado = chave === undefined ? undefined : eixosGuardados.get(chave)
  if (guardado !== undefined && guardado.largura === largura && guardado.altura === altura) return guardado.eixo
  const limpo = lerTracadoDoMuro(tracado)
  const eixo = limpo === undefined ? eixoReto(largura, altura) : eixoDoTracado(largura, altura, limpo)
  if (chave !== undefined) eixosGuardados.set(chave, { largura, altura, eixo })
  return eixo
}

/** Um ponto da linha e a normal unitária dela ali (à esquerda de quem anda no sentido do traço). */
export interface PontoNoEixo {
  readonly x: number
  readonly y: number
  readonly nx: number
  readonly ny: number
}

/** O ponto da linha a `andado` de comprimento do começo (preso entre as pontas). */
export function pontoNoEixo(eixo: EixoDoMuro, andado: number): PontoNoEixo {
  const { pontos, acumulado } = eixo
  const alvo = Math.min(eixo.comprimento, Math.max(0, andado))
  let i = 1
  while (i < pontos.length - 1 && acumulado[i] < alvo) i += 1
  const a = pontos[i - 1]
  const b = pontos[i]
  const trecho = acumulado[i] - acumulado[i - 1]
  const t = trecho > 0 ? (alvo - acumulado[i - 1]) / trecho : 0
  const dx = b.x - a.x
  const dy = b.y - a.y
  const d = Math.hypot(dx, dy) || 1
  return { x: a.x + dx * t, y: a.y + dy * t, nx: -dy / d, ny: dx / d }
}

/** Sorteio fixo em [0, 1): a disposição não usa o id, então a imagem parada (dividida entre muros iguais) casa com ela. */
function sorteio(i: number, n: number): number {
  const v = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453
  return v - Math.floor(v)
}

/** O comprimento da linha em grossuras de muro (em casas, no muro de 1 casa). */
function grossurasDoEixo(eixo: EixoDoMuro): number {
  return eixo.meia > 0 ? eixo.comprimento / (2 * eixo.meia) : 0
}

/** Quantas línguas tem o muro: 2,5 por grossura andada, de 2 a `MAXIMO_DE_LINGUAS_DO_MURO`. */
export function numeroDeLinguasDoMuro(eixo: EixoDoMuro): number {
  const grossuras = grossurasDoEixo(eixo)
  if (!(grossuras > 0) || !Number.isFinite(grossuras)) return 0
  return Math.max(2, Math.min(MAXIMO_DE_LINGUAS_DO_MURO, Math.round(LINGUAS_POR_GROSSURA * grossuras)))
}

/** Uma língua do muro: a base no referencial do eixo e a altura em repouso, na unidade dele. */
export interface LinguaDoMuro {
  readonly x: number
  readonly y: number
  readonly altura: number
}

/**
 * As línguas do muro, NA ORDEM DO TRAÇO (quem desenha ordena de trás para a
 * frente): de uma ponta à outra, a passo igual, saindo da linha ora para um
 * lado, ora para o outro, com a altura variando 15% para cima e para baixo.
 * Sempre as mesmas para o mesmo eixo.
 */
export function linguasDoMuro(eixo: EixoDoMuro): LinguaDoMuro[] {
  const n = numeroDeLinguasDoMuro(eixo)
  const linguas: LinguaDoMuro[] = []
  for (let i = 0; i < n; i += 1) {
    const p = pontoNoEixo(eixo, (eixo.comprimento * i) / (n - 1))
    const desvio = (i % 2 === 0 ? 1 : -1) * (DESVIO_MINIMO + DESVIO_SORTEADO * sorteio(i, n)) * eixo.meia
    linguas.push({
      x: p.x + p.nx * desvio,
      y: p.y + p.ny * desvio,
      altura: ALTURA_DA_LINGUA_EM_GROSSURAS * 2 * eixo.meia * (0.85 + 0.3 * sorteio(i + 7, n)),
    })
  }
  return linguas
}

/** `quantos` índices de 0 a `n - 1`, espalhados por igual. */
function indicesEspalhados(n: number, quantos: number): number[] {
  const indices: number[] = []
  for (let k = 0; k < Math.min(n, quantos); k += 1) indices.push(Math.floor(((k + 0.5) * n) / Math.min(n, quantos)))
  return indices
}

/** As línguas que soltam fagulha (3 cada), espalhadas pelo muro: uma a cada 2 grossuras, até 10. */
export function linguasComFagulhaDoMuro(eixo: EixoDoMuro): number[] {
  const n = numeroDeLinguasDoMuro(eixo)
  return indicesEspalhados(n, Math.max(1, Math.min(MAXIMO_DE_FAGULHAS, Math.round(grossurasDoEixo(eixo) / GROSSURAS_POR_FAGULHA))))
}

/** As línguas de onde sobe um fio de fumaça: um a cada 3 grossuras, até 8. */
export function linguasComFumacaDoMuro(eixo: EixoDoMuro): number[] {
  const n = numeroDeLinguasDoMuro(eixo)
  return indicesEspalhados(n, Math.max(1, Math.min(MAXIMO_DE_FIOS, Math.round(grossurasDoEixo(eixo) / GROSSURAS_POR_FIO))))
}

/** A língua mais alta que o muro pode ter, em grossuras (a fumaça cresce com ela). */
export const ALTURA_MAXIMA_DA_LINGUA_DO_MURO_EM_GROSSURAS = ALTURA_DA_LINGUA_EM_GROSSURAS * 1.15

/** Distância do ponto à linha (o trecho mais perto). */
export function distanciaAoEixo(pontos: readonly PontoDoMuro[], x: number, y: number): number {
  let menor = Infinity
  for (let i = 1; i < pontos.length; i += 1) {
    const a = pontos[i - 1]
    const dx = pontos[i].x - a.x
    const dy = pontos[i].y - a.y
    const comprimento = dx * dx + dy * dy
    const t = comprimento === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / comprimento))
    const qx = x - (a.x + dx * t)
    const qy = y - (a.y + dy * t)
    menor = Math.min(menor, qx * qx + qy * qy)
  }
  return Math.sqrt(menor)
}

/**
 * A linha com menos pontos, sem sair mais que `tolerancia` do lugar
 * (Ramer-Douglas-Peucker, sem recursão): o traço à mão tem um ponto a cada
 * poucos px, e o contorno, a colisão e a imagem não precisam de todos.
 */
export function simplificarEixo(pontos: readonly PontoDoMuro[], tolerancia: number): PontoDoMuro[] {
  const n = pontos.length
  if (n <= 2 || !(tolerancia > 0)) return [...pontos]
  const fica = new Uint8Array(n)
  fica[0] = 1
  fica[n - 1] = 1
  const pilha: [number, number][] = [[0, n - 1]]
  for (let trecho = pilha.pop(); trecho !== undefined; trecho = pilha.pop()) {
    const [de, ate] = trecho
    let longe = -1
    let maior = tolerancia
    for (let i = de + 1; i < ate; i += 1) {
      const d = distanciaAoEixo([pontos[de], pontos[ate]], pontos[i].x, pontos[i].y)
      if (d > maior) {
        maior = d
        longe = i
      }
    }
    if (longe < 0) continue
    fica[longe] = 1
    pilha.push([de, longe], [longe, ate])
  }
  return pontos.filter((_p, i) => fica[i] === 1)
}

function noCirculo(centro: PontoDoMuro, raio: number, angulo: number): PontoDoMuro {
  return { x: centro.x + Math.cos(angulo) * raio, y: centro.y + Math.sin(angulo) * raio }
}

/** A volta de `de` até `ate`, em (-π, π]. */
function voltaEntre(de: number, ate: number): number {
  let volta = ate - de
  while (volta > Math.PI) volta -= 2 * Math.PI
  while (volta <= -Math.PI) volta += 2 * Math.PI
  return volta
}

/**
 * Um arco em volta de `centro`, de `inicio` andando `volta`, em passos de até
 * 15°, pelo polígono que ABRAÇA o círculo: os cantos ficam no meio de cada
 * passo, um tico para fora, e os lados encostam no círculo. O primeiro e o
 * último canto caem na reta das bordas que chegam e saem, então o contorno
 * nunca fica menor que a faixa de verdade: quem está fora dele está fora do
 * muro (a colisão conta com isso).
 */
function arco(saida: PontoDoMuro[], centro: PontoDoMuro, raio: number, inicio: number, volta: number): void {
  const passos = Math.max(1, Math.ceil(Math.abs(volta) / PASSO_DO_ARCO))
  const porFora = raio / Math.cos(Math.abs(volta) / passos / 2)
  for (let k = 0; k < passos; k += 1) saida.push(noCirculo(centro, porFora, inicio + (volta * (k + 0.5)) / passos))
}

/** Um lado da faixa, do começo ao fim do traço: `lado` = +π/2 (à esquerda) ou -π/2 (à direita). */
function ladoDaFaixa(pontos: readonly PontoDoMuro[], meia: number, lado: number): PontoDoMuro[] {
  const saida: PontoDoMuro[] = []
  const n = pontos.length
  const rumo = (a: PontoDoMuro, b: PontoDoMuro): number => Math.atan2(b.y - a.y, b.x - a.x)
  for (let i = 0; i < n; i += 1) {
    const v = pontos[i]
    if (i === 0 || i === n - 1) {
      saida.push(noCirculo(v, meia, (i === 0 ? rumo(v, pontos[1]) : rumo(pontos[n - 2], v)) + lado))
      continue
    }
    const chega = rumo(pontos[i - 1], v)
    const sai = rumo(v, pontos[i + 1])
    const volta = voltaEntre(chega, sai)
    // O lado de FORA da quina abre: um arco em volta do ponto, como a ponta redonda.
    if (volta !== 0 && Math.sign(volta) !== Math.sign(lado)) {
      arco(saida, v, meia, chega + lado, volta)
      continue
    }
    // O lado de DENTRO fecha: o encontro das duas bordas quando cabe nos dois trechos; na quina fechada demais
    // (ou de trecho curto), as duas bordas no círculo do ponto, sem bico para fora.
    const recuo = meia * Math.tan(Math.abs(volta) / 2)
    const menorTrecho = Math.min(Math.hypot(v.x - pontos[i - 1].x, v.y - pontos[i - 1].y), Math.hypot(pontos[i + 1].x - v.x, pontos[i + 1].y - v.y))
    if (recuo <= menorTrecho) saida.push(noCirculo(v, meia / Math.cos(volta / 2), chega + lado + volta / 2))
    else saida.push(noCirculo(v, meia, chega + lado), noCirculo(v, meia, sai + lado))
  }
  return saida
}

/**
 * O contorno fechado da faixa de meia grossura `meia` em volta da linha, com
 * as pontas redondas: um lado de ida, a ponta do fim, o outro lado de volta e
 * a ponta do começo. Vazio com menos de 2 pontos.
 */
export function contornoDaFaixa(pontos: readonly PontoDoMuro[], meia: number): PontoDoMuro[] {
  const n = pontos.length
  if (n < 2 || !(meia > 0)) return []
  const ida = ladoDaFaixa(pontos, meia, Math.PI / 2)
  const volta = ladoDaFaixa(pontos, meia, -Math.PI / 2).reverse()
  const rumoDoFim = Math.atan2(pontos[n - 1].y - pontos[n - 2].y, pontos[n - 1].x - pontos[n - 2].x)
  const rumoDoComeco = Math.atan2(pontos[1].y - pontos[0].y, pontos[1].x - pontos[0].x)
  const anel = [...ida]
  arco(anel, pontos[n - 1], meia, rumoDoFim + Math.PI / 2, -Math.PI)
  anel.push(...volta)
  arco(anel, pontos[0], meia, rumoDoComeco - Math.PI / 2, -Math.PI)
  return anel
}

/** O muro que nasce de um traço: o centro, o tamanho da caixa e o traço em frações dela. */
export interface MuroDoTraco {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly tracado: PontoDoMuro[]
}

/**
 * O muro de um traço em px de mundo: a caixa é o contorno do traço mais meia
 * casa de cada lado (1 casa de grossura) e o traço vira frações dela. `null`
 * quando o traço não chega a `COMPRIMENTO_MINIMO_DO_MURO_EM_CASAS` (o clique
 * sem arrasto) ou não tem 2 pontos bons.
 */
export function muroDoTraco(pontos: readonly PontoDoMuro[], grade: number): MuroDoTraco | null {
  if (!Number.isFinite(grade) || !(grade > 0)) return null
  const bons: PontoDoMuro[] = []
  let comprimento = 0
  for (const p of pontos) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue
    const ultimo = bons[bons.length - 1]
    if (ultimo !== undefined && ultimo.x === p.x && ultimo.y === p.y) continue
    if (ultimo !== undefined) comprimento += Math.hypot(p.x - ultimo.x, p.y - ultimo.y)
    bons.push(p)
  }
  if (bons.length < 2 || comprimento < grade * COMPRIMENTO_MINIMO_DO_MURO_EM_CASAS - 1e-6) return null
  const meia = grade * MEIA_GROSSURA_DO_MURO_EM_CASAS
  const x0 = Math.min(...bons.map((p) => p.x)) - meia
  const y0 = Math.min(...bons.map((p) => p.y)) - meia
  const width = Math.max(...bons.map((p) => p.x)) + meia - x0
  const height = Math.max(...bons.map((p) => p.y)) + meia - y0
  const fracao = (valor: number): number => Math.round(valor * PASSOS_DA_FRACAO) / PASSOS_DA_FRACAO
  const tracado = lerTracadoDoMuro(bons.map((p) => ({ x: fracao((p.x - x0) / width), y: fracao((p.y - y0) / height) })))
  if (tracado === undefined) return null
  return { x: x0 + width / 2, y: y0 + height / 2, width, height, tracado }
}

const chavesGuardadas = new WeakMap<readonly PontoDoMuro[], string>()

/**
 * O traço em poucas letras, para a chave da imagem e a da camada animada:
 * traços iguais dão a mesma chave (dividem a imagem), e mexer num ponto a
 * troca. `'r'` = sem traço (a reta pelo meio).
 */
export function chaveDoTracado(tracado: readonly PontoDoMuro[] | undefined): string {
  if (typeof tracado !== 'object' || tracado === null) return 'r'
  const guardada = chavesGuardadas.get(tracado)
  if (guardada !== undefined) return guardada
  const limpo = lerTracadoDoMuro(tracado)
  let chave = 'r'
  if (limpo !== undefined) {
    // Dois hashes de 32 bits (FNV-1a e um de soma rodada): 64 bits bastam para muros de um mapa não baterem.
    let a = 0x811c9dc5
    let b = 0x9e3779b9
    for (const p of limpo) {
      const x = Math.round(p.x * PASSOS_DA_FRACAO)
      const y = Math.round(p.y * PASSOS_DA_FRACAO)
      a = Math.imul(a ^ x, 0x01000193)
      a = Math.imul(a ^ y, 0x01000193)
      b = (Math.imul(b ^ y, 0x85ebca6b) + x) | 0
      b = (b << 13) | (b >>> 19)
    }
    chave = `t${limpo.length}.${(a >>> 0).toString(36)}.${(b >>> 0).toString(36)}`
  }
  chavesGuardadas.set(tracado, chave)
  return chave
}

/** Um traço do desenho de linhas (a forma do `TracoDoGlifo` de `lib/mobilia.ts`). */
export interface TracoDoMuro {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * O desenho de linhas do muro (o provisório enquanto a imagem não chega): o
 * contorno da faixa, no referencial do objeto. Vazio com medida que não se desenha.
 */
export function tracosDoMuroDeFogo(largura: number, altura: number, tracado: readonly PontoDoMuro[] | undefined): TracoDoMuro[] {
  const eixo = eixoDoMuro(largura, altura, tracado)
  if (eixo === null) return []
  const anel = contornoDaFaixa(simplificarEixo(eixo.pontos, eixo.meia * TOLERANCIA_DO_CONTORNO), eixo.meia)
  return anel.map((a, i) => {
    const b = anel[(i + 1) % anel.length]
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  })
}
