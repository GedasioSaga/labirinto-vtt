import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import type { CarimboImportado } from '../types/map'
import {
  DENSIDADE_MAX,
  DENSIDADE_MIN,
  LARGURA_DO_SPRAY_MAX,
  LARGURA_DO_SPRAY_MIN,
  TAMANHO_DO_CARIMBO_MAX,
  TAMANHO_DO_CARIMBO_MIN,
  type ModoDoCarimbo,
} from '../lib/carimbos'
import { escolherImagemDeCarimbo, imagemDoCarimbo, nomeDoArquivoDoCarimbo } from '../lib/carimboImportado'
import { ImagePickerUnavailableError } from '../lib/imageImport'
import { assinarCarimbos, listarCarimbos, type CarimboDoCatalogo } from '../carimbos/catalogo'
import { assarDesenho, assarImagem, miniaturaDaArte } from '../carimbos/arte'
import { useMapStore } from '../stores/mapStore'
import { useToastStore } from '../stores/toastStore'
import { PinImageDrop } from './PinImageDrop'
import { BotaoProcurarAnimacoes } from './ProcurarAnimacoes'
import './CarimbosControls.css'

const MODOS: Array<{ modo: ModoDoCarimbo; rotulo: string; dica: string }> = [
  {
    modo: 'carimbo',
    rotulo: 'Carimbo',
    dica: 'Clique para soltar um. Segure e arraste para espalhar vários; começando na terra, o spray fica na terra. Segure Alt para apagar.',
  },
  { modo: 'borracha', rotulo: 'Borracha', dica: 'Clique ou arraste por cima dos objetos para tirá-los. O que vai sair fica apagado até você soltar.' },
]

// ---------------------------------------------------------------------------
// Miniaturas: o objeto no chão, com a sombra, como vai ficar no mapa. Feitas
// uma vez por desenho e guardadas.

/** Lado da miniatura em px de CSS; a tela tem o dobro (nítida em tela de alta densidade). */
const LADO_DA_MINIATURA = 64
const LADO_DA_TELA_DA_MINIATURA = LADO_DA_MINIATURA * 2
/** O desenho usado na miniatura: o de 45°, que mostra a luz e a sombra bem. */
const VARIANTE_DA_MINIATURA = 1

/** Pela referência do carimbo: o do pacote que chega de novo (desenho novo) é outro objeto, e ganha miniatura nova. */
const miniaturas = new WeakMap<object, Promise<HTMLCanvasElement | null>>()

function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolver) => {
    const img = new Image()
    img.onload = () => resolver(img)
    img.onerror = () => resolver(null)
    img.src = src
  })
}

function miniaturaDe(item: ItemDaBiblioteca): Promise<HTMLCanvasElement | null> {
  const chave = item.catalogo ?? item.importado
  if (chave === undefined) return Promise.resolve(null)
  const pronta = miniaturas.get(chave)
  if (pronta !== undefined) return pronta
  const feita = (async () => {
    if (item.catalogo !== undefined) {
      const arte = assarDesenho(item.catalogo.desenhar, item.catalogo.sombra, (VARIANTE_DA_MINIATURA * Math.PI) / 4, VARIANTE_DA_MINIATURA, LADO_DA_TELA_DA_MINIATURA)
      return arte === null ? null : miniaturaDaArte(arte, LADO_DA_TELA_DA_MINIATURA)
    }
    const img = item.importado === undefined ? null : await carregarImagem(item.importado.imagem)
    if (img === null) return null
    const arte = assarImagem(img, img.naturalWidth, img.naturalHeight, LADO_DA_TELA_DA_MINIATURA)
    return arte === null ? null : miniaturaDaArte(arte, LADO_DA_TELA_DA_MINIATURA)
  })()
  miniaturas.set(chave, feita)
  return feita
}

