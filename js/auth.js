class DentalAuth {
    constructor() {
        this.initializeAuth();
    }

    async initializeAuth() {
        // Wait for DB initialization
        await dentalDB.init();
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        // Auth tabs listeners
        const authTabs = document.querySelector('.auth-tabs');
        if (authTabs) {
            authTabs.addEventListener('click', (e) => {
                if (e.target.classList.contains('tab-btn')) {
                    this.switchAuthTab(e.target.dataset.tab);
                }
            });
        }

        // Form submission listeners
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin(e.target);
            });
        }

        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister(e.target);
            });
        }
    }

    switchAuthTab(tab) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    }

    async handleLogin(form) {
        const email = form.querySelector('input[type="email"]').value;
        const password = form.querySelector('input[type="password"]').value;
        const isDoctor = window.location.pathname.includes('doctor');

        try {
            const user = await dentalDB.getUserByEmail(email, isDoctor ? 'doctor' : 'patient');
            if (user && user.password === password) {
                // Store user session
                localStorage.setItem('currentUser', JSON.stringify(user));
                // Redirect to main app
                window.location.href = '/dentalcare/index.html';
            } else {
                this.showError('Credenciales inválidas');
            }
        } catch (error) {
            console.error('Error during login:', error);
            this.showError('Error al iniciar sesión');
        }
    }

    async handleRegister(form) {
        const isDoctor = window.location.pathname.includes('doctor');
        const userData = {
            name: form.querySelector('input[name="name"]').value,
            email: form.querySelector('input[name="email"]').value,
            password: form.querySelector('input[name="password"]').value,
            birthDate: form.querySelector('input[name="birthDate"]').value,
            role: isDoctor ? 'doctor' : 'patient',
            registerDate: new Date().toISOString()
        };

        // Si es doctor, agregar el ID
        if (isDoctor) {
            userData.id = form.querySelector('input[name="doctorId"]').value;
        }

        try {
            const user = await dentalDB.addUser(userData);
            // Store user session
            localStorage.setItem('currentUser', JSON.stringify(user));
            // Redirect to main app
            window.location.href = '/dentalcare/index.html';
        } catch (error) {
            console.error('Error during registration:', error);
            this.showError('Error al registrar usuario. ' + error.message);
        }
    }

    checkAuth() {
        const currentUser = localStorage.getItem('currentUser');
        const basePath = '/dentalcare';
        if (!currentUser && 
            window.location.pathname !== basePath + '/login.html' && 
            window.location.pathname !== basePath + '/patient-login.html' && 
            window.location.pathname !== basePath + '/doctor-login.html') {
            window.location.href = basePath + '/login.html';
        }
    }

    handleLogout() {
        localStorage.removeItem('currentUser');
        window.location.href = '/dentalcare/login.html';
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        // Remover cualquier mensaje de error anterior
        const oldError = document.querySelector('.error-message');
        if (oldError) {
            oldError.remove();
        }

        // Insertar el nuevo mensaje
        const form = document.querySelector('form');
        if (form) {
            form.insertBefore(errorDiv, form.firstChild);
        }

        // Remover después de 3 segundos
        setTimeout(() => {
            errorDiv.remove();
        }, 3000);
    }
}

// Initialize authentication
const auth = new DentalAuth();
