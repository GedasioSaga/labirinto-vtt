import { useId, useState, type FormEvent } from 'react'
import { TRANSFORMACOES_DE_EXEMPLO } from '../../../lib/dbt/dados/transformacoes'
import { LIMITES_DBT, type TransformacaoDBT, type TransformacaoDaFichaDBT } from '../../../lib/dbt/modelo'
import { divergenciaDaRegra, novaTransformacao, regraDoEstagio, transformacaoDoCatalogo } from '../../../lib/dbt/regras/transformacoes'
import { CampoQueColaImagem } from '../../CampoQueColaImagem'
import { ImagemOuIniciais } from '../../FichaPecas'
import { useFichaDBT } from './contexto'
import { desligarForma, ligarForma } from './edicaoDaFicha'
import { Stepper, TextoQueAbre } from './pecas'

/**
 * Aba Transformações: as formas da ficha (EP bônus, Ki para ligar, desgaste),
 * as da raça e os exemplos do livro para trazer com um clique, e uma forma
 * livre feita com o mestre (regra geral: EP = estágio, Ki = 3 × estágio).
 * Ligar paga o Ki na hora; ligar e desligar mudam a ficha, então ficam em Editar.
 */
const ESTAGIO_MAX = 10
const EP_MAX = 20
const KI_MAX = 999

