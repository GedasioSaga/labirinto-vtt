import { useEffect, useId, useState } from 'react'
import type { PinItem } from '../types/map'
import { cleanItemName, ITEM_NAME_MAX_LENGTH, ITEM_QUANTIDADE_MAX, quantidadeDe } from '../lib/items'
import type { FormaDoItem } from '../lib/itemNoMapa'
import { ImagemOuIniciais } from './FichaPecas'
import { Toggle } from './Toggle'
import './AcervoDeItensPanel.css'
import './ItemNoMapaControls.css'

/**
 * ITEM NO MAPA (entrega 5) — o painel do item que o mestre soltou do acervo:
 * a imagem e a categoria (do acervo, só leitura aqui), a quantidade da pilha
 * (só no empilhável: o resto vai um por vez) e a troca de forma, imagem no
 * chão ⇄ pino de item. O nome e o modo de pegar ficam com quem monta a seção:
 * o pino já os tem no "Item pegável" (`PinControls`); o chão, em
 * `ItemNoChaoControls`, logo abaixo.
 */
export interface DadosDoItemNoMapaProps {
  item: PinItem
  forma: FormaDoItem
  onChange: (item: PinItem) => void
  /** Troca a forma. Pino sem imagem não vira imagem no chão: o botão nem aparece. */
  onTrocarForma: () => void
}

/** O texto do botão de trocar, pela forma de AGORA. */
export function rotuloDaTroca(forma: FormaDoItem): string {
  return forma === 'chao' ? 'Mostrar como pino' : 'Mostrar como imagem no chão'
}

export function DadosDoItemNoMapa({ item, forma, onChange, onTrocarForma }: DadosDoItemNoMapaProps) {
  const quantidadeId = useId()
  const podeTrocar = forma === 'chao' || item.imagem !== undefined
  return (
    <div className="lb-item-no-mapa">
      <div className="lb-item-no-mapa__cabeca">
        <span className="lb-itens__foto lb-item-no-mapa__foto">
          <ImagemOuIniciais imagem={item.imagem} nome={item.nome} alt="" />
        </span>
        <span className="lb-item-no-mapa__resumo">
          <span className="lb-item-no-mapa__nome">{item.nome}</span>
          {item.categoria !== undefined && <span className="lb-label">{item.categoria}</span>}
        </span>
      </div>
      {item.empilhavel === true && (
        <div className="lb-item-no-mapa__linha">
          <label className="lb-label" htmlFor={quantidadeId}>
            Quantidade
          </label>
          <CampoDeQuantidade id={quantidadeId} valor={quantidadeDe(item)} onChange={(quantidade) => onChange(comQuantidade(item, quantidade))} />
        </div>
      )}
      {podeTrocar && (
        <button type="button" className="lb-btn lb-btn--compact" onClick={onTrocarForma}>
          {rotuloDaTroca(forma)}
        </button>
      )}
    </div>
  )
}

/** O item com a pilha nova: 1 tira o campo (ausente === 1, o arquivo fica como o de antes). */
function comQuantidade(item: PinItem, quantidade: number): PinItem {
  const { quantidade: _antiga, ...resto } = item
  return quantidade > 1 ? { ...resto, quantidade } : resto
}

/**
 * Inteiro de 1 a `ITEM_QUANTIDADE_MAX`, gravado ao sair do campo (ou Enter):
 * cada dígito não vira um passo do desfazer. Texto que não é número volta ao
 * valor de antes; fora da faixa vai para a borda.
 */
function CampoDeQuantidade({ id, valor, onChange }: { id: string; valor: number; onChange: (valor: number) => void }) {
  const [texto, setTexto] = useState(String(valor))
  useEffect(() => setTexto(String(valor)), [valor])
  const gravar = () => {
    const numero = /^\d+$/.test(texto.trim()) ? Number(texto.trim()) : Number.NaN
    if (!Number.isSafeInteger(numero)) {
      setTexto(String(valor))
      return
    }
    const limitado = Math.min(Math.max(numero, 1), ITEM_QUANTIDADE_MAX)
    setTexto(String(limitado))
    if (limitado !== valor) onChange(limitado)
  }
  return (
    <input
      id={id}
      className="lb-input lb-item-no-mapa__quantidade"
      inputMode="numeric"
      value={texto}
      onChange={(event) => setTexto(event.target.value)}
      onBlur={gravar}
      onKeyDown={(event) => {
        if (event.key === 'Enter') gravar()
      }}
    />
  )
}

export interface ItemNoChaoControlsProps {
  item: PinItem
  onChange: (item: PinItem) => void
  onTrocarForma: () => void
}

/**
 * A imagem do item no chão (o objeto com `item`): nome que vai para a mochila,
 * o modo de pegar ("Pega direto" ligado, o padrão; desligado, "Pede ao
 * mestre") e os dados acima. Girar, travar, esconder no editor e o "Oculto
 * para jogadores" são os do objeto, logo abaixo (`ItemTransformControls`).
 */
export function ItemNoChaoControls({ item, onChange, onTrocarForma }: ItemNoChaoControlsProps) {
  const [rascunho, setRascunho] = useState(item.nome)
  useEffect(() => setRascunho(item.nome), [item.nome])
  const gravarNome = () => {
    const limpo = cleanItemName(rascunho)
    // Nome apagado volta ao que era: item sem nome não é pegável, e sumiria calado.
    if (limpo === '' || limpo === item.nome) {
      setRascunho(item.nome)
      return
    }
    onChange({ ...item, nome: limpo })
  }
  return (
    <>
      <p className="lb-eyebrow">Item no chão</p>
      <input
        className="lb-input"
        type="text"
        aria-label="Nome do item"
        value={rascunho}
        maxLength={ITEM_NAME_MAX_LENGTH}
        onChange={(event) => setRascunho(event.target.value)}
        onBlur={gravarNome}
        onKeyDown={(event) => {
          if (event.key === 'Enter') gravarNome()
        }}
      />
      <Toggle label="Pega sem pedir ao mestre" checked={item.livre === true} onChange={(livre) => onChange(comModoDePegar(item, livre))} />
      <DadosDoItemNoMapa item={item} forma="chao" onChange={onChange} onTrocarForma={onTrocarForma} />
    </>
  )
}

/** "Pega direto" (`livre`) liga e desliga sem perder os dados do item. */
export function comModoDePegar(item: PinItem, livre: boolean): PinItem {
  const { livre: _antes, ...resto } = item
  return livre ? { ...resto, livre: true } : resto
}
