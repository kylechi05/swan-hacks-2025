"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import Chat from "./components/chat";
import { useAuth } from "@/app/authContext";

export default function MeetingPage() {
    const params = useParams();
    const meetingId = params.id as string;
    const { user } = useAuth();

    const [isConnected, setIsConnected] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shouldStartCall, setShouldStartCall] = useState(false);
    const [shouldShareScreen, setShouldShareScreen] = useState(false);
    const [userRole, setUserRole] = useState<"tutor" | "tutee">("tutee");

    const socketRef = useRef<Socket | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null); // Client-side recorder
    const recordedChunksRef = useRef<Blob[]>([]);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const isOfferCreatorRef = useRef<boolean>(false);
    const makingOfferRef = useRef<boolean>(false);
    const ignoreOfferRef = useRef<boolean>(false);

    const configuration: RTCConfiguration = {
        iceServers: [
            { urls: "stun:stun.relay.metered.ca:80" },
            {
                urls: "turn:standard.relay.metered.ca:80",
                username: "21681ef33e1175e2ba2aae3c",
                credential: "LWN5QDGpz7QJtKTW",
            },
            {
                urls: "turn:standard.relay.metered.ca:80?transport=tcp",
                username: "21681ef33e1175e2ba2aae3c",
                credential: "LWN5QDGpz7QJtKTW",
            },
            {
                urls: "turn:standard.relay.metered.ca:443",
                username: "21681ef33e1175e2ba2aae3c",
                credential: "LWN5QDGpz7QJtKTW",
            },
            {
                urls: "turns:standard.relay.metered.ca:443?transport=tcp",
                username: "21681ef33e1175e2ba2aae3c",
                credential: "LWN5QDGpz7QJtKTW",
            },
        ],
        iceCandidatePoolSize: 10,
        bundlePolicy: "max-bundle",
        iceTransportPolicy: "all",
    };

    // Fetch event details and determine user role
    useEffect(() => {
        const fetchEventDetails = async () => {
            try {
                const token = localStorage.getItem("token");
                if (!token || !user?.userid) return;

                const response = await fetch(`https://api.tutorl.ink/events`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log(data)
                    const event = data.events?.find(
                        (e: any) => e.eventid === parseInt(meetingId)
                    );
                    console.log(event)

                    if (event) {
                        console.log(event.userid_tutor.userid_tutor)
                        // Determine if user is tutor or tutee
                        if (event.userid_tutor.userid_tutor === user.userid) {
                            setUserRole("tutor");
                        } else if (event.userid_tutee === user.userid) {
                            setUserRole("tutee");
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching event details:", error);
            }
        };

        fetchEventDetails();
    }, [meetingId, user?.userid]);

    // Initialize Socket.IO
    useEffect(() => {
        const socket = io("https://api.tutorl.ink");
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Connected to server");
            setIsConnected(true);
            socket.emit("join", { eid: meetingId });
        });

        socket.on("joined", (data: { room: string; member_count: number }) => {
            console.log(`Joined room ${data.room}`);
            setMemberCount(data.member_count);
        });

        socket.on("user-joined", (data: { member_count: number }) => {
            console.log("Another user joined");
            setMemberCount(data.member_count);
            
            // Clear recorded chunks to sync recordings when someone joins
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
                recordedChunksRef.current = [];
                console.log("Cleared recording cache for sync");
            }
        });

        socket.on("user-left", (data: { member_count: number }) => {
            console.log("A user left");
            setMemberCount(data.member_count);
        });

        socket.on("error", (data: { message: string }) => {
            console.error("Socket error:", data.message);
            setError(data.message);
        });

        socket.on("peer-ready", () => {
            console.log("Another peer is ready");
            if (!localStreamRef.current) setShouldStartCall(true);
        });

        socket.on("offer", async (data: { sdp: string; type: RTCSdpType }) => {
            console.log("Received offer from remote peer");
            await handleOffer(data);
        });

        socket.on("answer", async (data: { sdp: string; type: RTCSdpType }) => {
            console.log("Received answer from remote peer");
            await handleAnswer(data);
        });

        socket.on(
            "ice-candidate",
            async (data: {
                candidate: string;
                sdpMLineIndex: number;
                sdpMid: string;
            }) => {
                console.log("Received ICE candidate");
                await handleIceCandidate(data);
            },
        );

        return () => {
            if (localStreamRef.current)
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            if (screenStreamRef.current)
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
            if (pcRef.current) pcRef.current.close();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
                try { mediaRecorderRef.current.requestData(); } catch {}
                mediaRecorderRef.current.stop();
            }
            socket.disconnect();
        };
    }, [meetingId]);

    // Centralized offer-answer function
    const runOfferAnswer = async () => {
        const pc = pcRef.current;
        if (!pc || !socketRef.current) return;

        try {
            if (makingOfferRef.current || pc.signalingState !== "stable")
                return;
            makingOfferRef.current = true;

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socketRef.current.emit("offer", {
                sdp: pc.localDescription!.sdp,
                type: pc.localDescription!.type,
            });
            console.log("[Renegotiation] Offer sent");

            makingOfferRef.current = false;
        } catch (err) {
            console.error("[Renegotiation] Error:", err);
            makingOfferRef.current = false;
        }
    };

    // Get user media
    useEffect(() => {
        if (!shouldStartCall || localStreamRef.current) return;

        let mounted = true;

        const getUserMedia = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true,
                });
                if (!mounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }
                localStreamRef.current = stream;
                if (localVideoRef.current)
                    localVideoRef.current.srcObject = stream;
                setIsCallActive(true);
                isOfferCreatorRef.current = true;

                createPeerConnection(stream);
                startClientRecording(stream);
            } catch (err) {
                console.error("Error accessing media devices:", err);
                setError("Failed to access camera/microphone");
                setShouldStartCall(false);
            }
        };

        getUserMedia();

        return () => {
            mounted = false;
        };
    }, [shouldStartCall]);

    // Create single peer connection
    const createPeerConnection = (stream: MediaStream) => {
        if (pcRef.current) return;

        const pc = new RTCPeerConnection(configuration);
        pcRef.current = pc;

        // ICE candidates
        pc.addEventListener("icecandidate", (e) => {
            if (e.candidate && socketRef.current) {
                socketRef.current.emit("ice-candidate", {
                    candidate: e.candidate.candidate,
                    sdpMLineIndex: e.candidate.sdpMLineIndex,
                    sdpMid: e.candidate.sdpMid,
                });
            }
        });

        // Remote track
        pc.addEventListener("track", (e) => {
            if (remoteVideoRef.current && e.streams[0]) {
                remoteVideoRef.current.srcObject = e.streams[0];
            }
        });

        // Add local tracks
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Negotiation needed
        pc.addEventListener("negotiationneeded", async () => {
            if (!isOfferCreatorRef.current) return; // Only offerer triggers
            await runOfferAnswer();
        });
    };

    const handleOffer = async (data: { sdp: string; type: RTCSdpType }) => {
        try {
            if (!localStreamRef.current) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true,
                });
                localStreamRef.current = stream;
                if (localVideoRef.current)
                    localVideoRef.current.srcObject = stream;
                setIsCallActive(true);
                createPeerConnection(stream);
                startClientRecording(stream);
            }

            const pc = pcRef.current!;
            if (pc.signalingState !== "stable") {
                await pc.setLocalDescription({
                    type: "rollback",
                } as RTCSessionDescriptionInit);
            }

            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            if (socketRef.current) {
                socketRef.current.emit("answer", {
                    sdp: pc.localDescription!.sdp,
                    type: pc.localDescription!.type,
                });
            }
            console.log("Answer sent successfully");
        } catch (err) {
            console.error("Error handling offer:", err);
        }
    };

    const handleAnswer = async (data: { sdp: string; type: RTCSdpType }) => {
        try {
            const pc = pcRef.current;
            if (pc && pc.signalingState !== "stable") {
                await pc.setRemoteDescription(new RTCSessionDescription(data));
            }
        } catch (err) {
            console.error("Error handling answer:", err);
        }
    };

    const handleIceCandidate = async (data: {
        candidate: string;
        sdpMLineIndex: number;
        sdpMid: string;
    }) => {
        try {
            const candidate = new RTCIceCandidate(data);
            if (pcRef.current && pcRef.current.remoteDescription) {
                await pcRef.current.addIceCandidate(candidate);
            }
        } catch (err) {
            console.error("Error adding ICE candidate:", err);
        }
    };

    // ============= Client-Side Recording Functions =============

    const getSupportedMimeType = (): string => {
        // Prioritize H.264 MP4 formats (most compatible)
        const possibleTypes = [
            'video/mp4;codecs=avc1.42E01E,mp4a.40.2',  // H.264 Baseline, AAC-LC (most compatible)
            'video/mp4;codecs=avc1.4D401E,mp4a.40.2',  // H.264 Main, AAC-LC
            'video/mp4;codecs=avc1.64001E,mp4a.40.2',  // H.264 High, AAC-LC
            'video/mp4;codecs=h264,aac',               // Generic H.264/AAC
            'video/mp4',                                // Plain MP4 (let browser decide codecs)
            'video/x-matroska;codecs=avc1,opus',       // MKV with H.264 (rare but possible)
        ];
        
        for (const type of possibleTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                console.log(`Using MIME type: ${type}`);
                return type;
            }
        }
        
        console.warn('No H.264/MP4 MIME type supported. Recording will use browser default (likely WebM).');
        return '';
    };

    const startClientRecording = (stream: MediaStream) => {
        try {
            recordedChunksRef.current = [];
            
            const mimeType = getSupportedMimeType();
            const options: MediaRecorderOptions = mimeType ? { mimeType } : {};
            
            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            
            mediaRecorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    recordedChunksRef.current.push(event.data);
                    console.log(`Recorded chunk: ${event.data.size} bytes`);
                }
            };
            
            mediaRecorder.onstop = async () => {
                console.log('Recording stopped, uploading...');
                await new Promise(resolve => setTimeout(resolve, 500));
                await uploadRecording();
            };
            
            mediaRecorder.onerror = (event: Event) => {
                console.error('MediaRecorder error:', event);
                setError('Recording error occurred');
            };
            
            // Start recording with 1-second chunks
            mediaRecorder.start(1000);
            console.log(`Started client-side recording with MIME type: ${mimeType || 'default'}`);
            
        } catch (err) {
            console.error('Error starting client recording:', err);
            setError('Failed to start recording');
        }
    };

    const uploadRecording = async () => {
        try {
            if (recordedChunksRef.current.length === 0) {
                console.warn('No recorded chunks to upload');
                return;
            }
            
            const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
            const blob = new Blob(recordedChunksRef.current, { type: mimeType });
            
            console.log(`Uploading recording: ${blob.size} bytes, type: ${blob.type}`);
            
            // Create form data
            const formData = new FormData();
            formData.append('video', blob, `recording.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`);
            formData.append('meeting_id', meetingId);
            formData.append('participant_id', (user?.userid?.toString() || socketRef.current?.id || 'unknown'));
            
            // Upload to server (configurable base URL)
            const response = await fetch(`https://api.tutorl.ink/api/recordings/upload`, {
                method: 'POST',
                body: formData,
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Recording uploaded successfully:', data);
            } else {
                const errorData = await response.json();
                console.error('Upload failed:', errorData);
                setError('Failed to upload recording');
            }
            
            // Clear recorded chunks
            recordedChunksRef.current = [];
            
        } catch (err) {
            console.error('Error uploading recording:', err);
            setError('Failed to upload recording');
        }
    };

    // Screen sharing
    useEffect(() => {
        if (!shouldShareScreen || !isCallActive) return;

        let mounted = true;
        const startScreenShare = async () => {
            try {
                const screenStream =
                    await navigator.mediaDevices.getDisplayMedia({
                        video: true,
                    });
                if (!mounted) {
                    screenStream.getTracks().forEach((t) => t.stop());
                    return;
                }
                screenStreamRef.current = screenStream;

                const pc = pcRef.current!;
                const videoSender = pc
                    .getSenders()
                    .find((s) => s.track?.kind === "video");
                if (!videoSender) {
                    setError("No video sender found");
                    return;
                }

                const screenTrack = screenStream.getVideoTracks()[0];
                await videoSender.replaceTrack(screenTrack);

                if (localVideoRef.current)
                    localVideoRef.current.srcObject = screenStream;
                setIsScreenSharing(true);

                // Trigger renegotiation for both participants
                await new Promise((res) => setTimeout(res, 50));
                await runOfferAnswer();

                // Stop screen share
                screenTrack.onended = async () => {
                    if (!mounted) return;
                    const cameraTrack =
                        localStreamRef.current?.getVideoTracks()[0];
                    if (cameraTrack)
                        await videoSender.replaceTrack(cameraTrack);
                    if (localVideoRef.current)
                        localVideoRef.current.srcObject =
                            localStreamRef.current;
                    setIsScreenSharing(false);
                    setShouldShareScreen(false);
                    if (screenStreamRef.current)
                        screenStreamRef.current
                            .getTracks()
                            .forEach((t) => t.stop());
                    screenStreamRef.current = null;

                    // Renegotiate back to camera
                    await new Promise((res) => setTimeout(res, 50));
                    await runOfferAnswer();
                };
            } catch (err) {
                console.error("Error sharing screen:", err);
                setError("Failed to share screen");
                setShouldShareScreen(false);
            }
        };

        startScreenShare();

        return () => {
            mounted = false;
            if (screenStreamRef.current)
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
        };
    }, [shouldShareScreen, isCallActive]);

    const handleStart = () => setShouldStartCall(true);
    const handleShareScreen = () => setShouldShareScreen(true);

    const handleHangup = () => {
        // Stop recording before cleanup
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            try { mediaRecorderRef.current.requestData(); } catch {}
            mediaRecorderRef.current.stop();
        }
        
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((t) => t.stop());
            screenStreamRef.current = null;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        setIsCallActive(false);
        setIsScreenSharing(false);
    };

    return (
        <div className="relative flex h-[calc(100vh-64px)] w-full flex-row bg-(--background) text-(--off-white)">
            {/* Video container */}
            <div className="relative z-0 mx-8 my-6 h-[80vh] w-full overflow-hidden rounded-xl bg-black">
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-contain"
                />
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute right-6 bottom-6 h-40 w-52 rounded-lg border-2 border-white object-cover shadow-lg"
                />

                {!isCallActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                        <div className="text-center">
                            <h2 className="mb-2 text-xl font-semibold">
                                Ready to start?
                            </h2>
                            <p className="text-(--light-gray)">
                                {memberCount === 1
                                    ? "Waiting for other participant..."
                                    : "Click Start to begin"}
                            </p>
                        </div>
                    </div>
                )}

                {/* Controls */}
                <div className="absolute bottom-0 z-10 flex w-full justify-center gap-4 px-8 pb-8">
                    <button
                        onClick={handleStart}
                        disabled={isCallActive}
                        className="cursor-pointer rounded-lg bg-green-600 px-6 py-1.5 font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
                    >
                        {isCallActive ? "Call Active" : "Start Call"}
                    </button>
                    <button
                        onClick={handleShareScreen}
                        disabled={!isCallActive}
                        className="cursor-pointer rounded-lg border-2 border-blue-600 bg-blue-600/65 px-6 py-1.5 font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
                    >
                        {isScreenSharing ? "Sharing Screen" : "Share Screen"}
                    </button>
                    <button
                        onClick={handleHangup}
                        disabled={!isCallActive}
                        className="cursor-pointer rounded-lg border-2 border-red-600 bg-red-600/65 px-6 py-1.5 font-semibold text-white transition-all hover:scale-105 disabled:opacity-50"
                    >
                        Hang Up
                    </button>
                </div>
            </div>

            {/* Sidebar */}
            <div className="flex h-full w-1/4 shrink-0 flex-col border-b border-(--primary-border-color) bg-zinc-900">
                {/* Meeting Info Section */}
                <div className="border-b border-gray-700 px-8 py-4">
                    <h1 className="text-2xl font-semibold">Tutoring Session</h1>
                    <p className="text-sm text-(--light-gray)">
                        Meeting ID: {meetingId}
                    </p>
                    <p className="text-sm text-(--light-gray)">
                        Participants: {memberCount}/2
                    </p>
                    <div className="flex items-center gap-2">
                        <div
                            className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
                        />
                        <span className="text-sm text-(--light-gray)">
                            {isConnected ? "Connected" : "Disconnected"}
                        </span>
                    </div>

                    {error && (
                        <div className="mt-4 rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-red-500">
                            {error}
                        </div>
                    )}
                </div>

                {/* Chat Component */}
                <div className="flex-1 overflow-hidden">
                    <Chat
                        socket={socketRef.current}
                        eventid={meetingId}
                        userRole={userRole}
                    />
                </div>
            </div>
        </div>
    );
}