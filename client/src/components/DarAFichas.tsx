import { useId, useMemo, useState } from 'react'
import { itemParaDar, type ItemDoCatalogo } from '../lib/acervoDeItens'
import { ehVariacao } from '../lib/livros/combate'
import { darAVarias, desfazerDarAVarias, previaDoDar, quantidadeDoDar, VAGAS_POR_DAR_MAX } from '../lib/mochila/darAVarias'
import { ITEM_QUANTIDADE_MAX } from '../lib/items'
import type { Personagem } from '../lib/personagem'
import { useAcervoDeItensStore } from '../stores/acervoDeItensStore'
import { personagensAtivos, useAdventureStore } from '../stores/adventureStore'
import { useToastStore } from '../stores/toastStore'
import './DarAFichas.css'

/**
 * "DAR A…" COM QUANTIDADE E VÁRIAS FICHAS (docs/design/itens-rework/PLANO.md, etapa E3): o mestre marca
 * as fichas (jogadores e cópias de NPC), diz quantos e dá a todas de uma vez. Cada linha mostra
 * quanto a ficha tem e, marcada, com quanto fica. O item vai para a MOCHILA DA FICHA (a dona; o
 * boneco só mostra), numa gravação só, com um Desfazer que volta todas.
 */

export interface DarAFichasProps {
  /** O item como está gravado no Acervo (o rascunho não salvo não se dá). */
  item: ItemDoCatalogo
  /** O motivo de não poder dar agora ("Salve antes de dar"); `null` = pode. */
  bloqueado: string | null
}

/** "Vincent (12 → 52)": a linha do aviso. */
function antesEDepois(nome: string, tem: number, ficaCom: number): string {
  return `${nome} (${tem.toLocaleString('pt-BR')} → ${ficaCom.toLocaleString('pt-BR')})`
}

/** "A, B e C". */
function lista(nomes: readonly string[]): string {
  if (nomes.length <= 1) return nomes.join('')
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}

/** Jogadores primeiro, depois os NPCs (o modelo e as cópias), cada grupo na ordem da lista. */
function emOrdem(personagens: readonly Personagem[]): Personagem[] {
  return [...personagens.filter((personagem) => personagem.tipo === 'jogador'), ...personagens.filter((personagem) => personagem.tipo !== 'jogador')]
}

export function DarAFichas({ item, bloqueado }: DarAFichasProps) {
  const idBase = useId()
  const daAventura = useAdventureStore(personagensAtivos)
  const doAcervo = useAcervoDeItensStore((state) => state.itens)
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(new Set())
  const [quantidade, setQuantidade] = useState(1)
  const fichas = useMemo(() => emOrdem(daAventura), [daAventura])
  const paraDar = useMemo(() => itemParaDar(item, doAcervo), [item, doAcervo])
  const pedida = quantidadeDoDar(paraDar, quantidade)
  const previa = useMemo(() => new Map(previaDoDar(fichas, paraDar, pedida).map((linha) => [linha.personagemId, linha])), [fichas, paraDar, pedida])
  const teto = item.empilhavel ? ITEM_QUANTIDADE_MAX : VAGAS_POR_DAR_MAX

  const marcar = (id: string, marcada: boolean) =>
    setMarcadas((atual) => {
      const nova = new Set(atual)
      if (marcada) nova.add(id)
      else nova.delete(id)
      return nova
    })

  const dar = () => {
    const ids = fichas.filter((ficha) => marcadas.has(ficha.id)).map((ficha) => ficha.id)
    if (ids.length === 0) return
    const aventura = useAdventureStore.getState()
    const agora = personagensAtivos(aventura)
    const dado = darAVarias(agora, ids, paraDar, pedida, () => `item_${crypto.randomUUID()}`)
    if (dado.recebidos.length === 0) {
      useToastStore.getState().push('info', `Ninguém recebeu: ${lista(ids.map((id) => agora.find((ficha) => ficha.id === id)?.nome ?? 'a ficha'))} já carrega o máximo de ${item.nome}.`)
      return
    }
    const novas = new Map(dado.personagens.map((personagem) => [personagem.id, personagem]))
    const recebeu = dado.recebidos.map((recebido) => recebido.personagemId)
    if (!aventura.ajustarPersonagens(recebeu, (atual) => novas.get(atual.id) ?? atual)) {
      useToastStore.getState().push('error', `Não deu para dar ${item.nome}: a aventura não aceitou a mudança.`)
      return
    }
    const linhas = dado.recebidos.map((recebido) => {
      const ficha = agora.find((candidata) => candidata.id === recebido.personagemId)
      const tem = previa.get(recebido.personagemId)?.tem ?? 0
      return antesEDepois(ficha?.nome ?? 'a ficha', tem, tem + recebido.entraram)
    })
    const desfazer = () => useAdventureStore.getState().ajustarPersonagens(recebeu, (atual) => desfazerDarAVarias(atual, dado.recebidos))
    const quantos = pedida > 1 ? `${pedida.toLocaleString('pt-BR')} ${item.nome}` : item.nome
    useToastStore.getState().push('info', `${quantos} para ${lista(linhas)}.`, undefined, { actions: [{ label: 'Desfazer', run: () => void desfazer() }] })
    setMarcadas(new Set())
  }

  const quantasMarcadas = fichas.filter((ficha) => marcadas.has(ficha.id)).length
  return (
    <section className="lb-item-janela__dar" aria-labelledby={`${idBase}-dar`}>
      <h3 id={`${idBase}-dar`} className="lb-item-janela__subtitulo">
        Dar a…
      </h3>
      {fichas.length === 0 ? (
        <p className="lb-item-janela__dica">Nenhuma ficha na aventura aberta. Crie um personagem ou abra uma aventura.</p>
      ) : (
        <>
          <ul className="lb-dar-fichas" aria-label="Fichas que recebem">
            {fichas.map((ficha) => {
              const linha = previa.get(ficha.id)
              const marcada = marcadas.has(ficha.id)
              return (
                <li key={ficha.id}>
                  <label className="lb-dar-fichas__linha">
                    <input type="checkbox" checked={marcada} onChange={(event) => marcar(ficha.id, event.target.checked)} />
                    <span className="lb-dar-fichas__nome">
                      {ficha.nome || 'Sem nome'}
                      {ehVariacao(ficha) && <small> · cópia</small>}
                    </span>
                    <span className="lb-dar-fichas__conta">
                      {marcada && linha !== undefined ? `tem ${linha.tem.toLocaleString('pt-BR')} → fica com ${linha.ficaCom.toLocaleString('pt-BR')}` : `tem ${(linha?.tem ?? 0).toLocaleString('pt-BR')}`}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <div className="lb-item-janela__linha">
            <label className="lb-dar-fichas__qtd" htmlFor={`${idBase}-qtd`}>
              <span className="lb-label">Quantos para cada</span>
              <input
                id={`${idBase}-qtd`}
                className="lb-input lb-item-janela__qtd"
                type="number"
                min={1}
                max={teto}
                value={quantidade}
                onChange={(event) => setQuantidade(Math.min(Math.max(Math.trunc(Number(event.target.value)) || 1, 1), teto))}
              />
            </label>
            <button type="button" className="lb-btn" disabled={bloqueado !== null || quantasMarcadas === 0} title={bloqueado ?? undefined} onClick={dar}>
              {quantasMarcadas > 1 ? `Dar a ${quantasMarcadas} fichas` : 'Dar'}
            </button>
          </div>
          {bloqueado !== null && <p className="lb-item-janela__dica">{bloqueado}</p>}
        </>
      )}
    </section>
  )
}

