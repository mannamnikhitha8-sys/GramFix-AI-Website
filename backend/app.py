
from flask import Flask, request, jsonify, g
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from functools import wraps
from difflib import SequenceMatcher
import sqlite3
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)

app.config["SECRET_KEY"] = os.environ.get(
    "GRAMFIX_SECRET_KEY", "change-this-secret-before-deployment"
)

serializer = URLSafeTimedSerializer(app.config["SECRET_KEY"])
DATABASE = os.path.join(os.path.dirname(__file__), "gramfix.db")


def get_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def init_db():
    db = get_db()

    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            mobile TEXT UNIQUE,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'Citizen',
            created_at TEXT
        )
    """)

    db.execute("""
        CREATE TABLE IF NOT EXISTS complaints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            description TEXT NOT NULL,
            location TEXT NOT NULL,
            category TEXT,
            people INTEGER DEFAULT 10,
            duration INTEGER DEFAULT 1,
            status TEXT DEFAULT 'Received',
            priority TEXT DEFAULT 'Medium',
            repeat_alert INTEGER DEFAULT 0,
            owner_id INTEGER,
            created_at TEXT
        )
    """)

    # Add owner_id if this is an older version of the database.
    columns = [
        row["name"]
        for row in db.execute("PRAGMA table_info(complaints)").fetchall()
    ]

    if "owner_id" not in columns:
        db.execute("ALTER TABLE complaints ADD COLUMN owner_id INTEGER")

    db.commit()
    db.close()


def make_token(user):
    return serializer.dumps({
        "user_id": user["id"],
        "role": user["role"]
    })


def require_login(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify({"error": "Please sign in first."}), 401

        token = header.replace("Bearer ", "", 1)

        try:
            data = serializer.loads(token, max_age=60 * 60 * 24)
        except SignatureExpired:
            return jsonify({"error": "Session expired. Please sign in again."}), 401
        except BadSignature:
            return jsonify({"error": "Invalid login session."}), 401

        db = get_db()
        user = db.execute(
            "SELECT id, name, email, mobile, role FROM users WHERE id = ?",
            (data["user_id"],)
        ).fetchone()
        db.close()

        if not user:
            return jsonify({"error": "Account not found."}), 401

        g.user = dict(user)
        return function(*args, **kwargs)

    return wrapper


def require_staff(function):
    @wraps(function)
    @require_login
    def wrapper(*args, **kwargs):
        if g.user["role"] != "Panchayat Staff":
            return jsonify({"error": "Only Panchayat Staff can perform this action."}), 403
        return function(*args, **kwargs)

    return wrapper


@app.route("/")
def home():
    return jsonify({"message": "GRAMFIX AI backend is running"})


@app.route("/api/health")
def health():
    return jsonify({"status": "connected"})


# ---------------- AUTHENTICATION ----------------

@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json(silent=True) or {}

    name = str(data.get("name", "")).strip()
    email = str(data.get("email", "")).strip().lower()
    mobile = str(data.get("mobile", "")).strip()
    password = str(data.get("password", ""))
    role = str(data.get("role", "Citizen")).strip()

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are required."}), 400

    if "@" not in email or "." not in email.split("@")[-1]:
        return jsonify({"error": "Enter a valid email address."}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must contain at least 8 characters."}), 400

    if role not in ["Citizen", "Panchayat Staff"]:
        return jsonify({"error": "Choose a valid account role."}), 400

    db = get_db()

    try:
        cursor = db.execute("""
            INSERT INTO users (name, email, mobile, password, role, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            name,
            email,
            mobile or None,
            generate_password_hash(password),
            role,
            datetime.now().isoformat(timespec="seconds")
        ))

        db.commit()
        user_id = cursor.lastrowid

        user = {
            "id": user_id,
            "name": name,
            "email": email,
            "mobile": mobile,
            "role": role
        }

        token = make_token(user)

        return jsonify({
            "message": "Account created successfully.",
            "token": token,
            "user": user
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({
            "error": "This email or mobile number is already registered."
        }), 409

    finally:
        db.close()


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    identifier = str(data.get("identifier", "")).strip().lower()
    password = str(data.get("password", ""))

    if not identifier or not password:
        return jsonify({"error": "Enter your email/mobile and password."}), 400

    db = get_db()
    user = db.execute("""
        SELECT * FROM users
        WHERE lower(email) = ? OR mobile = ?
    """, (identifier, identifier)).fetchone()
    db.close()

    if not user or not check_password_hash(user["password"], password):
        return jsonify({"error": "Incorrect email/mobile or password."}), 401

    user_data = {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "mobile": user["mobile"],
        "role": user["role"]
    }

    return jsonify({
        "message": "Login successful.",
        "token": make_token(user_data),
        "user": user_data
    })


@app.route("/api/auth/me", methods=["GET"])
@require_login
def current_user():
    return jsonify({"user": g.user})


@app.route("/api/auth/logout", methods=["POST"])
@require_login
def logout():
    # The frontend removes the token. This endpoint confirms logout.
    return jsonify({"message": "Logged out successfully."})


# ---------------- COMPLAINT MANAGEMENT ----------------

def detect_category(description):
    text = description.lower()

    categories = {
        "Water Supply": [
            "water", "pipeline", "leakage", "నీరు", "నీళ్లు", "పైపు"
        ],
        "Road Damage": [
            "road", "pothole", "రోడ్డు", "గుంత"
        ],
        "Drainage": [
            "drain", "drainage", "sewage", "కాలువ"
        ],
        "Streetlight": [
            "streetlight", "street light", "light", "వీధి దీపం"
        ],
        "Garbage": [
            "garbage", "waste", "rubbish", "చెత్త"
        ],
        "Sanitation": [
            "sanitation", "toilet", "cleanliness", "పరిశుభ్రత"
        ]
    }

    for category, keywords in categories.items():
        if any(word in text for word in keywords):
            return category

    return "Other"


def calculate_priority(people, duration):
    score = int(people) * 2 + int(duration) * 3

    if score >= 100:
        return "High"
    if score >= 35:
        return "Medium"
    return "Low"


def complaint_to_dict(row):
    item = dict(row)
    item["repeat_alert"] = bool(item.get("repeat_alert", 0))
    return item


@app.route("/api/complaints", methods=["GET"])
@require_login
def get_complaints():
    db = get_db()

    if g.user["role"] == "Panchayat Staff":
        rows = db.execute(
            "SELECT * FROM complaints ORDER BY id DESC"
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM complaints WHERE owner_id = ? ORDER BY id DESC",
            (g.user["id"],)
        ).fetchall()

    db.close()

    return jsonify([complaint_to_dict(row) for row in rows])


@app.route("/api/complaints", methods=["POST"])
@require_login
def add_complaint():
    if g.user["role"] != "Citizen":
        return jsonify({"error": "Only citizens can submit complaints."}), 403

    data = request.get_json(silent=True) or {}

    description = str(data.get("description", "")).strip()
    location = str(data.get("location", "")).strip()
    name = str(data.get("name", g.user["name"])).strip()

    if not description or not location:
        return jsonify({"error": "Description and location are required."}), 400

    people = max(1, min(int(data.get("people", 10)), 100000))
    duration = max(1, min(int(data.get("duration", 1)), 3650))

    category = data.get("category", "Auto Detect")
    if category == "Auto Detect":
        category = detect_category(description)

    priority = calculate_priority(people, duration)

    db = get_db()

    existing = db.execute("""
        SELECT description FROM complaints
        WHERE lower(location) = lower(?)
    """, (location,)).fetchall()

    repeat_alert = any(
        SequenceMatcher(
            None, description.lower(), row["description"].lower()
        ).ratio() > 0.75
        for row in existing
    )

    cursor = db.execute("""
        INSERT INTO complaints
        (name, description, location, category, people, duration,
         status, priority, repeat_alert, owner_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'Received', ?, ?, ?, ?)
    """, (
        name,
        description,
        location,
        category,
        people,
        duration,
        priority,
        int(repeat_alert),
        g.user["id"],
        datetime.now().isoformat(timespec="seconds")
    ))

    db.commit()

    row = db.execute(
        "SELECT * FROM complaints WHERE id = ?",
        (cursor.lastrowid,)
    ).fetchone()

    db.close()

    return jsonify(complaint_to_dict(row)), 201


@app.route("/api/complaints/<int:complaint_id>", methods=["PATCH"])
@require_staff
def update_complaint(complaint_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")

    allowed_statuses = [
        "Received", "Under Review", "Assigned", "Resolved"
    ]

    if status not in allowed_statuses:
        return jsonify({"error": "Invalid complaint status."}), 400

    db = get_db()

    result = db.execute(
        "UPDATE complaints SET status = ? WHERE id = ?",
        (status, complaint_id)
    )

    db.commit()

    if result.rowcount == 0:
        db.close()
        return jsonify({"error": "Complaint not found."}), 404

    row = db.execute(
        "SELECT * FROM complaints WHERE id = ?",
        (complaint_id,)
    ).fetchone()

    db.close()

    return jsonify(complaint_to_dict(row))


init_db()
import os
if __name__ == "__main__":
    port = int(os.environ.get("PORT",5000))
    app.run(host="0.0.0.0", port=port)
