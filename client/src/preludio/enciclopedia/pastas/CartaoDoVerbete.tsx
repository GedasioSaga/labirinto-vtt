import { memo, useState, type MouseEvent, type PointerEvent } from 'react'
import { semAcento, semAcentoComMapa } from '../../../lib/preparo/enciclopedia'
import type { Verbete } from '../../../lib/preparo/tipos'
import { urlDaMidia, useRaizDaMidia } from '../../midia'
import { iniciais, Retrato } from '../Imagens'
import { IconeCerto, IconeEscudo, IconeMais } from './icones'

/** O retrato da forma ativa (`midia/<sha>.<ext>`), ou nada. */
export function retratoDe(verbete: Verbete): string | undefined {
  return (verbete.formas.find((forma) => forma.id === verbete.formaAtivaId) ?? verbete.formas[0])?.retrato
}

/** O nome com o trecho procurado em destaque (sem acento: "joao" acha "João"). */
function Realce({ texto, busca }: { texto: string; busca: string }) {
  const procura = semAcento(busca.trim())
  if (procura === '') return <>{texto}</>
  const { texto: limpo, origem } = semAcentoComMapa(texto)
  const onde = limpo.indexOf(procura)
  if (onde < 0) return <>{texto}</>
  const inicio = origem[onde] ?? 0
  const ultimo = origem[onde + procura.length - 1] ?? inicio
  const fim = ultimo + (texto.codePointAt(ultimo) !== undefined && (texto.codePointAt(ultimo) ?? 0) > 0xffff ? 2 : 1)
  return (
    <>
      {texto.slice(0, inicio)}
      <mark className="pp-realce">{texto.slice(inicio, fim)}</mark>
      {texto.slice(fim)}
    </>
  )
}

function FotoDoCartao({ nome, midia }: { nome: string; midia: string | undefined }) {
  const raiz = useRaizDaMidia()
  const [falhou, setFalhou] = useState(false)
  const url = raiz === null || falhou ? null : urlDaMidia(raiz, midia)
  return url === null ? (
    <span className="pp-carta__iniciais">{iniciais(nome)}</span>
  ) : (
    <img src={url} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFalhou(true)} />
  )
}

function SeloNpc() {
  return (
    <span className="pp-selo-npc">
      <IconeEscudo />
      NPC
    </span>
  )
}

export interface CartaoDoVerbeteProps {
  verbete: Verbete
  vista: 'grade' | 'lista'
  marcado: boolean
  /** Mostra o selo "NPC" (o personagem tem ficha ligada). */
  npc: boolean
  /** A linha de baixo: campanha, "sem ficha" ou quando mudou. */
  sub: string
  /** O resumo (só na vista em lista). */
  resumo: string
  busca: string
  aoMarcar: (id: string, marcado: boolean) => void
  aoAbrir: (id: string) => void
  aoMenu: (id: string, gatilho: HTMLElement) => void
  aoApertar: (id: string, evento: PointerEvent<HTMLElement>) => void
}

/**
 * Um verbete na lista com pastas: o retrato grande (grade) ou a linha (lista).
 * Marcar, abrir e o menu "…" são botões separados; arrastar sai do botão de abrir.
 * `memo`: marcar um não redesenha os outros 100.
 */
export const CartaoDoVerbete = memo(function CartaoDoVerbete({ verbete, vista, marcado, npc, sub, resumo, busca, aoMarcar, aoAbrir, aoMenu, aoApertar }: CartaoDoVerbeteProps) {
  const nome = verbete.titulo || 'Sem nome'
  const marca = (
    <label className="pp-carta__marca" title="Marcar">
      <input type="checkbox" checked={marcado} aria-label={`Marcar ${nome}`} onChange={(evento) => aoMarcar(verbete.id, evento.target.checked)} />
      <IconeCerto />
    </label>
  )
  const menu = (
    <button
      type="button"
      className="pp-carta__mais"
      aria-label={`Ações de ${nome}`}
      aria-haspopup="menu"
      onClick={(evento: MouseEvent<HTMLButtonElement>) => aoMenu(verbete.id, evento.currentTarget)}
    >
      <IconeMais />
    </button>
  )
  const abrir = {
    onClick: () => aoAbrir(verbete.id),
    onPointerDown: (evento: PointerEvent<HTMLButtonElement>) => aoApertar(verbete.id, evento),
    onContextMenu: (evento: MouseEvent<HTMLButtonElement>) => {
      evento.preventDefault()
      aoMenu(verbete.id, evento.currentTarget)
    },
  }
  if (vista === 'lista') {
    return (
      <li className={`pp-linha-v${marcado ? ' e-sel' : ''}`} data-verbete={verbete.id}>
        {marca}
        <button type="button" className="pp-linha-v__abrir" {...abrir}>
          <Retrato nome={nome} midia={retratoDe(verbete)} tamanho="p" />
          <span className="pp-linha-v__texto">
            <span className="pp-linha-v__nome">
              <Realce texto={nome} busca={busca} />
            </span>
            {resumo !== '' && <span className="pp-linha-v__resumo">{resumo}</span>}
          </span>
        </button>
        <span className="pp-linha-v__meta">
          {npc && <SeloNpc />}
          <span>{sub}</span>
        </span>
        {menu}
      </li>
    )
  }
  return (
    <li className={`pp-carta${marcado ? ' e-sel' : ''}`} data-verbete={verbete.id}>
      {marca}
      {menu}
      <button type="button" className="pp-carta__abrir" {...abrir}>
        <span className="pp-carta__foto">
          <FotoDoCartao nome={nome} midia={retratoDe(verbete)} />
          {npc && <SeloNpc />}
        </span>
        <span className="pp-carta__nome">
          <Realce texto={nome} busca={busca} />
        </span>
        {sub !== '' && <span className="pp-carta__sub">{sub}</span>}
      </button>
    </li>
  )
})
