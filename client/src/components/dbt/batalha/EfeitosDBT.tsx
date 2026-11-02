import { useEffect, useMemo, useRef, useState, type AnimationEvent, type CSSProperties } from 'react'
import { nomeDaCondicao } from '../../../lib/dbt/batalha/condicoes'
import type { EfeitoDBT, TipoDaLinhaDBT } from '../../../lib/dbt/batalha/tipos'
import type { VistaDBT } from '../../../lib/dbt/batalha/vista'
import { efeitosDaCenaDBT, useBatalhaDBTStore } from '../../../stores/batalhaDBTStore'
import '../ficha/fichaDBT.css'
import './batalhaDBT.css'
import { NOME_DA_FAIXA } from './dadosDaBatalhaDBT'

/**
 * OS EFEITOS DA BATALHA DBT sobre o mapa (seção 19, `EfeitosDBT`): um aviso
 * curto junto da ficha a cada coisa que o motor fez, sem cobrir nada nem
 * pegar clique. O d20 e a faixa do golpe acima do alvo (Erro, Mínimo, Médio,
 * Completo; Crítico com um anel), o dano subindo em vermelho e a cura em
 * verde no meio da ficha, a condição embaixo, a forma que liga com um anel
 * âmbar, e a reação (Barreira, Defensiva, Reativa, Choque) em azul de Ki
 * junto de quem reagiu. Desenho próprio, sem arte de ninguém.
 *
 * Começa no `seq` de agora (sem reprise do que já passou). Cada aviso entra
 * em 180 ms, fica legível e sai em ~230 ms (1,3 s ao todo); os do mesmo
 * comando entram um depois do outro, 80 ms de diferença. Movimento reduzido:
 * só aparece e some, sem deslizar nem anel. Só transform e opacity.
 *
 * A posição da ficha vem da consulta do mapa (px da janela), lida quando o
 * efeito chega; ficha fora da tela não ganha aviso (a reação vai ao alto do
 * mapa). O leitor de tela ouve uma frase curta de cada um.
 */

/** A consulta do mapa (`onFichaNaTela`): onde a ficha está em px da janela; `null` = não desenhada agora. */
export type ConsultaDaFichaDBT = (tokenId: string) => { x: number; y: number; raio: number } | null

/** O pedaço da linha do registro que importa aqui (a do mestre e a do jogador servem). */
export interface LinhaParaEfeitoDBT {
  id: string
  tipo: TipoDaLinhaDBT
  texto: string
  /** Só a linha do mestre traz: quem reagiu (o aviso vai nele). */
  envolve?: { tokenIds: readonly string[] }
}

export interface EfeitosDBTProps {
  efeitos: readonly EfeitoDBT[]
  consulta: ConsultaDaFichaDBT | null
  /** O registro: a linha nova de reação vira aviso azul. Ausente = sem aviso de reação. */
  registro?: readonly LinhaParaEfeitoDBT[]
  /** A forma ativa do token (depois do efeito): o nome que liga; `null` = saiu da forma. */
  formaDe?: (tokenId: string) => string | null
  /** A condição mais nova do token, para o aviso dizer qual. */
  condicaoDe?: (tokenId: string) => string | null
  className?: string
}

type Tom = 'erro' | 'minimo' | 'medio' | 'completo' | 'critico' | 'erro-critico' | 'dado' | 'dano' | 'cura' | 'condicao' | 'forma' | 'sem-forma' | 'reacao'
type Lugar = 'acima' | 'centro' | 'abaixo' | 'anel'

interface Estouro {
  chave: string
  tom: Tom
  lugar: Lugar
  x: number
  y: number
  raio: number
  /** O d20 à esquerda do texto (só na rolagem). */
  d20: number | null
  texto: string
  atraso: number
}

/** Diferença entre os avisos do mesmo comando (30 a 80 ms: dá para ler a ordem sem esperar). */
const ESCALONAR_MS = 80
/** Respiro entre a ficha e o aviso. */
const FOLGA_PX = 6
/** Teto de avisos à vista: rajada de área não empilha sem fim. */
const ESTOUROS_MAX = 24
const FAIXA_DO_TOM = { erro: 'erro', minimo: 'minimo', medio: 'medio', completo: 'completo' } as const
const NATURAL_CRITICO = 20
const NATURAL_ERRO = 1

