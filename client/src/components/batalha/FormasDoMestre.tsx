import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { MODS_DA_DECISAO_MAX, NOME_DA_HABILIDADE_MAX, TEXTO_DA_HABILIDADE_MAX, type DecisaoDaForma, type FormaPendente } from '../../lib/batalha/combate'
import {
  alvosDaDecisao,
  cartaoPorId,
  decisaoValida,
  formaDecididaPeloMestre,
  fraseDoRecusar,
  habilidadeDaUltimaDecisao,
  PECA_DO_MESTRE_NA_FORMA,
  previaDaDecisao,
  textoDaHabilidade,
} from '../../lib/batalha/mecanica/formaDoMestre'
import type { LinhaDoRegistro } from '../../lib/batalha/registro'
import { requisitoDaForma } from '../../lib/batalha/transformacao'
import type { TurnosDaCena } from '../../lib/batalha/turnos'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { ImagemOuIniciais } from '../FichaPecas'
import { formatarNumero } from './dadosDoMenu'
import { JanelaDaBatalha } from './JanelaDaBatalha'
import { LinhasDeMods, linhasDosMods, modsDasLinhas, type LinhaDeMod } from './LinhasDeMods'
import './batalha.css'
import './combate.css'
import './MecanicaDaTecnica.css'

/**
 * A TELA DO MESTRE AO TRANSFORMAR (construtor de mecânicas, fatia C6): a forma
 * com "o mestre decide os números" (o Sulong da May e da Aira) não liga no
 * pedido. Ela entra nesta lista, e a janela abre sozinha para o mestre: o que
 * a forma soma (atributos e máximos), se ganha uma habilidade, e a prévia
 * ("FOR 160 → 190"). Só ao confirmar a forma liga. "Depois" fecha e a forma
 * fica esperando aqui; "Recusar" é o Desfazer do pedido (a confirmação diz o
 * que volta de fato: a ação só na vez do pedido, o uso só se a forma tem).
 * Com dois pedidos seguidos, as janelas abrem uma depois da outra.
 */

export interface FormasPendentesProps {
  itens: readonly FormaPendente[]
  personagens: readonly Personagem[]
  sistema: SistemaDeRpg | null
  /** A vez e a rodada de agora: a ação do pedido só volta no Recusar se ainda é a vez dele. */
  turnos: Pick<TurnosDaCena, 'vez' | 'rodada'>
  /** O registro da cena: o que a linha do pedido gastou (e se ela ainda está lá). */
  registro: readonly LinhaDoRegistro[]
  /** O nome do token na mesa ("May"). */
  nomeDoToken: (tokenId: string) => string
  onDecidir: (pendenteId: string, decisao: DecisaoDaForma) => boolean
  onRecusar: (pendenteId: string) => boolean
}

/** A lista "Formas · você decide" (aba Batalha do mestre), no alto, junto das invocações. */
export function FormasPendentes({ itens, personagens, sistema, turnos, registro, nomeDoToken, onDecidir, onRecusar }: FormasPendentesProps) {
  const [aberta, setAberta] = useState<string | null>(null)
  const vistas = useRef(new Set<string>())
  const abrir = (id: string) => {
    vistas.current.add(id)
    setAberta(id)
  }
  // O pedido novo abre a janela sozinho ("vai abrir uma tela para mim"), um de cada vez: o seguinte espera a janela
  // de agora fechar. Só conta como visto o que de fato abriu; o que o mestre deixou para depois não reabre.
  useEffect(() => {
    if (aberta !== null) return
    const nova = itens.find((item) => !vistas.current.has(item.id))
    if (nova === undefined) return
    vistas.current.add(nova.id)
    setAberta(nova.id)
  }, [itens, aberta])
  // A pendência saiu (decidida, recusada, desfeita): a janela dela fecha.
  useEffect(() => {
    if (aberta !== null && !itens.some((item) => item.id === aberta)) setAberta(null)
  }, [itens, aberta])
  if (itens.length === 0) return null
  const naJanela = itens.find((item) => item.id === aberta) ?? null
  const personagemDaJanela = naJanela === null ? undefined : personagens.find((personagem) => personagem.id === naJanela.personagemId)
  return (
    <section className="bt-secao" aria-label="Formas esperando o mestre decidir os números">
      <h3 className="bt-secao__titulo">Formas · você decide os números</h3>
      <ul className="bt-pendentes">
        {itens.map((item) => {
          const personagem = personagens.find((candidato) => candidato.id === item.personagemId)
          const cartao = personagem === undefined ? null : cartaoPorId(personagem, item.cartaoId)
          const quem = nomeDoToken(item.tokenId)
          return (
            <PendenciaDaForma
              key={item.id}
              item={item}
              quem={quem}
              imagem={cartao?.imagem ?? null}
              oQueVolta={fraseDoRecusar(item, quem, turnos, registro)}
              onAbrir={() => abrir(item.id)}
              onRecusar={() => onRecusar(item.id)}
            />
          )
        })}
      </ul>
      {naJanela !== null && personagemDaJanela !== undefined && sistema !== null && (
        <DecisaoDaFormaDialog
          key={naJanela.id}
          pendente={naJanela}
          quem={nomeDoToken(naJanela.tokenId)}
          personagem={personagemDaJanela}
          sistema={sistema}
          onDecidir={(decisao) => onDecidir(naJanela.id, decisao)}
          onFechar={() => setAberta(null)}
        />
      )}
    </section>
  )
}

