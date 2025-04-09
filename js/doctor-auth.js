class DoctorAuth {
    constructor() {
        this.form = document.getElementById('doctor-login-form');
        this.doctorId = document.getElementById('doctor-id');
        this.password = document.getElementById('doctor-password');
        this.togglePassword = document.querySelector('.toggle-password');
        this.forgotPassword = document.getElementById('forgot-password');
        
        this.setupEventListeners();
        this.checkAuth();
    }

    setupEventListeners() {
        this.form?.addEventListener('submit', (e) => this.handleLogin(e));
        this.togglePassword?.addEventListener('click', () => this.togglePasswordVisibility());
        this.forgotPassword?.addEventListener('click', (e) => this.handleForgotPassword(e));
    }

    checkAuth() {
        const currentDoctor = localStorage.getItem('currentDoctor');
        const basePath = '/dentalcare';
        if (!currentDoctor && 
            window.location.pathname !== basePath + '/doctor-login.html') {
            window.location.href = basePath + '/doctor-login.html';
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        try {
            const doctorId = this.doctorId.value;
            const password = this.password.value;

            // Add loading state
            const submitButton = this.form.querySelector('button[type="submit"]');
            submitButton.classList.add('loading');
            submitButton.disabled = true;

            // Get doctor from database
            const doctor = await dentalDB.getDoctorById(doctorId);
            
            if (!doctor) {
                this.showError('ID de doctor no encontrado');
                return;
            }

            // Hash the input password
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            // Compare passwords
            if (hashedPassword === doctor.password) {
                // Store doctor info without sensitive data
                const { password, ...doctorInfo } = doctor;
                localStorage.setItem('currentDoctor', JSON.stringify(doctorInfo));
                
                // Show success message and redirect
                this.showToast('Inicio de sesión exitoso', 'success');
                setTimeout(() => {
                    window.location.href = '/dentalcare/doctor-dashboard.html';
                }, 1000);
            } else {
                this.showError('Contraseña incorrecta');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Error al iniciar sesión');
        } finally {
            // Remove loading state
            const submitButton = this.form.querySelector('button[type="submit"]');
            submitButton.classList.remove('loading');
            submitButton.disabled = false;
        }
    }

    togglePasswordVisibility() {
        const type = this.password.type === 'password' ? 'text' : 'password';
        this.password.type = type;
        this.togglePassword.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        
        const doctorId = this.doctorId.value;
        if (!doctorId) {
            this.showError('Por favor, ingresa tu ID de doctor');
            return;
        }

        try {
            const doctor = await dentalDB.getDoctorById(doctorId);
            if (doctor) {
                // In a real application, send recovery email
                this.showToast('Se ha enviado un correo de recuperación a ' + doctor.email, 'success');
            } else {
                this.showError('ID de doctor no encontrado');
            }
        } catch (error) {
            console.error('Password recovery error:', error);
            this.showError('Error al procesar la solicitud');
        }
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    handleLogout() {
        localStorage.removeItem('currentDoctor');
        window.location.href = '/dentalcare/login.html';
    }
}

// Initialize authentication
const doctorAuth = new DoctorAuth();
