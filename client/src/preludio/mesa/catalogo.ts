import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { useMemo } from 'react'
import { create } from 'zustand'
import { ADVENTURE_FILE, parseAdventure, type SceneEntry } from '../../lib/adventure'
import { defaultMapsDir, listSavedMaps, loadMapFromDisk } from '../../lib/mapFileIO'
import { lerIndiceDasPastas, lerRpgDaPasta } from '../../lib/pastasDeMapas'
import type { AlvoNaMesa } from '../../lib/preparo/sessoes'
import type { LigaCena } from '../../lib/preparo/tipos'
import { useAdventureStore } from '../../stores/adventureStore'
import { useMapStore } from '../../stores/mapStore'
import type { MapData } from '../../types/map'

/**
 * O QUE EXISTE NA MESA, para os links do roteiro (F4): os mapas de
 * `<appData>/maps` com as cenas, os pinos de cada cena e as fichas de cada
 * pasta. Só lê, e só o que um link ou a escolha pedem: os pinos de uma cena só
 * são lidos quando algum link aponta para ela. O que não abre conta como "não
 * sei" (o link fica neutro), nunca como "não existe mais". O mapa aberto no
 * editor é conferido pela memória (`MapaNaMemoria`): a cena apagada e ainda não
 * salva já some do link.
 */

/** O map.json da raiz da pasta do mapa: o mapa sem cenas mora nele e, quando ganha cenas, a primeira continua nele. */
const ARQUIVO_DA_RAIZ = 'map.json'

export function ehArquivoDaRaiz(arquivo: string): boolean {
  return arquivo.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase() === ARQUIVO_DA_RAIZ
}

export interface CenaNoCatalogo {
  readonly id: string
  readonly nome: string
  /** "Ilha › Vila › Taverna": o caminho das pastas de cenas até esta. */
  readonly trilha: string
  /** A cena que mora no map.json da raiz: o link de quando o mapa não tinha cenas (`sceneId` vazio) aponta para ela. */
  readonly raiz: boolean
  /** O map.json da cena. */
  readonly arquivo: string
}

export interface MapaNoCatalogo {
  /** A pasta do mapa em `<appData>/maps`: é por ela que o link guarda o mapa. */
  readonly chave: string
  readonly nome: string
  /** O map.json que o Carregar mapa abre. */
  readonly caminho: string
  /** `null` = mapa sem cenas (os pinos moram no próprio map.json). */
  readonly cenas: readonly CenaNoCatalogo[] | null
  /** `false` = o map.json ou o adventure.json não abriu: fica fora da escolha, e o link para ele fica neutro. */
  readonly abriu: boolean
}

export interface ItemDoCatalogo {
  readonly id: string
  readonly nome: string
  readonly detalhe?: string
}

export type Leitura<T> = { readonly t: 'lendo' } | { readonly t: 'lido'; readonly valor: T } | { readonly t: 'falhou'; readonly motivo: string }

interface EstadoDoCatalogo {
  mapas: Leitura<ReadonlyMap<string, MapaNoCatalogo>> | null
  pastas: Leitura<ReadonlyMap<string, string>> | null
  /** Por `chaveDosPinos(chave, sceneId)`. */
  pinos: ReadonlyMap<string, Leitura<readonly ItemDoCatalogo[]>>
  /** Por pasta. */
  fichas: ReadonlyMap<string, Leitura<readonly ItemDoCatalogo[]>>
  lerMapas: () => void
  lerPastas: () => void
  lerPinos: (chave: string, sceneId: string) => void
  lerFichas: (pastaId: string) => void
  /** O disco pode ter mudado (o mestre editou um mapa): a próxima pergunta lê de novo. */
  esquecer: () => void
}

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

export function chaveDosPinos(chave: string, sceneId: string): string {
  return `${chave}\n${sceneId}`
}

