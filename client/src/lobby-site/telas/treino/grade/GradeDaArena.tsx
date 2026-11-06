import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import type { ConsultaDaFicha } from '../../../../components/batalha/MiraDoGolpe'
import { useImagemDaMesa } from '../../../../components/ImagemDaMesa'
import { CASA_DA_ARENA, EQUIPE_DO_LADO, GRADE_PEQUENA, limitesDaArena, type CasaDaArena, type GradeDaArena as MedidaDaGrade } from '../../../../lib/arena/grade'
import { blocosEntre } from '../../../../lib/batalha/blocos'
import { healthState } from '../../../../lib/tokenHealth'
import { casaPelaSeta, casaPresaSob, dentroDaGrade, iniciaisDoNome, mesmaCasa, rotuloDaCasa, situacaoDaCasa, type BonecoNaGrade, type SituacaoDaCasa } from './bonecos'
import { JuizAnimado } from './JuizAnimado'
import './grade.css'

/**
 * A GRADE DA ARENA NO SITE (fatia G2): a mesma grade 12 x 8 de casas de 64 px
 * da Arena de testes do app, em DOM (o site não carrega o Pixi). Cada ficha é
 * um botão posto na casa por `transform`; arrastar com o ponteiro, ou as setas
 * (com ou sem Alt, como o "Alt + setas move" da Arena) com a ficha em foco,
 * pedem para andar. A grade só desenha e pede: quem liga decide (a vez, o MOV,
 * o servidor no duelo) e responde se aceitou. Casa ocupada nem chega a pedir:
 * a ficha volta para onde estava.
 *
 * Expõe a `ConsultaDaFicha` da mira (onde cada ficha está na tela, em px da
 * janela) por `onConsulta`, como o palco da Arena do app.
 */

/** Px de tela que o ponteiro anda antes de o toque virar arrasto (abaixo disso é clique), o mesmo do palco do app. */
const LIMIAR_DO_ARRASTO = 4
/** Quanto a grade cresce além da casa de 64 px quando sobra espaço. */
const ESCALA_MAXIMA_PADRAO = 1.5
/** Metade da casa: o centro da ficha a partir do canto dela. */
const MEIA_CASA = CASA_DA_ARENA / 2

/** Pedido de andar: `true` = aceito (a ficha fica na casa nova até a luta confirmar); `false` = recusado (ela volta). */
export type RespostaDoAndar = boolean | Promise<boolean>

export interface GradeDaArenaProps {
  bonecos: readonly BonecoNaGrade[]
  /** Colunas x linhas; o padrão é a grade pequena da Arena (12 x 8). */
  grade?: MedidaDaGrade
  /** A ficha quer ir para `casa` (dentro da grade, livre e diferente da de agora). */
  onAndar: (tokenId: string, casa: CasaDaArena) => RespostaDoAndar
  /** Clique ou Enter na ficha, sem arrastar (a mira escolhe o alvo por aqui). */
  onTocar?: (tokenId: string) => void
  /** A consulta de onde cada ficha está na tela, para a mira; `null` quando a grade sai. */
  onConsulta?: (consulta: ConsultaDaFicha | null) => void
  /** O caminho andado de cada ficha, casa a casa (`BatalhaDaCena.trilhas`); ausente = sem trilha. */
  trilhas?: Readonly<Record<string, readonly CasaDaArena[]>>
  /** A mira está aberta: o cursor vira mira sobre as fichas. */
  mirando?: boolean
  /** `largura`: a grade cabe na largura (a altura segue). `tudo`: cabe na caixa de quem a põe (que precisa ter altura). */
  caber?: 'largura' | 'tudo'
  escalaMaxima?: number
  rotulo?: string
  /** A MONTAGEM (fatia J): as duas metades com o nome do lado, o realce de quem chega da lista e o jeito de tirar. */
  montagem?: MontagemDaGrade
}

