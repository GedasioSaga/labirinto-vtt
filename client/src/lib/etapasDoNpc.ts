import type { PassoDaPatrulha, Token } from '../types/map'

/**
 * ETAPAS DO NPC — o que a ficha faz quando chega a uma parada: os passos da
 * patrulha (esperar, olhar, falar, sumir, aparecer, velocidade, esperar o
 * mestre). Servem ao ponto da patrulha (`lib/patrulhaAndando.ts`) e ao posto
 * da rotina (`lib/rotinaAndando.ts`), com o mesmo executor e o mesmo jeito de
 * aplicar no mapa. Caminhos F4 (`docs/planos/caminhos-2026-10-23.md`).
 *
 * Puro: sem DOM, sem Pixi, sem store.
 */

/** O que as etapas da parada mudam na ficha, além de onde ela está. */
export interface EfeitosDosPassos {
  /** Passo "Olhar": a frente da ficha, em graus (0 = para cima, horário). */
  olhar?: number
  /** Passo "Falar": o texto; `null` cala (ela voltou a andar). */
  fala?: string | null
  /** Passo "Sumir" (`true`) ou "Aparecer" (`false`). */
  sumida?: boolean
}

/** Até onde as etapas da parada foram neste tique. */
export interface Execucao {
  efeitos: EfeitosDosPassos
  /** O próximo passo a fazer; `null` = as etapas acabaram e a ficha segue. */
  proximo: number | null
  esperaAte: number
  esperandoMestre: boolean
  /** Passo "Velocidade" feito neste tique. */
  velocidade?: number
}

/**
 * O EXECUTOR DAS ETAPAS: faz os passos a partir de `desde`, de uma vez, até um
 * que segura a ficha (esperar, esperar o mestre) ou até o fim. Olhar, falar,
 * sumir, aparecer e velocidade não levam tempo: valem no mesmo tique.
 */
export function executarPassos(passos: readonly PassoDaPatrulha[], desde: number, now: number): Execucao {
  const efeitos: EfeitosDosPassos = {}
  let velocidade: number | undefined
  const depois = (i: number) => (i + 1 < passos.length ? i + 1 : null)
  for (let i = desde; i < passos.length; i += 1) {
    const passo = passos[i]
    if (passo === undefined) continue
    switch (passo.tipo) {
      case 'esperar':
        if (passo.segundos > 0) return { efeitos, velocidade, proximo: depois(i), esperaAte: now + passo.segundos * 1000, esperandoMestre: false }
        break
      case 'esperarMestre':
        return { efeitos, velocidade, proximo: depois(i), esperaAte: now, esperandoMestre: true }
      case 'olhar':
        efeitos.olhar = passo.graus
        break
      case 'velocidade':
        velocidade = passo.casas
        break
      case 'falar':
        efeitos.fala = passo.texto === '' ? null : passo.texto
        break
      case 'sumir':
        efeitos.sumida = true
        break
      case 'aparecer':
        efeitos.sumida = false
        break
    }
  }
  return { efeitos, velocidade, proximo: null, esperaAte: now, esperandoMestre: false }
}

/** As etapas seguram a ficha agora (espera ainda correndo, ou o mestre)? */
export function segurada(ficha: { esperandoMestre?: true; esperaAte: number }, now: number): boolean {
  return ficha.esperandoMestre === true || ficha.esperaAte > now
}

/** "Seguir" do painel: a ficha parada em "Esperar o mestre" faz o resto das etapas e segue. Quem não espera: o mesmo mapa. */
export function soltarDoMestre<T extends { esperandoMestre?: true; esperaAte: number }>(andando: ReadonlyMap<string, T>, tokenId: string, now: number): ReadonlyMap<string, T> {
  const ficha = andando.get(tokenId)
  if (ficha?.esperandoMestre !== true) return andando
  const solta: T = { ...ficha, esperaAte: now }
  delete solta.esperandoMestre
  const next = new Map(andando)
  next.set(tokenId, solta)
  return next
}

export function temEfeito(efeitos: EfeitosDosPassos): boolean {
  return efeitos.olhar !== undefined || efeitos.fala !== undefined || efeitos.sumida !== undefined
}

/** A direção do cone da vigia (0 = leste) para a frente `graus` da ficha (0 = para cima). */
function direcaoDaVigia(graus: number): number {
  return (graus + 270) % 360
}

/** A ficha com os efeitos das etapas; a MESMA instância quando nada muda. */
export function comEfeitos(token: Token, m: EfeitosDosPassos): Token {
  let t = token
  if (m.olhar !== undefined && t.rotation !== m.olhar) t = { ...t, rotation: m.olhar }
  if (m.olhar !== undefined && t.vigia !== undefined && t.vigia !== null) {
    const direcao = direcaoDaVigia(m.olhar)
    if (t.vigia.direcao !== direcao) t = { ...t, vigia: { ...t.vigia, direcao } }
  }
  if (m.fala === null && 'fala' in t) {
    const { fala: _calou, ...resto } = t
    t = resto
  } else if (typeof m.fala === 'string' && t.fala !== m.fala) {
    t = { ...t, fala: m.fala }
  }
  if (m.sumida === true && t.hidden !== true) {
    t = { ...t, hidden: true }
  } else if (m.sumida === false && 'hidden' in t) {
    const { hidden: _sumida, ...resto } = t
    t = resto
  }
  return t
}
