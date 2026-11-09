import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react'
import type { PaginaExtraDoMestre } from '../../components/livro/LivroDoMestre'
import { FolhaDoLivro, TituloDaPagina } from '../../components/livro/FolhaDoLivro'
import { preparoLigado } from '../../lib/preparo/chave'
import type { LigaCena } from '../../lib/preparo/tipos'
import { useLivroDoMestreStore } from '../../stores/livroDoMestreStore'

/**
 * O MARCADOR ROTEIRO DO LIVRO DO MESTRE (plano §1, F4): no editor de mapas, o
 * roteiro da sessão da campanha do mapa, só para leitura, com os links e o
 * Revelar. Só isto mora no pacote principal: a página baixa na primeira vez
 * que o marcador abre (plano §5: a parte principal do app não cresce). Sem a
 * chave preparo, o livro fica como sempre.
 */

/** O rolo do roteiro, no traço dos ícones do livro (24 px de caixa, traço de 1,6). */
function IconeDoRoteiro() {
  return (
    <svg className="gr-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7 4h10.5a2 2 0 0 1 2 2v12.5 M7 4a2 2 0 0 0-2 2v1h4 M7 4a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2h8.5a1.5 1.5 0 0 0 0-3H11 M12 9h4.5 M12 12.5h4.5" />
    </svg>
  )
}

const PAGINAS_DO_PRELUDIO: readonly PaginaExtraDoMestre[] = [{ id: 'roteiro', rotulo: 'Roteiro', icone: <IconeDoRoteiro /> }]

/** Os marcadores que o Prelúdio põe no Livro do mestre; `undefined` com a chave desligada. */
export function usePaginasDoPreludioNoLivro(): readonly PaginaExtraDoMestre[] | undefined {
  const ligado = preparoLigado()
  // Desligou a chave com o Roteiro aberto (Ctrl+Alt+P na tela inicial): o livro volta à Ficha.
  useEffect(() => {
    const livro = useLivroDoMestreStore.getState()
    if (!ligado && livro.pagina === 'roteiro') livro.abrirPagina('ficha')
  }, [ligado])
  return ligado ? PAGINAS_DO_PRELUDIO : undefined
}

interface PropsDaPagina {
  /** Abre o mapa do link na cena e no pino; o App troca de mapa (perguntando antes, se há trabalho não salvo). */
  aoAbrirNaMesa: (alvo: LigaCena) => void
}

/** O pedaço da página não chegou (o app foi atualizado com ele aberto). */
function RoteiroNaoAbriu() {
  return (
    <>
      <TituloDaPagina titulo="Roteiro" sub="A sessão no mapa, só para leitura" />
      <p className="gr-sub-pagina" role="alert">
        O roteiro não abriu. Feche e abra o Labirinto de novo.
      </p>
    </>
  )
}

const PaginaRoteiro = lazy<ComponentType<PropsDaPagina>>(() =>
  import('./PaginaRoteiro').then(
    (modulo) => ({ default: modulo.PaginaRoteiro }),
    () => ({ default: RoteiroNaoAbriu }),
  ),
)

/** A folha do marcador Roteiro. Nada baixa nem lê o disco antes de o mestre abrir o marcador pela primeira vez. */
export function RoteiroNoLivro({ aoAbrirNaMesa }: PropsDaPagina) {
  const aberta = useLivroDoMestreStore((estado) => estado.pagina === 'roteiro')
  const [visto, setVisto] = useState(aberta)
  if (aberta && !visto) setVisto(true)
  // O App desenha a cada mudança do mapa (arrastar um token): a página recebe uma função fixa e não redesenha o texto junto.
  const ultima = useRef(aoAbrirNaMesa)
  useLayoutEffect(() => {
    ultima.current = aoAbrirNaMesa
  })
  const abrirNaMesa = useCallback((alvo: LigaCena) => ultima.current(alvo), [])
  return (
    <FolhaDoLivro pagina="roteiro">
      {visto && (
        <Suspense fallback={<TituloDaPagina titulo="Roteiro" sub="Abrindo o roteiro…" />}>
          <PaginaRoteiro aoAbrirNaMesa={abrirNaMesa} />
        </Suspense>
      )}
    </FolhaDoLivro>
  )
}
