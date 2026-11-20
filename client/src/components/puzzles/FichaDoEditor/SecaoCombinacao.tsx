import { useRef, useState } from 'react'
import { Botao } from '../../grimorio/Botao'
import { ALGARISMOS, combinacaoDoPuzzle, minutosNoMostrador, NOME_DO_SIMBOLO } from '../../../puzzles/combinacao'
import { BOTOES_MAX, BOTOES_MIN, PASSO_DO_RELOGIO, RODAS_MAX, RODAS_MIN, ROTULO_DO_BOTAO_MAX, SEQUENCIA_MAX, SIMBOLOS_DA_RODA, type CombinacaoDoPuzzle, type SimboloDaRoda } from '../../../puzzles/tipos'
import { comCombinacao } from '../edicao'
import { Secao, type PropsDaSecao } from './comum'

/**
 * A RESPOSTA DA COMBINAÇÃO no editor (protótipo aprovado, `htmlFichaResposta`
 * e os campos `digito`, `n-rodas`, `simbolo`, `hora`, `minuto`, `rotulos`,
 * `seq-mais` e `seq-limpar`): o código das rodas, os símbolos, a hora certa,
 * ou os nomes dos botões e a sequência, apertando os botões na ordem.
 * A resposta mora só no puzzle do mestre; o jogador nunca a recebe.
 */

const QUANTAS_RODAS = Array.from({ length: RODAS_MAX - RODAS_MIN + 1 }, (_, i) => RODAS_MIN + i)
const HORAS = Array.from({ length: 12 }, (_, i) => i + 1)
const MINUTOS = Array.from({ length: 60 / PASSO_DO_RELOGIO }, (_, i) => i * PASSO_DO_RELOGIO)
const UMA_HORA = 60

export function SecaoCombinacao({ puzzle, mudar }: PropsDaSecao) {
  const combinacao = combinacaoDoPuzzle(puzzle)
  if (combinacao === null) return null
  const mudarCombinacao = (fazer: (atual: CombinacaoDoPuzzle) => CombinacaoDoPuzzle, chave?: string) => mudar((atual) => comCombinacao(atual, fazer), chave)
  switch (combinacao.forma) {
    case 'numeros':
      return <CodigoDasRodas resposta={combinacao.resposta} mudar={mudarCombinacao} />
    case 'simbolos':
      return <SimbolosDasRodas resposta={combinacao.resposta} mudar={mudarCombinacao} />
    case 'relogio':
      return <HoraCerta resposta={combinacao.resposta} mudar={mudarCombinacao} />
    case 'botoes':
      return <SequenciaDeBotoes rotulos={combinacao.rotulos} resposta={combinacao.resposta} mudar={mudarCombinacao} />
  }
}

type MudarCombinacao = (fazer: (atual: CombinacaoDoPuzzle) => CombinacaoDoPuzzle, chave?: string) => void

/** As rodas com `n` posições: as que já existem ficam, as novas nascem com `nova(i)`. */
function comQuantas<T>(lista: readonly T[], n: number, nova: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => (i < lista.length ? lista[i] : nova(i)))
}

