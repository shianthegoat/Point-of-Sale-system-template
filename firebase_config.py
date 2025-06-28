import firebase_admin
from firebase_admin import credentials, firestore, auth
import os
from datetime import datetime, timezone

class FirebaseDB:
    def __init__(self):
        """Initialize Firebase connection"""
        try:
            # Check if Firebase app is already initialized
            if not firebase_admin._apps:
                # Initialize Firebase Admin SDK
                # Use the service account key in the project root
                cred = credentials.Certificate("serviceAccountKey.json")
                firebase_admin.initialize_app(cred)
            
            self.db = firestore.client()
            print("Firebase connection established successfully")
        except Exception as e:
            print(f"Error initializing Firebase: {e}")
            # For development, you can use a mock database
            self.db = None

    def create_user(self, username, email, password, role):
        """Create a new user in Firebase"""
        try:
            if self.db is None:
                return {"success": False, "error": "Firebase not initialized"}
            
            # Check if user already exists
            users_ref = self.db.collection('users')
            existing_user = users_ref.where('username', '==', username).limit(1).get()
            
            if existing_user:
                return {"success": False, "error": "Username already exists"}
            
            # Create user document
            user_data = {
                'username': username,
                'email': email,
                'password_hash': password,  # In production, hash this password
                'role': role,
                'created_at': datetime.now(timezone.utc),
                'last_login': None,
                'is_active': True
            }
            
            # Add user to Firestore
            user_ref = users_ref.add(user_data)
            
            return {"success": True, "user_id": user_ref[1].id}
            
        except Exception as e:
            print(f"Error creating user: {e}")
            return {"success": False, "error": str(e)}

    def ensure_manager_exists(self):
        """Ensure the default manager account exists in Firebase"""
        try:
            if self.db is None:
                return False
            
            # Check if manager already exists
            users_ref = self.db.collection('users')
            existing_manager = users_ref.where('username', '==', 'Luigi Corpuz').where('role', '==', 'manager').limit(1).get()
            
            if not existing_manager:
                # Create the default manager account
                manager_data = {
                    'username': 'Luigi Corpuz',
                    'email': 'luigi.corpuz@company.com',
                    'password_hash': 'rufrance',  # In production, this should be hashed
                    'role': 'manager',
                    'created_at': datetime.now(timezone.utc),
                    'last_login': None,
                    'is_active': True
                }
                
                users_ref.add(manager_data)
                print("Default manager account created in Firebase")
            
            # Ensure default test accounts exist
            self.ensure_default_accounts()
            return True
                
        except Exception as e:
            print(f"Error ensuring manager exists: {e}")
            return False

    def ensure_default_accounts(self):
        """Ensure default test accounts exist in Firebase"""
        try:
            if self.db is None:
                return False
            
            users_ref = self.db.collection('users')
            default_accounts = [
                {
                    'username': 'admin',
                    'email': 'admin@company.com',
                    'password_hash': 'admin123',
                    'role': 'admin'
                },
                {
                    'username': 'salesman',
                    'email': 'salesman@company.com',
                    'password_hash': 'sales123',
                    'role': 'user'
                },
                {
                    'username': 'customer',
                    'email': 'customer@email.com',
                    'password_hash': 'customer123',
                    'role': 'customer'
                }
            ]
            
            for account in default_accounts:
                # Check if account already exists
                existing_user = users_ref.where('username', '==', account['username']).limit(1).get()
                
                if not existing_user:
                    # Add default fields
                    account['created_at'] = datetime.now(timezone.utc)
                    account['last_login'] = None
                    account['is_active'] = True
                    
                    users_ref.add(account)
                    print(f"Default {account['role']} account created: {account['username']}")
                else:
                    print(f"Default {account['role']} account already exists: {account['username']}")
            
            return True
                
        except Exception as e:
            print(f"Error ensuring default accounts exist: {e}")
            return False

    def authenticate_user(self, username, password, role):
        """Authenticate user login"""
        try:
            if self.db is None:
                return {"success": False, "error": "Firebase not initialized"}
            
            # Find user by username
            users_ref = self.db.collection('users')
            
            # If role is 'staff', check for user, admin, or manager roles
            if role == 'staff':
                user_query = users_ref.where('username', '==', username).where('role', 'in', ['user', 'admin', 'manager']).limit(1).get()
            else:
                user_query = users_ref.where('username', '==', username).where('role', '==', role).limit(1).get()
            
            if not user_query:
                return {"success": False, "error": "Invalid credentials"}
            
            user_doc = user_query[0]
            user_data = user_doc.to_dict()
            
            # Check password (in production, use proper password hashing)
            if user_data['password_hash'] != password:
                return {"success": False, "error": "Invalid credentials"}
            
            # Update last login
            user_doc.reference.update({
                'last_login': datetime.now(timezone.utc)
            })
            
            return {
                "success": True,
                "user": {
                    "id": user_doc.id,
                    "username": user_data['username'],
                    "email": user_data['email'],
                    "role": user_data['role']
                }
            }
            
        except Exception as e:
            print(f"Error authenticating user: {e}")
            return {"success": False, "error": str(e)}

    def get_user_by_id(self, user_id):
        """Get user by ID"""
        try:
            if self.db is None:
                return None
            
            user_doc = self.db.collection('users').document(user_id).get()
            if user_doc.exists:
                return user_doc.to_dict()
            return None
            
        except Exception as e:
            print(f"Error getting user: {e}")
            return None

    def get_user_by_username(self, username):
        """Get user by username"""
        try:
            if self.db is None:
                return None
            
            users_ref = self.db.collection('users')
            user_query = users_ref.where('username', '==', username).limit(1).get()
            
            if user_query:
                user_doc = user_query[0]
                return {"id": user_doc.id, **user_doc.to_dict()}
            return None
            
        except Exception as e:
            print(f"Error getting user by username: {e}")
            return None

    def update_user(self, user_id, data):
        """Update user data"""
        try:
            if self.db is None:
                return {"success": False, "error": "Firebase not initialized"}
            
            self.db.collection('users').document(user_id).update(data)
            return {"success": True}
            
        except Exception as e:
            print(f"Error updating user: {e}")
            return {"success": False, "error": str(e)}

    def delete_user(self, user_id):
        """Delete user"""
        try:
            if self.db is None:
                return {"success": False, "error": "Firebase not initialized"}
            
            self.db.collection('users').document(user_id).delete()
            return {"success": True}
            
        except Exception as e:
            print(f"Error deleting user: {e}")
            return {"success": False, "error": str(e)}

    def get_all_users(self, role=None):
        """Get all users, optionally filtered by role"""
        try:
            if self.db is None:
                return []
            
            users_ref = self.db.collection('users')
            if role:
                users = users_ref.where('role', '==', role).get()
            else:
                users = users_ref.get()
            
            return [{"id": user.id, **user.to_dict()} for user in users]
            
        except Exception as e:
            print(f"Error getting users: {e}")
            return []

    # Mock functions for other entities (inventory, suppliers, etc.)
    def get_inventory_item(self, item_id):
        """Get inventory item by ID"""
        return None  # Mock implementation

    def update_inventory_item(self, item_id, data):
        """Update inventory item"""
        return {"success": True}  # Mock implementation

    def delete_inventory_item(self, item_id):
        """Delete inventory item"""
        return {"success": True}  # Mock implementation

    def get_supplier(self, supplier_id):
        """Get supplier by ID"""
        return None  # Mock implementation

    def update_supplier(self, supplier_id, data):
        """Update supplier"""
        return {"success": True}  # Mock implementation

    def delete_supplier(self, supplier_id):
        """Delete supplier"""
        return {"success": True}  # Mock implementation

    def get_category(self, category_id):
        """Get category by ID"""
        return None  # Mock implementation

    def update_category(self, category_id, data):
        """Update category"""
        return {"success": True}  # Mock implementation

    def delete_category(self, category_id):
        """Delete category"""
        return {"success": True}  # Mock implementation

    def get_restock_request(self, request_id):
        """Get restock request by ID"""
        return None  # Mock implementation

    def update_restock_request(self, request_id, data):
        """Update restock request"""
        return {"success": True}  # Mock implementation

    def delete_restock_request(self, request_id):
        """Delete restock request"""
        return {"success": True}  # Mock implementation

    def get_sale_by_id(self, sale_id):
        """Get sale by ID"""
        return None  # Mock implementation

    def update_sale(self, sale_id, data):
        """Update sale"""
        return {"success": True}  # Mock implementation

    def delete_sale(self, sale_id):
        """Delete sale"""
        return {"success": True}  # Mock implementation

