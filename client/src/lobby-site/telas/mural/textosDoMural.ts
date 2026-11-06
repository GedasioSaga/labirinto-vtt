import { ehRefDeMidia, idDaRef } from '../../../lib/midia'
import { MURAL_TEXTO_MAX, type MotivoDoMuralRecusado, type NoticiaDoMural, type ReacaoDoMural } from '../../../lib/nuvem/muralDoLobby'
import type { SituacaoDaPostagem } from '../../dados/muralDaCampanha'
import { imagemDaDemo } from '../../dados/muralDaDemo'
import type { FichaDoSite } from '../../dados/sessaoDaCampanha'

/**
 * OS TEXTOS DO MURAL (fatia M2), puros: o motivo de uma recusa, a situação de
 * uma notícia que ainda não saiu, o nome de cada reação para quem usa leitor
 * de tela e de onde vem cada imagem. As telas só montam.
 */

export function textoDaRecusa(motivo: MotivoDoMuralRecusado): string {
  switch (motivo) {
    case 'texto':
      return `O texto ficou vazio ou passou de ${MURAL_TEXTO_MAX.toLocaleString('pt-BR')} caracteres.`
    case 'imagem':
      return 'Esta imagem não está guardada nesta mesa. Escolha outra ou poste sem imagem.'
    case 'nao-existe':
      return 'Esta notícia não existe mais.'
    case 'sem-permissao':
      return 'Só o mestre pode fazer isso.'
    case 'apagada':
      return 'Esta notícia já foi apagada.'
    case 'formato':
      return 'O servidor não entendeu o pedido. Recarregue a página.'
    case 'ritmo':
      return 'Devagar: espere um instante.'
    case 'cota':
      return 'Limite de hoje atingido. Tente de novo amanhã.'
  }
}

export function textoDaPostagem(situacao: SituacaoDaPostagem, agora: number): string {
  switch (situacao.t) {
    case 'enviando':
      return 'Enviando…'
    case 'esperando': {
      const segundos = Math.max(1, Math.ceil((situacao.ate - agora) / 1000))
      return situacao.motivo === 'cota' ? `Limite de hoje atingido: vai sozinha em ${segundos} s.` : `Segurada um instante: vai sozinha em ${segundos} s.`
    }
    case 'recusada':
      return `Não foi: ${textoDaRecusa(situacao.motivo)}`
  }
}

const NOME_DA_REACAO: Readonly<Record<ReacaoDoMural, string>> = {
  '👍': 'Curti',
  '❤️': 'Amei',
  '😂': 'Rindo',
  '😮': 'Surpresa',
  '😢': 'Triste',
  '🔥': 'Fogo',
}

export function nomeDaReacao(reacao: ReacaoDoMural): string {
  return NOME_DA_REACAO[reacao]
}

/** O `src` da imagem de uma notícia: a rota de mídia da campanha (W3), ou a inventada na demo. */
export function urlDaImagem(ref: string, campanhaId: string, demo: boolean): string | null {
  if (demo) return imagemDaDemo(ref)
  const id = idDaRef(ref)
  return id === null ? null : `/api/c/${encodeURIComponent(campanhaId)}/midia/${id}`
}

/**
 * As imagens que esta mesa já guarda no Lobby e que o site conhece: as das
 * notícias e os retratos das fichas (o app do mestre sobe junto com elas).
 * O site não sobe imagem nova (na v1, só o app sobe, §6.6).
 */
export function imagensDaMesa(noticias: readonly NoticiaDoMural[], fichas: readonly FichaDoSite[]): string[] {
  const refs = new Set<string>()
  for (const noticia of noticias) if (noticia.imagem !== null) refs.add(noticia.imagem)
  for (const ficha of fichas) if (ehRefDeMidia(ficha.doc.retrato)) refs.add(ficha.doc.retrato)
  return [...refs]
}

/** A frase do feed com o nome de quem mudou separado (a tela o põe em negrito). */
export function partesDaFrase(frase: string, autorNome: string): { quem: string; resto: string } {
  const prefixo = `${autorNome} `
  return frase.startsWith(prefixo) ? { quem: autorNome, resto: frase.slice(prefixo.length) } : { quem: '', resto: frase }
}