interface PendenciaDaFormaProps {
  item: FormaPendente
  quem: string
  imagem: string | null
  /** "A ação volta para May." montada pelo que o Desfazer do pedido devolve de fato (`fraseDoRecusar`). */
  oQueVolta: string
  onAbrir: () => void
  onRecusar: () => boolean
}

function PendenciaDaForma({ item, quem, imagem, oQueVolta, onAbrir, onRecusar }: PendenciaDaFormaProps) {
  const [confirmando, setConfirmando] = useState(false)
  const manter = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (confirmando) manter.current?.focus()
  }, [confirmando])
  const doJogador = item.autor.tipo === 'jogador'
  return (
    <li className="bt-pendente bt-forma-do-mestre">
      <div className="bt-invocacao__linha">
        <span className="bt-invocacao__rosto" aria-hidden="true">
          <ImagemOuIniciais imagem={imagem} nome={item.nome} />
        </span>
        <span className="bt-invocacao__texto">
          <span>
            <b>{quem}</b> quer ativar <b>{item.nome}</b>
          </span>
          <small>{doJogador ? 'O jogador espera você decidir.' : 'A forma liga quando você decidir.'}</small>
        </span>
      </div>
      {confirmando ? (
        <div className="bt-pendente__acoes" role="group" aria-label={`Recusar ${item.nome} de ${quem}`}>
          <span className="bt-invocacao__pergunta">Recusar a forma? {oQueVolta}</span>
          <button type="button" className="bt-botao bt-botao--p" onClick={() => onRecusar()}>
            Recusar
          </button>
          <button ref={manter} type="button" className="bt-botao bt-botao--p" onClick={() => setConfirmando(false)}>
            Manter
          </button>
        </div>
      ) : (
        <div className="bt-pendente__acoes">
          <button type="button" className="bt-botao bt-botao--primario" onClick={onAbrir}>
            Decidir os números
          </button>
          <button type="button" className="bt-botao" onClick={() => setConfirmando(true)}>
            Recusar
          </button>
        </div>
      )}
    </li>
  )
}

export interface DecisaoDaFormaDialogProps {
  pendente: FormaPendente
  quem: string
  personagem: Personagem
  sistema: SistemaDeRpg
  /** O pedido valeu? `false` mantém a janela, com o aviso. */
  onDecidir: (decisao: DecisaoDaForma) => boolean
  onFechar: () => void
}

/** As linhas da última decisão (os modificadores que o cartão guarda), para o mestre partir delas. */
function linhasDoCartao(cartao: CartaoDaFicha | null): LinhaDeMod[] {
  return linhasDosMods(
    (cartao?.modificadores ?? []).map((mod) => ({ alvo: mod.atributo, delta: mod.delta })),
    MODS_DA_DECISAO_MAX,
  )
}

