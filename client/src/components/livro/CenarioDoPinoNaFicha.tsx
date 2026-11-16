import { useId, useState } from 'react'
import { CHEGAR_CASAS_MAX, CHEGAR_CASAS_MIN, casasAoChegar, quandoDoCenario } from '../../lib/cenarioDoPino'
import { useMapStore } from '../../stores/mapStore'
import { lerCenarioAgora, useMesaDoPino } from '../../stores/mesaDoPino'
import type { LeituraDoCenario, QuandoDoCenario } from '../../types/cenarioEFalas'
import type { Pin } from '../../types/map'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoNum } from '../grimorio/CampoNum'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { Nota } from '../grimorio/Nota'
import type { ShowPinNowCandidate } from '../ShowPinNowControls'

/*
 * "!" CENÁRIO NA FICHA DO PINO (P4, protótipo de 15/11, fluxo 2): quando o
 * texto abre para o jogador e o "Ler agora" — para todos da cena ou para quem
 * o mestre escolher —, com o estado de cada um (lendo, leu, ainda não).
 */

const OPCOES_DO_QUANDO: readonly OpcaoDoSeg<QuandoDoCenario>[] = [
  { valor: 'tocar', rotulo: 'Ao tocar' },
  { valor: 'chegar', rotulo: 'Ao chegar' },
  { valor: 'mandar', rotulo: 'Quando eu mandar' },
]

const AJUDA_DO_QUANDO: Record<QuandoDoCenario, string> = {
  tocar: 'O ! aparece no mapa. Quem tocar nele lê o texto.',
  chegar: 'Abre sozinho, uma vez para cada jogador, quando a ficha dele chega perto.',
  mandar: 'O ! aparece, mas ninguém lê sozinho. Só abre quando você usar Ler agora.',
}

export interface CenarioDoPinoNaFichaProps {
  pinId: string
  /** Quem pode receber agora (conectado, com ficha, nesta cena); `null` = sem sala ou pino oculto. */
  candidatos: readonly ShowPinNowCandidate[] | null
}

/** Muda um pino num passo do desfazer (a mesma porta do "Desligar" do pino ligado). */
export function mudarPino(pinId: string, mudar: (pin: Pin) => Pin): void {
  const { map, replacePins } = useMapStore.getState()
  replacePins(map.pins.map((pin) => (pin.id === pinId ? mudar(pin) : pin)))
}

function horaCurta(hora: number): string {
  const data = new Date(hora)
  return `${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`
}

function textoDoEstado(leitura: LeituraDoCenario | undefined): string {
  if (leitura === undefined) return 'ainda não leu'
  return leitura.estado === 'lendo' ? 'lendo agora' : `leu às ${horaCurta(leitura.hora)}`
}

export function CenarioDoPinoNaFicha({ pinId, candidatos }: CenarioDoPinoNaFichaProps) {
  const quandoId = useId()
  const pin = useMapStore((estado) => estado.map.pins.find((um) => um.id === pinId))
  const leituras = useMesaDoPino((estado) => estado.leituras[pinId])
  const [escolhendo, setEscolhendo] = useState(false)
  const [escolhidos, setEscolhidos] = useState<ReadonlySet<string>>(() => new Set())
  if (pin === undefined || pin.kind !== 'exclamacao') return null
  const quando = quandoDoCenario(pin)
  const semTexto = pin.description.trim() === '' && (pin.nome ?? '').trim() === ''
  const lista = candidatos ?? []
  const podeLer = candidatos !== null && lista.length > 0 && !semTexto

  const trocarQuando = (novo: QuandoDoCenario) => {
    if (novo === quando) return
    // "Ao tocar" grava AUSENTE: o "!" de sempre, como o mapa antigo.
    mudarPino(pinId, (antes) => {
      const depois: Pin = { ...antes, quando: novo }
      if (novo === 'tocar') delete depois.quando
      return depois
    })
  }
  const trocarCasas = (casas: number) => mudarPino(pinId, (antes) => ({ ...antes, chegarCasas: casas }))
  const ler = (ids: readonly string[] | null) => {
    if (lerCenarioAgora(pin, ids).ok) {
      setEscolhendo(false)
      setEscolhidos(new Set())
    }
  }
  const alternar = (playerId: string) =>
    setEscolhidos((antes) => {
      const depois = new Set(antes)
      if (!depois.delete(playerId)) depois.add(playerId)
      return depois
    })
  const nomesEscolhidos = lista.filter((c) => escolhidos.has(c.playerId))

  return (
    <div className="lb-cenario-ficha" role="group" aria-label="Cenário: o jogador lê">
      <CampoSeg rotulo="Quando abre para o jogador" nomeAcessivel="Quando abre para o jogador" opcoes={OPCOES_DO_QUANDO} valor={quando} onChange={trocarQuando} />
      <p className="lb-cenario-ficha__ajuda" id={quandoId}>
        {AJUDA_DO_QUANDO[quando]}
      </p>
      {quando === 'chegar' && (
        <CampoNum rotulo="Abre a" unidade="casas" valor={casasAoChegar(pin)} min={CHEGAR_CASAS_MIN} max={CHEGAR_CASAS_MAX} passo={1} onChange={trocarCasas} />
      )}
      <section className="lb-cenario-ficha__ler" aria-label="Ler agora">
        <h3 className="lb-cenario-ficha__titulo">Ler agora</h3>
        {candidatos === null && <Nota>Ler agora precisa da sala aberta e do pino visível aos jogadores.</Nota>}
        {candidatos !== null && lista.length === 0 && <Nota>Nenhum jogador conectado está nesta cena.</Nota>}
        {semTexto && <Nota>Escreva o texto antes de ler.</Nota>}
        {podeLer && !escolhendo && (
          <Acoes>
            <Botao variante="primario" tamanho="p" onClick={() => ler(null)}>
              Ler para todos
            </Botao>
            <Botao variante="latao" tamanho="p" onClick={() => setEscolhendo(true)}>
              Escolher
            </Botao>
          </Acoes>
        )}
        {podeLer && escolhendo && (
          <>
            <div className="lb-cenario-ficha__chips" role="group" aria-label="Quem lê">
              {lista.map((c) => (
                <button key={c.playerId} type="button" className="lb-cenario-ficha__chip" aria-pressed={escolhidos.has(c.playerId)} onClick={() => alternar(c.playerId)}>
                  <span className="lb-cenario-ficha__ponto" style={{ background: c.color }} aria-hidden="true" />
                  {c.name}
                </button>
              ))}
            </div>
            <Acoes>
              <Botao variante="primario" tamanho="p" disabled={nomesEscolhidos.length === 0} onClick={() => ler(nomesEscolhidos.map((c) => c.playerId))}>
                {nomesEscolhidos.length === 0 ? 'Ler para quem?' : nomesEscolhidos.length === 1 ? `Ler para ${nomesEscolhidos[0].name}` : `Ler para ${nomesEscolhidos.length} jogadores`}
              </Botao>
              <Botao variante="fantasma" tamanho="p" onClick={() => setEscolhendo(false)}>
                Cancelar
              </Botao>
            </Acoes>
          </>
        )}
        {lista.length > 0 && (
          <ul className="lb-cenario-ficha__quem">
            {lista.map((c) => {
              const leitura = leituras?.[c.playerId]
              return (
                <li key={c.playerId}>
                  <span className="lb-cenario-ficha__ponto" style={{ background: c.color }} aria-hidden="true" />
                  <span>{c.name}</span>
                  <em data-estado={leitura?.estado ?? 'nao'}>{textoDoEstado(leitura)}</em>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