/** "Ilha › Vila": sobe pelos `parentId`, sem laço. */
function trilhaDa(cena: SceneEntry, porId: ReadonlyMap<string, SceneEntry>): string {
  const nomes = [cena.name]
  const vistos = new Set([cena.id])
  let pai = cena.parentId === undefined ? undefined : porId.get(cena.parentId)
  while (pai !== undefined && !vistos.has(pai.id)) {
    nomes.unshift(pai.name)
    vistos.add(pai.id)
    pai = pai.parentId === undefined ? undefined : porId.get(pai.parentId)
  }
  return nomes.join(' › ')
}

/** As cenas de uma aventura como o link as vê, com o arquivo relativo à pasta dela (`file`). */
function cenasDaAventura(cenas: readonly SceneEntry[]): (Omit<CenaNoCatalogo, 'arquivo'> & { readonly file: string })[] {
  const porId = new Map(cenas.map((cena) => [cena.id, cena]))
  return cenas.map((cena) => ({ id: cena.id, nome: cena.name, trilha: trilhaDa(cena, porId), raiz: ehArquivoDaRaiz(cena.file), file: cena.file }))
}

async function cenasDoMapa(pasta: string): Promise<CenaNoCatalogo[] | null> {
  const caminho = await join(pasta, ADVENTURE_FILE)
  if (!(await exists(caminho))) return null
  const aventura = parseAdventure(await readTextFile(caminho))
  return Promise.all(cenasDaAventura(aventura.scenes).map(async ({ file, ...cena }) => ({ ...cena, arquivo: await join(pasta, file) })))
}

async function lerTodosOsMapas(): Promise<ReadonlyMap<string, MapaNoCatalogo>> {
  const raiz = await defaultMapsDir()
  const lista = await listSavedMaps()
  const mapas = await Promise.all(
    lista.map(async (entrada): Promise<MapaNoCatalogo> => {
      const naoAbriu: MapaNoCatalogo = { chave: entrada.id, nome: entrada.name, caminho: entrada.path, cenas: null, abriu: false }
      // O map.json danificado continua no catálogo: o link para ele fica neutro, não "não existe mais".
      if (entrada.damaged === true) return naoAbriu
      try {
        return { chave: entrada.id, nome: entrada.name, caminho: entrada.path, cenas: await cenasDoMapa(await join(raiz, entrada.id)), abriu: true }
      } catch {
        // A aventura que não abre fica fora da escolha; um link para ela fica neutro, não "quebrado".
        return naoAbriu
      }
    }),
  )
  return new Map(mapas.map((mapa) => [mapa.chave, mapa]))
}

/** O nome que o mestre reconhece: o do pino, senão o começo da descrição. */
function nomeDoPino(pino: { nome?: string; description: string }, indice: number): string {
  if (pino.nome !== undefined && pino.nome.trim() !== '') return pino.nome
  const descricao = pino.description.trim().replace(/\s+/g, ' ')
  return descricao === '' ? `Pino ${indice + 1} (sem nome)` : descricao.length > 40 ? `${descricao.slice(0, 39)}…` : descricao
}

function pinosDoMapa(pinos: MapData['pins']): ItemDoCatalogo[] {
  return pinos.map((pino, indice) => ({ id: pino.id, nome: nomeDoPino(pino, indice) }))
}

/**
 * A cena do link. `sceneId` vazio é o link de quando o mapa não tinha cenas:
 * com cenas, ele vale a cena que mora no map.json da raiz (a aventura que nasce
 * do mapa solto dá a ela um id novo). `null` = o mapa sem cenas; `undefined` =
 * a cena não existe mais.
 */
function cenaDoLink<C extends { readonly id: string; readonly raiz: boolean }>(cenas: readonly C[] | null, sceneId: string): C | null | undefined {
  if (cenas === null) return sceneId === '' ? null : undefined
  return sceneId === '' ? cenas.find((cena) => cena.raiz) : cenas.find((cena) => cena.id === sceneId)
}

