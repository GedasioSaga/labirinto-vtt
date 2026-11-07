import { useEffect, useId, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent } from 'react'
import type { RespostaDaFoto } from '../../dados/fonte'
import { useSite } from '../contexto'
import { Icone } from '../Icone'
import { inicialDe, useFotoDaConta } from '../Rosto'
import { tomDe } from '../textos'
import { caixaDoRecorte, comZoom, fotoRecortada, LADO_DO_PALCO, limitar, ORIGEM_MAX_BYTES, RECORTE_INICIAL, ZOOM_MAX, type Recorte } from './recorteDaFoto'
import './foto.css'

/**
 * A JANELA DA FOTO DE PERFIL (07/11/2026), aberta pelo menu da conta: escolher
 * uma imagem do computador (botão ou arrastar para a janela), ajustar o
 * recorte redondo (arrastar a imagem, setas, roda ou o controle de zoom) e
 * salvar; "Tirar foto" volta para a inicial. A foto vale para esta mesa.
 *
 * O erro fica dentro da janela, perto do botão, e nada do que foi escolhido
 * se perde. Enquanto envia, a janela não fecha (o Esc e o fundo esperam).
 */

interface Props {
  campanhaId: string
  nomeDaMesa: string | null
  contaId: string
  nome: string
  aoFechar(): void
}

interface Escolhida {
  endereco: string
  imagem: HTMLImageElement
  largura: number
  altura: number
}

type Enviando = 'salvar' | 'tirar' | null

/** Um passo das setas, em px do palco; com Shift, cinco. */
const PASSO_DAS_SETAS = 4
const PASSO_DO_ZOOM = 0.1

function textoDaRecusa(resposta: Exclude<RespostaDaFoto, { ok: true }>, agora: number): string {
  switch (resposta.motivo) {
    case 'grande':
      return 'A foto ficou maior que 256 KiB. Afaste o zoom ou escolha outra imagem.'
    case 'tipo':
      return 'O Lobby só aceita foto em WebP, PNG ou JPG. Escolha outra imagem.'
    case 'cheia':
      return 'As imagens desta mesa chegaram no limite. Peça ao mestre para liberar espaço.'
    case 'ritmo': {
      const segundos = Math.max(1, Math.ceil((resposta.tentarDepoisDe - agora) / 1000))
      return `Muitas trocas seguidas. Tente de novo em ${segundos} s.`
    }
    case 'sem-login':
      return 'Sua sessão terminou. Recarregue a página e entre de novo.'
    case 'fora-da-mesa':
      return 'Você não está mais nesta mesa.'
    case 'rede':
      return 'A foto não chegou ao Lobby. Confira a internet e tente de novo.'
    case 'servidor':
      return 'O Lobby não guardou a foto. Tente de novo daqui a pouco.'
  }
}

async function abrirImagem(arquivo: File): Promise<Escolhida | string> {
  if (!arquivo.type.startsWith('image/')) return 'Este arquivo não é uma imagem. Escolha um PNG, JPG ou WebP.'
  if (arquivo.size > ORIGEM_MAX_BYTES) return 'Esta imagem passa de 20 MB. Escolha uma menor.'
  const endereco = URL.createObjectURL(arquivo)
  const imagem = new Image()
  imagem.decoding = 'async'
  imagem.src = endereco
  try {
    await imagem.decode()
  } catch {
    URL.revokeObjectURL(endereco)
    return 'Não deu para abrir esta imagem. Tente outro arquivo PNG, JPG ou WebP.'
  }
  if (imagem.naturalWidth === 0 || imagem.naturalHeight === 0) {
    URL.revokeObjectURL(endereco)
    return 'Não deu para abrir esta imagem. Tente outro arquivo PNG, JPG ou WebP.'
  }
  return { endereco, imagem, largura: imagem.naturalWidth, altura: imagem.naturalHeight }
}

