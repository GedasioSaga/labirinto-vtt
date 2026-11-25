import { CATEGORIA_DA_MUNICAO, ehCategoriaDeMunicao, itemParaDar, novoIdDeItem, type ItemDoCatalogo } from '../acervoDeItens'
import { CAMPO_DO_DANO } from '../batalha/formula'
import { ABA_DAS_ARMAS, CAMPO_DA_QUANTIDADE, CAMPO_DO_EFEITO } from '../batalha/leituraDaFicha'
import { ITEM_QUANTIDADE_MAX } from '../items'
import type { CartaoDaFicha, Personagem } from '../personagem'
import { darNaFicha } from './darNaFicha'
import { municaoNaMochila, nomesDeMunicaoIguais } from './municao'

/**
 * AS BALAS NA MOCHILA (decisão do dono de 25/11/2026, frente A do levantamento de mecânicas
 * duplicadas): a fonte única da bala é o item de Munição do Acervo na mochila. O tipo de bala de
 * texto da aba Armas (subcartão "Tipos de bala", com uma Quantidade que o tiro não desconta) vira,
 * sozinho, a ligação a esse item: o de mesmo nome no Acervo, ou um novo (categoria Munição, com o
 * dano e o efeito do subcartão); a Quantidade vai para a mochila do dono. Depois, cada tiro tira 1
 * de lá (`gastarMunicaoDaFicha`).
 *
 * Nada se perde: o subcartão fica (nome, dano e efeito, que a batalha ainda lê quando o item não diz
 * os seus); só a Quantidade sai dele, e só depois de entrar na mochila. Bala sem número na Quantidade
 * fica como está (só texto, o tiro continua saindo): ligá-la deixaria a ficha sem tiro.
 *
 * Puras: quem grava o Acervo e a ficha é `stores/batalha/conversaoDasFichas.ts`.
 */

/** Uma bala que passou para a mochila: para o aviso ao mestre. */
export interface BalaConvertida {
  nome: string
  /** Quantos entraram na mochila; 0 = a mochila já tinha a munição pelo nome, e a bala só se ligou ao item. */
  quantos: number
}

/** A Quantidade do subcartão como número da mochila; `null` = vazia, zero, texto ou acima do teto da vaga. */
function quantidadeDaBala(bala: CartaoDaFicha): number | null {
  const texto = (bala.campos[CAMPO_DA_QUANTIDADE] ?? '').trim()
  if (!/^\d{1,4}$/.test(texto)) return null
  const numero = Number.parseInt(texto, 10)
  return numero >= 1 && numero <= ITEM_QUANTIDADE_MAX ? numero : null
}

/**
 * O tipo de bala ainda sem item que a conversão leva: com nome, e com número, ou já contando da mochila
 * pelo nome (a vaga de mesmo nome, ou a marca do tiro que já gastou dela, `municaoPeloNome`).
 */
function balaQueConverte(bala: CartaoDaFicha, personagem: Personagem): boolean {
  if (bala.itemId !== undefined || bala.nome.trim() === '') return false
  return jaContaDaMochila(bala, personagem) || quantidadeDaBala(bala) !== null
}

/** A bala já conta da mochila pelo nome: a Quantidade de texto dela não vale há tempo, e não entra (seriam balas de graça). */
function jaContaDaMochila(bala: CartaoDaFicha, personagem: Personagem): boolean {
  return bala.municaoPeloNome === true || municaoNaMochila(personagem.mochila ?? [], bala.nome.trim(), undefined) !== undefined
}

function balasQueConvertem(personagem: Personagem): CartaoDaFicha[] {
  return (personagem.abas[ABA_DAS_ARMAS] ?? []).flatMap((arma) => arma.subcartoes.filter((bala) => balaQueConverte(bala, personagem)))
}

/** O item do Acervo da bala: o de mesmo nome (sem acento, caixa e plural), a Munição primeiro. */
function itemDaBala(nome: string, acervo: readonly ItemDoCatalogo[]): ItemDoCatalogo | undefined {
  const mesmos = acervo.filter((item) => nomesDeMunicaoIguais(item.nome, nome))
  return mesmos.find((item) => ehCategoriaDeMunicao(item.categoria)) ?? mesmos[0]
}

