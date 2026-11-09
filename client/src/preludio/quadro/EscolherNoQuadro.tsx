import { useEffect, useMemo, useState } from 'react'
import { Dialogo } from '../../components/grimorio/Dialogo'
import { compararTitulos } from '../../lib/preparo/enciclopedia'
import { lugaresDoQuadro, type LugarNoQuadro } from '../../lib/preparo/quadros'
import { usePreludio } from '../estado/preludio'
import { verbeteDoCartao } from './cartaoSemTldraw'
import { lerQuadroAtual, quadrosParaCitar, useQuadros, type ResumoDoQuadro } from './estadoDosQuadros'

/**
 * "CITAR O QUADRO" (fatia F3b): o texto (o roteiro da sessão, mas serve em
 * qualquer texto) cita o quadro inteiro, uma moldura ou um cartão. A citação
 * guarda o endereço (o id do quadro e da forma); um clique nela abre o quadro
 * naquele ponto. Abre no quadro da sessão do texto, quando há, mesmo com o
 * filtro em outra campanha da sessão. Não grava: lê o quadro como o mestre o
 * deixou (a gravação pendente termina antes; a recusada vale).
 */

export interface AlvoNoQuadro {
  readonly quadroId: string
  /** A forma citada (`shape:…`); `null` = o quadro inteiro. */
  readonly formaId: string | null
}

interface EscolherNoQuadroProps {
  aoFechar: () => void
  aoEscolher: (alvo: AlvoNoQuadro, rotulo: string) => void
}

type Lugares = { readonly t: 'lendo' } | { readonly t: 'pronto'; readonly lugares: readonly LugarNoQuadro[] } | { readonly t: 'falhou'; readonly motivo: string }

/** A sessão do texto aberto: o quadro dela vem primeiro e já escolhido. */
function useSessaoDoTexto(): string | null {
  const lugar = usePreludio((estado) => estado.lugar)
  const verbetes = usePreludio((estado) => estado.verbetes)
  if (lugar.secao === 'sessoes') return lugar.sessaoId
  // A página de uma sessão (as notas que vieram do Grimório moram nelas).
  const paginaId = lugar.secao === 'escrita' ? lugar.paginaId : null
  const pai = paginaId === null ? undefined : verbetes.get(verbetes.get(paginaId)?.paiId ?? '')
  return pai?.tipo === 'sessao' ? pai.id : null
}

