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
    addDoc,
    deleteDoc,
    query,
    where,
    onSnapshot
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

let currentDate = new Date();
let selectedDateStr = formatDateKey(new Date());
let attendanceChart = null;

document.addEventListener('DOMContentLoaded', () => {
    // --------------------------------------------------
    // AUTHENTICATION & PROFILE
    // --------------------------------------------------
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDocRef = doc(db, "cadets", user.uid);
                const userDocSnap = await getDoc(userDocRef);

                if (userDocSnap.exists()) {
                    const data = userDocSnap.data();
                    const fullName = `${data.firstName} ${data.middleName ? data.middleName + ' ' : ''}${data.lastName} ${data.suffix || ''}`.trim();

                    document.getElementById('userName').textContent = fullName || 'Cadet';
                    document.getElementById('userRank').textContent = data.rank || '';
                    document.getElementById('userClass').textContent = data.class || 'N/A';
                    document.getElementById('userEmail').textContent = data.email || user.email;
                }
            } catch (error) {
                console.error("Error fetching user details:", error);
            }
        } else {
            window.location.href = "index.html";
        }
    });

    // --------------------------------------------------
    // SIDEBAR TOGGLE & LOGOUT
    // --------------------------------------------------
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
            } catch (error) {
                alert("Logout Error: " + error.message);
            }
        });
    }

    // --------------------------------------------------
    // REAL-TIME CAMPUS KPI COUNTS & DYNAMIC CHART
    // --------------------------------------------------
    initAttendanceChart();
    listenToCampusKPIsAndAttendance();

    // --------------------------------------------------
    // CALENDAR & REALTIME DIRECTIVES
    // --------------------------------------------------
    renderCalendar(currentDate);

    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar(currentDate);
    });

    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar(currentDate);
    });

    setupAnnouncementModal();
    listenToAnnouncements(selectedDateStr);
});

// --------------------------------------------------
// CHART INITIALIZATION
// --------------------------------------------------
function initAttendanceChart() {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Total Cadets'],
            datasets: [{
                label: 'Cadets Attended',
                data: [0],
                backgroundColor: '#0047AB',
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1, // Ensures integer ticks for small cadet numbers
                        precision: 0
                    }
                } 
            }
        }
    });
}

// --------------------------------------------------
// REALTIME KPI & ATTENDANCE GRAPH LISTENER
// --------------------------------------------------
function listenToCampusKPIsAndAttendance() {
    onSnapshot(collection(db, "cadets"), (snapshot) => {
        const counts = {
            wvsu: 0,
            stTherese: 0,
            idc: 0,
            aca: 0
        };

        let totalCadets = snapshot.size;

        snapshot.forEach((doc) => {
            const data = doc.data();
            const campus = (data.campus || data.school || "").toLowerCase();

            if (campus.includes("wvsu") || campus.includes("main")) {
                counts.wvsu++;
            } else if (campus.includes("therese") || campus.includes("st. therese")) {
                counts.stTherese++;
            } else if (campus.includes("doctors") || campus.includes("idc")) {
                counts.idc++;
            } else if (campus.includes("aeronautics") || campus.includes("aca")) {
                counts.aca++;
            }
        });

        // Update KPI values in the DOM
        const elWvsu = document.getElementById('kpiWvsu');
        const elStTherese = document.getElementById('kpiStTherese');
        const elIdc = document.getElementById('kpiIdc');
        const elAca = document.getElementById('kpiAca');

        if (elWvsu) elWvsu.textContent = counts.wvsu;
        if (elStTherese) elStTherese.textContent = counts.stTherese;
        if (elIdc) elIdc.textContent = counts.idc;
        if (elAca) elAca.textContent = counts.aca;

        // Dynamic Chart Update based on real Firestore count
        if (attendanceChart) {
            attendanceChart.data.labels = ['Registered Cadets'];
            attendanceChart.data.datasets[0].data = [totalCadets];
            attendanceChart.update();
        }
    });
}

