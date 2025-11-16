"use client";

import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { useAuth } from "@/app/authContext";

interface Message {
    message: string;
    userid: number;
    sender_name: string;
    role: string;
    timestamp: string;
    eventid: number;
}

interface ChatProps {
    socket: Socket | null;
    eventid: string;
    userRole: "tutor" | "tutee";
}

export default function Chat({ socket, eventid, userRole }: ChatProps) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState("");
    const [isConnected, setIsConnected] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const [isTyping, setIsTyping] = useState(false);
    const [otherUserTyping, setOtherUserTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Auto-scroll to bottom when new messages arrive
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Join chat room when component mounts
    useEffect(() => {
        console.log(user)

        if (!socket || !user?.userid) return;

        console.log("Joining chat room:", { eventid, userid: user.userid, role: userRole });

        // Join the chat room
        socket.emit("join-chat", {
            eventid: parseInt(eventid),
            userid: user.userid,
            role: userRole,
        });

        // Chat event handlers
        socket.on("chat-joined", (data) => {
            console.log("Successfully joined chat:", data);
            setIsConnected(true);
            setMemberCount(data.member_count);
        });

        socket.on("user-joined-chat", (data) => {
            console.log("Another user joined chat:", data);
            setMemberCount(data.member_count);
        });

        socket.on("receive-message", (data: Message) => {
            console.log("Received message:", data);
            setMessages((prev) => [...prev, data]);
        });

        socket.on("user-left-chat", (data) => {
            console.log("User left chat:", data);
            setMemberCount(data.member_count);
        });

        socket.on("user-typing", (data) => {
            console.log("User typing:", data);
            setOtherUserTyping(data.is_typing);
        });

        socket.on("chat-error", (data) => {
            console.error("Chat error:", data.message);
            alert(`Chat error: ${data.message}`);
        });

        // Cleanup
        return () => {
            if (socket) {
                socket.emit("leave-chat", { eventid: parseInt(eventid) });
                socket.off("chat-joined");
                socket.off("user-joined-chat");
                socket.off("receive-message");
                socket.off("user-left-chat");
                socket.off("user-typing");
                socket.off("chat-error");
            }
        };
    }, [socket, user?.userid, eventid, userRole]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();

        if (!socket || !inputMessage.trim()) return;

        console.log("Sending message:", inputMessage);

        // Send the message
        socket.emit("send-message", {
            message: inputMessage,
            eventid: parseInt(eventid),
        });

        // Clear input
        setInputMessage("");

        // Stop typing indicator
        if (isTyping) {
            socket.emit("typing", { is_typing: false });
            setIsTyping(false);
        }

        // Clear typing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputMessage(value);

        if (!socket) return;

        // Send typing indicator
        if (value && !isTyping) {
            socket.emit("typing", { is_typing: true });
            setIsTyping(true);
        }

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Set new timeout to stop typing indicator
        if (value) {
            typingTimeoutRef.current = setTimeout(() => {
                socket.emit("typing", { is_typing: false });
                setIsTyping(false);
            }, 1000);
        } else {
            socket.emit("typing", { is_typing: false });
            setIsTyping(false);
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const isOwnMessage = (message: Message) => {
        return message.userid === user?.userid;
    };

    return (
        <div className="flex h-full flex-col">
            {/* Chat Header */}
            <div className="border-b border-gray-700 px-4 py-3">
                <h3 className="text-lg font-semibold text-white">Chat</h3>
                <div className="flex items-center gap-2 text-sm">
                    <div
                        className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                    />
                    <span className="text-gray-400">
                        {isConnected
                            ? `${memberCount} participant${memberCount !== 1 ? "s" : ""}`
                            : "Connecting..."}
                    </span>
                </div>
            </div>

            {/* Messages Container */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                {messages.length === 0 && (
                    <div className="flex h-full items-center justify-center text-center">
                        <p className="text-sm text-gray-500">
                            No messages yet. Start the conversation!
                        </p>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isOwn = isOwnMessage(msg);
                    return (
                        <div
                            key={index}
                            className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[75%] rounded-lg px-4 py-2 ${
                                    isOwn
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-700 text-white"
                                }`}
                            >
                                {!isOwn && (
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="text-xs font-semibold">
                                            {msg.sender_name}
                                        </span>
                                        <span className="rounded bg-gray-600 px-1.5 py-0.5 text-xs">
                                            {msg.role}
                                        </span>
                                    </div>
                                )}
                                <p className="text-sm wrap-break-word">{msg.message}</p>
                                <span
                                    className={`mt-1 block text-xs ${
                                        isOwn ? "text-blue-200" : "text-gray-400"
                                    }`}
                                >
                                    {formatTime(msg.timestamp)}
                                </span>
                            </div>
                        </div>
                    );
                })}

                {/* Typing Indicator */}
                {otherUserTyping && (
                    <div className="flex justify-start">
                        <div className="rounded-lg bg-gray-700 px-4 py-2">
                            <div className="flex gap-1">
                                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }}></div>
                                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }}></div>
                                <div className="h-2 w-2 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }}></div>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form
                onSubmit={handleSendMessage}
                className="border-t border-gray-700 px-4 py-3"
            >
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={handleInputChange}
                        placeholder="Type a message..."
                        disabled={!isConnected}
                        className="flex-1 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <button
                        type="submit"
                        disabled={!isConnected || !inputMessage.trim()}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Send
                    </button>
                </div>
            </form>
        </div>
    );
}
