import { danoDoEstagio, estagioPelaMargem, limiaresPelaDiferencaDeEP, modificador, NATURAL_DO_CRITICO, type FichaLida } from './leitura'
import { DESLOCAMENTO_M, KI_DECOLAR, KI_MUDAR_NIVEL, PASSO_DE_CORRIDA_M, type Atributo, type CombatenteDBT, type Faixa, type LadosDoDado, type NivelDeVoo, type ParteDaConta } from './tipos'

/**
 * Números puros da batalha (docs/planos/dbt-batalha.md, seções 6 e 7). Sem
 * estado: recebem o combatente e a ficha lida, devolvem o número.
 */

const ORDEM_DAS_FAIXAS: readonly Faixa[] = ['erro', 'minimo', 'medio', 'completo']
/** Exposto: o próximo ataque contra ele é crítico de 16 a 20 (9.7). */
export const CRITICO_DO_EXPOSTO = 16
/** Desnorteado: -2 no acerto e na CA (9.7). */
export const REDUTOR_DO_DESNORTEADO = 2
/** CA de quem não tem ficha Dragon Ball (combatente manual): o mestre ajusta por temporário. */
const CA_SEM_FICHA = 10
/** Escala usada quando o mapa não diz a unidade (`types/map.ts`, MapScale). */
const METROS_POR_CASA_PADRAO = 1.5
const METROS_POR_PE = 0.3048

/** Condição ativa e não suprimida agora. */
export function temCondicao(c: CombatenteDBT, id: CombatenteDBT['condicoes'][number]['condicao']): boolean {
  return c.condicoes.some((condicao) => condicao.condicao === id && condicao.suprimidaAte === null)
}

/** EP total = base + bônus da transformação ativa (2.3.1). */
export function epTotal(c: CombatenteDBT, f: FichaLida | null): number {
  return (f?.epBase ?? 0) + (c.transformacao?.epBonus ?? 0)
}

/** Modificador com o Quebrado: -1 por Quebrado no atributo (acumula de técnicas diferentes). */
export function modEfetivo(c: CombatenteDBT, f: FichaLida | null, atributo: Atributo): number {
  if (f === null) return 0
  const quebrados = c.condicoes.filter((condicao) => condicao.condicao === 'quebrado' && condicao.suprimidaAte === null && condicao.extra?.atributo === atributo).length
  return modificador(f.atributos[atributo]) - quebrados
}

/** CA de agora: base (com a DES efetiva) + temporários + barreiras − Desnorteado. A Quebra de Guarda é do ataque (`ataque.ts`). */
export function caEfetiva(c: CombatenteDBT, f: FichaLida | null): number {
  const temporarios = c.temporarios.reduce((soma, temporario) => soma + temporario.ca, 0)
  const desnorteado = temCondicao(c, 'desnorteado') ? REDUTOR_DO_DESNORTEADO : 0
  if (f === null) return CA_SEM_FICHA + temporarios - desnorteado
  const quebraDaDes = modEfetivo(c, f, 'des') - modificador(f.atributos.des)
  return f.caBase + quebraDaDes + temporarios - desnorteado
}

export function somaDosTemporarios(c: CombatenteDBT, campo: 'acerto' | 'dano'): number {
  return c.temporarios.reduce((soma, temporario) => soma + temporario[campo], 0)
}

export interface Multiplicadores {
  /** Sobrecarregado em técnica de Ki. */
  sobrecarregado: boolean
  /** Atordoado ou Paralisado: reações x2 uma vez só. */
  reacaoDobrada: boolean
  /** Choque de Poder (9.5.6). */
  choque: boolean
}

/**
 * Custo efetivo (6.2): multiplicadores distintos se multiplicam. A Exaustiva
 * já vem no Ki da técnica (o montador da ficha multiplica).
 */
export function custoEfetivo(ki: number, m: Multiplicadores): number {
  let custo = ki
  if (m.sobrecarregado) custo *= 2
  if (m.reacaoDobrada) custo *= 2
  if (m.choque) custo *= 2
  return custo
}

/** Qualquer vantagem com qualquer desvantagem = normal; não acumulam (ambiguidade 2). */
export function vantagemDoAtaque(vantagens: readonly string[], desvantagens: readonly string[]): -1 | 0 | 1 {
  if (vantagens.length > 0 && desvantagens.length > 0) return 0
  if (vantagens.length > 0) return 1
  if (desvantagens.length > 0) return -1
  return 0
}

/** 2d20 e pega o maior (vantagem) ou o menor (desvantagem). */
export function rolarComVantagem(vantagem: -1 | 0 | 1, rolar: (lados: LadosDoDado) => number): { d20: number; dados: number[] } {
  if (vantagem === 0) {
    const d20 = rolar(20)
    return { d20, dados: [d20] }
  }
  const dados = [rolar(20), rolar(20)]
  return { d20: vantagem > 0 ? Math.max(...dados) : Math.min(...dados), dados }
}

/** Ataque básico: o k-ésimo do turno rola com -(k-1); n condensados, -(0+1+...+(n-1)) (9.2). */
export function redutorDosBasicos(jaUsados: number, quantos: number): number {
  let soma = 0
  for (let k = 0; k < quantos; k += 1) soma += jaUsados + k
  return soma
}

export interface EntradaDoAcerto {
  d20: number
  atributo: Atributo
  mod: number
  epAtacante: number
  epAlvo: number
  precisao: number
  temporarios: number
  redutorBasico: number
  desnorteado: boolean
}

