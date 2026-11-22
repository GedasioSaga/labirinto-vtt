import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { categoriaLimpa, ehCategoriaDeMunicao, ITEM_SEM_NOME, MUNICOES_POR_ARMA_MAX, type ItemDoCatalogo } from '../lib/acervoDeItens'
import { useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import { chaveDoNomeDaEntrada, novoIdDeEntrada, regraDaCoisa, type ItemDoCatalogo as EntradaDoCatalogo } from '../lib/livros/catalogo'
import type { MecanicaGuardada } from '../lib/personagem'
import { gravarRegraDaArma } from '../stores/armasNaFonte'
import { useCatalogoStore } from '../stores/catalogoStore'
import { sistemaPorId, useRpgStore } from '../stores/rpgStore'
import { CAMPO_DO_EFEITO } from '../lib/batalha/leituraDaFicha'
import { EfeitoDaArmaCampos } from './EfeitoDaArmaCampos'
import { cleanItemName, ITEM_DESCRICAO_MAX, ITEM_NAME_MAX_LENGTH, ITEM_PRECO_MAX, ITEM_QUANTIDADE_MAX } from '../lib/items'
import type { AlvoDoAcervo } from '../lib/party'
import { ALCANCE_DA_LUZ_DO_ITEM_MAX, ALCANCE_DA_LUZ_DO_ITEM_MIN, CORES_SUGERIDAS_DA_LUZ_DO_ITEM, FORCA_DA_LUZ_DO_ITEM_MAX, FORCA_DA_LUZ_DO_ITEM_MIN, LUZ_DO_ITEM_PADRAO } from '../lib/luzDoItem'
import type { LuzDoItem } from '../types/map'
import { comEfeito, EfeitoDoItemCampos } from './EfeitoDoItemCampos'
import { ImagemOuIniciais } from './FichaPecas'
import { CloseIcon } from './icons'
import { PinImageDrop } from './PinImageDrop'

/**
 * A janela de UM item do acervo de itens: editar (imagem, nome, categoria,
 * descrição, preço, empilhável) e "Dar a…" um personagem. A imagem chega
 * pelos três caminhos da do token: colar, soltar arrastando ou escolher no
 * computador — todos gravam a mídia e devolvem a referência (`imagemDoItem.ts`).
 *
 * O "Dar" entrega o item COMO ESTÁ GRAVADO: com mudança por salvar ele espera,
 * para o personagem não receber uma poção que o acervo não tem.
 */

export interface ItemDoCatalogoDialogProps {
  item: ItemDoCatalogo
  /** Item que ainda não está no acervo: sem "Apagar" nem "Dar", e o Salvar cria. */
  novo: boolean
  categorias: readonly string[]
  alvos: readonly AlvoDoAcervo[]
  onSalvar: (item: ItemDoCatalogo) => Promise<void>
  onApagar: () => Promise<void>
  /**
   * `false` = não deu (o token saiu da cena). Sem ele a janela não mostra o
   * "Dar a…": a página Itens do livro já põe na mochila pelo "Pôr em".
   */
  onDar?: (alvo: AlvoDoAcervo, quantidade: number) => boolean
  onClose: () => void
  /** Colar ou soltar: grava a imagem e devolve a referência. */
  imagemDoBlob: (fonte: Blob) => Promise<string>
  /** "Escolher imagem…": `null` = cancelou. */
  escolherImagem: () => Promise<string | null>
}

const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function mensagemDe(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** O preço digitado: vazio = sem preço; o resto, inteiro dentro do teto ou `undefined` (inválido). */
function precoDoTexto(texto: string): number | null | undefined {
  const limpo = texto.trim()
  if (limpo === '') return null
  if (!/^\d+$/.test(limpo)) return undefined
  const valor = Number(limpo)
  return Number.isSafeInteger(valor) && valor <= ITEM_PRECO_MAX ? valor : undefined
}

/**
 * A REGRA da arma no livro aberto (ARMAS-FONTE-UNICA §3): a entrada de arma ligada à coisa; senão a única
 * entrada de arma solta com o mesmo nome (`ligar`: o Salvar liga as duas). `undefined` = sem regra neste livro.
 */
function regraDaArmaNoLivro(catalogo: readonly EntradaDoCatalogo[], coisa: { id: string; nome: string }): { entrada: EntradaDoCatalogo; ligar: boolean } | undefined {
  const ligada = regraDaCoisa(catalogo, coisa.id)
  if (ligada !== undefined) return ligada.tipo === 'arma' ? { entrada: ligada, ligar: false } : undefined
  const chave = chaveDoNomeDaEntrada(coisa.nome)
  const soltas = catalogo.filter((entrada) => entrada.tipo === 'arma' && entrada.acervoId === undefined && chaveDoNomeDaEntrada(entrada.nome) === chave)
  return soltas.length === 1 ? { entrada: soltas[0], ligar: true } : undefined
}

/** A categoria das armas do Acervo ("Arma", "armas"), a mesma que a batalha lê da mochila. */
function ehCategoriaDeArma(categoria: string): boolean {
  return /^armas?$/.test(categoria.trim().toLowerCase())
}

/** O item com a lista de munições; vazia tira o campo (ausente = a arma não declara). */
function comMunicoes(item: ItemDoCatalogo, municoes: readonly string[]): ItemDoCatalogo {
  const { municoes: _antes, ...semMunicoes } = item
  return municoes.length === 0 ? semMunicoes : { ...semMunicoes, municoes: [...municoes] }
}

/**
 * MUNIÇÃO (pedido de 16/11/2026: "cada arma pode usar certos de munição"):
 * as munições do Acervo que esta arma aceita. Na batalha, cada marcada vira
 * uma bala da arma, com a quantidade da mochila de quem atira.
 */
function MunicoesDaArma({ armaId, escolhidas, onMudar }: { armaId: string; escolhidas: readonly string[]; onMudar: (municoes: readonly string[]) => void }) {
  const municoes = useAcervoDeItensStore((state) => state.itens).filter((candidato) => candidato.id !== armaId && ehCategoriaDeMunicao(candidato.categoria))
  const marcar = (id: string, marcada: boolean) => onMudar(marcada ? [...escolhidas, id].slice(0, MUNICOES_POR_ARMA_MAX) : escolhidas.filter((escolhida) => escolhida !== id))
  return (
    <fieldset className="lb-item-janela__municoes">
      <legend className="lb-label">Munições que a arma usa</legend>
      {municoes.length === 0 ? (
        <p className="lb-field__hint">Crie itens na categoria Munição (Balas, Balas de prata, Bala de RPG…) para escolher aqui.</p>
      ) : (
        municoes.map((municao) => (
          <label key={municao.id} className="lb-item-janela__marca">
            <input type="checkbox" checked={escolhidas.includes(municao.id)} onChange={(event) => marcar(municao.id, event.target.checked)} />
            <span>{municao.nome}</span>
          </label>
        ))
      )}
    </fieldset>
  )
}

/** O item com a luz; `undefined` tira o campo (ausente = não ilumina). */
function comLuz(item: ItemDoCatalogo, luz: LuzDoItem | undefined): ItemDoCatalogo {
  const { luz: _antes, ...semLuz } = item
  return luz === undefined ? semLuz : { ...semLuz, luz }
}

/** Força em porcentagem inteira, para o controle e para ler ("80%"). */
function porcento(forca: number): number {
  return Math.round(forca * 100)
}

/** "2,5 casas", "1 casa". */
function textoDoAlcance(casas: number): string {
  return `${String(casas).replace('.', ',')} ${casas === 1 ? 'casa' : 'casas'}`
}

/**
 * ITEM QUE ILUMINA (pedido de 18/11/2026): liga a luz do item e escolhe o
 * tom, o alcance, a força e o "crepita como fogo". Desligar e ligar de novo
 * volta com a luz de antes (a da janela aberta), não com a padrão.
 */
function LuzDoItemCampos({ idBase, luz, onMudar }: { idBase: string; luz: LuzDoItem | undefined; onMudar: (luz: LuzDoItem | undefined) => void }) {
  const ultima = useRef<LuzDoItem>(luz ?? LUZ_DO_ITEM_PADRAO)
  if (luz !== undefined) ultima.current = luz
  const mudar = (parte: Partial<LuzDoItem>) => {
    if (luz === undefined) return
    // `crepita` só existe ligado: desmarcar tira o campo.
    const crepita = 'crepita' in parte ? parte.crepita === true : luz.crepita === true
    const { crepita: _crepita, ...base } = { ...luz, ...parte }
    onMudar(crepita ? { ...base, crepita: true } : base)
  }
  return (
    <fieldset className="lb-item-janela__luz">
      <legend className="lb-label">Luz</legend>
      <label className="lb-item-janela__marca">
        <input type="checkbox" checked={luz !== undefined} onChange={(event) => onMudar(event.target.checked ? ultima.current : undefined)} />
        <span>Ilumina — no chão clareia em volta; na mochila, quando estiver aceso</span>
      </label>
      {luz !== undefined && (
        <>
          {/* Botões que ficam apertados (não `radio`): o Tab passa por cada tom, sem o teclado de setas que o radio promete. */}
          <div className="lb-item-janela__cores" role="group" aria-label="Cor da luz">
            {CORES_SUGERIDAS_DA_LUZ_DO_ITEM.map((sugerida) => (
              <button
                key={sugerida.cor}
                type="button"
                aria-pressed={luz.cor === sugerida.cor}
                className="lb-item-janela__cor"
                title={sugerida.nome}
                aria-label={sugerida.nome}
                style={{ background: sugerida.cor }}
                onClick={() => mudar({ cor: sugerida.cor })}
              />
            ))}
            <label className="lb-item-janela__cor-livre" title="Outra cor">
              <input type="color" aria-label="Outra cor da luz" value={luz.cor} onChange={(event) => mudar({ cor: event.target.value.toLowerCase() })} />
            </label>
          </div>
          <div className="lb-item-janela__linha">
            <label className="lb-field" htmlFor={`${idBase}-alcance`}>
              <span className="lb-label">
                Alcance <output htmlFor={`${idBase}-alcance`}>{textoDoAlcance(luz.alcanceEmCasas)}</output>
              </span>
              <input
                id={`${idBase}-alcance`}
                type="range"
                min={ALCANCE_DA_LUZ_DO_ITEM_MIN}
                max={ALCANCE_DA_LUZ_DO_ITEM_MAX}
                step={0.5}
                value={luz.alcanceEmCasas}
                onChange={(event) => mudar({ alcanceEmCasas: Number(event.target.value) })}
              />
            </label>
            <label className="lb-field" htmlFor={`${idBase}-forca`}>
              <span className="lb-label">
                Força <output htmlFor={`${idBase}-forca`}>{porcento(luz.forca)}%</output>
              </span>
              <input
                id={`${idBase}-forca`}
                type="range"
                min={porcento(FORCA_DA_LUZ_DO_ITEM_MIN)}
                max={porcento(FORCA_DA_LUZ_DO_ITEM_MAX)}
                step={5}
                value={porcento(luz.forca)}
                onChange={(event) => mudar({ forca: Number(event.target.value) / 100 })}
              />
            </label>
          </div>
          <label className="lb-item-janela__marca">
            <input type="checkbox" checked={luz.crepita === true} onChange={(event) => mudar({ crepita: event.target.checked ? true : undefined })} />
            <span>Crepita como fogo — o claro treme</span>
          </label>
          <p className="lb-field__hint">Tons claros iluminam melhor: cor forte escurece o chão em volta.</p>
        </>
      )}
    </fieldset>
  )
}

function chaveDoAlvo(alvo: Pick<AlvoDoAcervo, 'tokenId' | 'sceneId'>): string {
  return `${alvo.sceneId ?? ''}|${alvo.tokenId}`
}

export function ItemDoCatalogoDialog({ item, novo, categorias, alvos, onSalvar, onApagar, onDar, onClose, imagemDoBlob, escolherImagem }: ItemDoCatalogoDialogProps) {
  const tituloId = useId()
  const idBase = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const apertouNoFundo = useRef(false)
  const [rascunho, setRascunho] = useState(item)
  const [precoTexto, setPrecoTexto] = useState(item.preco === null ? '' : String(item.preco))
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmarApagar, setConfirmarApagar] = useState(false)
  const [alvoEscolhido, setAlvoEscolhido] = useState(alvos[0] === undefined ? '' : chaveDoAlvo(alvos[0]))
  const [quantidade, setQuantidade] = useState(1)
  const [resultadoDoDar, setResultadoDoDar] = useState<string | null>(null)

  // ARMAS-FONTE-UNICA §6: a arma do Acervo mostra e edita a regra do livro aberto (a fonte); o Salvar grava a entrada e as fichas ligadas.
  const sistemaIdDoLivro = useCatalogoStore((state) => (state.podeGravar ? state.sistemaId : null))
  const entradasDoLivro = useCatalogoStore((state) => state.itens)
  const sistemaDoLivro = useRpgStore((state) => (sistemaIdDoLivro === null ? undefined : sistemaPorId(state.biblioteca, sistemaIdDoLivro)))
  const ehArma = ehCategoriaDeArma(rascunho.categoria)
  const regraDaArma = ehArma && sistemaDoLivro !== undefined ? regraDaArmaNoLivro(entradasDoLivro, rascunho) : undefined
  /** O que o mestre mudou no "O que ela faz"; `null` = nada (o Salvar não toca no livro). */
  const [mecanicaDaArma, setMecanicaDaArma] = useState<{ mecanica: MecanicaGuardada | undefined; efeito?: string } | null>(null)

  /** Os campos da regra como ficariam ao salvar: o Efeito em texto que seguiu a mecânica entra por cima. */
  const camposDaArmaNaTela = mecanicaDaArma?.efeito === undefined ? (regraDaArma?.entrada.campos ?? {}) : { ...(regraDaArma?.entrada.campos ?? {}), [CAMPO_DO_EFEITO]: mecanicaDaArma.efeito }

  const preco = precoDoTexto(precoTexto)
  const mudou = novo || rascunho !== item || preco !== item.preco || mecanicaDaArma !== null

  useEffect(() => {
    const quemAbriu = document.activeElement
    dialogRef.current?.focus()
    return () => {
      if (quemAbriu instanceof HTMLElement && quemAbriu !== document.body && quemAbriu.isConnected) quemAbriu.focus()
    }
  }, [])

  /**
   * O botão apertado fica desligado enquanto grava (e o Salvar continua
   * desligado depois, sem mudança) e o foco cai no corpo da página. Ali o Esc
   * não chega à janela: no mundo do livro ele fechava o livro inteiro. Acabou
   * de gravar e o foco está num botão desligado ou no corpo: volta para a janela.
   */
  useEffect(() => {
    if (ocupado) return
    const ativo = document.activeElement
    if (ativo === null || ativo === document.body || ativo.matches(':disabled')) dialogRef.current?.focus()
  }, [ocupado])

  const trocarImagem = async (pegar: () => Promise<string | null>) => {
    setErro(null)
    setOcupado(true)
    try {
      const imagem = await pegar()
      if (imagem !== null) setRascunho((atual) => ({ ...atual, imagem }))
    } catch (falha) {
      setErro(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  const salvar = async () => {
    if (preco === undefined) {
      setErro('O preço é um número inteiro de berries (ou vazio, sem preço).')
      return
    }
    setErro(null)
    setOcupado(true)
    try {
      const salvo = { ...rascunho, nome: cleanItemName(rascunho.nome) || ITEM_SEM_NOME, categoria: categoriaLimpa(rascunho.categoria), preco }
      await onSalvar(salvo)
      if (mecanicaDaArma !== null && sistemaDoLivro !== undefined && ehCategoriaDeArma(salvo.categoria)) {
        // Sem regra neste livro, nasce a entrada de arma ligada a esta coisa; a de mesmo nome solta ganha a ligação.
        const { mecanica: _antes, ...base }: EntradaDoCatalogo = regraDaArma?.entrada ?? { id: novoIdDeEntrada(), tipo: 'arma', nome: salvo.nome, texto: '', campos: {} }
        const campos = mecanicaDaArma.efeito === undefined ? base.campos : { ...base.campos, [CAMPO_DO_EFEITO]: mecanicaDaArma.efeito }
        await gravarRegraDaArma({ ...base, campos, acervoId: salvo.id, ...(mecanicaDaArma.mecanica === undefined ? {} : { mecanica: mecanicaDaArma.mecanica }) }, sistemaDoLivro)
        setMecanicaDaArma(null)
      }
      // A store guarda este mesmo objeto: com ele no rascunho, "nada mudou" volta a valer e o "Dar" libera.
      setRascunho(salvo)
      if (novo) onClose()
    } catch (falha) {
      setErro(mensagemDe(falha))
    } finally {
      setOcupado(false)
    }
  }

  const apagar = async () => {
    setOcupado(true)
    try {
      await onApagar()
      onClose()
    } catch (falha) {
      setErro(mensagemDe(falha))
      setOcupado(false)
    }
  }

  const dar = () => {
    const alvo = alvos.find((candidato) => chaveDoAlvo(candidato) === alvoEscolhido)
    if (alvo === undefined || onDar === undefined) return
    const quantos = item.empilhavel ? quantidade : 1
    const deu = onDar(alvo, quantos)
    setResultadoDoDar(deu ? `Dado a ${alvo.nome}${quantos > 1 ? ` (×${quantos})` : ''}.` : `Não deu: ${alvo.nome} não está mais na cena.`)
  }

  const tecla = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab') return
    const focaveis = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])
    const primeiro = focaveis[0]
    const ultimo = focaveis[focaveis.length - 1]
    if (primeiro === undefined || ultimo === undefined) return
    if (event.shiftKey && (document.activeElement === primeiro || document.activeElement === dialogRef.current)) {
      event.preventDefault()
      ultimo.focus()
    } else if (!event.shiftKey && document.activeElement === ultimo) {
      event.preventDefault()
      primeiro.focus()
    }
  }

  const cliqueNoFundo = (event: MouseEvent<HTMLDivElement>) => {
    if (apertouNoFundo.current && event.target === event.currentTarget) onClose()
    apertouNoFundo.current = false
  }

  const listaId = `${idBase}-categorias`

  return createPortal(
    <div className="lb-dialog-backdrop" onMouseDown={(event) => (apertouNoFundo.current = event.target === event.currentTarget)} onClick={cliqueNoFundo}>
      <div ref={dialogRef} className="lb-panel lb-dialog lb-item-janela" role="dialog" aria-modal="true" aria-labelledby={tituloId} tabIndex={-1} onKeyDown={tecla}>
        <header className="lb-dialog__head lb-item-janela__topo">
          <h2 id={tituloId} className="lb-dialog__title">
            {novo ? 'Novo item' : item.nome}
          </h2>
          <button type="button" className="lb-iconbtn lb-iconbtn--sm" aria-label="Fechar" onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </header>
        <div className="lb-dialog__body lb-scroll lb-item-janela__corpo">
          <div className="lb-item-janela__imagem-linha">
            <div className="lb-item-janela__imagem">
              <ImagemOuIniciais imagem={rascunho.imagem} nome={rascunho.nome} alt={`Imagem de ${rascunho.nome}`} />
            </div>
            <div className="lb-item-janela__imagem-acoes">
              <PinImageDrop rotulo="Colar ou soltar imagem do item" onImage={(fonte) => void trocarImagem(() => imagemDoBlob(fonte))} />
              <div className="lb-item-janela__botoes">
                <button type="button" className="lb-btn lb-btn--compact" disabled={ocupado} onClick={() => void trocarImagem(escolherImagem)}>
                  {rascunho.imagem === null ? 'Escolher imagem…' : 'Trocar imagem…'}
                </button>
                {rascunho.imagem !== null && (
                  <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setRascunho({ ...rascunho, imagem: null })}>
                    Tirar imagem
                  </button>
                )}
              </div>
            </div>
          </div>
          <label className="lb-field" htmlFor={`${idBase}-nome`}>
            <span className="lb-label">Nome</span>
            <input
              id={`${idBase}-nome`}
              className="lb-input"
              value={rascunho.nome}
              maxLength={ITEM_NAME_MAX_LENGTH}
              onChange={(event) => setRascunho({ ...rascunho, nome: event.target.value })}
            />
          </label>
          <div className="lb-item-janela__linha">
            <label className="lb-field" htmlFor={`${idBase}-categoria`}>
              <span className="lb-label">Categoria</span>
              <input
                id={`${idBase}-categoria`}
                className="lb-input"
                list={listaId}
                value={rascunho.categoria}
                placeholder="Sem categoria"
                // MUNIÇÃO: bala empilha ("Balas de prata ×12"); escolher a categoria já liga o Empilhável.
                onChange={(event) => setRascunho({ ...rascunho, categoria: event.target.value, ...(ehCategoriaDeMunicao(event.target.value) ? { empilhavel: true } : {}) })}
              />
              <datalist id={listaId}>
                {categorias.map((categoria) => (
                  <option key={categoria} value={categoria} />
                ))}
              </datalist>
            </label>
            <label className="lb-field" htmlFor={`${idBase}-preco`}>
              <span className="lb-label">Preço (berries)</span>
              <input
                id={`${idBase}-preco`}
                className="lb-input"
                inputMode="numeric"
                placeholder="Sem preço"
                value={precoTexto}
                aria-invalid={preco === undefined}
                onChange={(event) => setPrecoTexto(event.target.value)}
              />
            </label>
          </div>
          <label className="lb-field" htmlFor={`${idBase}-descricao`}>
            <span className="lb-label">Descrição</span>
            <textarea
              id={`${idBase}-descricao`}
              className="lb-input lb-textarea"
              value={rascunho.descricao}
              maxLength={ITEM_DESCRICAO_MAX}
              onChange={(event) => setRascunho({ ...rascunho, descricao: event.target.value })}
            />
          </label>
          <label className="lb-item-janela__marca">
            <input type="checkbox" checked={rascunho.empilhavel} onChange={(event) => setRascunho({ ...rascunho, empilhavel: event.target.checked })} />
            <span>Empilhável — dar de novo a quem já tem soma na quantidade</span>
          </label>
          <LuzDoItemCampos idBase={idBase} luz={rascunho.luz} onMudar={(luz) => setRascunho(comLuz(rascunho, luz))} />
          {(ehCategoriaDeArma(rascunho.categoria) || (rascunho.municoes?.length ?? 0) > 0) && (
            <MunicoesDaArma armaId={rascunho.id} escolhidas={rascunho.municoes ?? []} onMudar={(municoes) => setRascunho(comMunicoes(rascunho, municoes))} />
          )}
          {/* Arma: o "O que ela faz" é a regra do livro (um efeito de item aqui seria uma 2ª verdade). Item: Fase 7, o efeito vai com a cópia dada. */}
          {ehArma ? (
            sistemaDoLivro === undefined ? (
              <p className="lb-field__hint">O que a arma faz mora no livro do sistema: abra o livro (Biblioteca, página Itens) para ver e mudar.</p>
            ) : (
              <EfeitoDaArmaCampos
                entrada={{ nome: regraDaArma?.entrada.nome ?? rascunho.nome, campos: camposDaArmaNaTela, acervoId: rascunho.id, mecanica: mecanicaDaArma === null ? regraDaArma?.entrada.mecanica : mecanicaDaArma.mecanica }}
                sistema={sistemaDoLivro}
                onMudar={(mecanica, efeito) => setMecanicaDaArma((antes) => ({ mecanica, ...(efeito !== undefined ? { efeito } : antes?.efeito !== undefined ? { efeito: antes.efeito } : {}) }))}
                {...(regraDaArma === undefined ? { nota: 'Sem regra neste livro: salvar cria a entrada de arma ligada a esta coisa.' } : regraDaArma.ligar ? { nota: 'Salvar liga esta coisa à entrada de mesmo nome do livro.' } : {})}
              />
            )
          ) : (
            <EfeitoDoItemCampos
              item={rascunho}
              onMudar={(efeito) => setRascunho((atual) => comEfeito(atual, efeito))}
              onTrocarDescricao={(descricao) => setRascunho((atual) => ({ ...atual, descricao: descricao.slice(0, ITEM_DESCRICAO_MAX) }))}
            />
          )}
          {erro !== null && (
            <p className="lb-field__error" role="alert">
              {erro}
            </p>
          )}
          <div className="lb-item-janela__salvar">
            {!novo &&
              (confirmarApagar ? (
                <span className="lb-item-janela__confirma" role="group" aria-label="Confirmar apagar">
                  <span>Apagar do acervo? Quem já tem o item continua com ele.</span>
                  <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setConfirmarApagar(false)}>
                    Manter
                  </button>
                  <button type="button" className="lb-btn lb-btn--danger lb-btn--compact" disabled={ocupado} onClick={() => void apagar()}>
                    Apagar
                  </button>
                </span>
              ) : (
                <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setConfirmarApagar(true)}>
                  Apagar…
                </button>
              ))}
            <button type="button" className="lb-btn lb-btn--primary" disabled={ocupado || !mudou} onClick={() => void salvar()}>
              {novo ? 'Criar item' : 'Salvar'}
            </button>
          </div>
          {!novo && onDar !== undefined && (
            <section className="lb-item-janela__dar" aria-labelledby={`${idBase}-dar`}>
              <h3 id={`${idBase}-dar`} className="lb-item-janela__subtitulo">
                Dar a…
              </h3>
              {alvos.length === 0 ? (
                <p className="lb-item-janela__dica">Nenhum personagem com token nas cenas abertas. Ligue um token a um personagem na ficha dele.</p>
              ) : (
                <div className="lb-item-janela__linha">
                  <select
                    className="lb-input"
                    aria-label="Personagem que recebe o item"
                    value={alvoEscolhido}
                    onChange={(event) => {
                      setAlvoEscolhido(event.target.value)
                      setResultadoDoDar(null)
                    }}
                  >
                    {alvos.map((alvo) => (
                      <option key={chaveDoAlvo(alvo)} value={chaveDoAlvo(alvo)}>
                        {alvo.nome} · {alvo.cena}
                      </option>
                    ))}
                  </select>
                  {item.empilhavel && (
                    <input
                      className="lb-input lb-item-janela__qtd"
                      type="number"
                      min={1}
                      max={ITEM_QUANTIDADE_MAX}
                      aria-label="Quantidade"
                      value={quantidade}
                      onChange={(event) => setQuantidade(Math.min(Math.max(Math.trunc(Number(event.target.value)) || 1, 1), ITEM_QUANTIDADE_MAX))}
                    />
                  )}
                  <button type="button" className="lb-btn" disabled={mudou} title={mudou ? 'Salve antes de dar.' : undefined} onClick={dar}>
                    Dar
                  </button>
                </div>
              )}
              {mudou && alvos.length > 0 && <p className="lb-item-janela__dica">Salve antes de dar: o personagem recebe o item como ele está no acervo.</p>}
              <p className="lb-item-janela__resultado" aria-live="polite">
                {resultadoDoDar}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
