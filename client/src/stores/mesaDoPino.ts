import { create } from 'zustand'
import type { FalasDitas, LeiturasDosCenarios } from '../types/cenarioEFalas'
import type { Pin } from '../types/map'
import { useToastStore } from './toastStore'

/**
 * A MESA DO PINO no editor (P4): o que a ficha do "!" e o "Ler junto" do
 * mestre precisam da sala sem passar pelo painel de propriedades. O App
 * conta as leituras (`onLeiturasDosCenariosChange` do host) e põe aqui as
 * ações ligadas ao host (`acoes`); a ficha e a janela do Prelúdio só chamam.
 */

export interface JogadorDaMesa {
  readonly playerId: string
  readonly name: string
}

export interface AcoesDaMesaDoPino {
  /** "Ler agora": quem recebeu; `null` = sala fechada. `playerIds` `null` = todos na cena do pino. */
  lerCenario(pinId: string, playerIds: readonly string[] | null): string[] | null
  /** "Dizer agora" de uma entrada do "?" (P5): quem ouviu; `null` = sala fechada. */
  dizerFala(pinId: string, falaId: string, playerIds: readonly string[] | null): string[] | null
  /** Os jogadores da sala, para escrever o nome de quem lê. */
  jogadores(): readonly JogadorDaMesa[]
}

/** O texto grande que o mestre lê em voz alta junto com a tela dos jogadores. */
export interface LerJunto {
  readonly pinId: string
  readonly nome: string
  readonly texto: string
  /** Quem recebeu, na ordem de entrada na sala. */
  readonly para: readonly string[]
}

interface EstadoDaMesaDoPino {
  leituras: LeiturasDosCenarios
  /** "?" (P5): por pino, por entrada, a quem foi dita nesta sala. */
  ditas: FalasDitas
  acoes: AcoesDaMesaDoPino | null
  lerJunto: LerJunto | null
}

export const useMesaDoPino = create<EstadoDaMesaDoPino>()(() => ({ leituras: {}, ditas: {}, acoes: null, lerJunto: null }))

/** O resultado de um "Ler agora", para quem pediu mostrar ao mestre (a ficha ou a janela do Prelúdio). */
export type FimDoLerAgora = { readonly ok: true; readonly para: readonly string[] } | { readonly ok: false; readonly motivo: string }

const SEM_SALA = 'Abra a sala para ler aos jogadores.'
const NINGUEM = 'Ninguém recebeu: nenhum jogador conectado está na cena deste pino.'

/**
 * "LER AGORA" de um "!": manda a revelação e abre o "Ler junto" do mestre com
 * o mesmo texto. Ninguém recebeu = aviso, nunca silêncio.
 */
export function lerCenarioAgora(pin: Pick<Pin, 'id' | 'nome' | 'description'>, playerIds: readonly string[] | null): FimDoLerAgora {
  const { acoes } = useMesaDoPino.getState()
  const para = acoes === null ? null : acoes.lerCenario(pin.id, playerIds)
  if (para === null || para.length === 0) {
    const motivo = para === null ? SEM_SALA : NINGUEM
    useToastStore.getState().push('info', motivo)
    return { ok: false, motivo }
  }
  useMesaDoPino.setState({ lerJunto: { pinId: pin.id, nome: (pin.nome ?? '').trim(), texto: pin.description, para } })
  return { ok: true, para }
}

const SEM_SALA_PARA_DIZER = 'Abra a sala para dizer aos jogadores.'
const NINGUEM_OUVIU = 'Ninguém ouviu: nenhum jogador conectado está na cena deste pino.'

/** "DIZER AGORA" de uma entrada do "?". Ninguém ouviu = aviso, nunca silêncio. */
export function dizerFalaAgora(pinId: string, falaId: string, playerIds: readonly string[] | null): FimDoLerAgora {
  const { acoes } = useMesaDoPino.getState()
  const para = acoes === null ? null : acoes.dizerFala(pinId, falaId, playerIds)
  if (para === null || para.length === 0) {
    const motivo = para === null ? SEM_SALA_PARA_DIZER : NINGUEM_OUVIU
    useToastStore.getState().push('info', motivo)
    return { ok: false, motivo }
  }
  return { ok: true, para }
}

export function fecharLerJunto(): void {
  if (useMesaDoPino.getState().lerJunto !== null) useMesaDoPino.setState({ lerJunto: null })
}

/** "Ana, Davi e Lia". */
export function nomesDe(ids: readonly string[], jogadores: readonly JogadorDaMesa[]): string {
  const nomes = ids.map((id) => jogadores.find((j) => j.playerId === id)?.name ?? 'um jogador')
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}
