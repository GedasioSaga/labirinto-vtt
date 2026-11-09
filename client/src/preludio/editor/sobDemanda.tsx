import { lazy, Suspense, type ComponentType } from 'react'
import { textoPlano } from '../../lib/preparo/enciclopedia'
import type { EditorDeTextoProps } from './EditorDeTexto'

/**
 * O editor (TipTap) baixa quando o primeiro texto aparece, e não quando o
 * Prelúdio abre: a tela inicial do Prelúdio (importar, cópia) não paga por ele.
 * Enquanto baixa, o texto aparece puro no mesmo lugar e na mesma letra.
 */

const carregar = () => import('./EditorDeTexto')

/** Começa a baixar o editor antes de ele ser preciso (ao entrar na Enciclopédia ou na Escrita). */
export function precarregarEditor(): void {
  void carregar().catch(() => undefined)
}

function EditorNaoAbriu({ texto, classe }: EditorDeTextoProps) {
  return (
    <div className={`pr-texto pr-texto--plano ${classe ?? ''}`}>
      <p className="pr-aviso" role="alert">
        O editor de texto não abriu. Feche e abra o Labirinto de novo; o texto continua salvo.
      </p>
      <p className="pr-texto__plano">{textoPlano(texto)}</p>
    </div>
  )
}

const EditorPreguicoso = lazy(() =>
  carregar().then(
    (modulo) => ({ default: modulo.EditorDeTexto }),
    () => ({ default: EditorNaoAbriu }),
  ),
)

const BarraPreguicosa = lazy((): Promise<{ default: ComponentType }> =>
  carregar().then(
    (modulo) => ({ default: modulo.BarraDoEditor }),
    () => ({ default: () => null }),
  ),
)

/** O texto pronto para ler e escrever; antes de o editor chegar, o mesmo texto sem formato. */
export function TextoDoPreludio(props: EditorDeTextoProps) {
  return (
    <Suspense
      fallback={
        <div className={`pr-texto pr-texto--esperando ${props.classe ?? ''}`}>
          <p className="pr-texto__plano">{textoPlano(props.texto)}</p>
        </div>
      }
    >
      <EditorPreguicoso {...props} />
    </Suspense>
  )
}

export function BarraDoTexto() {
  return (
    <Suspense fallback={<div className="pr-barra" aria-hidden="true" />}>
      <BarraPreguicosa />
    </Suspense>
  )
}
