import { useEffect, useId, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { itemParaDar } from '../lib/acervoDeItens'
import { ITEM_DESCRICAO_MAX, ITEM_NAME_MAX_LENGTH, ITEM_QUANTIDADE_MAX, cleanItemName, mochilaComItemDoAcervo, quantidadeDe, type ItemParaDar } from '../lib/items'
import { mochilaComAVagaEditada, mochilaSemAMudanca, precoValido, quantidadeValida, type MudancaNaVaga } from '../lib/mochila/editarVaga'
import { useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import { useToastStore } from '../stores/toastStore'
import type { CarriedItem } from '../types/map'
import { itemCasaNaBusca, palavrasDaBusca, textosDeBusca } from './BuscaDoAcervoDeItens'
import { InventarioDaFicha } from './InventarioDaFicha'

/**
 * O MESTRE EDITA A MOCHILA DO JOGADOR (pedido de 16/11/2026 11h03): o
 * inventário da ficha com o "Editar" da vaga (quantidade − / +, nome,
 * descrição, categoria e preço) e o "+ Adicionar" (do Acervo, com busca e
 * quantidade, ou um item novo pelo nome). Quem grava é quem monta: a ficha
 * (a dona da mochila) ou o caminho dos itens do boneco, que a leva à ficha.
 * Toda mudança sai com Desfazer no aviso, sobre a mochila de AGORA.
 */

export interface MochilaDoMestreProps {
  itens: readonly CarriedItem[]
  /** "Aira": quem carrega, para os avisos. */
  dono: string
  vazio: string
  /** Grava a mochila inteira nova. `false` = não gravou (o aviso de quem recusou já saiu). */
  gravar: (mochila: CarriedItem[]) => boolean
  /** A mochila de agora, lida na hora (o Desfazer vem depois, e outra mudança pode ter entrado no meio). */
  mochilaDeAgora: () => readonly CarriedItem[]
  /** As outras ações da vaga aberta (Usar, Largar no chão, Tirar). */
  acoes?: (item: CarriedItem, fechar: () => void) => ReactNode
}

/** Teto da lista do "+ Adicionar": a busca estreita o resto. */
const RESULTADOS_MAX = 8

/** "3" → 3; vazio ou torto = `null`. */
function inteiroDoTexto(texto: string): number | null {
  const limpo = texto.trim()
  return /^\d{1,13}$/.test(limpo) ? Number.parseInt(limpo, 10) : null
}

/** Sem acento e sem caixa, para a busca no Acervo. */
function paraBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/** − 3 + : a quantidade com os botões e o campo, de 1 a `ITEM_QUANTIDADE_MAX`. */
function CampoDeQuantidade({ id, texto, onTexto }: { id: string; texto: string; onTexto: (texto: string) => void }) {
  const atual = inteiroDoTexto(texto) ?? 1
  const somar = (delta: number) => onTexto(String(Math.min(Math.max(atual + delta, 1), ITEM_QUANTIDADE_MAX)))
  return (
    <span className="lb-inv-mestre__qtd">
      <button type="button" className="lb-btn lb-btn--compact" aria-label="Um a menos" disabled={atual <= 1} onClick={() => somar(-1)}>
        −
      </button>
      <input id={id} className="lb-input" inputMode="numeric" value={texto} aria-invalid={quantidadeValida(inteiroDoTexto(texto) ?? 0) === null} onChange={(event) => onTexto(event.target.value)} />
      <button type="button" className="lb-btn lb-btn--compact" aria-label="Um a mais" disabled={atual >= ITEM_QUANTIDADE_MAX} onClick={() => somar(1)}>
        +
      </button>
    </span>
  )
}

/** O Esc dentro do formulário fecha só ele: sem isto o mesmo Esc fecharia a ficha inteira. */
function escFechaSo(fechar: () => void): (event: KeyboardEvent<HTMLElement>) => void {
  return (event) => {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    fechar()
  }
}

/** O "Editar" da vaga, no lugar, logo abaixo da grade. `onSalvar` devolve o motivo de não ter gravado, ou `null`. */
function EditorDaVaga({ vaga, categorias, onSalvar, onCancelar }: { vaga: CarriedItem; categorias: readonly string[]; onSalvar: (mudanca: MudancaNaVaga) => string | null; onCancelar: () => void }) {
  const idBase = useId()
  const [nome, setNome] = useState(vaga.nome)
  const [quantidadeTexto, setQuantidadeTexto] = useState(String(quantidadeDe(vaga)))
  const [descricao, setDescricao] = useState(vaga.descricao ?? '')
  const [categoria, setCategoria] = useState(vaga.categoria ?? '')
  const [precoTexto, setPrecoTexto] = useState(vaga.preco === undefined ? '' : String(vaga.preco))
  const [erro, setErro] = useState<string | null>(null)

  const salvar = (event: FormEvent) => {
    event.preventDefault()
    const quantidade = quantidadeValida(inteiroDoTexto(quantidadeTexto) ?? 0)
    const preco = precoTexto.trim() === '' ? null : precoValido(inteiroDoTexto(precoTexto) ?? -1)
    if (nome.trim() === '') setErro('O item precisa de um nome.')
    else if (quantidade === null) setErro(`A quantidade vai de 1 a ${ITEM_QUANTIDADE_MAX.toLocaleString('pt-BR')}.`)
    else if (preco === undefined) setErro('O preço é um número inteiro de berries (vazio = sem preço).')
    else setErro(onSalvar({ nome, descricao, categoria, preco, quantidade }))
  }

  return (
    <form className="lb-inv-mestre__form" aria-label={`Editar ${vaga.nome}`} onSubmit={salvar} onKeyDown={escFechaSo(onCancelar)}>
      <label className="lb-field" htmlFor={`${idBase}-nome`}>
        <span className="lb-label">Nome</span>
        <input id={`${idBase}-nome`} className="lb-input" value={nome} maxLength={ITEM_NAME_MAX_LENGTH} onChange={(event) => setNome(event.target.value)} />
      </label>
      <div className="lb-inv-mestre__linha">
        <label className="lb-field" htmlFor={`${idBase}-qtd`}>
          <span className="lb-label">Quantidade</span>
          <CampoDeQuantidade id={`${idBase}-qtd`} texto={quantidadeTexto} onTexto={setQuantidadeTexto} />
        </label>
        <label className="lb-field" htmlFor={`${idBase}-categoria`}>
          <span className="lb-label">Categoria</span>
          <input id={`${idBase}-categoria`} className="lb-input" list={`${idBase}-categorias`} value={categoria} placeholder="Sem categoria" onChange={(event) => setCategoria(event.target.value)} />
          <datalist id={`${idBase}-categorias`}>
            {categorias.map((nomeDaCategoria) => (
              <option key={nomeDaCategoria} value={nomeDaCategoria} />
            ))}
          </datalist>
        </label>
        <label className="lb-field" htmlFor={`${idBase}-preco`}>
          <span className="lb-label">Preço (berries)</span>
          <input id={`${idBase}-preco`} className="lb-input" inputMode="numeric" placeholder="Sem preço" value={precoTexto} onChange={(event) => setPrecoTexto(event.target.value)} />
        </label>
      </div>
      <label className="lb-field" htmlFor={`${idBase}-descricao`}>
        <span className="lb-label">Descrição</span>
        <textarea id={`${idBase}-descricao`} className="lb-input lb-textarea" value={descricao} maxLength={ITEM_DESCRICAO_MAX} onChange={(event) => setDescricao(event.target.value)} />
      </label>
      {erro !== null && (
        <p className="lb-field__error" role="alert">
          {erro}
        </p>
      )}
      <div className="lb-inv__acoes">
        <button type="submit" className="lb-btn lb-btn--primary lb-btn--compact">
          Salvar
        </button>
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

/** O "+ Adicionar": busca no Acervo, a quantidade e o item novo pelo nome. `onAdicionar` devolve o motivo de não ter entrado, ou `null`. */
function AdicionarAMochila({ onAdicionar, onFechar }: { onAdicionar: (item: ItemParaDar, quantidade: number) => string | null; onFechar: () => void }) {
  const idBase = useId()
  const itens = useAcervoDeItensStore((state) => state.itens)
  const [busca, setBusca] = useState('')
  const [quantidadeTexto, setQuantidadeTexto] = useState('1')
  const [erro, setErro] = useState<string | null>(null)
  // O Acervo mora no disco do app: lê ao abrir, se ninguém leu ainda (fora do app ele fica vazio, sem erro).
  useEffect(() => {
    const acervo = useAcervoDeItensStore.getState()
    if (!acervo.podeGravar) void acervo.recarregar()
  }, [])
  const pastas = useAcervoDeItensStore((state) => state.pastas)
  const termo = paraBusca(busca)
  // A busca única do Acervo (nome, categoria, descrição e pasta), a mesma do painel, do livro e da loja.
  const textos = useMemo(() => textosDeBusca(itens, pastas), [itens, pastas])
  const palavras = palavrasDaBusca(busca)
  const achados = itens.filter((item) => itemCasaNaBusca(textos.get(item.id), palavras)).slice(0, RESULTADOS_MAX)
  const nomeNovo = cleanItemName(busca)
  const jaNoAcervo = itens.some((item) => paraBusca(item.nome) === termo)

  const adicionar = (item: ItemParaDar) => {
    const quantidade = quantidadeValida(inteiroDoTexto(quantidadeTexto) ?? 0)
    if (quantidade === null) {
      setErro(`A quantidade vai de 1 a ${ITEM_QUANTIDADE_MAX.toLocaleString('pt-BR')}.`)
      return
    }
    const motivo = onAdicionar(item, quantidade)
    setErro(motivo)
    if (motivo === null) setBusca('')
  }

  return (
    <div className="lb-inv-mestre__form" role="group" aria-label="Adicionar à mochila" onKeyDown={escFechaSo(onFechar)}>
      <div className="lb-inv-mestre__linha">
        <label className="lb-field" htmlFor={`${idBase}-busca`}>
          <span className="lb-label">Buscar no Acervo ou nome do item novo</span>
          <input id={`${idBase}-busca`} className="lb-input" type="search" value={busca} maxLength={ITEM_NAME_MAX_LENGTH} placeholder="Balas de prata, Poção…" onChange={(event) => setBusca(event.target.value)} />
        </label>
        <label className="lb-field" htmlFor={`${idBase}-qtd`}>
          <span className="lb-label">Quantidade</span>
          <CampoDeQuantidade id={`${idBase}-qtd`} texto={quantidadeTexto} onTexto={setQuantidadeTexto} />
        </label>
      </div>
      {achados.length > 0 ? (
        <ul className="lb-inv-mestre__achados" aria-label="Itens do Acervo">
          {achados.map((item) => (
            <li key={item.id}>
              <button type="button" className="lb-btn lb-btn--compact" onClick={() => adicionar(itemParaDar(item, itens))}>
                {item.nome}
                {item.categoria !== '' && <small className="lb-inv-mestre__cat"> · {item.categoria}</small>}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lb-ficha__vazio">{itens.length === 0 ? 'O Acervo de itens está vazio. Crie um item novo pelo nome.' : 'Nada no Acervo com esse nome.'}</p>
      )}
      {erro !== null && (
        <p className="lb-field__error" role="alert">
          {erro}
        </p>
      )}
      <div className="lb-inv__acoes">
        {nomeNovo !== '' && !jaNoAcervo && (
          <button type="button" className="lb-btn lb-btn--primary lb-btn--compact" onClick={() => adicionar({ nome: nomeNovo })}>
            Item novo: {nomeNovo}
          </button>
        )}
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={onFechar}>
          Fechar
        </button>
      </div>
    </div>
  )
}

export function MochilaDoMestre({ itens, dono, vazio, gravar, mochilaDeAgora, acoes }: MochilaDoMestreProps) {
  const categorias = useAcervoDeItensStore((state) => state.categorias)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)
  // A vaga em edição pode sair da mochila (o jogador deu, o tiro gastou a última): o editor fecha sozinho.
  const editando = editandoId === null ? undefined : itens.find((item) => item.id === editandoId)

  /** Grava `nova` e põe o aviso com Desfazer, que devolve a vaga `vagaId` a `antes` sobre a mochila de então. */
  const gravarComDesfazer = (nova: CarriedItem[], vagaId: string, antes: CarriedItem | null, frase: string): boolean => {
    if (!gravar(nova)) return false
    useToastStore.getState().push('info', frase, undefined, {
      actions: [{ label: 'Desfazer', run: () => void gravar(mochilaSemAMudanca(mochilaDeAgora(), vagaId, antes)) }],
    })
    return true
  }

  const salvarEdicao = (vaga: CarriedItem, mudanca: MudancaNaVaga): string | null => {
    const agora = mochilaDeAgora()
    const antes = agora.find((item) => item.id === vaga.id)
    const nova = mochilaComAVagaEditada(agora, vaga.id, mudanca)
    if (antes === undefined || nova === null) return 'O item já não está na mochila.'
    if (!gravarComDesfazer(nova, vaga.id, antes, `${cleanItemName(mudanca.nome)} editado na mochila de ${dono}.`)) return 'Não deu para gravar a mochila.'
    setEditandoId(null)
    return null
  }

  const adicionar = (item: ItemParaDar, quantidade: number): string | null => {
    const agora = mochilaDeAgora()
    // Item novo pelo nome com mais de 1: empilha numa vaga só, como a "Poção ×3" do Acervo.
    const dado = item.itemId === undefined && quantidade > 1 ? { ...item, empilhavel: true as const } : item
    const recebeu = mochilaComItemDoAcervo(agora, dado, quantidade, `item_${crypto.randomUUID()}`)
    if (recebeu === null) return 'O item precisa de um nome.'
    if (recebeu.entraram === 0) return `A pilha já está no máximo (${ITEM_QUANTIDADE_MAX.toLocaleString('pt-BR')}).`
    const antes = agora.find((vaga) => vaga.id === recebeu.vagaId) ?? null
    const frase = recebeu.entraram === 1 ? `${item.nome} entrou na mochila de ${dono}.` : `${recebeu.entraram} ${item.nome} entraram na mochila de ${dono}.`
    return gravarComDesfazer(recebeu.mochila, recebeu.vagaId, antes, frase) ? null : 'Não deu para gravar a mochila.'
  }

  return (
    <div className="lb-inv-mestre">
      <InventarioDaFicha
        itens={itens}
        vazio={vazio}
        acoes={(item, fechar) => (
          <>
            <button type="button" className="lb-btn lb-btn--compact" aria-expanded={editandoId === item.id} onClick={() => setEditandoId((atual) => (atual === item.id ? null : item.id))}>
              Editar
            </button>
            {acoes?.(item, fechar)}
          </>
        )}
      />
      {editando !== undefined && <EditorDaVaga key={editando.id} vaga={editando} categorias={categorias} onSalvar={(mudanca) => salvarEdicao(editando, mudanca)} onCancelar={() => setEditandoId(null)} />}
      {adicionando ? (
        <AdicionarAMochila onAdicionar={adicionar} onFechar={() => setAdicionando(false)} />
      ) : (
        <button type="button" className="lb-btn lb-btn--compact lb-inv-mestre__mais" onClick={() => setAdicionando(true)}>
          + Adicionar
        </button>
      )}
    </div>
  )
}
