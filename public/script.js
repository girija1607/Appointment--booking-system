// State Management
const state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  selectedSlot: null,
  currentProfessorId: null,
  reschedulingAptId: null
};

// UI Elements
const els = {
  toastContainer: document.getElementById('toast-container'),
  nav: document.getElementById('app-nav'),
  navUsername: document.getElementById('nav-username'),
  navRole: document.getElementById('nav-role'),
  navAvatar: document.getElementById('nav-avatar'),
  btnLogout: document.getElementById('btn-logout'),
  
  viewAuth: document.getElementById('view-auth'),
  viewStudent: document.getElementById('view-student'),
  viewProfessor: document.getElementById('view-professor'),
  
  tabLogin: document.getElementById('tab-login'),
  tabRegister: document.getElementById('tab-register'),
  formLogin: document.getElementById('form-login'),
  formRegister: document.getElementById('form-register'),
  
  selectProfessor: document.getElementById('select-professor'),
  slotsContainerSection: document.getElementById('slots-container-section'),
  slotsGrid: document.getElementById('slots-grid'),
  studentAptsList: document.getElementById('student-appointments-list'),
  
  formAvailability: document.getElementById('form-availability'),
  profSlotsList: document.getElementById('professor-slots-list'),
  profAptsList: document.getElementById('professor-appointments-list'),
  
  modalReschedule: document.getElementById('modal-reschedule'),
  modalSlotsGrid: document.getElementById('modal-slots-grid'),
  btnModalClose: document.getElementById('btn-modal-close')
};

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-exclamation-circle';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;
  
  els.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

// API Request Wrapper
async function apiRequest(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }
  
  const config = {
    ...options,
    headers
  };
  
  try {
    const res = await fetch(url, config);
    
    // Auto logout on token expiration/invalid
    if ((res.status === 401 || res.status === 403) && state.token) {
      showToast('Session expired. Please log in again.', 'error');
      logout();
      return null;
    }
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Something went wrong');
    }
    return data;
  } catch (err) {
    showToast(err.message, 'error');
    console.error('API Error:', err);
    throw err;
  }
}

// Formatting helpers
function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Auth Handlers
function checkAuth() {
  if (state.token && state.user) {
    els.nav.classList.remove('hide');
    els.navUsername.textContent = state.user.username;
    els.navRole.textContent = state.user.role;
    els.navRole.className = `badge ${state.user.role}`;
    els.navAvatar.textContent = state.user.username.charAt(0);
    els.viewAuth.classList.add('hide');
    
    if (state.user.role === 'student') {
      els.viewStudent.classList.remove('hide');
      els.viewProfessor.classList.add('hide');
      initStudentDashboard();
    } else {
      els.viewProfessor.classList.remove('hide');
      els.viewStudent.classList.add('hide');
      initProfessorDashboard();
    }
  } else {
    els.nav.classList.add('hide');
    els.viewAuth.classList.remove('hide');
    els.viewStudent.classList.add('hide');
    els.viewProfessor.classList.add('hide');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  checkAuth();
  showToast('Logged out successfully', 'success');
}

// Event Listeners for Tabs
els.tabLogin.addEventListener('click', () => {
  els.tabLogin.classList.add('active');
  els.tabRegister.classList.remove('active');
  els.formLogin.classList.remove('hide');
  els.formRegister.classList.add('hide');
});

els.tabRegister.addEventListener('click', () => {
  els.tabRegister.classList.add('active');
  els.tabLogin.classList.remove('active');
  els.formRegister.classList.remove('hide');
  els.formLogin.classList.add('hide');
});

// Login Form Submit
els.formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    
    if (data) {
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      showToast(`Welcome back, ${data.user.username}!`, 'success');
      checkAuth();
      els.formLogin.reset();
    }
  } catch (err) {}
});

// Register Form Submit
els.formRegister.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('register-username').value;
  const password = document.getElementById('register-password').value;
  const role = document.querySelector('input[name="register-role"]:checked').value;
  
  try {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role })
    });
    
    if (data) {
      showToast('Registration successful! Please log in.', 'success');
      els.tabLogin.click();
      els.formRegister.reset();
    }
  } catch (err) {}
});

els.btnLogout.addEventListener('click', logout);

// --- STUDENT DASHBOARD CODE ---

async function initStudentDashboard() {
  await loadProfessors();
  await loadStudentAppointments();
}

