import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Dialogo } from '../../components/grimorio/Dialogo'
import { naCampanha } from '../../lib/preparo/enciclopedia'
import { estaNaLixeira } from '../../lib/preparo/lixeira'
import { destinosParaMover, organizarLugares } from '../../lib/preparo/lugaresEmRegioes'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'
import './lixeira.css'

/**
 * "PÔR DENTRO DE…" (pedido de 17/11: sub-cenário fácil como no Grimório): a
 * escolha do lugar de cima, para o "Mover para…" da lista de Lugares e para o
 * "Fica dentro de" da página do lugar.
 *
 * Mostra TODOS os lugares (não só os que já têm algo dentro), na ordem da
 * árvore e com o caminho de cada um ("Reino de Goa › Castelo"), e uma busca
 * pelo nome. O que faria laço (o próprio lugar e o que está dentro dele) nem
 * aparece. Seta para baixo sai da busca para a lista; Enter na busca escolhe o
 * primeiro achado.
 */

interface EscolherLugarProps {
  aberto: boolean
  /** Os lugares que vão mudar de lugar de cima. */
  ids: readonly string[]
  /** Os lugares de qual campanha oferecer; `null` = de todas. */
  campanhaId: string | null
  aoFechar: () => void
  /** `null` = fora de todos os lugares. */
  aoEscolher: (destino: string | null) => void
}

function nomeDe(verbete: Verbete | undefined): string {
  return verbete?.titulo || 'Sem nome'
}

export function EscolherLugar({ aberto, ids: pedidos, campanhaId, aoFechar, aoEscolher }: EscolherLugarProps) {
  // Ao fechar, quem chama já esqueceu os lugares: a janela sai mostrando os de antes, sem trocar o título no meio da saída.
  const [ids, setIds] = useState(pedidos)
  if (aberto && ids !== pedidos) setIds(pedidos)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const soLeitura = usePreludio((estado) => estado.soLeitura)
  const [busca, setBusca] = useState('')
  const lista = useRef<HTMLUListElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  const organizados = useMemo(
    () => organizarLugares(aberto ? [...verbetes.values()].filter((verbete) => verbete.tipo === 'lugar' && !estaNaLixeira(verbete) && naCampanha(verbete, campanhaId)) : []),
    [aberto, verbetes, campanhaId],
  )
  const destinos = useMemo(() => destinosParaMover(ids, organizados, verbetes, soLeitura, busca), [ids, organizados, verbetes, soLeitura, busca])
  const quem = ids.map((id) => verbetes.get(id)).filter((verbete): verbete is Verbete => verbete !== undefined)
  const um = quem.length === 1 ? quem[0] : undefined
  // "Nenhum" só faz sentido para quem está dentro de algum lugar.
  const algumDentro = quem.some((verbete) => verbete.paiId !== undefined)
  const paiDoUm = um?.paiId === undefined ? undefined : verbetes.get(um.paiId)
  const procurando = busca.trim() !== ''

  const fechar = () => {
    setBusca('')
    aoFechar()
  }
  const escolher = (destino: string | null) => {
    setBusca('')
    aoEscolher(destino)
  }

  const itens = () => [...(lista.current?.querySelectorAll<HTMLButtonElement>('.pr-escolha__item:not(:disabled)') ?? [])]
  const aoTeclarNaBusca = (evento: KeyboardEvent<HTMLInputElement>) => {
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      itens()[0]?.focus()
    } else if (evento.key === 'Enter' && procurando) {
      evento.preventDefault()
      const primeiro = destinos.find((destino) => !destino.jaEstaAqui)
      if (primeiro !== undefined) escolher(primeiro.id)
    }
  }
  const aoTeclarNaLista = (evento: KeyboardEvent<HTMLUListElement>) => {
    if (evento.key !== 'ArrowDown' && evento.key !== 'ArrowUp') return
    evento.preventDefault()
    const todos = itens()
    const atual = todos.findIndex((item) => item === document.activeElement)
    if (evento.key === 'ArrowUp' && atual <= 0) campo.current?.focus()
    else todos[Math.min(todos.length - 1, atual + (evento.key === 'ArrowDown' ? 1 : -1))]?.focus()
  }

  return (
    <Dialogo
      aberto={aberto}
      pequeno
      titulo={um !== undefined ? `Pôr ${nomeDe(um)} dentro de` : `Pôr ${quem.length} lugares dentro de`}
      descricao="Escolha o lugar maior. O lugar passa a ficar dentro dele, com tudo o que já tem dentro."
      onFechar={fechar}
    >
      <div className="pr-por-dentro">
        <label className="pr-por-dentro__busca" data-gr-foco>
          <span className="pr-sr">Procurar um lugar pelo nome</span>
          <input
            ref={campo}
            type="search"
            className="pr-filtro__campo"
            placeholder="Procurar um lugar pelo nome"
            autoComplete="off"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            onKeyDown={aoTeclarNaBusca}
          />
        </label>
        <ul ref={lista} className="pr-escolha pr-por-dentro__lista" aria-label="Lugares" onKeyDown={aoTeclarNaLista}>
          {!procurando && algumDentro && (
            <li>
              <button type="button" className="pr-escolha__item pr-por-dentro__item" onClick={() => escolher(null)}>
                <span className="pr-por-dentro__nome">Nenhum</span>
                <span className="pr-escolha__detalhe">{paiDoUm !== undefined ? `Sai de ${nomeDe(paiDoUm)}` : 'Fica fora de outros lugares'}</span>
              </button>
            </li>
          )}
          {destinos.map((destino) => (
            <li key={destino.id}>
              <button type="button" className="pr-escolha__item pr-por-dentro__item" disabled={destino.jaEstaAqui} onClick={() => escolher(destino.id)}>
                <span className="pr-por-dentro__nome">{destino.nome}</span>
                <span className="pr-escolha__detalhe">{destino.jaEstaAqui ? 'Já está aqui' : destino.caminho === '' ? '' : `em ${destino.caminho}`}</span>
              </button>
            </li>
          ))}
          {destinos.length === 0 && (
            <li className="pr-quieto pr-por-dentro__nada" role="status">
              {procurando ? `Nenhum lugar com "${busca.trim()}".` : 'Ainda não há outro lugar onde pôr.'}
            </li>
          )}
        </ul>
        <p className="pr-quieto pr-por-dentro__nota">Não aparecem {um !== undefined ? `${nomeDe(um)} nem os lugares de dentro dele` : 'os lugares marcados nem os de dentro deles'}: um lugar não cabe dentro dele mesmo.</p>
      </div>
    </Dialogo>
  )
}
