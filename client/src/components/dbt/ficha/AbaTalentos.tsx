import { useId, useState, type FormEvent } from 'react'
import { MOVIMENTOS_MARCIAIS } from '../../../lib/dbt/dados/movimentosMarciais'
import { TALENTOS } from '../../../lib/dbt/dados/talentos'
import { LIMITES_DBT, novoIdDBT, type FichaDBT, type HabilidadeDaFichaDBT } from '../../../lib/dbt/modelo'
import { nomeNormalizado } from '../../../lib/dbt/regras/tecnicas'
import { useFichaDBT } from './contexto'
import { movimentoPorId, talentoPorId } from './edicaoDaFicha'
import { Segmentos, TextoQueAbre, inteiroDoCampo } from './pecas'

/**
 * Aba Talentos e movimentos: 3 + 1 a cada 20.000 PDL, gastos em talento ou
 * movimento marcial (o Humano Marcial ganha movimentos a mais). Escolhe do
 * livro (com os talentos da raça marcados) ou escreve um livre. O jogador
 * para no limite; o mestre pode passar (fica o aviso).
 */
type Lista = 'talentos' | 'movimentos'

interface Opcao {
  id: string
  nome: string
  detalhe: string
  efeito: string
  custoKi: number | null
  daRaca: boolean
}

export function AbaTalentos() {
  const { ficha, derivados, editando, ehMestre, ehNpc } = useFichaDBT()
  const t = derivados.talentos
  const acima = t.restantes < 0
  return (
    <>
      <div className="dbf-ph">
        <h3 className="dbf-ph__t">Talentos e movimentos</h3>
      </div>
      {!ehNpc && (
        <div className={`dbf-cont${acima ? ' dbf-cont--mal' : ''}`}>
          <span className="dbf-cont__n">{t.usados}</span>
          <span className="dbf-cont__de">de {t.disponiveis + t.movimentosExtras}</span>
          <span className="dbf-cont__txt">
            {acima ? `${-t.restantes} acima do limite${ehMestre ? ', o mestre decide' : ''}.` : t.restantes === 0 ? 'Todos escolhidos. O próximo vem a cada 20.000 PDL.' : `Sobram ${t.restantes} para escolher.`}
            <br />
            <small>{t.formula}</small>
          </span>
        </div>
      )}
      <ListaEscolhida titulo="Talentos" lista="talentos" itens={ficha.talentos} />
      <ListaEscolhida titulo="Movimentos marciais" lista="movimentos" itens={ficha.movimentos} />
      {ficha.talentos.length === 0 && ficha.movimentos.length === 0 && (
        <div className="dbf-vazio">
          <p>{editando ? 'Nenhum talento nem movimento ainda. Escolha do livro aqui embaixo ou escreva um livre.' : 'Nenhum talento nem movimento ainda. Em Editar, escolha do livro.'}</p>
        </div>
      )}
      {editando && <EscolherDoLivro />}
      {editando && <HabilidadeLivre />}
    </>
  )
}

function comLista(ficha: FichaDBT, lista: Lista, itens: HabilidadeDaFichaDBT[]): FichaDBT {
  const proxima = { ...ficha }
  proxima[lista] = itens
  return proxima
}

function efeitoDe(lista: Lista, h: HabilidadeDaFichaDBT): string {
  if (h.livroId === null || h.efeito.trim() !== '') return h.efeito
  return (lista === 'talentos' ? talentoPorId(h.livroId)?.efeito : movimentoPorId(h.livroId)?.efeito) ?? ''
}

function kiDe(lista: Lista, h: HabilidadeDaFichaDBT): number | null {
  if (h.livroId === null || lista === 'talentos') return h.custoKi
  return movimentoPorId(h.livroId)?.custoKi ?? h.custoKi
}

