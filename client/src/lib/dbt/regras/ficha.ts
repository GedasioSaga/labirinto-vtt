/**
 * DRAGON BALL TALES — os DERIVADOS da ficha (Livro do Jogador 2.2, 3.0, 8.x;
 * Livro do Narrador 4.0.2 para o PV do NPC). Puro: recebe a ficha, os
 * atributos genéricos do Personagem e os catálogos por parâmetro.
 *
 * Cada derivado ajustável devolve o valor que vale (o ajuste à mão em
 * `FichaDBT.ajustes` vence a conta), a conta do livro e a fórmula em texto,
 * para a tela mostrar de onde o número saiu.
 */
import {
  ATRIBUTO_DA_PERICIA,
  type CategoriaDeNpcDBT,
  type DerivadoAjustavelDBT,
  type FichaDBT,
  type IdAtributoDBT,
  type IdPericiaDBT,
  type IdRecursoDBT,
  type RacaDBT,
  type RankDBT,
  type TabelaVidaPorGolpe,
} from '../modelo'
import { type AtributosDBT, SIGLA_DO_ATRIBUTO, comSinal, modificador, valorDoAtributo } from './atributos'
import { type TabelaDeRanksDBT, nomeNormalizado, slotsUsados } from './tecnicas'
import { epBonusDaFicha, transformacaoAtiva } from './transformacoes'

// ───────────────────────────────────────────────────────────────────────────
// Números do livro
// ───────────────────────────────────────────────────────────────────────────

/** Marcos de PDL (3.0.11, p. 14). */
export const PDL_DO_MARCO_DE_VIDA = 10_000
export const PDL_DO_MARCO_DE_TALENTO = 20_000
export const PDL_DO_MARCO_DE_ATRIBUTO = 30_000
export const PDL_DO_MARCO_DE_EP = 40_000

const PV_POR_CON = 5
const PK_POR_POD = 2
const CA_BASE = 10
/** O 12 do exemplo da p. 109 (ver `slotsDeTecnica`). */
const ST_BASE = 12
const ST_POR_SAB = 5
/** Humano Marcial: "Aprendizado Marcial" troca o ×5 por ×10 (4.7.1, p. 33). */
const ST_POR_SAB_HUMANO_MARCIAL = 10
const ST_POR_MARCO_DE_VIDA = 2
export const TALENTOS_INICIAIS = 3
export const PONTOS_POR_MARCO_DE_ATRIBUTO = 2
export const PERICIAS_INICIAIS = 5
/** Deslocamento base (9.5.3, p. 116). */
export const DESLOCAMENTO_PADRAO_M = 9
/** Carga = 5 + mod FOR × 5 slots (8.2, p. 100). */
const CARGA_BASE = 5
const CARGA_POR_FOR = 5

const HUMANO_MARCIAL = 'humano marcial'

export const NOME_DA_CATEGORIA: Readonly<Record<CategoriaDeNpcDBT, string>> = {
  comum: 'Comum',
  elite: 'Elite',
  chefao: 'Chefão',
}

// ───────────────────────────────────────────────────────────────────────────
// Tipos do resultado
// ───────────────────────────────────────────────────────────────────────────

export interface DerivadoDBT {
  /** O que vale: o ajuste à mão quando existe, senão a conta. */
  valor: number
  /** A conta do livro, mesmo quando o ajuste vence (a tela pode mostrar os dois). */
  calculado: number
  /** O mestre fixou à mão (`FichaDBT.ajustes`). */
  manual: boolean
  /** A conta com os números ("CON 12 × 5 + raça 12 × (1 + 1) = 84"). */
  formula: string
}

export interface PericiaDaFichaDBT {
  id: IdPericiaDBT
  atributo: IdAtributoDBT
  treinada: boolean
  /** O que soma no d20. */
  bonus: number
  formula: string
}

export interface MarcoDBT {
  pdl: number
  falta: number
  ganhos: string[]
}

export interface TalentosDaFichaDBT {
  /** Talentos ou movimentos marciais: 3 + 1 a cada 20.000 PDL (3.0.7, p. 13). */
  disponiveis: number
  /** Só Humano Marcial: movimentos marciais grátis além dos normais (1 + 1 a cada 20.000 PDL). */
  movimentosExtras: number
  /** Talentos + movimentos na ficha. */
  usados: number
  restantes: number
  formula: string
}

export interface AumentosDaFichaDBT {
  /** 2 pontos a cada 30.000 PDL (+2 em um ou +1 em dois). */
  total: number
  gastos: number
  restantes: number
  formula: string
}

