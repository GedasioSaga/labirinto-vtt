import { create } from 'zustand'
import { isTauri } from '@tauri-apps/api/core'
import { appDataDir, join } from '@tauri-apps/api/path'
import { exists, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs'
import { CUTSCENE_TITULO_MAX, ehIdDeVideo } from '../net/protocol'
import { ehRefDeMidia } from '../lib/midia'
import { writeTextFileSafely } from '../lib/mapFileIO'
import { PASTA_DE_MIDIA } from '../lib/midiaNoDisco'
import type { LugarDaCutscene } from '../net/redeDaCutscene'
import { campanhaDaPastaAberta, enviarVideoParaAGaleria, GALERIA_VIDEO_MAX_BYTES, lerGaleria, mensagemDaFalha } from '../net/nuvem/galeriaNaNuvem'

/**
 * CUTSCENES DO MESTRE (14/11/2026): a lista da página Cutscenes do livro da
 * mesa, guardada em `<appData>/cutscenes.json` (do app, como a mídia: o vídeo
 * mora em `<appData>/midia/<sha256>.<ext>`), e a exibição em curso, que a
 * ponte do mestre (`hostBridge.ts`) escreve e a página lê.
 *
 * DEFESAS DO ARQUIVO (18/11/2026, análise Fable): as do acervo de itens
 * (`lib/acervoDeItens.ts`). A leitura que falha por I/O (OneDrive ou antivírus
 * segurando o arquivo) barra toda gravação (`podeGravar`): a lista vazia na
 * tela não passa por cima das 200 linhas do disco. O arquivo ilegível vai
 * para `cutscenes.json.invalido` antes de a lista recomeçar. A gravação é a
 * segura (`writeTextFileSafely`), e o erro vira `aviso` na página.
 */

/** O mesmo teto do Rust (`MIDIA_VIDEO_MAX_BYTES`): mp4/webm sem comprimir, até 500 MB. */
export const VIDEO_MAX_BYTES = 500 * 1024 * 1024
const ARQUIVO = 'cutscenes.json'
const ARQUIVO_INVALIDO = 'cutscenes.json.invalido'
const AVISO_DA_LEITURA = 'Não deu para ler a lista de cutscenes'
/** O tempo do "Desfazer" do Remover: só depois dele o vídeo sem uso sai do disco. */
export const DESFAZER_REMOCAO_MS = 10_000
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
  /**
   * `Date.now()` de quando esta exibição passou a tocar, para o tempo decorrido
   * no painel do mestre. Quem põe é a store (`definirExibicao`), não a ponte.
   */
  tocandoDesde?: number
}

/** O que deu errado com o arquivo: `leitura` barra gravar; `gravacao` some na próxima gravação que der certo. */
export interface AvisoDasCutscenes {
  tipo: 'leitura' | 'gravacao'
  texto: string
}

interface CutscenesState {
  lista: Cutscene[]
  carregada: boolean
  /** A lista foi lida do disco (ou não existia): só então mudar e gravar valem. */
  podeGravar: boolean
  aviso: AvisoDasCutscenes | null
  /** A exibição na sala de verdade. */
  exibicao: ExibicaoEmCurso | null
  /** MODO TREINO (18/11): a exibição na janela da Visão de jogador, à parte da sala (as duas podem estar no ar). */
  exibicaoDoTeste: ExibicaoEmCurso | null
  carregar: () => Promise<void>
  /** Lê o arquivo de novo (o "Tentar de novo" do aviso de leitura). */
  recarregar: () => Promise<void>
  adicionar: (cutscene: Cutscene) => void
  mudar: (id: string, mudanca: Partial<Omit<Cutscene, 'id' | 'video' | 'tamanho'>>) => void
  /**
   * Tira a linha da lista. O vídeo fica no disco por `DESFAZER_REMOCAO_MS`;
   * depois, se nenhuma linha usa o mesmo vídeo, sai da mídia da mesa.
   * `false` = nada saiu (id que não existe ou lista não lida).
   */
  remover: (id: string) => boolean
  /** O "Desfazer" do Remover: a linha volta ao mesmo lugar e o vídeo fica. */
  desfazerRemocao: (id: string) => void
  /** A miniatura tirada sozinha: vale para toda linha deste vídeo que ainda não tem uma (a escolhida no "Assistir" fica). */
  darMiniaturaAoVideo: (video: string, miniatura: string) => void
  /** A ponte escreve a exibição do lugar dela; ausente = a sala. */
  definirExibicao: (exibicao: ExibicaoEmCurso | null, lugar?: LugarDaCutscene) => void
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

function motivo(causa: unknown): string {
  const texto = causa instanceof Error ? causa.message : String(causa)
  return /os error 5\b|denied|negado/i.test(texto) ? 'o Windows negou o acesso ao arquivo (outro programa pode estar com ele aberto)' : texto
}

/** A lista do texto do arquivo; `null` = o texto não é a lista (JSON cortado, outro formato). Linha torta fica de fora sem derrubar o resto. */
function listaDoTexto(texto: string): Cutscene[] | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return null
  }
  if (!ehRecord(bruto) || !Array.isArray(bruto.cutscenes)) return null
  return bruto.cutscenes.flatMap((linha) => lerCutscene(linha) ?? []).slice(0, CUTSCENES_MAX)
}

