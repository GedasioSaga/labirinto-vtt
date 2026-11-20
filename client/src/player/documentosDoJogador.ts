import type { DocumentoNoPapel } from '../documentos/Papel'
import type { BlocoNoFio, DocumentoNaFicha, DocumentoNoFio } from '../documentos/tipos'
import type { Personagem } from '../lib/personagem'
import type { Token } from '../types/map'

/**
 * DOCUMENTOS NA TELA DO JOGADOR (plano dos puzzles, §2.4; fase D3): as contas
 * puras da lista "Documentos". A lista mora na ficha de personagem (vale em
 * qualquer mapa e sessão) e chega com as fichas DELE (`personagens`); a tela só
 * junta, ordena e conta.
 */

/** Um retângulo em px da janela (o `getBoundingClientRect` do que foi tocado): de onde a leitura abre, para onde o papel voa. */
export interface RetanguloNaTela {
  left: number
  top: number
  width: number
  height: number
}

/**
 * A lista dele: as linhas de todas as fichas dele, uma por documento (duas
 * fichas com o mesmo documento: a data da primeira leitura, e o "novo" acende se
 * uma delas ainda não leu), a mais recente primeiro.
 */
export function documentosDoJogador(personagens: readonly Pick<Personagem, 'documentos'>[] | undefined): DocumentoNaFicha[] {
  const porId = new Map<string, DocumentoNaFicha>()
  for (const personagem of personagens ?? []) {
    for (const linha of personagem.documentos ?? []) {
      const ja = porId.get(linha.docId)
      if (ja === undefined) {
        porId.set(linha.docId, linha)
        continue
      }
      const primeira = linha.em < ja.em ? linha : ja
      const novo = ja.novo === true || linha.novo === true
      porId.set(linha.docId, novo && primeira.novo !== true ? { ...primeira, novo: true } : primeira)
    }
  }
  return [...porId.values()].sort((a, b) => b.em - a.em)
}

/**
 * O nome do item que leu um trecho protegido (`com`, um `ItemDoCatalogo.id`),
 * como ele está na mochila de uma das fichas DELE no recorte. `null` = nenhuma
 * ficha dele o carrega agora: o papel diz "um item que você carrega".
 */
export function nomeDoItemQueCarrega(tokens: readonly Pick<Token, 'id' | 'mochila'>[] | undefined, fichasDele: readonly string[], itemId: string): string | null {
  for (const token of tokens ?? []) {
    if (!fichasDele.includes(token.id)) continue
    const vaga = token.mochila?.find((item) => item.itemId === itemId)
    if (vaga !== undefined) return vaga.nome
  }
  return null
}

/** Quantos estão com o aviso de novo (dados pelo mestre ou por um puzzle, ainda não lidos). */
export function quantosNovos(linhas: readonly DocumentoNaFicha[]): number {
  return linhas.reduce((total, linha) => (linha.novo === true ? total + 1 : total), 0)
}

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/** "19/11 22:14", na hora do aparelho (como o protótipo). */
export function quandoFoi(em: number): string {
  const data = new Date(em)
  return `${doisDigitos(data.getDate())}/${doisDigitos(data.getMonth() + 1)} ${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
}

/** A linha de baixo de cada documento na lista: de onde veio e quando (as frases do protótipo aprovado). */
export function metaDaLinha(linha: Pick<DocumentoNaFicha, 'origem' | 'de' | 'em'>): string {
  const quando = quandoFoi(linha.em)
  switch (linha.origem) {
    case 'mapa':
      return `lido no mapa · ${quando}`
    case 'puzzle':
      return `${linha.de === undefined ? 'ganho num puzzle' : `ganho em ${linha.de}`} · ${quando}`
    case 'objeto':
      return `${linha.de === undefined ? 'achado num objeto' : `achado em ${linha.de}`} · ${quando}`
    case 'mestre':
      return `entregue pelo mestre · ${quando}`
  }
}

/**
 * O texto de um pedaço da página como ele lê AGORA: o resolver do host já pôs
 * no `texto` o que cabe a ele (o cifrado de quem não tem o item, o claro de
 * quem tem, o borrado embaralhado). A marca visual de cada trecho é da D5.
 */
function textoDoBloco(bloco: BlocoNoFio): string {
  return bloco.texto
}

/** O documento do fio na forma do papel (`documentos/Papel.tsx`): cada página, os pedaços juntos no texto de antes. */
export function documentoNoPapel(documento: DocumentoNoFio): DocumentoNoPapel {
  return {
    titulo: documento.titulo,
    papel: documento.papel,
    imagemDoPapel: documento.imagemDoPapel,
    paginas: documento.paginas.map((pagina) => ({ texto: pagina.blocos.map(textoDoBloco).join(''), imagem: pagina.imagem })),
  }
}
