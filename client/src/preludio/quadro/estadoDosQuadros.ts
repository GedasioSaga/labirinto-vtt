import { create } from 'zustand'
import type { DocumentoLido } from '../../lib/preparo/disco'
import { contarFormas, ehPlanta, gravarQuadro, idDeQuadroNovo, lerQuadro, listarQuadros, quadroNovo, type ContagemDoQuadro, type QuadroNaLista } from '../../lib/preparo/quadros'
import type { Quadro } from '../../lib/preparo/tipos'
import { gravacaoPendente, usePreludio } from '../estado/preludio'

/**
 * A LISTA DOS QUADROS (mapa mental) do Prelúdio: só o resumo de cada um (nome,
 * campanha, quantas formas). A foto do tldraw não fica aqui: quem abre o
 * quadro lê o arquivo de novo (`lerQuadroAtual`). Este arquivo não puxa o
 * tldraw: a lista abre sem baixar o editor.
 */

export interface ResumoDoQuadro {
  readonly id: string
  readonly nome: string
  readonly campanhaId: string | null
  readonly sessaoId: string | null
  /** `null` = o arquivo não abriu. */
  readonly contagem: ContagemDoQuadro | null
  /** Planta do Grimório: abre só para ver. */
  readonly planta: boolean
  /** Por que abre só para leitura, ou por que não abre; `null` = abre para editar. */
  readonly aviso: string | null
  /** Na lixeira desde (ISO); `null` = fora dela. */
  readonly lixeira: string | null
}

export type ListaDosQuadros = { readonly t: 'nao-lida' } | { readonly t: 'lendo' } | { readonly t: 'pronta'; readonly quadros: readonly ResumoDoQuadro[] } | { readonly t: 'falhou'; readonly aviso: string }

interface EstadoDosQuadros {
  lista: ListaDosQuadros
  /** O quadro que acabou de nascer: ao abrir, o nome vem selecionado para trocar. */
  recemCriado: string | null
  /** O disco recusou o quadro novo: a lista mostra o motivo. */
  avisoDaCriacao: string | null
  recarregar: () => Promise<void>
  /**
   * Cria um quadro vazio e grava na hora; devolve o id, ou `null` se o disco
   * recusou (o motivo fica em `avisoDaCriacao`). Com `sessaoId`, é o quadro
   * daquela sessão (a aba Quadro dela), e o nome não vem selecionado.
   */
  criar: (campanhaId: string | null, opcoes?: { readonly sessaoId?: string; readonly nome?: string }) => Promise<string | null>
  /** O editor gravou: o resumo acompanha (nome e contagem). */
  gravado: (id: string, quadro: Quadro) => void
  /** O nome mudou no editor (a gravação vem depois): a trilha e a lista já mostram o novo. */
  renomear: (id: string, nome: string) => void
  esquecerRecemCriado: () => void
  /** Manda para a lixeira (`true`) ou restaura (`false`); devolve o motivo se não deu. */
  porNaLixeira: (id: string, naLixeira: boolean) => Promise<string | null>
  /** Muda o quadro de campanha (`null` = sem campanha); devolve o motivo se não deu. */
  mudarCampanha: (id: string, campanhaId: string | null) => Promise<string | null>
}

const TRAVADO = 'O Prelúdio está gravando uma importação ou uma cópia restaurada. Tente de novo quando terminar.'

/**
 * Muda o arquivo de um quadro fechado (a lista): lê o de agora (a gravação
 * pendente dele termina antes) e grava o que `mudar` devolve, com o resto
 * como estava. Devolve o quadro gravado, ou o motivo de não ter mudado.
 */
