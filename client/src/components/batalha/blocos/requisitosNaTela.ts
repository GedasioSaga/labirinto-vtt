import {
  CASAS_DO_REQUISITO_MAX,
  CATEGORIA_MAX,
  CD_DO_REQUISITO_MAX,
  MARCA_MAX,
  PESSOAS_DO_REQUISITO_MAX,
  QUANTIDADE_DO_REQUISITO_MAX,
  RECURSO_DO_REQUISITO_MAX,
  RODADA_DO_REQUISITO_MAX,
  TEXTO_DO_REQUISITO_MAX,
  TIPOS_DE_REQUISITO,
  VERSAO_DOS_REQUISITOS,
  type ComoConfere,
  type ObjetoJson,
  type TipoDeRequisito,
  type ValorJson,
} from '../../../lib/batalha/requisitos/modelo'
import { NOME_DO_SELO_MAX } from '../../../lib/batalha/combate'

/**
 * OS 41 TIPOS DE REQUISITO NA TELA (fase F de REQUISITOS.md §9 = ED5 do EDITOR.md): o nome e o
 * exemplo da busca, os campos de cada um em frase (o protótipo aprovado, `requisitos/prototipo.html`,
 * tela 1) e o requisito novo de partida. O MODELO é o de `lib/batalha/requisitos/modelo.ts`; a frase
 * do resumo e o "Falta:" são de `frases.ts` e `avaliar.ts` (uma fonte só). Aqui só a forma de editar.
 *
 * O editor mexe no JSON guardado (o mesmo que o disco tem) e quem confere é `lerRequisitos`: um campo
 * pela metade (o nome do selo ainda vazio) vira a peça "torta" com o motivo, sem derrubar a linha.
 */

/** Os grupos da lista (REQUISITOS-LISTA.md), na ordem da busca. O I (evolução e forma) mora na linha Evolução. */
export const GRUPOS_DOS_REQUISITOS: readonly { letra: string; nome: string }[] = [
  { letra: 'A', nome: 'Recursos' },
  { letra: 'B', nome: 'Quem usa' },
  { letra: 'C', nome: 'Tempo e ordem' },
  { letra: 'D', nome: 'O alvo' },
  { letra: 'E', nome: 'O campo' },
  { letra: 'F', nome: 'Itens e armas' },
  { letra: 'G', nome: 'Aliados' },
  { letra: 'H', nome: 'Testes' },
  { letra: 'J', nome: 'Personalizado' },
]

/** De onde vêm as opções de um campo que aponta outra coisa (a técnica, a forma, o atributo...). */
export type FonteDaReferencia = 'tecnica' | 'forma' | 'atributo' | 'acumulador' | 'item' | 'arma'

/** Um campo da frase: número, escolha, referência ou texto. `chave` é a do JSON guardado. */
export type CampoDoRequisito =
  | { tipo: 'numero'; chave: string; rotulo: string; minimo: number; maximo: number; partida: number }
  | { tipo: 'escolha'; chave: string; rotulo: string; opcoes: readonly { valor: string; rotulo: string }[] }
  /** Escolha que é uma chave ligada (`ate: true`) ou ausente. */
  | { tipo: 'bandeira'; chave: string; rotulo: string; sim: string; nao: string }
  | { tipo: 'referencia'; chave: string; rotulo: string; fonte: FonteDaReferencia; opcional?: boolean }
  | { tipo: 'texto'; chave: string; rotulo: string; maximo: number; opcional?: boolean; lista?: 'selos' | 'marcas' }

/** Um pedaço da frase: o texto ou o campo. */
export type PedacoDoMolde = string | CampoDoRequisito

export interface TipoNaTela {
  tipo: TipoDeRequisito
  /** A letra da lista ("A1"). */
  letra: string
  nome: string
  exemplo: string
  molde: readonly PedacoDoMolde[]
}

