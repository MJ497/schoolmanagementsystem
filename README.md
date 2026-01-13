# School Management System

A complete school management system built with Firebase, Firestore, and Chart.js. Supports role-based access for admins, teachers, finance staff, and students.

## Features

- **Admin Dashboard**: Manage users (teachers, finance), students, classes, and fee overview
- **Teacher Dashboard**: View assigned students, mark attendance with date-based tracking
- **Finance Dashboard**: Track all student fees, record payments, manage payment history and balances
- **Student Dashboard**: View profile, fees, and attendance records
- **Role-Based Access Control**: Email/password authentication with role-based routing
- **Fee Management**: Agreed amounts, payment tracking, balance calculation per installment
- **Attendance Tracking**: Date-based attendance marking by teachers

## Project Structure

```
school/
├── index.html              # Login page (role-based redirect)
├── admin.html              # Admin dashboard
├── teacher.html            # Teacher dashboard
├── finance.html            # Finance dashboard
├── student.html            # Student dashboard
├── dashboard.html          # Legacy dashboard (optional)
├── students.html           # Legacy students list (optional)
├── student-profile.html    # Legacy student profile (optional)
├── assets/
│   ├── firebase-config.js  # Firebase configuration
│   └── app.js              # App helpers, CRUD functions, Firestore integration
└── README.md               # This file
```

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (e.g., "School Management")
3. Once created, go to **Project Settings** → **Your apps** → **Web** (`</>`), register a new web app
4. Copy the configuration object (you'll need this in step 2)

### 2. Configure Firebase Credentials

Edit `assets/firebase-config.js` and replace the placeholder values with your Firebase project credentials:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  // messagingSenderId, appId optional
};
```

### 3. Set Up Firestore Database

1. In Firebase Console, go to **Firestore Database** → **Create Database**
2. Choose **Start in test mode** (for development; later add security rules)
3. Once created, create the following collections:

#### Collections & Documents Structure

**`users`** - Stores user roles (admin, teacher, finance, student)
- Document ID: Firebase Auth UID
- Fields:
  - `email` (string)
  - `role` (string): "admin", "teacher", "finance", "student"
  - `createdAt` (timestamp)

**`students`** - Student records
- Document ID: Auto-generated
- Fields:
  - `name` (string): Full name
  - `studentId` (string): Unique student ID (e.g., STU-2026-001)
  - `email` (string): Student email
  - `phone` (string): Contact number
  - `classes` (array): List of class document IDs assigned
  - `teachers` (array): List of teacher user IDs assigned
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)

**`classes`** - Class definitions
- Document ID: Auto-generated
- Fields:
  - `name` (string): Class name (e.g., "JSS 2", "SSS 1")
  - `level` (string): Level (e.g., "Junior", "Senior")
  - `createdAt` (timestamp)

**`fees`** - Fee records per student
- Document ID: Auto-generated
- Fields:
  - `studentId` (string): Reference to student document ID
  - `agreedAmount` (number): Total agreed fee amount
  - `description` (string): Fee description (e.g., "Tuition 2026")
  - `totalPaid` (number): Total amount paid so far
  - `balance` (number): Remaining balance
  - `payments` (array of objects):
    - `amount` (number)
    - `date` (string): Payment date (YYYY-MM-DD)
    - `notes` (string): Optional notes
    - `addedAt` (string): ISO timestamp when payment was recorded
  - `createdAt` (timestamp)
  - `updatedAt` (timestamp)

**`attendance`** - Attendance records
- Document ID: `{studentId}_{date}_{teacherId}` (format)
- Fields:
  - `studentId` (string): Reference to student document ID
  - `teacherId` (string): Reference to teacher user ID
  - `date` (string): Date (YYYY-MM-DD)
  - `present` (boolean): true if present, false if absent
  - `updatedAt` (timestamp)

### 4. Set Up Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** sign-in method
3. Create test users from the **Users** tab:
   - **Admin**: Create user with email `admin@school.com`, password `admin123`
   - **Teacher**: Create user with email `teacher@school.com`, password `teacher123`
   - **Finance**: Create user with email `finance@school.com`, password `finance123`
   - **Student**: Create user with email `student@school.com`, password `student123`

4. After creating each Auth user, manually add a document to the `users` collection:
   - Copy the user's UID from Firebase Authentication
   - Create a new document in `users` collection with that UID as the document ID
   - Add the `email`, `role`, and `createdAt` fields

### 5. Firestore Security Rules (Optional but Recommended)

In Firebase Console, go to **Firestore Database** → **Rules** and replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admins can do anything
    match /{document=**} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Teachers can read students assigned to them, mark attendance
    match /students/{studentDoc} {
      allow read: if request.auth != null && 
        (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'teacher', 'finance'] ||
         resource.data.email == request.auth.token.email);
    }
    
    match /attendance/{attendanceDoc} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'teacher'];
    }
    
    // Finance can read/write fees
    match /fees/{feeDoc} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'finance'];
    }
    
    // Students can read their own data
    match /users/{userId} {
      allow read: if request.auth.uid == userId;
    }
  }
}
```

