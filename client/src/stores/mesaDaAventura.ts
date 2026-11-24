import { direcaoDaRotacao } from '../lib/batalha/area'
import { mapaDoAlcance } from '../lib/batalha/alcance/segmentos'
import { fichaNaLuz } from '../lib/luzNaFicha'
import { pisoDe } from '../lib/pisos'
import { temporariosDaCena } from '../lib/batalha/invocacao'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { casaDoToken } from '../lib/batalha/movimentoEmBatalha'
import * as mapFactory from '../lib/mapFactory'
import { mudarFichaNoMapa } from '../lib/prazoDaCondicao'
import { tamanhoPadraoDaCena } from '../lib/tamanhoAoEntrar'
import type { MapData, Token } from '../types/map'
import { applyItemsInScene, equipesAtivas, mochilaMoraNaFicha, periodoDaSessao, personagensAtivos, sistemaAtivo, useAdventureStore } from './adventureStore'
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

/**
 * O invocado como nasce na cena: no "Tamanho da ficha ao entrar" dela, quando
 * a cena tem (`lib/tamanhoAoEntrar.ts`), como toda ficha nova; senão como veio.
 */
function invocadoNoTamanhoDaCena(sceneKey: string, token: Token): Token {
  const slot = useAdventureStore.getState().cache[sceneKey]
  const mapa = cenaAberta(sceneKey) ? useMapStore.getState().map : slot !== undefined && slot.status === 'ok' ? slot.map : null
  const padrao = mapa === null ? null : tamanhoPadraoDaCena(mapa)
  return padrao === null || token.size === padrao ? token : { ...token, size: padrao }
}

/** O tamanho da casa da grade da cena (a aberta, ou a de fundo já carregada); cena que não está à mão = `null`. */
function gradeDaCena(sceneKey: string): number | null {
  return mapaDaCena(sceneKey)?.grid ?? null
}

/** O mapa inteiro da cena (a aberta ou a de fundo à mão); `null` = cena fora de alcance. */
function mapaDaCena(sceneKey: string): MapData | null {
  if (cenaAberta(sceneKey)) return useMapStore.getState().map
  const slot = useAdventureStore.getState().cache[sceneKey]
  return slot !== undefined && slot.status === 'ok' ? slot.map : null
}

const chaveDaCasa = (casa: { col: number; row: number }): string => `${casa.col},${casa.row}`