const num = (chave: string, rotulo: string, minimo: number, maximo: number, partida: number): CampoDoRequisito => ({ tipo: 'numero', chave, rotulo, minimo, maximo, partida })
const ref = (chave: string, rotulo: string, fonte: FonteDaReferencia, opcional = false): CampoDoRequisito => ({ tipo: 'referencia', chave, rotulo, fonte, ...(opcional ? { opcional } : {}) })
const LADO: CampoDoRequisito = { tipo: 'escolha', chave: 'lado', rotulo: 'Abaixo ou acima', opcoes: [{ valor: 'abaixo', rotulo: 'abaixo' }, { valor: 'acima', rotulo: 'acima' }] }
const SE_FALHAR: CampoDoRequisito = {
  tipo: 'escolha',
  chave: 'seFalhar',
  rotulo: 'Se falhar',
  opcoes: [
    { valor: 'naoGasta', rotulo: 'não usa e não gasta nada' },
    { valor: 'perdeAAcao', rotulo: 'perde a ação e o custo' },
  ],
}
const PORCENTO = (rotulo: string): CampoDoRequisito => num('porcento', rotulo, 1, 100, 50)

const tipo = (t: TipoDeRequisito, nome: string, exemplo: string, molde: readonly PedacoDoMolde[]): TipoNaTela => ({ tipo: t, letra: TIPOS_DE_REQUISITO[t].letra, nome, exemplo, molde })

