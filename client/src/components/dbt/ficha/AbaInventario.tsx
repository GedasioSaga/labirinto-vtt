import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { ITENS } from '../../../lib/dbt/dados/itens'
import { LIMITES_DBT, novoIdDBT, type ItemDBT, type ItemDaFichaDBT } from '../../../lib/dbt/modelo'
import { nomeNormalizado } from '../../../lib/dbt/regras/tecnicas'
import { useFichaDBT } from './contexto'
import { BarraDeUso, Interruptor, Stepper, TextoQueAbre, inteiroDoCampo } from './pecas'

/**
 * Aba Inventário: a carga em slots (5 + FOR × 5), os itens com quantidade e
 * "equipado" (armadura equipada soma na CA), os do livro e os livres. Fora da
 * edição, a mochila do token (inventário da mesa) aparece embaixo.
 */
const QUANTIDADE_MAX = 999
const CARGA_MAX = 99

export function AbaInventario({ mochila }: { mochila?: ReactNode }) {
  const { ficha, derivados, editando } = useFichaDBT()
  const itens = ficha.inventario
  const sobra = derivados.carga.valor - derivados.cargaUsada
  return (
    <>
      <div className="dbf-ph">
        <h3 className="dbf-ph__t">Inventário</h3>
      </div>
      <BarraDeUso
        usado={derivados.cargaUsada}
        total={derivados.carga.valor}
        rotulo="Carga em slots"
        dica={{ titulo: 'Carga', conta: derivados.carga.formula }}
        mensagem={sobra < 0 ? `Sobrecarregado: ${-sobra} slots acima. Tire ou largue algo.` : `Cabem mais ${sobra} slots.`}
      />
      {itens.length === 0 ? (
        <div className="dbf-vazio">
          <p>{editando ? 'Mochila vazia. Pegue um item do livro aqui embaixo ou escreva um livre.' : 'Mochila vazia. Em Editar, pegue um item do livro ou escreva um livre.'}</p>
        </div>
      ) : (
        <div className="dbf-sec">
          {itens.map((item) => (
            <LinhaDoItem key={item.id} item={item} />
          ))}
        </div>
      )}
      {editando && <ItensDoLivro />}
      {editando && <ItemLivre />}
      {mochila !== undefined && mochila !== null && (
        <div className="dbf-sec">
          <h4 className="dbf-sec__t">Mochila do token</h4>
          {mochila}
        </div>
      )}
    </>
  )
}

function LinhaDoItem({ item }: { item: ItemDaFichaDBT }) {
  const { editando, mudarFicha } = useFichaDBT()
  const trocar = (mudanca: Partial<ItemDaFichaDBT>) => mudarFicha((f) => ({ ...f, inventario: f.inventario.map((i) => (i.id === item.id ? { ...i, ...mudanca } : i)) }))
  const tirar = () => mudarFicha((f) => ({ ...f, inventario: f.inventario.filter((i) => i.id !== item.id) }))
  const armadura = item.bonusCA > 0 || item.kiPorTurno > 0
  return (
    <div className={`dbf-item${item.equipado ? ' dbf-item--eq' : ''}`}>
      <div className="dbf-item__main">
        <h5 className="dbf-item__n">
          {item.nome}
          {item.livroId === null && <span className="dbf-tag dbf-tag--fraca">Livre</span>}
          {armadura && (
            <span className="dbf-tag dbf-tag--amber">
              CA +{item.bonusCA}
              {item.kiPorTurno > 0 ? `, −${item.kiPorTurno} Ki por turno` : ''}
            </span>
          )}
        </h5>
        <TextoQueAbre texto={item.descricao} className="dbf-item__ef" />
      </div>
      <div className="dbf-item__nums">
        {editando ? (
          <Stepper rotulo={`quantidade de ${item.nome}`} valor={item.quantidade} podeMenos={item.quantidade > 1} podeMais={item.quantidade < QUANTIDADE_MAX} onMenos={() => trocar({ quantidade: item.quantidade - 1 })} onMais={() => trocar({ quantidade: item.quantidade + 1 })} />
        ) : (
          <span className="dbf-item__q">×{item.quantidade}</span>
        )}
        <span className="dbf-item__c">{item.carga * item.quantidade} slots</span>
      </div>
      <div className="dbf-item__acts">
        {editando ? (
          <>
            <Interruptor ligado={item.equipado} onTrocar={() => trocar({ equipado: !item.equipado })}>
              Equipado
            </Interruptor>
            <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" aria-label={`Tirar ${item.nome}`} onClick={tirar}>
              Tirar
            </button>
          </>
        ) : (
          item.equipado && <span className="dbf-tag">Equipado</span>
        )}
      </div>
    </div>
  )
}

function itemDoLivro(item: ItemDBT): ItemDaFichaDBT {
  const descricao = [item.efeito, item.observacoes].filter((p) => p.trim() !== '').join('\n\n')
  return { id: novoIdDBT('item'), livroId: item.id, nome: item.nome, quantidade: 1, carga: item.carga, equipado: false, descricao, bonusCA: item.bonusCA, kiPorTurno: item.kiPorTurno }
}

