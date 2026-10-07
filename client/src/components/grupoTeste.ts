import { act } from 'react'
import { ABA_ROTULO, type AbaDaFicha } from './GrupoCompacto'

/*
 * Ajudantes dos testes do Grupo (aba Jogo): achar o cartão de um jogador pelo
 * "<nome> —" do leitor de tela (o mesmo gancho das jornadas e2e), abrir a
 * ficha dele e escolher uma aba. `el.click()` é um clique sem contagem, como
 * Enter no botão: a ficha aparece de uma vez, sem esperar animação.
 */

/**
 * O cartão do jogador: `.lb-field` com "<nome> —" e o nome à vista igual a
 * `nome` (uma ficha com o nome do jogador, "● Bruno — de Bruno" na lista de
 * atribuir de outro cartão, não conta). Exatamente um, ou o teste quebra dizendo quantos.
 */
export function cartaoDoJogador(escopo: ParentNode, nome: string): HTMLElement {
  const achados = Array.from(escopo.querySelectorAll<HTMLElement>('.lb-field')).filter(
    (el) => (el.textContent ?? '').includes(`${nome} —`) && el.querySelector('.lb-player__name')?.textContent === nome,
  )
  if (achados.length !== 1) throw new Error(`${achados.length} cartões de ${nome}`)
  return achados[0]
}

/** A linha do jogador numa cena do Grupo: o `<li>` do cartão dele. */
export function linhaDoJogador(escopo: ParentNode, nome: string): HTMLLIElement {
  const li = cartaoDoJogador(escopo, nome).closest('li')
  if (!li) throw new Error(`o cartão de ${nome} não é linha do Grupo`)
  return li
}

/** O botão da linha (36 px) que abre e fecha a ficha. */
export function botaoDaLinha(escopo: ParentNode, nome: string): HTMLButtonElement {
  const botao = linhaDoJogador(escopo, nome).querySelector<HTMLButtonElement>('button.lb-grupo__linha')
  if (!botao) throw new Error(`a linha de ${nome} não tem o botão que abre a ficha`)
  return botao
}

/** A ficha aberta do jogador (o painel que o botão da linha controla). */
export function fichaDoJogador(escopo: ParentNode, nome: string): HTMLElement {
  const id = botaoDaLinha(escopo, nome).getAttribute('aria-controls')
  const ficha = id === null ? null : document.getElementById(id)
  if (!ficha) throw new Error(`a ficha de ${nome} não está aberta`)
  return ficha
}

/** Escolhe a aba na ficha aberta (sem nada se já estiver nela). */
export function escolherAba(ficha: HTMLElement, aba: AbaDaFicha): void {
  const rotulo = ABA_ROTULO[aba]
  const botao = Array.from(ficha.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((tab) => tab.textContent === rotulo)
  if (!botao) throw new Error(`a ficha não tem a aba "${rotulo}"`)
  if (botao.getAttribute('aria-selected') !== 'true') act(() => botao.click())
}

/** Abre a ficha do jogador (se fechada) e, com `aba`, escolhe a aba. Devolve a ficha. */
export function abrirFicha(escopo: ParentNode, nome: string, aba?: AbaDaFicha): HTMLElement {
  const botao = botaoDaLinha(escopo, nome)
  if (botao.getAttribute('aria-expanded') !== 'true') act(() => botao.click())
  const ficha = fichaDoJogador(escopo, nome)
  if (aba !== undefined) escolherAba(ficha, aba)
  return ficha
}
