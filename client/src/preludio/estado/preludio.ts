import { create } from 'zustand'
import { gravarRevelado, gravarTempo, gravarVerbete, lerIndiceDoPreparo, lerRevelado, lerTempo, lerVerbete, listarNoPreparo, type DocumentoLido } from '../../lib/preparo/disco'
import { IndiceDeCitacoes, entradaDaBusca, type EntradaDaBusca } from '../../lib/preparo/enciclopedia'
import { comRevelacoes, reveladoVazio, type MudancaDeRevelacao } from '../../lib/preparo/revelado'
import { comEvento, semEvento, tempoVazio } from '../../lib/preparo/sessoes'
import type { Campanha, Evento, Revelado, Tempo, TipoDeVerbete, Verbete } from '../../lib/preparo/tipos'
import { registrarSalvarAoFechar } from '../aoFechar'
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
 *   "Tentar de novo" grava outra vez. Sair do Prelúdio não joga fora o que não
 *   gravou (ao abrir de novo, ele tenta outra vez e esse texto vale mais que o
 *   do disco), e fechar a janela grava o que falta ou pergunta (`aoFechar.ts`).
 * - A restauração do Google Drive trava a edição, grava o que estava pendente
 *   antes de trocar a pasta e, depois, relê o que voltou sem gravar a memória
 *   de antes por cima.
 * - O revelado (`revelado/<campanhaId>.json`, F2c) vai ao disco na hora do
 *   clique. Se não gravar, a tela volta ao que está no disco: um "oculto" que
 *   não gravou não pode ficar parecendo oculto.
 */

export type Lugar =
  | { readonly secao: 'inicio' }
  | { readonly secao: 'enciclopedia'; readonly tipo: TipoDeVerbete | 'todos'; readonly verbeteId: string | null }
  | { readonly secao: 'escrita'; readonly paginaId: string | null }
  | { readonly secao: 'sessoes'; readonly sessaoId: string | null }
  /** Os quadros (mapa mental); `quadroId` = o quadro aberto no editor. */
  | { readonly secao: 'quadros'; readonly quadroId: string | null }

export type Carga = { readonly t: 'fechada' } | { readonly t: 'lendo' } | { readonly t: 'pronta' } | { readonly t: 'falhou'; readonly aviso: string }

export type Salvamento = { readonly t: 'em-dia' } | { readonly t: 'esperando' } | { readonly t: 'salvando' } | { readonly t: 'falhou'; readonly motivo: string }

/** Quem está gravando em preparo/ por fora do salvar automático: enquanto houver um, ninguém edita. */
export type MotivoDaTrava = 'importacao' | 'restauracao'

/** A linha do tempo como abriu (a F4 põe e tira os eventos de "O que aconteceu"). */
export interface TempoNaTela {
  /** `null` = o arquivo não abriu: nada vira evento até abrir de novo. */
  readonly tempo: Tempo | null
  /** Por que não dá para mudar (versão mais nova, arquivo danificado); `null` = dá. */
  readonly soLeitura: string | null
}

