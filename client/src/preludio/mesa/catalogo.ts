import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { create } from 'zustand'
import { ADVENTURE_FILE, parseAdventure, type SceneEntry } from '../../lib/adventure'
import { defaultMapsDir, listSavedMaps, loadMapFromDisk } from '../../lib/mapFileIO'
import { lerIndiceDasPastas, lerRpgDaPasta } from '../../lib/pastasDeMapas'
import type { AlvoNaMesa } from '../../lib/preparo/sessoes'

/**
 * O QUE EXISTE NA MESA, para os links do roteiro (F4): os mapas de
 * `<appData>/maps` com as cenas, os pinos de cada cena e as fichas de cada
 * pasta. Só lê, e só o que um link ou a escolha pedem: os pinos de uma cena só
 * são lidos quando algum link aponta para ela. O que não abre conta como "não
 * sei" (o link fica neutro), nunca como "não existe mais".
 */

export interface CenaNoCatalogo {
  readonly id: string
  readonly nome: string
  /** "Ilha › Vila › Taverna": o caminho das pastas de cenas até esta. */
  readonly trilha: string
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

async function cenasDoMapa(pasta: string): Promise<CenaNoCatalogo[] | null> {
  const caminho = await join(pasta, ADVENTURE_FILE)
  if (!(await exists(caminho))) return null
  const aventura = parseAdventure(await readTextFile(caminho))
  const porId = new Map(aventura.scenes.map((cena) => [cena.id, cena]))
  return Promise.all(aventura.scenes.map(async (cena) => ({ id: cena.id, nome: cena.name, trilha: trilhaDa(cena, porId), arquivo: await join(pasta, cena.file) })))
}

async function lerTodosOsMapas(): Promise<ReadonlyMap<string, MapaNoCatalogo>> {
  const raiz = await defaultMapsDir()
  const lista = await listSavedMaps()
  const mapas = await Promise.all(
    lista
      .filter((entrada) => entrada.damaged !== true)
      .map(async (entrada): Promise<MapaNoCatalogo | null> => {
        try {
          return { chave: entrada.id, nome: entrada.name, caminho: entrada.path, cenas: await cenasDoMapa(await join(raiz, entrada.id)) }
        } catch {
          // A aventura que não abre fica fora da escolha; um link para ela fica neutro, não "quebrado".
          return null
        }
      }),
  )
  return new Map(mapas.filter((mapa): mapa is MapaNoCatalogo => mapa !== null).map((mapa) => [mapa.chave, mapa]))
}

/** O nome que o mestre reconhece: o do pino, senão o começo da descrição. */
function nomeDoPino(pino: { nome?: string; description: string }, indice: number): string {
  if (pino.nome !== undefined && pino.nome.trim() !== '') return pino.nome
  const descricao = pino.description.trim().replace(/\s+/g, ' ')
  return descricao === '' ? `Pino ${indice + 1} (sem nome)` : descricao.length > 40 ? `${descricao.slice(0, 39)}…` : descricao
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
        const arquivo = mapa === undefined ? undefined : sceneId === '' ? (mapa.cenas === null ? mapa.caminho : undefined) : mapa.cenas?.find((cena) => cena.id === sceneId)?.arquivo
        if (arquivo === undefined) return guardar({ t: 'lido', valor: [] })
        const mapaDaCena = await loadMapFromDisk(arquivo)
        guardar({ t: 'lido', valor: mapaDaCena.pins.map((pino, indice) => ({ id: pino.id, nome: nomeDoPino(pino, indice) })) })
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

// ─── O estado de um link ─────────────────────────────────────────────────────

export type EstadoDoLink =
  /** Ainda lendo, ou o disco não respondeu: o link fica neutro. */
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

export function estadoDoLink(alvo: AlvoNaMesa, catalogo: Catalogo): EstadoDoLink {
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
  const { mapas } = catalogo
  if (mapas === null || mapas.t !== 'lido') return LENDO
  const mapa = mapas.valor.get(alvo.chave)
  if (mapa === undefined) return { t: 'quebrado', aviso: 'O mapa deste link não existe mais.' }
  const cena = alvo.sceneId === '' ? undefined : mapa.cenas?.find((uma) => uma.id === alvo.sceneId)
  if (alvo.sceneId !== '' && cena === undefined) return { t: 'quebrado', aviso: 'A cena deste link não existe mais.' }
  const ondeDaCena = cena === undefined ? mapa.nome : `${mapa.nome} › ${cena.trilha}`
  if (alvo.pinoId === undefined) return { t: 'ok', nome: cena?.nome ?? mapa.nome, onde: ondeDaCena }
  const pinos = catalogo.pinos.get(chaveDosPinos(alvo.chave, alvo.sceneId))
  if (pinos === undefined || pinos.t !== 'lido') return LENDO
  const pino = pinos.valor.find((um) => um.id === alvo.pinoId)
  return pino === undefined ? { t: 'quebrado', aviso: 'O pino deste link não existe mais.' } : { t: 'ok', nome: pino.nome, onde: ondeDaCena }
}

/** O estado do link, já pedindo ao disco o que falta. */
export function useEstadoDoLink(alvo: AlvoNaMesa): EstadoDoLink {
  const mapas = useCatalogoDaMesa((estado) => estado.mapas)
  const pastas = useCatalogoDaMesa((estado) => estado.pastas)
  const pinos = useCatalogoDaMesa((estado) => estado.pinos)
  const fichas = useCatalogoDaMesa((estado) => estado.fichas)
  const estado = estadoDoLink(alvo, { mapas, pastas, pinos, fichas })
  if (estado.t === 'lendo') pedirLeitura(alvo)
  return estado
}
