// // Common app helpers for auth gating and Firestore usage
// const auth = window._firebase?.auth;
// const db = window._firebase?.db;

function requireAuth(redirectTo = 'index.html'){
  if (!auth) return; // firebase not initialized
  auth.onAuthStateChanged(user => {
    if (!user) {
      if (location.pathname.endsWith(redirectTo)) return;
      location.href = redirectTo;
    }
  });
}

function loginWithEmail(email, password){
  return auth.signInWithEmailAndPassword(email, password);
}

function logout(){
  return auth.signOut();
}

// Password reset
function resetPassword(email){
  if (!auth) return Promise.reject(new Error('Auth not initialized'));
  return auth.sendPasswordResetEmail(email);
}

async function getStudents(){
  if (!db) return [];
  const snap = await db.collection('students').orderBy('name').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function renderStudentsTable(tableBodySelector){
  const tbody = document.querySelector(tableBodySelector);
  if (!tbody) return;
  tbody.innerHTML = '<tr><td class="p-3">Loading...</td></tr>';
  try{
    const students = await getStudents();
    if (!students.length) {
      tbody.innerHTML = '<tr><td class="p-3">No students found</td></tr>';
      return;
    }
    tbody.innerHTML = students.map(s => `
      <tr class="border-t hover:bg-gray-50">
        <td class="p-3">${s.studentId || s.id}</td>
        <td class="p-3"><a class="text-primary hover:underline" href="student-profile.html?id=${s.id}">${s.name || '—'}</a></td>
        <td class="p-3">${s.className || s.class || '—'}</td>
      </tr>`).join('');
  }catch(e){
    tbody.innerHTML = '<tr><td class="p-3 text-red-600">Error loading students</td></tr>';
    console.error(e);
  }
}

async function renderDashboardStats(){
  // simple counts from students collection
  if (!db) return;
  const studentsSnap = await db.collection('students').get();
  const totalStudents = studentsSnap.size;
  const el1 = document.getElementById('totalStudents');
  if (el1) el1.innerText = totalStudents;

  // receipts and classes are application-specific; use placeholders
  const receipts = await db.collection('receipts').get().catch(()=>({size:0}));
  const el2 = document.getElementById('totalReceipts');
  if (el2) el2.innerText = receipts.size || 0;

  const classesSnap = await db.collection('classes').get().catch(()=>({size:0}));
  const el3 = document.getElementById('activeClasses');
  if (el3) el3.innerText = classesSnap.size || 0;

  // Chart: students per class
  const byClass = {};
  studentsSnap.forEach(doc=>{
    const d = doc.data();
    const k = d.className || d.class || 'Unknown';
    byClass[k] = (byClass[k]||0)+1;
  });
  const labels = Object.keys(byClass);
  const data = Object.values(byClass);
  const ctx = document.getElementById('dashboardChart')?.getContext('2d');
  if (ctx){
    // eslint-disable-next-line no-undef
    new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Students per Class', data, backgroundColor: '#dc2626' }] },
      options: { responsive: true }
    });
  }
}

// Simple modal helpers (reuse project modal)
function showModal(msg){
  const el = document.getElementById('modalText');
  if (el) el.innerText = msg;
  document.getElementById('modal')?.classList.remove('hidden');
}
function closeModal(){ document.getElementById('modal')?.classList.add('hidden'); }

// Role-based helpers
async function getUserRole(uid){
  if (!db) return null;
  const doc = await db.collection('users').doc(uid).get();
  return doc.data()?.role || null;
}

async function getCurrentUserRole(){
  if (!auth?.currentUser) return null;
  return getUserRole(auth.currentUser.uid);
}

async function requireRole(requiredRole, redirectTo = 'index.html'){
  if (!auth) return;
  auth.onAuthStateChanged(async user => {
    if (!user) {
      location.href = redirectTo;
      return;
    }
    const role = await getUserRole(user.uid);
    if (role !== requiredRole) {
      location.href = 'index.html';
    }
  });
}

