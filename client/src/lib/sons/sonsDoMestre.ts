import { useDiceStore } from '../../stores/diceStore'
import type { TravelLogEntry } from '../travelLog'
import { destravarAudioNoPrimeiroGesto } from './contexto'
import type { SomId } from './receitas'
import { tocarSom } from './tocarSom'

/**
 * SONS DO MESTRE: no app do mestre só toca evento de JOGO, nunca edição. O
 * dado rolado na sala (de jogador ou dele) e a ficha que troca de cena na
 * sessão. Abrir outra cena, seguir um pino ou ir a um ponto pelo editor é o
 * mestre olhando o mapa: não toca nada, mesmo quando ele passa por um pino de
 * viagem do editor (`handleTravelPin`), porque ali nenhuma ficha se moveu.
 *
 * O primeiro gesto no app cria e destrava o áudio. O bipe de chamado
 * (`lib/signalSound.ts`) toca nesse mesmo contexto.
 */

interface ComId {
  readonly id: string
}

/** O pedaço da lista de rolagens que os sons escutam: a assinatura da store (`diceStore`). */
export interface FonteDeRolagens {
  subscribe(ouvinte: (estado: { readonly rolls: readonly ComId[] }, anterior: { readonly rolls: readonly ComId[] }) => void): () => void
}

export interface OpcoesDosSonsDoMestre {
  /** Quem toca. Padrão: `tocarSom`, que respeita mudo e volume e não toca antes do primeiro gesto. */
  tocar?: (id: SomId) => unknown
  /** Onde escutar o primeiro gesto que destrava o áudio. Padrão: a janela. */
  alvoDoGesto?: EventTarget
  destravar?: (alvo: EventTarget) => () => void
  /** As rolagens da mesa. Padrão: `useDiceStore`, que a ponte enche a cada rolagem. */
  dados?: FonteDeRolagens
}

/** Rolagem nova: um id que a lista não tinha. Limpar a lista (sala fechada) não é rolagem. */
function temRolagemNova(antes: readonly ComId[], depois: readonly ComId[]): boolean {
  if (antes === depois) return false
  const vistas = new Set(antes.map((rolagem) => rolagem.id))
  return depois.some((rolagem) => !vistas.has(rolagem.id))
}

/**
 * Viagem nova: a linha de cima do diário não estava nele. A viagem entra em
 * cima (`addTravel`); o "Desfazer" só tira linha, e abrir ou fechar a sala
 * zera o diário.
 */
function temViagemNova(antes: readonly ComId[], depois: readonly ComId[]): boolean {
  const deCima = depois[0]
  return deCima !== undefined && !antes.some((linha) => linha.id === deCima.id)
}

/**
 * Os dois ganchos rodam DENTRO do fluxo da ponte: a rolagem, dentro do `set`
 * da store (um erro aqui calaria quem assina depois, como a lista na tela); a
 * viagem, no meio da travessia, antes de o jogador receber a cena nova. Som é
 * enfeite: falhar não pode cortar nenhum dos dois.
 */
function tocarSemQuebrar(tocar: (id: SomId) => unknown, id: SomId): void {
  try {
    tocar(id)
  } catch {
    // Sem som desta vez; o jogo segue.
  }
}

/** Liga o dado e o destravamento do áudio; devolve a função que desliga os dois. */
export function instalarSonsDoMestre({
  tocar = tocarSom,
  alvoDoGesto = window,
  destravar = destravarAudioNoPrimeiroGesto,
  dados = useDiceStore,
}: OpcoesDosSonsDoMestre = {}): () => void {
  const pararDeOuvir = dados.subscribe((estado, anterior) => {
    if (temRolagemNova(anterior.rolls, estado.rolls)) tocarSemQuebrar(tocar, 'dado')
  })
  const pararDeDestravar = destravar(alvoDoGesto)
  return () => {
    pararDeOuvir()
    pararDeDestravar()
  }
}

/**
 * Embrulha quem recebe o diário de viagens (`onTravelLogChange` da ponte):
 * cada linha nova é uma ficha que trocou de cena na sessão — pelo pino, pelo
 * "Deixar ir", pelo "Mandar para…" —, e toca a passagem, como no jogador.
 * O diário chega à tela antes do som.
 */
export function comSomDePassagem(aoMudar: (diario: TravelLogEntry[]) => void, tocar: (id: SomId) => unknown = tocarSom): (diario: TravelLogEntry[]) => void {
  let anterior: readonly TravelLogEntry[] = []
  return (diario) => {
    const antes = anterior
    anterior = diario
    aoMudar(diario)
    if (temViagemNova(antes, diario)) tocarSemQuebrar(tocar, 'passagem')
  }
}
