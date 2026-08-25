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
    collection,
    onSnapshot,
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCuSpIcl95F-XUM3olVnJSVNRTRzXroO8Y",
    authDomain: "attendance-tracker-b2321.firebaseapp.com",
    projectId: "attendance-tracker-b2321",
    storageBucket: "attendance-tracker-b2321.firebasestorage.app",
    messagingSenderId: "525564288058",
    appId: "1:525564288058:web:b6a408dc421cdf035ba903",
    measurementId: "G-ZQFXEQLRF5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// In-memory cache for loaded cadets
const cadetCache = {};

// Filter & Pagination States per Campus
const campusFilterState = {
    'wvsu-main': { sortOrder: 'asc', pageSize: 10, currentPage: { male: 1, female: 1 }, searchQuery: '' },
    'st-therese': { sortOrder: 'asc', pageSize: 10, currentPage: { male: 1, female: 1 }, searchQuery: '' },
    'idc': { sortOrder: 'asc', pageSize: 10, currentPage: { male: 1, female: 1 }, searchQuery: '' },
    'aca': { sortOrder: 'asc', pageSize: 10, currentPage: { male: 1, female: 1 }, searchQuery: '' }
};

// Map standard campus names from registration to the HTML container IDs
const campusIdMap = {
    "WVSU - Main Campus": "wvsu-main",
    "West Visayas State University": "wvsu-main",
    "WVSU Main": "wvsu-main",
    "St. Therese MTC - Colleges": "st-therese",
    "St. Therese MTC": "st-therese",
    "Iloilo Doctors' College": "idc",
    "Iloilo Doctors College": "idc",
    "IDC": "idc",
    "Asian College of Aeronautics": "aca",
    "ACA": "aca"
};

document.addEventListener('DOMContentLoaded', () => {
    // 1. Authenticate & Hydrate User Profile
    onAuthStateChanged(auth, async (user) => {
        if (!user) return;
        
        try {
            const userDocRef = doc(db, "cadets", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                const fullName = `${data.lastName || ''}, ${data.firstName || ''} ${data.middleName || ''}`.trim();

                const userNameEl = document.getElementById('userName');
                const userRankEl = document.getElementById('userRank');
                const userClassEl = document.getElementById('userClass');
                const userEmailEl = document.getElementById('userEmail');

                if (userNameEl) userNameEl.textContent = fullName || 'Cadet';
                if (userRankEl) userRankEl.textContent = data.rotcComponent || data.rank || '';
                if (userClassEl) userClassEl.textContent = data.rotcComponent || data.class || 'N/A';
                if (userEmailEl) userEmailEl.textContent = data.emailAddress || data.email || user.email;
            }
        } catch (error) {
            console.error("Error loading profile:", error);
        }
    });

    // 2. Core Initializations
    setupSidebarAndLogout();
    setupGlobalAttendanceDelegation();
    
    // 3. Listen to Realtime Cadet Database Changes
    listenToCadets();
});

function setupSidebarAndLogout() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    
    if (sidebar && sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await signOut(auth);
                window.location.href = "index.html";
            } catch (err) {
                console.error("Sign-out failed:", err);
            }
        });
    }
}

/**
 * Streams cadets live from Firestore and categorizes them into campus and gender.
 */
function listenToCadets() {
    const cadetsRef = collection(db, "cadets");

    onSnapshot(cadetsRef, (snapshot) => {
        // Clear cached data object
        for (const key in cadetCache) delete cadetCache[key];

        snapshot.forEach((docSnap) => {
            const cadet = docSnap.data();
            const cadetId = docSnap.id;
            cadetCache[cadetId] = { id: cadetId, ...cadet };
        });

        // Re-render all campuses using current filter state
        Object.keys(campusFilterState).forEach(campusId => {
            renderCampusTables(campusId);
        });
    }, (error) => {
        console.error("Error listening to cadets realtime stream:", error);
    });
}

/**
 * Filters, sorts, paginates, and renders cadet tables for a specified campus.
 */
