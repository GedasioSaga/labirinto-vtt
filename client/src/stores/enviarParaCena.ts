import type { MapData } from '../types/map'
import type { HostBridge } from '../net/hostBridge'
import { casaDeChegada, pinoDeChegada, textoDoEnvio } from '../lib/enviarParaCena'
import { pisoDe } from '../lib/pisos'
import { removeSelectionItem, selectionHas, type SelectionItem } from '../lib/selectionModel'
import { tamanhoAoEntrar } from '../lib/tamanhoAoEntrar'
import { useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
import { useToastStore } from './toastStore'

/**
 * "ENVIAR PARA CENA ›" do clique direito no token: a ficha SAI da cena aberta
 * e chega no pino de chegada da outra (`lib/enviarParaCena.ts`). A ficha de
 * jogador vai pela ponte da sala (`sendPlayer`, o mesmo "Mandar para…" do
 * Grupo): a tela dele troca de cena junto, com a névoa e a memória da cena
 * nova. A ficha sem dono vai pela travessia de sempre (`transferToken`).
 *
 * UM PASSO DO CTRL+Z. A travessia não entra no desfazer: ela tira a ficha de
 * TODO passo do histórico da origem, para um Ctrl+Z nunca a duplicar
 * (`lib/travessiaDaFicha.ts`). O envio entra no histórico da cena aberta como
 * um passo MARCADO, de mesmo conteúdo: quando o Ctrl+Z chega nele, a marca
 * faz a volta — de novo pela travessia (ou pela ponte, na ficha de jogador),
 * então nada duplica — e o Ctrl+Y faz a ida outra vez. A marca mora numa
 * chave Symbol do próprio mapa: sobrevive às cópias `{ ...map }` com que o
 * resto do app reescreve o histórico (mudança do jogador, troca de cena), e
 * nunca vai ao disco (o JSON ignora Symbol). Se alguma reescrita a perder, o
 * passo vira um Ctrl+Z que não muda nada — nunca uma ficha em duas cenas.
 */

/** O que o envio precisa da sala: quem é dono de qual ficha, e as duas pontas da viagem do jogador. */
export type PonteDoEnvio = Pick<HostBridge, 'players' | 'sendPlayer' | 'returnPlayer'>

let ponteDaSala: () => PonteDoEnvio | null = () => null

/** O App liga a ponte da sala uma vez; sem sala aberta ela devolve `null` e toda ficha vai como ficha sem dono. */
export function ligarSalaAoEnvio(fonte: () => PonteDoEnvio | null): void {
  ponteDaSala = fonte
}

/** Uma ficha que foi: de onde saiu (para a volta) e, se for de jogador, de quem. */
interface FichaEnviada {
  tokenId: string
  nome: string
  playerId: string | null
  /** `size`: o lado que ela tinha — a cena de destino pode tê-lo trocado pelo padrão dela (TAMANHO AO ENTRAR). */
  antes: { x: number; y: number; piso?: number; size: number }
}

/** Um envio feito: as duas cenas e as fichas que de fato mudaram de cena. */
interface Envio {
  origemId: string
  destinoId: string
  fichas: FichaEnviada[]
}

/** O que o passo marcado faz quando o Ctrl+Z (ou o Ctrl+Y) chega nele. */
interface Marca {
  envio: Envio
  sentido: 'desfazer' | 'refazer'
}

const MARCA = Symbol('envioParaCena')
/** Marca → o que fazer. O mapa guarda só o id: o registro é a única fonte do envio. */
const marcas = new Map<string, Marca>()
let proximaMarca = 0

function marcar(map: MapData, marca: Marca): MapData {
  proximaMarca += 1
  const id = `envio-${proximaMarca}`
  marcas.set(id, marca)
  const marcado: MapData & { [MARCA]: string } = { ...map, [MARCA]: id }
  return marcado
}

function idDaMarca(map: MapData): string | null {
  if (!(MARCA in map)) return null
  const id = map[MARCA]
  return typeof id === 'string' ? id : null
}

function semMarca(map: MapData): MapData {
  if (!(MARCA in map)) return map
  // A chave sai pela desestruturação: o resto é o mapa inteiro, sem ela.
  const { [MARCA]: _marca, ...resto } = map
  return resto
}

/** O dono jogando de cada ficha que a sala conhece; ficha sem dono fica fora. */
function donosNaSala(ponte: PonteDoEnvio | null): { jogando: Map<string, string>; fora: Set<string> } {
  const jogando = new Map<string, string>()
  const fora = new Set<string>()
  for (const player of ponte?.players() ?? []) {
    for (const tokenId of player.tokenIds) {
      if (player.status === 'playing') jogando.set(tokenId, player.playerId)
      else fora.add(tokenId)
    }
  }
  return { jogando, fora }
}

/**
 * A IDA, sem mexer no histórico: cada ficha de `tokenIds` que está na cena
 * aberta vai para `destinoId`, uma depois da outra — a que chega depois senta
 * na casa livre ao lado da anterior. `null` = nenhuma foi (o motivo vai em `porque`).
 */
function ida(tokenIds: readonly string[], destinoId: string): { envio: Envio | null; porque: string } {
  const { adventure, activeSceneId, cache } = useAdventureStore.getState()
  if (adventure === null || activeSceneId === null || activeSceneId === destinoId) return { envio: null, porque: 'Não há outra cena para onde mandar.' }
  const slot = cache[destinoId]
  if (slot === undefined || slot.status !== 'ok') return { envio: null, porque: 'A cena de destino ainda não abriu.' }
  const pino = pinoDeChegada(slot.map)
  const piso = pino === null || pisoDe(pino) === 0 ? undefined : pisoDe(pino)
  const ponte = ponteDaSala()
  const donos = donosNaSala(ponte)
  const fichas: FichaEnviada[] = []
  let foraDaMesa = 0
  for (const tokenId of tokenIds) {
    // A que foi a bordo de um veículo já atravessou com ele: não está mais aqui.
    const token = useMapStore.getState().map.tokens.find((t) => t.id === tokenId)
    if (token === undefined) continue
    if (donos.fora.has(tokenId)) {
      // Dono fora da mesa agora: a sessão não troca a tela dele, então a ficha fica.
      foraDaMesa += 1
      continue
    }
    const antes = { x: token.x, y: token.y, ...(token.piso === undefined ? {} : { piso: token.piso }), size: token.size }
    const playerId = donos.jogando.get(tokenId) ?? null
    let foi: boolean
    if (playerId !== null && ponte !== null) {
      foi = ponte.sendPlayer(playerId, destinoId, pino?.id ?? null, undefined, tokenId)
    } else {
      // Lido de novo a cada ficha: a anterior já ocupa a casa dela no destino.
      const agora = useAdventureStore.getState().cache[destinoId]
      if (agora === undefined || agora.status !== 'ok') break
      // A casa já no lado com que ela entra lá (TAMANHO AO ENTRAR, `lib/tamanhoAoEntrar.ts`).
      const casa = casaDeChegada(agora.map, pino, tamanhoAoEntrar(agora.map, token), tokenId)
      foi = useAdventureStore.getState().transferToken(tokenId, activeSceneId, destinoId, casa.x, casa.y, piso)
    }
    if (foi) fichas.push({ tokenId, nome: token.name, playerId, antes })
  }
  if (fichas.length === 0) {
    return { envio: null, porque: foraDaMesa > 0 ? 'O jogador dessa ficha não está na mesa agora. Ela ficou aqui.' : 'Não deu para mandar a ficha. Ela ficou aqui.' }
  }
  // Fora do mapa aberto, a seleção não pode apontar para elas.
  const { selection, setSelection } = useMapStore.getState()
  const restante = fichas.reduce((sel, ficha) => {
    const item: SelectionItem = { kind: 'token', id: ficha.tokenId }
    return selectionHas(sel, item) ? removeSelectionItem(sel, item) : sel
  }, selection)
  if (restante !== selection) setSelection(restante)
  return { envio: { origemId: activeSceneId, destinoId, fichas }, porque: '' }
}

/**
 * A VOLTA: cada ficha do envio à cena e à casa de onde saiu, na ordem da ida —
 * a que estava por cima das outras volta por cima. Devolve as que voltaram.
 */
function volta(envio: Envio): FichaEnviada[] {
  const ponte = ponteDaSala()
  const voltaram: FichaEnviada[] = []
  for (const ficha of envio.fichas) {
    const { tokenId, playerId, antes } = ficha
    const foi =
      playerId !== null && ponte !== null
        ? ponte.returnPlayer(playerId, tokenId, { sceneId: envio.origemId, x: antes.x, y: antes.y })
        : // O tamanho de antes volta junto: a origem pode não ter padrão, ou ter outro.
          useAdventureStore.getState().transferToken(tokenId, envio.destinoId, envio.origemId, antes.x, antes.y, antes.piso, undefined, antes.size)
    if (foi) voltaram.push(ficha)
  }
  return voltaram
}

function nomeDaCena(sceneId: string): string {
  return useAdventureStore.getState().adventure?.scenes.find((entry) => entry.id === sceneId)?.name ?? 'a outra cena'
}

/** "Envio desfeito: Zumbi voltou para Vila" (ou "3 fichas voltaram"). */
function textoDaVolta(voltaram: readonly FichaEnviada[], cena: string): string {
  if (voltaram.length === 1) return `Envio desfeito: ${voltaram[0].nome.trim() === '' ? 'a ficha' : voltaram[0].nome} voltou para ${cena}`
  return `Envio desfeito: ${voltaram.length} fichas voltaram para ${cena}`
}

/**
 * O aviso da ida, com "Ir lá": o editor vai à cena de destino, na primeira
 * ficha que chegou (e no piso dela). Ficha que já saiu de lá: o botão não faz nada.
 */
function avisarIda(envio: Envio): void {
  const irLa = () => {
    const slot = useAdventureStore.getState().cache[envio.destinoId]
    const primeira = slot?.status === 'ok' ? slot.map.tokens.find((t) => envio.fichas.some((ficha) => ficha.tokenId === t.id)) : undefined
    if (primeira === undefined) return
    void useAdventureStore.getState().goToPointNoPiso(envio.destinoId, { x: primeira.x, y: primeira.y }, pisoDe(primeira))
  }
  const texto = textoDoEnvio(
    envio.fichas.map((ficha) => ficha.nome),
    nomeDaCena(envio.destinoId),
  )
  useToastStore.getState().push('info', texto, undefined, { actions: [{ label: 'Ir lá', run: irLa }] })
}

/** Troca o passo do topo de `past` ou `future` pelo mesmo mapa, marcado. */
function marcarTopo(lista: 'past' | 'future', marca: Marca): void {
  const passos = useMapStore.getState()[lista]
  const topo = passos[passos.length - 1]
  if (topo === undefined) return
  useMapStore.setState({ [lista]: [...passos.slice(0, -1), marcar(topo, marca)] })
}

/**
 * Manda as fichas `tokenIds` da cena aberta para `destinoId` e avisa o
 * mestre. Um passo do Ctrl+Z: o passo marcado entra no histórico da cena
 * aberta, e o refazer que havia acaba, como em toda ação nova do mestre.
 * `false` = nenhuma foi (o aviso diz por quê), e nada mudou.
 */
export function enviarParaCena(tokenIds: readonly string[], destinoId: string): boolean {
  const { envio, porque } = ida(tokenIds, destinoId)
  if (envio === null) {
    useToastStore.getState().push('error', porque)
    return false
  }
  useMapStore.setState((state) => ({ past: [...state.past, marcar(state.map, { envio, sentido: 'desfazer' })], future: [] }))
  avisarIda(envio)
  return true
}

/**
 * O Ctrl+Z (ou Ctrl+Y) chegou num passo marcado. A marca sai do mapa na hora
 * (um passo novo copiado dele a levaria junto) e a volta ou a ida acontece.
 */
function tratarMarca(map: MapData): void {
  if (useMapStore.getState().map !== map) return
  const id = idDaMarca(map)
  if (id === null) return
  useMapStore.setState({ map: semMarca(map) })
  const marca = marcas.get(id)
  marcas.delete(id)
  // A marca pertence ao histórico da cena de origem: só ela, aberta, a desfaz.
  if (marca === undefined || useAdventureStore.getState().activeSceneId !== marca.envio.origemId) return
  const { envio } = marca
  const toasts = useToastStore.getState()
  if (marca.sentido === 'desfazer') {
    const voltaram = volta(envio)
    if (voltaram.length === 0) {
      toasts.push('error', `Não deu para desfazer o envio: a ficha já não está em ${nomeDaCena(envio.destinoId)}.`)
      return
    }
    marcarTopo('future', { envio: { ...envio, fichas: voltaram }, sentido: 'refazer' })
    toasts.push('info', textoDaVolta(voltaram, nomeDaCena(envio.origemId)))
    return
  }
  const { envio: denovo, porque } = ida(
    envio.fichas.map((ficha) => ficha.tokenId),
    envio.destinoId,
  )
  if (denovo === null) {
    toasts.push('error', `Não deu para refazer o envio. ${porque}`)
    return
  }
  marcarTopo('past', { envio: denovo, sentido: 'desfazer' })
  avisarIda(denovo)
}

// O mapa marcado só vira o atual pelo Ctrl+Z/Ctrl+Y (a marca mora no histórico).
// A volta e a ida reescrevem o histórico pela store: fora do aviso que as disparou.
useMapStore.subscribe(
  (state) => state.map,
  (map) => {
    if (idDaMarca(map) !== null) queueMicrotask(() => tratarMarca(map))
  },
)
