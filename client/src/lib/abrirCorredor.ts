import type { MapData, Region, RegionPoint, Wall } from '../types/map'
import { abrirTrecho } from './abrirVao'
import { canInteractInLayer, regionLayer, wallLayer } from './layers'
import { pisoDe } from './pisos'
import { ancestorsOf, pointInPolygonInclusive, pointOnPolygonBorder } from './roomNesting'

/**
 * ABRIR A SALA PARA O CORREDOR — pedido 4 de 30/09/2026: "um botão que
 * desmonta as salas, ou uma parede só da sala ... a imagem é um corredor e do
 * lado tem uma sala, eu queria que fosse uma estrutura só".
 *
 * O corredor do mestre são duas linhas de parede SOLTA (ferramenta Parede, ou
 * o modo "Criar Parede" da Sala livre) que entram na Sala e riscam o chão
 * dela. A Sala continua sendo Sala: nome, teto, cômodo, escuridão, pinos e
 * cenas ficam, e a Region volta pela mesma referência. Mudam só as paredes:
 *  - a parede da Sala perde o trecho da borda entre as duas linhas (o vão),
 *    com o corte do "Abrir vão aqui" (`abrirTrecho`), que já vale dos dois
 *    lados, poupa a parede da sala secreta vizinha e recusa parede travada;
 *  - cada linha para na borda: a ponta de dentro volta até ela, e a que parou
 *    um pouco antes é esticada até ela;
 *  - o "L" solto que a linha fazia dentro do chão é apagado.
 * Visão (`visibility.ts`) e colisão (`collision.ts`) só leem paredes: tirar o
 * trecho abre a passagem de verdade, no mestre e no jogador.
 *
 * O que conta como corredor é estreito DE PROPÓSITO: duas linhas que encostam
 * na borda, seguem para fora quase paralelas e no mesmo sentido, a uma
 * largura de corredor uma da outra, com o arco curto da borda entre elas.
 * Parede solta encostada em Sala é comum (divisória, muro, rua); sem essa
 * régua, duas delas em lados opostos abririam um lado inteiro da Sala.
 */

/** Ponta que parou ANTES da borda ainda encosta se a borda está a até 1/4 de
 *  célula adiante, seguindo a própria linha: é esticada até lá. É também a
 *  folga de "o canto da Sala fica entre as duas linhas" (traço à mão nunca é exato). */
const ENCOSTE_TOLERANCIA_CELULAS = 0.25

/** Pontas a até isto (px) são a mesma ponta: a parede livre em polilinha emenda
 *  os trechos no ponto exato do clique. */
const PONTA_COLADA = 0.5

/** Menos que meia célula entre as linhas não é passagem: é traço repetido ou parede dupla. */
const CORREDOR_LARGURA_MIN_CELULAS = 0.5

/** Mais que 4 células entre as linhas não é corredor: são paredes sem relação encostando na Sala. */
const CORREDOR_LARGURA_MAX_CELULAS = 4

/** As linhas seguem para fora quase paralelas: até 25° entre elas. Sentidos
 *  opostos (uma sobe do topo, a outra desce da base) nunca formam corredor. */
const CORREDOR_ANGULO_MAX_GRAUS = 25
const COS_ANGULO_MAX = Math.cos((CORREDOR_ANGULO_MAX_GRAUS * Math.PI) / 180)

/** O vão tem no máximo 4× a largura do corredor. Linhas quase deitadas sobre a
 *  parede (uma rua passando rente à Sala) encostam longe uma da outra e, sem
 *  esse teto, abririam a lateral inteira. Corredor que chega a ~15° da parede
 *  ainda passa. */
const VAO_MAX_POR_LARGURA = 4

/** Trecho de borda menor que isto (px) não vira vão: é o `PEDACO_MINIMO` de
 *  abrirVao.ts, abaixo do qual o corte nem acontece. */
const TRECHO_MINIMO = 0.5

