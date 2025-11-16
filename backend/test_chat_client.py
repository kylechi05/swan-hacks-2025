"""
Chat Test Client Example

This script demonstrates how to test the chat functionality using a Python client.
You can run this script to test the chat features from the command line.

Requirements:
    pip install flask-socketio python-socketio[client]
    
Note: This uses the python-socketio client which is compatible with flask-socketio server.
"""

from socketio import Client
import time
import sys

# Create a Socket.IO client
sio = Client()

# Event handlers
@sio.on('connect')
def on_connect():
    print('✓ Connected to server')

@sio.on('disconnect')
def on_disconnect():
    print('✗ Disconnected from server')

@sio.on('chat-joined')
def on_chat_joined(data):
    print(f'✓ Successfully joined chat for event {data["eventid"]}')
    print(f'  Role: {data["role"]}, Members: {data["member_count"]}')

@sio.on('user-joined-chat')
def on_user_joined(data):
    print(f'→ User {data["userid"]} ({data["role"]}) joined the chat')
    print(f'  Members now: {data["member_count"]}')

@sio.on('receive-message')
def on_receive_message(data):
    print(f'\n💬 {data["sender_name"]} ({data["role"]}): {data["message"]}')
    print(f'   [Event: {data["eventid"]}, Time: {data["timestamp"]}]')

@sio.on('user-left-chat')
def on_user_left(data):
    print(f'← User {data["userid"]} ({data["role"]}) left the chat')
    print(f'  Members now: {data["member_count"]}')

@sio.on('chat-left')
def on_chat_left(data):
    print(f'✓ Left chat for event {data["eventid"]}')

@sio.on('user-typing')
def on_user_typing(data):
    status = 'typing...' if data['is_typing'] else 'stopped typing'
    print(f'⌨️  User {data["userid"]} ({data["role"]}) is {status}')

@sio.on('chat-error')
def on_chat_error(data):
    print(f'❌ Error: {data["message"]}')

def main():
    """Test the chat functionality"""
    
    if len(sys.argv) < 4:
        print('Usage: python test_chat_client.py <server_url> <eventid> <userid> <role>')
        print('Example: python test_chat_client.py http://localhost:6969 1 123 tutor')
        sys.exit(1)
    
    server_url = sys.argv[1]
    eventid = int(sys.argv[2])
    userid = int(sys.argv[3])
    role = sys.argv[4]  # 'tutor' or 'tutee'
    
    print(f'Connecting to {server_url}...')
    
    try:
        # Connect to server
        sio.connect(server_url)
        
        # Join chat room
        print(f'\nJoining chat for event {eventid} as {role} (userid: {userid})...')
        sio.emit('join-chat', {
            'eventid': eventid,
            'userid': userid,
            'role': role
        })
        
        # Wait a moment for join confirmation
        time.sleep(1)
        
        # Interactive chat loop
        print('\n=== Chat started (type "quit" to exit) ===\n')
        
        while True:
            message = input('You: ')
            
            if message.lower() in ['quit', 'exit', 'q']:
                break
            
            if message.strip():
                # Send typing indicator
                sio.emit('typing', {'is_typing': True})
                time.sleep(0.5)
                
                # Send message
                sio.emit('send-message', {
                    'message': message,
                    'eventid': eventid
                })
                
                # Stop typing indicator
                sio.emit('typing', {'is_typing': False})
        
        # Leave chat
        print('\nLeaving chat...')
        sio.emit('leave-chat', {'eventid': eventid})
        time.sleep(1)
        
        # Disconnect
        sio.disconnect()
        print('Goodbye!')
        
    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)

if __name__ == '__main__':
    main()
