import asyncio
import time
from typing import Optional
import tiktoken

class APIRateLimiter:
    def __init__(self, tokens_per_minute: int = 40000):
        self.tokens_per_minute = tokens_per_minute
        self.token_bucket = tokens_per_minute
        self.last_update = time.time()
        self.lock = asyncio.Lock()
        self.encoder = tiktoken.get_encoding("cl100k_base")
        print("✓ Rate Limiter initialized")
        
    async def wait_for_tokens(self, text: str) -> None:
        """Wait until enough tokens are available for the text."""
        num_tokens = len(self.encoder.encode(text))
        print(f"\nRequest for {num_tokens} tokens (current bucket: {self.token_bucket})")
        
        async with self.lock:
            # If request is larger than tokens_per_minute, we need multiple minutes
            if num_tokens > self.tokens_per_minute:
                minutes_needed = num_tokens / self.tokens_per_minute
                wait_time = minutes_needed * 60
                print(f"Large request detected. Waiting {wait_time:.2f} seconds for full replenishment...")
                await asyncio.sleep(wait_time)
                self.token_bucket = self.tokens_per_minute
                self.last_update = time.time()
                self.token_bucket -= num_tokens
                print(f"✓ Tokens available after wait. Used {num_tokens} tokens.")
                return
            
            while True:
                current_time = time.time()
                time_passed = current_time - self.last_update
                
                # Replenish tokens based on time passed
                tokens_to_add = int(time_passed * (self.tokens_per_minute / 60))
                old_bucket = self.token_bucket
                self.token_bucket = min(
                    self.tokens_per_minute,
                    self.token_bucket + tokens_to_add
                )
                
                if tokens_to_add > 0:
                    print(f"Added {tokens_to_add} tokens. Bucket: {old_bucket} -> {self.token_bucket}")
                
                self.last_update = current_time
                
                if num_tokens <= self.token_bucket:
                    self.token_bucket -= num_tokens
                    print(f"✓ Tokens available. Using {num_tokens} tokens. {self.token_bucket} tokens remaining")
                    break
                
                # Calculate wait time needed for enough tokens
                tokens_needed = num_tokens - self.token_bucket
                wait_time = (tokens_needed / self.tokens_per_minute) * 60
                print(f"Waiting {wait_time:.2f} seconds for {tokens_needed} more tokens...")
                await asyncio.sleep(wait_time)