/** Folga numérica do cruzamento: a linha que passa exatamente pela emenda de
 *  duas arestas (o vértice) cai no limite 0 ou 1 de uma delas. */
const EPSILON_CRUZAMENTO = 1e-9

type Ponto = RegionPoint

/** Um ponto da borda: a aresta onde está (de `points[aresta]` a `points[aresta + 1]`)
 *  e a posição `s` ao longo do perímetro, a partir de `points[0]`. */
interface NaBorda {
  ponto: Ponto
  aresta: number
  s: number
}

/** Uma linha de corredor encostando na borda da Sala. */
export interface EncosteDeCorredor extends NaBorda {
  paredeId: string
  /** Direção da linha, do encoste para a ponta de fora (unitária). */
  paraFora: Ponto
  /** Ponta da parede (1 = x1,y1; 2 = x2,y2) que vai até o encoste; `null` = já está na borda. */
  ponta: 1 | 2 | null
  /** De onde sai o "L" que a linha fazia dentro do chão: a ponta de dentro
   *  original, ou a própria ponta na borda. `null` = a linha não chegava à Sala. */
  inicioDaCorrente: Ponto | null
}

/** Pedaço reto da borda, dentro de uma aresta, que vira vão. */
export interface TrechoDaBorda {
  aresta: number
  de: Ponto
  ate: Ponto
}

/** Um corredor: as duas linhas e os trechos da borda entre elas, pelo arco curto. */
export interface CorredorQueEncosta {
  linhas: [EncosteDeCorredor, EncosteDeCorredor]
  /** Comprimento do arco da borda entre as duas linhas (px). */
  arco: number
  trechos: TrechoDaBorda[]
}

export type MotivoDaAbertura = 'ok' | 'nada' | 'porta' | 'travada' | 'secreta'

export interface AberturaDeCorredor {
  /** O mapa aberto; em qualquer outro motivo, o MESMO mapa (referência), para quem chama não gravar histórico. */
  map: MapData
  motivo: MotivoDaAbertura
  /** Quantos corredores abriram (0 fora do 'ok'). */
  corredores: number
  /** A parede de uma sala secreta vizinha ficou de pé em algum trecho (ver `abrirTrecho`). */
  salaSecretaPoupada: boolean
}

type Impedimento = 'porta' | 'travada'

// ─── Vetores ────────────────────────────────────────────────────────────────

function menos(a: Ponto, b: Ponto): Ponto {
  return { x: a.x - b.x, y: a.y - b.y }
}

function cruz(a: Ponto, b: Ponto): number {
  return a.x * b.y - a.y * b.x
}

function escalar(a: Ponto, b: Ponto): number {
  return a.x * b.x + a.y * b.y
}

function distancia(a: Ponto, b: Ponto): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function unitario(v: Ponto): Ponto {
  const n = Math.hypot(v.x, v.y)
  return n === 0 ? { x: 0, y: 0 } : { x: v.x / n, y: v.y / n }
}

