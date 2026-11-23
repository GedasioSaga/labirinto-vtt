import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { avisoDaMecanica, lerMecanica, type MecanicaV1 } from '../../../lib/batalha/mecanica/modelo'
import { MODELOS_PRONTOS, mecanicaDoModeloNoCartao, problemaDaMecanica, type IdDoModelo } from '../../../lib/batalha/mecanica/modelos'
import { frasesDoGolpe, type FichaDaPrevia } from '../../../lib/batalha/mecanica/resumo'
import type { CartaoDaFicha } from '../../../lib/personagem'
import { BlocoSemCaixa } from '../blocos/controles'
import { categoriaDaMecanica, tipoNaBatalha } from './acaoNaTela'
import { ColunaDoPapel } from './ColunaDoPapel'
import { ComecarDeUmModelo } from './ComecarDeUmModelo'
import type { IdDaLinha } from './fraseDoPapel'
import { cartaoComAMecanica, cartaoDaTela, mecanicaQueAbre, type QuemEditaNoEditor } from './gravarNoCartao'
import { ancoraDaLinha, Linha, LinhaQueVem } from './Linha'
import { LinhaDaAcao } from './linhas/LinhaDaAcao'
import { LinhaDoAcerto } from './linhas/LinhaDoAcerto'
import { LinhaDoAlcance } from './linhas/LinhaDoAlcance'
import { LinhaDoCusto } from './linhas/LinhaDoCusto'
import { LinhaDoDano } from './linhas/LinhaDoDano'
import { LinhaDosEfeitos } from './linhas/LinhaDosEfeitos'
import type { MudarNoEditor } from './mudarNoEditor'
import './editor.css'

/** Quantos passos o Ctrl+Z guarda. */
const PILHA_MAX = 50
/** Mudanças seguidas dentro desta janela (digitar a fórmula, as setas num número) viram um passo só do Ctrl+Z. */
const JUNTAR_MS = 800
/** Quanto o aviso fica embaixo antes de sumir sozinho. */
const AVISO_MS = 6000
/** A saída do aviso (mais rápida que a entrada, 200 ms no CSS). */
const SAIDA_DO_AVISO_MS = 150

interface Aviso {
  texto: string
  comDesfazer: boolean
  /** Descendo para sair: some no fim da saída. */
  saindo: boolean
  /** Muda a cada aviso: o mesmo texto duas vezes entra de novo. */
  vez: number
}

/** O Ctrl+Z dentro de um campo de texto é o do próprio campo (desfaz a letra), não o do editor. */
function digitando(alvo: EventTarget): boolean {
  if (!(alvo instanceof HTMLElement)) return false
  if (alvo.isContentEditable || alvo instanceof HTMLTextAreaElement) return true
  return alvo instanceof HTMLInputElement && !['radio', 'checkbox', 'button', 'submit', 'range', 'color'].includes(alvo.type)
}

export interface EditorDaHabilidadeProps {
  cartao: CartaoDaFicha
  ficha: FichaDaPrevia
  /** O mestre grava a `mecanica`; o dono, a `mecanicaProposta` (como na fachada `MecanicaDaTecnica`). */
  quemEdita: QuemEditaNoEditor
  /** Cada mudança completa vai na hora para o cartão em edição; quem grava em disco é o Salvar da ficha. */
  onChange: (cartao: CartaoDaFicha) => void
  onFechar: () => void
}

/**
 * O EDITOR DA HABILIDADE novo, a casca (ED3; docs/design/habilidades/EDITOR.md §5
 * e o protótipo aprovado `editor/prototipo.html`, direção C): uma linha por
 * pergunta à esquerda e, à direita, o papel com a frase (cada pedaço leva à
 * sua linha), o mapa do alcance e o Testar no boneco, vivos. Por dentro, os
 * controles de hoje (`blocos/`, `EscolhaDaForma`, `CampoDeDano`, `PecasDoSelo`,
 * `PainelDeEnsaio`). Abre por cima da ficha, numa janela do sistema
 * (`<dialog>`): Esc fecha, Ctrl+Z desfaz fora dos campos de texto.
 *
 * Até a ED5 trocar a fachada, só abre pela chave `lb-editor:novo` (`ligado.ts`).
 */
