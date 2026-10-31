import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { IMAGENS_MAX, ERROS_DA_CHAVE, ERROS_DO_MODELO } from '../../lib/ia/portaDaIa'
import {
  DADOS_DO_MODO,
  fichasDaConversa,
  MAX_FICHAS_CONTEXTO,
  MODOS_DA_IA,
  oQueVaiSerLido,
  perguntaSobreOVisual,
  type EncontroParaIa,
  type LendoDaIa,
  type ModoDaIa,
} from '../../lib/ia/prompts'
import type { NivelDoNpc } from '../../lib/ia/gerarNpc'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import { useCatalogoStore } from '../../stores/catalogoStore'
import { CONSULTA_DA_GAVETA_DA_IA, useIaStore, type DadosDoMundoParaIa, type MensagemDaConversa } from '../../stores/iaStore'
import { useMundoDoLivroStore } from '../../stores/mundoDoLivroStore'
import { MarcacaoLeve } from '../MarcacaoLeve'
import { Retrato } from '../livros/comum'
import { IconeDoMundo } from '../livros/icones'
import { ChaveDaIaDialog, type FocoDaConfig } from './ChaveDaIaDialog'
import { GerarNpcForm, NpcGerado } from './GerarNpc'
import { IconeDaIa } from './icones'
import './ia.css'

/**
 * O ASSISTENTE DO MESTRE (M4): a coluna da direita do mundo do livro. Porte
 * do painel do protótipo aprovado — modos Conversa, Equilíbrio e Simulação,
 * "Fichas na conversa" (até 4: citadas no texto entram sozinhas, ou
 * "+ Pôr ficha"), a linha "Lendo:" com tudo o que sai, a conversa e a caixa
 * (Enter envia, Shift+Enter quebra a linha), o Gerar NPC e a engrenagem.
 * A resposta da IA é texto não confiável: vira marcação leve, nunca HTML.
 */

export const ID_DO_TEXTO_DA_IA = 'ia-texto'
const ALTURA_MAX_DA_CAIXA = 140
/** Seções que a linha "Lendo:" nomeia antes de resumir em "e mais N". */
const SECOES_NA_LINHA = 3
/** Os grupos do "+ Pôr ficha na conversa", nesta ordem. */
const TIPOS_NO_SELETOR: readonly Personagem['tipo'][] = ['jogador', 'npc']

export interface PainelDaIaProps {
  pastaId: string
  sistema: SistemaDeRpg
  personagens: readonly Personagem[]
}

