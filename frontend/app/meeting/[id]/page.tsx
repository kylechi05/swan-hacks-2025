"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import VideoPlayer from "@/app/components/VideoPlayer";

export default function MeetingPage() {
    const params = useParams();
    const meetingId = params.id as string;

    const [isConnected, setIsConnected] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const [isCallActive, setIsCallActive] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [myStream, setMyStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isAudioMute, setIsAudioMute] = useState(false);

    const socketRef = useRef<Socket | null>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pc1Ref = useRef<RTCPeerConnection | null>(null);
    const pc2Ref = useRef<RTCPeerConnection | null>(null);
    const screenStreamRef = useRef<MediaStream | null>(null);

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
                handleStart();
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
            if (pc1Ref.current) pc1Ref.current.close();
            if (pc2Ref.current) pc2Ref.current.close();
            socket.disconnect();
        };
    }, [meetingId]);

    const handleOffer = async (data: { sdp: string; type: RTCSdpType }) => {
        try {
            // Get local stream if we don't have it
            if (!localStreamRef.current) {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: true,
                });
                localStreamRef.current = stream;
                setMyStream(stream);
                setIsCallActive(true);
            }

            // Create peer connection if needed
            if (!pc2Ref.current) {
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
                    console.log("Track received:", e.track.kind);
                    if (e.streams[0]) {
                        console.log("Setting remote video stream");
                        setRemoteStream(e.streams[0]);
                    }
                });

                pc2Ref.current.addEventListener("negotiationneeded", async () => {
                    console.log("Negotiation needed on pc2 (answerer side) - waiting for offer");
                    // Don't create offers when we're the answerer
                    // The remote peer will send us a new offer which we'll handle in handleOffer
                });

                // Add local stream
                if (localStreamRef.current) {
                    localStreamRef.current.getTracks().forEach((track) => {
                        pc2Ref.current!.addTrack(
                            track,
                            localStreamRef.current!,
                        );
                    });
                }
            }

            // Handle the offer - works for both initial connection and renegotiation
            if (pc2Ref.current) {
                // Check if we can set remote description
                const validStates = ["stable", "have-remote-offer"];
                if (validStates.includes(pc2Ref.current.signalingState)) {
                    console.log(`Setting remote offer in state: ${pc2Ref.current.signalingState}`);
                    await pc2Ref.current.setRemoteDescription(
                        new RTCSessionDescription(data),
                    );
                    const answer = await pc2Ref.current.createAnswer();
                    await pc2Ref.current.setLocalDescription(answer);

                    if (socketRef.current) {
                        socketRef.current.emit("answer", {
                            sdp: pc2Ref.current.localDescription!.sdp,
                            type: pc2Ref.current.localDescription!.type,
                        });
                    }
                    console.log("Successfully handled offer and sent answer");
                } else {
                    console.warn(
                        `Cannot set remote offer in state ${pc2Ref.current.signalingState}, will retry`,
                    );
                    // If we're in have-local-offer state, we need to do rollback
                    if (pc2Ref.current.signalingState === "have-local-offer") {
                        await pc2Ref.current.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
                        // Now retry setting the remote offer
                        await pc2Ref.current.setRemoteDescription(
                            new RTCSessionDescription(data),
                        );
                        const answer = await pc2Ref.current.createAnswer();
                        await pc2Ref.current.setLocalDescription(answer);

                        if (socketRef.current) {
                            socketRef.current.emit("answer", {
                                sdp: pc2Ref.current.localDescription!.sdp,
                                type: pc2Ref.current.localDescription!.type,
                            });
                        }
                        console.log("Successfully handled offer after rollback");
                    }
                }
            }
        } catch (error) {
            console.error("Error handling offer:", error);
            setError("Failed to handle connection offer");
        }
    };

    const handleAnswer = async (data: { sdp: string; type: RTCSdpType }) => {
        try {
            if (pc1Ref.current) {
                // Check if we're in a valid state to receive an answer
                if (pc1Ref.current.signalingState === "have-local-offer") {
                    await pc1Ref.current.setRemoteDescription(
                        new RTCSessionDescription(data),
                    );
                    console.log("Successfully set remote answer");
                } else {
                    console.warn(
                        `Cannot set remote answer in state ${pc1Ref.current.signalingState}`,
                    );
                }
            }
        } catch (error) {
            console.error("Error handling answer:", error);
            setError("Failed to establish connection");
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

    const handleStart = async () => {
        try {
            // Get local stream
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
            });
            localStreamRef.current = stream;
            setMyStream(stream);
            setIsCallActive(true);

            // Create peer connection
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
                console.log("Track received:", e.track.kind);
                if (e.streams[0]) {
                    console.log("Setting remote video stream");
                    setRemoteStream(e.streams[0]);
                }
            });

            pc1Ref.current.addEventListener("negotiationneeded", async () => {
                console.log("Negotiation needed, creating new offer");
                try {
                    const offer = await pc1Ref.current!.createOffer();
                    await pc1Ref.current!.setLocalDescription(offer);
                    if (socketRef.current) {
                        socketRef.current.emit("offer", {
                            sdp: pc1Ref.current!.localDescription!.sdp,
                            type: pc1Ref.current!.localDescription!.type,
                        });
                    }
                } catch (error) {
                    console.error("Error during renegotiation:", error);
                }
            });

            // Add local stream to peer connection
            stream.getTracks().forEach((track) => {
                pc1Ref.current!.addTrack(track, stream);
            });

            // Create and send offer
            const offer = await pc1Ref.current.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
            });
            await pc1Ref.current.setLocalDescription(offer);

            if (socketRef.current) {
                socketRef.current.emit("offer", {
                    sdp: pc1Ref.current.localDescription!.sdp,
                    type: pc1Ref.current.localDescription!.type,
                });
            }
        } catch (error) {
            console.error("Error starting call:", error);
            setError("Failed to access camera/microphone");
            setIsCallActive(false);
        }
    };

    const handleShareScreen = async () => {
        try {
            console.log("Starting screen share...");
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: "always" } as MediaTrackConstraints,
                audio: false,
            });

            screenStreamRef.current = screenStream;
            const screenTrack = screenStream.getVideoTracks()[0];
            console.log("Got screen track:", screenTrack.id);

            // Find active peer connection and replace video track
            const pc = pc1Ref.current || pc2Ref.current;
            if (pc) {
                const senders = pc.getSenders();
                const videoSender = senders.find((sender) =>
                    sender.track?.kind === "video"
                );

                if (videoSender && localStreamRef.current) {
                    console.log("Replacing video track with screen share");
                    const oldTrack = videoSender.track;
                    
                    // Replace the track
                    await videoSender.replaceTrack(screenTrack);
                    
                    // Stop the old camera track
                    if (oldTrack) {
                        oldTrack.stop();
                    }
                    
                    setIsScreenSharing(true);

                    // Show screen share in local video
                    setMyStream(screenStream);

                    console.log("Screen share track replaced successfully");

                    // Handle screen share stop
                    screenTrack.onended = async () => {
                        console.log("Screen share ended, switching back to camera");
                        try {
                            // Get a fresh camera stream
                            const newCameraStream = await navigator.mediaDevices.getUserMedia({
                                audio: true,
                                video: true,
                            });
                            
                            const newVideoTrack = newCameraStream.getVideoTracks()[0];
                            const newAudioTrack = newCameraStream.getAudioTracks()[0];
                            
                            // Update local stream ref
                            localStreamRef.current = newCameraStream;
                            
                            // Replace video track
                            if (videoSender) {
                                await videoSender.replaceTrack(newVideoTrack);
                            }
                            
                            // Also replace audio track if it exists
                            const audioSender = pc.getSenders().find(s => s.track?.kind === "audio");
                            if (audioSender) {
                                await audioSender.replaceTrack(newAudioTrack);
                            }
                            
                            setMyStream(newCameraStream);
                            console.log("Switched back to camera");
                        } catch (err) {
                            console.error("Error switching back to camera:", err);
                        }
                        
                        setIsScreenSharing(false);
                        
                        // Stop screen stream tracks
                        if (screenStreamRef.current) {
                            screenStreamRef.current.getTracks().forEach(track => track.stop());
                            screenStreamRef.current = null;
                        }
                    };
                } else {
                    console.error("Video sender not found or no local stream");
                    setError("Failed to find video track");
                }
            } else {
                console.error("No active peer connection");
                setError("No active connection");
            }
        } catch (error) {
            console.error("Error sharing screen:", error);
            setError("Failed to share screen");
        }
    };

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

        // Clear state
        setMyStream(null);
        setRemoteStream(null);
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
                {remoteStream && (
                    <VideoPlayer 
                        stream={remoteStream} 
                        name="Remote Stream" 
                        isAudioMute={isAudioMute}
                    />
                )}

                {/* Local Video (picture-in-picture) */}
                {myStream && (
                    <VideoPlayer 
                        stream={myStream} 
                        name="My Stream" 
                        isAudioMute={isAudioMute}
                    />
                )}

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
