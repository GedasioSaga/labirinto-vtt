import { Fragment, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { sceneTree } from '../../lib/adventure'
import type { SceneListItem } from '../../stores/adventureStore'
import { Botao } from '../grimorio/Botao'
import { Balao } from '../grimorio/Balao'
import { MenuItem, MenuRotulo, MenuSeparador, Pop } from '../grimorio/Pop'
import { IconeDoLivro } from './icones'
import '../grimorio/grimorio.css'
import './livro.css'

/** Uma cena no menu; `dentroDe` é a cena de fora quando ela não é a pasta do trecho (2º nível para dentro). */
export interface CenaDoMenu {
  cena: SceneListItem
  dentroDe: string | null
}

/** Um trecho do menu: a pasta (`rotulo`) e as cenas dela; sem pastas na aventura, um trecho só e sem rótulo. */
export interface TrechoDoMenu {
  /** Identidade do trecho: o id da pasta, ou um nome fixo para o trecho sem pasta. Duas pastas podem ter o mesmo nome. */
  chave: string
  rotulo: string | null
  cenas: CenaDoMenu[]
}

/** Legenda das cenas de primeiro nível sem nada dentro, a mesma da Visão geral (SceneOverview.tsx). */
export const OUTRAS_CENAS = 'Outras cenas'

/**
 * O MENU DE CENAS POR PASTA, no mesmo agrupamento da Visão geral: cada cena de
 * primeiro nível que tem cenas dentro é uma pasta, com ela mesma e tudo o que
 * mora dentro dela (em qualquer profundidade, na ordem da lista Cenas); as de
 * primeiro nível sem nada dentro vão para "Outras cenas", no fim. Aventura sem
 * pastas é um trecho só. Nenhuma cena some nem aparece duas vezes.
 */
export function trechosDoMenu(cenas: readonly SceneListItem[]): TrechoDoMenu[] {
  const linhas = sceneTree(cenas)
  if (!linhas.some((linha) => linha.childIds.length > 0)) {
    return [{ chave: 'todas', rotulo: null, cenas: linhas.map((linha) => ({ cena: linha.entry, dentroDe: null })) }]
  }
  const porId = new Map(linhas.map((linha) => [linha.entry.id, linha]))
  const raizDe = (id: string): string => {
    let atual = id
    let pai = porId.get(atual)?.parentId ?? null
    while (pai !== null) {
      atual = pai
      pai = porId.get(atual)?.parentId ?? null
    }
    return atual
  }
  const pastas = new Map<string, TrechoDoMenu>()
  const soltas: CenaDoMenu[] = []
  for (const linha of linhas) {
    const raiz = porId.get(raizDe(linha.entry.id))
    if (raiz === undefined || raiz.childIds.length === 0) {
      soltas.push({ cena: linha.entry, dentroDe: null })
      continue
    }
    let pasta = pastas.get(raiz.entry.id)
    if (pasta === undefined) {
      pasta = { chave: `pasta:${raiz.entry.id}`, rotulo: raiz.entry.name, cenas: [] }
      pastas.set(raiz.entry.id, pasta)
    }
    // A pasta já diz onde mora o 1º nível de dentro; do 2º para dentro, a linha diz a cena de fora.
    const dentroDe = linha.depth >= 2 && linha.parentId !== null ? (porId.get(linha.parentId)?.entry.name ?? null) : null
    pasta.cenas.push({ cena: linha.entry, dentroDe })
  }
  const trechos = [...pastas.values()]
  if (soltas.length > 0) trechos.push({ chave: 'outras', rotulo: OUTRAS_CENAS, cenas: soltas })
  return trechos
}

/** O nome não coube no chip (cortado com reticências): o balão passa a mostrá-lo inteiro. */
function useNomeCortado(texto: RefObject<HTMLSpanElement | null>, nome: string): boolean {
  const [cortado, setCortado] = useState(false)
  useLayoutEffect(() => {
    const no = texto.current
    if (no === null) return
    const medir = () => setCortado(no.scrollWidth > no.clientWidth)
    medir()
    // A fonte de título pode chegar depois do primeiro desenho e mudar a largura do nome.
    let vivo = true
    if ('fonts' in document) {
      void document.fonts.ready.then(() => {
        if (vivo) medir()
      })
    }
    return () => {
      vivo = false
    }
  }, [texto, nome])
  return cortado
}

export interface ChipDaCenaProps {
  /** As cenas da aventura, como a lista Cenas as vê (`sceneList`); a aberta é a `active`. Mapa solto: ele mesmo, sozinho. */
  cenas: readonly SceneListItem[]
  /** Escolheu outra cena no menu. A aberta não chega aqui: escolher a cena em que já se está não faz nada. */
  onTrocar: (sceneId: string) => void
  /** Voltar à cena anterior. Ausente = não há para onde voltar, e a seta não aparece (como na antiga barra de ações). */
  onVoltar?: () => void
  /** "Ver todas as cenas": abre a Visão geral das cenas. */
  onVerTodas: () => void
}

/**
 * CHIP DA CENA (fatia 3 do design consolidado): no alto do mapa, a seta de
 * voltar à cena anterior e o nome inteiro da cena aberta ("cena inicial" ao
 * lado, quando é ela). O nome abre o menu de cenas por pasta, com "Ver todas
 * as cenas" no fim. Nome longo demais corta só aqui, com o nome inteiro no
 * balão; o menu e a Visão geral mostram tudo.
 */
export function ChipDaCena({ cenas, onTrocar, onVoltar, onVerTodas }: ChipDaCenaProps) {
  const [menuAberto, setMenuAberto] = useState(false)
  const gatilho = useRef<HTMLButtonElement>(null)
  const texto = useRef<HTMLSpanElement>(null)
  const aberta = cenas.find((cena) => cena.active)
  // Sem cena aberta (a lista ainda não chegou), o chip fica com o lugar e sem nome.
  const nome = aberta === undefined ? '' : aberta.name
  const cortado = useNomeCortado(texto, nome)

  const escolher = (cena: SceneListItem) => {
    if (!cena.active) onTrocar(cena.id)
  }

  return (
    <div className="gr-chip-cena" role="group" aria-label="Cena aberta">
      {onVoltar !== undefined && (
        <Balao texto="Voltar à cena anterior">
          {(props) => (
            <Botao soIcone aria-label="Voltar à cena anterior" {...props} onClick={onVoltar}>
              <IconeDoLivro nome="voltar" />
            </Botao>
          )}
        </Balao>
      )}
      <Balao texto={cortado ? nome : 'Trocar de cena'}>
        {(props) => (
          <button
            type="button"
            className="gr-chip-cena__nome"
            aria-haspopup="menu"
            aria-expanded={menuAberto}
            {...props}
            ref={(no) => {
              props.ref(no)
              gatilho.current = no
            }}
            onClick={() => setMenuAberto((estava) => !estava)}
          >
            <span ref={texto} className="gr-chip-cena__texto">
              {nome}
            </span>
            {aberta?.start === true && <small>cena inicial</small>}
            <IconeDoLivro nome="baixo" />
          </button>
        )}
      </Balao>
      <Pop aberto={menuAberto} gatilho={gatilho} onFechar={() => setMenuAberto(false)} lado="baixo" rotulo="Trocar de cena">
        {trechosDoMenu(cenas).map((trecho) => (
          <Fragment key={trecho.chave}>
            {trecho.rotulo !== null && <MenuRotulo>{trecho.rotulo}</MenuRotulo>}
            {trecho.cenas.map(({ cena, dentroDe }) => (
              <MenuItem
                key={cena.id || 'cena-solta'}
                icone={<IconeDoLivro nome="cena" />}
                // A que não abriu (arquivo sumido, ou ainda vindo do disco) fica no lugar, apagada, como na Visão geral.
                disabled={!cena.available}
                {...(dentroDe === null ? {} : { detalhe: `Dentro de ${dentroDe}` })}
                onClick={() => escolher(cena)}
              >
                {cena.name}
              </MenuItem>
            ))}
          </Fragment>
        ))}
        <MenuSeparador />
        <MenuItem icone={<IconeDoLivro nome="cenas" />} onClick={onVerTodas}>
          Ver todas as cenas
        </MenuItem>
      </Pop>
    </div>
  )
}