export function JanelaDaFoto({ campanhaId, nomeDaMesa, contaId, nome, aoFechar }: Props) {
  const site = useSite()
  const tituloId = useId()
  const textoId = useId()
  const dicaId = useId()
  const zoomId = useId()
  const janela = useRef<HTMLDialogElement>(null)
  const palco = useRef<HTMLDivElement>(null)
  const seletor = useRef<HTMLInputElement>(null)
  const fotoAtual = useFotoDaConta(contaId)
  const [escolhida, setEscolhida] = useState<Escolhida | null>(null)
  const [recorte, setRecorte] = useState<Recorte>(RECORTE_INICIAL)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState<Enviando>(null)
  const [alvo, setAlvo] = useState(false)
  const arrasto = useRef<{ ponteiro: number; x: number; y: number; inicio: Recorte } | null>(null)
  const montada = useRef(true)

  useEffect(() => {
    const elemento = janela.current
    if (elemento === null || elemento.open) return
    elemento.showModal()
    return () => elemento.close()
  }, [])

  // No StrictMode o efeito roda, desfaz e roda de novo: a volta precisa marcar de novo.
  useEffect(() => {
    montada.current = true
    return () => {
      montada.current = false
    }
  }, [])

  // A imagem escolhida vive enquanto está na janela: trocar ou fechar solta o `blob:`.
  useEffect(() => {
    if (escolhida === null) return
    return () => URL.revokeObjectURL(escolhida.endereco)
  }, [escolhida])

  // A roda aproxima e afasta sobre o palco: precisa de ouvinte não passivo para a página não rolar junto.
  useEffect(() => {
    const elemento = palco.current
    if (elemento === null || escolhida === null) return
    const aoRolar = (evento: WheelEvent) => {
      evento.preventDefault()
      const passo = evento.deltaY < 0 ? PASSO_DO_ZOOM : -PASSO_DO_ZOOM
      setRecorte((atual) => comZoom(atual, atual.zoom + passo, escolhida.largura, escolhida.altura))
    }
    elemento.addEventListener('wheel', aoRolar, { passive: false })
    return () => elemento.removeEventListener('wheel', aoRolar)
  }, [escolhida])

  function fechar(): void {
    if (enviando !== null) return
    aoFechar()
  }

  async function usarArquivo(arquivo: File | undefined): Promise<void> {
    if (arquivo === undefined || enviando !== null) return
    setErro(null)
    const aberta = await abrirImagem(arquivo)
    if (!montada.current) {
      if (typeof aberta !== 'string') URL.revokeObjectURL(aberta.endereco)
      return
    }
    if (typeof aberta === 'string') {
      setErro(aberta)
      return
    }
    setEscolhida(aberta)
    setRecorte(RECORTE_INICIAL)
    // O foco vai para o palco: as setas já movem a imagem.
    requestAnimationFrame(() => palco.current?.focus())
  }

  async function enviar(qual: Exclude<Enviando, null>): Promise<void> {
    if (enviando !== null) return
    setErro(null)
    setEnviando(qual)
    let imagem: Blob | null = null
    if (qual === 'salvar') {
      if (escolhida === null) {
        setEnviando(null)
        return
      }
      const fundo = getComputedStyle(document.body).backgroundColor
      imagem = await fotoRecortada(escolhida.imagem, recorte, fundo)
      if (imagem === null) {
        if (montada.current) {
          setEnviando(null)
          setErro('Não deu para preparar a foto neste navegador. Tente outra imagem.')
        }
        return
      }
    }
    const resposta = await site.fonte.trocarFoto(campanhaId, imagem)
    if (!montada.current) return
    setEnviando(null)
    if (resposta.ok) {
      aoFechar()
      return
    }
    setErro(textoDaRecusa(resposta, Date.now()))
  }

  function aoApertarNoPalco(evento: PointerEvent<HTMLDivElement>): void {
    if (escolhida === null || enviando !== null || !evento.isPrimary || arrasto.current !== null) return
    evento.currentTarget.setPointerCapture(evento.pointerId)
    arrasto.current = { ponteiro: evento.pointerId, x: evento.clientX, y: evento.clientY, inicio: recorte }
  }

  function aoMoverNoPalco(evento: PointerEvent<HTMLDivElement>): void {
    const atual = arrasto.current
    if (atual === null || atual.ponteiro !== evento.pointerId || escolhida === null) return
    const x = atual.inicio.x + evento.clientX - atual.x
    const y = atual.inicio.y + evento.clientY - atual.y
    setRecorte(limitar({ zoom: atual.inicio.zoom, x, y }, escolhida.largura, escolhida.altura))
  }

  function aoSoltarNoPalco(evento: PointerEvent<HTMLDivElement>): void {
    if (arrasto.current?.ponteiro === evento.pointerId) arrasto.current = null
  }

  function aoTeclarNoPalco(evento: KeyboardEvent<HTMLDivElement>): void {
    if (escolhida === null || enviando !== null) return
    const passo = evento.shiftKey ? PASSO_DAS_SETAS * 5 : PASSO_DAS_SETAS
    const mover = (dx: number, dy: number) => setRecorte((atual) => limitar({ ...atual, x: atual.x + dx, y: atual.y + dy }, escolhida.largura, escolhida.altura))
    const aproximar = (passoDoZoom: number) => setRecorte((atual) => comZoom(atual, atual.zoom + passoDoZoom, escolhida.largura, escolhida.altura))
    switch (evento.key) {
      // A seta leva a imagem junto, como o arrasto: para a direita, a imagem vai para a direita.
      case 'ArrowLeft':
        mover(-passo, 0)
        break
      case 'ArrowRight':
        mover(passo, 0)
        break
      case 'ArrowUp':
        mover(0, -passo)
        break
      case 'ArrowDown':
        mover(0, passo)
        break
      case '+':
      case '=':
        aproximar(PASSO_DO_ZOOM)
        break
      case '-':
        aproximar(-PASSO_DO_ZOOM)
        break
      default:
        return
    }
    evento.preventDefault()
  }

  function aoArrastarPorCima(evento: DragEvent<HTMLDivElement>): void {
    if (enviando !== null || !evento.dataTransfer.types.includes('Files')) return
    evento.preventDefault()
    evento.dataTransfer.dropEffect = 'copy'
    if (!alvo) setAlvo(true)
  }

  function aoSairDoArrasto(evento: DragEvent<HTMLDivElement>): void {
    // Sair para um filho não é sair da janela.
    if (evento.relatedTarget instanceof Node && evento.currentTarget.contains(evento.relatedTarget)) return
    setAlvo(false)
  }

  function aoSoltarArquivo(evento: DragEvent<HTMLDivElement>): void {
    evento.preventDefault()
    setAlvo(false)
    void usarArquivo(evento.dataTransfer.files[0])
  }

  const caixa = escolhida === null ? null : caixaDoRecorte(recorte, escolhida.largura, escolhida.altura)
  const ocupada = enviando !== null
  const mesa = nomeDaMesa === null ? 'nesta mesa' : `em ${nomeDaMesa}`

  return (
    <dialog
      ref={janela}
      className="lo-foto"
      aria-labelledby={tituloId}
      aria-describedby={textoId}
      onCancel={(evento) => {
        evento.preventDefault()
        fechar()
      }}
      onClick={(evento) => {
        // Só o fundo escurecido: o miolo cobre a caixa inteira.
        if (evento.target === evento.currentTarget) fechar()
      }}
    >
      <div className="lo-foto__miolo" data-alvo={alvo ? '1' : undefined} onDragOver={aoArrastarPorCima} onDragLeave={aoSairDoArrasto} onDrop={aoSoltarArquivo}>
        <h2 className="lo-foto__titulo" id={tituloId}>
          Sua foto
        </h2>
        <p className="lo-foto__texto" id={textoId}>
          Aparece no lugar da sua inicial {mesa}: na mesa, no chat e no mural.
        </p>

        <div className="lo-foto__corpo">
          <div
            ref={palco}
            className="lo-foto__palco"
            data-vazio={escolhida === null ? '1' : undefined}
            data-tom={tomDe(contaId)}
            style={{ width: LADO_DO_PALCO, height: LADO_DO_PALCO }}
            tabIndex={escolhida === null ? -1 : 0}
            role={escolhida === null ? undefined : 'group'}
            aria-label={escolhida === null ? undefined : 'Posição da foto'}
            aria-describedby={escolhida === null ? undefined : dicaId}
            onPointerDown={aoApertarNoPalco}
            onPointerMove={aoMoverNoPalco}
            onPointerUp={aoSoltarNoPalco}
            onPointerCancel={aoSoltarNoPalco}
            onKeyDown={aoTeclarNoPalco}
          >
            {escolhida !== null && caixa !== null ? (
              <img
                className="lo-foto__imagem"
                src={escolhida.endereco}
                alt=""
                draggable={false}
                style={{ width: caixa.largura, height: caixa.altura, transform: `translate(${caixa.esquerda}px, ${caixa.topo}px)` }}
              />
            ) : fotoAtual !== null ? (
              <img className="lo-foto__atual" src={fotoAtual} alt="" draggable={false} />
            ) : (
              <span className="lo-foto__inicial" aria-hidden="true">
                {inicialDe(nome)}
              </span>
            )}
            <span className="lo-foto__circulo" aria-hidden="true" />
          </div>

          <div className="lo-foto__lado">
            {escolhida !== null ? (
              <>
                <label className="lo-foto__zoom" htmlFor={zoomId}>
                  <span>Aproximar</span>
                  <input
                    id={zoomId}
                    type="range"
                    min={1}
                    max={ZOOM_MAX}
                    step={0.01}
                    value={recorte.zoom}
                    disabled={ocupada}
                    aria-valuetext={`${Math.round(recorte.zoom * 100)}%`}
                    onChange={(evento) => setRecorte((atual) => comZoom(atual, Number(evento.currentTarget.value), escolhida.largura, escolhida.altura))}
                  />
                </label>
                <p className="lo-motivo" id={dicaId}>
                  Arraste a imagem ou use as setas para centralizar. A roda do mouse aproxima.
                </p>
                <div className="lo-foto__previa" aria-hidden="true">
                  <span className="lo-av lo-foto__mini" data-tom={tomDe(contaId)}>
                    {caixa !== null && (
                      <img
                        src={escolhida.endereco}
                        alt=""
                        draggable={false}
                        style={(() => {
                          const mini = caixaDoRecorte(recorte, escolhida.largura, escolhida.altura, 28)
                          return { width: mini.largura, height: mini.altura, transform: `translate(${mini.esquerda}px, ${mini.topo}px)` }
                        })()}
                      />
                    )}
                  </span>
                  <span className="lo-foto__previa-nome">{nome}</span>
                </div>
                <button type="button" className="lo-btn lo-btn--fantasma lo-foto__outra" disabled={ocupada} onClick={() => seletor.current?.click()}>
                  Escolher outra imagem
                </button>
              </>
            ) : (
              <>
                <button type="button" className="lo-btn lo-btn--primario" autoFocus disabled={ocupada} onClick={() => seletor.current?.click()}>
                  <Icone nome="foto" /> Escolher imagem
                </button>
                <p className="lo-motivo">Do computador, em PNG, JPG ou WebP. Ou arraste a imagem para esta janela.</p>
              </>
            )}
            <input
              ref={seletor}
              className="lo-sr"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(evento) => {
                const arquivo = evento.currentTarget.files?.[0]
                // Limpa para escolher o mesmo arquivo de novo depois de um erro.
                evento.currentTarget.value = ''
                void usarArquivo(arquivo)
              }}
            />
          </div>
        </div>

        {erro !== null && (
          <p className="lo-foto__erro" role="alert">
            <Icone nome="alerta" />
            <span>{erro}</span>
          </p>
        )}

        <div className="lo-foto__acoes">
          {fotoAtual !== null && (
            <button type="button" className="lo-btn lo-btn--fantasma lo-foto__tirar" disabled={ocupada} onClick={() => void enviar('tirar')}>
              {enviando === 'tirar' ? <span className="lo-giro" aria-hidden="true" /> : <Icone nome="tirar" />}
              {enviando === 'tirar' ? 'Tirando…' : 'Tirar foto'}
            </button>
          )}
          <span className="lo-foto__vao" />
          <button type="button" className="lo-btn" disabled={ocupada} onClick={fechar}>
            Cancelar
          </button>
          <button type="button" className="lo-btn lo-btn--primario" disabled={escolhida === null || ocupada} onClick={() => void enviar('salvar')}>
            {enviando === 'salvar' && <span className="lo-giro" aria-hidden="true" />}
            {enviando === 'salvar' ? 'Salvando…' : 'Salvar foto'}
          </button>
        </div>
      </div>
    </dialog>
  )
}
