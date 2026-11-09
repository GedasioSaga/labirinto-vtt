import { create } from 'zustand'
import { gravarVerbete, lerIndiceDoPreparo, lerVerbete, listarNoPreparo } from '../../lib/preparo/disco'
import { IndiceDeCitacoes, entradaDaBusca, type EntradaDaBusca } from '../../lib/preparo/enciclopedia'
import type { Campanha, TipoDeVerbete, Verbete } from '../../lib/preparo/tipos'
import { prepararMidia } from '../midia'

/**
 * O PRELÚDIO ABERTO: os verbetes lidos de `<appData>/preparo/verbetes/`, para
 * onde a tela está olhando e o salvar automático (resposta do mestre, 08/11:
 * "automático + cópia diária"; a cópia diária é a do Google Drive, em
 * `copia/PainelDaCopia.tsx`, que roda ao abrir o Prelúdio).
 *
 * - Cada mudança vale na memória na hora (a busca e o "Citado em" já veem) e
 *   vai para o disco 800 ms depois da última, como as notas do Grimório.
 * - Verbete que abriu só para leitura (formato mais novo, nome de arquivo
 *   diferente do id) nunca é gravado; enquanto a importação ou a restauração
 *   gravam em preparo/ (`travado`), ninguém edita.
 * - Falha ao gravar não perde nada: o texto fica na memória, o aviso aparece e
 *   "Tentar de novo" grava outra vez.
 */

export type Lugar =
  | { readonly secao: 'inicio' }
  | { readonly secao: 'enciclopedia'; readonly tipo: TipoDeVerbete | 'todos'; readonly verbeteId: string | null }
  | { readonly secao: 'escrita'; readonly paginaId: string | null }

export type Carga = { readonly t: 'fechada' } | { readonly t: 'lendo' } | { readonly t: 'pronta' } | { readonly t: 'falhou'; readonly aviso: string }

export type Salvamento = { readonly t: 'em-dia' } | { readonly t: 'esperando' } | { readonly t: 'salvando' } | { readonly t: 'falhou'; readonly motivo: string }

interface EstadoDoPreludio {
  carga: Carga
  campanhas: readonly Campanha[]
  verbetes: ReadonlyMap<string, Verbete>
  /** Id → por que abre só para leitura. */
  soLeitura: ReadonlyMap<string, string>
  /** Verbetes que não abriram de jeito nenhum (danificados sem cópia). */
  avisos: readonly string[]
  /** Sobe a cada mudança num verbete: o que é calculado por cima (busca, citações) refaz por ela. */
  versao: number
  salvamento: Salvamento
  travado: boolean
  lugar: Lugar
  /** O filtro "Campanha" da barra lateral; `null` = todas. */
  campanhaId: string | null
  carregar: () => Promise<void>
  fechar: () => Promise<void>
  ir: (lugar: Lugar) => void
  escolherCampanha: (campanhaId: string | null) => void
  travar: (travado: boolean) => void
  /** Muda um verbete na memória e agenda a gravação. Só leitura ou travado: nada acontece. */
  mudarVerbete: (id: string, mudar: (verbete: Verbete) => Verbete) => void
  /** Põe um verbete novo na memória e grava na hora. */
  criarVerbete: (verbete: Verbete) => Promise<void>
  salvarPendentes: () => Promise<void>
  tentarDeNovo: () => void
}

const ESPERA_PARA_SALVAR_MS = 800
const CHAVE_DA_CAMPANHA = 'lb-preparo:campanha'

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

function campanhaGuardada(): string | null {
  try {
    return window.localStorage.getItem(CHAVE_DA_CAMPANHA)
  } catch {
    return null
  }
}

function guardarCampanha(campanhaId: string | null): void {
  try {
    if (campanhaId === null) window.localStorage.removeItem(CHAVE_DA_CAMPANHA)
    else window.localStorage.setItem(CHAVE_DA_CAMPANHA, campanhaId)
  } catch {
    // Sem armazenamento, o filtro só não volta na próxima vez.
  }
}

// ─── Gravação ────────────────────────────────────────────────────────────────

const agendados = new Map<string, ReturnType<typeof setTimeout>>()
/** Mudou e ainda não foi para o disco (inclusive o que falhou). */
const sujos = new Set<string>()
const emVoo = new Set<Promise<void>>()
let ultimaFalha: string | null = null
let citacoes = new IndiceDeCitacoes()
/** Cada abrir e fechar ganha um número: a leitura que terminou depois de outro abrir (ou do fechar) é jogada fora. */
let geracao = 0

function situacao(): Salvamento {
  if (ultimaFalha !== null) return { t: 'falhou', motivo: ultimaFalha }
  if (agendados.size > 0) return { t: 'esperando' }
  if (emVoo.size > 0) return { t: 'salvando' }
  return { t: 'em-dia' }
}

function gravar(id: string): Promise<void> {
  const verbete = usePreludio.getState().verbetes.get(id)
  sujos.delete(id)
  if (verbete === undefined || usePreludio.getState().soLeitura.has(id)) return Promise.resolve()
  const tarefa = gravarVerbete(verbete)
    .then(() => {
      if (!sujos.has(id) && [...sujos].every((outro) => agendados.has(outro))) ultimaFalha = null
    })
    .catch((erro: unknown) => {
      sujos.add(id)
      ultimaFalha = motivo(erro)
    })
    .finally(() => {
      emVoo.delete(tarefa)
      usePreludio.setState({ salvamento: situacao() })
    })
  emVoo.add(tarefa)
  usePreludio.setState({ salvamento: situacao() })
  return tarefa
}

