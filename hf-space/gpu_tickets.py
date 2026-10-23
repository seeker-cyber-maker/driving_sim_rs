"""One-use, short-lived in-memory inputs for a queued GPU lease.

Only opaque tickets enter the Gradio queue, never track/network bytes. This
store is not persistent and must be cleared by the owning application's lifespan.
"""
import secrets
import threading
import time
from training_config import validate_config

class InputTickets:
    def __init__(self,clock=time.monotonic):
        self.clock=clock
        self.lock=threading.RLock()
        self.pending={}

    def expire(self):
        with self.lock:
            for ticket,item in list(self.pending.items()):
                if self.clock()>=item[0]:del self.pending[ticket]

    def put(self,track,network,automatic,config=None):
        if not isinstance(track,bytes) or not isinstance(network,bytes):raise ValueError('Expected bytes')
        if not track or not network or max(len(track),len(network))>1024*1024:raise ValueError('Input size')
        if type(automatic) is not bool:raise ValueError('Automatic mode')
        if config is not None:config=validate_config(config, work_limit=8_000_000)
        with self.lock:
            self.expire()
            if self.pending:raise RuntimeError('GPU input capacity reached')
            ticket=secrets.token_urlsafe(32)
            self.pending[ticket]=(self.clock()+120,track,network,automatic)
            if config is not None:self.pending[ticket]+= (config,)
            return ticket

    def take(self,ticket):
        with self.lock:
            self.expire()
            if ticket not in self.pending:raise ValueError('GPU input unavailable')
            return self.pending.pop(ticket)[1:]

    def discard(self,ticket):
        with self.lock:
            self.expire()
            return self.pending.pop(ticket,None) is not None

    def clear(self):
        with self.lock:self.pending.clear()
