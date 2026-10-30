# Judge v2 (three.js)

O avatar do mestre refeito do zero em three.js, olhando a pintura de referência: cavaleiro de armadura pesada montado num grifo marrom, capa azul e o cartão vermelho. É só um protótipo; nada aqui mexe no app.

## Como abrir

Dê dois cliques em `prototipo.html`. Abre direto do disco, sem servidor e sem internet (usa o `three.min.js` de `../vendor/`). O modelo é esculpido ao abrir, em uns 2 segundos; uma barra mostra o andamento.

## O que tem na página

1. **Vista grande.** Arraste para girar; solte com embalo e ele continua girando até parar. A roda do mouse aproxima, o duplo clique volta. Com a vista em foco: as setas giram 45 graus, `+` e `-` aproximam, `Home` volta. `C` sobe e baixa o cartão; `P` liga a "Pincelada", um filtro de tinta que vem desligado.
2. **Na mesa de batalha.** A mesma cena falsa da v1: o Judge sai do token no canto, **Próxima vez** (`N`) faz ele virar para quem tem a vez, **Desfazer** (`Ctrl+Z`) ergue o cartão vermelho, e ele respira devagar enquanto espera. As fichas podem ser arrastadas.
3. **Folha de quadros.** Fotografada do próprio 3D: 8 direções, cada uma com 12 quadros respirando e 8 do cartão subindo. A página mostra o peso da folha e deixa ver inteira, baixar o PNG e trocar entre 32, 48 e 64 px por casa.

Movimento reduzido do Windows é respeitado: o giro, o cartão e a entrada viram troca direta ou esmaecimento, e a respiração para.

## O que mudou da v1

- **Esculpido, não montado.** Cada peça é uma forma contínua feita de campos de distância, sem bola colada em cilindro.
- **Grifo marrom** no lugar do chocobo amarelo: peito fundo de penugem, coxas de pena, garras curvas, bico de rapina, olho vivo e testeira de metal com orelhas.
- **Penas de verdade:** asas de penas longas em camadas, cauda em leque e cerca de 570 tufos que deixam a silhueta peluda.
- **Armadura de placas prateada:** couraça com quilha, faldas em degrau, ombreiras grandes de três lâminas, braços cheios com cotoveleira, elmo fechado com fenda e chifres largos de touro.
- **Capa azul larga** que desce pelos flancos, com dobras e vento; sela, manta, estribos e rédeas que seguem a cabeça da ave.
- **Luz de pintura:** céu frio, contraluz forte e sombra de ambiente nas dobras. O vermelho do cartão fica fora do ajuste de tons, para não desbotar em laranja.

## Peso

| O quê | Tamanho |
| --- | --- |
| `escultura.js` + `modelo.js` (o modelo inteiro, gerado ao abrir) | 97 KB |
| `prototipo.js` + `prototipo.html` (só a página de teste) | 71 KB |
| `three.min.js` (já usado pelo app, em `../vendor/`) | 726 KB |
| Folha de quadros a 48 px por casa (PNG de 2.880 x 1.440 px) | cerca de 2,0 MB |
| Malha de uma cópia | 36 peças, cerca de 380 mil triângulos |

A página mostra os números do PC em que abrir (tempo para esculpir, triângulos, peso da folha).

## O que ainda fica abaixo da pintura

- As ombreiras e os braços ainda são lisos e redondos demais; falta o metal batido, com risco e brilho duro.
- A testeira da ave é uma calota redonda; na pintura ela é mais comprida e angulosa, como a de um cavalo de guerra.
- A capa cai pesada pelos flancos, mas não esvoaça para trás como na pintura.
- A ave fica em pé. A pintura mostra a ave saltando, e esse salto não existe aqui.
- As penas são recortes de textura: bem de perto aparecem bordas serrilhadas e algumas manchas de tufo no pescoço.

## Como foi conferido

Só por prints da página num Chrome sem placa de vídeo (renderização por software), comparados com a pintura. Não rodei testes nem medi desempenho (regra do usuário) e não abri numa placa de vídeo real.

## Arquivos

- `prototipo.html`: a página.
- `prototipo.js`: a vista grande, a mesa de batalha e a folha de quadros.
- `modelo.js`: o Judge (escultura das peças, esqueleto, pose, luzes).
- `escultura.js`: as ferramentas (campos de distância, malha, texturas pintadas).