/** O que a grade faz a mais na montagem do treino (`MontagemNaGrade.tsx`). */
export interface MontagemDaGrade {
  /** A casa sob o item que vem arrastado da lista (a grade só desenha; quem arrasta é a lista). `texto` troca o rótulo padrão. */
  realce: { casa: CasaDaArena; situacao: 'livre' | 'ocupada' | 'cheio'; texto?: string } | null
  /** O nome de cada metade; ausente = o do treino ("Lado A: você joga", "Lado B: o robô joga"). */
  nomesDasMetades?: Readonly<Record<'a' | 'b', string>>
  /** O rótulo da casa sob a ficha na mão ("Lado B"), no lugar das casas andadas. */
  rotuloDoAlvo(alvo: CasaDaArena): string
  /** O ponteiro com uma ficha na mão (px da janela); `null` = soltou ou desistiu. A lista usa para se acender. */
  aoArrastar(tokenId: string, ponto: { x: number; y: number } | null): void
  /** Soltou com o ponteiro fora da grade: `true` = tirou a ficha (ela não volta). */
  aoSoltarFora(tokenId: string, ponto: { x: number; y: number }): boolean
  /** Delete ou Backspace na ficha em foco. */
  aoTirar(tokenId: string): void
  /** A dica de leitor de tela das fichas. */
  dica: string
}

interface FichaNaMao {
  tokenId: string
  origem: CasaDaArena
  alvo: CasaDaArena
  situacao: SituacaoDaCasa
  /** O ponteiro saiu da grade (só na montagem): soltar ali pode tirar a ficha. */
  fora: boolean
}

interface Gesto {
  pointerId: number
  tokenId: string
  origem: CasaDaArena
  inicioX: number
  inicioY: number
  /** Do ponteiro ao canto da ficha, em px da grade. */
  difX: number
  difY: number
  movido: boolean
  /** O último ponto do ponteiro, px da janela (para soltar fora da grade, na montagem). */
  x: number
  y: number
}

function posicaoDaCasa(casa: CasaDaArena): string {
  return `translate(${casa.col * CASA_DA_ARENA}px, ${casa.row * CASA_DA_ARENA}px)`
}

function textoDeCasas(blocos: number): string {
  return blocos === 1 ? '1 casa' : `${blocos} casas`
}

