import { useId } from 'react'
import { efeitoDaLuz, efeitoDaPorta, efeitoDaZona, type AmarraDeEstado, type EstadoDoMundo } from '../lib/estadoDoMundo'
import { PIN_PASSAGE_LABELS, PIN_PASSAGE_ORDER, passageOf } from '../lib/pins'
import type { ConcealZone, EfeitoDeEstado, EfeitoNaLuz, EfeitoNaPorta, EfeitoNaZona, Light, Pin, PinPassage, RegraDeEstado, Wall } from '../types/map'

/** Um efeito na lista de cada valor, com o nome que o mestre lê. */
export interface OpcaoDeEfeito<E extends string> {
  efeito: E
  rotulo: string
}

export const OPCOES_DA_PORTA: readonly OpcaoDeEfeito<EfeitoNaPorta>[] = [
  { efeito: 'aberta', rotulo: 'Aberta' },
  { efeito: 'fechada', rotulo: 'Fechada' },
  { efeito: 'trancada', rotulo: 'Trancada' },
]

export const OPCOES_DO_PINO: readonly OpcaoDeEfeito<PinPassage>[] = PIN_PASSAGE_ORDER.map((efeito) => ({ efeito, rotulo: PIN_PASSAGE_LABELS[efeito] }))

export const OPCOES_DA_ZONA: readonly OpcaoDeEfeito<EfeitoNaZona>[] = [
  { efeito: 'oculta', rotulo: 'Oculta' },
  { efeito: 'revelada', rotulo: 'Revelada' },
]

export const OPCOES_DA_LUZ: readonly OpcaoDeEfeito<EfeitoNaLuz>[] = [
  { efeito: 'acesa', rotulo: 'Acesa' },
  { efeito: 'apagada', rotulo: 'Apagada' },
]

/** Valor da lista de efeito que quer dizer "este valor não mexe no elemento". */
const NAO_MUDA = ''
/** Valor da lista de estado que quer dizer "não depende de estado nenhum". */
const NENHUM = ''

export interface DependeDoEstadoControlsProps<E extends string> {
  /** "a porta", "o pino" — entra na frase de quando não há estado. */
  elemento: string
  estados: readonly EstadoDoMundo[]
  regra: RegraDeEstado<E> | undefined
  opcoes: readonly OpcaoDeEfeito<E>[]
  /** O efeito em que o elemento está agora: vira o efeito de todo valor ao amarrar. */
  efeitoAgora: E
  /** A regra nova; `undefined` desamarra. */
  onChange: (regra: RegraDeEstado<E> | undefined) => void
}

/** Os efeitos com `valor` trocado para `efeito` (`undefined` = sai), na ordem de antes; valor novo vai para o fim. */
function comEfeito<E extends string>(efeitos: readonly EfeitoDeEstado<E>[], valor: string, efeito: E | undefined): EfeitoDeEstado<E>[] {
  const outros = efeitos.filter((entrada) => entrada.valor !== valor)
  if (efeito === undefined) return outros
  if (!efeitos.some((entrada) => entrada.valor === valor)) return [...efeitos, { valor, efeito }]
  return efeitos.map((entrada) => (entrada.valor === valor ? { valor, efeito } : entrada))
}

/**
 * ESTADO DO MUNDO — "Depende do estado" de um elemento (porta, pino de
 * viagem, zona oculta, luz). O mestre escolhe o estado ("Maré") e diz, para
 * cada valor, o que o elemento vira; "Não muda" deixa o elemento como está
 * naquele valor. Listas nativas: setas escolhem, a inicial salta, e cada uma
 * tem rótulo. Nada disto vai ao jogador (`lib/fogFilter.ts`).
 */
