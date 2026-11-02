import { useState, type FormEvent } from 'react'
import { LIMITES_DBT, novoIdDBT, type ContadorDBT, type FichaDBT } from '../../../lib/dbt/modelo'
import { HistoricoDaFicha } from '../../AjusteRapido'
import { useFichaDBT } from './contexto'
import { NPC_PADRAO } from './edicaoDaFicha'
import { Stepper, TextoQueAbre, inteiroDoCampo } from './pecas'

/**
 * Aba História e notas: os campos da ficha oficial (p. 127), a descrição do
 * personagem, os contadores (Magia Negra, cargas...), as passivas do NPC
 * (só o mestre) e, fora da edição, o histórico de ajustes da mesa.
 */
const CONTADOR_MAX = 9999

type CampoCurto = 'tamanho' | 'idade' | 'personalidade'

const CAMPOS_CURTOS: readonly { chave: CampoCurto; nome: string; exemplo: string }[] = [
  { chave: 'tamanho', nome: 'Tamanho', exemplo: '1,75 m' },
  { chave: 'idade', nome: 'Idade', exemplo: '18 anos' },
  { chave: 'personalidade', nome: 'Personalidade', exemplo: 'Calmo, teimoso, come demais' },
]

export function AbaHistoria() {
  const { personagem, ficha, editando, ehMestre, ehNpc, mudar, mudarFicha } = useFichaDBT()
  const trocar = (mudanca: Partial<FichaDBT>) => mudarFicha((f) => ({ ...f, ...mudanca }))
  const trocarCurto = (chave: CampoCurto, valor: string) =>
    mudarFicha((f) => {
      const proxima = { ...f }
      proxima[chave] = valor
      return proxima
    })
  const curtos = CAMPOS_CURTOS.filter((c) => ficha[c.chave].trim() !== '')
  const vazio = !editando && curtos.length === 0 && personagem.descricao.trim() === '' && ficha.historia.trim() === '' && ficha.notas.trim() === ''

  return (
    <>
      <div className="dbf-ph">
        <h3 className="dbf-ph__t">{ehNpc ? 'Passivas e notas' : 'História e notas'}</h3>
      </div>
      {ehNpc && (ehMestre || (ficha.npc?.passivas.length ?? 0) > 0) && <PassivasDoNpc />}
      {editando ? (
        <>
          <div className="dbf-novo__linha dbf-hist__curtos">
            {CAMPOS_CURTOS.map((c) => (
              <label key={c.chave} className="dbf-fld">
                <span>{c.nome}</span>
                <input className="dbf-inp" value={ficha[c.chave]} maxLength={LIMITES_DBT.textoCurto} placeholder={c.exemplo} onChange={(e) => trocarCurto(c.chave, e.target.value)} />
              </label>
            ))}
          </div>
          <label className="dbf-fld">
            <span>Aparência e descrição</span>
            <textarea className="dbf-inp dbf-area" rows={3} value={personagem.descricao} maxLength={LIMITES_DBT.texto} onChange={(e) => mudar((p) => ({ ...p, descricao: e.target.value }))} />
          </label>
          <label className="dbf-fld">
            <span>História</span>
            <textarea className="dbf-inp dbf-area" rows={6} value={ficha.historia} maxLength={LIMITES_DBT.historia} placeholder="De onde veio, quem treinou com ele, o que quer." onChange={(e) => trocar({ historia: e.target.value })} />
          </label>
          <label className="dbf-fld">
            <span>Notas</span>
            <textarea className="dbf-inp dbf-area" rows={4} value={ficha.notas} maxLength={LIMITES_DBT.notas} placeholder="Pistas, dívidas, nomes da sessão." onChange={(e) => trocar({ notas: e.target.value })} />
          </label>
        </>
      ) : (
        <>
          {curtos.length > 0 && (
            <dl className="dbf-hist__dl">
              {curtos.map((c) => (
                <div key={c.chave}>
                  <dt>{c.nome}</dt>
                  <dd>{ficha[c.chave]}</dd>
                </div>
              ))}
            </dl>
          )}
          <BlocoDeTexto titulo="Aparência e descrição" texto={personagem.descricao} />
          <BlocoDeTexto titulo="História" texto={ficha.historia} />
          <BlocoDeTexto titulo="Notas" texto={ficha.notas} />
          {vazio && (
            <div className="dbf-vazio">
              <p>Nada escrito ainda. Em Editar, conte de onde o personagem veio e anote o que a mesa precisa lembrar.</p>
            </div>
          )}
        </>
      )}
      <Contadores />
      {!editando && <HistoricoDaFicha historico={personagem.historico} />}
    </>
  )
}

function BlocoDeTexto({ titulo, texto }: { titulo: string; texto: string }) {
  if (texto.trim() === '') return null
  return (
    <div className="dbf-sec">
      <h4 className="dbf-sec__t">{titulo}</h4>
      <TextoQueAbre texto={texto} className="dbf-hist__txt" />
    </div>
  )
}

