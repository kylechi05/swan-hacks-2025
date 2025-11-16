# Chat API Documentation

This document describes the Socket.IO chat implementation for tutor-tutee communication within events.

## Overview

The chat system allows tutors and tutees to communicate in real-time for a specific event using Flask-SocketIO. Each event has its own chat room that only the assigned tutor and tutee can join.

## Socket.IO Events

### Client → Server Events

#### 1. `join-chat`
Join a chat room for a specific event.

**Payload:**
```json
{
  "eventid": 123,          // Integer: The event ID
  "userid": 456,           // Integer: The user ID
  "role": "tutor"          // String: "tutor" or "tutee"
}
```

**Server Responses:**
- `chat-joined` - Successfully joined the chat
- `chat-error` - Error occurred (unauthorized, event not found, etc.)
- `user-joined-chat` - Broadcast to other members when someone joins

#### 2. `send-message`
Send a chat message to the event chat room.

**Payload:**
```json
{
  "message": "Hello!",     // String: The message content
  "eventid": 123           // Integer: The event ID (optional, uses stored eventid)
}
```

**Server Responses:**
- `receive-message` - Message broadcast to all chat members
- `chat-error` - Error occurred

#### 3. `leave-chat`
Leave the chat room for an event.

**Payload:**
```json
{
  "eventid": 123          // Integer: The event ID (optional)
}
```

**Server Responses:**
- `chat-left` - Successfully left the chat
- `user-left-chat` - Broadcast to other members when someone leaves
- `chat-error` - Error occurred

#### 4. `typing`
Send typing indicator to other chat members.

**Payload:**
```json
{
  "is_typing": true       // Boolean: true when typing, false when stopped
}
```

**Server Responses:**
- `user-typing` - Broadcast to other members (not sender)

#### 5. `disconnect`
Automatically triggered when socket disconnects. Cleans up both meeting and chat rooms.

---

### Server → Client Events

#### 1. `chat-joined`
Emitted when user successfully joins a chat room.

**Payload:**
```json
{
  "eventid": 123,
  "member_count": 2,
  "role": "tutor"
}
```

#### 2. `user-joined-chat`
Broadcast to existing chat members when a new user joins.

**Payload:**
```json
{
  "userid": 456,
  "role": "tutee",
  "member_count": 2
}
```

#### 3. `receive-message`
Broadcast to all chat members (including sender) when a message is sent.

**Payload:**
```json
{
  "message": "Hello!",
  "userid": 456,
  "sender_name": "John Doe",
  "role": "tutor",
  "timestamp": "2025-11-16T10:30:00.123456",
  "eventid": 123
}
```

#### 4. `user-left-chat`
Broadcast to remaining members when someone leaves the chat.

**Payload:**
```json
{
  "userid": 456,
  "role": "tutor",
  "member_count": 1
}
```

#### 5. `chat-left`
Emitted to user who left the chat.

**Payload:**
```json
{
  "eventid": 123
}
```

#### 6. `user-typing`
Broadcast to other members when someone is typing.

**Payload:**
```json
{
  "userid": 456,
  "role": "tutor",
  "is_typing": true
}
```

#### 7. `chat-error`
Emitted when an error occurs.

**Payload:**
```json
{
  "message": "Error description"
}
```

---

## Authorization

The chat system verifies that users are authorized to join a chat room by checking:
1. The event exists in the database
2. The user is either the tutor (`userid_tutor`) or tutee (`userid_tutee`) for that event

Unauthorized users will receive a `chat-error` event.

---

## Example Client Usage (JavaScript)

```javascript
import io from 'socket.io-client';

// Connect to the server
const socket = io('http://localhost:6969');

// Join a chat room
socket.emit('join-chat', {
  eventid: 123,
  userid: 456,
  role: 'tutor'
});

// Listen for successful join
socket.on('chat-joined', (data) => {
  console.log('Joined chat:', data);
});

// Send a message
socket.emit('send-message', {
  message: 'Hello, how can I help you?',
  eventid: 123
});

// Receive messages
socket.on('receive-message', (data) => {
  console.log(`${data.sender_name} (${data.role}): ${data.message}`);
  console.log(`Sent at: ${data.timestamp}`);
});

// Send typing indicator
socket.emit('typing', { is_typing: true });

// Listen for typing indicators
socket.on('user-typing', (data) => {
  console.log(`User ${data.userid} is typing: ${data.is_typing}`);
});

// Leave chat
socket.emit('leave-chat', { eventid: 123 });

// Listen for errors
socket.on('chat-error', (data) => {
  console.error('Chat error:', data.message);
});

// Handle disconnection
socket.on('disconnect', () => {
  console.log('Disconnected from chat');
});
```

---

## Backend Implementation Details

### Data Structures

**chat_rooms:**
```python
{
  eventid: {
    'tutor_sid': 'socket_id',       # Socket ID of tutor (or None)
    'tutee_sid': 'socket_id',       # Socket ID of tutee (or None)
    'users': {
      'socket_id': userid,           # Map of active socket IDs to user IDs
      ...
    }
  },
  ...
}
```

**chat_sid_to_user:**
```python
{
  'socket_id': {
    'userid': 456,
    'eventid': 123,
    'role': 'tutor'
  },
  ...
}
```

### Chat Room Naming

Chat rooms are named using the pattern: `chat_{eventid}`

For example, event ID 123 would have chat room name: `chat_123`

---

## Error Handling

Common error messages:
- `"Missing eventid or userid"` - Required data not provided
- `"Event not found"` - Event ID doesn't exist in database
- `"Unauthorized: You are not part of this event"` - User is not tutor or tutee
- `"Not in any chat room"` - User tried to send message without joining
- `"Event ID mismatch"` - Eventid in message doesn't match joined room
- `"Empty message"` - Tried to send empty message
- `"Failed to join chat"` - General error joining chat
- `"Failed to send message"` - General error sending message
- `"Failed to leave chat"` - General error leaving chat

---

## Notes

1. **Automatic Cleanup:** When a user disconnects, they are automatically removed from both meeting rooms and chat rooms.

2. **Room Isolation:** Each event has its own isolated chat room. Messages sent in one event's chat won't be seen in other events.

3. **Authentication:** The backend verifies user authorization by querying the `RequestedEvent` table to ensure the user is the tutor or tutee.

4. **Real-time Updates:** The system uses Socket.IO rooms for efficient broadcasting of messages only to participants of each event.

5. **Message History:** The current implementation does NOT persist chat messages to the database. Messages are only delivered in real-time. If you need message persistence, you'll need to add a ChatMessage table to the database.

---

## Future Enhancements

Consider implementing:
1. **Message Persistence:** Store messages in database for history
2. **Message Read Receipts:** Track which messages have been read
3. **File Sharing:** Allow users to share files in chat
4. **Emoji Reactions:** Add support for emoji reactions to messages
5. **Message Editing/Deletion:** Allow users to edit or delete their messages
6. **Notification System:** Notify users of new messages when offline