async function mudarArquivo(id: string, mudar: (quadro: Quadro) => Quadro): Promise<{ readonly quadro: Quadro } | { readonly aviso: string }> {
  if (usePreludio.getState().travado) return { aviso: TRAVADO }
  let quadro: Quadro
  try {
    const atual = await lerQuadroAtual(id)
    if (atual.t === 'naoGravado') quadro = atual.quadro
    else if (atual.lido.estado === 'ok' && atual.lido.valor !== null) quadro = atual.lido.valor
    else if (atual.lido.estado === 'novo') return { aviso: 'Este quadro não existe mais.' }
    else if (atual.lido.estado === 'somenteLeitura') return { aviso: `${atual.lido.aviso} Ele não muda daqui.` }
    else return { aviso: atual.lido.estado === 'falhou' ? atual.lido.aviso : 'O arquivo do quadro está vazio.' }
  } catch (erro) {
    return { aviso: `Não deu para ler o quadro: ${motivo(erro)}.` }
  }
  const novo = mudar(quadro)
  try {
    await gravarQuadroAtual(id, novo)
  } catch (erro) {
    return { aviso: `O quadro não foi gravado: ${motivo(erro)}` }
  }
  return { quadro: novo }
}

/** O quadro sem a chave (e não com ela valendo `undefined`): restaurar devolve o arquivo igual ao de antes da lixeira. */
function sem<C extends 'lixeira' | 'campanhaId'>(quadro: Quadro, chave: C): Quadro {
  const copia = { ...quadro }
  delete copia[chave]
  return copia
}

export const NOME_DE_QUADRO_NOVO = 'Quadro sem nome'

const ORDEM = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

export function resumir(id: string, quadro: Quadro, aviso: string | null): ResumoDoQuadro {
  return {
    id,
    nome: quadro.nome,
    campanhaId: quadro.campanhaId ?? null,
    sessaoId: quadro.sessaoId ?? null,
    contagem: contarFormas(quadro.tldraw),
    planta: ehPlanta(quadro),
    aviso,
    lixeira: quadro.lixeira ?? null,
  }
}

function resumoDaLista(item: QuadroNaLista): ResumoDoQuadro {
  if (item.quadro === null) return { id: item.id, nome: item.id, campanhaId: null, sessaoId: null, contagem: null, planta: false, aviso: item.aviso, lixeira: null }
  return resumir(item.id, item.quadro, item.aviso)
}

function emOrdem(quadros: readonly ResumoDoQuadro[]): ResumoDoQuadro[] {
  return [...quadros].sort((a, b) => ORDEM.compare(a.nome, b.nome) || a.id.localeCompare(b.id))
}

/** Cada recarga ganha um número: a leitura que terminou depois de outra é jogada fora. */
let leitura = 0

export const useQuadros = create<EstadoDosQuadros>()((set, get) => ({
  lista: { t: 'nao-lida' },
  recemCriado: null,
  avisoDaCriacao: null,

  async recarregar() {
    const minha = (leitura += 1)
    if (get().lista.t !== 'pronta') set({ lista: { t: 'lendo' } })
    try {
      const itens = await listarQuadros()
      if (minha === leitura) set({ lista: { t: 'pronta', quadros: emOrdem(itens.map(resumoDaLista)) } })
    } catch (erro) {
      if (minha === leitura) set({ lista: { t: 'falhou', aviso: `Não deu para ler os quadros: ${motivo(erro)}.` } })
    }
  },

  async criar(campanhaId, opcoes = {}) {
    const id = idDeQuadroNovo()
    const quadro = quadroNovo(opcoes.nome ?? NOME_DE_QUADRO_NOVO, { ...(campanhaId === null ? {} : { campanhaId }), ...(opcoes.sessaoId === undefined ? {} : { sessaoId: opcoes.sessaoId }) })
    try {
      await gravarQuadro(id, quadro)
    } catch (erro) {
      set({ avisoDaCriacao: `O quadro novo não foi gravado: ${motivo(erro)}` })
      return null
    }
    const lista = get().lista
    const quadros = lista.t === 'pronta' ? lista.quadros : []
    set({ lista: { t: 'pronta', quadros: emOrdem([...quadros, resumir(id, quadro, null)]) }, recemCriado: opcoes.sessaoId === undefined ? id : null, avisoDaCriacao: null })
    return id
  },

  gravado(id, quadro) {
    const lista = get().lista
    if (lista.t !== 'pronta') return
    const resumo = resumir(id, quadro, null)
    const outros = lista.quadros.filter((cada) => cada.id !== id)
    set({ lista: { t: 'pronta', quadros: emOrdem([...outros, resumo]) } })
  },

  renomear(id, nome) {
    const lista = get().lista
    if (lista.t !== 'pronta') return
    set({ lista: { t: 'pronta', quadros: emOrdem(lista.quadros.map((cada) => (cada.id === id ? { ...cada, nome } : cada))) } })
  },

  esquecerRecemCriado() {
    set({ recemCriado: null })
  },

  async porNaLixeira(id, naLixeira) {
    const feito = await mudarArquivo(id, (quadro) => (naLixeira ? { ...quadro, lixeira: new Date().toISOString() } : sem(quadro, 'lixeira')))
    if ('aviso' in feito) return feito.aviso
    get().gravado(id, feito.quadro)
    return null
  },

  async mudarCampanha(id, campanhaId) {
    const feito = await mudarArquivo(id, (quadro) => (campanhaId === null ? sem(quadro, 'campanhaId') : { ...quadro, campanhaId }))
    if ('aviso' in feito) return feito.aviso
    get().gravado(id, feito.quadro)
    return null
  },
}))

