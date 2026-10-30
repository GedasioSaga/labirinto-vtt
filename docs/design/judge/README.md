# Judge: o token do mestre na batalha

Protótipo para você escolher **o estilo** e **o jeito de rodar no app** do Judge: o seu avatar, um juiz de armadura prateada, capa azul e elmo com chifres, montado numa ave grande, com o cartão vermelho na mão. Nada aqui mexe no app (`client/` não mudou).

O modelo foi feito do zero, só com formas simples do three.js (esfera, cone, cilindro, tubo afinado e um lençol para a capa). Nenhuma arte foi tirada de jogo, e as imagens de referência (Final Fantasy Tactics) não entram no repositório.

## Como abrir

Dê dois cliques em `prototipo.html`. Abre no Chrome ou no Edge do PC direto do disco, sem servidor e sem internet.

A batalha falsa já começa sozinha: o Judge sai do token no canto, fica parado respirando e olha para quem tem a vez.

## O que cada controle faz

| Controle | O que acontece |
|---|---|
| Cartões de **Estilo** (teclas 1, 2, 3) | Troca o desenho do Judge no mapa: low-poly pintado, cara de sprite ou detalhado. |
| **Comparar os três lado a lado** | Mostra os três estilos grandes, na mesma pose: de frente com o cartão erguido e de costas. |
| **Jeito no app** (tecla M) | Alterna entre *3D ao vivo* e *Quadros da folha*. A tabela logo abaixo diz o que cada um custa no estilo escolhido. |
| **Próxima vez** (N) | Passa a vez. A próxima ficha ganha o anel dourado e o Judge vira para ela. |
| **Desfazer** (Ctrl+Z ou Z) | Volta a vez anterior e o Judge ergue o cartão vermelho. Fica desligado até existir algo para desfazer. |
| **Reiniciar batalha** (R) | Recomeça. O Judge sai do token de novo. |
| Arrastar fichas e o próprio Judge | Serve para ver o giro em qualquer direção. No modo de quadros dá para ver os passos de 45 graus. O Judge fica da 4ª linha para baixo, para caber inteiro no mapa. |
| **Ver folha inteira** e **Baixar PNG** | Mostram e salvam a folha de quadros do estilo escolhido. |
| **Resolução da folha** (32, 48 ou 64 px por casa) | Fotografa a folha de novo nesse tamanho e mostra quanto ela pesa. Vale só para low-poly e detalhado. |
| **Zoom do mapa** e **Movimento reduzido** | O zoom muda o tamanho da casa. Com movimento reduzido, o giro e o cartão ficam instantâneos, a respiração para e a entrada vira um esmaecer. |

## Os dois jeitos de rodar

**3D ao vivo.** Um canvas WebGL por cima do mapa desenha o modelo a cada quadro. Não baixa nada novo, porque o three.js já vem no app (as transições de batalha carregam sob demanda). O modelo é código, uns 26 KB. A conta é um canvas 3D a mais durante a batalha inteira, desenhando a cada quadro:

| Estilo | Peças | Triângulos |
|---|---|---|
| Low-poly | 85 | 3.370 |
| Sprite | 86 | 8.028 |
| Detalhado | 172 | 63.132 |

Em troca, gira em qualquer ângulo, a cabeça da ave e o elmo viram antes do corpo, e fica nítido em qualquer zoom.

**Quadros da folha.** A página "fotografa" o mesmo 3D em 8 direções e 20 quadros: 12 respirando e 8 do cartão subindo, que descem tocando ao contrário. No app, o Pixi só copia um retângulo da folha, sem 3D nenhum. As limitações:

- O giro anda em passos de 45 graus.
- A cabeça não vira antes do corpo.
- Acima da resolução da folha, a imagem amacia.
- Mexeu no modelo, precisa fotografar de novo.

Peso de cada folha (PNG medido no Chrome; a página mede de novo no seu PC):

| Estilo | 32 px por casa | 48 px por casa | 64 px por casa |
|---|---|---|---|
| Low-poly pintado | 542 KB | 1.023 KB | 1.551 KB |
| Cara de sprite (sempre 16 px) | 75 KB | | |
| Detalhado | 672 KB | 1.349 KB | 2.171 KB |

Aberta na placa de vídeo, cada folha ocupa largura x altura x 4 bytes: 15,8 MB em 48 px e 1,8 MB no sprite. Dá para cortar a folha pela metade espelhando a direção, mas aí o cartão troca de mão. Também dá para encolher o PNG com compressão de paleta (não medi quanto).

## Arquivos

- `prototipo.html`: a página.
- `prototipo.js`: a cena falsa e os dois jeitos.
- `modelo-judge.js`: o modelo e a pose. Os dois jeitos usam a mesma função de pose.
- `vendor/three.min.js` e `vendor/LICENSE`: three.js 0.186.1 (MIT), empacotado como script comum para abrir por `file://`.
- `folhas/`: as três folhas na resolução padrão.
- `ferramentas/gerar-folhas.cjs`: refaz as folhas com `node docs/design/judge/ferramentas/gerar-folhas.cjs`. Com `--medir`, só mede.

## O que eu preciso de você

1. Qual estilo: low-poly pintado, cara de sprite ou detalhado?
2. Qual jeito: 3D ao vivo ou quadros da folha?
3. Viu algo estranho no giro ou no cartão? Rápido, lento, torto, em que momento?
