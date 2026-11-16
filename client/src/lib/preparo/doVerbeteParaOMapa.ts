import { podeIrAoJogador, textoDaSecaoParaOMapa } from './pacoteDoJogador'
import type { Campanha, Forma, Secao, Verbete } from './tipos'

/**
 * DO VERBETE PARA A FICHA E PARA O MAPA (E3 de 16/11/2026, protótipo aprovado
 * em tmp/pedidos-2026-11-16/e3-prototipo, telas 3 e 4). Puro: o que o "Virar
 * NPC" e o "Pôr no mapa" por tipo tiram do verbete. O "!" em si fica em
 * `pinoDoLugar.ts`, leve, porque a ferramenta Pino do mapa o chama. Seção de segredo nunca
 * entra em nada daqui: nem na descrição da ficha, nem no texto do "!".
 */

/** O título da seção que entra na descrição do NPC junto com o Resumo. */
const TITULO_DA_APARENCIA = 'aparencia'

function semAcentoNemCaixa(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Seção que pode sair do Prelúdio: nem segredo, nem com campos extras (os blocos do mestre). */
function secaoAberta(secao: Secao): boolean {
  return !secao.segredo && secao.extras === undefined
}

/** A imagem da forma: o retrato e, sem ele, a primeira da galeria. `null` = sem imagem. */
export function imagemDaForma(forma: Forma): string | null {
  return forma.retrato ?? forma.imagens[0]?.midia ?? null
}

/**
 * A DESCRIÇÃO DO NPC: o Resumo e a seção "Aparência", nesta ordem, separados
 * por linha em branco. Segredo e verbete que não vai ao jogador ficam de fora.
 */
export function descricaoDoNpc(verbete: Verbete, forma: Forma, todos: ReadonlyMap<string, Verbete>): string {
  const partes = [forma.resumo.trim()]
  if (podeIrAoJogador(verbete)) {
    const aparencia = forma.secoes.find((secao) => secaoAberta(secao) && semAcentoNemCaixa(secao.titulo) === TITULO_DA_APARENCIA)
    if (aparencia !== undefined) partes.push(textoDaSecaoParaOMapa(aparencia.texto, todos).trim())
  }
  return partes.filter((parte) => parte !== '').join('\n\n')
}

/**
 * O TEXTO DO "!" DE UM LUGAR: o Resumo; sem ele, a primeira seção que pode
 * sair. Segredo nunca. Vazio = o cartão só com a imagem e o nome.
 */
export function textoDoLugar(verbete: Verbete, forma: Forma, todos: ReadonlyMap<string, Verbete>): string {
  const resumo = forma.resumo.trim()
  if (resumo !== '' || !podeIrAoJogador(verbete)) return resumo
  const primeira = forma.secoes.find(secaoAberta)
  return primeira === undefined ? '' : textoDaSecaoParaOMapa(primeira.texto, todos).trim()
}

/** A chave do nome de um item: sem acento, sem caixa, espaços juntos ("Lâmina  de sal" = "lamina de sal"). */
export function chaveDoNomeDoItem(nome: string): string {
  return semAcentoNemCaixa(nome)
}

/** O item do Acervo com o MESMO nome (sem acento nem caixa); o primeiro, se houver dois. */
export function itemComOMesmoNome<T extends { readonly nome: string }>(itens: readonly T[], nome: string): T | null {
  const chave = chaveDoNomeDoItem(nome)
  if (chave === '') return null
  return itens.find((item) => chaveDoNomeDoItem(item.nome) === chave) ?? null
}

/** A campanha do verbete que aponta para uma pasta de mapas (onde a ficha mora); `null` = nenhuma. */
export function campanhaComPastaDoVerbete(verbete: Pick<Verbete, 'campanhas'>, campanhas: readonly Campanha[]): (Campanha & { pastaId: string }) | null {
  for (const campanha of campanhas) {
    if (verbete.campanhas.includes(campanha.id) && campanha.pastaId !== undefined) return { ...campanha, pastaId: campanha.pastaId }
  }
  return null
}
