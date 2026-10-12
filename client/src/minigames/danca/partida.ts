import {
  contarJulgamento,
  contarSegurada,
  DIF,
  julgar,
  letraDe,
  novoPlacar,
  passouDaNota,
  pontosDe,
  precisaoDe,
  SOLTAR_TOLERANCIA,
  totalDeItens,
  type Julgamento,
  type PlacarDanca,
} from './regras'
import type { DificuldadeDanca, LetraDanca, NotaDaDanca, TrilhaDanca } from './tipos'

/**
 * PARTIDA: o julgamento de uma dança, do primeiro toque ao resultado. Porte do
 * laço do protótipo (apertar, soltar, registrar, fecharSegura, atualizarJogo)
 * sem tela nem som: cada função muda a partida recebida e devolve o que
 * aconteceu, e quem chama toca o som, mexe o dançarino e mostra o texto.
 * Todo tempo aqui é posição na música, em s (`posicaoNaMusica` do relógio).
 */

export interface NotaEmJogo extends NotaDaDanca {
  julg: Julgamento | null
  /** Segurada com o dedo ainda na trilha. */
  segurando: boolean
  /** Fim da segurada: true inteira, false solta ou perdida, null ainda não fechou (ou não é segurada). */
  fimOk: boolean | null
  /** Delta do toque em ms (negativo = cedo); null sem toque. */
  delta: number | null
}

/** fim = a música acabou; falhou = a vida zerou (Expert); mestre = o mestre encerrou. */
export type MotivoDoFim = 'fim' | 'falhou' | 'mestre'

export interface PartidaDanca {
  dif: DificuldadeDanca
  notas: NotaEmJogo[]
  placar: PlacarDanca
  /** Primeira nota ainda em aberto: o laço começa dela. */
  cursor: number
  totalItens: number
  /** Posição da música em que a partida termina sozinha. */
  fimS: number
  motivo: MotivoDoFim | null
}

export type EventoDaPartida =
  | { tipo: 'julgou'; lane: TrilhaDanca; julg: Julgamento; segurada: boolean }
  | { tipo: 'segurada'; lane: TrilhaDanca; inteira: boolean }
  | { tipo: 'terminou'; motivo: MotivoDoFim }

/** A partida acaba 1,2 s depois da última seta (ou no fim do áudio, se vier antes). */
const FOLGA_DO_FIM_S = 1.2
/** Soltar procura seguradas que começaram até meio segundo à frente (toque um pouco cedo). */
const ALCANCE_DO_SOLTAR_S = 0.5
/** O laço olha só até 0,3 s à frente: o resto ainda não pode ter passado. */
const ALCANCE_DO_LACO_S = 0.3

export function novaPartida(notas: readonly NotaDaDanca[], dif: DificuldadeDanca, duracaoS: number): PartidaDanca {
  const emJogo: NotaEmJogo[] = notas.map((n) => ({ ...n, julg: null, segurando: false, fimOk: null, delta: null }))
  const ultima = emJogo.reduce((m, n) => Math.max(m, n.t + n.len), 0)
  return {
    dif,
    notas: emJogo,
    placar: novoPlacar(),
    cursor: 0,
    totalItens: totalDeItens(emJogo),
    fimS: Math.min(duracaoS, ultima + FOLGA_DO_FIM_S),
    motivo: null,
  }
}

function terminar(p: PartidaDanca, motivo: MotivoDoFim, eventos: EventoDaPartida[]): void {
  if (p.motivo !== null) return
  p.motivo = motivo
  for (const n of p.notas) n.segurando = false
  eventos.push({ tipo: 'terminou', motivo })
}

function conferirVida(p: PartidaDanca, eventos: EventoDaPartida[]): void {
  if (DIF[p.dif].vida && p.placar.vida <= 0) terminar(p, 'falhou', eventos)
}

function registrar(p: PartidaDanca, n: NotaEmJogo, julg: Julgamento, eventos: EventoDaPartida[]): void {
  n.julg = julg
  const segurada = n.len > 0
  if (julg === 'errou' && segurada) n.fimOk = false
  contarJulgamento(p.placar, julg, p.dif, segurada)
  eventos.push({ tipo: 'julgou', lane: n.lane, julg, segurada })
  conferirVida(p, eventos)
}

function fecharSegura(p: PartidaDanca, n: NotaEmJogo, inteira: boolean, eventos: EventoDaPartida[]): void {
  n.segurando = false
  n.fimOk = inteira
  contarSegurada(p.placar, inteira, p.dif)
  eventos.push({ tipo: 'segurada', lane: n.lane, inteira })
  conferirVida(p, eventos)
}

