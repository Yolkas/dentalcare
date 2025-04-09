// Initial doctors data
const initialDoctors = [
    {
        id: 'DC001',
        name: 'Dr. Carlos Ramírez',
        password: 'DrCR2025#',
        specialty: 'Odontología General',
        email: 'carlos.ramirez@dentalcare.com',
        phone: '+52 555-0001',
        schedule: {
            monday: { start: '09:00', end: '17:00' },
            tuesday: { start: '09:00', end: '17:00' },
            wednesday: { start: '09:00', end: '17:00' },
            thursday: { start: '09:00', end: '17:00' },
            friday: { start: '09:00', end: '14:00' }
        }
    },
    {
        id: 'DC002',
        name: 'Dra. Ana Martínez',
        password: 'DrAM2025#',
        specialty: 'Ortodoncia',
        email: 'ana.martinez@dentalcare.com',
        phone: '+52 555-0002',
        schedule: {
            monday: { start: '11:00', end: '19:00' },
            tuesday: { start: '11:00', end: '19:00' },
            wednesday: { start: '11:00', end: '19:00' },
            thursday: { start: '11:00', end: '19:00' },
            friday: { start: '11:00', end: '16:00' }
        }
    },
    {
        id: 'DC003',
        name: 'Dr. Miguel Torres',
        password: 'DrMT2025#',
        specialty: 'Endodoncia',
        email: 'miguel.torres@dentalcare.com',
        phone: '+52 555-0003',
        schedule: {
            monday: { start: '08:00', end: '16:00' },
            tuesday: { start: '08:00', end: '16:00' },
            wednesday: { start: '08:00', end: '16:00' },
            thursday: { start: '08:00', end: '16:00' },
            friday: { start: '08:00', end: '13:00' }
        }
    }
];

// Function to check if a doctor exists
async function checkDoctor(id) {
    try {
        const doctor = await dentalDB.getDoctorById(id);
        return doctor !== undefined;
    } catch (error) {
        console.error('Error checking doctor:', error);
        return false;
    }
}

// Function to initialize doctors in the database
async function initializeDoctors() {
    console.log('Starting doctor initialization...');
    
    try {
        // Check if doctors already exist
        const existingDoctor = await checkDoctor('DC001');
        if (existingDoctor) {
            console.log('Doctors already initialized');
            return;
        }

        for (const doctor of initialDoctors) {
            console.log(`Initializing doctor: ${doctor.id}`);
            
            // Hash the password before storing
            const encoder = new TextEncoder();
            const data = encoder.encode(doctor.password);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashedPassword = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            
            // Store doctor with hashed password
            await dentalDB.addDoctor({
                ...doctor,
                password: hashedPassword,
                createdAt: new Date().toISOString()
            });
            
            console.log(`Doctor ${doctor.id} initialized successfully`);
        }
        
        console.log('All doctors initialized successfully');
        
        // Show credentials in console for testing
        console.log('\nDoctor Credentials for Testing:');
        console.log('--------------------------------');
        initialDoctors.forEach(doctor => {
            console.log(`ID: ${doctor.id}`);
            console.log(`Password: ${doctor.password}`);
            console.log('--------------------------------');
        });
    } catch (error) {
        console.error('Error initializing doctors:', error);
    }
}

// Initialize doctors when the database is ready
console.log('Waiting for database initialization...');
dentalDB.init().then(() => {
    console.log('Database initialized, starting doctor initialization...');
    initializeDoctors();
}).catch(error => {
    console.error('Error initializing database:', error);
});
