/**
 * SVG PARA PNG, para a mídia da mesa (PLANO §1.4): "Pôr no acervo" uma peça
 * desenhada grava um PNG de 256 px em `<appData>/midia` (`guardarMidia`), e o
 * item guarda só a referência `midia:<id>`. Assim a vaga da mochila, o lobby e
 * a tela do jogador mostram a peça como mostram qualquer imagem de item, sem
 * campo novo no item nem no `CarriedItem`.
 *
 * PNG e não WebP: a peça tem fundo transparente e contorno fino, e o PNG de
 * 256 px dela fica em poucos KB, longe do teto de 2 MB (`MIDIA_MAX_BYTES`).
 * O desenho é sempre o mesmo, então neste computador o PNG também: pôr a
 * mesma peça de novo cai no mesmo arquivo (o nome é o hash do conteúdo).
 */
import { guardarMidia } from '../../lib/midiaNoDisco'
import type { IdDaPecaDesenhada } from '../tipos'
import { svgDaPeca } from './pecas'

/** O lado do PNG da peça: o da vaga grande da mochila com folga para a tela de alta densidade. */
export const LADO_DO_PNG_DA_PECA = 256

export const FALHA_AO_DESENHAR_A_PECA = 'Não foi possível desenhar a peça para guardar a imagem dela.'

/**
 * Desenha o SVG num quadro de `lado` x `lado` e devolve os bytes do PNG.
 * O SVG precisa trazer `width` e `height` (`svgDaPeca` traz): é o tamanho em
 * que o navegador o decodifica. Só no navegador (canvas); lança com a frase
 * pronta quando o desenho falha.
 */
export async function pngDoSvg(svg: string, lado: number): Promise<Uint8Array> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const imagem = new Image()
    imagem.src = url
    await imagem.decode()
    const canvas = document.createElement('canvas')
    canvas.width = lado
    canvas.height = lado
    const ctx = canvas.getContext('2d')
    if (ctx === null) throw new Error(FALHA_AO_DESENHAR_A_PECA)
    ctx.drawImage(imagem, 0, 0, lado, lado)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((resultado) => (resultado === null ? reject(new Error(FALHA_AO_DESENHAR_A_PECA)) : resolve(resultado)), 'image/png')
    })
    return new Uint8Array(await png.arrayBuffer())
  } catch (erro) {
    // A falha do `decode` vem como `EncodingError` sem frase para o mestre.
    throw erro instanceof Error && erro.message === FALHA_AO_DESENHAR_A_PECA ? erro : new Error(FALHA_AO_DESENHAR_A_PECA)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** A peça desenhada em PNG, gravada na mídia: devolve a referência `midia:<id>` que o item guarda. Lança com a frase pronta. */
export async function guardarPecaDesenhada(id: IdDaPecaDesenhada): Promise<string> {
  return guardarMidia(await pngDoSvg(svgDaPeca(id, LADO_DO_PNG_DA_PECA), LADO_DO_PNG_DA_PECA))
}