export interface ContextoDaFichaDBT {
  /** A raça do catálogo de `ficha.raca`; null = sem raça ou raça livre. */
  raca: RacaDBT | null
  /** Custo em ST das técnicas ativas. */
  ranks: TabelaDeRanksDBT
  /** Só NPC: PV = ND × vida por golpe. null = sem a tabela (vale a conta do jogador). */
  vidaPorGolpe: TabelaVidaPorGolpe | null
}

export interface DerivadosDaFichaDBT {
  vidaDaRaca: number
  humanoMarcial: boolean
  pvMax: DerivadoDBT
  pkMax: DerivadoDBT
  /** PK que volta no início do turno: máximo − bloqueado pela exaustão (8.5.1). */
  pkDisponivel: number
  epBase: DerivadoDBT
  /** EP da forma ativa; 0 na forma normal. */
  epBonus: number
  epTotal: DerivadoDBT
  ca: DerivadoDBT
  st: DerivadoDBT
  stUsados: number
  deslocamento: DerivadoDBT
  carga: DerivadoDBT
  cargaUsada: number
  talentos: TalentosDaFichaDBT
  aumentos: AumentosDaFichaDBT
  pericias: Record<IdPericiaDBT, PericiaDaFichaDBT>
  proximosMarcos: MarcoDBT[]
}

// ───────────────────────────────────────────────────────────────────────────
// Ajudantes
// ───────────────────────────────────────────────────────────────────────────

/** Quantos marcos de `intervalo` o PDL já passou (PDL negativo conta como 0). */
export function marcosPassados(pdl: number, intervalo: number): number {
  return Math.floor(Math.max(0, pdl) / intervalo)
}

function derivado(ficha: FichaDBT, chave: DerivadoAjustavelDBT, calculado: number, formula: string): DerivadoDBT {
  const ajuste = ficha.ajustes[chave]
  if (ajuste === undefined) return { valor: calculado, calculado, manual: false, formula }
  return { valor: ajuste, calculado, manual: true, formula: `${formula} · fixado à mão em ${ajuste}` }
}

function semAjuste(valor: number, formula: string): DerivadoDBT {
  return { valor, calculado: valor, manual: false, formula }
}

/** Vida extra por 10.000 PDL: da raça livre, ou da raça do catálogo (só se for a da ficha). 0 = sem raça ou o livro não diz. */
export function vidaDaRaca(ficha: FichaDBT, raca: RacaDBT | null): number {
  if (ficha.racaLivre !== null) return ficha.racaLivre.vidaPor10k
  if (raca === null || raca.id !== ficha.raca || raca.vidaPor10k === null) return 0
  return raca.vidaPor10k
}

/** A variante Humano Marcial dos Terráqueos (pelo id ou pelo nome da variante no catálogo). */
export function ehHumanoMarcial(ficha: FichaDBT, raca: RacaDBT | null): boolean {
  if (ficha.variante === '') return false
  if (nomeNormalizado(ficha.variante).includes(HUMANO_MARCIAL)) return true
  if (raca === null || raca.id !== ficha.raca) return false
  const variante = raca.variantes.find((v) => v.id === ficha.variante)
  return variante !== undefined && nomeNormalizado(variante.nome).includes(HUMANO_MARCIAL)
}

// ───────────────────────────────────────────────────────────────────────────
// Os derivados, um por um
// ───────────────────────────────────────────────────────────────────────────

/** PV do NPC: ND × vida por golpe da categoria e do rank (Livro do Narrador 4.0.2, p. 17-18). */
export function vidaDoNpc(nd: number, categoria: CategoriaDeNpcDBT, rank: RankDBT, tabela: TabelaVidaPorGolpe): number {
  return Math.max(0, Math.floor(nd)) * tabela[categoria][rank]
}

/**
 * PV máximo = CON × 5 + vida da raça × (1 + marcos de 10.000 PDL) (3.0.3,
 * p. 12-13). A raça soma já no PDL 0, como no exemplo do livro (CON 12 +
 * raça 12 = 72), embora 3.0.2 diga "só a constituição" abaixo de 10.000.
 * NPC com ND escolhido: ND × vida por golpe.
 */
