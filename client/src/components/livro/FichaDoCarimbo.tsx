import { useId, useSyncExternalStore } from 'react'
import type { Carimbo, CarimboImportado, MapData } from '../../types/map'
import { carimboPorId, ehTipoImportado, normalizarGiro, TAMANHO_DO_CARIMBO_MAX, TAMANHO_DO_CARIMBO_MIN } from '../../lib/carimbos'
import { anguloVisivelDoCarimbo } from '../../lib/alcasDoCarimbo'
import { unidadeDoRelevo } from '../../lib/relevo'
import { selectionSingle, type SelectionSet } from '../../lib/selectionModel'
import { assinarCarimbos, carimboDoCatalogo, listarCarimbos, tamanhoNaturalDoTipo } from '../../carimbos/catalogo'
import { useMapStore } from '../../stores/mapStore'
import { Toggle } from '../Toggle'
import { Essencial } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import './fichaDoItem.css'

/**
 * A FICHA DO CARIMBO (Fase 2, 15/11/2026: "o carimbo porque não consigo
 * editar?"). O carimbo selecionado sozinho abre aqui, no livro do mestre, com
 * a gramática da ficha do objeto: o essencial diz o que ele É (Tipo, Tamanho,
 * Giro) e a ficha "No mapa" tem o cadeado e as duas chaves de jogo, "Barra a
 * passagem" e "Tapa a visão" (`lib/carimbosQueBarram.ts`), desligadas em todo
 * carimbo que já existia. Tudo vai à cena aberta pela store, com Ctrl+Z.
 */

/** O giro anda de 45 em 45 graus: cada carimbo da biblioteca tem 8 desenhos (`varianteDoGiro`). */
const PASSO_DO_GIRO = 45
const PASSO_DO_TAMANHO = 5
const PREFIXO_LEMBRADO = 'lb-section:ficha-carimbo-'

/** O carimbo quando ele é a seleção inteira (um item só), ou `null`. */
export function carimboSelecionadoDe(map: MapData, selection: SelectionSet): Carimbo | null {
  const item = selectionSingle(selection)
  if (item === null || item.kind !== 'carimbo') return null
  return carimboPorId(map.carimbos, item.id) ?? null
}

/** O carimbo selecionado sozinho na cena aberta. A mesma referência enquanto ele não muda (sem render à toa). */
export function useCarimboSelecionado(): Carimbo | null {
  return useMapStore((state) => carimboSelecionadoDe(state.map, state.selection))
}

/** O nome do tipo: o da biblioteca ("Pinheiro") ou o que o mestre deu ao importado; `null` quando o tipo não está neste aparelho. */
export function nomeDoTipoDeCarimbo(tipo: string, importados: readonly CarimboImportado[] | undefined): string | null {
  const daBiblioteca = carimboDoCatalogo(tipo)
  if (daBiblioteca !== null) return daBiblioteca.nome
  return importados?.find((c) => c.id === tipo)?.nome ?? null
}

/** O tamanho natural do tipo neste mapa (100%), em px de mundo — a mesma régua do canto das alças. */
function naturalDoTipo(tipo: string, mapa: Pick<MapData, 'width' | 'height' | 'grid'>): number {
  return tamanhoNaturalDoTipo(tipo, unidadeDoRelevo(mapa), mapa.grid)
}

/** O tamanho do carimbo em % do natural do tipo, de 5 em 5, dentro da faixa do controle. */
export function porcentagemDoCarimbo(c: Pick<Carimbo, 'tipo' | 'tamanho'>, mapa: Pick<MapData, 'width' | 'height' | 'grid'>): number {
  const pct = (c.tamanho / naturalDoTipo(c.tipo, mapa)) * 100
  return Math.min(TAMANHO_DO_CARIMBO_MAX, Math.max(TAMANHO_DO_CARIMBO_MIN, Math.round(pct / PASSO_DO_TAMANHO) * PASSO_DO_TAMANHO))
}

function FichaDoCarimboLembrada(props: Omit<FichaLembradaProps, 'prefixo'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} {...props} />
}

function resumoNoMapa(c: Carimbo): string {
  if (c.locked === true) return 'Travado'
  const chaves = [c.barra === true ? 'Barra' : null, c.tapaVisao === true ? 'Tapa' : null].filter((x) => x !== null)
  return chaves.length === 0 ? 'Livre' : chaves.join(' e ')
}

