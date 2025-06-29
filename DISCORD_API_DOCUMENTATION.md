# Discord API Documentation

## Overview

The Discord API endpoint provides access to active Discord account IDs stored in a static JSON file.

## Endpoint

### GET /api/discord/accounts

Returns an array of active Discord account IDs.

**Response Format:**

```json
{
  "success": true,
  "data": ["123456789012345678", "234567890123456789", "345678901234567890"],
  "count": 3,
  "timestamp": "2025-06-28T23:45:30.123Z"
}
```

**Response Fields:**

- `success`: Boolean indicating request success
- `data`: Array of Discord ID strings (17-19 digits)
- `count`: Number of accounts in the array
- `timestamp`: ISO timestamp of the response

## Static File Management

### File Location

Discord IDs are stored in `/static/active_accounts.json`

### File Format

```json
[
  "123456789012345678",
  "234567890123456789",
  "345678901234567890"
]
```

### Direct Access

The static file can also be accessed directly at: `/static/active_accounts.json`

## Configuration

### Environment Variables

- `STATIC_DIR`: Directory path for static files (default: `/public/`)
- Set to `/static/` to serve files from the static directory
- Can be customized in `.env` file

### Static Directory Serving

- Files accessible at `/static/{filename}`
- Supports all file types
- Automatic directory resolution

## Implementation Details

### Controller

- `DiscordController.getActiveAccounts()`: Handles API endpoint
- Reads from file system synchronously
- Includes error handling and logging
- Returns structured JSON response

### File System

- Uses Node.js `fs.readFileSync()` for file access
- Path resolution via `path.join()`
- Automatic JSON parsing with error handling

### Testing

- Comprehensive test suite in `tests/discord.test.ts`
- Validates response structure
- Checks Discord ID format (17-19 digits)
- Ensures proper error handling
