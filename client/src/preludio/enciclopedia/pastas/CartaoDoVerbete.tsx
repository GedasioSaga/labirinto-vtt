import { memo, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { semAcento, semAcentoComMapa } from '../../../lib/preparo/enciclopedia'
import type { Verbete } from '../../../lib/preparo/tipos'
import { urlDaMidia, useRaizDaMidia } from '../../midia'
import { iniciais, Retrato } from '../Imagens'
import { IconeCerto, IconeEscudo, IconeLugar, IconeMais } from './icones'

function formaAtiva(verbete: Verbete) {
  return verbete.formas.find((forma) => forma.id === verbete.formaAtivaId) ?? verbete.formas[0]
}

/** O retrato da forma ativa (`midia/<sha>.<ext>`), ou nada. */
export function retratoDe(verbete: Verbete): string | undefined {
  return formaAtiva(verbete)?.retrato
}

/**
 * A imagem do lugar: o retrato da forma ativa ou, sem ele, a primeira da
 * galeria. O cenário importado do Grimório costuma vir só com a galeria.
 */
export function imagemDoLugar(verbete: Verbete): string | undefined {
  const forma = formaAtiva(verbete)
  return forma?.retrato ?? forma?.imagens[0]?.midia
}

/** Um número estável de 0 a 99 pelo id: o desenho do lugar sem imagem não é igual em todos os cartões. */
function sorteDoId(id: string): number {
  let soma = 0
  for (let indice = 0; indice < id.length; indice += 1) soma = (soma * 31 + id.charCodeAt(indice)) % 9973
  return soma % 100
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

/**
 * Sem imagem (ou com o arquivo faltando): o retrato mostra as iniciais; o
 * lugar, a primeira letra sobre um mapa discreto (curvas de nível e a grade),
 * com o centro das curvas mudando de cartão para cartão. Nunca a imagem quebrada.
 */
function SemImagem({ nome, id, capa }: { nome: string; id: string; capa: Capa }) {
  if (capa === 'retrato') return <span className="pp-carta__iniciais">{iniciais(nome)}</span>
  const sorte = sorteDoId(id)
  const centro = { '--pp-mapa-x': `${18 + (sorte % 7) * 11}%`, '--pp-mapa-y': `${22 + (Math.floor(sorte / 7) % 6) * 11}%` } as CSSProperties
  return (
    <span className="pp-carta__iniciais pp-carta__mapa" style={centro}>
      {iniciais(nome).slice(0, 1)}
    </span>
  )
}

function FotoDoCartao({ nome, id, midia, capa }: { nome: string; id: string; midia: string | undefined; capa: Capa }) {
  const raiz = useRaizDaMidia()
  const [falhou, setFalhou] = useState(false)
  const url = raiz === null || falhou ? null : urlDaMidia(raiz, midia)
  return url === null ? <SemImagem nome={nome} id={id} capa={capa} /> : <img src={url} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFalhou(true)} />
}

/** O selo dos lugares de dentro ("4 dentro"), no canto do cartão. */
function SeloDentro({ quantos }: { quantos: number }) {
  return (
    <span className="pp-selo-npc pp-selo-dentro" title={quantos === 1 ? '1 lugar dentro' : `${quantos} lugares dentro`}>
      <IconeLugar />
      {quantos} dentro
    </span>
  )
}

type Capa = 'retrato' | 'paisagem'

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
  /**
   * 'paisagem' (Lugares): a imagem do lugar (retrato ou a primeira da
   * galeria), deitada, e o mapa discreto quando não há imagem. Padrão: 'retrato'.
   */
  capa?: Capa
  /** Quantos lugares há dentro (o selo); 0 = nenhum. */
  dentro?: number
  /** O cartão também recebe o arrasto (soltar um lugar dentro deste). */
  alvo?: boolean
}

/**
 * Um verbete na lista com pastas: o retrato grande (grade) ou a linha (lista).
 * Marcar, abrir e o menu "…" são botões separados; arrastar sai do botão de abrir.
 * `memo`: marcar um não redesenha os outros 100.
 */
export const CartaoDoVerbete = memo(function CartaoDoVerbete({
  verbete,
  vista,
  marcado,
  npc,
  sub,
  resumo,
  busca,
  aoMarcar,
  aoAbrir,
  aoMenu,
  aoApertar,
  capa = 'retrato',
  dentro = 0,
  alvo = false,
}: CartaoDoVerbeteProps) {
  const nome = verbete.titulo || 'Sem nome'
  const midia = capa === 'paisagem' ? imagemDoLugar(verbete) : retratoDe(verbete)
  const soltaAqui = alvo ? verbete.id : undefined
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
      <li className={`pp-linha-v${marcado ? ' e-sel' : ''}`} data-verbete={verbete.id} data-solta-pasta={soltaAqui}>
        {marca}
        <button type="button" className="pp-linha-v__abrir" {...abrir}>
          <Retrato nome={nome} midia={midia} tamanho="p" />
          <span className="pp-linha-v__texto">
            <span className="pp-linha-v__nome">
              <Realce texto={nome} busca={busca} />
            </span>
            {resumo !== '' && <span className="pp-linha-v__resumo">{resumo}</span>}
          </span>
        </button>
        <span className="pp-linha-v__meta">
          {npc && <SeloNpc />}
          {dentro > 0 && <SeloDentro quantos={dentro} />}
          <span>{sub}</span>
        </span>
        {menu}
      </li>
    )
  }
  return (
    <li className={`pp-carta${capa === 'paisagem' ? ' pp-carta--paisagem' : ''}${marcado ? ' e-sel' : ''}`} data-verbete={verbete.id} data-solta-pasta={soltaAqui}>
      {marca}
      {menu}
      <button type="button" className="pp-carta__abrir" {...abrir}>
        <span className="pp-carta__foto">
          <FotoDoCartao nome={nome} id={verbete.id} midia={midia} capa={capa} />
          {npc && <SeloNpc />}
          {dentro > 0 && <SeloDentro quantos={dentro} />}
        </span>
        <span className="pp-carta__nome">
          <Realce texto={nome} busca={busca} />
        </span>
        {sub !== '' && <span className="pp-carta__sub">{sub}</span>}
      </button>
    </li>
  )
})
