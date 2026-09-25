import type { Pin, Stair } from '../types/map'
import { PIN_ICON_LABELS, isPinIcon } from '../lib/pins'
import { stairTravelLabel } from '../lib/stairTravel'

/**
 * DOIS PINOS NO MESMO PONTO: o que o toque curto do jogador faz com os pinos
 * que achou sob o dedo (`findPlayerPinsAt`, já na ordem do mais perto ao mais
 * longe). Um só abre o cartão direto, como sempre; dois ou mais abrem a
 * escolha "Aqui há N coisas".
 */
export type EscolhaDoToque =
  | { tipo: 'nada' }
  | { tipo: 'abrir'; pinId: string }
  | { tipo: 'escolher'; pinIds: string[] }

export function escolhaDoToque(pinIds: readonly string[]): EscolhaDoToque {
  if (pinIds.length === 0) return { tipo: 'nada' }
  if (pinIds.length === 1) return { tipo: 'abrir', pinId: pinIds[0] }
  return { tipo: 'escolher', pinIds: [...pinIds] }
}

/**
 * Título da escolha. Com uma só (a outra saiu do recorte com a lista aberta:
 * a ficha andou, o mestre escondeu), o singular — a lista não fecha sozinha
 * no meio da leitura, e o que sumiu não deixa rastro.
 */
export function tituloDaEscolha(quantas: number): string {
  return quantas === 1 ? 'Aqui há 1 coisa' : `Aqui há ${quantas} coisas`
}

/** Linha da escolha cabe numa pílula no celular em pé: 40 caracteres e reticências. */
const ROTULO_MAX = 40

/**
 * O que cada linha da escolha diz: as primeiras palavras do que o CARTÃO do
 * pino vai mostrar, e nada além. A escada diz o sentido ("Subir"/"Descer"),
 * como o cartão dela — nunca o nome do andar, que nem chega ao recorte. Sem
 * texto do mestre, o símbolo que o jogador vê na cabeça ou o tipo do pino.
 */
export function rotuloNaEscolha(pin: Pin, stairs: readonly Stair[]): string {
  if (pin.kind === 'viagem' && pin.escadaId !== undefined) {
    const escada = stairs.find((s) => s.id === pin.escadaId)
    if (escada !== undefined) return stairTravelLabel(escada.direction)
  }
  const primeiraLinha = pin.description.trim().split('\n')[0].trim()
  if (primeiraLinha !== '') return cortarEmPalavra(primeiraLinha)
  if (pin.kind === 'viagem') return 'Passagem'
  if (pin.kind === 'alavanca') return 'Alavanca'
  if (isPinIcon(pin.icon)) return PIN_ICON_LABELS[pin.icon]
  return 'Ponto de interesse'
}

/** Corta no último espaço antes do limite, para não partir palavra; sem espaço, corta seco. */
function cortarEmPalavra(texto: string): string {
  if (texto.length <= ROTULO_MAX) return texto
  const corte = texto.slice(0, ROTULO_MAX)
  const ultimoEspaco = corte.lastIndexOf(' ')
  const inteiro = ultimoEspaco > 0 ? corte.slice(0, ultimoEspaco) : corte
  // Sem vírgula ou ponto pendurado antes das reticências.
  return `${inteiro.replace(/[\s,.;:]+$/, '')}…`
}
