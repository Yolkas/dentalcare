class DoctorApp {
    constructor() {
        this.currentDoctor = JSON.parse(localStorage.getItem('currentDoctor'));
        if (!this.currentDoctor) {
            window.location.href = '/doctor-login.html';
            return;
        }

        this.initializeApp();
    }

    async initializeApp() {
        this.initializeEventListeners();
        await this.loadDoctorData();
        await this.loadPatients();
        await this.loadTodayAppointments();
        this.initializeCalendar();
    }

    initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.doctor-nav .nav-item').forEach(item => {
            item.addEventListener('click', () => this.navigateToPage(item.dataset.page));
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            localStorage.removeItem('currentDoctor');
            window.location.href = '/doctor-login.html';
        });

        // New appointment
        const newAppointmentBtn = document.getElementById('new-doctor-appointment');
        const appointmentModal = document.getElementById('doctor-appointment-modal');
        const closeModalBtn = appointmentModal.querySelector('.close-modal');
        const cancelBtn = appointmentModal.querySelector('.cancel-btn');
        const appointmentForm = document.getElementById('doctor-appointment-form');

        newAppointmentBtn.addEventListener('click', () => this.openNewAppointmentModal());
        closeModalBtn.addEventListener('click', () => this.closeModal(appointmentModal));
        cancelBtn.addEventListener('click', () => this.closeModal(appointmentModal));
        appointmentForm.addEventListener('submit', (e) => this.handleNewAppointment(e));

        // Patient search
        const searchInput = document.getElementById('patient-search');
        searchInput.addEventListener('input', () => this.handlePatientSearch(searchInput.value));

        // Calendar navigation
        document.getElementById('prev-week').addEventListener('click', () => this.navigateCalendar(-1));
        document.getElementById('next-week').addEventListener('click', () => this.navigateCalendar(1));

        // History filters
        document.getElementById('history-date-filter').addEventListener('change', () => this.filterHistory());
        document.getElementById('history-patient-filter').addEventListener('change', () => this.filterHistory());
    }

    async loadDoctorData() {
        document.getElementById('doctor-name').textContent = `Dr. ${this.currentDoctor.name}`;
        document.getElementById('doctor-specialty').textContent = this.currentDoctor.specialty;
    }

    async loadPatients() {
        try {
            const patients = await dentalDB.getAllPatients();
            this.renderPatients(patients);
            this.updatePatientSelect(patients);
        } catch (error) {
            console.error('Error loading patients:', error);
            this.showToast('Error al cargar pacientes', 'error');
        }
    }

    renderPatients(patients) {
        const grid = document.querySelector('.patients-grid');
        grid.innerHTML = patients.map(patient => `
            <div class="patient-card" data-patient-id="${patient.email}">
                <h3>${patient.name}</h3>
                <p><strong>Email:</strong> ${patient.email}</p>
                <p><strong>Fecha de Nacimiento:</strong> ${new Date(patient.birthDate).toLocaleDateString()}</p>
                <button class="secondary-button view-history-btn" onclick="app.viewPatientHistory('${patient.email}')">
                    Ver Historial
                </button>
            </div>
        `).join('');
    }

    updatePatientSelect(patients) {
        const select = document.getElementById('patient-select');
        select.innerHTML = `
            <option value="">Seleccionar paciente</option>
            ${patients.map(patient => `
                <option value="${patient.email}">${patient.name} (${patient.email})</option>
            `).join('')}
        `;
    }

    async loadTodayAppointments() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const appointments = await dentalDB.getAppointmentsByDateRange(
                today.toISOString(),
                tomorrow.toISOString()
            );

            const list = document.querySelector('.today-appointments .appointments-list');
            if (!appointments.length) {
                list.innerHTML = '<p class="no-data">No hay citas programadas para hoy</p>';
                return;
            }

            list.innerHTML = appointments
                .sort((a, b) => new Date(a.date) - new Date(b.date))
                .map(appointment => `
                    <div class="appointment-card ${appointment.status}">
                        <div class="appointment-time">
                            ${new Date(appointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div class="appointment-info">
                            <h4>${appointment.title}</h4>
                            <p>${appointment.patientName}</p>
                            <span class="appointment-type">${this.getAppointmentTypeLabel(appointment.type)}</span>
                        </div>
                        <div class="appointment-actions">
                            <button onclick="app.startAppointment('${appointment.id}')" 
                                    class="start-btn" ${appointment.status !== 'scheduled' ? 'disabled' : ''}>
                                Iniciar
                            </button>
                        </div>
                    </div>
                `).join('');
        } catch (error) {
            console.error('Error loading today\'s appointments:', error);
            this.showToast('Error al cargar citas de hoy', 'error');
        }
    }

    initializeCalendar() {
        this.currentWeek = new Date();
        this.updateCalendar();
    }

    updateCalendar() {
        const startOfWeek = new Date(this.currentWeek);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);

        // Update week display
        document.getElementById('current-week').textContent = 
            `Semana del ${startOfWeek.toLocaleDateString()} al ${endOfWeek.toLocaleDateString()}`;

        // Update grid
        const grid = document.getElementById('calendar-grid');
        grid.innerHTML = '';

        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(date.getDate() + i);

            const dayCol = document.createElement('div');
            dayCol.className = 'calendar-day';
            dayCol.innerHTML = `
                <div class="day-header">
                    <span class="day-name">${date.toLocaleDateString('es', { weekday: 'short' })}</span>
                    <span class="day-date">${date.getDate()}</span>
                </div>
                <div class="day-appointments"></div>
            `;

            grid.appendChild(dayCol);
        }

        this.loadWeekAppointments(startOfWeek, endOfWeek);
    }

    async loadWeekAppointments(start, end) {
        try {
            const appointments = await dentalDB.getAppointmentsByDateRange(
                start.toISOString(),
                end.toISOString()
            );

            appointments.forEach(appointment => {
                const date = new Date(appointment.date);
                const dayIndex = date.getDay();
                const dayCol = document.querySelectorAll('.calendar-day')[dayIndex];
                const appointmentsContainer = dayCol.querySelector('.day-appointments');

                const appointmentEl = document.createElement('div');
                appointmentEl.className = `calendar-appointment ${appointment.status}`;
                appointmentEl.innerHTML = `
                    <span class="time">
                        ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span class="title">${appointment.title}</span>
                    <span class="patient">${appointment.patientName}</span>
                `;

                appointmentsContainer.appendChild(appointmentEl);
            });
        } catch (error) {
            console.error('Error loading week appointments:', error);
            this.showToast('Error al cargar citas de la semana', 'error');
        }
    }

    navigateCalendar(weeks) {
        this.currentWeek.setDate(this.currentWeek.getDate() + (weeks * 7));
        this.updateCalendar();
    }

    async handleNewAppointment(e) {
        e.preventDefault();
        const form = e.target;
        
        const appointmentData = {
            patientEmail: form.querySelector('#patient-select').value,
            date: new Date(form.querySelector('#appointment-date').value).toISOString(),
            type: form.querySelector('#appointment-type').value,
            duration: parseInt(form.querySelector('#appointment-duration').value),
            notes: form.querySelector('#appointment-notes').value,
            doctorId: this.currentDoctor.id,
            status: 'scheduled',
            createdAt: new Date().toISOString()
        };

        try {
            await dentalDB.addAppointment(appointmentData);
            this.showToast('Cita agendada con éxito', 'success');
            this.closeModal(document.getElementById('doctor-appointment-modal'));
            await this.loadTodayAppointments();
            this.updateCalendar();
        } catch (error) {
            console.error('Error creating appointment:', error);
            this.showToast('Error al agendar cita', 'error');
        }
    }

    async handlePatientSearch(query) {
        try {
            const patients = await dentalDB.searchPatients(query);
            this.renderPatients(patients);
        } catch (error) {
            console.error('Error searching patients:', error);
            this.showToast('Error al buscar pacientes', 'error');
        }
    }

    async viewPatientHistory(patientEmail) {
        try {
            const patient = await dentalDB.getPatientByEmail(patientEmail);
            const appointments = await dentalDB.getPatientAppointments(patientEmail);
            
            const modal = document.getElementById('patient-details-modal');
            const detailsContainer = modal.querySelector('.patient-details');
            
            detailsContainer.innerHTML = `
                <div class="patient-info">
                    <h3>${patient.name}</h3>
                    <p><strong>Email:</strong> ${patient.email}</p>
                    <p><strong>Fecha de Nacimiento:</strong> ${new Date(patient.birthDate).toLocaleDateString()}</p>
                    <p><strong>Fecha de Registro:</strong> ${new Date(patient.registerDate).toLocaleDateString()}</p>
                </div>
                <div class="patient-history">
                    <h4>Historial de Citas</h4>
                    ${this.renderAppointmentHistory(appointments)}
                </div>
            `;

            modal.classList.add('active');
        } catch (error) {
            console.error('Error loading patient history:', error);
            this.showToast('Error al cargar historial del paciente', 'error');
        }
    }

    renderAppointmentHistory(appointments) {
        if (!appointments.length) {
            return '<p class="no-data">No hay historial de citas</p>';
        }

        return appointments
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .map(appointment => `
                <div class="history-item ${appointment.status}">
                    <div class="history-date">
                        ${new Date(appointment.date).toLocaleDateString()}
                        ${new Date(appointment.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div class="history-details">
                        <h5>${appointment.title}</h5>
                        <p>${appointment.description}</p>
                        ${appointment.notes ? `<p class="notes">${appointment.notes}</p>` : ''}
                    </div>
                    <div class="history-status">
                        ${this.getStatusLabel(appointment.status)}
                    </div>
                </div>
            `).join('');
    }

    navigateToPage(pageId) {
        document.querySelectorAll('.doctor-page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');

        document.querySelectorAll('.doctor-nav .nav-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.nav-item[data-page="${pageId}"]`).classList.add('active');
    }

    openNewAppointmentModal() {
        const modal = document.getElementById('doctor-appointment-modal');
        const dateInput = document.getElementById('appointment-date');
        
        // Set minimum date to today
        const now = new Date();
        const tzOffset = now.getTimezoneOffset() * 60000;
        dateInput.min = new Date(now - tzOffset).toISOString().slice(0, 16);
        
        // Set default date to current hour rounded up to next 30 minutes
        const minutes = now.getMinutes();
        now.setMinutes(minutes + (30 - (minutes % 30)));
        dateInput.value = new Date(now - tzOffset).toISOString().slice(0, 16);
        
        modal.classList.add('active');
    }

    closeModal(modal) {
        modal.classList.remove('active');
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

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    async startAppointment(appointmentId) {
        try {
            await dentalDB.updateAppointmentStatus(appointmentId, 'in-progress');
            this.showToast('Cita iniciada');
            await this.loadTodayAppointments();
            this.updateCalendar();
        } catch (error) {
            console.error('Error starting appointment:', error);
            this.showToast('Error al iniciar la cita', 'error');
        }
    }
}

// Initialize app
const app = new DoctorApp();
