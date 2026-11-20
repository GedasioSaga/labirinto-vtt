import type { PinSymbolShape } from '../../lib/pins'
import type { JogoDoMinigame } from '../../minigames/tipos'
import { SIMBOLO_DO_JOGO } from '../../minigames/simbolosDosJogos'

/**
 * Os ícones da página JOGOS (desafios, 15/11/2026), no traço dos ícones do
 * livro: caixa de 24, traço de 1,6. O símbolo de cada jogo é o MESMO do selo
 * no mapa (`minigames/simbolosDosJogos.ts`), passado do quadrado normalizado
 * para a caixa de 24.
 */

const CENTRO = 12
/** Quanto o quadrado normalizado (-1..1) ocupa na caixa de 24. */
const RAIO = 8

function px(n: number): number {
  return Math.round((CENTRO + n * RAIO) * 100) / 100
}

function DesenhoDoSimbolo({ forma }: { forma: PinSymbolShape }) {
  return (
    <>
      {forma.strokes.map((traco, i) => {
        const pontos = traco.points.map((p) => `${px(p.x)} ${px(p.y)}`)
        return <path key={`t${i}`} d={`M${pontos.join('L')}${traco.closed === true ? 'Z' : ''}`} />
      })}
      {(forma.rings ?? []).map((anel, i) => (
        <circle key={`a${i}`} cx={px(anel.x)} cy={px(anel.y)} r={Math.round(anel.r * RAIO * 100) / 100} />
      ))}
      {(forma.dots ?? []).map((ponto, i) => (
        <circle key={`p${i}`} cx={px(ponto.x)} cy={px(ponto.y)} r={Math.round(ponto.r * RAIO * 100) / 100} fill="currentColor" stroke="none" />
      ))}
    </>
  )
}

/** O símbolo do jogo (nota, anzol, alvo, chama, bolhas, peça de quebra-cabeça). */
export function IconeDoJogo({ jogo }: { jogo: JogoDoMinigame }) {
  return (
    <svg className="gr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <DesenhoDoSimbolo forma={SIMBOLO_DO_JOGO[jogo]} />
    </svg>
  )
}

/** O marcador "Jogos" do livro: o controle de videogame do protótipo. */
export function IconeDosJogos() {
  return (
    <svg className="gr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7.5 8h9a4 4 0 0 1 3.9 4.9l-.8 3.6a2.2 2.2 0 0 1-3.9.9L13.8 15h-3.6l-1.9 2.4a2.2 2.2 0 0 1-3.9-.9l-.8-3.6A4 4 0 0 1 7.5 8z M8.5 10.3v3.4 M6.8 12h3.4" />
      <circle cx={15.4} cy={11} r={0.95} fill="currentColor" stroke="none" />
      <circle cx={17.2} cy={12.9} r={0.95} fill="currentColor" stroke="none" />
    </svg>
  )
}
