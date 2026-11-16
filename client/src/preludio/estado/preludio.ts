import { create } from 'zustand'
import { gravarIndiceDoPreparo, gravarRevelado, gravarTempo, gravarVerbete, lerIndiceDoPreparo, lerRevelado, lerTempo, lerVerbete, listarNoPreparo, type DocumentoLido } from '../../lib/preparo/disco'
import { IndiceDeCitacoes, entradaDaBusca, type EntradaDaBusca } from '../../lib/preparo/enciclopedia'
import { comRevelacoes, reveladoVazio, type MudancaDeRevelacao } from '../../lib/preparo/revelado'
import { indiceComAsPastas } from '../../lib/preparo/pastasDeVerbetes'
import { comEvento, semEvento, tempoVazio } from '../../lib/preparo/sessoes'
import { ARQUIVO_DO_INDICE, type Campanha, type Evento, type IndiceDoPreparo, type PastaDeVerbetes, type Revelado, type Tempo, type TipoDeVerbete, type Verbete } from '../../lib/preparo/tipos'
import { registrarSalvarAoFechar } from '../aoFechar'
import { avisarMudanca } from '../janela/mudancas'
import type { MudancaNoPreparo } from '../janela/protocolo'
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
 * - DUAS JANELAS (P1): o Livro do mestre, na principal, e o Prelúdio em janela
 *   própria gravam o mesmo revelado. Cada gravação relê o disco e junta por item
 *   antes de gravar, uma de cada vez (Web Locks, que vale entre as janelas), e
 *   cada coisa gravada é avisada à outra janela (`janela/mudancas.ts`), que relê
 *   só aquilo (`relerDoDisco`).
 */

export type Lugar =
  | { readonly secao: 'inicio' }
  | { readonly secao: 'enciclopedia'; readonly tipo: TipoDeVerbete | 'todos'; readonly verbeteId: string | null }
  | { readonly secao: 'escrita'; readonly paginaId: string | null }
  /** `aba` = a sessão aberta no Roteiro (o padrão) ou no Quadro; `alvo` = a forma do quadro a mostrar (`shape:…`). */
  | { readonly secao: 'sessoes'; readonly sessaoId: string | null; readonly aba?: AbaDaSessao; readonly alvo?: string }
  /** Os quadros (mapa mental); `quadroId` = o quadro aberto no editor; `alvo` = a forma a mostrar ao abrir. */
  | { readonly secao: 'quadros'; readonly quadroId: string | null; readonly alvo?: string }
  /** Campanhas e sistemas (E3): a pasta de mapas e o sistema de cada campanha. */
  | { readonly secao: 'campanhas' }
  /** A linha do tempo (E3c): uma por campanha, a do filtro "Campanha" da barra. */
  | { readonly secao: 'tempo' }

export type AbaDaSessao = 'roteiro' | 'quadro'

/** O caminho de volta de uma página aberta a partir do quadro. */
export interface Volta {
  readonly lugar: Lugar
  readonly rotulo: string
}

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
  /** As pastas de verbetes guardadas no índice (E3); as do Grimório que ninguém mexeu saem dos verbetes (`pastasDoTipo`). */
  pastas: readonly PastaDeVerbetes[]
  /** A sessão em jogo ("Jogar esta sessão", P2), do índice; `null` = nenhuma. */
  emJogo: string | null
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
  /** Vai a outro lugar. `voltar` = o lugar de onde veio (o quadro), para a página oferecer a volta. */
  ir: (lugar: Lugar, voltar?: Volta) => void
  /** A volta que a página aberta oferece ("‹ Voltar ao quadro"); qualquer outro `ir` a esquece. */
  voltar: Volta | null
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
  /**
   * A tela da linha do tempo (E3c): muda eras e eventos de uma vez e grava na
   * hora. Travado, ou arquivo só de leitura: nada acontece. Se o disco recusar,
   * a tela volta ao que está gravado, com o `avisoDoTempo`.
   */
  mudarLinhaDoTempo: (mudar: (tempo: Tempo) => Tempo) => Promise<void>
  dispensarAvisoDoTempo: () => void
  /** Grava agora o que mudou. `true` = está tudo no disco. */
  salvarPendentes: () => Promise<boolean>
  /** A outra janela gravou isto: relê só isso do disco (o que esta janela ainda não gravou continua valendo). */
  relerDoDisco: (mudanca: MudancaNoPreparo) => Promise<void>
  /**
   * "JOGAR ESTA SESSÃO" (P2): marca a sessão em jogo no índice e grava na hora
   * (`null` = parar de jogar). Relê o índice do disco antes, para não gravar
   * por cima do que a outra janela mudou. Devolve o motivo quando não gravou.
   */
  jogarSessao: (sessaoId: string | null) => Promise<string | null>
  /**
   * PASTAS DE VERBETES (E3): troca a lista na memória na hora e grava o índice
   * pelo salvar automático (o mesmo rodapé e o mesmo "Tentar de novo" dos
   * verbetes). Travado ou fechado: nada muda, e devolve `false`.
   */
  mudarPastas: (pastas: readonly PastaDeVerbetes[]) => boolean
  /**
   * Muda uma campanha do índice (a pasta de mapas, o sistema; E3) e grava na
   * hora, sobre o índice relido do disco. Devolve o motivo quando não gravou.
   */
  mudarCampanha: (campanhaId: string, mudar: (campanha: Campanha) => Campanha) => Promise<string | null>
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