/** O quadro entra no filtro "Campanha"? Sem filtro, todos; o quadro sem campanha, em qualquer filtro. */
function noFiltro(quadro: ResumoDoQuadro, campanhaId: string | null): boolean {
  return campanhaId === null || quadro.campanhaId === null || quadro.campanhaId === campanhaId
}

/** Os quadros do filtro "Campanha" (todos, sem filtro), fora os da lixeira. O quadro sem campanha aparece em qualquer filtro. */
export function quadrosDaCampanha(lista: ListaDosQuadros, campanhaId: string | null): readonly ResumoDoQuadro[] {
  if (lista.t !== 'pronta') return []
  return lista.quadros.filter((quadro) => quadro.lixeira === null && noFiltro(quadro, campanhaId))
}

/** Os quadros na lixeira (de todas as campanhas: o filtro não esconde o que foi jogado fora), o último a entrar primeiro. */
export function quadrosNaLixeira(lista: ListaDosQuadros): readonly ResumoDoQuadro[] {
  if (lista.t !== 'pronta') return []
  return lista.quadros.filter((quadro) => quadro.lixeira !== null).sort((a, b) => (b.lixeira ?? '').localeCompare(a.lixeira ?? ''))
}

/** O quadro desta sessão que está na lixeira (a aba Quadro oferece restaurar). */
export function quadroDaSessaoNaLixeira(lista: ListaDosQuadros, sessaoId: string): ResumoDoQuadro | undefined {
  if (lista.t !== 'pronta') return undefined
  return quadrosNaLixeira(lista).find((quadro) => quadro.sessaoId === sessaoId)
}

/**
 * O quadro da aba Quadro da sessão. A sessão pode ter mais de um (o arquivo do
 * dela ficou ilegível, a aba criou outro e o primeiro voltou): vale o de menor
 * id, que o nome não muda. Renomear não troca o quadro aberto na aba, e a
 * citação dele abre sempre na aba (`abrirCitacao`).
 */
export function quadroDaSessao(lista: ListaDosQuadros, sessaoId: string): ResumoDoQuadro | undefined {
  if (lista.t !== 'pronta') return undefined
  let escolhido: ResumoDoQuadro | undefined
  for (const quadro of lista.quadros) if (quadro.sessaoId === sessaoId && quadro.lixeira === null && (escolhido === undefined || quadro.id < escolhido.id)) escolhido = quadro
  return escolhido
}

/**
 * Os quadros que um texto pode citar: os do filtro "Campanha" e, qualquer que
 * seja o filtro, os da sessão do texto (a sessão pode estar em várias campanhas,
 * e o quadro dela nasce na primeira). O da aba Quadro vem primeiro, depois os
 * outros da sessão, depois o resto em ordem de nome. A planta do Grimório (é
 * para ver) e o arquivo que não abriu ficam de fora.
 */