function ItensDoLivro() {
  const { ficha, mudarFicha } = useFichaDBT()
  const [busca, setBusca] = useState('')
  const cheia = ficha.inventario.length >= LIMITES_DBT.inventario
  const termos = nomeNormalizado(busca).split(' ').filter((t) => t !== '')
  const visiveis = termos.length === 0 ? ITENS : ITENS.filter((i) => termos.every((t) => nomeNormalizado(`${i.nome} ${i.tipo ?? ''} ${i.efeito}`).includes(t)))
  const quantos = new Map(ficha.inventario.filter((i) => i.livroId !== null).map((i) => [i.livroId, i.quantidade]))
  const pegar = (item: ItemDBT) =>
    mudarFicha((f) => {
      // Item do livro que já está na mochila ganha +1 na quantidade em vez de outra linha.
      const ja = f.inventario.find((i) => i.livroId === item.id)
      if (ja !== undefined) return { ...f, inventario: f.inventario.map((i) => (i.id === ja.id ? { ...i, quantidade: Math.min(QUANTIDADE_MAX, i.quantidade + 1) } : i)) }
      return { ...f, inventario: [...f.inventario, itemDoLivro(item)] }
    })
  return (
    <details className="dbf-sec dbf-pick dbf-dobra">
      <summary className="dbf-sec__t">
        Itens do livro <span>{ITENS.length}</span>
      </summary>
      <input type="search" className="dbf-inp" value={busca} maxLength={60} aria-label="Buscar item do livro" placeholder="Buscar pelo nome ou efeito" onChange={(e) => setBusca(e.target.value)} />
      {cheia && <p className="dbf-motivo">A mochila já tem {LIMITES_DBT.inventario} linhas, o máximo.</p>}
      {visiveis.length === 0 && <p className="dbf-vazio dbf-vazio--curto">Nenhum item com “{busca.trim()}”.</p>}
      <div className="dbf-pick__lista">
        {visiveis.map((item) => {
          const n = quantos.get(item.id) ?? 0
          return (
            <div key={item.id} className="dbf-bk">
              <div>
                <h5>{item.nome}</h5>
                <div className="dbf-bk__meta">
                  {item.tipo !== null && <span className="dbf-tag">{item.tipo}</span>}
                  <span className="dbf-tag dbf-tag--fraca">{item.carga} slots</span>
                  {item.bonusCA > 0 && <span className="dbf-tag dbf-tag--amber">CA +{item.bonusCA}</span>}
                </div>
                <TextoQueAbre texto={item.efeito} className="dbf-bk__ef" />
              </div>
              <div className="dbf-bk__acts">
                <button type="button" className="dbf-btn dbf-btn--sm" disabled={n === 0 && cheia} onClick={() => pegar(item)}>
                  {n > 0 ? `Mais um (tem ${n})` : 'Pegar'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </details>
  )
}

function ItemLivre() {
  const { ficha, mudarFicha } = useFichaDBT()
  const idBase = useId()
  const [nome, setNome] = useState('')
  const [carga, setCarga] = useState('1')
  const [descricao, setDescricao] = useState('')
  const slots = inteiroDoCampo(carga)
  const cargaInvalida = slots === null || slots < 0 || slots > CARGA_MAX
  const cheia = ficha.inventario.length >= LIMITES_DBT.inventario
  const criar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (nome.trim() === '' || cargaInvalida || cheia) return
    const item: ItemDaFichaDBT = { id: novoIdDBT('item'), livroId: null, nome: nome.trim(), quantidade: 1, carga: slots ?? 0, equipado: false, descricao: descricao.trim(), bonusCA: 0, kiPorTurno: 0 }
    mudarFicha((f) => ({ ...f, inventario: [...f.inventario, item] }))
    setNome('')
    setCarga('1')
    setDescricao('')
  }
  return (
    <form className="dbf-novo" onSubmit={criar}>
      <h4 className="dbf-sec__t">Item livre</h4>
      <div className="dbf-novo__linha">
        <label className="dbf-fld">
          <span>Nome</span>
          <input className="dbf-inp" value={nome} maxLength={LIMITES_DBT.nome} placeholder="Semente dos Deuses" onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="dbf-fld dbf-fld--curto">
          <span>Slots</span>
          <input className="dbf-inp dbf-inp--num" inputMode="numeric" value={carga} aria-invalid={cargaInvalida} aria-describedby={cargaInvalida ? `${idBase}-carga` : undefined} onChange={(e) => setCarga(e.target.value)} />
        </label>
      </div>
      <label className="dbf-fld">
        <span>Descrição</span>
        <textarea className="dbf-inp dbf-area" rows={2} value={descricao} maxLength={LIMITES_DBT.texto} onChange={(e) => setDescricao(e.target.value)} />
      </label>
      <div className="dbf-novo__fim">
        {cargaInvalida && (
          <span className="dbf-motivo" id={`${idBase}-carga`}>
            Slots é um número de 0 a {CARGA_MAX}.
          </span>
        )}
        {cheia && <span className="dbf-motivo">A mochila já tem {LIMITES_DBT.inventario} linhas, o máximo.</span>}
        <button type="submit" className="dbf-btn dbf-btn--sm" disabled={nome.trim() === '' || cargaInvalida || cheia}>
          Adicionar item
        </button>
      </div>
    </form>
  )
}
