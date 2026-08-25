import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    updateDoc, 
    arrayUnion, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCuSpIcl95F-XUM3olVnJSVNRTRzXroO8Y",
    authDomain: "attendance-tracker-b2321.firebaseapp.com",
    projectId: "attendance-tracker-b2321",
    storageBucket: "attendance-tracker-b2321.firebasestorage.app",
    messagingSenderId: "525564288058",
    appId: "1:525564288058:web:b6a408dc421cdf035ba903",
    measurementId: "G-ZQFXEQLRF5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Global State
let html5QrcodeScanner = null;
let isScanning = false;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const logoutBtn = document.getElementById('logoutBtn');

const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');
const qrFileInput = document.getElementById('qrFileInput');
const cameraStatus = document.getElementById('cameraStatus');

const resultContainer = document.getElementById('resultContainer');
const emptyState = resultContainer.querySelector('.empty-state');
const cadetDetailsView = document.getElementById('cadetDetailsView');

const cadetAvatar = document.getElementById('cadetAvatar');
const cadetFullName = document.getElementById('cadetFullName');
const cadetRankClass = document.getElementById('cadetRankClass');
const cadetStudentNumber = document.getElementById('cadetStudentNumber');
const cadetCampus = document.getElementById('cadetCampus');
const cadetCourseYear = document.getElementById('cadetCourseYear');
const cadetRotcComponent = document.getElementById('cadetRotcComponent');

const statusBox = document.getElementById('statusBox');
const statusTitle = document.getElementById('statusTitle');
const statusTime = document.getElementById('statusTime');

// Authentication Guard
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    }
});

// Initialize Scanner Logic
document.addEventListener('DOMContentLoaded', () => {
    setupSidebarEvents();
    setupScannerEvents();
    html5QrcodeScanner = new Html5Qrcode("qrReader");
    updateCameraStatus("Camera Ready", false);
});

// Sidebar Controls
function setupSidebarEvents() {
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                if (isScanning) await stopScanner();
                await signOut(auth);
                window.location.href = "index.html";
            } catch (error) {
                console.error("Logout Error:", error);
            }
        });
    }
}

// Scanner Controls setup
function setupScannerEvents() {
    startScanBtn.addEventListener('click', startScanner);
    stopScanBtn.addEventListener('click', stopScanner);

    qrFileInput.addEventListener('change', async (e) => {
        if (e.target.files.length === 0) return;
        const imageFile = e.target.files[0];
        
        try {
            if (isScanning) {
                await stopScanner();
            }
            updateCameraStatus("Processing Image...", true);
            const decodedText = await html5QrcodeScanner.scanFile(imageFile, true);
            handleScannedCode(decodedText);
            updateCameraStatus("Image Processed", false);
        } catch (err) {
            console.error("Error scanning file:", err);
            updateCameraStatus("Scan Failed", false);
            alert("Could not read QR code from selected image. Please try another image.");
        } finally {
            qrFileInput.value = "";
        }
    });
}

// Start Camera Stream
async function startScanner() {
    try {
        updateCameraStatus("Starting Camera...", true);
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        await html5QrcodeScanner.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanFailure
        );

        isScanning = true;
        startScanBtn.disabled = true;
        stopScanBtn.disabled = false;
        updateCameraStatus("Scanning Active", true);
    } catch (err) {
        console.error("Camera startup error:", err);
        updateCameraStatus("Camera Access Denied", false);
        alert("Unable to access camera. Please verify camera permissions.");
    }
}

// Stop Camera Stream
async function stopScanner() {
    if (!isScanning) return;
    try {
        await html5QrcodeScanner.stop();
        isScanning = false;
        startScanBtn.disabled = false;
        stopScanBtn.disabled = true;
        updateCameraStatus("Camera Stopped", false);
    } catch (err) {
        console.error("Camera shutdown error:", err);
    }
}

// Handle QR Detection
function onScanSuccess(decodedText) {
    handleScannedCode(decodedText);
}

function onScanFailure(error) {
    // Normal scanning loop noise; ignore continuous frame scan logs
}

// Process Scanned Data & Fetch Cadet Record
async function handleScannedCode(rawCadetId) {
    const cadetId = rawCadetId.trim();
    if (!cadetId) return;

    try {
        const cadetRef = doc(db, "cadets", cadetId);
        const cadetSnap = await getDoc(cadetRef);

        if (!cadetSnap.exists()) {
            displayNotFoundState(cadetId);
            return;
        }

        const cadetData = cadetSnap.data();
        
        // Log attendance in Firestore
        const now = new Date();
        const timestampStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        
        await updateDoc(cadetRef, {
            attendanceLogs: arrayUnion({
                timestamp: new Date().toISOString(),
                status: "Present"
            }),
            lastScannedAt: serverTimestamp()
        });

        renderCadetDetails(cadetData, cadetId, timestampStr);
    } catch (error) {
        console.error("Error processing cadet scan:", error);
        alert("Failed to process QR code scan: " + error.message);
    }
}

// UI Rendering Functions
function renderCadetDetails(data, id, timestamp) {
    emptyState.style.display = "none";
    cadetDetailsView.style.display = "flex";

    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Cadet Name';
    const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    cadetAvatar.textContent = initials || 'C';
    cadetFullName.textContent = fullName;
    cadetRankClass.textContent = data.rank || 'Cadet Officer';

    cadetStudentNumber.textContent = id || data.studentId || '--';
    cadetCampus.textContent = data.campus || 'WVSU Main';
    cadetCourseYear.textContent = `${data.course || ''} ${data.yearLevel || ''}`.trim() || '--';
    cadetRotcComponent.textContent = data.rotcClass || 'Air Force ROTC';

    statusBox.className = "attendance-status-box success";
    statusTitle.textContent = "ATTENDANCE LOGGED";
    statusTime.textContent = timestamp;
}

function displayNotFoundState(invalidId) {
    emptyState.style.display = "none";
    cadetDetailsView.style.display = "flex";

    cadetAvatar.textContent = "?";
    cadetFullName.textContent = "Cadet Not Found";
    cadetRankClass.textContent = "Unregistered ID";

    cadetStudentNumber.textContent = invalidId;
    cadetCampus.textContent = "--";
    cadetCourseYear.textContent = "--";
    cadetRotcComponent.textContent = "--";

    statusBox.className = "attendance-status-box warning";
    statusTitle.textContent = "INVALID QR CODE";
    statusTime.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateCameraStatus(text, isActive) {
    cameraStatus.textContent = text;
    if (isActive) {
        cameraStatus.classList.add('active');
    } else {
        cameraStatus.classList.remove('active');
    }
}