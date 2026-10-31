import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { atributoComposto } from '../lib/ajusteDaFicha'
import { lerDano, normalizar } from '../lib/batalha/formula'
import { lerDanoDoCartao } from '../lib/livros/saude'
import type { CartaoDaFicha, Personagem } from '../lib/personagem'
import type { SistemaDeRpg } from '../lib/sistemaDeRpg'
import './CampoDeDano.css'

/**
 * O campo Dano do cartão da ficha (habilidade, técnica da forma, arma, bala)
 * com um teclado de fórmula: as VARIÁVEIS que a leitura entende
 * (`lerDano`, lib/batalha/formula.ts: o nome de cada atributo, "Dano da Arma",
 * "% da vida do alvo") e os operadores dela (+ - × / parênteses, vírgula
 * decimal), mais a prévia com os números DESTA ficha pelo mesmo leitor da
 * Saúde (`lerDanoDoCartao`). O que fica gravado continua o texto do campo;
 * o modo Personalizado só liga a marca `aMao` do cartão (a mesma do "Deixar
 * à mão" da Saúde).
 */

export interface CampoDeDanoProps {
  rotulo: string
  campoId: string
  cartao: CartaoDaFicha
  personagem: Personagem
  sistema: SistemaDeRpg
  /** Arma ou bala: "Dano da Arma" não entra (a leitura não lê a arma dentro dela mesma). */
  semDanoDaArma: boolean
  /** Arma: o "Dano da Arma" no próprio dano vira "não entende" na prévia. */
  ehArma: boolean
  onChange: (cartao: CartaoDaFicha) => void
}

/** Como o pedaço encosta no texto vizinho. */
type Encaixe = 'palavra' | 'binario' | 'abre' | 'fecha' | 'colado' | 'sufixo'

interface Tecla {
  chave: string
  rotulo: string
  /** O que entra no campo (o "−" da tecla vira o "-" que a leitura conhece). */
  texto: string
  encaixe: Encaixe
  dica: string
  /** O valor desta ficha, ao lado do nome. */
  valor?: number
}

const OPERADORES: readonly Tecla[] = [
  { chave: 'mais', rotulo: '+', texto: '+', encaixe: 'binario', dica: 'Somar' },
  { chave: 'menos', rotulo: '−', texto: '-', encaixe: 'binario', dica: 'Subtrair' },
  { chave: 'vezes', rotulo: '×', texto: '×', encaixe: 'binario', dica: 'Multiplicar (x 1,5)' },
  { chave: 'dividir', rotulo: '÷', texto: '/', encaixe: 'binario', dica: 'Dividir' },
  { chave: 'abre', rotulo: '(', texto: '(', encaixe: 'abre', dica: 'Abrir parêntese' },
  { chave: 'fecha', rotulo: ')', texto: ')', encaixe: 'fecha', dica: 'Fechar parêntese' },
  { chave: 'virgula', rotulo: ',', texto: ',', encaixe: 'colado', dica: 'Vírgula decimal (1,5)' },
]

const DANO_DA_ARMA: Tecla = { chave: 'arma', rotulo: 'Dano da Arma', texto: 'Dano da Arma', encaixe: 'palavra', dica: 'O Dano da arma escolhida na hora do golpe' }
const VIDA_DO_ALVO: Tecla = {
  chave: 'vida',
  rotulo: '% da vida do alvo',
  texto: '% da vida do alvo',
  encaixe: 'sufixo',
  dica: 'Depois de um número e sozinho no campo: "30% da vida do alvo"',
}

const ESPACO = /\s/

/**
 * Onde o pedaço entra e com que espaços: o trecho [de, ate) (a seleção mais
 * os espaços em volta) vira `insercao`. Puro.
 */
function planejarInsercao(texto: string, ini: number, fim: number, pedaco: string, encaixe: Encaixe): { de: number; ate: number; insercao: string } {
  if (encaixe === 'colado') return { de: ini, ate: fim, insercao: pedaco }
  let de = ini
  let ate = fim
  while (de > 0 && ESPACO.test(texto.charAt(de - 1))) de -= 1
  while (ate < texto.length && ESPACO.test(texto.charAt(ate))) ate += 1
  const antes = texto.charAt(de - 1)
  const depois = texto.charAt(ate)
  const comeco = de === 0
  const final = ate === texto.length
  switch (encaixe) {
    case 'sufixo':
      return { de, ate, insercao: `${pedaco}${final ? '' : ' '}` }
    case 'binario':
      return { de, ate, insercao: `${comeco ? '' : ' '}${pedaco} ` }
    case 'abre':
      return { de, ate, insercao: `${comeco || antes === '(' ? '' : ' '}${pedaco}` }
    case 'fecha':
      return { de, ate, insercao: `${pedaco}${final ? '' : ' '}` }
    case 'palavra':
      return { de, ate, insercao: `${comeco || antes === '(' ? '' : ' '}${pedaco}${final || depois === ')' ? '' : ' '}` }
  }
}

type EstadoDaPrevia = 'lido' | 'naHora' | 'naoLe' | 'aMao' | 'vazio' | 'suporte'

