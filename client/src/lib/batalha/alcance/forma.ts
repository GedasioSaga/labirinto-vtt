/**
 * ALCANCE: A FORMA (plano docs/design/habilidades/ALCANCE.md §3.1; protótipo aprovado
 * tmp/proto-alcance/fonte.html, 23/11/2026). Uma forma só, a mesma no host, no mestre, no
 * jogador, no Testar do editor e no treino do Lobby: é o que a função das casas (`casas.ts`)
 * recebe e o que as condições (`condicoes.ts`) mudam.
 *
 * As distâncias são as do xadrez (a diagonal conta 1), medidas da borda da ficha inteira de
 * quem usa, como `casaNaAreaDaFicha` (`lib/batalha/area.ts`).
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/**
 * A explosão da área longe, em volta do centro: a `raio` casas (o `raio` da mecânica) ou o
 * quadrado de `lado` ímpar (3x3 = raio 1, o `quadrado` num ponto). Um dos dois, nunca os dois.
 */
export type ExplosaoDoAlcance = { raio: number; lado?: undefined } | { lado: number; raio?: undefined }

/**
 * - `alvo`: uma casa por alvo, a até `ate`; com `de`, o anel (de `de` a `ate`, nunca colado).
 * - `linha`: a linha reta à frente, da largura da ficha, até `ate`.
 * - `volta`: tudo em volta de quem usa, até `ate` (o quadrado ímpar em quem usa é esta forma).
 * - `frente`: o quadrado de `lado` x `lado` colado na frente, centrado na ficha.
 * - `cruz`: as quatro linhas retas, da largura da ficha, até `ate`.
 * - `leque`: à frente até `ate`, a fileira colada da largura da ficha e cada fileira 2 casas mais
 *   larga (1, 3, 5 na ficha de 1 casa).
 * - `ponto` / `ficha`: a área longe; o centro (uma casa ou uma ficha) a até `ate`, e a explosão
 *   em volta dele.
 * - `si`: só em quem usa.
 */
export type FormaDoAlcance =
  | { tipo: 'alvo'; ate: number; de?: number }
  | { tipo: 'linha'; ate: number }
  | { tipo: 'volta'; ate: number }
  | { tipo: 'frente'; lado: number }
  | { tipo: 'cruz'; ate: number }
  | { tipo: 'leque'; ate: number }
  | ({ tipo: 'ponto'; ate: number } & ExplosaoDoAlcance)
  | ({ tipo: 'ficha'; ate: number } & ExplosaoDoAlcance)
  | { tipo: 'si' }

export type TipoDoAlcance = FormaDoAlcance['tipo']

/** A área longe: o centro escolhido e a explosão em volta dele. */
export type FormaDaAreaLonge = Extract<FormaDoAlcance, { tipo: 'ponto' | 'ficha' }>

/** As formas que olham para um lado: a mira escolhe a direção (o lado que o mouse aponta). */
export const DIRECIONAIS: ReadonlySet<TipoDoAlcance> = new Set<TipoDoAlcance>(['linha', 'frente', 'leque'])

/** A forma depende da direção para onde quem usa está virado. */
export function usaDirecao(forma: FormaDoAlcance): boolean {
  return DIRECIONAIS.has(forma.tipo)
}

/** Quantas casas a explosão vai além do centro (o quadrado de lado ímpar: 3x3 = 1). */
export function raioDaExplosao(forma: FormaDaAreaLonge): number {
  return forma.raio !== undefined ? forma.raio : Math.floor((forma.lado - 1) / 2)
}

function casas(n: number): string {
  return `${n} ${n === 1 ? 'casa' : 'casas'}`
}

function textoDaExplosao(forma: FormaDaAreaLonge): string {
  if (forma.tipo === 'ficha' && forma.raio !== undefined) return `explode ${casas(forma.raio)} em volta dela`
  const lado = forma.raio !== undefined ? forma.raio * 2 + 1 : forma.lado
  return `explode ${lado} x ${lado}`
}

function textoDaForma(forma: FormaDoAlcance): string {
  switch (forma.tipo) {
    case 'alvo':
      return forma.de === undefined ? `Um alvo a até ${casas(forma.ate)}` : `De ${forma.de} a ${casas(forma.ate)}, nunca colado`
    case 'linha':
      return `Linha reta de ${casas(forma.ate)}`
    case 'volta':
      return `Em volta, ${casas(forma.ate)}`
    case 'frente':
      return `Quadrado ${forma.lado} x ${forma.lado} à frente`
    case 'cruz':
      return `Cruz de ${casas(forma.ate)}`
    case 'leque':
      return `Leque de ${casas(forma.ate)} à frente`
    case 'ponto':
      return `Um alvo a até ${casas(forma.ate)}, ${textoDaExplosao(forma)}`
    case 'ficha':
      return `Uma ficha a até ${casas(forma.ate)}, ${textoDaExplosao(forma)}`
    case 'si':
      return 'Só em quem usa'
  }
}

/**
 * A frase do alcance, a do protótipo ("Leque de 3 casas à frente", "De 3 a 6 casas, nunca
 * colado"). `acendeQuemUsa`: a casa de quem usa também acende; quem escolhe uma casa ganha
 * ", ou nele mesmo" e a forma inteira, ", com ele".
 */
export function descreverAlcance(forma: FormaDoAlcance, acendeQuemUsa = false): string {
  const texto = textoDaForma(forma)
  if (!acendeQuemUsa || forma.tipo === 'si') return texto
  const escolheUmaCasa = (forma.tipo === 'alvo' && forma.de === undefined) || forma.tipo === 'ponto' || forma.tipo === 'ficha'
  return escolheUmaCasa ? `${texto}, ou nele mesmo` : `${texto}, com ele`
}
