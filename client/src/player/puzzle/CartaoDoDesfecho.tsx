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
import type { DesfechoNaTela, GanhoNaTela } from './tipos'

interface PropsDoCartao {
  titulo: string
  desfecho: DesfechoNaTela
  eu: string
  onContinuar: () => void
}

export function CartaoDoDesfecho({ titulo, desfecho, eu, onContinuar }: PropsDoCartao) {
  const idDoTitulo = useId()
  const continuar = useRef<HTMLButtonElement>(null)
  // O foco vai ao "Continuar": Enter fecha, e o leitor de tela lê o cartão.
  useEffect(() => {
    continuar.current?.focus({ preventScroll: true })
  }, [])

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
