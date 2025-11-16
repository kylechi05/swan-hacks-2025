# Recordings Directory

This directory stores recorded meeting sessions.

## Format
- Each participant's stream is recorded separately
- Naming convention: `{meeting_id}_{participant_id}_{timestamp}.mp4`
- Example: `event_123_abc456_20251116_143052.mp4`

## Storage
- Recordings are stored locally in this directory
- Files are automatically created when meetings start
- Consider implementing a cleanup policy for production

## Access
Recordings can be accessed via:
- Direct file system access
- Future API endpoints for download
- Admin dashboard (to be implemented)

## Important
- Do not commit actual recording files to git
- Implement proper access controls for production
- Consider privacy and legal requirements for recording storage
