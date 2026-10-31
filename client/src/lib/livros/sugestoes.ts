import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { deixarAMao, mudarCartao, type CampoDaSaude } from './saude'

/**
 * SUGESTÕES DA SAÚDE DA FICHA (M2, docs/planos/livros-de-regras-plano.md,
 * seção M2): poucas regras, cada uma com o porquê, que trocam um texto que a
 * batalha não lê por um que ela lê. Sem regra que serve: a tela fica só com
 * o "Corrigir" e a releitura ao vivo. Puro: sem store, sem disco, sem rede.
 *
 * As regras (o escritor A as escreve):
 *  - "ção X" vira "Ação X" (o "A" comido na digitação);
 *  - abreviação de atributo (FOR, AGI) vira o nome inteiro do sistema;
 *  - "(ignora escudo)" sai do Dano e vira "Perfurante" no Efeito;
 *  - custo com frase ("Seguir todas as condições") manda a frase para a
 *    Descrição e pede o número (custo fica vazio);
 *  - dado ("2d6") no Dano sugere a média, ou "Deixar à mão".
 *
 * FASE 0 (contrato): tipos e assinaturas; `sugestoesPara` provisório.
 */

/** O que é uma regra de sugestão (para a tela agrupar e o teste nomear). */
export type RegraDaSugestao = 'acaoSemA' | 'abreviacao' | 'ignoraEscudo' | 'custoComFrase' | 'dadoNaMedia' | 'dadoAMao'

export interface SugestaoDaFicha {
  regra: RegraDaSugestao
  /** O texto do botão ("Trocar por Ação Bônus", "Usar a média: 7"). */
  rotulo: string
  /** Por que a regra existe, em uma frase. */
  porque: string
  /** Campo do cartão -> texto NOVO inteiro (a Descrição já com a frase somada). Vazio = nenhum campo muda. */
  campos: Readonly<Record<string, string>>
  /** Marca o golpe À mão (`CartaoDaFicha.aMao`): o "Deixar à mão" do dado. */
  aMao?: true
}

/**
 * As sugestões para um campo de um cartão, na ordem de preferência. Lista
 * vazia = nenhuma regra serve.
 *
 * Provisório (fase 0): lista vazia até o escritor A.
 */
export function sugestoesPara(_campo: CampoDaSaude, _cartao: CartaoDaFicha, _sistema: SistemaDeRpg): SugestaoDaFicha[] {
  return []
}

/** Aplica a sugestão ao cartão `cartaoId` do personagem: troca os campos e, se pedir, marca À mão. */
export function aplicarSugestao(personagem: Personagem, cartaoId: string, sugestao: SugestaoDaFicha): Personagem {
  const comCampos =
    Object.keys(sugestao.campos).length === 0 ? personagem : mudarCartao(personagem, cartaoId, (cartao) => ({ ...cartao, campos: { ...cartao.campos, ...sugestao.campos } }))
  return sugestao.aMao === true ? deixarAMao(comCampos, cartaoId, true) : comCampos
}
