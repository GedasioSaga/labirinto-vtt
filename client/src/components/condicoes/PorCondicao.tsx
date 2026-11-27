import { useId, useState, type FormEvent } from 'react'
import { condicaoDoCatalogo, type CondicaoDoCatalogo } from '../../lib/condicoes/catalogo'
import { duracaoDaOpcao, fraseDaDuracao, fraseDaRegra, fraseDoPrazo, OPCOES_DE_DURACAO } from '../../lib/condicoes/frases'
import { fraseCurta, type ContextoDasFrases } from '../../lib/condicoes/frasesDaCondicao'
import { TURNOS_PADRAO_DA_CONDICAO, turnosDoPrazo, type PrazoDaCondicao } from '../../lib/condicoes/modelo'
import type { DuracaoDaCondicao, PedidoDeCondicao } from '../../lib/condicoes/naFicha'
import { simboloDaCondicaoPropria } from '../../lib/condicoesProprias'
import type { CondicaoNaFicha } from '../../lib/itens/modelo'
import { TOKEN_CONDITION_SYMBOLS, type ConditionSymbol } from '../../lib/tokenConditions'
import type { CondicaoPropria } from '../../types/map'
import { PastilhaDeCondicao } from '../PastilhaDeCondicao'
import './condicoes.css'

/**
 * AS PEÇAS DA CONDIÇÃO NA FICHA (itens refeitos, E4b; rework das condições, E6): o chip da condição posta
 * (pastilha, nome, prazo, o que ela faz e o ✕ que tira) e o "Pôr condição" (em quem, qual e por quanto
 * tempo). Quem põe escolhe só qual e os turnos (D6): a regra mora na condição, no editor. O número próprio
 * de antes (a criada de antes com o "n" da ficha) continua valendo e fica à vista no chip, como "regra
 * própria (de antes)" (D4). Os mesmos no menu do token, no painel do token e em Livros › Condições.
 */

/** O desenho da pastilha de uma condição do catálogo: a de fábrica pelo id, a criada pela cor e o símbolo dela. */
export function simboloDoCatalogo(condicao: CondicaoDoCatalogo): ConditionSymbol {
  return condicao.pastilha.tipo === 'fabrica' ? TOKEN_CONDITION_SYMBOLS[condicao.pastilha.condicao] : simboloDaCondicaoPropria(condicao.pastilha.condicao)
}

/** O catálogo em volta para as frases: as montadas de todas. */
export function contextoDoCatalogo(catalogo: readonly CondicaoDoCatalogo[]): ContextoDasFrases {
  return { todas: catalogo.map((condicao) => condicao.montada) }
}

/** "Regra própria (de antes): tira 5 de vida no começo da vez": o número que a posta trouxe e que vence o da condição. */
export function regraPropriaDeAntes(posta: Pick<CondicaoNaFicha, 'n'>, doCatalogo: CondicaoDoCatalogo): string | null {
  if (posta.n === undefined || doCatalogo.regra === 'narra' || posta.n === doCatalogo.n) return null
  return `regra própria (de antes): ${fraseDaRegra(doCatalogo.regra, posta.n)}`
}

export interface ChipDaCondicaoProps {
  condicao: CondicaoNaFicha
  criadas: readonly CondicaoPropria[]
  /** O ✕ do chip. Ausente = só lê (o jogador, decisão 18). */
  onTirar?: (condicao: CondicaoNaFicha, nome: string) => void
}

