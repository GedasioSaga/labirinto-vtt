import { useId } from 'react'
import { PERICIAS } from '../../../lib/dbt/dados/pericias'
import { DERIVADOS_AJUSTAVEIS, IDS_DOS_ATRIBUTOS, type DerivadoAjustavelDBT, type IdAtributoDBT, type IdPericiaDBT } from '../../../lib/dbt/modelo'
import { SIGLA_DO_ATRIBUTO, modificador } from '../../../lib/dbt/regras/atributos'
import { PDL_DO_MARCO_DE_ATRIBUTO, PERICIAS_INICIAIS, type DerivadoDBT } from '../../../lib/dbt/regras/ficha'
import { avisosDosAtributosDoNpc } from '../../../lib/dbt/regras/npc'
import { useFichaDBT, type IdDaAbaDBT } from './contexto'
import { NPC_PADRAO, PONTOS_DE_CRIACAO, atributoDoNpc, descerAtributo, numero, podeSubirAtributo, pontosDosAtributos, sinal, subirAtributo, valorDe, ATRIBUTO_DO_NPC_MAX, ATRIBUTO_DO_NPC_MIN } from './edicaoDaFicha'
import { Formula, inteiroDoCampo, Stepper, useDica, ContaDaDica } from './pecas'

/** Nomes do livro (2.1.1 a 2.1.7, p. 6-7). */
export const NOME_DO_ATRIBUTO: Readonly<Record<IdAtributoDBT, string>> = {
  for: 'Força',
  des: 'Destreza',
  con: 'Constituição',
  int: 'Inteligência',
  sab: 'Sabedoria',
  pod: 'Poder',
  pre: 'Presença',
}

const NOME_DO_AJUSTE: Readonly<Record<DerivadoAjustavelDBT, string>> = {
  pvMax: 'PV máximo',
  pkMax: 'PK máximo',
  ca: 'Classe de armadura',
  st: 'Slots de técnica',
  epBase: 'EP base',
  deslocamento: 'Deslocamento (m)',
  carga: 'Carga (espaços)',
}

export function AtributosDBT() {
  const { personagem, ficha, editando, ehNpc, ehMestre, mudar } = useFichaDBT()
  const pontos = pontosDosAtributos(personagem, IDS_DOS_ATRIBUTOS)
  const sobe = podeSubirAtributo(personagem, IDS_DOS_ATRIBUTOS)
  const proximoMarco = (Math.floor(ficha.pdl / PDL_DO_MARCO_DE_ATRIBUTO) + 1) * PDL_DO_MARCO_DE_ATRIBUTO
  const regraLivre = ehNpc
  const avisosDoNpc = ehNpc && ehMestre ? avisosDosAtributosDoNpc((ficha.npc ?? NPC_PADRAO).categoria, personagem.atributos) : []
  const usados = pontos.criacaoUsados + pontos.marcosGastos
  const total = pontos.criacaoTotal + pontos.marcosTotal

  return (
    <>
      <div className="dbf-h">
        <h3 className="dbf-h__t">Atributos</h3>
        {!regraLivre && (
          <Formula
            titulo="Pontos de atributo"
            conta={`${PONTOS_DE_CRIACAO} na criação (cada atributo começa em 8) + 2 a cada 30.000 PDL = ${total}`}
            nota={pontos.marcosTotal > 0 ? `Dos marcos: ${pontos.marcosGastos} de ${pontos.marcosTotal} gastos.` : null}
            className={`dbf-h__n${pontos.livres < 0 ? ' dbf-h__n--mal' : ''}`}
          >
            {usados} de {total} pontos
          </Formula>
        )}
      </div>
      {!regraLivre &&
        (pontos.livres > 0 ? (
          <p className="dbf-aviso dbf-aviso--amber">{pontos.livres === 1 ? '1 ponto para distribuir' : `${pontos.livres} pontos para distribuir`}{editando ? '.' : '. Distribua em Editar.'}</p>
        ) : pontos.livres < 0 ? (
          <p className="dbf-aviso dbf-aviso--mal">{-pontos.livres} acima do permitido. Tire pontos de algum atributo.</p>
        ) : (
          <p className="dbf-aviso dbf-aviso--calmo">Tudo distribuído. Mais 2 pontos em {numero(proximoMarco)} PDL.</p>
        ))}
      {regraLivre && ehMestre && (
        <p className="dbf-aviso dbf-aviso--calmo">NPC não tem orçamento de pontos: o livro dá um guia por categoria, que só avisa.</p>
      )}
      {avisosDoNpc.map((aviso) => (
        <p key={aviso} className="dbf-aviso dbf-aviso--amber">
          {aviso}
        </p>
      ))}
      <div className="dbf-attrs">
        {IDS_DOS_ATRIBUTOS.map((id) => {
          const valor = valorDe(personagem, id)
          const mod = modificador(valor)
          const nome = NOME_DO_ATRIBUTO[id]
          return (
            <div key={id} className="dbf-attr">
              <div className="dbf-attr__id">
                <abbr className="dbf-attr__ab" title={nome}>
                  {SIGLA_DO_ATRIBUTO[id]}
                </abbr>
                <span className="dbf-attr__nome">{nome}</span>
              </div>
              {editando ? (
                <Stepper
                  rotulo={nome}
                  valor={valor}
                  podeMenos={regraLivre ? valor > ATRIBUTO_DO_NPC_MIN : valor > 8}
                  podeMais={regraLivre ? valor < ATRIBUTO_DO_NPC_MAX : sobe}
                  onMenos={() => mudar((p) => (regraLivre ? atributoDoNpc(p, id, -1) : descerAtributo(p, id)))}
                  onMais={() => mudar((p) => (regraLivre ? atributoDoNpc(p, id, 1) : subirAtributo(p, id, IDS_DOS_ATRIBUTOS)))}
                />
              ) : (
                <span className="dbf-attr__v" aria-label={`${nome} ${valor}`}>
                  {valor}
                </span>
              )}
              <Formula
                titulo={`Modificador de ${nome}`}
                conta={`(${valor} − 10) ÷ 2, para baixo = ${sinal(mod)}`}
                nota={id === 'con' ? 'A CON entra pelo valor no PV (× 5).' : id === 'pod' ? 'O POD entra pelo valor no PK (× 2).' : null}
                className="dbf-attr__mod"
                rotulo={`Modificador de ${nome} ${sinal(mod)}`}
              >
                {sinal(mod)}
              </Formula>
            </div>
          )
        })}
      </div>
      <Derivados />
      {editando && ehMestre && <ValoresAMao />}
    </>
  )
}

