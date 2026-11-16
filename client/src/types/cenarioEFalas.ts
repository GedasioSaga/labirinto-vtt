/**
 * "!" CENÁRIO e "?" FALAS E PISTAS (P4 e P5 do estudo de 15/11,
 * `tmp/preludio-integrado-2026-11-15/ESTUDO.md` §4). O pino é o lugar; o texto
 * tem um dono (o próprio pino ou uma seção do Prelúdio); a mesa escolhe como
 * e quando o jogador recebe.
 */

/**
 * Quando o texto do "!" abre para o jogador:
 * - `tocar`: quem toca no pino lê (o "!" de sempre);
 * - `chegar`: abre sozinho, uma vez, quando a ficha dele chega a N casas;
 * - `mandar`: o pino aparece, mas o texto só chega com o "Ler agora" do mestre.
 */
export type QuandoDoCenario = 'tocar' | 'chegar' | 'mandar'

/**
 * O que a MESA (o host) sabe que este jogador já recebeu nesta sessão. Mora só
 * na sessão do host (`net/hostSession.ts`): os ids de jogador nascem a cada
 * sala, então não vão ao disco. Ausente no recorte = nada lido: falha fechada.
 */
export interface LeiturasDoJogador {
  /** Pinos "!" que o mestre leu para ele ("Ler agora") ou que ele já leu inteiro. */
  readonly cenarios: ReadonlySet<string>
}

/** Como o jogador está com um cenário que o mestre mandou: lendo agora, ou leu (com a hora, `Date.now()`). */
export interface LeituraDoCenario {
  readonly estado: 'lendo' | 'leu'
  readonly hora: number
}

/** Por pino, por jogador: o que a ficha do "!" e o "Ler junto" do mestre mostram. */
export type LeiturasDosCenarios = Readonly<Record<string, Readonly<Record<string, LeituraDoCenario>>>>
