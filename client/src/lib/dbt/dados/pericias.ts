/**
 * Gerado por scripts/dbt/gerar-dados.cjs a partir de docs/fontes/dragon-ball-tales/.
 * Não editar à mão: mude o gerador (ou a fonte) e rode `node scripts/dbt/gerar-dados.cjs`.
 *
 * As 13 perícias (8.1.2, p. 98), na ordem do livro.
 */
import type { PericiaDBT } from '../modelo'

export const PERICIAS: PericiaDBT[] = [
  {
    id: 'atletismo',
    nome: 'Atletismo',
    atributo: 'for',
    descricao: 'Corridas intensas, saltos gigantes, escaladas e movimentos físicos brutos.',
    pagina: 98,
  },
  {
    id: 'acrobacia',
    nome: 'Acrobacia',
    atributo: 'des',
    descricao: 'Manobras aéreas, esquivas estilizadas, saltos complicados, equilíbrio em pleno voo.',
    pagina: 98,
  },
  {
    id: 'furtividade',
    nome: 'Furtividade',
    atributo: 'des',
    descricao: 'Movimentar-se sem ser notado, ocultar presença ou Ki temporariamente.',
    pagina: 98,
  },
  {
    id: 'controle-de-ki',
    nome: 'Controle de Ki',
    atributo: 'pod',
    descricao: 'Manipular sua energia de forma precisa — como reter, suprimir, canalizar ou moldar Ki.',
    pagina: 98,
  },
  {
    id: 'analise',
    nome: 'Análise',
    atributo: 'int',
    descricao: 'Avaliar padrões de luta, identificar fraquezas no oponente, entender táticas inimigas.',
    pagina: 98,
  },
  {
    id: 'ciencia',
    nome: 'Ciência',
    atributo: 'int',
    descricao: 'Usar ou reparar equipamentos, manipular tecnologia alienígena ou humana.',
    pagina: 98,
  },
  {
    id: 'conhecimento',
    nome: 'Conhecimento',
    atributo: 'int',
    descricao: 'Saber sobre raças, planetas, organizações, técnicas famosas ou lendas antigas.',
    pagina: 98,
  },
  {
    id: 'percepcao',
    nome: 'Percepção',
    atributo: 'sab',
    descricao: 'Detectar presenças ocultas, perceber movimentos rápidos, notar alterações no campo de batalha.',
    pagina: 98,
  },
  {
    id: 'sentido-de-ki',
    nome: 'Sentido de Ki',
    atributo: 'sab',
    descricao: 'Rastrear energia, analisar escalas de poder, distinguir presenças pela assinatura de Ki.',
    pagina: 98,
  },
  {
    id: 'sobrevivencia',
    nome: 'Sobrevivência',
    atributo: 'sab',
    descricao: 'Caçar, encontrar abrigo, navegar por florestas, desertos ou planetas desconhecidos.',
    pagina: 98,
  },
  {
    id: 'intimidacao',
    nome: 'Intimidação',
    atributo: 'pre',
    descricao: 'Forçar obediência ou medo com palavras, gestos ou pura presença.',
    pagina: 98,
  },
  {
    id: 'persuasao',
    nome: 'Persuasão',
    atributo: 'pre',
    descricao: 'Influenciar, negociar ou inspirar com carisma e confiança.',
    pagina: 98,
  },
  {
    id: 'enganacao',
    nome: 'Enganação',
    atributo: 'pre',
    descricao: 'Manipular, blefar ou disfarçar intenções — até mesmo fingir estar com o Ki mais baixo.',
    pagina: 98,
  },
]
