import sqlite3
import os

DB_NAME = "sentinel.db"

def repair():
    if os.path.exists(DB_NAME):
        print(f"[!] Found existing {DB_NAME}. Attempting to add 'category' column...")
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        try:
            # This adds the column if it's missing
            cursor.execute("ALTER TABLE results ADD COLUMN category TEXT")
            conn.commit()
            print("[✅] Success: 'category' column added.")
        except sqlite3.OperationalError:
            print("[i] Note: 'category' column already exists or table is missing.")
        finally:
            conn.close()
    else:
        print("[!] No database found. It will be created when you start main.py")

if __name__ == "__main__":
    repair()