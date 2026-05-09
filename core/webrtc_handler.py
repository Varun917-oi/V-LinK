import asyncio
import json
import logging
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaRelay

class AndroidVideoTrack(VideoStreamTrack):
    """
    A video stream track that receives frames from the Android engine.
    """
    def __init__(self):
        super().__init__()
        self.queue = asyncio.Queue()

    async def recv(self):
        timestamp, frame = await self.queue.get()
        frame.pts = timestamp
        frame.time_base = self.VIDEO_TIME_BASE
        return frame

class WebRTCHandler:
    def __init__(self):
        self.pc = None
        self.relay = MediaRelay()
        self.track = AndroidVideoTrack()

    async def create_offer(self):
        self.pc = RTCPeerConnection()
        self.pc.addTrack(self.track)
        
        offer = await self.pc.createOffer()
        await self.pc.setLocalDescription(offer)
        
        return {
            "sdp": self.pc.localDescription.sdp,
            "type": self.pc.localDescription.type
        }

    async def handle_answer(self, answer_json):
        answer = RTCSessionDescription(
            sdp=answer_json["sdp"], 
            type=answer_json["type"]
        )
        await self.pc.setRemoteDescription(answer)

    def push_frame(self, frame):
        """
        Push a frame to the WebRTC track.
        """
        asyncio.run_coroutine_threadsafe(
            self.track.queue.put((int(time.time() * 1000), frame)),
            asyncio.get_event_loop()
        )

    async def stop(self):
        if self.pc:
            await self.pc.close()
