import { aplicarAjustes, atributoComposto, cartoesQueLigam, maximoComposto, temMaximo } from '../ajusteDaFicha'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import { motivoDaAcao, type AcoesDaVez } from './acoes'
import { NUMEROS_DA_FORMA_MAX, type AcaoDaForma, type FormaNaBatalha, type NumeroDaForma } from './combate'
import { CAMPO_DA_ACAO, lerAcao } from './leituraDaFicha'

/**
 * TRANSFORMAÇÃO NA BATALHA, F3 fatia T (seção 3.2 de
 * docs/planos/batalha-one-piece-f3-plano.md; decisão 16 e respostas Q1 a Q3):
 * a tira Transformação do menu da vez. Ativar liga o cartão, gasta a ação do
 * campo Ação (vazio = Completa) e o ATUAL de cada recurso com atual e máximo
 * ganha a diferença do máximo (Q1: HP e SP). Desfazer a forma é ação livre.
 * Ligar pela FICHA no meio da batalha continua manual (Q2); ao encerrar, a
 * forma segue ligada e só a imagem volta (Q3).
 *
 * Puro: sem store, sem rede.
 */

export interface FormaNoMenu {
  cartao: CartaoDaFicha
  ligada: boolean
  /** O campo Ação; vazio ou ilegível = "completa". */
  acaoDaFicha: AcaoDaForma
  imagem: string | null
  /** A prévia do que muda (modificadores, máximos, atual). Vazia na forma já ligada. */
  numeros: NumeroDaForma[]
  /** Nomes dos subcartões (entram nas Habilidades quando ligada: já é a F2). */
  tecnicas: string[]
  /** Apagada com a ação DA FICHA e por quê; `null` = pode. O seletor relê com `motivoDaForma`. */
  motivo: string | null
}

/** A ação que Ativar a forma gasta, pelo campo Ação: Simples, Completa ou Bônus; o resto (vazio, Livre, ilegível) = Completa. */
export function acaoDaForma(cartao: CartaoDaFicha): AcaoDaForma {
  const { acao } = lerAcao(cartao.campos[CAMPO_DA_ACAO] ?? '')
  return acao === 'simples' || acao === 'bonus' ? acao : 'completa'
}

/** O cartão de forma (aba que liga) pelo id; `null` = não é forma desta ficha. */
export function formaDaFicha(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string): CartaoDaFicha | null {
  return cartoesQueLigam(personagem, sistema).find((cartao) => cartao.id === cartaoId) ?? null
}

/**
 * Por que Ativar está apagado com a ação ESCOLHIDA na tela, ou `null`.
 * Forma ligada: nada a ativar (Desfazer é ação livre, sempre pode). `acoes`
 * null = sem a conta da vez (o mestre fora da vez): não apaga.
 */
export function motivoDaForma(forma: Pick<FormaNoMenu, 'ligada'>, acao: AcaoDaForma, acoes: AcoesDaVez | null): string | null {
  if (forma.ligada) return null
  return acoes === null ? null : motivoDaAcao(acoes, acao)
}

/** As formas da ficha para a tira Transformação, com a prévia de cada uma desligada. */
export function formasNoMenu(personagem: Personagem, sistema: SistemaDeRpg, acoes: AcoesDaVez | null): FormaNoMenu[] {
  return cartoesQueLigam(personagem, sistema).map((cartao) => {
    const ligada = personagem.cartoesAtivos.includes(cartao.id)
    const acaoDaFicha = acaoDaForma(cartao)
    // A prévia é a própria ativação feita no ar (o histórico e o relógio não importam aqui).
    const previa = ligada ? null : ativarForma(personagem, sistema, cartao.id, '', 0)
    return {
      cartao,
      ligada,
      acaoDaFicha,
      imagem: cartao.imagem,
      numeros: previa?.numeros ?? [],
      tecnicas: cartao.subcartoes.map((subcartao) => subcartao.nome),
      motivo: motivoDaForma({ ligada }, acaoDaFicha, acoes),
    }
  })
}

/** As chaves que os modificadores do cartão mexem, separadas: atributos e recursos de atual e máximo. */
function chavesDoCartao(cartao: CartaoDaFicha, sistema: SistemaDeRpg): { atributos: string[]; recursos: string[] } {
  const chaves = [...new Set(cartao.modificadores.map((mod) => mod.atributo))]
  return {
    atributos: sistema.atributos.filter((atributo) => chaves.includes(atributo.id)).map((atributo) => atributo.id),
    recursos: sistema.recursos.filter((recurso) => chaves.includes(recurso.id) && temMaximo(sistema, recurso.id)).map((recurso) => recurso.id),
  }
}

