import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Official Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCuSpIcl95F-XUM3olVnJSVNRTRzXroO8Y",
    authDomain: "attendance-tracker-b2321.firebaseapp.com",
    projectId: "attendance-tracker-b2321",
    storageBucket: "attendance-tracker-b2321.firebasestorage.app",
    messagingSenderId: "525564288058",
    appId: "1:525564288058:web:b6a408dc421cdf035ba903",
    measurementId: "G-ZQFXEQLRF5"
};

// Initialize Firebase App & Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    setupRegistrationForm();
    setupExcelImport();
});

function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    if (sidebar && sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }
}

function setupRegistrationForm() {
    const form = document.getElementById('cadetRegistrationForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('submitBtn');
        const originalBtnHtml = submitBtn.innerHTML;
        
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering Cadet...';

        // Map form values to match Campus Management requirements
        const cadetData = {
            lastName: document.getElementById('lastName').value.trim().toUpperCase(),
            firstName: document.getElementById('firstName').value.trim().toUpperCase(),
            middleName: document.getElementById('middleName').value.trim().toUpperCase(),
            extensionName: document.getElementById('extensionName').value.trim().toUpperCase(),
            gender: document.getElementById('gender').value,
            birthDate: document.getElementById('birthDate').value,
            contactNumber: document.getElementById('contactNumber').value.trim(),
            emailAddress: document.getElementById('emailAddress').value.trim().toLowerCase(),
            
            studentNumber: document.getElementById('studentNumber').value.trim().toUpperCase(),
            campus: document.getElementById('campus').value,
            course: document.getElementById('course').value.trim().toUpperCase(),
            yearLevel: document.getElementById('yearLevel').value,
            rotcComponent: document.getElementById('rotcComponent').value,
            platoon: document.getElementById('platoon').value.trim() || 'Unassigned',
            
            guardianName: document.getElementById('guardianName').value.trim().toUpperCase(),
            guardianRelationship: document.getElementById('guardianRelationship').value.trim(),
            guardianContact: document.getElementById('guardianContact').value.trim(),
            
            // Initial attendance array for training sessions
            attendance: [true, true, true, true, true],
            status: 'Active',
            createdAt: serverTimestamp()
        };

        try {
            await addDoc(collection(db, 'cadets'), cadetData);
            alert(`Cadet ${cadetData.lastName}, ${cadetData.firstName} registered successfully!`);
            form.reset();
        } catch (error) {
            console.error('Error saving cadet to Firestore:', error);
            alert('Failed to register cadet. Please check Firestore permissions.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    });
}

function setupExcelImport() {
    const fileInput = document.getElementById('excelImportInput');
    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    alert('Excel sheet is empty.');
                    return;
                }

                let successCount = 0;
                for (const row of jsonData) {
                    const cadetRecord = {
                        lastName: (row['Last Name'] || '').toString().trim().toUpperCase(),
                        firstName: (row['First Name'] || '').toString().trim().toUpperCase(),
                        middleName: (row['Middle Name'] || '').toString().trim().toUpperCase(),
                        gender: row['Gender'] || 'Male',
                        campus: row['Campus'] || 'WVSU - Main Campus',
                        studentNumber: (row['Student ID'] || '').toString().trim().toUpperCase(),
                        course: (row['Course'] || '').toString().trim().toUpperCase(),
                        yearLevel: row['Year Level'] || '1st Year',
                        rotcComponent: row['ROTC Component'] || 'MS 1',
                        attendance: [true, true, true, true, true],
                        status: 'Active',
                        createdAt: serverTimestamp()
                    };

                    if (cadetRecord.lastName && cadetRecord.firstName) {
                        await addDoc(collection(db, 'cadets'), cadetRecord);
                        successCount++;
                    }
                }

                alert(`Successfully imported ${successCount} cadets!`);
                fileInput.value = '';
            } catch (err) {
                console.error('Error parsing Excel:', err);
                alert('Error processing Excel file. Ensure proper column formatting.');
            }
        };
        reader.readAsArrayBuffer(file);
    });
}