function agendar(id: string): void {
  sujos.add(id)
  const antes = agendados.get(id)
  if (antes !== undefined) clearTimeout(antes)
  agendados.set(
    id,
    setTimeout(() => {
      agendados.delete(id)
      void gravar(id)
    }, ESPERA_PARA_SALVAR_MS),
  )
}

async function gravarTudoAgora(): Promise<void> {
  for (const [id, relogio] of agendados) {
    clearTimeout(relogio)
    agendados.delete(id)
  }
  for (const id of [...sujos]) void gravar(id)
  while (emVoo.size > 0) await Promise.all([...emVoo])
}

// ─── Busca ───────────────────────────────────────────────────────────────────

/** A entrada de cada verbete, refeita só quando o verbete mudou (mesmo objeto = mesma entrada). */
const entradasGuardadas = new WeakMap<Verbete, EntradaDaBusca>()

export function entradasDaBusca(verbetes: ReadonlyMap<string, Verbete>): EntradaDaBusca[] {
  const saida: EntradaDaBusca[] = []
  for (const verbete of verbetes.values()) {
    let entrada = entradasGuardadas.get(verbete)
    if (entrada === undefined) {
      entrada = entradaDaBusca(verbete)
      entradasGuardadas.set(verbete, entrada)
    }
    saida.push(entrada)
  }
  return saida
}

/** Quem @menciona o verbete, pelo índice mantido a cada mudança. */
export function citadoEm(id: string): string[] {
  return citacoes.citadoEm(id)
}

// ─── A loja ──────────────────────────────────────────────────────────────────

const INICIO: Lugar = { secao: 'inicio' }

export const usePreludio = create<EstadoDoPreludio>()((set, get) => ({
  carga: { t: 'fechada' },
  campanhas: [],
  verbetes: new Map(),
  soLeitura: new Map(),
  avisos: [],
  versao: 0,
  salvamento: { t: 'em-dia' },
  travado: false,
  lugar: INICIO,
  campanhaId: null,

  async carregar() {
    const minha = (geracao += 1)
    await gravarTudoAgora()
    if (minha !== geracao) return
    set({ carga: { t: 'lendo' } })
    try {
      const indice = await lerIndiceDoPreparo()
      const campanhas = indice.estado === 'ok' || (indice.estado === 'somenteLeitura' && indice.valor !== null) ? (indice.valor?.campanhas ?? []) : []
      const ids = await listarNoPreparo('verbetes')
      const lidos = await Promise.all(ids.map(async (id) => ({ id, lido: await lerVerbete(id) })))
      const verbetes = new Map<string, Verbete>()
      const soLeitura = new Map<string, string>()
      const avisos: string[] = []
      for (const { id, lido } of lidos) {
        if (lido.estado === 'novo') continue
        if (lido.estado === 'falhou' || (lido.estado === 'somenteLeitura' && lido.valor === null)) {
          avisos.push(lido.aviso)
          continue
        }
        const verbete = lido.valor
        if (verbete === null) continue
        verbetes.set(verbete.id, verbete)
        if (lido.estado === 'somenteLeitura') soLeitura.set(verbete.id, lido.aviso)
        else if (verbete.id !== id) soLeitura.set(verbete.id, `O arquivo preparo/verbetes/${id}.json guarda o verbete "${verbete.id}": ele abre só para leitura.`)
      }
      citacoes = new IndiceDeCitacoes(verbetes.values())
      // As imagens do texto nascem com o endereço certo (`midia.ts`).
      await prepararMidia()
      if (minha !== geracao) return
      const guardada = campanhaGuardada()
      const campanhaId = guardada !== null && campanhas.some((campanha) => campanha.id === guardada) ? guardada : null
      set({ carga: { t: 'pronta' }, campanhas, verbetes, soLeitura, avisos, versao: get().versao + 1, campanhaId })
    } catch (erro) {
      if (minha === geracao) set({ carga: { t: 'falhou', aviso: `Não deu para ler o Prelúdio: ${motivo(erro)}.` } })
    }
  },

  async fechar() {
    const minha = (geracao += 1)
    await gravarTudoAgora()
    if (minha !== geracao) return
    citacoes = new IndiceDeCitacoes()
    set({ carga: { t: 'fechada' }, verbetes: new Map(), soLeitura: new Map(), avisos: [], lugar: INICIO, salvamento: situacao() })
  },

  ir(lugar) {
    set({ lugar })
  },

  escolherCampanha(campanhaId) {
    guardarCampanha(campanhaId)
    set({ campanhaId })
  },

  travar(travado) {
    set({ travado })
  },

  mudarVerbete(id, mudar) {
    const estado = get()
    const atual = estado.verbetes.get(id)
    if (atual === undefined || estado.soLeitura.has(id) || estado.travado) return
    const novo = mudar(atual)
    if (novo === atual) return
    const verbetes = new Map(estado.verbetes)
    verbetes.set(id, novo)
    citacoes.atualizar(novo)
    agendar(id)
    set({ verbetes, versao: estado.versao + 1, salvamento: situacao() })
  },

  async criarVerbete(verbete) {
    const estado = get()
    if (estado.travado) return
    const verbetes = new Map(estado.verbetes)
    verbetes.set(verbete.id, verbete)
    citacoes.atualizar(verbete)
    set({ verbetes, versao: estado.versao + 1 })
    await gravar(verbete.id)
  },

  salvarPendentes() {
    return gravarTudoAgora()
  },

  tentarDeNovo() {
    ultimaFalha = null
    for (const id of [...sujos]) if (!agendados.has(id)) void gravar(id)
    set({ salvamento: situacao() })
  },
}))