/** O revelado de uma campanha como abriu. */
export interface RevelacoesDaCampanha {
  /** `null` = o arquivo não abriu: nada é revelado e nada muda. */
  readonly revelado: Revelado | null
  /** Por que não dá para mudar (versão mais nova, arquivo danificado); `null` = dá. */
  readonly soLeitura: string | null
}

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
  /** O que foi revelado em cada campanha do índice, e a quem. */
  revelados: ReadonlyMap<string, RevelacoesDaCampanha>
  /** A última revelação que o disco recusou (a tela já voltou ao que está gravado). */
  avisoDoRevelado: string | null
  tempo: TempoNaTela
  /** A última mudança da linha do tempo que o disco recusou (a tela já voltou ao que está gravado). */
  avisoDoTempo: string | null
  carregar: () => Promise<void>
  fechar: () => Promise<void>
  ir: (lugar: Lugar) => void
  escolherCampanha: (campanhaId: string | null) => void
  /** Trava (ou solta) a edição por um motivo; fica travado enquanto sobrar algum. */
  travar: (motivo: MotivoDaTrava, travado: boolean) => void
  /** Muda um verbete na memória e agenda a gravação. Só leitura ou travado: nada acontece. */
  mudarVerbete: (id: string, mudar: (verbete: Verbete) => Verbete) => void
  /** Põe um verbete novo na memória e grava na hora. */
  criarVerbete: (verbete: Verbete) => Promise<void>
  /** Revela ou oculta, numa campanha, e grava na hora. Travado, ou arquivo só de leitura: nada acontece. */
  revelar: (campanhaId: string, mudancas: readonly MudancaDeRevelacao[]) => Promise<void>
  dispensarAvisoDoRevelado: () => void
  /** Põe (ou troca, pelo id) um evento na linha do tempo e grava na hora. Travado, ou arquivo só de leitura: nada acontece. */
  registrarEvento: (evento: Evento) => Promise<void>
  /** Tira o evento da linha do tempo e grava na hora. */
  tirarEvento: (eventoId: string) => Promise<void>
  dispensarAvisoDoTempo: () => void
  /** Grava agora o que mudou. `true` = está tudo no disco. */
  salvarPendentes: () => Promise<boolean>
  tentarDeNovo: () => void
  /**
   * A restauração vai trocar a pasta preparo/ (o Prelúdio de agora vai inteiro
   * para antes-de-restaurar): trava a edição na hora e grava o que estava
   * pendente. Devolve o motivo quando algo não gravou, e aí a restauração não
   * deve começar.
   */
  antesDeRestaurar: () => Promise<string | null>
  /** A restauração acabou. Se trocou a pasta, relê o que voltou sem gravar a memória de antes por cima. Depois, destrava. */
  depoisDeRestaurar: (restaurou: boolean) => Promise<void>
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
/** Quantas gravações de cada id estão indo ao disco agora (a chave sai de `sujos` quando a gravação começa). */
const gravandoPorId = new Map<string, number>()
let ultimaFalha: string | null = null
let citacoes = new IndiceDeCitacoes()
/** Cada abrir e fechar ganha um número: a leitura que terminou depois de outro abrir (ou do fechar) é jogada fora. */
let geracao = 0
const travas = new Set<MotivoDaTrava>()

const AINDA_FALTA = 'Uma mudança do Prelúdio ainda não foi para o disco.'

function situacao(): Salvamento {
  if (ultimaFalha !== null) return { t: 'falhou', motivo: ultimaFalha }
  if (agendados.size > 0) return { t: 'esperando' }
  if (emVoo.size > 0) return { t: 'salvando' }
  return { t: 'em-dia' }
}

/** O aviso de falha sai quando nada do que falhou continua pendente (o que só está agendado grava sozinho). */
function conferirFalha(): void {
  if ([...sujos].every((id) => agendados.has(id))) ultimaFalha = null
}

/** `null` = tudo no disco; senão, o motivo. */
function oQueFaltou(): string | null {
  return sujos.size === 0 ? null : (ultimaFalha ?? AINDA_FALTA)
}

/** Esquece o que ia para o disco: depois de uma restauração vale o que voltou (o de antes ficou guardado inteiro). */
function descartarPendentes(): void {
  for (const relogio of agendados.values()) clearTimeout(relogio)
  agendados.clear()
  sujos.clear()
  gravadoresDeFora.clear()
  ultimaFalha = null
}

/** Quem grava o que não é verbete (o quadro aberto), pela chave dele em `sujos`. A chave tem `:`, que id de verbete não tem. */
const gravadoresDeFora = new Map<string, () => Promise<void>>()

function contarGravando(id: string, mais: 1 | -1): void {
  const quantas = (gravandoPorId.get(id) ?? 0) + mais
  if (quantas > 0) gravandoPorId.set(id, quantas)
  else gravandoPorId.delete(id)
}

