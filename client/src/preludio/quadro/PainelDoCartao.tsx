import { useEffect, useMemo, useRef, type FocusEvent } from 'react'
import { useSvgExportContext } from 'tldraw'
import type { AlvoNaMesa } from '../../lib/preparo/sessoes'
import type { Forma, Secao, TextoRico, Verbete } from '../../lib/preparo/tipos'
import { precarregarEditor, TextoDoPreludio } from '../editor/sobDemanda'
import { usePreludio } from '../estado/preludio'
import { abrirNaMesaPeloPreludio, podeAbrirNaMesa } from '../mesa/ponte'
import { temTexto, TextoDoRoteiro, type ContextoDoRoteiro } from '../roteiro/TextoDoRoteiro'
import { FONTE_MAX, FONTE_MIN, FONTE_PASSO, proximaEscala } from './escalaFonte'
import { useVezDoTexto } from './vezDoTexto'

/**
 * O TEXTO DO CARTÃO NO QUADRO (fatia F3c, como no Grimório,
 * `CharacterCardShape.tsx`): cada seção da forma ativa, com o texto formatado
 * (negrito, títulos, listas, o bloco de segredo, as @menções e os links da
 * mesa), e o lápis que abre ali mesmo o editor de texto do Prelúdio (o mesmo
 * TipTap da página do verbete). O que se escreve vai para o verbete; a seção
 * de segredo continua de segredo (o cartão só troca o texto, nunca a marca).
 */

const PROCURAR_O_CAMPO_POR = 120

/** A marca que a sugestão da @menção aberta põe no texto digitado (`decorationClass` padrão da `@tiptap/suggestion`). */
const MARCA_DA_MENCAO_ABERTA = '.suggestion'

function verbeteDaFicha(alvo: Extract<AlvoNaMesa, { tipo: 'ficha' }>): Verbete | undefined {
  for (const verbete of usePreludio.getState().verbetes.values()) {
    if (verbete.liga?.fichas.some((ficha) => ficha.pastaId === alvo.pastaId && ficha.personagemId === alvo.personagemId) === true) return verbete
  }
  return undefined
}

/** O texto da seção mudou no cartão: grava no verbete, pela fila de sempre (só o texto; o segredo fica como está). */
function gravarTextoDaSecao(verbeteId: string, formaId: string, secaoId: string, texto: TextoRico): void {
  usePreludio.getState().mudarVerbete(verbeteId, (atual) => ({
    ...atual,
    formas: atual.formas.map((forma) => (forma.id !== formaId ? forma : { ...forma, secoes: forma.secoes.map((secao) => (secao.id === secaoId ? { ...secao, texto } : secao)) })),
  }))
}

const LAPIS = (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M12.6 4.4l3 3M4.5 15.5l.8-3.6 8.4-8.4a1.4 1.4 0 0 1 2 0l.8.8a1.4 1.4 0 0 1 0 2l-8.4 8.4z" />
  </svg>
)

interface EdicaoProps {
  readonly verbeteId: string
  readonly formaId: string
  readonly secao: Secao
  readonly rotulo: string
  readonly aoParar: (devolverFoco: boolean) => void
}