function renderCampusTables(campusId) {
    const container = document.getElementById(campusId);
    if (!container) return;

    const state = campusFilterState[campusId] || { sortOrder: 'asc', pageSize: 10, currentPage: { male: 1, female: 1 }, searchQuery: '' };

    const maleList = [];
    const femaleList = [];

    // Filter cadets matching this campus
    Object.values(cadetCache).forEach(cadet => {
        const rawCampus = cadet.campus || cadet.school || '';
        const mappedId = campusIdMap[rawCampus] || rawCampus.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (mappedId === campusId) {
            const gender = (cadet.gender || cadet.sex || '').toLowerCase();
            if (gender === 'female') {
                femaleList.push(cadet);
            } else {
                maleList.push(cadet);
            }
        }
    });

    // Helper: Sort array alphabetically
    const sortCadets = (list) => {
        return list.sort((a, b) => {
            const nameA = `${a.lastName || ''} ${a.firstName || ''}`.toUpperCase();
            const nameB = `${b.lastName || ''} ${b.firstName || ''}`.toUpperCase();
            return state.sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        });
    };

    // Helper: Filter by search query
    const filterBySearch = (list) => {
        if (!state.searchQuery) return list;
        return list.filter(cadet => {
            const name = `${cadet.lastName || ''}, ${cadet.firstName || ''} ${cadet.middleName || ''}`.toLowerCase();
            return name.includes(state.searchQuery.toLowerCase());
        });
    };

    renderGenderTable(campusId, 'male', filterBySearch(sortCadets(maleList)));
    renderGenderTable(campusId, 'female', filterBySearch(sortCadets(femaleList)));

    updateCampusTotals(container);
}

function renderGenderTable(campusId, gender, cadets) {
    const container = document.getElementById(campusId);
    if (!container) return;

    const tbody = container.querySelector(gender === 'female' ? '.female-cadet-list' : '.male-cadet-list');
    const paginationContainer = container.querySelector(gender === 'female' ? '.female-pagination' : '.male-pagination');
    if (!tbody) return;

    tbody.innerHTML = '';

    const state = campusFilterState[campusId];
    const totalCadets = cadets.length;
    const pageSize = state.pageSize === 'all' ? totalCadets : parseInt(state.pageSize, 10);
    const totalPages = pageSize > 0 ? Math.ceil(totalCadets / pageSize) || 1 : 1;

    // Adjust page bounds
    if (state.currentPage[gender] > totalPages) state.currentPage[gender] = totalPages;
    if (state.currentPage[gender] < 1) state.currentPage[gender] = 1;

    const currentPage = state.currentPage[gender];
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = state.pageSize === 'all' ? totalCadets : startIndex + pageSize;
    const pageCadets = cadets.slice(startIndex, endIndex);

    pageCadets.forEach(cadet => {
        const tr = createCadetRow(cadet.id, cadet);
        tbody.appendChild(tr);
    });

    // Build pagination controls
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
        if (state.pageSize !== 'all' && totalPages > 1) {
            const prevBtn = document.createElement('button');
            prevBtn.className = 'page-btn';
            prevBtn.textContent = '« Prev';
            prevBtn.disabled = currentPage === 1;
            prevBtn.onclick = () => changeCampusPage(campusId, gender, currentPage - 1);
            paginationContainer.appendChild(prevBtn);

            for (let i = 1; i <= totalPages; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.onclick = () => changeCampusPage(campusId, gender, i);
                paginationContainer.appendChild(pageBtn);
            }

            const nextBtn = document.createElement('button');
            nextBtn.className = 'page-btn';
            nextBtn.textContent = 'Next »';
            nextBtn.disabled = currentPage === totalPages;
            nextBtn.onclick = () => changeCampusPage(campusId, gender, currentPage + 1);
            paginationContainer.appendChild(nextBtn);
        }
    }
}

/**
 * Builds a single dynamic table row with clickable cadet names.
 */
