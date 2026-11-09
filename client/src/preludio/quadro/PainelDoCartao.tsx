import { useEffect, useMemo, useRef, type FocusEvent, type KeyboardEvent } from 'react'
import type { AlvoNaMesa } from '../../lib/preparo/sessoes'
import type { Forma, Secao, TextoRico, Verbete } from '../../lib/preparo/tipos'
import { precarregarEditor, TextoDoPreludio } from '../editor/sobDemanda'
import { usePreludio } from '../estado/preludio'
import { abrirNaMesaPeloPreludio, podeAbrirNaMesa } from '../mesa/ponte'
import { temTexto, TextoDoRoteiro, type ContextoDoRoteiro } from '../roteiro/TextoDoRoteiro'
import { FONTE_MAX, FONTE_MIN, FONTE_PASSO, proximaEscala } from './escalaFonte'

/**
 * O TEXTO DO CARTÃO NO QUADRO (fatia F3c, como no Grimório,
 * `CharacterCardShape.tsx`): cada seção da forma ativa, com o texto formatado
 * (negrito, títulos, listas, o bloco de segredo, as @menções e os links da
 * mesa), e o lápis que abre ali mesmo o editor de texto do Prelúdio (o mesmo
 * TipTap da página do verbete). O que se escreve vai para o verbete; a seção
 * de segredo continua de segredo (o cartão só troca o texto, nunca a marca).
 */

const PROCURAR_O_CAMPO_POR = 120

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

  // A sugestão da @menção usa o Esc primeiro (e marca o evento): só o Esc livre fecha o editor.
  const aoTeclar = (evento: KeyboardEvent<HTMLDivElement>) => {
    if (evento.key !== 'Escape' || evento.defaultPrevented) return
    evento.preventDefault()
    evento.stopPropagation()
    aoParar(true)
  }

  return (
    <div ref={casca} className="pr-cartao__edicao" onBlur={aoSairDoCampo} onKeyDown={aoTeclar}>
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
}

export function TextoDoCartao({ verbete, forma, raiz, podeEscrever, editando, aoEditar, aoAbrirVerbete }: PainelProps) {
  const lapis = useRef(new Map<string, HTMLButtonElement>())
  const nome = verbete.titulo || 'Sem nome'

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

  if (forma.secoes.length === 0) return <p className="pr-cartao__vazio">Sem texto nesta forma.</p>

  return (
    <>
      {forma.secoes.map((secao) => {
        const titulo = secao.titulo || 'Sem título'
        const aberta = editando === secao.id
        const vazia = !temTexto(secao.texto)
        return (
          <section key={secao.id} className={`pr-cartao__secao${vazia && !aberta ? ' pr-cartao__secao--vazia' : ''}${aberta ? ' pr-cartao__secao--editando' : ''}`}>
            <h3>
              <span className="pr-cartao__secao-nome">{titulo}</span>
              {secao.segredo && <span className="pr-cartao__segredo">Segredo</span>}
              {vazia && !aberta && <span className="pr-cartao__secao-vazia">vazia</span>}
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