function Miniatura({ item }: { item: ItemDaBiblioteca }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { id, catalogo, importado } = item
  useEffect(() => {
    let vivo = true
    void miniaturaDe({ id, nome: '', catalogo, importado }).then((tela) => {
      const g = ref.current?.getContext('2d')
      if (!vivo || tela === null || !g) return
      g.clearRect(0, 0, LADO_DA_TELA_DA_MINIATURA, LADO_DA_TELA_DA_MINIATURA)
      g.drawImage(tela, 0, 0)
    })
    return () => {
      vivo = false
    }
    // O item é refeito a cada render; o que importa são o id e as referências estáveis do catálogo e do mapa.
  }, [id, catalogo, importado])
  return <canvas ref={ref} className="lb-carimbos__miniatura" width={LADO_DA_TELA_DA_MINIATURA} height={LADO_DA_TELA_DA_MINIATURA} aria-hidden="true" />
}

// ---------------------------------------------------------------------------

interface ItemDaBiblioteca {
  id: string
  nome: string
  catalogo?: CarimboDoCatalogo
  importado?: CarimboImportado
}

const SEM_IMPORTADOS: readonly CarimboImportado[] = []

/** As colunas da grade (o CSS usa as mesmas três): as setas sobem e descem de três em três. */
const COLUNAS = 3

/**
 * Painel da ferramenta Carimbos (`lib/carimbos.ts`): o que o PRÓXIMO gesto
 * faz (Carimbo | Borracha), a BIBLIOTECA em miniaturas (os embutidos, os do
 * pacote e os que o mestre importou), importar uma imagem, o tamanho do
 * objeto, a largura do spray e a densidade.
 *
 * Lê e escreve a store direto (como `TexturasControls`). O que não serve ao
 * modo escolhido não aparece (a borracha não tem objeto, tamanho nem
 * densidade), para nenhum controle ficar na tela sem efeito.
 */
