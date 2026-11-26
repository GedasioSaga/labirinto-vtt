import { useEffect, useState } from 'react'
import { PaginaSons, type SonsNaJanela } from '../components/livro/PaginaSons'
import { Toast } from '../components/Toast'
import { useToastStore } from '../stores/toastStore'
import { criarFioDosSons, type SituacaoDoFio } from './fioDaJanela'
import './janela.css'

/**
 * A JANELA DOS SONS (`client/sons.html`): a página Sons do livro numa janela
 * à parte. Quem toca é o app: aqui a página só mostra o espelho que ele manda
 * e devolve os pedidos (`fioDaJanela.ts`). Recarregar esta janela não mexe em
 * nada: ela pede o estado de novo, e o que já soa continua soando.
 */

export function JanelaDosSons({ sessao }: { sessao: string }) {
  const [fio] = useState(() => criarFioDosSons(sessao))
  const [naJanela] = useState<SonsNaJanela>(() => ({ ...fio.sons, onVoltar: fio.voltar }))
  const [situacao, setSituacao] = useState<SituacaoDoFio>('esperando')
  const toasts = useToastStore((estado) => estado.toasts)
  const dispensar = useToastStore((estado) => estado.dismiss)
  const pausar = useToastStore((estado) => estado.pausar)
  const retomar = useToastStore((estado) => estado.retomar)

  useEffect(() => fio.ligar(), [fio])
  useEffect(() => fio.assinarSituacao(setSituacao), [fio])

  // A página só monta com o primeiro estado do app: antes, a biblioteca daqui é a vazia, e o lápis mudaria o nada.
  const comEstado = situacao === 'viva' || fio.temEstado()
  const semOApp =
    situacao === 'sumiu'
      ? 'A janela principal fechou, recarregou ou saiu da aventura. Os sons voltam aqui sozinhos quando ela voltar; até lá, nada aqui toca.'
      : comEstado
        ? null
        : 'Ligando com a janela principal…'

  return (
    <main className="lb-sons-janela">
      {semOApp !== null && (
        <p className="lb-sons-janela__faixa" role="status">
          {semOApp}
        </p>
      )}
      {comEstado && (
        <div className="lb-sons-janela__rolo lb-scroll" inert={situacao === 'sumiu'}>
          <PaginaSons naJanela={naJanela} />
        </div>
      )}
      <Toast toasts={toasts} onDismiss={dispensar} onPausar={pausar} onRetomar={retomar} />
    </main>
  )
}