/** O id da cena do link na aventura aberta: `null` = o mapa sem cenas, ou a cena da raiz que não existe mais (quem chama confere). */
export function cenaDoLinkNaAventura(cenas: readonly SceneEntry[], sceneId: string): string | null {
  if (sceneId !== '') return sceneId
  return cenas.find((cena) => ehArquivoDaRaiz(cena.file))?.id ?? null
}

export const useCatalogoDaMesa = create<EstadoDoCatalogo>()((set, get) => ({
  mapas: null,
  pastas: null,
  pinos: new Map(),
  fichas: new Map(),

  lerMapas() {
    if (get().mapas !== null) return
    set({ mapas: { t: 'lendo' } })
    lerTodosOsMapas().then(
      (valor) => set({ mapas: { t: 'lido', valor } }),
      (erro: unknown) => set({ mapas: { t: 'falhou', motivo: motivo(erro) } }),
    )
  },

  lerPastas() {
    if (get().pastas !== null) return
    set({ pastas: { t: 'lendo' } })
    lerIndiceDasPastas().then(
      ({ indice }) => set({ pastas: { t: 'lido', valor: new Map(indice.pastas.map((pasta) => [pasta.id, pasta.nome])) } }),
      (erro: unknown) => set({ pastas: { t: 'falhou', motivo: motivo(erro) } }),
    )
  },

  lerPinos(chave, sceneId) {
    const qual = chaveDosPinos(chave, sceneId)
    if (get().pinos.has(qual)) return
    const guardar = (leitura: Leitura<readonly ItemDoCatalogo[]>) => set({ pinos: new Map(get().pinos).set(qual, leitura) })
    guardar({ t: 'lendo' })
    const mapas = get().mapas
    void (async () => {
      try {
        const lido = mapas !== null && mapas.t === 'lido' ? mapas.valor : await lerTodosOsMapas()
        const mapa = lido.get(chave)
        if (mapa !== undefined && !mapa.abriu) return guardar({ t: 'falhou', motivo: 'O mapa não abriu.' })
        const cena = mapa === undefined ? undefined : cenaDoLink(mapa.cenas, sceneId)
        const arquivo = mapa === undefined || cena === undefined ? undefined : cena === null ? mapa.caminho : cena.arquivo
        if (arquivo === undefined) return guardar({ t: 'lido', valor: [] })
        guardar({ t: 'lido', valor: pinosDoMapa((await loadMapFromDisk(arquivo)).pins) })
      } catch (erro) {
        guardar({ t: 'falhou', motivo: motivo(erro) })
      }
    })()
  },

  lerFichas(pastaId) {
    if (get().fichas.has(pastaId)) return
    const guardar = (leitura: Leitura<readonly ItemDoCatalogo[]>) => set({ fichas: new Map(get().fichas).set(pastaId, leitura) })
    guardar({ t: 'lendo' })
    lerRpgDaPasta(pastaId).then(
      (lido) =>
        guardar(
          lido.ok
            ? { t: 'lido', valor: lido.rpg.personagens.map((personagem) => ({ id: personagem.id, nome: personagem.nome || 'Ficha sem nome', detalhe: personagem.tipo === 'npc' ? 'NPC' : 'Jogador' })) }
            : { t: 'falhou', motivo: lido.motivo },
        ),
      (erro: unknown) => guardar({ t: 'falhou', motivo: motivo(erro) }),
    )
  },

  esquecer() {
    set({ mapas: null, pastas: null, pinos: new Map(), fichas: new Map() })
  },
}))

// ─── O mapa aberto no editor ─────────────────────────────────────────────────

/** O mapa aberto no editor, como está na memória (com o que ainda não foi salvo): é ele que vale para os links dele. */
export interface MapaNaMemoria {
  readonly chave: string
  readonly nome: string
  /** `null` = mapa sem cenas. */
  readonly cenas: readonly Omit<CenaNoCatalogo, 'arquivo'>[] | null
  /** Os pinos de uma cena carregada (`''` = o mapa sem cenas); `undefined` = a cena não está na memória e vale o disco. */
  readonly pinosDa: (sceneId: string) => readonly ItemDoCatalogo[] | undefined
}

