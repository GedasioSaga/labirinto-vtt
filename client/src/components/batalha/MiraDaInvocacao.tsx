import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'
import { DANO_MAX, type AcaoDaTecnica } from '../../lib/batalha/combate'
import type { OpcaoDaInvocacao } from '../../lib/batalha/invocacao'
import { ImagemOuIniciais } from '../FichaPecas'
import { opcoesNaTela, pluralDoNome, textoDoCampo, type MotivoDaOpcao } from './dadosDaInvocacao'
import { formatarNumero, lerInteiro, textoDaAcao, type GolpeNaTela } from './dadosDoMenu'
import './batalha.css'
import './combate.css'

/**
 * A MIRA DA INVOCAÇÃO (F3 de docs/planos/batalha-invocacao-plano.md): a
 * técnica de Tipo Invocação não lança golpe, ela chama alguém. No papel da
 * mira de sempre: as opções em chips ("Lobos comuns", "Ultra Lobo", como os
 * de Escolha), a ficha de quem vem (os números grandes: HP, dano, quanto
 * anda), o que a opção exige (concentração, quantos em campo, quem sai), o
 * custo e o botão Invocar. Opção que não vale fica marcada e o Invocar
 * apaga com o motivo ao lado (máximo, carga, recarga, SP).
 *
 * Serve ao jogador (menu da vez) e ao mestre (painel do NPC). Quem põe no
 * mapa é sempre o mestre: a nota diz isso a quem pede.
 */

export interface MiraDaInvocacaoProps {
  /** A técnica como o menu a leu (nome, custo, ação, tempo e o motivo da técnica). */
  golpe: GolpeNaTela
  /** As opções da técnica (`lerInvocacao`). */
  opcoes: readonly OpcaoDaInvocacao[]
  /** A imagem do cartão da técnica; `null` = iniciais. */
  imagem: string | null
  /** Quantos desta opção o dono já tem (colocados + esperando). */
  contar: (opcao: OpcaoDaInvocacao) => number
  motivo: MotivoDaOpcao
  /** O pedido saiu? (`false` = sem conexão, vez passou, regra recusou.) */
  onInvocar: (opcao: string, custo: number | null, acao: AcaoDaTecnica | null) => boolean
  onVoltar: () => void
  /** O painel do NPC não tem Voltar (a lista fica ao lado). */
  semVoltar?: boolean
  /** Quem pede: o jogador lê "o mestre põe no mapa"; o mestre, "ponha pela lista Invocações". */
  quemPede: 'jogador' | 'mestre'
}

const ACOES_PERGUNTADAS: readonly AcaoDaTecnica[] = ['simples', 'completa', 'bonus', 'livre']

