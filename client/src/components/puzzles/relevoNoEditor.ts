import { useEffect, useRef } from 'react'
import { ID_DA_PASTA_DA_PECA_DE_PUZZLE, pastaDaPecaDePuzzle, type ItemDoCatalogo } from '../../lib/acervoDeItens'
import { guardarMidia, urlDaMidiaNoMestre } from '../../lib/midiaNoDisco'
import { PASTAS_MAX, type PastaDeItens } from '../../lib/pastasDosItens'
import { poligonoDaPlaca } from '../../puzzles/relevo/placas'
import { canvasComImagem, canvasDoPainel, pngDaPlaca } from '../../puzzles/relevo/raster'
import { descricaoDaPlaca, ehRelevo, idDoItemDaPlaca, nomeDaPlaca, placasDoPuzzle } from '../../puzzles/relevo/relevo'
import { CATEGORIA_DA_PECA_DE_PUZZLE, type Puzzle, type VisualDoRelevo } from '../../puzzles/tipos'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'

/**
 * O PAINEL EM RELEVO NO EDITOR (28/11): cada placa que falta vira um item do
 * acervo (categoria "Peça de puzzle", na pasta dela), com o PNG recortado do
 * MESMO painel do quadro. O id do item é fixo pela cena, metal e placa
 * (`idDoItemDaPlaca`): pôr de novo cai no mesmo item, e o mestre espalha as
 * placas pelo mapa como qualquer item (arrastar do acervo, baú, pino).
 */

const IMAGEM_DO_PAINEL_SUMIU = 'a imagem do painel não está na mídia desta mesa'

async function imagemPropria(ref: string): Promise<ImageBitmap> {
  const url = await urlDaMidiaNoMestre(ref)
  if (url === null) throw new Error(IMAGEM_DO_PAINEL_SUMIU)
  const resposta = await fetch(url)
  if (!resposta.ok) throw new Error(IMAGEM_DO_PAINEL_SUMIU)
  return createImageBitmap(await resposta.blob())
}

/** O painel de onde as placas saem: o da cena, ou a moldura com a imagem do mestre na área. */
async function painelDasPlacas(visual: VisualDoRelevo): Promise<HTMLCanvasElement> {
  if (visual.cena !== null) return canvasDoPainel(visual.cena, visual.metal)
  if (visual.imagem === null) throw new Error('escolha a imagem do painel primeiro')
  const bitmap = await imagemPropria(visual.imagem)
  try {
    return await canvasComImagem(visual.metal, bitmap)
  } finally {
    bitmap.close()
  }
}

/** O item na pasta "Peça de puzzle" (criada se faltar e couber), como as peças desenhadas. */
function naPastaDasPecas(item: ItemDoCatalogo, pastas: readonly PastaDeItens[]): { item: ItemDoCatalogo; pastas: PastaDeItens[] } {
  const achada = pastaDaPecaDePuzzle(pastas)
  if (achada !== undefined) return { item: { ...item, pasta: achada.id }, pastas: [...pastas] }
  if (pastas.length >= PASTAS_MAX) return { item, pastas: [...pastas] }
  return { item: { ...item, pasta: ID_DA_PASTA_DA_PECA_DE_PUZZLE }, pastas: [...pastas, { id: ID_DA_PASTA_DA_PECA_DE_PUZZLE, nome: CATEGORIA_DA_PECA_DE_PUZZLE }] }
}

/** As placas que faltam no painel e ainda não estão no acervo. */
export function placasForaDoAcervo(puzzle: Puzzle, idsNoAcervo: ReadonlySet<string>): number[] {
  const visual = puzzle.visual
  if (!ehRelevo(visual)) return []
  return placasDoPuzzle(puzzle).filter((placa) => {
    const id = idDoItemDaPlaca(visual, placa)
    return id !== null && !idsNoAcervo.has(id)
  })
}

/** Põe no acervo as placas do painel que ainda não estão lá. Devolve quantas entraram; lança com a frase pronta. */
export async function garantirPlacasNoAcervo(puzzle: Puzzle): Promise<number> {
  const visual = puzzle.visual
  if (!ehRelevo(visual)) return 0
  const faltam = placasForaDoAcervo(puzzle, new Set(useAcervoDeItensStore.getState().itens.map((item) => item.id)))
  if (faltam.length === 0) return 0
  const painel = await painelDasPlacas(visual)
  let entraram = 0
  // Uma de cada vez: o acervo grava em fila, e cada placa vê o índice que a anterior deixou.
  for (const placa of faltam) {
    const itemId = idDoItemDaPlaca(visual, placa)
    const loja = useAcervoDeItensStore.getState()
    if (itemId === null || loja.itens.some((item) => item.id === itemId)) continue
    const imagem = await guardarMidia(await pngDaPlaca(painel, poligonoDaPlaca(visual.cena, placa)))
    const base: ItemDoCatalogo = { id: itemId, nome: nomeDaPlaca(visual, placa), imagem, descricao: descricaoDaPlaca(visual), categoria: CATEGORIA_DA_PECA_DE_PUZZLE, preco: null, empilhavel: false }
    const lugar = naPastaDasPecas(base, useAcervoDeItensStore.getState().pastas)
    await useAcervoDeItensStore.getState().salvarItem(lugar.item, lugar.pastas)
    entraram += 1
  }
  return entraram
}

/**
 * Sempre que as placas do painel mudam (cena, metal, imagem, quais faltam, o
 * Desfazer, o puzzle aberto noutro computador), as que não estão no acervo
 * entram. Espera o acervo poder gravar; o aviso diz quantas entraram.
 */
export function useGarantirPlacasNoAcervo(puzzle: Puzzle | null, avisar: (texto: string, tipo?: 'info' | 'error') => void): void {
  const podeGravar = useAcervoDeItensStore((estado) => estado.podeGravar)
  const atual = useRef({ puzzle, avisar })
  useEffect(() => {
    atual.current = { puzzle, avisar }
  })
  const chave = puzzle !== null && ehRelevo(puzzle.visual) ? `${puzzle.visual.cena ?? ''}|${puzzle.visual.imagem ?? ''}|${puzzle.encaixes.map((encaixe) => (encaixe.jeito === 'peca' ? (encaixe.itemId ?? '') : '')).join(',')}` : ''
  useEffect(() => {
    if (chave === '' || !podeGravar) return
    let vivo = true
    const agora = atual.current.puzzle
    if (agora === null) return
    garantirPlacasNoAcervo(agora).then(
      (entraram) => {
        if (vivo && entraram > 0) atual.current.avisar(`${entraram === 1 ? 'Uma placa foi' : `${entraram} placas foram`} para o acervo, na pasta Peça de puzzle. Espalhe-as pelo mapa ou guarde num baú.`)
      },
      (erro: unknown) => {
        if (vivo) atual.current.avisar(`As placas não entraram no acervo: ${erro instanceof Error ? erro.message : String(erro)}.`, 'error')
      },
    )
    return () => {
      vivo = false
    }
  }, [chave, podeGravar])
}
