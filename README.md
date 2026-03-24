# Instant Chat +

A minimalist, persistent chat protocol designed for speed and privacy. No accounts, no tracking, just pure conversation.

## Features

- **URL-Based Rooms**: Rooms are identified by unique URL parameters. Share the link to invite others instantly.
- **Markdown Ready**: Full support for Markdown syntax. Format your messages with bold, italics, code blocks, and more.
- **Image Persistence**: Paste images directly from your clipboard. They are stored and rendered instantly for all participants.
- **Real-time Sync**: Powered by Firebase Firestore for sub-50ms synchronization.
- **Ephemeral Feel**: No complex sign-ups. Just pick a nickname and start chatting.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Framer Motion (motion/react)
- **Backend**: Firebase (Authentication, Firestore)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js installed
- A Firebase project

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd <your-repo-name>
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file in the root directory and add your Firebase API Key:
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key_here
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Deployment

This project is optimized for deployment on platforms like **Koyeb** or **Cloud Run**.

### Koyeb Deployment

1. Create a Secret in Koyeb named `FIREBASE_API_KEY`.
2. Set an environment variable `VITE_FIREBASE_API_KEY` with the value `{{ secret.FIREBASE_API_KEY }}`.
3. Deploy using the provided `Dockerfile`.

---

Vibe coded by **Adrian Luyaphan**
- [LinkedIn](https://www.linkedin.com/in/adrian-luyaphan/)
- [GitHub](https://github.com/polohot)