export function DecisaoDaFormaDialog({ pendente, quem, personagem, sistema, onDecidir, onFechar }: DecisaoDaFormaDialogProps) {
  const idBase = useId()
  const cartao = cartaoPorId(personagem, pendente.cartaoId)
  const alvos = useMemo(() => alvosDaDecisao(sistema), [sistema])
  // A habilidade da última decisão não vem junto: fica oferecida, desmarcada, com o nome e o texto prontos.
  const ultima = cartao === null ? null : habilidadeDaUltimaDecisao(cartao)
  const [linhas, setLinhas] = useState<LinhaDeMod[]>(() => linhasDoCartao(cartao))
  const [ganha, setGanha] = useState(false)
  const [nome, setNome] = useState(() => (ultima === null ? '' : textoDaHabilidade(ultima).nome.slice(0, NOME_DA_HABILIDADE_MAX)))
  const [texto, setTexto] = useState(() => (ultima === null ? '' : textoDaHabilidade(ultima).texto.slice(0, TEXTO_DA_HABILIDADE_MAX)))
  const [erro, setErro] = useState<string | null>(null)
  const lidos = useMemo(() => modsDasLinhas(linhas, alvos, 'dos modificadores'), [linhas, alvos])
  const decisao = useMemo<DecisaoDaForma | null>(
    () => ('erro' in lidos ? null : { mods: lidos.mods.map((mod) => ({ atributo: mod.alvo, delta: mod.delta })), habilidade: ganha ? { nome, texto } : null }),
    [lidos, ganha, nome, texto],
  )
  // A prévia só depende dos modificadores (a habilidade não muda número).
  const mods = decisao?.mods
  const previa = useMemo(() => (mods === undefined ? [] : previaDaDecisao(personagem, sistema, pendente.cartaoId, { mods, habilidade: null })), [mods, personagem, sistema, pendente.cartaoId])
  const requisito = cartao === null ? null : requisitoDaForma(cartao)
  const jaTem =
    cartao?.subcartoes
      .filter((subcartao) => subcartao.id !== ultima?.id)
      .map((subcartao) => subcartao.nome.trim())
      .filter((nomeDaHabilidade) => nomeDaHabilidade.length > 0) ?? []
  const nomeDaUltima = ultima?.nome.trim() ?? ''

  const confirmar = (evento: FormEvent) => {
    evento.preventDefault()
    if ('erro' in lidos || decisao === null) {
      setErro('erro' in lidos ? lidos.erro : 'Confira os modificadores.')
      return
    }
    const valida = decisaoValida(decisao, sistema)
    if ('motivo' in valida) {
      setErro(`${valida.motivo}.`)
      if (ganha && nome.trim().length === 0) document.getElementById(`${idBase}-nome`)?.focus()
      return
    }
    if (onDecidir(valida.decisao)) onFechar()
    else setErro(`Não ligou: ${pendente.nome} já está ligada, saiu da ficha, ou alguém desfez o pedido.`)
  }

  return (
    <JanelaDaBatalha
      titulo={`${pendente.nome} de ${quem}`}
      descricao={`Escolha o que ${pendente.nome} soma e se ${quem} ganha alguma habilidade. A forma só liga quando você confirmar. Entra no registro; o Desfazer volta tudo.`}
      onFechar={onFechar}
    >
      <form className="bt-form bt-decisao" onSubmit={confirmar} noValidate>
        {requisito !== null && (
          <p className="bt-decisao__requisito">
            <span className="bt-decisao__rotulo">A ficha pede</span> {requisito}
          </p>
        )}
        <LinhasDeMods
          idBase={idBase}
          linhas={linhas}
          alvos={alvos}
          maximo={MODS_DA_DECISAO_MAX}
          dica="somam enquanto a forma estiver ligada"
          vazio="Nenhum: a forma liga sem somar nada."
          onMudar={(novas) => {
            setErro(null)
            setLinhas(novas)
          }}
        />
        <fieldset className="bt-decisao__habilidade">
          <legend className="bt-mods__legenda">
            Habilidade <small>o app só lembra; o efeito você aplica</small>
          </legend>
          {jaTem.length > 0 && <p className="bt-decisao__ja">Já vem com a forma: {jaTem.join(', ')}.</p>}
          <label className="bt-decisao__opcao">
            <input
              type="checkbox"
              checked={ganha}
              aria-describedby={nomeDaUltima.length > 0 && !ganha ? `${idBase}-ultima` : undefined}
              onChange={(evento) => {
                setErro(null)
                setGanha(evento.target.checked)
              }}
            />
            {quem} ganha uma habilidade desta vez
          </label>
          {nomeDaUltima.length > 0 && !ganha && (
            <p id={`${idBase}-ultima`} className="bt-decisao__ultima">
              Da última vez ganhou {nomeDaUltima}. Marque para dar de novo ou trocar.
            </p>
          )}
          {ganha && (
            <div className="bt-decisao__campos">
              <label className="bt-decisao__campo" htmlFor={`${idBase}-nome`}>
                <span>Nome</span>
                <input
                  id={`${idBase}-nome`}
                  className="bt-num bt-num--texto"
                  maxLength={NOME_DA_HABILIDADE_MAX}
                  value={nome}
                  placeholder="ex.: Garras de Lua"
                  autoComplete="off"
                  onChange={(evento) => {
                    setErro(null)
                    setNome(evento.target.value.replace(/[\r\n]/g, ''))
                  }}
                />
              </label>
              <label className="bt-decisao__campo" htmlFor={`${idBase}-texto`}>
                <span>O que faz</span>
                <textarea
                  id={`${idBase}-texto`}
                  className="bt-num bt-num--texto bt-decisao__texto"
                  maxLength={TEXTO_DA_HABILIDADE_MAX}
                  rows={3}
                  value={texto}
                  placeholder="ex.: +30 de dano no Atacar enquanto durar a lua cheia."
                  onChange={(evento) => {
                    setErro(null)
                    setTexto(evento.target.value)
                  }}
                />
              </label>
            </div>
          )}
        </fieldset>
        <div className="bt-decisao__previa" aria-live="polite">
          <span className="bt-decisao__rotulo">Ao ligar</span>
          {previa.length === 0 ? (
            <span className="bt-decisao__nada">nenhum número muda</span>
          ) : (
            <ul className="bt-decisao__numeros">
              {previa.map((numero) => (
                <li key={numero.rotulo}>
                  {numero.rotulo} {formatarNumero(numero.de)} <span aria-label="vai para">→</span> <b>{formatarNumero(numero.para)}</b>
                </li>
              ))}
            </ul>
          )}
        </div>
        {erro !== null && (
          <p className="bt-form__erro" role="alert">
            {erro}
          </p>
        )}
        <div className="bt-form__acoes">
          <button type="button" className="bt-botao" onClick={onFechar}>
            Depois
          </button>
          <button type="submit" className="bt-botao bt-botao--batalha">
            Ativar {pendente.nome}
          </button>
        </div>
      </form>
    </JanelaDaBatalha>
  )
}

