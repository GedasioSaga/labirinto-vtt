import type { SistemaDeRpg } from '../../sistemaDeRpg'
import type { EfeitoDoItem } from '../../../types/map'
import { pecasDoEfeito } from '../../leituraDoItem'
import { VERSAO_GRAVADA, type AlvoDaMecanica, type Efeito, type MecanicaV1, type Teste } from './modelo'
import { atributoDePartida, guardarMecanica } from './modelos'

/**
 * OS 25 MODELOS DE ITEM (Fase 7 de docs/design/habilidades/SISTEMA.md §9.2):
 * o "O que ele faz" do item do Acervo começa por um deles, como a habilidade
 * começa pelos dela. Mesmas peças da técnica (`MecanicaV1`, lidas por
 * `lerMecanica`), sem custo de SP: o custo é o próprio item (decisão C7: Ação
 * Simples de fábrica, gasta 1 por uso). Números fixos: a poção cura igual na
 * mão de qualquer um.
 *
 * Nomes ORIGINAIS (pedido de 21/11/2026: "pode procurar efeitos de jogos, tente
 * usar Final Fantasy e Resident Evil"): de lá vem só a ideia da mecânica; o
 * nome que lembra demais um item de um jogo (as ervas, o spray, a fita) foi
 * trocado por um nosso.
 *
 * Puro: sem store, sem rede.
 */

export type IdDoModeloDeItem =
  | 'pocaoPequena'
  | 'pocaoGrande'
  | 'pocaoSuprema'
  | 'tonicoDeFolego'
  | 'tonicoMaior'
  | 'elixirCompleto'
  | 'elixirDoBando'
  | 'plumaDoRetorno'
  | 'plumaDourada'
  | 'antidoto'
  | 'colirio'
  | 'saisDeDespertar'
  | 'bandagem'
  | 'pomadaFria'
  | 'panaceia'
  | 'folhaDeCura'
  | 'misturaDeFolhas'
  | 'folhaComAntidoto'
  | 'balsamoDeCampanha'
  | 'granadaDeEstilhacos'
  | 'granadaDeClarao'
  | 'garrafaIncendiaria'
  | 'frascoDeAcido'
  | 'tonicoDeGuerra'
  | 'diarioDeViagem'

/** Os grupos do degrau 1 do item (nota 16 do protótipo: como em FF e RE). */
export type GrupoDoModeloDeItem = 'cura' | 'reviver' | 'condicao' | 'arremesso' | 'reforco' | 'fora'

export const GRUPOS_DOS_MODELOS_DE_ITEM: readonly { grupo: GrupoDoModeloDeItem; nome: string }[] = [
  { grupo: 'cura', nome: 'Cura' },
  { grupo: 'reviver', nome: 'Reviver' },
  { grupo: 'condicao', nome: 'Condição' },
  { grupo: 'arremesso', nome: 'Arremesso' },
  { grupo: 'reforco', nome: 'Reforço' },
  { grupo: 'fora', nome: 'Fora da batalha' },
]

export interface ModeloDeItem {
  id: IdDoModeloDeItem
  /** O número da tabela do SISTEMA (I01 a I25). */
  numero: string
  nome: string
  /** O que ele monta, numa frase (a dica do botão). */
  dica: string
  grupo: GrupoDoModeloDeItem
}

