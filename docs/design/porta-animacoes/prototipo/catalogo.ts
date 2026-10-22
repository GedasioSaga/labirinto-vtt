/**
 * As 5 animações novas, registradas pelo registro PROPOSTO (que guarda tempo de
 * fechar e curva por sentido), a partir dos módulos no formato do pacote:
 * modulos/porta/<id>.ts (o desenho) + <id>.json (nome, tempos, curvas).
 */
import arrombada from '../modulos/porta/arrombada'
import metaArrombada from '../modulos/porta/arrombada.json'
import cortina from '../modulos/porta/cortina'
import metaCortina from '../modulos/porta/cortina.json'
import dupla from '../modulos/porta/dupla'
import metaDupla from '../modulos/porta/dupla.json'
import grade from '../modulos/porta/grade'
import metaGrade from '../modulos/porta/grade.json'
import sanfona from '../modulos/porta/sanfona'
import metaSanfona from '../modulos/porta/sanfona.json'
import type { AnimacaoDePorta } from '../portas/animacoesDePorta'
import { animacaoDePortaProposta, listarAnimacoesPropostas, registrarAnimacaoDePortaProposta, type AnimacaoDePortaProposta } from '../proposta/registroProposto'
import type { IdDoSom } from './som'

export interface InfoDaNova {
  id: IdDoSom
  /** Uma frase, no seletor e no cartão. */
  descricao: string
  /**
   * Trechos do progresso em que a folha treme ou balança DE PROPÓSITO: a prova de
   * monotonia (provas/metas.json, M4) não cobra subida/descida da cobertura ali.
   */
  trechosDeTremor: readonly (readonly [number, number])[]
}

export const NOVAS: readonly InfoDaNova[] = [
  { id: 'dupla', descricao: 'Duas folhas, uma em cada ponta, giram juntas e recolhem.', trechosDeTremor: [] },
  { id: 'grade', descricao: 'Vira grade de barras, dá um tranco de corrente e sobe.', trechosDeTremor: [[0.18, 0.44]] },
  { id: 'arrombada', descricao: 'Golpe, tremor, cede de vez e solta estilhaços.', trechosDeTremor: [[0, 0.5]] },
  { id: 'sanfona', descricao: 'Dobra em quatro gomos e recolhe para a ponta.', trechosDeTremor: [] },
  { id: 'cortina', descricao: 'Vira contas que se afastam pelo meio, com balanço.', trechosDeTremor: [[0.06, 0.74]] },
]

export const DESCRICAO_DAS_EMBUTIDAS: Readonly<Record<string, string>> = {
  girar: 'A de hoje: gira 70 graus na dobradiça e esmaece.',
  deslizar: 'A de hoje: corre para dentro da parede.',
}

const MODULOS: Readonly<Record<IdDoSom, readonly [AnimacaoDePorta['desenhar'], object]>> = {
  dupla: [dupla, metaDupla],
  grade: [grade, metaGrade],
  arrombada: [arrombada, metaArrombada],
  sanfona: [sanfona, metaSanfona],
  cortina: [cortina, metaCortina],
}

let registradas = false

/** Registra as 5 uma vez. Falha alto se o registro recusar alguma: seria defeito do módulo, não algo para esconder. */
export function registrarNovas(): void {
  if (registradas) return
  for (const nova of NOVAS) {
    const [desenhar, meta] = MODULOS[nova.id]
    if (!registrarAnimacaoDePortaProposta({ id: nova.id, ...meta, desenhar })) throw new Error(`o registro recusou a animação "${nova.id}"`)
  }
  registradas = true
}

export function animacaoPorId(id: string | null): AnimacaoDePortaProposta | null {
  return id === null ? null : animacaoDePortaProposta(id)
}

export function todasAsAnimacoes(): readonly AnimacaoDePortaProposta[] {
  return listarAnimacoesPropostas()
}

export function ehNova(id: string | null): id is IdDoSom {
  return NOVAS.some((nova) => nova.id === id)
}

export function descricaoDe(id: string | null): string {
  if (id === null) return 'Sem animação: a porta troca de estado na hora, como em mapa antigo.'
  return NOVAS.find((nova) => nova.id === id)?.descricao ?? DESCRICAO_DAS_EMBUTIDAS[id] ?? ''
}

/** Paleta da porta: 6 cores contidas (Meio-Termo), todas com contraste de 3:1 ou mais no chão escuro do app. Sem vermelho (é da trancada) e sem amarelo (é da seleção). */
export interface CorDaPaleta {
  nome: string
  /** `undefined` = sem cor própria: a de hoje (laranja; trancada vermelha). */
  cor: number | undefined
  amostra: number
}

export const PALETA: readonly CorDaPaleta[] = [
  { nome: 'Laranja de hoje', cor: undefined, amostra: 0xd08c3a },
  { nome: 'Carvalho', cor: 0xa07b51, amostra: 0xa07b51 },
  { nome: 'Musgo', cor: 0x7f9a64, amostra: 0x7f9a64 },
  { nome: 'Ardósia', cor: 0x7189a6, amostra: 0x7189a6 },
  { nome: 'Ameixa', cor: 0x9b7fae, amostra: 0x9b7fae },
  { nome: 'Ferro', cor: 0x8a8f93, amostra: 0x8a8f93 },
]