interface Quadrinho {
  id: string
  rotulo: string
  valor: string
  de?: string
  derivado: DerivadoDBT | null
  titulo: string
  conta: string
  vai?: IdDaAbaDBT
  mal?: boolean
  ponto?: boolean
}

function Derivados() {
  const { derivados, ehNpc } = useFichaDBT()
  const t = derivados.talentos
  const totalDeTalentos = t.disponiveis + t.movimentosExtras
  const quadrinhos: Quadrinho[] = [
    { id: 'ca', rotulo: 'CA', valor: String(derivados.ca.valor), derivado: derivados.ca, titulo: 'Classe de armadura', conta: derivados.ca.formula },
    ...(ehNpc
      ? []
      : [
          { id: 'st', rotulo: 'ST', valor: String(derivados.stUsados), de: String(derivados.st.valor), derivado: derivados.st, titulo: 'Slots de técnica', conta: `${derivados.stUsados} em uso. ${derivados.st.formula}`, vai: 'tecnicas' as const, mal: derivados.stUsados > derivados.st.valor },
          { id: 'tal', rotulo: 'Talentos', valor: String(t.usados), de: String(totalDeTalentos), derivado: null, titulo: 'Talentos e movimentos', conta: t.formula, vai: 'talentos' as const, mal: t.restantes < 0, ponto: t.restantes > 0 },
        ]),
    { id: 'carga', rotulo: 'Carga', valor: String(derivados.cargaUsada), de: String(derivados.carga.valor), derivado: derivados.carga, titulo: 'Carga', conta: derivados.carga.formula, vai: 'inventario', mal: derivados.cargaUsada > derivados.carga.valor },
    { id: 'desl', rotulo: 'Deslocamento', valor: String(derivados.deslocamento.valor).replace('.', ','), de: undefined, derivado: derivados.deslocamento, titulo: 'Deslocamento', conta: derivados.deslocamento.formula },
  ]
  return (
    <div className="dbf-der">
      {quadrinhos.map((q) => (
        <QuadrinhoDerivado key={q.id} q={q} />
      ))}
    </div>
  )
}

function QuadrinhoDerivado({ q }: { q: Quadrinho }) {
  const { irPara } = useFichaDBT()
  const { props, dica } = useDica(<ContaDaDica titulo={q.titulo} conta={q.conta} nota={q.derivado?.manual === true ? 'Valor fixado à mão pelo mestre.' : q.vai !== undefined ? 'Clique para abrir a aba.' : null} />)
  const classe = `dbf-der__t${q.mal === true ? ' dbf-der__t--mal' : ''}`
  const corpo = (
    <>
      <span className="dbf-der__n">
        {q.valor}
        {q.de !== undefined && <small>/{q.de}</small>}
      </span>
      <span className="dbf-der__l">{q.rotulo}</span>
      {q.ponto === true && <span className="dbf-der__dot" aria-hidden="true" />}
      {q.derivado?.manual === true && <span className="dbf-der__mao">à mão</span>}
    </>
  )
  const vai = q.vai
  return (
    <>
      {vai !== undefined ? (
        <button type="button" {...props} className={classe} onClick={() => irPara(vai)}>
          {corpo}
        </button>
      ) : (
        <span {...props} tabIndex={0} className={classe}>
          {corpo}
        </span>
      )}
      {dica}
    </>
  )
}

