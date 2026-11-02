/**
 * Ajudantes dos testes das regras do Dragon Ball Tales (só teste importa este
 * arquivo). Os números são os do livro: tabela de rank 6.0.2 (p. 58) com os
 * ST da p. 109 e o Ki da técnica especial (p. 88-89); vida por golpe do Livro
 * do Narrador 4.0.2 (p. 17-18); rótulos do Cap. IV com custo e Ki impressos.
 */
import type {
  FichaDBT,
  ModificadorDeKiDoRotuloDBT,
  RacaDBT,
  RankDeTecnica,
  RotuloDBT,
  RotuloEscolhidoDBT,
  TabelaVidaPorGolpe,
  TecnicaDBT,
  VarianteDeRacaDBT,
} from '../modelo'
import { fichaDBTVazia } from '../modelo'
import { type TabelaDeRanksDBT, catalogoDeRotulos, indexarRanks, nomeNormalizado } from './tecnicas'

export const LINHAS_DE_RANK: RankDeTecnica[] = [
  { rank: 'E', nome: 'Técnica Básica', pdl: 10_000, danoMin: 12, danoMax: 24, kiMin: 1, kiMax: 4, pontosDeRotuloBase: 1, pontosDeRotuloMax: 2, slots: 2, kiMinimoDaEspecial: 2, pagina: 58 },
  { rank: 'D', nome: 'Técnica Simples', pdl: 20_000, danoMin: 26, danoMax: 46, kiMin: 4, kiMax: 9, pontosDeRotuloBase: 2, pontosDeRotuloMax: 4, slots: 4, kiMinimoDaEspecial: 4, pagina: 58 },
  { rank: 'C', nome: 'Técnica Intermediária', pdl: 30_000, danoMin: 34, danoMax: 58, kiMin: 6, kiMax: 12, pontosDeRotuloBase: 3, pontosDeRotuloMax: 6, slots: 6, kiMinimoDaEspecial: 6, pagina: 58 },
  { rank: 'B', nome: 'Técnica Avançada', pdl: 40_000, danoMin: 44, danoMax: 84, kiMin: 8, kiMax: 18, pontosDeRotuloBase: 4, pontosDeRotuloMax: 8, slots: 8, kiMinimoDaEspecial: 8, pagina: 58 },
  { rank: 'A', nome: 'Técnica Épica', pdl: 80_000, danoMin: 68, danoMax: 124, kiMin: 12, kiMax: 26, pontosDeRotuloBase: 5, pontosDeRotuloMax: 10, slots: 10, kiMinimoDaEspecial: 10, pagina: 58 },
  { rank: 'Z', nome: 'Técnica Lendária', pdl: 120_000, danoMin: 130, danoMax: 234, kiMin: 18, kiMax: 44, pontosDeRotuloBase: 6, pontosDeRotuloMax: 12, slots: 14, kiMinimoDaEspecial: 12, pagina: 58 },
]

function tabelaDeRanks(): TabelaDeRanksDBT {
  const tabela = indexarRanks(LINHAS_DE_RANK)
  if (tabela === null) throw new Error('a tabela de ranks do teste está incompleta')
  return tabela
}

export const RANKS_DO_LIVRO: TabelaDeRanksDBT = tabelaDeRanks()

export const VIDA_POR_GOLPE: TabelaVidaPorGolpe = {
  comum: { E: 12, D: 26, C: 34, B: 44, A: 68, Z: 130 },
  elite: { E: 14, D: 32, C: 42, B: 58, A: 80, Z: 175 },
  chefao: { E: 20, D: 46, C: 58, B: 80, A: 124, Z: 234 },
}

function ki(parcial: Partial<ModificadorDeKiDoRotuloDBT>): ModificadorDeKiDoRotuloDBT {
  return { inicial: null, porPontoExtra: null, porRotulo: null, porPontoNegativo: null, multiplicador: null, outros: {}, nota: null, ...parcial }
}

type RotuloMinimo = Pick<RotuloDBT, 'nome' | 'categoria' | 'custo' | 'custoTexto' | 'pagina'> & Partial<RotuloDBT>

