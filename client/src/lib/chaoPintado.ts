import type { Drawing, PinceladaDeTextura, Region, RegionPoint } from '../types/map'
import { dentroDoPoligono, formaDoBalde, type RecorteDoBalde } from './baldeDeTextura'
import type { Caixa } from './texturas'

/**
 * O CHÃO PINTADO NUM PONTO (CONTRATO.md 11.11, a borda do penhasco do
 * continente no Desenhado): o id da textura que a ferramenta Texturas deixou
 * por cima naquele ponto, ou `null` (nada pintado, a borracha passou, ou uma
 * sala foi posta por cima). É o "chão do lado alto" que escolhe a linha de
 * cima da borda: grama, terra ou neve; `null` = a primeira (a grama).
 *
 * Os passos valem na ordem, o de depois por cima (como `pixi/texturasRaster.ts`
 * pinta): a resposta é a do ÚLTIMO passo que cobre o ponto. A força não conta:
 * a pincelada fraca ainda é o chão que o mestre escolheu ali.
 *
 * Puro: sem DOM nem Pixi. Cada tela pergunta com os passos que ELA recebeu.
 */

export type ConsultaDoChao = (p: RegionPoint) => string | null

interface Passo {
  readonly caixa: Caixa
  readonly cobre: (p: RegionPoint) => boolean
  /**
   * O passo cobre o ponto como CHÃO: o mesmo `cobre`, menos os recortes do
   * Balde. O traço desenhado por cima da tinta (a estrada a Pincel na grama)
   * esconde a textura, mas não abre buraco no chão; o recorte de área é
   * desenho cheio, que já é chão (`formasDeChao`).
   */
  readonly cobreOChao: (p: RegionPoint) => boolean
  /** O que fica no ponto quando este passo o cobre (`null` = a borracha, a sala). */
  readonly textura: string | null
}

const NADA: ConsultaDoChao = () => null

/** Os passos que ainda têm forma, na ordem em que foram dados. */
function passosDe(passos: readonly PinceladaDeTextura[], regioes: readonly Region[], desenhos: readonly Drawing[]): Passo[] {
  const lista: Passo[] = []
  for (const item of passos) {
    const passo = passoDe(item, regioes, desenhos)
    if (passo !== null) lista.push(passo)
  }
  return lista
}

/** O último passo que cobre o ponto responde; `comoChao` pergunta pelo chão (`cobreOChao`), não pela textura à vista. */
function consultaDos(lista: readonly Passo[], comoChao: boolean): ConsultaDoChao {
  return (p) => {
    for (let i = lista.length - 1; i >= 0; i -= 1) {
      const passo = lista[i]
      const { caixa } = passo
      if (p.x < caixa.minX || p.x > caixa.maxX || p.y < caixa.minY || p.y > caixa.maxY) continue
      if (comoChao ? passo.cobreOChao(p) : passo.cobre(p)) return passo.textura
    }
    return null
  }
}

/** A consulta dos passos (`MapData.texturas`); sem passos, sempre `null`. */
export function consultaDoChaoPintado(
  passos: readonly PinceladaDeTextura[] | undefined,
  regioes: readonly Region[],
  desenhos: readonly Drawing[],
): ConsultaDoChao {
  if (passos === undefined || passos.length === 0) return NADA
  const lista = passosDe(passos, regioes, desenhos)
  return lista.length === 0 ? NADA : consultaDos(lista, false)
}

/** O chão pintado como sim ou não, com a caixa de toda a tinta posta (fora dela não há tinta). */
export interface TintaDoChao {
  readonly tem: (p: RegionPoint) => boolean
  readonly caixa: Caixa
}

/**
 * A MESMA regra da consulta, como sim ou não (levantamento de 25/11/2026, Nº
 * 25: o terreno alto lia a tinta de outro jeito, somando a força e com
 * "Conta como Chão" desligado): os passos na ordem, o último vale e a força
 * não conta. Só o traço por cima da tinta não fura o chão (`cobreOChao`).
 * `null` = nenhum passo deixa textura.
 */