/** Os 41 tipos, na ordem da lista. */
export const TIPOS_NA_TELA: readonly TipoNaTela[] = [
  tipo('sp', 'SP', 'Ter 50 SP ou mais', ['Ter ', num('n', 'SP', 1, RECURSO_DO_REQUISITO_MAX, 30), ' SP ou mais']),
  tipo('vida', 'Vida de quem usa', 'Só com a vida abaixo de 50%', ['Vida ', LADO, ' de ', PORCENTO('Porcentagem da vida'), '%']),
  tipo('escudo', 'Escudo de pé', 'Só com o Escudo de pé', ['Com o Escudo de pé']),
  tipo('contador', 'Nível de um acumulador', 'Polaridade 2 ou mais (e gasta)', [ref('acumulador', 'Acumulador', 'acumulador'), ' ', num('nivel', 'Nível', 1, 99, 2), ' ou mais']),
  tipo('concentracao', 'Concentração', '"Concentrado 2x"', ['Concentração ', num('n', 'Cargas', 0, 3, 1), ' ou mais']),
  tipo('pagaVida', 'Paga com a vida', 'Paga 10% do HP máximo', ['Paga ', PORCENTO('Porcentagem do HP máximo'), '% do HP máximo']),
  tipo('reacaoLivre', 'A reação livre (e gasta)', 'Carregar gasta a reação', ['Ter a reação livre (gasta a reação)']),
  tipo('ligada', 'Técnica ou passiva ligada', 'Melodia de Todas as Coisas ligada', [ref('cartao', 'Técnica', 'tecnica'), ' ligada']),
  tipo('selo', 'Um selo em si', 'Só Fortalecido', ['Ter ', { tipo: 'texto', chave: 'nome', rotulo: 'Selo', maximo: NOME_DO_SELO_MAX, lista: 'selos' }]),
  tipo('naForma', 'Numa forma', 'Só na Forma Híbrida', ['Na forma ', ref('forma', 'Forma', 'forma', true)]),
  tipo('parado', 'Não ter andado', 'Tiro de precisão: parado', ['Não ter andado nesta vez']),
  tipo('andou', 'Ter andado', 'Investida: andou 3 casas', ['Ter andado ', num('casas', 'Casas', 1, CASAS_DO_REQUISITO_MAX, 3), ' casas ou mais nesta vez']),
  tipo('apanhou', 'Ter apanhado', 'Vingança: só se apanhou', ['Ter recebido dano desde a última vez']),
  tipo('acertou', 'Ter acertado nesta vez', 'Golpe de continuação', ['Ter acertado alguém nesta vez']),
  tipo('errou', 'Ter errado o último ataque', 'Segunda chance', ['Ter errado o último ataque']),
  tipo('rodada', 'Rodada', 'A partir da rodada 3', [{ tipo: 'bandeira', chave: 'ate', rotulo: 'A partir de ou até', sim: 'Até a', nao: 'A partir da' }, ' rodada ', num('n', 'Rodada', 1, RODADA_DO_REQUISITO_MAX, 3)]),
  tipo('depoisDe', 'Logo depois de outra', 'Logo depois de Investida', ['Logo depois de usar ', ref('cartao', 'Técnica', 'tecnica')]),
  tipo('jaUsada', 'Outra já usada', 'Depois de usar Grito na batalha', [ref('cartao', 'Técnica', 'tecnica'), ' já usada nesta batalha']),
  tipo('ordemNaVez', 'Primeira ou última da vez', 'Só como a primeira ação', ['Ser a ', { tipo: 'escolha', chave: 'qual', rotulo: 'Qual', opcoes: [{ valor: 'primeira', rotulo: 'primeira' }, { valor: 'ultima', rotulo: 'última' }] }, ' ação da vez']),
  tipo('alvoComSelo', 'Selo no alvo', 'Só em quem está Queimando', ['O alvo com ', { tipo: 'texto', chave: 'nome', rotulo: 'Selo do alvo', maximo: NOME_DO_SELO_MAX, lista: 'selos' }]),
  tipo('alvoVida', 'Vida do alvo', 'Execução: alvo abaixo de 25%', ['Vida do alvo ', LADO, ' de ', PORCENTO('Porcentagem da vida do alvo'), '%']),
  tipo('alvoMarcado', 'Alvo marcado', 'Só no alvo que você marcou', ['O alvo marcado por quem usa']),
  tipo('alvoTipo', 'Tipo do alvo', 'Só em NPC', ['O alvo é ', { tipo: 'escolha', chave: 'quem', rotulo: 'Tipo do alvo', opcoes: [{ valor: 'npc', rotulo: 'NPC' }, { valor: 'jogador', rotulo: 'jogador' }, { valor: 'invocacao', rotulo: 'invocação' }] }]),
  tipo('alvoJaAgiu', 'Alvo já agiu', 'Contra-golpe: o alvo já agiu', ['O alvo já agiu nesta rodada']),
  tipo('aliadoPerto', 'Aliado perto', 'Um aliado a até 2 casas', ['Um aliado a até ', num('casas', 'Casas', 1, CASAS_DO_REQUISITO_MAX, 2), ' casas']),
  tipo('sozinho', 'Sozinho', 'Nenhum aliado a até 3 casas', ['Nenhum aliado a até ', num('casas', 'Casas', 1, CASAS_DO_REQUISITO_MAX, 3), ' casas']),
  tipo('semInimigoColado', 'Sem inimigo colado', 'Tiro: nenhum inimigo do lado', ['Nenhum inimigo colado']),
  tipo('inimigosPerto', 'Inimigos perto', '3 inimigos a até 2 casas', [num('n', 'Inimigos', 1, PESSOAS_DO_REQUISITO_MAX, 2), ' inimigos ou mais a até ', num('casas', 'Casas', 1, CASAS_DO_REQUISITO_MAX, 2), ' casas']),
  tipo('luz', 'Na luz ou no escuro', 'Sombra: só no escuro', ['Estar ', { tipo: 'escolha', chave: 'onde', rotulo: 'Luz', opcoes: [{ valor: 'escuro', rotulo: 'no escuro' }, { valor: 'luz', rotulo: 'na luz' }] }]),
  tipo('item', 'Item na mochila', 'Gasta 1 Pólvora', ['Ter ', num('quantidade', 'Quantidade', 1, QUANTIDADE_DO_REQUISITO_MAX, 1), ' ', ref('item', 'Item', 'item'), ' na mochila']),
  tipo('armaNaMao', 'Arma na mão', 'Só com arma de fogo', ['Arma na mão', { tipo: 'texto', chave: 'categoria', rotulo: 'Categoria da arma (vazio = qualquer)', maximo: CATEGORIA_MAX, opcional: true }]),
  tipo('municao', 'Balas', '2 balas', ['Ter ', num('n', 'Balas', 1, QUANTIDADE_DO_REQUISITO_MAX, 1), ' balas']),
  tipo('pedirAoAliado', 'Um aliado paga', 'Um aliado paga 25 SP', ['Um aliado paga ', num('n', 'Quanto', 1, RECURSO_DO_REQUISITO_MAX, 25), ' ', { tipo: 'escolha', chave: 'recurso', rotulo: 'Recurso', opcoes: [{ valor: 'sp', rotulo: 'SP' }, { valor: 'hp', rotulo: 'HP' }, { valor: 'escudo', rotulo: 'Escudo' }] }]),
  tipo('ajudaDeAliado', 'Ajuda de um aliado com marca', 'Ajuda de um aliado com Fogo', ['Ajuda de um aliado com ', { tipo: 'texto', chave: 'marca', rotulo: 'Marca', maximo: MARCA_MAX, lista: 'marcas' }]),
  tipo('aliadoUsou', 'Um aliado usou', 'Um aliado usou Grito nesta rodada', ['Um aliado usou ', ref('cartao', 'Técnica', 'tecnica'), ' nesta rodada']),
  tipo('aliadosDePe', 'Aliados de pé', '2 aliados de pé', [num('quantos', 'Aliados', 1, PESSOAS_DO_REQUISITO_MAX, 2), ' aliados de pé']),
  tipo('aliadoCaiu', 'Um aliado caiu', 'Fúria: um aliado caiu', ['Um aliado caiu nesta batalha']),
  tipo('teste', 'Passar num teste', 'Percepção CD 15', ['Passar em ', ref('atributo', 'Atributo', 'atributo'), ' contra CD ', num('cd', 'CD', 1, CD_DO_REQUISITO_MAX, 15), '; se falhar, ', SE_FALHAR]),
  tipo('disputa', 'Vencer uma disputa', 'Força contra Força do alvo', ['Vencer o alvo em ', ref('atributo', 'Atributo', 'atributo'), '; se falhar, ', SE_FALHAR]),
  tipo('personalizado', 'Personalizado (Cumpriu?)', 'Só depois de ouvir a música', [{ tipo: 'texto', chave: 'texto', rotulo: 'O que precisa', maximo: TEXTO_DO_REQUISITO_MAX }]),
  tipo('mestreDecide', 'O mestre decide', 'O mestre libera na hora', ['O mestre decide', { tipo: 'texto', chave: 'texto', rotulo: 'O que o mestre olha (opcional)', maximo: TEXTO_DO_REQUISITO_MAX, opcional: true }]),
]