function ListaEscolhida({ titulo, lista, itens }: { titulo: string; lista: Lista; itens: readonly HabilidadeDaFichaDBT[] }) {
  const { editando, ajustar, pkAtual, mudarFicha } = useFichaDBT()
  const idBase = useId()
  if (itens.length === 0) return null
  const tirar = (id: string) => mudarFicha((f) => comLista(f, lista, f[lista].filter((h) => h.id !== id)))
  return (
    <div className="dbf-sec">
      <h4 className="dbf-sec__t">
        {titulo} <span>{itens.length}</span>
      </h4>
      {itens.map((h) => {
        const ki = kiDe(lista, h)
        const falta = ki === null ? 0 : ki - pkAtual
        return (
          <div key={h.id} className="dbf-hab">
            <div className="dbf-hab__main">
              <h5 className="dbf-hab__n">
                {h.nome}
                {h.livroId === null && <span className="dbf-tag dbf-tag--fraca">Livre</span>}
                {ki !== null && ki > 0 && <span className="dbf-tag dbf-tag--ki">{ki} Ki</span>}
              </h5>
              <TextoQueAbre texto={efeitoDe(lista, h)} className="dbf-hab__ef" />
            </div>
            <div className="dbf-hab__acts">
              {!editando && ajustar !== undefined && ki !== null && ki > 0 && (
                <>
                  {falta > 0 && (
                    <span className="dbf-motivo" id={`${idBase}-${h.id}`}>
                      Falta {falta} Ki
                    </span>
                  )}
                  <button
                    type="button"
                    className="dbf-btn dbf-btn--sm"
                    disabled={falta > 0}
                    aria-describedby={falta > 0 ? `${idBase}-${h.id}` : undefined}
                    onClick={() => ajustar({ parte: 'recurso', chave: 'pk', valor: Math.max(0, pkAtual - ki) })}
                  >
                    Usar <span className="dbf-ki-cost">−{ki} Ki</span>
                  </button>
                </>
              )}
              {editando && (
                <button type="button" className="dbf-btn dbf-btn--sm dbf-btn--ghost" aria-label={`Tirar ${h.nome}`} onClick={() => tirar(h.id)}>
                  Tirar
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Quanto ainda cabe em cada lista: os movimentos extras do Humano Marcial só valem para movimento. */
function vagas(ficha: FichaDBT, disponiveis: number, movimentosExtras: number): Record<Lista, number> {
  const movimentosNaCota = Math.max(0, ficha.movimentos.length - movimentosExtras)
  const cota = disponiveis - ficha.talentos.length - movimentosNaCota
  const extrasLivres = Math.max(0, movimentosExtras - ficha.movimentos.length)
  return { talentos: cota, movimentos: cota + extrasLivres }
}

function EscolherDoLivro() {
  const { ficha, raca, derivados, ehMestre, ehNpc, mudarFicha } = useFichaDBT()
  const [lista, setLista] = useState<Lista>('talentos')
  const [busca, setBusca] = useState('')
  const sobra = vagas(ficha, derivados.talentos.disponiveis, derivados.talentos.movimentosExtras)
  const semLimite = ehMestre || ehNpc
  const limite = lista === 'talentos' ? LIMITES_DBT.talentos : LIMITES_DBT.movimentos
  const cheia = ficha[lista].length >= limite
  const naFicha = new Set(ficha[lista].map((h) => h.livroId))

  const opcoes: Opcao[] =
    lista === 'talentos'
      ? [
          ...(raca?.talentos ?? []).map((t) => ({ id: t.id, nome: t.nome, detalhe: [t.tipoTexto, t.requisito === null ? '' : `Requisito: ${t.requisito}`].filter((p) => p !== '').join('. '), efeito: t.efeito, custoKi: null, daRaca: true })),
          ...TALENTOS.map((t) => ({ id: t.id, nome: t.nome, detalhe: [t.tipoTexto, t.requisito === null ? '' : `Requisito: ${t.requisito}`].filter((p) => p !== '').join('. '), efeito: t.efeito, custoKi: null, daRaca: false })),
        ]
      : MOVIMENTOS_MARCIAIS.map((m) => ({
          id: m.id,
          nome: m.nome,
          detalhe: [m.custoTexto === '' ? '' : `Ki ${m.custoTexto}`, m.combinaCom === null ? '' : `combina com técnica ${m.combinaCom === 'ki' ? 'de Ki' : 'física'}`, m.requisito === null ? '' : `Requisito: ${m.requisito}`].filter((p) => p !== '').join('. '),
          efeito: m.efeito,
          custoKi: m.custoKi,
          daRaca: false,
        }))
  const termos = nomeNormalizado(busca).split(' ').filter((t) => t !== '')
  const visiveis = termos.length === 0 ? opcoes : opcoes.filter((o) => termos.every((t) => nomeNormalizado(`${o.nome} ${o.efeito}`).includes(t)))

  const escolher = (o: Opcao) => {
    const nova: HabilidadeDaFichaDBT = { id: novoIdDBT(lista === 'talentos' ? 'tal' : 'mov'), livroId: o.id, nome: o.nome, efeito: o.daRaca ? o.efeito : '', custoKi: null }
    mudarFicha((f) => comLista(f, lista, [...f[lista], nova]))
  }
  const motivoGeral = cheia ? `A lista já tem ${limite}, o máximo.` : !semLimite && sobra[lista] <= 0 ? 'Sem vaga: o próximo vem a cada 20.000 PDL.' : null

  return (
    <div className="dbf-sec dbf-pick">
      <h4 className="dbf-sec__t">Escolher do livro</h4>
      <div className="dbf-pick__top">
        <Segmentos
          rotulo="Lista do livro"
          opcoes={[
            { valor: 'talentos', texto: `Talentos ${TALENTOS.length + (raca?.talentos.length ?? 0)}` },
            { valor: 'movimentos', texto: `Movimentos ${MOVIMENTOS_MARCIAIS.length}` },
          ]}
          valor={lista}
          onTrocar={setLista}
        />
        <input type="search" className="dbf-inp" value={busca} maxLength={60} aria-label="Buscar no livro" placeholder="Buscar pelo nome ou efeito" onChange={(e) => setBusca(e.target.value)} />
      </div>
      {motivoGeral !== null && <p className="dbf-motivo">{motivoGeral}</p>}
      {visiveis.length === 0 && <p className="dbf-vazio dbf-vazio--curto">Nada com “{busca.trim()}”. Tente parte do nome.</p>}
      <div className="dbf-pick__lista">
        {visiveis.map((o) => {
          const ja = naFicha.has(o.id)
          return (
            <div key={`${o.daRaca ? 'raca' : 'livro'}-${o.id}`} className="dbf-bk">
              <div>
                <h5>
                  {o.nome}
                  {o.daRaca && <span className="dbf-tag dbf-tag--amber">Da raça</span>}
                </h5>
                {o.detalhe !== '' && <p className="dbf-bk__req">{o.detalhe}</p>}
                <TextoQueAbre texto={o.efeito} className="dbf-bk__ef" />
              </div>
              <div className="dbf-bk__acts">
                <button type="button" className={`dbf-btn dbf-btn--sm${ja ? ' dbf-btn--on' : ''}`} disabled={ja || motivoGeral !== null} onClick={() => escolher(o)}>
                  {ja ? 'Na ficha' : 'Escolher'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HabilidadeLivre() {
  const { ficha, mudarFicha } = useFichaDBT()
  const [lista, setLista] = useState<Lista>('talentos')
  const [nome, setNome] = useState('')
  const [efeito, setEfeito] = useState('')
  const [ki, setKi] = useState('')
  const limite = lista === 'talentos' ? LIMITES_DBT.talentos : LIMITES_DBT.movimentos
  const cheia = ficha[lista].length >= limite
  const custo = inteiroDoCampo(ki)
  const kiInvalido = ki.trim() !== '' && (custo === null || custo < 0)
  const criar = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (nome.trim() === '' || cheia || kiInvalido) return
    const nova: HabilidadeDaFichaDBT = { id: novoIdDBT(lista === 'talentos' ? 'tal' : 'mov'), livroId: null, nome: nome.trim(), efeito: efeito.trim(), custoKi: custo !== null && custo > 0 ? custo : null }
    mudarFicha((f) => comLista(f, lista, [...f[lista], nova]))
    setNome('')
    setEfeito('')
    setKi('')
  }
  return (
    <form className="dbf-novo" onSubmit={criar}>
      <h4 className="dbf-sec__t">Livre, combinado com o mestre</h4>
      <div className="dbf-novo__linha">
        <Segmentos
          rotulo="Vai para"
          opcoes={[
            { valor: 'talentos', texto: 'Talento' },
            { valor: 'movimentos', texto: 'Movimento' },
          ]}
          valor={lista}
          onTrocar={setLista}
        />
        <label className="dbf-fld">
          <span>Nome</span>
          <input className="dbf-inp" value={nome} maxLength={LIMITES_DBT.nome} onChange={(e) => setNome(e.target.value)} />
        </label>
        <label className="dbf-fld dbf-fld--curto">
          <span>Ki por uso</span>
          <input className="dbf-inp dbf-inp--num" inputMode="numeric" value={ki} placeholder="0" aria-invalid={kiInvalido} onChange={(e) => setKi(e.target.value)} />
        </label>
      </div>
      <label className="dbf-fld">
        <span>Efeito</span>
        <textarea className="dbf-inp dbf-area" rows={2} value={efeito} maxLength={LIMITES_DBT.texto} onChange={(e) => setEfeito(e.target.value)} />
      </label>
      <div className="dbf-novo__fim">
        {cheia && <span className="dbf-motivo">A lista já tem {limite}, o máximo.</span>}
        {kiInvalido && <span className="dbf-motivo">Ki é um número inteiro, 0 ou mais.</span>}
        <button type="submit" className="dbf-btn dbf-btn--sm" disabled={nome.trim() === '' || cheia || kiInvalido}>
          Adicionar {lista === 'talentos' ? 'talento' : 'movimento'}
        </button>
      </div>
    </form>
  )
}