export function tintaDoChao(passos: readonly PinceladaDeTextura[] | undefined, regioes: readonly Region[], desenhos: readonly Drawing[]): TintaDoChao | null {
  if (passos === undefined || passos.length === 0) return null
  const lista = passosDe(passos, regioes, desenhos)
  const poem = lista.filter((passo) => passo.textura !== null)
  if (poem.length === 0) return null
  const consulta = consultaDos(lista, true)
  return { tem: (p) => consulta(p) !== null, caixa: poem.map((passo) => passo.caixa).reduce(juntaCaixas) }
}

/**
 * As células de `lado` px (alinhadas à origem do mundo, como os blocos do
 * Chão) cujo CENTRO tem chão pintado pela regra de `tintaDoChao`. Cada passo só
 * olha as células da caixa dele dentro da `area` (o mapa: coordenada torta
 * do arquivo não vira um laço sem fim), na ordem: o de depois vale por cima.
 * É a tinta posta em blocos, para quem pensa o chão em peças ("Fora do
 * Chão", `lib/offFloor.ts`). Sem tinta, nenhuma.
 */
export function celulasDoChaoPintado(
  passos: readonly PinceladaDeTextura[],
  regioes: readonly Region[],
  desenhos: readonly Drawing[],
  lado: number,
  area: Caixa,
): { col: number; row: number }[] {
  if (passos.length === 0 || !(Number.isFinite(lado) && lado > 0)) return []
  const celulas = new Map<string, { col: number; row: number; tem: boolean }>()
  for (const passo of passosDe(passos, regioes, desenhos)) {
    const { cobreOChao, textura } = passo
    const caixa = { minX: Math.max(passo.caixa.minX, area.minX), minY: Math.max(passo.caixa.minY, area.minY), maxX: Math.min(passo.caixa.maxX, area.maxX), maxY: Math.min(passo.caixa.maxY, area.maxY) }
    for (let col = Math.ceil(caixa.minX / lado - 0.5); (col + 0.5) * lado <= caixa.maxX; col += 1) {
      for (let row = Math.ceil(caixa.minY / lado - 0.5); (row + 0.5) * lado <= caixa.maxY; row += 1) {
        if (cobreOChao({ x: (col + 0.5) * lado, y: (row + 0.5) * lado })) celulas.set(`${col},${row}`, { col, row, tem: textura !== null })
      }
    }
  }
  return [...celulas.values()].filter((c) => c.tem).map(({ col, row }) => ({ col, row }))
}

/** Uma forma cheia que é chão, com o piso dela. */
export interface FormaDeChao {
  readonly pontos: readonly RegionPoint[]
  readonly piso: number | undefined
}

function finito(p: RegionPoint): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y)
}

/** Sala (com ou sem fundo) ou região comum com fundo; a que o mestre esconde ("Esconder") não. */
function regiaoDeChao(r: Region): boolean {
  return r.hidden !== true && (r.room !== undefined || r.filled !== false) && r.points.length >= 3 && r.points.every(finito)
}

const SEM_REGIOES: readonly Region[] = []

/** O contorno do desenho cheio: a forma do Balde com o desenho sozinho (quem está por cima não tira chão). */
function contornoDoDesenhoCheio(d: Drawing): RegionPoint[] | null {
  return formaDoBalde({ tipo: 'desenho', id: d.id }, SEM_REGIOES, [d])?.contorno ?? null
}

const formasGuardadas = new WeakMap<readonly Region[], { desenhos: readonly Drawing[]; formas: FormaDeChao[] }>()

/**
 * AS FORMAS CHEIAS QUE SÃO CHÃO além das peças e da tinta (levantamento de
 * 25/11/2026, frente D: uma definição só de chão): Sala, região com fundo e
 * desenho cheio (polígono do Balde do Pincel, forma preenchida; a mesma
 * mancha que o Balde de textura enche). Quem lê: o terreno alto
 * (`lib/terrenoAlto.ts`), o "Fora do Chão: bloqueado" (`lib/offFloor.ts`) e o
 * abrigo da chuva (`lib/abrigoDoAmbiente.ts`). As mesmas listas devolvem a
 * MESMA lista.
 */