function ajustarAltura(caixa: HTMLTextAreaElement | null): void {
  if (caixa === null) return
  caixa.style.height = 'auto'
  caixa.style.height = `${Math.min(ALTURA_MAX_DA_CAIXA, caixa.scrollHeight + 2)}px`
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`
}

/** O trecho das regras na linha "Lendo:". */
function textoDasRegras(lendo: LendoDaIa): string {
  if (!lendo.temLivro) return 'sem livro de regras'
  if (lendo.secoes.length === 0) return 'o núcleo das regras'
  const nomeadas = lendo.secoes.slice(0, SECOES_NA_LINHA).join(', ')
  const resto = lendo.secoes.length - SECOES_NA_LINHA
  return `o núcleo das regras + ${nomeadas}${resto > 0 ? ` e mais ${resto}` : ''}`
}

export function PainelDaIa({ pastaId, sistema, personagens }: PainelDaIaProps) {
  const modo = useIaStore((state) => state.modo)
  const fixas = useIaStore((state) => state.fixas)
  const conversa = useIaStore((state) => state.conversa)
  const retratosEnviados = useIaStore((state) => state.retratosEnviados)
  const pensando = useIaStore((state) => state.pensando)
  const gerando = useIaStore((state) => state.gerando)
  const gerado = useIaStore((state) => state.gerado)
  const chaves = useIaStore((state) => state.chaves)
  const configAberta = useIaStore((state) => state.configAberta)
  const comparar = useMundoDoLivroStore((state) => state.comparar)
  const grupo = useMundoDoLivroStore((state) => state.grupo)
  const inimigos = useMundoDoLivroStore((state) => state.inimigos)
  const itens = useCatalogoStore((state) => state.itens)
  const doLivro = useCatalogoStore((state) => state.doLivro)

  const [texto, setTexto] = useState('')
  const [focoDaConfig, setFocoDaConfig] = useState<FocoDaConfig>('chave')
  const caixaRef = useRef<HTMLTextAreaElement>(null)
  const conversaRef = useRef<HTMLDivElement>(null)
  const engrenagemRef = useRef<HTMLButtonElement>(null)
  const porFichaRef = useRef<HTMLSelectElement>(null)
  const modosRef = useRef<Partial<Record<ModoDaIa, HTMLButtonElement | null>>>({})
  const foraDoApp = !isTauri()

  // A conversa é da pasta aberta; o cofre e o modelo, do computador. O catálogo do sistema quem abre é o mundo (MundoDoLivro).
  useEffect(() => {
    useIaStore.getState().usarPasta(pastaId)
  }, [pastaId])
  useEffect(() => {
    void useIaStore.getState().lerConfig()
  }, [])

  const encontro: EncontroParaIa = useMemo(() => ({ comparar, grupo, inimigos }), [comparar, grupo, inimigos])
  const fichas = useMemo(() => fichasDaConversa(modo, fixas, texto, personagens, encontro), [modo, fixas, texto, personagens, encontro])
  const ultimaPergunta = useMemo(() => [...conversa].reverse().find((mensagem) => mensagem.de === 'mestre')?.texto ?? '', [conversa])
  const pergunta = texto.trim().length > 0 ? texto : ultimaPergunta
  const lendo = useMemo(
    () => oQueVaiSerLido({ modo, pergunta, sistema, personagens, fichas, itens, doLivro, encontro }),
    [modo, pergunta, sistema, personagens, fichas, itens, doLivro, encontro],
  )
  const porId = useMemo(() => new Map(personagens.map((personagem) => [personagem.id, personagem])), [personagens])
  const sobreOVisual = perguntaSobreOVisual(pergunta)
  const retratos = Math.min(
    IMAGENS_MAX,
    fichas.usadas.filter((id) => {
      const personagem = porId.get(id)
      return personagem !== undefined && personagem.retrato !== null && (sobreOVisual || !retratosEnviados.includes(id))
    }).length,
  )

  // Mensagem nova, "pensando", formulário ou ficha gerada: a conversa desce até o fim.
  useLayoutEffect(() => {
    const caixa = conversaRef.current
    if (caixa !== null) caixa.scrollTop = caixa.scrollHeight
  }, [conversa.length, pensando, gerando, gerado])

  const dadosDoMundo = (): DadosDoMundoParaIa => ({ sistema, personagens, itens, doLivro, encontro })

  const abrirConfig = (foco: FocoDaConfig) => {
    setFocoDaConfig(foco)
    useIaStore.getState().abrirConfig(true)
  }

  const fecharConfig = () => {
    useIaStore.getState().abrirConfig(false)
    engrenagemRef.current?.focus()
  }

  const enviar = async (bruto: string) => {
    const pedido = bruto.trim()
    if (pedido.length === 0 || pensando || foraDoApp) return
    // Sem chave nenhuma: o Enviar leva à engrenagem, e a pergunta fica na caixa.
    if (chaves === 0) {
      setTexto(bruto)
      abrirConfig('chave')
      return
    }
    setTexto('')
    if (caixaRef.current !== null) caixaRef.current.style.height = ''
    const respondeu = await useIaStore.getState().perguntar(pedido, dadosDoMundo())
    // Deu erro: a pergunta volta à caixa, se o mestre não começou outra enquanto esperava.
    if (!respondeu) setTexto((atual) => (atual.trim().length === 0 ? pedido : atual))
  }

  const gerarNpc = (descricao: string, nivel: NivelDoNpc) => {
    if (chaves === 0) {
      abrirConfig('chave')
      return
    }
    void useIaStore.getState().gerarNpc(descricao, nivel, dadosDoMundo())
  }

  const abrirGerar = () => useIaStore.getState().abrirGerar(true)

  const novaConversa = () => {
    useIaStore.getState().novaConversa()
    setTexto('')
    caixaRef.current?.focus()
  }

  const trocarModo = (novo: ModoDaIa, focar: boolean) => {
    useIaStore.getState().trocarModo(novo)
    if (focar) modosRef.current[novo]?.focus()
  }

  const aoTeclarNosModos = (event: KeyboardEvent<HTMLDivElement>) => {
    const passo = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
    if (passo === 0) return
    event.preventDefault()
    const i = MODOS_DA_IA.indexOf(modo)
    const proximo = MODOS_DA_IA[(i + passo + MODOS_DA_IA.length) % MODOS_DA_IA.length]
    if (proximo !== undefined) trocarModo(proximo, true)
  }

  const aoTeclarNaCaixa = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void enviar(texto)
  }

  /** Esc: fecha a engrenagem; na janela estreita (coluna por cima da página), fecha o assistente. O resto sobe para o mundo. */
  const aoTeclar = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    if (configAberta) {
      event.preventDefault()
      fecharConfig()
    } else if (window.matchMedia(CONSULTA_DA_GAVETA_DA_IA).matches) {
      event.preventDefault()
      useIaStore.getState().fechar()
    }
  }

  const tirarFicha = (personagemId: string) => {
    useIaStore.getState().tirarFicha(personagemId)
    porFichaRef.current?.focus()
  }

  const usadas = new Set(fichas.usadas)
  const cheio = usadas.size >= MAX_FICHAS_CONTEXTO
  const foraDaConversa = personagens.filter((personagem) => !usadas.has(personagem.id))
  const dadosDoModo = DADOS_DO_MODO[modo]
  const vazia = conversa.length === 0 && !gerando && gerado === null && !pensando

  const chip = (personagemId: string, como: 'fixa' | 'citada' | 'comparar') => {
    const personagem = porId.get(personagemId)
    if (personagem === undefined) return null
    const titulo = como === 'citada' ? 'Citada no texto: entra ao enviar' : como === 'comparar' ? 'Do Comparar: entra ao enviar' : 'Na conversa'
    return (
      <span key={personagemId} className={como === 'fixa' ? 'ia-chip' : 'ia-chip ia-chip--auto'} title={titulo}>
        <Retrato imagem={personagem.retrato} nome={personagem.nome} tamanho="p" />
        <span className="ia-chip__nome">{personagem.nome}</span>
        {como === 'fixa' && (
          <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label={`Tirar ${personagem.nome} da conversa`} onClick={() => tirarFicha(personagemId)}>
            <IconeDoMundo nome="x" />
          </button>
        )}
      </span>
    )
  }

  const acaoDoErro = (mensagem: MensagemDaConversa) => {
    if (mensagem.codigo === undefined) return null
    if (ERROS_DA_CHAVE.includes(mensagem.codigo)) {
      return (
        <button type="button" className="ia-msg__acao" onClick={() => abrirConfig('chave')}>
          Pôr a chave
        </button>
      )
    }
    if (ERROS_DO_MODELO.includes(mensagem.codigo)) {
      return (
        <button type="button" className="ia-msg__acao" onClick={() => abrirConfig('modelo')}>
          Trocar o modelo
        </button>
      )
    }
    return null
  }

  return (
    <aside className="ia-painel" id="ia-painel" aria-labelledby="ia-titulo" onKeyDown={aoTeclar}>
      <div className="ia-cab">
        <h2 className="ia-cab__tit" id="ia-titulo">
          Assistente do mestre<small>Lê as regras e as fichas deste livro</small>
        </h2>
        {conversa.length > 0 && (
          <button type="button" className="mu-bt mu-bt--p mu-bt--fantasma" onClick={novaConversa}>
            Nova conversa
          </button>
        )}
        <button
          ref={engrenagemRef}
          type="button"
          className="mu-bt mu-bt--ic mu-bt--p"
          aria-expanded={configAberta}
          aria-controls="ia-config"
          aria-label="Chave da IA"
          title="Chave da IA"
          onClick={() => (configAberta ? fecharConfig() : abrirConfig('chave'))}
        >
          <IconeDaIa nome="engrenagem" />
        </button>
        <button type="button" className="mu-bt mu-bt--ic mu-bt--p" aria-label="Fechar o assistente" title="Fechar" onClick={() => useIaStore.getState().fechar()}>
          <IconeDoMundo nome="x" />
        </button>
      </div>

      {configAberta && <ChaveDaIaDialog focoInicial={focoDaConfig} />}

      <div className="ia-modos" role="radiogroup" aria-label="O que pedir" onKeyDown={aoTeclarNosModos}>
        {MODOS_DA_IA.map((cada) => (
          <button
            key={cada}
            ref={(elemento) => {
              modosRef.current[cada] = elemento
            }}
            type="button"
            role="radio"
            className="ia-modo"
            aria-checked={modo === cada}
            tabIndex={modo === cada ? 0 : -1}
            onClick={() => trocarModo(cada, false)}
          >
            {DADOS_DO_MODO[cada].nome}
          </button>
        ))}
      </div>
      <p className="ia-modo__dica">{dadosDoModo.dica}</p>

      <div className="ia-fichas">
        <div className="ia-fichas__cab">
          <span>Fichas na conversa</span>
          <span>
            {usadas.size} de {MAX_FICHAS_CONTEXTO}
          </span>
        </div>
        {usadas.size > 0 ? (
          <div className="mu-chips">
            {fichas.fixas.map((id) => chip(id, 'fixa'))}
            {fichas.citadas.map((id) => chip(id, 'citada'))}
            {fichas.doComparar.map((id) => chip(id, 'comparar'))}
          </div>
        ) : (
          <p className="ia-fichas__vazio">Nenhuma. Cite um nome na pergunta ou escolha abaixo.</p>
        )}
        {fichas.fora.length > 0 && (
          <p className="ia-fichas__vazio">
            Até {MAX_FICHAS_CONTEXTO} fichas por pergunta: {fichas.fora.map((id) => porId.get(id)?.nome ?? '').join(', ')} {fichas.fora.length === 1 ? 'ficou' : 'ficaram'} de fora.
          </p>
        )}
        <label className="lb-sr-only" htmlFor="ia-por">
          Pôr uma ficha na conversa
        </label>
        <select
          ref={porFichaRef}
          className="mu-seletor"
          id="ia-por"
          value=""
          disabled={cheio || foraDaConversa.length === 0}
          onChange={(event) => {
            if (event.target.value !== '') useIaStore.getState().porFicha(event.target.value)
          }}
        >
          <option value="">{cheio ? `Já são ${MAX_FICHAS_CONTEXTO} fichas` : '+ Pôr ficha na conversa'}</option>
          {TIPOS_NO_SELETOR.map((tipo) => {
            const doTipo = foraDaConversa.filter((personagem) => personagem.tipo === tipo)
            if (doTipo.length === 0) return null
            return (
              <optgroup key={tipo} label={tipo === 'jogador' ? 'Jogadores' : 'NPCs'}>
                {doTipo.map((personagem) => (
                  <option key={personagem.id} value={personagem.id}>
                    {personagem.nome}
                  </option>
                ))}
              </optgroup>
            )
          })}
        </select>
      </div>

      <p className="ia-lendo">
        Lendo: <b>{textoDasRegras(lendo)}</b>
        {lendo.catalogo !== 'vazio' && (
          <>
            {' · '}
            <b>catálogos do livro</b>
          </>
        )}
        {' · '}
        <b>{plural(lendo.fichas, 'ficha', 'fichas')}</b>
        {retratos > 0 && (
          <>
            {' · '}
            <b>{plural(retratos, 'retrato', 'retratos')}</b>
          </>
        )}
        {lendo.encontro && (
          <>
            {' · '}
            <b>o encontro de Comparar</b>
          </>
        )}
      </p>

      <div className="ia-conversa" ref={conversaRef} aria-live="polite" aria-label="Conversa com o assistente">
        {vazia && (
          <>
            <p className="ia-vazio">{dadosDoModo.dica}</p>
            <div className="ia-sugestoes">
              {dadosDoModo.sugestoes.map((sugestao) => (
                <button key={sugestao} type="button" className="ia-sugestao" onClick={() => void enviar(sugestao)} disabled={foraDoApp}>
                  {sugestao}
                </button>
              ))}
            </div>
          </>
        )}
        {conversa.map((mensagem) =>
          mensagem.de === 'mestre' ? (
            <div key={mensagem.id} className="ia-msg ia-msg--mestre">
              {mensagem.texto}
            </div>
          ) : mensagem.de === 'ia' ? (
            <div key={mensagem.id} className="ia-msg ia-msg--ia">
              <MarcacaoLeve texto={mensagem.texto} />
            </div>
          ) : (
            <div key={mensagem.id} className="ia-msg ia-msg--erro">
              <span>{mensagem.texto}</span>
              {acaoDoErro(mensagem)}
            </div>
          ),
        )}
        {gerando && <GerarNpcForm onGerar={gerarNpc} onCancelar={() => useIaStore.getState().abrirGerar(false)} />}
        {gerado !== null && <NpcGerado npc={gerado} sistema={sistema} personagens={personagens} onGerarOutro={abrirGerar} />}
        {pensando && (
          <div className="ia-msg ia-msg--pensando" role="status">
            <i />
            <i />
            <i />
            <span className="lb-sr-only">Pensando</span>
          </div>
        )}
      </div>

      <div className="ia-compor">
        {foraDoApp ? (
          <p className="ia-semchave">A IA só funciona no app instalado.</p>
        ) : (
          chaves === 0 && (
            <p className="ia-semchave">
              Sem chave da IA.{' '}
              <button type="button" onClick={() => abrirConfig('chave')}>
                Pôr a chave
              </button>
            </p>
          )
        )}
        <div className="ia-compor__lin">
          <label className="lb-sr-only" htmlFor={ID_DO_TEXTO_DA_IA}>
            Pergunta ao assistente
          </label>
          <textarea
            ref={caixaRef}
            className="mu-entrada ia-area ia-compor__caixa"
            id={ID_DO_TEXTO_DA_IA}
            rows={1}
            value={texto}
            placeholder={dadosDoModo.lugar}
            onChange={(event) => {
              setTexto(event.target.value)
              ajustarAltura(event.target)
            }}
            onKeyDown={aoTeclarNaCaixa}
            disabled={foraDoApp}
          />
          <button
            type="button"
            className="mu-bt mu-bt--primario ia-enviar"
            aria-label="Enviar"
            title="Enviar"
            onClick={() => void enviar(texto)}
            disabled={pensando || foraDoApp || texto.trim().length === 0}
          >
            <IconeDaIa nome="enviar" />
          </button>
        </div>
        <div className="ia-compor__pe">
          <button type="button" className="mu-bt mu-bt--p mu-bt--latao" onClick={abrirGerar} aria-expanded={gerando} disabled={pensando || foraDoApp}>
            <IconeDaIa nome="ia" />
            Gerar NPC
          </button>
          <span>
            <kbd className="ia-kbd">Enter</kbd> envia · <kbd className="ia-kbd">Shift</kbd>+<kbd className="ia-kbd">Enter</kbd> quebra a linha
          </span>
        </div>
      </div>
    </aside>
  )
}