/** A condição posta: pastilha, nome, o prazo e o que ela faz. A criada que foi apagada do catálogo aparece riscada, para dar para tirar. */
export function ChipDaCondicao({ condicao, criadas, onTirar }: ChipDaCondicaoProps) {
  const doCatalogo = condicaoDoCatalogo(condicao.condId, criadas)
  const nome = doCatalogo?.nome ?? 'Condição apagada'
  const faz = doCatalogo === null ? null : fraseCurta(doCatalogo.montada)
  const propria = doCatalogo === null ? null : regraPropriaDeAntes(condicao, doCatalogo)
  const pilhas = condicao.pilhas !== undefined && condicao.pilhas > 1 ? `${condicao.pilhas} pilhas` : null
  const detalhe = [fraseDoPrazo(condicao), pilhas, propria ?? faz, condicao.origem === undefined ? null : `de ${condicao.origem}`].filter((parte): parte is string => parte !== null && parte !== '').join(' · ')
  return (
    <span className="cd-chip" data-apagada={doCatalogo === null ? '' : undefined} title={propria !== null && faz !== null ? `${nome}: ${faz}` : undefined}>
      {doCatalogo !== null && <PastilhaDeCondicao symbol={simboloDoCatalogo(doCatalogo)} tamanho={16} />}
      <span className="cd-chip__txt">
        <span className="cd-chip__nome">{nome}</span>
        <span className="cd-chip__prazo">{detalhe}</span>
      </span>
      {onTirar !== undefined && (
        <button type="button" className="cd-chip__x" aria-label={`Tirar ${nome}`} onClick={() => onTirar(condicao, nome)}>
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
          </svg>
        </button>
      )}
    </span>
  )
}

export interface ChipsDaFichaProps {
  condicoes: readonly CondicaoNaFicha[]
  criadas: readonly CondicaoPropria[]
  onTirar?: (condicao: CondicaoNaFicha, nome: string) => void
  /** A frase quando não há nenhuma. */
  vazio?: string
}

export function ChipsDaFicha({ condicoes, criadas, onTirar, vazio = 'Sem condição agora.' }: ChipsDaFichaProps) {
  if (condicoes.length === 0) return <p className="cd-nota">{vazio}</p>
  return (
    <ul className="cd-chips" aria-label="Condições da ficha">
      {condicoes.map((condicao) => (
        <li key={condicao.id}>
          <ChipDaCondicao condicao={condicao} criadas={criadas} onTirar={onTirar} />
        </li>
      ))}
    </ul>
  )
}

/** Uma ficha que pode receber a condição (o NPC: a cópia daquele token). */
export interface AlvoDaCondicao {
  id: string
  nome: string
}

/** O prazo da condição como a ficha o guarda (D6, "o prazo dela"): a ficha não sabe do próximo golpe, então ele dura até tirarem. */
export function duracaoDoPrazo(prazo: PrazoDaCondicao): DuracaoDaCondicao {
  if (prazo.modo === 'turnos') return turnosDoPrazo(prazo) ?? TURNOS_PADRAO_DA_CONDICAO
  return prazo.modo === 'batalha' ? 'fim' : 'tirar'
}

export interface FormDePorCondicaoProps {
  alvos: readonly AlvoDaCondicao[]
  catalogo: readonly CondicaoDoCatalogo[]
  /** Põe; `true` = pôs (o formulário fica como está, para pôr a mesma em outro). */
  onPor: (alvoIds: readonly string[], pedido: PedidoDeCondicao) => boolean
  /** A condição que nasce escolhida (a aberta na tela Condições). */
  condIdInicial?: string
  /** No submenu do token: os campos um embaixo do outro. */
  compacto?: boolean
  /** "Criar condição…": abre o editor da condição (D13). Ausente = sem o botão. */
  onCriar?: () => void
}

const TODOS = '__todos__'
/** A opção "o prazo dela" (D6): a duração vem da condição. */
const PRAZO_DELA = 'dela'

/**
 * "PÔR CONDIÇÃO EM ALGUÉM": Em quem (só com mais de uma ficha; "Todas" põe em cada uma), Condição (o
 * catálogo, negativas e positivas, com a frase curta embaixo) e Duração ("o prazo dela", que nasce
 * escolhido, ou N turnos, até o fim da batalha, até alguém tirar). Enter em qualquer campo põe.
 */
