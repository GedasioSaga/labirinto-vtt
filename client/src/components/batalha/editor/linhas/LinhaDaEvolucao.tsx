import { useId, useMemo } from 'react'
import { basesDaEvolucao, evolucaoDe, EXTRAS_DA_EVOLUCAO, temExtrasDaEvolucao } from '../../../../lib/batalha/escolhaEEvolucao'
import { normalizar } from '../../../../lib/batalha/formula'
import { lerRequisitos } from '../../../../lib/batalha/requisitos/ler'
import type { ValorJson } from '../../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha, Personagem } from '../../../../lib/personagem'
import { BlocoDosRequisitos, type ListasDosRequisitos } from '../../blocos/BlocoDosRequisitos'
import type { OpcoesDasFontes } from '../../blocos/requisitosNaTela'
import { blocoCru, blocoParaLer, comEvoluir, todosCru } from '../requisitosDoCartao'
import { ResumoDosRequisitos } from './ResumoDosRequisitos'

interface LinhaDaEvolucaoProps {
  cartao: CartaoDaFicha
  /** As técnicas da ficha (com esta), para o "Evolui para". */
  tecnicas: readonly CartaoDaFicha[]
  personagem: Personagem
  fontes: OpcoesDasFontes
  listas: ListasDosRequisitos
  custoEmSp: number
  onChange: (cartao: CartaoDaFicha) => void
}

const EH_O_LINK = (nome: string): boolean => /^evolui (?:para|pra)$/.test(normalizar(nome).trim())

/** O cartão com o "Evolui para" trocado; `null` = não evolui mais: saem os extras da evolução e o grupo de evoluir. */
function comLink(cartao: CartaoDaFicha, para: string | null): CartaoDaFicha {
  const indice = cartao.extras.findIndex((extra) => EH_O_LINK(extra.nome))
  if (para === null) {
    const semLink = { ...cartao, extras: cartao.extras.filter((extra) => !temExtrasDaEvolucao({ extras: [extra] })) }
    return comEvoluir(semLink, null)
  }
  const extras = indice < 0 ? [...cartao.extras, { nome: EXTRAS_DA_EVOLUCAO.para, valor: para }] : cartao.extras.map((extra, i) => (i === indice ? { ...extra, valor: para } : extra))
  return { ...cartao, extras }
}

/**
 * LINHA EVOLUÇÃO (EDITOR.md §3.6; protótipo `htmlEvolucao`; REQUISITOS.md I3): para qual versão a
 * técnica evolui (o extra "Evolui para", que a batalha já lê) e o que pede para evoluir (o grupo
 * `requisitos.evoluir`, que liga o botão Evoluir). Evoluída, vale até usar uma vez (`dura: 'umUso'`).
 */
export function LinhaDaEvolucao({ cartao, tecnicas, personagem, fontes, listas, custoEmSp, onChange }: LinhaDaEvolucaoProps) {
  const seletorId = useId()
  const evolucao = useMemo(() => evolucaoDe(cartao, tecnicas), [cartao, tecnicas])
  const bases = useMemo(() => basesDaEvolucao(cartao, tecnicas), [cartao, tecnicas])
  const todos = useMemo(() => todosCru(blocoCru(cartao), 'evoluir'), [cartao])
  const lidos = useMemo(() => lerRequisitos(blocoParaLer(todos, 'evoluir')), [todos])
  const outras = tecnicas.filter((outra) => outra.id !== cartao.id && outra.nome.trim() !== '')
  const paraEscrito = evolucao?.paraEscrito ?? ''
  const para = evolucao?.para ?? null

  if (bases.length > 0 && evolucao === null) {
    return <p className="lb-ed__vazio">Esta é a versão evoluída de {bases.map((base) => base.nome.trim()).join(', ')}: os requisitos para virar ela ficam na técnica comum.</p>
  }

  if (evolucao === null || (paraEscrito === '' && evolucao.texto === '')) {
    const sugestao = evolucao?.sugestao ?? null
    return (
      <>
        <p className="lb-ed__vazio">Não evolui.</p>
        <div className="lb-ed__linha-acoes">
          <label className="lb-ed__rot" htmlFor={seletorId}>
            Evolui para
          </label>
          <select id={seletorId} className="lb-input lb-ed__sel" value="" onChange={(evento) => evento.target.value !== '' && onChange(comEvoluir(comLink(cartao, evento.target.value), []))}>
            <option value="">escolha a versão evoluída</option>
            {outras.map((outra) => (
              <option key={outra.id} value={outra.nome.trim()}>
                {outra.nome.trim()}
              </option>
            ))}
          </select>
          {sugestao !== null && (
            <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p" onClick={() => onChange(comEvoluir(comLink(cartao, sugestao.nome.trim()), []))}>
              Evolui para {sugestao.nome.trim()}
            </button>
          )}
        </div>
        <p className="lb-ed__dica">A versão evoluída é outra técnica da ficha (a SUPER, a Overload). Crie o cartão dela antes, se ainda não existe.</p>
      </>
    )
  }

  const nomeDaSuper = para?.nome.trim() ?? paraEscrito
  return (
    <>
      <p className="lb-ed__frase">
        Cumpridos os requisitos, vira{' '}
        <select className="lb-input lb-ed__sel" aria-label="Evolui para" value={para === null ? paraEscrito : para.nome.trim()} onChange={(evento) => onChange(comLink(cartao, evento.target.value))}>
          {para === null && paraEscrito !== '' && <option value={paraEscrito}>{paraEscrito} (não achada na ficha)</option>}
          {outras.map((outra) => (
            <option key={outra.id} value={outra.nome.trim()}>
              {outra.nome.trim()}
            </option>
          ))}
        </select>{' '}
        até usar uma vez; depois volta a esta.
      </p>
      {paraEscrito === '' && evolucao.texto !== '' && <p className="lb-ed__dica">Evolução escrita no cartão, sem link: "{evolucao.texto}". Escolha a versão evoluída para o botão Evoluir trocar de técnica.</p>}
      {evolucao.condicoes !== '' && <p className="lb-ed__dica">Condições escritas antes (só para ler): "{evolucao.condicoes}". O que o app confere são os requisitos abaixo.</p>}
      <BlocoDosRequisitos
        todos={todos}
        lidos={lidos.bloco?.evoluir?.grupo.todos ?? []}
        fontes={fontes}
        listas={listas}
        vazio="Sem requisito: o Evoluir fica livre na batalha (o mestre confere)."
        onChange={(novos: ValorJson[]) => onChange(comEvoluir(cartao, novos))}
      />
      <ResumoDosRequisitos todos={todos} qual="evoluir" nome={nomeDaSuper} personagem={personagem} custoEmSp={custoEmSp} />
      <div>
        <button type="button" className="lb-ed__bt lb-ed__bt--fantasma lb-ed__bt--p" onClick={() => onChange(comLink(cartao, null))}>
          Não evolui mais
        </button>
      </div>
    </>
  )
}
