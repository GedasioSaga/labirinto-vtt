import { idDaRef, refDoId, resolverComBase, type ResolverDeImagem } from '../../../../lib/midia'
import { isTokenPhotoData } from '../../../../lib/tokenPhoto'

/**
 * O RETRATO DAS FICHAS NA GRADE (fatia G2). No site de verdade a imagem
 * `midia:<id>` da ficha vem da rota de mídia da campanha
 * (`GET /api/c/:id/midia/:midiaId`, só para quem é da mesa); a embutida
 * (`data:`) passa como veio. Na demo (`?demo=1`) não há servidor: cada ficha
 * sem retrato ganha um inventado, desenhado aqui em SVG e embutido no `src`,
 * para a grade da demo mostrar rostos como a Arena do app mostra.
 */

/** A base da rota de mídia da campanha (o resolvedor soma o id). */
export function baseDaMidiaDaMesa(campanhaId: string): string {
  return `/api/c/${encodeURIComponent(campanhaId)}/midia/`
}

/** FNV-1a de 32 bits: o mesmo texto dá sempre o mesmo número (o rosto da ficha não muda de uma visita para outra). */
function espalhar(texto: string): number {
  let valor = 0x811c9dc5
  for (let i = 0; i < texto.length; i += 1) {
    valor ^= texto.charCodeAt(i)
    valor = Math.imul(valor, 0x01000193) >>> 0
  }
  return valor >>> 0
}

/** Um id na forma de `midia:` (64 hex + extensão) tirado da semente: só a demo usa, e só para o rosto inventado. */
function idInventado(semente: string): string {
  let hex = ''
  for (let rodada = 0; rodada < 8; rodada += 1) hex += espalhar(`${rodada}:${semente}`).toString(16).padStart(8, '0')
  return `${hex}.png`
}

/** O retrato que a grade pede ao resolvedor: o da ficha; sem ele, na demo, o inventado pela semente (o id da ficha). */
export function retratoDoBoneco(retrato: string | null, semente: string, demo: boolean): string | null {
  if (retrato !== null) return retrato
  return demo ? refDoId(idInventado(semente)) : null
}

const FUNDOS: readonly (readonly [string, string])[] = [
  ['#2f5874', '#16283a'],
  ['#7a4a35', '#2c1a14'],
  ['#4d6a46', '#1d2a1c'],
  ['#5a4677', '#211a30'],
  ['#7a6234', '#2a2213'],
  ['#3d6b6b', '#152828'],
]
const PELES: readonly string[] = ['#f1c8a4', '#d9a37c', '#b77b55', '#8a5536', '#e7b48f']
const CABELOS: readonly string[] = ['#1d1612', '#4a2c1b', '#8b5a2b', '#c9a15a', '#9b2f24', '#d8d4cc', '#2e3f66']
const ROUPAS: readonly string[] = ['#b4493c', '#2f4d6e', '#3f5a3a', '#6d4f2b', '#ece6d6', '#3a3346']

function escolher<T>(lista: readonly T[], numero: number): T {
  return lista[numero % lista.length] as T
}

/** O cabelo por cima da cabeça (centro 32,27, raio 11): curto, comprido, de lado, preso com faixa. */
function cabelo(estilo: number, cor: string, faixa: string): string {
  switch (estilo % 4) {
    case 0:
      return `<path d="M20.5 27c-.6-8.4 5-13.5 11.5-13.5S44.1 18.6 43.5 27c-2.6-4.4-7-6.6-11.5-6.6S23.1 22.6 20.5 27z" fill="${cor}"/>`
    case 1:
      return `<path d="M19.5 41c-2-9-1.6-16 2.2-21 3.4-4.6 16-4.6 19.6 0 3.8 5 4.2 12 2.2 21-1.6-6-2.4-12.2-4.3-15.6-3.2 2-8.6 3-14.4 1.8-1.6 3.4-3.2 7.8-5.3 13.8z" fill="${cor}"/>`
    case 2:
      return `<path d="M20.6 28.5c-1.2-9 4.4-15 12-15 6.4 0 11.4 4.8 10.8 12.6-5.4-1-11.6-3.4-15.8-7.2-1.8 3.4-4.2 6.6-7 9.6z" fill="${cor}"/>`
    default:
      return `<path d="M20.5 26.5c0-7.6 5.2-12.6 11.5-12.6s11.5 5 11.5 12.6z" fill="${cor}"/><path d="M20.2 22.6h23.6v4.2H20.2z" fill="${faixa}"/><path d="M43.4 23.4l5.6 3.4-4.6 2.6z" fill="${faixa}"/>`
  }
}

/** Os rostos já desenhados: a grade pede o `src` a cada render, e o texto do SVG não precisa sair de novo. */
const ROSTOS = new Map<string, string>()

/** O rosto inventado do id (busto sobre fundo de duas cores), em SVG embutido. */
export function retratoInventado(id: string): string {
  const pronto = ROSTOS.get(id)
  if (pronto !== undefined) return pronto
  const rosto = desenharRosto(id)
  ROSTOS.set(id, rosto)
  return rosto
}

function desenharRosto(id: string): string {
  const n = espalhar(id)
  const [fundoAlto, fundoBaixo] = escolher(FUNDOS, n)
  const pele = escolher(PELES, n >>> 3)
  const corDoCabelo = escolher(CABELOS, n >>> 6)
  const roupa = escolher(ROUPAS, n >>> 9)
  const faixa = escolher(ROUPAS, (n >>> 12) + 1)
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${fundoAlto}"/><stop offset="1" stop-color="${fundoBaixo}"/></linearGradient></defs>` +
    '<rect width="64" height="64" fill="url(#f)"/>' +
    `<path d="M8 66c1.4-12.6 10.6-19.6 24-19.6S54.6 53.4 56 66z" fill="${roupa}"/>` +
    `<path d="M27.4 36.5h9.2v8.6c-2.8 2.4-6.4 2.4-9.2 0z" fill="${pele}"/>` +
    `<ellipse cx="32" cy="28.5" rx="10.6" ry="12" fill="${pele}"/>` +
    cabelo(n >>> 15, corDoCabelo, faixa) +
    '<path d="M27.6 30.6h2.2M34.2 30.6h2.2" stroke="#2a1d16" stroke-width="1.6" stroke-linecap="round"/>' +
    '</svg>'
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/** O resolvedor da demo: a embutida passa; a `midia:` vira o rosto inventado do id (não há servidor a quem pedir). */
export const resolverDaDemo: ResolverDeImagem = (valor) => {
  if (isTokenPhotoData(valor)) return valor
  const id = idDaRef(valor)
  return id === null ? null : retratoInventado(id)
}

/** O resolvedor da tela do treino e do duelo: a rota de mídia da campanha, ou o da demo. */
export function resolverDoSite(campanhaId: string, demo: boolean): ResolverDeImagem {
  return demo ? resolverDaDemo : resolverComBase(baseDaMidiaDaMesa(campanhaId))
}
