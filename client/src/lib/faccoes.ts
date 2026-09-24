import type { MapData, NivelAlerta, Region, RegionPoint } from '../types/map'
import { visibleRegions } from './layers'

/**
 * FACÇÃO POR TERRITÓRIO E NÍVEL DE ALERTA — regra pura, sem Pixi nem store.
 *
 * Cada Sala pode dizer quem manda nela (`RoomMeta.faccao`). Distrito é a Sala
 * de fora: a sala sem facção dentro dele (`Region.parentId`) herda a dele. O
 * filtro "Quem manda aqui" do editor pinta cada território com a cor da
 * facção. O alerta (`MapData.alerta`) é da cena inteira.
 *
 * Tudo aqui é do MESTRE: `lib/fogFilter.ts` tira a facção e o alerta do
 * recorte de todo jogador.
 */

/** Teto do nome da facção: é rótulo de legenda, não descrição. */
export const FACCAO_MAX_LENGTH = 40

export const NIVEIS_ALERTA: readonly NivelAlerta[] = ['calmo', 'atento', 'cacada']

export const ROTULO_ALERTA: Readonly<Record<NivelAlerta, string>> = {
  calmo: 'Calmo',
  atento: 'Atento',
  cacada: 'Caçada',
}

/**
 * Cores do filtro, chapadas e translúcidas por cima do chão (estilo minimapa:
 * sem textura, sem contorno próprio). Distintas entre si e da cor do perigo.
 */
const PALETA_FACCOES: readonly number[] = [0xc0504d, 0x4f81bd, 0x9bbb59, 0xf2c14e, 0x8064a2, 0x4bacc6, 0xf79646, 0xd67ab1]

/** Transparência da cor da facção: o chão e a parede fina continuam legíveis por baixo. */
export const FACCAO_FILL_ALPHA = 0.3

/** O alerta da cena; mapa sem o campo está calmo. */
export function alertaDaCena(map: MapData): NivelAlerta {
  return map.alerta ?? 'calmo'
}

function ehNivelAlerta(valor: unknown): valor is NivelAlerta {
  return valor === 'calmo' || valor === 'atento' || valor === 'cacada'
}

/** Alerta lido do disco: só um dos três níveis volta; o resto sai. */
export function lerAlerta(raw: unknown): NivelAlerta | undefined {
  return ehNivelAlerta(raw) ? raw : undefined
}

/** Corta no teto sem mexer em espaço: é o que o campo guarda enquanto o mestre digita. */
export function limitarFaccao(texto: string): string {
  return texto.slice(0, FACCAO_MAX_LENGTH)
}

/** O nome da facção como vale para comparar e mostrar: aparado e no teto. Vazio = ninguém manda. */
export function normalizarFaccao(texto: string): string | undefined {
  const aparado = texto.trim().slice(0, FACCAO_MAX_LENGTH)
  return aparado === '' ? undefined : aparado
}

/** Facção lida do disco: só texto que não é vazio volta, já no teto. */
export function lerFaccao(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || raw.trim() === '') return undefined
  return limitarFaccao(raw)
}

export interface FaccaoDaSala {
  faccao: string
  /** A sala não tem facção própria: vale a do distrito (sala de fora). */
  herdada: boolean
}

/**
 * Quem manda na sala `regionId`: a facção dela, ou a da primeira sala de fora
 * que tiver uma. Região comum, id inexistente ou ninguém na cadeia: `null`.
 * Ciclo de `parentId` (arquivo editado à mão) para em vez de travar.
 */
export function faccaoDaSala(regions: readonly Region[], regionId: string): FaccaoDaSala | null {
  return donoNaCadeia(indexarRegioes(regions), regionId)
}

/** A facção que a sala recebe do distrito quando não tem a própria; `undefined` se tem a própria ou ninguém manda. */
export function faccaoHerdada(regions: readonly Region[], regionId: string): string | undefined {
  const dono = faccaoDaSala(regions, regionId)
  return dono !== null && dono.herdada ? dono.faccao : undefined
}

type RegioesPorId = ReadonlyMap<string, Region>

function indexarRegioes(regions: readonly Region[]): RegioesPorId {
  return new Map(regions.map((r) => [r.id, r]))
}

/** `faccaoDaSala` com o índice já montado: o filtro pergunta por toda sala do andar de uma vez. */
function donoNaCadeia(porId: RegioesPorId, regionId: string): FaccaoDaSala | null {
  const inicio = porId.get(regionId)
  if (inicio?.room === undefined) return null
  const vistas = new Set<string>()
  let atual: Region | undefined = inicio
  while (atual !== undefined && !vistas.has(atual.id)) {
    vistas.add(atual.id)
    const propria = atual.room === undefined || atual.room.faccao === undefined ? undefined : normalizarFaccao(atual.room.faccao)
    if (propria !== undefined) return { faccao: propria, herdada: atual !== inicio }
    atual = atual.parentId === undefined ? undefined : porId.get(atual.parentId)
  }
  return null
}

export interface LegendaFaccao {
  faccao: string
  cor: number
  /** Quantas salas ela manda, contando as que herdam do distrito. */
  salas: number
}

/**
 * Uma entrada por facção do mapa, em ordem alfabética, cada uma com a sua cor
 * da paleta. A cor sai da posição na ordem: duas facções do mesmo mapa nunca
 * dividem cor (até a paleta dar a volta).
 */
export function coresDasFaccoes(regions: readonly Region[]): LegendaFaccao[] {
  const porId = indexarRegioes(regions)
  const contagem = new Map<string, number>()
  for (const region of regions) {
    const dono = donoNaCadeia(porId, region.id)
    if (dono !== null) contagem.set(dono.faccao, (contagem.get(dono.faccao) ?? 0) + 1)
  }
  return [...contagem.keys()]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map((faccao, indice) => ({ faccao, cor: PALETA_FACCOES[indice % PALETA_FACCOES.length], salas: contagem.get(faccao) ?? 0 }))
}

/** A cor da paleta como o CSS a lê (`#rrggbb`), para a amostra da legenda. */
export function corCss(cor: number): string {
  return `#${cor.toString(16).padStart(6, '0')}`
}

export interface PinturaFaccao {
  regionId: string
  faccao: string
  cor: number
  points: RegionPoint[]
}

/**
 * O que o filtro "Quem manda aqui" pinta: cada Sala visível no editor que tem
 * dono. A sala que herda do distrito visível já está coberta pela cor dele e
 * não é pintada de novo (a cor dobraria); a que tem facção DIFERENTE da do
 * distrito ganha a sua por cima. Camada Salas escondida ou sala oculta no
 * editor não pinta.
 */
export function pinturaDeFaccoes(map: Pick<MapData, 'regions' | 'hiddenLayers'>): PinturaFaccao[] {
  const salas = visibleRegions(map.regions, map.hiddenLayers).filter((r) => r.room !== undefined && !r.hidden)
  const visiveis = new Set(salas.map((r) => r.id))
  const porId = indexarRegioes(map.regions)
  const cores = new Map(coresDasFaccoes(map.regions).map((l) => [l.faccao, l.cor]))
  const pintura: PinturaFaccao[] = []
  for (const sala of salas) {
    const dono = donoNaCadeia(porId, sala.id)
    const cor = dono === null ? undefined : cores.get(dono.faccao)
    if (dono === null || cor === undefined) continue
    const distrito = sala.parentId
    if (distrito !== undefined && visiveis.has(distrito) && donoNaCadeia(porId, distrito)?.faccao === dono.faccao) continue
    pintura.push({ regionId: sala.id, faccao: dono.faccao, cor, points: sala.points })
  }
  return pintura
}
