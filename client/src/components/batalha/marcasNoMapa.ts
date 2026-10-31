import { useRef } from 'react'
import { aparenciaDaForma } from '../../lib/batalha/transformacao'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import type { EstadoParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { ResolverDeImagem } from '../../lib/midia'
import type { Personagem } from '../../lib/personagem'
import type { FotosDaForma, SeloNaFicha, SelosNasFichas } from '../../pixi/tokenPhotoSprite'

/**
 * BATALHA F3 (fatia T): o que a batalha pinta no MAPA, por ficha: a imagem da
 * forma no lugar da foto e os selos acima do disco (tipos de habilidade F2:
 * com a natureza, que pinta a linha). Puro, menos o gancho do
 * fim: quem monta (App do mestre, Session do jogador) chama e passa ao canvas.
 *
 * O canvas repinta quando a referência muda, e a batalha troca `turnos` a cada
 * ação (HP, vez, carga). Por isso o `useMapaEstavel`: devolve o MESMO mapa
 * enquanto o conteúdo não mudar.
 */

/** Mestre: por tokenId, a imagem da forma ligada (a ficha manda), já resolvida para `src`. */
export function fotosDaFormaDoMestre(turnos: TurnosDaCena | undefined, personagens: readonly Personagem[], resolver: ResolverDeImagem): FotosDaForma | null {
  if (turnos?.formas === undefined) return null
  const fotos = new Map<string, string>()
  for (const carta of turnos.cartas) {
    if (carta.personagemId === null || fotos.has(carta.tokenId)) continue
    const personagem = personagens.find((candidato) => candidato.id === carta.personagemId)
    const src = resolver(aparenciaDaForma(turnos.formas[carta.personagemId], personagem))
    if (src !== null) fotos.set(carta.tokenId, src)
  }
  return fotos.size === 0 ? null : fotos
}

/** Jogador: o host já mandou só as imagens que ele pode ver (`aparencias`); aqui só vira `src`. */
export function fotosDaFormaDoJogador(estado: EstadoParaJogador | null | undefined, resolver: ResolverDeImagem): FotosDaForma | null {
  const aparencias = estado?.aparencias
  if (aparencias === undefined) return null
  const fotos = new Map<string, string>()
  for (const [tokenId, imagem] of Object.entries(aparencias)) {
    const src = resolver(imagem)
    if (src !== null) fotos.set(tokenId, src)
  }
  return fotos.size === 0 ? null : fotos
}

/** Mestre: os selos de cada ficha da ordem, na ordem em que foram postos. */
export function selosNasFichasDoMestre(turnos: TurnosDaCena | undefined): SelosNasFichas | null {
  const selos = turnos?.selos
  if (selos === undefined || selos.length === 0) return null
  const porFicha = new Map<string, SeloNaFicha[]>()
  for (const selo of selos) {
    const lista = porFicha.get(selo.tokenId) ?? []
    lista.push(selo.natureza === undefined ? { nome: selo.nome, turnos: selo.turnos } : { nome: selo.nome, turnos: selo.turnos, natureza: selo.natureza })
    porFicha.set(selo.tokenId, lista)
  }
  return porFicha
}

/** Jogador: os selos que vieram nas cartas (Q5: também de NPC); a carta extra repete os do token, conta uma vez. */
export function selosNasFichasDoJogador(estado: EstadoParaJogador | null | undefined): SelosNasFichas | null {
  if (estado === null || estado === undefined) return null
  const porFicha = new Map<string, SeloNaFicha[]>()
  for (const carta of estado.cartas) {
    if (carta.selos === undefined || carta.selos.length === 0 || porFicha.has(carta.tokenId)) continue
    porFicha.set(
      carta.tokenId,
      carta.selos.map((selo) => (selo.natureza === undefined ? { nome: selo.nome, turnos: selo.turnos } : { nome: selo.nome, turnos: selo.turnos, natureza: selo.natureza })),
    )
  }
  return porFicha.size === 0 ? null : porFicha
}

function mesmasFotos(a: FotosDaForma | null, b: FotosDaForma | null): boolean {
  if (a === b) return true
  if (a === null || b === null || a.size !== b.size) return false
  for (const [tokenId, src] of a) if (b.get(tokenId) !== src) return false
  return true
}

function mesmosSelos(a: SelosNasFichas | null, b: SelosNasFichas | null): boolean {
  if (a === b) return true
  if (a === null || b === null || a.size !== b.size) return false
  for (const [tokenId, lista] of a) {
    const outra = b.get(tokenId)
    if (outra === undefined || outra.length !== lista.length) return false
    if (lista.some((selo, i) => selo.nome !== outra[i].nome || selo.turnos !== outra[i].turnos || selo.natureza !== outra[i].natureza)) return false
  }
  return true
}

/** Guarda o último mapa e o devolve enquanto o novo tiver o mesmo conteúdo. */
function useEstavel<T>(valor: T, igual: (a: T, b: T) => boolean): T {
  const guardado = useRef(valor)
  if (!igual(guardado.current, valor)) guardado.current = valor
  return guardado.current
}

/** As fotos da forma com referência estável (o canvas só repinta quando alguma imagem muda). */
export function useFotosEstaveis(fotos: FotosDaForma | null): FotosDaForma | null {
  return useEstavel(fotos, mesmasFotos)
}

/** Os selos com referência estável (o canvas só reescreve quando algum selo muda). */
export function useSelosEstaveis(selos: SelosNasFichas | null): SelosNasFichas | null {
  return useEstavel(selos, mesmosSelos)
}
