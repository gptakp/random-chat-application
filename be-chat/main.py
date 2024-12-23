from flask import Flask, render_template, request, session, redirect, url_for
from flask_migrate import Migrate
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_session import Session
from werkzeug.security import generate_password_hash, check_password_hash
import random

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "postgresql://postgres:jiraya@localhost/chat1"
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

CORS(app, resources={r"/*": {"origins": "https://localhost:3000"}})
Session(app)
db = SQLAlchemy(app)
migrate = Migrate(app, db)
socketio = SocketIO(app, cors_allowed_origins="https://localhost:3000")

# User model
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.Text, unique=True, nullable=False)
    password = db.Column(db.Text, nullable=False)

# Global dictionary to store active users
active_users = {}

# Create database tables
with app.app_context():
    db.create_all()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/register', methods=['POST'])
def register():
    username = request.form['username']
    password = request.form['password']
    if User.query.filter_by(username=username).first():
        return "User already exists", 400
    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()
    return "User registered", 200

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    user = User.query.filter_by(username=username).first()
    if user and check_password_hash(user.password, password):
        session['user_id'] = user.id
        session['username'] = user.username
        return "Logged in", 200
    return "Invalid credentials", 400

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@socketio.on('connect_user')
def handle_connect_user(data):
    username = data['username']
    if username:
        active_users[username] = {'sid': request.sid, 'status': 'disconnected', 'partner': None}

@socketio.on('start_chat')
def handle_start_chat(data):
    username = data['username']
    if active_users[username]['status'] == 'connected':
        emit('chat_start', {'partner': None, 'message': 'Already connected to a partner.'}, room=request.sid)
        return

    available_users = [user for user in active_users.keys() if
                       user != username and active_users[user]['status'] == 'disconnected']
    if available_users:
        matched_partner = random.choice(available_users)
        active_users[matched_partner]['status'] = 'connected'
        active_users[username]['status'] = 'connected'
        active_users[username]['partner'] = matched_partner
        active_users[matched_partner]['partner'] = username
        emit('chat_start', {'partner': matched_partner}, room=request.sid)
        socketio.emit('chat_start', {'partner': username}, room=active_users[matched_partner]['sid'])
    else:
        emit('chat_start', {'partner': None}, room=request.sid)

@socketio.on('chat_message')
def handle_chat_message(data):
    sender_username = data.get('username')
    msg = data.get('msg', '')
    recipient_username = data.get('recipient')
    recipient_sid = active_users.get(recipient_username, {}).get('sid')
    if recipient_sid and active_users[recipient_username]['status'] == 'connected':
        socketio.emit('chat_message', {'username': sender_username, 'msg': msg}, room=recipient_sid)

@socketio.on('disconnect')
def handle_disconnect():
    username = None
    for user, info in list(active_users.items()):
        if info['sid'] == request.sid:
            username = user
            break
    if username:
        partner = active_users[username]['partner']
        active_users.pop(username, None)
        if partner and active_users[partner]['status'] == 'connected':
            active_users[partner]['status'] = 'disconnected'
            active_users[partner]['partner'] = None
            socketio.emit('partner_disconnected', {'message': f"{username} disconnected."}, room=active_users[partner]['sid'])

if __name__ == '__main__':
    socketio.run(app, debug=True, allow_unsafe_werkzeug=True)