function entre(a: Ponto, b: Ponto, t: number): Ponto {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

// ─── A borda da Sala ────────────────────────────────────────────────────────

/** O contorno da Sala, com o comprimento acumulado antes de cada aresta. */
interface Borda {
  pontos: readonly Ponto[]
  antes: readonly number[]
  perimetro: number
}

function bordaDa(sala: Region): Borda {
  const pontos = sala.points
  const antes: number[] = []
  let perimetro = 0
  for (let k = 0; k < pontos.length; k += 1) {
    antes.push(perimetro)
    perimetro += distancia(pontos[k], pontos[(k + 1) % pontos.length])
  }
  return { pontos, antes, perimetro }
}

function inicioDa(borda: Borda, aresta: number): Ponto {
  return borda.pontos[aresta]
}

function fimDa(borda: Borda, aresta: number): Ponto {
  return borda.pontos[(aresta + 1) % borda.pontos.length]
}

/** O ponto da aresta no parâmetro `u` (0..1, com clamp). */
function naAresta(borda: Borda, aresta: number, u: number): NaBorda {
  const a = inicioDa(borda, aresta)
  const b = fimDa(borda, aresta)
  const t = Math.max(0, Math.min(1, u))
  return { ponto: entre(a, b, t), aresta, s: borda.antes[aresta] + t * distancia(a, b) }
}

/** Onde p→q cruza a→b: `t` ao longo de p→q, `u` ao longo de a→b. Paralelos não cruzam. */
function cruzamento(p: Ponto, q: Ponto, a: Ponto, b: Ponto): { t: number; u: number } | null {
  const r = menos(q, p)
  const s = menos(b, a)
  const den = cruz(r, s)
  if (den === 0) return null
  const w = menos(a, p)
  const t = cruz(w, s) / den
  const u = cruz(w, r) / den
  const noTrecho = (x: number) => x >= -EPSILON_CRUZAMENTO && x <= 1 + EPSILON_CRUZAMENTO
  return noTrecho(t) && noTrecho(u) ? { t, u } : null
}

/** O primeiro ponto da borda que o segmento p→q toca, andando a partir de `p`. */
function primeiroToque(borda: Borda, p: Ponto, q: Ponto): (NaBorda & { t: number }) | null {
  let melhor: (NaBorda & { t: number }) | null = null
  for (let k = 0; k < borda.pontos.length; k += 1) {
    const c = cruzamento(p, q, inicioDa(borda, k), fimDa(borda, k))
    if (c !== null && (melhor === null || c.t < melhor.t)) melhor = { ...naAresta(borda, k, c.u), t: c.t }
  }
  return melhor
}

/** O ponto da borda mais perto de `p`. */
function maisPertoNaBorda(borda: Borda, p: Ponto): NaBorda {
  let melhor = naAresta(borda, 0, 0)
  let menor = Infinity
  for (let k = 0; k < borda.pontos.length; k += 1) {
    const a = inicioDa(borda, k)
    const ab = menos(fimDa(borda, k), a)
    const comprimento2 = escalar(ab, ab)
    const candidato = naAresta(borda, k, comprimento2 === 0 ? 0 : escalar(menos(p, a), ab) / comprimento2)
    const d = distancia(p, candidato.ponto)
    if (d < menor) {
      menor = d
      melhor = candidato
    }
  }
  return melhor
}

type Lugar = 'borda' | 'dentro' | 'fora'

function lugarDe(p: Ponto, pontos: readonly Ponto[]): Lugar {
  if (pointOnPolygonBorder(p, pontos)) return 'borda'
  return pointInPolygonInclusive(p, pontos) ? 'dentro' : 'fora'
}

// ─── Onde cada linha encosta ────────────────────────────────────────────────

/**
 * Como a parede encosta na borda, ou `null` se ela não é linha de corredor:
 * entra no chão (uma ponta dentro, outra fora), bate certinho na borda, ou
 * parou pouco antes dela. Inteira dentro, inteira sobre a borda, ou
 * atravessando a Sala de lado a lado, não é.
 */
function encosteDa(parede: Wall, borda: Borda, folga: number): EncosteDeCorredor | null {
  const p1 = { x: parede.x1, y: parede.y1 }
  const p2 = { x: parede.x2, y: parede.y2 }
  const l1 = lugarDe(p1, borda.pontos)
  const l2 = lugarDe(p2, borda.pontos)
  if (l1 === 'fora' && l2 === 'fora') return quaseEncostando(parede.id, borda, p1, p2, folga)
  if (l1 === 'fora') return l2 === 'dentro' ? entrando(parede.id, borda, p2, p1, 2) : naBorda(parede.id, borda, p2, p1)
  if (l2 === 'fora') return l1 === 'dentro' ? entrando(parede.id, borda, p1, p2, 1) : naBorda(parede.id, borda, p1, p2)
  return null
}

/** Linha que entra no chão: encosta onde cruza a borda mais perto da ponta de dentro. */
function entrando(paredeId: string, borda: Borda, dentro: Ponto, fora: Ponto, ponta: 1 | 2): EncosteDeCorredor | null {
  const toque = primeiroToque(borda, dentro, fora)
  if (toque === null) return null
  const { ponto, aresta, s } = toque
  return { paredeId, ponto, aresta, s, paraFora: unitario(menos(fora, ponto)), ponta, inicioDaCorrente: dentro }
}

/** Linha que bate certinho na borda: encosta na própria ponta e não muda. */
function naBorda(paredeId: string, borda: Borda, pontaNaBorda: Ponto, fora: Ponto): EncosteDeCorredor {
  const { ponto, aresta, s } = maisPertoNaBorda(borda, pontaNaBorda)
  return { paredeId, ponto, aresta, s, paraFora: unitario(menos(fora, ponto)), ponta: null, inicioDaCorrente: pontaNaBorda }
}

/** A borda seguindo a linha além de `ponta` (sentido de quem vem de `outra`), a até `folga` px. */
function esticando(borda: Borda, ponta: Ponto, outra: Ponto, folga: number): (NaBorda & { t: number }) | null {
  const adiante = unitario(menos(ponta, outra))
  return primeiroToque(borda, ponta, { x: ponta.x + adiante.x * folga, y: ponta.y + adiante.y * folga })
}

/** Linha que parou antes da borda: encosta se a borda está logo adiante. Com as duas pontas
 *  fora e cruzando a borda (atravessa a Sala, ou raspa um canto), não é corredor. */
function quaseEncostando(paredeId: string, borda: Borda, p1: Ponto, p2: Ponto, folga: number): EncosteDeCorredor | null {
  if (primeiroToque(borda, p1, p2) !== null) return null
  const t1 = esticando(borda, p1, p2, folga)
  const t2 = esticando(borda, p2, p1, folga)
  const pelaPonta1 = t1 !== null && (t2 === null || t1.t <= t2.t)
  const toque = pelaPonta1 ? t1 : t2
  if (toque === null) return null
  const { ponto, aresta, s } = toque
  const fora = pelaPonta1 ? p2 : p1
  return { paredeId, ponto, aresta, s, paraFora: unitario(menos(fora, ponto)), ponta: pelaPonta1 ? 1 : 2, inicioDaCorrente: null }
}

// ─── Quais linhas formam um corredor ────────────────────────────────────────

/** Os pedaços retos da borda de `de` até `ate`, no sentido dos pontos da Sala (um por aresta). */
function trechosDoArco(borda: Borda, de: NaBorda, ate: NaBorda): TrechoDaBorda[] {
  const n = borda.pontos.length
  const trechos: TrechoDaBorda[] = []
  if (de.aresta === ate.aresta && ate.s >= de.s) {
    trechos.push({ aresta: de.aresta, de: de.ponto, ate: ate.ponto })
  } else {
    trechos.push({ aresta: de.aresta, de: de.ponto, ate: fimDa(borda, de.aresta) })
    for (let k = (de.aresta + 1) % n; k !== ate.aresta; k = (k + 1) % n) {
      trechos.push({ aresta: k, de: inicioDa(borda, k), ate: fimDa(borda, k) })
    }
    trechos.push({ aresta: ate.aresta, de: inicioDa(borda, ate.aresta), ate: ate.ponto })
  }
  return trechos.filter((t) => distancia(t.de, t.ate) >= TRECHO_MINIMO)
}

/** Distância de `c` até a linha de `e`, positiva do lado em que está `outra` (a outra linha do corredor). */
function ladoDeDentro(e: EncosteDeCorredor, outra: Ponto, c: Ponto): number {
  return Math.sign(cruz(e.paraFora, menos(outra, e.ponto))) * cruz(e.paraFora, menos(c, e.ponto))
}

/**
 * As duas linhas formam um corredor, indo de `de` a `ate` pela borda? Arco
 * curto; quase paralelas e no mesmo sentido; largura de corredor entre elas; o
 * vão do tamanho da boca do corredor; e todo canto da Sala no caminho fica
 * entre as duas linhas (o vão é onde o corredor encontra a Sala, nunca além).
 */
function formamCorredor(de: EncosteDeCorredor, ate: EncosteDeCorredor, borda: Borda, grade: number): CorredorQueEncosta | null {
  const arco = (ate.s - de.s + borda.perimetro) % borda.perimetro
  if (arco > borda.perimetro / 2) return null
  if (escalar(de.paraFora, ate.paraFora) < COS_ANGULO_MAX) return null
  const largura = Math.max(Math.abs(cruz(de.paraFora, menos(ate.ponto, de.ponto))), Math.abs(cruz(ate.paraFora, menos(de.ponto, ate.ponto))))
  if (largura < CORREDOR_LARGURA_MIN_CELULAS * grade || largura > CORREDOR_LARGURA_MAX_CELULAS * grade) return null
  if (arco > VAO_MAX_POR_LARGURA * largura) return null
  const trechos = trechosDoArco(borda, de, ate)
  const folga = ENCOSTE_TOLERANCIA_CELULAS * grade
  const cantos = trechos.slice(1).map((t) => t.de)
  const cantosDentro = cantos.every((c) => ladoDeDentro(de, ate.ponto, c) >= -folga && ladoDeDentro(ate, de.ponto, c) >= -folga)
  return cantosDentro ? { linhas: [de, ate], arco, trechos } : null
}

/** Corredores escolhidos e o arco somado deles. */
interface Escolha {
  corredores: CorredorQueEncosta[]
  arco: number
}

const NENHUMA: Escolha = { corredores: [], arco: 0 }

/** Mais corredores ganha; no empate, o menor arco somado (o par mais estreito); empate total, a primeira. */
function melhorEscolha(a: Escolha, b: Escolha): Escolha {
  if (a.corredores.length !== b.corredores.length) return a.corredores.length > b.corredores.length ? a : b
  return b.arco < a.arco ? b : a
}

function somando(escolha: Escolha, corredor: CorredorQueEncosta): Escolha {
  return { corredores: [...escolha.corredores, corredor], arco: escolha.arco + corredor.arco }
}

/** A melhor escolha entre as ligações `de..ate` de uma fila. Vizinhas dividem uma linha
 *  e nunca entram as duas: cada linha é de um corredor só. */
function escolherNaFila(ligacoes: readonly (CorredorQueEncosta | null)[], de: number, ate: number): Escolha {
  let semAVizinha = NENHUMA
  let ateAqui = NENHUMA
  for (let k = de; k <= ate; k += 1) {
    const ligacao = ligacoes[k]
    const comEsta = ligacao === null ? ateAqui : melhorEscolha(ateAqui, somando(semAVizinha, ligacao))
    semAVizinha = ateAqui
    ateAqui = comEsta
  }
  return ateAqui
}

/**
 * As linhas em volta da Sala formam um ciclo (em ordem de perímetro), e a
 * ligação k une a linha k à k+1. Só vizinhas se emparelham, e uma linha pode
 * ficar sem par: a divisória solta encostada entre dois corredores não estraga
 * os dois. A última ligação fecha o ciclo: ou fica de fora, ou entra e tira as
 * duas vizinhas dela.
 */
function escolherNoCiclo(ligacoes: readonly (CorredorQueEncosta | null)[]): CorredorQueEncosta[] {
  const n = ligacoes.length
  if (n < 2) return []
  const semAUltima = escolherNaFila(ligacoes, 0, n - 2)
  const ultima = ligacoes[n - 1]
  if (ultima === null) return semAUltima.corredores
  return melhorEscolha(semAUltima, somando(escolherNaFila(ligacoes, 1, n - 3), ultima)).corredores
}

/** Todos os corredores que encostam na Sala, já abertos ou não. */
function corredoresQueEncostam(map: MapData, sala: Region): CorredorQueEncosta[] {
  const borda = bordaDa(sala)
  const folga = ENCOSTE_TOLERANCIA_CELULAS * map.grid
  const piso = pisoDe(sala)
  const encostes = map.walls
    .filter((w) => w.regionId === undefined && pisoDe(w) === piso)
    .flatMap((w) => {
      const encoste = encosteDa(w, borda, folga)
      return encoste === null ? [] : [encoste]
    })
    .sort((a, b) => a.s - b.s)
  if (encostes.length < 2) return []
  return escolherNoCiclo(encostes.map((e, k) => formamCorredor(e, encostes[(k + 1) % encostes.length], borda, map.grid)))
}

// ─── O que ainda falta fazer ────────────────────────────────────────────────

/** Alguma parede da própria Sala cobre o trecho? Os pedaços de uma aresta guardam o
 *  `regionEdgeIndex` dela (types/map.ts), então basta medir cada um ao longo do trecho. */
function trechoTemParedeDaSala(walls: readonly Wall[], salaId: string, trecho: TrechoDaBorda): boolean {
  const eixo = unitario(menos(trecho.ate, trecho.de))
  const comprimento = distancia(trecho.de, trecho.ate)
  const aoLongo = (x: number, y: number) => escalar(menos({ x, y }, trecho.de), eixo)
  return walls.some((w) => {
    if (w.regionId !== salaId || w.regionEdgeIndex !== trecho.aresta) return false
    const a = aoLongo(w.x1, w.y1)
    const b = aoLongo(w.x2, w.y2)
    return Math.min(Math.max(a, b), comprimento) - Math.max(Math.min(a, b), 0) >= TRECHO_MINIMO
  })
}

function colada(x: number, y: number, p: Ponto): boolean {
  return Math.hypot(x - p.x, y - p.y) <= PONTA_COLADA
}

/** Parede solta, do piso da Sala, inteira dentro do chão dela. O meio fora da borda:
 *  parede sobre o contorno é divisa, não sobra de traço. */
function soltaDeDentro(w: Wall, sala: Region): boolean {
  if (w.regionId !== undefined || pisoDe(w) !== pisoDe(sala)) return false
  const meio = { x: (w.x1 + w.x2) / 2, y: (w.y1 + w.y2) / 2 }
  return (
    pointInPolygonInclusive({ x: w.x1, y: w.y1 }, sala.points) &&
    pointInPolygonInclusive({ x: w.x2, y: w.y2 }, sala.points) &&
    lugarDe(meio, sala.points) === 'dentro'
  )
}

/**
 * O "L" que a linha fazia dentro do chão: paredes soltas inteiras dentro da
 * Sala, emendadas ponta com ponta a partir de `inicio` (a parede livre em
 * polilinha). Para na bifurcação: duas paredes saindo da mesma ponta já são
 * construção de dentro da Sala, não sobra do traço. `usadas` é dividido entre
 * as linhas para nenhuma parede entrar duas vezes.
 */
function correnteDeDentro(map: MapData, sala: Region, inicio: Ponto | null, usadas: Set<string>): Wall[] {
  const corrente: Wall[] = []
  let ponta = inicio
  while (ponta !== null) {
    const aqui = ponta
    const ligadas = map.walls.filter((w) => (colada(w.x1, w.y1, aqui) || colada(w.x2, w.y2, aqui)) && !usadas.has(w.id) && soltaDeDentro(w, sala))
    if (ligadas.length !== 1) break
    const parede = ligadas[0]
    usadas.add(parede.id)
    corrente.push(parede)
    ponta = colada(parede.x1, parede.y1, aqui) ? { x: parede.x2, y: parede.y2 } : { x: parede.x1, y: parede.y1 }
  }
  return corrente
}

/**
 * O corredor ainda tem o que fazer: linha para trazer até a borda, "L" para
 * apagar, ou parede da própria Sala no vão. Corredor já aberto não conta: é o
 * que faz o botão sumir depois do clique, e o segundo clique não gravar um
 * passo vazio no histórico.
 */
function temTrabalho(map: MapData, sala: Region, corredor: CorredorQueEncosta): boolean {
  if (corredor.linhas.some((l) => l.ponta !== null)) return true
  if (corredor.trechos.some((t) => trechoTemParedeDaSala(map.walls, sala.id, t))) return true
  return corredor.linhas.some((l) => correnteDeDentro(map, sala, l.inicioDaCorrente, new Set()).length > 0)
}

function salaDe(map: MapData, salaId: string): Region | undefined {
  return map.regions.find((r) => r.id === salaId && r.room !== undefined && r.points.length >= 3)
}

/**
 * Os corredores que o botão "Abrir para o corredor" ainda abre nesta Sala —
 * a contagem é de CORREDORES (par de linhas), não de paredes. Inclui os que a
 * Sala travada ou secreta recusaria: o botão aparece desabilitado com o motivo
 * (`bloqueioDaSala`). Sala inexistente: lista vazia.
 */
export function corredoresDaSala(map: MapData, salaId: string): CorredorQueEncosta[] {
  const sala = salaDe(map, salaId)
  if (sala === undefined) return []
  return corredoresQueEncostam(map, sala).filter((c) => temTrabalho(map, sala, c))
}

/**
 * Por que a Sala não abre, ou `null`. Sala secreta, ou dentro de sala secreta
 * ou oculta: o vão furaria o disfarce (`disguisedSecretBorderWalls`,
 * fogFilter.ts) e entregaria o esconderijo ao jogador. Sala travada, ela ou a
 * camada: não muda por gesto nenhum.
 */
export function bloqueioDaSala(map: MapData, sala: Region): 'secreta' | 'travada' | null {
  if (sala.secret === true || ancestorsOf(map.regions, sala.id).some((a) => a.secret === true || a.hidden === true)) return 'secreta'
  if (!canInteractInLayer(sala, regionLayer(sala), map.lockedLayers)) return 'travada'
  return null
}

// ─── Abrir ──────────────────────────────────────────────────────────────────

/** O que muda nas linhas: as pontas trazidas até a borda, as paredes do "L" a apagar,
 *  e as paredes originais que vão mudar (para checar trava e porta antes). */
interface MudancaNasLinhas {
  novas: Map<string, Wall>
  apagadas: Wall[]
  mexidas: Wall[]
}

function comPontaEm(parede: Wall, ponta: 1 | 2, p: Ponto): Wall {
  return ponta === 1 ? { ...parede, x1: p.x, y1: p.y } : { ...parede, x2: p.x, y2: p.y }
}

function mudancaNasLinhas(map: MapData, sala: Region, corredores: readonly CorredorQueEncosta[]): MudancaNasLinhas {
  const porId = new Map(map.walls.map((w) => [w.id, w]))
  const usadas = new Set<string>()
  const novas = new Map<string, Wall>()
  const apagadas: Wall[] = []
  const mexidas: Wall[] = []
  for (const linha of corredores.flatMap((c) => c.linhas)) {
    const parede = porId.get(linha.paredeId)
    if (parede !== undefined && linha.ponta !== null) {
      novas.set(parede.id, comPontaEm(parede, linha.ponta, linha.ponto))
      mexidas.push(parede)
    }
    const corrente = correnteDeDentro(map, sala, linha.inicioDaCorrente, usadas)
    apagadas.push(...corrente)
    mexidas.push(...corrente)
  }
  return { novas, apagadas, mexidas }
}

/** Trava (da parede ou da camada) vale para gesto nenhum; porta não some em silêncio:
 *  quem decide tirar a porta é o mestre. */
function impedimentoDe(map: MapData, paredes: readonly Wall[]): Impedimento | null {
  if (paredes.some((w) => !canInteractInLayer(w, wallLayer(w), map.lockedLayers))) return 'travada'
  return paredes.some((w) => w.door !== null) ? 'porta' : null
}

/** As paredes de `antes` que o corte trocou por pedaços, ou tirou inteiras. */
function paredesTiradas(antes: MapData, depois: MapData): Wall[] {
  if (antes === depois) return []
  const ficaram = new Set(depois.walls.map((w) => w.id))
  return antes.walls.filter((w) => !ficaram.has(w.id))
}

interface Cortado {
  map: MapData
  salaSecretaPoupada: boolean
  impedimento: Impedimento | null
}

/**
 * Abre os trechos um depois do outro, cada um no mapa já cortado pelo
 * anterior. Trecho sem parede da própria Sala já está aberto e fica como está:
 * não é este botão que derruba a parede do vizinho. É isso que protege a sala
 * secreta no segundo clique, porque `abrirTrecho` só poupa a parede dela
 * quando há um lado visível para cortar.
 */
function cortarTrechos(map: MapData, salaId: string, trechos: readonly TrechoDaBorda[]): Cortado {
  let atual = map
  let salaSecretaPoupada = false
  for (const trecho of trechos) {
    if (!trechoTemParedeDaSala(atual.walls, salaId, trecho)) continue
    const corte = abrirTrecho(atual, trecho.de, trecho.ate)
    if (corte.travadaNoCaminho) return { map, salaSecretaPoupada: false, impedimento: 'travada' }
    if (paredesTiradas(atual, corte.map).some((w) => w.door !== null)) return { map, salaSecretaPoupada: false, impedimento: 'porta' }
    salaSecretaPoupada = salaSecretaPoupada || corte.salaSecretaPoupada
    atual = corte.map
  }
  return { map: atual, salaSecretaPoupada, impedimento: null }
}

function recusa(map: MapData, motivo: Exclude<MotivoDaAbertura, 'ok'>): AberturaDeCorredor {
  return { map, motivo, corredores: 0, salaSecretaPoupada: false }
}

/**
 * "Abrir para o corredor": abre a Sala para todo corredor que encosta nela.
 * Tudo ou nada: porta no caminho ('porta'), algo travado ('travada'), Sala
 * secreta ('secreta') ou nada a abrir ('nada') devolvem o MESMO mapa, e quem
 * chama não grava histórico. No 'ok', um passo só desfaz tudo.
 */
export function abrirSalaParaCorredores(map: MapData, salaId: string): AberturaDeCorredor {
  const sala = salaDe(map, salaId)
  if (sala === undefined) return recusa(map, 'nada')
  const bloqueio = bloqueioDaSala(map, sala)
  if (bloqueio !== null) return recusa(map, bloqueio)
  const corredores = corredoresDaSala(map, salaId)
  if (corredores.length === 0) return recusa(map, 'nada')
  const linhas = mudancaNasLinhas(map, sala, corredores)
  const impedimento = impedimentoDe(map, linhas.mexidas)
  if (impedimento !== null) return recusa(map, impedimento)
  const cortado = cortarTrechos(map, sala.id, corredores.flatMap((c) => c.trechos))
  if (cortado.impedimento !== null) return recusa(map, cortado.impedimento)
  if (cortado.map === map && linhas.mexidas.length === 0) return recusa(map, 'nada')
  const apagar = new Set(linhas.apagadas.map((w) => w.id))
  const walls = cortado.map.walls.flatMap((w) => (apagar.has(w.id) ? [] : [linhas.novas.get(w.id) ?? w]))
  return { map: { ...cortado.map, walls }, motivo: 'ok', corredores: corredores.length, salaSecretaPoupada: cortado.salaSecretaPoupada }
}
