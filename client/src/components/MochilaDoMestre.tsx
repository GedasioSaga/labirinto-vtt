import { useEffect, useId, useMemo, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { itemParaDar } from '../lib/acervoDeItens'
import { ITEM_DESCRICAO_MAX, ITEM_NAME_MAX_LENGTH, ITEM_QUANTIDADE_MAX, cleanItemName, mochilaComItemDoAcervo, quantidadeDe, type ItemParaDar } from '../lib/items'
import { mochilaComAVagaEditada, mochilaSemAMudanca, precoValido, quantidadeValida, type MudancaNaVaga } from '../lib/mochila/editarVaga'
import { acervoDaMochila } from '../lib/mochila/acervoDaMochila'
import {
  balasParaOPente,
  ehRecusa,
  equiparNaMochila,
  guardarNaMochila,
  mochilaDesfeita,
  penteDaArma,
  recarregarForaDaBatalha,
  seEquipa,
  type AcervoDaMochila,
} from '../lib/mochila/armaNaMochila'
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
  /** O "Armas por batalha" da ficha (`limiteDeArmas`); `null` ou ausente = sem limite (o boneco sem ficha). */
  limiteDeArmas?: number | null
  /** "Dar a…" de uma vaga a um aliado. Ausente = sem o botão (a mochila de antes da migração, no boneco). */
  darA?: DarAAliado
}

/** O "Dar a…" da vaga (itens refeitos, E3): a quem dá e como. */
export interface DarAAliado {
  alvos: readonly { id: string; nome: string }[]
  /** Dá `quantos` da vaga ao aliado `alvoId`; devolve a frase do aviso (com o Desfazer já posto) ou o motivo de não ter dado. */
  dar: (vaga: CarriedItem, alvoId: string, quantos: number) => { ok: true } | { ok: false; motivo: string }
}

/** "Pente 4 de 6 · Bala de Prata", o Recarregar (na hora, fora da batalha) e, com mais de uma bala que serve, qual. */
function PenteDaVaga({ arma, mochila, acervo, onRecarregar }: { arma: CarriedItem; mochila: readonly CarriedItem[]; acervo: AcervoDaMochila; onRecarregar: (balaVagaId: string) => void }) {
  const pente = penteDaArma(arma, acervo)
  const opcoes = balasParaOPente(mochila, arma.id, acervo)
  const daMesmaBala = opcoes.find((vaga) => vaga.itemId === arma.pente?.balaId)
  const [escolhida, setEscolhida] = useState<string | null>(null)
  if (pente === null) return null
  const bala = opcoes.find((vaga) => vaga.id === escolhida) ?? daMesmaBala ?? opcoes[0]
  const nomeNoPente = arma.pente === undefined ? null : (acervo.paraDar(arma.pente.balaId)?.nome ?? 'bala')
  return (
    <span className="lb-inv-mestre__pente">
      <span className="lb-inv-mestre__cat">
        Pente {arma.pente?.n ?? 0} de {pente.capacidade}
        {nomeNoPente !== null && ` · ${nomeNoPente}`}
      </span>
      {opcoes.length > 1 && (
        <select className="lb-input" aria-label={`Bala para o pente de ${arma.nome}`} value={bala?.id ?? ''} onChange={(event) => setEscolhida(event.target.value)}>
          {opcoes.map((vaga) => (
            <option key={vaga.id} value={vaga.id}>
              {vaga.nome} ({quantidadeDe(vaga)})
            </option>
          ))}
        </select>
      )}
      <button
        type="button"
        className="lb-btn lb-btn--compact"
        disabled={bala === undefined}
        title={bala === undefined ? `Nenhuma munição que ${arma.nome} aceita na mochila.` : undefined}
        onClick={() => bala !== undefined && onRecarregar(bala.id)}
      >
        Recarregar
      </button>
    </span>
  )
}