async function loadProfessors() {
  try {
    const professors = await apiRequest('/auth/professors');
    els.selectProfessor.innerHTML = '<option value="" disabled selected>Choose a professor...</option>';
    if (professors) {
      professors.forEach(prof => {
        const option = document.createElement('option');
        option.value = prof._id;
        option.textContent = prof.username;
        els.selectProfessor.appendChild(option);
      });
    }
  } catch (err) {}
}

els.selectProfessor.addEventListener('change', async (e) => {
  const professorId = e.target.value;
  state.currentProfessorId = professorId;
  
  // Show custom request container
  document.getElementById('custom-request-divider')?.classList.remove('hide');
  document.getElementById('custom-request-section')?.classList.remove('hide');
  
  // Bind pickers for custom inputs
  document.getElementById('custom-date')?.addEventListener('click', function() { this.showPicker(); });
  document.getElementById('custom-time')?.addEventListener('click', function() { this.showPicker(); });

  await loadProfessorAvailability(professorId);
});

// Submit Custom Appointment Request
document.getElementById('form-custom-request')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentProfessorId) {
    showToast('Please select a professor first', 'error');
    return;
  }
  
  const dateVal = document.getElementById('custom-date').value;
  const timeVal = document.getElementById('custom-time').value;
  const durationVal = parseInt(document.getElementById('custom-duration').value);
  
  const startDate = new Date(`${dateVal}T${timeVal}`);
  const endDate = new Date(startDate.getTime() + durationVal * 60 * 1000);
  
  const formatISO = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  
  const slot = {
    start: formatISO(startDate),
    end: formatISO(endDate)
  };
  
  try {
    const data = await apiRequest('/appointments', {
      method: 'POST',
      body: JSON.stringify({
        professorId: state.currentProfessorId,
        slot,
        isCustom: true
      })
    });
    
    if (data) {
      showToast('Custom appointment request submitted successfully!', 'success');
      document.getElementById('form-custom-request').reset();
      await loadStudentAppointments();
    }
  } catch (err) {}
});

async function loadProfessorAvailability(professorId) {
  try {
    const slots = await apiRequest(`/availability/${professorId}`);
    els.slotsContainerSection.classList.remove('hide');
    els.slotsGrid.innerHTML = '';
    
    if (!slots || slots.length === 0) {
      els.slotsGrid.innerHTML = '<div class="empty-state-compact"><p>No available slots found for this professor.</p></div>';
      return;
    }
    
    // Fetch currently booked appointments for this professor to avoid displaying booked ones
    const allBooked = await apiRequest('/appointments/student'); // filter locally or just rely on backend conflict handling
    
    slots.forEach((slot, index) => {
      const slotButton = document.createElement('button');
      slotButton.className = 'slot-btn';
      
      const dateObj = new Date(slot.start);
      const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeString = formatTime(slot.start);
      
      slotButton.innerHTML = `
        <span class="slot-date">${dateString}</span>
        <span class="slot-time">${timeString}</span>
      `;
      
      slotButton.addEventListener('click', () => {
        document.querySelectorAll('.slot-btn').forEach(btn => btn.classList.remove('selected'));
        slotButton.classList.add('selected');
        state.selectedSlot = slot;
        bookSlotDirectly(slot);
      });
      
      els.slotsGrid.appendChild(slotButton);
    });
  } catch (err) {}
}

async function bookSlotDirectly(slot) {
  if (!state.currentProfessorId) return;
  
  if (confirm(`Do you want to book appointment for ${formatDateTime(slot.start)}?`)) {
    try {
      const data = await apiRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          professorId: state.currentProfessorId,
          slot
        })
      });
      if (data) {
        showToast('Appointment booked successfully! Awaiting confirmation.', 'success');
        await loadStudentAppointments();
        // Refresh availability grid
        await loadProfessorAvailability(state.currentProfessorId);
      }
    } catch (err) {}
  }
}

