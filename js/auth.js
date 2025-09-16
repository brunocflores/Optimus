import { auth } from './firebase-config.js';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

class AuthManager {
  constructor() {
    this.currentUser = null;
    this.initializeAuthListeners();
    this.setupEventListeners();
  }

  initializeAuthListeners() {
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.handleAuthStateChange(user);
    });
  }

  setupEventListeners() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');

    loginForm?.addEventListener('submit', (e) => this.handleLogin(e));
    registerForm?.addEventListener('submit', (e) => this.handleRegister(e));
    showRegisterBtn?.addEventListener('click', (e) => this.showRegisterForm(e));
    showLoginBtn?.addEventListener('click', (e) => this.showLoginForm(e));
    logoutBtn?.addEventListener('click', (e) => this.handleLogout(e));
  }

  async handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
      this.setButtonLoading(submitBtn, true);
      await signInWithEmailAndPassword(auth, email, password);
      this.showMessage('Login realizado com sucesso!', 'success');
    } catch (error) {
      console.error('Login error:', error);
      this.showMessage(this.getErrorMessage(error.code), 'error');
    } finally {
      this.setButtonLoading(submitBtn, false);
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');

    try {
      this.setButtonLoading(submitBtn, true);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      this.showMessage('Conta criada com sucesso!', 'success');
    } catch (error) {
      console.error('Registration error:', error);
      this.showMessage(this.getErrorMessage(error.code), 'error');
    } finally {
      this.setButtonLoading(submitBtn, false);
    }
  }

  async handleLogout(e) {
    e.preventDefault();
    
    try {
      await signOut(auth);
      this.showMessage('Logout realizado com sucesso!', 'success');
    } catch (error) {
      console.error('Logout error:', error);
      this.showMessage('Erro ao fazer logout', 'error');
    }
  }

  showRegisterForm(e) {
    e.preventDefault();
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
  }

  showLoginForm(e) {
    e.preventDefault();
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-form').classList.remove('hidden');
  }

  handleAuthStateChange(user) {
    const loginScreen = document.getElementById('login-screen');
    const portfolioScreen = document.getElementById('portfolio-screen');

    if (user) {
      loginScreen.classList.add('hidden');
      portfolioScreen.classList.remove('hidden');
      
      if (window.portfolioManager) {
        window.portfolioManager.loadPortfolio();
      }
    } else {
      loginScreen.classList.remove('hidden');
      portfolioScreen.classList.add('hidden');
    }
  }

  setButtonLoading(button, loading) {
    if (loading) {
      button.disabled = true;
      button.textContent = 'Carregando...';
      button.classList.add('loading');
    } else {
      button.disabled = false;
      button.classList.remove('loading');
      
      if (button.closest('#login-form')) {
        button.textContent = 'Entrar';
      } else if (button.closest('#register-form')) {
        button.textContent = 'Registrar';
      }
    }
  }

  showMessage(message, type) {
    const existingMessage = document.querySelector('.error-message, .success-message');
    if (existingMessage) {
      existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
    messageDiv.textContent = message;

    const activeForm = document.querySelector('.auth-form:not(.hidden)');
    if (activeForm) {
      activeForm.parentNode.insertBefore(messageDiv, activeForm);
    }

    setTimeout(() => {
      messageDiv.remove();
    }, 5000);
  }

  getErrorMessage(errorCode) {
    const errorMessages = {
      'auth/email-already-in-use': 'Este email já está sendo usado',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres',
      'auth/invalid-email': 'Email inválido',
      'auth/user-not-found': 'Usuário não encontrado',
      'auth/wrong-password': 'Senha incorreta',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet',
      'auth/invalid-credential': 'Email ou senha incorretos'
    };

    return errorMessages[errorCode] || 'Erro desconhecido. Tente novamente';
  }

  getCurrentUser() {
    return this.currentUser;
  }
}

export default new AuthManager();