function createCadetRow(id, cadet) {
    const tr = document.createElement('tr');
    tr.dataset.id = id;

    const lastName = (cadet.lastName || '').toUpperCase();
    const firstName = (cadet.firstName || '').toUpperCase();
    const middleName = (cadet.middleName || '').toUpperCase();
    const fullName = `${lastName}, ${firstName} ${middleName}`.trim();

    // Default 5-day training schedule
    const attendance = cadet.attendance || [true, true, true, true, true];
    let absences = 0;

    let checkboxesHTML = '';
    for (let i = 0; i < 5; i++) {
        const isChecked = attendance[i] !== undefined ? attendance[i] : true;
        if (!isChecked) absences++;
        checkboxesHTML += `<td><input type="checkbox" class="att-checkbox" data-index="${i}" ${isChecked ? 'checked' : ''}></td>`;
    }

    const isDropped = absences > 3;
    const statusText = isDropped ? 'DROPPED' : 'ACTIVE';
    const statusClass = isDropped ? 'status-dropped' : 'status-active';

    tr.innerHTML = `
        <td class="student-name">
            <button class="student-name-btn" onclick="openCadetDrawer('${id}')">${fullName}</button>
        </td>
        ${checkboxesHTML}
        <td class="absence-count">${absences}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
    `;

    return tr;
}

window.updateCampusFilter = function(campusId, key, value) {
    if (!campusFilterState[campusId]) return;
    campusFilterState[campusId][key] = value;
    
    // Reset page numbers when changing page sizes or sorting
    campusFilterState[campusId].currentPage.male = 1;
    campusFilterState[campusId].currentPage.female = 1;

    renderCampusTables(campusId);
};

window.changeCampusPage = function(campusId, gender, pageNum) {
    if (!campusFilterState[campusId]) return;
    campusFilterState[campusId].currentPage[gender] = pageNum;
    renderCampusTables(campusId);
};

window.filterCadets = function(campusId, query) {
    if (!campusFilterState[campusId]) return;
    campusFilterState[campusId].searchQuery = query.trim();
    campusFilterState[campusId].currentPage.male = 1;
    campusFilterState[campusId].currentPage.female = 1;
    renderCampusTables(campusId);
};

/**
 * Event Delegation for Attendance Checkboxes
 */
function setupGlobalAttendanceDelegation() {
    document.addEventListener('change', async (e) => {
        if (e.target && e.target.classList.contains('att-checkbox')) {
            const row = e.target.closest('tr');
            if (!row) return;

            recalculateRowAbsences(row);

            const campusContainer = e.target.closest('.campus-dropdown-body');
            if (campusContainer) updateCampusTotals(campusContainer);

            // Persist modified attendance to Firestore
            const cadetId = row.dataset.id;
            if (cadetId) {
                const checkboxes = row.querySelectorAll('.att-checkbox');
                const updatedAttendance = Array.from(checkboxes).map(cb => cb.checked);
                
                try {
                    await updateDoc(doc(db, "cadets", cadetId), {
                        attendance: updatedAttendance
                    });
                } catch (err) {
                    console.error("Failed to sync attendance state to Firestore:", err);
                }
            }
        }
    });
}

function recalculateRowAbsences(row) {
    const checkboxes = row.querySelectorAll('.att-checkbox');
    let absences = 0;

    checkboxes.forEach(cb => {
        if (!cb.checked) absences++;
    });

    const absenceCell = row.querySelector('.absence-count');
    const statusCell = row.querySelector('.status-badge');

    if (absenceCell) absenceCell.textContent = absences;

    if (statusCell) {
        const isDropped = absences > 3;
        statusCell.textContent = isDropped ? 'DROPPED' : 'ACTIVE';
        statusCell.className = `status-badge ${isDropped ? 'status-dropped' : 'status-active'}`;
    }
}

function updateCampusTotals(campusContainer) {
    if (!campusContainer) return;

    let maleActive = 0, maleDropped = 0;
    let femaleActive = 0, femaleDropped = 0;

    const campusId = campusContainer.id;

    // Evaluate stats across total cached cadets for this campus
    Object.values(cadetCache).forEach(cadet => {
        const rawCampus = cadet.campus || cadet.school || '';
        const mappedId = campusIdMap[rawCampus] || rawCampus.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (mappedId === campusId) {
            const gender = (cadet.gender || cadet.sex || '').toLowerCase();
            const attendance = cadet.attendance || [true, true, true, true, true];
            const absences = attendance.filter(val => val === false).length;
            const isDropped = absences > 3;

            if (gender === 'female') {
                if (isDropped) femaleDropped++; else femaleActive++;
            } else {
                if (isDropped) maleDropped++; else maleActive++;
            }
        }
    });

    const setSafeText = (selector, val) => {
        const el = campusContainer.querySelector(selector);
        if (el) el.textContent = val;
    };

    setSafeText('.male-count', maleActive + maleDropped);
    setSafeText('.female-count', femaleActive + femaleDropped);

    setSafeText('.active-male-count', maleActive);
    setSafeText('.active-female-count', femaleActive);
    setSafeText('.total-active-count', maleActive + femaleActive);

    setSafeText('.dropped-male-count', maleDropped);
    setSafeText('.dropped-female-count', femaleDropped);
    setSafeText('.total-dropped-count', maleDropped + femaleDropped);
}

