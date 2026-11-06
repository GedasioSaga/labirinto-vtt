import { segmentoValido } from '../../lib/nuvem/caminho'
import type { EnderecoDaMesa, SalaDaMesa } from './fonte'

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

// ── A entrada na sala aberta no app ("Entrar na mesa agora", B6) ───────────

/**
 * A mesma forma exata que o DO aceita guardar (`urlDaSalaValida` em
 * lobby/nuvem/src/salaAberta.ts): `http://<IPv4 privado>:<porta>/player` ou
 * `https://<palavra-palavra>.trycloudflare.com/player`, sem barra no fim,
 * query nem fragmento. O site confere de novo porque navega para ela com o
 * convite: uma URL de outra forma levaria o convite a outro lugar.
 */
const FORMA_DA_LAN = /^http:\/\/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}):(\d{1,5})\/player$/
const FORMA_DO_TUNEL = /^https:\/\/([a-z0-9]+(?:-[a-z0-9]+)+)\.trycloudflare\.com\/player$/
/** Sem zero à esquerda: `010` não é `10` para todo leitor de URL. */
const FORMA_DO_NUMERO = /^(?:0|[1-9]\d*)$/
const ROTULO_MAX = 63
const OCTETO_MAX = 255
const PORTA_MAX = 65_535
/** `v1.<base64url>.<base64url>` (client/src/lib/nuvem/bilhete.ts): nada de `#`, `?`, `&` nem espaço. */
const FORMA_DO_BILHETE = /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const BILHETE_MAX = 1024

function numeroAte(texto: string, maximo: number): number | null {
  if (!FORMA_DO_NUMERO.test(texto)) return null
  const numero = Number(texto)
  return numero <= maximo ? numero : null
}

/** 10/8, 172.16/12 e 192.168/16 (RFC 1918), como no DO. */
function lanValida(url: string): boolean {
  const achado = FORMA_DA_LAN.exec(url)
  if (achado === null) return false
  const [primeiro, segundo, ...resto] = achado.slice(1, 5).map((octeto) => numeroAte(octeto, OCTETO_MAX))
  const porta = numeroAte(achado[5], PORTA_MAX)
  if (primeiro === null || segundo === null || resto.some((octeto) => octeto === null) || porta === null || porta === 0) return false
  return primeiro === 10 || (primeiro === 172 && segundo >= 16 && segundo <= 31) || (primeiro === 192 && segundo === 168)
}

export function enderecoDaMesaValido(endereco: EnderecoDaMesa): boolean {
  if (endereco.tipo === 'lan') return lanValida(endereco.url)
  const achado = FORMA_DO_TUNEL.exec(endereco.url)
  return achado !== null && achado[1].length <= ROTULO_MAX
}

/**
 * O endereço que o botão abre: o túnel quando o app tem um, porque o Local
 * Network Access do Chrome e do Safari pode pedir permissão (ou barrar) para
 * um site da internet abrir o IP da rede local; sem túnel, o da rede local.
 */
export function enderecoDoBotao(sala: SalaDaMesa): EnderecoDaMesa | null {
  return sala.enderecos.find((endereco) => endereco.tipo === 'tunel') ?? sala.enderecos.find((endereco) => endereco.tipo === 'lan') ?? null
}

/**
 * A URL que a aba do jogador abre: o convite SÓ no fragmento (`#entrar=`),
 * que o navegador não manda ao servidor nem põe no Referer, e nunca na query
 * (`?`), que vai no pedido, no log do servidor e no histórico de quem está no
 * meio. `null` = endereço ou convite fora da forma: o site não abre nada.
 */
export function enderecoDeEntrada(endereco: EnderecoDaMesa, bilhete: string): string | null {
  if (!enderecoDaMesaValido(endereco) || bilhete.length > BILHETE_MAX || !FORMA_DO_BILHETE.test(bilhete)) return null
  return `${endereco.url}#entrar=${bilhete}`
}