interface Previa {
  estado: EstadoDaPrevia
  selo: string
  valor: number | null
  conta: string
  frase: string
}

const SELO: Readonly<Record<EstadoDaPrevia, string>> = {
  lido: 'O app calcula sozinho',
  naHora: 'Calcula na hora',
  naoLe: 'O app não entende: vai à mão',
  aMao: 'À mão',
  vazio: 'Sem dano',
  suporte: 'Suporte',
}

/** "160 Força + 45 = 205" → "160 Força + 45": o total já vai à parte. */
function semTotal(conta: string): string {
  const igual = conta.lastIndexOf(' = ')
  return igual < 0 ? conta : conta.slice(0, igual)
}

/** A prévia pelo leitor da Saúde (o mesmo funil da batalha), com os números desta ficha. */
function lerPrevia(texto: string, cartao: CartaoDaFicha, personagem: Personagem, sistema: SistemaDeRpg, ehArma: boolean, semSaude: boolean): Previa {
  const previa = (estado: EstadoDaPrevia, frase: string, valor: number | null = null, conta = ''): Previa => ({ estado, selo: SELO[estado], valor, conta, frase })
  if (ehArma && lerDano(texto, { personagem, sistema, arma: null, vidaDoAlvo: null }).tipo === 'precisaArma') {
    return previa('naoLe', 'O "Dano da Arma" não entra no dano da própria arma: use números e atributos.')
  }
  const lido = lerDanoDoCartao(texto, cartao, personagem, sistema)
  if (lido === null) {
    return normalizar(texto) === '-' ? previa('suporte', 'Sem dano: habilidade de suporte.') : previa('vazio', '')
  }
  switch (lido.estado) {
    case 'lido':
      return previa('lido', cartao.aMao === true ? 'Mesmo no Personalizado, o app entende esta conta e calcula sozinho.' : '', lido.valor, semTotal(lido.leitura))
    case 'naHora': {
      if (lido.valor === null) return previa('naHora', lido.motivo)
      // "… = 168 (com Gram)": a arma já aparece na conta ("8 Gram"); o "(com …)" sai.
      const comArma = lido.leitura.lastIndexOf(' (com ')
      return previa('naHora', lido.motivo, lido.valor, semTotal(comArma < 0 ? lido.leitura : lido.leitura.slice(0, comArma)))
    }
    case 'naoLe':
      return previa('naoLe', lido.motivo)
    case 'aMao':
      return previa('aMao', semSaude ? 'Personalizado: na batalha você digita o número.' : 'Personalizado: na batalha você digita o número, e o golpe sai da porcentagem da Saúde.')
  }
}

/** O cartão com a marca À mão ligada ou tirada (o `deixarAMao` da Saúde, num cartão só). */
function comAMao(cartao: CartaoDaFicha, sim: boolean): CartaoDaFicha {
  if (sim) return cartao.aMao === true ? cartao : { ...cartao, aMao: true }
  if (cartao.aMao === undefined) return cartao
  const { aMao: _marca, ...semMarca } = cartao
  return semMarca
}

