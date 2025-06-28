# Login Guide

## Available Test Accounts

### Manager Account
- **Username:** luigi
- **Password:** rufrance
- **Role:** manager
- **Name:** Luigi Corpuz

### Admin Account
- **Username:** admin
- **Password:** admin123
- **Role:** admin
- **Name:** Admin User

### Salesman Account
- **Username:** salesman
- **Password:** sales123
- **Role:** user (salesman)
- **Name:** Sales Person

### Customer Account
- **Username:** customer
- **Password:** customer123
- **Role:** customer
- **Name:** Test Customer

## How to Login

1. Go to the login page
2. Enter the username and password from the accounts above
3. **Important:** Select the correct role from the dropdown:
   - For Luigi: select "Staff" and choose "Manager"
   - For Admin: select "Staff" and choose "Admin"
   - For Salesman: select "Staff" and choose "Salesman"
   - For Customer: select "Customer"

## Role Selection Guide

- **Staff Roles:** Use the "Staff" option and then select the specific role (Manager/Admin/Salesman)
- **Customer Role:** Use the "Customer" option

## Features by Role

### Manager
- Create staff accounts
- Full CRUD for inventory, suppliers, categories
- View sales history and reports

### Admin
- Full CRUD for inventory, suppliers, categories
- View sales history and reports

### Salesman
- Make sales
- View inventory
- Basic reporting

### Customer
- View available items
- Make purchases
- View purchase history

## Important Notes

- **Role Selection is Required:** You must select either "Staff" or "Customer" before logging in
- **Case Sensitive:** Usernames and passwords are case-sensitive
- **Staff Role:** Use "Staff" role for manager, admin, and salesman accounts (not their individual roles)
- **Customer Role:** Use "Customer" role only for customer accounts

## Troubleshooting

### "Invalid Credentials" Error
1. Make sure you selected the correct role (Staff vs Customer)
2. Check that username and password are exactly as shown
3. Ensure no extra spaces in username or password

### "Please select a role" Error
1. Click on either the "Staff" or "Customer" card before submitting
2. The selected card should have a blue background

### Still Having Issues?
1. Try refreshing the page
2. Clear your browser cache
3. Make sure you're using the correct URL (http://localhost:5000)

## Account Creation

- **Public Registration:** Only customers can register publicly
- **Staff Accounts:** Must be created by managers using the "Create Staff" feature
- **Manager Accounts:** Can only be created by other managers

## Default Accounts Summary

| Role | Username | Password | Login Role |
|------|----------|----------|------------|
| Manager | Luigi Corpuz | rufrance | Staff |
| Admin | admin | admin123 | Staff |
| Salesman | salesman | sales123 | Staff |
| Customer | customer | customer123 | Customer | 