/** As 8 casas em volta (primeiro as dos lados, depois as diagonais) e o anel de fora: onde os companions nascem. */
function casasEmVolta(centro: { col: number; row: number }): { col: number; row: number }[] {
  const anel1 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]
  const anel2: number[][] = []
  for (let dc = -2; dc <= 2; dc += 1) for (let dr = -2; dr <= 2; dr += 1) if (Math.max(Math.abs(dc), Math.abs(dr)) === 2) anel2.push([dc, dr])
  return [...anel1, ...anel2].flatMap(([dc, dr]) => (dc === undefined || dr === undefined ? [] : [{ col: centro.col + dc, row: centro.row + dr }])).filter((casa) => casa.col >= 0 && casa.row >= 0)
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
  salvarEquipes: (equipes) => useAdventureStore.getState().salvarEquipes(equipes),

  criarInvocado: (sceneKey, personagem, token) => {
    const aventura = useAdventureStore.getState()
    const novoPersonagem = personagem !== null && !personagensAtivos(aventura).some((candidato) => candidato.id === personagem.id)
    if (novoPersonagem && !aventura.adicionarPersonagens([personagem])) return false
    if (token === null || tokensDaCena(sceneKey).some((candidato) => candidato.id === token.id)) return true
    const nasce = invocadoNoTamanhoDaCena(sceneKey, token)
    if (mudarACena(sceneKey, () => useMapStore.getState().addToken(nasce), (map) => mapFactory.addToken(map, nasce))) return true
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
    const temporarios = temporariosDaCena(personagensAtivos(useAdventureStore.getState()), sceneKey)
    if (temporarios.length === 0) return
    const ids = new Set(temporarios.map((personagem) => personagem.id))
    for (const token of tokensDaCena(sceneKey)) if (token.characterId !== null && ids.has(token.characterId)) tirarToken(sceneKey, token.id)
    for (const personagem of temporarios) useAdventureStore.getState().apagarPersonagem(personagem.id)
  },

  porCompanionsAoLado: (sceneKey, donoTokenId, quem) => {
    const mapa = mapaDaCena(sceneKey)
    const dono = mapa?.tokens.find((token) => token.id === donoTokenId)
    if (mapa === null || dono === undefined || !(mapa.grid > 0)) return null
    const postos: { personagemId: string; tokenId: string; criado: boolean }[] = []
    const novos: Token[] = []
    const ocupadas = new Set(mapa.tokens.filter((token) => pisoDe(token) === pisoDe(dono)).map((token) => chaveDaCasa(casaDoToken(token, token.size, mapa.grid))))
    const casas = casasEmVolta(casaDoToken(dono, dono.size, mapa.grid))
    for (const { personagemId, nome } of quem) {
      const ja = mapa.tokens.find((token) => token.characterId === personagemId)
      if (ja !== undefined) {
        postos.push({ personagemId, tokenId: ja.id, criado: false })
        continue
      }
      // A casa livre mais perto do dono; sem nenhuma em volta, em cima do dono (o mestre arrasta).
      const casa = casas.find((candidata) => !ocupadas.has(chaveDaCasa(candidata)))
      const deslocamento = casa === undefined ? { col: 0, row: 0 } : { col: casa.col - casaDoToken(dono, dono.size, mapa.grid).col, row: casa.row - casaDoToken(dono, dono.size, mapa.grid).row }
      if (casa !== undefined) ocupadas.add(chaveDaCasa(casa))
      const token: Token = invocadoNoTamanhoDaCena(sceneKey, { id: crypto.randomUUID(), characterId: personagemId, name: nome, x: dono.x + deslocamento.col * mapa.grid, y: dono.y + deslocamento.row * mapa.grid, size: 1, image: null })
      if (dono.piso !== undefined) token.piso = dono.piso
      novos.push(token)
      postos.push({ personagemId, tokenId: token.id, criado: true })
    }
    if (novos.length === 0) return postos
    // Um passo só no mapa: todos os tokens entram juntos (a cena aberta pelo mapStore, a de fundo pela aventura).
    const comTodos = (map: MapData): MapData => novos.reduce((acumulado, token) => mapFactory.addToken(acumulado, token), map)
    const entrou = mudarACena(sceneKey, () => useMapStore.getState().applyPlayerChange(comTodos), comTodos)
    return entrou ? postos : null
  },

  tirarTokensDosCompanions: (sceneKey, tokenIds) => {
    for (const tokenId of tokenIds) tirarToken(sceneKey, tokenId)
  },

  fichaDaCena: (sceneKey, tokenId) => tokensDaCena(sceneKey).find((candidato) => candidato.id === tokenId) ?? null,

  fichasDaCena: (sceneKey) => tokensDaCena(sceneKey),

  mudarFichaDaCena: (sceneKey, tokenId, mudar) => {
    const naFicha = (map: MapData): MapData => mudarFichaNoMapa(map, tokenId, mudar)
    if (cenaAberta(sceneKey)) useMapStore.getState().applyPlayerChange(naFicha)
    else useAdventureStore.getState().applyPlayerChangeToBackgroundScene(sceneKey, naFicha)
  },

  mochilaDoBoneco: (sceneKey, tokenId) => {
    if (mochilaMoraNaFicha(useAdventureStore.getState())) return null
    const token = tokensDaCena(sceneKey).find((candidato) => candidato.id === tokenId)
    return token === undefined ? null : (token.mochila ?? [])
  },

  // O caminho dos itens do mapa (`applyItemsInScene`): o Ctrl+Z do mestre não traz de volta a bala gasta, e a cena de fundo marca o Salvar.
  gravarMochilaDoBoneco: (sceneKey, tokenId, mochila) => applyItemsInScene({ mochilas: [{ tokenId, mochila }], ...(cenaAberta(sceneKey) ? {} : { sceneId: sceneKey }) }),

  posicaoDoToken: (sceneKey, tokenId) => {
    const token = tokensDaCena(sceneKey).find((candidato) => candidato.id === tokenId)
    const grid = gradeDaCena(sceneKey)
    if (token === undefined || grid === null || !(grid > 0)) return null
    return { casa: casaDoToken(token, token.size, grid), direcao: direcaoDaRotacao(token.rotation) }
  },

  // Fase C do alcance: o mestre (e o NPC) mede com o mapa inteiro, no piso da ficha que usa.
  mapaDoAlcance: (sceneKey, tokenId) => {
    const map = mapaDaCena(sceneKey)
    const token = map?.tokens.find((candidato) => candidato.id === tokenId)
    return map === null || token === undefined || !(map.grid > 0) ? null : mapaDoAlcance(map, pisoDe(token))
  },

  // REQUISITOS E5: a luz pelo mapa inteiro da cena e o período da sessão (o mestre vê toda luz).
  naLuz: (sceneKey, tokenId) => {
    const map = mapaDaCena(sceneKey)
    return map === null ? null : fichaNaLuz(map, tokenId, periodoDaSessao(useAdventureStore.getState()))
  },
}