/** O item novo da bala sem par no Acervo: Munição, empilhável, com o dano e o efeito do subcartão. */
function itemNovoDaBala(bala: CartaoDaFicha): ItemDoCatalogo {
  const dano = (bala.campos[CAMPO_DO_DANO] ?? '').trim()
  const efeito = (bala.campos[CAMPO_DO_EFEITO] ?? '').trim()
  return {
    id: novoIdDeItem(),
    nome: bala.nome.trim(),
    imagem: null,
    descricao: efeito,
    categoria: CATEGORIA_DA_MUNICAO,
    preco: null,
    empilhavel: true,
    ...(dano === '' && efeito === '' ? {} : { tiro: { dano, efeito } }),
  }
}

/**
 * Os itens de Munição que o Acervo precisa ganhar ANTES de as fichas se ligarem: um por nome de bala
 * sem par, mesmo que várias fichas o tenham. Vazio = nada a criar.
 */
export function municoesQueFaltam(personagens: readonly Personagem[], acervo: readonly ItemDoCatalogo[]): ItemDoCatalogo[] {
  const novos: ItemDoCatalogo[] = []
  for (const personagem of personagens) {
    for (const bala of balasQueConvertem(personagem)) {
      if (itemDaBala(bala.nome.trim(), [...acervo, ...novos]) === undefined) novos.push(itemNovoDaBala(bala))
    }
  }
  return novos
}

/** O subcartão ligado ao item; a Quantidade sai quando foi para a mochila. */
function balaLigada(bala: CartaoDaFicha, itemId: string, tirarAQuantidade: boolean): CartaoDaFicha {
  const { municaoPeloNome: _peloNome, ...semMarca } = bala
  if (!tirarAQuantidade) return { ...semMarca, itemId }
  const { [CAMPO_DA_QUANTIDADE]: _quantidade, ...campos } = bala.campos
  return { ...semMarca, campos, itemId }
}

/**
 * A ficha com cada tipo de bala de texto ligado ao item do Acervo (`acervo` já com os de
 * `municoesQueFaltam`) e a Quantidade na mochila. Bala sem item no Acervo, ou que não coube na
 * mochila, fica como estava. Nada a converter: a MESMA ficha e nenhuma convertida.
 */
export function fichaComAsBalasNaMochila(personagem: Personagem, acervo: readonly ItemDoCatalogo[], novoIdDaVaga: () => string): { personagem: Personagem; convertidas: BalaConvertida[] } {
  const armas = personagem.abas[ABA_DAS_ARMAS]
  if (armas === undefined || balasQueConvertem(personagem).length === 0) return { personagem, convertidas: [] }
  let ficha = personagem
  const convertidas: BalaConvertida[] = []
  const novasArmas = armas.map((arma) => ({
    ...arma,
    subcartoes: arma.subcartoes.map((bala) => {
      if (!balaQueConverte(bala, ficha)) return bala
      const item = itemDaBala(bala.nome.trim(), acervo)
      if (item === undefined) return bala
      // A mochila que já tem esta munição (pelo item ou pelo nome) manda: a Quantidade de texto, que o tiro já não lia, fica como está.
      const naMochila = municaoNaMochila(ficha.mochila ?? [], bala.nome.trim(), item.id)
      if (jaContaDaMochila(bala, ficha) || (naMochila !== undefined && naMochila.vagaId !== null)) {
        convertidas.push({ nome: bala.nome.trim(), quantos: 0 })
        return balaLigada(bala, item.id, false)
      }
      const quantos = quantidadeDaBala(bala)
      // Munição empilha, mesmo o item antigo cadastrado sem o Empilhável: a Quantidade cabe numa vaga só.
      const deu = quantos === null ? null : darNaFicha(ficha, { ...itemParaDar(item, acervo), empilhavel: true }, quantos, novoIdDaVaga())
      if (deu === null) return bala
      ficha = deu.personagem
      convertidas.push({ nome: bala.nome.trim(), quantos: deu.entraram })
      return balaLigada(bala, item.id, true)
    }),
  }))
  if (convertidas.length === 0) return { personagem, convertidas }
  return { personagem: { ...ficha, abas: { ...ficha.abas, [ABA_DAS_ARMAS]: novasArmas } }, convertidas }
}

/** "Vincent: 12 Bala de Prata na mochila; Balas de RPG ligada ao Acervo." */
export function textoDasBalasConvertidas(nome: string, convertidas: readonly BalaConvertida[]): string {
  const partes = convertidas.map((bala) => (bala.quantos > 0 ? `${bala.quantos} ${bala.nome} na mochila` : `${bala.nome} ligada ao Acervo`))
  return `${nome.trim() || 'Ficha sem nome'}: ${partes.join('; ')}.`
}