function Contadores() {
  const { ficha, editando, mudarFicha } = useFichaDBT()
  const [nome, setNome] = useState('')
  const [maximo, setMaximo] = useState('')
  const itens = ficha.contadores
  const cheia = itens.length >= LIMITES_DBT.contadores
  const teto = inteiroDoCampo(maximo)
  const tetoInvalido = maximo.trim() !== '' && (teto === null || teto < 1 || teto > CONTADOR_MAX)
  if (!editando && itens.length === 0) return null
  const trocar = (id: string, mudanca: Partial<ContadorDBT>) => mudarFicha((f) => ({ ...f, contadores: f.contadores.map((c) => (c.id === id ? { ...c, ...mudanca } : c)) }))
  const tirar = (id: string) => mudarFicha((f) => ({ ...f, contadores: f.contadores.filter((c) => c.id !== id) }))
  const criar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (nome.trim() === '' || cheia || tetoInvalido) return
    mudarFicha((f) => ({ ...f, contadores: [...f.contadores, { id: novoIdDBT('cont'), nome: nome.trim(), atual: 0, maximo: teto }] }))
    setNome('')
    setMaximo('')
  }
  return (
    <div className="dbf-sec">
      <h4 className="dbf-sec__t">
        Contadores <span>{itens.length === 0 ? 'Magia Negra, cargas, tempo perdido' : itens.length}</span>
      </h4>
      {itens.map((c) => {
        const topo = c.maximo ?? CONTADOR_MAX
        return (
          <div key={c.id} className="dbf-hab dbf-hab--cont">
            <h5 className="dbf-hab__n">{c.nome}</h5>
            {editando ? (
              <>
                <Stepper rotulo={c.nome} valor={c.maximo === null ? c.atual : `${c.atual}/${c.maximo}`} podeMenos={c.atual > 0} podeMais={c.atual < topo} onMenos={() => trocar(c.id, { atual: c.atual - 1 })} onMais={() => trocar(c.id, { atual: c.atual + 1 })} />
                <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" aria-label={`Tirar ${c.nome}`} onClick={() => tirar(c.id)}>
                  Tirar
                </button>
              </>
            ) : (
              <span className="dbf-hab__v">{c.maximo === null ? c.atual : `${c.atual} de ${c.maximo}`}</span>
            )}
          </div>
        )
      })}
      {editando && (
        <form className="dbf-novo dbf-novo--uma" onSubmit={criar}>
          <label className="dbf-fld">
            <span>Contador novo</span>
            <input className="dbf-inp" value={nome} maxLength={LIMITES_DBT.nome} placeholder="Nome" onChange={(e) => setNome(e.target.value)} />
          </label>
          <label className="dbf-fld dbf-fld--curto">
            <span>Máximo</span>
            <input className="dbf-inp dbf-inp--num" inputMode="numeric" value={maximo} placeholder="sem" aria-invalid={tetoInvalido} onChange={(e) => setMaximo(e.target.value)} />
          </label>
          <button type="submit" className="dbf-btn dbf-btn--sm" disabled={nome.trim() === '' || cheia || tetoInvalido}>
            Criar contador
          </button>
          {tetoInvalido && <span className="dbf-motivo">Máximo é um número de 1 a {CONTADOR_MAX}, ou vazio.</span>}
          {cheia && <span className="dbf-motivo">A ficha já tem {LIMITES_DBT.contadores} contadores, o máximo.</span>}
        </form>
      )}
    </div>
  )
}

/** Só o mestre edita: as "Passivas e Ativas Únicas" do NPC. */
function PassivasDoNpc() {
  const { ficha, editando, ehMestre, mudarFicha } = useFichaDBT()
  const [nome, setNome] = useState('')
  const [texto, setTexto] = useState('')
  const npc = ficha.npc ?? NPC_PADRAO
  const passivas = npc.passivas
  const cheia = passivas.length >= LIMITES_DBT.passivas
  const podeEditar = editando && ehMestre
  const trocarPassivas = (lista: typeof passivas) => mudarFicha((f) => ({ ...f, npc: { ...(f.npc ?? NPC_PADRAO), passivas: lista } }))
  const criar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (nome.trim() === '' || cheia) return
    trocarPassivas([...passivas, { id: novoIdDBT('pas'), livroId: null, nome: nome.trim(), efeito: texto.trim(), custoKi: null }])
    setNome('')
    setTexto('')
  }
  return (
    <div className="dbf-sec">
      <h4 className="dbf-sec__t">
        Passivas e ativas únicas <span>{passivas.length}</span>
      </h4>
      {passivas.length === 0 && !podeEditar && <p className="dbf-nota">Nenhuma passiva. Em Editar, o mestre escreve as do NPC.</p>}
      {passivas.map((p) => (
        <div key={p.id} className="dbf-hab">
          <div className="dbf-hab__main">
            <h5 className="dbf-hab__n">{p.nome}</h5>
            <TextoQueAbre texto={p.efeito} className="dbf-hab__ef" />
          </div>
          {podeEditar && (
            <div className="dbf-hab__acts">
              <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" aria-label={`Tirar ${p.nome}`} onClick={() => trocarPassivas(passivas.filter((x) => x.id !== p.id))}>
                Tirar
              </button>
            </div>
          )}
        </div>
      ))}
      {podeEditar && (
        <form className="dbf-novo" onSubmit={criar}>
          <div className="dbf-novo__linha">
            <label className="dbf-fld">
              <span>Passiva nova</span>
              <input className="dbf-inp" value={nome} maxLength={LIMITES_DBT.nome} placeholder="Nome" onChange={(e) => setNome(e.target.value)} />
            </label>
          </div>
          <label className="dbf-fld">
            <span>O que faz</span>
            <textarea className="dbf-inp dbf-area" rows={2} value={texto} maxLength={LIMITES_DBT.texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <div className="dbf-novo__fim">
            {cheia && <span className="dbf-motivo">O NPC já tem {LIMITES_DBT.passivas} passivas, o máximo.</span>}
            <button type="submit" className="dbf-btn dbf-btn--sm" disabled={nome.trim() === '' || cheia}>
              Adicionar passiva
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