export function DependeDoEstadoControls<E extends string>({ elemento, estados, regra, opcoes, efeitoAgora, onChange }: DependeDoEstadoControlsProps<E>) {
  const baseId = useId()
  if (estados.length === 0 && regra === undefined) {
    return (
      <p className="lb-world-amarra__vazio">
        Para {elemento} mudar junto com a maré, a energia ou uma alavanca, crie um estado em "Estado do mundo".
      </p>
    )
  }

  const estado = regra === undefined ? undefined : estados.find((e) => e.id === regra.estadoId)
  const estadoId = `${baseId}-estado`
  // Estado que sumiu da aventura: os valores que a regra cita são tudo o que sobra dele.
  const valores = estado !== undefined ? estado.valores : regra === undefined ? [] : regra.efeitos.map((entrada) => entrada.valor)

  const escolherEstado = (id: string) => {
    if (id === NENHUM) {
      onChange(undefined)
      return
    }
    const novo = estados.find((e) => e.id === id)
    if (novo === undefined || novo.id === regra?.estadoId) return
    onChange({ estadoId: novo.id, efeitos: novo.valores.map((valor) => ({ valor, efeito: efeitoAgora })) })
  }

  const escolherEfeito = (valor: string, escolhido: string) => {
    if (regra === undefined) return
    const efeito = opcoes.find((opcao) => opcao.efeito === escolhido)?.efeito
    const efeitos = comEfeito(regra.efeitos, valor, efeito)
    onChange(efeitos.length === 0 ? undefined : { estadoId: regra.estadoId, efeitos })
  }

  return (
    <div className="lb-world-amarra">
      <div className="lb-field">
        <label className="lb-label" htmlFor={estadoId}>
          Depende do estado
        </label>
        <select id={estadoId} className="lb-input" value={regra?.estadoId ?? NENHUM} onChange={(event) => escolherEstado(event.target.value)}>
          <option value={NENHUM}>Nenhum</option>
          {estados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
          {regra !== undefined && estado === undefined && <option value={regra.estadoId}>Estado que não existe mais</option>}
        </select>
      </div>
      {regra !== undefined && (
        <ul className="lb-world-amarra__valores">
          {valores.map((valor, i) => {
            const id = `${baseId}-valor-${i}`
            const atual = estado?.atual === valor
            return (
              <li key={valor} className="lb-world-amarra__valor">
                <label className="lb-label" htmlFor={id}>
                  {valor}
                  {atual && <span className="lb-world-amarra__agora"> (agora)</span>}
                </label>
                <select
                  id={id}
                  className="lb-input"
                  value={regra.efeitos.find((entrada) => entrada.valor === valor)?.efeito ?? NAO_MUDA}
                  onChange={(event) => escolherEfeito(valor, event.target.value)}
                >
                  <option value={NAO_MUDA}>Não muda</option>
                  {opcoes.map((opcao) => (
                    <option key={opcao.efeito} value={opcao.efeito}>
                      {opcao.rotulo}
                    </option>
                  ))}
                </select>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────────────
// Um por elemento: o App (e o teste do painel) montam estes, com a mesma ligação.
// ───────────────────────────────────────────────────────────────────────────

interface AmarraProps {
  estados: readonly EstadoDoMundo[]
  onAmarrar: (amarra: AmarraDeEstado) => void
}

export function EstadoDaPorta({ wall, estados, onAmarrar }: AmarraProps & { wall: Wall }) {
  if (wall.door === null) return null
  return (
    <DependeDoEstadoControls
      elemento="a porta"
      estados={estados}
      regra={wall.door.porEstado}
      opcoes={OPCOES_DA_PORTA}
      efeitoAgora={efeitoDaPorta(wall.door)}
      onChange={(regra) => onAmarrar({ alvo: 'porta', id: wall.id, regra })}
    />
  )
}

export function EstadoDoPino({ pin, estados, onAmarrar }: AmarraProps & { pin: Pin }) {
  return (
    <DependeDoEstadoControls
      elemento="a passagem"
      estados={estados}
      regra={pin.porEstado}
      opcoes={OPCOES_DO_PINO}
      efeitoAgora={passageOf(pin)}
      onChange={(regra) => onAmarrar({ alvo: 'pino', id: pin.id, regra })}
    />
  )
}

export function EstadoDaZona({ zone, estados, onAmarrar }: AmarraProps & { zone: ConcealZone }) {
  return (
    <DependeDoEstadoControls
      elemento="a zona"
      estados={estados}
      regra={zone.porEstado}
      opcoes={OPCOES_DA_ZONA}
      efeitoAgora={efeitoDaZona(zone)}
      onChange={(regra) => onAmarrar({ alvo: 'zona', id: zone.id, regra })}
    />
  )
}

export function EstadoDaLuz({ light, estados, onAmarrar }: AmarraProps & { light: Light }) {
  return (
    <DependeDoEstadoControls
      elemento="a luz"
      estados={estados}
      regra={light.porEstado}
      opcoes={OPCOES_DA_LUZ}
      efeitoAgora={efeitoDaLuz(light)}
      onChange={(regra) => onAmarrar({ alvo: 'luz', id: light.id, regra })}
    />
  )
}
