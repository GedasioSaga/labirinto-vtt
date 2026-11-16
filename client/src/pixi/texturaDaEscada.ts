import { CanvasSource, Texture } from 'pixi.js'
import { FOLHA_DA_ESCADA, type FolhaDaEscada } from '../lib/materialDaEscada'
import { urlDaFolhaDaEscada } from '../texturas/escadas/materiais'

/**
 * A TEXTURA de cada folha da escada com material, uma só para o editor e o
 * jogador. Nasce NA HORA, numa tela do tamanho da folha pintada com a cor
 * média, e a imagem é desenhada nela quando chega (`source.update()`): o
 * Graphics da escada já aponta para esta textura, então o degrau ganha a
 * matéria no quadro seguinte sem ninguém precisar repintar a escada (o
 * pintor do jogador só repinta quando a chave da escada muda).
 *
 * `null` onde não há tela 2D (o teste, no jsdom): a escada pinta a cor média.
 */
const texturas = new Map<FolhaDaEscada, Texture | null>()

export function texturaDaEscada(folha: FolhaDaEscada, corMedia: number): Texture | null {
  if (texturas.has(folha)) return texturas.get(folha) ?? null
  const textura = criarTextura(folha, corMedia)
  texturas.set(folha, textura)
  return textura
}

function criarTextura(folha: FolhaDaEscada, corMedia: number): Texture | null {
  if (typeof document === 'undefined') return null
  const tela = document.createElement('canvas')
  tela.width = FOLHA_DA_ESCADA.largura
  tela.height = FOLHA_DA_ESCADA.altura
  const ctx = tela.getContext('2d')
  if (ctx === null) return null
  ctx.fillStyle = `#${corMedia.toString(16).padStart(6, '0')}`
  ctx.fillRect(0, 0, tela.width, tela.height)
  // O degrau é uma janela que começa em qualquer x e o patamar empilha fiadas: repete nos dois eixos (256 x 128, potência de 2).
  const source = new CanvasSource({ resource: tela, autoGenerateMipmaps: true, scaleMode: 'linear', mipmapFilter: 'linear', addressMode: 'repeat' })
  const textura = new Texture({ source })
  const url = urlDaFolhaDaEscada(folha)
  if (url !== null) {
    const imagem = new Image()
    imagem.decoding = 'async'
    imagem.onload = () => {
      ctx.drawImage(imagem, 0, 0, tela.width, tela.height)
      source.update()
    }
    // PNG que não abre: o degrau fica na cor média, sem tentar de novo a cada quadro.
    imagem.onerror = () => undefined
    imagem.src = url
  }
  return textura
}