export const MODELOS_DE_ITEM: readonly ModeloDeItem[] = [
  { id: 'pocaoPequena', numero: 'I01', nome: 'Poção Pequena', dica: 'Toque: cura 50 de HP.', grupo: 'cura' },
  { id: 'pocaoGrande', numero: 'I02', nome: 'Poção Grande', dica: 'Toque: cura 100 de HP.', grupo: 'cura' },
  { id: 'pocaoSuprema', numero: 'I03', nome: 'Poção Suprema', dica: 'Toque: cura 50% do HP máximo.', grupo: 'cura' },
  { id: 'tonicoDeFolego', numero: 'I04', nome: 'Tônico de Fôlego', dica: 'Toque: recupera 30 de SP.', grupo: 'cura' },
  { id: 'tonicoMaior', numero: 'I05', nome: 'Tônico Maior', dica: 'Toque: recupera 50% do SP máximo.', grupo: 'cura' },
  { id: 'elixirCompleto', numero: 'I06', nome: 'Elixir Completo', dica: 'Toque: HP e SP cheios.', grupo: 'cura' },
  { id: 'elixirDoBando', numero: 'I07', nome: 'Elixir do Bando', dica: 'Aliados a até 2 casas: metade do HP e do SP máximos em cada um.', grupo: 'cura' },
  { id: 'folhaDeCura', numero: 'I16', nome: 'Folha de Cura', dica: 'Toque: cura 25% do HP máximo.', grupo: 'cura' },
  { id: 'misturaDeFolhas', numero: 'I17', nome: 'Mistura de Folhas', dica: 'Toque: HP cheio.', grupo: 'cura' },
  { id: 'plumaDoRetorno', numero: 'I08', nome: 'Pluma do Retorno', dica: 'Toque num aliado caído: volta com 25% do HP máximo.', grupo: 'reviver' },
  { id: 'plumaDourada', numero: 'I09', nome: 'Pluma Dourada', dica: 'Toque num aliado caído: volta com o HP cheio.', grupo: 'reviver' },
  { id: 'antidoto', numero: 'I10', nome: 'Antídoto', dica: 'Toque: tira Envenenado.', grupo: 'condicao' },
  { id: 'colirio', numero: 'I11', nome: 'Colírio', dica: 'Toque: tira Cego.', grupo: 'condicao' },
  { id: 'saisDeDespertar', numero: 'I12', nome: 'Sais de Despertar', dica: 'Toque em outro (quem está travado não usa): tira Atordoado e Paralisado.', grupo: 'condicao' },
  { id: 'bandagem', numero: 'I13', nome: 'Bandagem', dica: 'Toque: tira Sangrando e cura 20 de HP.', grupo: 'condicao' },
  { id: 'pomadaFria', numero: 'I14', nome: 'Pomada Fria', dica: 'Toque: tira Queimando.', grupo: 'condicao' },
  { id: 'panaceia', numero: 'I15', nome: 'Panaceia', dica: 'Toque: tira todas as condições negativas.', grupo: 'condicao' },
  { id: 'folhaComAntidoto', numero: 'I18', nome: 'Folha com Antídoto', dica: 'Toque: cura 25% do HP máximo e tira Envenenado.', grupo: 'condicao' },
  { id: 'balsamoDeCampanha', numero: 'I19', nome: 'Bálsamo de Campanha', dica: 'Toque: HP cheio e tira Sangrando.', grupo: 'condicao' },
  { id: 'granadaDeEstilhacos', numero: 'I20', nome: 'Granada de Estilhaços', dica: 'Todos a 1 casa de um ponto, alcance 6: teste de Agilidade CD 13, metade se passar; 150 de dano.', grupo: 'arremesso' },
  { id: 'granadaDeClarao', numero: 'I21', nome: 'Granada de Clarão', dica: 'Todos a 2 casas de um ponto, alcance 6: teste de Percepção CD 13; quem falha fica Cego 1.', grupo: 'arremesso' },
  { id: 'garrafaIncendiaria', numero: 'I22', nome: 'Garrafa Incendiária', dica: 'Todos a 1 casa de um ponto, alcance 5: reage; 60 de dano e Queimando 3.', grupo: 'arremesso' },
  { id: 'frascoDeAcido', numero: 'I23', nome: 'Frasco de Ácido', dica: '1 alvo a até 4 casas: reage; 80 de dano, perfuração 50%, Corroído 3 (Resistência -15).', grupo: 'arremesso' },
  { id: 'tonicoDeGuerra', numero: 'I24', nome: 'Tônico de Guerra', dica: 'Toque: Vigor 3 (Força +20).', grupo: 'reforco' },
  { id: 'diarioDeViagem', numero: 'I25', nome: 'Diário de Viagem', dica: 'Só fora da batalha, à mão: o mestre guarda este ponto da cena para voltar.', grupo: 'fora' },
]

/** "Toque" (§9.2): em si ou num aliado a até 1 casa. */
const TOQUE: AlvoDaMecanica = { quem: 'aliados', forma: { tipo: 'um' }, alcance: 1 }
/** O toque num aliado caído (o reviver). */
const TOQUE_NO_CAIDO: AlvoDaMecanica = { ...TOQUE, estado: 'caido' }
const SEM_MULTIPLICAR = { concentracao: false, surpresa: false } as const
/** A CD dos arremessos que pedem teste (a da Explosão à distância). */
const CD_DO_ARREMESSO = 13

/** A cura pela parte do máximo do alvo, do mesmo recurso. */
function curaPelaParte(recurso: 'hp' | 'sp', porcento: number): Efeito {
  return { tipo: 'cura', recurso, quanto: { porcento, de: recurso === 'hp' ? 'hpMaximo' : 'spMaximo', deQuem: 'alvo' }, emQuem: 'alvo' }
}

function curaFixa(recurso: 'hp' | 'sp', fixo: number): Efeito {
  return { tipo: 'cura', recurso, quanto: { fixo }, emQuem: 'alvo' }
}

function tira(...nomes: string[]): Efeito {
  return { tipo: 'tirarSelos', quais: { nomes } }
}

