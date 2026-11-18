import { create } from 'zustand'
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { CUTSCENE_TITULO_MAX, ehIdDeVideo } from '../net/protocol'
import { ehRefDeMidia } from '../lib/midia'
import { campanhaDaPastaAberta, enviarVideoParaAGaleria, GALERIA_VIDEO_MAX_BYTES, lerGaleria, mensagemDaFalha } from '../net/nuvem/galeriaNaNuvem'

/**
 * CUTSCENES DO MESTRE (14/11/2026): a lista da página Cutscenes do livro da
 * mesa, guardada em `<appData>/cutscenes.json` (do app, como a mídia: o vídeo
 * mora em `<appData>/midia/<sha256>.<ext>`), e a exibição em curso, que a
 * ponte do mestre (`hostBridge.ts`) escreve e a página lê.
 */

/** O mesmo teto do Rust (`MIDIA_VIDEO_MAX_BYTES`): mp4/webm sem comprimir, até 500 MB. */
export const VIDEO_MAX_BYTES = 500 * 1024 * 1024
const ARQUIVO = 'cutscenes.json'
/** Teto da lista: um arquivo pequeno, que o app lê inteiro. */
export const CUTSCENES_MAX = 200

export type EstadoNaGaleria =
  | { estado: 'enviando'; campanhaId: string; pct: number }
  | { estado: 'enviado'; campanhaId: string }
  | { estado: 'erro'; campanhaId: string | null; erro: string }
  | { estado: 'grande' }

export interface Cutscene {
  id: string
  titulo: string
  /** `<sha256>.<mp4|webm>` na mídia da mesa. */
  video: string
  tamanho: number
  /** "Na Galeria": depois da 1ª exibição, o vídeo sobe para o site dos jogadores. */
  naGaleria: boolean
  /** Já chegou ao fim numa tela da mesa ao menos uma vez. */
  exibida: boolean
  galeria?: EstadoNaGaleria
  /**
   * A imagem da linha (`midia:<sha256>.webp`, 320x180, na mídia da mesa): o
   * quadro de ~1 s tirado sozinho, ou o que o mestre escolheu no "Assistir".
   * Só do mestre: não vai para a mesa nem para a Galeria. Sem ela (arquivo de
   * antes de 18/11, ou o vídeo que não deu quadro), a linha mostra o ícone.
   */
  miniatura?: string
}

export interface TelaDaExibicao {
  clientId: string
  nome: string
  pct: number
  pronta: boolean
  falhou: boolean
  terminou: boolean
}

export interface ExibicaoEmCurso {
  numero: number
  cutsceneId: string
  titulo: string
  fase: 'esperando' | 'tocando'
  telas: TelaDaExibicao[]
}

interface CutscenesState {
  lista: Cutscene[]
  carregada: boolean
  exibicao: ExibicaoEmCurso | null
  carregar: () => Promise<void>
  adicionar: (cutscene: Cutscene) => void
  mudar: (id: string, mudanca: Partial<Omit<Cutscene, 'id' | 'video' | 'tamanho'>>) => void
  remover: (id: string) => void
  /** A miniatura tirada sozinha: vale para toda linha deste vídeo que ainda não tem uma (a escolhida no "Assistir" fica). */
  darMiniaturaAoVideo: (video: string, miniatura: string) => void
  definirExibicao: (exibicao: ExibicaoEmCurso | null) => void
  /** A ponte avisa: a cutscene chegou ao fim numa tela. Com "Na Galeria", sobe o vídeo. */
  marcarExibida: (id: string) => void
  /** Sobe (ou tenta de novo) o vídeo para a Galeria da campanha da pasta aberta. */
  enviarParaAGaleria: (id: string) => Promise<void>
  /**
   * Relê a Galeria do site da campanha da pasta aberta e acerta a lista: o que
   * o mestre tirou pelo site deixa de estar "Na Galeria"; o que está lá vira
   * "enviado". Sem rede, sem credencial ou sem campanha: fica como estava.
   */
  conferirGaleria: () => Promise<void>
}

