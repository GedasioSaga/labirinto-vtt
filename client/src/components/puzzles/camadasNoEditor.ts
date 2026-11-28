import { useEffect, useRef } from 'react'
import { ID_DA_PASTA_DA_PECA_DE_PUZZLE, pastaDaPecaDePuzzle, type ItemDoCatalogo } from '../../lib/acervoDeItens'
import { guardarMidia, urlDaMidiaNoMestre } from '../../lib/midiaNoDisco'
import { PASTAS_MAX, type PastaDeItens } from '../../lib/pastasDosItens'
import { camadasDoPuzzle, descricaoDaLamina, idDoItemDaLamina, marcasDas, nomeDaLamina, quantasLaminas } from '../../puzzles/camadas/camadas'
import { figuraDeFabrica, pngDaLamina, type FiguraEmBitmap } from '../../puzzles/camadas/raster'
import { CATEGORIA_DA_PECA_DE_PUZZLE, type CamadasDoPuzzle, type MarcaDaLamina, type Puzzle } from '../../puzzles/tipos'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'

/**
 * AS CAMADAS NO EDITOR (28/11): cada lâmina vira um item do acervo (categoria
 * "Peça de puzzle", na pasta dela), com o PNG da lâmina no giro de quando
 * pousa. O id do item muda com tudo o que muda o desenho (`idDoItemDaLamina`):
 * mudar a figura, o material ou cortar de novo faz itens novos, e o mestre
 * espalha as lâminas pelo mapa como qualquer item (arrastar do acervo, baú,
 * pino). Com a imagem do mestre ainda por escolher, nada entra.
 */

const IMAGEM_DAS_LAMINAS_SUMIU = 'a imagem das lâminas não está na mídia desta mesa'

async function imagemPropria(ref: string): Promise<ImageBitmap> {
  const url = await urlDaMidiaNoMestre(ref)
  if (url === null) throw new Error(IMAGEM_DAS_LAMINAS_SUMIU)
  const resposta = await fetch(url)
  if (!resposta.ok) throw new Error(IMAGEM_DAS_LAMINAS_SUMIU)
  return createImageBitmap(await resposta.blob())
}

/** O item na pasta "Peça de puzzle" (criada se faltar e couber), como as placas do relevo. */
function naPastaDasPecas(item: ItemDoCatalogo, pastas: readonly PastaDeItens[]): { item: ItemDoCatalogo; pastas: PastaDeItens[] } {
  const achada = pastaDaPecaDePuzzle(pastas)
  if (achada !== undefined) return { item: { ...item, pasta: achada.id }, pastas: [...pastas] }
  if (pastas.length >= PASTAS_MAX) return { item, pastas: [...pastas] }
  return { item: { ...item, pasta: ID_DA_PASTA_DA_PECA_DE_PUZZLE }, pastas: [...pastas, { id: ID_DA_PASTA_DA_PECA_DE_PUZZLE, nome: CATEGORIA_DA_PECA_DE_PUZZLE }] }
}

/** As lâminas do puzzle que ainda não estão no acervo (nenhuma, com a imagem por escolher). */
export function laminasForaDoAcervo(puzzle: Puzzle, idsNoAcervo: ReadonlySet<string>): MarcaDaLamina[] {
  const camadas = camadasDoPuzzle(puzzle)
  if (camadas === null || (camadas.figura === 'imagem' && camadas.imagem === null)) return []
  const quantas = quantasLaminas(puzzle)
  return marcasDas(camadas, quantas).filter((marca) => !idsNoAcervo.has(idDoItemDaLamina(camadas, quantas, marca)))
}

async function figuraDas(camadas: CamadasDoPuzzle): Promise<{ figura: FiguraEmBitmap | null; fechar: () => void }> {
  if (camadas.figura !== 'imagem') return { figura: await figuraDeFabrica(camadas), fechar: () => undefined }
  if (camadas.imagem === null) throw new Error('escolha a imagem das lâminas primeiro')
  const bitmap = await imagemPropria(camadas.imagem)
  return { figura: bitmap, fechar: () => bitmap.close() }
}

/** Põe no acervo as lâminas que ainda não estão lá. Devolve quantas entraram; lança com a frase pronta. */
export async function garantirLaminasNoAcervo(puzzle: Puzzle): Promise<number> {
  const camadas = camadasDoPuzzle(puzzle)
  if (camadas === null) return 0
  const faltam = laminasForaDoAcervo(puzzle, new Set(useAcervoDeItensStore.getState().itens.map((item) => item.id)))
  if (faltam.length === 0) return 0
  const quantas = quantasLaminas(puzzle)
  const { figura, fechar } = await figuraDas(camadas)
  let entraram = 0
  try {
    // Uma de cada vez: o acervo grava em fila, e cada lâmina vê o índice que a anterior deixou.
    for (const marca of faltam) {
      const itemId = idDoItemDaLamina(camadas, quantas, marca)
      if (useAcervoDeItensStore.getState().itens.some((item) => item.id === itemId)) continue
      const imagem = await guardarMidia(await pngDaLamina(camadas, quantas, marca, figura))
      const base: ItemDoCatalogo = { id: itemId, nome: nomeDaLamina(camadas, marca), imagem, descricao: descricaoDaLamina(camadas), categoria: CATEGORIA_DA_PECA_DE_PUZZLE, preco: null, empilhavel: false }
      const lugar = naPastaDasPecas(base, useAcervoDeItensStore.getState().pastas)
      await useAcervoDeItensStore.getState().salvarItem(lugar.item, lugar.pastas)
      entraram += 1
    }
  } finally {
    fechar()
  }
  return entraram
}

/**
 * Sempre que as lâminas mudam (figura, material, corte, quantas, o Desfazer,
 * o puzzle aberto noutro computador), as que não estão no acervo entram.
 * Espera o acervo poder gravar; o aviso diz quantas entraram.
 */
export function useGarantirLaminasNoAcervo(puzzle: Puzzle | null, avisar: (texto: string, tipo?: 'info' | 'error') => void): void {
  const podeGravar = useAcervoDeItensStore((estado) => estado.podeGravar)
  const atual = useRef({ puzzle, avisar })
  useEffect(() => {
    atual.current = { puzzle, avisar }
  })
  const camadas = puzzle === null ? null : camadasDoPuzzle(puzzle)
  const chave = puzzle !== null && camadas !== null ? puzzle.encaixes.map((encaixe) => (encaixe.jeito === 'peca' ? (encaixe.itemId ?? '') : '')).join(',') : ''
  useEffect(() => {
    if (chave === '' || !podeGravar) return
    let vivo = true
    const agora = atual.current.puzzle
    if (agora === null) return
    garantirLaminasNoAcervo(agora).then(
      (entraram) => {
        if (vivo && entraram > 0) atual.current.avisar(`${entraram === 1 ? 'Uma lâmina foi' : `${entraram} lâminas foram`} para o acervo, na pasta Peça de puzzle. Espalhe-as pelo mapa ou guarde num baú.`)
      },
      (erro: unknown) => {
        if (vivo) atual.current.avisar(`As lâminas não entraram no acervo: ${erro instanceof Error ? erro.message : String(erro)}.`, 'error')
      },
    )
    return () => {
      vivo = false
    }
  }, [chave, podeGravar])
}
