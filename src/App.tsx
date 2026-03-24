/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  db, 
  auth, 
  collection, 
  doc, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  getDoc, 
  setDoc,
  onAuthStateChanged
} from './firebase';
import { 
  Send, 
  Image as ImageIcon, 
  User, 
  Hash, 
  MessageSquare, 
  Loader2, 
  Plus, 
  Copy, 
  Check,
  ChevronRight,
  LogOut,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { format } from 'date-fns';
import { getDocFromServer } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Database Error: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white p-6 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
            <LogOut className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold mb-4">Application Error</h2>
          <p className="text-white/60 max-w-md mb-8">{errorMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-bold"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Message {
  id: string;
  sender: string;
  text: string;
  imageUrl?: string;
  timestamp: any;
}

export default function App() {
  const [view, setView] = useState<'loading' | 'home' | 'chat'>('loading');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(localStorage.getItem('chat_username'));
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Test Firestore Connection
  useEffect(() => {
    if (!isAuthReady) return;
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error.message?.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    }
    testConnection();
  }, [isAuthReady]);

  // Initialize Room from URL
  useEffect(() => {
    if (!isAuthReady) return;

    const params = new URLSearchParams(window.location.search);
    const roomFromUrl = Array.from(params.keys())[0]; // Get the first key as room ID

    if (roomFromUrl === 'newroom') {
      createNewRoom();
    } else if (roomFromUrl) {
      setRoomId(roomFromUrl);
      checkRoomExists(roomFromUrl);
      setView('chat');
      setIsLoading(false);
    } else {
      setView('home');
      setIsLoading(false);
    }
  }, [isAuthReady]);

  // Check if user has a username
  useEffect(() => {
    if (!username) {
      setShowUsernameModal(true);
    }
  }, [username]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Listen for messages
  useEffect(() => {
    if (!roomId) return;

    const q = query(
      collection(db, 'rooms', roomId, 'messages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
      setIsLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  const createNewRoom = async () => {
    const newId = Math.random().toString(36).substring(2, 10);
    const roomRef = doc(db, 'rooms', newId);
    try {
      await setDoc(roomRef, {
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `rooms/${newId}`);
    }
    window.history.replaceState({}, '', `?${newId}`);
    setRoomId(newId);
    setView('chat');
    setIsLoading(false);
  };

  const checkRoomExists = async (id: string) => {
    const roomRef = doc(db, 'rooms', id);
    try {
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        await setDoc(roomRef, {
          createdAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `rooms/${id}`);
    }
  };

  const handleSetUsername = (e: React.FormEvent) => {
    e.preventDefault();
    if (newUsername.trim()) {
      localStorage.setItem('chat_username', newUsername.trim());
      setUsername(newUsername.trim());
      setShowUsernameModal(false);
      setNewUsername('');
    }
  };

  const sendMessage = async (text: string, imageUrl?: string) => {
    if (!roomId || !username || (!text.trim() && !imageUrl)) return;

    setIsSending(true);
    const path = `rooms/${roomId}/messages`;
    try {
      await addDoc(collection(db, 'rooms', roomId, 'messages'), {
        sender: username,
        text: text.trim(),
        imageUrl: imageUrl || null,
        timestamp: serverTimestamp(),
      });
      setInputText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSending(false);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            sendMessage('', base64);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading || view === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#0a0a0a] text-white">
        <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
        <p className="font-mono text-sm tracking-widest uppercase opacity-50">Initializing Session...</p>
      </div>
    );
  }

  if (view === 'home') {
    return (
      <ErrorBoundary>
        <div className="flex flex-col min-h-screen bg-[#0a0a0a] text-[#e0e0e0] font-sans selection:bg-orange-500/30">
          <header className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-[#0a0a0a]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20">
                <MessageSquare className="text-black w-6 h-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white">Instant Chat +</h1>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => createNewRoom()}
                className="bg-orange-500 hover:bg-orange-400 text-black px-6 py-2 rounded-lg font-bold transition-all shadow-lg shadow-orange-500/20"
              >
                Start Chatting
              </button>
            </div>
          </header>

          <main className="flex-1 max-w-4xl mx-auto px-6 py-20 space-y-24">
            {/* Hero Section */}
            <section className="text-center space-y-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-6xl md:text-8xl font-black tracking-tighter text-white leading-none">
                  INSTANT.<br />
                  SECURE.<br />
                  <span className="text-orange-500">EPHEMERAL.</span>
                </h2>
              </motion.div>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-xl text-white/40 max-w-2xl mx-auto font-medium"
              >
                A minimalist, persistent chat protocol designed for speed and privacy. 
                No accounts, no tracking, just pure conversation.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="pt-8"
              >
                <button 
                  onClick={() => createNewRoom()}
                  className="group relative inline-flex items-center gap-3 bg-white text-black px-10 py-5 rounded-2xl font-black text-lg hover:bg-orange-500 transition-all active:scale-95"
                >
                  CREATE A PRIVATE ROOM
                  <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </button>
              </motion.div>
            </section>

            {/* Features Grid */}
            <section className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "URL-BASED ROOMS",
                  desc: "Rooms are identified by unique URL parameters. Share the link to invite others instantly.",
                  icon: <Hash className="w-6 h-6 text-orange-500" />
                },
                {
                  title: "MARKDOWN READY",
                  desc: "Full support for Markdown syntax. Format your messages with bold, italics, code blocks, and more.",
                  icon: <FileText className="w-6 h-6 text-orange-500" />
                },
                {
                  title: "IMAGE PERSISTENCE",
                  desc: "Paste images directly from your clipboard. They are stored and rendered instantly for all participants.",
                  icon: <ImageIcon className="w-6 h-6 text-orange-500" />
                }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-8 bg-[#121212] border border-white/5 rounded-3xl hover:border-orange-500/30 transition-colors group"
                >
                  <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-6 group-hover:bg-orange-500/10 transition-colors">
                    {feature.icon}
                  </div>
                  <h3 className="text-sm font-black tracking-widest uppercase mb-3 text-white">{feature.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed font-medium">{feature.desc}</p>
                </motion.div>
              ))}
            </section>

            {/* Tech Specs */}
            <section className="pt-12 border-t border-white/5">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                  <h4 className="text-[10px] font-black tracking-[0.2em] uppercase text-orange-500 mb-2">Protocol Specifications</h4>
                  <p className="text-sm text-white/30 font-mono">V1.0.5-stable // Cloud-Native Architecture</p>
                </div>
                <div className="flex gap-12">
                  <div>
                    <span className="block text-2xl font-bold text-white">100%</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-30">Encrypted Transit</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-bold text-white">&lt;50ms</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-30">Sync Latency</span>
                  </div>
                </div>
              </div>
            </section>
          </main>

          <footer className="px-6 py-12 border-t border-white/5 text-center space-y-4">
            <p className="text-[10px] uppercase tracking-[0.3em] opacity-20 font-mono">
              Instant Chat + // Built for the open web
            </p>
            <div className="text-[10px] uppercase tracking-widest opacity-40 font-mono">
              Vibe coded by <a href="https://www.linkedin.com/in/adrian-luyaphan/" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Adrian Luyaphan</a> // 
              <a href="https://github.com/polohot" target="_blank" rel="noopener noreferrer" className="ml-2 text-orange-500 hover:underline">GitHub</a>
            </div>
          </footer>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen bg-[#0a0a0a] text-[#e0e0e0] font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-[#0f0f0f] z-10">
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => {
            window.history.replaceState({}, '', window.location.pathname);
            setRoomId(null);
            setView('home');
          }}
        >
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <MessageSquare className="text-black w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Instant Chat +</h1>
            <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-mono opacity-50">
              <Hash className="w-2.5 h-2.5" />
              <span>{roomId}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={copyRoomLink}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors text-[10px] font-medium border border-white/5"
          >
            {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Invite'}</span>
          </button>
          
          <div 
            onClick={() => setShowUsernameModal(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/10 hover:bg-orange-500/20 transition-all cursor-pointer border border-orange-500/20 group"
          >
            <User className="w-3.5 h-3.5 text-orange-500" />
            <span className="text-xs font-semibold text-orange-500 group-hover:text-orange-400">{username || 'Guest'}</span>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full opacity-30 space-y-2">
            <Plus className="w-8 h-8" />
            <p className="font-mono text-[10px] uppercase tracking-widest">No messages yet.</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <motion.div 
            key={msg.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex flex-col ${msg.sender === username ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center gap-1.5 mb-0.5 px-1">
              <span className={`text-[9px] font-bold uppercase tracking-widest ${msg.sender === username ? 'text-orange-500' : 'text-blue-400'}`}>
                {msg.sender}
              </span>
              <span className="text-[9px] opacity-30 font-mono">
                {msg.timestamp ? format(msg.timestamp.toDate(), 'HH:mm') : '--:--'}
              </span>
            </div>
            
            <div className={`max-w-[85%] p-2.5 rounded-xl shadow-lg ${
              msg.sender === username 
                ? 'bg-orange-500 text-black rounded-tr-none' 
                : 'bg-[#1a1a1a] text-white border border-white/5 rounded-tl-none'
            }`}>
              {msg.imageUrl && (
                <img 
                  src={msg.imageUrl} 
                  alt="Pasted content" 
                  className="max-w-full rounded-lg mb-2 border border-black/10"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="prose prose-invert prose-xs max-w-none leading-tight">
                <Markdown>{msg.text}</Markdown>
              </div>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-3 bg-[#0f0f0f] border-t border-white/10">
        <form 
          onSubmit={(e) => { e.preventDefault(); sendMessage(inputText); }}
          className="relative max-w-4xl mx-auto"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onPaste={handlePaste}
            placeholder="Type a message..."
            className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-4 py-2.5 pr-12 focus:outline-none focus:border-orange-500/50 transition-all text-sm text-white placeholder:text-white/20 shadow-inner"
          />
          <button
            type="submit"
            disabled={isSending || (!inputText.trim())}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center text-black hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </footer>

      {/* Username Modal */}
      <AnimatePresence>
        {showUsernameModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-[#121212] border border-white/10 rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-4 border border-orange-500/20">
                  <User className="w-8 h-8 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Identify Yourself</h2>
                <p className="text-sm text-white/40">Choose a nickname to join the conversation.</p>
              </div>

              <form onSubmit={handleSetUsername} className="space-y-4">
                <div className="relative">
                  <input
                    autoFocus
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter nickname..."
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl px-6 py-4 focus:outline-none focus:border-orange-500 transition-all text-white"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-orange-500 hover:bg-orange-400 text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group"
                >
                  <span>Join Chat</span>
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </form>
              
              <div className="mt-6 pt-6 border-t border-white/5 flex justify-center">
                <p className="text-[10px] uppercase tracking-widest opacity-30">Instant Chat + Protocol V1.0.5-stable</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