export function FichaDoCarimbo({ carimbo }: { carimbo: Carimbo }) {
  const mudarCarimbo = useMapStore((state) => state.mudarCarimbo)
  const importados = useMapStore((state) => state.map.carimbosImportados)
  const largura = useMapStore((state) => state.map.width)
  const altura = useMapStore((state) => state.map.height)
  const grade = useMapStore((state) => state.map.grid)
  // O catálogo cresce quando um pacote chega: a lista de tipos acompanha.
  const catalogo = useSyncExternalStore(assinarCarimbos, listarCarimbos)
  const idTipo = useId()
  const idTamanho = useId()
  const idPassagem = useId()
  const idVisao = useId()
  const mapa = { width: largura, height: altura, grid: grade }
  const pct = porcentagemDoCarimbo(carimbo, mapa)
  const travado = carimbo.locked === true
  const tiposConhecidos = new Set([...catalogo.map((c) => c.id), ...(importados ?? []).map((c) => c.id)])

  // Trocar o tipo mantém a porcentagem: o carvalho no lugar do pinheiro sai do mesmo "tamanho" escolhido.
  const trocarTipo = (tipo: string) => mudarCarimbo(carimbo.id, { tipo, tamanho: (naturalDoTipo(tipo, mapa) * pct) / 100 })
  const mudarTamanho = (novoPct: number) => mudarCarimbo(carimbo.id, { tamanho: (naturalDoTipo(carimbo.tipo, mapa) * novoPct) / 100 }, 'tamanho')
  // O giro parte do ângulo que a tela mostra: o importado de antes, que só inclinava uns graus,
  // vai a 45° (e não a 180°, de ponta-cabeça) e passa a girar de verdade (`giroLivre`; a
  // biblioteca ignora o campo). Na biblioteca a conta é a mesma de antes.
  const girar = (sentido: 1 | -1) => {
    const base = anguloVisivelDoCarimbo(carimbo)
    mudarCarimbo(carimbo.id, { giro: normalizarGiro(Math.round(base / PASSO_DO_GIRO) * PASSO_DO_GIRO + sentido * PASSO_DO_GIRO), giroLivre: true })
  }
  // O número do giro é o que a tela mostra; no importado de antes, a inclinação, não o sorteio guardado.
  const giroNaTela = ehTipoImportado(carimbo.tipo) && carimbo.giroLivre !== true ? normalizarGiro(anguloVisivelDoCarimbo(carimbo)) : carimbo.giro

  return (
    <section className="lb-ficha-do-objeto">
      <h2 className="gr-sr">Carimbo</h2>
      <Essencial>
        <div className="lb-field">
          <label className="lb-label" htmlFor={idTipo}>
            Tipo
          </label>
          <select id={idTipo} className="lb-input" value={carimbo.tipo} disabled={travado} onChange={(event) => trocarTipo(event.target.value)}>
            {/* O tipo que este aparelho não tem (pacote que não chegou) fica escolhido, com o id. */}
            {!tiposConhecidos.has(carimbo.tipo) && <option value={carimbo.tipo}>{carimbo.tipo}</option>}
            {/* O aposentado só aparece no objeto que já é dele: a troca oferece o que está em uso. */}
            {catalogo
              .filter((c) => c.aposentado !== true || c.id === carimbo.tipo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            {(importados ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor={idTamanho}>
              Tamanho
            </label>
            <span className="lb-num">{pct}%</span>
          </div>
          <input
            id={idTamanho}
            className="lb-range"
            type="range"
            min={TAMANHO_DO_CARIMBO_MIN}
            max={TAMANHO_DO_CARIMBO_MAX}
            step={PASSO_DO_TAMANHO}
            value={pct}
            disabled={travado}
            onChange={(event) => mudarTamanho(Number(event.target.value))}
          />
        </div>
        <div className="lb-field">
          <div className="lb-section__row">
            <span className="lb-label">Giro</span>
            <span className="lb-num">{giroNaTela}°</span>
          </div>
          <div className="lb-section__row">
            {/* Rótulo curto (o longo vazava do livro, visto no print da Fase 2); o nome inteiro vai ao leitor de tela. */}
            <button type="button" className="lb-btn lb-btn--compact" aria-label="Girar 45° para a esquerda" disabled={travado} onClick={() => girar(-1)}>
              −45°
            </button>
            <button type="button" className="lb-btn lb-btn--compact" aria-label="Girar 45° para a direita" disabled={travado} onClick={() => girar(1)}>
              +45°
            </button>
          </div>
        </div>
      </Essencial>
      <Fichas>
        <FichaDoCarimboLembrada id="no-mapa" titulo="No mapa" icone="cadeado" padrao resumo={resumoNoMapa(carimbo)}>
          <div className="lb-field">
            <Toggle label="Travado" checked={travado} onChange={(liga) => mudarCarimbo(carimbo.id, { locked: liga })} />
          </div>
          <div className="lb-field">
            <Toggle label="Barra a passagem" checked={carimbo.barra === true} onChange={(liga) => mudarCarimbo(carimbo.id, { barra: liga })} describedBy={idPassagem} />
            <p id={idPassagem} className="lb-field__hint">
              A ficha do jogador não atravessa o pé deste carimbo. Você, mestre, atravessa sempre.
            </p>
          </div>
          <div className="lb-field">
            <Toggle label="Tapa a visão" checked={carimbo.tapaVisao === true} onChange={(liga) => mudarCarimbo(carimbo.id, { tapaVisao: liga })} describedBy={idVisao} />
            <p id={idVisao} className="lb-field__hint">
              Os jogadores não veem através do pé deste carimbo, como numa parede.
            </p>
          </div>
        </FichaDoCarimboLembrada>
      </Fichas>
    </section>
  )
}
