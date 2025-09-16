# Configuração do Firestore para Portfolio Tracker

## 🔧 Como configurar as regras de segurança

### 1. Acesse o Firebase Console
- Vá para: https://console.firebase.google.com
- Selecione o projeto: `optimuspy-54238`

### 2. Configure as Regras do Firestore
1. No menu lateral, clique em **Firestore Database**
2. Clique na aba **Regras**
3. **TEMPORÁRIO** - Cole as regras abaixo para teste:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // TEMPORÁRIO - Permitir tudo para usuários autenticados
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. Clique em **Publicar**

### 3. Após testar, usar regras de produção
Depois que confirmar que funciona, substitua pelas regras de produção:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // Portfolio collection rules
    match /portfolio/{document} {
      allow read, write: if request.auth != null &&
        request.auth.uid == resource.data.userId;
      allow create: if request.auth != null &&
        request.auth.uid == request.resource.data.userId;
    }

    // Allow users to read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## ⚡ Status Atual
- ✅ Logs de debug adicionados
- ✅ OrderBy removido temporariamente (evita erro de índice)
- ⏳ **AÇÃO NECESSÁRIA**: Configurar regras no Firebase Console

## 🐛 Debug
Abra o Console do navegador (F12) para ver os logs detalhados:
- Login: logs com 🚀 e 📧
- Portfolio: logs com 📊, ➕, e 💾