export function GradeDaArena({ bonecos, grade = GRADE_PEQUENA, onAndar, onTocar, onConsulta, trilhas, mirando = false, caber = 'largura', escalaMaxima = ESCALA_MAXIMA_PADRAO, rotulo = 'Grade da arena', montagem }: GradeDaArenaProps) {
  const idBase = useId()
  const resolver = useImagemDaMesa()
  const { largura, altura } = limitesDaArena(grade)
  const [escala, setEscala] = useState(1)
  const [naMao, setNaMao] = useState<FichaNaMao | null>(null)
  const [pendente, setPendente] = useState<string | null>(null)
  const [anuncio, setAnuncio] = useState({ texto: '', vez: 0 })
  const [semFoto, setSemFoto] = useState<ReadonlySet<string>>(() => new Set())

  const medida = useRef<HTMLDivElement>(null)
  const tabuleiro = useRef<HTMLDivElement>(null)
  const botoes = useRef(new Map<string, HTMLButtonElement>())
  const discos = useRef(new Map<string, HTMLElement>())
  const gesto = useRef<Gesto | null>(null)
  const alvoAtual = useRef<FichaNaMao | null>(null)
  const cliqueEngolido = useRef<string | null>(null)
  // As props de agora, para os gestos (que vivem entre renders) lerem sem recriar os ouvintes.
  const atual = useRef({ bonecos, grade, onAndar, onTocar, onConsulta, montagem })
  atual.current = { bonecos, grade, onAndar, onTocar, onConsulta, montagem }

  // A escala que faz a grade caber: só a largura, ou a caixa toda. Antes do primeiro quadro, para não piscar grande.
  useLayoutEffect(() => {
    const caixa = medida.current
    if (caixa === null) return
    const medir = (w: number, h: number) => {
      if (w <= 0) return
      const pelaLargura = w / largura
      const nova = Math.min(escalaMaxima, caber === 'tudo' && h > 0 ? Math.min(pelaLargura, h / altura) : pelaLargura)
      setEscala((antes) => (Math.abs(antes - nova) < 0.001 ? antes : nova))
    }
    const inicial = caixa.getBoundingClientRect()
    medir(inicial.width, inicial.height)
    const observador = new ResizeObserver((entradas) => {
      const ultima = entradas[entradas.length - 1]
      if (ultima !== undefined) medir(ultima.contentRect.width, ultima.contentRect.height)
    })
    observador.observe(caixa)
    return () => observador.disconnect()
  }, [largura, altura, caber, escalaMaxima])

  // A consulta da mira: o centro e o raio do disco na tela, lidos na hora (a grade pode ter mudado de escala ou rolado).
  const consulta = useCallback<ConsultaDaFicha>((tokenId) => {
    const disco = discos.current.get(tokenId)
    if (disco === undefined || !disco.isConnected) return null
    const caixa = disco.getBoundingClientRect()
    if (caixa.width === 0) return null
    return { x: caixa.left + caixa.width / 2, y: caixa.top + caixa.height / 2, raio: caixa.width / 2 }
  }, [])
  useEffect(() => {
    atual.current.onConsulta?.(consulta)
    return () => atual.current.onConsulta?.(null)
  }, [consulta])

  const anunciar = useCallback((texto: string) => setAnuncio((antes) => ({ texto, vez: antes.vez + 1 })), [])

  const nomeDe = (tokenId: string) => atual.current.bonecos.find((boneco) => boneco.tokenId === tokenId)?.nome ?? 'A ficha'

  /** A ficha volta, com a transição curta do CSS, para a casa de onde saiu. */
  const devolver = useCallback((tokenId: string, origem: CasaDaArena) => {
    const botao = botoes.current.get(tokenId)
    if (botao !== undefined) botao.style.transform = posicaoDaCasa(origem)
  }, [])

  /** Pede para andar e trata a resposta: recusada, a ficha volta; aceita, fica (a luta confirma no próximo estado). */
  const pedir = useCallback(
    (tokenId: string, origem: CasaDaArena, destino: CasaDaArena) => {
      const nome = nomeDe(tokenId)
      const concluir = (aceito: boolean) => {
        if (aceito) {
          anunciar(`${nome} andou para ${rotuloDaCasa(destino)}.`)
          return
        }
        devolver(tokenId, origem)
        anunciar(`${nome} não andou: a luta recusou a casa ${rotuloDaCasa(destino)}.`)
      }
      let resposta: RespostaDoAndar
      try {
        resposta = atual.current.onAndar(tokenId, destino)
      } catch {
        concluir(false)
        return
      }
      if (typeof resposta === 'boolean') {
        concluir(resposta)
        return
      }
      setPendente(tokenId)
      resposta.then(
        (aceito) => {
          setPendente((antes) => (antes === tokenId ? null : antes))
          concluir(aceito)
        },
        () => {
          setPendente((antes) => (antes === tokenId ? null : antes))
          concluir(false)
        },
      )
    },
    [anunciar, devolver],
  )

  /** Fim do arrasto: `soltou` = o dedo saiu na grade; cancelado (Esc, o sistema tomou o ponteiro), a ficha volta. */
  const terminar = useCallback(
    (soltou: boolean) => {
      const fim = gesto.current
      if (fim === null) return
      gesto.current = null
      const botao = botoes.current.get(fim.tokenId)
      if (botao !== undefined && botao.hasPointerCapture(fim.pointerId)) botao.releasePointerCapture(fim.pointerId)
      if (!fim.movido) return
      // O clique que o navegador manda depois do arrasto não é um toque na ficha.
      cliqueEngolido.current = fim.tokenId
      window.setTimeout(() => {
        if (cliqueEngolido.current === fim.tokenId) cliqueEngolido.current = null
      }, 0)
      if (botao !== undefined) delete botao.dataset.naMao
      const alvo = alvoAtual.current
      alvoAtual.current = null
      setNaMao(null)
      const naMontagem = atual.current.montagem
      naMontagem?.aoArrastar(fim.tokenId, null)
      // Na montagem, soltar fora da grade (sobre a lista) tira a ficha: ela não volta para a casa.
      if (soltou && alvo?.fora === true && naMontagem !== undefined && naMontagem.aoSoltarFora(fim.tokenId, { x: fim.x, y: fim.y })) return
      if (!soltou || alvo === null || alvo.situacao !== 'livre') {
        devolver(fim.tokenId, fim.origem)
        if (soltou && alvo?.situacao === 'ocupada') anunciar(`A casa ${rotuloDaCasa(alvo.alvo)} está ocupada: ${nomeDe(fim.tokenId)} voltou.`)
        return
      }
      // Assenta no centro da casa (a transição curta leva do ponto solto até lá) e pede.
      if (botao !== undefined) botao.style.transform = posicaoDaCasa(alvo.alvo)
      pedir(fim.tokenId, fim.origem, alvo.alvo)
    },
    [anunciar, devolver, pedir],
  )

  // Esc no meio do arrasto: desiste, a ficha volta (catálogo: Lista reordenável, "Esc cancela").
  useEffect(() => {
    if (naMao === null) return
    const aoTeclar = (evento: globalThis.KeyboardEvent) => {
      if (evento.key !== 'Escape') return
      evento.preventDefault()
      evento.stopPropagation()
      terminar(false)
    }
    window.addEventListener('keydown', aoTeclar, true)
    return () => window.removeEventListener('keydown', aoTeclar, true)
  }, [naMao, terminar])

  /** O ponto da janela em px da grade (sem a escala). */
  function naGrade(clienteX: number, clienteY: number): { x: number; y: number } {
    const caixa = tabuleiro.current?.getBoundingClientRect()
    if (caixa === undefined || caixa.width === 0) return { x: 0, y: 0 }
    const fator = largura / caixa.width
    return { x: (clienteX - caixa.left) * fator, y: (clienteY - caixa.top) * fator }
  }

  function aoApertar(evento: PointerEvent<HTMLButtonElement>, boneco: BonecoNaGrade) {
    if (evento.button !== 0 || !evento.isPrimary || gesto.current !== null || !boneco.podeAndar || pendente === boneco.tokenId) return
    const ponto = naGrade(evento.clientX, evento.clientY)
    gesto.current = {
      pointerId: evento.pointerId,
      tokenId: boneco.tokenId,
      origem: boneco.casa,
      inicioX: evento.clientX,
      inicioY: evento.clientY,
      difX: boneco.casa.col * CASA_DA_ARENA - ponto.x,
      difY: boneco.casa.row * CASA_DA_ARENA - ponto.y,
      movido: false,
      x: evento.clientX,
      y: evento.clientY,
    }
    evento.currentTarget.setPointerCapture(evento.pointerId)
  }

  function aoMover(evento: PointerEvent<HTMLButtonElement>) {
    const vivo = gesto.current
    if (vivo === null || evento.pointerId !== vivo.pointerId) return
    if (!vivo.movido) {
      if (Math.hypot(evento.clientX - vivo.inicioX, evento.clientY - vivo.inicioY) < LIMIAR_DO_ARRASTO) return
      // Só o primeiro passo que anda levanta a ficha: o clique de mira não levanta nada.
      vivo.movido = true
      evento.currentTarget.dataset.naMao = ''
    }
    const ponto = naGrade(evento.clientX, evento.clientY)
    vivo.x = evento.clientX
    vivo.y = evento.clientY
    const naMontagem = atual.current.montagem
    naMontagem?.aoArrastar(vivo.tokenId, { x: evento.clientX, y: evento.clientY })
    // A ficha segue o ponteiro, sem sair mais que meia casa da grade.
    const x = Math.min(largura - MEIA_CASA, Math.max(-MEIA_CASA, ponto.x + vivo.difX))
    const y = Math.min(altura - MEIA_CASA, Math.max(-MEIA_CASA, ponto.y + vivo.difY))
    evento.currentTarget.style.transform = `translate(${x}px, ${y}px)`
    const alvo = casaPresaSob(x + MEIA_CASA, y + MEIA_CASA, atual.current.grade)
    const fora = naMontagem !== undefined && (ponto.x < 0 || ponto.y < 0 || ponto.x > largura || ponto.y > altura)
    const antes = alvoAtual.current
    if (antes !== null && mesmaCasa(antes.alvo, alvo) && antes.fora === fora) return
    // O destaque da casa muda só quando a casa muda (não a cada quadro do ponteiro).
    const novo: FichaNaMao = { tokenId: vivo.tokenId, origem: vivo.origem, alvo, situacao: situacaoDaCasa(atual.current.bonecos, vivo.tokenId, alvo), fora }
    alvoAtual.current = novo
    setNaMao(novo)
  }

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, boneco: BonecoNaGrade) {
    if (evento.ctrlKey || evento.metaKey || evento.shiftKey) return
    if (montagem !== undefined && (evento.key === 'Delete' || evento.key === 'Backspace')) {
      evento.preventDefault()
      if (gesto.current === null) montagem.aoTirar(boneco.tokenId)
      return
    }
    const destino = casaPelaSeta(boneco.casa, evento.key)
    if (destino === null) return
    // Toda seta numa ficha fica com a grade, mesmo a que não anda: Alt + seta para a
    // esquerda voltaria uma página no navegador e a luta, que só vive nesta tela, se perderia.
    evento.preventDefault()
    if (gesto.current !== null || pendente === boneco.tokenId) return
    if (!boneco.podeAndar) {
      if (!evento.repeat) anunciar(`${boneco.nome} não anda agora.`)
      return
    }
    if (!dentroDaGrade(destino, grade)) {
      anunciar(`${boneco.nome} está na borda da grade.`)
      return
    }
    if (situacaoDaCasa(bonecos, boneco.tokenId, destino) === 'ocupada') {
      anunciar(`A casa ${rotuloDaCasa(destino)} está ocupada.`)
      return
    }
    // Andar pelo teclado não anima: a ficha troca de casa na hora, como todo atalho.
    const botao = evento.currentTarget
    botao.dataset.semTransicao = ''
    requestAnimationFrame(() => requestAnimationFrame(() => delete botao.dataset.semTransicao))
    pedir(boneco.tokenId, boneco.casa, destino)
  }

  function aoClicar(boneco: BonecoNaGrade) {
    if (cliqueEngolido.current === boneco.tokenId) {
      cliqueEngolido.current = null
      return
    }
    onTocar?.(boneco.tokenId)
  }

  const ladoDe = new Map(bonecos.map((boneco) => [boneco.tokenId, boneco.lado]))
  const caminhos = trilhas === undefined ? [] : Object.entries(trilhas).filter(([tokenId, casas]) => casas.length > 1 && ladoDe.has(tokenId))
  const idDaDica = `${idBase}-dica`
  const idDaDicaParada = `${idBase}-dica-parada`

  return (
    <div className="lo-ga" data-caber={caber} ref={medida}>
      <div className="lo-ga-moldura" style={{ width: largura * escala, height: altura * escala }}>
        <div
          className="lo-ga-tabuleiro"
          ref={tabuleiro}
          role="group"
          aria-label={`${rotulo}, ${grade.colunas} por ${grade.linhas} casas`}
          data-mirando={mirando ? '' : undefined}
          data-alvo={naMao?.situacao}
          style={{ width: largura, height: altura, transform: `scale(${escala})` }}
        >
          <div className="lo-ga-chao" aria-hidden="true" />
          {montagem !== undefined && (
            <div className="lo-ga-metades" aria-hidden="true">
              {(['a', 'b'] as const).map((lado) => (
                <div key={lado} className="lo-ga-metade" data-lado={lado} style={{ '--lo-ga-lado': EQUIPE_DO_LADO[lado].cor } as CSSProperties}>
                  <span className="lo-ga-metade__nome">{montagem.nomesDasMetades?.[lado] ?? (lado === 'a' ? `${EQUIPE_DO_LADO.a.nome}: você joga` : `${EQUIPE_DO_LADO.b.nome}: o robô joga`)}</span>
                </div>
              ))}
            </div>
          )}
          {montagem?.realce != null && (
            <>
              <div className="lo-ga-alvo" data-situacao={montagem.realce.situacao === 'livre' ? 'livre' : 'ocupada'} style={{ transform: posicaoDaCasa(montagem.realce.casa) }} aria-hidden="true" />
              <div className="lo-ga-alvo-rotulo" data-situacao={montagem.realce.situacao === 'livre' ? 'livre' : 'ocupada'} style={{ transform: posicaoDaCasa(montagem.realce.casa) }} aria-hidden="true">
                <span className="lo-ga-alvo__texto">
                  {montagem.realce.texto ?? (montagem.realce.situacao === 'ocupada' ? 'Ocupada' : montagem.realce.situacao === 'cheio' ? 'Lado cheio' : montagem.rotuloDoAlvo(montagem.realce.casa))}
                </span>
              </div>
            </>
          )}

          {caminhos.length > 0 && (
            <svg className="lo-ga-trilhas" viewBox={`0 0 ${largura} ${altura}`} aria-hidden="true">
              {caminhos.map(([tokenId, casas]) => {
                const lado = ladoDe.get(tokenId) ?? 'a'
                const pontos = casas.map((casa) => `${(casa.col + 0.5) * CASA_DA_ARENA},${(casa.row + 0.5) * CASA_DA_ARENA}`).join(' ')
                return (
                  <g key={tokenId} style={{ '--lo-ga-lado': EQUIPE_DO_LADO[lado].cor } as CSSProperties}>
                    <polyline className="lo-ga-trilha" points={pontos} />
                    {casas.slice(0, -1).map((casa, i) => (
                      <circle key={i} className="lo-ga-trilha__passo" cx={(casa.col + 0.5) * CASA_DA_ARENA} cy={(casa.row + 0.5) * CASA_DA_ARENA} r={3.5} />
                    ))}
                  </g>
                )
              })}
            </svg>
          )}

          {naMao !== null && (
            <>
              <div className="lo-ga-origem" style={{ transform: posicaoDaCasa(naMao.origem) }} aria-hidden="true" />
              {naMao.situacao !== 'mesma' && !naMao.fora && (
                <>
                  <div className="lo-ga-alvo" data-situacao={naMao.situacao} style={{ transform: posicaoDaCasa(naMao.alvo) }} aria-hidden="true" />
                  {/* O rótulo vai por cima da ficha na mão (a casa fica por baixo dela). */}
                  <div className="lo-ga-alvo-rotulo" data-situacao={naMao.situacao} style={{ transform: posicaoDaCasa(naMao.alvo) }} aria-hidden="true">
                    <span className="lo-ga-alvo__texto">
                      {naMao.situacao === 'ocupada' ? 'Ocupada' : montagem !== undefined ? montagem.rotuloDoAlvo(naMao.alvo) : textoDeCasas(blocosEntre(naMao.origem, naMao.alvo))}
                    </span>
                  </div>
                </>
              )}
            </>
          )}

          {bonecos.map((boneco) => {
            // O Judge fica de pé com a folha animada: o disco vira só a base dele, sem retrato.
            const src = boneco.juiz === undefined ? resolver(boneco.retrato) : null
            const foto = src !== null && !semFoto.has(src) ? src : null
            const estado = [boneco.lado === 'a' ? EQUIPE_DO_LADO.a.nome : EQUIPE_DO_LADO.b.nome, `casa ${rotuloDaCasa(boneco.casa)}`, boneco.naVez ? 'na vez' : null, boneco.caiu ? 'caiu' : null]
            // Na primeira e na última coluna o nome inteiro (ao pairar ou focar) cresce para dentro da grade, não para fora.
            const borda = boneco.casa.col === 0 ? 'esquerda' : boneco.casa.col === grade.colunas - 1 ? 'direita' : undefined
            return (
              <button
                key={boneco.tokenId}
                type="button"
                className="lo-ga-boneco"
                ref={(botao) => {
                  if (botao === null) botoes.current.delete(boneco.tokenId)
                  else botoes.current.set(boneco.tokenId, botao)
                }}
                style={{ transform: posicaoDaCasa(boneco.casa), '--lo-ga-lado': EQUIPE_DO_LADO[boneco.lado].cor } as CSSProperties}
                data-lado={boneco.lado}
                data-pode={boneco.podeAndar ? '' : undefined}
                data-vez={boneco.naVez ? '' : undefined}
                data-caiu={boneco.caiu ? '' : undefined}
                data-pendente={pendente === boneco.tokenId ? '' : undefined}
                data-juiz={boneco.juiz === undefined ? undefined : ''}
                data-borda={borda}
                aria-label={`${boneco.nome}, ${estado.filter((parte) => parte !== null).join(', ')}`}
                aria-describedby={boneco.podeAndar ? idDaDica : idDaDicaParada}
                onPointerDown={(evento) => aoApertar(evento, boneco)}
                onPointerMove={aoMover}
                onPointerUp={() => terminar(true)}
                onPointerCancel={() => terminar(false)}
                onLostPointerCapture={() => terminar(false)}
                onKeyDown={(evento) => aoTeclar(evento, boneco)}
                onClick={() => aoClicar(boneco)}
              >
                {boneco.naVez && (
                  <span
                    className="lo-ga-boneco__vez"
                    aria-hidden="true"
                    // A chegada do anel acontece uma vez: a aba escondida e mostrada de novo não a repete.
                    onAnimationEnd={(evento) => {
                      evento.currentTarget.style.animation = 'none'
                    }}
                  />
                )}
                <span
                  className="lo-ga-boneco__disco"
                  aria-hidden="true"
                  ref={(disco) => {
                    if (disco === null) discos.current.delete(boneco.tokenId)
                    else discos.current.set(boneco.tokenId, disco)
                  }}
                >
                  {boneco.juiz !== undefined ? null : foto !== null ? (
                    <img className="lo-ga-boneco__foto" src={foto} alt="" draggable={false} decoding="async" onError={() => setSemFoto((antes) => new Set(antes).add(foto))} />
                  ) : (
                    <span className="lo-ga-boneco__iniciais">{iniciaisDoNome(boneco.nome)}</span>
                  )}
                </span>
                {boneco.juiz !== undefined && <JuizAnimado casa={boneco.casa} olhaPara={boneco.juiz.olhaPara} parado={boneco.caiu} />}
                {boneco.vida !== null && (
                  <span className="lo-ga-boneco__vida" data-estado={healthState(boneco.vida)} aria-hidden="true">
                    <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, boneco.vida)).toFixed(3)})` }} />
                  </span>
                )}
                <span className="lo-ga-boneco__nome" aria-hidden="true">
                  {boneco.nome}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <p id={idDaDica} className="lo-sr">
        {montagem?.dica ?? 'Arraste para andar, ou use as setas para andar uma casa. Enter escolhe a ficha.'}
      </p>
      <p id={idDaDicaParada} className="lo-sr">
        Enter escolhe a ficha.
      </p>
      <p className="lo-sr" aria-live="polite">
        {/* O mesmo aviso duas vezes seguidas também é lido: o espaço no fim alterna. */}
        {anuncio.texto}
        {anuncio.vez % 2 === 0 ? '' : ' '}
      </p>
    </div>
  )
}
