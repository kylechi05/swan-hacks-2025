"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";

export default function MeetingPage() {
    const params = useParams();
    const meetingId = params.id as string;

    const [isConnected, setIsConnected] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [shouldStartCall, setShouldStartCall] = useState(false);
    const [shouldShareScreen, setShouldShareScreen] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const recorderPcRef = useRef<RTCPeerConnection | null>(null); // Separate PC for server recording
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

        socket.on("recorder-answer", async (data: { sdp: string; type: RTCSdpType }) => {
            console.log("Received recorder answer from server");
            await handleRecorderAnswer(data);
        });

        return () => {
            if (localStreamRef.current)
                localStreamRef.current.getTracks().forEach((t) => t.stop());
            if (screenStreamRef.current)
                screenStreamRef.current.getTracks().forEach((t) => t.stop());
            if (pcRef.current) pcRef.current.close();
            if (recorderPcRef.current) recorderPcRef.current.close();
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
                
                // Create separate peer connection for server recording
                createRecorderPeerConnection(stream);
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
                
                // Create separate peer connection for server recording
                createRecorderPeerConnection(stream);
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

    // ============= Server Recording Functions =============

    const createRecorderPeerConnection = (stream: MediaStream) => {
        if (recorderPcRef.current) return;

        const recorderPc = new RTCPeerConnection(configuration);
        recorderPcRef.current = recorderPc;

        // ICE candidates for recorder connection
        recorderPc.addEventListener("icecandidate", (e) => {
            if (e.candidate && socketRef.current) {
                socketRef.current.emit("recorder-ice-candidate", {
                    candidate: e.candidate.candidate,
                    sdpMLineIndex: e.candidate.sdpMLineIndex,
                    sdpMid: e.candidate.sdpMid,
                });
            }
        });

        // Add local tracks to recorder
        stream.getTracks().forEach((track) => {
            recorderPc.addTrack(track, stream);
            console.log(`Added ${track.kind} track to recorder peer connection`);
        });

        // Create and send offer to server
        recorderPc.createOffer().then((offer) => {
            return recorderPc.setLocalDescription(offer);
        }).then(() => {
            if (socketRef.current) {
                socketRef.current.emit("recorder-offer", {
                    sdp: recorderPc.localDescription!.sdp,
                    type: recorderPc.localDescription!.type,
                });
                console.log("Sent recorder offer to server");
            }
        }).catch((err) => {
            console.error("Error creating recorder offer:", err);
        });
    };

    const handleRecorderAnswer = async (data: { sdp: string; type: RTCSdpType }) => {
        try {
            const recorderPc = recorderPcRef.current;
            if (recorderPc && recorderPc.signalingState !== "stable") {
                await recorderPc.setRemoteDescription(new RTCSessionDescription(data));
                console.log("Server recording connection established");
            }
        } catch (err) {
            console.error("Error handling recorder answer:", err);
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
                        video: { cursor: "always" },
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
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }
        if (recorderPcRef.current) {
            recorderPcRef.current.close();
            recorderPcRef.current = null;
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
            <div className="flex h-full w-1/4 shrink-0 flex-col border-b border-(--primary-border-color) bg-zinc-900 px-8 py-4">
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
        </div>
    );
}8