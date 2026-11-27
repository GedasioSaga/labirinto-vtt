// JORNADA SÓ POR CLIQUES (rework do editor de habilidades, 0.6.5, PLANO.md E8): o mestre cria a Overload de
// transformação do exemplo do dono ("A Caçada Começa") pelo editor da ficha e a usa na batalha. Nenhum
// setState: o disco é de mentira (helpers/mestreDeMentira.ts), o resto é clique, tecla e texto.
import { test, expect, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

test.use({ trace: 'off', video: 'off', screenshot: 'off' })

const AVENTURA = 'Caçada no Porto'
const PASTA = 'C:/appdata/maps/map_cacada'
const ID_CENA = 'scene_cacada'
const HEROI = 'Alexei'
const PIRATA = 'Pirata'
const GRADE = 50
const FOTOS = '../docs/qualidade-de-vida/depois'

function mapa(): MapData {
  const base = createEmptyMap('map_cacada', AVENTURA, 16, 10, GRADE)
  const token = (id: string, characterId: string, name: string, x: number, color: string): Token => ({ id, characterId, name, x, y: 5 * GRADE + GRADE / 2, size: 1, image: null, color })
  return {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: 8 * GRADE, cy: 5 * GRADE, w: 16 * GRADE - 20, h: 10 * GRADE - 20 }, op: 'add', modifiers: {} }],
    tokens: [token('tok-heroi', 'p-heroi', HEROI, 5 * GRADE + GRADE / 2, '#3cff00'), token('tok-pirata', 'p-pirata', PIRATA, 6 * GRADE + GRADE / 2, '#ff5533')],
  }
}

