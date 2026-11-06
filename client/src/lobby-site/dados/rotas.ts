import { segmentoValido } from '../../lib/nuvem/caminho'

/**
 * ROTAS do site (§3.2: a navegação mora na URL). Caminhos de verdade, não
 * `#`: o Pages devolve o `index.html` para qualquer caminho sem arquivo, e o
 * `/c/x` da S1 já abre assim.
 *
 *   /                                  suas mesas (com uma mesa só, a entrada abre direto no lobby dela)
 *   /c/:campanhaId                     o lobby da mesa (H1): quem está, avisos, notícias, chat e atalhos
 *   /c/:campanhaId/fichas              as fichas da mesa (minhas primeiro, colegas só ver)
 *   /c/:campanhaId/f/:fichaId          a ficha
 *   /c/:campanhaId/f/:fichaId/mochila  a mochila dela
 *   /c/:campanhaId/f/:fichaId/historico
 *   /c/:campanhaId/chat                a sala do chat (C2)
 *   /c/:campanhaId/chat/:contaId       o privado com essa conta
 *   /c/:campanhaId/mural               o mural: notícias e avisos (M2)
 *   /c/:campanhaId/mural/modificacoes  o feed do que mudou nas fichas
 *   /c/:campanhaId/treino              o treino (T7)
 *   /c/:campanhaId/treino/duelo        o duelo com um colega (T7)
 *
 * `?demo=1` liga a demo e viaja junto em toda navegação.
 */

export type AbaDaFicha = 'ficha' | 'mochila' | 'historico'

export type AbaDoMural = 'noticias' | 'modificacoes'

export type ParteDoTreino = 'lutas' | 'duelo'

export type Rota =
  | { tela: 'campanhas' }
  /** O lobby da mesa: a primeira tela de dentro dela. */
  | { tela: 'campanha'; campanhaId: string }
  | { tela: 'fichas'; campanhaId: string }
  | { tela: 'treino'; campanhaId: string; parte: ParteDoTreino }
  | { tela: 'ficha'; campanhaId: string; fichaId: string; aba: AbaDaFicha }
  /** `com` = o contaId do outro lado do privado; `null` = a sala. */
  | { tela: 'chat'; campanhaId: string; com: string | null }
  | { tela: 'mural'; campanhaId: string; aba: AbaDoMural }
  | { tela: 'nao-achada' }

const NAO_ACHADA: Rota = { tela: 'nao-achada' }

function abaDe(parte: string | undefined): AbaDaFicha | null {
  if (parte === undefined) return 'ficha'
  return parte === 'mochila' || parte === 'historico' ? parte : null
}

function partesDo(caminho: string): string[] | null {
  try {
    return caminho.split('/').filter((parte) => parte !== '').map(decodeURIComponent)
  } catch (erro) {
    // `%` solto no endereço: é só uma rota que não existe.
    if (erro instanceof URIError) return null
    throw erro
  }
}

/** O `location.pathname` como rota; o que não bate vira `nao-achada` (nunca chega id torto à fila nem ao fio). */
export function lerRota(caminho: string): Rota {
  const partes = partesDo(caminho)
  if (partes === null) return NAO_ACHADA
  if (partes.length === 0) return { tela: 'campanhas' }
  const [c, campanhaId, f, fichaId, parteDaAba, ...sobra] = partes
  if (c !== 'c' || !segmentoValido(campanhaId) || sobra.length > 0) return NAO_ACHADA
  if (f === undefined) return { tela: 'campanha', campanhaId }
  if (f === 'fichas') return fichaId === undefined ? { tela: 'fichas', campanhaId } : NAO_ACHADA
  if (f === 'treino') {
    if (parteDaAba !== undefined) return NAO_ACHADA
    if (fichaId === undefined) return { tela: 'treino', campanhaId, parte: 'lutas' }
    return fichaId === 'duelo' ? { tela: 'treino', campanhaId, parte: 'duelo' } : NAO_ACHADA
  }
  if (f === 'chat') {
    if (parteDaAba !== undefined) return NAO_ACHADA
    if (fichaId === undefined) return { tela: 'chat', campanhaId, com: null }
    return segmentoValido(fichaId) ? { tela: 'chat', campanhaId, com: fichaId } : NAO_ACHADA
  }
  if (f === 'mural') {
    if (parteDaAba !== undefined) return NAO_ACHADA
    if (fichaId === undefined) return { tela: 'mural', campanhaId, aba: 'noticias' }
    return fichaId === 'modificacoes' ? { tela: 'mural', campanhaId, aba: 'modificacoes' } : NAO_ACHADA
  }
  const aba = abaDe(parteDaAba)
  if (f !== 'f' || !segmentoValido(fichaId) || aba === null) return NAO_ACHADA
  return { tela: 'ficha', campanhaId, fichaId, aba }
}

export function caminhoDaRota(rota: Rota): string {
  switch (rota.tela) {
    case 'campanhas':
    case 'nao-achada':
      return '/'
    case 'campanha':
      return `/c/${encodeURIComponent(rota.campanhaId)}`
    case 'fichas':
      return `/c/${encodeURIComponent(rota.campanhaId)}/fichas`
    case 'treino': {
      const doTreino = `/c/${encodeURIComponent(rota.campanhaId)}/treino`
      return rota.parte === 'lutas' ? doTreino : `${doTreino}/duelo`
    }
    case 'ficha': {
      const daFicha = `/c/${encodeURIComponent(rota.campanhaId)}/f/${encodeURIComponent(rota.fichaId)}`
      return rota.aba === 'ficha' ? daFicha : `${daFicha}/${rota.aba}`
    }
    case 'chat': {
      const doChat = `/c/${encodeURIComponent(rota.campanhaId)}/chat`
      return rota.com === null ? doChat : `${doChat}/${encodeURIComponent(rota.com)}`
    }
    case 'mural': {
      const doMural = `/c/${encodeURIComponent(rota.campanhaId)}/mural`
      return rota.aba === 'noticias' ? doMural : `${doMural}/modificacoes`
    }
  }
}

/** A campanha que a rota abre; `null` = rota fora de campanha. */
export function campanhaDaRota(rota: Rota): string | null {
  return rota.tela === 'campanhas' || rota.tela === 'nao-achada' ? null : rota.campanhaId
}

export function ehDemo(busca: string): boolean {
  return new URLSearchParams(busca).get('demo') === '1'
}

/** O endereço para o `href` e o `pushState`, com o `?demo=1` quando a demo está ligada. */
export function enderecoDaRota(rota: Rota, demo: boolean): string {
  return demo ? `${caminhoDaRota(rota)}?demo=1` : caminhoDaRota(rota)
}