function rotulo(parcial: RotuloMinimo): RotuloDBT {
  return {
    id: nomeNormalizado(parcial.nome).replace(/ /g, '-'),
    modificadorDeKi: null,
    variavel: parcial.custo.tipo !== 'fixo' && parcial.custo.tipo !== 'consome-tudo',
    acumula: null,
    alcance: null,
    restricoes: [],
    efeito: '',
    ...parcial,
  }
}

export const TECNICA_DE_KI = rotulo({ nome: 'Técnica de Ki', categoria: 'base', custo: { tipo: 'fixo', pontos: 0 }, custoTexto: '0', pagina: 61, acumula: false })
export const TECNICA_HIBRIDA = rotulo({ nome: 'Técnica Híbrida', categoria: 'base', custo: { tipo: 'fixo', pontos: 2 }, custoTexto: '2', pagina: 61, acumula: false })
export const ENGOLFANTE = rotulo({
  nome: 'Alcance – Engolfante',
  categoria: 'base',
  custo: { tipo: 'variavel', minimo: 2 },
  custoTexto: '2 a Variável',
  pagina: 62,
  acumula: true,
  modificadorDeKi: ki({ inicial: 3, porPontoExtra: 3, nota: 'o exemplo 6.7 usa +4' }),
  alcance: { forma: 'cone_a_partir_do_usuario', inicialM: 6, porPontoExtraM: 1.5, medidasM: {} },
})
export const PROJETIL = rotulo({
  nome: 'Alcance – Projétil',
  categoria: 'base',
  custo: { tipo: 'variavel', minimo: 1 },
  custoTexto: '1 a Variável',
  pagina: 62,
  acumula: true,
  modificadorDeKi: ki({ inicial: 2, porPontoExtra: 2 }),
  alcance: { forma: 'projetil_alvo_unico', inicialM: 9, porPontoExtraM: 1.5, medidasM: {} },
})
export const ACUMULACAO = rotulo({
  nome: 'Técnica de Acumulação – Ki',
  categoria: 'ki',
  custo: { tipo: 'fixo', pontos: 4 },
  custoTexto: '4',
  pagina: 70,
  modificadorDeKi: ki({ outros: { carga_com_ki: 'cada carga = custo normal da técnica em Ki' } }),
})
export const RAJADA_CONTINUA = rotulo({
  nome: 'Rajada Contínua',
  categoria: 'generico',
  custo: { tipo: 'fixo', pontos: 2 },
  custoTexto: '2',
  pagina: 76,
  modificadorDeKi: ki({ outros: { por_rodada_mantida: 'mesma quantidade de Ki exigida para a técnica' } }),
})
export const TECNICA_BASICA = rotulo({ nome: 'Técnica Básica', categoria: 'generico', custo: { tipo: 'consome-tudo' }, custoTexto: '?', pagina: 74, acumula: false })
export const AUMENTAR_DANO_POR_KI = rotulo({
  nome: 'Aumentar Dano por Ki',
  categoria: 'generico',
  custo: { tipo: 'fixo', pontos: 1 },
  custoTexto: '1',
  pagina: 74,
  modificadorDeKi: ki({ outros: { por_1_ki: '+4 de dano' } }),
  restricoes: ['esse bônus não pode ultrapassar o limite máximo de Dano e de Ki por rank da técnica'],
})
export const AUMENTAR_PRECISAO = rotulo({
  nome: 'Aumentar Precisão',
  categoria: 'generico',
  custo: { tipo: 'fixo', pontos: 2 },
  custoTexto: '2',
  pagina: 74,
  acumula: true,
  modificadorDeKi: ki({ porRotulo: 4 }),
})
export const EFEITO_NEGATIVO = rotulo({ nome: 'Efeito Negativo', categoria: 'generico', custo: { tipo: 'variavel', minimo: null }, custoTexto: 'Variável', pagina: 76 })
export const EXAUSTIVA = rotulo({
  nome: 'Exaustiva',
  categoria: 'negativo',
  custo: { tipo: 'fixo', pontos: -4 },
  custoTexto: '-4',
  pagina: 79,
  modificadorDeKi: ki({ multiplicador: 2 }),
})
export const DRENO_DE_KI = rotulo({
  nome: 'Dreno de Ki',
  categoria: 'negativo',
  custo: { tipo: 'variavel', minimo: null },
  custoTexto: 'Variável',
  pagina: 79,
  acumula: true,
  modificadorDeKi: ki({ porPontoNegativo: 3 }),
})
export const SOMATICA = rotulo({ nome: 'Somática', categoria: 'negativo', custo: { tipo: 'fixo', pontos: -2 }, custoTexto: '-2', pagina: 81 })
export const VERBAL = rotulo({ nome: 'Verbal', categoria: 'negativo', custo: { tipo: 'fixo', pontos: -2 }, custoTexto: '-2', pagina: 80 })
export const CONDICIONADA = rotulo({ nome: 'Condicionada', categoria: 'negativo', custo: { tipo: 'faixa', minimo: -1, maximo: -2 }, custoTexto: '-1 a -2', pagina: 81 })
export const FRAGMENTACAO = rotulo({
  nome: 'Técnica de Fragmentação – Ki',
  categoria: 'ki',
  custo: { tipo: 'fixo', pontos: 2 },
  custoTexto: '2',
  pagina: 71,
  modificadorDeKi: ki({ inicial: 6, outros: { por_1_5m_raio_extra: 4 } }),
  alcance: { forma: 'raio_de_fragmentacao', inicialM: 7.5, porPontoExtraM: null, medidasM: {} },
})

