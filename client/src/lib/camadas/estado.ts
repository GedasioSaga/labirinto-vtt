/**
 * O ESTADO DAS CAMADAS NA CENA, mexido pelo painel (fase 3, fatia 6 de
 * `docs/planos/camadas-fase3-2026-10-22.md`): olho "Mestre vê", olho
 * "Jogadores veem", cadeado e opacidade. Funções puras: a store embrulha cada
 * uma no `withHistory`.
 *
 * ONDE MORA CADA COISA (decisão do orquestrador antes da fatia 6): o olho do
 * mestre e o cadeado de TODA camada moram em `hiddenLayers` e `lockedLayers`,
 * alargados para `CamadaId[]` — uma fonte só, sem campo paralelo. Os ids
 * novos (Chão, Desenhos, Terreno, Telhados e as livres) só aparecem em mapa
 * v2: no mapa de antes, Chão e Desenhos seguem Salas e Anotações, e uma
 * entrada deles ali seria muda.
 *
 * A VIRADA (`paraVersao2`): no primeiro uso de um controle novo (olho dos
 * jogadores, opacidade, olho ou cadeado de uma camada nova) o mapa vira v2 e
 * as implicações de antes viram dado explícito, para nada mudar na tela no
 * instante da virada. O olho e o cadeado das 9 camadas de antes, num mapa de
 * antes, seguem o sentido de sempre (o olho some para todos).
 */
import type { CamadaId, LayerId, MapData } from '../../types/map'
import { roomHasRoof } from '../roomOps'
import { isStairPin } from '../stairTravel'
import { contextoDeCamadas, type CamposDeCamadas } from './consulta'
import { ehCamadaDeAntes } from './padrao'

/** Só os campos de camadas que o painel muda. */
type EstadoDasCamadas = CamposDeCamadas

/** No mapa de antes, [quem segue, quem manda]: Chão segue Salas, Desenhos segue Anotações. */
const SEGUE_NO_MAPA_DE_ANTES: readonly (readonly [CamadaId, LayerId])[] = [
  ['chao', 'salas'],
  ['desenhos', 'anotacoes'],
]

/**
 * Uma lista do mapa de antes, escrita como o mapa v2 a lê: a entrada muda de
 * Chão ou Desenhos sai (no mapa de antes ela não valia nada) e entra a que
 * espelha Salas ou Anotações.
 */
function materializar(lista: readonly CamadaId[]): CamadaId[] {
  const seguidoras = new Set(SEGUE_NO_MAPA_DE_ANTES.map(([segue]) => segue))
  const nova = lista.filter((id) => !seguidoras.has(id))
  for (const [segue, manda] of SEGUE_NO_MAPA_DE_ANTES) if (nova.includes(manda)) nova.push(segue)
  return nova
}

/**
 * O mapa v2 equivalente: mesmo resultado de `mestreVe`, `jogadorVe`,
 * `travada` e `alfa` em toda camada. Idempotente: mapa já v2 volta o MESMO
 * objeto (a store não grava passo vazio).
 */
export function paraVersao2<T extends EstadoDasCamadas>(map: T): T {
  if (map.versaoDasCamadas === 2) return map
  return {
    ...map,
    hiddenLayers: materializar(map.hiddenLayers),
    lockedLayers: materializar(map.lockedLayers),
    // Ausente = igual à do mestre (a "oculta" de antes some para todos).
    ocultasDoJogador: materializar(map.ocultasDoJogador ?? map.hiddenLayers),
    versaoDasCamadas: 2,
  }
}

function alternar(lista: readonly CamadaId[], id: CamadaId): CamadaId[] {
  return lista.includes(id) ? lista.filter((c) => c !== id) : [...lista, id]
}

/** As 9 de antes, num mapa de antes, ficam no sentido antigo; camada nova só existe no mapa v2. */
function baseParaOlhoOuCadeado<T extends EstadoDasCamadas>(map: T, id: CamadaId): T {
  return map.versaoDasCamadas !== 2 && !ehCamadaDeAntes(id) ? paraVersao2(map) : map
}

