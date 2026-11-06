import { useId, useState, type FormEvent } from 'react'
import { quantidadeDe } from '../../lib/items'
import { paraJson } from '../../lib/nuvem/json'
import type { Mudanca } from '../../lib/nuvem/tipos'
import { MOEDAS_MAX } from '../../lib/troca'
import type { CarriedItem } from '../../types/map'
import type { EstadoDaCampanha, FichaDoSite } from '../dados/sessaoDaCampanha'
import { useSite } from './contexto'
import { enviarMudancas, revDeAgora, textoDaFalha } from './enviar'
import { Icone } from './Icone'
import { iniciais, tomDe } from './textos'

/**
 * A MOCHILA (protótipo, tela 6): as moedas e os itens que o personagem
 * carrega, a mesma em todos os mapas da campanha. Cada toque é UMA mudança:
 * "+1 Poção" vira um `somar` em `['mochila', vaga, 'quantidade']`, nunca a
 * mochila inteira. Na ficha de um colega, só lê.
 */

const NOME_DO_ITEM_MAX = 80
const QUANTIDADE_MAX = 9999

interface PainelProps {
  campanha: EstadoDaCampanha
  ficha: FichaDoSite
}

/** "1.234" do campo de moedas, ou com espaço, vira 1234; o resto é `null`. */
function lerInteiro(texto: string): number | null {
  const limpo = texto.replace(/[.\s]/g, '')
  return /^\d+$/.test(limpo) ? Number(limpo) : null
}

function novaVaga(): string {
  return `vaga_${crypto.randomUUID()}`
}

export function PainelMochila({ campanha, ficha }: PainelProps) {
  const site = useSite()
  const tituloId = useId()
  const pode = ficha.ehMinha
  const travado = campanha.conexao !== 'em-dia'
  const [erro, setErro] = useState<string | null>(null)
  const [porItem, setPorItem] = useState(false)
  const itens = ficha.doc.mochila ?? []
  const moedas = ficha.doc.moedas ?? 0
  const fichaId = ficha.doc.id

  function mandar(mudanca: Mudanca) {
    const baseRev = revDeAgora(site)
    if (baseRev === null) return
    setErro(null)
    void enviarMudancas(site, [mudanca], baseRev).then((resultado) => {
      if (!resultado.ok) setErro(textoDaFalha(resultado))
    })
  }

  const somarItem = (item: CarriedItem, delta: number) => mandar({ fichaId, caminho: ['mochila', item.id, 'quantidade'], acao: 'somar', delta })
  const tirarItem = (item: CarriedItem) => mandar({ fichaId, caminho: ['mochila', item.id], acao: 'apagar' })
  const somarMoedas = (delta: number) => mandar({ fichaId, caminho: ['moedas'], acao: 'somar', delta })

  return (
    <section aria-labelledby={tituloId}>
      <div className="lo-painel__cab">
        <h2 className="lo-painel__titulo" id={tituloId}>
          Mochila
        </h2>
        <p className="lo-nota-mapas">
          <Icone nome="mapas" /> A mesma mochila em todos os mapas da campanha
        </p>
      </div>
      <div className="lo-moedas">
        <span className="lo-moedas__sinal">
          <Icone nome="moeda" />
        </span>
        <div>
          <p className="lo-moedas__nome">Moedas</p>
          {pode ? <p className="lo-motivo">Digite o total ou use − e +.</p> : <p className="lo-moedas__ler">{moedas.toLocaleString('pt-BR')}</p>}
        </div>
        {pode && <PassoDeMoedas key={moedas} moedas={moedas} travado={travado} aoSomar={somarMoedas} />}
      </div>
      <ul className="lo-itens" aria-label="Itens">
        {itens.length === 0 ? (
          <li className="lo-vazio">{pode ? 'A mochila está vazia. Use Pôr item para guardar a primeira coisa.' : 'A mochila está vazia.'}</li>
        ) : (
          itens.map((item) => <LinhaDoItem key={item.id} item={item} pode={pode} travado={travado} aoSomar={somarItem} aoTirar={tirarItem} />)
        )}
      </ul>
      {erro !== null && (
        <p className="lo-erro-campo" role="alert">
          {erro}
        </p>
      )}
      {pode &&
        (porItem ? (
          <PorItem
            travado={travado}
            aoPor={(nome, quantidade) => {
              const item: CarriedItem = quantidade === 1 ? { id: novaVaga(), nome } : { id: novaVaga(), nome, quantidade }
              mandar({ fichaId, caminho: ['mochila', item.id], acao: 'criar', valor: paraJson(item) })
              setPorItem(false)
            }}
            aoCancelar={() => setPorItem(false)}
          />
        ) : (
          <div className="lo-mochila__pe">
            <button type="button" className="lo-btn" onClick={() => setPorItem(true)} disabled={travado}>
              <Icone nome="mais" /> Pôr item
            </button>
            {travado && <span className="lo-motivo">Sem internet: volta quando a conexão voltar.</span>}
          </div>
        ))}
    </section>
  )
}

