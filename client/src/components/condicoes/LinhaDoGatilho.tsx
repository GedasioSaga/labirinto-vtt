import { useId, useState } from 'react'
import { fraseDoGatilho } from '../../lib/condicoes/fraseDoGatilho'
import { DURACOES_NO_EDITOR, nDePartida, pecaDePartida, ROTULO_DA_PECA, regraDaCondicaoPeloNome } from '../../lib/itens/editorDoItem'
import { duracaoDoTexto, type GatilhoDaCondicao, type PecaDoGatilho } from '../../lib/itens/modelo'
import { NUMERO_DO_ITEM_MAX, PECAS_DO_GATILHO_MAX, TURNOS_DO_GATILHO_MAX } from '../../lib/itens/pecasDoItem'
import { CloseIcon } from '../icons'
import './LinhaDoGatilho.css'

/**
 * O GATILHO DA CONDIÇÃO no editor (pedido de 26/11): uma linha só, "Depois de [X] turnos [uma vez | a
 * cada X] → [peças] · ao disparar [some | continua]". As peças são as do "Ao acertar" do item
 * (`PecaDoItem`, sem o empurrão), com os mesmos rótulos e os mesmos números de partida. Desligado, é
 * um botão pequeno que liga com o exemplo do dono (depois de 3 turnos, uma vez, some).
 *
 * Usado na peça de condição do editor do item e na condição criada do catálogo (tela Condições).
 */

const TIPOS_DO_GATILHO: readonly PecaDoGatilho['tipo'][] = ['condicao', 'dano', 'curar', 'tirar']
const TURNOS_DE_PARTIDA = 3

/** O rótulo curto de cada peça no "+ efeito" do gatilho. */
const ROTULO_CURTO: Readonly<Record<PecaDoGatilho['tipo'], string>> = {
  condicao: 'Condição',
  dano: 'Dano',
  curar: 'Cura',
  tirar: 'Tirar condição',
}

function pecaNova(tipo: PecaDoGatilho['tipo'], condicoes: readonly string[]): PecaDoGatilho {
  const peca = pecaDePartida(tipo, condicoes)
  if (peca.tipo === 'empurrar') return { tipo: 'dano', valor: 5 }
  if (peca.tipo === 'condicao') {
    // A de partida dura "até o fim da batalha"; no gatilho o comum é por 1 turno (o "vira Atordoado").
    const { gatilho: _semGatilho, ...semGatilho } = peca
    return { ...semGatilho, duracao: 1 }
  }
  return peca
}

/** Um número curto digitado (só algarismos), gravado a cada tecla quando vale. */
function NumeroCurto({ valor, minimo, maximo, rotulo, onMudar }: { valor: number; minimo: number; maximo: number; rotulo: string; onMudar: (valor: number) => void }) {
  const [texto, setTexto] = useState(String(valor))
  const numero = Number.parseInt(texto, 10)
  const valido = Number.isInteger(numero) && numero >= minimo && numero <= maximo
  return (
    <input
      className="lb-input lb-gat__num"
      type="text"
      inputMode="numeric"
      aria-label={rotulo}
      aria-invalid={!valido}
      maxLength={String(maximo).length}
      value={texto}
      onChange={(evento) => {
        const limpo = evento.target.value.replace(/\D/g, '')
        setTexto(limpo)
        const novo = Number.parseInt(limpo, 10)
        if (Number.isInteger(novo) && novo >= minimo && novo <= maximo) onMudar(novo)
      }}
      onBlur={() => {
        if (!valido) setTexto(String(valor))
      }}
    />
  )
}

