// Adaptado do Grimório: src/components/ligacoesCanvas.ts e dropsDeEntidade.tsx (a seta nativa
// do tldraw presa nos dois cartões, que acompanha quando um deles se move).
import { createShapeId, getArrowBindings, renderPlaintextFromRichText, toRichText, type Editor, type TLArrowShape, type TLShapeId } from 'tldraw'
import { setasDasLigacoes } from '../../lib/preparo/ligacoes'
import { verbeteDoRegistro } from '../../lib/preparo/quadros'
import type { Ligacao, Verbete } from '../../lib/preparo/tipos'
import { CARD_ALTURA_PADRAO, CARD_LARGURA_PADRAO, marcarChegada, tipoDeCartaoDo, verbeteDoCartao } from './cartoes'

/**
 * OS CARTÕES E AS SETAS DO QUADRO (fatia F3b), do lado do tldraw:
 * - o cartão que entra (arrastado da gaveta, posto pela busca) já ganha as
 *   setas das ligações com os cartões que estão no quadro, num passo só do
 *   desfazer (Ctrl+Z tira o cartão e as setas juntos), como no Grimório;
 * - a seta desenhada pelo mestre entre dois cartões é lida aqui (de qual
 *   verbete para qual) para o quadro oferecer a ligação.
 */

/** Âncora comum aos dois lados da seta das ligações: o centro do cartão, sem grudar no ponto exato. */
const ANCORA_DA_SETA = { normalizedAnchor: { x: 0.5, y: 0.5 }, isPrecise: false, isExact: false, snap: 'none' } as const

/** Os cartões da página aberta, pelo id do verbete do Prelúdio (o id do Grimório já traduzido). */
export function cartoesPorVerbete(editor: Editor, verbetes: ReadonlyMap<string, Verbete>): Map<string, TLShapeId[]> {
  const mapa = new Map<string, TLShapeId[]>()
  for (const forma of editor.getCurrentPageShapes()) {
    const id = verbeteDoRegistro(forma as unknown as Record<string, unknown>)
    if (id === null) continue
    const real = verbeteDoCartao(verbetes, id)?.id ?? id
    const lista = mapa.get(real)
    if (lista === undefined) mapa.set(real, [forma.id])
    else lista.push(forma.id)
  }
  return mapa
}

/** Já há seta entre as duas formas, em qualquer direção? */
function existeSetaEntre(editor: Editor, a: TLShapeId, b: TLShapeId): boolean {
  for (const presa of editor.getBindingsToShape(a, 'arrow')) {
    if (editor.getBindingsFromShape(presa.fromId, 'arrow').some((outra) => outra.toId === b)) return true
  }
  return false
}

function criarSeta(editor: Editor, de: TLShapeId, para: TLShapeId, rotulo: string): void {
  const setaId = createShapeId()
  editor.createShape({ id: setaId, type: 'arrow', x: 0, y: 0, ...(rotulo === '' ? {} : { props: { richText: toRichText(rotulo) } }) })
  editor.createBindings([
    { type: 'arrow', fromId: setaId, toId: de, props: { terminal: 'start', ...ANCORA_DA_SETA } },
    { type: 'arrow', fromId: setaId, toId: para, props: { terminal: 'end', ...ANCORA_DA_SETA } },
  ])
}

/**
 * Desenha as setas das ligações que faltam entre os cartões do quadro (com
 * `so`, só as que tocam aquele verbete). Devolve quantas desenhou. Quem chama
 * põe dentro de `editor.run` para o desfazer ser um passo só.
 */
export function desenharSetasDasLigacoes(editor: Editor, ligacoes: readonly Ligacao[], verbetes: ReadonlyMap<string, Verbete>, so?: string): number {
  const cartoes = cartoesPorVerbete(editor, verbetes)
  let desenhadas = 0
  for (const { de, para, rotulo } of setasDasLigacoes(ligacoes, new Set(cartoes.keys()), verbetes, so)) {
    for (const formaDe of cartoes.get(de) ?? []) {
      for (const formaPara of cartoes.get(para) ?? []) {
        if (existeSetaEntre(editor, formaDe, formaPara)) continue
        criarSeta(editor, formaDe, formaPara, rotulo)
        desenhadas += 1
      }
    }
  }
  return desenhadas
}

