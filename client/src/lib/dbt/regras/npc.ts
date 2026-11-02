/**
 * DRAGON BALL TALES — NPC (Livro do Narrador 4.0, p. 17-19). Puro.
 *  - PV = ND × vida por golpe[categoria][rank] (`vidaDoNpc`, conta em ficha.ts);
 *  - ficha em branco e conversão do NPC pronto (sagas, Enma Daioh) em
 *    `FichaDBT` + atributos e recursos genéricos do Personagem;
 *  - boa prática de atributos por categoria e medidor de ameaça: só avisam.
 */
import {
  ATRIBUTO_DO_TIPO,
  IDS_DOS_ATRIBUTOS,
  LIMITES_DBT,
  type CategoriaDeNpcDBT,
  type FichaDBT,
  type HabilidadeDaFichaDBT,
  type IdAtributoDBT,
  type IdRecursoDBT,
  type NpcProntoDBT,
  type PassivaDBT,
  type RankDBT,
  type TabelaVidaPorGolpe,
  type TecnicaDBT,
  type TecnicaProntaDBT,
  type TipoDeTecnicaDBT,
  fichaDBTVazia,
  novoIdDBT,
} from '../modelo'
import { type AtributosDBT, SIGLA_DO_ATRIBUTO, valorDoAtributo } from './atributos'
import { DESLOCAMENTO_PADRAO_M, NOME_DA_CATEGORIA, caDaFicha, epBase, pkMaximo, pvMaximo } from './ficha'
import { nomeNormalizado } from './tecnicas'
import { transformacaoDoCatalogo } from './transformacoes'

export { vidaDoNpc } from './ficha'

// ───────────────────────────────────────────────────────────────────────────
// Ficha nova de NPC
// ───────────────────────────────────────────────────────────────────────────

/** NPC do zero: ficha vazia com o bloco de NPC. `nd` null = o mestre escolhe depois. */
export function fichaDeNpcEmBranco(categoria: CategoriaDeNpcDBT, rank: RankDBT, nd: number | null): FichaDBT {
  return { ...fichaDBTVazia(), npc: { nd, categoria, rank, passivas: [], prontoId: null } }
}

// ───────────────────────────────────────────────────────────────────────────
// NPC pronto → ficha
// ───────────────────────────────────────────────────────────────────────────

/** O que a costura grava no Personagem: a ficha estruturada e os campos genéricos. */
export interface PersonagemDoNpcDBT {
  ficha: FichaDBT
  atributos: Record<IdAtributoDBT, number>
  /** PV e PK atuais = máximos (o NPC entra inteiro). */
  recursos: Record<IdRecursoDBT, number>
  maximos: Record<IdRecursoDBT, number>
}

export interface OpcoesDoNpcPronto {
  /** Golpes que aguenta; null = o mestre ainda não escolheu (a ficha pronta vem com "ND ( )"). */
  nd: number | null
  vidaPorGolpe: TabelaVidaPorGolpe
}

/**
 * O tipo da técnica pronta sai do rótulo de tipo impresso ("Técnica de Ki",
 * "Técnica Física"...). Sem rótulo de tipo impresso: física, e o mestre troca.
 */
export function tipoPelosRotulos(nomes: readonly string[]): TipoDeTecnicaDBT {
  const normalizados = nomes.map(nomeNormalizado)
  if (normalizados.some((n) => n.includes('hibrida'))) return 'hibrida'
  if (normalizados.some((n) => n.includes('magica'))) return 'magica'
  if (normalizados.some((n) => n.includes('fisica'))) return 'fisica'
  if (normalizados.some((n) => n === 'tecnica de ki')) return 'ki'
  return 'fisica'
}

function linhaDosRotulos(titulo: string, pontos: number | null, nomes: readonly string[]): string | null {
  if (nomes.length === 0) return null
  const parenteses = pontos === null ? '' : ` (${pontos})`
  return `${titulo}${parenteses}: ${nomes.join(', ')}.`
}