// Drawer population & display triggers mapping all Enrolment Form fields
window.openCadetDrawer = function(cadetId) {
    const cadet = cadetCache[cadetId];
    if (!cadet) return;

    document.getElementById('editCadetId').value = cadetId;
    
    // Personal Information
    document.getElementById('editLastName').value = cadet.lastName || '';
    document.getElementById('editFirstName').value = cadet.firstName || '';
    document.getElementById('editMiddleName').value = cadet.middleName || '';
    document.getElementById('editExtensionName').value = cadet.extensionName || '';
    document.getElementById('editGender').value = cadet.gender || 'Male';
    document.getElementById('editBirthDate').value = cadet.birthDate || '';
    document.getElementById('editContactNumber').value = cadet.contactNumber || '';
    document.getElementById('editEmail').value = cadet.emailAddress || cadet.email || '';

    // Academic & ROTC Details
    document.getElementById('editStudentNumber').value = cadet.studentNumber || '';
    document.getElementById('editCampus').value = cadet.campus || 'WVSU - Main Campus';
    document.getElementById('editCourse').value = cadet.course || '';
    document.getElementById('editYearLevel').value = cadet.yearLevel || '1st Year';
    document.getElementById('editRotcComponent').value = cadet.rotcComponent || 'MS 1';
    document.getElementById('editPlatoon').value = cadet.platoon || '';

    // Emergency Contact
    document.getElementById('editGuardianName').value = cadet.guardianName || '';
    document.getElementById('editGuardianRelationship').value = cadet.guardianRelationship || '';
    document.getElementById('editGuardianContact').value = cadet.guardianContact || '';

    cancelCadetEdit();

    document.getElementById('drawerOverlay').classList.add('active');
    document.getElementById('cadetDrawer').classList.add('open');
};

window.closeCadetDrawer = function() {
    document.getElementById('drawerOverlay').classList.remove('active');
    document.getElementById('cadetDrawer').classList.remove('open');
    cancelCadetEdit();
};

window.enableCadetEdit = function() {
    const inputs = document.querySelectorAll('.drawer-input');
    inputs.forEach(input => input.disabled = false);

    document.getElementById('viewActions').style.display = 'none';
    document.getElementById('editActions').style.display = 'flex';
};

window.cancelCadetEdit = function() {
    const inputs = document.querySelectorAll('.drawer-input');
    inputs.forEach(input => input.disabled = true);

    document.getElementById('viewActions').style.display = 'flex';
    document.getElementById('editActions').style.display = 'none';
};

window.saveCadetChanges = async function() {
    const cadetId = document.getElementById('editCadetId').value;
    if (!cadetId) return;

    const updatedData = {
        lastName: document.getElementById('editLastName').value.trim(),
        firstName: document.getElementById('editFirstName').value.trim(),
        middleName: document.getElementById('editMiddleName').value.trim(),
        extensionName: document.getElementById('editExtensionName').value.trim(),
        gender: document.getElementById('editGender').value,
        birthDate: document.getElementById('editBirthDate').value,
        contactNumber: document.getElementById('editContactNumber').value.trim(),
        emailAddress: document.getElementById('editEmail').value.trim(),
        
        studentNumber: document.getElementById('editStudentNumber').value.trim(),
        campus: document.getElementById('editCampus').value,
        course: document.getElementById('editCourse').value.trim(),
        yearLevel: document.getElementById('editYearLevel').value,
        rotcComponent: document.getElementById('editRotcComponent').value,
        platoon: document.getElementById('editPlatoon').value.trim(),

        guardianName: document.getElementById('editGuardianName').value.trim(),
        guardianRelationship: document.getElementById('editGuardianRelationship').value.trim(),
        guardianContact: document.getElementById('editGuardianContact').value.trim()
    };

    try {
        await updateDoc(doc(db, "cadets", cadetId), updatedData);
        alert("Cadet details updated successfully!");
        closeCadetDrawer();
    } catch (err) {
        console.error("Failed to update cadet profile:", err);
        alert("Error saving cadet information.");
    }
};

