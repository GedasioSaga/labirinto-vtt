import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import type { TexturaImportada } from '../types/map'
import { FORCA_MAX, FORCA_MIN, TAMANHO_DO_PINCEL_MAX, TAMANHO_DO_PINCEL_MIN, type ModoDaTextura } from '../lib/texturas'
import { escolherImagemDeTextura, ladrilhoDaImagem, nomeDoArquivo } from '../lib/texturaImportada'
import { ImagePickerUnavailableError } from '../lib/imageImport'
import { assinarTexturas, listarTexturas, type TexturaDoCatalogo } from '../texturas/catalogo'
import { FATIA_DO_LADRILHO_MS, LADO_DA_MINIATURA, pixelsEmFatias } from '../texturas/ladrilhos'
import { mapaDoPiso } from '../lib/pisos'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { PinImageDrop } from './PinImageDrop'
import { BotaoProcurarAnimacoes } from './ProcurarAnimacoes'
import './TexturasControls.css'

const MODOS: Array<{ modo: ModoDaTextura; rotulo: string; dica: string }> = [
  { modo: 'pincel', rotulo: 'Pincel', dica: 'Arraste por cima do mapa para pintar a textura. Segure Alt para apagar.' },
  { modo: 'balde', rotulo: 'Balde', dica: 'Clique numa região ou num desenho pintado: a textura enche a parte dele que está à vista.' },
  { modo: 'borracha', rotulo: 'Borracha', dica: 'Arraste por cima de uma textura para tirá-la. O desenho de baixo volta a aparecer.' },
]

// ---------------------------------------------------------------------------
// Miniaturas: geradas uma por vez, cada uma em fatias, e guardadas.

const miniaturas = new Map<string, Uint8ClampedArray>()
let filaDeMiniaturas: Promise<void> = Promise.resolve()
/** 2×2 amostras por pixel: a borda da copa não serrilha no tamanho pequeno. */
const AMOSTRAS_DA_MINIATURA = 2
/**
 * Quanto do mundo a miniatura mostra, no máximo (em px do protótipo do
 * relevo, o metro da `escala`). As de ladrilho grande (Bosque, Pântano, Terra)
 * mostram só um pedaço dele: inteiro, a árvore e a poça saíam miúdas ao lado
 * das outras miniaturas.
 */
const ESCALA_DA_MINIATURA = 64

function corDaMiniatura(textura: TexturaDoCatalogo): TexturaDoCatalogo['cor'] {
  const parte = Math.min(1, ESCALA_DA_MINIATURA / textura.escala)
  return parte === 1 ? textura.cor : (u, v) => textura.cor(u * parte, v * parte)
}

function miniaturaDe(textura: TexturaDoCatalogo): Promise<Uint8ClampedArray | null> {
  const chave = `${textura.origem}:${textura.id}`
  const pronta = miniaturas.get(chave)
  if (pronta !== undefined) return Promise.resolve(pronta)
  // Uma por vez e em fatias de poucos ms: a miniatura da Serra inteira custava
  // ~170 ms numa tarefa só, e abrir o painel somava ~750 ms de travadas.
  const vez = filaDeMiniaturas.then(async () => {
    const ja = miniaturas.get(chave)
    if (ja !== undefined) return ja
    const dados = await pixelsEmFatias(corDaMiniatura(textura), LADO_DA_MINIATURA, () => false, FATIA_DO_LADRILHO_MS, AMOSTRAS_DA_MINIATURA)
    // Cor de um pacote que lança: sem miniatura (o quadro fica vazio), e a fila segue.
    if (dados !== null) miniaturas.set(chave, dados)
    return dados
  })
  filaDeMiniaturas = vez.then(() => undefined)
  return vez
}

function MiniaturaDoCatalogo({ textura }: { textura: TexturaDoCatalogo }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let vivo = true
    void miniaturaDe(textura).then((dados) => {
      if (!vivo || dados === null) return
      const g = ref.current?.getContext('2d')
      if (g) g.putImageData(new ImageData(new Uint8ClampedArray(dados), LADO_DA_MINIATURA, LADO_DA_MINIATURA), 0, 0)
    })
    return () => {
      vivo = false
    }
  }, [textura])
  return <canvas ref={ref} className="lb-texturas__miniatura" width={LADO_DA_MINIATURA} height={LADO_DA_MINIATURA} aria-hidden="true" />
}

