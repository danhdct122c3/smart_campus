import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.modules.users import repository as repo

def main():
    users, _ = repo.list_users(limit=1000)
    count = 0
    for u in users:
        if u.get('role') == 'MAINTENANCE':
            print(f"Updating user {u.get('email')}")
            repo.update_user(u['user_id'], {'role': 'STAFF', 'department': 'MAINTENANCE'})
            count += 1
    print(f"Done! Updated {count} users.")

if __name__ == '__main__':
    main()
