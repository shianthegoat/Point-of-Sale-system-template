# POS System - Flask & Firebase

A modern Point of Sale (POS) system built with Flask and Firebase, featuring user authentication, role-based access control, and responsive design.

## Features

- 🔐 **User Authentication**: Secure login and registration system
- 👥 **Role-Based Access**: Separate dashboards for staff and customers
- 📱 **Responsive Design**: Works on all devices (phones, tablets, desktops)
- 🔥 **Firebase Integration**: Real-time database with Firestore
- 🎨 **Modern UI**: Beautiful gradient design with smooth animations
- 🛡️ **Security**: Password hashing and session management

## Project Structure

```
MYVERSION - POS SYSTEM/
├── Myapp.py                 # Main Flask application
├── firebase_config.py       # Firebase database configuration
├── requirements.txt         # Python dependencies
├── README.md               # This file
├── static/
│   └── design.css          # Main stylesheet
└── templates/
    ├── loginPage.html      # Login page
    ├── registerPage.html   # Registration page
    ├── staff_dashboard.html # Staff dashboard
    ├── customer_dashboard.html # Customer dashboard
    ├── 404.html           # 404 error page
    └── 500.html           # 500 error page
```

## Setup Instructions

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Firebase Setup (Optional)

For production use, set up Firebase:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Firestore Database
4. Generate a service account key:
   - Go to Project Settings > Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `serviceAccountKey.json` in the project root
5. Update the path in `firebase_config.py`:
   ```python
   cred = credentials.Certificate("serviceAccountKey.json")
   ```

**Note**: If Firebase is not set up, the system will automatically use a mock database for development.

### 3. Run the Application

```bash
python Myapp.py
```

The application will be available at `http://localhost:5000`

## Usage

### Registration
1. Visit `/register`
2. Select your role (Customer or Staff)
3. Fill in your details
4. Click "Register"

### Login
1. Visit `/login`
2. Select your role
3. Enter your credentials
4. Click "Login"

### Dashboards
- **Staff Dashboard**: Access to system management, user management, and analytics
- **Customer Dashboard**: Order history, profile management, and quick actions

## Design Features

### Responsive Design
- **Mobile**: Single-column layout with optimized touch targets
- **Tablet**: Adaptive grid layout
- **Desktop**: Full-featured multi-column layout

### Role Selection Cards
- Equal-sized containers for Customer and Staff roles
- Interactive hover and selection states
- Smooth animations and transitions

### Modern UI Elements
- Gradient backgrounds
- Card-based layouts
- Smooth hover effects
- Consistent color scheme
- Professional typography

## Security Features

- Password hashing using Werkzeug
- Session management with Flask-Login
- Role-based access control
- CSRF protection (built into Flask)
- Secure password validation

## API Endpoints

### Authentication
- `GET/POST /login` - User login
- `GET/POST /register` - User registration
- `GET /logout` - User logout

### Dashboards
- `GET /staff/dashboard` - Staff dashboard (requires staff role)
- `GET /customer/dashboard` - Customer dashboard (requires customer role)

### API (Staff Only)
- `GET /api/users` - Get all users
- `GET /api/user/<id>` - Get specific user
- `PUT /api/user/<id>` - Update user
- `DELETE /api/user/<id>` - Delete user

## Development

### Mock Database
For development without Firebase, the system uses a mock database that stores data in memory. This allows for quick testing and development.

### Environment Variables
Create a `.env` file for environment-specific configuration:
```
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
```

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For support or questions, please open an issue in the repository. 