import { useState } from 'react'
import { Botao } from '../../grimorio/Botao'
import { CampoFaixa } from '../../grimorio/CampoFaixa'
import { PESO_MAX, PESO_MIN, PESOS_MAX, type TrocaDePeso } from '../../../puzzles/tipos'
import { comTroca, limitar } from '../edicao'
import type { PecasDoEditor } from '../pecasDoEditor'
import { EscolhaDeItem, NumeroDoCampo, Secao, SeletorDePeca, type PropsDaSecao, type UsarPeca } from './comum'

/**
 * TROCA DE PESO (v1: o pedestal e a bandeja): a peça guardada sai do pedestal
 * quando a bandeja pesa o pedido. O peso mora no puzzle, e não no item (§6,
 * decisão 5), então as pedras são escolhidas aqui, cada uma com o seu peso.
 */
export function SecaoTroca({ puzzle, mudar, pecas, usarPeca }: PropsDaSecao & { pecas: PecasDoEditor; usarPeca: UsarPeca }) {
  const [escolhendo, setEscolhendo] = useState(false)
  const { troca } = puzzle
  const mudarTroca = (mudanca: (atual: TrocaDePeso) => TrocaDePeso, chave?: string) =>
    mudar((atual) => (atual.troca === null ? atual : { ...atual, troca: mudanca(atual.troca) }), chave)
  const pesos = troca === null ? [] : Object.entries(troca.pesos)
  return (
    <Secao titulo="Troca de peso">
      <label className="gr-campo">
        <span className="gr-campo__rot">Peça guardada no pedestal</span>
        <SeletorDePeca
          pecas={pecas}
          valor={troca?.guarda ?? null}
          vazio="Sem troca de peso"
          rotulo="Peça guardada no pedestal"
          onEscolher={(peca) => {
            if (peca === null) {
              mudar((atual) => comTroca(atual, null))
              return
            }
            void usarPeca(peca).then((itemId) => {
              if (itemId !== null) mudar((atual) => comTroca(atual, itemId))
            })
          }}
        />
      </label>
      {troca === null ? (
        <p className="pze-nota">Com uma peça no pedestal, aparece a bandeja: quem acerta o peso e aperta “Trocar” leva a peça.</p>
      ) : (
        <>
          <label className="gr-campo">
            <span className="gr-campo__rot">O pedestal pede o peso</span>
            <NumeroDoCampo valor={troca.peso} min={PESO_MIN} max={PESO_MAX} rotulo="Peso pedido" onChange={(peso) => mudarTroca((atual) => ({ ...atual, peso }), 'troca:peso')} />
          </label>
          <div className="gr-campo">
            <span className="gr-campo__rot">Pedras com peso {pesos.length > 0 && <small>{pesos.length}</small>}</span>
            {pesos.length === 0 ? (
              <p className="pze-vazio">Nenhuma pedra. Sem pedra com peso, a bandeja não aceita nada.</p>
            ) : (
              <ul className="pze-lista-itens">
                {pesos.map(([itemId, peso]) => {
                  const nome = pecas.porId(itemId)?.nome ?? 'Item apagado do acervo'
                  return (
                    <li key={itemId}>
                      <span className="pze-lista-itens__nome">{nome}</span>
                      <NumeroDoCampo valor={peso} min={PESO_MIN} max={PESO_MAX} rotulo={`Peso de ${nome}`} onChange={(novo) => mudarTroca((atual) => ({ ...atual, pesos: { ...atual.pesos, [itemId]: novo } }), `troca:pedra:${itemId}`)} />
                      <button
                        type="button"
                        className="pze-bt-ico"
                        aria-label={`Tirar ${nome} da troca`}
                        onClick={() => mudarTroca((atual) => ({ ...atual, pesos: Object.fromEntries(Object.entries(atual.pesos).filter(([id]) => id !== itemId)) }))}
                      >
                        ×
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {pesos.length < PESOS_MAX && (
              <Botao tamanho="p" largo aria-haspopup="dialog" aria-expanded={escolhendo} onClick={() => setEscolhendo((antes) => !antes)}>
                + Pedra do acervo
              </Botao>
            )}
            {escolhendo && (
              <EscolhaDeItem
                verbo="põe na troca"
                aoFechar={() => setEscolhendo(false)}
                aoEscolher={(item) => {
                  mudarTroca((atual) => (item.id in atual.pesos ? atual : { ...atual, pesos: { ...atual.pesos, [item.id]: PESO_MIN } }))
                  setEscolhendo(false)
                }}
              />
            )}
          </div>
          <CampoFaixa rotulo="Lugar na imagem, da esquerda" valor={troca.x} min={0} max={100} unidade="%" onChange={(x) => mudarTroca((atual) => ({ ...atual, x: limitar(x, 0, 100) }), 'troca:x')} />
          <CampoFaixa rotulo="Lugar na imagem, de cima" valor={troca.y} min={0} max={100} unidade="%" onChange={(y) => mudarTroca((atual) => ({ ...atual, y: limitar(y, 0, 100) }), 'troca:y')} />
        </>
      )}
    </Secao>
  )
}