function LinhaDoItem({
  item,
  pode,
  travado,
  aoSomar,
  aoTirar,
}: {
  item: CarriedItem
  pode: boolean
  travado: boolean
  aoSomar: (item: CarriedItem, delta: number) => void
  aoTirar: (item: CarriedItem) => void
}) {
  const quantidade = quantidadeDe(item)
  return (
    <li className="lo-item">
      <span className="lo-vaga" data-tom={tomDe(item.itemId ?? item.nome)} aria-hidden="true">
        {iniciais(item.nome)}
        <span className="lo-vaga__qtd">{quantidade}</span>
      </span>
      <div className="lo-item__texto">
        <p className="lo-item__nome">{item.nome}</p>
        {item.descricao !== undefined && item.descricao !== '' && <p className="lo-item__desc">{item.descricao}</p>}
      </div>
      {pode ? (
        <div className="lo-qtd">
          {quantidade <= 1 ? (
            <button type="button" className="lo-btn lo-btn--icone lo-btn--tirar" aria-label={`Tirar ${item.nome} da mochila`} title="Tirar da mochila" disabled={travado} onClick={() => aoTirar(item)}>
              <Icone nome="tirar" />
            </button>
          ) : (
            <button type="button" className="lo-btn lo-btn--icone" aria-label={`Tirar 1 ${item.nome}`} disabled={travado} onClick={() => aoSomar(item, -1)}>
              <Icone nome="menos" />
            </button>
          )}
          <output aria-label={`Quantidade de ${item.nome}`}>{quantidade}</output>
          <button type="button" className="lo-btn lo-btn--icone" aria-label={`Pôr 1 ${item.nome}`} disabled={travado || quantidade >= QUANTIDADE_MAX} onClick={() => aoSomar(item, 1)}>
            <Icone nome="mais" />
          </button>
        </div>
      ) : (
        <span className="lo-moedas__nome">x{quantidade}</span>
      )}
    </li>
  )
}

/** − total +: o total digitado vale no Enter ou ao sair do campo (vira a diferença, como no app). */
function PassoDeMoedas({ moedas, travado, aoSomar }: { moedas: number; travado: boolean; aoSomar: (delta: number) => void }) {
  const erroId = useId()
  const [texto, setTexto] = useState(String(moedas))
  const [erro, setErro] = useState<string | null>(null)

  function confirmar() {
    const total = lerInteiro(texto)
    if (total === null || total > MOEDAS_MAX) {
      setErro(`Use um número inteiro de 0 a ${MOEDAS_MAX.toLocaleString('pt-BR')}.`)
      return
    }
    setErro(null)
    if (total !== moedas) aoSomar(total - moedas)
  }

  return (
    <>
      <div className="lo-passo">
        <button type="button" className="lo-btn lo-btn--icone" aria-label="Tirar 1 moeda" disabled={travado || moedas <= 0} onClick={() => aoSomar(-1)}>
          <Icone nome="menos" />
        </button>
        <input
          className="lo-numero"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label="Moedas"
          value={texto}
          disabled={travado}
          aria-invalid={erro !== null ? true : undefined}
          aria-describedby={erro !== null ? erroId : undefined}
          onChange={(evento) => setTexto(evento.target.value)}
          onBlur={confirmar}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter') confirmar()
            if (evento.key === 'Escape') {
              setTexto(String(moedas))
              setErro(null)
            }
          }}
        />
        <button type="button" className="lo-btn lo-btn--icone" aria-label="Pôr 1 moeda" disabled={travado || moedas >= MOEDAS_MAX} onClick={() => aoSomar(1)}>
          <Icone nome="mais" />
        </button>
      </div>
      {erro !== null && (
        <p className="lo-erro-campo lo-moedas__erro" id={erroId}>
          {erro}
        </p>
      )}
    </>
  )
}

function PorItem({ travado, aoPor, aoCancelar }: { travado: boolean; aoPor: (nome: string, quantidade: number) => void; aoCancelar: () => void }) {
  const nomeId = useId()
  const qtdId = useId()
  const [erro, setErro] = useState<string | null>(null)

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const dados = new FormData(evento.currentTarget)
    const nome = String(dados.get('nome') ?? '').trim()
    const quantidade = lerInteiro(String(dados.get('qtd') ?? ''))
    if (nome === '') {
      setErro('Dê um nome ao item.')
      return
    }
    if (quantidade === null || quantidade < 1 || quantidade > QUANTIDADE_MAX) {
      setErro(`A quantidade vai de 1 a ${QUANTIDADE_MAX.toLocaleString('pt-BR')}.`)
      return
    }
    aoPor(nome, quantidade)
  }

  return (
    <form
      className="lo-por"
      aria-label="Pôr item na mochila"
      onSubmit={enviar}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') aoCancelar()
      }}
    >
      <div className="lo-campo">
        <label htmlFor={nomeId}>Nome do item</label>
        <input className="lo-texto" id={nomeId} name="nome" maxLength={NOME_DO_ITEM_MAX} required autoComplete="off" autoFocus />
      </div>
      <div className="lo-campo">
        <label htmlFor={qtdId}>Quantidade</label>
        <input className="lo-texto" id={qtdId} name="qtd" inputMode="numeric" defaultValue="1" autoComplete="off" />
      </div>
      <div className="lo-por__acoes">
        <button type="submit" className="lo-btn lo-btn--primario" disabled={travado}>
          Pôr na mochila
        </button>
        <button type="button" className="lo-btn" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
      {erro !== null && (
        <p className="lo-erro-campo lo-por__erro" role="alert">
          {erro}
        </p>
      )}
    </form>
  )
}
