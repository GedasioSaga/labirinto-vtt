import type { Point } from '../pixi/world'
import type { Casa } from '../lib/batalha/blocos'
import { DIRECOES_EM_ORDEM, type Direcao8 } from '../lib/batalha/medicao'
import { CONE_MAXIMO, RAIO_MAXIMO, type MedidaCompartilhada } from '../lib/batalha/ferramentasDoJogador'

/**
 * COMPARTILHAR COM O MESTRE (B6, pedido de 28/10/2026): a medida ao vivo do
 * jogador (régua, círculo, cone, visão) vai ao host, e o host a repassa SÓ à
 * tela do mestre — nunca a outro jogador nem à TV. Um sentido só, jogador →
 * host: não há mensagem de volta, e nada do mestre vaza por aqui.
 *
 * `medida: null` apaga a marca no mestre (interruptor desligado, medida
 * limpa). A queda da conexão apaga pelo host.
 *
 * Entrada do jogador é hostil: este parser confere tipo, campos, números
 * finitos, casas inteiras, direção numa das 8 e os tetos; o host confere o
 * resto contra o mapa (`medidaCabeNoMapa`). Nenhum texto vem do jogador: o
 * mestre monta o rótulo a partir dos números. Este módulo não importa
 * `protocol.ts`, que importa daqui.
 */
export interface MedidaCompartilharMessage {
  type: 'medida.compartilhar'
  medida: MedidaCompartilhada | null
}

/** Intervalo mínimo entre dois envios do jogador: no máximo ~10 por segundo. */
export const MEDIDA_ENVIO_INTERVALO_MS = 100

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function lerPonto(value: unknown): Point | null {
  if (!isRecord(value)) return null
  const { x, y } = value
  return typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

function lerCasa(value: unknown): Casa | null {
  if (!isRecord(value)) return null
  const { col, row } = value
  return typeof col === 'number' && typeof row === 'number' && Number.isInteger(col) && Number.isInteger(row) ? { col, row } : null
}

function lerInteiroAte(value: unknown, minimo: number, maximo: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimo && value <= maximo ? value : null
}

function lerDirecao(value: unknown): Direcao8 | null {
  return DIRECOES_EM_ORDEM.find((d) => d === value) ?? null
}

/** A medida, campo a campo: devolve cópia só com o que se conhece; qualquer campo torto recusa tudo. */
export function lerMedidaCompartilhada(value: unknown): MedidaCompartilhada | null {
  if (!isRecord(value)) return null
  switch (value.ferramenta) {
    case 'regua': {
      const de = lerPonto(value.de)
      const ate = lerPonto(value.ate)
      return de === null || ate === null ? null : { ferramenta: 'regua', de, ate }
    }
    case 'circulo': {
      const centro = lerCasa(value.centro)
      const raio = lerInteiroAte(value.raio, 0, RAIO_MAXIMO)
      return centro === null || raio === null ? null : { ferramenta: 'circulo', centro, raio }
    }
    case 'cone': {
      const origem = lerCasa(value.origem)
      const direcao = lerDirecao(value.direcao)
      const comprimento = lerInteiroAte(value.comprimento, 1, CONE_MAXIMO)
      return origem === null || direcao === null || comprimento === null ? null : { ferramenta: 'cone', origem, direcao, comprimento }
    }
    case 'visao': {
      const de = lerCasa(value.de)
      const para = lerCasa(value.para)
      // `ve` é opcional (cliente antigo não manda); presente, só booleano.
      if (de === null || para === null || (value.ve !== undefined && typeof value.ve !== 'boolean')) return null
      return typeof value.ve === 'boolean' ? { ferramenta: 'visao', de, para, ve: value.ve } : { ferramenta: 'visao', de, para }
    }
    default:
      return null
  }
}

/** A mensagem inteira (objeto já desserializado). `medida` ausente ou torta recusa; `null` explícito apaga. */
export function parseMedidaCompartilhar(value: Record<string, unknown>): MedidaCompartilharMessage | null {
  if (value.type !== 'medida.compartilhar' || !('medida' in value)) return null
  if (value.medida === null) return { type: 'medida.compartilhar', medida: null }
  const medida = lerMedidaCompartilhada(value.medida)
  return medida === null ? null : { type: 'medida.compartilhar', medida }
}