/** Descrição + efeito + o que não tem campo próprio (rank e Ki fora do padrão, rótulos como impressos). */
function descricaoDaPronta(t: TecnicaProntaDBT): string {
  const partes: (string | null)[] = [
    t.descricao,
    t.efeito,
    t.rank === null ? `Rank impresso: ${t.rankTexto}.` : null,
    t.custoKi === null && t.custoTexto !== '' ? `Ki impresso: ${t.custoTexto}.` : null,
    linhaDosRotulos('Rótulos positivos', t.rotulosPositivos.pontos, t.rotulosPositivos.nomes),
    linhaDosRotulos('Rótulos negativos', t.rotulosNegativos.pontos, t.rotulosNegativos.nomes),
  ]
  return partes
    .filter((parte): parte is string => parte !== null && parte.trim() !== '')
    .join('\n\n')
    .slice(0, LIMITES_DBT.texto)
}

/**
 * Técnica pronta → técnica da ficha. Os rótulos vêm impressos por nome (sem
 * id do catálogo) e os números às vezes fogem da conta (14-22-44): Ki e
 * faixa entram À MÃO (`kiManual`/`danoManual`), que vencem o montador.
 * Rank fora de E..Z ("God", "Variável") cai no rank do NPC.
 */
export function tecnicaDaPronta(t: TecnicaProntaDBT, rankDoNpc: RankDBT): TecnicaDBT {
  const tipo = tipoPelosRotulos(t.rotulosPositivos.nomes)
  const efeitoDaFaixa = t.efeitoDaFaixa ?? 'dano'
  return {
    id: novoIdDBT('tec'),
    nome: t.nome,
    rank: t.rank ?? rankDoNpc,
    tipo,
    atributo: ATRIBUTO_DO_TIPO[tipo],
    rotulos: [],
    alcance: t.alcance,
    descricao: descricaoDaPronta(t),
    // NPC não segue a regra de ST (Livro do Narrador 4.0.5): tudo pronto para uso.
    ativa: true,
    especial:
      t.categoria === 'especial'
        ? { ofensiva: t.faixa !== null && efeitoDaFaixa === 'dano', momento: 'acao', efeito: t.efeito, aprovada: true }
        : null,
    efeitoDaFaixa,
    kiManual: t.custoKi,
    danoManual: t.faixa,
  }
}

function passivaDaFicha(p: PassivaDBT): HabilidadeDaFichaDBT {
  return { id: novoIdDBT('pas'), livroId: null, nome: p.nome, efeito: p.tipo === '' ? p.texto : `(${p.tipo}) ${p.texto}`, custoKi: null }
}

/** O impresso vence a conta: PK, CA e deslocamento que fogem da fórmula viram ajuste à mão. */
function ajustesDoImpresso(npc: NpcProntoDBT, ficha: FichaDBT, atributos: AtributosDBT): FichaDBT['ajustes'] {
  const ajustes: FichaDBT['ajustes'] = {}
  if (pkMaximo(ficha, atributos).calculado !== npc.pk) ajustes.pkMax = npc.pk
  if (caDaFicha(ficha, atributos, epBase(ficha)).calculado !== npc.ca) ajustes.ca = npc.ca
  if (npc.vel !== DESLOCAMENTO_PADRAO_M) ajustes.deslocamento = npc.vel
  return ajustes
}

/**
 * NPC pronto → ficha + campos genéricos. A ficha pronta não traz PDL nem
 * raça: PDL 0 e a EP impressa vira a EP inicial (CA = 10 + DES + EP confere
 * nas 7 fichas do Enma Daioh). PV pelo ND quando escolhido.
 */
