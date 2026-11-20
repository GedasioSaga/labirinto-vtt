/**
 * O CARTÃO DO DESFECHO (o `htmlResultadoPz` do protótipo v2): por cima do
 * quadro, depois que a porta abre (Cena) ou logo (Texto). Mostra o texto do
 * mestre a todos e os ganhos só a quem os ganhou: quem não resolveu lê
 * "Resolvido por Bento" e nada mais.
 */
import { useEffect, useId, useRef } from 'react'
import { useImagemDaMesa } from '../../components/ImagemDaMesa'
import { moedasLabel } from '../../lib/troca'
import { IconeDoJogador } from '../IconeDoJogador'
import type { DesfechoNaTela, GanhoNaTela, TesteNaTela } from './tipos'

interface PropsDoCartao {
  titulo: string
  desfecho: DesfechoNaTela
  eu: string
  onContinuar: () => void
  /** O "Testar como jogador": o cartão "Resolvido no teste", com o que o jogo daria e nada entregue. */
  teste?: TesteNaTela
  /** No teste, o "Voltar ao editor". */
  onVoltar?: () => void
}

export function CartaoDoDesfecho({ titulo, desfecho, eu, onContinuar, teste, onVoltar }: PropsDoCartao) {
  const idDoTitulo = useId()
  const continuar = useRef<HTMLButtonElement>(null)
  // O foco vai ao "Continuar": Enter fecha, e o leitor de tela lê o cartão.
  useEffect(() => {
    continuar.current?.focus({ preventScroll: true })
  }, [])

  if (teste !== undefined) return <CartaoDoTeste titulo={titulo} texto={desfecho.texto} teste={teste} onVoltar={onVoltar ?? onContinuar} />

  const outro = desfecho.por !== '' && desfecho.por !== eu
  const ganhouAlgo = desfecho.itens.length > 0 || desfecho.moedas > 0
  return (
    <>
      <div className="tpz-veu" aria-hidden="true" />
      <div className="tpz-cartao" role="dialog" aria-labelledby={idDoTitulo}>
        <p className="tpz-cartao__selo">Resolvido</p>
        <h2 id={idDoTitulo}>{titulo}</h2>
        {outro && <p className="tpz-cartao__por">Resolvido por {desfecho.por}.</p>}
        {desfecho.texto.trim() !== '' && <p className="tpz-cartao__texto">{desfecho.texto}</p>}
        {desfecho.abriuPorta && <p className="tpz-cartao__porta">A porta se abriu no mapa.</p>}
        {ganhouAlgo && (
          <div className="tpz-cartao__itens">
            <p>Foi para o inventário de {eu}</p>
            <ul>
              {desfecho.itens.map((item, i) => (
                <ItemGanho key={`${item.nome}-${i}`} item={item} />
              ))}
              {desfecho.moedas > 0 && <li className="tpz-cartao__moedas">{moedasLabel(desfecho.moedas)}</li>}
            </ul>
          </div>
        )}
        {desfecho.documentos.map((documento, i) => (
          <div key={`${documento.titulo}-${i}`} className="tpz-cartao__doc">
            <span className="tpz-mini-papel" aria-hidden="true" />
            <p>
              <b>{documento.titulo}</b>
              {documento.novo ? 'Documento novo, guardado em Documentos.' : 'Você já tinha este documento.'}
            </p>
          </div>
        ))}
        <button ref={continuar} type="button" className="tpz-bt tpz-bt--primario" onClick={onContinuar}>
          Continuar
        </button>
      </div>
    </>
  )
}

/**
 * O cartão do teste (o `htmlResultadoPz` do v2 no modo teste): o texto do
 * mestre e o que o jogo entregaria, com "Aqui nada foi entregue". O foco vai ao
 * "Recomeçar o teste", a ação mais provável de quem está testando.
 */
function CartaoDoTeste({ titulo, texto, teste, onVoltar }: { titulo: string; texto: string; teste: TesteNaTela; onVoltar: () => void }) {
  const idDoTitulo = useId()
  const recomecar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    recomecar.current?.focus({ preventScroll: true })
  }, [])
  return (
    <>
      <div className="tpz-veu" aria-hidden="true" />
      <div className="tpz-cartao" role="dialog" aria-labelledby={idDoTitulo}>
        <p className="tpz-cartao__selo">Resolvido no teste</p>
        <h2 id={idDoTitulo}>{titulo}</h2>
        {texto.trim() !== '' && <p className="tpz-cartao__texto">{texto}</p>}
        <p className="tpz-cartao__teste">
          No jogo, quem resolver recebe <GanhosDoTeste ganhos={teste.ganhos} />
          {teste.porta !== null && (
            <>
              , e abre a <b>{teste.porta}</b>
            </>
          )}
          . <b>Aqui nada foi entregue.</b>
        </p>
        <div className="tpz-cartao__acoes">
          <button ref={recomecar} type="button" className="tpz-bt tpz-bt--primario" onClick={teste.onRecomecar}>
            Recomeçar o teste
          </button>
          <button type="button" className="tpz-bt" onClick={onVoltar}>
            Voltar ao editor
          </button>
        </div>
      </div>
    </>
  )
}

/** "<b>Chave</b>, <b>30 moedas</b>"; nada = "nada (o mestre não pôs itens nem documento)", como no v2. */
function GanhosDoTeste({ ganhos }: { ganhos: readonly string[] }) {
  if (ganhos.length === 0) {
    return (
      <>
        <b>nada</b> (o mestre não pôs itens nem documento)
      </>
    )
  }
  return (
    <>
      {ganhos.map((ganho, i) => (
        <span key={`${ganho}-${i}`}>
          {i > 0 && ', '}
          <b>{ganho}</b>
        </span>
      ))}
    </>
  )
}

function ItemGanho({ item }: { item: GanhoNaTela }) {
  const src = useImagemDaMesa()(item.imagem)
  return (
    <li>
      {src !== null ? <img src={src} alt="" draggable={false} /> : <IconeDoJogador nome="mochila" />}
      {item.nome}
      {item.quantidade > 1 && <span className="tpz-cartao__qtd">×{item.quantidade}</span>}
    </li>
  )
}
