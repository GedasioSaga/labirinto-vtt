import { useState, type FormEvent } from 'react'
import { LIMITES_DBT, novoIdDBT, type HabilidadeDaFichaDBT, type TracoDBT } from '../../../lib/dbt/modelo'
import { useFichaDBT } from './contexto'
import { caracteristicasDaRaca, tecnicasProntasDaRaca } from './edicaoDaFicha'
import { TextoQueAbre } from './pecas'

/**
 * Aba Raça: o que a raça (e a variante) dá, como o livro escreve: traços,
 * características especiais (a de outra variante aparece apagada, com o
 * nome dela), regras extras e atalhos para as formas e técnicas prontas.
 * Embaixo, as características que a ficha guarda (escolhidas ou livres).
 */
export function AbaRaca() {
  const { ficha, raca, variante, editando, irPara } = useFichaDBT()
  const livre = ficha.racaLivre
  if (raca === null && livre === null) {
    return (
      <>
        <div className="dbf-ph">
          <h3 className="dbf-ph__t">Raça</h3>
        </div>
        <div className="dbf-vazio">
          <p>{editando ? 'Sem raça ainda. Escolha a raça no topo da ficha, ao lado do nome: as do Livro do Jogador, as dos suplementos ou uma livre.' : 'Sem raça ainda. Em Editar, escolha no topo da ficha.'}</p>
        </div>
        <CaracteristicasDaFicha />
      </>
    )
  }
  if (raca === null && livre !== null) {
    return (
      <>
        <div className="dbf-ph">
          <h3 className="dbf-ph__t">{livre.nome.trim() === '' ? 'Raça livre' : livre.nome}</h3>
          <span className="dbf-tag dbf-tag--fraca">Raça livre</span>
        </div>
        <p className="dbf-nota">+{livre.vidaPor10k} PV a cada 10.000 PDL (também no PDL 0). Os traços dela ficam nas características aqui embaixo, combinados com o mestre.</p>
        <CaracteristicasDaFicha />
      </>
    )
  }
  if (raca === null) return null

  const especiais = caracteristicasDaRaca(raca, variante)
  const prontas = tecnicasProntasDaRaca(raca).length
  return (
    <>
      <div className="dbf-ph">
        <h3 className="dbf-ph__t">{raca.nome}</h3>
        <span className={`dbf-tag${raca.fonte === 'suplemento' ? ' dbf-tag--amber' : ''}`}>{raca.fonte === 'basico' ? 'Livro do Jogador' : 'Suplemento de fã'}</span>
        {raca.pagina !== null && <span className="dbf-ph__d">p. {raca.pagina}</span>}
      </div>
      <p className="dbf-nota">{raca.vidaPor10k === null ? 'O livro não diz a vida por 10.000 PDL desta raça: combine com o mestre (Valores à mão).' : `+${raca.vidaPor10k} PV a cada 10.000 PDL, também no PDL 0.`}</p>
      <TextoQueAbre texto={raca.descricao} className="dbf-raca__desc" />
      {(raca.transformacoes.length > 0 || prontas > 0) && (
        <p className="dbf-raca__atalhos">
          {raca.transformacoes.length > 0 && (
            <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" onClick={() => irPara('transformacoes')}>
              {raca.transformacoes.length} {raca.transformacoes.length === 1 ? 'forma' : 'formas'} da raça
            </button>
          )}
          {prontas > 0 && (
            <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" onClick={() => irPara('tecnicas')}>
              {prontas} {prontas === 1 ? 'técnica pronta' : 'técnicas prontas'}
            </button>
          )}
        </p>
      )}
      {variante !== null && (
        <div className="dbf-sec">
          <h4 className="dbf-sec__t">
            Variante: {variante.nome} <span>{variante.tracos.length} traços</span>
          </h4>
          <TextoQueAbre texto={variante.descricao} className="dbf-raca__desc" />
          {variante.tracos.map((traco, i) => (
            <Traco key={`${traco.nome}-${i}`} traco={traco} />
          ))}
        </div>
      )}
      {raca.variantes.length > 0 && variante === null && <p className="dbf-aviso dbf-aviso--amber">Esta raça tem {raca.variantes.length} variantes. Escolha uma no topo da ficha para ver os traços dela.</p>}
      {raca.tracos.length > 0 && (
        <div className="dbf-sec">
          <h4 className="dbf-sec__t">
            Traços <span>{raca.variantes.length > 0 ? 'de toda variante' : raca.tracos.length}</span>
          </h4>
          {raca.tracos.map((traco, i) => (
            <Traco key={`${traco.nome}-${i}`} traco={traco} />
          ))}
        </div>
      )}
      {especiais.length > 0 && (
        <div className="dbf-sec">
          <h4 className="dbf-sec__t">
            Características especiais <span>{especiais.filter((e) => e.deOutraVariante === null).length} valem para esta ficha</span>
          </h4>
          {especiais.map(({ traco, deOutraVariante }, i) => (
            <Traco key={`${traco.nome}-${i}`} traco={traco} soPara={deOutraVariante} podePor />
          ))}
        </div>
      )}
      {raca.outros.length > 0 && (
        <div className="dbf-sec">
          <h4 className="dbf-sec__t">Regras da raça</h4>
          {raca.outros.map((o, i) => (
            <div key={`${o.titulo}-${i}`} className="dbf-traco">
              <h5 className="dbf-traco__n">{o.titulo}</h5>
              <TextoQueAbre texto={o.texto} className="dbf-traco__ef" />
            </div>
          ))}
        </div>
      )}
      <CaracteristicasDaFicha />
    </>
  )
}

