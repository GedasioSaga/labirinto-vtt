import { memo, type DragEvent, type KeyboardEvent, type Ref } from 'react'
import { casasDaExplosao, casasDoAlcance } from '../../../lib/batalha/alcance/casas'
import type { CorDoAlcance } from '../../../lib/batalha/alcance/cor'
import { descreverAlcance, usaDirecao, type FormaDoAlcance } from '../../../lib/batalha/alcance/forma'
import type { DadosDoGrupo, GrupoDaBiblioteca } from '../../../lib/livros/gruposDaBiblioteca'
import { tamanhoDoAlcance, type DadosDaLinha } from '../../../lib/livros/linhaDaBiblioteca'
import type { EntradaDaBiblioteca } from '../../../lib/livros/paginasDaBiblioteca'
import type { Personagem } from '../../../lib/personagem'
import { formatarNumero, Retrato } from '../comum'
import { IconeDaBiblioteca } from './IconeDaBiblioteca'

/**
 * A LISTA AGRUPADA da biblioteca (protótipo `.grupo`, `.linha`): grupos com
 * cabeçalho fixo e contagem, que se fecham; uma linha por coisa, com a frase
 * em uma linha, as fichas de ação, SP e espera, o desenho do alcance e quem
 * tem. É um `listbox`: setas, Home e End andam (a página cuida), a escolhida
 * é a parada do Tab.
 */

/** O desenho de 7 x 7 casas, o mesmo do seletor de forma (`GlifoDoAlcance`), com a ficha no meio. */
const LADO_DO_GLIFO = 7
const MEIO = 3
const LINHA_DA_FICHA_DIRECIONAL = 5
const CENTRO_DA_AREA = { col: MEIO, row: 1, tamanho: 1 }
const PASSO = 30 / LADO_DO_GLIFO

interface DesenhoDoGlifo {
  acesas: string
  apagadas: string
  fichas: readonly { col: number; row: number }[]
}

/** Uma `path` por cor (e não 49 `rect`): a lista inteira fica com ~10x menos nós (o protótipo mediu 291 -> 94 ms ao abrir). */
const desenhos = new Map<string, DesenhoDoGlifo>()

function desenhoDoGlifo(forma: FormaDoAlcance): DesenhoDoGlifo {
  const chave = JSON.stringify(forma)
  const pronto = desenhos.get(chave)
  if (pronto !== undefined) return pronto
  // As MESMAS funções das casas da batalha que o `GlifoDoAlcance` usa (components/batalha/alcance/EscolhaDaForma.tsx).
  const grade = { segmentos: [], colunas: LADO_DO_GLIFO, linhas: LADO_DO_GLIFO, grade: 1 }
  let casas: readonly { col: number; row: number }[]
  let fichas: { col: number; row: number }[]
  if (forma.tipo === 'ponto' || forma.tipo === 'ficha') {
    casas = casasDaExplosao({ ...grade, forma, centro: CENTRO_DA_AREA })
    fichas = [{ col: MEIO, row: LADO_DO_GLIFO - 2 }, ...(forma.tipo === 'ficha' ? [CENTRO_DA_AREA] : [])]
  } else {
    const quemUsa = { col: MEIO, row: usaDirecao(forma) ? LINHA_DA_FICHA_DIRECIONAL : MEIO, tamanho: 1 }
    casas = casasDoAlcance({ ...grade, forma, quemUsa, direcao: 'norte' })
    fichas = [quemUsa]
  }
  const acesas = new Set(casas.map((casa) => `${casa.col},${casa.row}`))
  const lado = PASSO - 1
  let acesasD = ''
  let apagadasD = ''
  for (let row = 0; row < LADO_DO_GLIFO; row += 1) {
    for (let col = 0; col < LADO_DO_GLIFO; col += 1) {
      const quadrado = `M${(col * PASSO + 0.5).toFixed(2)} ${(row * PASSO + 0.5).toFixed(2)}h${lado.toFixed(2)}v${lado.toFixed(2)}h-${lado.toFixed(2)}z`
      if (acesas.has(`${col},${row}`)) acesasD += quadrado
      else apagadasD += quadrado
    }
  }
  const desenho = { acesas: acesasD, apagadas: apagadasD, fichas }
  desenhos.set(chave, desenho)
  return desenho
}

/** O desenho pequeno do alcance na linha (as classes do `GlifoDoAlcance`, para a cor ser a mesma). */
export function GlifoLeve({ forma, cor }: { forma: FormaDoAlcance; cor: CorDoAlcance }) {
  const { acesas, apagadas, fichas } = desenhoDoGlifo(forma)
  return (
    <svg className="lb-alc__glifo" viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      <path className="lb-alc__glifo-casa" d={apagadas} />
      <path className={`lb-alc__glifo-acesa lb-alc__glifo-acesa--${cor}`} d={acesas} />
      {fichas.map((casa) => (
        <circle key={`${casa.col},${casa.row}`} className="lb-alc__glifo-ficha" cx={casa.col * PASSO + PASSO / 2} cy={casa.row * PASSO + PASSO / 2} r={PASSO * 0.34} />
      ))}
    </svg>
  )
}