function gravar(id: string): Promise<void> {
  const deFora = gravadoresDeFora.get(id)
  const verbete = usePreludio.getState().verbetes.get(id)
  sujos.delete(id)
  let escrever: () => Promise<void>
  if (deFora !== undefined) escrever = deFora
  else if (verbete !== undefined && !usePreludio.getState().soLeitura.has(id)) escrever = () => gravarVerbete(verbete)
  else {
    // Nada a gravar: sem isto, a falha de um verbete que saiu da memória ficava no rodapé para sempre.
    conferirFalha()
    usePreludio.setState({ salvamento: situacao() })
    return Promise.resolve()
  }
  contarGravando(id, 1)
  const tarefa = Promise.resolve()
    .then(escrever)
    .then(conferirFalha)
    .catch((erro: unknown) => {
      sujos.add(id)
      ultimaFalha = motivo(erro)
    })
    .finally(() => {
      contarGravando(id, -1)
      // O gravador de fora fica enquanto a chave espera o disco: agendada de novo no meio, gravando em outra leva ou com falha.
      if (!gravacaoPendente(id)) gravadoresDeFora.delete(id)
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

/**
 * Agenda a gravação de algo que não é verbete (o quadro aberto, F3): o mesmo
 * relógio, o mesmo rodapé, o mesmo "Tentar de novo" e a mesma pergunta ao
 * fechar a janela. `gravarAgora` monta o que vai ao disco na hora de gravar.
 * Travado (importação ou restauração gravando): nada é agendado, e devolve `false`.
 */
export function agendarGravacaoDeFora(chave: string, gravarAgora: () => Promise<void>): boolean {
  if (usePreludio.getState().travado) return false
  gravadoresDeFora.set(chave, gravarAgora)
  agendar(chave)
  usePreludio.setState({ salvamento: situacao() })
  return true
}

/**
 * Ainda há o que gravar com esta chave: agendado, gravando ou que falhou. Quem
 * relê o arquivo espera antes (`salvarPendentes`): no meio da gravação, o disco
 * ainda tem o de antes.
 */
export function gravacaoPendente(chave: string): boolean {
  return sujos.has(chave) || agendados.has(chave) || gravandoPorId.has(chave)
}

// ─── Revelado ────────────────────────────────────────────────────────────────

function revelacoesDe(lido: DocumentoLido<Revelado>): RevelacoesDaCampanha {
  switch (lido.estado) {
    case 'novo':
      return { revelado: reveladoVazio(), soLeitura: null }
    case 'ok':
      return { revelado: lido.valor, soLeitura: null }
    case 'somenteLeitura':
      return { revelado: lido.valor, soLeitura: lido.aviso }
    case 'falhou':
      return { revelado: null, soLeitura: lido.aviso }
  }
}

/** Gravações do revelado ainda no disco, por campanha, e a falha da leva (a tela só volta ao disco quando a última termina). */
const revelacoesEmVoo = new Map<string, number>()
const falhasDoRevelado = new Map<string, string>()

async function gravarRevelacoes(campanhaId: string, revelado: Revelado, minha: number): Promise<void> {
  revelacoesEmVoo.set(campanhaId, (revelacoesEmVoo.get(campanhaId) ?? 0) + 1)
  try {
    await gravarRevelado(campanhaId, revelado)
  } catch (erro) {
    falhasDoRevelado.set(campanhaId, motivo(erro))
  }
  const restantes = (revelacoesEmVoo.get(campanhaId) ?? 1) - 1
  if (restantes > 0) {
    revelacoesEmVoo.set(campanhaId, restantes)
    return
  }
  revelacoesEmVoo.delete(campanhaId)
  const falha = falhasDoRevelado.get(campanhaId)
  if (falha === undefined) return
  falhasDoRevelado.delete(campanhaId)
  // O disco manda: a tela volta ao que ficou gravado (lerRevelado nunca lança).
  const lido = await lerRevelado(campanhaId)
  if (minha !== geracao) return
  const revelados = new Map(usePreludio.getState().revelados)
  revelados.set(campanhaId, revelacoesDe(lido))
  usePreludio.setState({ revelados, avisoDoRevelado: `A revelação não foi gravada (${falha}). A tela voltou ao que está no disco.` })
}

function gravarRevelacoesEmVoo(campanhaId: string, revelado: Revelado): Promise<void> {
  const tarefa = gravarRevelacoes(campanhaId, revelado, geracao).finally(() => {
    emVoo.delete(tarefa)
    usePreludio.setState({ salvamento: situacao() })
  })
  emVoo.add(tarefa)
  usePreludio.setState({ salvamento: situacao() })
  return tarefa
}

// ─── Linha do tempo ──────────────────────────────────────────────────────────

const TEMPO_NAO_LIDO: TempoNaTela = { tempo: null, soLeitura: null }

function tempoNaTela(lido: DocumentoLido<Tempo>): TempoNaTela {
  switch (lido.estado) {
    case 'novo':
      return { tempo: tempoVazio(), soLeitura: null }
    case 'ok':
      return { tempo: lido.valor, soLeitura: null }
    case 'somenteLeitura':
      return { tempo: lido.valor, soLeitura: lido.aviso }
    case 'falhou':
      return { tempo: null, soLeitura: lido.aviso }
  }
}

/** Muda a linha do tempo na memória e grava na hora; se o disco recusar, a tela volta ao que está gravado. */
async function mudarTempo(mudar: (tempo: Tempo) => Tempo): Promise<void> {
  const estado = usePreludio.getState()
  const atual = estado.tempo
  if (estado.travado || estado.carga.t !== 'pronta' || atual.tempo === null || atual.soLeitura !== null) return
  const novo = mudar(atual.tempo)
  if (novo === atual.tempo) return
  usePreludio.setState({ tempo: { ...atual, tempo: novo }, avisoDoTempo: null })
  const minha = geracao
  const tarefa = gravarTempo(novo)
    .catch(async (erro: unknown) => {
      const lido = await lerTempo()
      if (minha !== geracao) return
      usePreludio.setState({ tempo: tempoNaTela(lido), avisoDoTempo: `A linha do tempo não foi gravada (${motivo(erro)}). A tela voltou ao que está no disco.` })
    })
    .finally(() => {
      emVoo.delete(tarefa)
      usePreludio.setState({ salvamento: situacao() })
    })
  emVoo.add(tarefa)
  usePreludio.setState({ salvamento: situacao() })
  await tarefa
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
  revelados: new Map(),
  avisoDoRevelado: null,
  tempo: TEMPO_NAO_LIDO,
  avisoDoTempo: null,

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
      // O que de novo não gravou continua sendo o da memória: o disco tem o de antes, e a próxima gravação tenta outra vez.
      const naMemoria = get().verbetes
      for (const id of sujos) {
        const pendente = naMemoria.get(id)
        if (pendente !== undefined && !soLeitura.has(id)) verbetes.set(id, pendente)
      }
      citacoes = new IndiceDeCitacoes(verbetes.values())
      const revelados = new Map(
        await Promise.all(campanhas.map(async (campanha): Promise<[string, RevelacoesDaCampanha]> => [campanha.id, revelacoesDe(await lerRevelado(campanha.id))])),
      )
      const tempo = tempoNaTela(await lerTempo())
      // As imagens do texto nascem com o endereço certo (`midia.ts`).
      await prepararMidia()
      if (minha !== geracao) return
      const guardada = campanhaGuardada()
      const campanhaId = guardada !== null && campanhas.some((campanha) => campanha.id === guardada) ? guardada : null
      set({ carga: { t: 'pronta' }, campanhas, verbetes, soLeitura, avisos, versao: get().versao + 1, campanhaId, revelados, avisoDoRevelado: null, tempo, avisoDoTempo: null, salvamento: situacao() })
    } catch (erro) {
      if (minha === geracao) set({ carga: { t: 'falhou', aviso: `Não deu para ler o Prelúdio: ${motivo(erro)}.` } })
    }
  },

  async fechar() {
    const minha = (geracao += 1)
    // A tela saiu: a importação e a restauração dela não seguram mais a edição.
    travas.clear()
    await gravarTudoAgora()
    if (minha !== geracao) return
    // O que não gravou fica na memória até a próxima abertura (que tenta de novo) ou até fechar a janela (que pergunta).
    const guardar = sujos.size > 0
    if (!guardar) citacoes = new IndiceDeCitacoes()
    set({
      carga: { t: 'fechada' },
      ...(guardar ? {} : { verbetes: new Map<string, Verbete>(), soLeitura: new Map<string, string>() }),
      // O revelado já foi ao disco (a espera acima inclui as gravações dele): a próxima abertura relê.
      revelados: new Map<string, RevelacoesDaCampanha>(),
      avisoDoRevelado: null,
      tempo: TEMPO_NAO_LIDO,
      avisoDoTempo: null,
      avisos: [],
      lugar: INICIO,
      salvamento: situacao(),
      travado: false,
    })
  },

  ir(lugar) {
    set({ lugar })
  },

  escolherCampanha(campanhaId) {
    guardarCampanha(campanhaId)
    set({ campanhaId })
  },

  travar(motivoDaTrava, travado) {
    if (travado) travas.add(motivoDaTrava)
    else travas.delete(motivoDaTrava)
    set({ travado: travas.size > 0 })
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

  async revelar(campanhaId, mudancas) {
    const estado = get()
    const atual = estado.revelados.get(campanhaId)
    if (estado.travado || estado.carga.t !== 'pronta' || atual === undefined || atual.revelado === null || atual.soLeitura !== null) return
    const novo = comRevelacoes(atual.revelado, mudancas, new Date().toISOString())
    if (novo === atual.revelado) return
    const revelados = new Map(estado.revelados)
    revelados.set(campanhaId, { ...atual, revelado: novo })
    set({ revelados, avisoDoRevelado: null })
    await gravarRevelacoesEmVoo(campanhaId, novo)
  },

  dispensarAvisoDoRevelado() {
    set({ avisoDoRevelado: null })
  },

  registrarEvento(evento) {
    return mudarTempo((tempo) => comEvento(tempo, evento))
  },

  tirarEvento(eventoId) {
    return mudarTempo((tempo) => semEvento(tempo, eventoId))
  },

  dispensarAvisoDoTempo() {
    set({ avisoDoTempo: null })
  },

  async salvarPendentes() {
    await gravarTudoAgora()
    return sujos.size === 0
  },

  tentarDeNovo() {
    ultimaFalha = null
    for (const id of [...sujos]) if (!agendados.has(id)) void gravar(id)
    set({ salvamento: situacao() })
  },

  async antesDeRestaurar() {
    // Trava antes de qualquer espera: uma tecla no meio agendaria uma gravação para cair na pasta trocada.
    get().travar('restauracao', true)
    await gravarTudoAgora()
    return oQueFaltou()
  },

  async depoisDeRestaurar(restaurou) {
    if (restaurou) {
      descartarPendentes()
      // Tela aberta relê na hora; fechada, a próxima abertura lê do disco.
      if (get().carga.t !== 'fechada') await get().carregar()
      else {
        citacoes = new IndiceDeCitacoes()
        set({ verbetes: new Map(), soLeitura: new Map(), revelados: new Map(), tempo: TEMPO_NAO_LIDO })
      }
    }
    get().travar('restauracao', false)
    set({ salvamento: situacao() })
  },
}))

/**
 * Fechar a janela (X, Alt+F4) grava o que ainda não foi ao disco. O editor
 * segura o texto 250 ms e os apelidos só gravam ao perder o foco: tirar o foco
 * leva os dois para a loja antes da gravação. Se a janela não fechar (a pessoa
 * desistiu na pergunta), o cursor volta para onde estava.
 */
registrarSalvarAoFechar(async () => {
  const ativo = usePreludio.getState().carga.t !== 'fechada' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  ativo?.blur()
  await gravarTudoAgora()
  if (ativo?.isConnected === true) ativo.focus({ preventScroll: true })
  return oQueFaltou()
})