/** O "Dar a…" da vaga, no lugar: o aliado, quantos (só a pilha) e o Dar. */
function DarDaVaga({ vaga, darA, onFeito }: { vaga: CarriedItem; darA: DarAAliado; onFeito: () => void }) {
  const idBase = useId()
  const [aberto, setAberto] = useState(false)
  const [alvoId, setAlvoId] = useState(darA.alvos[0]?.id ?? '')
  const [quantidadeTexto, setQuantidadeTexto] = useState(String(quantidadeDe(vaga)))
  const [erro, setErro] = useState<string | null>(null)
  if (darA.alvos.length === 0) return null
  if (!aberto) {
    return (
      <button type="button" className="lb-btn lb-btn--compact" aria-expanded={false} onClick={() => setAberto(true)}>
        Dar a…
      </button>
    )
  }
  const tem = quantidadeDe(vaga)
  const dar = () => {
    const quantos = Math.min(inteiroDoTexto(quantidadeTexto) ?? 0, tem)
    if (quantos < 1) {
      setErro(`Diga quantos, de 1 a ${tem.toLocaleString('pt-BR')}.`)
      return
    }
    const feito = darA.dar(vaga, alvoId, quantos)
    if (!feito.ok) setErro(feito.motivo)
    else onFeito()
  }
  return (
    <div className="lb-inv-mestre__form" role="group" aria-label={`Dar ${vaga.nome} a um aliado`} onKeyDown={escFechaSo(() => setAberto(false))}>
      <div className="lb-inv-mestre__linha">
        <label className="lb-field" htmlFor={`${idBase}-alvo`}>
          <span className="lb-label">Para quem</span>
          <select id={`${idBase}-alvo`} className="lb-input" value={alvoId} onChange={(event) => setAlvoId(event.target.value)}>
            {darA.alvos.map((alvo) => (
              <option key={alvo.id} value={alvo.id}>
                {alvo.nome}
              </option>
            ))}
          </select>
        </label>
        {tem > 1 && (
          <label className="lb-field" htmlFor={`${idBase}-qtd`}>
            <span className="lb-label">Quantos (tem {tem.toLocaleString('pt-BR')})</span>
            <CampoDeQuantidade id={`${idBase}-qtd`} texto={quantidadeTexto} onTexto={setQuantidadeTexto} />
          </label>
        )}
      </div>
      {erro !== null && (
        <p className="lb-field__error" role="alert">
          {erro}
        </p>
      )}
      <div className="lb-inv__acoes">
        <button type="button" className="lb-btn lb-btn--primary lb-btn--compact" onClick={dar}>
          Dar
        </button>
        <button type="button" className="lb-btn lb-btn--ghost lb-btn--compact" onClick={() => setAberto(false)}>
          Cancelar
        </button>
      </div>
    </div>
  )
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

export function MochilaDoMestre({ itens, dono, vazio, gravar, mochilaDeAgora, acoes, limiteDeArmas = null, darA }: MochilaDoMestreProps) {
  const categorias = useAcervoDeItensStore((state) => state.categorias)
  const doAcervo = useAcervoDeItensStore((state) => state.itens)
  const acervo = useMemo(() => acervoDaMochila(doAcervo), [doAcervo])
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

  /** Grava a mudança de várias vagas (Equipar, Recarregar) com o Desfazer que volta só as vagas que ela mexeu. */
  const gravarMudanca = (antes: readonly CarriedItem[], nova: CarriedItem[], frase: string): void => {
    if (!gravar(nova)) return
    useToastStore.getState().push('info', frase, undefined, {
      actions: [{ label: 'Desfazer', run: () => void gravar(mochilaDesfeita(mochilaDeAgora(), antes, nova)) }],
    })
  }

  const alternarEquipado = (vaga: CarriedItem) => {
    const antes = mochilaDeAgora()
    const nova = vaga.equipado === true ? guardarNaMochila(antes, vaga.id) : equiparNaMochila(antes, vaga.id, limiteDeArmas, dono, acervo)
    if (ehRecusa(nova)) {
      useToastStore.getState().push('error', nova.recusa)
      return
    }
    gravarMudanca(antes, nova, vaga.equipado === true ? `${vaga.nome} guardado na mochila de ${dono}.` : `${vaga.nome} equipado em ${dono}.`)
  }

  const recarregar = (arma: CarriedItem, balaVagaId: string) => {
    const antes = mochilaDeAgora()
    const bala = antes.find((vaga) => vaga.id === balaVagaId)
    const feito = recarregarForaDaBatalha(antes, arma.id, balaVagaId, acervo, `item_${crypto.randomUUID()}`)
    if (ehRecusa(feito)) {
      useToastStore.getState().push('error', feito.recusa)
      return
    }
    // Trocar de bala começa o pente do zero: as de antes voltaram para a mochila.
    const penteAntes = antes.find((vaga) => vaga.id === arma.id)?.pente
    const noPente = penteAntes !== undefined && penteAntes.balaId === bala?.itemId ? penteAntes.n : 0
    const naMochila = bala === undefined ? 0 : quantidadeDe(bala)
    const nomeDaBala = bala?.nome ?? 'bala'
    const trocou = feito.devolvidas > 0 ? ` As ${feito.devolvidas.toLocaleString('pt-BR')} balas de antes voltaram para a mochila.` : ''
    gravarMudanca(
      antes,
      feito.mochila,
      `${arma.nome} recarregada: pente ${noPente} → ${noPente + feito.entraram}. ${nomeDaBala} na mochila: ${naMochila.toLocaleString('pt-BR')} → ${(naMochila - feito.entraram).toLocaleString('pt-BR')}.${trocou}`,
    )
  }

  return (
    <div className="lb-inv-mestre">
      <InventarioDaFicha
        itens={itens}
        vazio={vazio}
        acoes={(item, fechar) => (
          <>
            {/* Itens refeitos (E3): Equipar e Guardar, com o limite "Armas por batalha" da ficha. */}
            {seEquipa(item, acervo) && (
              <button type="button" className="lb-btn lb-btn--compact" aria-pressed={item.equipado === true} onClick={() => alternarEquipado(item)}>
                {item.equipado === true ? 'Guardar' : 'Equipar'}
              </button>
            )}
            <PenteDaVaga arma={item} mochila={itens} acervo={acervo} onRecarregar={(balaVagaId) => recarregar(item, balaVagaId)} />
            <button type="button" className="lb-btn lb-btn--compact" aria-expanded={editandoId === item.id} onClick={() => setEditandoId((atual) => (atual === item.id ? null : item.id))}>
              Editar
            </button>
            {darA !== undefined && (
              <DarDaVaga
                key={item.id}
                vaga={item}
                darA={darA}
                onFeito={() => {
                  // Deu tudo: a vaga saiu da mochila, e o cartão dela fecha.
                  if (!mochilaDeAgora().some((vaga) => vaga.id === item.id)) fechar()
                }}
              />
            )}
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