/** O mestre fixa um derivado à mão (vale no lugar da conta); vazio = a conta do livro. */
function ValoresAMao() {
  const { ficha, derivados, mudarFicha } = useFichaDBT()
  const idBase = useId()
  const calculado: Record<DerivadoAjustavelDBT, number> = {
    pvMax: derivados.pvMax.calculado,
    pkMax: derivados.pkMax.calculado,
    ca: derivados.ca.calculado,
    st: derivados.st.calculado,
    epBase: derivados.epBase.calculado,
    deslocamento: derivados.deslocamento.calculado,
    carga: derivados.carga.calculado,
  }
  const quantos = Object.keys(ficha.ajustes).length
  return (
    <details className="dbf-mao">
      <summary>
        Valores à mão{quantos > 0 && <span className="dbf-h__n"> {quantos} fixado{quantos > 1 ? 's' : ''}</span>}
      </summary>
      <p className="dbf-nota">Vazio = vale a conta do livro. Use para NPC de ficha impressa ou regra da mesa.</p>
      <div className="dbf-mao__grade">
        {DERIVADOS_AJUSTAVEIS.map((chave) => (
          <label key={chave} className="dbf-fld" htmlFor={`${idBase}-${chave}`}>
            {NOME_DO_AJUSTE[chave]}
            <input
              id={`${idBase}-${chave}`}
              className="dbf-inp dbf-inp--num"
              type="number"
              step={chave === 'deslocamento' ? 1.5 : 1}
              placeholder={String(calculado[chave])}
              value={ficha.ajustes[chave] ?? ''}
              onChange={(event) => {
                const texto = event.target.value.trim()
                const valor = chave === 'deslocamento' ? Number(texto.replace(',', '.')) : inteiroDoCampo(texto)
                mudarFicha((f) => {
                  const ajustes = { ...f.ajustes }
                  if (texto === '' || valor === null || !Number.isFinite(valor)) delete ajustes[chave]
                  else ajustes[chave] = valor
                  return { ...f, ajustes }
                })
              }}
            />
          </label>
        ))}
      </div>
    </details>
  )
}

export function PericiasDBT() {
  const { ficha, derivados, editando, ehNpc, mudarFicha } = useFichaDBT()
  const idBase = useId()
  const treinadas = ficha.periciasTreinadas.length
  const limite = ehNpc ? Infinity : PERICIAS_INICIAIS
  const cheio = treinadas >= limite
  const trocar = (id: IdPericiaDBT, marcar: boolean) =>
    mudarFicha((f) => ({ ...f, periciasTreinadas: marcar ? [...f.periciasTreinadas, id] : f.periciasTreinadas.filter((p) => p !== id) }))
  return (
    <>
      <div className="dbf-h">
        <h3 className="dbf-h__t">Perícias</h3>
        <span className={`dbf-h__n${cheio && !ehNpc ? ' dbf-h__n--cheio' : ''}${treinadas > limite ? ' dbf-h__n--mal' : ''}`}>
          {ehNpc ? `${treinadas} treinadas` : `${treinadas} de ${PERICIAS_INICIAIS} treinadas`}
        </span>
      </div>
      <p className="dbf-aviso dbf-aviso--calmo" id={`${idBase}-regra`}>
        {!editando
          ? `Treinada soma a EP base (${sinal(derivados.epBase.valor)}).`
          : cheio && !ehNpc
            ? 'Cinco treinadas. Desmarque uma para trocar.'
            : `Marque ${ehNpc ? 'as do NPC' : 'até cinco'}. Treinada soma a EP base (${sinal(derivados.epBase.valor)}).`}
      </p>
      <div className="dbf-sks">
        {PERICIAS.map((pericia) => {
          const conta = derivados.pericias[pericia.id]
          const bloqueada = editando && !conta.treinada && cheio
          return (
            <div key={pericia.id} className={`dbf-sk${conta.treinada ? ' dbf-sk--tr' : ''}`}>
              {editando ? (
                <input
                  type="checkbox"
                  className="dbf-chk"
                  id={`${idBase}-${pericia.id}`}
                  checked={conta.treinada}
                  disabled={bloqueada}
                  aria-describedby={bloqueada ? `${idBase}-regra` : undefined}
                  onChange={(event) => trocar(pericia.id, event.target.checked)}
                />
              ) : (
                <span className={`dbf-chk dbf-chk--lido${conta.treinada ? ' dbf-chk--on' : ''}`} role="img" aria-label={conta.treinada ? 'treinada' : 'não treinada'} />
              )}
              {editando ? (
                <label htmlFor={`${idBase}-${pericia.id}`} className="dbf-sk__n">
                  {pericia.nome}
                </label>
              ) : (
                <span className="dbf-sk__n">{pericia.nome}</span>
              )}
              <abbr className="dbf-sk__a" title={NOME_DO_ATRIBUTO[pericia.atributo]}>
                {SIGLA_DO_ATRIBUTO[pericia.atributo]}
              </abbr>
              <Formula titulo={pericia.nome} conta={conta.formula} nota={pericia.descricao} className="dbf-sk__b" rotulo={`${pericia.nome} ${sinal(conta.bonus)}`}>
                {sinal(conta.bonus)}
              </Formula>
            </div>
          )
        })}
      </div>
    </>
  )
}
