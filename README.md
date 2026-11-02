# Amigo Secreto com QR

Página estática para sortear o amigo secreto da família e entregar o resultado por QR code, sem servidor. Roda inteira no celular do organizador.

## Como funciona
1. **Organizador** cadastra participantes (nome, família, e se é criança, quem é o responsável) e os dados do evento. Uma lista pronta pode ser carregada por um link privado `#setup=...`.
2. **Sortear** gera os pares respeitando: ninguém tira a si mesmo; ninguém tira alguém da própria família (opcional); responsável e criança nunca se tiram.
3. Para cada pessoa é gerado um **link secreto** `#t=<chave>.<iv>.<cifrado>`: o nome sorteado vai cifrado (AES-GCM) e a chave está dentro do próprio link. Ou seja, o QR é o segredo. O organizador não vê o resultado a não ser que escaneie o QR de alguém.
4. **Mostrar QRs um por um**: a tela diz "Vez de Marco", ele escaneia com a câmera, abre o link e toca no presente para revelar. Crianças aparecem logo após o responsável, que escaneia por elas.
5. **Lista de QRs**: reabrir o QR de quem faltou ou enviar o link por WhatsApp.

O sorteio fica no armazenamento local do navegador do organizador; se for apagado, é preciso sortear de novo.

## Cartinha e bilhetes (Firestore)
Depois de revelar, cada pessoa escreve a **cartinha** (até 3 desejos com categoria, tamanho e cores, "nem pensar", uma dica) e vê a cartinha de quem tirou. Há ainda **bilhetes anônimos** nos dois sentidos. O organizador vê **quem já escreveu** (nunca o conteúdo) e pode cutucar pelo WhatsApp.

Isso usa um projeto Firebase próprio (`amigo-secreto-deleu-2026`, Firestore em São Paulo, plano gratuito) sem login:
- Nenhum nome vai ao banco. Os documentos são indexados por hashes: `eventId = sha256("event|segredo")` e `wid = sha256("segredo|nome")`. O segredo é sorteado a cada sorteio e viaja cifrado dentro de cada QR; sorteios antigos (sem segredo) usam o título do evento.
- Regras em `firestore.rules`: leitura por id direto (sem listagem), escrita só com os campos e tamanhos esperados, bilhetes nunca editados nem apagados.
- Deploy das regras: `firebase deploy --only firestore`.

## Arquivos
- `index.html`, `styles.css`, `app.js`: o app.
- `qrcode.js`: pacote npm `qrcode` 1.5.4 (MIT) empacotado localmente a partir de `lib/browser.js`.
- `wish.js`: módulo da cartinha (Firebase Web SDK 11 via gstatic, hashes, leitura em tempo real).
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `.firebaserc`: configuração do Firestore.

## Rodar localmente
```bash
cd ~/Desktop/AMIGO-SECRETO && python3 -m http.server 8766
```
A cifra usa WebCrypto, que exige HTTPS ou localhost.
