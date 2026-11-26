import { chavesDoDragonBall, chavesDosSelos, espelharNoMapa, mudancasDaPonte, type ChavesPorFicha, type MudancaDaPonte } from '../lib/ponteDasCondicoes'
import type { MapData } from '../types/map'
import { personagensAtivos, useAdventureStore } from './adventureStore'
import { useBatalhaDBTStore, type CenaDBT } from './batalhaDBTStore'
import { useBatalhaStore, type BatalhaDaCena } from './batalhaStore'
import { useCondicoesPropriasStore } from './condicoesPropriasStore'
import { useMapStore } from './mapStore'

/**
 * A PONTE DA BATALHA PARA A PASTILHA, ligada às stores da MESA DE VERDADE
 * (Fase 3 do plano de melhoria, 15/11/2026). A regra pura mora em
 * `lib/ponteDasCondicoes.ts`; aqui só se olha a batalha One Piece
 * (`useBatalhaStore`) e a Dragon Ball (`useBatalhaDBTStore`) e se grava a
 * diferença no mapa da cena.
 *
 * A mudança entra FORA do Ctrl+Z do mestre, como a de um jogador
 * (`applyPlayerChange`; na cena de fundo, `applyPlayerChangeToBackgroundScene`):
 * quem manda na pastilha espelhada é a batalha, e desfazer uma parede não pode
 * reacender um selo que já acabou. A arena e o treino têm stores próprias e
 * ficam de fora: nada chega ao mapa por eles.
 *
 * Só no app do mestre (`main.tsx`). A pastilha chega a quem joga pelo mapa,
 * como qualquer outra.
 */

/** Uma foto da batalha: por cena (`sceneKey`), o que cada ficha tem aceso por ela. */
type FotoDasCenas = ReadonlyMap<string, ChavesPorFicha>

function fotoDoOnePiece(cenas: Readonly<Record<string, BatalhaDaCena>>): FotoDasCenas {
  return new Map(Object.entries(cenas).map(([sceneKey, cena]) => [sceneKey, chavesDosSelos(cena.turnos.selos)]))
}

function fotoDoDragonBall(cenas: Readonly<Record<string, CenaDBT>>): FotoDasCenas {
  return new Map(Object.entries(cenas).map(([sceneKey, cena]) => [sceneKey, chavesDoDragonBall(cena.combatentes)]))
}

/** A cena da batalha é a aberta no editor? (a chave é a de `App.tsx`: a cena da aventura, ou o mapa solto). */
function chaveDaCenaAberta(): string {
  return useAdventureStore.getState().activeSceneId ?? useMapStore.getState().map.id
}

function cenaAberta(sceneKey: string): boolean {
  return chaveDaCenaAberta() === sceneKey
}

/** Grava as mudanças no mapa da cena: a aberta, ou a de fundo já carregada (a que não está à mão fica como está). */
function espelharNaCena(sceneKey: string, mudancas: readonly MudancaDaPonte[]): void {
  if (mudancas.length === 0) return
  const catalogo = useCondicoesPropriasStore.getState().catalogo
  const mudar = (map: MapData): MapData => espelharNoMapa(map, mudancas, catalogo)
  if (cenaAberta(sceneKey)) useMapStore.getState().applyPlayerChange(mudar)
  else useAdventureStore.getState().applyPlayerChangeToBackgroundScene(sceneKey, mudar)
}

const SEM_CHAVES: ChavesPorFicha = new Map()

/**
 * Compara duas fotos e espelha: cena que continua, pela diferença; cena que
 * SUMIU (a batalha acabou), apaga tudo o que ela segurava; cena que APARECEU
 * (começou, ou voltou do disco) é a base e não acende nada.
 */
function espelharDiferenca(antes: FotoDasCenas, depois: FotoDasCenas): void {
  for (const [sceneKey, chavesDepois] of depois) {
    const chavesAntes = antes.get(sceneKey)
    if (chavesAntes !== undefined) espelharNaCena(sceneKey, mudancasDaPonte(chavesAntes, chavesDepois))
  }
  for (const [sceneKey, chavesAntes] of antes) if (!depois.has(sceneKey)) espelharNaCena(sceneKey, mudancasDaPonte(chavesAntes, SEM_CHAVES))
}

/**
 * Liga a ponte. Devolve o desligar. Chamar uma vez, na abertura do app do
 * mestre; a foto de agora é a base (nada acende na hora).
 */
