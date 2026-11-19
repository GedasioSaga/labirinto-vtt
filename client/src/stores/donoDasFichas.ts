import type { MapData } from '../types/map'
import { sincronizarVariacoes } from '../lib/livros/combate'
import type { Personagem } from '../lib/personagem'
import type { PastaAberta } from '../lib/pastasDeMapas'
import type { Equipe } from '../lib/batalha/equipes'
import type { PastaDeFichas } from '../lib/pastasDeFichas'
import { mapaComAsFichas } from '../lib/mochila/espelho'
import { prepararEmissao } from '../net/nuvem/emissor'
import type { AdventureState } from './adventureStore'
import { useToastStore } from './toastStore'

/**
 * O DONO DAS FICHAS do mapa aberto: a PASTA DE MAPAS (`rpg.json`, quando o
 * mapa herda o sistema universal dela) ou a AVENTURA (`adventure.json`). Toda
 * leitura (sistema, personagens, equipes, pastas do mestre, fichas que mandam
 * na mochila) e todo gravador saem daqui, para os dois donos nunca divergirem.
 *
 * Funções puras sobre o estado do `useAdventureStore`; os gravadores recebem o
 * `get`/`set` da store e pedem a gravação certa (`pastaSuja` ou
 * `structureDirty`). Saiu do `adventureStore.ts` sem mudar comportamento.
 */

/** Referência estável: a sessão compara os personagens por referência para não reenviar a ficha. */
const SEM_PERSONAGENS: readonly Personagem[] = []

/** O que decide de onde vêm o sistema e os personagens do mapa aberto. */
export type RpgState = Pick<AdventureState, 'adventure' | 'pasta'>

/** A pasta que manda no RPG do mapa: tem sistema universal e o mapa não pediu o próprio. */
export function pastaQueManda(state: Pick<AdventureState, 'pasta'>): PastaAberta | null {
  const { pasta } = state
  return pasta !== null && !pasta.proprio && pasta.sistemaDeRpg !== undefined ? pasta : null
}

/**
 * PASTAS DE MAPAS: o mapa aberto usa o sistema e os personagens da PASTA
 * ("Usar o da pasta"). A pasta sem sistema universal só organiza: o mapa usa
 * o próprio, e entrar numa pasta não esconde os personagens de ninguém.
 */
export function herdaDaPasta(state: Pick<AdventureState, 'pasta'>): boolean {
  return pastaQueManda(state) !== null
}

/** O id do sistema em uso: o da pasta quando o mapa herda, senão o da aventura (`undefined` = sem sistema, ou mapa solto). */
export function sistemaAtivo(state: RpgState): string | undefined {
  const pasta = pastaQueManda(state)
  if (pasta !== null) return pasta.sistemaDeRpg
  return state.adventure === null ? undefined : state.adventure.sistemaDeRpg
}

/**
 * Os personagens em uso — a ÚNICA leitura da lista para a ficha, a mesa e o
 * jogador: os da pasta quando o mapa herda (a mesma cópia em todos os mapas
 * dela), senão os da aventura. Referência estável enquanto nada muda.
 */
export function personagensAtivos(state: RpgState): readonly Personagem[] {
  const pasta = pastaQueManda(state)
  if (pasta !== null) return pasta.personagens
  return state.adventure?.personagens ?? SEM_PERSONAGENS
}

/**
 * Há onde guardar sistema e personagens: aventura aberta, ou mapa (até solto)
 * que herda da pasta — esse não precisa virar aventura, a pasta guarda por ele.
 */
export function temRpgNoMapa(state: RpgState): boolean {
  return state.adventure !== null || herdaDaPasta(state)
}

/**
 * Quem guarda a lista de personagens ATIVA e como gravá-la: a pasta (pede a
 * gravação da pasta) ou a aventura (pede Salvar). `null` = mapa solto fora de
 * pasta que herda: não há onde guardar.
 */
export function donoDosPersonagens(
  get: () => AdventureState,
  set: (patch: Partial<AdventureState>) => void,
): { lista: readonly Personagem[] | undefined; gravar: (personagens: Personagem[]) => boolean } | null {
  const state = get()
  const pasta = pastaQueManda(state)
  // MUNDO DO LIVRO: toda gravação passa pelas variações — editar o modelo pela ficha do mapa atualiza as variações junto.
  if (pasta !== null) {
    // `false` = não entrou (o Lobby recusaria): quem tem rascunho (a janela da ficha) o mantém.
    const gravar = (personagens: Personagem[]): boolean => {
      const novos = sincronizarVariacoes(personagens)
      // LOBBY (funil 1 do emissor, §5.1): numa pasta publicada a mudança vira ops ANTES de entrar; a que o Lobby recusaria não entra.
      const emissao = prepararEmissao(pasta.pastaId, pasta.personagens, novos)
      if (!emissao.ok) {
        useToastStore.getState().push('error', emissao.motivo)
        return false
      }
      set({ pasta: { ...pasta, personagens: novos }, pastaSuja: true })
      emissao.entregar()
      return true
    }
    return { lista: pasta.personagens, gravar }
  }
  const { adventure } = state
  if (adventure === null) return null
  return {
    lista: adventure.personagens,
    gravar: (personagens) => {
      set({ adventure: { ...adventure, personagens: sincronizarVariacoes(personagens) }, structureDirty: true })
      return true
    },
  }
}