export interface PecaDoMestreNaFormaProps {
  cartao: CartaoDaFicha
  /** Só o mestre liga e desliga a peça (como a `mecanica` da técnica); o dono só vê. */
  podeMudar: boolean
  onChange: (cartao: CartaoDaFicha) => void
}

/**
 * C6, no cartão da forma (a ficha): o interruptor "o mestre decide os números".
 * Ligado, Ativar na batalha abre a tela do mestre antes de a forma ligar. O
 * dono vê a frase, sem o interruptor. A peça mora no campo `mecanica` do
 * cartão (viaja pela LAN e pela nuvem como a da técnica); desligar só tira a
 * peça deste formato.
 */
export function PecaDoMestreNaForma({ cartao, podeMudar, onChange }: PecaDoMestreNaFormaProps) {
  const id = useId()
  const ligada = formaDecididaPeloMestre(cartao)
  if (!podeMudar) {
    return ligada ? <p className="lb-mec__dica-da-forma">Na batalha, o mestre decide os números desta forma ao ativar.</p> : null
  }
  const trocar = (ligar: boolean) => {
    if (ligar) {
      onChange({ ...cartao, mecanica: { ...PECA_DO_MESTRE_NA_FORMA } })
      return
    }
    if (!ligada) return
    const { mecanica: _peca, ...semPeca } = cartao
    onChange(semPeca)
  }
  return (
    <div className="lb-mec lb-mec--forma">
      <label className="lb-mec__forma-opcao" htmlFor={id}>
        <input id={id} type="checkbox" checked={ligada} onChange={(evento) => trocar(evento.target.checked)} aria-describedby={`${id}-dica`} />
        <span>Na batalha, o mestre decide os números</span>
      </label>
      <p id={`${id}-dica`} className="lb-mec__dica-da-forma">
        Ao ativar, abre uma tela para o mestre escolher o que a forma soma e se ganha uma habilidade. Só depois ela liga.
      </p>
    </div>
  )
}