/** A conta do acerto (7.1), com cada parte para a linha legível do cartão. */
export function montarAcerto(e: EntradaDoAcerto): { partes: ParteDaConta[]; total: number } {
  const penalidade = Math.max(0, e.epAlvo - e.epAtacante)
  const partes: ParteDaConta[] = [
    { rotulo: e.atributo.toUpperCase(), valor: e.mod },
    { rotulo: 'EP', valor: e.epAtacante },
  ]
  if (e.precisao !== 0) partes.push({ rotulo: 'Precisão', valor: e.precisao })
  if (e.temporarios !== 0) partes.push({ rotulo: 'Temporários', valor: e.temporarios })
  if (penalidade > 0) partes.push({ rotulo: 'Dif. EP', valor: -penalidade })
  if (e.redutorBasico > 0) partes.push({ rotulo: 'Básico', valor: -e.redutorBasico })
  if (e.desnorteado) partes.push({ rotulo: 'Desnorteado', valor: -REDUTOR_DO_DESNORTEADO })
  return { partes, total: e.d20 + partes.reduce((soma, parte) => soma + parte.valor, 0) }
}

/** Faixa pela margem com a tabela de 2.3.3; só desloca a favor do mais forte (difEP >= 0). */
export function faixaDaMargem(margem: number, difEP: number): Faixa {
  return estagioPelaMargem(margem, limiaresPelaDiferencaDeEP(Math.max(0, difEP)))
}

/**
 * Escala invertida (defensiva e cura): rolagem igual ou acima do alvo =
 * completo; 1 a 5 abaixo = médio; 6 ou mais abaixo = mínimo.
 */
export function faixaInvertida(rolagem: number, alvo: number): Faixa {
  const falta = alvo - rolagem
  if (falta <= 0) return 'completo'
  if (falta <= 5) return 'medio'
  return 'minimo'
}

/**
 * Sobe `n` estágios (Devastadora, Sangrando, cargas). Acima do completo, cada
 * estágio vira +dano mínimo (p. 76-77; ambiguidade 8). Erro fica erro.
 */
export function subirEstagios(faixa: Faixa, n: number, minimo: number): { faixa: Faixa; extra: number } {
  if (faixa === 'erro' || n <= 0) return { faixa, extra: 0 }
  const indice = ORDEM_DAS_FAIXAS.indexOf(faixa) + n
  const ultimo = ORDEM_DAS_FAIXAS.length - 1
  if (indice <= ultimo) return { faixa: ORDEM_DAS_FAIXAS[indice], extra: 0 }
  return { faixa: 'completo', extra: (indice - ultimo) * minimo }
}

export function danoDaFaixa(dano: { minimo: number; medio: number; completo: number }, faixa: Faixa): number {
  return danoDoEstagio(dano, faixa)
}

/** Menor d20 que é crítico: 20 menos o Golpe Crítico, ou 16 com o alvo Exposto (o menor vale). */
export function criticoAPartirDe(golpeCritico: number, exposto: boolean): number {
  return Math.min(NATURAL_DO_CRITICO - golpeCritico, exposto ? CRITICO_DO_EXPOSTO : NATURAL_DO_CRITICO)
}

/** Metros por casa pela escala do mapa: "m" usa o número; pés convertem; o resto, 1,5 m. */
export function metrosPorCasa(escala: { unit: string; unitsPerCell: number } | null): number {
  if (escala === null || !Number.isFinite(escala.unitsPerCell) || escala.unitsPerCell <= 0) return METROS_POR_CASA_PADRAO
  const unidade = escala.unit.trim().toLowerCase()
  if (unidade === 'm' || unidade.startsWith('metro')) return escala.unitsPerCell
  if (unidade === 'ft' || unidade === 'feet' || unidade.startsWith('pé') || unidade.startsWith('pe')) return escala.unitsPerCell * METROS_POR_PE
  return METROS_POR_CASA_PADRAO
}

/** Casas do deslocamento: max(1, floor(9 / metros por casa)); Caído = metade (9.5.3). */
export function casasDoDeslocamento(metros: number, deslocamentoM: number = DESLOCAMENTO_M, caido = false): number {
  const casas = Math.max(1, Math.floor(deslocamentoM / metros))
  return caido ? Math.floor(casas / 2) : casas
}

/** Correr: 1 Ki por 1,5 m além do deslocamento (9.5.3). */
export function kiDaCorrida(casasAlem: number, metros: number): number {
  return casasAlem * Math.ceil(metros / PASSO_DE_CORRIDA_M)
}

/** Desengajar de X: max(2, 2 x EP total de X) (9.5.4). */
export function kiDeDesengajar(epTotalDoOutro: number): number {
  return Math.max(2, 2 * epTotalDoOutro)
}

/** Decolar 4 (vai ao nível 1); mudar de nível 2 por mudança, qualquer número de níveis; pousar 0 (ambiguidade 12). */
export function kiDeVoo(de: NivelDeVoo, para: NivelDeVoo): number {
  if (para === de || para === 0) return 0
  if (de === 0) return para === 1 ? KI_DECOLAR : KI_DECOLAR + KI_MUDAR_NIVEL
  return KI_MUDAR_NIVEL
}

/** Recarga do início do turno (6.1 passo 3): máximo menos tudo que está bloqueado, entre 0 e o máximo. */
export function kiDaRecarga(c: CombatenteDBT, f: FichaLida): number {
  const recarga = f.pk.max - f.pkBloqueadosDaFicha - c.kiBloqueado - c.kiDebito - f.armaduraKiPorTurno
  return Math.min(f.pk.max, Math.max(0, recarga))
}