window.deleteCadet = async function() {
    const cadetId = document.getElementById('editCadetId').value;
    if (!cadetId) return;

    const confirmDelete = confirm("Are you sure you want to delete this cadet? This action cannot be undone.");
    if (!confirmDelete) return;

    try {
        await deleteDoc(doc(db, "cadets", cadetId));
        alert("Cadet record deleted successfully!");
        closeCadetDrawer();
    } catch (err) {
        console.error("Failed to delete cadet:", err);
        alert("Error deleting cadet record.");
    }
};

window.toggleAccordion = function(campusId) {
    const wrapper = document.getElementById(`${campusId}-wrapper`);
    if (!wrapper) return;
    
    const parentCard = wrapper.closest('.campus-card-accordion');
    const icon = parentCard ? parentCard.querySelector('.dropdown-icon') : null;

    const isOpen = wrapper.classList.toggle('open');
    if (icon) {
        icon.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
    }
};

window.exportCampusToExcel = function(campusId) {
    const container = document.getElementById(campusId);
    if (!container || !window.XLSX) {
        console.warn("Target element or XLSX library missing.");
        return;
    }

    const campusName = container.getAttribute('data-campus-name') || campusId;
    const wb = XLSX.utils.book_new();

    const parseTableData = (gender) => {
        const data = [
            [`${campusName.toUpperCase()} - ${gender.toUpperCase()} CADETS DIRECTORY`],
            ["NAME", "SAT 1", "SAT 2", "SAT 3", "SAT 4", "SAT 5", "ABSENCES", "STATUS"]
        ];

        Object.values(cadetCache).forEach(cadet => {
            const rawCampus = cadet.campus || cadet.school || '';
            const mappedId = campusIdMap[rawCampus] || rawCampus.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (mappedId === campusId && (cadet.gender || '').toLowerCase() === gender.toLowerCase()) {
                const fullName = `${cadet.lastName || ''}, ${cadet.firstName || ''} ${cadet.middleName || ''}`.toUpperCase().trim();
                const attendance = cadet.attendance || [true, true, true, true, true];
                
                const sat = Array.from({ length: 5 }, (_, i) => 
                    attendance[i] !== undefined && attendance[i] ? 'P' : 'A'
                );
                
                const absences = attendance.filter(v => v === false).length;
                const status = absences > 3 ? 'DROPPED' : 'ACTIVE';

                data.push([fullName, ...sat, absences, status]);
            }
        });

        return data;
    };

    const maleData = parseTableData('male');
    const femaleData = parseTableData('female');

    const getText = (cls) => {
        const el = container.querySelector(cls);
        return el ? el.textContent : '0';
    };

    const summaryHeader = [
        [],
        ["CAMPUS STATISTICAL SUMMARY"],
        ["ACTIVE MALES", getText('.active-male-count'), "DROPPED MALES", getText('.dropped-male-count')],
        ["ACTIVE FEMALES", getText('.active-female-count'), "DROPPED FEMALES", getText('.dropped-female-count')],
        ["TOTAL ACTIVE CADETS", getText('.total-active-count'), "TOTAL DROPPED CADETS", getText('.total-dropped-count')],
        []
    ];

    const fullSheetData = [...summaryHeader, ...maleData, [], ...femaleData];
    const ws = XLSX.utils.aoa_to_sheet(fullSheetData);
    XLSX.utils.book_append_sheet(wb, ws, "Attendance Directory");

    XLSX.writeFile(wb, `${campusName}_Attendance_Report.xlsx`);
};

window.printCampusDirectory = function(cardElementId) {
    const targetCard = document.getElementById(cardElementId);
    if (!targetCard) return;
    
    const wrapper = targetCard.querySelector('.accordion-wrapper');
    const icon = targetCard.querySelector('.dropdown-icon');
    
    if (wrapper) wrapper.classList.add('open');
    if (icon) icon.style.transform = 'rotate(180deg)';

    targetCard.classList.add('printable-active');
    window.print();
    targetCard.classList.remove('printable-active');
};