/** O teste de resistência do arremesso; sistema sem o atributo (nem outro): o alvo reage normal. */
function testeDoArremesso(sistema: SistemaDeRpg, preferido: string, sePassar: 'nada' | 'metade'): Teste {
  const atributo = atributoDePartida(sistema, preferido)
  return atributo === null ? { tipo: 'reacao' } : { tipo: 'resistencia', alvo: { atributo }, cd: { fixo: CD_DO_ARREMESSO }, sePassar }
}

/** A mecânica de toque que não erra, só com os efeitos. */
function deToque(efeitos: readonly Efeito[], alvo: AlvoDaMecanica = TOQUE): MecanicaV1 {
  return { versao: VERSAO_GRAVADA, acao: 'simples', custos: [], limite: {}, alvo, teste: { tipo: 'naoErra' }, efeitos }
}

/** As peças do modelo, prontas para o motor (os números são ponto de partida; o mestre troca). */
export function mecanicaDoModeloDeItem(id: IdDoModeloDeItem, sistema: SistemaDeRpg): MecanicaV1 {
  switch (id) {
    case 'pocaoPequena':
      return deToque([curaFixa('hp', 50)])
    case 'pocaoGrande':
      return deToque([curaFixa('hp', 100)])
    case 'pocaoSuprema':
      return deToque([curaPelaParte('hp', 50)])
    case 'tonicoDeFolego':
      return deToque([curaFixa('sp', 30)])
    case 'tonicoMaior':
      return deToque([curaPelaParte('sp', 50)])
    case 'elixirCompleto':
      return deToque([curaPelaParte('hp', 100), curaPelaParte('sp', 100)])
    case 'elixirDoBando':
      return deToque([curaPelaParte('hp', 50), curaPelaParte('sp', 50)], { quem: 'aliados', forma: { tipo: 'raio', casas: 2 } })
    case 'plumaDoRetorno':
      return deToque([{ tipo: 'reviver', volta: { porcento: 25, de: 'hpMaximo', deQuem: 'alvo' } }], TOQUE_NO_CAIDO)
    case 'plumaDourada':
      return deToque([{ tipo: 'reviver', volta: { porcento: 100, de: 'hpMaximo', deQuem: 'alvo' } }], TOQUE_NO_CAIDO)
    case 'antidoto':
      return deToque([tira('Envenenado')])
    case 'colirio':
      return deToque([tira('Cego')])
    case 'saisDeDespertar':
      return deToque([tira('Atordoado', 'Paralisado')])
    case 'bandagem':
      return deToque([curaFixa('hp', 20), tira('Sangrando')])
    case 'pomadaFria':
      return deToque([tira('Queimando')])
    case 'panaceia':
      return deToque([{ tipo: 'tirarSelos', quais: 'negativos' }])
    case 'folhaDeCura':
      return deToque([curaPelaParte('hp', 25)])
    case 'misturaDeFolhas':
      return deToque([curaPelaParte('hp', 100)])
    case 'folhaComAntidoto':
      return deToque([curaPelaParte('hp', 25), tira('Envenenado')])
    case 'balsamoDeCampanha':
      return deToque([curaPelaParte('hp', 100), tira('Sangrando')])
    case 'granadaDeEstilhacos':
      return {
        versao: VERSAO_GRAVADA,
        acao: 'simples',
        custos: [],
        limite: {},
        alvo: { quem: 'todos', forma: { tipo: 'raio', casas: 1, centro: 'ponto' }, alcance: 6 },
        teste: testeDoArremesso(sistema, 'agilidade', 'metade'),
        dano: { base: { fixo: 150 }, multiplicadores: { ...SEM_MULTIPLICAR } },
        efeitos: [],
      }
    case 'granadaDeClarao':
      return {
        versao: VERSAO_GRAVADA,
        acao: 'simples',
        custos: [],
        limite: {},
        alvo: { quem: 'todos', forma: { tipo: 'raio', casas: 2, centro: 'ponto' }, alcance: 6 },
        teste: testeDoArremesso(sistema, 'percepcao', 'nada'),
        efeitos: [{ tipo: 'selo', nome: 'Cego', duracao: 1, natureza: 'debuff' }],
      }
    case 'garrafaIncendiaria':
      return {
        versao: VERSAO_GRAVADA,
        acao: 'simples',
        custos: [],
        limite: {},
        alvo: { quem: 'todos', forma: { tipo: 'raio', casas: 1, centro: 'ponto' }, alcance: 5 },
        teste: { tipo: 'reacao' },
        dano: { base: { fixo: 60 }, multiplicadores: { ...SEM_MULTIPLICAR } },
        // Queimando já tira 10 por vez pelo nome (`condicoes.ts`); a peça não repete.
        efeitos: [{ tipo: 'selo', nome: 'Queimando', duracao: 3, natureza: 'debuff' }],
      }
    case 'frascoDeAcido': {
      const resistencia = atributoDePartida(sistema, 'resistencia')
      return {
        versao: VERSAO_GRAVADA,
        acao: 'simples',
        custos: [],
        limite: {},
        alvo: { quem: 'inimigos', forma: { tipo: 'um' }, alcance: 4 },
        teste: { tipo: 'reacao' },
        dano: { base: { fixo: 80 }, perfuracao: 50, multiplicadores: { ...SEM_MULTIPLICAR } },
        efeitos: [{ tipo: 'selo', nome: 'Corroído', duracao: 3, natureza: 'debuff', mods: [{ alvo: resistencia ?? 'reacao', delta: { fixo: -15 } }] }],
      }
    }
    case 'tonicoDeGuerra': {
      const forca = atributoDePartida(sistema, 'forca')
      return deToque([{ tipo: 'selo', nome: 'Vigor', duracao: 3, natureza: 'buff', mods: [{ alvo: forca ?? 'dano', delta: { fixo: 20 } }] }])
    }
    case 'diarioDeViagem':
      return { versao: VERSAO_GRAVADA, acao: 'simples', custos: [], limite: {}, alvo: { quem: 'si', forma: { tipo: 'um' } }, teste: { tipo: 'naoErra' }, efeitos: [{ tipo: 'aMao', texto: 'o mestre guarda este ponto da cena para voltar' }] }
  }
}

