import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from './adventureStore'
import { sistemaPorId, useRpgStore } from './rpgStore'

/**
 * A MESA DE VERDADE da batalha (fase 0 de
 * docs/planos/batalha-arena-de-testes-plano.md, seção 4.2): as fichas da
 * aventura aberta (ou da pasta, quando o mapa herda) e o sistema em uso.
 * Exatamente o que a `batalhaStore` lia e gravava direto antes da fábrica:
 * `personagensAtivos`, `equipesAtivas`, `sistemaAtivo` e os ajustes pela
 * aventura (o histórico da ficha cresce e a mudança chega ao jogador pelo
 * `syncPersonagens` de sempre).
 *
 * Cada leitura pega o estado de AGORA; nada fica guardado aqui.
 */
export const mesaDaAventura: MesaDaBatalha = {
  personagens: () => personagensAtivos(useAdventureStore.getState()),
  sistema: () => sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(useAdventureStore.getState())) ?? null,
  equipes: () => equipesAtivas(useAdventureStore.getState()),
  ajustarPersonagem: (personagemId, ajustar) => useAdventureStore.getState().ajustarPersonagem(personagemId, ajustar),
  trocarEquipe: (personagemId, equipeId) => useAdventureStore.getState().trocarEquipe(personagemId, equipeId),
}