interface ListaLida {
  lista: Cutscene[]
  aviso: string | null
  /** `false` = não dá para gravar por cima (o disco não respondeu, ou o ilegível não ganhou cópia). */
  lido: boolean
}

/** Lê a lista. Nunca lança: o erro vira `aviso`, e `lido: false` barra quem grava. */
async function lerDoDisco(): Promise<ListaLida> {
  let texto: string
  try {
    const caminho = await caminhoDoArquivo()
    if (!(await exists(caminho))) return { lista: [], aviso: null, lido: true }
    texto = await readTextFile(caminho)
  } catch (erro) {
    return { lista: [], aviso: `${AVISO_DA_LEITURA}: ${motivo(erro)}. Nada muda no arquivo até ela abrir.`, lido: false }
  }
  const lista = listaDoTexto(texto)
  if (lista !== null) return { lista, aviso: null, lido: true }
  try {
    await writeTextFile(await join(await appDataDir(), ARQUIVO_INVALIDO), texto)
  } catch {
    // Sem a cópia, a lista NÃO recomeça: gravar agora passaria por cima do único exemplar.
    return { lista: [], aviso: `${AVISO_DA_LEITURA}: o arquivo estava ilegível e não deu para guardar uma cópia dele.`, lido: false }
  }
  return { lista: [], aviso: `${AVISO_DA_LEITURA}: o arquivo estava ilegível. A lista começa vazia, e o arquivo antigo ficou guardado como ${ARQUIVO_INVALIDO}, na pasta do app.`, lido: true }
}

/** Uma gravação por vez, sempre a lista mais nova: duas mudanças seguidas não trocam de ordem no disco. */
let gravando: Promise<void> = Promise.resolve()
function gravarNoDisco(lista: readonly Cutscene[], aoTerminar: (erro: string | null) => void): void {
  const texto = JSON.stringify({ versao: 1, cutscenes: lista }, null, 2)
  gravando = gravando
    .catch(() => undefined)
    .then(async () => writeTextFileSafely(await caminhoDoArquivo(), texto))
    .then(
      () => aoTerminar(null),
      (erro: unknown) => aoTerminar(`Não deu para gravar a lista de cutscenes: ${motivo(erro)}. A última mudança vale só até fechar o app.`),
    )
}

/** Tira o vídeo da mídia da mesa. Melhor esforço: o que não sai fica no disco, sem aviso (a lista já não o mostra). */
async function apagarVideoDoDisco(video: string): Promise<void> {
  // O id veio conferido (`ehIdDeVideo`: 64 hex + extensão): o caminho não sai da pasta da mídia.
  if (!ehIdDeVideo(video)) return
  try {
    const caminho = await join(await appDataDir(), PASTA_DE_MIDIA, video)
    if (await exists(caminho)) await remove(caminho)
  } catch {
    // Vídeo preso (o "Assistir" de outra janela, o antivírus): fica no disco.
  }
}

/** A exibição com a hora em que começou a tocar: a mesma exibição guarda a primeira hora; esperando, não há hora. */
function comTocandoDesde(exibicao: ExibicaoEmCurso, antes: ExibicaoEmCurso | null): ExibicaoEmCurso {
  const { tocandoDesde: _daPonte, ...semHora } = exibicao
  if (exibicao.fase !== 'tocando') return semHora
  const mesma = antes !== null && antes.numero === exibicao.numero && antes.tocandoDesde !== undefined
  return { ...semHora, tocandoDesde: mesma ? antes.tocandoDesde : Date.now() }
}