export function pvMaximo(ficha: FichaDBT, atributos: AtributosDBT, raca: RacaDBT | null, vidaPorGolpe: TabelaVidaPorGolpe | null): DerivadoDBT {
  const npc = ficha.npc
  if (npc !== undefined && npc.nd !== null && vidaPorGolpe !== null) {
    const porGolpe = vidaPorGolpe[npc.categoria][npc.rank]
    const valor = vidaDoNpc(npc.nd, npc.categoria, npc.rank, vidaPorGolpe)
    return derivado(ficha, 'pvMax', valor, `ND ${npc.nd} × ${porGolpe} (vida por golpe, rank ${npc.rank}, ${NOME_DA_CATEGORIA[npc.categoria]}) = ${valor}`)
  }
  const con = valorDoAtributo(atributos, 'con')
  const vida = vidaDaRaca(ficha, raca)
  const marcos = marcosPassados(ficha.pdl, PDL_DO_MARCO_DE_VIDA)
  const valor = con * PV_POR_CON + vida * (1 + marcos)
  let formula = `CON ${con} × ${PV_POR_CON} + raça ${vida} × (1 + ${marcos}) = ${valor}`
  // Só o mestre lê este texto: o bloco de NPC (ND, categoria, rank) não vai ao jogador (`paraOFio`).
  if (npc !== undefined && npc.nd === null) formula += ' (ND ainda não escolhido: vale a conta do jogador até o mestre escolher o ND)'
  else if (npc !== undefined) formula += ' (tabela de vida por golpe indisponível: vale a conta do jogador)'
  return derivado(ficha, 'pvMax', valor, formula)
}

/** PK máximo = POD × 2 + 1 a cada 10.000 PDL (3.0.4, p. 13). */
export function pkMaximo(ficha: FichaDBT, atributos: AtributosDBT): DerivadoDBT {
  const pod = valorDoAtributo(atributos, 'pod')
  const marcos = marcosPassados(ficha.pdl, PDL_DO_MARCO_DE_VIDA)
  const valor = pod * PK_POR_POD + marcos
  return derivado(ficha, 'pkMax', valor, `POD ${pod} × ${PK_POR_POD} + ${marcos} = ${valor}`)
}

/** EP base = EP inicial + 1 a cada 40.000 PDL (2.3, p. 9). */
export function epBase(ficha: FichaDBT): DerivadoDBT {
  const marcos = marcosPassados(ficha.pdl, PDL_DO_MARCO_DE_EP)
  const valor = ficha.epInicial + marcos
  return derivado(ficha, 'epBase', valor, `EP inicial ${ficha.epInicial} + ${marcos} (1 a cada 40.000 PDL) = ${valor}`)
}

/** EP total = EP base + EP da transformação ativa (2.3, p. 9): é o que entra nas rolagens. */
export function epTotal(ficha: FichaDBT, base: DerivadoDBT): DerivadoDBT {
  const ativa = transformacaoAtiva(ficha)
  if (ativa === null) return semAjuste(base.valor, `EP base ${base.valor} (forma normal)`)
  const valor = base.valor + ativa.ep
  return semAjuste(valor, `EP base ${base.valor} + ${ativa.nome} ${ativa.ep} = ${valor}`)
}

/** Bônus de CA das armaduras equipadas (8.3, p. 103). */
export function armaduraEquipada(ficha: FichaDBT): number {
  return ficha.inventario.reduce((soma, item) => (item.equipado ? soma + item.bonusCA : soma), 0)
}

/** CA = 10 + mod DES + EP base + armadura (3.0.5, p. 13; 8.3). A EP da transformação não soma. */
export function caDaFicha(ficha: FichaDBT, atributos: AtributosDBT, base: DerivadoDBT): DerivadoDBT {
  const des = modificador(valorDoAtributo(atributos, 'des'))
  const armadura = armaduraEquipada(ficha)
  const valor = CA_BASE + des + base.valor + armadura
  const parteDaArmadura = armadura === 0 ? '' : ` + armadura ${armadura}`
  return derivado(ficha, 'ca', valor, `${CA_BASE} + DES ${comSinal(des)} + EP base ${base.valor}${parteDaArmadura} = ${valor}`)
}

/**
 * ST = 12 + mod SAB × 5 + 2 a cada 10.000 PDL, como no exemplo da p. 109
 * (SAB 14 = 22 ST). A fórmula de 2.2.5 e 8.6, 20 + (1 + mod SAB) × 5, daria 35:
 * o usuário mandou seguir os exemplos (docs/planos/dbt-contradicoes.md, 1.3).
 * Humano Marcial troca o × 5 por × 10. A p. 109 diz "+1 a cada 5.000 PDL"
 * (mesma taxa, degrau diferente): vale o de 3.0.11.
 */