export function MiraDaInvocacao({ golpe, opcoes: opcoesDaFicha, imagem, contar, motivo, onInvocar, onVoltar, semVoltar, quemPede }: MiraDaInvocacaoProps) {
  const idBase = useId()
  const [custoTexto, setCustoTexto] = useState(golpe.custo.tipo === 'pergunta' && golpe.custo.sugestao !== null ? String(golpe.custo.sugestao) : '')
  const [acao, setAcao] = useState<AcaoDaTecnica | ''>('')
  const [erro, setErro] = useState<string | null>(null)
  const pergunta = golpe.custo.tipo === 'pergunta'
  const recurso = golpe.custo.tipo === 'nada' ? 'sp' : golpe.custo.recurso
  const custo = pergunta ? lerInteiro(custoTexto, DANO_MAX) : null
  const acaoDoPedido = golpe.acao === null && acao !== '' ? acao : null
  const opcoes = opcoesNaTela({ opcoes: opcoesDaFicha }, contar, motivo, pergunta ? (custo ?? 0) : null, acaoDoPedido ?? (golpe.acao === null ? 'livre' : null))
  // Começa na primeira que vale (a de sempre é a comum); sem nenhuma, na primeira.
  const [chave, setChave] = useState<string | null>(() => (opcoes.find((opcao) => opcao.motivo === null) ?? opcoes[0])?.chave ?? null)
  const escolhida = opcoes.find((opcao) => opcao.chave === chave) ?? opcoes[0] ?? null
  const bloqueio = escolhida?.motivo ?? null
  const comuns = escolhida?.ultra === true ? opcoes.find((opcao) => !opcao.ultra) : undefined

  const invocar = (evento: FormEvent) => {
    evento.preventDefault()
    if (escolhida === null || bloqueio !== null) return
    if (pergunta && custo === null) {
      setErro(`Digite o custo em ${recurso.toUpperCase()}.`)
      return
    }
    if (golpe.acao === null && acao === '') {
      setErro('A ficha não diz a ação: escolha uma.')
      return
    }
    const saiu = onInvocar(escolhida.chave, custo, acaoDoPedido)
    setErro(saiu ? null : 'A invocação não saiu: sem conexão com o mestre, ou a vez já passou. Tente de novo.')
  }

  const teclar = (evento: KeyboardEvent<HTMLFormElement>) => {
    if (evento.key !== 'Escape' || semVoltar) return
    evento.preventDefault()
    evento.stopPropagation()
    onVoltar()
  }

  const meta = [golpe.custoTexto, golpe.acaoTexto, golpe.tempoTexto].filter((parte): parte is string => parte !== null && parte !== '')
  const quem = escolhida?.nome ?? golpe.nome
  const regras: string[] = []
  if (escolhida !== null) {
    if (escolhida.carga > 0) regras.push(`Exige concentração ${escolhida.carga} e gasta as ${escolhida.carga} cargas`)
    if (comuns !== undefined) regras.push(`Ao entrar, os ${pluralDoNome(comuns.nome)} que estão em campo saem`)
    const campo = textoDoCampo(escolhida)
    if (campo !== '') regras.push(campo)
  }

  return (
    <form className="bt-mira bt-papel bt-invoca" onSubmit={invocar} onKeyDown={teclar} aria-labelledby={`${idBase}-nome`} noValidate>
      <p className="bt-mira__rot">Invocação</p>
      <h3 className="bt-mira__nome" id={`${idBase}-nome`}>
        {golpe.nome}
      </h3>
      {meta.length > 0 && (
        <p className="bt-mira__arma">
          {meta.map((parte) => (
            <span key={parte} className="bt-etq">
              {parte}
            </span>
          ))}
        </p>
      )}
      {opcoes.length > 1 && (
        <fieldset className="bt-escolha">
          <legend>Quem vem · um por uso</legend>
          <div className="bt-escolha__chips">
            {opcoes.map((opcao) => (
              <label key={opcao.chave} className="bt-escolha__chip" data-apagada={opcao.motivo === null ? undefined : 'sim'} title={opcao.motivo ?? (opcao.texto || undefined)}>
                <input
                  type="radio"
                  className="bt-sr"
                  name={`${idBase}-opcao`}
                  checked={escolhida?.chave === opcao.chave}
                  aria-describedby={opcao.motivo === null ? undefined : `${idBase}-motivo`}
                  onChange={() => {
                    setErro(null)
                    setChave(opcao.chave)
                  }}
                />
                {opcao.rotulo}
                {opcao.maximo !== null && (
                  <span className="bt-invoca__conta" aria-label={`${opcao.emCampo} de ${opcao.maximo} em campo`}>
                    {opcao.emCampo}/{opcao.maximo}
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {escolhida !== null && (
        <div className="bt-invoca__ficha" data-ultra={escolhida.ultra ? 'sim' : undefined} data-apagada={bloqueio === null ? undefined : 'sim'}>
          <span className="bt-invoca__retrato" aria-hidden="true">
            <ImagemOuIniciais imagem={imagem} nome={quem} />
          </span>
          <div className="bt-invoca__corpo">
            <b className="bt-invoca__quem">{quem}</b>
            {escolhida.numeros === null ? (
              <small className="bt-invoca__sugeridos">O texto não diz HP e dano: o mestre digita ao colocar.</small>
            ) : (
              <>
                <dl className="bt-invoca__numeros" data-sugeridos={escolhida.sugeridos ? 'sim' : undefined}>
                  <div>
                    <dt>HP</dt>
                    <dd>{formatarNumero(escolhida.numeros.hp)}</dd>
                  </div>
                  <div>
                    <dt>Dano</dt>
                    <dd>{formatarNumero(escolhida.numeros.dano)}</dd>
                  </div>
                  <div>
                    <dt>Anda</dt>
                    <dd>
                      {formatarNumero(escolhida.numeros.blocos)}
                      <small> {escolhida.numeros.blocos === 1 ? 'bloco' : 'blocos'}</small>
                    </dd>
                  </div>
                </dl>
                {escolhida.sugeridos && <small className="bt-invoca__sugeridos">Números sugeridos (os comuns juntos + 1): o mestre ajusta ao colocar.</small>}
              </>
            )}
          </div>
        </div>
      )}
      {regras.length > 0 && (
        <ul className="bt-invoca__regras">
          {regras.map((regra) => (
            <li key={regra}>{regra}</li>
          ))}
        </ul>
      )}
      {escolhida !== null && escolhida.texto.trim() !== '' && <p className="bt-escolha__texto">{escolhida.texto}</p>}
      {pergunta && (
        <label className="bt-linha-campo">
          <span>Custo ({recurso.toUpperCase()})</span>
          <input
            className="bt-num"
            inputMode="numeric"
            value={custoTexto}
            aria-invalid={erro !== null && custo === null ? true : undefined}
            onChange={(evento) => {
              setErro(null)
              setCustoTexto(evento.target.value)
            }}
          />
          {golpe.custo.tipo === 'pergunta' && <small className="bt-mira__nota">A ficha diz: {golpe.custo.texto}</small>}
        </label>
      )}
      {golpe.acao === null && (
        <label className="bt-linha-campo">
          <span>Ação</span>
          <select
            value={acao}
            onChange={(evento) => {
              setErro(null)
              setAcao(evento.target.value as AcaoDaTecnica | '')
            }}
          >
            <option value="">A ficha não diz: escolha</option>
            {ACOES_PERGUNTADAS.map((opcao) => (
              <option key={opcao} value={opcao}>
                {textoDaAcao(opcao)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="bt-mira__nota">
        {quemPede === 'jogador'
          ? `O mestre põe ${artigoDo(quem)} no mapa. Ele age na carta do bando, logo depois da sua.`
          : `Depois ponha ${artigoDo(quem)} no mapa pela lista Invocações. Ele age na carta do bando, logo depois do dono.`}
      </p>
      {bloqueio !== null && (
        <p className="bt-invoca__motivo" id={`${idBase}-motivo`} role="status">
          {bloqueio}
        </p>
      )}
      {erro !== null && (
        <p className="bt-mira__erro" role="alert">
          {erro}
        </p>
      )}
      <div className="bt-pendente__acoes">
        <button type="submit" className="bt-botao bt-botao--batalha" disabled={bloqueio !== null || escolhida === null} aria-describedby={bloqueio === null ? undefined : `${idBase}-motivo`}>
          Invocar <kbd>Enter</kbd>
        </button>
        {!semVoltar && (
          <button type="button" className="bt-botao" onClick={onVoltar}>
            Voltar <kbd>Esc</kbd>
          </button>
        )}
      </div>
    </form>
  )
}

/** "o Lobo", "o Ultra Lobo"; sem nome, "o invocado". */
function artigoDo(nome: string): string {
  const limpo = nome.trim()
  return limpo === '' ? 'o invocado' : `o ${limpo}`
}