# Mock database for development (when Firebase is not available)
class MockDB:
    def __init__(self):
        self.users = {}
        self.user_id_counter = 1
        
        # Hard-coded default manager account
        self.users['1'] = {
            'username': 'Luigi Corpuz',
            'email': 'luigi.corpuz@company.com',
            'password_hash': 'rufrance',  # In production, this should be hashed
            'role': 'manager',
            'created_at': datetime.now(timezone.utc),
            'last_login': None,
            'is_active': True
        }
        
        # Add default test accounts for different roles
        self.users['2'] = {
            'username': 'admin',
            'email': 'admin@company.com',
            'password_hash': 'admin123',
            'role': 'admin',
            'created_at': datetime.now(timezone.utc),
            'last_login': None,
            'is_active': True
        }
        
        self.users['3'] = {
            'username': 'salesman',
            'email': 'salesman@company.com',
            'password_hash': 'sales123',
            'role': 'user',
            'created_at': datetime.now(timezone.utc),
            'last_login': None,
            'is_active': True
        }
        
        self.users['4'] = {
            'username': 'customer',
            'email': 'customer@email.com',
            'password_hash': 'customer123',
            'role': 'customer',
            'created_at': datetime.now(timezone.utc),
            'last_login': None,
            'is_active': True
        }
        
        self.user_id_counter = 5  # Start from 5 since we have 4 default accounts

    def create_user(self, username, email, password, role):
        # Check if username already exists
        for user in self.users.values():
            if user['username'] == username:
                return {"success": False, "error": "Username already exists"}
        
        user_id = str(self.user_id_counter)
        self.user_id_counter += 1
        
        self.users[user_id] = {
            'username': username,
            'email': email,
            'password_hash': password,
            'role': role,
            'created_at': datetime.now(timezone.utc),
            'last_login': None,
            'is_active': True
        }
        
        return {"success": True, "user_id": user_id}

    def authenticate_user(self, username, password, role):
        print(f"Attempting login: username={username}, role={role}, password={password}")
        
        for user_id, user in self.users.items():
            print(f"Checking user {user_id}: {user['username']} (role: {user['role']})")
            
            # Check if username matches
            if user['username'] == username:
                # If role is 'staff', check for user, admin, or manager roles
                if role == 'staff' and user['role'] in ['user', 'admin', 'manager']:
                    print(f"Username and staff role match. Checking password...")
                elif user['role'] == role:
                    print(f"Username and role match. Checking password...")
                else:
                    continue
                
                # Check password
                if password == user['password_hash']:
                    print("Login successful!")
                    # Update last login
                    user['last_login'] = datetime.now(timezone.utc)
                    
                    return {
                        "success": True,
                        "user": {
                            "id": user_id,
                            "username": user['username'],
                            "email": user['email'],
                            "role": user['role']
                        }
                    }
                else:
                    print(f"Password mismatch. Expected: {user['password_hash']}, Got: {password}")
        
        print("No matching user found")
        return {"success": False, "error": "Invalid credentials"}

    def get_user_by_id(self, user_id):
        return self.users.get(user_id)

    def get_user_by_username(self, username):
        """Get user by username"""
        for user_id, user in self.users.items():
            if user['username'] == username:
                return {"id": user_id, **user}
        return None

    def update_user(self, user_id, data):
        if user_id in self.users:
            self.users[user_id].update(data)
            return {"success": True}
        return {"success": False, "error": "User not found"}

    def delete_user(self, user_id):
        if user_id in self.users:
            del self.users[user_id]
            return {"success": True}
        return {"success": False, "error": "User not found"}

    def get_all_users(self, role=None):
        users = []
        for user_id, user in self.users.items():
            if role is None or user['role'] == role:
                users.append({"id": user_id, **user})
        return users

    # Mock functions for other entities (inventory, suppliers, etc.)
    def get_inventory_item(self, item_id):
        """Get inventory item by ID"""
        return None  # Mock implementation

    def update_inventory_item(self, item_id, data):
        """Update inventory item"""
        return {"success": True}  # Mock implementation

    def delete_inventory_item(self, item_id):
        """Delete inventory item"""
        return {"success": True}  # Mock implementation

    def get_supplier(self, supplier_id):
        """Get supplier by ID"""
        return None  # Mock implementation

    def update_supplier(self, supplier_id, data):
        """Update supplier"""
        return {"success": True}  # Mock implementation

    def delete_supplier(self, supplier_id):
        """Delete supplier"""
        return {"success": True}  # Mock implementation

    def get_category(self, category_id):
        """Get category by ID"""
        return None  # Mock implementation

    def update_category(self, category_id, data):
        """Update category"""
        return {"success": True}  # Mock implementation

    def delete_category(self, category_id):
        """Delete category"""
        return {"success": True}  # Mock implementation

    def get_restock_request(self, request_id):
        """Get restock request by ID"""
        return None  # Mock implementation

    def update_restock_request(self, request_id, data):
        """Update restock request"""
        return {"success": True}  # Mock implementation

    def delete_restock_request(self, request_id):
        """Delete restock request"""
        return {"success": True}  # Mock implementation

    def get_sale_by_id(self, sale_id):
        """Get sale by ID"""
        return None  # Mock implementation

    def update_sale(self, sale_id, data):
        """Update sale"""
        return {"success": True}  # Mock implementation

    def delete_sale(self, sale_id):
        """Delete sale"""
        return {"success": True}  # Mock implementation 