const POR_TIPO: ReadonlyMap<string, TipoNaTela> = new Map(TIPOS_NA_TELA.map((t) => [t.tipo, t]))

export function tipoNaTela(tipoLido: string): TipoNaTela | undefined {
  return POR_TIPO.get(tipoLido)
}

/** O selo de quem confere, como no protótipo. */
export const COMO_CONFERE_NA_TELA: Readonly<Record<ComoConfere, { curto: string; longo: string }>> = {
  auto: { curto: 'Auto', longo: 'o app confere sozinho' },
  pergunta: { curto: 'Pergunta', longo: 'espera alguém: o aliado ou o mestre' },
  teste: { curto: 'Rola d20', longo: 'o host rola o d20 na hora' },
  caixa: { curto: 'Cumpriu?', longo: 'quem usa marca "Cumpriu?" na hora' },
}

/** Opções de cada fonte, já com id e nome. */
export type OpcoesDasFontes = Readonly<Record<FonteDaReferencia, readonly { id?: string; nome: string }[]>>

/** Um id curto e novo para a peça (`r` + base 36; o leitor aceita letras, números, _ e -). */
export function idNovo(): string {
  return `r${Math.random().toString(36).slice(2, 9)}`
}

/** O requisito novo de um tipo, com os números de partida e a primeira opção de cada referência. */
export function requisitoNovo(t: TipoNaTela, fontes: OpcoesDasFontes, texto = ''): ObjetoJson {
  const peca: ObjetoJson = { id: idNovo(), tipo: t.tipo }
  for (const parte of t.molde) {
    if (typeof parte === 'string') continue
    if (parte.tipo === 'numero') peca[parte.chave] = parte.partida
    else if (parte.tipo === 'escolha') peca[parte.chave] = parte.opcoes[0]?.valor ?? ''
    else if (parte.tipo === 'texto' && !parte.opcional) peca[parte.chave] = texto
    else if (parte.tipo === 'referencia' && !parte.opcional) {
      const primeira = fontes[parte.fonte][0]
      peca[parte.chave] = primeira === undefined ? { nome: '' } : referenciaJson(primeira)
    }
  }
  // A7 e A6 sempre gastam (não há o "e gasta" deles); o resto começa só exigindo.
  return peca
}

/** A referência como o disco a guarda ({ id?, nome }). */
export function referenciaJson(referencia: { id?: string; nome: string }): ObjetoJson {
  return referencia.id === undefined ? { nome: referencia.nome } : { id: referencia.id, nome: referencia.nome }
}