export function slotsDeTecnica(ficha: FichaDBT, atributos: AtributosDBT, humanoMarcial: boolean): DerivadoDBT {
  const sab = modificador(valorDoAtributo(atributos, 'sab'))
  const porSab = humanoMarcial ? ST_POR_SAB_HUMANO_MARCIAL : ST_POR_SAB
  const marcos = marcosPassados(ficha.pdl, PDL_DO_MARCO_DE_VIDA)
  const valor = Math.max(0, ST_BASE + sab * porSab + ST_POR_MARCO_DE_VIDA * marcos)
  const nota = humanoMarcial ? ' (Humano Marcial)' : ''
  const parteDaSab = sab < 0 ? `- ${-sab}` : `+ ${sab}`
  return derivado(ficha, 'st', valor, `${ST_BASE} ${parteDaSab} × ${porSab} + ${ST_POR_MARCO_DE_VIDA} × ${marcos} = ${valor}${nota}`)
}

export function deslocamento(ficha: FichaDBT): DerivadoDBT {
  return derivado(ficha, 'deslocamento', DESLOCAMENTO_PADRAO_M, `Deslocamento base ${DESLOCAMENTO_PADRAO_M} m (p. 116)`)
}

/** Slots de carga = 5 + mod FOR × 5 (8.2, p. 100); FOR muito baixa não deixa negativo. */
export function cargaMaxima(ficha: FichaDBT, atributos: AtributosDBT): DerivadoDBT {
  const forca = modificador(valorDoAtributo(atributos, 'for'))
  const valor = Math.max(0, CARGA_BASE + forca * CARGA_POR_FOR)
  return derivado(ficha, 'carga', valor, `${CARGA_BASE} + FOR ${comSinal(forca)} × ${CARGA_POR_FOR} = ${valor}`)
}

export function cargaUsada(ficha: FichaDBT): number {
  return ficha.inventario.reduce((soma, item) => soma + item.carga * item.quantidade, 0)
}

export function talentosDaFicha(ficha: FichaDBT, humanoMarcial: boolean): TalentosDaFichaDBT {
  const marcos = marcosPassados(ficha.pdl, PDL_DO_MARCO_DE_TALENTO)
  const disponiveis = TALENTOS_INICIAIS + marcos
  const movimentosExtras = humanoMarcial ? 1 + marcos : 0
  const usados = ficha.talentos.length + ficha.movimentos.length
  let formula = `${TALENTOS_INICIAIS} + ${marcos} (1 a cada 20.000 PDL) = ${disponiveis} talentos ou movimentos`
  if (humanoMarcial) formula += `; + ${movimentosExtras} movimentos marciais do Humano Marcial`
  return { disponiveis, movimentosExtras, usados, restantes: disponiveis + movimentosExtras - usados, formula }
}

export function aumentosDaFicha(ficha: FichaDBT): AumentosDaFichaDBT {
  const marcos = marcosPassados(ficha.pdl, PDL_DO_MARCO_DE_ATRIBUTO)
  const total = PONTOS_POR_MARCO_DE_ATRIBUTO * marcos
  const gastos = ficha.aumentos.reduce((soma, aumento) => soma + aumento.pontos, 0)
  return {
    total,
    gastos,
    restantes: total - gastos,
    formula: `${PONTOS_POR_MARCO_DE_ATRIBUTO} × ${marcos} (a cada 30.000 PDL) = ${total} pontos; gastos ${gastos}`,
  }
}

/** Perícia = d20 + mod do atributo + EP base se treinada (8.1.2, p. 97-98). A EP da transformação não entra. */
export function periciaDaFicha(id: IdPericiaDBT, ficha: FichaDBT, atributos: AtributosDBT, epBaseValor: number): PericiaDaFichaDBT {
  const atributo = ATRIBUTO_DA_PERICIA[id]
  const mod = modificador(valorDoAtributo(atributos, atributo))
  const treinada = ficha.periciasTreinadas.includes(id)
  const bonus = mod + (treinada ? epBaseValor : 0)
  const parteDaEp = treinada ? ` + EP base ${epBaseValor} (treinada)` : ''
  return { id, atributo, treinada, bonus, formula: `d20 ${comSinal(mod)} (${SIGLA_DO_ATRIBUTO[atributo]})${parteDaEp}` }
}