/** A linha removida, à espera do "Desfazer"; o vídeo só sai do disco quando o prazo acaba. */
interface Remocao {
  cutscene: Cutscene
  indice: number
  prazo: ReturnType<typeof setTimeout>
}

export const useCutscenesStore = create<CutscenesState>((set, get) => {
  const remocoes = new Map<string, Remocao>()
  const aoGravar = (erro: string | null): void => {
    if (erro !== null) set({ aviso: { tipo: 'gravacao', texto: erro } })
    else if (get().aviso?.tipo === 'gravacao') set({ aviso: null })
  }
  /** Lista não lida: nada muda (a tela vazia não vale como lista). */
  const trocarLista = (lista: Cutscene[]): void => {
    if (!get().podeGravar) return
    set({ lista })
    gravarNoDisco(lista, aoGravar)
  }
  const mudarGaleria = (id: string, galeria: EstadoNaGaleria): void => {
    trocarLista(get().lista.map((c) => (c.id === id ? { ...c, galeria } : c)))
  }
  /** O vídeo sai do disco se nenhuma linha (nem outra remoção à espera) usa o mesmo arquivo. */
  const apagarSeSemUso = (video: string): void => {
    if (get().lista.some((c) => c.video === video)) return
    if ([...remocoes.values()].some((r) => r.cutscene.video === video)) return
    // A remoção espera a mesa livre (a página só remove sem exibição), e a linha que saiu não toca: o arquivo não está no ar.
    void apagarVideoDoDisco(video)
  }
  const ler = async (): Promise<void> => {
    // Fora do app não há disco: a lista fica vazia, sem aviso sobre o que nem é oferecido.
    if (!isTauri()) {
      set({ lista: [], carregada: true, podeGravar: false, aviso: null })
      return
    }
    const lida = await lerDoDisco()
    set({ lista: lida.lista, carregada: true, podeGravar: lida.lido, aviso: lida.aviso === null ? null : { tipo: 'leitura', texto: lida.aviso } })
  }
  return {
    lista: [],
    carregada: false,
    podeGravar: false,
    aviso: null,
    exibicao: null,
    exibicaoDoTeste: null,
    carregar: async () => {
      if (get().carregada) return
      await ler()
    },
    recarregar: ler,
    adicionar: (cutscene) => {
      if (get().lista.length >= CUTSCENES_MAX) return
      trocarLista([...get().lista, cutscene])
    },
    mudar: (id, mudanca) => trocarLista(get().lista.map((c) => (c.id === id ? { ...c, ...mudanca } : c))),
    remover: (id) => {
      const lista = get().lista
      const indice = lista.findIndex((c) => c.id === id)
      const cutscene = lista[indice]
      if (cutscene === undefined || !get().podeGravar) return false
      trocarLista(lista.filter((c) => c.id !== id))
      const prazo = setTimeout(() => {
        remocoes.delete(id)
        apagarSeSemUso(cutscene.video)
      }, DESFAZER_REMOCAO_MS)
      remocoes.set(id, { cutscene, indice, prazo })
      return true
    },
    desfazerRemocao: (id) => {
      const remocao = remocoes.get(id)
      if (remocao === undefined) return
      clearTimeout(remocao.prazo)
      remocoes.delete(id)
      const lista = get().lista
      if (lista.some((c) => c.id === id) || lista.length >= CUTSCENES_MAX) return
      const indice = Math.min(remocao.indice, lista.length)
      trocarLista([...lista.slice(0, indice), remocao.cutscene, ...lista.slice(indice)])
    },
    darMiniaturaAoVideo: (video, miniatura) => {
      const lista = get().lista
      if (!lista.some((c) => c.video === video && c.miniatura === undefined)) return
      trocarLista(lista.map((c) => (c.video === video && c.miniatura === undefined ? { ...c, miniatura } : c)))
    },
    definirExibicao: (exibicao, lugar = 'sala') => {
      const antes = lugar === 'teste' ? get().exibicaoDoTeste : get().exibicao
      const comTempo = exibicao === null ? null : comTocandoDesde(exibicao, antes)
      set(lugar === 'teste' ? { exibicaoDoTeste: comTempo } : { exibicao: comTempo })
    },
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