function ehRecord(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Uma linha do arquivo, conferida; o que não confere fica de fora sem derrubar o resto. */
function lerCutscene(bruta: unknown): Cutscene | null {
  if (!ehRecord(bruta)) return null
  const { id, titulo, video, tamanho, naGaleria, exibida, galeria, miniatura } = bruta
  if (typeof id !== 'string' || id === '' || typeof titulo !== 'string' || titulo.trim() === '' || titulo.length > CUTSCENE_TITULO_MAX) return null
  if (!ehIdDeVideo(video) || typeof tamanho !== 'number' || !Number.isFinite(tamanho) || tamanho <= 0) return null
  const cutscene: Cutscene = { id, titulo, video, tamanho, naGaleria: naGaleria === true, exibida: exibida === true }
  // Só a referência de imagem da mídia: caminho de disco ou URL de fora nunca vira `src`.
  if (ehRefDeMidia(miniatura)) cutscene.miniatura = miniatura
  // Só o que já terminou volta do disco: "enviando" de uma sessão que fechou no meio vira "erro".
  if (ehRecord(galeria) && galeria.estado === 'enviado' && typeof galeria.campanhaId === 'string') cutscene.galeria = { estado: 'enviado', campanhaId: galeria.campanhaId }
  else if (ehRecord(galeria) && galeria.estado === 'grande') cutscene.galeria = { estado: 'grande' }
  else if (ehRecord(galeria)) cutscene.galeria = { estado: 'erro', campanhaId: null, erro: 'A subida para a Galeria parou no meio. Tente de novo.' }
  return cutscene
}

async function caminhoDoArquivo(): Promise<string> {
  return join(await appDataDir(), ARQUIVO)
}

async function lerDoDisco(): Promise<Cutscene[]> {
  const caminho = await caminhoDoArquivo()
  if (!(await exists(caminho))) return []
  try {
    const bruto: unknown = JSON.parse(await readTextFile(caminho))
    const lista = ehRecord(bruto) && Array.isArray(bruto.cutscenes) ? bruto.cutscenes : []
    return lista.flatMap((linha) => lerCutscene(linha) ?? []).slice(0, CUTSCENES_MAX)
  } catch {
    return []
  }
}

/** Uma gravação por vez, sempre a lista mais nova: duas mudanças seguidas não trocam de ordem no disco. */
let gravando: Promise<void> = Promise.resolve()
function gravarNoDisco(lista: readonly Cutscene[]): void {
  const texto = JSON.stringify({ versao: 1, cutscenes: lista }, null, 2)
  gravando = gravando
    .catch(() => undefined)
    .then(async () => writeTextFile(await caminhoDoArquivo(), texto))
    .catch(() => undefined)
}

export const useCutscenesStore = create<CutscenesState>((set, get) => {
  const trocarLista = (lista: Cutscene[]): void => {
    set({ lista })
    gravarNoDisco(lista)
  }
  const mudarGaleria = (id: string, galeria: EstadoNaGaleria): void => {
    trocarLista(get().lista.map((c) => (c.id === id ? { ...c, galeria } : c)))
  }
  return {
    lista: [],
    carregada: false,
    exibicao: null,
    carregar: async () => {
      if (get().carregada) return
      const lista = await lerDoDisco()
      set({ lista, carregada: true })
    },
    adicionar: (cutscene) => {
      if (get().lista.length >= CUTSCENES_MAX) return
      trocarLista([...get().lista, cutscene])
    },
    mudar: (id, mudanca) => trocarLista(get().lista.map((c) => (c.id === id ? { ...c, ...mudanca } : c))),
    remover: (id) => trocarLista(get().lista.filter((c) => c.id !== id)),
    darMiniaturaAoVideo: (video, miniatura) => {
      const lista = get().lista
      if (!lista.some((c) => c.video === video && c.miniatura === undefined)) return
      trocarLista(lista.map((c) => (c.video === video && c.miniatura === undefined ? { ...c, miniatura } : c)))
    },
    definirExibicao: (exibicao) => set({ exibicao }),
    marcarExibida: (id) => {
      const cutscene = get().lista.find((c) => c.id === id)
      if (cutscene === undefined) return
      if (!cutscene.exibida) trocarLista(get().lista.map((c) => (c.id === id ? { ...c, exibida: true } : c)))
      // Já na Galeria (ou subindo): exibir de novo não sobe de novo.
      const estado = cutscene.galeria?.estado
      if (cutscene.naGaleria && estado !== 'enviado' && estado !== 'enviando') void get().enviarParaAGaleria(id)
    },
    enviarParaAGaleria: async (id) => {
      const cutscene = get().lista.find((c) => c.id === id)
      if (cutscene === undefined || cutscene.galeria?.estado === 'enviando') return
      if (cutscene.tamanho > GALERIA_VIDEO_MAX_BYTES) {
        mudarGaleria(id, { estado: 'grande' })
        return
      }
      let campanhaId: string | null = null
      try {
        campanhaId = await campanhaDaPastaAberta()
      } catch {
        campanhaId = null
      }
      if (campanhaId === null) {
        mudarGaleria(id, { estado: 'erro', campanhaId: null, erro: 'Esta aventura não está publicada no Lobby: a Galeria é do site da campanha.' })
        return
      }
      const daCampanha = campanhaId
      mudarGaleria(id, { estado: 'enviando', campanhaId: daCampanha, pct: 0 })
      try {
        await enviarVideoParaAGaleria(daCampanha, cutscene.video, cutscene.titulo, ({ enviados, total }) => {
          const pct = total > 0 ? Math.min(99, Math.floor((enviados / total) * 100)) : 0
          // Só o estado, sem regravar o disco a cada pedaço: "enviando" nem volta do disco.
          set({ lista: get().lista.map((c) => (c.id === id ? { ...c, galeria: { estado: 'enviando', campanhaId: daCampanha, pct } } : c)) })
        })
        mudarGaleria(id, { estado: 'enviado', campanhaId: daCampanha })
        void get().conferirGaleria()
      } catch (erro) {
        mudarGaleria(id, { estado: 'erro', campanhaId: daCampanha, erro: mensagemDaFalha(erro) })
      }
    },
    conferirGaleria: async () => {
      let campanhaId: string | null
      let noSite: Set<string>
      try {
        campanhaId = await campanhaDaPastaAberta()
        if (campanhaId === null) return
        noSite = await lerGaleria(campanhaId)
      } catch {
        return
      }
      const daCampanha = campanhaId
      let mudou = false
      // A lista de AGORA (a leitura levou tempo); o que está subindo não é tocado.
      const lista = get().lista.map((c): Cutscene => {
        const estado = c.galeria?.estado
        if (estado === 'enviando') return c
        const estaNoSite = noSite.has(c.video)
        if (c.galeria?.estado === 'enviado' && c.galeria.campanhaId === daCampanha && !estaNoSite) {
          mudou = true
          return { ...c, naGaleria: false, galeria: undefined }
        }
        if (estaNoSite && estado !== 'enviado') {
          mudou = true
          return { ...c, naGaleria: true, galeria: { estado: 'enviado', campanhaId: daCampanha } }
        }
        return c
      })
      if (mudou) trocarLista(lista)
    },
  }
})