/** Onde o item vale, de fábrica: arremesso só na batalha (fora dela é o "Dar dano" do mestre, decisão C19); o diário só fora. */
export function ondeDoModeloDeItem(id: IdDoModeloDeItem): EfeitoDoItem['onde'] {
  const modelo = MODELOS_DE_ITEM.find((candidato) => candidato.id === id)
  if (modelo?.grupo === 'arremesso') return 'soNaBatalha'
  return modelo?.grupo === 'fora' ? 'soFora' : 'sempre'
}

/**
 * O "O que ele faz" inteiro do modelo, como o "Sugerir efeito" o grava: as peças, gasta 1, e o
 * onde de fábrica. `mecanica` troca as peças (o alcance mudado na lista dos antigos). `undefined`
 * = as peças passam do teto do item (nenhum modelo de fábrica passa).
 */
export function efeitoDoModeloDeItem(id: IdDoModeloDeItem, sistema: SistemaDeRpg, mecanica: MecanicaV1 = mecanicaDoModeloDeItem(id, sistema)): EfeitoDoItem | undefined {
  const pecas = pecasDoEfeito(guardarMecanica(mecanica))
  return pecas === null ? undefined : { mecanica: pecas, gasta: 'um', onde: ondeDoModeloDeItem(id) }
}

/**
 * "Sugerir efeito" (SISTEMA.md §9.2, decisão C3): o modelo mais parecido com
 * o que o item de hoje diz no nome e na descrição. Nada é convertido sozinho:
 * o mestre vê o modelo já preenchido e decide. `null` = nada parecido.
 */
export function modeloSugeridoParaOItem(nome: string, descricao: string): IdDoModeloDeItem | null {
  const texto = ` ${`${nome} ${descricao}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()} `
  const pistas: readonly [RegExp, IdDoModeloDeItem][] = [
    [/granada|bomba|explos/, 'granadaDeEstilhacos'],
    [/clarao|flash|luz cegante/, 'granadaDeClarao'],
    [/molotov|incendi|fogo/, 'garrafaIncendiaria'],
    [/acido|corros/, 'frascoDeAcido'],
    [/revive|reviver|ressusc|pluma|fenix/, 'plumaDoRetorno'],
    [/elixir/, 'elixirCompleto'],
    [/antidoto|veneno/, 'antidoto'],
    [/colirio|cegueira/, 'colirio'],
    [/bandagem|atadura|curativo|kit medico|sangr/, 'bandagem'],
    [/queimadura|pomada/, 'pomadaFria'],
    [/panaceia|remedio/, 'panaceia'],
    [/tonico|energia|folego|\bsp\b/, 'tonicoDeFolego'],
    [/(pocao|porcao).*(grande|maior)|(grande|maior).*(pocao|porcao)/, 'pocaoGrande'],
    [/(pocao|porcao).*(suprema|maxima)/, 'pocaoSuprema'],
    [/pocao|porcao|cura|erva|folha/, 'pocaoPequena'],
    [/forca|vigor|fortalec|peixe|carne|comida/, 'tonicoDeGuerra'],
    [/diario|salvar|fita/, 'diarioDeViagem'],
  ]
  return pistas.find(([pista]) => pista.test(texto))?.[1] ?? null
}