/** Quantas setas das ligações faltam entre os cartões do quadro (sem desenhar nada). */
export function setasQueFaltam(editor: Editor, ligacoes: readonly Ligacao[], verbetes: ReadonlyMap<string, Verbete>): number {
  const cartoes = cartoesPorVerbete(editor, verbetes)
  let faltam = 0
  for (const { de, para } of setasDasLigacoes(ligacoes, new Set(cartoes.keys()), verbetes)) {
    for (const formaDe of cartoes.get(de) ?? []) for (const formaPara of cartoes.get(para) ?? []) if (!existeSetaEntre(editor, formaDe, formaPara)) faltam += 1
  }
  return faltam
}

/** O cartão do verbete, centrado no ponto (coordenadas da página), com as setas das ligações. Um passo só do desfazer. */
export function porCartao(editor: Editor, verbete: Verbete, ponto: { x: number; y: number }, ligacoes: readonly Ligacao[], verbetes: ReadonlyMap<string, Verbete>): { formaId: TLShapeId; setas: number } {
  const formaId = createShapeId()
  const tipo = tipoDeCartaoDo(verbete)
  const base = { id: formaId, x: ponto.x - CARD_LARGURA_PADRAO / 2, y: ponto.y - CARD_ALTURA_PADRAO / 2 }
  let setas = 0
  marcarChegada(formaId)
  editor.markHistoryStoppingPoint('pôr cartão')
  editor.run(() => {
    if (tipo === 'cenario-card') editor.createShape({ ...base, type: tipo, props: { cenarioId: verbete.id } })
    else if (tipo === 'item-card') editor.createShape({ ...base, type: tipo, props: { itemId: verbete.id } })
    else editor.createShape({ ...base, type: tipo, props: { personagemId: verbete.id } })
    setas = desenharSetasDasLigacoes(editor, ligacoes, verbetes, verbete.id)
  })
  return { formaId, setas }
}

/**
 * Mostra uma forma: a câmera vai até ela e ela fica selecionada, na página dela
 * (o quadro pode ter várias, e a citação pode apontar para qualquer uma). Sem
 * `duracao`, salta (ao abrir o quadro); trocando de página também salta, porque
 * a vista inteira muda e não há caminho a mostrar.
 */
export function mostrarForma(editor: Editor, formaId: TLShapeId, duracao?: number): boolean {
  const pagina = editor.getAncestorPageId(formaId)
  if (pagina === undefined) return false
  const trocaDePagina = pagina !== editor.getCurrentPageId()
  if (trocaDePagina) editor.setCurrentPage(pagina)
  const limites = editor.getShapePageBounds(formaId)
  if (limites === undefined) return false
  editor.select(formaId)
  editor.zoomToBounds(limites, { targetZoom: 1, inset: 96, ...(duracao === undefined || trocaDePagina ? { immediate: true } : { animation: { duration: duracao } }) })
  return true
}

/** As duas formas que uma seta prende (início e fim), ou `null` se uma ponta está solta. */
export function pontasDaSeta(editor: Editor, seta: TLArrowShape): { inicio: TLShapeId; fim: TLShapeId } | null {
  const { start, end } = getArrowBindings(editor, seta)
  if (start === undefined || end === undefined || start.toId === end.toId) return null
  return { inicio: start.toId, fim: end.toId }
}

/** O texto escrito na seta (o rótulo), sem formatação. */
export function textoDaSeta(editor: Editor, seta: TLArrowShape): string {
  return renderPlaintextFromRichText(editor, seta.props.richText).trim()
}

/** O verbete (do Prelúdio) de uma forma, se ela for cartão. */
export function verbeteDaForma(editor: Editor, formaId: TLShapeId, verbetes: ReadonlyMap<string, Verbete>): Verbete | undefined {
  const forma = editor.getShape(formaId)
  if (forma === undefined) return undefined
  const id = verbeteDoRegistro(forma as unknown as Record<string, unknown>)
  return id === null ? undefined : verbeteDoCartao(verbetes, id)
}

/** Põe na seta o tipo da ligação, se ela não tinha texto (o mestre desfaz com Ctrl+Z, como qualquer mudança). */
export function rotularSeta(editor: Editor, seta: TLArrowShape, rotulo: string): void {
  if (rotulo === '' || textoDaSeta(editor, seta) !== '') return
  editor.updateShape<TLArrowShape>({ id: seta.id, type: 'arrow', props: { richText: toRichText(rotulo) } })
}