export function AbaTransformacoes({ escolherImagem }: { escolherImagem: EscolherImagem }) {
  const { ficha, raca, editando, mudarFicha } = useFichaDBT()
  const formas = ficha.transformacoes
  const cheia = formas.length >= LIMITES_DBT.transformacoes
  const doLivro = new Set(formas.map((t) => t.livroId).filter((id): id is string => id !== null))
  const daRaca = raca?.transformacoes ?? []
  const catalogo: { origem: string; forma: TransformacaoDBT }[] = [
    ...daRaca.map((forma) => ({ origem: raca?.nome ?? '', forma })),
    ...TRANSFORMACOES_DE_EXEMPLO.filter((ex) => !daRaca.some((t) => t.id === ex.id)).map((forma) => ({ origem: 'Exemplo do livro', forma })),
  ]

  return (
    <>
      <div className="dbf-ph">
        <h3 className="dbf-ph__t">Transformações</h3>
        {!editando && formas.length > 0 && <span className="dbf-ph__d">Ligar e desligar a forma fica em Editar: muda o Ki e a EP da ficha.</span>}
      </div>
      {formas.length === 0 && (
        <div className="dbf-vazio">
          <p>
            {editando
              ? 'Nenhuma forma ainda. Traga uma da raça ou dos exemplos do livro, ou crie uma com o mestre aqui embaixo.'
              : 'Nenhuma forma ainda. Em Editar, traga uma da raça ou crie uma com o mestre.'}
          </p>
        </div>
      )}
      {formas.length > 0 && (
        <div className="dbf-sec">
          {formas.map((forma) => (
            <CartaoDaForma key={forma.id} forma={forma} escolherImagem={escolherImagem} />
          ))}
        </div>
      )}
      {editando && (
        <>
          <NovaForma desabilitada={cheia} />
          {catalogo.length > 0 && (
            <div className="dbf-sec">
              <h4 className="dbf-sec__t">
                Do livro <span>{raca === null ? 'exemplos do cap. 7' : `${raca.nome} e exemplos do cap. 7`}</span>
              </h4>
              {catalogo.map(({ origem, forma }) => {
                const ja = doLivro.has(forma.id)
                return (
                  <div key={forma.id} className="dbf-bk">
                    <div>
                      <h5>{forma.nome}</h5>
                      <div className="dbf-bk__meta">
                        <span className="dbf-tag">{forma.estagioTexto}</span>
                        <span className="dbf-tag dbf-tag--amber">EP {forma.ep === null ? '?' : `+${forma.ep}`}</span>
                        <span className="dbf-tag dbf-tag--ki">{forma.custoTexto}</span>
                        <span className="dbf-tag dbf-tag--fraca">{origem}</span>
                      </div>
                      {forma.requisito !== '' && <p className="dbf-bk__req">Requisito: {forma.requisito}</p>}
                      <TextoQueAbre texto={forma.efeitos.join('\n')} className="dbf-bk__ef" />
                    </div>
                    <div className="dbf-bk__acts">
                      <button
                        type="button"
                        className={`dbf-btn dbf-btn--sm${ja ? ' dbf-btn--on' : ''}`}
                        disabled={ja || cheia}
                        onClick={() => mudarFicha((f) => ({ ...f, transformacoes: [...f.transformacoes, transformacaoDoCatalogo(forma, origem)] }))}
                      >
                        {ja ? 'Na ficha' : 'Adicionar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}

/** Pede uma imagem ao mestre (o seletor de arquivo da janela da ficha); `null` = ele desistiu. */
type EscolherImagem = () => Promise<string | null>

function CartaoDaForma({ forma, escolherImagem }: { forma: TransformacaoDaFichaDBT; escolherImagem: EscolherImagem }) {
  const { ficha, editando, ehMestre, pkAtual, mudar, mudarFicha } = useFichaDBT()
  const idBase = useId()
  const [erroDaImagem, setErroDaImagem] = useState<string | null>(null)
  const ativa = ficha.transformacaoAtiva === forma.id
  const outraAtiva = ficha.transformacaoAtiva !== null && !ativa
  const faltaKi = forma.custoKi - pkAtual
  const divergencia = divergenciaDaRegra(forma)
  const trocar = (mudanca: Partial<TransformacaoDaFichaDBT>) =>
    mudarFicha((f) => ({ ...f, transformacoes: f.transformacoes.map((t) => (t.id === forma.id ? { ...t, ...mudanca } : t)) }))
  const tirar = () =>
    mudarFicha((f) => ({ ...f, transformacoes: f.transformacoes.filter((t) => t.id !== forma.id), transformacaoAtiva: f.transformacaoAtiva === forma.id ? null : f.transformacaoAtiva }))
  const motivo = ativa ? null : faltaKi > 0 ? `Falta ${faltaKi} Ki para ligar` : null
  // MUDAR FICHA: a imagem que o token mostra nesta forma. Sem imagem o campo sai da ficha (não vira `null`).
  const tirarImagem = () =>
    mudarFicha((f) => ({
      ...f,
      transformacoes: f.transformacoes.map((t) => {
        if (t.id !== forma.id) return t
        const { imagem: _imagem, ...semImagem } = t
        return semImagem
      }),
    }))
  const pedirImagem = async () => {
    setErroDaImagem(null)
    try {
      const imagem = await escolherImagem()
      if (imagem !== null) trocar({ imagem })
    } catch (erro) {
      setErroDaImagem(erro instanceof Error ? erro.message : String(erro))
    }
  }

  return (
    <article className={`dbf-tr${ativa ? ' dbf-tr--on' : ''}`} aria-labelledby={`${idBase}-n`}>
      <div className="dbf-tr__head">
        {!editando && forma.imagem !== undefined && (
          <span className="dbf-tr__foto" aria-hidden="true">
            <ImagemOuIniciais imagem={forma.imagem} nome={forma.nome} />
          </span>
        )}
        {editando ? (
          <label className="dbf-fld dbf-tr__nome">
            <span className="lb-sr-only">Nome da forma</span>
            <input id={`${idBase}-n`} className="dbf-inp" value={forma.nome} maxLength={LIMITES_DBT.nome} onChange={(e) => trocar({ nome: e.target.value })} />
          </label>
        ) : (
          <h4 className="dbf-tr__n" id={`${idBase}-n`}>
            {forma.nome}
          </h4>
        )}
        {ativa && <span className="dbf-tag dbf-tag--amber">Ligada agora</span>}
        {forma.livroId !== null && <span className="dbf-tag dbf-tag--fraca">Do livro</span>}
      </div>
      {editando ? (
        <div className="dbf-tr__nums dbf-tr__nums--edit">
          <span className="dbf-tr__ctl">
            <span>Estágio</span>
            <Stepper rotulo="estágio" valor={forma.estagio} podeMenos={forma.estagio > 1} podeMais={forma.estagio < ESTAGIO_MAX} onMenos={() => trocar({ estagio: forma.estagio - 1 })} onMais={() => trocar({ estagio: forma.estagio + 1 })} />
          </span>
          <span className="dbf-tr__ctl">
            <span>EP bônus</span>
            <Stepper rotulo="EP bônus" valor={`+${forma.ep}`} podeMenos={forma.ep > 0} podeMais={forma.ep < EP_MAX} onMenos={() => trocar({ ep: forma.ep - 1 })} onMais={() => trocar({ ep: forma.ep + 1 })} />
          </span>
          <span className="dbf-tr__ctl">
            <span>Ki para ligar</span>
            <Stepper rotulo="Ki para ligar" valor={forma.custoKi} podeMenos={forma.custoKi > 0} podeMais={forma.custoKi < KI_MAX} onMenos={() => trocar({ custoKi: forma.custoKi - 1 })} onMais={() => trocar({ custoKi: forma.custoKi + 1 })} />
          </span>
          <span className="dbf-tr__ctl">
            <span>Ki por rodada</span>
            <Stepper rotulo="Ki por rodada" valor={forma.kiPorRodada} podeMenos={forma.kiPorRodada > 0} podeMais={forma.kiPorRodada < KI_MAX} onMenos={() => trocar({ kiPorRodada: forma.kiPorRodada - 1 })} onMais={() => trocar({ kiPorRodada: forma.kiPorRodada + 1 })} />
          </span>
        </div>
      ) : (
        <p className="dbf-tr__nums">
          <span>Estágio {forma.estagio}</span>
          <span className="dbf-tr__ep">EP +{forma.ep}</span>
          <span className="dbf-tr__ki">{forma.custoKi} Ki para ligar</span>
          {forma.kiPorRodada > 0 && <span className="dbf-tr__ki">{forma.kiPorRodada} Ki por rodada</span>}
        </p>
      )}
      {divergencia !== null && <p className="dbf-tr__div">{divergencia}</p>}
      {editando ? (
        <div className="dbf-builder__linha">
          <label className="dbf-fld">
            <span>Efeitos</span>
            <textarea className="dbf-inp dbf-area" rows={2} value={forma.efeitos} maxLength={LIMITES_DBT.texto} onChange={(e) => trocar({ efeitos: e.target.value })} />
          </label>
          <label className="dbf-fld">
            <span>Como destravou</span>
            <input className="dbf-inp" value={forma.origem} maxLength={LIMITES_DBT.textoCurto} placeholder="Raça, evento, treino" onChange={(e) => trocar({ origem: e.target.value })} />
          </label>
        </div>
      ) : (
        <>
          <TextoQueAbre texto={forma.efeitos} className="dbf-tr__ef" />
          {forma.origem.trim() !== '' && <p className="dbf-tr__or">Origem: {forma.origem}</p>}
        </>
      )}
      {editando && ehMestre && (
        <div className="dbf-tr__imagem">
          <span className="dbf-tr__imagem-rotulo">Imagem do token nesta forma</span>
          <CampoQueColaImagem className="dbf-tr__imagem-edit" rotulo={`Imagem de ${forma.nome}: clique e cole com Ctrl+V`} onImagem={(imagem) => trocar({ imagem })} onAviso={setErroDaImagem}>
            <span className="dbf-tr__foto" aria-hidden="true">
              <ImagemOuIniciais imagem={forma.imagem} nome={forma.nome} />
            </span>
            <button type="button" className="dbf-btn dbf-btn--sm" onClick={() => void pedirImagem()}>
              {forma.imagem === undefined ? 'Escolher imagem…' : 'Trocar imagem…'}
            </button>
            {forma.imagem !== undefined && (
              <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" onClick={tirarImagem}>
                Tirar
              </button>
            )}
          </CampoQueColaImagem>
          {erroDaImagem !== null && (
            <p className="dbf-motivo" role="alert">
              {erroDaImagem}
            </p>
          )}
        </div>
      )}
      {editando && (
        <div className="dbf-tr__acts">
          {ativa ? (
            <button type="button" className="dbf-btn dbf-btn--sm" onClick={() => mudar(desligarForma)}>
              Desligar a forma
            </button>
          ) : (
            <>
              <button
                type="button"
                className="dbf-btn dbf-btn--sm dbf-btn--ki"
                disabled={motivo !== null}
                aria-describedby={motivo !== null ? `${idBase}-motivo` : undefined}
                onClick={() => mudar((p) => ligarForma(p, forma.id))}
              >
                {outraAtiva ? 'Trocar para esta' : 'Ligar'} <span className="dbf-ki-cost">−{forma.custoKi} Ki</span>
              </button>
              {motivo !== null && (
                <span className="dbf-motivo" id={`${idBase}-motivo`}>
                  {motivo}
                </span>
              )}
            </>
          )}
          <span className="dbf-builder__esp" />
          <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost dbf-btn--perigo" onClick={tirar}>
            Tirar da ficha
          </button>
        </div>
      )}
    </article>
  )
}

function NovaForma({ desabilitada }: { desabilitada: boolean }) {
  const { mudarFicha } = useFichaDBT()
  const [nome, setNome] = useState('')
  const [estagio, setEstagio] = useState(1)
  const criar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (nome.trim() === '' || desabilitada) return
    mudarFicha((f) => ({ ...f, transformacoes: [...f.transformacoes, { ...novaTransformacao(nome.trim(), estagio), origem: 'Criada com o mestre' }] }))
    setNome('')
    setEstagio(1)
  }
  return (
    <form className="dbf-novo" onSubmit={criar}>
      <h4 className="dbf-sec__t">Forma nova, feita com o mestre</h4>
      <div className="dbf-novo__linha">
        <label className="dbf-fld">
          <span>Nome</span>
          <input className="dbf-inp" value={nome} maxLength={LIMITES_DBT.nome} placeholder="Forma Liberada" onChange={(e) => setNome(e.target.value)} />
        </label>
        <span className="dbf-fld">
          <span>Estágio</span>
          <Stepper rotulo="estágio da forma nova" valor={estagio} podeMenos={estagio > 1} podeMais={estagio < ESTAGIO_MAX} onMenos={() => setEstagio(estagio - 1)} onMais={() => setEstagio(estagio + 1)} />
        </span>
        <span className="dbf-novo__conta">
          EP +{regraDoEstagio(estagio).ep}, {regraDoEstagio(estagio).custoKi} Ki
        </span>
        <button type="submit" className="dbf-btn dbf-btn--sm" disabled={nome.trim() === '' || desabilitada}>
          Criar forma
        </button>
      </div>
      {desabilitada && <p className="dbf-motivo">A ficha já tem {LIMITES_DBT.transformacoes} formas, o máximo.</p>}
    </form>
  )
}
