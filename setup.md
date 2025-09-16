# Setup Rápido - Portfolio Tracker PWA

## 🔥 Firebase Configuration

### 1. Criar Projeto Firebase
1. Vá para https://console.firebase.google.com
2. Clique em "Adicionar projeto"
3. Nome: `portfolio-tracker-[seu-nome]`
4. Desabilite Google Analytics (opcional)

### 2. Configurar Authentication
1. No console Firebase, vá em "Authentication"
2. Clique em "Começar"
3. Vá na aba "Sign-in method"
4. Habilite "Email/senha"

### 3. Configurar Firestore
1. Vá em "Firestore Database"
2. Clique em "Criar banco de dados"
3. Inicie em "modo de teste"
4. Escolha a localização (us-central1)

### 4. Obter Configurações
1. Vá em "Configurações do projeto" (ícone de engrenagem)
2. Role até "Seus apps"
3. Clique no ícone da web `</>`
4. Nome do app: `Portfolio Tracker`
5. Marque "Configurar Firebase Hosting"
6. Copie o objeto `firebaseConfig`

### 5. Configurar o App
Edite o arquivo `js/firebase-config.js` e substitua:

```javascript
const firebaseConfig = {
  apiKey: "Cole aqui",
  authDomain: "Cole aqui", 
  projectId: "Cole aqui",
  storageBucket: "Cole aqui",
  messagingSenderId: "Cole aqui",
  appId: "Cole aqui"
};
```

## 🔒 Regras de Segurança Firestore

1. No console Firebase, vá em "Firestore Database"
2. Clique na aba "Regras"
3. Substitua o conteúdo por:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Portfolio documents
    match /portfolio/{document} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.userId;
    }
  }
}
```

4. Clique em "Publicar"

## 🚀 Executar o App

### Opção 1: HTTP Server (Recomendado)
```bash
# Se não tiver http-server instalado
npm install -g http-server

# Na pasta do projeto
http-server -p 3000

# Acesse: http://localhost:3000
```

### Opção 2: Python
```bash
# Python 3
python -m http.server 3000

# Python 2
python -SimpleHTTPServer 3000
```

### Opção 3: Node.js
```bash
npm install
npm start
```

## 📋 Checklist de Configuração

- [ ] Projeto Firebase criado
- [ ] Authentication habilitado (Email/Senha)
- [ ] Firestore Database criado
- [ ] Regras de segurança configuradas
- [ ] Arquivo `firebase-config.js` atualizado
- [ ] Servidor HTTP executando
- [ ] App abrindo no navegador

## 🧪 Testar o App

1. **Cadastro**: Crie uma conta com email/senha
2. **Login**: Faça login com a conta criada
3. **Adicionar Ação**: Clique em "+ Adicionar Ação"
   - Código: PETR4
   - Quantidade: 100
   - Preço: 35.50
   - Data: hoje
4. **Dashboard**: Veja os cards de P&L atualizarem

## 🎨 Personalização

### Cores Vaporwave
Edite as variáveis CSS em `css/styles.css`:

```css
:root {
  --neon-pink: #ff007f;     /* Rosa neon */
  --neon-cyan: #00ffff;     /* Ciano */
  --neon-purple: #8a2be2;   /* Roxo */
  --neon-yellow: #ffff00;   /* Amarelo */
  --neon-green: #39ff14;    /* Verde */
}
```

### Adicionar Ícones PWA
1. Crie ícones PNG nas dimensões: 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512
2. Coloque na pasta `icons/`
3. Nomeie como: `icon-72x72.png`, `icon-96x96.png`, etc.

## 🐛 Problemas Comuns

### "Firebase não definido"
- Verifique se o arquivo `firebase-config.js` está correto
- Confirme se as URLs estão certas no HTML

### "Permissão negada" no Firestore
- Verifique as regras de segurança
- Confirme se o usuário está logado

### Cotações não carregam
- As APIs podem ter limitação
- Dados mock serão usados como fallback

### PWA não instala
- Use HTTPS ou localhost
- Verifique se o manifest.json está correto

## 📱 Deploy no GitHub Pages

### 1. Preparar o Repositório
```bash
# Inicializar git (se não for um repo ainda)
git init

# Adicionar todos os arquivos
git add .

# Fazer commit inicial
git commit -m "Initial commit: Portfolio Tracker PWA"

# Criar repositório no GitHub e conectar
git remote add origin https://github.com/SEU_USUARIO/portfolio-tracker.git
git branch -M main
git push -u origin main
```

### 2. Configurar GitHub Pages
1. No repositório GitHub, vá em **Settings**
2. No menu lateral, clique em **Pages**
3. Em **Source**, selecione **Deploy from a branch**
4. Escolha **main** como branch
5. Deixe **/ (root)** como pasta
6. Clique em **Save**

### 3. Ajustar PWA para GitHub Pages
Edite o arquivo `manifest.json`:

```json
{
  "name": "Portfolio Tracker",
  "short_name": "Portfolio",
  "start_url": "/portfolio-tracker/",
  "scope": "/portfolio-tracker/",
  ...
}
```

### 4. Configurar Firebase para HTTPS
No console Firebase:

1. **Authentication → Settings → Authorized domains**
   - Adicione: `seuusuario.github.io`

2. **Project Settings → General**
   - Em **Your apps**, edite as configurações
   - Adicione o domínio GitHub Pages

### 5. Acessar o App
- URL: `https://seuusuario.github.io/nome-do-repo/`
- O deploy pode levar alguns minutos

### 6. Personalizar Domínio (Opcional)
1. Compre um domínio (ex: `meuportfolio.com`)
2. Configure DNS apontando para GitHub Pages
3. No repo, vá em Settings → Pages → Custom domain
4. Adicione seu domínio personalizado

### 📋 Checklist Deploy GitHub Pages
- [ ] Repositório criado no GitHub
- [ ] Código commitado e pushed
- [ ] GitHub Pages ativado
- [ ] Domínio autorizado no Firebase
- [ ] App funcionando na URL do GitHub Pages
- [ ] PWA instalável via HTTPS

### 🔄 Atualizações Automáticas
Sempre que fizer push para a branch `main`:
```bash
git add .
git commit -m "Update: nova funcionalidade"
git push
```

O GitHub Pages atualiza automaticamente!

## 🔄 Próximos Passos

Após o setup básico:
1. Adicione ícones PWA personalizados
2. Configure APIs de cotação reais
3. Implemente funcionalidades avançadas
4. Deploy em produção

---

**🎉 Parabéns! Seu Portfolio Tracker está pronto!**