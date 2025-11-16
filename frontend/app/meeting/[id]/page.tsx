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
    const pc1Ref = useRef<RTCPeerConnection | null>(null);
    const pc2Ref = useRef<RTCPeerConnection | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);
    const isOfferCreatorRef = useRef<boolean>(false);
    const makingOfferRef = useRef<boolean>(false);
    const ignoreOfferRef = useRef<boolean>(false);

    const configuration: RTCConfiguration = {
        iceServers: [
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
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

    useEffect(() => {
        // Initialize socket connection
        const socket = io("https://api.tutorl.ink");
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("Connected to server");
            setIsConnected(true);
            socket.emit("join", { eid: meetingId });
        });

        socket.on("joined", (data: { room: string; member_count: number }) => {
            console.log(`Successfully joined room ${data.room}`);
            setMemberCount(data.member_count);
        });

        socket.on("user-joined", (data: { member_count: number }) => {
            console.log(`Another user joined`);
            setMemberCount(data.member_count);
        });

        socket.on("user-left", (data: { member_count: number }) => {
            console.log(`A user left`);
            setMemberCount(data.member_count);
        });

        socket.on("error", (data: { message: string }) => {
            console.error("Socket error:", data.message);
            setError(data.message);
        });

        socket.on("peer-ready", () => {
            console.log("Another peer is ready");
            if (!localStreamRef.current && !pc1Ref.current) {
                setShouldStartCall(true);
            }
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
            async (
                data: {
                    candidate: string;
                    sdpMLineIndex: number;
                    sdpMid: string;
                },
            ) => {
                console.log("Received ICE candidate");
                await handleIceCandidate(data);
            },
        );

        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach((track) =>
                    track.stop()
                );
            }
            if (screenStreamRef.current) {
                screenStreamRef.current.getTracks().forEach((track) =>
                    track.stop()
                );
            }
            if (pc1Ref.current) pc1Ref.current.close();
            if (pc2Ref.current) pc2Ref.current.close();
            socket.disconnect();
        };
    }, [meetingId]);

    // Centralized offer-answer exchange function
    const runOfferAnswer = async (pc: RTCPeerConnection) => {
        if (!socketRef.current) return;
        
        try {
            console.log("[Renegotiation] Starting offer-answer exchange");
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            
            socketRef.current.emit("offer", {
                sdp: pc.localDescription!.sdp,
                type: pc.localDescription!.type,
            });
            console.log("[Renegotiation] Offer sent");
        } catch (error) {
            console.error("[Renegotiation] Error during offer-answer:", error);
        }
    };

    // Effect to get user media when call starts
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
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                console.log("[Local Stream] Acquired media stream:", {
                    streamId: stream.id,
                    audioTracks: stream.getAudioTracks().map(t => ({ id: t.id, label: t.label, enabled: t.enabled })),
                    videoTracks: stream.getVideoTracks().map(t => ({ id: t.id, label: t.label, enabled: t.enabled }))
                });
                setIsCallActive(true);
                isOfferCreatorRef.current = true;
            } catch (error) {
                console.error("Error accessing media devices:", error);
                setError("Failed to access camera/microphone");
                setShouldStartCall(false);
            }
        };

        getUserMedia();

        return () => {
            mounted = false;
        };
    }, [shouldStartCall]);

    // Effect to create peer connection and send offer
    useEffect(() => {
        if (!isCallActive || !localStreamRef.current || !isOfferCreatorRef.current || pc1Ref.current) return;

        const createPeerConnection = async () => {
            try {
                pc1Ref.current = new RTCPeerConnection(configuration);

                pc1Ref.current.addEventListener("icecandidate", (e) => {
                    if (e.candidate && socketRef.current) {
                        socketRef.current.emit("ice-candidate", {
                            candidate: e.candidate.candidate,
                            sdpMLineIndex: e.candidate.sdpMLineIndex,
                            sdpMid: e.candidate.sdpMid,
                        });
                    }
                });

                pc1Ref.current.addEventListener("track", (e) => {
                    console.log("[PC1] Track received:", {
                        kind: e.track.kind,
                        id: e.track.id,
                        label: e.track.label,
                        enabled: e.track.enabled,
                        muted: e.track.muted,
                        readyState: e.track.readyState
                    });
                    if (remoteVideoRef.current && e.streams[0]) {
                        console.log("[PC1] Setting remote video stream:", {
                            streamId: e.streams[0].id,
                            tracks: e.streams[0].getTracks().map(t => ({ kind: t.kind, id: t.id, label: t.label }))
                        });
                        remoteVideoRef.current.srcObject = e.streams[0];
                    }
                });

                pc1Ref.current.addEventListener("negotiationneeded", async () => {
                    console.log("[PC1] Negotiation needed event fired");
                    try {
                        if (!pc1Ref.current || pc1Ref.current.signalingState === "closed") {
                            console.log("[PC1] Peer connection closed, skipping negotiation");
                            return;
                        }

                        // Prevent collisions during negotiation
                        if (makingOfferRef.current) {
                            console.log("[PC1] Already making an offer, skipping");
                            return;
                        }

                        makingOfferRef.current = true;
                        console.log("[PC1] Starting negotiation sequence");
                        await runOfferAnswer(pc1Ref.current);
                        makingOfferRef.current = false;
                        console.log("[PC1] Negotiation sequence complete");
                    } catch (error) {
                        console.error("[PC1] Error during renegotiation:", error);
                        makingOfferRef.current = false;
                    }
                });

                // Add local stream to peer connection
                if (localStreamRef.current) {
                    console.log("[PC1] Adding tracks to peer connection:");
                    localStreamRef.current.getTracks().forEach((track) => {
                        console.log(`[PC1] Adding ${track.kind} track:`, { id: track.id, label: track.label, enabled: track.enabled });
                        pc1Ref.current!.addTrack(track, localStreamRef.current!);
                    });
                }

                // Create and send initial offer
                const offer = await pc1Ref.current.createOffer({
                    offerToReceiveAudio: true,
                    offerToReceiveVideo: true,
                });
                await pc1Ref.current.setLocalDescription(offer);

                // Log what this peer connection is sending
                const senders = pc1Ref.current.getSenders();
                console.log("[PC1] Currently sending tracks:", senders.map(sender => ({
                    track: sender.track ? {
                        kind: sender.track.kind,
                        id: sender.track.id,
                        label: sender.track.label,
                        enabled: sender.track.enabled,
                        muted: sender.track.muted,
                        readyState: sender.track.readyState
                    } : null
                })));

                if (socketRef.current) {
                    socketRef.current.emit("offer", {
                        sdp: pc1Ref.current.localDescription!.sdp,
                        type: pc1Ref.current.localDescription!.type,
                    });
                }
                console.log("[PC1] Initial offer sent");
            } catch (error) {
                console.error("Error creating peer connection:", error);
                setError("Failed to establish connection");
            }
        };

        createPeerConnection();
    }, [isCallActive]);

    const handleOffer = async (data: { sdp: string; type: RTCSdpType }) => {
        try {
            console.log("[HandleOffer] Processing incoming offer");
            
            // Get local stream if we don't have it
            if (!localStreamRef.current) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true,
                });
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                console.log("[HandleOffer] Acquired media stream:", {
                    streamId: stream.id,
                    audioTracks: stream.getAudioTracks().map(t => ({ id: t.id, label: t.label, enabled: t.enabled })),
                    videoTracks: stream.getVideoTracks().map(t => ({ id: t.id, label: t.label, enabled: t.enabled }))
                });
                localStreamRef.current = stream;
                setIsCallActive(true);
            }

            // Create peer connection
            if (!pc2Ref.current) {
                console.log("[HandleOffer] Creating PC2 (answerer)");
                pc2Ref.current = new RTCPeerConnection(configuration);

                pc2Ref.current.addEventListener("icecandidate", (e) => {
                    if (e.candidate && socketRef.current) {
                        socketRef.current.emit("ice-candidate", {
                            candidate: e.candidate.candidate,
                            sdpMLineIndex: e.candidate.sdpMLineIndex,
                            sdpMid: e.candidate.sdpMid,
                        });
                    }
                });

                pc2Ref.current.addEventListener("track", (e) => {
                    console.log("[PC2] Track received:", {
                        kind: e.track.kind,
                        id: e.track.id,
                        label: e.track.label,
                        enabled: e.track.enabled,
                        muted: e.track.muted,
                        readyState: e.track.readyState
                    });
                    if (remoteVideoRef.current && e.streams[0]) {
                        console.log("[PC2] Setting remote video stream:", {
                            streamId: e.streams[0].id,
                            tracks: e.streams[0].getTracks().map(t => ({ kind: t.kind, id: t.id, label: t.label }))
                        });
                        remoteVideoRef.current.srcObject = e.streams[0];
                    }
                });

                // Add local stream
                if (localStreamRef.current) {
                    console.log("[PC2] Adding tracks to peer connection:");
                    localStreamRef.current.getTracks().forEach((track) => {
                        console.log(`[PC2] Adding ${track.kind} track:`, { id: track.id, label: track.label, enabled: track.enabled });
                        pc2Ref.current!.addTrack(
                            track,
                            localStreamRef.current!,
                        );
                    });
                }
            }

            // Handle the offer using proper sequence
            const offerCollision = pc2Ref.current.signalingState !== "stable";
            ignoreOfferRef.current = offerCollision;
            
            if (ignoreOfferRef.current) {
                console.log("[HandleOffer] Ignoring offer due to collision");
                return;
            }

            console.log("[HandleOffer] Setting remote description");
            await pc2Ref.current.setRemoteDescription(
                new RTCSessionDescription(data),
            );
            
            console.log("[HandleOffer] Creating answer");
            const answer = await pc2Ref.current.createAnswer();
            await pc2Ref.current.setLocalDescription(answer);

            // Log what this peer connection is sending
            const senders = pc2Ref.current.getSenders();
            console.log("[PC2] Currently sending tracks:", senders.map(sender => ({
                track: sender.track ? {
                    kind: sender.track.kind,
                    id: sender.track.id,
                    label: sender.track.label,
                    enabled: sender.track.enabled,
                    muted: sender.track.muted,
                    readyState: sender.track.readyState
                } : null
            })));

            console.log("[HandleOffer] Sending answer");
            if (socketRef.current) {
                socketRef.current.emit("answer", {
                    sdp: pc2Ref.current.localDescription!.sdp,
                    type: pc2Ref.current.localDescription!.type,
                });
            }
            console.log("[HandleOffer] Answer sent successfully");
        } catch (error) {
            console.error("Error handling offer:", error);
            setError("Failed to handle connection offer");
        }
    };

    const handleAnswer = async (data: { sdp: string; type: RTCSdpType }) => {
        try {
            console.log("[HandleAnswer] Processing answer");
            if (pc1Ref.current && pc1Ref.current.signalingState !== "stable") {
                await pc1Ref.current.setRemoteDescription(
                    new RTCSessionDescription(data),
                );
                console.log("[HandleAnswer] Remote description set successfully");
            } else {
                console.log("[HandleAnswer] Skipping - already in stable state or no PC");
            }
        } catch (error) {
            console.error("Error handling answer:", error);
        }
    };

    const handleIceCandidate = async (
        data: { candidate: string; sdpMLineIndex: number; sdpMid: string },
    ) => {
        try {
            const candidate = new RTCIceCandidate(data);

            if (pc1Ref.current && pc1Ref.current.remoteDescription) {
                await pc1Ref.current.addIceCandidate(candidate);
            } else if (pc2Ref.current && pc2Ref.current.remoteDescription) {
                await pc2Ref.current.addIceCandidate(candidate);
            }
        } catch (error) {
            console.error("Error adding ICE candidate:", error);
        }
    };

    // Effect to handle screen sharing
    useEffect(() => {
        if (!shouldShareScreen || !isCallActive) return;

        let mounted = true;
        let screenStream: MediaStream | null = null;

        const startScreenShare = async () => {
            try {
                console.log("Starting screen share...");
                screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: { cursor: "always" } as MediaTrackConstraints,
                    audio: false,
                });

                if (!mounted) {
                    screenStream.getTracks().forEach((track) => track.stop());
                    return;
                }

                screenStreamRef.current = screenStream;
                const screenTrack = screenStream.getVideoTracks()[0];
                console.log("[Screen Share] Got screen track:", {
                    id: screenTrack.id,
                    label: screenTrack.label,
                    enabled: screenTrack.enabled,
                    muted: screenTrack.muted,
                    readyState: screenTrack.readyState,
                    settings: screenTrack.getSettings()
                });

                // Find active peer connection and replace video track
                const pc = pc1Ref.current || pc2Ref.current;
                if (pc) {
                    const senders = pc.getSenders();
                    const videoSender = senders.find((sender) =>
                        sender.track?.kind === "video"
                    );
                    if (videoSender && localStreamRef.current) {
                        console.log("[Screen Share] Current video sender:", {
                            track: videoSender.track ? {
                                kind: videoSender.track.kind,
                                id: videoSender.track.id,
                                label: videoSender.track.label,
                                enabled: videoSender.track.enabled
                            } : null
                        });
                        console.log("[Screen Share] Replacing video track with screen share");

                        // Replace the track
                        await videoSender.replaceTrack(screenTrack);
                        console.log("[Screen Share] Track replaced. New track:", {
                            kind: screenTrack.kind,
                            id: screenTrack.id,
                            label: screenTrack.label
                        });

                        // The negotiationneeded event handler will automatically trigger renegotiation
                        console.log("[Screen Share] Track replaced, negotiationneeded will handle renegotiation");
                        
                        setIsScreenSharing(true);

                        // Show screen share in local video
                        if (localVideoRef.current) {
                            localVideoRef.current.srcObject = screenStream;
                        }

                        console.log("Screen share track replaced successfully");

                        // Handle screen share stop
                        screenTrack.onended = async () => {
                            if (!mounted) return;
                            
                            console.log("[Screen Share] Screen share ended, switching back to camera");
                            const cameraTrack = localStreamRef.current
                                ?.getVideoTracks()[0];
                            if (cameraTrack && videoSender) {
                                console.log("[Screen Share] Replacing with camera track:", {
                                    id: cameraTrack.id,
                                    label: cameraTrack.label,
                                    enabled: cameraTrack.enabled
                                });
                                await videoSender.replaceTrack(cameraTrack);

                                // The negotiationneeded event handler will automatically trigger renegotiation
                                console.log("[Screen Share] Camera track replaced, negotiationneeded will handle renegotiation");

                                if (
                                    localVideoRef.current && localStreamRef.current
                                ) {
                                    localVideoRef.current.srcObject =
                                        localStreamRef.current;
                                }
                                console.log("Switched back to camera");
                            }
                            setIsScreenSharing(false);
                            setShouldShareScreen(false);

                            // Stop screen stream tracks
                            if (screenStreamRef.current) {
                                screenStreamRef.current.getTracks().forEach(track => track.stop());
                                screenStreamRef.current = null;
                            }
                        };
                    } else {
                        console.error("Video sender not found or no local stream");
                        setError("Failed to find video track");
                        setShouldShareScreen(false);
                    }
                } else {
                    console.error("No active peer connection");
                    setError("No active connection");
                    setShouldShareScreen(false);
                }
            } catch (error) {
                console.error("Error sharing screen:", error);
                setError("Failed to share screen");
                setShouldShareScreen(false);
            }
        };

        startScreenShare();

        return () => {
            mounted = false;
            if (screenStream) {
                screenStream.getTracks().forEach((track) => track.stop());
            }
        };
    }, [shouldShareScreen, isCallActive]);

    const handleStart = () => {
        setShouldStartCall(true);
    };

    const handleShareScreen = () => {
        setShouldShareScreen(true);
    };

    const logCurrentSenders = () => {
        const pc = pc1Ref.current || pc2Ref.current;
        if (pc) {
            const senders = pc.getSenders();
            const pcName = pc1Ref.current ? 'PC1' : 'PC2';
            console.log(`[${pcName}] Active senders:`, senders.map(sender => ({
                track: sender.track ? {
                    kind: sender.track.kind,
                    id: sender.track.id,
                    label: sender.track.label,
                    enabled: sender.track.enabled,
                    muted: sender.track.muted,
                    readyState: sender.track.readyState
                } : null
            })));
        } else {
            console.log("[Debug] No active peer connection");
        }
    };

    // Expose logging function for debugging
    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).logCurrentSenders = logCurrentSenders;
            (window as any).pc1 = pc1Ref;
            (window as any).pc2 = pc2Ref;
        }
    }, []);

    const handleHangup = () => {
        // Close peer connections
        if (pc1Ref.current) {
            pc1Ref.current.close();
            pc1Ref.current = null;
        }
        if (pc2Ref.current) {
            pc2Ref.current.close();
            pc2Ref.current = null;
        }

        // Stop all tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) =>
                track.stop()
            );
            screenStreamRef.current = null;
        }

        // Clear video elements
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        setIsCallActive(false);
        setIsScreenSharing(false);
    };

    return (
        <div className="min-h-screen bg-(--background) text-(--off-white)">
            {/* Header */}
            <div className="border-b border-(--primary-border-color) bg-zinc-900 px-8 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold">
                            Tutoring Session
                        </h1>
                        <p className="text-sm text-(--light-gray)">
                            Meeting ID: {meetingId}
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div
                                className={`h-2 w-2 rounded-full ${
                                    isConnected ? "bg-green-500" : "bg-red-500"
                                }`}
                            />
                            <span className="text-sm text-(--light-gray)">
                                {isConnected ? "Connected" : "Disconnected"}
                            </span>
                        </div>
                        <div className="text-sm text-(--light-gray)">
                            Participants: {memberCount}/2
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mx-8 mt-4 rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-red-500">
                    {error}
                </div>
            )}

            {/* Video Container */}
            <div className="relative mx-8 my-6 h-[80vh] overflow-hidden rounded-xl bg-black">
                {/* Remote Video (main view) */}
                <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-contain"
                />

                {/* Local Video (picture-in-picture) */}
                <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute bottom-6 right-6 h-40 w-52 rounded-lg border-2 border-white object-cover shadow-lg"
                />

                {/* Waiting message */}
                {!isCallActive && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                        <div className="text-center">
                            <h2 className="mb-2 text-xl font-semibold">
                                Ready to start?
                            </h2>
                            <p className="text-(--light-gray)">
                                {memberCount === 1
                                    ? "Waiting for other participant to join..."
                                    : "Click Start to begin the session"}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4 px-8 pb-8">
                <button
                    onClick={handleStart}
                    disabled={isCallActive}
                    className="rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-all hover:scale-105 hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-green-600"
                >
                    {isCallActive ? "Call Active" : "Start Call"}
                </button>

                <button
                    onClick={handleShareScreen}
                    disabled={!isCallActive}
                    className="rounded-lg border-2 border-blue-600 bg-blue-600/20 px-6 py-3 font-semibold text-white transition-all hover:scale-105 hover:border-blue-500 hover:bg-blue-600/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                    {isScreenSharing ? "Sharing Screen" : "Share Screen"}
                </button>

                <button
                    onClick={handleHangup}
                    disabled={!isCallActive}
                    className="rounded-lg border-2 border-red-600 bg-red-600/20 px-6 py-3 font-semibold text-white transition-all hover:scale-105 hover:border-red-500 hover:bg-red-600/30 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                    Hang Up
                </button>
            </div>
        </div>
    );
}