export function EscolherNoQuadro({ aoFechar, aoEscolher }: EscolherNoQuadroProps) {
  const lista = useQuadros((estado) => estado.lista)
  const campanhaId = usePreludio((estado) => estado.campanhaId)
  const verbetes = usePreludio((estado) => estado.verbetes)
  const sessaoDoTexto = useSessaoDoTexto()
  const quadros = useMemo(() => quadrosParaCitar(lista, campanhaId, sessaoDoTexto), [lista, campanhaId, sessaoDoTexto])
  const [escolhido, setEscolhido] = useState<string | null>(null)
  const quadro: ResumoDoQuadro | undefined = quadros.find((cada) => cada.id === escolhido) ?? quadros[0]
  const [lugares, setLugares] = useState<Lugares>({ t: 'lendo' })

  useEffect(() => {
    if (lista.t === 'nao-lida') void useQuadros.getState().recarregar()
  }, [lista.t])

  const quadroId = quadro?.id
  useEffect(() => {
    if (quadroId === undefined) return
    let vivo = true
    setLugares({ t: 'lendo' })
    lerQuadroAtual(quadroId).then(
      (atual) => {
        if (!vivo) return
        if (atual.t === 'naoGravado') {
          setLugares({ t: 'pronto', lugares: lugaresDoQuadro(atual.quadro.tldraw) })
          return
        }
        const { lido } = atual
        if (lido.estado === 'ok' || (lido.estado === 'somenteLeitura' && lido.valor !== null)) setLugares({ t: 'pronto', lugares: lugaresDoQuadro(lido.valor?.tldraw) })
        else setLugares({ t: 'falhou', motivo: lido.estado === 'novo' ? 'o quadro não existe mais' : lido.aviso })
      },
      (erro: unknown) => {
        if (vivo) setLugares({ t: 'falhou', motivo: erro instanceof Error ? erro.message : String(erro) })
      },
    )
    return () => {
      vivo = false
    }
  }, [quadroId])

  const nomeDoQuadro = quadro === undefined ? '' : quadro.nome || 'Quadro sem nome'
  const molduras = lugares.t === 'pronto' ? lugares.lugares.filter((lugar) => lugar.tipo === 'moldura') : []
  const cartoes = useMemo(() => {
    if (lugares.t !== 'pronto') return []
    const vistos = new Set<string>()
    const lista: { formaId: string; titulo: string }[] = []
    for (const lugar of lugares.lugares) {
      if (lugar.tipo !== 'cartao') continue
      const verbete = verbeteDoCartao(verbetes, lugar.nome)
      const titulo = verbete?.titulo || 'Sem nome'
      if (verbete === undefined || vistos.has(verbete.id)) continue
      vistos.add(verbete.id)
      lista.push({ formaId: lugar.formaId, titulo })
    }
    return lista.sort((a, b) => compararTitulos(a.titulo, b.titulo))
  }, [lugares, verbetes])

  return (
    <Dialogo aberto titulo="Citar o quadro" onFechar={aoFechar} descricao="A citação guarda o endereço, não uma cópia: renomear o quadro ou a moldura não a quebra. No texto, um clique abre o quadro nesse ponto.">
      {lista.t === 'falhou' ? (
        <p className="pr-aviso" role="alert">
          {lista.aviso}
        </p>
      ) : lista.t !== 'pronta' ? (
        <p className="pr-quieto">Lendo os quadros…</p>
      ) : quadro === undefined ? (
        <p className="pr-quieto">Nenhum quadro nesta campanha ainda. Crie um em Quadros, ou na aba Quadro da sessão.</p>
      ) : (
        <div className="pr-mesa-escolha">
          <label className="pr-campo">
            <span className="pr-campo__rotulo">Quadro</span>
            <select className="pr-campo__entrada" value={quadro.id} onChange={(evento) => setEscolhido(evento.target.value)}>
              {quadros.map((cada) => (
                <option key={cada.id} value={cada.id}>
                  {(cada.nome || 'Quadro sem nome') + (cada.sessaoId !== null && cada.sessaoId === sessaoDoTexto ? ' (desta sessão)' : '')}
                </option>
              ))}
            </select>
          </label>
          <ul className="pr-escolha" aria-label="Citar">
            <li>
              <button type="button" className="pr-escolha__item" onClick={() => aoEscolher({ quadroId: quadro.id, formaId: null }, nomeDoQuadro)}>
                <span>O quadro inteiro</span>
                <span className="pr-escolha__detalhe">{nomeDoQuadro}</span>
              </button>
            </li>
            {lugares.t === 'lendo' ? (
              <li className="pr-quieto pr-mesa-escolha__nota">Lendo as molduras e os cartões…</li>
            ) : lugares.t === 'falhou' ? (
              <li className="pr-aviso pr-mesa-escolha__nota" role="alert">
                Não deu para ler este quadro: {lugares.motivo}
              </li>
            ) : molduras.length === 0 && cartoes.length === 0 ? (
              <li className="pr-quieto pr-mesa-escolha__nota">Este quadro ainda não tem molduras nem cartões. Uma moldura (tecla F no quadro) agrupa uma cena.</li>
            ) : (
              <>
                {molduras.map((moldura) => (
                  <li key={moldura.formaId}>
                    <button type="button" className="pr-escolha__item" onClick={() => aoEscolher({ quadroId: quadro.id, formaId: moldura.formaId }, moldura.nome || `${nomeDoQuadro}, moldura`)}>
                      <span>{moldura.nome || 'Moldura sem nome'}</span>
                      <span className="pr-escolha__detalhe">Moldura</span>
                    </button>
                  </li>
                ))}
                {cartoes.map((cartao) => (
                  <li key={cartao.formaId}>
                    <button type="button" className="pr-escolha__item" onClick={() => aoEscolher({ quadroId: quadro.id, formaId: cartao.formaId }, cartao.titulo)}>
                      <span>{cartao.titulo}</span>
                      <span className="pr-escolha__detalhe">Cartão</span>
                    </button>
                  </li>
                ))}
              </>
            )}
          </ul>
        </div>
      )}
    </Dialogo>
  )
}