/** O editor aberto no cartão. Fecha ao sair do campo e com Esc; o que estava para gravar vai antes de fechar. */
function EdicaoNoCartao({ verbeteId, formaId, secao, rotulo, aoParar }: EdicaoProps) {
  const casca = useRef<HTMLDivElement>(null)
  const parar = useRef(aoParar)
  useEffect(() => {
    parar.current = aoParar
  })

  // O Esc tem de ser tratado aqui, num ouvinte do próprio elemento: o tldraw ouve o teclado no contêiner
  // (antes do onKeyDown do React, que fica na raiz) e, com o Esc, tira a seleção e o foco do campo. Com a
  // lista da @menção aberta, o Esc é dela: só a lista fecha, e a edição segue. O Esc livre fecha o editor e
  // devolve o foco ao lápis. Em nenhum dos dois o tldraw recebe a tecla.
  // O `defaultPrevented` não separa os dois casos: o ProseMirror marca todo Esc como usado
  // (`captureKeyDown`, código 27). Por isso a pergunta "a lista está aberta?" é feita na captura, antes de
  // o campo tratar a tecla, pela marca que a sugestão aberta deixa no texto.
  useEffect(() => {
    const elemento = casca.current
    if (elemento === null) return
    let daMencao = false
    const antesDoCampo = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') daMencao = elemento.querySelector(MARCA_DA_MENCAO_ABERTA) !== null
    }
    const depoisDoCampo = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      evento.stopPropagation()
      if (daMencao) return
      evento.preventDefault()
      parar.current(true)
    }
    elemento.addEventListener('keydown', antesDoCampo, true)
    elemento.addEventListener('keydown', depoisDoCampo)
    return () => {
      elemento.removeEventListener('keydown', antesDoCampo, true)
      elemento.removeEventListener('keydown', depoisDoCampo)
    }
  }, [])

  // O editor pode estar baixando: o cursor vai para o fim do texto assim que o campo aparece.
  useEffect(() => {
    let tentativas = 0
    let quadro = 0
    const procurar = () => {
      const campo = casca.current?.querySelector<HTMLElement>('[contenteditable="true"]')
      if (campo !== null && campo !== undefined) {
        campo.focus({ preventScroll: true })
        const selecao = window.getSelection()
        if (selecao !== null) {
          const trecho = document.createRange()
          trecho.selectNodeContents(campo)
          trecho.collapse(false)
          selecao.removeAllRanges()
          selecao.addRange(trecho)
        }
        return
      }
      tentativas += 1
      if (tentativas < PROCURAR_O_CAMPO_POR) quadro = requestAnimationFrame(procurar)
    }
    quadro = requestAnimationFrame(procurar)
    return () => cancelAnimationFrame(quadro)
  }, [])

  const aoSairDoCampo = (evento: FocusEvent<HTMLDivElement>) => {
    const destino = evento.relatedTarget
    if (destino instanceof Node && evento.currentTarget.contains(destino)) return
    aoParar(false)
  }

  return (
    <div ref={casca} className="pr-cartao__edicao" onBlur={aoSairDoCampo}>
      <TextoDoPreludio
        texto={secao.texto}
        rotulo={rotulo}
        convite="Escreva aqui… (@ menciona um verbete)"
        editavel
        aoMudar={(texto) => gravarTextoDaSecao(verbeteId, formaId, secao.id, texto)}
        classe="pr-cartao__texto-rico"
      />
    </div>
  )
}

interface PainelProps {
  readonly verbete: Verbete
  readonly forma: Forma
  readonly raiz: string | null
  /** O texto pode mudar daqui (quadro editável, verbete gravável, Prelúdio sem trava). */
  readonly podeEscrever: boolean
  /** A seção aberta no editor (`null` = nenhuma). Fica no cartão: trocar de forma fecha. */
  readonly editando: string | null
  readonly aoEditar: (secaoId: string | null) => void
  readonly aoAbrirVerbete: (verbete: Verbete) => void
  /** As seções desta coluna do cartão: a principal, ou uma das que o Grimório punha "ao lado". */
  readonly secoes: readonly Secao[]
  /** A coluna "ao lado" de uma seção que esta forma não tem: o título dela e a volta para baixo. */
  readonly semSecao?: { readonly titulo: string; readonly alternar: (() => void) | null }
  /** A seta que leva a seção para uma coluna própria ou de volta para baixo; `null` = esta seção não tem coluna própria. */
  readonly ladoDaSecao?: (secao: Secao) => { readonly aoLado: boolean; readonly alternar: () => void } | null
}

const PARA_O_LADO = (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4.5 10h10M11 6.5l3.5 3.5-3.5 3.5" />
  </svg>
)

const PARA_BAIXO = (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M10 4.5v10M6.5 11l3.5 3.5 3.5-3.5" />
  </svg>
)

/** A seta da coluna: leva a seção para o lado (o cartão cresce uma coluna) ou de volta para baixo. */
function SetaDaColuna({ titulo, aoLado, alternar }: { titulo: string; aoLado: boolean; alternar: () => void }) {
  return (
    <button
      type="button"
      className="pr-cartao__lapis pr-cartao__coluna"
      aria-label={aoLado ? `Pôr ${titulo} embaixo, na coluna principal` : `Pôr ${titulo} numa coluna ao lado`}
      title={aoLado ? 'Pôr embaixo' : 'Pôr ao lado'}
      onClick={alternar}
    >
      {aoLado ? PARA_BAIXO : PARA_O_LADO}
    </button>
  )
}