// ---------------------------------------------------------------------------

interface ItemDaBiblioteca {
  id: string
  nome: string
  catalogo?: TexturaDoCatalogo
  importada?: TexturaImportada
}

const SEM_IMPORTADAS: readonly TexturaImportada[] = []

/** As colunas da grade (o CSS usa as mesmas três): as setas sobem e descem de três em três. */
const COLUNAS = 3

/**
 * Painel da ferramenta Texturas (`lib/texturas.ts`): o que o PRÓXIMO gesto faz
 * (Pincel | Balde | Borracha), a BIBLIOTECA em miniaturas (as embutidas, as
 * do pacote e as que o mestre importou), importar uma imagem, o tamanho do
 * pincel e a força.
 *
 * Lê e escreve a store direto (como `PenhascoControls`): são preferências da
 * ferramenta e as texturas da cena aberta, sem nada para o App repassar. O que
 * não serve ao modo escolhido não aparece (a borracha não tem textura; o balde
 * não tem tamanho), para nenhum controle ficar na tela sem efeito.
 */
export function TexturasControls() {
  const modo = useMapStore((s) => s.texturaModo)
  const setModo = useMapStore((s) => s.setTexturaModo)
  const escolhida = useMapStore((s) => s.texturaEscolhida)
  const setEscolhida = useMapStore((s) => s.setTexturaEscolhida)
  const tamanho = useMapStore((s) => s.texturaTamanho)
  const setTamanho = useMapStore((s) => s.setTexturaTamanho)
  const forca = useMapStore((s) => s.texturaForca)
  const setForca = useMapStore((s) => s.setTexturaForca)
  const importadas = useMapStore((s) => s.map.texturasImportadas ?? SEM_IMPORTADAS)
  // PISOS: "apagar todas" só alcança o piso em edição; o botão aparece pelo mesmo recorte.
  const temTextura = useMapStore((s) => (mapaDoPiso(s.map, s.pisoAtivo).texturas?.length ?? 0) > 0)
  const importar = useMapStore((s) => s.importarTextura)
  const remover = useMapStore((s) => s.removerTexturaImportada)
  const apagarTodas = useMapStore((s) => s.apagarTodasAsTexturas)
  const catalogo = useSyncExternalStore(assinarTexturas, listarTexturas)
  const [importando, setImportando] = useState(false)
  const grade = useRef<HTMLDivElement>(null)

  const itens: ItemDaBiblioteca[] = [
    ...catalogo.map((t) => ({ id: t.id, nome: t.nome, catalogo: t })),
    ...importadas.map((t) => ({ id: t.id, nome: t.nome, importada: t })),
  ]
  const indiceEscolhido = itens.findIndex((item) => item.id === escolhida)
  const importadaEscolhida = importadas.find((t) => t.id === escolhida)
  const dicaDoModo = MODOS.find((m) => m.modo === modo)?.dica ?? ''

  const avisar = (erro: unknown) => {
    const texto = erro instanceof Error ? erro.message : 'não deu para importar essa imagem'
    useToastStore.getState().push('error', `Textura não importada: ${texto}`)
  }

  const receberImagem = async (blob: Blob) => {
    setImportando(true)
    try {
      const imagem = await ladrilhoDaImagem(blob)
      importar(blob instanceof File ? nomeDoArquivo(blob.name) : 'Textura importada', imagem)
    } catch (erro) {
      avisar(erro)
    } finally {
      setImportando(false)
    }
  }

  const escolherDoDisco = async () => {
    setImportando(true)
    try {
      const escolha = await escolherImagemDeTextura()
      if (escolha !== null) importar(escolha.nome, escolha.imagem)
    } catch (erro) {
      if (erro instanceof ImagePickerUnavailableError) useToastStore.getState().push('instrucao', erro.message)
      else avisar(erro)
    } finally {
      setImportando(false)
    }
  }

  /** Setas andam pela grade (três por linha), Home e End vão às pontas: o grupo de rádio de sempre. */
  const navegar = (evento: KeyboardEvent<HTMLDivElement>) => {
    const atual = indiceEscolhido < 0 ? 0 : indiceEscolhido
    const passo: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUNAS, ArrowUp: -COLUNAS }
    let proximo: number | null = null
    if (evento.key in passo) proximo = Math.min(itens.length - 1, Math.max(0, atual + passo[evento.key]))
    else if (evento.key === 'Home') proximo = 0
    else if (evento.key === 'End') proximo = itens.length - 1
    if (proximo === null) return
    evento.preventDefault()
    setEscolhida(itens[proximo].id)
    grade.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[proximo]?.focus()
  }

  return (
    <section className="lb-section lb-texturas">
      <h2 className="lb-eyebrow">Ao pintar</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Ao pintar">
        {MODOS.map((opcao) => (
          <button
            key={opcao.modo}
            type="button"
            role="radio"
            aria-checked={modo === opcao.modo}
            className="lb-seg__option"
            onClick={() => setModo(opcao.modo)}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
      <p className="lb-field__hint">{dicaDoModo}</p>

      {modo !== 'borracha' && (
        <>
          <h2 className="lb-eyebrow">Textura</h2>
          <div ref={grade} className="lb-texturas__grade" role="radiogroup" aria-label="Textura" onKeyDown={navegar}>
            {itens.map((item, i) => {
              const marcada = item.id === escolhida
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={marcada}
                  // Um só ponto de parada do Tab no grupo; as setas andam dentro dele.
                  tabIndex={marcada || (indiceEscolhido < 0 && i === 0) ? 0 : -1}
                  className="lb-texturas__opcao"
                  title={item.nome}
                  onClick={() => setEscolhida(item.id)}
                >
                  {item.catalogo !== undefined ? (
                    <MiniaturaDoCatalogo textura={item.catalogo} />
                  ) : (
                    <img className="lb-texturas__miniatura" src={item.importada?.imagem} alt="" draggable={false} />
                  )}
                  <span className="lb-texturas__nome">{item.nome}</span>
                </button>
              )
            })}
          </div>
          {importadaEscolhida !== undefined && (
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => remover(importadaEscolhida.id)}>
              Remover “{importadaEscolhida.nome}”
            </button>
          )}
          <h2 className="lb-eyebrow">Importar textura</h2>
          <PinImageDrop onImage={(blob) => void receberImagem(blob)} rotulo="Colar ou soltar a imagem da nova textura" />
          {isTauri() && (
            <button type="button" className="lb-btn lb-btn--block" disabled={importando} onClick={() => void escolherDoDisco()}>
              {importando ? 'Importando…' : 'Escolher imagem…'}
            </button>
          )}
          {importando && !isTauri() && (
            <p className="lb-field__hint" role="status">
              Importando…
            </p>
          )}
          <p className="lb-field__hint">A imagem vira um ladrilho que se repete sem emenda. Texturas novas também chegam pelo pacote de animações.</p>
          <BotaoProcurarAnimacoes rotulo="Procurar texturas novas" />
        </>
      )}

      {modo !== 'balde' && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-textura-tamanho">
              Tamanho do pincel
            </label>
            <span className="lb-num">{tamanho}</span>
          </div>
          <input
            id="lb-textura-tamanho"
            className="lb-range"
            type="range"
            min={TAMANHO_DO_PINCEL_MIN}
            max={TAMANHO_DO_PINCEL_MAX}
            step={2}
            value={tamanho}
            onChange={(event) => setTamanho(Number(event.target.value))}
          />
        </div>
      )}
      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-textura-forca">
            Força
          </label>
          <span className="lb-num">{Math.round(forca * 100)}%</span>
        </div>
        <input
          id="lb-textura-forca"
          className="lb-range"
          type="range"
          min={FORCA_MIN}
          max={FORCA_MAX}
          step={0.05}
          value={forca}
          onChange={(event) => setForca(Number(event.target.value))}
        />
      </div>
      {temTextura && (
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={apagarTodas}>
          Apagar todas as texturas
        </button>
      )}
    </section>
  )
}