export function npcProntoParaFicha(npc: NpcProntoDBT, opcoes: OpcoesDoNpcPronto): PersonagemDoNpcDBT {
  const atributos: Record<IdAtributoDBT, number> = { ...npc.atributos }
  const semAjustes: FichaDBT = {
    ...fichaDBTVazia(),
    pdl: 0,
    epInicial: npc.ep,
    tecnicas: npc.tecnicas.slice(0, LIMITES_DBT.tecnicas).map((t) => tecnicaDaPronta(t, npc.rank)),
    transformacoes: npc.transformacoes.slice(0, LIMITES_DBT.transformacoes).map((t) => transformacaoDoCatalogo(t, npc.nome)),
    historia: npc.historia.slice(0, LIMITES_DBT.historia),
    notas: npc.notas.join('\n\n').slice(0, LIMITES_DBT.notas),
    npc: {
      nd: opcoes.nd,
      categoria: npc.categoria,
      rank: npc.rank,
      passivas: npc.passivas.slice(0, LIMITES_DBT.passivas).map(passivaDaFicha),
      prontoId: npc.id,
    },
  }
  const ficha: FichaDBT = { ...semAjustes, ajustes: ajustesDoImpresso(npc, semAjustes, atributos) }
  const pv = pvMaximo(ficha, atributos, null, opcoes.vidaPorGolpe).valor
  const pk = pkMaximo(ficha, atributos).valor
  return { ficha, atributos, recursos: { pv, pk }, maximos: { pv, pk } }
}

// ───────────────────────────────────────────────────────────────────────────
// Boa prática e ameaça (só avisam)
// ───────────────────────────────────────────────────────────────────────────

/** Tetos de atributo por categoria (4.0.4, p. 18). As fichas prontas do próprio livro passam deles: é aviso, nunca bloqueio. */
export function avisosDosAtributosDoNpc(categoria: CategoriaDeNpcDBT, atributos: AtributosDBT): string[] {
  const valores = IDS_DOS_ATRIBUTOS.map((id) => ({ id, valor: valorDoAtributo(atributos, id) })).sort((a, b) => b.valor - a.valor)
  const nome = NOME_DA_CATEGORIA[categoria]
  const rotulo = (v: { id: IdAtributoDBT; valor: number }): string => `${SIGLA_DO_ATRIBUTO[v.id]} ${v.valor}`
  const avisos: string[] = []
  if (categoria === 'comum') {
    for (const v of valores) if (v.valor > 16) avisos.push(`${rotulo(v)}: ${nome} vai até 16; cada ponto acima pede −2 em outro atributo.`)
    const acimaDe12 = valores.filter((v) => v.valor > 12)
    if (acimaDe12.length > 2) avisos.push(`${nome}: só um ou dois atributos acima de 12 (${acimaDe12.map(rotulo).join(', ')}).`)
  } else if (categoria === 'elite') {
    const [primeiro, segundo, ...demais] = valores
    if (primeiro.valor > 20) avisos.push(`${rotulo(primeiro)}: ${nome} vai até 20; cada ponto acima pede −3 em outro atributo.`)
    if (segundo.valor > 16) avisos.push(`${rotulo(segundo)}: o segundo atributo de ${nome} vai até 16.`)
    const altos = demais.filter((v) => v.valor > 14)
    if (altos.length > 0) avisos.push(`${nome}: os demais ficam entre 12 e 14 (${altos.map(rotulo).join(', ')}).`)
  } else if (valores[0].valor > 30) {
    avisos.push(`${rotulo(valores[0])}: ${nome} chega até 30.`)
  }
  return avisos
}

export type AmeacaDBT = 'facil' | 'equilibrado' | 'dificil' | 'mortal'

export const NOME_DA_AMEACA: Readonly<Record<AmeacaDBT, string>> = {
  facil: 'Combate fácil',
  equilibrado: 'Combate equilibrado',
  dificil: 'Desafio difícil',
  mortal: 'Desafio mortal',
}

/** EP do NPC contra a do grupo (4.0.3, p. 18): igual equilibrado, +1 difícil, +2 ou mais mortal, abaixo fácil. */
export function ameacaPelaEscala(epDoNpc: number, epDoGrupo: number): AmeacaDBT {
  const diferenca = epDoNpc - epDoGrupo
  if (diferenca < 0) return 'facil'
  if (diferenca === 0) return 'equilibrado'
  if (diferenca === 1) return 'dificil'
  return 'mortal'
}
