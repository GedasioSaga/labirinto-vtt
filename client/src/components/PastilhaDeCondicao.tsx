import { caracteresDoSimbolo } from '../lib/condicoesProprias'
import { imagemDoGlifo } from '../lib/glifoDeCondicao'
import {
  CONDITION_GLYPH_FRACTION,
  CONDITION_GLYPH_STROKE_FRACTION,
  CONDITION_INK,
  CONDITION_OUTLINE_FRACTION,
  CONDITION_TEXT_FRACTION,
  type ConditionSymbol,
  type ConditionSymbolPoint,
} from '../lib/tokenConditions'

/** Centro e raio da pastilha no `viewBox` de 24: sobra 1 unidade para o contorno não ser cortado na borda. */
const CENTRO = 12
const RAIO = 10.5
/** Sem a pintura do símbolo (teste sem tela): o texto direto, neste tamanho de fonte — um caractere, ou dois. */
const FONTE_DE_RESERVA_DE_UM = 13
const FONTE_DE_RESERVA_DE_DOIS = 9

/**
 * O símbolo digitado dentro da pastilha: a MESMA pintura que o mapa usa de
 * textura (`lib/glifoDeCondicao.ts`), no mesmo quadrado. Onde não há tela para
 * pintar, o texto vai direto no SVG.
 */
function SimboloDigitado({ texto, tinta }: { texto: string; tinta: string }) {
  const imagem = imagemDoGlifo(texto, tinta)
  const meia = RAIO * CONDITION_TEXT_FRACTION
  if (imagem !== null) return <image href={imagem} x={CENTRO - meia} y={CENTRO - meia} width={meia * 2} height={meia * 2} />
  const fonte = caracteresDoSimbolo(texto) > 1 ? FONTE_DE_RESERVA_DE_DOIS : FONTE_DE_RESERVA_DE_UM
  return (
    <text x={CENTRO} y={CENTRO} textAnchor="middle" dominantBaseline="central" fontSize={fonte} fontWeight={700} fill={tinta}>
      {texto}
    </text>
  )
}

/**
 * Uma pastilha de condição como SVG — a mesma geometria que
 * `pixi/drawTokenConditions.ts` desenha em cima da ficha, lida da mesma fonte
 * (`ConditionSymbol`) e nas mesmas proporções: o botão mostra a marca que vai
 * sair no mapa. Serve às cinco de fábrica e às criadas pelo mestre, no painel
 * dele e no inventário de quem joga (por isso mora num arquivo sem store).
 *
 * Decorativa (`aria-hidden`): quem carrega o nome é o texto ou o rótulo ao lado.
 */
export function PastilhaDeCondicao({ symbol, tamanho = 18 }: { symbol: ConditionSymbol; tamanho?: number }) {
  const scale = RAIO * CONDITION_GLYPH_FRACTION
  const width = RAIO * CONDITION_GLYPH_STROKE_FRACTION
  const tinta = symbol.ink ?? CONDITION_INK
  const ponto = (p: ConditionSymbolPoint): string => `${(CENTRO + p.x * scale).toFixed(2)},${(CENTRO + p.y * scale).toFixed(2)}`
  return (
    <svg className="lb-token-condition__badge" width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx={CENTRO} cy={CENTRO} r={RAIO} fill={symbol.fill} stroke={CONDITION_INK} strokeWidth={RAIO * CONDITION_OUTLINE_FRACTION} />
      {symbol.texto !== undefined && <SimboloDigitado texto={symbol.texto} tinta={tinta} />}
      {(symbol.solids ?? []).map((solid, i) => (
        <polygon key={`cheio-${i}`} points={solid.map(ponto).join(' ')} fill={tinta} />
      ))}
      {symbol.strokes.map((stroke, i) => {
        const points = stroke.points.map(ponto).join(' ')
        return stroke.closed === true ? (
          <polygon key={`traco-${i}`} points={points} fill="none" stroke={tinta} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <polyline key={`traco-${i}`} points={points} fill="none" stroke={tinta} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
        )
      })}
      {(symbol.dots ?? []).map((dot, i) => (
        <circle
          key={`ponto-${i}`}
          cx={CENTRO + dot.x * scale}
          cy={CENTRO + dot.y * scale}
          r={dot.r * scale}
          fill={dot.hole === true ? symbol.fill : tinta}
        />
      ))}
    </svg>
  )
}