/** "FOR 160 → 220", "HP máx 1.200 → 1.800", "HP 900 → 1.500": o que mudou de `antes` para `depois`, na ordem atributos, depois cada recurso (máximo e atual). */
function numerosDaForma(antes: Personagem, depois: Personagem, sistema: SistemaDeRpg, cartao: CartaoDaFicha): NumeroDaForma[] {
  const { atributos, recursos } = chavesDoCartao(cartao, sistema)
  const numeros: NumeroDaForma[] = []
  for (const atributo of sistema.atributos) {
    if (!atributos.includes(atributo.id)) continue
    const de = atributoComposto(antes, atributo.id).total
    const para = atributoComposto(depois, atributo.id).total
    if (de !== para) numeros.push({ rotulo: atributo.abreviacao || atributo.nome, de, para })
  }
  for (const recurso of sistema.recursos) {
    if (!recursos.includes(recurso.id)) continue
    const maximoDe = maximoComposto(antes, recurso.id).total
    const maximoPara = maximoComposto(depois, recurso.id).total
    if (maximoDe !== maximoPara) numeros.push({ rotulo: `${recurso.nome} máx`, de: maximoDe, para: maximoPara })
    const atualDe = numeroDaFicha(antes.recursos, recurso.id)
    const atualPara = numeroDaFicha(depois.recursos, recurso.id)
    if (atualDe !== atualPara) numeros.push({ rotulo: recurso.nome, de: atualDe, para: atualPara })
  }
  return numeros.slice(0, NUMEROS_DA_FORMA_MAX)
}

/**
 * Ativar: liga o cartão e, para cada recurso de atual e máximo que a forma
 * AUMENTA, soma a diferença do máximo ao atual (Q1: HP e SP; o
 * `aplicarAjuste` limita no máximo novo). Máximo que cai: o corte do ligar já
 * resolve. Tudo pelo `aplicarAjustes`, com o histórico da ficha em nome de
 * `quem`. `null` = não ativou (não é forma da ficha, ou já está ligada).
 */
export function ativarForma(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string, quem: string, quando: number): { personagem: Personagem; numeros: NumeroDaForma[] } | null {
  const cartao = formaDaFicha(personagem, sistema, cartaoId)
  if (cartao === null || personagem.cartoesAtivos.includes(cartaoId)) return null
  const { recursos } = chavesDoCartao(cartao, sistema)
  const maximosAntes = new Map(recursos.map((recurso) => [recurso, maximoComposto(personagem, recurso).total]))
  const ligado = aplicarAjustes(personagem, sistema, [{ parte: 'cartao', chave: cartaoId, valor: 1 }], quem, quando)
  if (!ligado.cartoesAtivos.includes(cartaoId)) return null
  const ganhos = recursos.flatMap((recurso) => {
    const diferenca = maximoComposto(ligado, recurso).total - (maximosAntes.get(recurso) ?? 0)
    return diferenca > 0 ? [{ parte: 'recurso' as const, chave: recurso, valor: numeroDaFicha(ligado.recursos, recurso) + diferenca }] : []
  })
  const depois = ganhos.length === 0 ? ligado : aplicarAjustes(ligado, sistema, ganhos, quem, quando)
  return { personagem: depois, numeros: numerosDaForma(personagem, depois, sistema, cartao) }
}

/** "Desfazer a forma" (ação livre): desliga o cartão; o corte do máximo já resolve o atual. `null` = não estava ligada. */
export function desfazerForma(personagem: Personagem, sistema: SistemaDeRpg, cartaoId: string, quem: string, quando: number): Personagem | null {
  if (!personagem.cartoesAtivos.includes(cartaoId)) return null
  const depois = aplicarAjustes(personagem, sistema, [{ parte: 'cartao', chave: cartaoId, valor: 0 }], quem, quando)
  return depois.cartoesAtivos.includes(cartaoId) ? null : depois
}

/** A imagem da forma para o token e o retrato: só enquanto o cartão segue ligado (R5: desligou pela ficha, a imagem volta sozinha). */
export function aparenciaDaForma(forma: FormaNaBatalha | undefined, personagem: Personagem | undefined): string | null {
  if (forma === undefined || personagem === undefined || !personagem.cartoesAtivos.includes(forma.cartaoId)) return null
  return forma.imagem
}

/**
 * Q3, no Encerrar: a forma ativada pelo menu CONTINUA ligada (a ficha manda;
 * só a imagem volta, porque `formas` some com a batalha). As linhas "Bruno
 * segue em Punho Negro", uma por personagem cuja forma segue ligada, para a
 * tela do Encerrar mostrar (o registro some junto com a batalha).
 */
export function formasQueSeguem(formas: Readonly<Record<string, FormaNaBatalha>> | undefined, personagens: readonly Personagem[]): string[] {
  if (formas === undefined) return []
  const linhas: string[] = []
  for (const [personagemId, forma] of Object.entries(formas)) {
    const personagem = personagens.find((candidato) => candidato.id === personagemId)
    const nome = nomeDaFormaLigada(forma, personagem)
    if (personagem !== undefined && nome !== null) linhas.push(`${personagem.nome} segue em ${nome}`)
  }
  return linhas
}

/** O nome da forma ativada pelo menu, enquanto o cartão segue ligado (a carta mostra "PUNHO NEGRO"). */
export function nomeDaFormaLigada(forma: FormaNaBatalha | undefined, personagem: Personagem | undefined): string | null {
  if (forma === undefined || personagem === undefined || !personagem.cartoesAtivos.includes(forma.cartaoId)) return null
  for (const cartoes of Object.values(personagem.abas)) {
    const cartao = cartoes.find((candidato) => candidato.id === forma.cartaoId)
    if (cartao !== undefined) return cartao.nome
  }
  return null
}
