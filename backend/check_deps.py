import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.modules.users import repository as repo

def main():
    users, _ = repo.list_users(limit=1000)
    invalid_depts = set()
    for u in users:
        dept = u.get('department')
        if dept and dept not in ['IT', 'MAINTENANCE', 'SECURITY', 'HR', 'ADMIN']:
            print(f"User {u.get('email')} has invalid department: '{dept}'")
            invalid_depts.add(dept)
    print(f'Invalid departments found: {invalid_depts}')
    
    # Auto fix invalid departments to None or valid ones if needed
    for u in users:
        dept = u.get('department')
        if dept and dept not in ['IT', 'MAINTENANCE', 'SECURITY', 'HR', 'ADMIN']:
            if dept == 'Software Engineering':
                new_dept = 'IT'
            elif dept == 'BA':
                new_dept = 'IT' # Or HR/ADMIN depending on business logic, let's just use IT
            else:
                new_dept = None
            
            print(f"Migrating {u.get('email')} department from {dept} to {new_dept}")
            repo.update_user(u['user_id'], {'department': new_dept})

if __name__ == '__main__':
    main()
