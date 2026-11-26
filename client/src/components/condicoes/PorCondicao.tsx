import { useId, useState, type FormEvent } from 'react'
import { condicaoDoCatalogo, type CondicaoDoCatalogo } from '../../lib/condicoes/catalogo'
import { duracaoDaOpcao, fraseDaRegra, fraseDoPrazo, numeroQueVale, OPCOES_DE_DURACAO, rotuloDoNumero, tetoDoNumero } from '../../lib/condicoes/frases'
import type { PedidoDeCondicao } from '../../lib/condicoes/naFicha'
import { simboloDaCondicaoPropria } from '../../lib/condicoesProprias'
import type { CondicaoNaFicha } from '../../lib/itens/modelo'
import { TOKEN_CONDITION_SYMBOLS, type ConditionSymbol } from '../../lib/tokenConditions'
import type { CondicaoPropria } from '../../types/map'
import { PastilhaDeCondicao } from '../PastilhaDeCondicao'
import './condicoes.css'

/**
 * AS PEÇAS DA CONDIÇÃO NA FICHA (sistema de itens refeito, etapa E4b): o chip da condição posta
 * (pastilha, nome, prazo e o ✕ que tira) e o formulário "Pôr condição" (em quem, qual, por quanto
 * tempo e o número da regra). As mesmas no menu do token, no painel do token e na tela Condições do
 * livro, como no protótipo aprovado (`formPorCondicao`, `chipCond`).
 */

/** O desenho da pastilha de uma condição do catálogo: a de fábrica pelo id, a criada pela cor e o símbolo dela. */
export function simboloDoCatalogo(condicao: CondicaoDoCatalogo): ConditionSymbol {
  return condicao.pastilha.tipo === 'fabrica' ? TOKEN_CONDITION_SYMBOLS[condicao.pastilha.condicao] : simboloDaCondicaoPropria(condicao.pastilha.condicao)
}

export interface ChipDaCondicaoProps {
  condicao: CondicaoNaFicha
  criadas: readonly CondicaoPropria[]
  /** O ✕ do chip. Ausente = só lê (o jogador, decisão 18). */
  onTirar?: (condicao: CondicaoNaFicha, nome: string) => void
}

/** A condição posta: pastilha, nome, o prazo e o que a regra faz. A criada que foi apagada do catálogo aparece riscada, para dar para tirar. */
export function ChipDaCondicao({ condicao, criadas, onTirar }: ChipDaCondicaoProps) {
  const doCatalogo = condicaoDoCatalogo(condicao.condId, criadas)
  const nome = doCatalogo?.nome ?? 'Condição apagada'
  const regra = doCatalogo === null || doCatalogo.regra === 'narra' ? null : fraseDaRegra(doCatalogo.regra, numeroQueVale(condicao, doCatalogo))
  const detalhe = [fraseDoPrazo(condicao), regra, condicao.origem === undefined ? null : `de ${condicao.origem}`].filter((parte): parte is string => parte !== null).join(' · ')
  return (
    <span className="cd-chip" data-apagada={doCatalogo === null ? '' : undefined}>
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

export interface FormDePorCondicaoProps {
  alvos: readonly AlvoDaCondicao[]
  catalogo: readonly CondicaoDoCatalogo[]
  /** Põe; `true` = pôs (o formulário fica como está, para pôr a mesma em outro). */
  onPor: (alvoIds: readonly string[], pedido: PedidoDeCondicao) => boolean
  /** A condição que nasce escolhida (a aberta na tela Condições). */
  condIdInicial?: string
  /** No submenu do token: os campos um embaixo do outro. */
  compacto?: boolean
}

const TODOS = '__todos__'
const DURACAO_INICIAL = '2'

/**
 * "PÔR CONDIÇÃO EM ALGUÉM": Em quem (só com mais de uma ficha; "Todas" põe em cada uma), Condição,
 * Duração e, na que tira vida ou corta a cura, o número (nasce o do catálogo; o item ou a armadilha
 * podem ter o seu). Enter em qualquer campo põe.
 */
export function FormDePorCondicao({ alvos, catalogo, onPor, condIdInicial, compacto = false }: FormDePorCondicaoProps) {
  const idBase = useId()
  const [quem, setQuem] = useState(alvos[0]?.id ?? '')
  const [condId, setCondId] = useState(condIdInicial ?? catalogo[0]?.id ?? '')
  const [duracao, setDuracao] = useState(DURACAO_INICIAL)
  const [numero, setNumero] = useState<string | null>(null)
  const escolhida = catalogo.find((condicao) => condicao.id === condId) ?? catalogo[0]
  const rotuloDoN = escolhida === undefined ? null : rotuloDoNumero(escolhida.regra)
  const textoDoN = numero ?? String(escolhida?.n ?? 0)
  const n = Number.parseInt(textoDoN, 10)
  const nValido = rotuloDoN === null || (escolhida !== undefined && Number.isInteger(n) && n >= 0 && n <= tetoDoNumero(escolhida.regra))
  // A lista de fichas mudou (outra seleção, a cópia saiu do mapa): vale a primeira de agora.
  const quemDeAgora = quem === TODOS || alvos.some((alvo) => alvo.id === quem) ? quem : (alvos[0]?.id ?? '')
  const pode = escolhida !== undefined && quemDeAgora !== '' && nValido && duracaoDaOpcao(duracao) !== null

  const trocarCondicao = (id: string) => {
    setCondId(id)
    // Outra condição, outro número de fábrica: o digitado não passa de uma para a outra.
    setNumero(null)
  }

  const enviar = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const prazo = duracaoDaOpcao(duracao)
    if (!pode || escolhida === undefined || prazo === null) return
    const ids = quemDeAgora === TODOS ? alvos.map((alvo) => alvo.id) : [quemDeAgora]
    onPor(ids, { condId: escolhida.id, duracao: prazo, ...(rotuloDoN === null || n === escolhida.n ? {} : { n }) })
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
        <select id={`${idBase}-cond`} className="lb-input" value={escolhida?.id ?? ''} onChange={(evento) => trocarCondicao(evento.target.value)}>
          {catalogo.map((condicao) => (
            <option key={condicao.id} value={condicao.id}>
              {condicao.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="cd-campo" htmlFor={`${idBase}-dur`}>
        <span className="cd-campo__rot">Duração</span>
        <select id={`${idBase}-dur`} className="lb-input" value={duracao} onChange={(evento) => setDuracao(evento.target.value)}>
          {OPCOES_DE_DURACAO.map((opcao) => (
            <option key={opcao.valor} value={opcao.valor}>
              {opcao.texto}
            </option>
          ))}
        </select>
      </label>
      {rotuloDoN !== null && escolhida !== undefined && (
        <label className="cd-campo cd-campo--num" htmlFor={`${idBase}-n`}>
          <span className="cd-campo__rot">{rotuloDoN}</span>
          <input
            id={`${idBase}-n`}
            className="lb-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            value={textoDoN}
            aria-invalid={!nValido}
            onChange={(evento) => setNumero(evento.target.value.replace(/\D/g, ''))}
          />
        </label>
      )}
      <button type="submit" className="lb-btn cd-por__botao" disabled={!pode}>
        Pôr condição
      </button>
      {escolhida !== undefined && (
        <p className="cd-nota cd-por__regra">
          {escolhida.nome}: {fraseDaRegra(escolhida.regra, nValido && rotuloDoN !== null ? n : escolhida.n)}.
        </p>
      )}
    </form>
  )
}