export function EditorDaHabilidade({ cartao, ficha, quemEdita, onChange, onFechar }: EditorDaHabilidadeProps) {
  const prefixo = useId()
  const tituloId = useId()
  const nomeId = useId()
  const descricaoId = useId()
  const janela = useRef<HTMLDialogElement>(null)
  const [rascunho, setRascunho] = useState<MecanicaV1 | null>(() => mecanicaQueAbre(cartao, quemEdita))
  const [pilha, setPilha] = useState<readonly (MecanicaV1 | null)[]>([])
  const ultimoPasso = useRef(0)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [escolhendoModelo, setEscolhendoModelo] = useState(false)
  const [brilho, setBrilho] = useState<{ linha: IdDaLinha; vez: number } | null>(null)
  // A ficha chega montada a cada render da janela de trás; fixa, o papel e o Testar só refazem quando ela muda de verdade.
  const fichaFixa = useMemo<FichaDaPrevia>(() => ({ personagem: ficha.personagem, sistema: ficha.sistema }), [ficha.personagem, ficha.sistema])

  // O papel, o mapa e o Testar seguem um passo atrás da digitação (EDITOR.md §5, "Fluidez").
  const naTela = useMemo(() => cartaoDaTela(cartao, rascunho, fichaFixa), [cartao, rascunho, fichaFixa])
  const telaAdiada = useDeferredValue(naTela)
  const mecanicaAdiada = useDeferredValue(rascunho)

  useEffect(() => {
    const aberta = janela.current
    if (aberta === null) return
    const quemAbriu = document.activeElement instanceof HTMLElement ? document.activeElement : null
    aberta.showModal()
    return () => {
      aberta.close()
      quemAbriu?.focus()
    }
  }, [])

  useEffect(() => {
    if (aviso === null) return
    const relogio = window.setTimeout(() => setAviso(aviso.saindo ? null : { ...aviso, saindo: true }), aviso.saindo ? SAIDA_DO_AVISO_MS : AVISO_MS)
    return () => window.clearTimeout(relogio)
  }, [aviso])

  const avisar = (texto: string, comDesfazer: boolean) => setAviso({ texto, comDesfazer, saindo: false, vez: performance.now() })

  /** O rascunho na tela e, se completo, no cartão; peça pela metade fica só aqui. */
  const gravar = (nova: MecanicaV1 | null) => {
    setRascunho(nova)
    const proximo = cartaoComAMecanica(cartao, nova, quemEdita, fichaFixa)
    if (proximo !== null) onChange(proximo)
  }

  /** `novo`: um passo próprio no Ctrl+Z (modelo, categoria que tira peças); `junta`: cola no passo de agora há pouco. */
  const mudar = (nova: MecanicaV1 | null, passo: 'novo' | 'junta', textoDoAviso?: string) => {
    const agora = performance.now()
    if (passo === 'novo' || agora - ultimoPasso.current > JUNTAR_MS) setPilha((antes) => [...antes.slice(-(PILHA_MAX - 1)), rascunho])
    ultimoPasso.current = passo === 'novo' ? 0 : agora
    gravar(nova)
    if (textoDoAviso !== undefined) avisar(textoDoAviso, true)
  }
  const mudarNaLinha: MudarNoEditor = (nova, textoDoAviso) => mudar(nova, textoDoAviso === undefined ? 'junta' : 'novo', textoDoAviso)

  const desfazer = () => {
    const anterior = pilha.at(-1)
    if (anterior === undefined) {
      avisar('Nada para desfazer.', false)
      return
    }
    setPilha((antes) => antes.slice(0, -1))
    ultimoPasso.current = 0
    gravar(anterior)
    avisar(anterior === null ? 'Desfeito: a técnica voltou a ser só texto.' : 'Desfeito.', false)
  }

  const aplicarModelo = (id: IdDoModelo) => {
    setEscolhendoModelo(false)
    const nome = MODELOS_PRONTOS.find((modelo) => modelo.id === id)?.nome ?? 'escolhido'
    mudar(mecanicaDoModeloNoCartao(id, fichaFixa, cartao), 'novo', `Modelo ${nome}: preencheu Ação, Alcance, Dano, Acerto, Efeitos e Custo. Nome, descrição e requisitos ficaram.`)
  }

  /** O pedaço da frase leva à linha dele: rola até ela, acende o brilho e põe o foco no primeiro controle. */
  const irPara = useCallback(
    (linha: IdDaLinha, porTeclado: boolean) => {
      const alvo = document.getElementById(ancoraDaLinha(prefixo, linha))
      if (alvo === null) return
      // Pelo teclado (Enter no pedaço) a rolagem é na hora, como com movimento reduzido.
      const reduzido = porTeclado || window.matchMedia('(prefers-reduced-motion: reduce)').matches
      alvo.scrollIntoView({ block: 'start', behavior: reduzido ? 'auto' : 'smooth' })
      setBrilho((antes) => ({ linha, vez: (antes === null ? 0 : antes.vez) + 1 }))
      const primeiro = alvo.querySelector<HTMLElement>('input:checked:not(:disabled)') ?? alvo.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), a[href]')
      if (primeiro !== null) primeiro.focus({ preventScroll: true })
    },
    [prefixo],
  )

  const aoTeclar = (evento: KeyboardEvent<HTMLDialogElement>) => {
    // As teclas do editor não sobem para a janela da ficha atrás dele (o Esc e o Tab dela).
    evento.stopPropagation()
    if (escolhendoModelo) return
    const ctrlZ = (evento.ctrlKey || evento.metaKey) && !evento.shiftKey && !evento.altKey && evento.key.toLowerCase() === 'z'
    if (!ctrlZ || digitando(evento.target)) return
    evento.preventDefault()
    desfazer()
  }

  const lida = lerMecanica(quemEdita === 'dono' && cartao.mecanicaProposta !== undefined ? cartao.mecanicaProposta : cartao.mecanica)
  const futura = lida.tipo === 'futura'
  const categoria = rascunho === null ? null : categoriaDaMecanica(rascunho)
  const ataque = categoria === 'simples' || categoria === 'completo' || categoria === 'overload'
  const naVez = rascunho !== null && rascunho.uso !== 'reacao'
  const problema = rascunho === null ? null : problemaDaMecanica(rascunho, fichaFixa)
  const brilhoDe = (linha: IdDaLinha) => (brilho !== null && brilho.linha === linha ? brilho.vez : 0)
  const abrirModelos = () => setEscolhendoModelo(true)

  return createPortal(
    <dialog
      ref={janela}
      className="lb-ed"
      // O papel explícito: as janelas do app reconhecem uma camada por cima pelo [role="dialog"] (o Esc da ficha atrás não dispara).
      role="dialog"
      aria-labelledby={tituloId}
      onKeyDown={aoTeclar}
      onCancel={(evento) => {
        evento.preventDefault()
        onFechar()
      }}
    >
      <header className="lb-ed__cab">
        <h2 className="lb-ed__tit" id={tituloId}>
          Editor da habilidade
        </h2>
        <span className="lb-ed__trilha">
          {ficha.personagem.nome} · {quemEdita === 'dono' ? 'vai ao mestre quando você salvar a ficha' : 'entra no cartão; o Salvar da ficha grava'}
        </span>
        <div className="lb-ed__cab-acoes">
          <button type="button" className="lb-ed__bt lb-ed__bt--latao" disabled={futura} onClick={abrirModelos}>
            <svg className="lb-ed__ic" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <path d="M11.5 9v5M9 11.5h5" />
            </svg>
            Começar de um modelo
          </button>
          <button type="button" className="lb-ed__bt lb-ed__bt--fantasma" disabled={pilha.length === 0} aria-keyshortcuts="Control+Z" title="Ctrl+Z" onClick={desfazer}>
            Desfazer
          </button>
          <button type="button" className="lb-ed__bt lb-ed__bt--primario" onClick={onFechar}>
            Voltar à ficha
          </button>
        </div>
      </header>

      <div className="lb-ed__corpo">
        <div className="lb-ed__editor">
          <div className="lb-ed__topo">
            <div className="lb-ed__campo">
              <label htmlFor={nomeId}>Nome</label>
              <input id={nomeId} className="lb-ed__entrada lb-ed__entrada--nome" value={cartao.nome} placeholder="Nome da habilidade" onChange={(evento) => onChange({ ...cartao, nome: evento.target.value })} />
            </div>
            <div className="lb-ed__campo lb-ed__campo--tipo">
              <span className="lb-ed__rot">Tipo na batalha</span>
              <span className="lb-ed__etq" title="Sai das escolhas abaixo; não é mais um campo à parte">
                {rascunho === null ? 'pelo texto' : tipoNaBatalha(rascunho)}
              </span>
            </div>
            <div className="lb-ed__campo lb-ed__campo--desc">
              <label htmlFor={descricaoId}>
                Descrição <span className="lb-ed__dica">como o golpe é, com suas palavras (só para ler; o app não lê)</span>
              </label>
              <textarea id={descricaoId} className="lb-ed__entrada" rows={2} value={cartao.campos.descricao ?? ''} placeholder="Ex.: uma flecha de fogo que corta o céu" onChange={(evento) => onChange({ ...cartao, campos: { ...cartao.campos, descricao: evento.target.value } })} />
            </div>
          </div>

          {(lida.tipo === 'futura' || lida.tipo === 'invalida') && (
            <p className="lb-ed__alerta" role="note">
              {avisoDaMecanica(lida)}
              {lida.tipo === 'invalida' && ' Um modelo troca a mecânica que não se lê.'}
            </p>
          )}

          <BlocoSemCaixa.Provider value={true}>
            {rascunho === null ? (
              <Linha prefixo={prefixo} linha="acao" nome="Ação" dica="o que é e o que gasta" brilho={brilhoDe('acao')}>
                <p className="lb-ed__vazio">Esta técnica ainda é só texto: a batalha lê a Ação, o Custo e o Dano escritos no cartão. Para montar as peças, comece de um modelo; o custo, a ação e o dano escritos entram nele quando dá.</p>
                {!futura && (
                  <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--sozinho" onClick={abrirModelos}>
                    Começar de um modelo
                  </button>
                )}
                <LinhaQueVem texto='"Montar a partir do texto" e "Desmontar" chegam com o editor inteiro.' />
              </Linha>
            ) : (
              <>
                <Linha prefixo={prefixo} linha="acao" nome="Ação" dica="o que é e o que gasta" brilho={brilhoDe('acao')}>
                  <LinhaDaAcao mecanica={rascunho} onChange={mudarNaLinha} />
                </Linha>
                {ataque && (
                  <Linha prefixo={prefixo} linha="golpe" nome="Golpe" dica="que tipo de golpe é" brilho={brilhoDe('golpe')}>
                    {frasesDoGolpe(rascunho, fichaFixa).map((frase, indice) => (
                      <p key={indice} className="lb-ed__golpe-lido">
                        {frase}
                      </p>
                    ))}
                    <LinhaQueVem texto="Escolher como bate (impacto, cortante, perfurante) e o que causa (queimadura, veneno, congelamento…), com a regra de cada um e o teste para pegar, chega com o editor inteiro." />
                  </Linha>
                )}
                {naVez && (
                  <Linha prefixo={prefixo} linha="alcance" nome="Alcance" dica={categoria === 'apoio' ? 'em quem ajuda' : 'onde pega'} brilho={brilhoDe('alcance')}>
                    <LinhaDoAlcance mecanica={rascunho} onChange={mudarNaLinha} />
                  </Linha>
                )}
                {((naVez && categoria !== 'apoio') || rascunho.dano !== undefined) && (
                  <Linha prefixo={prefixo} linha="dano" nome="Dano" dica="quanto tira" brilho={brilhoDe('dano')}>
                    <LinhaDoDano mecanica={rascunho} cartao={cartao} ficha={fichaFixa} onChange={mudarNaLinha} />
                  </Linha>
                )}
                <Linha prefixo={prefixo} linha="acerto" nome={rascunho.uso === 'reacao' ? 'Defesa' : 'Acerto'} dica={rascunho.uso === 'reacao' ? 'o que faz no lugar da reação' : 'como o golpe pega'} brilho={brilhoDe('acerto')}>
                  <LinhaDoAcerto mecanica={rascunho} ficha={fichaFixa} onChange={mudarNaLinha} />
                </Linha>
                <Linha prefixo={prefixo} linha="efeitos" nome="Efeitos" dica={categoria === 'apoio' ? 'o que faz no aliado' : 'o que mais faz'} brilho={brilhoDe('efeitos')}>
                  <LinhaDosEfeitos mecanica={rascunho} ficha={fichaFixa} onChange={mudarNaLinha} />
                </Linha>
                <Linha prefixo={prefixo} linha="custo" nome="Custo" dica="o que gasta e quando volta" brilho={brilhoDe('custo')}>
                  <LinhaDoCusto mecanica={rascunho} onChange={mudarNaLinha} />
                </Linha>
              </>
            )}
            <Linha prefixo={prefixo} linha="requisitos" nome="Requisitos" dica="o que precisa para usar" brilho={brilhoDe('requisitos')}>
              <LinhaQueVem texto="O que precisa para usar (Polaridade 2, Melodia ligada, 50 SP ou a ajuda de um aliado com Fogo…), com o Cumpriu? de quem usa. Chega com o editor inteiro." />
            </Linha>
            <Linha prefixo={prefixo} linha="evolucao" nome="Evolução" dica="vira outra versão" brilho={brilhoDe('evolucao')}>
              <LinhaQueVem texto="Para qual versão evolui e o que pede para evoluir. Chega com o editor inteiro." />
            </Linha>
            <Linha prefixo={prefixo} linha="jogadores" nome="Jogadores" dica="o que eles veem" brilho={brilhoDe('jogadores')}>
              <LinhaQueVem texto="Esconder dos jogadores: por enquanto, no cartão da ficha. Chega com o editor inteiro." />
            </Linha>
            <Linha prefixo={prefixo} linha="campos" nome="Campos extras" dica="anotações do cartão" brilho={brilhoDe('campos')}>
              <LinhaQueVem texto={`${cartao.extras.length === 0 ? 'Nenhum campo extra' : cartao.extras.length === 1 ? '1 campo extra' : `${cartao.extras.length} campos extras`} no cartão (o papel ao lado mostra). Por enquanto, edite no cartão da ficha.`} />
            </Linha>
          </BlocoSemCaixa.Provider>
        </div>

        <aside className="lb-ed__ver" aria-label="Como fica, alcance e teste">
          {problema !== null && (
            <p className="lb-ed__problema" role="status">
              {quemEdita === 'dono' ? 'Ainda não vai ao mestre' : 'Ainda não vale na batalha'}: {problema}. Até completar, a ficha guarda a última versão completa.
            </p>
          )}
          <ColunaDoPapel cartao={telaAdiada} mecanica={mecanicaAdiada} ficha={fichaFixa} prefixo={prefixo} onIr={irPara} />
        </aside>
      </div>

      <div className="lb-ed__avisos" role="status" aria-live="polite">
        {aviso !== null && (
          <div key={aviso.vez} className="lb-ed__aviso" data-saindo={aviso.saindo ? '' : undefined}>
            <span>{aviso.texto}</span>
            {aviso.comDesfazer && (
              <button type="button" className="lb-ed__bt lb-ed__bt--latao lb-ed__bt--p" onClick={desfazer}>
                Desfazer
              </button>
            )}
          </div>
        )}
      </div>

      {escolhendoModelo && <ComecarDeUmModelo ficha={fichaFixa} onEscolher={aplicarModelo} onFechar={() => setEscolhendoModelo(false)} />}
    </dialog>,
    document.body,
  )
}
