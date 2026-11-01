import type { MesaDaBatalha } from '../lib/batalha/mesa'
import * as mapFactory from '../lib/mapFactory'
import type { MapData, Token } from '../types/map'
import { equipesAtivas, personagensAtivos, sistemaAtivo, useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
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
 * INVOCAÇÃO (docs/planos/batalha-invocacao-plano.md): o personagem
 * temporário do invocado entra pela aventura (como as fichas do "Quem entra
 * na batalha?") e o token pelo mapa da cena: o aberto pelo `useMapStore`
 * (passo do desfazer do mapa, como o "Ligar token"), o de fundo pelo
 * `updateBackgroundScene`. A SAÍDA do token fica fora do desfazer do mapa
 * (`tirarToken`).
 *
 * Cada leitura pega o estado de AGORA; nada fica guardado aqui.
 */

/** A cena da batalha é a aberta no editor (a chave é a de `App.tsx`: a cena da aventura, ou o mapa solto). */
function cenaAberta(sceneKey: string): boolean {
  return (useAdventureStore.getState().activeSceneId ?? useMapStore.getState().map.id) === sceneKey
}

/** Os tokens da cena: a aberta, ou a de fundo já carregada; cena que não está à mão = nenhum. */
function tokensDaCena(sceneKey: string): readonly Token[] {
  if (cenaAberta(sceneKey)) return useMapStore.getState().map.tokens
  const slot = useAdventureStore.getState().cache[sceneKey]
  return slot !== undefined && slot.status === 'ok' ? slot.map.tokens : []
}

/** Muda o mapa da cena: a aberta por `naAberta`, a de fundo por `mudar`. `false` = cena que não está à mão. */
function mudarACena(sceneKey: string, naAberta: () => void, mudar: (map: MapData) => MapData): boolean {
  if (cenaAberta(sceneKey)) {
    naAberta()
    return true
  }
  const aventura = useAdventureStore.getState()
  if (aventura.cache[sceneKey]?.status !== 'ok') return false
  aventura.updateBackgroundScene(sceneKey, mudar)
  return true
}

/**
 * O token do invocado sai FORA do desfazer do mapa, como a mudança de um
 * jogador (`applyPlayerChange`): sai também de cada passo guardado. Pelo
 * `removeToken` ele entraria no Ctrl+Z, e o Ctrl+Z traria de volta um token
 * ligado a um personagem temporário já apagado, que nada mais limpa e fica
 * salvo. Quem traz o invocado de volta é o Desfazer da batalha (`criarInvocado`).
 */
function tirarToken(sceneKey: string, tokenId: string): void {
  const semOToken = (map: MapData): MapData => (map.tokens.some((token) => token.id === tokenId) ? mapFactory.removeToken(map, tokenId) : map)
  if (cenaAberta(sceneKey)) {
    useMapStore.getState().applyPlayerChange(semOToken)
    return
  }
  useAdventureStore.getState().applyPlayerChangeToBackgroundScene(sceneKey, semOToken)
}

export const mesaDaAventura: MesaDaBatalha = {
  personagens: () => personagensAtivos(useAdventureStore.getState()),
  sistema: () => sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(useAdventureStore.getState())) ?? null,
  equipes: () => equipesAtivas(useAdventureStore.getState()),
  ajustarPersonagem: (personagemId, ajustar) => useAdventureStore.getState().ajustarPersonagem(personagemId, ajustar),
  trocarEquipe: (personagemId, equipeId) => useAdventureStore.getState().trocarEquipe(personagemId, equipeId),

  criarInvocado: (sceneKey, personagem, token) => {
    const aventura = useAdventureStore.getState()
    const novoPersonagem = personagem !== null && !personagensAtivos(aventura).some((candidato) => candidato.id === personagem.id)
    if (novoPersonagem && !aventura.adicionarPersonagens([personagem])) return false
    if (token === null || tokensDaCena(sceneKey).some((candidato) => candidato.id === token.id)) return true
    if (mudarACena(sceneKey, () => useMapStore.getState().addToken(token), (map) => mapFactory.addToken(map, token))) return true
    // Sem cena onde pôr o token: o personagem que acabou de entrar sai (nada fica pela metade).
    if (novoPersonagem) useAdventureStore.getState().apagarPersonagem(personagem.id)
    return false
  },

  tirarInvocado: (sceneKey, personagemId, tokenId) => {
    const personagem = personagensAtivos(useAdventureStore.getState()).find((candidato) => candidato.id === personagemId) ?? null
    const token = tokensDaCena(sceneKey).find((candidato) => candidato.id === tokenId) ?? null
    if (token !== null) tirarToken(sceneKey, tokenId)
    if (personagem !== null) useAdventureStore.getState().apagarPersonagem(personagemId)
    return { personagem, token }
  },

  limparInvocados: (sceneKey) => {
    const temporarios = personagensAtivos(useAdventureStore.getState()).filter((personagem) => personagem.combate?.invocadoNaCena === sceneKey)
    if (temporarios.length === 0) return
    const ids = new Set(temporarios.map((personagem) => personagem.id))
    for (const token of tokensDaCena(sceneKey)) if (token.characterId !== null && ids.has(token.characterId)) tirarToken(sceneKey, token.id)
    for (const personagem of temporarios) useAdventureStore.getState().apagarPersonagem(personagem.id)
  },
}