/** Olho "Mestre vê". No mapa de antes, nas 9 camadas de antes, some também para os jogadores (como sempre). */
export function alternarOlhoDoMestre<T extends EstadoDasCamadas>(map: T, id: CamadaId): T {
  const base = baseParaOlhoOuCadeado(map, id)
  return { ...base, hiddenLayers: alternar(base.hiddenLayers, id) }
}

/** Cadeado. Mesma regra do olho do mestre para o mapa de antes. */
export function alternarCadeado<T extends EstadoDasCamadas>(map: T, id: CamadaId): T {
  const base = baseParaOlhoOuCadeado(map, id)
  return { ...base, lockedLayers: alternar(base.lockedLayers, id) }
}

/** Olho "Jogadores veem": controle novo, sempre no mapa v2. */
export function alternarOlhoDosJogadores<T extends EstadoDasCamadas>(map: T, id: CamadaId): T {
  const base = paraVersao2(map)
  return { ...base, ocultasDoJogador: alternar(base.ocultasDoJogador ?? base.hiddenLayers, id) }
}

/** O passo do slider: 1%. */
export const PASSO_DA_OPACIDADE = 0.01

/**
 * Opacidade da camada, a mesma para mestre e jogadores: arredondada em 1% e
 * limitada a 0..1; 100% tira a chave (ausente = 1). Valor que não muda nada
 * (ou que não é número) devolve o MESMO mapa: nem passo vazio no Ctrl+Z, nem
 * virada para v2 à toa.
 */
export function definirOpacidade<T extends EstadoDasCamadas>(map: T, id: CamadaId, valor: number): T {
  if (!Number.isFinite(valor)) return map
  // Em centésimos inteiros: 0.4567 vira 0.46 sem resto de ponto flutuante.
  const arredondado = Math.round(Math.min(1, Math.max(0, valor)) / PASSO_DA_OPACIDADE) / (1 / PASSO_DA_OPACIDADE)
  if (arredondado === contextoDeCamadas(map).alfa(id)) return map
  const base = paraVersao2(map)
  const opacidadeDasCamadas: Partial<Record<CamadaId, number>> = { ...base.opacidadeDasCamadas }
  if (arredondado === 1) delete opacidadeDasCamadas[id]
  else opacidadeDasCamadas[id] = arredondado
  return { ...base, opacidadeDasCamadas }
}

/**
 * Quantos itens cada camada tem, pelo ponto único (`camadaDe`): a escolhida
 * do item ou a padrão do tipo. Conta TODOS, visíveis ou não (a contagem não
 * muda ao ocultar a própria camada). Terreno conta carimbos e pinceladas de
 * textura; Telhados, as salas com teto; o pino da escada não conta (a escada
 * já conta). Linhas e marcadores do chão ficam de fora, como antes.
 */
export function contarItensPorCamada(map: MapData): Partial<Record<CamadaId, number>> {
  const camadas = contextoDeCamadas(map)
  const contas: Partial<Record<CamadaId, number>> = {}
  const somar = (id: CamadaId): void => {
    contas[id] = (contas[id] ?? 0) + 1
  }
  for (const item of map.walls) somar(camadas.camadaDe('parede', item))
  for (const item of map.regions) {
    somar(camadas.camadaDe('regiao', item))
    if (roomHasRoof(item.room)) somar(camadas.camadaDe('telhado', item))
  }
  for (const item of map.stairs) somar(camadas.camadaDe('escada', item))
  for (const item of map.lights) somar(camadas.camadaDe('luz', item))
  for (const item of map.tokens) somar(camadas.camadaDe('ficha', item))
  for (const item of map.drawings) somar(camadas.camadaDe('desenho', item))
  for (const item of map.props) somar(camadas.camadaDe('objeto', item))
  for (const item of map.pins) if (!isStairPin(item)) somar(camadas.camadaDe('pino', item))
  for (const item of map.floor) somar(camadas.camadaDe('peca', item))
  for (const item of map.carimbos ?? []) somar(camadas.camadaDe('carimbo', item))
  for (let i = 0; i < (map.texturas?.length ?? 0); i += 1) somar('terreno')
  return contas
}
