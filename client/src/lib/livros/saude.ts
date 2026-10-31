import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'

/**
 * SAÚDE DA FICHA do mundo do livro de regras (M2,
 * docs/planos/livros-de-regras-plano.md, seção M2): o quanto da ficha a
 * batalha automática consegue ler. Não há leitor novo: é um mapeamento puro
 * dos leitores da F2 (`lerCusto`, `lerAcao`, `lerTempo` em
 * lib/batalha/leituraDaFicha.ts e `lerDano` em lib/batalha/formula.ts) para
 * Lido / Lê na hora / Não lê / À mão. Puro: sem store, sem disco, sem rede.
 *
 * FASE 0 (contrato): tipos, constantes e assinaturas. Os corpos marcados
 * "provisório" devolvem o vazio honesto até o escritor A (contas).
 */

/** Os 4 medidores, na ordem da tela. */
export type CampoDaSaude = 'custo' | 'dano' | 'acao' | 'tempo'
export const CAMPOS_DA_SAUDE: readonly CampoDaSaude[] = ['custo', 'dano', 'acao', 'tempo']
export const ROTULO_DO_CAMPO: Readonly<Record<CampoDaSaude, string>> = { custo: 'Custo', dano: 'Dano', acao: 'Ação', tempo: 'Tempo' }

/**
 * Como um campo foi lido:
 *  - `lido`: a batalha usa o número sozinha;
 *  - `naHora`: lê na batalha com o que só existe lá (arma escolhida, vida do
 *    alvo, custo em % que a pessoa confirma);
 *  - `naoLe`: a batalha pergunta ou ignora — é o que a Saúde lista;
 *  - `aMao`: golpe marcado À mão (`CartaoDaFicha.aMao`): cinza, fora da
 *    porcentagem (decisão 6).
 * Campo vazio (custo "nada", dano "-" de suporte) não é estado: fica fora.
 */
export type EstadoDaLeitura = 'lido' | 'naHora' | 'naoLe' | 'aMao'

export const ROTULO_DO_ESTADO: Readonly<Record<EstadoDaLeitura, string>> = { lido: 'Lido', naHora: 'Lê na hora', naoLe: 'Não lê', aMao: 'À mão' }

/** A leitura de UM campo de um cartão. */
export interface LeituraDoCampo {
  estado: EstadoDaLeitura
  /** O que o app entendeu ("35 de SP", "188") ou vazio quando não lê. */
  leitura: string
  /** A frase do porquê ("Dado (2d6) não entra na conta: o app não rola por você."). */
  motivo: string
}

/** Uma linha da lista da Saúde: um campo de um cartão que não é Lido. */
export interface AchadoDaSaude {
  personagemId: string
  /** O cartão (técnica, ou técnica dentro de transformação). */
  cartaoId: string
  nomeDoCartao: string
  /** Vem de transformação: o nome da forma. */
  forma?: string
  campo: CampoDaSaude
  /** O texto da ficha, como está. */
  texto: string
  leitura: LeituraDoCampo
}

export interface ContagemDaSaude {
  lido: number
  naHora: number
  naoLe: number
  aMao: number
}

export interface SaudeDasFichas {
  contagem: Readonly<Record<CampoDaSaude, ContagemDaSaude>>
  /** 0 a 100, inteiro (`porcentagemDaSaude`). */
  porcentagem: Readonly<Record<CampoDaSaude, number>>
  /** O que a tela lista: `naHora` e `naoLe`, na ordem das fichas e dos cartões. */
  achados: AchadoDaSaude[]
}

/**
 * Lê a saúde de todas as fichas. Variação não conta (herda do modelo: corrigir
 * no modelo propaga; ver `ehVariacao`, lib/livros/combate.ts). Lê as técnicas
 * de Habilidades e as de dentro de TODAS as transformações (ligadas ou não: a
 * saúde é da ficha, não do momento).
 *
 * Provisório (fase 0): tudo zerado até o escritor A.
 */
export function lerSaude(_personagens: readonly Personagem[], _sistema: SistemaDeRpg): SaudeDasFichas {
  const zero = (): ContagemDaSaude => ({ lido: 0, naHora: 0, naoLe: 0, aMao: 0 })
  return {
    contagem: { custo: zero(), dano: zero(), acao: zero(), tempo: zero() },
    porcentagem: { custo: 100, dano: 100, acao: 100, tempo: 100 },
    achados: [],
  }
}

/**
 * A releitura ao vivo do "Corrigir": o campo com o texto que está sendo
 * digitado. `null` = vazio (fica fora da conta). Custo: nada = `null`, valor
 * = Lido, pergunta com sugestão = Lê na hora, sem sugestão = Não lê. Ação:
 * ação nula com texto = Não lê. Tempo: texto = Não lê. Dano: valor = Lido;
 * precisaArma e precisaAlvo = Lê na hora; naoEntende com texto = Não lê;
 * vazio com `aMao` = À mão; semDano = `null`.
 *
 * Provisório (fase 0): devolve `null` até o escritor A.
 */
export function lerCampo(
  _campo: CampoDaSaude,
  _texto: string,
  _cartao: CartaoDaFicha,
  _personagem: Personagem,
  _sistema: SistemaDeRpg,
): LeituraDoCampo | null {
  return null
}

/** (Lido + Lê na hora) / (Lido + Lê na hora + Não lê), inteiro de 0 a 100; À mão fica fora; nada contado = 100. */
export function porcentagemDaSaude(contagem: ContagemDaSaude): number {
  const lidos = contagem.lido + contagem.naHora
  const total = lidos + contagem.naoLe
  return total === 0 ? 100 : Math.round((lidos * 100) / total)
}

/**
 * O personagem com o cartão `cartaoId` trocado por `mudar` (procura também
 * dentro das transformações). Cartão que não existe: a MESMA referência.
 * Funil das escritas da Saúde (Corrigir, Deixar à mão, sugestões).
 *
 * Provisório (fase 0): devolve o personagem como veio até o escritor A.
 */
export function mudarCartao(personagem: Personagem, _cartaoId: string, _mudar: (cartao: CartaoDaFicha) => CartaoDaFicha): Personagem {
  return personagem
}

/** "Corrigir": o campo do cartão com o texto novo. */
export function corrigirCampo(personagem: Personagem, cartaoId: string, campoId: string, texto: string): Personagem {
  return mudarCartao(personagem, cartaoId, (cartao) => ({ ...cartao, campos: { ...cartao.campos, [campoId]: texto } }))
}

/** "Deixar à mão" (`sim`) ou desfazer: liga ou tira `aMao` do cartão. */
export function deixarAMao(personagem: Personagem, cartaoId: string, sim: boolean): Personagem {
  return mudarCartao(personagem, cartaoId, (cartao) => {
    if (sim) return cartao.aMao === true ? cartao : { ...cartao, aMao: true }
    if (cartao.aMao === undefined) return cartao
    const { aMao: _marca, ...semMarca } = cartao
    return semMarca
  })
}