export function ligarPonteDasCondicoes(): () => void {
  let fotoOnePiece = fotoDoOnePiece(useBatalhaStore.getState().cenas)
  let fotoDragonBall = fotoDoDragonBall(useBatalhaDBTStore.getState().cenas)
  const espelhar = espelhoDasPastilhasNaFila()
  // Nº 3 do levantamento: a pastilha mudou à mão no mapa (aberto ou de fundo), o espelho da batalha acompanha na hora.
  const desligarMapa = useMapStore.subscribe((state, anterior) => {
    if (state.map.tokens !== anterior.map.tokens) espelhar(chaveDaCenaAberta())
  })
  const desligarFundo = useAdventureStore.subscribe((state, anterior) => {
    // ITENS REFEITOS, E6c: a condição posta ou tirada na FICHA (o menu do token, o painel) entra no espelho da batalha na hora.
    if (personagensAtivos(state) !== personagensAtivos(anterior)) for (const sceneKey of Object.keys(useBatalhaStore.getState().cenas)) espelhar(sceneKey)
    if (state.cache === anterior.cache) return
    for (const sceneKey of Object.keys(useBatalhaStore.getState().cenas)) {
      const agora = state.cache[sceneKey]
      const antes = anterior.cache[sceneKey]
      if (agora?.status !== 'ok' || cenaAberta(sceneKey)) continue
      if (antes?.status !== 'ok' || antes.map.tokens !== agora.map.tokens) espelhar(sceneKey)
    }
  })
  const desligarOnePiece = useBatalhaStore.subscribe((state, anterior) => {
    if (state.cenas === anterior.cenas) return
    const depois = fotoDoOnePiece(state.cenas)
    espelharDiferenca(fotoOnePiece, depois)
    fotoOnePiece = depois
  })
  const desligarDragonBall = useBatalhaDBTStore.subscribe((state, anterior) => {
    if (state.cenas === anterior.cenas) return
    const depois = fotoDoDragonBall(state.cenas)
    espelharDiferenca(fotoDragonBall, depois)
    fotoDragonBall = depois
  })
  return () => {
    desligarOnePiece()
    desligarDragonBall()
    desligarMapa()
    desligarFundo()
  }
}

/**
 * Nº 3 do levantamento: põe em dia o espelho das pastilhas (`espelharPastilhas`) da cena com batalha, também
 * na cena de FUNDO e com a faixa do mestre fechada (antes só a FaixaDoMestre montada, na cena aberta, chamava).
 * Numa microtarefa, fora da pilha de quem mudou o mapa: a própria ponte escreve pastilha no mapa de dentro da
 * assinatura da batalha, e assim não reentra nela. Várias mudanças seguidas da mesma cena viram uma chamada.
 */
function espelhoDasPastilhasNaFila(): (sceneKey: string) => void {
  const pendentes = new Set<string>()
  const esvaziar = (): void => {
    const chaves = [...pendentes]
    pendentes.clear()
    for (const sceneKey of chaves) useBatalhaStore.getState().espelharPastilhas(sceneKey)
  }
  return (sceneKey) => {
    if (useBatalhaStore.getState().cenas[sceneKey] === undefined) return
    if (pendentes.size === 0) queueMicrotask(esvaziar)
    pendentes.add(sceneKey)
  }
}

/**
 * As chaves de nome que a batalha da cena segura acesas na ficha (selo do One
 * Piece e condição do Dragon Ball). Vazio = nenhuma, ou cena sem batalha. É o
 * `seguradas` do desconto do prazo (`contarFimDaVez`, `passarTurnoNoMapa` em
 * `lib/prazoDaCondicao.ts`): o prazo da armadilha acaba, mas a pastilha que a
 * batalha ainda segura fica.
 */
export function chavesDaFichaNaBatalha(sceneKey: string, tokenId: string): ReadonlySet<string> {
  const onePiece = useBatalhaStore.getState().cenas[sceneKey]
  const dragonBall = useBatalhaDBTStore.getState().cenas[sceneKey]
  const chaves = new Set<string>()
  if (onePiece !== undefined) for (const chave of chavesDosSelos(onePiece.turnos.selos).get(tokenId) ?? []) chaves.add(chave)
  if (dragonBall !== undefined) for (const chave of chavesDoDragonBall(dragonBall.combatentes).get(tokenId) ?? []) chaves.add(chave)
  return chaves
}
