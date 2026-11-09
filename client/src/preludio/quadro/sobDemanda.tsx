import { lazy, Suspense } from 'react'
import type { EditorDoQuadroProps } from './EditorDoQuadro'

/**
 * O editor do quadro (tldraw, com fontes e ícones dentro do app) baixa quando
 * o mestre entra em Quadros, e não quando o Prelúdio abre: a parte principal
 * do app e o resto do Prelúdio não pagam por ele (plano §5).
 */

const carregar = () => import('./EditorDoQuadro')

/** Começa a baixar o editor do quadro antes de ele ser preciso (ao entrar em Quadros). */
export function precarregarQuadro(): void {
  void carregar().catch(() => undefined)
}

function QuadroNaoAbriu({ aoVoltar }: EditorDoQuadroProps) {
  return (
    <section className="pr-lista">
      <p className="pr-aviso" role="alert">
        O editor do quadro não abriu. Feche e abra o Labirinto de novo; o quadro continua salvo.
      </p>
      <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" onClick={aoVoltar}>
        Voltar aos quadros
      </button>
    </section>
  )
}

const EditorPreguicoso = lazy(() =>
  carregar().then(
    (modulo) => ({ default: modulo.EditorDoQuadro }),
    () => ({ default: QuadroNaoAbriu }),
  ),
)

export function QuadroSobDemanda(props: EditorDoQuadroProps) {
  return (
    <Suspense
      fallback={
        <p className="pr-quieto pr-palco__abrindo" role="status">
          Abrindo o quadro…
        </p>
      }
    >
      <EditorPreguicoso {...props} />
    </Suspense>
  )
}