/** Movimento reduzido: o anel (que só cresce) nem nasce. Sem `matchMedia` vale o normal. */
function movimentoReduzido(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/**
 * O efeito diz "crítico"? O golpe leva o campo (`ataque.ts`), e ele manda: o
 * crítico de 16 a 19 (Exposto, Golpe Crítico) e o marcado pelo mestre. Sem o
 * campo (efeito salvo antes dele), o 20 natural que acertou é crítico, e isso
 * bate com o motor: só o ataque rolado vira efeito e o 20 rolado sempre passa
 * da margem de crítico.
 */
function criticoDe(efeito: EfeitoDBT): boolean {
  return efeito.critico ?? (efeito.d20 === NATURAL_CRITICO && efeito.faixa !== null && efeito.faixa !== 'erro')
}

/** Erro crítico: o campo do golpe; sem ele, o 1 natural rolado (o motor faz o mesmo fora do total fixo). */
function erroCriticoDe(efeito: EfeitoDBT): boolean {
  return efeito.erroCritico ?? (efeito.d20 === NATURAL_ERRO && efeito.faixa === 'erro')
}

function tomDaRolagem(efeito: EfeitoDBT): { tom: Tom; texto: string } {
  if (efeito.faixa === null) return { tom: 'dado', texto: 'Rolou' }
  if (efeito.faixa === 'erro') return erroCriticoDe(efeito) ? { tom: 'erro-critico', texto: 'Erro crítico' } : { tom: 'erro', texto: 'Erro' }
  if (criticoDe(efeito)) return { tom: 'critico', texto: `Crítico · ${NOME_DA_FAIXA[efeito.faixa]}` }
  return { tom: FAIXA_DO_TOM[efeito.faixa], texto: NOME_DA_FAIXA[efeito.faixa] }
}

/** "Barreira: Kamehameha (CA +2)" do texto "Goku: Barreira: Kamehameha (CA +2)"; `null` = não é reação feita ("Não reagir", "entra na reação"). */
function reacaoDaLinha(linha: LinhaParaEfeitoDBT): string | null {
  if (linha.tipo !== 'reacao') return null
  const texto = linha.texto.trim()
  if (texto === '' || texto.endsWith('Não reagir') || texto.endsWith('entra na reação')) return null
  return texto
}

const numero = new Intl.NumberFormat('pt-BR')

export function EfeitosDBT({ efeitos, consulta, registro, formaDe, condicaoDe, className }: EfeitosDBTProps) {
  const camada = useRef<HTMLDivElement>(null)
  const [estouros, setEstouros] = useState<readonly Estouro[]>([])
  const [anuncio, setAnuncio] = useState('')
  // Começa no que já existe: abrir a tela no meio da batalha não reprisa nada.
  const visto = useRef(efeitos.reduce((maior, efeito) => Math.max(maior, efeito.seq), 0))
  const linhasVistas = useRef(new Set((registro ?? []).map((linha) => linha.id)))
  const ultimoAlvo = useRef<string | null>(null)
  // Os leitores do momento do efeito (a forma e a condição já mudaram no mesmo estado).
  const leitores = useRef({ consulta, formaDe, condicaoDe })
  leitores.current = { consulta, formaDe, condicaoDe }

  const ondeEsta = (tokenId: string): { x: number; y: number; raio: number } | null => {
    const lido = leitores.current.consulta?.(tokenId) ?? null
    const raiz = camada.current
    if (lido === null || raiz === null) return null
    const caixa = raiz.getBoundingClientRect()
    return { x: lido.x - caixa.left, y: lido.y - caixa.top, raio: lido.raio }
  }

  const tocar = (novos: Estouro[], frase: string) => {
    if (novos.length > 0) setEstouros((antes) => [...antes, ...novos].slice(-ESTOUROS_MAX))
    if (frase !== '') setAnuncio(frase)
  }

  useEffect(() => {
    const chegaram = efeitos.filter((efeito) => efeito.seq > visto.current)
    if (chegaram.length === 0) return
    visto.current = Math.max(visto.current, ...chegaram.map((efeito) => efeito.seq))
    const novos: Estouro[] = []
    const frases: string[] = []
    const semAnel = movimentoReduzido()
    let ordem = 0
    const por = (efeito: EfeitoDBT, tokenId: string, estouro: Omit<Estouro, 'chave' | 'x' | 'y' | 'raio' | 'atraso'>): void => {
      if (estouro.lugar === 'anel' && semAnel) return
      const onde = ondeEsta(tokenId)
      if (onde === null) return
      novos.push({ ...estouro, ...onde, chave: `${efeito.seq}:${tokenId}:${estouro.lugar}`, atraso: ordem * ESCALONAR_MS })
    }
    for (const efeito of chegaram) {
      const alvo = alvoDoEfeito(efeito)
      if (alvo === null) {
        // Golpe com um dos dois fora da vista: sem saber quem sobrou, nada em cima de ninguém.
        if (efeito.tipo === 'rolagem') ultimoAlvo.current = null
        continue
      }
      if (efeito.tipo === 'rolagem') {
        ultimoAlvo.current = alvo
        const { tom, texto } = tomDaRolagem(efeito)
        por(efeito, alvo, { tom, lugar: 'acima', d20: efeito.d20, texto })
        if (tom === 'critico') por(efeito, alvo, { tom, lugar: 'anel', d20: null, texto: '' })
        frases.push(efeito.d20 === null ? texto : `d20 ${efeito.d20}: ${texto}`)
      } else if (efeito.tipo === 'dano' || efeito.tipo === 'cura') {
        const sinal = efeito.tipo === 'dano' ? '−' : '+'
        // Sem número (o jogador não vê a vida de quem é do outro lado): só a palavra.
        const texto = efeito.numero === null ? (efeito.tipo === 'dano' ? 'Dano' : 'Cura') : `${sinal}${numero.format(efeito.numero)}`
        for (const tokenId of efeito.tokenIds) por(efeito, tokenId, { tom: efeito.tipo, lugar: 'centro', d20: null, texto })
        frases.push(efeito.numero === null ? texto : `${efeito.tipo === 'dano' ? 'Dano' : 'Cura'} ${numero.format(efeito.numero)}`)
      } else if (efeito.tipo === 'condicao') {
        const nome = leitores.current.condicaoDe?.(alvo) ?? 'Condição'
        por(efeito, alvo, { tom: 'condicao', lugar: 'abaixo', d20: null, texto: nome })
        frases.push(nome)
      } else {
        const forma = leitores.current.formaDe?.(alvo) ?? null
        const texto = forma ?? 'Saiu da forma'
        por(efeito, alvo, { tom: forma === null ? 'sem-forma' : 'forma', lugar: 'abaixo', d20: null, texto })
        if (forma !== null) por(efeito, alvo, { tom: 'forma', lugar: 'anel', d20: null, texto: '' })
        frases.push(texto)
      }
      ordem += 1
    }
    tocar(novos, frases.join('. '))
    // `ondeEsta` e `tocar` leem refs: rodar só quando chega efeito novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [efeitos])

  useEffect(() => {
    if (registro === undefined) return
    const novos: Estouro[] = []
    const frases: string[] = []
    for (const linha of registro) {
      if (linhasVistas.current.has(linha.id)) continue
      linhasVistas.current.add(linha.id)
      const texto = reacaoDaLinha(linha)
      if (texto === null) continue
      const quem = linha.envolve?.tokenIds[0] ?? ultimoAlvo.current
      const onde = quem === null ? null : ondeEsta(quem)
      const raiz = camada.current
      // Sem o alvo à vista, a reação aparece no alto do mapa.
      const lugar = onde ?? (raiz === null ? null : { x: raiz.clientWidth / 2, y: 72, raio: 0 })
      if (lugar === null) continue
      novos.push({ chave: `reacao:${linha.id}`, tom: 'reacao', lugar: 'abaixo', ...lugar, d20: null, texto: `Reação · ${texto}`, atraso: novos.length * ESCALONAR_MS })
      frases.push(`Reação: ${texto}`)
    }
    tocar(novos, frases.join('. '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro])

  const acabou = (chave: string) => (evento: AnimationEvent<HTMLElement>) => {
    if (evento.target !== evento.currentTarget) return
    setEstouros((antes) => antes.filter((estouro) => estouro.chave !== chave))
  }

  return (
    <div ref={camada} className={className === undefined ? 'dbf dbe' : `dbf dbe ${className}`}>
      {estouros.map((estouro) => {
        const estilo = { left: `${estouro.x}px`, top: `${posicaoY(estouro)}px`, '--dbe-atraso': `${estouro.atraso}ms` } as CSSProperties
        if (estouro.lugar === 'anel') {
          const lado = `${Math.max(24, estouro.raio * 2)}px`
          return <span key={estouro.chave} className="dbe-anel" data-tom={estouro.tom} style={{ ...estilo, width: lado, height: lado }} aria-hidden="true" onAnimationEnd={acabou(estouro.chave)} />
        }
        return (
          <span key={estouro.chave} className="dbe-pino" data-lugar={estouro.lugar} style={estilo} aria-hidden="true">
            <span className={estouro.lugar === 'centro' ? 'dbe-numero' : 'dbe-chip'} data-tom={estouro.tom} onAnimationEnd={acabou(estouro.chave)}>
              {estouro.d20 !== null && <span className="dbe-chip__d20">d20 {estouro.d20}</span>}
              {estouro.texto}
            </span>
          </span>
        )
      })}
      <span className="dbe-sr" aria-live="polite">
        {anuncio}
      </span>
    </div>
  )
}

/**
 * Em quem o aviso vai. O golpe (rolagem com faixa) diz o alvo em `alvoId`; no
 * jogador o host o tira quando o alvo está fora da vista, e aí o aviso não
 * cai em ninguém (nunca no atacante). Sem o campo (efeito salvo antes dele),
 * o golpe vem do motor como [atacante, alvo]. O resto (teste de morte, dano,
 * condição, forma) tem um token só.
 */
function alvoDoEfeito(efeito: EfeitoDBT): string | null {
  if (efeito.tipo === 'rolagem' && efeito.faixa !== null) {
    if (efeito.alvoId !== undefined) return efeito.alvoId
    return efeito.tokenIds.length === 2 ? (efeito.tokenIds[1] ?? null) : null
  }
  return efeito.tokenIds[efeito.tokenIds.length - 1] ?? null
}

/** Acima e abaixo da ficha com folga; o número e o anel no meio dela. */
function posicaoY(estouro: Estouro): number {
  if (estouro.lugar === 'acima') return estouro.y - estouro.raio - FOLGA_PX
  if (estouro.lugar === 'abaixo') return estouro.y + estouro.raio + FOLGA_PX
  return estouro.y
}

/** O nome da condição mais nova da lista (a que o efeito acabou de pôr). */
function ultimaCondicao(condicoes: readonly { nome: string }[] | undefined): string | null {
  const ultima = condicoes === undefined ? undefined : condicoes[condicoes.length - 1]
  return ultima?.nome ?? null
}

export interface EfeitosDoMestreDBTProps {
  /** A cena aberta (`tableSceneKey`). */
  sceneKey: string
  /** A consulta do mapa do mestre (`consultaDoMestre`, a mesma dos efeitos do One Piece). */
  consulta: ConsultaDaFichaDBT | null
}

/** Os efeitos na tela do MESTRE (seção 18, ao lado de `EfeitosDoMestre` no App): tudo da cena, com o registro inteiro. */
export function EfeitosDoMestreDBT({ sceneKey, consulta }: EfeitosDoMestreDBTProps) {
  const efeitos = useBatalhaDBTStore((state) => efeitosDaCenaDBT(state, sceneKey))
  const cena = useBatalhaDBTStore((state) => (Object.hasOwn(state.cenas, sceneKey) ? state.cenas[sceneKey] : undefined))
  const combatentes = cena?.combatentes
  const leitores = useMemo(() => {
    const de = (tokenId: string) => (combatentes !== undefined && Object.hasOwn(combatentes, tokenId) ? combatentes[tokenId] : undefined)
    return {
      formaDe: (tokenId: string) => de(tokenId)?.transformacao?.nome ?? null,
      condicaoDe: (tokenId: string) => {
        const ultima = de(tokenId)?.condicoes.at(-1)
        if (ultima === undefined) return null
        return ultima.nome.trim() || nomeDaCondicao(ultima.condicao)
      },
    }
  }, [combatentes])
  if (cena === undefined) return null
  return <EfeitosDBT efeitos={efeitos} consulta={consulta} registro={cena.registro} formaDe={leitores.formaDe} condicaoDe={leitores.condicaoDe} />
}

export interface EfeitosDoJogadorDBTProps {
  vista: VistaDBT
  /** `batalhaDBTEfeitos` da conexão (já recortados pelo host: número só de "eu" e aliado). */
  efeitos: readonly EfeitoDBT[] | undefined
  /** A consulta do mapa dele (`onFichaNaTela`). */
  consulta: ConsultaDaFichaDBT | null
}

const SEM_EFEITOS: readonly EfeitoDBT[] = []

/** Os efeitos na tela do JOGADOR: só os tokens do recorte dele, com o registro público. */
export function EfeitosDoJogadorDBT({ vista, efeitos, consulta }: EfeitosDoJogadorDBTProps) {
  const cartas = vista.cartas
  const leitores = useMemo(() => {
    const de = (tokenId: string) => cartas.find((carta) => carta.tokenId === tokenId)
    return {
      formaDe: (tokenId: string) => de(tokenId)?.transformacao ?? null,
      condicaoDe: (tokenId: string) => ultimaCondicao(de(tokenId)?.condicoes),
    }
  }, [cartas])
  // A camada cobre a janela (a consulta do jogador já é em px da janela), como `pp-batalha-efeitos`.
  return <EfeitosDBT className="dbe--janela" efeitos={efeitos ?? SEM_EFEITOS} consulta={consulta} registro={vista.registro} formaDe={leitores.formaDe} condicaoDe={leitores.condicaoDe} />
}