function Traco({ traco, soPara = null, podePor = false }: { traco: TracoDBT; soPara?: string | null; podePor?: boolean }) {
  const { ficha, editando, mudarFicha } = useFichaDBT()
  const ja = ficha.caracteristicas.some((c) => c.nome.trim().toLowerCase() === traco.nome.trim().toLowerCase())
  const cheia = ficha.caracteristicas.length >= LIMITES_DBT.caracteristicas
  const por = () => {
    const nova: HabilidadeDaFichaDBT = { id: novoIdDBT('car'), livroId: null, nome: traco.nome, efeito: traco.efeito, custoKi: null }
    mudarFicha((f) => ({ ...f, caracteristicas: [...f.caracteristicas, nova] }))
  }
  return (
    <div className={`dbf-traco${soPara !== null ? ' dbf-traco--outra' : ''}`}>
      <h5 className="dbf-traco__n">
        {traco.nome}
        {soPara !== null && <span className="dbf-tag dbf-tag--fraca">Só para {soPara}</span>}
        {soPara === null && traco.requisito !== null && <span className="dbf-tag">Requisito: {traco.requisito}</span>}
      </h5>
      <TextoQueAbre texto={traco.efeito} className="dbf-traco__ef" />
      {editando && podePor && (
        <button type="button" className={`dbf-btn dbf-btn--xs${ja ? ' dbf-btn--on' : ''}`} disabled={ja || cheia} onClick={por}>
          {ja ? 'Na ficha' : 'Pôr nas características da ficha'}
        </button>
      )}
    </div>
  )
}

function CaracteristicasDaFicha() {
  const { ficha, editando, mudarFicha } = useFichaDBT()
  const [nome, setNome] = useState('')
  const [efeito, setEfeito] = useState('')
  const itens = ficha.caracteristicas
  const cheia = itens.length >= LIMITES_DBT.caracteristicas
  if (!editando && itens.length === 0) return null
  const tirar = (id: string) => mudarFicha((f) => ({ ...f, caracteristicas: f.caracteristicas.filter((c) => c.id !== id) }))
  const criar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (nome.trim() === '' || cheia) return
    mudarFicha((f) => ({ ...f, caracteristicas: [...f.caracteristicas, { id: novoIdDBT('car'), livroId: null, nome: nome.trim(), efeito: efeito.trim(), custoKi: null }] }))
    setNome('')
    setEfeito('')
  }
  return (
    <div className="dbf-sec">
      <h4 className="dbf-sec__t">
        Características da ficha <span>{itens.length === 0 ? 'escolhidas ou combinadas com o mestre' : itens.length}</span>
      </h4>
      {itens.map((c) => (
        <div key={c.id} className="dbf-hab">
          <div className="dbf-hab__main">
            <h5 className="dbf-hab__n">{c.nome}</h5>
            <TextoQueAbre texto={c.efeito} className="dbf-hab__ef" />
          </div>
          {editando && (
            <div className="dbf-hab__acts">
              <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" aria-label={`Tirar ${c.nome}`} onClick={() => tirar(c.id)}>
                Tirar
              </button>
            </div>
          )}
        </div>
      ))}
      {editando && (
        <form className="dbf-novo" onSubmit={criar}>
          <div className="dbf-novo__linha">
            <label className="dbf-fld">
              <span>Característica livre</span>
              <input className="dbf-inp" value={nome} maxLength={LIMITES_DBT.nome} placeholder="Nome" onChange={(e) => setNome(e.target.value)} />
            </label>
          </div>
          <label className="dbf-fld">
            <span>Efeito</span>
            <textarea className="dbf-inp dbf-area" rows={2} value={efeito} maxLength={LIMITES_DBT.texto} onChange={(e) => setEfeito(e.target.value)} />
          </label>
          <div className="dbf-novo__fim">
            {cheia && <span className="dbf-motivo">A ficha já tem {LIMITES_DBT.caracteristicas} características, o máximo.</span>}
            <button type="submit" className="dbf-btn dbf-btn--sm" disabled={nome.trim() === '' || cheia}>
              Adicionar característica
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