/**
 * MOCHILA NA FICHA (docs/planos/lobby-jogadores-2026-11-05.md §4, fatia A3):
 * as fichas que mandam na mochila e na bolsa dos bonecos — as mesmas de
 * `personagensAtivos`: as da pasta quando o mapa herda; senão as da aventura
 * (aventura sem pasta, mapa em "Configurar só neste mapa") — e só depois da
 * migração, pelo marcador `mochilaMigrada` de quem as guarda (§4.2). `null` =
 * ainda não migrou: a mochila mora no boneco, como antes.
 */
export function fichasDonasDaMochila(state: RpgState): readonly Personagem[] | null {
  const pasta = pastaQueManda(state)
  if (pasta !== null) return pasta.mochilaMigrada === undefined ? null : pasta.personagens
  const { adventure } = state
  if (adventure === null || adventure.mochilaMigrada === undefined) return null
  return adventure.personagens ?? SEM_PERSONAGENS
}

/** O espelho das fichas para o mapa que ENTRA (abrir, cena que chega do disco, troca de cena): a ficha vence o boneco. Sem fichas donas, o mapa como veio. */
export function espelhoDasFichas(state: RpgState): (map: MapData) => MapData {
  const fichas = fichasDonasDaMochila(state)
  if (fichas === null || fichas.length === 0) return (map) => map
  return (map) => mapaComAsFichas(map, fichas)
}

/** Referência estável para "sem equipes": o host compara por referência. */
const SEM_EQUIPES: readonly Equipe[] = []

const SEM_PASTAS_DE_FICHAS: readonly PastaDeFichas[] = []

/** PASTAS DO MESTRE do painel Personagens: do MESMO dono que `personagensAtivos`. Referência estável enquanto nada muda. */
export function pastasDeFichasAtivas(state: RpgState): readonly PastaDeFichas[] {
  const pasta = pastaQueManda(state)
  if (pasta !== null) return pasta.pastasDeFichas ?? SEM_PASTAS_DE_FICHAS
  return state.adventure?.pastasDeFichas ?? SEM_PASTAS_DE_FICHAS
}

/** Como `donoDasEquipes`, para as pastas do mestre: devolve o gravador, ou `null` sem onde guardar. Vazia grava sem a chave. */
export function donoDasPastasDeFichas(get: () => AdventureState, set: (patch: Partial<AdventureState>) => void): ((pastas: PastaDeFichas[]) => void) | null {
  const state = get()
  const pasta = pastaQueManda(state)
  if (pasta !== null) {
    return (pastas) => {
      const { pastasDeFichas: _antigas, ...sem } = pasta
      set({ pasta: pastas.length === 0 ? sem : { ...sem, pastasDeFichas: pastas }, pastaSuja: true })
    }
  }
  const { adventure } = state
  if (adventure === null) return null
  return (pastas) => {
    const { pastasDeFichas: _antigas, ...sem } = adventure
    set({ adventure: pastas.length === 0 ? sem : { ...sem, pastasDeFichas: pastas }, structureDirty: true })
  }
}

/**
 * BATALHA F1: as equipes em uso — do MESMO dono que `personagensAtivos` (a
 * pasta quando o mapa herda, senão a aventura), porque o membro é personagem.
 * Referência estável enquanto nada muda.
 */
export function equipesAtivas(state: RpgState): readonly Equipe[] {
  const pasta = pastaQueManda(state)
  if (pasta !== null) return pasta.equipes ?? SEM_EQUIPES
  return state.adventure?.equipes ?? SEM_EQUIPES
}

/** Como `donoDosPersonagens`, para as equipes. Lista vazia grava sem a chave (o arquivo de antes continua igual). */
export function donoDasEquipes(
  get: () => AdventureState,
  set: (patch: Partial<AdventureState>) => void,
): { lista: readonly Equipe[] | undefined; gravar: (equipes: Equipe[]) => void } | null {
  const state = get()
  const pasta = pastaQueManda(state)
  if (pasta !== null) {
    const gravar = (equipes: Equipe[]): void => {
      const { equipes: _antigas, ...semEquipes } = pasta
      set({ pasta: equipes.length === 0 ? semEquipes : { ...semEquipes, equipes }, pastaSuja: true })
    }
    return { lista: pasta.equipes, gravar }
  }
  const { adventure } = state
  if (adventure === null) return null
  const gravar = (equipes: Equipe[]): void => {
    const { equipes: _antigas, ...semEquipes } = adventure
    set({ adventure: equipes.length === 0 ? semEquipes : { ...semEquipes, equipes }, structureDirty: true })
  }
  return { lista: adventure.equipes, gravar }
}

/** A mochila mora na ficha no mapa aberto (já migrou): a cópia de recuperação guarda isso para o "Recuperar" saber se leva a mochila dos bonecos para as fichas. */
export function mochilaMoraNaFicha(state: RpgState): boolean {
  return fichasDonasDaMochila(state) !== null
}

/**
 * MOCHILA NA FICHA: as fichas do PRÓPRIO mapa aberto que mandam na mochila
 * dos bonecos dele — "Configurar só neste mapa", ou a pasta sem Sistema
 * universal, com a aventura já migrada. Vazio = quem manda é a pasta, ou a
 * mochila ainda mora nos bonecos. O "Usar o da pasta" e a volta do sistema
 * fazem as fichas da PASTA vencerem estas: antes, o que só elas têm vira
 * pendente (`net/nuvem/mochilaPendenteNoApp.ts`).
 */
export function fichasDonasDoProprioMapa(state: RpgState): readonly Personagem[] {
  return pastaQueManda(state) === null ? (fichasDonasDaMochila(state) ?? SEM_PERSONAGENS) : SEM_PERSONAGENS
}
