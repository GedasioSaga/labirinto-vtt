import { lazy, Suspense, type ComponentType } from 'react'
import { MenuShell } from '../screens/MenuShell'
import { SUBTITULO_DO_PRELUDIO, TITULO_DO_PRELUDIO } from './textos'
import type { TelaDoPreludio as Tela } from './TelaDoPreludio'

/**
 * A porta de entrada do Prelúdio no pacote principal: só isto fica nele. A
 * tela, e tudo que ela puxar nas próximas fatias (editor de texto, quadro),
 * baixa quando o mestre abre o Prelúdio (plano §5: a parte principal do app
 * não cresce).
 */

type PropsDaTela = Parameters<typeof Tela>[0]

/** O pedaço da tela não chegou (o app foi atualizado com ele aberto, arquivo faltando). */
function PreludioNaoAbriu({ onBack }: PropsDaTela) {
  return (
    <MenuShell title={TITULO_DO_PRELUDIO} subtitle={SUBTITULO_DO_PRELUDIO} onBack={onBack} crumbs={['Labirinto']}>
      <section className="lb-wip">
        <p className="lb-wip__text" role="alert">
          A tela do Prelúdio não abriu. Feche e abra o Labirinto de novo.
        </p>
      </section>
    </MenuShell>
  )
}

const TelaDoPreludio = lazy<ComponentType<PropsDaTela>>(() =>
  import('./TelaDoPreludio').then(
    (modulo) => ({ default: modulo.TelaDoPreludio }),
    () => ({ default: PreludioNaoAbriu }),
  ),
)

export function PreludioSobDemanda({ onBack }: PropsDaTela) {
  return (
    // Enquanto baixa: o mesmo cabeçalho, sem conteúdo (vem do disco em milissegundos; um "Carregando" só piscaria).
    <Suspense fallback={<MenuShell title={TITULO_DO_PRELUDIO} subtitle={SUBTITULO_DO_PRELUDIO} onBack={onBack} crumbs={['Labirinto']}>{null}</MenuShell>}>
      <TelaDoPreludio onBack={onBack} />
    </Suspense>
  )
}
