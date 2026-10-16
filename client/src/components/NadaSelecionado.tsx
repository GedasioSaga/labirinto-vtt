import { useMemo } from 'react'
import { mapObjectsOf, type MapObjectEntry, type MapObjectKind } from '../lib/mapObjects'
import type { MapData, PinKind } from '../types/map'
import { ChevronDownIcon, DoorIcon, PinIcon, RoomIcon, TokenIcon } from './icons'
import './NadaSelecionado.css'

/** Um exemplo de cada tipo que tem ficha própria, na ordem do protótipo (token, porta, pino, sala). */
const ORDEM_DOS_EXEMPLOS: readonly MapObjectKind[] = ['token', 'door', 'pin', 'room']

const NOME_DO_TIPO: Record<MapObjectKind, string> = { token: 'Token', door: 'Porta', pin: 'Pino', room: 'Sala', text: 'Texto' }

const NOME_DO_PINO: Record<PinKind, string> = {
  exclamacao: 'Pino de exclamação',
  interrogacao: 'Pino de interrogação',
  viagem: 'Pino de viagem',
  alavanca: 'Alavanca',
  minigame: 'Pino de minigame',
}

/**
 * O que é o exemplo, na linha de baixo ("Token de NPC", "Porta trancada",
 * "Pino de exclamação"), como no protótipo; o detalhe da lista de objetos (as
 * salas de uma porta) vem depois do ponto.
 */
export function tipoDoExemplo(map: MapData, entry: MapObjectEntry): string {
  const tipo = (() => {
    if (entry.kind === 'token') {
      const token = map.tokens.find((t) => t.id === entry.id)
      return token?.playerCharacter === true ? 'Token de jogador' : token?.npc === true ? 'Token de NPC' : 'Token'
    }
    if (entry.kind === 'door') {
      const porta = map.walls.find((w) => w.id === entry.id)?.door
      return porta?.locked === true ? 'Porta trancada' : porta?.open === true ? 'Porta aberta' : 'Porta fechada'
    }
    if (entry.kind === 'pin') {
      const pino = map.pins.find((p) => p.id === entry.id)
      return pino === undefined ? 'Pino' : NOME_DO_PINO[pino.kind]
    }
    return NOME_DO_TIPO[entry.kind]
  })()
  return entry.detail === '' ? tipo : `${tipo} · ${entry.detail}`
}

const ICONE_DO_TIPO: Partial<Record<MapObjectKind, typeof TokenIcon>> = { token: TokenIcon, door: DoorIcon, pin: PinIcon, room: RoomIcon }

/** O ícone da linha (o mesmo das ferramentas na barra), em 18 px como os itens do protótipo. */
const TAMANHO_DO_ICONE = 18

/**
 * "Neste mapa": o primeiro token, a primeira porta, o primeiro pino e a
 * primeira sala da cena — um de cada, só os que o clique consegue selecionar
 * (camada travada ou item oculto leva a câmera mas não seleciona, e um exemplo
 * que não abre a ficha não ensina nada). Puro: mesma cena, mesma lista.
 */
export function exemplosDoMapa(map: MapData): MapObjectEntry[] {
  const selecionaveis = mapObjectsOf(map).filter((entry) => entry.blockedReason === null)
  return ORDEM_DOS_EXEMPLOS.flatMap((kind) => selecionaveis.find((entry) => entry.kind === kind) ?? [])
}

export interface NadaSelecionadoProps {
  /**
   * A cena aberta e o "ir até" da lista de objetos (`goToMapObject`, o mesmo
   * clique da página Cena: seleciona e leva a câmera). Ausente = sem o "Neste
   * mapa".
   */
  nesteMapa?: { map: MapData; onIr: (entry: MapObjectEntry) => void }
}

/**
 * A página Ficha com Selecionar na mão e nada selecionado (fatia 7 do design
 * consolidado, `vazioSelecionar` do protótipo): o convite tracejado com os
 * atalhos de quem vai selecionar, e embaixo um exemplo de cada tipo da cena
 * para abrir a ficha com um clique.
 *
 * "Nada selecionado" continua um botão desabilitado com o texto exato: é
 * contrato das jornadas, a prova de que o clique no vazio desmarcou
 * (task4-select-delete, parede-grossa, portao-vista-movel...). Nenhum outro
 * texto da página pode conter "nada selecionado": `getByText` não aceitaria dois.
 */
export function NadaSelecionado({ nesteMapa }: NadaSelecionadoProps) {
  const map = nesteMapa?.map
  const exemplos = useMemo(() => (map === undefined ? [] : exemplosDoMapa(map)), [map])
  return (
    <div className="lb-ficha-vazia">
      <div className="gr-vazio">
        <button type="button" className="gr-vazio__tit lb-ficha-vazia__estado" disabled>
          Nada selecionado
        </button>
        <p>Clique numa ficha, porta, pino ou sala do mapa e as propriedades dela aparecem aqui.</p>
        <dl className="lb-ficha-vazia__atalhos">
          <dt>
            <kbd className="gr-kbd">Ctrl K</kbd>
          </dt>
          <dd>Procurar no mapa</dd>
          <dt>
            <kbd className="gr-kbd">Esc</kbd>
          </dt>
          <dd>Limpar a seleção</dd>
          <dt>
            <kbd className="gr-kbd">Del</kbd>
          </dt>
          <dd>Apagar o selecionado</dd>
        </dl>
      </div>
      {nesteMapa !== undefined && exemplos.length > 0 && (
        <>
          <h2 className="lb-ficha-vazia__titulo">
            Neste mapa<small>para experimentar</small>
          </h2>
          <ul className="lb-ficha-vazia__lista">
            {exemplos.map((entry) => {
              const Icone = ICONE_DO_TIPO[entry.kind]
              const tipo = tipoDoExemplo(nesteMapa.map, entry)
              return (
                <li key={entry.key}>
                  <button type="button" className="lb-ficha-vazia__item" onClick={() => nesteMapa.onIr(entry)}>
                    <span className="lb-ficha-vazia__ic" aria-hidden="true">
                      {Icone && <Icone size={TAMANHO_DO_ICONE} />}
                    </span>
                    <span className="lb-ficha-vazia__txt">
                      <span className="lb-ficha-vazia__nome">{entry.name}</span>
                      <span className="lb-ficha-vazia__sub">{tipo}</span>
                    </span>
                    <span className="lb-ficha-vazia__seta" aria-hidden="true">
                      <ChevronDownIcon />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