export function FormDePorCondicao({ alvos, catalogo, onPor, condIdInicial, compacto = false, onCriar }: FormDePorCondicaoProps) {
  const idBase = useId()
  const [quem, setQuem] = useState(alvos[0]?.id ?? '')
  const [condId, setCondId] = useState(condIdInicial ?? catalogo[0]?.id ?? '')
  const [duracao, setDuracao] = useState(PRAZO_DELA)
  const escolhida = catalogo.find((condicao) => condicao.id === condId) ?? catalogo[0]
  // A lista de fichas mudou (outra seleção, a cópia saiu do mapa): vale a primeira de agora.
  const quemDeAgora = quem === TODOS || alvos.some((alvo) => alvo.id === quem) ? quem : (alvos[0]?.id ?? '')
  const prazo = escolhida === undefined ? null : duracao === PRAZO_DELA ? duracaoDoPrazo(escolhida.montada.prazo) : duracaoDaOpcao(duracao)
  const pode = escolhida !== undefined && quemDeAgora !== '' && prazo !== null
  const grupo = (tipo: 'negativa' | 'positiva') => catalogo.filter((condicao) => condicao.montada.tipo === tipo)

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    if (!pode || escolhida === undefined || prazo === null) return
    const ids = quemDeAgora === TODOS ? alvos.map((alvo) => alvo.id) : [quemDeAgora]
    onPor(ids, { condId: escolhida.id, duracao: prazo })
  }

  if (alvos.length === 0) return <p className="cd-nota">Ninguém com ficha para receber condição agora.</p>
  return (
    <form className="cd-por" data-compacto={compacto ? '' : undefined} aria-label="Pôr condição" onSubmit={enviar}>
      {alvos.length > 1 && (
        <label className="cd-campo" htmlFor={`${idBase}-quem`}>
          <span className="cd-campo__rot">Em quem</span>
          <select id={`${idBase}-quem`} className="lb-input" value={quemDeAgora} onChange={(evento) => setQuem(evento.target.value)}>
            {alvos.map((alvo) => (
              <option key={alvo.id} value={alvo.id}>
                {alvo.nome}
              </option>
            ))}
            <option value={TODOS}>Todas as {alvos.length} fichas</option>
          </select>
        </label>
      )}
      <label className="cd-campo" htmlFor={`${idBase}-cond`}>
        <span className="cd-campo__rot">Condição</span>
        <select id={`${idBase}-cond`} className="lb-input" value={escolhida?.id ?? ''} onChange={(evento) => setCondId(evento.target.value)}>
          <optgroup label="Negativas">
            {grupo('negativa').map((condicao) => (
              <option key={condicao.id} value={condicao.id}>
                {condicao.nome}
              </option>
            ))}
          </optgroup>
          <optgroup label="Positivas">
            {grupo('positiva').map((condicao) => (
              <option key={condicao.id} value={condicao.id}>
                {condicao.nome}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <label className="cd-campo" htmlFor={`${idBase}-dur`}>
        <span className="cd-campo__rot">Duração</span>
        <select id={`${idBase}-dur`} className="lb-input" value={duracao} onChange={(evento) => setDuracao(evento.target.value)}>
          <option value={PRAZO_DELA}>o prazo dela{escolhida === undefined ? '' : ` (${fraseDaDuracao(duracaoDoPrazo(escolhida.montada.prazo))})`}</option>
          {OPCOES_DE_DURACAO.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.texto}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="lb-btn cd-por__botao" disabled={!pode}>
        Pôr condição
      </button>
      {escolhida !== undefined && (
        <p className="cd-nota cd-por__regra">
          {escolhida.nome}: {fraseCurta(escolhida.montada, contextoDoCatalogo(catalogo))}
        </p>
      )}
      {onCriar !== undefined && (
        <button type="button" className="cd-por__criar" onClick={onCriar}>
          Criar condição…
        </button>
      )}
    </form>
  )
}