async function loadStudentAppointments() {
  try {
    const appointments = await apiRequest('/appointments/student');
    els.studentAptsList.innerHTML = '';
    
    if (!appointments || appointments.length === 0) {
      els.studentAptsList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-calendar-xmark"></i>
          <p>No appointments booked yet.</p>
        </div>
      `;
      return;
    }
    
    appointments.forEach(apt => {
      const card = document.createElement('div');
      card.className = 'appointment-card';
      
      const statusBadgeClass = `badge status-${apt.status}`;
      
      // Look up professor name if populated, or show ID
      const profName = apt.professorId ? (apt.professorId.username || 'Professor') : 'Professor';
      
      let actionButtons = '';
      if (apt.status !== 'cancelled') {
        actionButtons = `
          <div class="apt-actions">
            <button class="btn btn-outline btn-sm btn-reschedule" data-id="${apt._id}" data-prof="${apt.professorId._id || apt.professorId}">
              <i class="fa-solid fa-clock"></i> Reschedule
            </button>
            <button class="btn btn-danger btn-sm btn-cancel" data-id="${apt._id}">
              <i class="fa-solid fa-trash"></i> Cancel
            </button>
          </div>
        `;
      }
      
      card.innerHTML = `
        <div class="apt-info-block">
          <div class="apt-icon">
            <i class="fa-solid fa-chalkboard-user"></i>
          </div>
          <div class="apt-info">
            <h4>${profName}</h4>
            <div class="apt-time">
              <i class="fa-regular fa-clock"></i>
              <span>${formatDateTime(apt.slot.start)}</span>
            </div>
            <div style="margin-top: 0.5rem">
              <span class="${statusBadgeClass}">${apt.status}</span>
            </div>
          </div>
        </div>
        ${actionButtons}
      `;
      
      // Cancel Event
      const btnCancel = card.querySelector('.btn-cancel');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => cancelAppointment(apt._id));
      }
      
      // Reschedule Event
      const btnResched = card.querySelector('.btn-reschedule');
      if (btnResched) {
        btnResched.addEventListener('click', () => openRescheduleModal(apt._id, btnResched.dataset.prof));
      }
      
      els.studentAptsList.appendChild(card);
    });
  } catch (err) {}
}

async function cancelAppointment(aptId) {
  if (confirm('Are you sure you want to cancel this appointment?')) {
    try {
      const data = await apiRequest(`/appointments/${aptId}/cancel`, {
        method: 'PATCH'
      });
      if (data) {
        showToast('Appointment cancelled successfully', 'info');
        if (state.user.role === 'student') {
          await loadStudentAppointments();
          if (state.currentProfessorId) {
            await loadProfessorAvailability(state.currentProfessorId);
          }
        } else {
          await loadProfessorAppointments();
        }
      }
    } catch (err) {}
  }
}

// Rescheduling Modal
async function openRescheduleModal(aptId, profId) {
  state.reschedulingAptId = aptId;
  els.modalReschedule.classList.remove('hide');
  els.modalSlotsGrid.innerHTML = '<div class="empty-state-compact"><p>Loading available slots...</p></div>';
  
  try {
    const slots = await apiRequest(`/availability/${profId}`);
    els.modalSlotsGrid.innerHTML = '';
    
    if (!slots || slots.length === 0) {
      els.modalSlotsGrid.innerHTML = '<div class="empty-state-compact"><p>No slots available for rescheduling.</p></div>';
      return;
    }
    
    slots.forEach(slot => {
      const slotButton = document.createElement('button');
      slotButton.className = 'slot-btn';
      
      const dateObj = new Date(slot.start);
      const dateString = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timeString = formatTime(slot.start);
      
      slotButton.innerHTML = `
        <span class="slot-date">${dateString}</span>
        <span class="slot-time">${timeString}</span>
      `;
      
      slotButton.addEventListener('click', () => executeReschedule(slot));
      els.modalSlotsGrid.appendChild(slotButton);
    });
  } catch (err) {
    els.modalReschedule.classList.add('hide');
  }
}

async function executeReschedule(slot) {
  if (!state.reschedulingAptId) return;
  
  if (confirm(`Reschedule appointment to ${formatDateTime(slot.start)}?`)) {
    try {
      const data = await apiRequest(`/appointments/${state.reschedulingAptId}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ slot })
      });
      
      if (data) {
        showToast('Appointment rescheduled successfully! Awaiting approval.', 'success');
        els.modalReschedule.classList.add('hide');
        await loadStudentAppointments();
        if (state.currentProfessorId) {
          await loadProfessorAvailability(state.currentProfessorId);
        }
      }
    } catch (err) {}
  }
}

els.btnModalClose.addEventListener('click', () => {
  els.modalReschedule.classList.add('hide');
});

window.addEventListener('click', (e) => {
  if (e.target === els.modalReschedule) {
    els.modalReschedule.classList.add('hide');
  }
});


// --- PROFESSOR DASHBOARD CODE ---

function initProfessorDashboard() {
  loadProfessorSlots();
  loadProfessorAppointments();
}

