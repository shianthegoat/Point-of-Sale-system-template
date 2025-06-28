from flask import Blueprint, Flask, request, jsonify, render_template, redirect, url_for, flash, send_file, session
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from firebase_config import FirebaseDB, MockDB
from datetime import datetime, timezone, timedelta
import base64
import os
import logging
from io import BytesIO
import uuid
from firebase_admin import credentials, firestore, initialize_app
import json
from urllib.parse import unquote
from functools import wraps
import re
import calendar

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Security: Use environment variable for secret key
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-this-in-production')

# Security: Add CSRF protection
app.config['WTF_CSRF_ENABLED'] = True

# Security: Add session configuration
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=8)
app.config['SESSION_COOKIE_SECURE'] = False  # Set to True in production with HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Initialize Firebase
use_firebase = False
db = None

def initialize_firebase():
    """Initialize Firebase connection with proper error handling."""
    global db, use_firebase
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        initialize_app(cred)
        db = firestore.client()
        use_firebase = True
        logger.info("Firebase initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Firebase initialization failed: {e}")
        use_firebase = False
        return False

def create_mock_db():
    """Create a mock database for fallback."""
    class MockDB:
        def collection(self, name):
            return MockCollection()
    
    class MockCollection:
        def stream(self):
            return []
        def document(self, doc_id):
            return MockDocument()
        def add(self, data):
            return (None, MockDocument())
        def where(self, field, op, value):
            return self
    
    class MockDocument:
        def get(self):
            return MockDocSnapshot()
        def update(self, data):
            return None
        def delete(self):
            return None
        def set(self, data):
            return None
        def id(self):
            return "mock_id"
    
    class MockDocSnapshot:
        def exists(self):
            return False
        def to_dict(self):
            return {}
    
    return MockDB()

# Initialize Firebase or fallback to mock
if not initialize_firebase():
    db = create_mock_db()

def initialize_firebase_data():
    """Initialize default data in Firebase if collections are empty."""
    if not use_firebase:
        return
    
    try:
        users_ref = db.collection('users')
        users_docs = list(users_ref.stream())
        
        # Check if default users exist
        default_usernames = ['admin', 'salesman']
        existing_usernames = [doc.to_dict().get('username') for doc in users_docs]
        
        # Create default users if they don't exist
        default_users = [
            {
                'username': 'admin',
                'password_hash': generate_password_hash('admin123'),
                'role': 'admin',
                'name': 'Admin User',
                'email': 'admin@example.com',
                'created_at': datetime.now().isoformat()
            },
            {
                'username': 'salesman',
                'password_hash': generate_password_hash('sales123'),
                'role': 'user',
                'name': 'Sales Person',
                'email': 'sales@example.com',
                'created_at': datetime.now().isoformat()
            }
        ]
        
        for user_data in default_users:
            if user_data['username'] not in existing_usernames:
                users_ref.add(user_data)
                logger.info(f"Created default user: {user_data['username']}")
        
        if len(users_docs) == 0:
            logger.info("Default users initialized in Firebase")
    except Exception as e:
        logger.error(f"Error initializing Firebase data: {e}")

# Call the initialization function
initialize_firebase_data()

# Initialize Flask-login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Security: Input validation functions
def validate_email(email):
    """Validate email format."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_username(username):
    """Validate username format."""
    return len(username) >= 3 and len(username) <= 20 and username.isalnum()

def validate_password(password):
    """Validate password strength."""
    return len(password) >= 6

def sanitize_input(text):
    """Sanitize user input to prevent XSS."""
    if not text:
        return ""
    # Remove potentially dangerous characters
    dangerous_chars = ['<', '>', '"', "'", '&']
    for char in dangerous_chars:
        text = text.replace(char, '')
    return text.strip()

# Security: Authentication decorators
def admin_required(f):
    """Decorator to require admin role."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        if current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def staff_required(f):
    """Decorator to require staff role (admin or user)."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'error': 'Authentication required'}), 401
        if current_user.role not in ['admin', 'user']:
            return jsonify({'error': 'Staff access required'}), 403
        return f(*args, **kwargs)
    return decorated_function

def validate_session(f):
    """Decorator to validate session."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Session expired'}), 401
        return f(*args, **kwargs)
    return decorated_function

# User class for Flask-Login
class User(UserMixin):
    def __init__(self, user_id, username, email, role):
        self.id = user_id
        self.username = username
        self.email = email
        self.role = role

@login_manager.user_loader
def load_user(user_id):
    """Load user from database."""
    try:
        user_data = db.collection('users').document(user_id).get()
        if user_data.exists:
            user_data = user_data.to_dict()
            return User(user_id, user_data['username'], user_data['email'], user_data['role'])
    except Exception as e:
        logger.error(f"Error loading user {user_id}: {e}")
    return None

# Error handling functions
def handle_database_error(e, operation="database operation"):
    """Handle database errors consistently."""
    logger.error(f"Database error during {operation}: {e}")
    return jsonify({'error': f'Database error during {operation}'}), 500

def handle_validation_error(message):
    """Handle validation errors consistently."""
    return jsonify({'error': message}), 400

def handle_not_found_error(resource):
    """Handle not found errors consistently."""
    return jsonify({'error': f'{resource} not found'}), 404

