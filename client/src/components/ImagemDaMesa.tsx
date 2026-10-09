import { createContext, useContext } from 'react'
import { resolverComBase, URL_DA_MIDIA_NA_SALA, type ResolverDeImagem } from '../lib/midia'

/**
 * MÍDIA DA MESA na tela: quem desenha a imagem de uma ficha ou de um item
 * pede o `src` a este resolvedor, e não à referência crua. Cada tela põe o
 * seu no alto: o jogador na sala usa o padrão (`/media/<id>`, a rota da sala
 * que serviu a página); o mestre e a janela da Visão de jogador, a ponte de
 * arquivos do Tauri (`baseDaMidiaNoMestre`). A mesma ficha (`FichaDePersonagem`)
 * serve às duas telas sem saber de onde a imagem vem.
 */
export const ImagemDaMesa = createContext<ResolverDeImagem>(resolverComBase(URL_DA_MIDIA_NA_SALA))

export function useImagemDaMesa(): ResolverDeImagem {
  return useContext(ImagemDaMesa)
}
