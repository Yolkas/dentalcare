class DentalCareApp {
    constructor() {
        this.currentUser = null;
        this.currentStream = null;
        this.facingMode = 'environment'; // Start with back camera
        this.showGrid = false;
        this.deferredPrompt = null; // Para la instalación de PWA
        this.initializeApp();
    }

    async initializeApp() {
        // Wait for DB initialization
        await dentalDB.init();
        // Check authentication
        this.checkAuth();
        this.setupEventListeners();
        this.loadUserData();
        this.setupPWA();
        this.setupServiceWorker();
        this.handlePWAInstallation();
    }

    checkAuth() {
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
            // If no user is logged in, redirect to login page
            window.location.href = '/login.html';
            return;
        }
        this.currentUser = JSON.parse(currentUser);
        this.loadUserData();
    }

    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/sw.js');
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        }
    }

    setupEventListeners() {
        // Navigation listeners
        document.querySelector('nav').addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem) {
                this.navigateTo(navItem.dataset.page);
            }
        });

        // Page specific listeners
        document.getElementById('new-appointment').addEventListener('click', () => {
            this.showNewAppointmentModal();
        });

        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // AR Camera listeners
        document.getElementById('capture-btn')?.addEventListener('click', () => {
            this.captureImage();
        });

        document.getElementById('compare-btn')?.addEventListener('click', () => {
            this.compareDental();
        });

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => this.navigateToPage(item.dataset.page));
        });

        // New appointment button
        const newAppointmentBtn = document.getElementById('new-appointment');
        const appointmentModal = document.getElementById('appointment-modal');
        const closeModalBtn = document.querySelector('.close-modal');
        const cancelBtn = document.querySelector('.cancel-btn');
        const appointmentForm = document.getElementById('new-appointment-form');

        // Set minimum date for appointment
        const dateInput = document.getElementById('appointment-date');
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        const localNow = new Date(now - tzOffset);
        dateInput.min = localNow.toISOString().slice(0, 16);

        // Open modal
        newAppointmentBtn.addEventListener('click', () => {
            appointmentModal.classList.add('active');
            // Reset form
            appointmentForm.reset();
            // Set default date to tomorrow
            const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            dateInput.value = new Date(tomorrow - tzOffset).toISOString().slice(0, 16);
        });

        // Close modal functions
        const closeModal = () => appointmentModal.classList.remove('active');
        closeModalBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        appointmentModal.addEventListener('click', (e) => {
            if (e.target === appointmentModal) closeModal();
        });

        // Handle form submission
        appointmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const appointmentData = {
                title: document.getElementById('appointment-title').value,
                date: new Date(document.getElementById('appointment-date').value).toISOString(),
                doctor: document.getElementById('appointment-doctor').value,
                type: document.getElementById('appointment-type').value,
                description: document.getElementById('appointment-description').value,
                symptoms: document.getElementById('appointment-symptoms').value || null,
                userEmail: this.currentUser.email,
                status: 'scheduled',
                createdAt: new Date().toISOString()
            };

            try {
                await dentalDB.addAppointment(appointmentData);
                
                // Show success message
                const toast = document.createElement('div');
                toast.className = 'toast success';
                toast.textContent = '¡Cita agendada con éxito!';
                document.body.appendChild(toast);
                
                setTimeout(() => toast.remove(), 3000);
                
                // Close modal and refresh appointments
                closeModal();
                const appointments = await dentalDB.getAppointments(this.currentUser.email);
                this.updateAppointmentHistory(appointments);
                
                // Update next appointment
                const nextAppointment = await dentalDB.getNextAppointment(this.currentUser.email);
                this.updateNextAppointment(nextAppointment);
            } catch (error) {
                console.error('Error al agendar cita:', error);
                const toast = document.createElement('div');
                toast.className = 'toast error';
                toast.textContent = 'Error al agendar la cita. Por favor intenta de nuevo.';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }
        });
    }

    async loadUserData() {
        if (!this.currentUser) {
            console.error('No hay usuario activo');
            return;
        }

        // Format dates using Intl.DateTimeFormat for better localization
        const dateFormatter = new Intl.DateTimeFormat('es', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Load user profile
        document.getElementById('user-name').textContent = this.currentUser.name;
        
        // Format birth date
        const birthDate = new Date(this.currentUser.birthDate);
        document.getElementById('user-birth').textContent = 
            birthDate.toLocaleDateString('es', { year: 'numeric', month: 'long', day: 'numeric' });
        
        // Format and display registration date
        const registerDate = new Date(this.currentUser.registerDate);
        if (!isNaN(registerDate.getTime())) {
            document.getElementById('user-register-date').textContent = dateFormatter.format(registerDate);
        } else {
            console.error('Fecha de registro inválida:', this.currentUser.registerDate);
            document.getElementById('user-register-date').textContent = 'Fecha no disponible';
        }

        // Load next appointment
        const nextAppointment = await dentalDB.getNextAppointment(this.currentUser.email);
        this.updateNextAppointment(nextAppointment);

        // Load appointment history
        const appointments = await dentalDB.getAppointments(this.currentUser.email);
        this.updateAppointmentHistory(appointments);
    }

    updateNextAppointment(appointment) {
        const container = document.getElementById('next-appointment');
        if (appointment) {
            container.innerHTML = `
                <h3>${appointment.title}</h3>
                <p>Fecha: ${new Date(appointment.date).toLocaleDateString()}</p>
                <p>Doctor: ${appointment.doctor}</p>
                <p>${appointment.description}</p>
            `;
        } else {
            container.innerHTML = '<p>No hay citas programadas</p>';
        }
    }

    updateAppointmentHistory(appointments) {
        const appointmentsList = document.getElementById('appointments-list');
        if (!appointments || appointments.length === 0) {
            appointmentsList.innerHTML = '<p class="no-data">No hay citas registradas</p>';
            return;
        }

        const dateFormatter = new Intl.DateTimeFormat('es', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        appointmentsList.innerHTML = appointments
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(appointment => `
                <div class="appointment-card ${appointment.status}">
                    <div class="appointment-header">
                        <h3>${appointment.title}</h3>
                        <span class="appointment-type">${this.getAppointmentTypeLabel(appointment.type)}</span>
                    </div>
                    <div class="appointment-details">
                        <p><strong>Fecha:</strong> ${dateFormatter.format(new Date(appointment.date))}</p>
                        <p><strong>Doctor:</strong> ${appointment.doctor}</p>
                        <p><strong>Estado:</strong> ${this.getStatusLabel(appointment.status)}</p>
                    </div>
                    <div class="appointment-description">
                        <p>${appointment.description}</p>
                        ${appointment.symptoms ? `<p><strong>Síntomas:</strong> ${appointment.symptoms}</p>` : ''}
                    </div>
                </div>
            `).join('');
    }

    getAppointmentTypeLabel(type) {
        const types = {
            'checkup': 'Revisión General',
            'cleaning': 'Limpieza Dental',
            'treatment': 'Tratamiento',
            'emergency': 'Emergencia',
            'followup': 'Seguimiento'
        };
        return types[type] || type;
    }

    getStatusLabel(status) {
        const statuses = {
            'scheduled': 'Programada',
            'completed': 'Completada',
            'cancelled': 'Cancelada',
            'pending': 'Pendiente'
        };
        return statuses[status] || status;
    }

    navigateTo(page) {
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        document.getElementById(page).classList.add('active');
        document.querySelector(`.nav-item[data-page="${page}"]`).classList.add('active');

        if (page === 'ar-camera') {
            this.initializeCamera();
        }
    }

    async initializeCamera() {
        const cameraContainer = document.querySelector('.camera-container');
        try {
            // First check if we have the necessary permissions
            const permissions = await navigator.permissions.query({ name: 'camera' });
            
            if (permissions.state === 'denied') {
                throw new Error('Permiso de cámara denegado. Por favor, habilita el acceso a la cámara en la configuración de tu navegador.');
            }

            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Tu navegador no soporta acceso a la cámara. Por favor, usa un navegador moderno como Chrome, Firefox o Edge.');
            }

            // Check HTTPS requirement
            if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
                throw new Error('La cámara requiere una conexión segura (HTTPS) o localhost. Actualmente estás usando: ' + location.protocol);
            }

            // Stop any existing stream
            if (this.currentStream) {
                this.currentStream.getTracks().forEach(track => track.stop());
            }

            // Get new stream with specific constraints
            const constraints = {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            console.log('Solicitando acceso a la cámara con configuración:', constraints);
            
            try {
                this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
                const video = document.getElementById('camera-feed');
                video.srcObject = this.currentStream;

                // Wait for video to be ready
                await new Promise((resolve) => {
                    video.onloadedmetadata = () => {
                        video.play().then(resolve).catch(e => {
                            console.error('Error reproduciendo video:', e);
                            resolve();
                        });
                    };
                });

                // Set up preview canvas
                const previewCanvas = document.getElementById('preview-canvas');
                const videoAspectRatio = 16/9;
                previewCanvas.width = previewCanvas.offsetWidth;
                previewCanvas.height = previewCanvas.width / videoAspectRatio;

                // Set up AR overlay
                const arCanvas = document.getElementById('ar-overlay');
                arCanvas.width = video.videoWidth || 1280;
                arCanvas.height = video.videoHeight || 720;

                // Add event listeners for controls
                document.getElementById('switch-camera').addEventListener('click', () => this.switchCamera());
                document.getElementById('toggle-grid').addEventListener('click', () => this.toggleGrid());

                // Start preview update loop
                this.updatePreview();
                
                // Show success message
                const messageDiv = document.createElement('div');
                messageDiv.className = 'camera-status success';
                messageDiv.textContent = 'Cámara iniciada correctamente';
                cameraContainer.insertBefore(messageDiv, cameraContainer.firstChild);
                
                setTimeout(() => messageDiv.remove(), 3000);

            } catch (streamError) {
                console.error('Error específico al acceder a la cámara:', streamError);
                throw new Error(`No se pudo acceder a la cámara: ${streamError.message || 'Error desconocido'}`);
            }

        } catch (error) {
            console.error('Error detallado de la cámara:', error);
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'camera-status error';
            
            let errorMessage = '';
            let solutionSteps = [];

            // Provide specific error messages and solutions based on the error
            if (error.name === 'NotAllowedError' || error.message.includes('denied')) {
                errorMessage = 'Acceso a la cámara denegado';
                solutionSteps = [
                    'Haz clic en el icono de la cámara en la barra de direcciones del navegador',
                    'Selecciona "Permitir" para dar acceso a la cámara',
                    'Recarga la página después de permitir el acceso'
                ];
            } else if (error.name === 'NotFoundError') {
                errorMessage = 'No se encontró ninguna cámara';
                solutionSteps = [
                    'Verifica que tu dispositivo tiene una cámara conectada',
                    'Asegúrate de que ninguna otra aplicación está usando la cámara',
                    'Reinicia el navegador si el problema persiste'
                ];
            } else if (error.name === 'NotSupportedError') {
                errorMessage = 'Tu navegador no soporta el acceso a la cámara';
                solutionSteps = [
                    'Usa un navegador moderno como Chrome, Firefox o Edge',
                    'Actualiza tu navegador a la última versión'
                ];
            } else {
                errorMessage = error.message || 'Error al acceder a la cámara';
                solutionSteps = [
                    'Verifica que tu cámara está funcionando correctamente',
                    'Permite el acceso a la cámara en la configuración del navegador',
                    'Intenta recargar la página'
                ];
            }

            errorDiv.innerHTML = `
                <p><strong>${errorMessage}</strong></p>
                <p>Pasos para solucionar:</p>
                <ul>
                    ${solutionSteps.map(step => `<li>${step}</li>`).join('')}
                </ul>
                <button onclick="window.location.reload()" class="retry-button">
                    Reintentar
                </button>
            `;
            
            cameraContainer.innerHTML = '';
            cameraContainer.appendChild(errorDiv);
        }
    }

    updatePreview() {
        if (!this.currentStream) return;

        const video = document.getElementById('camera-feed');
        const previewCanvas = document.getElementById('preview-canvas');
        const arCanvas = document.getElementById('ar-overlay');
        const previewCtx = previewCanvas.getContext('2d');
        const arCtx = arCanvas.getContext('2d');

        // Clear canvases
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        arCtx.clearRect(0, 0, arCanvas.width, arCanvas.height);

        // Draw video frame to preview
        previewCtx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);

        // Draw grid if enabled
        if (this.showGrid) {
            this.drawGrid(arCtx, arCanvas.width, arCanvas.height);
        }

        // Continue the preview loop
        requestAnimationFrame(() => this.updatePreview());
    }

    drawGrid(ctx, width, height) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 1;

        // Draw vertical lines
        for (let x = 0; x <= width; x += width/3) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let y = 0; y <= height; y += height/3) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    async switchCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        await this.initializeCamera();
    }

    toggleGrid() {
        this.showGrid = !this.showGrid;
        const button = document.getElementById('toggle-grid');
        button.textContent = this.showGrid ? 'Ocultar Guía' : 'Mostrar Guía';
    }

    captureImage() {
        const video = document.getElementById('camera-feed');
        const canvas = document.getElementById('preview-canvas');
        const context = canvas.getContext('2d');

        // Ensure canvas dimensions match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the current frame
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Here you would implement dental feature detection and analysis
        this.analyzeDentalImage(canvas);
    }

    analyzeDentalImage(canvas) {
        // This is where you would implement dental analysis using computer vision
        // For now, we'll just show some sample tips
        const tips = [
            'Cepilla tus dientes al menos dos veces al día',
            'Usa hilo dental diariamente',
            'Visita al dentista cada 6 meses',
            'Evita alimentos muy azucarados'
        ];

        const tipsContainer = document.getElementById('dental-tips');
        tipsContainer.innerHTML = tips
            .map(tip => `<div class="card"><p>${tip}</p></div>`)
            .join('');
    }

    compareDental() {
        // This would implement the AR comparison feature
        // For now, we'll just show a placeholder message
        alert('Comparación dental en desarrollo');
    }

    handleLogout() {
        localStorage.removeItem('currentUser');
        window.location.href = '/login.html';
    }

    showNewAppointmentModal() {
        // Implementation for new appointment modal
        // This would be expanded in a real application
        alert('Funcionalidad de nueva cita en desarrollo');
    }

    setupPWA() {
        // Escuchar el evento beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevenir que Chrome muestre el prompt automáticamente
            e.preventDefault();
            // Guardar el evento para usarlo después
            this.deferredPrompt = e;
            // Mostrar el botón de instalación
            const pwaSection = document.getElementById('pwa-install-section');
            if (pwaSection) {
                pwaSection.style.display = 'block';
            }
        });

        // Manejar el clic en el botón de instalación
        const installButton = document.getElementById('install-pwa');
        if (installButton) {
            installButton.addEventListener('click', async () => {
                if (!this.deferredPrompt) {
                    console.log('No hay prompt de instalación disponible');
                    return;
                }

                // Mostrar el prompt de instalación
                this.deferredPrompt.prompt();
                
                // Esperar la respuesta del usuario
                const { outcome } = await this.deferredPrompt.userChoice;
                console.log(`Usuario ${outcome === 'accepted' ? 'aceptó' : 'rechazó'} la instalación`);
                
                // Limpiar el prompt guardado
                this.deferredPrompt = null;
                
                // Ocultar el botón de instalación
                const pwaSection = document.getElementById('pwa-install-section');
                if (pwaSection) {
                    pwaSection.style.display = 'none';
                }
            });
        }

        // Escuchar si la PWA ya está instalada
        window.addEventListener('appinstalled', () => {
            console.log('PWA instalada exitosamente');
            // Ocultar el botón de instalación
            const pwaSection = document.getElementById('pwa-install-section');
            if (pwaSection) {
                pwaSection.style.display = 'none';
            }
        });
    }

    handlePWAInstallation() {
        // Registro del Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then(registration => {
                        console.log('Service Worker registrado con éxito:', registration);
                    })
                    .catch(error => {
                        console.error('Error al registrar el Service Worker:', error);
                    });
            });
        }

        // Variables para la instalación de PWA
        let deferredPrompt;
        const installButton = document.getElementById('install-pwa');
        const installSection = document.getElementById('pwa-install-section');

        // Escuchar el evento beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevenir que Chrome muestre automáticamente el prompt
            e.preventDefault();
            // Guardar el evento para usarlo después
            deferredPrompt = e;
            // Mostrar el botón de instalación
            if (installSection) {
                installSection.style.display = 'block';
            }
        });

        // Manejar el clic en el botón de instalación
        if (installButton) {
            installButton.addEventListener('click', async () => {
                if (!deferredPrompt) {
                    // Si no hay prompt disponible, probablemente la app ya está instalada
                    showToast('La aplicación ya está instalada o no se puede instalar en este momento', 'warning');
                    return;
                }
                // Mostrar el prompt de instalación
                deferredPrompt.prompt();
                // Esperar la respuesta del usuario
                const { outcome } = await deferredPrompt.userChoice;
                // Limpiar el prompt guardado
                deferredPrompt = null;
                // Ocultar el botón de instalación
                if (installSection) {
                    installSection.style.display = 'none';
                }
                // Mostrar mensaje según la respuesta del usuario
                if (outcome === 'accepted') {
                    showToast('¡Gracias por instalar nuestra aplicación!', 'success');
                }
            });
        }

        // Detectar si la app ya está instalada
        window.addEventListener('appinstalled', () => {
            // Ocultar el botón de instalación
            if (installSection) {
                installSection.style.display = 'none';
            }
            showToast('¡Aplicación instalada con éxito!', 'success');
        });

        // Función para mostrar notificaciones toast
        function showToast(message, type = 'info') {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);

            // Remover el toast después de 3 segundos
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }
    }
}

// Initialize the app
const app = new DentalCareApp();
