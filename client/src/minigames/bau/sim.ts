/**
 * SIMULAÇÃO DO BAÚ, "FECHOS TEIMOSOS": baú velho com fechos de mola de latão
 * na frente da tampa. Solto, cada fecho volta a fechar devagar (a mola puxa);
 * a tampa só sobe com todos os fechos abertos ao mesmo tempo, por tempo
 * suficiente. Tocar num fecho ainda alto emperra esse fecho, e de vez em
 * quando um solavanco derruba um fecho, com aviso antes. É malabarismo de
 * pratos: escolher qual fecho salvar agora (decisão) e entrar numa cadência
 * (ritmo).
 *
 * Puro, sem DOM, determinístico por semente: o jogo, o robô e os testes rodam
 * a mesma conta em passo fixo. Todo número de ajuste mora em `DIF`.
 */
import { entre, inteiro, rngDe } from '../abrir/rng'
import { DT, LIMITE_S } from '../abrir/tipos'
import type { Rng } from '../abrir/rng'
import type { Dificuldade, Entrada, Evento, Fim } from '../abrir/tipos'

/** Faixa [mínimo, máximo) de um sorteio. */
export type Faixa = readonly [number, number]

/** Números de ajuste de uma dificuldade. Abertura e tampa vão de 0 a 1. */
export interface ParametrosDaDificuldade {
  nome: string
  /** Quantos fechos o baú tem (até `MAX_FECHOS`). */
  fechos: number
  /** Queda de cada fecho, em abertura por s, sorteada por fecho nesta faixa. */
  queda: Faixa
  /** O fecho teimoso (um por partida) cai este tanto mais rápido. */
  teimoso: number
  /** Toque com o fecho acima disto é cedo demais: emperra. */
  cedo: number
  /** Tempo que o fecho fica emperrado, em s (não aceita toque e continua caindo). */
  trava: number
  /** Com todos os fechos neste nível ou acima, a tampa sobe. */
  limiar: number
  /** Tempo de tampa subindo sem parar até abrir, em s. */
  tampa: number
  /** Queda da tampa por s quando algum fecho está abaixo do limiar. */
  dreno: number
  /** Intervalo entre o fim de um solavanco e o aviso do próximo, em s. */
  solavanco: Faixa
  /** Aviso antes do solavanco, em s (meta: nunca abaixo de 0,3 s). */
  aviso: number
}

/** Mais fechos que isso não cabem na frente do baú com alvos de toque generosos. */
export const MAX_FECHOS = 4

/*
 * Afinação de 15/11/2026, placar de 400 partidas por dificuldade (números no
 * robo.test.ts). Com os valores de partida do pedido (queda 0,30-0,42/s, trava
 * 0,6 s, tampa 4,5 s, dreno 0,3/s, solavanco a cada 3,5-5 s) o robô humano
 * abria 100% em 5,3 s e o robô ruim, tocando ao acaso, abria 59,5%: tocar à
 * toa compensava. O que mudou e por quê:
 * - trava 0,6 -> 1,2 s: emperrar passou a custar caro. Com 0,6 s o fecho
 *   emperrado ainda voltava a tempo de ser tocado de novo; com 1,2 s ele cai
 *   abaixo do limiar preso, e o toque à toa deixa de abrir (ruim 59,5% -> 0%).
 * - tampa 4,5 -> 9 s e queda 0,45-0,60/s no Normal: com a tampa curta a
 *   partida acabava antes do segundo solavanco; agora a pessoa precisa manter
 *   a cadência por uns 10 s, dentro da faixa de 10-16 s da meta.
 * - dreno 0,3 -> 0,5/s (Normal) e 0,6/s (Difícil): deixar um fecho cair custa
 *   uns 4 s de tampa por segundo caído. É o que separa quem salva o fecho de
 *   quem não salva.
 * - solavanco mais frequente (2,2-3,2 s no Normal, 1,6-2,4 s no Difícil) e
 *   aviso de 0,42 s no Normal: com 0,5 s o robô salvava quase todos.
 *
 * Ajuste 2, 15/11/2026 (PEDIDO-2.md): o mestre jogou e achou o baú "muito
 * difícil". Metas novas: Normal >= 97% com mediana de 7 a 11 s, Difícil de 55%
 * a 75%, robô ruim < 10% nos dois. Antes: Normal 88,0% em 12,2 s, Difícil
 * 44,5%. Só trava, dreno, solavanco, teimoso e limiar ficaram iguais.
 * - tampa 9 -> 7 s (Normal) e 8 s (Difícil): é o que leva o robô às metas.
 *   Sozinha, a tampa de 6,5 s já dava 99,5% ao robô no Normal, mas um robô
 *   mais lento que a régua (reação de 400 ms, o dobro de erro de fecho), usado
 *   só para comparar, vencia 63%: gente aprendendo ainda perderia muito.
 * - queda 0,45-0,60 -> 0,38-0,50/s (só Normal): menos toques por segundo, uma
 *   cadência que dá para pegar. Foi a alavanca que mais ajudou o robô lento.
 * - aviso 0,42 -> 0,55 s (Normal) e 0,38 -> 0,45 s (Difícil): ver o fecho
 *   acender, achar e tocar leva mais que os 250 ms do robô para quem usa o mouse.
 * - cedo 0,8 -> 0,85 (só Normal): faixa âmbar maior, menos fecho emperrado por
 *   toque adiantado. O robô ruim, que toca ao acaso, continua em 0%.
 * Com os quatro, o robô lento vence 95% no Normal. O Difícil continua difícil
 * para ele (perto de 2%): 4 fechos, queda rápida, âmbar estreito e aviso curto.
 */
