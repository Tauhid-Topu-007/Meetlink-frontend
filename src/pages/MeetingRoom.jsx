import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  MessageSquare,
  Users,
  Hand,
  Lock,
  Unlock,
  Copy,
  Paperclip,
  Download,
  FileText,
  X,
  ClipboardList,
  Mail,
  StickyNote,
  Link2,
  Keyboard,
  LayoutGrid,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import { meetingApi, attendanceApi, chatApi, recordingApi } from '../api/client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:5000';

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuthStore();

  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [sidePanel, setSidePanel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenSharerId, setScreenSharerId] = useState(null); // socketId of active sharer
  const [locked, setLocked] = useState(false);
  const [waiting, setWaiting] = useState([]);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [spotlightId, setSpotlightId] = useState(null); // socketId pinned by host
  const [connectionOk, setConnectionOk] = useState(true);
  const [showReactions, setShowReactions] = useState(false);
  const [breakout, setBreakout] = useState(null); // { active, rooms, assignments, timerMinutes }
  const [myBreakout, setMyBreakout] = useState(null); // { breakoutRoomId, roomName, peers }
  const [boRoomCount, setBoRoomCount] = useState(2);
  const [boBroadcast, setBoBroadcast] = useState('');
  const [boTimer, setBoTimer] = useState(15);
  const [attendance, setAttendance] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [inviteEmails, setInviteEmails] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [notes, setNotes] = useState(() => localStorage.getItem(`meetlink_notes_${meetingId}`) || '');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const joinedAtRef = useRef(Date.now());
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const socketRef = useRef(null);
  const peersRef = useRef({});
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);
  const [remoteStreams, setRemoteStreams] = useState({});

  const myId = String(user?.id || user?._id || '');
  const hostIdStr = String(meeting?.hostId?._id || meeting?.hostId || '');
  const isHost =
    (myId && hostIdStr && myId === hostIdStr) ||
    participants.some(
      (p) => String(p.userId) === myId && (p.role === 'host' || p.role === 'co-host')
    );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep local <video> attached after layout switches (grid <-> screen stage)
  useEffect(() => {
    const el = localVideoRef.current;
    const stream = screenSharing
      ? el?.srcObject
      : localStreamRef.current;
    if (el && localStreamRef.current && !screenSharing) {
      el.srcObject = localStreamRef.current;
      el.play().catch(() => {});
    }
  }, [screenSharing, screenSharerId, remoteStreams]); // reattach-local

  useEffect(() => {
    joinedAtRef.current = Date.now();
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - joinedAtRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [meetingId]);

  useEffect(() => {
    localStorage.setItem(`meetlink_notes_${meetingId}`, notes);
  }, [notes, meetingId]);

  // Keyboard shortcuts for efficiency
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'm') { e.preventDefault(); toggleMute(); }
      if (k === 'v') { e.preventDefault(); toggleVideo(); }
      if (k === 'c') { e.preventDefault(); setSidePanel((p) => (p === 'chat' ? null : 'chat')); }
      if (k === 'p') { e.preventDefault(); setSidePanel((p) => (p === 'participants' ? null : 'participants')); }
      if (k === 'n') { e.preventDefault(); setSidePanel((p) => (p === 'notes' ? null : 'notes')); }
      if (k === 'h') { e.preventDefault(); toggleHand(); }
      if (k === '?') { e.preventDefault(); setShowShortcuts((s) => !s); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await meetingApi.get(meetingId);
        if (!mounted) return;
        setMeeting(data.meeting);
        setLocked(data.meeting.locked || false);

        // Ensure REST join with password when required (e.g. direct URL)
        try {
          const joinPassword = sessionStorage.getItem(`meetlink_pwd_${String(meetingId).toUpperCase()}`) || undefined;
          if (data.meeting?.hasPassword && joinPassword) {
            await meetingApi.join(meetingId, { password: joinPassword });
          }
        } catch (joinErr) {
          const msg = joinErr.response?.data?.message || '';
          if (joinErr.response?.status === 403 && msg.toLowerCase().includes('password')) {
            toast.error(msg || 'Password required or incorrect');
            navigate('/join/' + meetingId);
            return;
          }
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;

        const socket = io(SOCKET_URL, {
          auth: { token },
          transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          const joinPassword = sessionStorage.getItem(`meetlink_pwd_${String(meetingId).toUpperCase()}`) || undefined;
          socket.emit('meeting:join', { meetingId, password: joinPassword }, (res) => {
            if (!res?.success) {
              toast.error(res?.message || 'Failed to join');
              navigate('/dashboard');
              return;
            }
            if (res.needsApproval) {
              setPendingApproval(true);
              toast('Waiting for host approval…');
            } else {
              setPendingApproval(false);
              if (Array.isArray(res.waiting) && res.waiting.length) {
                setWaiting(res.waiting);
              }
            }
          });
        });

        socket.on('meeting:participants', (list) => {
          setParticipants(list);
          list.forEach((p) => {
            if (p.socketId !== socket.id) createPeer(p.socketId, true, stream, socket);
          });
        });

        socket.on('participant:joined', (p) => {
          setParticipants((prev) => [...prev.filter((x) => x.socketId !== p.socketId), p]);
          createPeer(p.socketId, false, stream, socket);
          toast.success(`${p.displayName} joined`);
        });

        socket.on('participant:left', ({ socketId }) => {
          setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
          if (peersRef.current[socketId]) {
            peersRef.current[socketId].destroy();
            delete peersRef.current[socketId];
          }
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[socketId];
            return next;
          });
        });

        socket.on('signal', ({ from, signal }) => {
          const peer = peersRef.current[from];
          if (peer) peer.signal(signal);
          else createPeer(from, false, stream, socket, signal);
        });

        socket.on('chat:message', (msg) => setMessages((prev) => [...prev, msg]));

        socket.on('meeting:locked', ({ locked: l }) => {
          setLocked(l);
          toast(l ? 'Meeting locked' : 'Meeting unlocked');
        });

        socket.on('meeting:ended', (payload) => {
          toast.success(payload?.endedBy ? `Meeting ended by ${payload.endedBy}` : 'Meeting ended');
          cleanup();
          navigate('/dashboard');
        });

        socket.on('host:muted-all', ({ by }) => {
          toast(`${by || 'Host'} muted all participants`);
        });

        socket.on('screen:share', ({ socketId, sharing, displayName }) => {
          if (sharing) {
            setScreenSharerId(socketId);
            if (socketId !== socket.id) {
              toast(`${displayName || 'Someone'} is sharing screen`);
            }
          } else {
            setScreenSharerId((cur) => (cur === socketId ? null : cur));
          }
        });

        socket.on('host:force-mute', () => {
          if (localStreamRef.current) {
            localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
            setMuted(true);
            toast('You were muted by the host');
          }
        });

        socket.on('host:force-video-off', () => {
          if (localStreamRef.current) {
            localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = false));
            setVideoOff(true);
          }
        });

        socket.on('host:removed', () => {
          toast.error('You were removed from the meeting');
          cleanup();
          navigate('/dashboard');
        });

        socket.on('breakout:updated', (data) => {
          setBreakout(data);
        });

        socket.on('breakout:joined', (data) => {
          setMyBreakout(data);
          setBreakout((b) => (b ? { ...b, active: true } : { active: true, rooms: [], assignments: {} }));
          // Reset mesh — only connect to breakout peers
          destroyAllPeers();
          setParticipants(
            (data.peers || []).map((p) => ({
              socketId: p.socketId,
              userId: p.userId,
              displayName: p.displayName,
              role: 'participant',
            }))
          );
          const stream = localStreamRef.current;
          (data.peers || []).forEach((p) => {
            if (p.socketId !== socket.id && stream) {
              createPeer(p.socketId, true, stream, socket);
            }
          });
          toast.success(`Joined ${data.roomName || 'breakout room'}`);
        });

        socket.on('breakout:opened', (data) => {
          setBreakout((b) => ({
            ...(b || {}),
            active: true,
            rooms: data.rooms || b?.rooms || [],
            assignments: data.assignments || b?.assignments || {},
            timerMinutes: data.timerMinutes,
          }));
          toast('Breakout rooms opened');
        });

        socket.on('breakout:closed', () => {
          setMyBreakout(null);
          destroyAllPeers();
          toast('Breakout rooms closed — returning to main session');
          // Rejoin main mesh: request fresh participant list by re-emitting join is heavy;
          // host/others will get participant:joined as people return — emit breakout:rejoin-main
          const joinPassword = sessionStorage.getItem(`meetlink_pwd_${String(meetingId).toUpperCase()}`) || undefined;
          socket.emit('meeting:join', { meetingId, password: joinPassword }, (res) => {
            if (res?.success) {
              setBreakout((b) => (b ? { ...b, active: false } : null));
            }
          });
        });

        socket.on('breakout:broadcast', ({ content, from }) => {
          toast(`${from || 'Host'}: ${content}`, { duration: 5000, icon: '📢' });
        });

        socket.on('breakout:host-left-room', () => {
          setMyBreakout(null);
          destroyAllPeers();
          toast('Left breakout room');
        });

        socket.on('meeting:reaction', ({ emoji, displayName, socketId }) => {
          const id = `${Date.now()}-${Math.random()}`;
          setFloatingReactions((prev) => [...prev.slice(-12), { id, emoji, displayName, socketId }]);
          setTimeout(() => {
            setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
          }, 2800);
        });

        socket.on('meeting:spotlight', ({ socketId }) => {
          setSpotlightId(socketId || null);
        });

        socket.on('connect', () => setConnectionOk(true));
        socket.on('disconnect', () => setConnectionOk(false));

        socket.on('participant:raise-hand', ({ socketId, raised, displayName }) => {
          setParticipants((prev) =>
            prev.map((p) =>
              p.socketId === socketId ? { ...p, handRaised: !!raised } : p
            )
          );
          if (raised && socketId !== socket.id) {
            toast(`${displayName || 'Someone'} raised a hand`, { icon: '✋' });
          }
        });

        socket.on('meeting:waiting-join', (u) => {
          setWaiting((prev) => [...prev.filter((x) => x.socketId !== u.socketId), u]);
          toast(`${u.displayName || 'Someone'} is waiting to join`, { icon: '👤' });
        });

        socket.on('meeting:waiting-update', ({ waiting: list }) => {
          if (Array.isArray(list)) setWaiting(list);
        });

        socket.on('meeting:approved', () => {
          setPendingApproval(false);
          toast.success('You were admitted');
        });
        socket.on('recording:status', ({ recording }) => {
          setIsRecording(!!recording);
        });
        socket.on('meeting:rejected', () => {
          toast.error('Host declined your request');
          cleanup();
          navigate('/dashboard');
        });
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to join meeting');
        navigate('/dashboard');
      }
    };

    init();
    return () => {
      mounted = false;
      cleanup();
    };
  }, [meetingId]);

  const createPeer = useCallback(
    (peerId, initiator, stream, socket, initialSignal) => {
      if (peersRef.current[peerId]) return peersRef.current[peerId];
      const peer = new Peer({
        initiator,
        trickle: true,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });
      peer.on('signal', (signal) => {
        socket.emit('signal', { to: peerId, signal, meetingId });
      });
      peer.on('stream', (remoteStream) => {
        console.log('Got remote stream from', peerId, remoteStream?.getTracks?.().map((x) => x.kind));
        setRemoteStreams((prev) => ({ ...prev, [peerId]: remoteStream }));
      });
      // simple-peer sometimes fires track instead of stream
      peer.on('track', (track, remoteStream) => {
        if (remoteStream) {
          setRemoteStreams((prev) => ({ ...prev, [peerId]: remoteStream }));
        }
      });
      peer.on('error', (err) => console.warn('Peer error', peerId, err));
      peer.on('close', () => {
        delete peersRef.current[peerId];
        setRemoteStreams((prev) => {
          const next = { ...prev };
          delete next[peerId];
          return next;
        });
      });
      if (initialSignal) peer.signal(initialSignal);
      peersRef.current[peerId] = peer;
      return peer;
    },
    [meetingId]
  );

  const destroyAllPeers = () => {
    Object.values(peersRef.current).forEach((p) => {
      try { p.destroy(); } catch (_) {}
    });
    peersRef.current = {};
    setRemoteStreams({});
  };

  const cleanup = () => {
    Object.values(peersRef.current).forEach((p) => {
      try { p.destroy(); } catch (_) {}
    });
    peersRef.current = {};
    if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    if (socketRef.current) socketRef.current.disconnect();
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = muted));
    setMuted(!muted);
    socketRef.current?.emit('participant:update', { meetingId, updates: { isMuted: !muted } });
  };

  const toggleVideo = () => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = videoOff));
    setVideoOff(!videoOff);
    socketRef.current?.emit('participant:update', { meetingId, updates: { isVideoOff: !videoOff } });
  };

  const stopScreenShare = () => {
    try {
      // Stop screen tracks
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      const camStream = localStreamRef.current;
      const videoTrack = camStream?.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((peer) => {
        try {
          const sender = peer._pc?.getSenders?.().find((s) => s.track?.kind === 'video');
          if (sender && videoTrack) {
            sender.replaceTrack(videoTrack);
            // Trigger renegotiation so receivers update
            if (typeof peer.negotiate === 'function') peer.negotiate();
          }
        } catch (_) {}
      });
      if (localVideoRef.current && camStream) localVideoRef.current.srcObject = camStream;
    } catch (_) {}
    setScreenSharing(false);
    setScreenSharerId((cur) =>
      cur === socketRef.current?.id || cur === 'local' ? null : cur
    );
    socketRef.current?.emit('screen:share', { meetingId, sharing: false });
  };

  // Screen share is available to ALL participants (host and non-host)
  const toggleScreenShare = async () => {
    try {
      if (!screenSharing) {
        // Only one person should share at a time — stop if someone else is sharing
        if (screenSharerId && screenSharerId !== socketRef.current?.id) {
          toast.error('Someone else is already sharing their screen');
          return;
        }
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always', displaySurface: 'monitor' },
          audio: false,
        });
        screenStreamRef.current = screenStream;
        const videoTrack = screenStream.getVideoTracks()[0];
        Object.values(peersRef.current).forEach((peer) => {
          try {
            const sender = peer._pc?.getSenders?.().find((s) => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(videoTrack);
              if (typeof peer.negotiate === 'function') peer.negotiate();
            }
          } catch (_) {}
        });
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;
        videoTrack.onended = () => stopScreenShare();
        setScreenSharing(true);
        setScreenSharerId(socketRef.current?.id || 'local');
        socketRef.current?.emit('screen:share', { meetingId, sharing: true });
        toast.success('You are sharing your screen');
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.warn('Screen share error', err);
      toast.error('Screen share cancelled or failed');
    }
  };

  const toggleHand = () => {
    setHandRaised((prev) => {
      const next = !prev;
      socketRef.current?.emit('meeting:raise-hand', { meetingId, raised: next });
      setParticipants((list) =>
        list.map((p) =>
          p.socketId === socketRef.current?.id ? { ...p, handRaised: next } : p
        )
      );
      toast(next ? 'Hand raised' : 'Hand lowered', { icon: '✋' });
      return next;
    });
  };

  const sendChat = (e) => {
    e?.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit('chat:message', { meetingId, content: chatInput.trim() });
    setChatInput('');
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error('File too large (max 15 MB)');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('meetingId', meetingId);
      const { data } = await chatApi.upload(formData);
      const attachment = data.attachment;
      socketRef.current?.emit('chat:message', {
        meetingId,
        content: chatInput.trim() || '',
        attachments: [attachment],
      });
      setChatInput('');
      toast.success(attachment.isImage ? 'Image sent' : 'File sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const loadAttendance = async () => {
    setLoadingAttendance(true);
    try {
      const { data } = await attendanceApi.get(meetingId);
      setAttendance(data.attendance);
      setSidePanel('attendance');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoadingAttendance(false);
    }
  };

  const downloadExcel = async () => {
    try {
      const res = await attendanceApi.downloadExcel(meetingId);
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MeetLink_Attendance_${meetingId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Attendance Excel downloaded');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Download failed (host only)');
    }
  };


  const toggleRecording = async () => {
    if (!isHost) {
      toast.error('Only host can control recording');
      return;
    }
    try {
      if (!isRecording) {
        // Start MediaRecorder on local stream (client-side recording)
        const stream = localStreamRef.current;
        if (!stream) {
          toast.error('No media stream');
          return;
        }
        recordedChunksRef.current = [];
        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType: mime });
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = async () => {
          const blob = new Blob(recordedChunksRef.current, { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `MeetLink_${meetingId}_${Date.now()}.webm`;
          a.click();
          URL.revokeObjectURL(url);
          try {
            await recordingApi.stop(meetingId, { sizeBytes: blob.size });
          } catch (_) {}
          socketRef.current?.emit('recording:stopped', { meetingId });
          toast.success('Recording saved');
        };
        recorder.start(1000);
        mediaRecorderRef.current = recorder;
        await recordingApi.start(meetingId);
        socketRef.current?.emit('recording:started', { meetingId });
        setIsRecording(true);
        toast.success('Recording started');
      } else {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Recording failed');
      setIsRecording(false);
    }
  };

  const leave = () => { cleanup(); navigate('/dashboard'); };

  const endMeeting = async () => {
    if (!window.confirm('End meeting for everyone? This cannot be undone.')) return;
    try {
      // Notify everyone immediately via socket
      socketRef.current?.emit('meeting:end', { meetingId });
      try {
        await meetingApi.end(meetingId);
      } catch (apiErr) {
        console.warn('API end failed (socket may still work)', apiErr);
      }
      toast.success('Meeting ended');
      cleanup();
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end meeting');
    }
  };

  const toggleLock = () => {
    socketRef.current?.emit('meeting:lock', { meetingId, locked: !locked });
  };

  const copyId = () => {
    navigator.clipboard.writeText(meetingId);
    toast.success('Meeting ID copied');
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/join/${meetingId}`;
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied');
  };

  const sendInvites = async () => {
    const emails = inviteEmails.split(/[,\s]+/).map((e) => e.trim()).filter(Boolean);
    if (!emails.length) {
      toast.error('Enter at least one email');
      return;
    }
    try {
      await meetingApi.invite(meetingId, { emails });
      toast.success(`Invites sent to ${emails.length} address(es)`);
      setInviteEmails('');
      setShowInvite(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invite failed');
    }
  };

  const muteAll = () => {
    socketRef.current?.emit('host:mute-all', { meetingId });
    toast.success('Mute all sent');
  };

  const approveWaiting = (socketId) => {
    socketRef.current?.emit('meeting:approve', { meetingId, socketId });
    setWaiting((prev) => prev.filter((w) => w.socketId !== socketId));
    toast.success('Participant admitted');
  };

  const rejectWaiting = (socketId) => {
    socketRef.current?.emit('meeting:reject', { meetingId, socketId });
    setWaiting((prev) => prev.filter((w) => w.socketId !== socketId));
  };

  const createBreakouts = () => {
    socketRef.current?.emit('breakout:create', {
      meetingId,
      roomCount: boRoomCount,
    });
    toast.success(`Created ${boRoomCount} breakout rooms (auto-assigned)`);
  };

  const openBreakouts = () => {
    socketRef.current?.emit('breakout:open', {
      meetingId,
      timerMinutes: boTimer,
    });
  };

  const closeBreakouts = () => {
    socketRef.current?.emit('breakout:close', { meetingId });
    setMyBreakout(null);
  };

  const sendBoBroadcast = () => {
    if (!boBroadcast.trim()) return;
    socketRef.current?.emit('breakout:broadcast', {
      meetingId,
      content: boBroadcast.trim(),
    });
    setBoBroadcast('');
    toast.success('Broadcast sent to all rooms');
  };

  const hostJoinBreakout = (breakoutRoomId) => {
    destroyAllPeers();
    socketRef.current?.emit('breakout:host-join', { meetingId, breakoutRoomId });
  };

  const hostLeaveBreakout = () => {
    socketRef.current?.emit('breakout:host-leave', { meetingId });
    setMyBreakout(null);
    destroyAllPeers();
  };

  const REACTIONS = ['👍', '👏', '❤️', '😂', '🔥', '🎉', '😮', '👋'];

  const sendReaction = (emoji) => {
    socketRef.current?.emit('meeting:reaction', { meetingId, emoji });
    setShowReactions(false);
  };

  const toggleSpotlight = (socketId) => {
    if (!isHost) return;
    const next = spotlightId === socketId ? null : socketId;
    setSpotlightId(next);
    socketRef.current?.emit('meeting:spotlight', { meetingId, socketId: next });
    toast(next ? 'Participant spotlighted' : 'Spotlight cleared');
  };

  const exportChat = () => {
    if (!messages.length) {
      toast.error('No chat messages to export');
      return;
    }
    const lines = messages.map((m) => {
      const time = m.createdAt ? new Date(m.createdAt).toLocaleString() : '';
      const att = m.attachments?.length ? ` [files: ${m.attachments.map((a) => a.name || a.filename || 'file').join(', ')}]` : '';
      return `[${time}] ${m.displayName || 'User'}: ${m.content || ''}${att}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meetlink-chat-${meetingId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chat exported');
  };

  const formatElapsed = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const remoteEntries = Object.entries(remoteStreams);
  const totalInCall = participants.length + 1;

  return (
    <>
    <div className="flex h-screen flex-col bg-[#05080d]">
      <header className="flex items-center justify-between border-b border-white/5 bg-[#05080d]/60 backdrop-blur-xl px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="truncate font-semibold text-white">{meeting?.title || meetingId}</span>
          <button onClick={copyId} className="btn-ghost shrink-0 text-xs gap-1 px-2 py-1">
            <Copy className="h-3.5 w-3.5" /> {meetingId}
          </button>
          {locked && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">Locked</span>
          )}
          {isRecording && (
            <span className="badge-live flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500 rec-pulse" />
              REC
            </span>
          )}
          <span className="hidden sm:inline text-xs text-slate-500">Unlimited duration · No participant cap</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              connectionOk ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
            }`}
            title={connectionOk ? 'Connected' : 'Reconnecting…'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connectionOk ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
            {connectionOk ? 'Live' : 'Offline'}
          </span>
          <span className="tabular-nums font-medium text-white/90" title="Unlimited duration">{formatElapsed(elapsed)}</span>
          <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {totalInCall}</span>
        </div>
      </header>

      {myBreakout && (
        <div className="border-b border-violet-500/30 bg-violet-500/10 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-violet-200">
            <span className="font-semibold">Breakout:</span> {myBreakout.roomName}
            {myBreakout.asHost ? ' (host visit)' : ''}
          </p>
          {myBreakout.asHost && (
            <button type="button" className="btn-secondary text-xs" onClick={hostLeaveBreakout}>
              Return to main session
            </button>
          )}
        </div>
      )}

      {/* Host: people waiting for approval — always visible */}
      {isHost && waiting.length > 0 && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-amber-200">
              Waiting room · {waiting.length} waiting for approval
            </p>
          </div>
          <ul className="space-y-2">
            {waiting.map((w) => (
              <li
                key={w.socketId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-[#05080d]/50 px-3 py-2"
              >
                <span className="text-sm text-white font-medium">{w.displayName || 'Guest'}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveWaiting(w.socketId)}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Admit
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectWaiting(w.socketId)}
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    Deny
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Participant: waiting for host */}
      {pendingApproval && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="h-16 w-16 rounded-full border-4 border-cyan-500 border-t-transparent animate-spin" />
          <h2 className="text-xl font-semibold text-white">Waiting for host approval</h2>
          <p className="text-sm text-slate-400 max-w-sm">
            The host has been notified. You will join the meeting when they admit you.
          </p>
          <button type="button" className="btn-secondary" onClick={() => { cleanup(); navigate('/dashboard'); }}>
            Leave
          </button>
        </div>
      )}

      {!pendingApproval && (
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex flex-1 flex-col min-w-0">
                    <div className="relative flex flex-1 flex-col min-h-0 overflow-hidden p-3 gap-2">
            {/* Floating emoji reactions */}
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              {floatingReactions.map((r) => (
                <div
                  key={r.id}
                  className="absolute bottom-8 left-1/2 text-3xl animate-bounce"
                  style={{
                    transform: `translateX(${(Math.random() * 120 - 60)}px)`,
                    animationDuration: '1s',
                  }}
                  title={r.displayName}
                >
                  {r.emoji}
                </div>
              ))}
            </div>
            {/* Stage when someone is screen-sharing */}
            {(screenSharing || (screenSharerId && screenSharerId !== socketRef.current?.id) || (spotlightId && spotlightId !== socketRef.current?.id)) ? (
              <>
                <div className="relative flex-1 min-h-[240px] rounded-xl overflow-hidden bg-black border border-white/10">
                  {screenSharing ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full object-contain bg-black"
                    />
                  ) : (
                    remoteEntries
                      .filter(([sid]) => sid === (screenSharerId || spotlightId))
                      .map(([sid, stream]) => (
                        <RemoteVideo
                          key={sid}
                          stream={stream}
                          participant={participants.find((p) => p.socketId === sid)}
                          large
                          isScreen={sid === screenSharerId}
                        />
                      ))
                  )}
                  <div className={`absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    screenSharerId ? 'bg-red-600/90' : 'bg-amber-500/90'
                  }`}>
                    {screenSharerId ? 'Screen share' : 'Spotlight'}
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto shrink-0 h-28">
                  {!screenSharing && (
                    <div className="relative h-full w-40 shrink-0 overflow-hidden rounded-xl bg-[#0c121a]">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`h-full w-full object-cover ${videoOff ? 'hidden' : ''}`}
                        style={{ transform: 'scaleX(-1)' }}
                      />
                      {videoOff && (
                        <div className="flex h-full items-center justify-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-600 font-bold">
                            {(user?.displayName || 'Y')[0]}
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px]">You</div>
                    </div>
                  )}
                  {remoteEntries
                    .filter(([sid]) => sid !== screenSharerId && sid !== spotlightId)
                    .map(([sid, stream]) => (
                      <div key={sid} className="h-full w-40 shrink-0">
                        <RemoteVideo
                          stream={stream}
                          participant={participants.find((p) => p.socketId === sid)}
                          compact
                        />
                      </div>
                    ))}
                </div>
              </>
            ) : (
              /* Normal participant grid — equal tiles */
              <div
                className={`grid flex-1 min-h-0 gap-2 content-center ${
                  remoteEntries.length === 0
                    ? 'grid-cols-1 max-w-3xl mx-auto w-full'
                    : remoteEntries.length === 1
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : remoteEntries.length <= 3
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-2 lg:grid-cols-3'
                }`}
              >
                <div className="relative aspect-video overflow-hidden rounded-xl bg-[#0c121a] min-h-[160px]">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`h-full w-full object-cover ${videoOff ? 'hidden' : ''}`}
                    style={{ transform: screenSharing ? 'none' : 'scaleX(-1)' }}
                  />
                  {videoOff && (
                    <div className="flex h-full min-h-[160px] items-center justify-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cyan-600 text-2xl font-bold">
                        {(user?.displayName || 'Y')[0]}
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 rounded-lg bg-black/60 px-2 py-1 text-xs">
                    You {muted && '(muted)'} {handRaised && '✋'}
                  </div>
                </div>
                {remoteEntries.map(([sid, stream]) => (
                  <RemoteVideo
                    key={sid}
                    stream={stream}
                    participant={participants.find((p) => p.socketId === sid)}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/5 bg-[#05080d]/80 backdrop-blur-xl px-3 py-3.5">
            <ControlBtn onClick={toggleMute} active={muted} danger={muted} title="Mute">
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </ControlBtn>
            <ControlBtn onClick={toggleVideo} active={videoOff} danger={videoOff} title="Camera">
              {videoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </ControlBtn>
            <ControlBtn onClick={toggleScreenShare} active={screenSharing} title="Share screen">
              <Monitor className="h-5 w-5" />
            </ControlBtn>
            <ControlBtn onClick={toggleHand} active={handRaised} title="Raise hand">
              <Hand className="h-5 w-5" />
            </ControlBtn>
            <div className="relative">
              <ControlBtn onClick={() => setShowReactions((v) => !v)} active={showReactions} title="Reactions">
                <span className="text-lg leading-none">😊</span>
              </ControlBtn>
              {showReactions && (
                <div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 flex gap-1 rounded-2xl border border-white/10 bg-[#0c121a] p-2 shadow-xl z-30">
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="h-9 w-9 rounded-xl text-xl hover:bg-white/10"
                      onClick={() => sendReaction(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ControlBtn onClick={() => setSidePanel(sidePanel === 'chat' ? null : 'chat')} active={sidePanel === 'chat'} title="Chat">
              <MessageSquare className="h-5 w-5" />
            </ControlBtn>
            <ControlBtn onClick={() => setSidePanel(sidePanel === 'participants' ? null : 'participants')} active={sidePanel === 'participants'} title="Participants">
              <Users className="h-5 w-5" />
            </ControlBtn>
            <ControlBtn onClick={loadAttendance} active={sidePanel === 'attendance'} title="Attendance">
              <ClipboardList className="h-5 w-5" />
            </ControlBtn>
            {isHost && (
              <ControlBtn onClick={toggleLock} active={locked} title={locked ? 'Unlock' : 'Lock'}>
                {locked ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
              </ControlBtn>
            )}
            {isHost && (
              <ControlBtn onClick={muteAll} title="Mute all">
                <MicOff className="h-5 w-5" />
              </ControlBtn>
            )}
            <ControlBtn onClick={() => setShowInvite(true)} title="Invite people">
              <Mail className="h-5 w-5" />
            </ControlBtn>
            <ControlBtn onClick={copyInviteLink} title="Copy invite link">
              <Link2 className="h-5 w-5" />
            </ControlBtn>
            <ControlBtn onClick={() => setSidePanel(sidePanel === 'notes' ? null : 'notes')} active={sidePanel === 'notes'} title="Notes (N)">
              <StickyNote className="h-5 w-5" />
            </ControlBtn>
            {isHost && (
              <ControlBtn
                onClick={() => setSidePanel(sidePanel === 'breakout' ? null : 'breakout')}
                active={sidePanel === 'breakout' || breakout?.active}
                title="Breakout rooms"
              >
                <LayoutGrid className="h-5 w-5" />
              </ControlBtn>
            )}
            <ControlBtn onClick={() => setShowShortcuts(true)} title="Shortcuts (?)">
              <Keyboard className="h-5 w-5" />
            </ControlBtn>
            {isHost && (
              <ControlBtn onClick={toggleRecording} active={isRecording} danger={isRecording} title={isRecording ? 'Stop recording' : 'Start recording'}>
                <span className={`h-3.5 w-3.5 rounded-sm ${isRecording ? 'bg-white' : 'bg-red-500'}`} />
              </ControlBtn>
            )}
            <button onClick={leave} className="btn-danger rounded-full p-3 ml-1" title="Leave">
              <PhoneOff className="h-5 w-5" />
            </button>
            {isHost && (
              <button onClick={endMeeting} className="btn-danger text-xs px-4 py-2.5 font-semibold shadow-lg shadow-red-600/30">End for all</button>
            )}
          </div>
        </div>

        {sidePanel && (
          <aside className="flex w-full max-w-sm flex-col border-l border-slate-800 bg-[#0c121a] sm:w-96">
            <div className="flex items-center justify-between border-b border-white/5 bg-[#05080d]/60 backdrop-blur-xl px-4 py-3">
              <h3 className="font-semibold text-white capitalize">
                {sidePanel === 'chat' && (
                  <span className="flex items-center gap-2">
                    Chat
                    <button type="button" onClick={exportChat} className="text-[10px] font-normal text-cyan-400 hover:underline">
                      Export
                    </button>
                  </span>
                )}
                {sidePanel === 'participants' && `Participants (${totalInCall})`}
                {sidePanel === 'attendance' && 'Attendance'}
                {sidePanel === 'notes' && 'Meeting notes'}
                {sidePanel === 'breakout' && 'Breakout rooms'}
              </h3>
              <button onClick={() => setSidePanel(null)} className="btn-ghost p-1"><X className="h-4 w-4" /></button>
            </div>

            {isHost && waiting.length > 0 && (
              <div className="border-b border-slate-800 p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Waiting room</p>
                {waiting.map((w) => (
                  <div key={w.socketId} className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-200">{w.displayName}</span>
                    <div className="flex gap-1">
                      <button onClick={() => approveWaiting(w.socketId)} className="btn-primary text-xs px-2 py-1">Admit</button>
                      <button onClick={() => rejectWaiting(w.socketId)} className="btn-ghost text-xs px-2 py-1">Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sidePanel === 'chat' && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-center text-sm text-slate-500 py-8">No messages yet. Say hello or share a file!</p>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className="rounded-xl bg-[#151d2a]/80 px-3 py-2 text-sm">
                      <p className="text-xs font-medium text-cyan-400">{m.displayName}</p>
                      {m.content && <p className="mt-0.5 text-slate-200 break-words">{m.content}</p>}
                      {m.attachments?.map((att, i) => (
                        <div key={i} className="mt-2">
                          {att.isImage || att.mimeType?.startsWith('image/') ? (
                            <a href={`${API_BASE}${att.url}`} target="_blank" rel="noreferrer" className="block">
                              <img src={`${API_BASE}${att.url}`} alt={att.name} className="max-h-48 rounded-lg object-contain border border-slate-700" />
                            </a>
                          ) : (
                            <a href={`${API_BASE}${att.url}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0c121a] px-3 py-2 text-slate-300 hover:border-cyan-500">
                              <FileText className="h-4 w-4 shrink-0 text-cyan-400" />
                              <span className="truncate text-xs">{att.name}</span>
                              <Download className="h-3.5 w-3.5 shrink-0 ml-auto" />
                            </a>
                          )}
                        </div>
                      ))}
                      <p className="mt-1 text-[10px] text-slate-500">{m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : ''}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="border-t border-slate-800 p-3 space-y-2">
                  <div className="flex gap-2">
                    <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" onChange={handleFileSelect} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-secondary p-2.5" title="Attach file or image">
                      {uploading ? <span className="text-xs">…</span> : <Paperclip className="h-4 w-4" />}
                    </button>
                    <form onSubmit={sendChat} className="flex flex-1 gap-2">
                      <input className="input flex-1 py-2" placeholder="Message or attach file…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} />
                      <button type="submit" className="btn-primary px-3">Send</button>
                    </form>
                  </div>
                  <p className="text-[10px] text-slate-500">Images, PDF, Word, Excel, text, zip · max 15 MB</p>
                </div>
              </>
            )}

            {sidePanel === 'participants' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="flex items-center gap-3 rounded-xl bg-[#151d2a]/60 px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-600 text-xs font-bold">{(user?.displayName || 'Y')[0]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{user?.displayName} (You) {handRaised ? '✋' : ''}</p>
                    <p className="text-xs text-slate-500">{isHost ? 'Host' : 'Participant'}</p>
                  </div>
                </div>
                {participants.map((p) => (
                  <div key={p.socketId} className="flex items-center gap-3 rounded-xl bg-[#151d2a]/40 px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-700 text-xs font-bold">{(p.displayName || '?')[0]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">
                        {p.displayName} {p.handRaised ? '✋' : ''}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">{p.role || 'participant'}</p>
                    </div>
                    {isHost && p.role !== 'host' && (
                      <button onClick={() => socketRef.current?.emit('host:remove', { meetingId, targetSocketId: p.socketId })} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                    )}
                  </div>
                ))}
              </div>
            )}

            
            
            {sidePanel === 'breakout' && isHost && (
              <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4 min-h-0">
                <p className="text-xs text-slate-400">
                  Split participants into smaller rooms. Auto-assigns evenly. You can visit any room.
                </p>
                {!breakout?.rooms?.length ? (
                  <div className="space-y-3">
                    <div>
                      <label className="label">Number of rooms</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="input"
                        value={boRoomCount}
                        onChange={(e) => setBoRoomCount(Number(e.target.value) || 2)}
                      />
                    </div>
                    <button type="button" className="btn-primary w-full" onClick={createBreakouts}>
                      Create rooms & auto-assign
                    </button>
                  </div>
                ) : (
                  <>
                    <ul className="space-y-2">
                      {(breakout.rooms || []).map((r) => (
                        <li key={r.id} className="rounded-xl border border-slate-700 bg-[#05080d]/50 p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-white">{r.name}</p>
                            <span className="text-[10px] text-slate-500">{r.members?.length || 0} people</span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">
                            {(r.members || []).map((m) => m.displayName).join(', ') || 'Empty'}
                          </p>
                          {breakout.active && (
                            <button
                              type="button"
                              className="btn-secondary text-xs mt-2 w-full"
                              onClick={() => hostJoinBreakout(r.id)}
                            >
                              Join this room
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {!breakout.active ? (
                      <div className="space-y-2">
                        <div>
                          <label className="label">Timer (minutes, 0 = none)</label>
                          <input
                            type="number"
                            min={0}
                            className="input"
                            value={boTimer}
                            onChange={(e) => setBoTimer(Number(e.target.value) || 0)}
                          />
                        </div>
                        <button type="button" className="btn-primary w-full" onClick={openBreakouts}>
                          Open breakout rooms
                        </button>
                        <button
                          type="button"
                          className="btn-ghost w-full text-xs"
                          onClick={() => {
                            setBreakout(null);
                            socketRef.current?.emit('breakout:create', { meetingId, roomCount: 0 });
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            className="input flex-1 text-sm"
                            placeholder="Broadcast to all rooms…"
                            value={boBroadcast}
                            onChange={(e) => setBoBroadcast(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendBoBroadcast()}
                          />
                          <button type="button" className="btn-secondary text-xs" onClick={sendBoBroadcast}>
                            Send
                          </button>
                        </div>
                        <button type="button" className="btn-danger w-full" onClick={closeBreakouts}>
                          Close all breakouts
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {sidePanel === 'notes' && (
              <div className="flex flex-1 flex-col overflow-hidden min-h-0">
                <div className="p-3 border-b border-slate-800">
                  <p className="text-xs text-slate-400">
                    Private notes for this meeting. Saved in this browser only.
                  </p>
                </div>
                <textarea
                  className="flex-1 m-3 min-h-[200px] rounded-xl border border-slate-700 bg-[#05080d] p-3 text-sm text-slate-100 outline-none focus:border-cyan-500 resize-none"
                  placeholder="Action items, decisions, timestamps…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                <div className="px-3 pb-3 flex gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-xs flex-1"
                    onClick={() => {
                      setNotes('');
                      localStorage.removeItem(`meetlink_notes_${meetingId}`);
                      toast.success('Notes cleared');
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="btn-primary text-xs flex-1"
                    onClick={() => {
                      localStorage.setItem(`meetlink_notes_${meetingId}`, notes);
                      toast.success('Notes saved');
                    }}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {sidePanel === 'attendance' && (
              <div className="flex flex-1 flex-col overflow-hidden">
                {loadingAttendance ? (
                  <p className="p-6 text-center text-slate-500">Loading…</p>
                ) : attendance ? (
                  <>
                    <div className="border-b border-slate-800 p-4 space-y-1 text-sm">
                      <p className="text-white font-medium">{attendance.title}</p>
                      <p className="text-slate-400">Total participants: <span className="text-white font-semibold">{attendance.totalParticipants}</span></p>
                      <p className="text-slate-400">Currently active: <span className="text-emerald-400">{attendance.currentlyActive}</span></p>
                      {isHost && (
                        <button onClick={downloadExcel} className="btn-primary mt-3 w-full text-sm gap-2">
                          <Download className="h-4 w-4" /> Download Excel report
                        </button>
                      )}
                    </div>
                    <div className="flex-1 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-[#0c121a] text-slate-400">
                          <tr>
                            <th className="px-3 py-2">#</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Joined</th>
                            <th className="px-3 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {attendance.participants?.map((p) => {
                            // BDT (Asia/Dhaka) — e.g. 2026-08-28 02:02:46 AM
                            const formatBdt = (isoOrDate) => {
                              if (!isoOrDate || isoOrDate === 'Still in meeting') return null;
                              // Backend already sent BDT string like "2026-08-28 02:02:46 AM"
                              if (
                                typeof isoOrDate === 'string' &&
                                /^\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}:\d{2}/.test(isoOrDate) &&
                                !isoOrDate.includes('T')
                              ) {
                                return isoOrDate
                                  .replace(/(\d)(AM|PM)$/i, '$1 $2')
                                  .replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
                              }
                              const d = new Date(isoOrDate);
                              if (Number.isNaN(d.getTime())) return null;
                              const parts = new Intl.DateTimeFormat('en-GB', {
                                timeZone: 'Asia/Dhaka',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true,
                              }).formatToParts(d);
                              const get = (type) => parts.find((x) => x.type === type)?.value || '';
                              const ampm = (get('dayPeriod') || '').toUpperCase();
                              return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')} ${ampm}`;
                            };
                            const joinedDisplay =
                              formatBdt(p.joinedAtLocal) ||
                              formatBdt(p.joinedAt) ||
                              '—';
                            return (
                            <tr key={p.no} className="border-t border-slate-800/80">
                              <td className="px-3 py-2 text-slate-500">{p.no}</td>
                              <td className="px-3 py-2 text-white">
                                <div>{p.name}</div>
                                {p.email && <div className="text-[10px] text-slate-500">{p.email}</div>}
                              </td>
                              <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{joinedDisplay}</td>
                              <td className="px-3 py-2">
                                <span className={p.status === 'Active' ? 'text-emerald-400' : 'text-slate-500'}>{p.status}</span>
                              </td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="p-6 text-center text-slate-500">No attendance data</p>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
      )}
    </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#0c121a] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1">Invite by email</h3>
            <p className="text-sm text-slate-400 mb-4">Comma-separated addresses. Host only.</p>
            <textarea
              className="input min-h-[90px] mb-3"
              placeholder="topu@gmail.com, tauhid@gmail.com"
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn-secondary" onClick={() => setShowInvite(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={sendInvites}>Send invites</button>
            </div>
          </div>
        </div>
      )}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#0c121a] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-4">Keyboard shortcuts</h3>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex justify-between"><span>Mute / unmute</span><kbd className="text-xs bg-slate-800 px-2 py-0.5 rounded">M</kbd></li>
              <li className="flex justify-between"><span>Camera</span><kbd className="text-xs bg-slate-800 px-2 py-0.5 rounded">V</kbd></li>
              <li className="flex justify-between"><span>Chat</span><kbd className="text-xs bg-slate-800 px-2 py-0.5 rounded">C</kbd></li>
              <li className="flex justify-between"><span>Participants</span><kbd className="text-xs bg-slate-800 px-2 py-0.5 rounded">P</kbd></li>
              <li className="flex justify-between"><span>Notes</span><kbd className="text-xs bg-slate-800 px-2 py-0.5 rounded">N</kbd></li>
              <li className="flex justify-between"><span>Raise hand</span><kbd className="text-xs bg-slate-800 px-2 py-0.5 rounded">H</kbd></li>
              <li className="flex justify-between"><span>Shortcuts</span><kbd className="text-xs bg-slate-800 px-2 py-0.5 rounded">?</kbd></li>
            </ul>
            <button type="button" className="btn-primary w-full mt-5" onClick={() => setShowShortcuts(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}

function ControlBtn({ children, onClick, active, danger, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-full p-3 transition ${
        danger
          ? 'bg-red-600/90 text-white hover:bg-red-500'
          : active
            ? 'bg-cyan-600 text-white'
            : 'bg-[#151d2a] text-slate-200 border border-slate-700 hover:bg-[#151d2a]/80'
      }`}
    >
      {children}
    </button>
  );
}

function RemoteVideo({ stream, participant, large, compact, isScreen }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    const play = () => el.play().catch(() => {});
    play();
    stream.getTracks().forEach((track) => {
      track.addEventListener('unmute', play);
    });
    return () => {
      stream.getTracks().forEach((track) => {
        track.removeEventListener('unmute', play);
      });
    };
  }, [stream]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl bg-[#0c121a] ${
        large ? 'absolute inset-0 h-full w-full' : compact ? 'h-full w-full' : 'aspect-video min-h-[160px]'
      }`}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        className={`h-full w-full ${isScreen || large ? 'object-contain bg-black' : 'object-cover'}`}
      />
      <div className="absolute bottom-2 left-2 z-10 rounded-lg bg-black/60 px-2 py-1 text-xs text-white">
        {participant?.displayName || 'Participant'}
        {participant?.handRaised ? ' ✋' : ''}
        {isScreen ? ' · Screen' : ''}
      </div>
      {isScreen && (
        <div className="absolute top-2 left-2 z-10 rounded-md bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
          Screen share
        </div>
      )}
    </div>
  );
}