export function CampoDeDano({ rotulo, campoId, cartao, personagem, sistema, semDanoDaArma, ehArma, onChange }: CampoDeDanoProps) {
  const id = useId()
  const campo = useRef<HTMLInputElement>(null)
  const teclado = useRef<HTMLDivElement>(null)
  /** A seleção do campo antes do foco sair para o teclado (Tab até as teclas). */
  const selecao = useRef<{ ini: number; fim: number } | null>(null)
  /** Cursor a pôr depois do render, quando o navegador não faz a inserção por conta própria. */
  const cursorPendente = useRef<number | null>(null)
  const [focoNaTecla, setFocoNaTecla] = useState(0)

  const texto = cartao.campos[campoId] ?? ''
  const personalizado = cartao.aMao === true
  // Arma e bala não entram na Saúde (ela conta as técnicas): o Personalizado delas não fala da porcentagem.
  const previa = lerPrevia(texto, cartao, personagem, sistema, ehArma, semDanoDaArma)
  const trocarModo = (sim: boolean) => {
    const novo = comAMao(cartao, sim)
    if (novo !== cartao) onChange(novo)
  }

  const variaveis: Tecla[] = [
    ...sistema.atributos.map((atributo) => ({
      chave: `atr-${atributo.id}`,
      rotulo: atributo.nome,
      texto: atributo.nome,
      encaixe: 'palavra' as const,
      dica: `${atributo.nome} desta ficha (total com os ajustes)`,
      valor: atributoComposto(personagem, atributo.id).total,
    })),
    ...(semDanoDaArma ? [] : [DANO_DA_ARMA]),
    VIDA_DO_ALVO,
  ]
  const teclas = [...variaveis, ...OPERADORES]

  useLayoutEffect(() => {
    const cursor = cursorPendente.current
    const el = campo.current
    if (cursor === null || el === null) return
    cursorPendente.current = null
    el.focus()
    el.setSelectionRange(cursor, cursor)
  }, [texto])

  const trocarTexto = (novo: string) => onChange({ ...cartao, campos: { ...cartao.campos, [campoId]: novo } })

  function lembrarSelecao() {
    const el = campo.current
    if (el === null) return
    selecao.current = { ini: el.selectionStart ?? el.value.length, fim: el.selectionEnd ?? el.value.length }
  }

  function inserir(tecla: Tecla) {
    const el = campo.current
    if (el === null) return
    const atual = el.value
    const focado = document.activeElement === el
    const ini = focado ? (el.selectionStart ?? atual.length) : (selecao.current?.ini ?? atual.length)
    const fim = focado ? (el.selectionEnd ?? atual.length) : (selecao.current?.fim ?? atual.length)
    const { de, ate, insercao } = planejarInsercao(atual, Math.min(ini, atual.length), Math.min(fim, atual.length), tecla.texto, tecla.encaixe)
    el.focus()
    el.setSelectionRange(de, ate)
    // insertText passa pelo histórico do campo: Ctrl+Z desfaz a tecla como desfaz a digitação.
    if (document.execCommand('insertText', false, insercao)) return
    cursorPendente.current = de + insercao.length
    trocarTexto(atual.slice(0, de) + insercao + atual.slice(ate))
  }

  // Setas andam entre as teclas, Home/End vão às pontas, Esc volta ao campo: uma parada de Tab só.
  function onKeyDownDoTeclado(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      campo.current?.focus()
      return
    }
    const ultimo = teclas.length - 1
    const alvo =
      event.key === 'ArrowRight' ? Math.min(ultimo, focoNaTecla + 1) : event.key === 'ArrowLeft' ? Math.max(0, focoNaTecla - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? ultimo : null
    if (alvo === null) return
    event.preventDefault()
    setFocoNaTecla(alvo)
    teclado.current?.querySelectorAll<HTMLButtonElement>('button')[alvo]?.focus()
  }

  const botaoDaTecla = (tecla: Tecla, indice: number) => (
    <button
      key={tecla.chave}
      type="button"
      className={`lb-dano__tecla${tecla.valor === undefined && tecla.encaixe !== 'palavra' && tecla.encaixe !== 'sufixo' ? ' lb-dano__tecla--op' : ''}`}
      tabIndex={indice === Math.min(focoNaTecla, teclas.length - 1) ? 0 : -1}
      title={tecla.dica}
      aria-label={tecla.valor === undefined ? `${tecla.dica}: ${tecla.texto}` : `${tecla.rotulo}, ${tecla.valor} nesta ficha`}
      // O clique não tira o foco do campo: o cursor fica onde estava.
      onMouseDown={(event) => event.preventDefault()}
      onFocus={() => setFocoNaTecla(indice)}
      onClick={() => inserir(tecla)}
    >
      {tecla.rotulo}
      {tecla.valor !== undefined && <span className="lb-dano__tecla-valor">{tecla.valor}</span>}
    </button>
  )

  return (
    <div className={`lb-field lb-dano${personalizado ? ' lb-dano--personalizado' : ''}`}>
      <div className="lb-dano__topo">
        <label className="lb-label" htmlFor={`${id}-campo`}>
          {rotulo}
        </label>
        <div className="lb-dano__modo" role="group" aria-label={`Modo do ${rotulo}`}>
          <button type="button" className="lb-dano__modo-botao" aria-pressed={!personalizado} onClick={() => trocarModo(false)}>
            Fórmula
          </button>
          <button
            type="button"
            className="lb-dano__modo-botao"
            aria-pressed={personalizado}
            title="Texto livre: na batalha você digita o número"
            onClick={() => trocarModo(true)}
          >
            Personalizado
          </button>
        </div>
      </div>
      <input
        ref={campo}
        id={`${id}-campo`}
        className="lb-input lb-dano__campo"
        value={texto}
        spellCheck={false}
        autoComplete="off"
        placeholder={personalizado ? 'Texto livre, ex.: 2d6 + 10' : 'Ex.: Força + 45'}
        aria-describedby={`${id}-previa`}
        onChange={(event) => trocarTexto(event.target.value)}
        onSelect={lembrarSelecao}
        onBlur={lembrarSelecao}
      />
      {!personalizado && (
        <div ref={teclado} className="lb-dano__teclado" role="toolbar" aria-label={`Variáveis e operadores do ${rotulo}`} onKeyDown={onKeyDownDoTeclado}>
          <div className="lb-dano__grupo">{variaveis.map((tecla, indice) => botaoDaTecla(tecla, indice))}</div>
          <div className="lb-dano__grupo lb-dano__grupo--ops">{OPERADORES.map((tecla, indice) => botaoDaTecla(tecla, variaveis.length + indice))}</div>
        </div>
      )}
      <p id={`${id}-previa`} className="lb-dano__previa" data-estado={previa.estado}>
        <span className="lb-dano__selo">{previa.selo}</span>
        {previa.valor !== null && <span className="lb-dano__total">= {previa.valor}</span>}
        {previa.conta !== '' && <span className="lb-dano__conta">({previa.conta})</span>}
        {previa.frase !== '' && <span className="lb-dano__frase">{previa.frase}</span>}
      </p>
    </div>
  )
}