# Routes
@app.route('/')
def index():
    """Main index route."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    """User login route with enhanced security."""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        role = request.form.get('role', '')
        
        # Input validation
        if not username or not password or not role:
            flash('Please fill in all fields', 'error')
            return render_template('loginPage.html')
        
        if role not in ['admin', 'user']:
            flash('Please select a valid role', 'error')
            return render_template('loginPage.html')
        
        # Sanitize inputs
        username = sanitize_input(username)
        
        try:
            users_ref = db.collection('users')
            all_users = list(users_ref.stream())
            user_doc = None
            
            for doc in all_users:
                user_data = doc.to_dict()
                if user_data.get('username') == username and user_data.get('role') == role:
                    user_doc = doc
                    break
            
            if user_doc:
                user_data = user_doc.to_dict()
                if check_password_hash(user_data['password_hash'], password):
                    user = User(user_doc.id, user_data['username'], user_data['email'], user_data['role'])
                    login_user(user)
                    
                    # Set session data
                    session.permanent = True
                    session['user_id'] = user_doc.id
                    session['username'] = user_data['username']
                    session['role'] = user_data['role']
                    session['login_time'] = datetime.now().isoformat()
                    
                    logger.info(f"User {username} logged in successfully")
                    return redirect(url_for('dashboard'))
                else:
                    flash('Invalid password', 'error')
                    logger.warning(f"Failed login attempt for user {username}: invalid password")
            else:
                flash('User not found or role mismatch', 'error')
                logger.warning(f"Failed login attempt for user {username}: user not found")
        except Exception as e:
            logger.error(f"Login error: {e}")
            flash('Authentication error', 'error')
    
    return render_template('loginPage.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """User registration route (currently disabled)."""
    flash('Registration is currently disabled.', 'error')
    return render_template('registerPage.html')

@app.route('/logout')
@login_required
def logout():
    """User logout route."""
    username = current_user.username if current_user.is_authenticated else 'Unknown'
    logout_user()
    session.clear()
    flash('You have been logged out.', 'info')
    logger.info(f"User {username} logged out")
    return redirect(url_for('login'))

@app.route('/dashboard')
@staff_required
def dashboard():
    """Dashboard page."""
    return render_template('dashboard.html')

@app.route('/make-sale')
@staff_required
def make_sale():
    """Make sale page."""
    return render_template('make_sale.html')

@app.route('/inventory')
@staff_required
def inventory():
    """Inventory management page."""
    return render_template('inventory.html')

@app.route('/sales')
@staff_required
def sales():
    """Sales history page."""
    return render_template('sales.html')

@app.route('/customers')
@staff_required
def customers():
    """Customers page."""
    return render_template('customers.html')

@app.route('/suppliers')
@staff_required
def suppliers():
    """Suppliers page."""
    return render_template('suppliers.html')

@app.route('/categories')
@staff_required
def categories():
    """Categories page."""
    return render_template('categories.html')

@app.route('/staff')
@staff_required
def staff():
    """Staff management page."""
    return render_template('staff.html')

# Legacy route for backward compatibility
@app.route('/staff_dashboard')
@validate_session
@staff_required
def staff_dashboard_legacy():
    """Legacy staff dashboard route - redirects to new dashboard."""
    return redirect(url_for('dashboard'))

# Sales Management Routes
@app.route('/api/sales', methods=['GET', 'POST'])
@validate_session
def sales_api():
    """Sales API with enhanced security and error handling."""
    try:
        if request.method == 'GET':
            # Get sales history from Firebase
            sales_ref = db.collection('sales')
            sales = []
            users_map = {}
            
            # Preload all users for mapping user_id to name
            try:
                for user_doc in db.collection('users').stream():
                    user = user_doc.to_dict()
                    users_map[user_doc.id] = user.get('name', user.get('username', 'Unknown'))
            except Exception as e:
                logger.warning(f"Error loading users for sales mapping: {e}")
            
            # Get all sales and sort by date (most recent first)
            for doc in sales_ref.stream():
                sale = {'id': doc.id, **doc.to_dict()}
                # Parse date for sorting
                try:
                    dt = datetime.fromisoformat(sale.get('date', ''))
                    sale['date_parsed'] = dt  # Keep parsed date for sorting
                    sale['date'] = dt.strftime('%B %d, %Y (%I:%M %p)')
                except (ValueError, TypeError):
                    sale['date_parsed'] = datetime.min  # Put invalid dates at the end
                
                # Add staff name
                staff_id = sale.get('staff_id')
                sale['staff_name'] = users_map.get(staff_id, 'Unknown')
                
                # Format items for display
                items = sale.get('items', [])
                sale['items_display'] = ', '.join([f"{item.get('name', '')} x{item.get('quantity', 1)}" for item in items])
                sales.append(sale)
            
            # Sort by date in descending order (most recent first)
            sales.sort(key=lambda x: x['date_parsed'], reverse=True)
            
            return jsonify({'success': True, 'sales': sales})
        else:
            # Create sale
            return create_sale()
    except Exception as e:
        return handle_database_error(e, "managing sales")

@app.route('/api/sales/<sale_id>', methods=['GET', 'PUT', 'DELETE'])
@validate_session
@staff_required
def manage_sale(sale_id):
    """Manage individual sale with enhanced security."""
    try:
        if request.method == 'GET':
            sale = db.collection('sales').document(sale_id).get()
            if sale.exists:
                return jsonify({'success': True, 'sale': sale.to_dict()})
            return handle_not_found_error('Sale')
        
        elif request.method == 'PUT':
            data = request.get_json()
            if not data:
                return handle_validation_error('No data provided')
            
            db.collection('sales').document(sale_id).update(data)
            return jsonify({'success': True, 'message': 'Sale updated successfully'})
        
        elif request.method == 'DELETE':
            db.collection('sales').document(sale_id).delete()
            return jsonify({'success': True, 'message': 'Sale deleted successfully'})
    
    except Exception as e:
        return handle_database_error(e, "managing sale")

@app.route('/api/sales/filtered', methods=['GET'])
@validate_session
@staff_required
def get_filtered_sales():
    """Get sales with filters for date range, customer, and amount range."""
    try:
        # Get filter parameters
        date_filter = request.args.get('dateFilter', 'all')
        customer_filter = request.args.get('customerFilter', '')
        amount_filter = request.args.get('amountFilter', '')
        start_date = request.args.get('startDate', '')
        end_date = request.args.get('endDate', '')
        page = max(1, int(request.args.get('page', 1)))
        limit = 20  # Results per page
        
        # Get sales from Firebase
        sales_ref = db.collection('sales')
        sales = []
        users_map = {}
        
        # Preload all users for mapping user_id to name
        try:
            for user_doc in db.collection('users').stream():
                user = user_doc.to_dict()
                users_map[user_doc.id] = user.get('name', user.get('username', 'Unknown'))
        except Exception as e:
            logger.warning(f"Error loading users for sales mapping: {e}")
        
        # Get all sales and apply filters
        for doc in sales_ref.stream():
            sale = {'id': doc.id, **doc.to_dict()}
            
            # Parse date for filtering and sorting
            try:
                dt = datetime.fromisoformat(sale.get('date', ''))
                sale['date_parsed'] = dt
                sale['date'] = dt.strftime('%B %d, %Y (%I:%M %p)')
            except (ValueError, TypeError):
                sale['date_parsed'] = datetime.min
                sale['date'] = 'Unknown'
            
            # Apply date filter
            if date_filter != 'all':
                today = datetime.now().date()
                sale_date = sale['date_parsed'].date()
                
                if date_filter == 'today' and sale_date != today:
                    continue
                elif date_filter == 'yesterday' and sale_date != (today - timedelta(days=1)):
                    continue
                elif date_filter == 'week':
                    week_ago = today - timedelta(days=7)
                    if sale_date < week_ago:
                        continue
                elif date_filter == 'month':
                    month_ago = today - timedelta(days=30)
                    if sale_date < month_ago:
                        continue
                elif date_filter == 'custom' and start_date and end_date:
                    try:
                        start_dt = datetime.strptime(start_date, '%Y-%m-%d').date()
                        end_dt = datetime.strptime(end_date, '%Y-%m-%d').date()
                        if not (start_dt <= sale_date <= end_dt):
                            continue
                    except ValueError:
                        pass  # Invalid date format, skip filter
            
            # Apply customer filter
            if customer_filter:
                customer_name = sale.get('customer_name', 'Walk-in Customer')
                if customer_name != customer_filter:
                    continue
            
            # Apply amount filter
            if amount_filter:
                total = float(sale.get('total', 0))
                if amount_filter == '0-1000' and not (0 <= total <= 1000):
                    continue
                elif amount_filter == '1000-5000' and not (1000 <= total <= 5000):
                    continue
                elif amount_filter == '5000-10000' and not (5000 <= total <= 10000):
                    continue
                elif amount_filter == '10000+' and total < 10000:
                    continue
            
            # Add staff name
            staff_id = sale.get('staff_id')
            sale['staff_name'] = users_map.get(staff_id, 'Unknown')
            
            # Format items for display
            items = sale.get('items', [])
            sale['items_display'] = ', '.join([f"{item.get('name', '')} x{item.get('quantity', 1)}" for item in items])
            
            sales.append(sale)
        
        # Sort by date in descending order (most recent first)
        sales.sort(key=lambda x: x['date_parsed'], reverse=True)
        
        # Calculate summary for all filtered results
        total_sales_amount = sum(float(sale.get('total', 0)) for sale in sales)
        total_transactions = len(sales)
        average_order = total_sales_amount / total_transactions if total_transactions > 0 else 0
        
        # Apply pagination
        total_results = len(sales)
        start_index = (page - 1) * limit
        end_index = start_index + limit
        paginated_sales = sales[start_index:end_index]
        
        return jsonify({
            'success': True, 
            'sales': paginated_sales,
            'total': total_results,
            'page': page,
            'limit': limit,
            'total_pages': (total_results + limit - 1) // limit,
            'summary': {
                'total_sales_amount': total_sales_amount,
                'total_transactions': total_transactions,
                'average_order': average_order
            }
        })
        
    except Exception as e:
        return handle_database_error(e, "fetching filtered sales")

@app.route('/api/sales/recent', methods=['GET'])
@validate_session
def get_recent_sales():
    """Get recent sales for dashboard display (most recent 5 sales)."""
    try:
        # Get sales from Firebase
        sales_ref = db.collection('sales')
        sales = []
        users_map = {}
        
        # Preload all users for mapping user_id to name
        try:
            for user_doc in db.collection('users').stream():
                user = user_doc.to_dict()
                users_map[user_doc.id] = user.get('name', user.get('username', 'Unknown'))
        except Exception as e:
            logger.warning(f"Error loading users for sales mapping: {e}")
        
        # Get all sales and sort by date (most recent first)
        for doc in sales_ref.stream():
            sale = {'id': doc.id, **doc.to_dict()}
            # Parse date for sorting
            try:
                dt = datetime.fromisoformat(sale.get('date', ''))
                sale['date_parsed'] = dt  # Keep parsed date for sorting
                sale['date'] = dt.strftime('%B %d, %Y (%I:%M %p)')
            except (ValueError, TypeError):
                sale['date_parsed'] = datetime.min  # Put invalid dates at the end
                sale['date'] = 'Unknown'
            
            # Add staff name
            staff_id = sale.get('staff_id')
            sale['staff_name'] = users_map.get(staff_id, 'Unknown')
            
            # Format items for display
            items = sale.get('items', [])
            sale['items_display'] = ', '.join([f"{item.get('name', '')} x{item.get('quantity', 1)}" for item in items])
            sales.append(sale)
        
        # Sort by date in descending order (most recent first) and take only 5
        sales.sort(key=lambda x: x['date_parsed'], reverse=True)
        recent_sales = sales[:5]
        
        return jsonify({'success': True, 'sales': recent_sales})
        
    except Exception as e:
        return handle_database_error(e, "loading recent sales")

# Inventory Management Routes
@app.route('/api/inventory', methods=['GET', 'POST'])
@validate_session
def inventory_api():
    """Inventory API with enhanced security and validation."""
    if request.method == 'GET':
        try:
            inventory_ref = db.collection('inventory')
            inventory = []
            for doc in inventory_ref.stream():
                item_data = doc.to_dict()
                item_data['id'] = doc.id
                inventory.append(item_data)
            
            # Sort by name (case-insensitive)
            inventory.sort(key=lambda x: x.get('name', '').lower())
            
            # Optional pagination
            try:
                page = max(1, int(request.args.get('page', 1)))
                limit = max(0, int(request.args.get('limit', 0)))
            except (ValueError, TypeError):
                page = 1
                limit = 0
            
            if limit > 0:
                start = (page - 1) * limit
                end = start + limit
                paginated = inventory[start:end]
            else:
                paginated = inventory
            
            return jsonify({'success': True, 'inventory': paginated, 'total': len(inventory)})
        except Exception as e:
            return handle_database_error(e, "fetching inventory")
    
    else:
        # Create new inventory item
        if session.get('role') not in ['admin', 'user', 'staff']:
            return jsonify({'success': False, 'message': 'Access denied'}), 403
        
        try:
            data = request.get_json()
            if not data:
                return handle_validation_error('No data provided')
            
            # Input validation
            required_fields = ['name', 'category', 'stock', 'price', 'supplier']
            for field in required_fields:
                if not data.get(field):
                    return handle_validation_error(f'Missing required field: {field}')
            
            # Sanitize inputs
            data['name'] = sanitize_input(str(data['name']))
            data['category'] = sanitize_input(str(data['category']))
            data['supplier'] = sanitize_input(str(data['supplier']))
            
            # Validate stock and price
            try:
                stock = int(data['stock'])
                price = float(data['price'])
                if stock < 0 or price < 0:
                    return handle_validation_error('Stock and price must be non-negative')
            except (ValueError, TypeError):
                return handle_validation_error('Stock must be an integer and price must be a number')
            
            # Get category name from category ID
            category_name = data['category']
            if data['category'] and not data['category'].startswith('cat_'):
                category_name = data['category']
            else:
                try:
                    category_doc = db.collection('categories').document(data['category']).get()
                    if category_doc.exists:
                        category_name = category_doc.to_dict().get('name', data['category'])
                    else:
                        category_name = data['category']
                except Exception:
                    category_name = data['category']
            
            # Duplicate check (same name and category)
            inventory_ref = db.collection('inventory')
            duplicate_query = inventory_ref.where('name', '==', data['name']).where('category', '==', category_name).stream()
            if any(True for _ in duplicate_query):
                return handle_validation_error('An item with this name and category already exists.')
            
            # Prepare data for storage
            inventory_data = {
                'name': data['name'],
                'category': category_name,
                'stock': stock,
                'price': price,
                'supplier': data['supplier'],
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
            
            # Add item
            doc_ref = inventory_ref.add(inventory_data)
            return jsonify({
                'success': True, 
                'message': 'Inventory item created successfully', 
                'item_id': doc_ref[1].id
            })
            
        except Exception as e:
            return handle_database_error(e, "creating inventory item")

@app.route('/api/inventory/<item_id>', methods=['GET', 'PUT', 'DELETE'])
@validate_session
@staff_required
def manage_inventory_item(item_id):
    """Manage individual inventory item with enhanced security."""
    try:
        if request.method == 'GET':
            item = db.collection('inventory').document(item_id).get()
            if item.exists:
                item_data = item.to_dict()
                item_data['id'] = item_id
                return jsonify({'success': True, 'item': item_data})
            return handle_not_found_error('Item')
        
        elif request.method == 'PUT':
            data = request.get_json()
            if not data:
                return handle_validation_error('No data provided')
            
            # Validate required fields
            required_fields = ['name', 'category', 'stock', 'price', 'supplier']
            for field in required_fields:
                if not data.get(field):
                    return handle_validation_error(f'Missing required field: {field}')
            
            # Sanitize inputs
            data['name'] = sanitize_input(str(data['name']))
            data['category'] = sanitize_input(str(data['category']))
            data['supplier'] = sanitize_input(str(data['supplier']))
            
            # Validate stock and price
            try:
                stock = int(data['stock'])
                price = float(data['price'])
                if stock < 0 or price < 0:
                    return handle_validation_error('Stock and price must be non-negative')
            except (ValueError, TypeError):
                return handle_validation_error('Stock must be an integer and price must be a number')
            
            # Get category name from category ID
            category_name = data['category']
            if data['category'] and not data['category'].startswith('cat_'):
                category_name = data['category']
            else:
                try:
                    category_doc = db.collection('categories').document(data['category']).get()
                    if category_doc.exists:
                        category_name = category_doc.to_dict().get('name', data['category'])
                    else:
                        category_name = data['category']
                except Exception:
                    category_name = data['category']
            
            # Check for duplicates (excluding current item)
            inventory_ref = db.collection('inventory')
            duplicate_query = inventory_ref.where('name', '==', data['name']).where('category', '==', category_name).stream()
            for doc in duplicate_query:
                if doc.id != item_id:
                    return handle_validation_error('An item with this name and category already exists.')
            
            # Prepare update data
            update_data = {
                'name': data['name'],
                'category': category_name,
                'stock': stock,
                'price': price,
                'supplier': data['supplier'],
                'updated_at': datetime.now().isoformat()
            }
            
            db.collection('inventory').document(item_id).update(update_data)
            return jsonify({'success': True, 'message': 'Item updated successfully'})
        
        elif request.method == 'DELETE':
            # Check if item exists before deleting
            item = db.collection('inventory').document(item_id).get()
            if not item.exists:
                return handle_not_found_error('Item')
            
            db.collection('inventory').document(item_id).delete()
            return jsonify({'success': True, 'message': 'Item deleted successfully'})
    
    except Exception as e:
        return handle_database_error(e, "managing inventory item")

# Supplier Management Routes
@app.route('/api/suppliers', methods=['GET', 'POST'])
@validate_session
@staff_required
def api_suppliers():
    """Supplier API with staff access."""
    try:
        if request.method == 'GET':
            suppliers_ref = db.collection('suppliers')
            suppliers = []
            for doc in suppliers_ref.stream():
                suppliers.append({'id': doc.id, **doc.to_dict()})
            return jsonify({'success': True, 'suppliers': suppliers})
        else:
            data = request.get_json()
            if not data:
                return handle_validation_error('No data provided')
            
            # Sanitize inputs
            for key in data:
                if isinstance(data[key], str):
                    data[key] = sanitize_input(data[key])
            
            doc_ref = db.collection('suppliers').add(data)
            return jsonify({'success': True, 'message': 'Supplier created successfully', 'supplier_id': doc_ref[1].id})
    except Exception as e:
        return handle_database_error(e, "managing suppliers")

@app.route('/api/suppliers/<supplier_id>', methods=['GET', 'PUT', 'DELETE'])
@validate_session
@staff_required
def manage_supplier(supplier_id):
    """Manage individual supplier with staff access."""
    try:
        if request.method == 'GET':
            supplier = db.collection('suppliers').document(supplier_id).get()
            if supplier.exists:
                return jsonify({'success': True, 'supplier': supplier.to_dict()})
            return handle_not_found_error('Supplier')
        
        elif request.method == 'PUT':
            data = request.get_json()
            if not data:
                return handle_validation_error('No data provided')
            
            # Sanitize inputs
            for key in data:
                if isinstance(data[key], str):
                    data[key] = sanitize_input(data[key])
            
            db.collection('suppliers').document(supplier_id).update(data)
            return jsonify({'success': True, 'message': 'Supplier updated successfully'})
        
        elif request.method == 'DELETE':
            db.collection('suppliers').document(supplier_id).delete()
            return jsonify({'success': True, 'message': 'Supplier deleted successfully'})
    
    except Exception as e:
        return handle_database_error(e, "managing supplier")

# Category Management Routes
@app.route('/api/categories', methods=['GET', 'POST'])
@validate_session
@admin_required
def api_categories():
    """Category API with admin-only access."""
    try:
        if request.method == 'GET':
            categories_ref = db.collection('categories')
            categories = []
            
            # Get all categories
            for doc in categories_ref.stream():
                category_data = {'id': doc.id, **doc.to_dict()}
                categories.append(category_data)
            
            # Get item counts for each category
            inventory_ref = db.collection('inventory')
            for category in categories:
                # Count items in this category
                items_in_category = inventory_ref.where('category', '==', category['name']).stream()
                item_count = sum(1 for _ in items_in_category)
                category['item_count'] = item_count
            
            return jsonify({'success': True, 'categories': categories})
        else:
            data = request.get_json()
            if not data:
                return handle_validation_error('No data provided')
            
            # Sanitize inputs
            for key in data:
                if isinstance(data[key], str):
                    data[key] = sanitize_input(data[key])
            
            doc_ref = db.collection('categories').add(data)
            return jsonify({'success': True, 'message': 'Category created successfully', 'category_id': doc_ref[1].id})
    except Exception as e:
        return handle_database_error(e, "managing categories")

@app.route('/api/categories/<category_id>', methods=['GET', 'PUT', 'DELETE'])
@validate_session
@admin_required
def manage_category(category_id):
    """Manage individual category with admin-only access."""
    try:
        if request.method == 'GET':
            category = db.collection('categories').document(category_id).get()
            if category.exists:
                category_data = category.to_dict()
                category_data['id'] = category_id
                
                # Get item count for this category
                inventory_ref = db.collection('inventory')
                items_in_category = inventory_ref.where('category', '==', category_data['name']).stream()
                item_count = sum(1 for _ in items_in_category)
                category_data['item_count'] = item_count
                
                return jsonify({'success': True, 'category': category_data})
            return handle_not_found_error('Category')
        
        elif request.method == 'PUT':
            data = request.get_json()
            if not data:
                return handle_validation_error('No data provided')
            
            # Sanitize inputs
            for key in data:
                if isinstance(data[key], str):
                    data[key] = sanitize_input(data[key])
            
            db.collection('categories').document(category_id).update(data)
            return jsonify({'success': True, 'message': 'Category updated successfully'})
        
        elif request.method == 'DELETE':
            db.collection('categories').document(category_id).delete()
            return jsonify({'success': True, 'message': 'Category deleted successfully'})
    
    except Exception as e:
        return handle_database_error(e, "managing category")

# Account Management Routes (Admin Only)
@app.route('/api/accounts', methods=['GET', 'POST'])
@login_required
@admin_required
def api_accounts():
    """Account API with admin-only access."""
    try:
        if request.method == 'GET':
            return jsonify({'accounts': [
                {'username': 'johnsales', 'role': 'user', 'status': 'Active'},
                {'username': 'mikeadmin', 'role': 'admin', 'status': 'Active'},
                {'username': 'manager1', 'role': 'manager', 'status': 'Active'},
                {'username': 'sarahsales', 'role': 'user', 'status': 'Active'}
            ]})
        else:
            return jsonify({'success': True, 'message': 'Account created.'})
    except Exception as e:
        return handle_database_error(e, "managing accounts")

@app.route('/api/accounts/<account_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
@admin_required
def manage_account(account_id):
    """Manage individual account with admin-only access."""
    try:
        if request.method == 'GET':
            account = db.collection('users').document(account_id).get()
            if account.exists:
                return jsonify({'account': account.to_dict()})
            return handle_not_found_error('Account')
        
        elif request.method == 'PUT':
            data = request.get_json()
            if not data:
                return handle_validation_error('No data provided')
            
            if 'password' in data:
                if not validate_password(data['password']):
                    return handle_validation_error('Password must be at least 6 characters long')
                data['password_hash'] = generate_password_hash(data['password'])
                del data['password']
            
            # Sanitize inputs
            for key in data:
                if isinstance(data[key], str):
                    data[key] = sanitize_input(data[key])
            
            db.collection('users').document(account_id).update(data)
            return jsonify({'success': True, 'message': 'Account updated successfully'})
        
        elif request.method == 'DELETE':
            db.collection('users').document(account_id).delete()
            return jsonify({'success': True, 'message': 'Account deleted successfully'})
    
    except Exception as e:
        return handle_database_error(e, "managing account")

# API Routes for AJAX requests
@app.route('/api/users', methods=['GET'])
@login_required
@admin_required
def get_users():
    """Get users with role filtering."""
    try:
        role_filter = request.args.get('role')
        if role_filter:
            users = db.collection('users').where('role', '==', role_filter).stream()
        else:
            users = db.collection('users').stream()
        
        user_list = []
        for doc in users:
            user_data = doc.to_dict()
            # Don't include password hash in response
            if 'password_hash' in user_data:
                del user_data['password_hash']
            user_list.append(user_data)
        
        return jsonify({'users': user_list})
    except Exception as e:
        return handle_database_error(e, "fetching users")

@app.route('/api/user/<user_id>', methods=['GET', 'PUT', 'DELETE'])
@login_required
@admin_required
def manage_user(user_id):
    """Manage individual user with admin-only access."""
    try:
        if request.method == 'GET':
            user = db.collection('users').document(user_id).get()
            if user.exists:
                user_data = user.to_dict()
                # Don't include password hash in response
                if 'password_hash' in user_data:
                    del user_data['password_hash']
                return jsonify({'user': user_data})
            return handle_not_found_error('User')
        
        elif request.method == 'PUT':
            data = request.get_json()
            if not data:
                return handle_validation_error('No data provided')
            
            # Sanitize inputs
            for key in data:
                if isinstance(data[key], str):
                    data[key] = sanitize_input(data[key])
            
            db.collection('users').document(user_id).update(data)
            return jsonify({'success': True, 'message': 'User updated successfully'})
        
        elif request.method == 'DELETE':
            db.collection('users').document(user_id).delete()
            return jsonify({'success': True, 'message': 'User deleted successfully'})
    
    except Exception as e:
        return handle_database_error(e, "managing user")

# Manager-only route for creating staff accounts
@app.route('/create_staff', methods=['GET', 'POST'])
@login_required
@admin_required
def create_staff_account():
    """Create staff account with enhanced validation."""
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip()
        password = request.form.get('password', '')
        confirm_password = request.form.get('confirm_password', '')
        role = request.form.get('role', '')
        full_name = request.form.get('full_name', '').strip()
        
        # Validation
        if not all([username, email, password, confirm_password, role, full_name]):
            flash('Please fill in all fields', 'error')
            return render_template('create_staff.html', user=current_user)
        
        if not validate_username(username):
            flash('Username must be 3-20 characters long and contain only letters and numbers', 'error')
            return render_template('create_staff.html', user=current_user)
        
        if not validate_email(email):
            flash('Please enter a valid email address', 'error')
            return render_template('create_staff.html', user=current_user)
        
        if not validate_password(password):
            flash('Password must be at least 6 characters long', 'error')
            return render_template('create_staff.html', user=current_user)
        
        if password != confirm_password:
            flash('Passwords do not match', 'error')
            return render_template('create_staff.html', user=current_user)
        
        if role not in ['user', 'admin', 'manager']:
            flash('Invalid role selected', 'error')
            return render_template('create_staff.html', user=current_user)
        
        # Sanitize inputs
        username = sanitize_input(username)
        email = sanitize_input(email)
        full_name = sanitize_input(full_name)
        
        try:
            # Check if username already exists
            users_ref = db.collection('users')
            all_users = list(users_ref.stream())
            existing_usernames = [doc.to_dict().get('username') for doc in all_users]
            
            if username in existing_usernames:
                flash('Username already exists', 'error')
                return render_template('create_staff.html', user=current_user)
            
            # Hash password
            password_hash = generate_password_hash(password)
            
            # Create staff account
            doc_ref = db.collection('users').add({
                'username': username,
                'email': email,
                'password_hash': password_hash,
                'role': role,
                'name': full_name,
                'created_at': datetime.now().isoformat()
            })
            
            if doc_ref:
                flash(f'Staff account created successfully for {full_name} ({username}) as {role}!', 'success')
                logger.info(f"Admin {current_user.username} created staff account: {username}")
                return redirect(url_for('dashboard'))
            else:
                flash('Error creating staff account', 'error')
        except Exception as e:
            logger.error(f"Error creating staff account: {e}")
            flash('Error creating staff account', 'error')
    
    return render_template('create_staff.html', user=current_user)

# Simple redirect route for create_staff
@app.route('/create_staff')
@login_required
@admin_required
def create_staff_redirect():
    """Redirect to create staff account page."""
    return redirect(url_for('create_staff_account'))

# Error handlers
@app.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors."""
    return render_template('404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors."""
    logger.error(f"Internal server error: {error}")
    return render_template('500.html'), 500

# Flash message categories
@app.context_processor
def inject_flash_categories():
    """Inject flash message categories into templates."""
    return dict(flash_categories=['success', 'error', 'info', 'warning'])

def create_sale():
    """Create a new sale with enhanced validation and error handling."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Not authenticated'}), 401
    
    try:
        data = request.get_json()
        if not data:
            return handle_validation_error('No data provided')
        
        customer_name = sanitize_input(data.get('customerName', ''))
        items = data.get('items', [])
        total = data.get('total', 0)
        
        if not customer_name or not items:
            return handle_validation_error('Missing required fields')
        
        # Validate total
        try:
            total = float(total)
            if total < 0:
                return handle_validation_error('Total must be non-negative')
        except (ValueError, TypeError):
            return handle_validation_error('Invalid total amount')
        
        # Validate items and check stock
        for item in items:
            item_id = item.get('id')
            quantity = item.get('quantity', 0)
            
            if not item_id or quantity <= 0:
                return handle_validation_error('Invalid item data')
            
            try:
                doc = db.collection('inventory').document(item_id).get()
                if not doc.exists:
                    return handle_validation_error(f'Item {item.get("name", "Unknown")} not found')
                
                inventory_item = {'id': doc.id, **doc.to_dict()}
                current_stock = inventory_item.get('stock', 0)
                
                if current_stock < quantity:
                    return handle_validation_error(f'Insufficient stock for {inventory_item["name"]}. Available: {current_stock}, Requested: {quantity}')
            except Exception as e:
                logger.error(f"Error checking inventory for item {item_id}: {e}")
                return handle_validation_error('Error checking inventory')
        
        # Create sale record
        sale_id = str(uuid.uuid4())
        sale_data = {
            'id': sale_id,
            'customer_name': customer_name,
            'items': items,
            'total': total,
            'date': datetime.now().isoformat(),
            'staff_id': session['user_id']
        }
        
        db.collection('sales').document(sale_id).set(sale_data)
        
        # Update inventory stock
        for item in items:
            item_id = item.get('id')
            quantity = item.get('quantity', 0)
            
            try:
                doc = db.collection('inventory').document(item_id).get()
                if doc.exists:
                    current_stock = doc.to_dict().get('stock', 0)
                    new_stock = current_stock - quantity
                    db.collection('inventory').document(item_id).update({'stock': new_stock})
            except Exception as e:
                logger.error(f"Error updating inventory for item {item_id}: {e}")
                # Continue with other items even if one fails
        
        logger.info(f"Sale created successfully: {sale_id} by {session.get('username', 'Unknown')}")
        return jsonify({'success': True, 'message': 'Sale completed successfully', 'sale_id': sale_id})
    
    except Exception as e:
        logger.error(f"Error creating sale: {e}")
        return handle_database_error(e, "creating sale")

# Customer Profile Management Routes
@app.route('/api/customers', methods=['GET'])
@validate_session
def get_customers():
    """Get customer list with statistics."""
    try:
        # Get all unique customers from sales
        sales_ref = db.collection('sales')
        customers = {}
        
        for doc in sales_ref.stream():
            sale = doc.to_dict()
            customer_name = sale.get('customer_name', 'Walk-in Customer')
            
            if customer_name not in customers:
                customers[customer_name] = {
                    'name': customer_name,
                    'total_sales': 0,
                    'total_spent': 0.0,
                    'first_purchase': None,
                    'last_purchase': None,
                    'purchase_count': 0,
                    'favorite_items': {},
                    'favorite_categories': {}
                }
            
            # Update customer statistics
            customers[customer_name]['total_sales'] += 1
            customers[customer_name]['total_spent'] += float(sale.get('total', 0))
            
            # Track purchase dates
            sale_date = sale.get('date')
            if sale_date:
                try:
                    dt = datetime.fromisoformat(sale_date)
                    if not customers[customer_name]['first_purchase'] or dt < customers[customer_name]['first_purchase']:
                        customers[customer_name]['first_purchase'] = dt
                    if not customers[customer_name]['last_purchase'] or dt > customers[customer_name]['last_purchase']:
                        customers[customer_name]['last_purchase'] = dt
                except (ValueError, TypeError):
                    continue
            
            # Track favorite items and categories
            items = sale.get('items', [])
            for item in items:
                item_name = item.get('name', '')
                item_category = item.get('category', '')
                quantity = item.get('quantity', 1)
                
                if item_name:
                    if item_name not in customers[customer_name]['favorite_items']:
                        customers[customer_name]['favorite_items'][item_name] = 0
                    customers[customer_name]['favorite_items'][item_name] += quantity
                
                if item_category:
                    if item_category not in customers[customer_name]['favorite_categories']:
                        customers[customer_name]['favorite_categories'][item_category] = 0
                    customers[customer_name]['favorite_categories'][item_category] += quantity
        
        # Get additional profile information from customers collection
        customers_ref = db.collection('customers')
        for doc in customers_ref.stream():
            profile_data = doc.to_dict()
            customer_name = profile_data.get('name')
            if customer_name in customers:
                # Merge profile data with sales data
                customers[customer_name].update({
                    'age': profile_data.get('age', 'N/A'),
                    'sex': profile_data.get('sex', 'N/A'),
                    'address': profile_data.get('address', 'N/A'),
                    'occupation': profile_data.get('occupation', 'N/A'),
                    'business': profile_data.get('business', 'N/A'),
                    'phone': profile_data.get('phone'),
                    'email': profile_data.get('email'),
                    'notes': profile_data.get('notes'),
                    'profile_picture': profile_data.get('profile_picture')
                })
        
        # Ensure all customers have age, sex, address, occupation, business fields
        for c in customers.values():
            if 'age' not in c:
                c['age'] = 'N/A'
            if 'sex' not in c:
                c['sex'] = 'N/A'
            if 'address' not in c:
                c['address'] = 'N/A'
            if 'occupation' not in c:
                c['occupation'] = 'N/A'
            if 'business' not in c:
                c['business'] = 'N/A'
        
        # Convert to list and sort by total spent
        customers_list = list(customers.values())
        customers_list.sort(key=lambda x: x['total_spent'], reverse=True)
        
        return jsonify({'success': True, 'customers': customers_list})
        
    except Exception as e:
        return handle_database_error(e, "fetching customers")

@app.route('/api/customers/<path:customer_name>', methods=['GET'])
@validate_session
def get_customer_profile(customer_name):
    """Get detailed customer profile."""
    try:
        # Decode the customer name from URL
        customer_name = unquote(customer_name)
        
        # Get all sales for this customer
        sales_ref = db.collection('sales')
        customer_sales = []
        total_spent = 0.0
        total_items = 0
        favorite_items = {}
        favorite_categories = {}
        purchase_dates = []
        
        for doc in sales_ref.stream():
            sale = doc.to_dict()
            if sale.get('customer_name') == customer_name:
                sale_data = {
                    'id': doc.id,
                    'date': sale.get('date'),
                    'total': sale.get('total', 0),
                    'items': sale.get('items', []),
                    'staff_id': sale.get('staff_id')
                }
                customer_sales.append(sale_data)
                
                # Calculate statistics
                total_spent += float(sale.get('total', 0))
                
                # Track items and categories
                items = sale.get('items', [])
                for item in items:
                    item_name = item.get('name', '')
                    item_category = item.get('category', '')
                    quantity = item.get('quantity', 1)
                    total_items += quantity
                    
                    if item_name:
                        if item_name not in favorite_items:
                            favorite_items[item_name] = 0
                        favorite_items[item_name] += quantity
                    
                    if item_category:
                        if item_category not in favorite_categories:
                            favorite_categories[item_category] = 0
                        favorite_categories[item_category] += quantity
                
                # Track purchase dates
                sale_date = sale.get('date')
                if sale_date:
                    try:
                        dt = datetime.fromisoformat(sale_date)
                        purchase_dates.append(dt)
                    except (ValueError, TypeError):
                        continue
        
        # Sort sales by date (newest first)
        customer_sales.sort(key=lambda x: x.get('date', ''), reverse=True)
        
        # Calculate additional statistics
        avg_order_value = total_spent / len(customer_sales) if customer_sales else 0
        first_purchase = min(purchase_dates) if purchase_dates else None
        last_purchase = max(purchase_dates) if purchase_dates else None
        
        # Get top favorite items and categories
        top_items = sorted(favorite_items.items(), key=lambda x: x[1], reverse=True)[:5]
        top_categories = sorted(favorite_categories.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Calculate monthly spending trend (last 6 months)
        monthly_spending = {}
        six_months_ago = datetime.now() - timedelta(days=180)
        
        for sale in customer_sales:
            try:
                sale_date = datetime.fromisoformat(sale.get('date', ''))
                if sale_date >= six_months_ago:
                    month_key = sale_date.strftime('%Y-%m')
                    if month_key not in monthly_spending:
                        monthly_spending[month_key] = 0
                    monthly_spending[month_key] += float(sale.get('total', 0))
            except (ValueError, TypeError):
                continue
        
        # Format monthly spending data
        monthly_data = []
        for month in sorted(monthly_spending.keys()):
            monthly_data.append({
                'month': month,
                'spending': monthly_spending[month]
            })
        
        # Get additional profile information
        customers_ref = db.collection('customers')
        profile_data = {}
        for doc in customers_ref.stream():
            data = doc.to_dict()
            if data.get('name') == customer_name:
                profile_data = data
                break
        
        customer_profile = {
            'name': customer_name,
            'total_sales': len(customer_sales),
            'total_spent': total_spent,
            'total_items': total_items,
            'avg_order_value': avg_order_value,
            'first_purchase': first_purchase.isoformat() if first_purchase else None,
            'last_purchase': last_purchase.isoformat() if last_purchase else None,
            'favorite_items': dict(top_items),
            'favorite_categories': dict(top_categories),
            'monthly_spending': monthly_data,
            'recent_sales': customer_sales[:10],  # Last 10 sales
            # Profile information
            'age': profile_data.get('age', 'N/A'),
            'sex': profile_data.get('sex', 'N/A'),
            'address': profile_data.get('address', 'N/A'),
            'occupation': profile_data.get('occupation', 'N/A'),
            'business': profile_data.get('business', 'N/A'),
            'phone': profile_data.get('phone'),
            'email': profile_data.get('email'),
            'notes': profile_data.get('notes'),
            'profile_picture': profile_data.get('profile_picture')
        }
        
        return jsonify({'success': True, 'customer': customer_profile})
        
    except Exception as e:
        return handle_database_error(e, "fetching customer profile")

@app.route('/api/customers/update', methods=['POST'])
@validate_session
@staff_required
def update_customer_profile():
    """Update customer profile information."""
    try:
        print("=== Customer Profile Update Debug ===")
        print(f"Request method: {request.method}")
        print(f"Request headers: {dict(request.headers)}")
        print(f"Request form data: {dict(request.form)}")
        print(f"Request files: {list(request.files.keys())}")
        print(f"Session data: {dict(session)}")
        
        # Get form data
        customer_name = request.form.get('name')
        age = request.form.get('age')
        sex = request.form.get('sex')
        address = request.form.get('address')
        occupation = request.form.get('occupation')
        business = request.form.get('business')
        original_name = request.form.get('original_name')
        # ... other fields as needed ...

        if not customer_name:
            return jsonify({'success': False, 'error': 'Customer name is required'}), 400

        # Validate input data
        if age and (not age.isdigit() or int(age) < 1 or int(age) > 120):
            return jsonify({'success': False, 'error': 'Invalid age'}), 400

        # Handle profile picture upload
        profile_picture = None
        if 'profile_picture' in request.files:
            file = request.files['profile_picture']
            if file and file.filename:
                allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
                if '.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions:
                    file_content = file.read()
                    file_extension = file.filename.rsplit('.', 1)[1].lower()
                    profile_picture = f"data:image/{file_extension};base64,{base64.b64encode(file_content).decode('utf-8')}"

        # Prepare customer data
        customer_data = {
            'name': sanitize_input(customer_name),
            'age': int(age) if age and age.isdigit() else None,
            'sex': sanitize_input(sex) if sex else None,
            'address': sanitize_input(address) if address else None,
            'occupation': sanitize_input(occupation) if occupation else None,
            'business': sanitize_input(business) if business else None,
            'updated_at': datetime.now().isoformat(),
            'updated_by': session.get('user_id')
        }
        if profile_picture:
            customer_data['profile_picture'] = profile_picture

        # Check if customer profile already exists (by original_name if provided, else by name)
        customers_ref = db.collection('customers')
        existing_doc = None
        search_name = original_name or customer_name
        for doc in customers_ref.stream():
            if doc.to_dict().get('name') == search_name:
                existing_doc = doc
                break

        if existing_doc:
            existing_doc.reference.update(customer_data)
        else:
            customer_data['created_at'] = datetime.now().isoformat()
            customers_ref.add(customer_data)

        return jsonify({'success': True, 'message': 'Customer profile updated successfully'})
    except Exception as e:
        return handle_database_error(e, "updating customer profile")

@app.route('/api/customers/<path:customer_name>/purchases', methods=['GET'])
@validate_session
@staff_required
def get_customer_purchase_history(customer_name):
    """Return all purchase history for a specific customer, sorted by date descending."""
    try:
        customer_name = unquote(customer_name)
        sales_ref = db.collection('sales')
        purchases = []
        for doc in sales_ref.stream():
            sale = doc.to_dict()
            if sale.get('customer_name') == customer_name:
                purchases.append({
                    'date': sale.get('date'),
                    'total': float(sale.get('total', 0)),
                    'items': sale.get('items', [])
                })
        # Sort by date descending
        def parse_date(s):
            try:
                return datetime.fromisoformat(s)
            except Exception:
                return datetime.min
        purchases.sort(key=lambda x: parse_date(x['date']), reverse=True)
        return jsonify({'success': True, 'purchases': purchases})
    except Exception as e:
        return handle_database_error(e, "fetching customer purchase history")

@app.route('/customer_profile')
@staff_required
def customer_profile():
    return render_template('customer_profile.html')

@app.route('/api/customers/<path:customer_name>/summary', methods=['GET'])
@validate_session
@staff_required
def get_customer_summary(customer_name):
    """Return summary info for a specific customer: first purchase, recent purchase, current month spending, and month with most spending."""
    try:
        customer_name = unquote(customer_name)
        sales_ref = db.collection('sales')
        purchase_dates = []
        monthly_spending = {}
        current_month = datetime.now().strftime('%Y-%m')
        current_month_spending = 0.0
        for doc in sales_ref.stream():
            sale = doc.to_dict()
            if sale.get('customer_name') == customer_name:
                sale_date = sale.get('date')
                total = float(sale.get('total', 0))
                if sale_date:
                    try:
                        dt = datetime.fromisoformat(sale_date)
                        purchase_dates.append(dt)
                        month_key = dt.strftime('%Y-%m')
                        if month_key not in monthly_spending:
                            monthly_spending[month_key] = 0.0
                        monthly_spending[month_key] += total
                        if month_key == current_month:
                            current_month_spending += total
                    except Exception:
                        continue
        first_purchase = min(purchase_dates).isoformat() if purchase_dates else None
        recent_purchase = max(purchase_dates).isoformat() if purchase_dates else None
        # Find month with most spending
        most_spending_month = None
        most_spending_amount = 0.0
        for month, amount in monthly_spending.items():
            if amount > most_spending_amount:
                most_spending_month = month
                most_spending_amount = amount
        summary = {
            'first_purchase': first_purchase,
            'recent_purchase': recent_purchase,
            'current_month_spending': current_month_spending,
            'most_spending_month': most_spending_month,
            'most_spending_amount': most_spending_amount
        }
        return jsonify({'success': True, 'summary': summary})
    except Exception as e:
        return handle_database_error(e, "fetching customer summary")

@app.route('/api/customers/<path:customer_name>/spending_by_item_category', methods=['GET'])
@validate_session
@staff_required
def get_spending_by_item_category(customer_name):
    """Return total amount spent per item and category for a specific customer."""
    try:
        customer_name = unquote(customer_name)
        sales_ref = db.collection('sales')
        spending = {}
        for doc in sales_ref.stream():
            sale = doc.to_dict()
            if sale.get('customer_name') == customer_name:
                items = sale.get('items', [])
                for item in items:
                    item_name = item.get('name', 'Unknown')
                    category = item.get('category', 'Uncategorized')
                    price = float(item.get('price', 0))
                    quantity = int(item.get('quantity', 1))
                    amount = price * quantity
                    key = (item_name, category)
                    if key not in spending:
                        spending[key] = 0.0
                    spending[key] += amount
        # Format for frontend
        result = [
            {'item': k[0], 'category': k[1], 'amount': v}
            for k, v in spending.items()
        ]
        return jsonify({'success': True, 'spending': result})
    except Exception as e:
        return handle_database_error(e, "fetching spending by item and category")

@app.route('/api/customers/<path:customer_name>/spending_table', methods=['GET'])
@validate_session
@staff_required
def get_spending_table(customer_name):
    """Return a table of items with category, quantity, and total spent for a specific customer."""
    try:
        customer_name = unquote(customer_name)
        sales_ref = db.collection('sales')
        table = {}
        for doc in sales_ref.stream():
            sale = doc.to_dict()
            if sale.get('customer_name') == customer_name:
                items = sale.get('items', [])
                for item in items:
                    item_name = item.get('name', 'Unknown')
                    category = item.get('category', 'Uncategorized')
                    price = float(item.get('price', 0))
                    quantity = int(item.get('quantity', 1))
                    amount = price * quantity
                    key = (item_name, category)
                    if key not in table:
                        table[key] = {'item': item_name, 'category': category, 'quantity': 0, 'amount': 0.0}
                    table[key]['quantity'] += quantity
                    table[key]['amount'] += amount
        result = list(table.values())
        return jsonify({'success': True, 'table': result})
    except Exception as e:
        return handle_database_error(e, "fetching spending table")

@app.route('/api/customers/<path:customer_name>/top_items_monthly_spending', methods=['GET'])
@validate_session
@staff_required
def get_top_items_monthly_spending(customer_name):
    """Return top 3 items and their monthly spending for a specific customer (for a grouped bar chart)."""
    try:
        customer_name = unquote(customer_name)
        sales_ref = db.collection('sales')
        item_totals = {}
        monthly_spending = {}
        months_set = set()
        for doc in sales_ref.stream():
            sale = doc.to_dict()
            if sale.get('customer_name') == customer_name:
                sale_date = sale.get('date')
                if not sale_date:
                    continue
                try:
                    dt = datetime.fromisoformat(sale_date)
                    month_key = dt.strftime('%Y-%m')
                except Exception:
                    continue
                months_set.add(month_key)
                items = sale.get('items', [])
                for item in items:
                    item_name = item.get('name', 'Unknown')
                    price = float(item.get('price', 0))
                    quantity = int(item.get('quantity', 1))
                    amount = price * quantity
                    # Track total per item
                    if item_name not in item_totals:
                        item_totals[item_name] = 0.0
                    item_totals[item_name] += amount
                    # Track monthly per item
                    if item_name not in monthly_spending:
                        monthly_spending[item_name] = {}
                    if month_key not in monthly_spending[item_name]:
                        monthly_spending[item_name][month_key] = 0.0
                    monthly_spending[item_name][month_key] += amount
        # Get top 3 items
        top_items = sorted(item_totals.items(), key=lambda x: x[1], reverse=True)[:3]
        top_item_names = [item[0] for item in top_items]
        # Get all months in range (sorted)
        months = sorted(list(months_set))
        # Prepare data for frontend
        result = {
            'months': months,
            'items': []
        }
        for item_name in top_item_names:
            item_data = {
                'name': item_name,
                'monthly': [monthly_spending[item_name].get(month, 0.0) for month in months]
            }
            result['items'].append(item_data)
        return jsonify({'success': True, 'data': result})
    except Exception as e:
        return handle_database_error(e, "fetching top items monthly spending")

@app.route('/statistics')
@validate_session
@staff_required
def statistics():
    if session.get('role') not in ['manager', 'admin']:
        return redirect(url_for('dashboard'))
    return render_template('statistics.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