export const DIF: Readonly<Record<Dificuldade, ParametrosDaDificuldade>> = {
  normal: {
    nome: 'Normal', fechos: 3, queda: [0.38, 0.5], teimoso: 1.4, cedo: 0.85, trava: 1.2,
    limiar: 0.3, tampa: 7, dreno: 0.5, solavanco: [2.2, 3.2], aviso: 0.55,
  },
  dificil: {
    nome: 'Difícil', fechos: 4, queda: [0.45, 0.6], teimoso: 1.4, cedo: 0.8, trava: 1.2,
    limiar: 0.3, tampa: 8, dreno: 0.6, solavanco: [1.6, 2.4], aviso: 0.45,
  },
}

/** Duração da animação de abrir depois da vitória, em s. */
export const ABRIR_S = 0.5
/** Intervalo entre dois rangidos da tampa enquanto ela sobe, em s. */
export const RANGE_A_CADA = 0.3
/** Sem fecho alto para o solavanco derrubar, ele tenta de novo depois deste tanto, em s. */
export const SOLAVANCO_DE_NOVO = 0.5
/** Folga de ponto flutuante na comparação do teto de tempo (2.400 somas de DT). */
const FOLGA = 1e-9

/** Um fecho de mola. */
export interface Fecho {
  /** Abertura: 0 = fechado (deitado), 1 = aberto (em pé). */
  a: number
  /** Queda por s (a mola puxando). */
  q: number
  /** Tempo que ainda falta emperrado, em s; 0 = solto. */
  preso: number
}

/** Estado mutável único da tentativa. */
export interface Estado {
  dif: Dificuldade
  d: ParametrosDaDificuldade
  r: Rng
  /** Tempo desde o começo, em s; continua andando depois do fim (animação de abrir). */
  t: number
  fechos: Fecho[]
  /** Índice do fecho teimoso. */
  teimoso: number
  /** Tampa: 0 = fechada, 1 = abriu. */
  tampa: number
  /** Instante do próximo aviso de solavanco. */
  proxAviso: number
  /** Fecho em aviso (-1 = nenhum). */
  avisoEm: number
  /** Tempo de aviso que ainda falta, em s. */
  avisoResta: number
  /** Instante do último solavanco (negativo = nenhum ainda); a arte dá o tranco por ele. */
  tSolavanco: number
  /** Tempo desde o último rangido da tampa (com teto em `RANGE_A_CADA`). */
  range: number
  fim: Fim | null
  /** Instante do fim (vale só com `fim` diferente de null). */
  tFim: number
  /** Eventos do último passo. */
  ev: Evento[]
}

/** Começa uma tentativa: todos os fechos em 0 (fechados), quedas e solavancos sorteados pela semente. */
export function criar(semente: string, dif: Dificuldade): Estado {
  const d = DIF[dif]
  const r = rngDe(semente + '|jogo')
  const n = Math.min(MAX_FECHOS, d.fechos)
  const teimoso = inteiro(r, n)
  const fechos: Fecho[] = []
  for (let i = 0; i < n; i++) {
    const q = entre(r, d.queda[0], d.queda[1]) * (i === teimoso ? d.teimoso : 1)
    fechos.push({ a: 0, q, preso: 0 })
  }
  return {
    dif, d, r, t: 0, fechos, teimoso, tampa: 0,
    proxAviso: entre(r, d.solavanco[0], d.solavanco[1]),
    avisoEm: -1, avisoResta: 0, tSolavanco: -1,
    // Cheio: o primeiro passo de tampa subindo já range, para a pessoa ouvir que começou.
    range: RANGE_A_CADA,
    fim: null, tFim: 0, ev: [],
  }
}

/** Todos os fechos no limiar ou acima: a condição da tampa subir. */
export function todosAbertos(e: Readonly<Estado>): boolean {
  return e.fechos.every((f) => f.a >= e.d.limiar)
}

/** Aplica o toque no fecho `i` (as regras de emperrar e segurar). */
function tocar(e: Estado, i: number): void {
  const f = e.fechos[i]
  if (f.preso > 0) {
    e.ev.push({ nome: 'travado', v: i })
    return
  }
  if (i === e.avisoEm) {
    // Segurar o fecho que acendeu nunca emperra, mesmo alto: a pessoa fez o certo.
    f.a = 1
    e.avisoEm = -1
    e.avisoResta = 0
    e.proxAviso = e.t + entre(e.r, e.d.solavanco[0], e.d.solavanco[1])
    e.ev.push({ nome: 'segurou', v: i })
    return
  }
  if (f.a > e.d.cedo) {
    f.preso = e.d.trava
    e.ev.push({ nome: 'emperrou', v: i })
    return
  }
  f.a = 1
  e.ev.push({ nome: 'fecho', v: i })
}