/** Toque na trilha `lane` na posição `st` da música. */
export function apertarTrilha(p: PartidaDanca, lane: TrilhaDanca, st: number): EventoDaPartida[] {
  const eventos: EventoDaPartida[] = []
  if (p.motivo !== null) return eventos
  const d = DIF[p.dif]
  const alcance = Math.max(d.janelas.ok, d.errouCedo) / 1000
  for (let i = p.cursor; i < p.notas.length && p.motivo === null; i += 1) {
    const n = p.notas[i]
    if (n.t - st > alcance) break
    if (n.lane !== lane || n.julg !== null) continue
    const deltaMs = (st - n.t) * 1000
    // Seta que já passou da janela nesta trilha: conta o erro e o toque vale para a próxima.
    if (deltaMs > d.janelas.ok) {
      registrar(p, n, 'errou', eventos)
      continue
    }
    const julg = julgar(deltaMs, p.dif)
    // Cedo demais na Diversão: o toque é ignorado.
    if (julg === null) return eventos
    n.delta = deltaMs
    registrar(p, n, julg, eventos)
    if (julg !== 'errou' && n.len > 0 && p.motivo === null) n.segurando = true
    return eventos
  }
  return eventos
}

/** A trilha `lane` soltou na posição `st`: fecha a segurada dela, inteira se soltou perto do fim. */
export function soltarTrilha(p: PartidaDanca, lane: TrilhaDanca, st: number): EventoDaPartida[] {
  const eventos: EventoDaPartida[] = []
  if (p.motivo !== null) return eventos
  for (let i = p.cursor; i < p.notas.length && p.motivo === null; i += 1) {
    const n = p.notas[i]
    if (n.t > st + ALCANCE_DO_SOLTAR_S) break
    if (n.lane === lane && n.segurando) fecharSegura(p, n, st >= n.t + n.len - SOLTAR_TOLERANCIA, eventos)
  }
  return eventos
}

/** A cada quadro: setas que passaram sem toque viram Errou, seguradas que chegaram ao fim fecham, e o fim da música encerra. */
export function avancarPartida(p: PartidaDanca, st: number): EventoDaPartida[] {
  const eventos: EventoDaPartida[] = []
  if (p.motivo !== null) return eventos
  const tarde = DIF[p.dif].janelas.ok / 1000
  for (let i = p.cursor; i < p.notas.length; i += 1) {
    const n = p.notas[i]
    if (n.t > st + ALCANCE_DO_LACO_S) break
    if (n.julg === null && st - n.t > tarde) registrar(p, n, 'errou', eventos)
    if (n.segurando && st >= n.t + n.len) fecharSegura(p, n, true, eventos)
    if (p.motivo !== null) return eventos
  }
  while (p.cursor < p.notas.length && p.notas[p.cursor].julg !== null && !p.notas[p.cursor].segurando) p.cursor += 1
  if (st >= p.fimS) terminar(p, 'fim', eventos)
  return eventos
}

/** Pausa: a segurada no instante da pausa conta como inteira (a pausa não pode punir). */
export function fecharSeguradasNaPausa(p: PartidaDanca): EventoDaPartida[] {
  const eventos: EventoDaPartida[] = []
  if (p.motivo !== null) return eventos
  for (const n of p.notas) if (n.segurando) fecharSegura(p, n, true, eventos)
  return eventos
}

/** O mestre encerrou para todos. */
export function encerrarPartida(p: PartidaDanca, motivo: MotivoDoFim): EventoDaPartida[] {
  const eventos: EventoDaPartida[] = []
  terminar(p, motivo, eventos)
  return eventos
}

/** 0 a 1: quanto da música já passou. */
export function progressoDe(p: PartidaDanca, st: number): number {
  if (p.motivo !== null) return 1
  return p.fimS > 0 ? Math.min(1, Math.max(0, st / p.fimS)) : 0
}

export interface ResultadoDaDanca {
  motivo: MotivoDoFim
  /** null quando o mestre encerrou: não há nota. */
  letra: LetraDanca | null
  precisao: number
  pontos: number
  passou: boolean
  comboMax: number
  contagem: Record<Julgamento, number>
  seguradas: { inteiras: number; total: number }
}

/**
 * O resultado de quem terminou. Quem chegou ao fim é medido sobre a música
 * inteira; quem caiu ou foi encerrado, sobre o que chegou a dançar. Só passa
 * quem chegou ao fim com a nota mínima.
 */
export function resultadoDaPartida(p: PartidaDanca, notaMin: LetraDanca): ResultadoDaDanca {
  const motivo = p.motivo ?? 'mestre'
  const precisao = precisaoDe(p.placar, motivo === 'fim' ? p.totalItens : undefined)
  const letra = letraDe(precisao)
  return {
    motivo,
    letra: motivo === 'mestre' ? null : letra,
    precisao,
    pontos: pontosDe(p.placar, p.totalItens),
    passou: motivo === 'fim' && passouDaNota(letra, notaMin),
    comboMax: p.placar.comboMax,
    contagem: { perfeito: p.placar.perfeito, bom: p.placar.bom, ok: p.placar.ok, errou: p.placar.errou },
    seguradas: { inteiras: p.placar.segOk, total: p.placar.segTotal },
  }
}

/** Runas da porta acesas durante a dança: a nota ao vivo está passando da mínima. */
export function notaAoVivoPassa(placar: PlacarDanca, notaMin: LetraDanca): boolean {
  return placar.julgadas > 0 && passouDaNota(letraDe(precisaoDe(placar)), notaMin)
}