async function loadProfessorSlots() {
  try {
    const slots = await apiRequest(`/availability/${state.user.id}`);
    els.profSlotsList.innerHTML = '';
    
    if (!slots || slots.length === 0) {
      els.profSlotsList.innerHTML = '<div class="empty-state-compact"><p>No slots configured yet.</p></div>';
      return;
    }
    
    slots.forEach(slot => {
      const tag = document.createElement('div');
      tag.className = 'slot-tag-compact';
      tag.innerHTML = `
        <i class="fa-regular fa-clock"></i>
        <span>${formatDateTime(slot.start)} - ${formatTime(slot.end)}</span>
      `;
      els.profSlotsList.appendChild(tag);
    });
  } catch (err) {}
}

// Add Availability Slot
els.formAvailability.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dateVal = document.getElementById('slot-date').value;
  const timeVal = document.getElementById('slot-time').value;
  const durationVal = parseInt(document.getElementById('slot-duration').value);
  
  const startDate = new Date(`${dateVal}T${timeVal}`);
  const endDate = new Date(startDate.getTime() + durationVal * 60 * 1000);
  
  // Format local dates to YYYY-MM-DDTHH:mm
  const formatISO = (d) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  
  const slot = {
    start: formatISO(startDate),
    end: formatISO(endDate)
  };
  
  try {
    const data = await apiRequest('/availability', {
      method: 'POST',
      body: JSON.stringify({ slots: [slot] })
    });
    
    if (data) {
      showToast('Availability slot added successfully!', 'success');
      els.formAvailability.reset();
      await loadProfessorSlots();
    }
  } catch (err) {}
});

async function loadProfessorAppointments() {
  try {
    const appointments = await apiRequest('/appointments/professor');
    els.profAptsList.innerHTML = '';
    
    if (!appointments || appointments.length === 0) {
      els.profAptsList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-inbox"></i>
          <p>No incoming appointment requests.</p>
        </div>
      `;
      return;
    }
    
    appointments.forEach(apt => {
      const card = document.createElement('div');
      card.className = 'appointment-card';
      
      const statusBadgeClass = `badge status-${apt.status}`;
      const studentName = apt.studentId ? (apt.studentId.username || 'Student') : 'Student';
      
      let actionButtons = '';
      if (apt.status === 'pending') {
        actionButtons = `
          <div class="apt-actions">
            <button class="btn btn-success btn-sm btn-confirm" data-id="${apt._id}">
              <i class="fa-solid fa-check"></i> Confirm
            </button>
            <button class="btn btn-danger btn-sm btn-cancel" data-id="${apt._id}">
              <i class="fa-solid fa-xmark"></i> Cancel
            </button>
          </div>
        `;
      } else if (apt.status === 'confirmed') {
        actionButtons = `
          <div class="apt-actions">
            <button class="btn btn-danger btn-sm btn-cancel" data-id="${apt._id}">
              <i class="fa-solid fa-ban"></i> Cancel Booking
            </button>
          </div>
        `;
      }
      
      card.innerHTML = `
        <div class="apt-info-block">
          <div class="apt-icon">
            <i class="fa-solid fa-user-graduate"></i>
          </div>
          <div class="apt-info">
            <h4>${studentName}</h4>
            <div class="apt-time">
              <i class="fa-regular fa-clock"></i>
              <span>${formatDateTime(apt.slot.start)}</span>
            </div>
            <div style="margin-top: 0.5rem">
              <span class="${statusBadgeClass}">${apt.status}</span>
            </div>
          </div>
        </div>
        ${actionButtons}
      `;
      
      const btnConfirm = card.querySelector('.btn-confirm');
      if (btnConfirm) {
        btnConfirm.addEventListener('click', () => confirmAppointment(apt._id));
      }
      
      const btnCancel = card.querySelector('.btn-cancel');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => cancelAppointment(apt._id));
      }
      
      els.profAptsList.appendChild(card);
    });
  } catch (err) {}
}

async function confirmAppointment(aptId) {
  try {
    const data = await apiRequest(`/appointments/${aptId}/confirm`, {
      method: 'PATCH'
    });
    if (data) {
      showToast('Appointment confirmed successfully!', 'success');
      await loadProfessorAppointments();
    }
  } catch (err) {}
}

// Open native pickers programmatically on click anywhere in the inputs
document.getElementById('slot-date')?.addEventListener('click', function() {
  try {
    this.showPicker();
  } catch (err) {}
});
document.getElementById('slot-time')?.addEventListener('click', function() {
  try {
    this.showPicker();
  } catch (err) {}
});

// Start Application
checkAuth();