function disco(): Record<string, string> {
  const atributos = { forca: 40, agilidade: 30, percepcao: 20, resistencia: 30, intuicao: 10, espirito: 10, carisma: 10, determinacao: 20 }
  const aventura = {
    version: 1,
    id: 'adv_cacada',
    name: AVENTURA,
    startSceneId: ID_CENA,
    scenes: [{ id: ID_CENA, name: AVENTURA, file: 'map.json' }],
    sistemaDeRpg: 'one-piece',
    personagens: [
      { id: 'p-heroi', tipo: 'npc', nome: HEROI, atributos, recursos: { hp: 800, sp: 200 }, maximos: { hp: 800, sp: 200 } },
      { id: 'p-pirata', tipo: 'npc', nome: PIRATA, atributos: { ...atributos, agilidade: 10 }, recursos: { hp: 2000, sp: 50 }, maximos: { hp: 2000, sp: 50 } },
    ],
  }
  return { [`${PASTA}/map.json`]: serializeMap(mapa()), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

test('o mestre cria a Overload A Caçada Começa pelo editor e a usa na batalha, só com cliques', async ({ page }) => {
  test.setTimeout(240_000)
  page.setDefaultTimeout(10_000)
  await abrirAventuraDeMentira(page, disco(), AVENTURA, 'CACA01')
  await jornada(page)
})

async function jornada(page: Page): Promise<void> {
  const livro = page.getByRole('complementary', { name: 'Livro da mesa' })
  await page.getByRole('button', { name: 'Dispensar aviso' }).click()
  // A batalha começa antes: o Alexei é NPC do lado dos jogadores, e o mestre age por ele (o jogador joga na tela própria).
  await livro.getByRole('tab', { name: 'Batalha' }).click()
  await livro.getByRole('button', { name: 'Iniciar batalha' }).click()
  await livro.getByRole('combobox', { name: `De que lado ${HEROI} luta` }).selectOption({ label: 'Do lado dos jogadores' })
  await livro.getByRole('button', { name: 'Iniciar com 2' }).click()
  const mesa = page.getByRole('complementary', { name: 'Mesa da batalha' })
  const cartaDoHeroi = mesa.getByRole('button', { name: `${HEROI} : menu da carta` })
  await cartaDoHeroi.click()
  await page.getByRole('menuitem', { name: /^Abrir a ficha/ }).click()
  const ficha = page.getByRole('dialog', { name: HEROI })
  await ficha.getByRole('button', { name: 'Editar' }).click()
  await ficha.getByRole('tab', { name: 'Transformações' }).click()
  await ficha.getByRole('button', { name: '+ Transformação' }).click()
  // O editor abre já com a peça Transformação (3 turnos, +1 ação, Agilidade +20, Fadiga -10 por 2 turnos).
  const editor = page.getByRole('dialog', { name: 'Editor da habilidade' })
  await expect(editor.getByRole('region', { name: 'Transformação' })).toBeVisible()
  await editor.getByRole('textbox', { name: 'Nome' }).fill('A Caçada Começa')
  // Os cartões da Ação são rótulos com o rádio escondido para leitor de tela: o clique é no cartão, como o mouse faz.
  await editor.getByRole('radiogroup', { name: 'Ação' }).locator('label').filter({ hasText: /^Overload/ }).click()
  await expect(editor.getByRole('radio', { name: /^Overload/ })).toBeChecked()
  await editor.locator('label').filter({ hasText: /^Cada ataque deixa uma marca/ }).click()
  await expect(editor.getByRole('checkbox', { name: /^Cada ataque deixa uma marca/ })).toBeChecked()
  await expect(editor.getByRole('spinbutton', { name: 'Quantos turnos' })).toHaveValue('3')
  await expect(editor.getByRole('spinbutton', { name: 'Ações a mais' })).toHaveValue('1')
  await expect(editor.getByRole('spinbutton', { name: 'Muda: quanto' })).toHaveValue('20')
  await expect(editor.getByRole('spinbutton', { name: 'Fadiga: quanto' })).toHaveValue('-10')
  await page.screenshot({ path: `${FOTOS}/rework-hab-01-editor-com-as-pecas.png` })
  await editor.getByRole('button', { name: /^Salvar na ficha/ }).click()
  await expect(editor).toBeHidden()
  // A ficha: a lista única com o filtro Transformações, a forma nova nela. O Salvar da ficha grava.
  await expect(ficha.getByRole('button', { name: 'Abrir A Caçada Começa no editor' })).toBeVisible()
  await page.screenshot({ path: `${FOTOS}/rework-hab-02-ficha-com-o-filtro-transformacoes.png` })
  await ficha.getByRole('button', { name: 'Salvar', exact: true }).click()
  await ficha.getByRole('button', { name: 'Fechar', exact: true }).click()
  await expect(ficha).toBeHidden()

  // Na vez do Alexei: ligar a forma e atacar o Pirata duas vezes.
  await mesa.getByRole('button', { name: /^Transformação 1 forma/ }).click()
  await page.getByRole('list', { name: 'Transformações' }).getByRole('button', { name: /^A Caçada Começa LIVRE/ }).click()
  const forma = page.getByRole('form', { name: 'A Caçada Começa' })
  await expect(forma).toContainText(/AGI30 → vai para\s*50/)
  await forma.getByRole('group', { name: 'Que ação você gastou?' }).locator('label').filter({ hasText: /^Livre/ }).click()
  await forma.getByRole('button', { name: /^Ativar/ }).click()
  await expect(forma).toBeHidden()
  await page.waitForTimeout(800)
  // Dois ataques na mesma vez (+1 ação): sem desvio, o Pirata nem reage.
  const lancar = mesa.getByRole('button', { name: /^Lançar .* em Pirata$/ })
  const cartaDoPirata = mesa.getByRole('button', { name: /^Pirata .*: menu da carta$/ })
  const vidaDoPirata = mesa.getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Pirata .*: menu da carta$/ }) })
  await lancar.click()
  await expect(mesa).toContainText('Alexei usa Mão nua em Pirata (Overload): 40 sem reação')
  await expect(vidaDoPirata).toContainText('HP 1960 de 2000')
  await expect(cartaDoPirata).toHaveAccessibleName(/Marcado/)
  // O 2º golpe do dono no marcado dá o dobro (80); a marca usada some e o acerto deixa outra.
  await lancar.click()
  await expect(vidaDoPirata).toContainText('HP 1880 de 2000')
  await expect(cartaDoPirata).toHaveAccessibleName(/Marcado/)
  await page.screenshot({ path: `${FOTOS}/rework-hab-03-batalha-com-a-overload-e-a-marca.png` })

  // Dura 3 vezes depois da que ligou: no fim da 3ª desliga sozinha e deixa a Fadiga.
  const passar = mesa.getByRole('button', { name: 'Passar a vez' })
  for (let vezes = 0; vezes < 8; vezes += 1) await passar.click()
  const vezDoHeroi = mesa.getByRole('listitem').filter({ has: page.getByRole('button', { name: `${HEROI} : menu da carta` }) })
  await expect(mesa).toContainText('Rodada 5')
  await expect(vezDoHeroi).toContainText('Fadiga 2')
  await expect(mesa.getByRole('button', { name: /^Transformação 1 forma/ })).toBeVisible()
  await expect(vidaDoPirata).toContainText('HP 1880 de 2000')
}
