import { aplicarAjustes, NOME_DO_MESTRE, type Ajuste } from '../lib/ajusteDaFicha'
import { danoDoAjusteNaVida } from '../lib/batalha/danoPelaFicha'
import type { Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import { personagensAtivos, useAdventureStore } from './adventureStore'
import { darDanoPelaFicha, MESTRE } from './batalha/cena'
import { useBatalhaDBTStore } from './batalhaDBTStore'
import { useBatalhaStore } from './batalhaStore'

/**
 * AJUSTE RÁPIDO DO MESTRE, um caminho só para as duas portas: o "−"/"+" da
 * ficha aberta (`RpgDialogs`) e a "Vida ›" do botão direito no token
 * (`stores/vidaPeloMenu.ts`).
 */

/** O que o caminho simples fez: `gravou` = a aventura aceitou; `mudou` = o antes e o depois, quando algo mudou. */
export interface AjusteNaFicha {
  gravou: boolean
  mudou: { antes: Personagem; depois: Personagem } | null
}

/**
 * O CAMINHO SIMPLES: sobre o personagem de AGORA da aventura (o jogador pode
 * ter mexido um instante antes), com o histórico da ficha. BATALHA F1: o que
 * mudou vira linha "ficha" no registro da batalha (autor mestre), em toda cena
 * com ele na ordem; BATALHA DBT: PV e Ki viram linha "ficha" na Dragon Ball.
 */
export function gravarAjusteDoMestre(personagemId: string, sistema: SistemaDeRpg, ajustes: readonly Ajuste[]): AjusteNaFicha {
  const feito: { antes?: Personagem; depois?: Personagem } = {}
  const gravou = useAdventureStore.getState().ajustarPersonagem(personagemId, (atual) => {
    feito.antes = atual
    feito.depois = aplicarAjustes(atual, sistema, ajustes, NOME_DO_MESTRE, Date.now())
    return feito.depois
  })
  const { antes, depois } = feito
  if (antes === undefined || depois === undefined || antes === depois) return { gravou, mudou: null }
  useBatalhaStore.getState().registrarAjuste(personagemId, antes, depois, { tipo: 'mestre' })
  useBatalhaDBTStore.getState().registrarAjuste(personagemId, antes, depois, { tipo: 'mestre' })
  return { gravou, mudou: { antes, depois } }
}

/**
 * DANO PELA FICHA (Nº 4 do levantamento): com o personagem numa batalha, o
 * ajuste que DESCE a vida é o "Dar dano" dela (Escudo, redução, registro com
 * Desfazer, queda): `'batalha'`. Fora dela (ou cura, ou outra parte), o
 * caminho simples (`gravarAjusteDoMestre`).
 */
export function ajustarFichaComoMestre(personagemId: string, sistema: SistemaDeRpg, ajuste: Ajuste): 'batalha' | AjusteNaFicha {
  const agora = personagensAtivos(useAdventureStore.getState()).find((candidato) => candidato.id === personagemId)
  const dano = agora === undefined ? null : danoDoAjusteNaVida(agora, [ajuste], sistema)
  if (dano !== null && darDanoPelaFicha(useBatalhaStore.getState(), personagemId, dano, MESTRE)) return 'batalha'
  return gravarAjusteDoMestre(personagemId, sistema, [ajuste])
}
