import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc,
    getDoc
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

// Initialize Firebase SDKs
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
    
    // UI Panel Slide Controls
    const container = document.getElementById('authContainer');
    const signUpBtn = document.getElementById('signUpBtn');
    const signInBtn = document.getElementById('signInBtn');

    if (signUpBtn && signInBtn && container) {
        signUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            container.classList.add("right-panel-active");
        });

        signInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            container.classList.remove("right-panel-active");
        });
    }

    // Military Rank to Cadet Class Auto-Calculation
    const rankClassMap = {
        "C/COL": "1st Class",
        "C/LTC": "1st Class",
        "C/MAJ": "2nd Class",
        "C/CPT": "2nd Class",
        "C/1LT": "3rd Class",
        "C/2LT": "3rd Class"
    };

    const rankSelect = document.getElementById('rankSelect');
    const classInput = document.getElementById('classInput');

    if (rankSelect && classInput) {
        rankSelect.addEventListener('change', () => {
            classInput.value = rankClassMap[rankSelect.value] || '';
        });
    }

    // Age Auto-Calculation from Date of Birth
    const dobInput = document.getElementById('dobInput');
    const ageInput = document.getElementById('ageInput');

    if (dobInput && ageInput) {
        dobInput.addEventListener('change', () => {
            const birthDate = new Date(dobInput.value);
            if (!isNaN(birthDate)) {
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
                ageInput.value = age >= 0 ? age : 0;
            } else {
                ageInput.value = '';
            }
        });
    }

    // Password Visibility Toggle Handler
    function setupPasswordToggle(inputId, toggleId) {
        const input = document.getElementById(inputId);
        const toggle = document.getElementById(toggleId);

        if (input && toggle) {
            toggle.addEventListener('click', () => {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                toggle.textContent = isPassword ? '🙈' : '👁️';
            });
        }
    }

    setupPasswordToggle('signUpPassword', 'toggleSignUpPass');
    setupPasswordToggle('signUpConfirmPassword', 'toggleSignUpConfirmPass');
    setupPasswordToggle('signInPassword', 'toggleSignInPass');

    // Password Strength Evaluator
    const signUpPassword = document.getElementById('signUpPassword');
    const strengthBar = document.getElementById('strengthBar');
    const strengthText = document.getElementById('strengthText');

    if (signUpPassword && strengthBar && strengthText) {
        signUpPassword.addEventListener('input', () => {
            const val = signUpPassword.value;
            let score = 0;

            if (val.length === 0) {
                strengthBar.style.width = '0%';
                strengthText.textContent = '';
                return;
            }

            if (val.length >= 6) score++;
            if (val.length >= 10) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;

            if (score <= 2) {
                strengthBar.style.width = '33%';
                strengthBar.style.backgroundColor = '#EF4444';
                strengthText.style.color = '#EF4444';
                strengthText.textContent = 'Weak Password';
            } else if (score <= 4) {
                strengthBar.style.width = '66%';
                strengthBar.style.backgroundColor = '#F59E0B';
                strengthText.style.color = '#F59E0B';
                strengthText.textContent = 'Moderate Password';
            } else {
                strengthBar.style.width = '100%';
                strengthBar.style.backgroundColor = '#10B981';
                strengthText.style.color = '#10B981';
                strengthText.textContent = 'Strong Password';
            }
        });
    }

    // Sign Up Form Submission Logic
    const signUpForm = document.getElementById('signUpForm');
    if (signUpForm) {
        signUpForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('signUpEmail').value;
            const password = document.getElementById('signUpPassword').value;
            const confirmPassword = document.getElementById('signUpConfirmPassword').value;

            if (password !== confirmPassword) {
                alert("Passwords do not match!");
                return;
            }

            const rankSelect = document.getElementById('rankSelect');
            const rank = rankSelect ? rankSelect.value : '';
            const cadetClass = classInput ? classInput.value : '';
            const lastName = document.getElementById('lastName').value;
            const firstName = document.getElementById('firstName').value;
            const middleName = document.getElementById('middleName').value;
            const suffix = document.getElementById('suffix').value;
            const dob = dobInput ? dobInput.value : '';
            const age = ageInput ? ageInput.value : '';

            try {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                await setDoc(doc(db, "cadets", user.uid), {
                    uid: user.uid,
                    email: email,
                    role: 'officer',
                    rank: rank,
                    class: cadetClass,
                    lastName: lastName,
                    firstName: firstName,
                    middleName: middleName,
                    suffix: suffix,
                    dob: dob,
                    age: age,
                    createdAt: new Date().toISOString()
                });

                alert("Officer account created successfully! You can now Sign In.");
                container.classList.remove("right-panel-active");
                signUpForm.reset();
                if (strengthBar) strengthBar.style.width = '0%';
                if (strengthText) strengthText.textContent = '';
            } catch (error) {
                alert("Sign Up Error: " + error.message);
            }
        });
    }

    // Sign In Form Submission Logic
    const signInForm = document.getElementById('signInForm');
    if (signInForm) {
        signInForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('signInEmail').value;
            const password = document.getElementById('signInPassword').value;

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                const userDocRef = doc(db, "cadets", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();

                    if (userData.role === 'officer') {
                        window.location.href = "../HTML/dashboard.html";
                    } else {
                        alert("Access Denied: This portal is restricted to Cadet Officers.");
                    }
                } else {
                    alert("Account record not found in system database.");
                }
            } catch (error) {
                alert("Sign In Error: " + error.message);
            }
        });
    }
});