export function quadrosParaCitar(lista: ListaDosQuadros, campanhaId: string | null, sessaoId: string | null): ResumoDoQuadro[] {
  if (lista.t !== 'pronta') return []
  const daAba = sessaoId === null ? undefined : quadroDaSessao(lista, sessaoId)
  const peso = (quadro: ResumoDoQuadro) => (quadro.id === daAba?.id ? 2 : sessaoId !== null && quadro.sessaoId === sessaoId ? 1 : 0)
  // A lista já vem em ordem de nome, e o sort é estável: dentro de cada peso, a ordem fica.
  return lista.quadros.filter((quadro) => !quadro.planta && quadro.contagem !== null && quadro.lixeira === null && (peso(quadro) > 0 || noFiltro(quadro, campanhaId))).sort((a, b) => peso(b) - peso(a))
}

// ─── O quadro como o mestre o deixou ─────────────────────────────────────────

/** A chave do quadro na fila de gravação do Prelúdio (`agendarGravacaoDeFora`). */
export function chaveDaGravacaoDoQuadro(id: string): string {
  return `quadro:${id}`
}

/**
 * O último quadro mandado ao disco que ainda não chegou lá (o disco recusou),
 * por id: quem relê o quadro (abrir o editor, citar no texto) vê este, e não o
 * do disco, que é o de antes.
 */
const naoGravados = new Map<string, Quadro>()

/** Grava o quadro; até o disco aceitar, quem relê vê este (`lerQuadroAtual`). */
export async function gravarQuadroAtual(id: string, quadro: Quadro): Promise<void> {
  naoGravados.set(id, quadro)
  await gravarQuadro(id, quadro)
  if (naoGravados.get(id) === quadro) naoGravados.delete(id)
}

/** O que o disco recusou (`naoGravado`) ou o que o disco tem. */
export type QuadroAtual = { readonly t: 'naoGravado'; readonly quadro: Quadro } | { readonly t: 'disco'; readonly lido: DocumentoLido<Quadro> }

/**
 * O quadro como o mestre o deixou. A gravação que ainda espera o relógio
 * (800 ms) ou está indo ao disco termina antes de ler: o quadro grava sozinho
 * depois que sai da tela, e o disco ainda tem o de antes. Se o disco recusou,
 * vale o que não foi gravado.
 */
export async function lerQuadroAtual(id: string): Promise<QuadroAtual> {
  const chave = chaveDaGravacaoDoQuadro(id)
  if (gravacaoPendente(chave)) await usePreludio.getState().salvarPendentes()
  const pendente = naoGravados.get(id)
  if (pendente !== undefined && gravacaoPendente(chave)) return { t: 'naoGravado', quadro: pendente }
  naoGravados.delete(id)
  return { t: 'disco', lido: await lerQuadro(id) }
}

/** "12 cartões, 3 setas e 47 imagens"; "Vazio" quando não há forma. */
export function resumoDaContagem(contagem: ContagemDoQuadro): string {
  if (contagem.formas === 0) return 'Vazio'
  const partes: string[] = []
  const por = (quantos: number, um: string, varios: string) => {
    if (quantos > 0) partes.push(quantos === 1 ? `1 ${um}` : `${quantos} ${varios}`)
  }
  por(contagem.cartoes, 'cartão', 'cartões')
  por(contagem.salas, 'sala', 'salas')
  por(contagem.imagens, 'imagem', 'imagens')
  por(contagem.setas, 'seta', 'setas')
  por(contagem.molduras, 'moldura', 'molduras')
  por(contagem.textos, 'texto', 'textos')
  const contadas = contagem.cartoes + contagem.salas + contagem.imagens + contagem.setas + contagem.molduras + contagem.textos
  por(contagem.formas - contadas, 'outra forma', 'outras formas')
  return new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(partes)
}
