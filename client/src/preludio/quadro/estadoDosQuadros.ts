import { create } from 'zustand'
import { contarFormas, ehPlanta, gravarQuadro, idDeQuadroNovo, listarQuadros, quadroNovo, type ContagemDoQuadro, type QuadroNaLista } from '../../lib/preparo/quadros'
import type { Quadro } from '../../lib/preparo/tipos'

/**
 * A LISTA DOS QUADROS (mapa mental) do Prelúdio: só o resumo de cada um (nome,
 * campanha, quantas formas). A foto do tldraw não fica aqui: quem abre o
 * quadro lê o arquivo de novo (`EditorDoQuadro.tsx`). Este arquivo não puxa o
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
  }
}

function resumoDaLista(item: QuadroNaLista): ResumoDoQuadro {
  if (item.quadro === null) return { id: item.id, nome: item.id, campanhaId: null, sessaoId: null, contagem: null, planta: false, aviso: item.aviso }
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
}))

/** Os quadros do filtro "Campanha" (todos, sem filtro). O quadro sem campanha aparece em qualquer filtro. */
export function quadrosDaCampanha(lista: ListaDosQuadros, campanhaId: string | null): readonly ResumoDoQuadro[] {
  if (lista.t !== 'pronta') return []
  if (campanhaId === null) return lista.quadros
  return lista.quadros.filter((quadro) => quadro.campanhaId === null || quadro.campanhaId === campanhaId)
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

/** Os quadros de uma sessão (o da aba Quadro é o primeiro, na ordem do nome). */
export function quadrosDaSessao(lista: ListaDosQuadros, sessaoId: string): readonly ResumoDoQuadro[] {
  return lista.t === 'pronta' ? lista.quadros.filter((quadro) => quadro.sessaoId === sessaoId) : []
}