/** A sessão em jogo do índice lido (`null` = nenhuma, ou o índice não abriu). */
function emJogoDoIndice(indice: DocumentoLido<IndiceDoPreparo>): string | null {
  if (indice.estado !== 'ok' && indice.estado !== 'somenteLeitura') return null
  return indice.valor?.emJogo ?? null
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
/** A chave das pastas em `sujos` (tem `:`, que id de verbete não tem: `gravadoresDeFora`). */
const CHAVE_DAS_PASTAS = 'indice:pastas'

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
  else if (verbete !== undefined && !usePreludio.getState().soLeitura.has(id))
    escrever = async () => {
      await gravarVerbete(verbete)
      avisarMudanca({ o: 'verbete', id })
    }
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

// ─── Índice ──────────────────────────────────────────────────────────────────

/** Uma gravação do índice por vez nesta janela: as pastas e a campanha leem, mudam e gravam o mesmo arquivo. */
let filaDoIndice: Promise<unknown> = Promise.resolve()

function naVezDoIndice<T>(tarefa: () => Promise<T>): Promise<T> {
  const minha = filaDoIndice.then(tarefa, tarefa)
  filaDoIndice = minha.catch(() => undefined)
  return minha
}

/** O índice do disco, para mudar e gravar por cima: o que a outra janela gravou nele fica. Lança quando não dá para gravar. */
async function indiceParaMudar(): Promise<IndiceDoPreparo> {
  const lido = await lerIndiceDoPreparo()
  if (lido.estado === 'falhou' || lido.estado === 'somenteLeitura') throw new Error(lido.aviso)
  return lido.estado === 'novo' ? { formato: ARQUIVO_DO_INDICE.formato, campanhas: [] } : lido.valor
}

/** As pastas da memória vão para o índice do disco (as campanhas e a sessão em jogo de lá ficam). */
function gravarAsPastas(): Promise<void> {
  return naVezDoIndice(async () => {
    const indice = await indiceParaMudar()
    await gravarIndiceDoPreparo(indiceComAsPastas(indice, usePreludio.getState().pastas))
    avisarMudanca({ o: 'indice' })
  })
}

/** As pastas do índice lido; as da memória que ainda não gravaram valem mais. */
function pastasDoIndice(indice: DocumentoLido<IndiceDoPreparo>, naMemoria: readonly PastaDeVerbetes[]): readonly PastaDeVerbetes[] {
  if (gravacaoPendente(CHAVE_DAS_PASTAS)) return naMemoria
  if (indice.estado !== 'ok' && indice.estado !== 'somenteLeitura') return []
  return indice.valor?.pastas ?? []
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
/** O que a última gravação da leva deixou no disco: a tela fica com ele quando a leva acaba. */
const ultimoRevelado = new Map<string, Revelado>()
/** Uma gravação do revelado por vez em cada campanha, nesta janela (sem Web Locks, é só isto). */
const filaDoRevelado = new Map<string, Promise<unknown>>()

/**
 * Uma de cada vez, por campanha: nesta janela pela fila, e entre as janelas do
 * app pelo Web Locks (mesma origem). Sem ele (teste, navegador antigo), vale a fila.
 */
function naVezDoRevelado<T>(campanhaId: string, tarefa: () => Promise<T>): Promise<T> {
  const travas = typeof navigator !== 'undefined' && 'locks' in navigator ? navigator.locks : undefined
  const rodar = (): Promise<T> => (travas === undefined ? tarefa() : travas.request(`labirinto-preparo-revelado:${campanhaId}`, tarefa))
  const antes = filaDoRevelado.get(campanhaId) ?? Promise.resolve()
  const minha = antes.then(rodar, rodar)
  filaDoRevelado.set(campanhaId, minha)
  const soltar = () => {
    if (filaDoRevelado.get(campanhaId) === minha) filaDoRevelado.delete(campanhaId)
  }
  minha.then(soltar, soltar)
  return minha
}

/** Relê o disco e junta as mudanças por item antes de gravar: o que a outra janela revelou no meio não some. */
async function juntarEGravarRevelado(campanhaId: string, mudancas: readonly MudancaDeRevelacao[], quando: string): Promise<Revelado> {
  const noDisco = revelacoesDe(await lerRevelado(campanhaId))
  if (noDisco.revelado === null || noDisco.soLeitura !== null) throw new Error(noDisco.soLeitura ?? 'o arquivo do revelado não abriu')
  const junto = comRevelacoes(noDisco.revelado, mudancas, quando)
  if (junto !== noDisco.revelado) await gravarRevelado(campanhaId, junto)
  return junto
}

async function gravarRevelacoes(campanhaId: string, mudancas: readonly MudancaDeRevelacao[], quando: string, minha: number): Promise<void> {
  revelacoesEmVoo.set(campanhaId, (revelacoesEmVoo.get(campanhaId) ?? 0) + 1)
  try {
    ultimoRevelado.set(campanhaId, await naVezDoRevelado(campanhaId, () => juntarEGravarRevelado(campanhaId, mudancas, quando)))
    avisarMudanca({ o: 'revelado', campanhaId })
  } catch (erro) {
    falhasDoRevelado.set(campanhaId, motivo(erro))
  }
  const restantes = (revelacoesEmVoo.get(campanhaId) ?? 1) - 1
  if (restantes > 0) {
    revelacoesEmVoo.set(campanhaId, restantes)
    return
  }
  revelacoesEmVoo.delete(campanhaId)
  const gravado = ultimoRevelado.get(campanhaId)
  ultimoRevelado.delete(campanhaId)
  const falha = falhasDoRevelado.get(campanhaId)
  if (falha === undefined) {
    // A tela fica com o que está no disco: o que a outra janela revelou no meio entra junto.
    if (gravado === undefined || minha !== geracao) return
    const revelados = new Map(usePreludio.getState().revelados)
    revelados.set(campanhaId, { revelado: gravado, soLeitura: null })
    usePreludio.setState({ revelados })
    return
  }
  falhasDoRevelado.delete(campanhaId)
  // O disco manda: a tela volta ao que ficou gravado (lerRevelado nunca lança).
  const lido = await lerRevelado(campanhaId)
  if (minha !== geracao) return
  const revelados = new Map(usePreludio.getState().revelados)
  revelados.set(campanhaId, revelacoesDe(lido))
  usePreludio.setState({ revelados, avisoDoRevelado: `A revelação não foi gravada (${falha}). A tela voltou ao que está no disco.` })
}

function gravarRevelacoesEmVoo(campanhaId: string, mudancas: readonly MudancaDeRevelacao[], quando: string): Promise<void> {
  const tarefa = gravarRevelacoes(campanhaId, mudancas, quando, geracao).finally(() => {
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
    .then(() => avisarMudanca({ o: 'tempo' }))
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
  pastas: [],
  emJogo: null,
  verbetes: new Map(),
  soLeitura: new Map(),
  avisos: [],
  versao: 0,
  salvamento: { t: 'em-dia' },
  travado: false,
  lugar: INICIO,
  voltar: null,
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
      const emJogo = emJogoDoIndice(indice)
      const pastas = pastasDoIndice(indice, get().pastas)
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
      set({ carga: { t: 'pronta' }, campanhas, pastas, emJogo, verbetes, soLeitura, avisos, versao: get().versao + 1, campanhaId, revelados, avisoDoRevelado: null, tempo, avisoDoTempo: null, salvamento: situacao() })
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
  voltar: null,
      salvamento: situacao(),
      travado: false,
    })
  },

  ir(lugar, voltar) {
    set({ lugar, voltar: voltar ?? null })
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
    const quando = new Date().toISOString()
    const novo = comRevelacoes(atual.revelado, mudancas, quando)
    if (novo === atual.revelado) return
    const revelados = new Map(estado.revelados)
    revelados.set(campanhaId, { ...atual, revelado: novo })
    set({ revelados, avisoDoRevelado: null })
    // A tela muda na hora; o disco recebe as MUDANÇAS, juntadas ao que estiver lá.
    await gravarRevelacoesEmVoo(campanhaId, mudancas, quando)
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

  mudarLinhaDoTempo(mudar) {
    return mudarTempo(mudar)
  },

  dispensarAvisoDoTempo() {
    set({ avisoDoTempo: null })
  },

  async salvarPendentes() {
    await gravarTudoAgora()
    return sujos.size === 0
  },

  async relerDoDisco(mudanca) {
    const minha = geracao
    if (get().carga.t !== 'pronta') return
    const aindaValendo = () => minha === geracao && get().carga.t === 'pronta'
    switch (mudanca.o) {
      case 'verbete': {
        const { id } = mudanca
        // O que esta janela ainda não gravou vale mais que o disco.
        if (gravacaoPendente(id)) return
        const lido = await lerVerbete(id)
        if (!aindaValendo() || gravacaoPendente(id) || lido.estado !== 'ok' || lido.valor.id !== id) return
        const verbetes = new Map(get().verbetes)
        verbetes.set(id, lido.valor)
        citacoes.atualizar(lido.valor)
        set({ verbetes, versao: get().versao + 1 })
        return
      }
      case 'revelado': {
        const { campanhaId } = mudanca
        // Campanha que esta janela não leu (veio de importação): entra na próxima abertura.
        if (revelacoesEmVoo.has(campanhaId) || !get().revelados.has(campanhaId)) return
        const lido = await lerRevelado(campanhaId)
        if (!aindaValendo() || revelacoesEmVoo.has(campanhaId)) return
        const revelados = new Map(get().revelados)
        revelados.set(campanhaId, revelacoesDe(lido))
        set({ revelados })
        return
      }
      case 'tempo': {
        const lido = await lerTempo()
        if (aindaValendo()) set({ tempo: tempoNaTela(lido) })
        return
      }
      case 'indice': {
        const lido = await lerIndiceDoPreparo()
        if (!aindaValendo() || (lido.estado !== 'ok' && lido.estado !== 'somenteLeitura') || lido.valor === null) return
        set({ campanhas: lido.valor.campanhas, emJogo: emJogoDoIndice(lido), pastas: pastasDoIndice(lido, get().pastas) })
        return
      }
    }
  },

  async jogarSessao(sessaoId) {
    if (get().carga.t !== 'pronta') return 'O Prelúdio ainda está abrindo.'
    if (travas.size > 0) return 'O Prelúdio está gravando uma importação ou uma cópia restaurada. Tente de novo quando terminar.'
    try {
      const lido = await lerIndiceDoPreparo()
      if (lido.estado === 'falhou' || lido.estado === 'somenteLeitura') return lido.aviso
      const indice: IndiceDoPreparo = lido.estado === 'novo' ? { formato: ARQUIVO_DO_INDICE.formato, campanhas: [] } : lido.valor
      // Parar de jogar tira o campo: o índice de quem nunca jogou fica como era.
      const { emJogo: _antes, ...semEmJogo } = indice
      const novo: IndiceDoPreparo = sessaoId === null ? semEmJogo : { ...semEmJogo, emJogo: sessaoId }
      await gravarIndiceDoPreparo(novo)
      set({ campanhas: novo.campanhas, emJogo: sessaoId })
      avisarMudanca({ o: 'indice' })
      return null
    } catch (erro) {
      return `Não deu para gravar a sessão em jogo: ${motivo(erro)}.`
    }
  },

  mudarPastas(pastas) {
    if (get().carga.t !== 'pronta' || get().travado) return false
    set({ pastas })
    return agendarGravacaoDeFora(CHAVE_DAS_PASTAS, gravarAsPastas)
  },

  async mudarCampanha(campanhaId, mudar) {
    if (get().carga.t !== 'pronta') return 'O Prelúdio ainda está abrindo.'
    if (travas.size > 0) return 'O Prelúdio está gravando uma importação ou uma cópia restaurada. Tente de novo quando terminar.'
    try {
      return await naVezDoIndice(async () => {
        const indice = await indiceParaMudar()
        if (!indice.campanhas.some((campanha) => campanha.id === campanhaId)) return 'Essa campanha não está mais no Prelúdio.'
        const novo: IndiceDoPreparo = { ...indice, campanhas: indice.campanhas.map((campanha) => (campanha.id === campanhaId ? mudar(campanha) : campanha)) }
        await gravarIndiceDoPreparo(novo)
        set({ campanhas: novo.campanhas })
        avisarMudanca({ o: 'indice' })
        return null
      })
    } catch (erro) {
      return `Não deu para gravar a campanha: ${motivo(erro)}.`
    }
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
