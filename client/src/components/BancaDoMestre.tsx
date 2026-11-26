import { useId, useMemo, useState } from 'react'
import { quantidadeDe } from '../lib/items'
import { precoEmBerries, precoEmMoedas, textoDoPrecoDaBanca } from '../lib/loja'
import { acervoDaMochila, precoNoAcervo } from '../lib/mochila/acervoDaMochila'
import { ehRecusa, mochilaDesfeita } from '../lib/mochila/armaNaMochila'
import { comprarNaBanca, desfazerCompra, lojaComEstoque, precoDaBancaPara, precoDeVenda, venderABanca } from '../lib/mochila/banca'
import { fichaComMochila } from '../lib/mochila/juncao'
import type { Personagem } from '../lib/personagem'
import { moedasDe } from '../lib/troca'
import { useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import { mochilaMoraNaFicha, personagensAtivos, useAdventureStore } from '../stores/adventureStore'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import type { LojaItem } from '../types/map'
import './BancaDoMestre.css'

/**
 * A BANCA DO MESTRE (docs/design/itens-rework/PLANO.md, etapa E3; protótipo, tela Loja): o mestre
 * escolhe quem compra e compra pela ficha, ou vende à banca. O preço que aparece é o cobrado:
 * comprar tira os berries e põe o item na mochila, com Desfazer; vender dá metade do preço da banca;
 * a arma equipada precisa ser guardada antes. O estoque do pino muda junto (o da mercadoria com conta).
 * O "Quero" do jogador continua chegando nos Pedidos, como antes.
 */

export interface BancaDoMestreProps {
  pinId: string
}

/** O teto do "quantos" de uma compra: o estoque da banca ou, sem conta, uma pilha grande. */
const COMPRA_SEM_ESTOQUE_MAX = 99

const SEM_LOJA: readonly LojaItem[] = []

/** A ficha de AGORA (o Desfazer vem depois, e outra mudança pode ter entrado no meio). */
function fichaDeAgora(personagemId: string): Personagem | undefined {
  return personagensAtivos(useAdventureStore.getState()).find((personagem) => personagem.id === personagemId)
}

/** O estoque da mercadoria muda no pino de agora (sem conta de estoque: nada muda). */
function mudarEstoque(pinId: string, mercadoriaId: string, delta: number): void {
  const loja = useMapStore.getState().map.pins.find((pin) => pin.id === pinId)?.loja
  if (loja === undefined) return
  const nova = lojaComEstoque(loja, mercadoriaId, delta)
  if (nova.some((mercadoria, i) => mercadoria !== loja[i])) useMapStore.getState().updatePin(pinId, { loja: nova })
}

export function BancaDoMestre({ pinId }: BancaDoMestreProps) {
  const idBase = useId()
  const loja = useMapStore((state) => state.map.pins.find((pin) => pin.id === pinId)?.loja) ?? SEM_LOJA
  const fichas = useAdventureStore(personagensAtivos)
  // Antes da migração a mochila mora no boneco: comprar pela ficha poria o item onde ninguém vê. Lá vale só o "Quero".
  const mochilaNaFicha = useAdventureStore(mochilaMoraNaFicha)
  const jogadores = useMemo(() => fichas.filter((ficha) => ficha.tipo === 'jogador'), [fichas])
  const doAcervo = useAcervoDeItensStore((state) => state.itens)
  const acervo = useMemo(() => acervoDaMochila(doAcervo), [doAcervo])
  const precoDoAcervo = useMemo(() => precoNoAcervo(doAcervo), [doAcervo])
  const [quemId, setQuemId] = useState<string | null>(null)
  const [quantos, setQuantos] = useState<Readonly<Record<string, number>>>({})
  const quem = jogadores.find((ficha) => ficha.id === quemId) ?? jogadores[0]
  const aVenda = loja.filter((mercadoria) => mercadoria.nome.trim() !== '')

  if (!mochilaNaFicha || jogadores.length === 0 || aVenda.length === 0) return null
  const moedas = quem === undefined ? 0 : moedasDe(quem)

  const comprar = (mercadoria: LojaItem, quantidade: number) => {
    if (quem === undefined) return
    const agora = fichaDeAgora(quem.id)
    if (agora === undefined) return
    const compra = comprarNaBanca(agora, mercadoria, quantidade, () => `item_${crypto.randomUUID()}`)
    if (ehRecusa(compra)) {
      useToastStore.getState().push('error', compra.recusa)
      return
    }
    if (!useAdventureStore.getState().ajustarPersonagem(agora.id, () => compra.personagem)) {
      useToastStore.getState().push('error', `Não deu para gravar a ficha de ${agora.nome}.`)
      return
    }
    mudarEstoque(pinId, mercadoria.id, -compra.entraram)
    setQuantos((atual) => ({ ...atual, [mercadoria.id]: 1 }))
    const antes = moedasDe(agora)
    const desfazer = () => {
      if (useAdventureStore.getState().ajustarPersonagem(agora.id, (atual) => desfazerCompra(atual, compra))) mudarEstoque(pinId, mercadoria.id, compra.entraram)
    }
    useToastStore
      .getState()
      .push('info', `${agora.nome} comprou ${compra.entraram} ${mercadoria.nome.trim()} por ${precoEmBerries(compra.pago)} (${antes.toLocaleString('pt-BR')} → ${(antes - compra.pago).toLocaleString('pt-BR')}). Já está na mochila.`, undefined, {
        actions: [{ label: 'Desfazer', run: desfazer }],
      })
  }

  const vender = (vagaId: string) => {
    if (quem === undefined) return
    const agora = fichaDeAgora(quem.id)
    if (agora === undefined) return
    const venda = venderABanca(agora, vagaId, loja, acervo, precoDoAcervo, `item_${crypto.randomUUID()}`)
    if (ehRecusa(venda)) {
      useToastStore.getState().push('error', venda.recusa)
      return
    }
    if (!useAdventureStore.getState().ajustarPersonagem(agora.id, () => venda.personagem)) {
      useToastStore.getState().push('error', `Não deu para gravar a ficha de ${agora.nome}.`)
      return
    }
    if (venda.mercadoriaId !== null) mudarEstoque(pinId, venda.mercadoriaId, 1)
    const nome = (agora.mochila ?? []).find((vaga) => vaga.id === vagaId)?.nome ?? 'o item'
    const mochilaAntes = agora.mochila ?? []
    const mochilaDepois = venda.personagem.mochila ?? []
    const desfazer = () => {
      const voltou = useAdventureStore
        .getState()
        .ajustarPersonagem(agora.id, (atual) => fichaComMochila(atual, mochilaDesfeita(atual.mochila ?? [], mochilaAntes, mochilaDepois), Math.max(0, moedasDe(atual) - venda.recebeu)))
      if (voltou && venda.mercadoriaId !== null) mudarEstoque(pinId, venda.mercadoriaId, -1)
    }
    const balas = venda.devolvidas > 0 ? ` As ${venda.devolvidas} balas do pente voltaram para a mochila.` : ''
    useToastStore.getState().push('info', `${agora.nome} vendeu 1 ${nome} por ${precoEmBerries(venda.recebeu)}.${balas}`, undefined, { actions: [{ label: 'Desfazer', run: desfazer }] })
  }

  const vendaveis = (quem?.mochila ?? []).flatMap((vaga) => {
    const preco = precoDaBancaPara(vaga, loja, precoDoAcervo)
    return preco === null || preco <= 0 ? [] : [{ vaga, paga: precoDeVenda(preco) }]
  })

  return (
    <section className="lb-banca" aria-labelledby={`${idBase}-titulo`}>
      <h3 id={`${idBase}-titulo`} className="lb-label">
        Comprar e vender pela ficha
      </h3>
      <p className="lb-banca__dica">O preço que aparece é o cobrado: comprar tira os berries e põe o item na mochila, com Desfazer. A banca paga metade do preço dela.</p>
      <div className="lb-banca__quem" role="group" aria-label="Quem compra">
        {jogadores.map((ficha) => (
          <button key={ficha.id} type="button" className="lb-btn lb-btn--compact" aria-pressed={ficha.id === quem?.id} onClick={() => setQuemId(ficha.id)}>
            {ficha.nome || 'Sem nome'} <span className="lb-banca__num">{moedasDe(ficha).toLocaleString('pt-BR')}</span>
          </button>
        ))}
      </div>
      <ul className="lb-banca__lista" aria-label="O que a banca vende">
        {aVenda.map((mercadoria) => {
          const preco = precoEmMoedas(mercadoria)
          const teto = Math.max(1, mercadoria.estoque ?? COMPRA_SEM_ESTOQUE_MAX)
          const q = Math.min(Math.max(quantos[mercadoria.id] ?? 1, 1), teto)
          const total = preco === null ? null : preco * q
          const motivo =
            preco === null ? 'Sem preço em berries' : mercadoria.estoque === 0 ? 'Acabou na banca' : total !== null && total > moedas ? `Faltam ${precoEmBerries(total - moedas)}` : null
          const mudarQ = (delta: number) => setQuantos((atual) => ({ ...atual, [mercadoria.id]: Math.min(Math.max(q + delta, 1), teto) }))
          return (
            <li key={mercadoria.id} className="lb-banca__linha">
              <span className="lb-banca__nome">
                <strong>{mercadoria.nome.trim()}</strong>
                <small>
                  {textoDoPrecoDaBanca(preco)}
                  {mercadoria.estoque !== undefined && ` · ${mercadoria.estoque} na banca`}
                </small>
              </span>
              <span className="lb-inv-mestre__qtd">
                <button type="button" className="lb-btn lb-btn--compact" aria-label={`Um a menos de ${mercadoria.nome.trim()}`} disabled={q <= 1} onClick={() => mudarQ(-1)}>
                  −
                </button>
                <span className="lb-banca__num" aria-label={`Quantos ${mercadoria.nome.trim()}`}>
                  {q}
                </span>
                <button type="button" className="lb-btn lb-btn--compact" aria-label={`Um a mais de ${mercadoria.nome.trim()}`} disabled={q >= teto} onClick={() => mudarQ(1)}>
                  +
                </button>
              </span>
              <span className="lb-banca__comprar">
                <b className="lb-banca__num">{total === null ? '—' : precoEmBerries(total)}</b>
                <button type="button" className="lb-btn lb-btn--primary lb-btn--compact" disabled={motivo !== null} onClick={() => comprar(mercadoria, q)}>
                  Comprar
                </button>
                <small className={motivo === null ? 'lb-banca__dica' : 'lb-field__error'}>{motivo ?? `Fica com ${(moedas - (total ?? 0)).toLocaleString('pt-BR')}`}</small>
              </span>
            </li>
          )
        })}
      </ul>
      <h4 className="lb-label">Vender à banca</h4>
      {vendaveis.length === 0 ? (
        <p className="lb-banca__dica">Nada com preço na mochila de {quem?.nome || 'quem compra'}.</p>
      ) : (
        <ul className="lb-banca__lista" aria-label="Vender à banca">
          {vendaveis.map(({ vaga, paga }) => (
            <li key={vaga.id} className="lb-banca__linha lb-banca__linha--venda">
              <span className="lb-banca__nome">
                <strong>{vaga.nome}</strong>
                <small>
                  {quantidadeDe(vaga) > 1 && `×${quantidadeDe(vaga)}`}
                  {vaga.equipado === true && ' (equipado)'}
                </small>
              </span>
              {/* A equipada não fica apagada: o clique diz o que fazer ("Guarde antes de vender", decisão 16). */}
              <button type="button" className="lb-btn lb-btn--compact" title={vaga.equipado === true ? `Guarde ${vaga.nome} antes de vender.` : undefined} onClick={() => vender(vaga.id)}>
                Vender 1 por {precoEmBerries(paga)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