export function CarimbosControls() {
  const modo = useMapStore((s) => s.carimboModo)
  const setModo = useMapStore((s) => s.setCarimboModo)
  const escolhido = useMapStore((s) => s.carimboEscolhido)
  const setEscolhido = useMapStore((s) => s.setCarimboEscolhido)
  const tamanho = useMapStore((s) => s.carimboTamanho)
  const setTamanho = useMapStore((s) => s.setCarimboTamanho)
  const largura = useMapStore((s) => s.carimboLargura)
  const setLargura = useMapStore((s) => s.setCarimboLargura)
  const densidade = useMapStore((s) => s.carimboDensidade)
  const setDensidade = useMapStore((s) => s.setCarimboDensidade)
  const importados = useMapStore((s) => s.map.carimbosImportados ?? SEM_IMPORTADOS)
  const quantos = useMapStore((s) => s.map.carimbos?.length ?? 0)
  const importar = useMapStore((s) => s.importarCarimbo)
  const remover = useMapStore((s) => s.removerCarimboImportado)
  const apagarTodos = useMapStore((s) => s.apagarTodosOsCarimbos)
  const catalogo = useSyncExternalStore(assinarCarimbos, listarCarimbos)
  const [importando, setImportando] = useState(false)
  const grade = useRef<HTMLDivElement>(null)

  const itens: ItemDaBiblioteca[] = [
    ...catalogo.map((c) => ({ id: c.id, nome: c.nome, catalogo: c })),
    ...importados.map((c) => ({ id: c.id, nome: c.nome, importado: c })),
  ]
  const indiceEscolhido = itens.findIndex((item) => item.id === escolhido)
  const importadoEscolhido = importados.find((c) => c.id === escolhido)
  const dicaDoModo = MODOS.find((m) => m.modo === modo)?.dica ?? ''

  const avisar = (erro: unknown) => {
    const texto = erro instanceof Error ? erro.message : 'não deu para importar essa imagem'
    useToastStore.getState().push('error', `Carimbo não importado: ${texto}`)
  }

  const receberImagem = async (blob: Blob) => {
    setImportando(true)
    try {
      const imagem = await imagemDoCarimbo(blob)
      importar(blob instanceof File ? nomeDoArquivoDoCarimbo(blob.name) : 'Carimbo importado', imagem)
    } catch (erro) {
      avisar(erro)
    } finally {
      setImportando(false)
    }
  }

  const escolherDoDisco = async () => {
    setImportando(true)
    try {
      const escolha = await escolherImagemDeCarimbo()
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
    setEscolhido(itens[proximo].id)
    grade.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[proximo]?.focus()
  }

  return (
    <section className="lb-section lb-carimbos">
      <h2 className="lb-eyebrow">Ao clicar</h2>
      <div className="lb-seg" role="radiogroup" aria-label="Ao clicar">
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

      {modo === 'carimbo' && (
        <>
          <h2 className="lb-eyebrow">Objeto</h2>
          <div ref={grade} className="lb-carimbos__grade" role="radiogroup" aria-label="Objeto" onKeyDown={navegar}>
            {itens.map((item, i) => {
              const marcado = item.id === escolhido
              return (
                <button
                  key={item.id}
                  type="button"
                  role="radio"
                  aria-checked={marcado}
                  // Um só ponto de parada do Tab no grupo; as setas andam dentro dele.
                  tabIndex={marcado || (indiceEscolhido < 0 && i === 0) ? 0 : -1}
                  className="lb-carimbos__opcao"
                  title={item.nome}
                  onClick={() => setEscolhido(item.id)}
                >
                  <Miniatura item={item} />
                  <span className="lb-carimbos__nome">{item.nome}</span>
                </button>
              )
            })}
          </div>
          {importadoEscolhido !== undefined && (
            <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => remover(importadoEscolhido.id)}>
              Remover “{importadoEscolhido.nome}”
            </button>
          )}
          <h2 className="lb-eyebrow">Importar carimbo</h2>
          <PinImageDrop onImage={(blob) => void receberImagem(blob)} rotulo="Colar ou soltar a imagem do novo carimbo" />
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
          <p className="lb-field__hint">Uma imagem com fundo transparente (PNG) vira um objeto com sombra. Carimbos novos também chegam pelo pacote de animações.</p>
          <BotaoProcurarAnimacoes rotulo="Procurar carimbos novos" />

          <div className="lb-field">
            <div className="lb-section__row">
              <label className="lb-label" htmlFor="lb-carimbo-tamanho">
                Tamanho
              </label>
              <span className="lb-num">{tamanho}%</span>
            </div>
            <input
              id="lb-carimbo-tamanho"
              className="lb-range"
              type="range"
              min={TAMANHO_DO_CARIMBO_MIN}
              max={TAMANHO_DO_CARIMBO_MAX}
              step={5}
              value={tamanho}
              onChange={(event) => setTamanho(Number(event.target.value))}
            />
          </div>
        </>
      )}

      <div className="lb-field">
        <div className="lb-section__row">
          <label className="lb-label" htmlFor="lb-carimbo-largura">
            {modo === 'borracha' ? 'Largura da borracha' : 'Largura do spray'}
          </label>
          <span className="lb-num">{largura}</span>
        </div>
        <input
          id="lb-carimbo-largura"
          className="lb-range"
          type="range"
          min={LARGURA_DO_SPRAY_MIN}
          max={LARGURA_DO_SPRAY_MAX}
          step={2}
          value={largura}
          onChange={(event) => setLargura(Number(event.target.value))}
        />
      </div>
      {modo === 'carimbo' && (
        <div className="lb-field">
          <div className="lb-section__row">
            <label className="lb-label" htmlFor="lb-carimbo-densidade">
              Densidade do spray
            </label>
            <span className="lb-num">{Math.round(densidade * 100)}%</span>
          </div>
          <input
            id="lb-carimbo-densidade"
            className="lb-range"
            type="range"
            min={DENSIDADE_MIN}
            max={DENSIDADE_MAX}
            step={0.05}
            value={densidade}
            onChange={(event) => setDensidade(Number(event.target.value))}
          />
        </div>
      )}
      {quantos > 0 && (
        <>
          <p className="lb-field__hint" role="status">
            {quantos === 1 ? '1 objeto nesta cena' : `${quantos.toLocaleString('pt-BR')} objetos nesta cena`}
          </p>
          <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={apagarTodos}>
            Apagar todos os objetos
          </button>
        </>
      )}
    </section>
  )
}
