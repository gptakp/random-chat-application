import { useEffect, useRef, useState } from "react";
import Peer from "simple-peer";
import { Button } from 'antd';
import { PhoneOutlined } from '@ant-design/icons'; // Importing the phone icon
import React from "react";

function Video1({ socket, user, partner, videoCallVisible, setVideoCallVisible }: any) {
    const [me, setMe] = useState<string>("");
    const [stream, setStream] = useState<MediaStream | undefined>(undefined);
    const [receivingCall, setReceivingCall] = useState(false);
    const [caller, setCaller] = useState<string>("");
    const [callerSignal, setCallerSignal] = useState<any>();
    const [callAccepted, setCallAccepted] = useState(false);
    const [idToCall, setIdToCall] = useState("");
    const [callEnded, setCallEnded] = useState(false);
    const [name, setName] = useState("");
    const [isRinging, setIsRinging] = useState(false); // New state for ringing
    const myVideo = useRef<HTMLVideoElement | null>(null);
    const userVideo = useRef<HTMLVideoElement | null>(null);
    const connectionRef = useRef<Peer | null>(null);
    const [videoEnabled, setVideoEnabled] = useState(true);
    const [audioEnabled, setAudioEnabled] = useState(true);

    useEffect(() => {
        const getMedia = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setStream(mediaStream);
                if (myVideo.current) {
                    myVideo.current.srcObject = mediaStream;
                }
            } catch (err) {
                console.error("Error accessing media devices.", err);
            }
        };

        getMedia();

        socket.on("me", (id: string) => setMe(id));

        socket.on("callUser", (data: { from: string, name: any, signal: any }) => {
            setReceivingCall(true);
            setCaller(data.from);
            setName(data.name?.partner ?? 'User');
            setCallerSignal(data.signal);
        });

        socket.on("missedCall", (data: { from: string, to: string, name: string }) => {
            // Logic to handle missed call notification on this user
            console.log(${data.name} missed your call.);
        });

        return () => {
            socket.off("me");
            socket.off("callUser");
            socket.off("missedCall");
        };
    }, [socket]);

    const callUser = () => {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: stream,
        });

        peer.on("signal", (data: any) => {
            setIsRinging(true); // Set ringing state to true
            socket.emit("callUser", {
                userToCall: partner,
                signalData: data,
                from: me,
                name: user,
            });
        });

        peer.on("stream", (incomingStream: MediaStream) => {
            if (userVideo.current) {
                userVideo.current.srcObject = incomingStream;
            }
        });

        socket.on("callAccepted", (signal: any) => {
            setCallAccepted(true);
            setIsRinging(false); // Stop ringing when call is accepted
            peer.signal(signal);
        });

        connectionRef.current = peer;
    };

    const answerCall = () => {
        setCallAccepted(true);
        setIsRinging(false); // Stop ringing when call is answered
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: stream,
        });

        peer.on("signal", (data: any) => {
            socket.emit("answerCall", { signal: data, to: caller });
        });

        peer.on("stream", (incomingStream: MediaStream) => {
            if (userVideo.current) {
                userVideo.current.srcObject = incomingStream;
            }
        });

        peer.signal(callerSignal);

        connectionRef.current = peer;
    };

    const declineCall = () => {
        setReceivingCall(false);
        setIsRinging(false); // Stop ringing when declined
        socket.emit("missedCall", { from: me, to: caller, name: user }); // Emit missed call notification
    };

    const leaveCall = () => {
        setCallEnded(true);
        if (connectionRef.current) {
            connectionRef.current.destroy();
            connectionRef.current = null; // Reset connectionRef to avoid errors
        }
    };

    const toggleVideo = () => {
        if (stream) {
            const videoTrack = stream.getVideoTracks()[0];
            videoTrack.enabled = !videoTrack.enabled; // Toggle the track
            setVideoEnabled(videoTrack.enabled); // Update state
        }
    };

    const toggleAudio = () => {
        if (stream) {
            const audioTrack = stream.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled; // Toggle the track
            setAudioEnabled(audioTrack.enabled); // Update state
        }
    };


    return (
        <>
            <div className="container">
                <div className="video-container">
                    <div className="video">
                        {stream && <video playsInline muted ref={myVideo} autoPlay style={{ width: "100%", height: "auto", border: "1px solid black", display: ${(callAccepted && !callEnded) ? '' : 'none'} }} />}
                    </div>

                    <div className="video">
                        {callAccepted && !callEnded ? <video playsInline ref={userVideo} autoPlay style={{ width: "300px" }} /> : null}
                    </div>
                </div>
                <div className="controls">
                    <Button onClick={toggleVideo} style={{ margin: '5px' }}>
                        {videoEnabled ? "Disable Video" : "Enable Video"}
                    </Button>
                    <Button onClick={toggleAudio} style={{ margin: '5px' }}>
                        {audioEnabled ? "Mute Audio" : "Unmute Audio"}
                    </Button>
                </div>

                <div className="myId">
                    <div className="call-button">
                        {callAccepted && !callEnded ? (
                            <button onClick={leaveCall}>End Call</button>
                        ) : (
                            <></>
                        )}
                        {idToCall}
                    </div>
                </div>
                {/* Incoming Call Popup */}
                {receivingCall && !callAccepted && (
                    <div className="call-popup" style={{
                        width: '96%',
                        height: '150px',
                        backgroundColor: '#f8f9fa',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        padding: '10px',
                        position: 'relative',
                        marginTop: '10px',
                    }}>
                        <h1 style={{ margin: '10px 0' }}>{partner} is calling...</h1>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            width: '100%',
                        }}>
                            <Button
                                style={{
                                    backgroundColor: 'red',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    padding: '10px 15px',
                                    cursor: 'pointer',
                                    width: '80px',
                                    marginRight: '30px',
                                }}
                                onClick={declineCall}
                            >
                                Decline
                            </Button>

                            <Button
                                style={{
                                    backgroundColor: 'green',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '5px',
                                    padding: '10px 15px',
                                    cursor: 'pointer',
                                    width: '80px',
                                }}
                                onClick={answerCall}
                            >
                                Answer
                            </Button>
                        </div>
                    </div>
                )}
                {/* Ringing state UI */}
                {isRinging && !callAccepted && (
                    <div className="ringing-popup" style={{
                        width: '96%',
                        height: '150px',
                        backgroundColor: '#ffeb3b',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        padding: '10px',
                        position: 'relative',
                        marginTop: '10px',
                        textAlign: 'center',
                    }}>
                        <h1 style={{ margin: '10px 0' }}>Ringing...</h1>
                        <p>{partner} is being called</p>
                        <PhoneOutlined
                            style={{ fontSize: '40px', cursor: 'pointer', color: 'white', marginTop: '10px', transform: 'rotate(225deg)', background: 'red', borderRadius: '50%' }}
                            onClick={declineCall}
                        />
                    </div>
                )}
            </div>
            {videoCallVisible && (
                <div className="video-call-modal"
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: '#fff',
                        border: '1px solid #ccc',
                        borderRadius: '8px',
                        padding: '20px',
                        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1000,
                        width: '300px',
                    }}
                >
                    <h3> Start Video call </h3>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%',
                    }}>
                        <Button
                            style={{
                                backgroundColor: 'green',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '5px',
                                padding: '10px 15px',
                                cursor: 'pointer',
                                flex: '1',
                                marginRight: '5px',
                            }}
                            onClick={() => {
                                setVideoCallVisible(false);
                                callUser(); // Close modal after starting call
                            }}
                        >
                            Yes
                        </Button>

                        <Button
                            onClick={() => setVideoCallVisible(false)}  // Close the modal when clicked
                            style={{
                                backgroundColor: 'grey',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '5px',
                                padding: '10px 15px',
                                cursor: 'pointer',
                                flex: '1',
                            }}
                        >
                            No
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}

export default Video1;