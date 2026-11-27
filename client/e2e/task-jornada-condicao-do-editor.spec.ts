// JORNADA SÓ POR CLIQUES (rework das condições, 0.6.7, docs/design/condicoes-rework/PLANO.md E8): o mestre abre
// Livros › Condições, usa o Sangrando de fábrica como modelo, troca o nome e o número pelo editor, vê o boneco
// mudar, salva no catálogo e põe a condição nova no Pirata pela batalha, onde ela tira o número novo. Nenhum
// setState: o disco é de mentira (helpers/mestreDeMentira.ts), o resto é clique, tecla e texto.
import { test, expect, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

test.use({ trace: 'off', video: 'off', screenshot: 'off' })

const AVENTURA = 'Febre no Porto'
const PASTA = 'C:/appdata/maps/map_febre'
const ID_CENA = 'scene_febre'
const PASTA_DE_MAPAS = 'pasta_porto'
const HEROI = 'Hector'
const PIRATA = 'Pirata'
const MINHA = 'Corte Profundo'
const GRADE = 50
const FOTOS = '../docs/qualidade-de-vida/depois'

function mapa(): MapData {
  const base = createEmptyMap('map_febre', AVENTURA, 16, 10, GRADE)
  const token = (id: string, characterId: string, name: string, x: number, color: string): Token => ({ id, characterId, name, x, y: 5 * GRADE + GRADE / 2, size: 1, image: null, color })
  return {
    ...base,
    floor: [{ id: 'chao', shape: { kind: 'rect', cx: 8 * GRADE, cy: 5 * GRADE, w: 16 * GRADE - 20, h: 10 * GRADE - 20 }, op: 'add', modifiers: {} }],
    tokens: [token('tok-heroi', 'p-heroi', HEROI, 5 * GRADE + GRADE / 2, '#3cff00'), token('tok-pirata', 'p-pirata', PIRATA, 7 * GRADE + GRADE / 2, '#ff5533')],
  }
}

function disco(): Record<string, string> {
  const atributos = { forca: 40, agilidade: 30, percepcao: 20, resistencia: 30, intuicao: 10, espirito: 10, carisma: 10, determinacao: 20 }
  const personagens = [
    { id: 'p-heroi', tipo: 'npc', nome: HEROI, atributos, recursos: { hp: 800, sp: 200 }, maximos: { hp: 800, sp: 200 } },
    { id: 'p-pirata', tipo: 'npc', nome: PIRATA, atributos: { ...atributos, agilidade: 10 }, recursos: { hp: 2000, sp: 50 }, maximos: { hp: 2000, sp: 50 } },
  ]
  const aventura = { version: 1, id: 'adv_febre', name: AVENTURA, startSceneId: ID_CENA, scenes: [{ id: ID_CENA, name: AVENTURA, file: 'map.json' }], sistemaDeRpg: 'one-piece', personagens }
  // A pasta de mapas com o One Piece (é ela que o Livros abre): o índice e o rpg.json dela.
  const indice = { versao: 1, pastas: [{ id: PASTA_DE_MAPAS, nome: 'Porto' }], mapas: [{ chave: 'map_febre', pastaId: PASTA_DE_MAPAS }] }
  const rpg = { versao: 1, sistemaDeRpg: 'one-piece', personagens }
  return {
    [`${PASTA}/map.json`]: serializeMap(mapa()),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    'C:/appdata/pastas/indice.json': JSON.stringify(indice, null, 2),
    [`C:/appdata/pastas/${PASTA_DE_MAPAS}/rpg.json`]: JSON.stringify(rpg, null, 2),
  }
}

test('o mestre faz uma condição do Sangrando pelo editor e ela tira o número novo na batalha, só com cliques', async ({ page }) => {
  test.setTimeout(240_000)
  page.setDefaultTimeout(10_000)
  // O vite frio transforma o app inteiro na 1ª carga.
  page.setDefaultNavigationTimeout(120_000)
  await abrirAventuraDeMentira(page, disco(), AVENTURA, 'COND08')
  await page.getByRole('button', { name: 'Dispensar aviso' }).click()
  await criarPeloEditor(page)
  await usarNaBatalha(page)
})

async function criarPeloEditor(page: Page): Promise<void> {
  // Pelo início: Livros › One Piece › Condições.
  await page.getByRole('complementary', { name: 'Livro do mestre' }).getByRole('button', { name: 'Arquivo', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Voltar ao início', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salvar e sair' }).click()
  await page.getByRole('button', { name: /Livros/ }).first().click()
  await page.getByRole('button', { name: /One Piece/ }).first().click()
  await page.getByRole('tab', { name: 'Condições' }).click()
  const lista = page.getByRole('list', { name: 'Catálogo de condições' })
  await expect(lista.getByRole('listitem')).toHaveCount(35)
  await page.getByRole('group', { name: 'Filtrar pela peça' }).getByRole('button').nth(1).click()
  await page.screenshot({ path: `${FOTOS}/rework-cond-01-livros-condicoes-com-o-filtro.png` })
  await page.getByRole('group', { name: 'Filtrar pela peça' }).getByRole('button').nth(1).click()
  await expect(lista.getByRole('listitem')).toHaveCount(35)

  // O Sangrando de fábrica como modelo: a cópia abre no editor com as peças dele.
  await lista.getByRole('button', { name: /^Sangrando/ }).click()
  await page.getByRole('button', { name: 'Usar como modelo' }).first().click()
  const nome = page.getByRole('textbox', { name: 'Nome', exact: true })
  await nome.fill(MINHA)
  const quanto = page.getByRole('spinbutton', { name: 'Quanto' }).first()
  await expect(quanto).toHaveValue('10')
  // O boneco do editor (o lado da lista tem outro, o da condição escolhida).
  const rodada1 = page.getByRole('complementary', { name: 'Cartão e teste' }).getByRole('article', { name: 'Rodada 1' })
  await expect(rodada1).toContainText('sangra: -10 HP')
  await quanto.fill('25')
  await expect(page.getByRole('article', { name: `Cartão de ${MINHA}` })).toContainText('25')
  await expect(rodada1).toContainText(`sofre com ${MINHA}: -25 HP`)
  await page.screenshot({ path: `${FOTOS}/rework-cond-02-editor-com-pecas-e-boneco.png` })
  await page.getByRole('button', { name: /^Salvar no catálogo/ }).click()
  await expect(lista.getByRole('button', { name: new RegExp(`^${MINHA}`) })).toBeVisible()
}

async function usarNaBatalha(page: Page): Promise<void> {
  // De volta à aventura, pela tela de início (o editor fica aberto depois do Salvar: fecha-se à mão).
  await page.getByRole('dialog', { name: MINHA }).getByRole('button', { name: 'Fechar', exact: true }).click()
  await page.getByRole('button', { name: 'Outros livros' }).click()
  await page.getByRole('button', { name: /Voltar/ }).first().click()
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await page.waitForSelector('canvas')
  const livro = page.getByRole('complementary', { name: 'Livro da mesa' })
  await livro.getByRole('tab', { name: 'Batalha' }).click()
  await livro.getByRole('button', { name: 'Iniciar batalha' }).click()
  await livro.getByRole('combobox', { name: `De que lado ${HEROI} luta` }).selectOption({ label: 'Do lado dos jogadores' })
  await livro.getByRole('button', { name: 'Iniciar com 2' }).click()
  const mesa = page.getByRole('complementary', { name: 'Mesa da batalha' })

  // Na vez do Hector, o mestre põe a condição nova no Pirata pela lista do catálogo.
  await mesa.getByRole('button', { name: /^Pirata .*: menu da carta$/ }).click()
  await page.getByRole('menuitem', { name: /^Pôr selo/ }).click()
  const dialogo = page.getByRole('dialog', { name: `Pôr selo em ${PIRATA}` })
  await dialogo.getByRole('combobox', { name: 'Condição' }).selectOption({ label: MINHA })
  await expect(dialogo).toContainText('25')
  await dialogo.getByRole('button', { name: /^Pôr / }).click()
  await expect(dialogo).toBeHidden()
  const cartaDoPirata = mesa.getByRole('button', { name: /^Pirata .*: menu da carta$/ })
  await expect(cartaDoPirata).toHaveAccessibleName(new RegExp(MINHA))

  // Na vez do Pirata, o lembrete pede o Aplicar: tira os 25 da cópia, não os 10 do Sangrando.
  await mesa.getByRole('button', { name: 'Passar a vez' }).click()
  const lembrete = page.getByRole('group', { name: `${PIRATA} · ${MINHA} · tira 25 de HP direto, sem o Escudo` })
  // A faixa "Vez de Pirata" passa por cima de tudo por uns 2 s: a foto espera ela sair. O lembrete mora na aba Batalha
  // do Livro da mesa, recolhido no modo Minimalista: o marcador "1" da lombada avisa, e o clique nele abre.
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${FOTOS}/rework-cond-03-batalha-com-a-condicao-nova.png` })
  await livro.getByRole('tab', { name: /^Batalha/ }).click()
  await lembrete.getByRole('button', { name: 'Aplicar · -25 HP' }).click()
  const vidaDoPirata = mesa.getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Pirata .*: menu da carta$/ }) })
  await expect(vidaDoPirata).toContainText('1975/2000')
}