export const ROTULOS_DO_LIVRO: RotuloDBT[] = [
  TECNICA_DE_KI,
  TECNICA_HIBRIDA,
  ENGOLFANTE,
  PROJETIL,
  ACUMULACAO,
  RAJADA_CONTINUA,
  TECNICA_BASICA,
  AUMENTAR_DANO_POR_KI,
  AUMENTAR_PRECISAO,
  EFEITO_NEGATIVO,
  EXAUSTIVA,
  DRENO_DE_KI,
  SOMATICA,
  VERBAL,
  CONDICIONADA,
  FRAGMENTACAO,
]

export const CATALOGO = catalogoDeRotulos(ROTULOS_DO_LIVRO)

export function escolhido(r: RotuloDBT, extra: Partial<RotuloEscolhidoDBT> = {}): RotuloEscolhidoDBT {
  return { rotuloId: r.id, pontosExtras: 0, variavel: null, investimento: 0, nota: '', ...extra }
}

export function tecnicaDeTeste(parcial: Partial<TecnicaDBT> = {}): TecnicaDBT {
  return {
    id: 'tec_teste',
    nome: 'Teste',
    rank: 'B',
    tipo: 'ki',
    atributo: 'int',
    rotulos: [],
    alcance: '',
    descricao: '',
    ativa: true,
    especial: null,
    efeitoDaFaixa: 'dano',
    kiManual: null,
    danoManual: null,
    ...parcial,
  }
}

export function fichaDeTeste(parcial: Partial<FichaDBT> = {}): FichaDBT {
  return { ...fichaDBTVazia(), ...parcial }
}

/** Os 7 atributos em 8 (ficha nova), com os que o teste muda. */
export function atributosDeTeste(parcial: Partial<Record<'for' | 'des' | 'con' | 'int' | 'sab' | 'pod' | 'pre', number>> = {}): Record<string, number> {
  return { for: 8, des: 8, con: 8, int: 8, sab: 8, pod: 8, pre: 8, ...parcial }
}

export function racaDeTeste(id: string, vidaPor10k: number | null, variantes: VarianteDeRacaDBT[] = []): RacaDBT {
  return {
    id,
    nome: id,
    fonte: 'basico',
    arquivo: 'teste',
    tipo: 'raca',
    vidaPor10k,
    descricao: '',
    variantes,
    tracos: [],
    caracteristicasEspeciais: [],
    transformacoes: [],
    tecnicas: [],
    talentos: [],
    outros: [],
    pagina: null,
  }
}
