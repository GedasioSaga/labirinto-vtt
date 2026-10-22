import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { classes } from './comum'
import './grimorio.css'

export interface SecaoDaNavegacao {
  /** Fica no id da seção (`<idDaNavegacao>-<id>`) e é o que `secaoInicial` aponta. */
  id: string
  rotulo: string
  conteudo: ReactNode
}

export interface NavegacaoVerticalProps {
  /** Nome acessível da lista ("Seções de Configurações do mapa"). */
  rotulo: string
  secoes: readonly SecaoDaNavegacao[]
  /** A seção que já abre à vista (o atalho "Mapa vivo" da página Cena). */
  secaoInicial?: string
}

/** Folga do topo da rolagem: a seção que encosta nela já é a da vez. */
const FOLGA_DA_SECAO_PX = 12

/** Quem rola: o corpo do diálogo (`.gr-dlg__corpo`), senão a própria navegação. */
function rolagemDe(no: HTMLElement): HTMLElement {
  return no.closest<HTMLElement>('.gr-dlg__corpo') ?? no
}

/**
 * A navegação vertical das janelas de configuração (o `.nav-vertical` do
 * protótipo): a lista de seções à esquerda e o conteúdo à direita; no estreito
 * a lista vai para cima, rolando de lado. Todas as seções ficam montadas, uma
 * embaixo da outra: a lista leva à seção e acende a que está à vista, e o Tab, a
 * busca do navegador e quem procura um campo pelo nome acham tudo, como antes.
 */
export function NavegacaoVertical({ rotulo, secoes, secaoInicial }: NavegacaoVerticalProps) {
  const prefixo = useId()
  const raiz = useRef<HTMLDivElement>(null)
  const [daVez, setDaVez] = useState(secaoInicial ?? secoes[0]?.id ?? '')
  const idDe = (secao: string) => `${prefixo}-${secao}`

  const irPara = (secao: string) => {
    const alvo = document.getElementById(idDe(secao))
    const no = raiz.current
    if (alvo === null || no === null) return
    const rolagem = rolagemDe(no)
    // Pulo seco, sem rolagem suave: quem escolheu a seção quer lê-la já.
    rolagem.scrollTop += alvo.getBoundingClientRect().top - rolagem.getBoundingClientRect().top
    setDaVez(secao)
  }

  // Só ao abrir: depois, quem manda na seção é a rolagem e a lista.
  useLayoutEffect(() => {
    if (secaoInicial !== undefined) irPara(secaoInicial)
  }, [])

  // A seção da vez acompanha a rolagem: a última cujo topo já passou do topo da área.
  useEffect(() => {
    const no = raiz.current
    if (no === null) return
    const rolagem = rolagemDe(no)
    const acompanhar = () => {
      const topo = rolagem.getBoundingClientRect().top + FOLGA_DA_SECAO_PX
      let atual = secoes[0]?.id ?? ''
      for (const secao of secoes) {
        const alvo = document.getElementById(idDe(secao.id))
        if (alvo !== null && alvo.getBoundingClientRect().top <= topo) atual = secao.id
      }
      // No fim da rolagem a última seção pode ser baixa demais para chegar ao topo.
      if (rolagem.scrollTop + rolagem.clientHeight >= rolagem.scrollHeight - 1) atual = secoes[secoes.length - 1]?.id ?? atual
      setDaVez(atual)
    }
    rolagem.addEventListener('scroll', acompanhar, { passive: true })
    return () => rolagem.removeEventListener('scroll', acompanhar)
  }, [secoes, prefixo])

  return (
    <div ref={raiz} className="gr-dlg-duas">
      <nav className="gr-nav-vertical" aria-label={rotulo}>
        {secoes.map((secao) => (
          <button
            key={secao.id}
            type="button"
            className={classes(secao.id === daVez && 'gr-e-davez')}
            aria-current={secao.id === daVez ? 'true' : undefined}
            aria-controls={idDe(secao.id)}
            onClick={() => irPara(secao.id)}
          >
            {secao.rotulo}
          </button>
        ))}
      </nav>
      {/* O foco do diálogo entra no conteúdo (ou na seção pedida), e não na lista: é o campo que se veio mexer. */}
      <div className="gr-dlg-duas__conteudo" data-gr-foco={secaoInicial === undefined ? '' : undefined}>
        {secoes.map((secao) => (
          // Sem nome próprio: o título de cada seção já vem dos controles de dentro.
          <div key={secao.id} id={idDe(secao.id)} className="gr-dlg-duas__secao" data-gr-foco={secao.id === secaoInicial ? '' : undefined}>
            {secao.conteudo}
          </div>
        ))}
      </div>
    </div>
  )
}
