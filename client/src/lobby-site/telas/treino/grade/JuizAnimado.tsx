import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { centroDaCasaNaArena, type CasaDaArena } from '../../../../lib/arena/grade'
import { DIRECAO_INICIAL, FOLHA_DO_JUDGE, PASSO_DA_VIRADA_MS, direcaoSeguinte, passosDaVirada, type DirecaoDoJudge } from '../../../../lib/batalha/judge'

/**
 * O JUDGE ANIMADO NA GRADE DO SITE (pedido de 06/11/2026: "lembre-se de
 * colocar o juiz, o modelo 3d"). A mesma folha pré-renderizada do modelo 3D
 * que o app desenha no Pixi (`pixi/judgeDoMapa.ts`), aqui em CSS: o site não
 * carrega Pixi nem three (guarda em `vite.lobby.config.ts`).
 *
 * - A folha do site (`public-lobby/judge-folha.webp`) são as 12 primeiras
 *   colunas da do app (`assets/judge/judge-folha.webp`): as 8 direções com a
 *   respiração. As 8 colunas de erguer a carta ficam de fora: no app a carta
 *   sobe quando o MESTRE desfaz uma linha, e no site não há mestre na luta.
 * - Respira a 12 quadros por segundo, em laço de 1 s, pelo `steps(12)` do
 *   CSS (arrasta o fundo um quadro por vez, sem JS por quadro).
 * - Vira para quem `olhaPara` aponta pela regra do app (`direcaoSeguinte`,
 *   `passosDaVirada`): uma direção da folha a cada 70 ms, pelo lado mais curto.
 * - Mesmo tamanho e ancoragem da Arena do app: 64 px de folha por casa, os pés
 *   (`FOLHA_DO_JUDGE.chao`) no centro da casa.
 * - Menos movimento: parado na 1ª coluna e vira de uma vez.
 */

/** Em `public-lobby/`: a folha do app cortada nas colunas da respiração. */
export const FOLHA_DO_JUIZ_NO_SITE = '/judge-folha.webp'

const { quadro, chao, linhas, respiracao } = FOLHA_DO_JUDGE
/** Colunas da folha do site (só a respiração). */
const COLUNAS_NO_SITE = respiracao.quadros
const MEIA_CASA = 32

function movimentoReduzido(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A direção de agora: começa de frente (sul, como o app antes da primeira vez)
 * e, quando o alvo muda, vira passo a passo até ele. Alvo nulo ou na mesma
 * casa: fica como está.
 */
function useDirecaoDoJuiz(casa: CasaDaArena, olhaPara: CasaDaArena | null): DirecaoDoJudge {
  const [direcao, setDirecao] = useState<DirecaoDoJudge>(DIRECAO_INICIAL)
  const atual = useRef(direcao)
  atual.current = direcao
  const alvoCol = olhaPara?.col
  const alvoRow = olhaPara?.row

  useEffect(() => {
    const alvo = alvoCol === undefined || alvoRow === undefined ? null : centroDaCasaNaArena({ col: alvoCol, row: alvoRow })
    const de = atual.current
    const para = direcaoSeguinte(de, centroDaCasaNaArena(casa), alvo)
    const passos = passosDaVirada(de, para)
    const primeiro = passos[0]
    if (primeiro === undefined) return
    if (movimentoReduzido()) {
      setDirecao(para)
      return
    }
    // O primeiro passo já sai agora; os outros a cada PASSO_DA_VIRADA_MS (o `direcaoNaVirada` do app).
    setDirecao(primeiro)
    let indice = 0
    const relogio = window.setInterval(() => {
      indice += 1
      const passo = passos[indice]
      if (passo === undefined) {
        window.clearInterval(relogio)
        return
      }
      setDirecao(passo)
    }, PASSO_DA_VIRADA_MS)
    return () => window.clearInterval(relogio)
  }, [casa.col, casa.row, alvoCol, alvoRow])

  return direcao
}

export function JuizAnimado({ casa, olhaPara, parado }: { casa: CasaDaArena; olhaPara: CasaDaArena | null; parado: boolean }) {
  const direcao = useDirecaoDoJuiz(casa, olhaPara)
  const estilo: CSSProperties = {
    left: MEIA_CASA - chao.x,
    top: MEIA_CASA - chao.y,
    width: quadro.largura,
    height: quadro.altura,
    backgroundImage: `url(${FOLHA_DO_JUIZ_NO_SITE})`,
    backgroundSize: `${COLUNAS_NO_SITE * quadro.largura}px ${linhas * quadro.altura}px`,
    // A linha da folha é a direção; a coluna é a respiração (o laço do grade.css, .lo-ga-juiz).
    backgroundPositionY: `${-direcao * quadro.altura}px`,
  }
  return <span className="lo-ga-juiz" style={estilo} data-direcao={direcao} data-parado={parado ? '' : undefined} aria-hidden="true" />
}