type EstadoDaAventura = ReturnType<typeof useAdventureStore.getState>
type LojasDoMapa = {
  readonly aventura: Pick<EstadoDaAventura, 'pasta' | 'dir' | 'adventure' | 'activeSceneId' | 'cache'>
  readonly aberto: Pick<MapData, 'id' | 'name' | 'pins'>
}

function ultimoTrecho(caminho: string): string {
  return caminho.replace(/\\/g, '/').replace(/\/+$/, '').split('/').pop() ?? ''
}

/**
 * A chave do mapa aberto como a lista de mapas a dá: a da pasta de mapas; na
 * aventura, o nome da pasta dela; no mapa solto, o id dele (`listSavedMaps`).
 */
export function mapaNaMemoria({ aventura, aberto }: LojasDoMapa): MapaNaMemoria | null {
  const { pasta, dir, adventure, activeSceneId, cache } = aventura
  const chave = pasta?.chave ?? (adventure === null ? aberto.id : dir === null ? '' : ultimoTrecho(dir))
  if (chave === '') return null
  return {
    chave,
    nome: adventure?.name ?? aberto.name,
    cenas: adventure === null ? null : cenasDaAventura(adventure.scenes),
    pinosDa: (sceneId) => {
      if (adventure === null) return sceneId === '' ? pinosDoMapa(aberto.pins) : undefined
      if (sceneId === activeSceneId) return pinosDoMapa(aberto.pins)
      const slot = cache[sceneId]
      return slot !== undefined && slot.status === 'ok' ? pinosDoMapa(slot.map.pins) : undefined
    },
  }
}

/** O mapa aberto agora (fora da renderização). */
export function mapaNaMemoriaAgora(): MapaNaMemoria | null {
  return mapaNaMemoria({ aventura: useAdventureStore.getState(), aberto: useMapStore.getState().map })
}

/** O mapa aberto, acompanhando as lojas: apagar uma cena ou um pino no editor já muda o link. */
export function useMapaNaMemoria(): MapaNaMemoria | null {
  const pasta = useAdventureStore((estado) => estado.pasta)
  const dir = useAdventureStore((estado) => estado.dir)
  const adventure = useAdventureStore((estado) => estado.adventure)
  const activeSceneId = useAdventureStore((estado) => estado.activeSceneId)
  const cache = useAdventureStore((estado) => estado.cache)
  const id = useMapStore((estado) => estado.map.id)
  const name = useMapStore((estado) => estado.map.name)
  const pins = useMapStore((estado) => estado.map.pins)
  return useMemo(() => mapaNaMemoria({ aventura: { pasta, dir, adventure, activeSceneId, cache }, aberto: { id, name, pins } }), [pasta, dir, adventure, activeSceneId, cache, id, name, pins])
}

// ─── O estado de um link ─────────────────────────────────────────────────────

export type EstadoDoLink =
  /** Ainda lendo, ou o disco não respondeu, ou o mapa não abriu: o link fica neutro. */
  | { readonly t: 'lendo' }
  | { readonly t: 'ok'; readonly nome: string; readonly onde: string }
  | { readonly t: 'quebrado'; readonly aviso: string }

type Catalogo = Pick<EstadoDoCatalogo, 'mapas' | 'pastas' | 'pinos' | 'fichas'>

const LENDO: EstadoDoLink = { t: 'lendo' }

/** Pede ao disco o que falta para dizer se o link existe (fora da renderização: ler muda a loja). */
export function pedirLeitura(alvo: AlvoNaMesa): void {
  queueMicrotask(() => {
    const catalogo = useCatalogoDaMesa.getState()
    if (alvo.tipo === 'ficha') {
      catalogo.lerPastas()
      catalogo.lerFichas(alvo.pastaId)
      return
    }
    catalogo.lerMapas()
    if (alvo.pinoId !== undefined) catalogo.lerPinos(alvo.chave, alvo.sceneId)
  })
}

