class DentalDB {
    constructor() {
        this.DB_NAME = 'dentalcare';
        this.DB_VERSION = 1;
        this.db = null;
    }

    async init() {
        if (this.db) {
            console.log('Database already initialized');
            return;
        }

        console.log('Initializing database...');
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = (event) => {
                console.error('Database error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Database opened successfully');
                resolve();
            };

            request.onupgradeneeded = (event) => {
                console.log('Database upgrade needed');
                const db = event.target.result;

                // Create doctors store
                if (!db.objectStoreNames.contains('doctors')) {
                    const doctorsStore = db.createObjectStore('doctors', { keyPath: 'id' });
                    doctorsStore.createIndex('email', 'email', { unique: true });
                    console.log('Doctors store created');
                }

                // Create patients store
                if (!db.objectStoreNames.contains('patients')) {
                    const patientsStore = db.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
                    patientsStore.createIndex('email', 'email', { unique: true });
                    console.log('Patients store created');
                }

                // Create appointments store
                if (!db.objectStoreNames.contains('appointments')) {
                    const appointmentsStore = db.createObjectStore('appointments', { keyPath: 'id', autoIncrement: true });
                    appointmentsStore.createIndex('patientId', 'patientId');
                    appointmentsStore.createIndex('doctorId', 'doctorId');
                    appointmentsStore.createIndex('date', 'date');
                    console.log('Appointments store created');
                }
            };
        });
    }

    // Doctor methods
    async addDoctor(doctor) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['doctors'], 'readwrite');
            const store = transaction.objectStore('doctors');

            const request = store.put(doctor);

            request.onsuccess = () => {
                console.log(`Doctor ${doctor.id} added successfully`);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error adding doctor:', request.error);
                reject(request.error);
            };
        });
    }

    async getDoctorById(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['doctors'], 'readonly');
            const store = transaction.objectStore('doctors');
            const request = store.get(id);

            request.onsuccess = () => {
                console.log(`Retrieved doctor ${id}:`, request.result);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error getting doctor:', request.error);
                reject(request.error);
            };
        });
    }

    async getDoctorByEmail(email) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['doctors'], 'readonly');
            const store = transaction.objectStore('doctors');
            const index = store.index('email');
            const request = index.get(email);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Patient methods
    async addPatient(patient) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['patients'], 'readwrite');
            const store = transaction.objectStore('patients');
            const request = store.add(patient);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getPatientById(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['patients'], 'readonly');
            const store = transaction.objectStore('patients');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Appointment methods
    async addAppointment(appointment) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['appointments'], 'readwrite');
            const store = transaction.objectStore('appointments');
            const request = store.add(appointment);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAppointmentsByPatient(patientId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['appointments'], 'readonly');
            const store = transaction.objectStore('appointments');
            const index = store.index('patientId');
            const request = index.getAll(patientId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAppointmentsByDoctor(doctorId) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction(['appointments'], 'readonly');
            const store = transaction.objectStore('appointments');
            const index = store.index('doctorId');
            const request = index.getAll(doctorId);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // User methods
    async addUser(user) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            // Determinar si es un paciente o un doctor basado en el rol
            const storeName = user.role === 'doctor' ? 'doctors' : 'patients';
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            // Si es doctor, asegurarse de que tenga un ID
            if (user.role === 'doctor' && !user.id) {
                reject(new Error('Doctor ID is required'));
                return;
            }

            // Para pacientes, el ID es autoincremental
            const request = user.role === 'doctor' ? store.put(user) : store.add(user);

            request.onsuccess = () => {
                console.log(`User added successfully to ${storeName}`);
                // Si es paciente, el ID se genera automáticamente
                if (user.role !== 'doctor') {
                    user.id = request.result;
                }
                resolve(user);
            };

            request.onerror = () => {
                console.error('Error adding user:', request.error);
                reject(request.error);
            };
        });
    }

    async getUserByEmail(email, role = 'patient') {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const storeName = role === 'doctor' ? 'doctors' : 'patients';
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index('email');
            const request = index.get(email);

            request.onsuccess = () => {
                console.log(`Retrieved user from ${storeName}:`, request.result);
                resolve(request.result);
            };

            request.onerror = () => {
                console.error('Error getting user:', request.error);
                reject(request.error);
            };
        });
    }
}

// Create and export a single instance
const dentalDB = new DentalDB();