## Usage

### Admin Workflow

1. Log in as admin
2. **Dashboard**: View overall stats and student distribution chart
3. **Students**: Add students, assign classes and teachers, delete records
4. **Teachers**: Create teacher accounts (email + password)
5. **Finance**: Create finance staff accounts
6. **Classes**: Add/manage class definitions
7. **Fees Overview**: Monitor all student fees at a glance

### Teacher Workflow

1. Log in with teacher credentials
2. **My Students**: View list of students assigned to you
3. **Mark Attendance**: Select a date, mark each student as present/absent, save

### Finance Workflow

1. Log in with finance credentials
2. **Fee Overview**: See all students' fee statuses and payment summaries
3. **Student Fees**: 
   - Select a student
   - Create a fee record (if none exists)
   - View payment history
   - Add payments with amount, date, and notes
   - Track balance automatically

### Student Workflow

1. Log in with student credentials
2. **My Profile**: View your assigned classes and contact info
3. **My Fees**: See agreed amounts, paid amounts, and balance for each fee record
4. **Attendance**: View your attendance records for the last 90 days

## Key Functions

All functions are exposed via `window.app` namespace in `assets/app.js`:

### Authentication
- `loginWithEmail(email, password)` - Sign in user
- `logout()` - Sign out
- `getUserRole(uid)` - Get user role
- `getCurrentUserRole()` - Get logged-in user's role
- `requireRole(requiredRole, redirectTo)` - Redirect if unauthorized
- `createUser(email, password, role)` - Create new user (admin only)

### Students
- `createStudent(data)` - Add new student
- `updateStudent(studentId, data)` - Update student record
- `deleteStudent(studentId)` - Delete student and related records
- `getStudentById(studentId)` - Fetch single student
- `getStudents()` - Fetch all students
- `getStudentsForTeacher(teacherId)` - Get students assigned to a teacher

### Fees
- `createFeeRecord(studentId, agreedAmount, description)` - Create fee
- `addPayment(feeId, amount, date, notes)` - Record payment
- `getFeeRecordsForStudent(studentId)` - Get student's fees
- `getAllFeeRecords()` - Get all fees (finance/admin)

### Attendance
- `markAttendance(teacherId, studentId, date, present)` - Record attendance
- `getAttendanceForStudent(studentId, startDate, endDate)` - Get attendance records

### Classes
- `createClass(name, level)` - Add class
- `getClasses()` - Fetch all classes

### UI Helpers
- `showModal(msg)` - Display message modal
- `closeModal()` - Close modal
- `renderStudentsTable(selector)` - Render students table (legacy)
- `renderDashboardStats()` - Load dashboard stats (legacy)

## Sample Data Creation

Once logged in as admin, try:

1. **Create a class**: Go to Classes tab → Add → name="JSS 2", level="Junior"
2. **Create a teacher**: Go to Teachers tab → Add → email=`j.smith@school.com`, password=`smith123`
3. **Create a student**: Go to Students tab → Add → name="John Doe", studentId="STU-2026-001", select the class and teacher
4. **Create fee record**: Finance logs in, Student Fees tab → select student → Create fee → ₦50,000
5. **Record payment**: Add Payment → amount=₦20,000, date=today, notes="First installment"

## Browser Compatibility

- Chrome, Firefox, Safari, Edge (latest versions)
- Requires JavaScript enabled

## Troubleshooting

- **Login not working**: Check Firebase credentials in `assets/firebase-config.js`
- **Firestore errors**: Ensure rules allow your user role to access collections
- **No data showing**: Verify Firestore collections exist and user role is set in `users` collection
- **Chart not rendering**: Check Chart.js CDN is loaded and dashboard has students data

## Future Enhancements

- Student self-registration
- Bulk fee import (CSV)
- Payment receipts/PDF download
- Real-time notifications
- Grade tracking
- Report generation

## License

Open source for educational purposes.