function QuantasRodas({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <label className="gr-campo">
      <span className="gr-campo__rot">Quantas rodas</span>
      <select className="gr-entrada" value={valor} onChange={(evento) => onChange(Number(evento.currentTarget.value))}>
        {QUANTAS_RODAS.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  )
}

function CodigoDasRodas({ resposta, mudar }: { resposta: readonly number[]; mudar: MudarCombinacao }) {
  const digitos = useRef<(HTMLInputElement | null)[]>([])
  const porDigito = (i: number, texto: string) => {
    // Só o último algarismo digitado vale (o v2): digitar por cima troca, sem apagar antes.
    const algarismo = texto.replace(/\D/g, '').slice(-1)
    if (algarismo === '') return
    mudar((atual) => (atual.forma === 'numeros' ? { ...atual, resposta: atual.resposta.map((v, k) => (k === i ? Number(algarismo) % ALGARISMOS : v)) } : atual))
    const proximo = digitos.current[i + 1]
    if (proximo !== null && proximo !== undefined) proximo.select()
  }
  return (
    <Secao titulo="Código das rodas">
      <QuantasRodas valor={resposta.length} onChange={(n) => mudar((atual) => (atual.forma === 'numeros' ? { ...atual, resposta: comQuantas(atual.resposta, n, () => 0) } : atual))} />
      <div className="gr-campo">
        <span className="gr-campo__rot">Código certo</span>
        <div className="pze-digitos">
          {resposta.map((valor, i) => (
            <input
              key={i}
              ref={(el) => {
                digitos.current[i] = el
              }}
              className="gr-entrada"
              inputMode="numeric"
              maxLength={2}
              value={String(valor)}
              aria-label={`Algarismo ${i + 1}`}
              onFocus={(evento) => evento.currentTarget.select()}
              onChange={(evento) => porDigito(i, evento.currentTarget.value)}
            />
          ))}
        </div>
      </div>
      <p className="pze-nota">O jogador gira as rodas e aperta “Tentar abrir”. O código nunca sai daqui.</p>
    </Secao>
  )
}

function SimbolosDasRodas({ resposta, mudar }: { resposta: readonly SimboloDaRoda[]; mudar: MudarCombinacao }) {
  const trocar = (i: number, valor: string) => {
    const simbolo = SIMBOLOS_DA_RODA.find((candidato) => candidato === valor)
    if (simbolo === undefined) return
    mudar((atual) => (atual.forma === 'simbolos' ? { ...atual, resposta: atual.resposta.map((v, k) => (k === i ? simbolo : v)) } : atual))
  }
  return (
    <Secao titulo="Símbolos das rodas">
      <QuantasRodas
        valor={resposta.length}
        onChange={(n) => mudar((atual) => (atual.forma === 'simbolos' ? { ...atual, resposta: comQuantas(atual.resposta, n, (i) => SIMBOLOS_DA_RODA[i % SIMBOLOS_DA_RODA.length]) } : atual))}
      />
      <div className="gr-campo">
        <span className="gr-campo__rot">Símbolos certos, da esquerda para a direita</span>
        <div className="pze-simbolos">
          {resposta.map((simbolo, i) => (
            <select key={i} className="gr-entrada" value={simbolo} aria-label={`Símbolo ${i + 1}`} onChange={(evento) => trocar(i, evento.currentTarget.value)}>
              {SIMBOLOS_DA_RODA.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {NOME_DO_SIMBOLO[opcao]}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>
    </Secao>
  )
}

function HoraCerta({ resposta, mudar }: { resposta: number; mudar: MudarCombinacao }) {
  const hora = Math.floor(resposta / UMA_HORA) || 12
  const minuto = resposta % UMA_HORA
  const por = (h: number, m: number) => mudar((atual) => (atual.forma === 'relogio' ? { ...atual, resposta: minutosNoMostrador((h % 12) * UMA_HORA + m) } : atual))
  return (
    <Secao titulo="Hora certa do relógio">
      <div className="pze-linha2">
        <label className="gr-campo">
          <span className="gr-campo__rot">Hora</span>
          <select className="gr-entrada" value={hora} onChange={(evento) => por(Number(evento.currentTarget.value), minuto)}>
            {HORAS.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>
        </label>
        <label className="gr-campo">
          <span className="gr-campo__rot">Minutos</span>
          <select className="gr-entrada" value={minuto} onChange={(evento) => por(hora, Number(evento.currentTarget.value))}>
            {MINUTOS.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="pze-nota">O relógio começa nas 12:00. O jogador arrasta os ponteiros e aperta “Tentar”.</p>
    </Secao>
  )
}

/** "I, II, III": os nomes que valem (de 2 a 6, cada um no teto). Menos de 2 = `null` (o v2 não aceita). */
function rotulosDoTexto(texto: string): string[] | null {
  const rotulos = texto
    .split(',')
    .map((parte) => parte.trim().slice(0, ROTULO_DO_BOTAO_MAX))
    .filter((parte) => parte !== '')
    .slice(0, BOTOES_MAX)
  return rotulos.length < BOTOES_MIN ? null : rotulos
}

function SequenciaDeBotoes({ rotulos, resposta, mudar }: { rotulos: readonly string[]; resposta: readonly number[]; mudar: MudarCombinacao }) {
  // O texto do campo é de quem digita: a vírgula do fim ("I, II,") não pode sumir a cada letra.
  const juntos = rotulos.join(', ')
  const [texto, setTexto] = useState(juntos)
  const [vistos, setVistos] = useState(juntos)
  if (juntos !== vistos) {
    setVistos(juntos)
    if (rotulosDoTexto(texto)?.join(', ') !== juntos) setTexto(juntos)
  }
  const porTexto = (novo: string) => {
    setTexto(novo)
    const lidos = rotulosDoTexto(novo)
    if (lidos === null) return
    mudar((atual) => (atual.forma === 'botoes' ? { ...atual, rotulos: lidos, resposta: atual.resposta.filter((botao) => botao < lidos.length) } : atual), 'rotulos')
  }
  const cheia = resposta.length >= SEQUENCIA_MAX
  return (
    <Secao titulo="Sequência de botões">
      <label className="gr-campo">
        <span className="gr-campo__rot">Nome dos botões, separados por vírgula</span>
        <input className="gr-entrada" value={texto} onChange={(evento) => porTexto(evento.currentTarget.value)} />
      </label>
      <p className="pze-nota">De {BOTOES_MIN} a {BOTOES_MAX} botões.</p>
      <div className="gr-campo">
        <span className="gr-campo__rot">
          Sequência certa <small>{resposta.length === 1 ? '1 toque' : `${resposta.length} toques`}</small>
        </span>
        <div className="pze-seq" aria-live="polite">
          {resposta.length === 0 ? <span className="pze-nota">Vazia: aperte os botões abaixo na ordem.</span> : resposta.map((botao, i) => <b key={i}>{rotulos[botao]}</b>)}
        </div>
        <div className="pze-seq">
          {rotulos.map((rotulo, i) => (
            <Botao
              key={i}
              tamanho="p"
              disabled={cheia}
              title={cheia ? `A sequência tem no máximo ${SEQUENCIA_MAX} toques` : undefined}
              onClick={() => mudar((atual) => (atual.forma === 'botoes' && atual.resposta.length < SEQUENCIA_MAX ? { ...atual, resposta: [...atual.resposta, i] } : atual))}
            >
              {rotulo}
            </Botao>
          ))}
          <Botao variante="fantasma" tamanho="p" disabled={resposta.length === 0} onClick={() => mudar((atual) => (atual.forma === 'botoes' ? { ...atual, resposta: [] } : atual))}>
            Limpar
          </Botao>
        </div>
      </div>
      <p className="pze-nota">Cada botão fora da ordem castiga e a sequência recomeça.</p>
    </Secao>
  )
}