/** O valor de uma chave do JSON, só se for número. */
export function numeroDoJson(peca: ObjetoJson, chave: string): number | null {
  const valor = peca[chave]
  return typeof valor === 'number' ? valor : null
}

/** O valor de uma chave do JSON, só se for texto. */
export function textoDoJson(peca: ObjetoJson, chave: string): string {
  const valor = peca[chave]
  return typeof valor === 'string' ? valor : ''
}

/** O nome de uma referência guardada ({ nome }), ou ''. */
export function nomeDaReferencia(peca: ObjetoJson, chave: string): string {
  const valor = peca[chave]
  return ehObjetoJson(valor) && typeof valor.nome === 'string' ? valor.nome : ''
}

export function ehObjetoJson(valor: ValorJson | undefined): valor is ObjetoJson {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

// ─── As ligações da forma (D8 do rework das habilidades) ────────────────────

/**
 * As duas ligações da forma (D8): moram no bloco do cartão (`requisitos.forma`, I2 do modelo), não
 * numa peça do grupo, e o motor já as confere (`motivoDoSoLigaPor`, `motivoDaOrdem` em `partes.ts`).
 * Na busca aparecem no grupo C, como no protótipo aprovado.
 */
export type LigacaoDaForma = 'soLigaPor' | 'partesEmOrdem'

export interface LigacaoNaTela {
  ligacao: LigacaoDaForma
  letra: string
  nome: string
  exemplo: string
}

export const LIGACOES_NA_TELA: readonly LigacaoNaTela[] = [
  { ligacao: 'soLigaPor', letra: 'C5', nome: 'Só liga pela técnica', exemplo: 'Só transforma com o Grito' },
  { ligacao: 'partesEmOrdem', letra: 'C6', nome: 'Parte da forma, em ordem', exemplo: 'Forma Híbrida: uma Parte por vez' },
]

/** As ligações como o bloco cru as guarda: as técnicas do "Só liga" ({ id?, nome } do disco) e o "em ordem". */
export interface LigacoesDoBloco {
  soLigaPor: readonly ObjetoJson[]
  partesEmOrdem: boolean
}

/** As ligações do bloco cru; sem bloco ou sem `forma`, nenhuma. */
export function ligacoesDoBloco(bloco: ObjetoJson | null): LigacoesDoBloco {
  const forma = bloco?.forma
  if (!ehObjetoJson(forma)) return { soLigaPor: [], partesEmOrdem: false }
  const lista = forma.soLigaPor
  return { soLigaPor: Array.isArray(lista) ? lista.filter(ehObjetoJson) : [], partesEmOrdem: forma.partesEmOrdem === true }
}

/** As ligações que já estão no bloco (a busca não as oferece de novo). */
export function ligacoesAtivas(ligacoes: LigacoesDoBloco): LigacaoDaForma[] {
  const ativas: LigacaoDaForma[] = []
  if (ligacoes.soLigaPor.length > 0) ativas.push('soLigaPor')
  if (ligacoes.partesEmOrdem) ativas.push('partesEmOrdem')
  return ativas
}

/**
 * O bloco com as ligações trocadas. Uma chave de app mais novo dentro de `forma` fica como veio; sem
 * nenhuma ligação, a `forma` sai; sem nada além da versão, o bloco inteiro some (`null`).
 */
export function blocoComLigacoes(bloco: ObjetoJson | null, ligacoes: LigacoesDoBloco): ObjetoJson | null {
  const base: ObjetoJson = bloco ?? { v: VERSAO_DOS_REQUISITOS }
  const { forma: antes, ...semForma } = base
  const formaAntes: ObjetoJson = ehObjetoJson(antes) ? antes : {}
  const { soLigaPor: _lista, partesEmOrdem: _ordem, ...outras } = formaAntes
  const forma: ObjetoJson = {
    ...outras,
    ...(ligacoes.partesEmOrdem ? { partesEmOrdem: true } : {}),
    ...(ligacoes.soLigaPor.length > 0 ? { soLigaPor: [...ligacoes.soLigaPor] } : {}),
  }
  const novo: ObjetoJson = Object.keys(forma).length === 0 ? semForma : { ...semForma, forma }
  const { v: _v, ...resto } = novo
  return Object.keys(resto).length === 0 ? null : novo
}