// Student CRUD
async function createStudent(data){
  if (!db) throw new Error('DB not initialized');
  const docRef = await db.collection('students').add({
    name: data.name,
    studentId: data.studentId,
    email: data.email || '',
    phone: data.phone || '',
    classTeachers: data.classTeachers || [],
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return docRef;
}

async function updateStudent(studentId, data){
  if (!db) throw new Error('DB not initialized');
  return db.collection('students').doc(studentId).update({
    ...data,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function markStudentAsCompleted(studentId, classId){
  if (!db) throw new Error('DB not initialized');
  const student = await getStudentById(studentId);
  if (!student) throw new Error('Student not found');
  
  const classTeachers = student.classTeachers || [];
  const updated = classTeachers.map(ct => {
    if (ct.classId === classId) {
      return { ...ct, isCompleted: true };
    }
    return ct;
  });
  
  return db.collection('students').doc(studentId).update({
    classTeachers: updated,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function deleteStudent(studentId){
  if (!db) throw new Error('DB not initialized');
  // Delete related fees and attendance records
  const feesSnap = await db.collection('fees').where('studentId', '==', studentId).get();
  feesSnap.forEach(doc => doc.ref.delete());
  
  const attendSnap = await db.collection('attendance').where('studentId', '==', studentId).get();
  attendSnap.forEach(doc => doc.ref.delete());
  
  return db.collection('students').doc(studentId).delete();
}

async function getStudentById(studentId){
  if (!db) return null;
  const doc = await db.collection('students').doc(studentId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// Replaces the previous createUser implementation.
// Uses a secondary Firebase App so creating a user does NOT change the primary auth state.
async function createUser(email, password, role){
  if (!firebase) throw new Error('Firebase not initialized');
  if (!firebase.apps) throw new Error('Firebase SDK not available');

  // Create a short-lived secondary app instance (unique name)
  const secondaryAppName = 'secondary-' + Date.now();
  let secondaryApp;
  try {
    secondaryApp = firebase.initializeApp(firebase.app().options, secondaryAppName);
  } catch (err) {
    // If initialization fails, try to continue but throw a clearer error
    console.error('Failed to initialize secondary Firebase app', err);
    throw new Error('Failed to initialize secondary Firebase app');
  }

  const secondaryAuth = secondaryApp.auth();
  try {
    // Create the new user using the secondary auth instance.
    const userCred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    const uid = userCred.user.uid;

    // Store role in Firestore (primary db instance) — this does not depend on auth state.
    if (db) {
      await db.collection('users').doc(uid).set({
        email,
        role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    return uid;
  } catch (e) {
    console.error('Error creating user in secondary auth', e);
    throw e;
  } finally {
    // Cleanup: sign out and delete the secondary app to avoid memory leak
    try { await secondaryAuth.signOut(); } catch (e) { /* ignore */ }
    try { await secondaryApp.delete(); } catch (e) { /* ignore */ }
  }
}


async function getTeachers(){
  if (!db) return [];
  const snap = await db.collection('users').where('role', '==', 'teacher').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getFinanceUsers(){
  if (!db) return [];
  const snap = await db.collection('users').where('role', '==', 'finance').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Get students assigned to a teacher
async function getStudentsForTeacher(teacherId){
  if (!db) return [];
  const snap = await db.collection('students').orderBy('name').get();
  // Filter students who have this teacher in their classTeachers array
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(student => {
      const classTeachers = student.classTeachers || [];
      return classTeachers.some(ct => ct.teacherId === teacherId);
    });
}

// Get classes for a teacher
async function getClassesForTeacher(teacherId){
  if (!db) return [];
  const students = await getStudentsForTeacher(teacherId);
  const classIds = new Set();
  students.forEach(student => {
    const classTeachers = student.classTeachers || [];
    classTeachers.forEach(ct => {
      if (ct.teacherId === teacherId) {
        classIds.add(ct.classId);
      }
    });
  });
  
  const snap = await db.collection('classes').get();
  const allClasses = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return allClasses.filter(c => classIds.has(c.id));
}

// Attendance CRUD
async function markAttendance(teacherId, studentId, date, present){
  if (!db) throw new Error('DB not initialized');
  const docRef = db.collection('attendance').doc(`${studentId}_${date}_${teacherId}`);
  return docRef.set({
    studentId,
    teacherId,
    date,
    present,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function getAttendanceForStudent(studentId, startDate, endDate){
  if (!db) return [];
  const snap = await db.collection('attendance')
    .where('studentId', '==', studentId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date', 'desc')
    .get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Fee CRUD
async function createFeeRecord(studentId, agreedAmount, description){
  if (!db) throw new Error('DB not initialized');
  const docRef = await db.collection('fees').add({
    studentId,
    agreedAmount,
    description,
    payments: [],
    totalPaid: 0,
    balance: agreedAmount,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return docRef;
}

async function addPayment(feeId, amount, date, notes){
  if (!db) throw new Error('DB not initialized');
  const feeDoc = await db.collection('fees').doc(feeId).get();
  const feeData = feeDoc.data();
  const newTotalPaid = (feeData.totalPaid || 0) + amount;
  const newBalance = feeData.agreedAmount - newTotalPaid;
  
  const payments = feeData.payments || [];
  payments.push({ amount, date, notes, addedAt: new Date().toISOString() });
  
  return db.collection('fees').doc(feeId).update({
    payments,
    totalPaid: newTotalPaid,
    balance: newBalance,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function getFeeRecordsForStudent(studentId){
  if (!db) return [];
  const snap = await db.collection('fees').where('studentId', '==', studentId).orderBy('createdAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getAllFeeRecords(){
  if (!db) return [];
  const snap = await db.collection('fees').orderBy('updatedAt', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Classes CRUD
async function createClass(name, level){
  if (!db) throw new Error('DB not initialized');
  const docRef = await db.collection('classes').add({
    name,
    level,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  return docRef;
}

async function updateClass(classId, data){
  if (!db) throw new Error('DB not initialized');
  return db.collection('classes').doc(classId).update(data);
}

async function deleteClass(classId){
  if (!db) throw new Error('DB not initialized');
  return db.collection('classes').doc(classId).delete();
}

async function getClasses(){
  if (!db) return [];
  const snap = await db.collection('classes').orderBy('name').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// User management (delete teachers/finance staff)
async function deleteUser(userId){
  if (!db) throw new Error('DB not initialized');
  return db.collection('users').doc(userId).delete();
}

// Expose functions
window.app = { 
  // Auth
  requireAuth, loginWithEmail, logout, resetPassword,
  // Roles
  getUserRole, getCurrentUserRole, requireRole,
  // Students
  createStudent, updateStudent, deleteStudent, getStudentById, getStudents, renderStudentsTable, markStudentAsCompleted,
  // Users
  createUser, getTeachers, getFinanceUsers, deleteUser,
  // Teacher functions
  getStudentsForTeacher, getClassesForTeacher,
  // Attendance
  markAttendance, getAttendanceForStudent,
  // Fees
  createFeeRecord, addPayment, getFeeRecordsForStudent, getAllFeeRecords,
  // Classes
  createClass, updateClass, deleteClass, getClasses,
  // Dashboard
  renderDashboardStats,
  // UI helpers
  showModal, closeModal
};