function formatDateKey(dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

function renderCalendar(dateObj) {
    const calendarDays = document.getElementById('calendarDays');
    const calendarMonthYear = document.getElementById('calendarMonthYear');
    calendarDays.innerHTML = '';

    const year = dateObj.getFullYear();
    const month = dateObj.getMonth();

    const monthNames = ["January", "February", "March", "April", "May", "June", 
                        "July", "August", "September", "October", "November", "December"];
    calendarMonthYear.textContent = `${monthNames[month]} ${year}`;

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const todayStr = formatDateKey(new Date());

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyDiv = document.createElement('div');
        emptyDiv.classList.add('day-cell', 'empty');
        calendarDays.appendChild(emptyDiv);
    }

    for (let day = 1; day <= lastDay; day++) {
        const dayCell = document.createElement('div');
        dayCell.classList.add('day-cell');
        
        const thisDateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        dayCell.textContent = day;

        if (thisDateKey === todayStr) dayCell.classList.add('today');
        if (thisDateKey === selectedDateStr) dayCell.classList.add('selected');

        dayCell.addEventListener('click', () => {
            document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected'));
            dayCell.classList.add('selected');
            selectedDateStr = thisDateKey;
            document.getElementById('selectedDateText').textContent = selectedDateStr;
            listenToAnnouncements(selectedDateStr);
        });

        calendarDays.appendChild(dayCell);
    }
}

function setupAnnouncementModal() {
    const announceModal = document.getElementById('announceModal');
    const openBtn = document.getElementById('openAnnounceModalBtn');
    const closeBtn = document.getElementById('closeAnnounceModalBtn');
    const cancelBtn = document.getElementById('cancelAnnounceBtn');
    const typeSelect = document.getElementById('announcementType');
    const normalFields = document.getElementById('normalFields');
    const militaryFields = document.getElementById('militaryFields');
    const announcementForm = document.getElementById('announcementForm');

    openBtn.addEventListener('click', () => announceModal.classList.add('active'));
    closeBtn.addEventListener('click', () => announceModal.classList.remove('active'));
    cancelBtn.addEventListener('click', () => announceModal.classList.remove('active'));

    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'military') {
            normalFields.style.display = 'none';
            militaryFields.style.display = 'block';
        } else {
            normalFields.style.display = 'block';
            militaryFields.style.display = 'none';
        }
    });

    announcementForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const type = typeSelect.value;
        let payload = {
            dateKey: selectedDateStr,
            type: type,
            createdAt: new Date().toISOString()
        };

        if (type === 'normal') {
            payload.message = document.getElementById('normalText').value;
        } else {
            const checkedCampuses = Array.from(document.querySelectorAll('input[name="whoCampus"]:checked'))
                                         .map(cb => cb.value);
            payload.who = checkedCampuses;
            payload.what = document.getElementById('milWhat').value;
            payload.when = document.getElementById('milWhen').value;
            payload.where = document.getElementById('milWhere').value;
            payload.uod = document.getElementById('milUod').value;
        }

        try {
            await addDoc(collection(db, "announcements"), payload);
            alert("Directive saved successfully!");
            announcementForm.reset();
            announceModal.classList.remove('active');
        } catch (error) {
            alert("Error saving: " + error.message);
        }
    });
}

function listenToAnnouncements(dateKey) {
    const listContainer = document.getElementById('announcementsList');
    const q = query(collection(db, "announcements"), where("dateKey", "==", dateKey));

    onSnapshot(q, (snapshot) => {
        listContainer.innerHTML = '';

        if (snapshot.empty) {
            listContainer.innerHTML = '<p class="no-data">No announcements for this date.</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const docId = docSnap.id;
            const card = document.createElement('div');
            card.classList.add('announcement-item');

            const deleteBtnHtml = `
                <button class="delete-announcement-btn" data-id="${docId}" title="Delete Announcement">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            `;

            if (data.type === 'normal') {
                card.innerHTML = `
                    <div class="announcement-item-header">
                        <span class="badge badge-normal">Normal Announcement</span>
                        ${deleteBtnHtml}
                    </div>
                    <p>${data.message}</p>
                `;
            } else {
                const campuses = data.who ? data.who.join(', ') : 'All Units';
                card.innerHTML = `
                    <div class="announcement-item-header">
                        <span class="badge badge-military">Military Directive</span>
                        ${deleteBtnHtml}
                    </div>
                    <div class="mil-directive-grid">
                        <p><strong>WHO:</strong> ${campuses}</p>
                        <p><strong>WHAT:</strong> ${data.what || 'N/A'}</p>
                        <p><strong>WHEN:</strong> ${data.when || 'N/A'}</p>
                        <p><strong>WHERE:</strong> ${data.where || 'N/A'}</p>
                        <p><strong>U.O.D:</strong> ${data.uod || 'N/A'}</p>
                    </div>
                `;
            }

            // Attach Delete Event Listener
            const delBtn = card.querySelector('.delete-announcement-btn');
            delBtn.addEventListener('click', async () => {
                if (confirm("Are you sure you want to delete this directive?")) {
                    try {
                        await deleteDoc(doc(db, "announcements", docId));
                    } catch (err) {
                        alert("Error deleting announcement: " + err.message);
                    }
                }
            });

            listContainer.appendChild(card);
        });
    });
}