export function formasDeChao(regioes: readonly Region[], desenhos: readonly Drawing[]): FormaDeChao[] {
  const guardada = formasGuardadas.get(regioes)
  if (guardada !== undefined && guardada.desenhos === desenhos) return guardada.formas
  const formas: FormaDeChao[] = regioes.filter(regiaoDeChao).map((r) => ({ pontos: r.points, piso: r.piso }))
  for (const d of desenhos) {
    const pontos = contornoDoDesenhoCheio(d)
    if (pontos !== null) formas.push({ pontos, piso: d.piso })
  }
  formasGuardadas.set(regioes, { desenhos, formas })
  return formas
}

function passoDe(item: PinceladaDeTextura, regioes: readonly Region[], desenhos: readonly Drawing[]): Passo | null {
  switch (item.tipo) {
    case 'pincel':
    case 'borracha': {
      if (item.pontos.length === 0 || !(item.raio > 0)) return null
      const { pontos, raio } = item
      const cobre = (p: RegionPoint): boolean => distanciaAoCaminho(p, pontos, false) <= raio
      return { caixa: caixaDe(pontos, raio), cobre, cobreOChao: cobre, textura: item.tipo === 'pincel' ? item.textura : null }
    }
    case 'balde': {
      const forma = formaDoBalde(item.alvo, regioes, desenhos)
      if (forma === null) return null
      const { contorno, recortes } = forma
      const cobreOChao = (p: RegionPoint): boolean => dentroDoPoligono(p, contorno)
      return { caixa: forma.caixa, cobre: (p) => cobreOChao(p) && !recortes.some((r) => recorteCobre(r, p)), cobreOChao, textura: item.textura }
    }
    case 'esvaziar': {
      // O Alt + clique do Balde tira a textura da forma inteira (sem recortes, como a sala).
      const forma = formaDoBalde(item.alvo, regioes, desenhos)
      if (forma === null) return null
      const { contorno } = forma
      const cobre = (p: RegionPoint): boolean => dentroDoPoligono(p, contorno)
      return { caixa: forma.caixa, cobre, cobreOChao: cobre, textura: null }
    }
    case 'sala': {
      const regiao = regioes.find((r) => r.id === item.regiao)
      if (regiao === undefined || regiao.points.length < 3) return null
      const pontos = regiao.points
      const cobre = (p: RegionPoint): boolean => dentroDoPoligono(p, pontos)
      return { caixa: caixaDe(pontos, 0), cobre, cobreOChao: cobre, textura: null }
    }
  }
}

function recorteCobre(r: RecorteDoBalde, p: RegionPoint): boolean {
  return r.tipo === 'area' ? dentroDoPoligono(p, r.pontos) : distanciaAoCaminho(p, r.pontos, r.fechada) <= r.largura / 2
}

function juntaCaixas(a: Caixa, b: Caixa): Caixa {
  return { minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY) }
}

function caixaDe(pontos: readonly RegionPoint[], folga: number): Caixa {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const q of pontos) {
    minX = Math.min(minX, q.x)
    minY = Math.min(minY, q.y)
    maxX = Math.max(maxX, q.x)
    maxY = Math.max(maxY, q.y)
  }
  return { minX: minX - folga, minY: minY - folga, maxX: maxX + folga, maxY: maxY + folga }
}

/** A menor distância do ponto ao caminho (um ponto só = a distância a ele). */
function distanciaAoCaminho(p: RegionPoint, pontos: readonly RegionPoint[], fechado: boolean): number {
  if (pontos.length === 1) return Math.hypot(p.x - pontos[0].x, p.y - pontos[0].y)
  let menor = Infinity
  const lados = fechado ? pontos.length : pontos.length - 1
  for (let i = 0; i < lados; i += 1) menor = Math.min(menor, distanciaAoSegmento(p, pontos[i], pontos[(i + 1) % pontos.length]))
  return menor
}

function distanciaAoSegmento(p: RegionPoint, a: RegionPoint, b: RegionPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const u = l2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - (a.x + dx * u), p.y - (a.y + dy * u))
}