/** Os próximos `quantos` marcos de PDL (todos caem em múltiplos de 10.000) e o que cada um dá (3.0.11, p. 14). */
export function proximosMarcos(pdl: number, vida: number, humanoMarcial: boolean, quantos = 3): MarcoDBT[] {
  const atual = Math.max(0, pdl)
  const marcos: MarcoDBT[] = []
  let alvo = (marcosPassados(atual, PDL_DO_MARCO_DE_VIDA) + 1) * PDL_DO_MARCO_DE_VIDA
  for (let i = 0; i < quantos; i++, alvo += PDL_DO_MARCO_DE_VIDA) {
    const ganhos: string[] = []
    if (vida > 0) ganhos.push(`+${vida} PV (raça)`)
    ganhos.push('+1 PK', `+${ST_POR_MARCO_DE_VIDA} ST`)
    if (alvo % PDL_DO_MARCO_DE_TALENTO === 0) {
      ganhos.push('+1 talento ou movimento marcial')
      if (humanoMarcial) ganhos.push('+1 movimento marcial (Humano Marcial)')
    }
    if (alvo % PDL_DO_MARCO_DE_ATRIBUTO === 0) ganhos.push('+2 em um atributo ou +1 em dois')
    if (alvo % PDL_DO_MARCO_DE_EP === 0) ganhos.push('+1 EP base')
    marcos.push({ pdl: alvo, falta: alvo - atual, ganhos })
  }
  return marcos
}

// ───────────────────────────────────────────────────────────────────────────
// Tudo de uma vez (a tela da ficha)
// ───────────────────────────────────────────────────────────────────────────

export function derivadosDaFicha(ficha: FichaDBT, atributos: AtributosDBT, contexto: ContextoDaFichaDBT): DerivadosDaFichaDBT {
  const vida = vidaDaRaca(ficha, contexto.raca)
  const humanoMarcial = ehHumanoMarcial(ficha, contexto.raca)
  const pvMax = pvMaximo(ficha, atributos, contexto.raca, contexto.vidaPorGolpe)
  const pkMax = pkMaximo(ficha, atributos)
  const base = epBase(ficha)
  return {
    vidaDaRaca: vida,
    humanoMarcial,
    pvMax,
    pkMax,
    pkDisponivel: Math.max(0, pkMax.valor - ficha.kiBloqueado),
    epBase: base,
    epBonus: epBonusDaFicha(ficha),
    epTotal: epTotal(ficha, base),
    ca: caDaFicha(ficha, atributos, base),
    st: slotsDeTecnica(ficha, atributos, humanoMarcial),
    stUsados: slotsUsados(ficha.tecnicas, contexto.ranks),
    deslocamento: deslocamento(ficha),
    carga: cargaMaxima(ficha, atributos),
    cargaUsada: cargaUsada(ficha),
    talentos: talentosDaFicha(ficha, humanoMarcial),
    aumentos: aumentosDaFicha(ficha),
    pericias: periciasDaFicha(ficha, atributos, base.valor),
    proximosMarcos: proximosMarcos(ficha.pdl, vida, humanoMarcial),
  }
}

/** As 13 perícias (8.1.2, p. 98), uma chave por perícia: perícia nova no contrato quebra a compilação aqui. */
export function periciasDaFicha(ficha: FichaDBT, atributos: AtributosDBT, epBaseValor: number): Record<IdPericiaDBT, PericiaDaFichaDBT> {
  const uma = (id: IdPericiaDBT): PericiaDaFichaDBT => periciaDaFicha(id, ficha, atributos, epBaseValor)
  return {
    atletismo: uma('atletismo'),
    acrobacia: uma('acrobacia'),
    furtividade: uma('furtividade'),
    'controle-de-ki': uma('controle-de-ki'),
    analise: uma('analise'),
    ciencia: uma('ciencia'),
    conhecimento: uma('conhecimento'),
    percepcao: uma('percepcao'),
    'sentido-de-ki': uma('sentido-de-ki'),
    sobrevivencia: uma('sobrevivencia'),
    intimidacao: uma('intimidacao'),
    persuasao: uma('persuasao'),
    enganacao: uma('enganacao'),
  }
}

/** Os máximos que a costura grava em `Personagem.maximos` quando a base muda. */
export function maximosDosRecursos(derivados: Pick<DerivadosDaFichaDBT, 'pvMax' | 'pkMax'>): Record<IdRecursoDBT, number> {
  return { pv: derivados.pvMax.valor, pk: derivados.pkMax.valor }
}
