import type { KeyboardEvent, ReactNode } from 'react'
import { Torrada, Torradas } from '../../../components/grimorio/Torrada'
import { semAcento } from '../../../lib/preparo/enciclopedia'
import type { Campanha, Verbete } from '../../../lib/preparo/tipos'
import { IconeGrade, IconeLista, IconeLupa, IconeSeta } from './icones'

/**
 * AS PARTES DA LISTA ORGANIZADA (E3, 16/11): o que a lista com pastas
 * (Personagens, Itens, Facções) e a lista em regiões (Lugares) têm igual — a
 * barra de organizar, o grupo recolhível, a barra dos marcados e o aviso com
 * Desfazer. As duas telas montam estas peças; o que muda é como agrupam.
 */

export type Ordem = 'az' | 'rec'
export type Vista = 'grade' | 'lista'

export interface Aviso {
  readonly chave: number
  readonly texto: string
  readonly desfazer?: () => void
}

const QUANDO = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
const DIA_MS = 86_400_000
const UNIDADES: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * DIA_MS],
  ['month', 30 * DIA_MS],
  ['week', 7 * DIA_MS],
  ['day', DIA_MS],
]

/** "há 3 dias", "hoje", "sem data". */
export function quando(ms: number): string {
  if (ms === 0) return 'sem data'
  const passou = ms - Date.now()
  for (const [unidade, tamanho] of UNIDADES) if (Math.abs(passou) >= tamanho) return QUANDO.format(Math.round(passou / tamanho), unidade)
  return 'hoje'
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

/** Nome ou apelido contém a busca (já sem acento e minúscula). */
export function passaNaBusca(verbete: Verbete, busca: string): boolean {
  return busca === '' || semAcento(verbete.titulo).includes(busca) || verbete.apelidos.some((apelido) => semAcento(apelido).includes(busca))
}

/** O nome da primeira campanha do verbete, para a linha de baixo quando a tela mostra todas. */
export function campanhaDoVerbete(verbete: Verbete, campanhas: readonly Campanha[]): string {
  return verbete.campanhas.map((id) => campanhas.find((campanha) => campanha.id === id)?.nome).find((nome) => nome !== undefined) ?? 'sem campanha'
}

interface FerramentasDaListaProps {
  /** "personagem", "lugar": vai no rótulo escondido da busca. */
  um: string
  busca: string
  aoBuscar: (busca: string) => void
  campanhas: readonly Campanha[]
  campanhaId: string | null
  aoEscolherCampanha: (campanhaId: string | null) => void
  ordem: Ordem
  aoOrdenar: (ordem: Ordem) => void
  vista: Vista
  aoVer: (vista: Vista) => void
  /** O nome da vista em grade ("Retratos", "Imagens"). */
  rotuloDaGrade: string
  /** Filtros a mais, entre a campanha e a ordem (o "Já é NPC" de Personagens). */
  children?: ReactNode
}

/** A barra de organizar: busca pelo nome e apelido, campanha, filtros, A–Z ou Recentes, grade ou lista. Gruda no topo ao rolar. */
export function FerramentasDaLista(props: FerramentasDaListaProps) {
  const { ordem, vista } = props
  return (
    <div className="pp-ferr" role="toolbar" aria-label="Organizar a lista">
      <label className="pp-busca">
        <span className="pr-sr">Procurar {props.um}</span>
        <IconeLupa />
        <input type="search" placeholder="Procurar pelo nome ou apelido" value={props.busca} autoComplete="off" onChange={(evento) => props.aoBuscar(evento.target.value)} />
      </label>
      <label className="pp-filtro">
        Campanha
        <select value={props.campanhaId ?? ''} disabled={props.campanhas.length === 0} onChange={(evento) => props.aoEscolherCampanha(evento.target.value === '' ? null : evento.target.value)}>
          <option value="">Todas</option>
          {props.campanhas.map((uma) => (
            <option key={uma.id} value={uma.id}>
              {uma.nome}
            </option>
          ))}
        </select>
      </label>
      {props.children}
      <div className="pp-seg" role="group" aria-label="Ordem">
        <button type="button" aria-pressed={ordem === 'az'} onClick={() => props.aoOrdenar('az')}>
          A–Z
        </button>
        <button type="button" aria-pressed={ordem === 'rec'} onClick={() => props.aoOrdenar('rec')}>
          Recentes
        </button>
      </div>
      <div className="pp-seg pp-seg--ic" role="group" aria-label="Vista">
        <button type="button" aria-pressed={vista === 'grade'} aria-label={props.rotuloDaGrade} title={props.rotuloDaGrade} onClick={() => props.aoVer('grade')}>
          <IconeGrade />
        </button>
        <button type="button" aria-pressed={vista === 'lista'} aria-label="Lista" title="Lista" onClick={() => props.aoVer('lista')}>
          <IconeLista />
        </button>
      </div>
    </div>
  )
}

interface GrupoDaListaProps {
  /** O id do alvo do arrasto (`data-solta-pasta`); ausente = o grupo não recebe. */
  alvo?: string
  nome: string
  /** "em Mar do Leste": onde o grupo mora. */
  caminho?: string
  conta: number
  fechado: boolean
  aoAlternar: () => void
  children: ReactNode
}

/** Um grupo recolhível com a conta. Recolher é instantâneo (o porquê está no CSS). */
export function GrupoDaLista({ alvo, nome, caminho, conta, fechado, aoAlternar, children }: GrupoDaListaProps) {
  return (
    <section className={`pp-grupo${fechado ? ' e-fechado' : ''}`} data-solta-pasta={alvo} aria-label={nome}>
      <h3 className="pp-grupo__h">
        <button type="button" className="pp-grupo__cab" aria-expanded={!fechado} onClick={aoAlternar}>
          <span className="pp-grupo__seta" aria-hidden="true">
            <IconeSeta />
          </span>
          <span className="pp-grupo__nome">{nome}</span>
          {caminho !== undefined && caminho !== '' && <span className="pp-grupo__caminho">{caminho}</span>}
          <span className="pp-grupo__conta">{conta}</span>
        </button>
      </h3>
      <div className="pp-grupo__corpo" inert={fechado}>
        <div className="pp-grupo__miolo">{children}</div>
      </div>
    </section>
  )
}

interface BarraDosMarcadosProps {
  /** "Personagens marcados". */
  rotulo: string
  quantos: number
  travado: boolean
  aoMover: (gatilho: HTMLElement) => void
  aoDesmarcar: () => void
}

/** A barra que sobe quando há marcados: "Mover para…" e "Desmarcar (Esc)". */
export function BarraDosMarcados({ rotulo, quantos, travado, aoMover, aoDesmarcar }: BarraDosMarcadosProps) {
  return (
    <div className={`pp-barra-sel${quantos > 0 ? '' : ' e-fora'}`} role="region" aria-label={rotulo}>
      <span className="pp-barra-sel__conta">{plural(quantos, 'marcado', 'marcados')}</span>
      <button type="button" className="gr-bt gr-bt--p gr-bt--primario" aria-haspopup="menu" disabled={travado || quantos === 0} onClick={(evento) => aoMover(evento.currentTarget)}>
        Mover para…
      </button>
      <button type="button" className="gr-bt gr-bt--p gr-bt--fantasma" disabled={quantos === 0} onClick={aoDesmarcar}>
        Desmarcar <kbd className="gr-kbd">Esc</kbd>
      </button>
    </div>
  )
}

/** O aviso de baixo, com Desfazer quando dá. */
export function AvisoDaLista({ aviso, aoFechar }: { aviso: Aviso | null; aoFechar: (chave: number) => void }) {
  if (aviso === null) return null
  return (
    <Torradas>
      <Torrada key={aviso.chave} mensagem={aviso.texto} acao={aviso.desfazer === undefined ? undefined : { rotulo: 'Desfazer', onClick: aviso.desfazer }} onFechar={() => aoFechar(aviso.chave)} />
    </Torradas>
  )
}

interface TeclasDosMarcados {
  readonly marcados: number
  readonly menuAberto: boolean
  readonly aoDesmarcar: () => void
  readonly aoMarcarTodos: () => void
}

/** Esc desmarca tudo; Ctrl+A marca os que estão na tela (só com o foco na lista, nunca num campo). */
export function teclaDosMarcados(evento: KeyboardEvent<HTMLElement>, { marcados, menuAberto, aoDesmarcar, aoMarcarTodos }: TeclasDosMarcados): void {
  const emCampo = evento.target instanceof HTMLInputElement && evento.target.type !== 'checkbox'
  if (evento.key === 'Escape' && marcados > 0 && !emCampo && !menuAberto) {
    evento.preventDefault()
    aoDesmarcar()
  } else if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === 'a' && !emCampo && evento.target instanceof Element && evento.target.closest('.pp-resultado') !== null) {
    evento.preventDefault()
    aoMarcarTodos()
  }
}