export function TextoDoCartao({ verbete, forma, raiz, podeEscrever, editando, aoEditar, aoAbrirVerbete, secoes, semSecao, ladoDaSecao }: PainelProps) {
  const lapis = useRef(new Map<string, HTMLButtonElement>())
  const nome = verbete.titulo || 'Sem nome'
  // Na exportação (PNG/SVG) o texto sai na hora; no quadro, espera a vez dele.
  const vez = useVezDoTexto(useSvgExportContext() !== null || editando !== null)

  const contexto = useMemo<ContextoDoRoteiro>(
    () => ({
      raiz,
      tituloDe: (id) => usePreludio.getState().verbetes.get(id)?.titulo,
      aoAbrirLink: (alvo) => {
        if (alvo.tipo === 'cena') {
          if (podeAbrirNaMesa()) abrirNaMesaPeloPreludio(alvo.pinoId === undefined ? { chave: alvo.chave, sceneId: alvo.sceneId } : { chave: alvo.chave, sceneId: alvo.sceneId, pinoId: alvo.pinoId })
          return
        }
        const ligado = verbeteDaFicha(alvo)
        if (ligado !== undefined) aoAbrirVerbete(ligado)
      },
    }),
    [raiz, aoAbrirVerbete],
  )

  const parar = (secaoId: string, devolverFoco: boolean) => {
    aoEditar(null)
    if (devolverFoco) requestAnimationFrame(() => lapis.current.get(secaoId)?.focus())
  }

  if (!vez) return null
  if (semSecao !== undefined) {
    return (
      <section className="pr-cartao__secao pr-cartao__secao--vazia">
        <h3>
          <span className="pr-cartao__secao-nome">{semSecao.titulo}</span>
          <span className="pr-cartao__secao-vazia">sem esta seção nesta forma</span>
          {semSecao.alternar !== null && <SetaDaColuna titulo={semSecao.titulo} aoLado alternar={semSecao.alternar} />}
        </h3>
      </section>
    )
  }
  if (forma.secoes.length === 0) return <p className="pr-cartao__vazio">Sem texto nesta forma.</p>

  return (
    <>
      {secoes.map((secao) => {
        const titulo = secao.titulo || 'Sem título'
        const aberta = editando === secao.id
        const vazia = !temTexto(secao.texto)
        const coluna = ladoDaSecao?.(secao) ?? null
        return (
          <section key={secao.id} className={`pr-cartao__secao${vazia && !aberta ? ' pr-cartao__secao--vazia' : ''}${aberta ? ' pr-cartao__secao--editando' : ''}`}>
            <h3>
              <span className="pr-cartao__secao-nome">{titulo}</span>
              {secao.segredo && <span className="pr-cartao__segredo">Segredo</span>}
              {vazia && !aberta && <span className="pr-cartao__secao-vazia">vazia</span>}
              {coluna !== null && <SetaDaColuna titulo={titulo} aoLado={coluna.aoLado} alternar={coluna.alternar} />}
              {podeEscrever && (
                <button
                  ref={(botao) => {
                    if (botao === null) lapis.current.delete(secao.id)
                    else lapis.current.set(secao.id, botao)
                  }}
                  type="button"
                  className="pr-cartao__lapis"
                  aria-pressed={aberta}
                  aria-label={aberta ? `Parar de editar ${titulo}` : `Editar ${titulo} de ${nome} aqui mesmo`}
                  title={aberta ? 'Parar de editar (Esc)' : 'Editar aqui mesmo'}
                  onPointerEnter={precarregarEditor}
                  onFocus={precarregarEditor}
                  onClick={() => aoEditar(aberta ? null : secao.id)}
                >
                  {LAPIS}
                </button>
              )}
            </h3>
            {aberta ? (
              <EdicaoNoCartao key={`${forma.id}:${secao.id}`} verbeteId={verbete.id} formaId={forma.id} secao={secao} rotulo={`${titulo} de ${nome}`} aoParar={(devolverFoco) => parar(secao.id, devolverFoco)} />
            ) : (
              !vazia && <TextoDoRoteiro texto={secao.texto} contexto={contexto} />
            )}
          </section>
        )
      })}
    </>
  )
}

interface ControlesDaFonteProps {
  readonly escala: number
  readonly aoMudar: (proxima: number) => void
}

/** A− e A+ do cartão (Grimório, `ControlesFonte.tsx`): o tamanho da letra deste cartão, sem mexer no tamanho dele. */
export function ControlesDaFonte({ escala, aoMudar }: ControlesDaFonteProps) {
  return (
    <span className="pr-cartao__fonte" role="group" aria-label="Tamanho da letra do cartão" onPointerDown={(evento) => evento.stopPropagation()}>
      <button type="button" aria-label="Diminuir a letra do cartão" title="Diminuir a letra" disabled={escala <= FONTE_MIN} onClick={() => aoMudar(proximaEscala(escala, -FONTE_PASSO))}>
        A−
      </button>
      <span className="pr-cartao__fonte-valor" aria-live="polite">
        {Math.round(escala * 100)}%
      </span>
      <button type="button" aria-label="Aumentar a letra do cartão" title="Aumentar a letra" disabled={escala >= FONTE_MAX} onClick={() => aoMudar(proximaEscala(escala, FONTE_PASSO))}>
        A+
      </button>
    </span>
  )
}