/** Escolhe um fecho para o solavanco: alto o bastante para cair e solto (preso não teria como ser salvo). */
function escolherVitima(e: Estado): number {
  const candidatos: number[] = []
  e.fechos.forEach((f, i) => {
    if (f.a >= e.d.limiar && f.preso === 0) candidatos.push(i)
  })
  return candidatos.length === 0 ? -1 : candidatos[inteiro(e.r, candidatos.length)]
}

/** Relógio do solavanco: aviso, depois a queda do fecho escolhido. */
function solavancar(e: Estado): void {
  if (e.avisoEm >= 0) {
    e.avisoResta -= DT
    if (e.avisoResta > FOLGA) return
    const i = e.avisoEm
    e.fechos[i].a = 0
    e.avisoEm = -1
    e.avisoResta = 0
    e.tSolavanco = e.t
    e.proxAviso = e.t + entre(e.r, e.d.solavanco[0], e.d.solavanco[1])
    e.ev.push({ nome: 'solavanco', v: i })
    return
  }
  if (e.t + FOLGA < e.proxAviso) return
  const i = escolherVitima(e)
  if (i < 0) {
    e.proxAviso = e.t + SOLAVANCO_DE_NOVO
    return
  }
  e.avisoEm = i
  e.avisoResta = e.d.aviso
  e.ev.push({ nome: 'aviso', v: i })
}

/** Tampa: sobe com todos os fechos no limiar, desce pelo dreno com algum abaixo. */
function moverTampa(e: Estado): void {
  if (todosAbertos(e)) {
    e.tampa = Math.min(1, e.tampa + DT / e.d.tampa)
    e.range += DT
    if (e.range + FOLGA >= RANGE_A_CADA) {
      e.range -= RANGE_A_CADA
      e.ev.push({ nome: 'range', v: e.tampa })
    }
    return
  }
  e.tampa = Math.max(0, e.tampa - e.d.dreno * DT)
  // O relógio do rangido continua contando parado: depois de uma pausa longa a tampa range logo
  // que volta a subir, e uma pausa curta não faz dois rangidos a menos de 0,3 s.
  e.range = Math.min(RANGE_A_CADA, e.range + DT)
}

/**
 * Avança um DT. Depois do fim só o relógio anda (a animação de abrir), sem ler
 * a entrada, e devolve sempre o mesmo fim.
 */
export function passo(e: Estado, entrada: Readonly<Entrada>): Fim | null {
  e.ev = []
  e.t += DT
  if (e.fim !== null) return e.fim
  if (entrada.toque >= 0 && entrada.toque < e.fechos.length) tocar(e, entrada.toque)
  for (const f of e.fechos) {
    f.a = Math.max(0, f.a - f.q * DT)
    f.preso = Math.max(0, f.preso - DT)
  }
  solavancar(e)
  moverTampa(e)
  if (e.tampa >= 1) {
    e.fim = 'abriu'
    e.tFim = e.t
    e.ev.push({ nome: 'abriu' })
  } else if (e.t + FOLGA >= LIMITE_S) {
    e.fim = 'tempo'
    e.tFim = e.t
    e.ev.push({ nome: 'tempo' })
  }
  return e.fim
}

/** Eventos do último passo (a lista é refeita a cada passo). */
export const eventos = (e: Readonly<Estado>): readonly Evento[] => e.ev

/** Tempo da tentativa, em s. */
export const tempo = (e: Readonly<Estado>): number => e.t

/** Como a tentativa acabou (null = ainda jogando). */
export const fim = (e: Readonly<Estado>): Fim | null => e.fim

/** 0..1 até abrir: a altura da tampa. */
export const progresso = (e: Readonly<Estado>): number => e.tampa

/** 0..1 da animação de abrir, em `ABRIR_S` depois da vitória; 0 sem vitória. */
export function abertura(e: Readonly<Estado>): number {
  if (e.fim !== 'abriu') return 0
  return Math.min(1, Math.max(0, (e.t - e.tFim) / ABRIR_S))
}

/** Tempo que a vela mostra: para no fim, para não queimar durante a animação de abrir. */
export const tempoDaVela = (e: Readonly<Estado>): number => (e.fim === null ? e.t : e.tFim)

/**
 * O que o gráfico do movimento e o robô leem: `a<i>` abertura de cada fecho,
 * `p<i>` 1 se emperrado, `tampa`, `aviso` (0/1) e `alvo` (fecho em aviso, -1 =
 * nenhum). Objeto novo a cada chamada: o olho do robô guarda as telas antigas.
 */
export function amostra(e: Readonly<Estado>): Readonly<Record<string, number>> {
  const s: Record<string, number> = { tampa: e.tampa, aviso: e.avisoEm >= 0 ? 1 : 0, alvo: e.avisoEm }
  e.fechos.forEach((f, i) => {
    s['a' + i] = f.a
    s['p' + i] = f.preso > 0 ? 1 : 0
  })
  return s
}