/** Uma peça do gatilho, em linha: o que faz e o número dela. */
function PecaDoGatilhoEmLinha({ peca, condicoes, onMudar }: { peca: PecaDoGatilho; condicoes: readonly string[]; onMudar: (peca: PecaDoGatilho) => void }) {
  const opcoes = (nome: string) => (condicoes.includes(nome) ? condicoes : [nome, ...condicoes])
  switch (peca.tipo) {
    case 'condicao': {
      const regra = regraDaCondicaoPeloNome(peca.nome)
      return (
        <>
          <span className="lb-gat__txt">vira</span>
          <select
            className="lb-input lb-gat__sel"
            aria-label="Condição que entra"
            value={peca.nome}
            onChange={(evento) => {
              const nome = evento.target.value
              const n = nDePartida(nome)
              onMudar({ tipo: 'condicao', nome, duracao: peca.duracao, ...(n === undefined ? {} : { n }) })
            }}
          >
            {opcoes(peca.nome).map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
          <select className="lb-input lb-gat__sel" aria-label="Quanto tempo dura" value={String(peca.duracao)} onChange={(evento) => onMudar({ ...peca, duracao: duracaoDoTexto(evento.target.value) })}>
            {DURACOES_NO_EDITOR.map((opcao) => (
              <option key={opcao.duracao} value={String(opcao.duracao)}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
          {regra !== 'narra' && (
            <NumeroCurto
              key={peca.nome}
              valor={peca.n ?? nDePartida(peca.nome) ?? 1}
              minimo={1}
              maximo={regra === 'cura' ? 100 : 99}
              rotulo={regra === 'cura' ? 'A cura cai (%)' : 'Perde de vida por vez'}
              onMudar={(n) => onMudar({ ...peca, n })}
            />
          )}
        </>
      )
    }
    case 'dano':
      return (
        <>
          <NumeroCurto valor={peca.valor} minimo={1} maximo={NUMERO_DO_ITEM_MAX} rotulo="Dano" onMudar={(valor) => onMudar({ tipo: 'dano', valor })} />
          <span className="lb-gat__txt">de dano</span>
        </>
      )
    case 'curar':
      return (
        <>
          <span className="lb-gat__txt">cura</span>
          <NumeroCurto valor={peca.fixo} minimo={1} maximo={NUMERO_DO_ITEM_MAX} rotulo="Cura" onMudar={(fixo) => onMudar({ tipo: 'curar', fixo })} />
        </>
      )
    case 'tirar':
      return (
        <>
          <span className="lb-gat__txt">tira</span>
          <select className="lb-input lb-gat__sel" aria-label="Condição que sai" value={peca.nome ?? ''} onChange={(evento) => onMudar({ tipo: 'tirar', nome: evento.target.value === '' ? null : evento.target.value })}>
            <option value="">as outras condições</option>
            {opcoes(peca.nome ?? condicoes[0] ?? '').filter((nome) => nome !== '').map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </>
      )
  }
}

export interface LinhaDoGatilhoProps {
  gatilho: GatilhoDaCondicao | undefined
  /** Os nomes do catálogo de condições, para as peças de condição. */
  condicoes: readonly string[]
  onMudar: (gatilho: GatilhoDaCondicao | undefined) => void
}

export function LinhaDoGatilho({ gatilho, condicoes, onMudar }: LinhaDoGatilhoProps) {
  const id = useId()
  if (gatilho === undefined) {
    return (
      <button
        type="button"
        className="lb-btn lb-btn--ghost lb-btn--compact lb-gat__ligar"
        onClick={() => onMudar({ turnos: TURNOS_DE_PARTIDA, vezes: 'uma', aoDisparar: 'some', pecas: [pecaNova('condicao', condicoes)] })}
      >
        + Depois de X turnos…
      </button>
    )
  }
  const mudarPeca = (indice: number, peca: PecaDoGatilho) => onMudar({ ...gatilho, pecas: gatilho.pecas.map((atual, i) => (i === indice ? peca : atual)) })
  const tirarPeca = (indice: number) => {
    const pecas = gatilho.pecas.filter((_, i) => i !== indice)
    onMudar(pecas.length === 0 ? undefined : { ...gatilho, pecas })
  }
  return (
    <div className="lb-gat" role="group" aria-labelledby={id}>
      <div className="lb-gat__linha">
        <span id={id} className="lb-gat__txt lb-gat__txt--forte">
          Depois de
        </span>
        <NumeroCurto valor={gatilho.turnos} minimo={1} maximo={TURNOS_DO_GATILHO_MAX} rotulo="Quantos turnos" onMudar={(turnos) => onMudar({ ...gatilho, turnos })} />
        <span className="lb-gat__txt">{gatilho.turnos === 1 ? 'turno' : 'turnos'}</span>
        <select
          className="lb-input lb-gat__sel"
          aria-label="Quantas vezes"
          value={gatilho.vezes}
          onChange={(evento) => {
            const vezes = evento.target.value === 'cada' ? 'cada' : 'uma'
            // O padrão do dono: "uma vez" some; "a cada X" continua (senão só dispararia uma vez).
            onMudar({ ...gatilho, vezes, aoDisparar: vezes === 'cada' ? 'continua' : 'some' })
          }}
        >
          <option value="uma">uma vez</option>
          <option value="cada">{`a cada ${gatilho.turnos}`}</option>
        </select>
        <span className="lb-gat__seta" aria-hidden="true">
          →
        </span>
        {gatilho.pecas.map((peca, indice) => (
          <span key={indice} className="lb-gat__peca">
            <PecaDoGatilhoEmLinha peca={peca} condicoes={condicoes} onMudar={(nova) => mudarPeca(indice, nova)} />
            <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label={`Tirar ${ROTULO_DA_PECA[peca.tipo]}`} onClick={() => tirarPeca(indice)}>
              <CloseIcon size={12} />
            </button>
          </span>
        ))}
        {gatilho.pecas.length < PECAS_DO_GATILHO_MAX && (
          <select
            className="lb-input lb-gat__sel lb-gat__mais"
            aria-label="Pôr mais um efeito no gatilho"
            value=""
            onChange={(evento) => {
              const tipo = TIPOS_DO_GATILHO.find((candidato) => candidato === evento.target.value)
              if (tipo !== undefined) onMudar({ ...gatilho, pecas: [...gatilho.pecas, pecaNova(tipo, condicoes)] })
            }}
          >
            <option value="">+ efeito</option>
            {TIPOS_DO_GATILHO.map((tipo) => (
              <option key={tipo} value={tipo}>
                {ROTULO_CURTO[tipo]}
              </option>
            ))}
          </select>
        )}
        <span className="lb-gat__txt">· ao disparar</span>
        <select className="lb-input lb-gat__sel" aria-label="Ao disparar, a condição" value={gatilho.aoDisparar} onChange={(evento) => onMudar({ ...gatilho, aoDisparar: evento.target.value === 'continua' ? 'continua' : 'some' })}>
          <option value="some">some</option>
          <option value="continua">continua</option>
        </select>
        <button type="button" className="lb-iconbtn lb-iconbtn--sm lb-gat__fora" aria-label="Tirar o gatilho" onClick={() => onMudar(undefined)}>
          <CloseIcon size={14} />
        </button>
      </div>
      <p className="lb-gat__frase">{`Conta na vez de quem está com ela: ${fraseDoGatilho(gatilho)}.`}</p>
    </div>
  )
}