/** O "?" tracejado: pede alcance e não tem (a ferramenta "Dar alcance aos antigos" propõe um). */
export function GlifoDaFalta() {
  return (
    <svg className="mu-bib-falta" viewBox="0 0 26 26" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="24" height="24" rx="4" fill="none" stroke="rgba(236,234,228,0.28)" strokeDasharray="3 2.4" />
      <path d="M10.4 10.2a2.7 2.7 0 1 1 3.6 2.5c-.7.3-1 .8-1 1.5v.5M13 17.6v.1" fill="none" stroke="rgba(236,234,228,0.5)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/** As cores do tipo do golpe (as do editor) e as dos grupos, iguais às do protótipo (`COR`). */
const COR_DO_ICONE: Readonly<Record<string, string>> = {
  impacto: '#d9cfb8', cortante: '#d9cfb8', perfurante: '#d9cfb8', queimadura: '#e2845a', veneno: '#7fb48a', choque: '#f3ba66', cegueira: '#ab93d6',
  ataque: '#d9cfb8', apoio: '#7fb48a', reacao: '#79a9cc', passiva: '#ab93d6', pericia: '#c8b089', vantagem: '#7fb48a', desvantagem: '#e2645a',
  espada: '#d9cfb8', fogo: '#d9cfb8', frasco: '#7fb48a', balas: '#c8b089', caixa: '#a2a09a',
}

/** Quantos donos a linha mostra em bolinha; o resto vira "+N". */
const DONOS_NA_LINHA = 3

interface LinhaDaListaProps {
  entrada: EntradaDaBiblioteca
  dados: DadosDaLinha
  donos: readonly Personagem[]
  doAcervo: boolean
  escolhida: boolean
  /** A parada do Tab da lista (a escolhida, ou a primeira quando a escolhida saiu pelo filtro). */
  parada: boolean
  arrastavel: boolean
  arrastada: boolean
  nova: boolean
  onEscolher: (entrada: EntradaDaBiblioteca) => void
  onArrastar: (event: DragEvent<HTMLElement>, entrada: EntradaDaBiblioteca) => void
  onFimDoArrasto: () => void
}

const LinhaDaLista = memo(function LinhaDaLista({ entrada, dados, donos, doAcervo, escolhida, parada, arrastavel, arrastada, nova, onEscolher, onArrastar, onFimDoArrasto }: LinhaDaListaProps) {
  const nomes = donos.map((ficha) => ficha.nome).join(', ')
  const { alcance } = dados
  return (
    <div
      className="mu-bib-linha"
      role="option"
      id={`mu-bib-op-${entrada.id}`}
      data-entrada={entrada.id}
      aria-selected={escolhida}
      tabIndex={parada ? 0 : -1}
      draggable={arrastavel}
      aria-keyshortcuts="D T E"
      data-arrastada={arrastada ? '' : undefined}
      data-novo={nova ? '' : undefined}
      onClick={() => onEscolher(entrada)}
      onFocus={(event) => {
        // O foco que chega pelo Tab escolhe a linha; o das setas já escolheu.
        if (event.target === event.currentTarget && !escolhida) onEscolher(entrada)
      }}
      onDragStart={(event) => onArrastar(event, entrada)}
      onDragEnd={onFimDoArrasto}
    >
      <span className="mu-bib-linha__ic" style={{ color: COR_DO_ICONE[dados.icone] }}>
        <IconeDaBiblioteca nome={dados.icone} />
      </span>
      <span className="mu-bib-linha__main">
        <span className="mu-bib-linha__l1">
          <span className="mu-bib-linha__nome" title={entrada.nome.length > 34 ? entrada.nome : undefined}>
            {entrada.nome}
          </span>
          {doAcervo && <span className="mu-bib-marca">Do Acervo</span>}
          {dados.fichas.length > 0 && (
            <span className="mu-bib-linha__chips">
              {dados.fichas.map((ficha) => (
                <span key={ficha.texto} className="mu-bib-ch" data-c={ficha.cor}>
                  {ficha.texto}
                </span>
              ))}
            </span>
          )}
        </span>
        <span className={dados.fraseDoTexto ? 'mu-bib-linha__frase mu-bib-linha__frase--texto' : 'mu-bib-linha__frase'} title={dados.frase.length > 90 ? dados.frase : undefined}>
          {dados.frase === '' ? 'Sem texto.' : dados.frase}
        </span>
      </span>
      {alcance === null ? (
        <span />
      ) : alcance === 'falta' ? (
        <span className="mu-bib-gl" title="Sem alcance: a mesa não confere a distância">
          <GlifoDaFalta />
        </span>
      ) : (
        <span className="mu-bib-gl" title={descreverAlcance(alcance.forma)}>
          <GlifoLeve forma={alcance.forma} cor={alcance.cor} />
          {tamanhoDoAlcance(alcance.forma) !== null && <span>{tamanhoDoAlcance(alcance.forma)}</span>}
        </span>
      )}
      <span className="mu-bib-donos" title={donos.length > 0 ? `Quem tem: ${nomes}` : undefined}>
        {donos.slice(0, DONOS_NA_LINHA).map((ficha) => (
          <span key={ficha.id} className="mu-bib-av" aria-hidden="true">
            <Retrato imagem={ficha.retrato} nome={ficha.nome} tamanho="p" />
          </span>
        ))}
        {donos.length > DONOS_NA_LINHA && <span className="mu-bib-donos__mais">+{formatarNumero(donos.length - DONOS_NA_LINHA)}</span>}
        {donos.length > 0 && <span className="mu-it-sr">Quem tem: {nomes}</span>}
      </span>
    </div>
  )
})

export interface GrupoNaLista {
  dados: DadosDoGrupo
  entradas: readonly EntradaDaBiblioteca[]
}

interface ListaAgrupadaProps {
  rotulo: string
  grupos: readonly GrupoNaLista[]
  fechados: ReadonlySet<GrupoDaBiblioteca>
  /** Com busca, todo grupo abre (o achado nunca fica escondido num grupo fechado). */
  buscando: boolean
  /** Quantas linhas desenhar agora (a lista longa entra em mais de um quadro: nenhuma tarefa longa ao abrir). */
  limite: number
  dadosDe: (entrada: EntradaDaBiblioteca) => DadosDaLinha
  donosDe: (entrada: EntradaDaBiblioteca) => readonly Personagem[]
  ehDoAcervo: (entrada: EntradaDaBiblioteca) => boolean
  escolhidaId: string | null
  arrastavel: boolean
  arrastadaId: string | null
  novos: ReadonlySet<string>
  listaRef: Ref<HTMLDivElement>
  onDobrar: (grupo: GrupoDaBiblioteca) => void
  onEscolher: (entrada: EntradaDaBiblioteca) => void
  onArrastar: (event: DragEvent<HTMLElement>, entrada: EntradaDaBiblioteca) => void
  onFimDoArrasto: () => void
  onTeclar: (event: KeyboardEvent<HTMLDivElement>) => void
}

export function ListaAgrupada({ rotulo, grupos, fechados, buscando, limite, dadosDe, donosDe, ehDoAcervo, escolhidaId, arrastavel, arrastadaId, novos, listaRef, onDobrar, onEscolher, onArrastar, onFimDoArrasto, onTeclar }: ListaAgrupadaProps) {
  const visivel = grupos.some((grupo) => (buscando || !fechados.has(grupo.dados.id)) && grupo.entradas.some((entrada) => entrada.id === escolhidaId))
  let resta = limite
  let jaSeparou = false
  let primeira = !visivel
  return (
    <div className="mu-bib-lista" role="listbox" aria-label={rotulo} ref={listaRef} onKeyDown={onTeclar}>
      {grupos.map((grupo) => {
        const { dados } = grupo
        const aberto = buscando || !fechados.has(dados.id)
        const linhas = aberto ? grupo.entradas.slice(0, Math.max(0, resta)) : []
        resta -= linhas.length
        const separador = dados.doLivro && !jaSeparou
        if (separador) jaSeparou = true
        const cabId = `mu-bib-gc-${dados.id}`
        return (
          <div key={dados.id} role="presentation">
            {separador && (
              <p className="mu-bib-livro-sep" role="presentation">
                Do livro de regras do sistema
              </p>
            )}
            <div className="mu-bib-grupo" role="group" aria-labelledby={cabId}>
              <button type="button" className="mu-bib-grupo__cab" id={cabId} aria-expanded={aberto} onClick={() => onDobrar(dados.id)}>
                <IconeDaBiblioteca nome="seta" />
                <span className="mu-bib-grupo__nome">{dados.nome}</span>
                <span className="mu-bib-grupo__n">{formatarNumero(grupo.entradas.length)}</span>
                <span className="mu-bib-grupo__dica">{dados.dica}</span>
              </button>
              {linhas.length > 0 && (
                <div className="mu-bib-linhas">
                  {linhas.map((entrada) => {
                    const parada = entrada.id === escolhidaId || primeira
                    primeira = false
                    return (
                      <LinhaDaLista
                        key={entrada.id}
                        entrada={entrada}
                        dados={dadosDe(entrada)}
                        donos={donosDe(entrada)}
                        doAcervo={ehDoAcervo(entrada)}
                        escolhida={entrada.id === escolhidaId}
                        parada={parada}
                        arrastavel={arrastavel}
                        arrastada={entrada.id === arrastadaId}
                        nova={novos.has(entrada.id)}
                        onEscolher={onEscolher}
                        onArrastar={onArrastar}
                        onFimDoArrasto={onFimDoArrasto}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