/** A cena e o pino do link, numa lista de cenas (a do disco ou a da memória). `pinos` = `null` enquanto não se sabe. */
function estadoDaCena(alvo: LigaCena, nomeDoMapa: string, cenas: readonly Omit<CenaNoCatalogo, 'arquivo'>[] | null, pinos: (sceneId: string) => readonly ItemDoCatalogo[] | null): EstadoDoLink {
  const cena = cenaDoLink(cenas, alvo.sceneId)
  if (cena === undefined) return { t: 'quebrado', aviso: 'A cena deste link não existe mais.' }
  const onde = cena === null ? nomeDoMapa : `${nomeDoMapa} › ${cena.trilha}`
  if (alvo.pinoId === undefined) return { t: 'ok', nome: cena?.nome ?? nomeDoMapa, onde }
  const lista = pinos(cena === null ? '' : cena.id)
  if (lista === null) return LENDO
  const pino = lista.find((um) => um.id === alvo.pinoId)
  return pino === undefined ? { t: 'quebrado', aviso: 'O pino deste link não existe mais.' } : { t: 'ok', nome: pino.nome, onde }
}

export function estadoDoLink(alvo: AlvoNaMesa, catalogo: Catalogo, naMemoria: MapaNaMemoria | null = null): EstadoDoLink {
  if (alvo.tipo === 'ficha') {
    const { pastas } = catalogo
    if (pastas === null || pastas.t !== 'lido') return LENDO
    const pasta = pastas.valor.get(alvo.pastaId)
    if (pasta === undefined) return { t: 'quebrado', aviso: 'A pasta desta ficha não existe mais.' }
    const fichas = catalogo.fichas.get(alvo.pastaId)
    if (fichas === undefined || fichas.t !== 'lido') return LENDO
    const ficha = fichas.valor.find((uma) => uma.id === alvo.personagemId)
    return ficha === undefined ? { t: 'quebrado', aviso: 'Esta ficha não existe mais.' } : { t: 'ok', nome: ficha.nome, onde: `${ficha.detalhe ?? 'Ficha'} na pasta ${pasta}` }
  }
  // Os pinos que o disco já leu (a cena que não está na memória vale o disco).
  const doDisco = (): readonly ItemDoCatalogo[] | null => {
    const lidos = catalogo.pinos.get(chaveDosPinos(alvo.chave, alvo.sceneId))
    return lidos !== undefined && lidos.t === 'lido' ? lidos.valor : null
  }
  // O mapa aberto no editor manda: a cena ou o pino apagado e ainda não salvo já some do link.
  if (naMemoria !== null && naMemoria.chave === alvo.chave) return estadoDaCena(alvo, naMemoria.nome, naMemoria.cenas, (sceneId) => naMemoria.pinosDa(sceneId) ?? doDisco())
  const { mapas } = catalogo
  if (mapas === null || mapas.t !== 'lido') return LENDO
  const mapa = mapas.valor.get(alvo.chave)
  if (mapa === undefined) return { t: 'quebrado', aviso: 'O mapa deste link não existe mais.' }
  // Não abriu (danificado, aventura ilegível): não se sabe se a cena e o pino existem.
  if (!mapa.abriu) return LENDO
  return estadoDaCena(alvo, mapa.nome, mapa.cenas, doDisco)
}

/** O estado do link, já pedindo ao disco o que falta. */
export function useEstadoDoLink(alvo: AlvoNaMesa): EstadoDoLink {
  const mapas = useCatalogoDaMesa((estado) => estado.mapas)
  const pastas = useCatalogoDaMesa((estado) => estado.pastas)
  const pinos = useCatalogoDaMesa((estado) => estado.pinos)
  const fichas = useCatalogoDaMesa((estado) => estado.fichas)
  const naMemoria = useMapaNaMemoria()
  const estado = estadoDoLink(alvo, { mapas, pastas, pinos, fichas }, naMemoria)
  if (estado.t === 'lendo') pedirLeitura(alvo)
  return estado
}
